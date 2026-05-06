const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { requireSupervisor } = require('../middleware/auth');
const { createBackup, listBackups, BACKUP_DIR } = require('../utils/backup');
const Trip = require('../models/Trip');

router.use(auth);

// ── POST /api/reports/backup — Trigger manual backup (Admin only) ─────────────
router.post('/backup', requireSupervisor, async (req, res) => {
  try {
    const result = await createBackup();
    if (result.success) {
      res.json({ success: true, message: 'Backup created successfully', size: result.size });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/backups — List available backups ──────────────────────────
router.get('/backups', requireSupervisor, async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups, total: backups.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/backups/:filename — Download a backup file ───────────────
router.get('/backups/:filename', requireSupervisor, async (req, res) => {
  try {
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/driver-expenses — Export driver expenses as CSV ───────────
router.get('/driver-expenses', requireSupervisor, async (req, res) => {
  try {
    const { start_date, end_date, driver_id } = req.query;
    const query = {};

    if (driver_id) query.driver_id = driver_id;
    if (start_date || end_date) {
      query.started_at = {};
      if (start_date) query.started_at.$gte = new Date(start_date);
      if (end_date) query.started_at.$lte = new Date(end_date + 'T23:59:59.999Z');
    }

    const trips = await Trip.find(query).sort({ started_at: -1 }).lean();

    // Build CSV
    const rows = [['Trip ID', 'Driver', 'Vehicle', 'Type', 'Start Date', 'End Date', 'Expense Type', 'Amount', 'Note'].join(',')];

    for (const trip of trips) {
      const expenses = (trip.timeline || []).filter(t => t.type === 'expense');
      if (expenses.length === 0) {
        rows.push([
          trip._id, trip.driver_name, trip.vehicle_number, trip.type,
          new Date(trip.started_at).toLocaleDateString('en-IN'),
          trip.completed_at ? new Date(trip.completed_at).toLocaleDateString('en-IN') : 'Active',
          'No expenses', '0', ''
        ].join(','));
      } else {
        for (const exp of expenses) {
          rows.push([
            trip._id, trip.driver_name, trip.vehicle_number, trip.type,
            new Date(trip.started_at).toLocaleDateString('en-IN'),
            trip.completed_at ? new Date(trip.completed_at).toLocaleDateString('en-IN') : 'Active',
            exp.expense_type, exp.expense_amount,
            `"${(exp.expense_note || '').replace(/"/g, '""')}"`
          ].join(','));
        }
      }
    }

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=driver_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
