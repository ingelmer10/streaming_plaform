const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'streaming.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📺',
      color TEXT NOT NULL DEFAULT '#6c5ce7',
      max_profiles INTEGER NOT NULL DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT '',
      provider_phone TEXT NOT NULL DEFAULT '',
      cost REAL NOT NULL DEFAULT 0,
      expiry_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      profile_name TEXT NOT NULL,
      pin TEXT DEFAULT '',
      client_name TEXT NOT NULL DEFAULT '',
      client_whatsapp TEXT NOT NULL DEFAULT '',
      sale_price REAL NOT NULL DEFAULT 0,
      expiry_date DATE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS renewals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      account_id INTEGER,
      account_email TEXT NOT NULL DEFAULT '',
      platform_id INTEGER,
      platform_name TEXT NOT NULL DEFAULT '',
      platform_icon TEXT NOT NULL DEFAULT '',
      platform_color TEXT NOT NULL DEFAULT '',
      profile_name TEXT NOT NULL DEFAULT '',
      client_name TEXT NOT NULL DEFAULT '',
      client_whatsapp TEXT NOT NULL DEFAULT '',
      old_expiry_date DATE,
      new_expiry_date DATE NOT NULL,
      sale_price REAL NOT NULL DEFAULT 0,
      renewal_type TEXT NOT NULL DEFAULT 'profile',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  migrateProfilesTable();
  migrateRenewalsTable();

  // Seed admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
    console.log('✅ Admin user created (admin / admin123)');
  }

  // Seed default platforms if none exist
  const platformCount = db.prepare('SELECT COUNT(*) as count FROM platforms').get();
  if (platformCount.count === 0) {
    const platforms = [
      { name: 'Netflix', icon: '🎬', color: '#E50914', max_profiles: 5 },
      { name: 'Disney+', icon: '🏰', color: '#113CCF', max_profiles: 7 },
      { name: 'Prime Video', icon: '📦', color: '#00A8E1', max_profiles: 6 },
      { name: 'HBO Max', icon: '🎭', color: '#B834DB', max_profiles: 5 },
      { name: 'Spotify', icon: '🎵', color: '#1DB954', max_profiles: 6 },
    ];
    const insert = db.prepare('INSERT INTO platforms (name, icon, color, max_profiles) VALUES (?, ?, ?, ?)');
    for (const p of platforms) {
      insert.run(p.name, p.icon, p.color, p.max_profiles);
    }
    console.log('✅ Default platforms seeded');
  }
}

function migrateRenewalsTable() {
  const columns = db.prepare(`PRAGMA table_info(renewals)`).all();
  const hasAccountId = columns.some(c => c.name === 'account_id');
  const hasRenewalType = columns.some(c => c.name === 'renewal_type');

  if (!hasAccountId || !hasRenewalType) {
    db.exec('BEGIN TRANSACTION;');
    db.exec(`
      CREATE TABLE renewals_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER,
        account_id INTEGER,
        account_email TEXT NOT NULL DEFAULT '',
        platform_id INTEGER,
        platform_name TEXT NOT NULL DEFAULT '',
        platform_icon TEXT NOT NULL DEFAULT '',
        platform_color TEXT NOT NULL DEFAULT '',
        profile_name TEXT NOT NULL DEFAULT '',
        client_name TEXT NOT NULL DEFAULT '',
        client_whatsapp TEXT NOT NULL DEFAULT '',
        old_expiry_date DATE,
        new_expiry_date DATE NOT NULL,
        sale_price REAL NOT NULL DEFAULT 0,
        renewal_type TEXT NOT NULL DEFAULT 'profile',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const renewalTypeExpression = hasRenewalType ? "COALESCE(r.renewal_type, 'profile')" : "'profile'";
    db.prepare(`
      INSERT INTO renewals_new (
        id, profile_id, account_id, account_email, platform_id, platform_name, platform_icon, platform_color,
        profile_name, client_name, client_whatsapp, old_expiry_date, new_expiry_date, sale_price, renewal_type, created_at
      )
      SELECT
        r.id,
        r.profile_id,
        a.id,
        COALESCE(a.email, ''),
        pl.id,
        COALESCE(pl.name, ''),
        COALESCE(pl.icon, ''),
        COALESCE(pl.color, ''),
        COALESCE(p.profile_name, ''),
        COALESCE(p.client_name, ''),
        COALESCE(p.client_whatsapp, ''),
        r.old_expiry_date,
        r.new_expiry_date,
        r.sale_price,
        ${renewalTypeExpression},
        r.created_at
      FROM renewals r
      LEFT JOIN profiles p ON p.id = r.profile_id
      LEFT JOIN accounts a ON a.id = p.account_id
      LEFT JOIN platforms pl ON pl.id = a.platform_id
    `).run();

    db.exec(`
      DROP TABLE renewals;
      ALTER TABLE renewals_new RENAME TO renewals;
    `);
    db.exec('COMMIT;');
  }
}

function migrateProfilesTable() {
  const columns = db.prepare(`PRAGMA table_info(profiles)`).all();
  const hasIsActive = columns.some(c => c.name === 'is_active');
  if (hasIsActive) return;
  db.exec('ALTER TABLE profiles ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
}

module.exports = { db, initializeDatabase };
