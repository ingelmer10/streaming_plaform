const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/profiles/account/:accountId - List profiles for an account
router.get('/account/:accountId', (req, res) => {
  const profiles = db.prepare(`
    SELECT p.*,
      a.email as account_email,
      a.cost as account_cost,
      pl.name as platform_name,
      pl.icon as platform_icon,
      pl.color as platform_color
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    JOIN platforms pl ON pl.id = a.platform_id
    WHERE p.account_id = ? AND p.is_active = 1
    ORDER BY p.created_at DESC
  `).all(req.params.accountId);

  res.json(profiles);
});

// GET /api/profiles/:id - Get single profile
router.get('/:id', (req, res) => {
  const profile = db.prepare(`
    SELECT p.*,
      a.email as account_email,
      a.cost as account_cost,
      pl.name as platform_name,
      pl.icon as platform_icon,
      pl.color as platform_color
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    JOIN platforms pl ON pl.id = a.platform_id
    WHERE p.id = ? AND p.is_active = 1
  `).get(req.params.id);

  if (!profile) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  res.json(profile);
});

// POST /api/profiles - Create profile
router.post('/', (req, res) => {
  const { account_id, profile_name, pin, client_name, client_whatsapp, sale_price, expiry_date } = req.body;

  if (!account_id || !profile_name) {
    return res.status(400).json({ error: 'account_id y profile_name son requeridos' });
  }

  const account = db.prepare(`
    SELECT a.*, p.max_profiles 
    FROM accounts a 
    JOIN platforms p ON p.id = a.platform_id 
    WHERE a.id = ?
  `).get(account_id);

  if (!account) {
    return res.status(404).json({ error: 'Cuenta no encontrada' });
  }

  const currentProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE account_id = ? AND is_active = 1').get(account_id);
  if (currentProfiles.count >= account.max_profiles) {
    return res.status(400).json({ error: `Esta cuenta ya tiene el máximo de ${account.max_profiles} perfiles` });
  }

  const result = db.prepare(
    'INSERT INTO profiles (account_id, profile_name, pin, client_name, client_whatsapp, sale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(account_id, profile_name, pin || '', client_name || '', client_whatsapp || '', sale_price || 0, expiry_date || null);

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(profile);
});

// PUT /api/profiles/:id - Update profile
router.put('/:id', (req, res) => {
  const { profile_name, pin, client_name, client_whatsapp, sale_price, expiry_date } = req.body;
  const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  db.prepare(`
    UPDATE profiles 
    SET profile_name = ?, pin = ?, client_name = ?, client_whatsapp = ?, sale_price = ?, expiry_date = ?
    WHERE id = ?
  `).run(
    profile_name ?? existing.profile_name,
    pin ?? existing.pin,
    client_name ?? existing.client_name,
    client_whatsapp ?? existing.client_whatsapp,
    sale_price !== undefined ? sale_price : existing.sale_price,
    expiry_date !== undefined ? expiry_date : existing.expiry_date,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /api/profiles/:id/renew - Renew profile
router.post('/:id/renew', (req, res) => {
  const { new_expiry_date, sale_price } = req.body;
  const existing = db.prepare(`
    SELECT p.*, a.id as account_id, a.email as account_email, pl.id as platform_id, pl.name as platform_name, pl.icon as platform_icon, pl.color as platform_color
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    JOIN platforms pl ON pl.id = a.platform_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  if (!new_expiry_date) {
    return res.status(400).json({ error: 'La nueva fecha de vencimiento es requerida' });
  }

  const renewalPrice = sale_price !== undefined ? sale_price : existing.sale_price;

  // Log renewal in history
  db.prepare(
    'INSERT INTO renewals (profile_id, account_id, account_email, platform_id, platform_name, platform_icon, platform_color, profile_name, client_name, client_whatsapp, old_expiry_date, new_expiry_date, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.params.id,
    existing.account_id,
    existing.account_email,
    existing.platform_id,
    existing.platform_name,
    existing.platform_icon,
    existing.platform_color,
    existing.profile_name,
    existing.client_name,
    existing.client_whatsapp,
    existing.expiry_date,
    new_expiry_date,
    renewalPrice
  );

  // Update profile expiry only; keep the original profile sale_price intact
  db.prepare('UPDATE profiles SET expiry_date = ? WHERE id = ?').run(new_expiry_date, req.params.id);

  const updated = db.prepare(`
    SELECT p.*, a.email as account_email, pl.name as platform_name, pl.icon as platform_icon
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    JOIN platforms pl ON pl.id = a.platform_id
    WHERE p.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/profiles/:id - Soft delete profile
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  db.prepare('UPDATE profiles SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Perfil eliminado correctamente' });
});

module.exports = router;
