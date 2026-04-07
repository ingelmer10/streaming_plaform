const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/accounts/platform/:platformId - List accounts for a platform
router.get('/platform/:platformId', (req, res) => {
  const accounts = db.prepare(`
    SELECT 
      a.*,
      COUNT(CASE WHEN p.is_active = 1 THEN p.id END) as profile_count,
      COALESCE(SUM(CASE WHEN p.is_active = 1 THEN p.sale_price ELSE 0 END), 0) + COALESCE(
        (SELECT SUM(r.sale_price) FROM renewals r WHERE r.account_id = a.id AND r.renewal_type = 'profile'),
        0
      ) as total_revenue
    FROM accounts a
    LEFT JOIN profiles p ON p.account_id = a.id
    WHERE a.platform_id = ?
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all(req.params.platformId);

  res.json(accounts);
});

// GET /api/accounts/:id - Get single account
router.get('/:id', (req, res) => {
  const account = db.prepare(`
    SELECT 
      a.*,
      p.name as platform_name,
      p.icon as platform_icon,
      p.color as platform_color,
      p.max_profiles,
      COUNT(CASE WHEN pr.is_active = 1 THEN pr.id END) as profile_count,
      COALESCE(SUM(CASE WHEN pr.is_active = 1 THEN pr.sale_price ELSE 0 END), 0) + COALESCE(
        (SELECT SUM(r.sale_price) FROM renewals r WHERE r.account_id = a.id AND r.renewal_type = 'profile'),
        0
      ) as total_revenue
    FROM accounts a
    JOIN platforms p ON p.id = a.platform_id
    LEFT JOIN profiles pr ON pr.account_id = a.id
    WHERE a.id = ?
    GROUP BY a.id
  `).get(req.params.id);

  if (!account) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  res.json(account);
});

// POST /api/accounts - Create account
router.post('/', (req, res) => {
  const { platform_id, email, password, provider_name, provider_phone, cost, expiry_date } = req.body;

  if (!platform_id || !email || !password) {
    return res.status(400).json({ error: 'platform_id, email y password son requeridos' });
  }

  const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platform_id);
  if (!platform) {
    return res.status(404).json({ error: 'Plataforma no encontrada' });
  }

  const result = db.prepare(
    'INSERT INTO accounts (platform_id, email, password, provider_name, provider_phone, cost, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(platform_id, email, password, provider_name || '', provider_phone || '', cost || 0, expiry_date || null);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(account);
});

// PUT /api/accounts/:id - Update account
router.put('/:id', (req, res) => {
  const { email, password, provider_name, provider_phone, cost, expiry_date } = req.body;
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  db.prepare(
    'UPDATE accounts SET email = ?, password = ?, provider_name = ?, provider_phone = ?, cost = ?, expiry_date = ? WHERE id = ?'
  ).run(
    email || existing.email,
    password || existing.password,
    provider_name ?? existing.provider_name,
    provider_phone ?? existing.provider_phone,
    cost !== undefined ? cost : existing.cost,
    expiry_date !== undefined ? expiry_date : existing.expiry_date,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /api/accounts/:id/renew - Renew account expiry and log provider cost
router.post('/:id/renew', (req, res) => {
  const { new_expiry_date, renewal_cost } = req.body;
  const existing = db.prepare(`
    SELECT a.*, p.id as platform_id, p.name as platform_name, p.icon as platform_icon, p.color as platform_color
    FROM accounts a
    JOIN platforms p ON p.id = a.platform_id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  if (!new_expiry_date) {
    return res.status(400).json({ error: 'La nueva fecha de vencimiento es requerida' });
  }

  const cost = renewal_cost !== undefined ? renewal_cost : 0;

  db.prepare(
    'INSERT INTO renewals (profile_id, account_id, account_email, platform_id, platform_name, platform_icon, platform_color, profile_name, client_name, client_whatsapp, old_expiry_date, new_expiry_date, sale_price, renewal_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    null,
    existing.id,
    existing.email,
    existing.platform_id,
    existing.platform_name,
    existing.platform_icon,
    existing.platform_color,
    '',
    '',
    '',
    existing.expiry_date,
    new_expiry_date,
    cost,
    'account'
  );

  db.prepare('UPDATE accounts SET expiry_date = ? WHERE id = ?').run(new_expiry_date, req.params.id);

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/accounts/:id - Delete account (cascade)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Cuenta eliminada correctamente' });
});

module.exports = router;
