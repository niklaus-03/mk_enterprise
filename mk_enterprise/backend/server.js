require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { cleanupInvoices } = require('./utils/cleanupInvoices');

const app = express();
connectDB();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Public Routes (no auth) ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/seed', require('./routes/seed')); // only for initial setup

// ── Protected Routes ──────────────────────────────────────────────────────────
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/stock-movements', require('./routes/stockMovements'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/deliveries', require('./routes/deliveries'));
const ordersRoutes = require('./routes/orders');

app.use('/api/orders', ordersRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
}));

// ── Serve React build (production) ───────────────────────────────────────────
const frontendBuild = path.join(__dirname, '../frontend/build');
const fs = require('fs');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    }
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Server error', message: err.message });
});

const User = require('./models/Admin');



const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      MK Enterprise — Server Started     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Port:  ${PORT}                               ║`);
  console.log(`║  Mode:  ${(process.env.NODE_ENV || 'development').padEnd(32)}║`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('→ Run POST /api/seed once to create admin & sample data\n');
});


// Run once when server starts
cleanupInvoices();

// Run automatically every 24 hours
setInterval(() => {
  console.log("Running daily invoice cleanup...");
  cleanupInvoices();
}, 24 * 60 * 60 * 1000); // 24 hours