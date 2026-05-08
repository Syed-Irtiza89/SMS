const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// On Render (and similar PaaS), the app directory is read-only.
// Use /tmp for writable storage, or a custom DB_PATH env var.
const resolveDbPath = () => {
    if (process.env.DB_PATH) return process.env.DB_PATH;
    if (process.env.RENDER) return '/tmp/sms_system.db';
    return path.resolve(__dirname, 'sms_system.db');
};

const dbPath = resolveDbPath();

// Ensure the directory exists (important for custom DB_PATH)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
        process.exit(1); // Fatal — can't run without DB
    } else {
        console.log(`✅ Connected to SQLite database at: ${dbPath}`);

        // Enable WAL mode for better concurrent read/write performance
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA foreign_keys = ON');

        // Create Contacts Table
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT    NOT NULL,
            phone TEXT    NOT NULL UNIQUE
        )`, (err) => {
            if (err) console.error('Error creating contacts table:', err.message);
        });

        // Create History Table
        db.run(`CREATE TABLE IF NOT EXISTS history (
            id               INTEGER  PRIMARY KEY AUTOINCREMENT,
            message          TEXT     NOT NULL,
            recipients_count INTEGER,
            status           TEXT,
            timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating history table:', err.message);
        });
    }
});

module.exports = db;
