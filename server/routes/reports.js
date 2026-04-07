const express = require('express');
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/reports/summary - General summary
router.get('/summary', async (req, res) => {
  try {
    const summaryResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM platforms) as total_platforms,
        (SELECT COUNT(*) FROM accounts) as total_accounts,
        (SELECT COUNT(*) FROM profiles WHERE is_active = true) as total_profiles,
        (SELECT COUNT(*) FROM profiles WHERE client_name != '' AND is_active = true) as active_clients,
        (SELECT COALESCE(SUM(cost), 0) FROM accounts) + (SELECT COALESCE(SUM(sale_price), 0) FROM renewals WHERE renewal_type = 'account') as total_costs,
        ((SELECT COALESCE(SUM(sale_price), 0) FROM profiles) + (SELECT COALESCE(SUM(sale_price), 0) FROM renewals WHERE renewal_type = 'profile')) as total_revenue,
        (SELECT COUNT(*) FROM profiles WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE AND is_active = true) as expired_profiles,
        (SELECT COUNT(*) FROM profiles WHERE expiry_date IS NOT NULL AND expiry_date > CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '7 days' AND is_active = true) as expiring_soon_profiles,
        (SELECT COUNT(*) FROM accounts WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE) as expired_accounts,
        (SELECT COUNT(*) FROM accounts WHERE expiry_date IS NOT NULL AND expiry_date > CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '7 days') as expiring_soon_accounts
    `);

    const summary = summaryResult.rows[0];
    summary.total_profit = summary.total_revenue - summary.total_costs;
    res.json(summary);
  } catch (err) {
    console.error('Reports summary error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reports/platforms - Revenue & cost per platform
router.get('/platforms', async (req, res) => {
  try {
    const dataResult = await pool.query(`
      SELECT
        pl.id,
        pl.name,
        pl.icon,
        pl.color,
        COUNT(DISTINCT a.id) as account_count,
        COUNT(DISTINCT CASE WHEN pr.is_active = true THEN pr.id END) as profile_count,
        COALESCE((SELECT SUM(cost) FROM accounts WHERE platform_id = pl.id), 0) + COALESCE((SELECT SUM(r.sale_price) FROM renewals r WHERE r.platform_id = pl.id AND r.renewal_type = 'account'), 0) as total_cost,
        COALESCE((SELECT SUM(pr2.sale_price) FROM profiles pr2 JOIN accounts a2 ON a2.id = pr2.account_id WHERE a2.platform_id = pl.id), 0) + COALESCE((SELECT SUM(r.sale_price) FROM renewals r WHERE r.platform_id = pl.id AND r.renewal_type = 'profile'), 0) as total_revenue,
        COALESCE((SELECT SUM(pr2.sale_price) FROM profiles pr2 JOIN accounts a2 ON a2.id = pr2.account_id WHERE a2.platform_id = pl.id), 0) + COALESCE((SELECT SUM(r.sale_price) FROM renewals r WHERE r.platform_id = pl.id AND r.renewal_type = 'profile'), 0) - (COALESCE((SELECT SUM(cost) FROM accounts WHERE platform_id = pl.id), 0) + COALESCE((SELECT SUM(r.sale_price) FROM renewals r WHERE r.platform_id = pl.id AND r.renewal_type = 'account'), 0)) as profit
      FROM platforms pl
      LEFT JOIN accounts a ON a.platform_id = pl.id
      LEFT JOIN profiles pr ON pr.account_id = a.id
      GROUP BY pl.id, pl.name, pl.icon, pl.color
      ORDER BY profit DESC
    `);

    res.json(dataResult.rows);
  } catch (err) {
    console.error('Reports platforms error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reports/expiring-soon - Expiring accounts and profiles
router.get('/expiring-soon', async (req, res) => {
  try {
    const expiringAccountsResult = await pool.query(`
      SELECT
        'account' as type,
        a.id,
        a.email,
        a.expiry_date,
        p.name as platform_name,
        p.icon as platform_icon,
        p.color as platform_color,
        NULL as profile_name,
        NULL as client_name
      FROM accounts a
      JOIN platforms p ON p.id = a.platform_id
      WHERE a.expiry_date IS NOT NULL AND a.expiry_date > CURRENT_DATE AND a.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY a.expiry_date ASC
    `);

    const expiringProfilesResult = await pool.query(`
      SELECT
        'profile' as type,
        pr.id,
        a.email as account_email,
        pr.expiry_date,
        p.name as platform_name,
        p.icon as platform_icon,
        p.color as platform_color,
        pr.profile_name,
        pr.client_name
      FROM profiles pr
      JOIN accounts a ON a.id = pr.account_id
      JOIN platforms p ON p.id = a.platform_id
      WHERE pr.expiry_date IS NOT NULL AND pr.expiry_date > CURRENT_DATE AND pr.expiry_date <= CURRENT_DATE + INTERVAL '7 days' AND pr.is_active = true
      ORDER BY pr.expiry_date ASC
    `);

    res.json({
      expiring_accounts: expiringAccountsResult.rows,
      expiring_profiles: expiringProfilesResult.rows
    });
  } catch (err) {
    console.error('Reports expiring-soon error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reports/expired - Expired accounts and profiles
router.get('/expired', async (req, res) => {
  try {
    const expiredAccountsResult = await pool.query(`
      SELECT
        'account' as type,
        a.id,
        a.email,
        a.expiry_date,
        p.name as platform_name,
        p.icon as platform_icon,
        p.color as platform_color,
        NULL as profile_name,
        NULL as client_name
      FROM accounts a
      JOIN platforms p ON p.id = a.platform_id
      WHERE a.expiry_date IS NOT NULL AND a.expiry_date <= CURRENT_DATE
      ORDER BY a.expiry_date ASC
    `);

    const expiredProfilesResult = await pool.query(`
      SELECT
        'profile' as type,
        pr.id,
        a.email as account_email,
        pr.expiry_date,
        p.name as platform_name,
        p.icon as platform_icon,
        p.color as platform_color,
        pr.profile_name,
        pr.client_name
      FROM profiles pr
      JOIN accounts a ON a.id = pr.account_id
      JOIN platforms p ON p.id = a.platform_id
      WHERE pr.expiry_date IS NOT NULL AND pr.expiry_date <= CURRENT_DATE AND pr.is_active = true
      ORDER BY pr.expiry_date ASC
    `);

    res.json({
      expired_accounts: expiredAccountsResult.rows,
      expired_profiles: expiredProfilesResult.rows
    });
  } catch (err) {
    console.error('Reports expired error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reports/sales - Sales and profit report
router.get('/sales', async (req, res) => {
  try {
    const salesResult = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as profiles_sold,
        SUM(sale_price) as revenue
      FROM profiles
      WHERE sale_price > 0
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    const renewalsResult = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as renewals_count,
        SUM(sale_price) as renewal_revenue
      FROM renewals
      WHERE sale_price > 0
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    res.json({
      sales: salesResult.rows,
      renewals: renewalsResult.rows
    });
  } catch (err) {
    console.error('Reports sales error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

// GET /api/reports/renewals - Renewal history
router.get('/renewals', (req, res) => {
  const { from, to, limit } = req.query;
  let query = `
    SELECT
      r.*,
      COALESCE(p.profile_name, r.profile_name) as profile_name,
      COALESCE(p.client_name, r.client_name) as client_name,
      COALESCE(p.client_whatsapp, r.client_whatsapp) as client_whatsapp,
      COALESCE(a.email, r.account_email) as account_email,
      COALESCE(pl.name, r.platform_name) as platform_name,
      COALESCE(pl.icon, r.platform_icon) as platform_icon,
      COALESCE(pl.color, r.platform_color) as platform_color
    FROM renewals r
    LEFT JOIN profiles p ON p.id = r.profile_id
    LEFT JOIN accounts a ON a.id = r.account_id
    LEFT JOIN platforms pl ON pl.id = r.platform_id
  `;

  const conditions = [];
  const params = [];

  if (from) {
    conditions.push('r.created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('r.created_at <= ?');
    params.push(to + ' 23:59:59');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.created_at DESC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit));
  }

  const renewals = db.prepare(query).all(...params);
  
  const totalRevenue = renewals.reduce((sum, r) => sum + (r.sale_price || 0), 0);
  
  res.json({ renewals, totalRevenue, count: renewals.length });
});

// GET /api/reports/monthly - Monthly revenue/costs
router.get('/monthly', (req, res) => {
  const months = db.prepare(`
    SELECT
      strftime('%Y-%m', r.created_at) as month,
      COUNT(*) as renewal_count,
      COALESCE(SUM(r.sale_price), 0) as revenue
    FROM renewals r
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all();

  res.json(months);
});

// GET /api/reports/expiring - All expiring soon items
router.get('/expiring', (req, res) => {
  const days = parseInt(req.query.days) || 7;

  const accounts = db.prepare(`
    SELECT a.*, pl.name as platform_name, pl.icon as platform_icon, pl.color as platform_color
    FROM accounts a
    JOIN platforms pl ON pl.id = a.platform_id
    WHERE a.expiry_date IS NOT NULL AND a.expiry_date <= date('now', '+' || ? || ' days')
    ORDER BY a.expiry_date ASC
  `).all(days);

  const profiles = db.prepare(`
    SELECT p.*, a.email as account_email, pl.name as platform_name, pl.icon as platform_icon, pl.color as platform_color
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    JOIN platforms pl ON pl.id = a.platform_id
    WHERE p.expiry_date IS NOT NULL AND p.expiry_date <= date('now', '+' || ? || ' days') AND p.is_active = 1
    ORDER BY p.expiry_date ASC
  `).all(days);

  res.json({ accounts, profiles });
});

module.exports = router;
