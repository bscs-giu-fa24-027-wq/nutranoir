require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── INITIALIZE SERVICES ───────────────────────────────────
const { initializeEmailService } = require('./services/emailService');
const { initializeWhatsAppService } = require('./services/whatsappService');

console.log('Initializing notification services...');
initializeEmailService();
initializeWhatsAppService();

// ── ROUTES ────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));

// ── HEALTH CHECK ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'NutraNoir backend running ✓', 
    env: process.env.NODE_ENV,
    services: {
      email: !!process.env.GMAIL_USER,
      whatsapp: !!process.env.WHATSAPP_NUMBER,
    }
  });
});

// ── SERVE ADMIN DASHBOARD ─────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// ── FALLBACK - serve index.html ───────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
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
  ║   http://localhost:${PORT}${PORT === 3000 ? '              ' : '            '}║
  ║   Admin: http://localhost:${PORT}/admin${PORT === 3000 ? '   ' : '  '}║
  ╚══════════════════════════════════════╝
  `);
});
