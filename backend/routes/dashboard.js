const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const Settlement = require('../models/Settlement');
const auth = require('../middleware/auth');
const { todayUTCRange, formatIST } = require('../utils/timeUtils');
const { logActivity } = require('./activityLogs');
const ProductList = require('../models/ProductList');

router.use(auth);

// Helper: managers see only their own data (cast to ObjectId for aggregates)
function ownerFilter(req) {
  if (req.user.role === 'supervisor' && req.query.manager_id) {
    return { created_by: new mongoose.Types.ObjectId(req.query.manager_id) };
  }
  if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
    return { created_by: new mongoose.Types.ObjectId(req.user.id) };
  }
  return {}; // supervisor sees all
}

// Helper: managers see only their own products
async function getProductOwnerFilter(req) {
  let targetId = req.user.id;
  let targetRole = req.user.role;
  if (req.user.role === 'supervisor' && req.query.manager_id) {
    targetId = req.query.manager_id;
    // We assume the target is a manager; you could also look up their role if needed
    targetRole = 'manager';
  }

  if (targetRole === 'walkin_manager') {
    return { created_by: new mongoose.Types.ObjectId(targetId) };
  }
  
  if (['manager', 'temp_manager'].includes(targetRole)) {
    const sharedLists = await ProductList.find({ 'shares.manager_id': targetId });
    let sharedProductIds = [];
    sharedLists.forEach(list => {
      const share = list.shares.find(s => s.manager_id.toString() === targetId);
      if (share) {
        list.products.forEach(pId => {
          const override = share.overrides.find(o => o.product_id.toString() === pId.toString());
          if (!override || !override.is_excluded) {
            sharedProductIds.push(pId);
          }
        });
      }
    });

    if (targetRole === 'temp_manager') {
      return {
        $or: [
          { allowed_managers: new mongoose.Types.ObjectId(targetId) },
          { _id: { $in: sharedProductIds } }
        ],
      };
    }

    return {
      $or: [
        { created_by: new mongoose.Types.ObjectId(targetId) },
        { allowed_managers: new mongoose.Types.ObjectId(targetId) },
        { _id: { $in: sharedProductIds } }
      ],
    };
  }
  return {}; // supervisor sees all
}

router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let startUTC, endUTC;

    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Convert IST calendar date → UTC range
      // e.g. 2026-04-17 IST = 2026-04-16 18:30 UTC → 2026-04-17 18:29:59 UTC
      const istMidnight = new Date(date + 'T00:00:00.000+05:30');
      startUTC = new Date(istMidnight.getTime());
      endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    } else {
      ({ startUTC, endUTC } = todayUTCRange());
    }

    // Safety log — helps debug calendar date issues
    const notCancelled = { status: { $ne: 'cancelled' }, ...ownerFilter(req) };

    // Fetch global low stock threshold from settings
    const Setting = require('../models/Setting');
    const thresholdSetting = await Setting.findOne({ key: 'low_stock_threshold' });
    const globalThreshold = parseInt(thresholdSetting?.value) || 10;
    // 🔴 FIX — 7-day range based on selected date
    const sevenDaysAgo = new Date(startUTC);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Run queries in two batches to avoid variable count mismatch bugs
    const [
      totalSalesAgg,
      selectedDateSalesAgg,
      invoiceCount,
      pendingCustomers,
      productCount,
      allActiveProducts,
      recentInvoices,
      selectedDateInvoices,
      salesByDay,
      topProducts,
      todayMovements,
      walkinPendingInvoices,
      selectedDatePendingInvoices,
    ] = await Promise.all([
      // 1. Total sales — all time
      Invoice.aggregate([
        { $match: notCancelled },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      // 2. Selected date sales
      Invoice.aggregate([
        { $match: { ...notCancelled, date: { $gte: startUTC, $lt: endUTC } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 }, concession: { $sum: '$discount' } } },
      ]),
      // 3. Total invoice count
      Invoice.countDocuments(notCancelled),
      // 4. Registered customers with balance > 0 (scoped)
      Customer.find({ balance: { $gt: 0 }, is_active: true, ...(['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role) ? { $or: [{ created_by: req.user.id }, { allowed_managers: req.user.id }] } : {}) })
        .populate('created_by', 'username display_name role')
        .sort({ balance: -1 }).limit(50),
      // 5. Product count
      Product.countDocuments({ is_active: true, ...(await getProductOwnerFilter(req)) }),
      // 6. All active products — used for both allProducts dropdown AND low stock filtering
      Product.find({ is_active: true, ...(await getProductOwnerFilter(req)) }).populate('created_by', 'username display_name role').populate('last_updated_by', 'username display_name role').select('name price stock unit gst is_active custom_low_stock weight_per_unit created_by saved_order_qty created_from_order is_custom last_updated_by createdAt updatedAt').sort({ name: 1 }),
      // 7. Recent invoices (sidebar widget)
      Invoice.find(notCancelled).sort({ date: -1 }).limit(5),
      // 9. All invoices on selected date (Today's Sale drill-down)
      Invoice.find({
        ...notCancelled,
        date: { $gte: startUTC, $lt: endUTC },
      }).populate('created_by', 'username display_name role').sort({ date: -1 }),
      // 10. Sales by day — last 7 days
      Invoice.aggregate([
        { $match: { ...notCancelled, date: { $gte: new Date(Date.now() - 7 * 86400000) } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } },
          sales: { $sum: '$total' },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      // 11. Top products
      Invoice.aggregate([
        { $match: notCancelled },
        { $unwind: '$items' },
        { $group: { _id: '$items.product_name', total_qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.total' } } },
        { $sort: { total_qty: -1 } },
        { $limit: 5 },
      ]),
      // 12. Today's stock movements
      StockMovement.find({ ...ownerFilter(req), date: { $gte: startUTC, $lt: endUTC } }).sort({ date: -1 }).limit(30),
      // 13. Walk-in invoices with unpaid balance — all time
      Invoice.find({
        ...notCancelled,
        customer_id: null,
        balance_due: { $gt: 0.01 },
      }).populate('created_by', 'username display_name role').sort({ balance_due: -1 }).limit(50),
      // 14. Selected-date invoices with unpaid balance
      Invoice.find({
        ...notCancelled,
        balance_due: { $gt: 0.01 },
        date: { $gte: startUTC, $lt: endUTC },
      }).populate('created_by', 'username display_name role').sort({ date: -1 }).limit(100),
    ]);


    // Fix: Compute low stock using per-product custom threshold OR global setting
    // globalThreshold already set above from DB
    const lowStockProducts = (allActiveProducts || []).filter(p => {
      // Use product-level custom threshold if set, otherwise global
      const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0)
        ? p.custom_low_stock
        : globalThreshold;
      if (p.saved_order_qty === -1) return false;
      return p.stock <= minStock || (p.saved_order_qty && p.saved_order_qty > 0);
    }).sort((a, b) => {
      if (a.created_from_order && !b.created_from_order) return -1;
      if (!a.created_from_order && b.created_from_order) return 1;
      return a.stock - b.stock;
    });
    // All-time pending dues (registered + walk-in merged)
    // Fix 3: For registered customers, find their latest unpaid invoice to use as invoice reference
    const registeredPending = await Promise.all(
      (pendingCustomers || []).map(async c => {
        const unpaidInvoices = await Invoice.find({
          customer_id: c._id,
          balance_due: { $gt: 0.01 },
          status: { $ne: 'cancelled' },
        }).sort({ date: 1 }).select('invoice_number _id balance_due date ist_formatted total');

        const latestInvoice = unpaidInvoices.length > 0 ? unpaidInvoices[unpaidInvoices.length - 1] : null;

        return {
          _id: c._id,
          name: c.name || 'Unknown',
          phone: c.phone || '',
          balance: c.balance || 0,
          type: 'registered',
          // Include invoice reference for payment button
          invoice_id: latestInvoice?._id?.toString() || null,
          invoice_number: latestInvoice?.invoice_number || null,
          unpaid_invoices: unpaidInvoices,
        };
      })
    );
    const walkinPending = (walkinPendingInvoices || []).map(inv => ({
      _id: inv._id,
      invoice_id: inv._id,
      customer_id: null,
      name: inv.customer_name || 'Walk-in Customer',
      phone: inv.customer_phone || '',
      balance: inv.balance_due || 0,
      invoice_number: inv.invoice_number || '',
      type: 'walkin',
    }));
    const allPendingDues = [...registeredPending, ...walkinPending]
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));

    // Selected-date pending dues
    const selectedDatePendingDues = (selectedDatePendingInvoices || []).map(inv => ({
      _id: inv._id,
      invoice_id: inv._id,
      customer_id: inv.customer_id || null,
      name: inv.customer_name || 'Walk-in Customer',
      phone: inv.customer_phone || '',
      balance: inv.balance_due || 0,
      invoice_number: inv.invoice_number || '',
      ist_formatted: inv.ist_formatted || '',
      type: inv.customer_id ? 'registered' : 'walkin',
    }));

    const selectedDatePendingBalance = selectedDatePendingDues
      .reduce((s, c) => s + (c.balance || 0), 0);

    // Safe statement data from selected date invoices
    // Fix 3: Settlement received = all invoice payments received on this date
    // This covers: cash payments, UPI, advance payments, partial payments
    const invoicePaymentsReceived = (selectedDateInvoices || []).reduce((s, i) => s + (i.amount_received || 0), 0);

    const statementData = {
      totalBilled: (selectedDateInvoices || []).reduce((s, i) => s + (i.total || 0), 0),
      // Fix 3: totalReceived = all payments received across all invoices on this date
      totalReceived: invoicePaymentsReceived,
      totalPending: (selectedDateInvoices || []).reduce((s, i) => s + (i.balance_due || 0), 0),
      invoiceCount: (selectedDateInvoices || []).length,
      byMode: (selectedDateInvoices || []).reduce((acc, inv) => {
        ((inv.payments) || []).forEach(p => {
          if (p && p.mode && p.amount) {
            acc[p.mode] = (acc[p.mode] || 0) + p.amount;
          }
        });
        return acc;
      }, {}),
    };

    res.json({
      totalSales: totalSalesAgg[0]?.total || 0,
      todaySales: selectedDateSalesAgg[0]?.total || 0,
      todayConcession: selectedDateSalesAgg[0]?.concession || 0,
      todayCount: selectedDateSalesAgg[0]?.count || 0,
      invoiceCount: invoiceCount || 0,
      productCount: productCount || 0,
      pendingBalance: selectedDatePendingBalance,
      allTimePendingBalance: allPendingDues.reduce((s, c) => s + (c.balance || 0), 0),
      pendingCustomers: allPendingDues,
      todayPendingDues: selectedDatePendingDues,
      statementData,
      todayInvoices: (selectedDateInvoices || []).map(inv => ({
        _id: inv._id,
        invoice_number: inv.invoice_number || '',
        customer_name: inv.customer_name || 'Walk-in Customer',
        customer_phone: inv.customer_phone || '',
        driver_name: inv.driver_name || '',
        vehicle_number: inv.vehicle_number || '',
        total: inv.total || 0,
        amount_received: inv.amount_received || 0,
        balance_due: inv.balance_due || 0,
        ist_formatted: inv.ist_formatted || '',
        date: inv.date || null,
      })),
      allProducts: (allActiveProducts || []).map(p => ({
        _id: p._id,
        name: p.name,
        stock: p.stock || 0,
        unit: p.unit || 'pcs',
        price: p.price || 0,
        gst: p.gst || 0,
        is_active: p.is_active,
        custom_low_stock: p.custom_low_stock != null ? p.custom_low_stock : null,
        weight_per_unit: p.weight_per_unit || 0,
        created_by: p.created_by,
        saved_order_qty: p.saved_order_qty || 0,
        last_updated_by: p.last_updated_by || null,
      })),
      // lowStockProducts — filtered using per-product or global threshold
      lowStockProducts: lowStockProducts.map(p => ({
        _id: p._id,
        name: p.name,
        stock: p.stock || 0,
        unit: p.unit || 'pcs',
        price: p.price || 0,
        gst: p.gst || 0,
        custom_low_stock: p.custom_low_stock != null ? p.custom_low_stock : null,
        weight_per_unit: p.weight_per_unit || 0,
        saved_order_qty: p.saved_order_qty || 0,
        created_from_order: p.created_from_order || false,
        is_custom: p.is_custom || false,
        last_updated_by: p.last_updated_by || null,
      })),
      customersWithDues: registeredPending,
      salesByDay: salesByDay.map(d => ({ day: d._id, sales: d.sales, count: d.count })),
      topProducts: topProducts.map(p => ({ product_name: p._id, total_qty: p.total_qty, revenue: p.revenue })),
      todayMovements,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/dashboard/record-payment — record dues payment and update customer/invoice balance
router.post('/record-payment', async (req, res) => {
  try {
    const { invoice_id, customer_id, amount, mode, reference } = req.body;
    if (!amount || !mode) {
      return res.status(400).json({ error: 'amount and mode are required' });
    }

    const { formatIST } = require('../utils/timeUtils');
    let paid = parseFloat(amount) || 0;
    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + IST_OFFSET_MS);
    const ist_date = istDate.toISOString().slice(0, 10);

    let customer = null;
    if (customer_id) {
      customer = await Customer.findById(customer_id);
    }

    let invoicesToPay = [];

    // 1. If invoice_id is provided, we pay ONLY that specific invoice
    if (invoice_id) {
      try { 
        const specificInvoice = await Invoice.findById(invoice_id); 
        if (specificInvoice) invoicesToPay.push(specificInvoice);
      } catch (e) { /* invalid id format */ }
    } 
    // 2. If no invoice_id but we have customer_id, we fetch ALL unpaid invoices for cascading
    else if (customer_id) {
      invoicesToPay = await Invoice.find({
        customer_id: customer_id,
        balance_due: { $gt: 0.01 },
        status: { $ne: 'cancelled' },
      }).sort({ date: 1 }); // SORT BY OLDEST FIRST!
    }

    if (invoicesToPay.length === 0 && !customer) {
      return res.status(404).json({ error: 'Invoice not found and no customer specified' });
    }

    // Capture previous balance before mutating anything
    let previousBalance = 0;
    if (customer) {
      previousBalance = customer.balance || 0;
    } else {
      previousBalance = invoicesToPay.reduce((s, inv) => s + (inv.balance_due || 0), 0);
    }

    // 3. Cascade payment across invoices
    let advance = 0;
    let originalPaid = paid;

    for (let invoice of invoicesToPay) {
      if (paid <= 0) break; // Payment exhausted
      
      const currentDue = invoice.balance_due || 0;
      const amountToApply = Math.min(paid, currentDue);

      invoice.payments.push({ mode, amount: amountToApply, reference: reference || '' });
      invoice.amount_received = (invoice.amount_received || 0) + amountToApply;
      invoice.balance_due = currentDue - amountToApply;
      await invoice.save();

      paid -= amountToApply;
    }

    // 4. Any remaining payment becomes advance credit on the customer's ledger
    advance = paid;

    // 5. Update the customer's ledger balance
    if (customer) {
      // originalPaid is the full amount they handed us. It always reduces their ledger balance.
      if (advance > 0 && invoicesToPay.length === 0) {
        // If they had no invoices at all, the entire amount might push them into negative (credit)
        const pureAdvance = Math.max(0, originalPaid - customer.balance);
        customer.balance = Math.max(0, customer.balance - originalPaid);
        if(pureAdvance > 0) customer.balance -= pureAdvance; // negative balance
      } else {
        // Reduce balance by the total amount they paid.
        // If they pay 10,000 and balance was 6,000, new balance is -4,000 (advance)
        customer.balance = customer.balance - originalPaid;
      }
      await customer.save();
    }

    // 6. Record the Settlement entry
    const partyName = customer ? customer.name : (invoicesToPay[0] ? invoicesToPay[0].customer_name : 'Walk-in Customer');
    const ref = reference || (invoicesToPay.length === 1 ? invoicesToPay[0].invoice_number : (invoicesToPay.length > 1 ? 'Multiple Invoices' : ''));
    
    await Settlement.create({
      type: 'other_income',
      received_category: advance > 0 && originalPaid === advance ? 'advance_payment' : 'due_cleared',
      party_name: partyName,
      amount: originalPaid,
      mode: mode || 'cash',
      reference: ref,
      notes: advance > 0 && originalPaid === advance ? 'Advance Received' : 'Due Received',
      date: now,
      ist_date,
      ist_formatted: formatIST(now),
      created_by: req.user ? req.user.id : null,
    });

    // 6b. Also create Payment record for customer ledger history
    if (customer) {
      try {
        const Payment = require('../models/Payment');
        await Payment.create({
          customer_id: customer._id,
          amount: originalPaid,
          previous_balance: previousBalance,
          new_balance: customer.balance,
          mode: mode || 'cash',
          reference: ref,
          notes: '',
          collected_by: req.user ? req.user.id : null,
          invoice_id: invoice_id || null,
          date: now,
          ist_date,
          ist_formatted: formatIST(now),
        });
      } catch (payErr) {
        console.error('Failed to create Payment record:', payErr.message);
      }
    }

    // 7. Log Activity
    const entityType = invoicesToPay.length === 1 && !customer_id ? 'invoice' : 'customer';
    const entityId = invoicesToPay.length === 1 && !customer_id ? invoicesToPay[0]._id : (customer ? customer._id : null);
    
    const remainingBalance = customer ? customer.balance : 0;
    
    await logActivity(req, {
      action: 'payment',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: partyName,
      description: `Collected ₹${originalPaid.toFixed(2)} via ${mode || 'cash'}. Prev Due: ₹${previousBalance.toFixed(2)} | Remaining: ₹${remainingBalance.toFixed(2)}`,
      changes: { mode, amount: originalPaid, previousBalance, remainingBalance }
    });

    res.json({
      success: true,
      amount_received: originalPaid,
      advance_stored: advance > 0 ? advance : 0,
      message: advance > 0
        ? `Payment recorded. ₹${advance.toFixed(2)} stored as advance credit.`
        : `₹${originalPaid.toFixed(2)} recorded successfully.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/check-phone — check if a phone number already belongs to a registered customer or has walk-in dues
router.get('/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.json({ registered: null, walkin_invoices: [] });

    const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanedPhone || cleanedPhone.length < 10) return res.json({ registered: null, walkin_invoices: [] });

    // 1. Check for registered customer
    // We use regex to match the last 10 digits to handle leading zeros or +91
    const customerRegex = new RegExp(`${cleanedPhone}$`);
    const registered = await Customer.findOne({
      phone: { $regex: customerRegex },
      is_active: true,
    });

    // 2. Check for unpaid walk-in invoices
    const walkin_invoices = await Invoice.find({
      customer_id: null,
      customer_phone: { $regex: customerRegex },
      balance_due: { $gt: 0.01 },
      status: { $ne: 'cancelled' },
    });

    res.json({
      registered: registered ? { id: registered._id, name: registered.name, balance: registered.balance } : null,
      walkin_invoices: walkin_invoices.map(i => ({ invoice_number: i.invoice_number, balance_due: i.balance_due, name: i.customer_name })),
      total_walkin_due: walkin_invoices.reduce((sum, i) => sum + i.balance_due, 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/walkin-due — create a walk-in due without an invoice
router.post('/walkin-due', async (req, res) => {
  try {
    const { name, amount, phone, notes, force_walkin } = req.body;
    if (!name || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'name and amount are required' });
    }
    const { formatIST } = require('../utils/timeUtils');
    const now = new Date();
    const dueAmount = parseFloat(amount);
    const customerPhone = phone && phone.trim() ? phone.trim() : 'Not Available';

    // Phone lookup: if phone provided and NOT force_walkin, check for existing registered customer
    if (customerPhone !== 'Not Available' && !force_walkin) {
      const existingCustomer = await Customer.findOne({
        phone: customerPhone,
        is_active: true,
      });

      if (existingCustomer) {
        // Link due to the registered customer's ledger instead of creating walk-in invoice
        const invoice = new Invoice({
          customer_id: existingCustomer._id,
          customer_name: existingCustomer.name,
          customer_phone: existingCustomer.phone,
          items: [{
            product_name: notes || 'Due entry',
            qty: 1,
            price: dueAmount,
            gst: 0,
            taxable_amount: dueAmount,
            cgst: 0,
            sgst: 0,
            total: dueAmount,
          }],
          subtotal: dueAmount,
          discount: 0,
          gst_total: 0,
          total: dueAmount,
          total_with_prev_balance: dueAmount + (existingCustomer.getManagerBalance(req.user.id) || 0),
          payments: [],
          amount_received: 0,
          balance_due: dueAmount,
          notes: notes || 'Manual due entry (phone-matched)',
          gst_enabled: false,
          date: now,
          ist_formatted: formatIST(now),
          created_by: req.user ? req.user.id : null,
        });
        await invoice.save();

        // Update customer's per-manager balance
        const prevBalance = existingCustomer.getManagerBalance(req.user.id);
        existingCustomer.setManagerBalance(req.user.id, prevBalance + dueAmount);
        await existingCustomer.save();

        // Log Activity
        logActivity(req, {
          action: 'create',
          entity_type: 'invoice',
          entity_id: invoice._id,
          entity_name: invoice.invoice_number,
          description: `Due entry added for ${existingCustomer.name}. Amount: ₹${dueAmount.toFixed(2)}`,
        });

        return res.status(201).json({
          success: true,
          matched_customer: true,
          customer_id: existingCustomer._id,
          customer_name: existingCustomer.name,
          invoice_id: invoice._id,
          invoice_number: invoice.invoice_number,
          message: `Due of ₹${dueAmount.toFixed(2)} added to registered customer "${existingCustomer.name}" ledger`,
        });
      }
    }

    // No phone match — create standard walk-in invoice
    const invoice = new Invoice({
      customer_id: null,
      customer_name: name.trim(),
      customer_phone: customerPhone,
      items: [{
        product_name: notes || 'Due entry',
        qty: 1,
        price: dueAmount,
        gst: 0,
        taxable_amount: dueAmount,
        cgst: 0,
        sgst: 0,
        total: dueAmount,
      }],
      subtotal: dueAmount,
      discount: 0,
      gst_total: 0,
      total: dueAmount,
      total_with_prev_balance: dueAmount,
      payments: [],
      amount_received: 0,
      balance_due: dueAmount,
      notes: notes || 'Manual due entry',
      gst_enabled: false,
      date: now,
      ist_formatted: formatIST(now),
      created_by: req.user ? req.user.id : null,
    });

    await invoice.save();

    // Log Activity
    logActivity(req, {
      action: 'create',
      entity_type: 'invoice',
      entity_id: invoice._id,
      entity_name: invoice.invoice_number,
      description: `Walk-in due entry created for ${name}. Amount: ₹${dueAmount.toFixed(2)}`,
    });

    res.status(201).json({
      success: true,
      matched_customer: false,
      invoice_id: invoice._id,
      invoice_number: invoice.invoice_number,
      message: `Due of ₹${dueAmount.toFixed(2)} created for ${name}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
