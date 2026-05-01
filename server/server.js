const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');
const db = require('./database');

const app = express();

// Bug Fix: Auto-create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// Bug Fix: Lazy Twilio init — only create client if real credentials exist
// Prevents crash on startup when credentials are placeholder values
const getTwilioClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    // Preference: API Key > Auth Token
    if (apiKeySid && apiKeySecret && !apiKeySid.includes('xxx')) {
        return twilio(apiKeySid, apiKeySecret, { accountSid: accountSid });
    }

    if (accountSid && authToken && !accountSid.includes('xxx') && !authToken.includes('xxx')) {
        return twilio(accountSid, authToken);
    }
    
    return null;
};

// Middleware for JWT verification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Bug Fix: JWT now expires in 8 hours
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get Contacts
app.get('/api/contacts', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM contacts`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ contacts: rows });
    });
});

// Add Contact
app.post('/api/contacts', authenticateToken, (req, res) => {
    const { name, phone } = req.body;
    db.run(`INSERT INTO contacts (name, phone) VALUES (?, ?)`, [name, phone], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, phone });
    });
});

// Upload Contacts
app.post('/api/contacts/upload', authenticateToken, upload.single('file'), (req, res) => {
    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            let inserted = 0;
            let skipped = 0;
            
            const processBatch = async () => {
                for (const row of results) {
                    const name = row.name || row.Name || 'Unknown';
                    const phone = row.phone || row.Phone || row.number || '';
                    
                    if (phone) {
                        try {
                            await new Promise((resolve, reject) => {
                                db.run(`INSERT INTO contacts (name, phone) VALUES (?, ?)`, [name, phone], function(err) {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });
                            inserted++;
                        } catch (e) {
                            skipped++;
                        }
                    } else {
                        skipped++;
                    }
                }
                fs.unlinkSync(req.file.path);
                res.json({ inserted, skipped });
            };
            
            processBatch();
        });
});

// Delete Contact
app.delete('/api/contacts/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM contacts WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Send SMS
app.post('/api/send-sms', authenticateToken, async (req, res) => {
    const { message, contactIds } = req.body;

    if (!message || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'message and contactIds are required' });
    }
    
    try {
        // Bug Fix: Use parameterized placeholders to prevent SQL injection
        const placeholders = contactIds.map(() => '?').join(',');
        db.all(`SELECT phone FROM contacts WHERE id IN (${placeholders})`, contactIds, async (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const numbers = rows.map(r => r.phone);
            let successCount = 0;
            let failCount = 0;

            // Bug Fix: Use lazy Twilio client, fallback to simulation if no real creds
            const twilioClient = getTwilioClient();

            for (const number of numbers) {
                try {
                    if (twilioClient) {
                        await twilioClient.messages.create({
                            body: message,
                            from: process.env.TWILIO_PHONE_NUMBER,
                            to: number
                        });
                    } else {
                        // Simulation mode — no real Twilio credentials
                        console.log(`[SIMULATION] SMS to ${number}: ${message}`);
                    }
                    successCount++;
                } catch (e) {
                    console.error(`Failed to send to ${number}:`, e.message);
                    failCount++;
                }
            }

            const status = successCount > 0 ? 'Sent' : 'Failed';
            db.run(`INSERT INTO history (message, recipients_count, status) VALUES (?, ?, ?)`, 
                [message, numbers.length, status], 
                function(err) {
                    if (err) console.error("History insert error:", err);
                    
                    res.json({
                        status: status,
                        sent: successCount,
                        failed: failCount
                    });
                }
            );
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get History
app.get('/api/history', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM history ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ history: rows });
    });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
