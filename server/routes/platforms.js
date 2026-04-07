const express = require('express');
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/platforms - List all platforms with stats (including expiry alerts)
router.get('/', async (req, res) => {
  try {
    const platformsResult = await pool.query(`
      SELECT
        p.*,
        COUNT(DISTINCT a.id) as account_count,
        COUNT(DISTINCT pr.id) as profile_count
      FROM platforms p
      LEFT JOIN accounts a ON a.platform_id = p.id
      LEFT JOIN profiles pr ON pr.account_id = a.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    // Add expiry stats for each platform
    for (const p of platformsResult.rows) {
      const expiryStatsResult = await pool.query(`
        SELECT
          COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date <= CURRENT_DATE THEN 1 END) as expired_accounts,
          COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date > CURRENT_DATE AND a.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_soon_accounts,
          COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date <= CURRENT_DATE THEN 1 END) as expired_profiles,
          COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date > CURRENT_DATE AND pr.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_soon_profiles
        FROM accounts a
        LEFT JOIN profiles pr ON pr.account_id = a.id
        WHERE a.platform_id = $1
      `, [p.id]);
      Object.assign(p, expiryStatsResult.rows[0]);
    }

    res.json(platformsResult.rows);
  } catch (err) {
    console.error('Platforms list error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/platforms/:id - Get single platform with stats
router.get('/:id', async (req, res) => {
  try {
    const platformResult = await pool.query(`
      SELECT
        p.*,
        COUNT(DISTINCT a.id) as account_count,
        COUNT(DISTINCT pr.id) as profile_count
      FROM platforms p
      LEFT JOIN accounts a ON a.platform_id = p.id
      LEFT JOIN profiles pr ON pr.account_id = a.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (platformResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plataforma no encontrada' });
    }

    const platform = platformResult.rows[0];

    // Add expiry stats
    const expiryStatsResult = await pool.query(`
      SELECT
        COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date <= CURRENT_DATE THEN 1 END) as expired_accounts,
        COUNT(CASE WHEN a.expiry_date IS NOT NULL AND a.expiry_date > CURRENT_DATE AND a.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_soon_accounts,
        COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date <= CURRENT_DATE THEN 1 END) as expired_profiles,
        COUNT(CASE WHEN pr.expiry_date IS NOT NULL AND pr.expiry_date > CURRENT_DATE AND pr.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_soon_profiles
      FROM accounts a
      LEFT JOIN profiles pr ON pr.account_id = a.id
      WHERE a.platform_id = $1
    `, [req.params.id]);
    Object.assign(platform, expiryStatsResult.rows[0]);

    res.json(platform);
  } catch (err) {
    console.error('Platform detail error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/platforms - Create new platform
router.post('/', async (req, res) => {
  const { name, icon, color, max_profiles } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre de la plataforma es requerido' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO platforms (name, icon, color, max_profiles) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, icon || '📺', color || '#6c5ce7', max_profiles || 5]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      res.status(400).json({ error: 'Ya existe una plataforma con ese nombre' });
    } else {
      console.error('Platform creation error:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// PUT /api/platforms/:id - Update platform
router.put('/:id', async (req, res) => {
  const { name, icon, color, max_profiles } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre de la plataforma es requerido' });
  }

  try {
    const result = await pool.query(
      'UPDATE platforms SET name = $1, icon = $2, color = $3, max_profiles = $4 WHERE id = $5 RETURNING *',
      [name, icon || '📺', color || '#6c5ce7', max_profiles || 5, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plataforma no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      res.status(400).json({ error: 'Ya existe una plataforma con ese nombre' });
    } else {
      console.error('Platform update error:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// DELETE /api/platforms/:id - Delete platform
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM platforms WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plataforma no encontrada' });
    }

    res.json({ message: 'Plataforma eliminada exitosamente' });
  } catch (err) {
    console.error('Platform deletion error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
