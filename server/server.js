const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/reports', require('./routes/reports'));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🎬  StreamVault Server Running          ║
  ║   📡  http://localhost:${PORT}              ║
  ║   👤  Admin: admin / admin123             ║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
});
