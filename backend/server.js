require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── FRONTEND PATH (works both locally and on Railway) ─────
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// ── INITIALIZE SERVICES ───────────────────────────────────
const { initializeEmailService } = require('./services/emailService');
const { initializeWhatsAppService } = require('./services/whatsappService');
initializeEmailService();
initializeWhatsAppService();

// ── ROUTES ────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));

// ── HEALTH CHECK ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'NutraNoir backend running ✓', env: process.env.NODE_ENV });
});

// ── SERVE ADMIN ───────────────────────────────────────────
app.get('/admin', (req, res) => {
  const adminFile = path.join(__dirname, 'public/admin.html');
  res.sendFile(adminFile, err => {
    if(err) res.status(404).json({ error: 'Admin page not found' });
  });
});

// ── FALLBACK ──────────────────────────────────────────────
app.use((req, res) => {
  const indexFile = path.join(__dirname, 'public/index.html');
  res.sendFile(indexFile, err => {
    if(err) res.status(404).json({ error: 'Page not found' });
  });
});

// ── ERROR HANDLER ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── START ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🍫 NutraNoir Backend Running       ║
  ║   http://localhost:${PORT}             ║
  ║   Admin: http://localhost:${PORT}/admin║
  ╚══════════════════════════════════════╝
  `);
});
