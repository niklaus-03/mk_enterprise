const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { requireSupervisor } = require('../middleware/auth');
const { createBackup, listBackups, BACKUP_DIR } = require('../utils/backup');
const Trip = require('../models/Trip');
const DailyReport = require('../models/DailyReport');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Settlement = require('../models/Settlement');
const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const VehicleTrip = require('../models/VehicleTrip');
const StockMovement = require('../models/StockMovement');
const { logActivity } = require('./activityLogs');
const { formatIST } = require('../utils/timeUtils');

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

// ── GET /api/reports/daily — Get daily reports ────────────────────────────────
router.get('/daily', async (req, res) => {
  try {
    const { date, status } = req.query;
    const query = {};

    // Managers can only see their own reports
    if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      query.manager_id = req.user.id;
    }

    if (date) {
      // Use regex to match dates that might have timestamp suffixes (e.g., 2026-06-03_1685790000)
      query.date = { $regex: `^${date}` };
    }
    if (status) query.status = status;

    const reports = await DailyReport.find(query).sort({ date: -1 }).lean();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reports/daily — Manager submits end-of-day report ───────────────
router.post('/daily', async (req, res) => {
  try {
    const {
      date, opening_balance, system_cash_reported, actual_cash_reported,
      system_bills_reported, system_deliveries_reported, system_expenses_reported,
      system_sales_reported, system_money_received, system_debt_reported,
      system_concession_reported,
      discrepancy_notes, quick_entries,
    } = req.body;

    if (quick_entries && quick_entries.length > 0) {
      for (const entry of quick_entries) {
        const type = entry.type;
        const party_name = entry.customer_name || entry.supplier_name;
        const product_name = entry.product_name;
        const quantity = entry.quantity;
        const amount = entry.amount;
        const paid = entry.is_paid;
        const entryDate = new Date();
        const ist_formatted = formatIST(entryDate);
        const created_by = req.user.id;

        if (type === 'bill') {
          let customer = null;
          if (party_name.toLowerCase() !== 'anonymous customer') {
            customer = await Customer.findOne({ name: party_name });
            if (!customer) {
              customer = await Customer.create({ name: party_name, created_by });
            }
          }

          let currentBalance = customer ? (customer.getManagerBalance ? customer.getManagerBalance(req.user.id) : (customer.balance || 0)) : 0;

          let total = Number(amount) || 0;
          let product_id = null;
          let qty = Number(quantity) || 1;
          let price = total / qty;

          if (product_name) {
            let product = await Product.findOne({ name: product_name });
            if (product) {
              product_id = product._id;
              price = product.price || price;
              total = price * qty;
              product.stock -= qty;
              await product.save();
            }
          }

          const amount_received = paid ? total : 0;
          const balance_due = paid ? 0 : total;

          const newInvoice = new Invoice({
            is_report: true,
            customer_id: customer ? customer._id : null,
            customer_name: customer ? customer.name : party_name,
            customer_phone: customer ? (customer.phone || '') : '',
            total,
            amount_received,
            balance_due,
            items: [{
              product_id,
              product_name: product_name || 'Misc',
              qty,
              price,
              total
            }],
            date: entryDate,
            ist_formatted,
            created_by
          });
          await newInvoice.save();

          if (customer) {
            if (customer.setManagerBalance) {
              customer.setManagerBalance(req.user.id, currentBalance + balance_due);
            } else {
              customer.balance = (customer.balance || 0) + balance_due;
            }
            await customer.save();
          }

          if (paid) {
            await Settlement.create({
              party_id: customer ? customer._id : null,
              party_name: customer ? customer.name : party_name,
              type: 'received_from_customer',
              amount: total,
              date: entryDate,
              notes: entry.notes ? `Paid for bill: ${entry.notes}` : `Paid for bill`,
              created_by
            });
          }
        } else if (type === 'payment_in') {
          let customer = await Customer.findOne({ name: party_name });
          if (!customer) {
            customer = await Customer.create({ name: party_name, created_by });
          }
          const amt = Number(amount) || 0;
          await Settlement.create({
            party_id: customer._id,
            party_name: customer.name,
            type: 'received_from_customer',
            amount: amt,
            date: entryDate,
            notes: entry.notes ? `Received: ${entry.notes}` : 'Received payment',
            created_by
          });
          
          let currentBalance = customer.getManagerBalance ? customer.getManagerBalance(req.user.id) : (customer.balance || 0);
          if (customer.setManagerBalance) {
            customer.setManagerBalance(req.user.id, currentBalance - amt);
          } else {
            customer.balance = (customer.balance || 0) - amt;
          }
          await customer.save();
        } else if (type === 'payment_out') {
          let supplier = await Supplier.findOne({ name: party_name });
          if (!supplier) {
            supplier = await Supplier.create({ name: party_name, created_by });
          }
          const amt = Number(amount) || 0;
          await Settlement.create({
            party_id: supplier._id,
            party_name: supplier.name,
            type: 'paid_to_supplier',
            amount: amt,
            date: entryDate,
            notes: entry.notes ? `Paid to ${supplier.name}: ${entry.notes}` : `Paid to ${supplier.name}`,
            created_by
          });
          supplier.balance = (supplier.balance || 0) - amt;
          await supplier.save();
        } else if (type === 'expense' || type === 'vehicle_expense') {
          const amt = Number(amount) || 0;
          await Settlement.create({
            party_name: entry.expense_for || 'Expense',
            type: type === 'vehicle_expense' ? 'vehicle_expense' : 'other_expense',
            amount: amt,
            date: entryDate,
            notes: entry.notes ? `${entry.expense_for}: ${entry.notes}` : `${entry.expense_for}`,
            created_by
          });
        }
      }
    }

    let finalDate = date;
    const dbUser = await Admin.findById(req.user.id);
    if (dbUser && dbUser.role === 'walkin_manager') {
      finalDate = `${date}_${Date.now()}`;
    }

    const report = new DailyReport({
      manager_id: req.user.id,
      manager_name: req.user.username || req.user.display_name,
      date: finalDate,
      opening_balance: opening_balance || 0,
      system_sales_reported: system_sales_reported || 0,
      system_money_received: system_money_received || 0,
      system_debt_reported: system_debt_reported || 0,
      system_cash_reported,
      actual_cash_reported,
      system_bills_reported,
      system_deliveries_reported,
      system_expenses_reported: system_expenses_reported || 0,
      system_concession_reported: system_concession_reported || 0,
      discrepancy_notes,
      quick_entries: quick_entries || [],
      total_quick_entries: (quick_entries || []).length,
    });

    // We'll save the report after processing Walkin Manager logic if applicable
    let savedReport = false;

    // Handle Walk-in Manager logic
    let remainingProducts = [];
    if (req.user.role === 'walkin_manager') {
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.is_trip_active) {
        // Fetch final remaining stock
        remainingProducts = await Product.find({ created_by: req.user.id, stock: { $gt: 0 } });
        const finalStock = remainingProducts.map(p => ({
          product_id: p._id,
          quantity: p.stock
        }));

        // Get Trip and build summary
        const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
        
        const summary = {
          initial_load: [],
          sold_items: [],
          remaining_items: []
        };

        if (trip && trip.initial_stock) {
          trip.initial_stock.forEach(item => {
            const initialQty = item.quantity || 0;
            const price = item.price || 0;
            const remProduct = remainingProducts.find(r => r.name === item.product_name);
            const remQty = remProduct ? remProduct.stock : 0;
            const soldQty = initialQty - remQty;

            summary.initial_load.push({ product_name: item.product_name, quantity: initialQty, value: initialQty * price });
            if (remQty > 0) {
              summary.remaining_items.push({ product_name: item.product_name, quantity: remQty, value: remQty * price });
            }
            if (soldQty > 0) {
              summary.sold_items.push({ product_name: item.product_name, quantity: soldQty, value: soldQty * price });
            }
          });
        }
        
        report.walkin_trip_summary = summary;
        await report.save();
        savedReport = true;

        if (trip) {
          trip.status = 'completed';
          trip.completed_at = new Date();
          trip.final_stock = finalStock;
          trip.total_sales_amount = system_sales_reported || 0;
          await trip.save();
        }

        // Return unsold stock to global inventory
        const supervisor = await Admin.findOne({ role: 'supervisor' });
        if (supervisor) {
          for (const localProduct of remainingProducts) {
            if (localProduct.stock > 0) {
              const globalProduct = await Product.findOne({ name: localProduct.name, created_by: supervisor._id });
              if (globalProduct) {
                const globalStockBefore = globalProduct.stock;
                globalProduct.stock += localProduct.stock;
                await globalProduct.save();

                // Log global stock returned
                await StockMovement.create({
                  product_id: globalProduct._id,
                  product_name: globalProduct.name,
                  created_by: req.user.id,
                  type: 'incoming',
                  qty: localProduct.stock,
                  stock_before: globalStockBefore,
                  stock_after: globalProduct.stock,
                  reference: `Returned by Walk-in Manager (${req.user.username || req.user.display_name})`,
                  notes: `Unsold stock returned from vehicle ${admin.active_vehicle_number}`,
                  source: 'Supply Return',
                  vehicle_number: admin.active_vehicle_number,
                  driver_name: admin.active_driver_name,
                  ist_formatted: formatIST(new Date()),
                });
              }
            }
          }
        }

        admin.is_trip_active = false;
        admin.active_vehicle_number = '';
        admin.active_driver_name = '';
        admin.active_destination = '';
        await admin.save();

        // Reset all stock for this manager to 0
        await Product.updateMany({ created_by: req.user.id }, { stock: 0 });
      }
    }

    if (!savedReport) {
      await report.save();
    }

      let extraText = '';
      if (report.discrepancy_notes) {
        extraText += `\nNote: ${report.discrepancy_notes}`;
      }
      if (report.quick_entries && report.quick_entries.length > 0) {
        extraText += `\n\nExtra Items:`;
        report.quick_entries.forEach(q => {
          let label = '';
          if (q.type === 'expense') label = q.expense_for;
          else if (q.type === 'payment_out') label = q.supplier_name;
          else label = q.customer_name;
          
          let typeStr = q.type ? q.type.replace('_', ' ').toUpperCase() : 'ENTRY';
          extraText += `\n• [${typeStr}] ${label || 'N/A'} (₹${q.amount})`;
          if (q.notes) {
            extraText += ` - ${q.notes}`;
          }
        });
      }

      let returnedSummary = '';
      if (req.user.role === 'walkin_manager' && remainingProducts && remainingProducts.length > 0) {
        returnedSummary = `\n\n📦 Unsold Items Returned:\n` + remainingProducts.filter(p => p.stock > 0).map(p => `• ${p.name}: ${p.stock}`).join('\n');
      }

      const description = `Report sent. Cash in drawer left: ₹${(actual_cash_reported || 0).toLocaleString('en-IN')} (Expected: ₹${(system_cash_reported || 0).toLocaleString('en-IN')}).${extraText}${returnedSummary}`;

      await logActivity(req, {
        action: 'report_submitted',
        entity_type: 'daily_report',
        entity_id: report._id,
        entity_name: `Report for ${date}`,
        description: description,
      changes: {
        opening_balance: report.opening_balance,
        system_cash: report.system_cash_reported,
        actual_cash: report.actual_cash_reported,
        notes: report.discrepancy_notes,
        quick_entries: report.quick_entries,
        total_sales: report.system_sales_reported,
        money_received: report.system_money_received,
        debt_created: report.system_debt_reported
      }
    });

    // Notify admin/supervisor about the submitted report
    const cashDiff = (actual_cash_reported || 0) - (system_cash_reported || 0);
    const cashStatus = cashDiff === 0 
      ? '✅ Cash matches' 
      : `⚠️ Cash difference: ₹${Math.abs(cashDiff).toLocaleString('en-IN')} ${cashDiff > 0 ? 'surplus' : 'short'}`;
    
    const managerDisplayName = req.user.username || req.user.display_name || 'Manager';

    // Create notification for all supervisors
    const supervisors = await Admin.find({ role: 'supervisor' });
    for (const sup of supervisors) {
      await Notification.create({
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'general',
        title: 'Daily Report Submitted',
        message: `${managerDisplayName} submitted their daily report for ${date}. ${cashStatus}${returnedSummary}`,
        priority: cashDiff !== 0 ? 'high' : 'medium',
        sender_id: req.user.id,
        sender_name: managerDisplayName,
        metadata: { report_id: report._id, date }
      });
    }

    // Emit socket event so admin panel updates in real-time
    if (global.io) {
      global.io.emit('report_submitted', {
        report_id: report._id,
        manager_id: req.user.id,
        manager_name: managerDisplayName,
        date,
      });
    }

    res.status(201).json(report);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A report for this date already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reports/daily/:id/review — Admin marks report as reviewed ──────
router.patch('/daily/:id/review', requireSupervisor, async (req, res) => {
  try {
    const report = await DailyReport.findByIdAndUpdate(
      req.params.id,
      {
        status: 'reviewed',
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
      { new: true }
    );

    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reports/daily/remind/:manager_id — Admin sends a manual reminder ──────
router.post('/daily/remind/:manager_id', requireSupervisor, async (req, res) => {
  try {
    const { date } = req.body;
    await Notification.create({
      recipient_id: req.params.manager_id,
      recipient_role: 'manager',
      type: 'general',
      title: 'Daily Report Reminder',
      message: date ? `Please submit your daily end-of-day report for ${date}.` : 'Please submit your daily end-of-day report.',
      priority: 'high',
      sender_id: req.user.id,
      sender_name: req.user.username || 'Admin'
    });
    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
