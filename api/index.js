const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('../server/database');

const app = express();

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/platforms', require('../server/routes/platforms'));
app.use('/api/accounts', require('../server/routes/accounts'));
app.use('/api/profiles', require('../server/routes/profiles'));
app.use('/api/reports', require('../server/routes/reports'));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Export for Vercel serverless function
module.exports = app;
