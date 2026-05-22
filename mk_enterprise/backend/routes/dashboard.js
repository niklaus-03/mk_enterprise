const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const auth = require('../middleware/auth');
const { todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

// Helper: managers see only their own data
function ownerFilter(req) {
  if (req.user.role === 'manager') {
    return { created_by: req.user.id };
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
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      // 3. Total invoice count
      Invoice.countDocuments(notCancelled),
      // 4. Registered customers with balance > 0 (scoped)
      Customer.find({ balance: { $gt: 0 }, is_active: true, ...(req.user.role === 'manager' ? { $or: [{ created_by: req.user.id }, { allowed_managers: req.user.id }] } : {}) }).sort({ balance: -1 }).limit(50),
      // 5. Product count
      Product.countDocuments({ is_active: true }),
      // 6. All active products — used for both allProducts dropdown AND low stock filtering
      Product.find({ is_active: true }).select('name price stock unit gst is_active custom_low_stock weight_per_unit').sort({ name: 1 }),
      // 7. Recent invoices (sidebar widget)
      Invoice.find(notCancelled).sort({ date: -1 }).limit(5),
      // 9. All invoices on selected date (Today's Sale drill-down)
      Invoice.find({
        ...notCancelled,
        date: { $gte: startUTC, $lt: endUTC },
      }).sort({ date: -1 }),
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
      }).sort({ balance_due: -1 }).limit(50),
      // 14. Selected-date invoices with unpaid balance
      Invoice.find({
        ...notCancelled,
        balance_due: { $gt: 0.01 },
        date: { $gte: startUTC, $lt: endUTC },
      }).sort({ date: -1 }).limit(100),
    ]);


    // Fix: Compute low stock using per-product custom threshold OR global setting
    // globalThreshold already set above from DB
    const lowStockProducts = (allActiveProducts || []).filter(p => {
      // Use product-level custom threshold if set, otherwise global
      const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0)
        ? p.custom_low_stock
        : globalThreshold;
      // Unit-independent: just compare raw stock number against threshold
      return p.stock <= minStock;
    }).sort((a, b) => a.stock - b.stock); // lowest stock first
    // All-time pending dues (registered + walk-in merged)
    // Fix 3: For registered customers, find their latest unpaid invoice to use as invoice reference
    const registeredPending = await Promise.all(
      (pendingCustomers || []).map(async c => {
        const latestInvoice = await Invoice.findOne({
          customer_id: c._id,
          balance_due: { $gt: 0.01 },
          status: { $ne: 'cancelled' },
        }).sort({ date: -1 }).select('invoice_number _id balance_due');

        return {
          _id: c._id,
          name: c.name || 'Unknown',
          phone: c.phone || '',
          balance: c.balance || 0,
          type: 'registered',
          // Include invoice reference for payment button
          invoice_id: latestInvoice?._id?.toString() || null,
          invoice_number: latestInvoice?.invoice_number || null,
        };
      })
    );
    const walkinPending = (walkinPendingInvoices || []).map(inv => ({
      _id: inv._id,
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
        total: inv.total || 0,
        amount_received: inv.amount_received || 0,
        balance_due: inv.balance_due || 0,
        ist_formatted: inv.ist_formatted || '',
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
    let invoice = null;

    // Fix 3: Try to find invoice by invoice_id first
    if (invoice_id) {
      try { invoice = await Invoice.findById(invoice_id); } catch (e) { /* invalid id format */ }
    }

    // Fix 3: For registered customers — find their latest unpaid invoice
    if (!invoice && customer_id) {
      invoice = await Invoice.findOne({
        customer_id: customer_id,
        balance_due: { $gt: 0.01 },
        status: { $ne: 'cancelled' },
      }).sort({ date: -1 });
    }

    // Fix 3: Still not found — update customer balance directly
    if (!invoice) {
      // Customer-only payment (no specific invoice — reduce customer balance)
      if (customer_id) {
        const paid = parseFloat(amount) || 0;
        const customer = await Customer.findById(customer_id);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const advance = Math.max(0, paid - customer.balance);
        customer.balance = Math.max(0, customer.balance - paid);
        await customer.save();

        return res.json({
          success: true,
          balance_due: 0,
          amount_received: paid,
          advance_stored: advance,
          message: advance > 0
            ? `Due cleared. ₹${advance.toFixed(2)} stored as advance.`
            : `₹${paid.toFixed(2)} recorded for customer.`,
        });
      }
      return res.status(404).json({ error: 'Invoice not found and no customer specified' });
    }

    const paid = parseFloat(amount) || 0;
    const currentDue = invoice.balance_due || 0;

    invoice.payments.push({ mode, amount: paid, reference: reference || '' });
    invoice.amount_received = (invoice.amount_received || 0) + paid;

    let advance = 0;
    if (paid >= currentDue) {
      // Clears full due; any extra becomes advance
      advance = paid - currentDue;
      invoice.balance_due = 0;
    } else {
      invoice.balance_due = currentDue - paid;
    }
    await invoice.save();

    // Update registered customer balance
    // Positive balance = customer owes us; Negative = advance paid by customer
    const custId = customer_id || invoice.customer_id;
    if (custId) {
      const customer = await Customer.findById(custId);
      if (customer) {
        if (advance > 0) {
          // Subtract advance from balance (makes it negative = customer credit)
          customer.balance = customer.balance - paid;
        } else {
          customer.balance = Math.max(0, customer.balance - paid);
        }
        await customer.save();
      }
    }

    res.json({
      success: true,
      balance_due: invoice.balance_due,
      amount_received: invoice.amount_received,
      advance_stored: advance > 0 ? advance : 0,
      message: advance > 0
        ? `Due cleared. ₹${advance.toFixed(2)} stored as advance for this customer.`
        : `₹${paid.toFixed(2)} recorded successfully.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/walkin-due — create a walk-in due without an invoice
router.post('/walkin-due', async (req, res) => {
  try {
    const { name, amount, phone, notes } = req.body;
    if (!name || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'name and amount are required' });
    }
    const { formatIST } = require('../utils/timeUtils');
    const now = new Date();
    const dueAmount = parseFloat(amount);
    const customerPhone = phone && phone.trim() ? phone.trim() : 'Not Available';

    // Phone lookup: if phone provided, check for existing registered customer
    if (customerPhone !== 'Not Available') {
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
