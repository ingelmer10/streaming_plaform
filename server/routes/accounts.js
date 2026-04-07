const express = require('express');
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/accounts/platform/:platformId - List accounts for a platform
router.get('/platform/:platformId', async (req, res) => {
  try {
    const accountsResult = await pool.query(`
      SELECT
        a.*,
        COUNT(CASE WHEN p.is_active = true THEN p.id END) as profile_count,
        COALESCE(SUM(CASE WHEN p.is_active = true THEN p.sale_price ELSE 0 END), 0) + COALESCE(
          (SELECT SUM(r.sale_price) FROM renewals r WHERE r.account_id = a.id AND r.renewal_type = 'profile'),
          0
        ) as total_revenue
      FROM accounts a
      LEFT JOIN profiles p ON p.account_id = a.id
      WHERE a.platform_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `, [req.params.platformId]);

    res.json(accountsResult.rows);
  } catch (err) {
    console.error('Accounts list error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/accounts/:id - Get single account
router.get('/:id', async (req, res) => {
  try {
    const accountResult = await pool.query(`
      SELECT
        a.*,
        p.name as platform_name,
        p.icon as platform_icon,
        p.color as platform_color,
        p.max_profiles,
        COUNT(CASE WHEN pr.is_active = true THEN pr.id END) as profile_count,
        COALESCE(SUM(CASE WHEN pr.is_active = true THEN pr.sale_price ELSE 0 END), 0) + COALESCE(
          (SELECT SUM(r.sale_price) FROM renewals r WHERE r.account_id = a.id AND r.renewal_type = 'profile'),
          0
        ) as total_revenue
      FROM accounts a
      JOIN platforms p ON p.id = a.platform_id
      LEFT JOIN profiles pr ON pr.account_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, p.name, p.icon, p.color, p.max_profiles
    `, [req.params.id]);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    res.json(accountResult.rows[0]);
  } catch (err) {
    console.error('Account detail error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/accounts - Create new account
router.post('/', async (req, res) => {
  const { platform_id, email, password, provider_name, provider_phone, cost, expiry_date } = req.body;

  if (!platform_id || !email || !password) {
    return res.status(400).json({ error: 'Plataforma, email y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO accounts (platform_id, email, password, provider_name, provider_phone, cost, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [platform_id, email, password, provider_name || '', provider_phone || '', cost || 0, expiry_date]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      res.status(400).json({ error: 'Ya existe una cuenta con ese email en esta plataforma' });
    } else {
      console.error('Account creation error:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// PUT /api/accounts/:id - Update account
router.put('/:id', async (req, res) => {
  const { email, password, provider_name, provider_phone, cost, expiry_date } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      `UPDATE accounts SET email = $1, password = $2, provider_name = $3, provider_phone = $4,
       cost = $5, expiry_date = $6 WHERE id = $7 RETURNING *`,
      [email, password, provider_name || '', provider_phone || '', cost || 0, expiry_date, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      res.status(400).json({ error: 'Ya existe una cuenta con ese email en esta plataforma' });
    } else {
      console.error('Account update error:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// DELETE /api/accounts/:id - Delete account
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    res.json({ message: 'Cuenta eliminada exitosamente' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/accounts/:id/renew - Renew account
router.post('/:id/renew', async (req, res) => {
  const { new_expiry_date, renewal_cost } = req.body;

  if (!new_expiry_date) {
    return res.status(400).json({ error: 'Nueva fecha de vencimiento es requerida' });
  }

  try {
    // Get current account
    const accountResult = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    const account = accountResult.rows[0];

    // Get platform info
    const platformResult = await pool.query('SELECT * FROM platforms WHERE id = $1', [account.platform_id]);
    const platform = platformResult.rows[0];

    // Update account expiry
    await pool.query('UPDATE accounts SET expiry_date = $1 WHERE id = $2', [new_expiry_date, req.params.id]);

    // Log renewal
    await pool.query(`
      INSERT INTO renewals (
        account_id, account_email, platform_id, platform_name, platform_icon, platform_color,
        old_expiry_date, new_expiry_date, sale_price, renewal_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      account.id, account.email, platform.id, platform.name, platform.icon, platform.color,
      account.expiry_date, new_expiry_date, renewal_cost || 0, 'account'
    ]);

    res.json({ message: 'Cuenta renovada exitosamente' });
  } catch (err) {
    console.error('Account renewal error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
