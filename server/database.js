const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/streaming_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📺',
        color TEXT NOT NULL DEFAULT '#6c5ce7',
        max_profiles INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        provider_name TEXT NOT NULL DEFAULT '',
        provider_phone TEXT NOT NULL DEFAULT '',
        cost DECIMAL(10,2) NOT NULL DEFAULT 0,
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        profile_name TEXT NOT NULL,
        pin TEXT DEFAULT '',
        client_name TEXT NOT NULL DEFAULT '',
        client_whatsapp TEXT NOT NULL DEFAULT '',
        sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        expiry_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS renewals (
        id SERIAL PRIMARY KEY,
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
        sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        renewal_type TEXT NOT NULL DEFAULT 'profile',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await migrateProfilesTable(client);
    await migrateRenewalsTable(client);

    // Seed admin user if not exists
    const adminResult = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminResult.rows.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
      console.log('✅ Admin user created (admin / admin123)');
    }

    // Seed default platforms if none exist
    const platformResult = await client.query('SELECT COUNT(*) as count FROM platforms');
    if (parseInt(platformResult.rows[0].count) === 0) {
      const platforms = [
        { name: 'Netflix', icon: '🎬', color: '#E50914', max_profiles: 5 },
        { name: 'Disney+', icon: '🏰', color: '#113CCF', max_profiles: 7 },
        { name: 'Prime Video', icon: '📦', color: '#00A8E1', max_profiles: 6 },
        { name: 'HBO Max', icon: '🎭', color: '#B834DB', max_profiles: 5 },
        { name: 'Spotify', icon: '🎵', color: '#1DB954', max_profiles: 6 },
      ];
      for (const p of platforms) {
        await client.query('INSERT INTO platforms (name, icon, color, max_profiles) VALUES ($1, $2, $3, $4)',
          [p.name, p.icon, p.color, p.max_profiles]);
      }
      console.log('✅ Default platforms seeded');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    client.release();
  }
}

async function migrateProfilesTable(client) {
  try {
    // Check if is_active column exists
    const columnResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'is_active'
    `);
    if (columnResult.rows.length === 0) {
      await client.query('ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true');
    }
  } catch (err) {
    console.log('Migration check for profiles table:', err.message);
  }
}

async function migrateRenewalsTable(client) {
  try {
    // Check if account_id column exists
    const columnResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'renewals' AND column_name = 'account_id'
    `);
    if (columnResult.rows.length === 0) {
      // Add missing columns
      await client.query(`
        ALTER TABLE renewals ADD COLUMN account_id INTEGER,
        ADD COLUMN account_email TEXT NOT NULL DEFAULT '',
        ADD COLUMN platform_id INTEGER,
        ADD COLUMN platform_name TEXT NOT NULL DEFAULT '',
        ADD COLUMN platform_icon TEXT NOT NULL DEFAULT '',
        ADD COLUMN platform_color TEXT NOT NULL DEFAULT '',
        ADD COLUMN profile_name TEXT NOT NULL DEFAULT '',
        ADD COLUMN client_name TEXT NOT NULL DEFAULT '',
        ADD COLUMN client_whatsapp TEXT NOT NULL DEFAULT '',
        ADD COLUMN old_expiry_date DATE,
        ADD COLUMN renewal_type TEXT NOT NULL DEFAULT 'profile'
      `);
    }
  } catch (err) {
    console.log('Migration check for renewals table:', err.message);
  }
}

module.exports = { pool, initializeDatabase };
