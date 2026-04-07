const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Set correct MIME types for static files
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  } else if (req.path.endsWith('.css')) {
    res.type('text/css');
  }
  next();
});

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

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  
  // Initialize database and start server
  (async () => {
    try {
      await initializeDatabase();
      console.log('✅ Database initialized successfully');
      
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
    } catch (err) {
      console.error('❌ Failed to initialize database:', err);
      process.exit(1);
    }
  })();
}

module.exports = app;
