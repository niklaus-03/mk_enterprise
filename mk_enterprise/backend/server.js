require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { cleanupInvoices } = require('./utils/cleanupInvoices');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});
app.set('io', io); // Make io available in routes via req.app.get('io')
global.io = io; // Global access for models

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
app.use('/api/product-lists', require('./routes/productLists'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/customer-lists', require('./routes/customerLists'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/stock-movements', require('./routes/stockMovements'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/deliveries', require('./routes/deliveries'));
const ordersRoutes = require('./routes/orders');

app.use('/api/orders', ordersRoutes);
app.use('/api/activity-logs', require('./routes/activityLogs'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/reports', require('./routes/reports'));

// ── Scheduled backup at 3:00 AM daily ─────────────────────────────────────────
const { createBackup } = require('./utils/backup');
function scheduleBackup() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(3, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target - now;
  setTimeout(() => {
    console.log('🔄 Running scheduled backup...');
    createBackup();
    setInterval(() => {
      console.log('🔄 Running scheduled backup...');
      createBackup();
    }, 24 * 60 * 60 * 1000);
  }, ms);
  console.log(`📦 Next backup scheduled at ${target.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
}

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
const cron = require('node-cron');
const DailyReport = require('./models/DailyReport');
const Notification = require('./models/Notification');

// Schedule daily report reminder at 16:30 IST
cron.schedule('30 16 * * *', async () => {
  console.log("Running daily report reminder check...");
  try {
    const managers = await User.find({ role: 'manager' });
    if (!managers.length) return;

    // Get today's date in IST
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = ist.toISOString().slice(0, 10);

    const reportsToday = await DailyReport.find({ date: todayIST });
    const submittedManagerIds = reportsToday.map(r => r.manager_id.toString());

    for (const manager of managers) {
      if (!submittedManagerIds.includes(manager._id.toString())) {
        await Notification.create({
          recipient_id: manager._id,
          recipient_role: 'manager',
          type: 'general',
          title: 'Daily Report Reminder',
          message: 'Please submit your daily end-of-day report. It is pending.',
          priority: 'high'
        });
      }
    }
  } catch (err) {
    console.error("Error in daily report reminder cron:", err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('join', async (userData) => {
    if (userData && userData._id) {
      socket.join(userData._id);
      socket.join(`role:${userData.role}`);
      socket.userId = userData._id;
      
      // Update DB to online
      try {
        await User.findByIdAndUpdate(userData._id, { is_online: true });
        io.emit('status_update'); // Tell everyone to refresh their manager/driver list
      } catch (err) {
        console.error("Socket join error:", err);
      }
    }
  });

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.userId) {
      // Small delay to prevent flickering on rapid reload
      setTimeout(async () => {
        const sockets = await io.in(socket.userId).fetchSockets();
        if (sockets.length === 0) {
          try {
            await User.findByIdAndUpdate(socket.userId, { is_online: false });
            io.emit('status_update');
          } catch (err) {
            console.error("Socket disconnect error:", err);
          }
        }
      }, 5000);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      MK Enterprise — Server Started     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Port:  ${PORT}                               ║`);
  console.log(`║  Mode:  ${(process.env.NODE_ENV || 'development').padEnd(32)}║`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('→ Run POST /api/seed once to create admin & sample data\n');
  scheduleBackup();
});


// Run once when server starts
cleanupInvoices();

// Run automatically every 24 hours
setInterval(() => {
  console.log("Running daily invoice cleanup...");
  cleanupInvoices();
}, 24 * 60 * 60 * 1000); // 24 hours