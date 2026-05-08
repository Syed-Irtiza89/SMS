// ============================================================
// server.js — Twilio SMS System Backend
// Fixed: duplicate 'path' require, Render compatibility,
//        no recipient limit, batched concurrent sends,
//        safe file cleanup, proper CORS config
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const twilio = require('twilio');
const db = require('./database');

const app = express();

// ── Uploads directory (use /tmp on Render, local otherwise) ──
const uploadsDir = process.env.RENDER
    ? '/tmp/uploads'
    : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

// ── CORS ─────────────────────────────────────────────────────
// Allow any origin so the React frontend (wherever it's hosted) can connect
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// ── Config ───────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// ── Twilio Client (lazy, safe) ────────────────────────────────
// Only initialises if real credentials are provided.
// Falls back to simulation mode so the app still runs without Twilio creds.
const getTwilioClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    // Prefer Auth Token auth
    if (accountSid && authToken &&
        !accountSid.includes('xxx') && !authToken.includes('xxx') &&
        accountSid.startsWith('AC')) {
        return twilio(accountSid, authToken);
    }

    // Fall back to API Key auth
    if (apiKeySid && apiKeySecret &&
        !apiKeySid.includes('xxx') && !apiKeySecret.includes('xxx')) {
        return twilio(apiKeySid, apiKeySecret, { accountSid });
    }

    return null; // simulation mode
};

// ── JWT Middleware ────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// ── Helper: safe file delete ──────────────────────────────────
const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.warn('Could not delete temp file:', filePath, e.message);
    }
};

// ── Helper: send SMS with concurrency ────────────────────────
// Sends in parallel batches of `batchSize` to avoid request timeouts
// while still being respectful of Twilio rate limits.
const sendSmsBatch = async (twilioClient, numbers, message, batchSize = 10) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < numbers.length; i += batchSize) {
        const batch = numbers.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(number => {
                if (twilioClient) {
                    return twilioClient.messages.create({
                        body: message,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: number
                    });
                } else {
                    // Simulation mode — log and resolve immediately
                    console.log(`[SIMULATION] SMS to ${number}: ${message}`);
                    return Promise.resolve({ sid: 'SIMULATED' });
                }
            })
        );

        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                successCount++;
            } else {
                failCount++;
                const errMsg = result.reason?.message || 'Unknown error';
                console.error(`Failed to send to ${batch[idx]}:`, errMsg);
                errors.push({ number: batch[idx], error: errMsg });
            }
        });

        // Small delay between batches to avoid hammering the API
        if (i + batchSize < numbers.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return { successCount, failCount, errors };
};

// ════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════

// ── Health check (useful for Render & uptime monitors) ───────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Login ─────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ── Get Contacts ──────────────────────────────────────────────
app.get('/api/contacts', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM contacts ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ contacts: rows });
    });
});

// ── Add Contact ───────────────────────────────────────────────
app.post('/api/contacts', authenticateToken, (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }
    db.run(`INSERT INTO contacts (name, phone) VALUES (?, ?)`, [name, phone], function(err) {
        if (err) {
            // Duplicate phone number
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'This phone number already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, name, phone });
    });
});

// ── Upload Contacts via CSV ───────────────────────────────────
app.post('/api/contacts/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('error', (err) => {
            safeUnlink(filePath);
            res.status(500).json({ error: 'Failed to parse CSV: ' + err.message });
        })
        .on('end', async () => {
            let inserted = 0;
            let skipped = 0;

            for (const row of results) {
                const name = (row.name || row.Name || row.NAME || '').trim() || 'Unknown';
                const phone = (row.phone || row.Phone || row.PHONE || row.number || row.Number || '').trim();

                if (!phone) { skipped++; continue; }

                try {
                    await new Promise((resolve, reject) => {
                        db.run(
                            `INSERT OR IGNORE INTO contacts (name, phone) VALUES (?, ?)`,
                            [name, phone],
                            function(err) {
                                if (err) reject(err);
                                else {
                                    if (this.changes === 0) skipped++; // duplicate
                                    else inserted++;
                                    resolve();
                                }
                            }
                        );
                    });
                } catch (e) {
                    skipped++;
                }
            }

            safeUnlink(filePath);
            res.json({ inserted, skipped, total: results.length });
        });
});

// ── Delete Contact ────────────────────────────────────────────
app.delete('/api/contacts/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid contact ID' });

    db.run(`DELETE FROM contacts WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });
        res.json({ success: true });
    });
});

// ── Send SMS ─────────────────────────────────────────────────
// No hard limit on recipients — sends in concurrent batches of 10.
// Immediately responds; large sends just take proportionally longer.
app.post('/api/send-sms', authenticateToken, async (req, res) => {
    const { message, contactIds } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message text is required' });
    }
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'At least one contact must be selected' });
    }

    try {
        const placeholders = contactIds.map(() => '?').join(',');
        db.all(
            `SELECT id, phone FROM contacts WHERE id IN (${placeholders})`,
            contactIds,
            async (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                if (rows.length === 0) {
                    return res.status(404).json({ error: 'No matching contacts found' });
                }

                const numbers = rows.map(r => r.phone);
                const twilioClient = getTwilioClient();

                const { successCount, failCount, errors } = await sendSmsBatch(
                    twilioClient,
                    numbers,
                    message.trim()
                );

                const status = successCount > 0 ? 'Sent' : 'Failed';

                db.run(
                    `INSERT INTO history (message, recipients_count, status) VALUES (?, ?, ?)`,
                    [message.trim(), numbers.length, status],
                    function(histErr) {
                        if (histErr) console.error('History insert error:', histErr.message);

                        res.json({
                            status,
                            sent: successCount,
                            failed: failCount,
                            total: numbers.length,
                            simulation: twilioClient === null,
                            errors: errors.length > 0 ? errors : undefined
                        });
                    }
                );
            }
        );
    } catch (e) {
        console.error('Send SMS error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ── Get History ───────────────────────────────────────────────
app.get('/api/history', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM history ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ history: rows });
    });
});

// ── Serve React build (production) ───────────────────────────
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // In dev mode without a built frontend, just return a JSON message
    app.get('/', (req, res) => {
        res.json({ message: 'SMS API server is running. Build the React frontend to serve it here.' });
    });
}

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   Twilio mode: ${getTwilioClient() ? 'LIVE' : 'SIMULATION'}`);
    console.log(`   DB path: ${process.env.RENDER ? '/tmp/sms_system.db' : path.join(__dirname, 'sms_system.db')}`);
});
