const express = require('express');
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/profiles/account/:accountId - List profiles for an account
router.get('/account/:accountId', async (req, res) => {
  try {
    const profilesResult = await pool.query(`
      SELECT p.*,
        a.email as account_email,
        a.cost as account_cost,
        pl.name as platform_name,
        pl.icon as platform_icon,
        pl.color as platform_color
      FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      JOIN platforms pl ON pl.id = a.platform_id
      WHERE p.account_id = $1 AND p.is_active = true
      ORDER BY p.created_at DESC
    `, [req.params.accountId]);

    res.json(profilesResult.rows);
  } catch (err) {
    console.error('Profiles list error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/profiles/:id - Get single profile
router.get('/:id', async (req, res) => {
  try {
    const profileResult = await pool.query(`
      SELECT p.*,
        a.email as account_email,
        a.cost as account_cost,
        pl.name as platform_name,
        pl.icon as platform_icon,
        pl.color as platform_color
      FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      JOIN platforms pl ON pl.id = a.platform_id
      WHERE p.id = $1 AND p.is_active = true
    `, [req.params.id]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json(profileResult.rows[0]);
  } catch (err) {
    console.error('Profile detail error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/profiles - Create profile
router.post('/', async (req, res) => {
  const { account_id, profile_name, pin, client_name, client_whatsapp, sale_price, expiry_date } = req.body;

  if (!account_id || !profile_name || !client_name) {
    return res.status(400).json({ error: 'Cuenta, nombre del perfil y nombre del cliente son requeridos' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO profiles (account_id, profile_name, pin, client_name, client_whatsapp, sale_price, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [account_id, profile_name, pin || '', client_name, client_whatsapp || '', sale_price || 0, expiry_date]
    );

    // Get full profile with account/platform info
    const fullProfileResult = await pool.query(`
      SELECT p.*,
        a.email as account_email,
        a.cost as account_cost,
        pl.name as platform_name,
        pl.icon as platform_icon,
        pl.color as platform_color
      FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      JOIN platforms pl ON pl.id = a.platform_id
      WHERE p.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(fullProfileResult.rows[0]);
  } catch (err) {
    console.error('Profile creation error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/profiles/:id - Update profile
router.put('/:id', async (req, res) => {
  const { profile_name, pin, client_name, client_whatsapp, sale_price, expiry_date } = req.body;

  if (!profile_name || !client_name) {
    return res.status(400).json({ error: 'Nombre del perfil y nombre del cliente son requeridos' });
  }

  try {
    const result = await pool.query(
      `UPDATE profiles SET profile_name = $1, pin = $2, client_name = $3, client_whatsapp = $4,
       sale_price = $5, expiry_date = $6 WHERE id = $7 AND is_active = true RETURNING *`,
      [profile_name, pin || '', client_name, client_whatsapp || '', sale_price || 0, expiry_date, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Get full profile with account/platform info
    const fullProfileResult = await pool.query(`
      SELECT p.*,
        a.email as account_email,
        a.cost as account_cost,
        pl.name as platform_name,
        pl.icon as platform_icon,
        pl.color as platform_color
      FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      JOIN platforms pl ON pl.id = a.platform_id
      WHERE p.id = $1
    `, [req.params.id]);

    res.json(fullProfileResult.rows[0]);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/profiles/:id - Soft delete profile
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE profiles SET is_active = false WHERE id = $1 AND is_active = true RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json({ message: 'Perfil eliminado exitosamente' });
  } catch (err) {
    console.error('Profile deletion error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/profiles/:id/renew - Renew profile
router.post('/:id/renew', async (req, res) => {
  const { new_expiry_date, sale_price } = req.body;

  if (!new_expiry_date) {
    return res.status(400).json({ error: 'Nueva fecha de vencimiento es requerida' });
  }

  try {
    // Get current profile
    const profileResult = await pool.query(`
      SELECT p.*, a.email as account_email, pl.id as platform_id, pl.name as platform_name,
             pl.icon as platform_icon, pl.color as platform_color
      FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      JOIN platforms pl ON pl.id = a.platform_id
      WHERE p.id = $1 AND p.is_active = true
    `, [req.params.id]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const profile = profileResult.rows[0];

    // Update profile expiry
    await pool.query('UPDATE profiles SET expiry_date = $1 WHERE id = $2', [new_expiry_date, req.params.id]);

    // Log renewal
    await pool.query(`
      INSERT INTO renewals (
        profile_id, account_id, account_email, platform_id, platform_name, platform_icon, platform_color,
        profile_name, client_name, client_whatsapp, old_expiry_date, new_expiry_date, sale_price, renewal_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      profile.id, profile.account_id, profile.account_email, profile.platform_id, profile.platform_name,
      profile.platform_icon, profile.platform_color, profile.profile_name, profile.client_name,
      profile.client_whatsapp, profile.expiry_date, new_expiry_date, sale_price || 0, 'profile'
    ]);

    // Get updated profile
    const updatedResult = await pool.query(`
      SELECT p.*,
        a.email as account_email,
        a.cost as account_cost,
        pl.name as platform_name,
        pl.icon as platform_icon,
        pl.color as platform_color
      FROM profiles p
      JOIN accounts a ON a.id = p.account_id
      JOIN platforms pl ON pl.id = a.platform_id
      WHERE p.id = $1
    `, [req.params.id]);

    res.json(updatedResult.rows[0]);
  } catch (err) {
    console.error('Profile renewal error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
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
