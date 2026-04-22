require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const multer = require('multer');
const fs = require('fs');
const csvParser = require('csv-parser');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Initialize Twilio Client only if valid credentials exist
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// ----------------------
// Auth Middleware
// ----------------------
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// ----------------------
// Login Endpoint
// ----------------------
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username });
    } else {
        res.status(401).json({ error: 'Invalid username or password' });
    }
});

// ----------------------
// Contacts API Endpoints
// ----------------------

// Get all contacts
app.get('/api/contacts', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM contacts`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ contacts: rows });
    });
});

// Add single contact
app.post('/api/contacts', authenticateToken, (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    db.run(`INSERT INTO contacts (name, phone) VALUES (?, ?)`, [name, phone], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Contact with this phone already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, name, phone });
    });
});

// Upload CSV of contacts
app.post('/api/contacts/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            fs.unlinkSync(req.file.path);
            
            let insertedCount = 0;
            let errors = [];
            
            const stmt = db.prepare(`INSERT OR IGNORE INTO contacts (name, phone) VALUES (?, ?)`);
            
            results.forEach(row => {
                const name = row.name || row.Name || row.NAME;
                const phone = row.phone || row.Phone || row.PHONE;
                
                if (name && phone) {
                    stmt.run([name, phone], function(err) {
                        if (!err && this.changes > 0) insertedCount++;
                    });
                } else {
                    errors.push(row);
                }
            });
            
            stmt.finalize(() => {
                res.json({ 
                    message: 'Upload complete', 
                    inserted: insertedCount,
                    skipped: results.length - insertedCount
                });
            });
        });
});

// Delete single contact
app.delete('/api/contacts/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM contacts WHERE id = ?`, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });
        res.json({ message: 'Contact deleted successfully' });
    });
});

// ----------------------
// Messaging API Endpoints
// ----------------------

// Send batch SMS
app.post('/api/send', authenticateToken, async (req, res) => {
    const { message, contactIds } = req.body;
    if (!message || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'Invalid message or contacts array' });
    }

    if (!twilioClient) {
         return res.status(500).json({ error: 'Twilio is not configured. Please check .env file.' });
    }

    try {
        const placeholders = contactIds.map(() => '?').join(',');
        db.all(`SELECT phone FROM contacts WHERE id IN (${placeholders})`, contactIds, async (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const numbers = rows.map(r => r.phone);
            if (numbers.length === 0) return res.status(400).json({ error: 'No valid contacts found' });

            let successCount = 0;
            let failCount = 0;

            for (const phone of numbers) {
                try {
                    await twilioClient.messages.create({
                        body: message,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: phone
                    });
                    successCount++;
                } catch (sendErr) {
                    console.error(`Failed to send to ${phone}`, sendErr.message);
                    failCount++;
                }
            }

            const status = failCount === 0 ? 'Sent' : (successCount === 0 ? 'Failed' : 'Partial Warning');

            db.run(`INSERT INTO history (message, recipients_count, status) VALUES (?, ?, ?)`, 
                [message, numbers.length, status], 
                function(err) {
                    if (err) console.error("History insert error:", err);
                    
                    res.json({
                        success: true,
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

const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
module.exports = app;
