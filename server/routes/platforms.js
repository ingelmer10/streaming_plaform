const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/platforms - List all platforms with stats (including expiry alerts)
router.get('/', (req, res) => {
  const platforms = db.prepare(`
    SELECT 
      p.*,
      COUNT(DISTINCT a.id) as account_count,
      COUNT(DISTINCT pr.id) as profile_count
    FROM platforms p
    LEFT JOIN accounts a ON a.platform_id = p.id
    LEFT JOIN profiles pr ON pr.account_id = a.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();

  // Add expiry stats for each platform
  for (const p of platforms) {
    const expiryStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date <= date('now') THEN 1 END) as expired_accounts,
        COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date > date('now') AND a.expiry_date <= date('now', '+7 days') THEN 1 END) as expiring_soon_accounts,
        COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date <= date('now') THEN 1 END) as expired_profiles,
        COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date > date('now') AND pr.expiry_date <= date('now', '+7 days') THEN 1 END) as expiring_soon_profiles
      FROM accounts a
      LEFT JOIN profiles pr ON pr.account_id = a.id
      WHERE a.platform_id = ?
    `).get(p.id);
    Object.assign(p, expiryStats);
  }

  res.json(platforms);
});

// GET /api/platforms/:id - Get single platform with stats
router.get('/:id', (req, res) => {
  const platform = db.prepare(`
    SELECT 
      p.*,
      COUNT(DISTINCT a.id) as account_count,
      COUNT(DISTINCT pr.id) as profile_count
    FROM platforms p
    LEFT JOIN accounts a ON a.platform_id = p.id
    LEFT JOIN profiles pr ON pr.account_id = a.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(req.params.id);

  if (!platform) {
    return res.status(404).json({ error: 'Plataforma no encontrada' });
  }

  // Add expiry stats
  const expiryStats = db.prepare(`
    SELECT
      COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date <= date('now') THEN 1 END) as expired_accounts,
      COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date > date('now') AND a.expiry_date <= date('now', '+7 days') THEN 1 END) as expiring_soon_accounts,
      COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date <= date('now') THEN 1 END) as expired_profiles,
      COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date > date('now') AND pr.expiry_date <= date('now', '+7 days') THEN 1 END) as expiring_soon_profiles
    FROM accounts a
    LEFT JOIN profiles pr ON pr.account_id = a.id
    WHERE a.platform_id = ?
  `).get(req.params.id);
  Object.assign(platform, expiryStats);

  res.json(platform);
});

// POST /api/platforms - Create platform
router.post('/', (req, res) => {
  const { name, icon, color, max_profiles } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const result = db.prepare(
    'INSERT INTO platforms (name, icon, color, max_profiles) VALUES (?, ?, ?, ?)'
  ).run(name, icon || '📺', color || '#6c5ce7', max_profiles || 5);

  const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(platform);
});

// PUT /api/platforms/:id - Update platform
router.put('/:id', (req, res) => {
  const { name, icon, color, max_profiles } = req.body;
  const existing = db.prepare('SELECT * FROM platforms WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Plataforma no encontrada' });
  }

  db.prepare(
    'UPDATE platforms SET name = ?, icon = ?, color = ?, max_profiles = ? WHERE id = ?'
  ).run(
    name || existing.name,
    icon || existing.icon,
    color || existing.color,
    max_profiles || existing.max_profiles,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM platforms WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/platforms/:id - Delete platform (cascade)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM platforms WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Plataforma no encontrada' });
  }

  db.prepare('DELETE FROM platforms WHERE id = ?').run(req.params.id);
  res.json({ message: 'Plataforma eliminada correctamente' });
});

module.exports = router;
