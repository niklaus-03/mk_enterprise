const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Settlement = require('../models/Settlement');
const { logActivity } = require('./activityLogs');
const { formatIST } = require('../utils/timeUtils');
const auth = require('../middleware/auth');

router.use(auth);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// GET /history/:customer_id — payment history + combined ledger for a customer
router.get('/history/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const { date, all } = req.query;

    const customer = await Customer.findById(customer_id).select('name phone balance');
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Build payment filter
    let paymentFilter = { customer_id };

    if (all !== 'true') {
      // Filter by IST date
      let filterDate = date;
      if (!filterDate || !/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
        // Default to today's IST date
        const nowIST = new Date(Date.now() + IST_OFFSET_MS);
        filterDate = nowIST.toISOString().slice(0, 10);
      }
      paymentFilter.ist_date = filterDate;
    }

    const [payments, invoices] = await Promise.all([
      Payment.find(paymentFilter)
        .populate('collected_by', 'username display_name role')
        .sort({ date: -1 }),
      Invoice.find({ customer_id, status: { $ne: 'cancelled' } })
        .sort({ date: -1 })
        .limit(100),
    ]);

    // Calculate total paid across ALL payments (not filtered)
    const allPayments = await Payment.find({ customer_id });
    const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      payments,
      invoices,
      customer: {
        name: customer.name,
        phone: customer.phone,
        balance: customer.balance,
      },
      totalPaid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /collect/:customer_id — collect a payment from a customer
router.post('/collect/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const { amount, mode, reference, notes, invoice_id } = req.body;

    let paid = parseFloat(amount) || 0;
    if (paid <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const customer = await Customer.findById(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Capture previous balance
    const previous_balance = customer.balance || 0;
    const originalPaid = paid;

    // Build list of invoices to pay
    let invoicesToPay = [];

    let invoiceIdsToFetch = req.body.invoice_ids || (invoice_id ? invoice_id.split(',').map(id => id.trim()) : null);
    if (invoiceIdsToFetch && Array.isArray(invoiceIdsToFetch)) {
      invoiceIdsToFetch = invoiceIdsToFetch.filter(id => id && id.length === 24); // Remove 'OPENING_BALANCE'
    }

    if (invoiceIdsToFetch && Array.isArray(invoiceIdsToFetch) && invoiceIdsToFetch.length > 0) {
      // Pay specific invoices
      try {
        const specificInvoices = await Invoice.find({ _id: { $in: invoiceIdsToFetch } }).sort({ date: 1 });
        if (specificInvoices && specificInvoices.length > 0) {
          invoicesToPay = specificInvoices;
        }
      } catch (e) { /* invalid id format */ }
    } else if (invoice_id) {
      // Fallback for single string invoice_id that wasn't an array
      try {
        const specificInvoice = await Invoice.findById(invoice_id);
        if (specificInvoice) invoicesToPay.push(specificInvoice);
      } catch (e) { /* invalid id format */ }
    } else {
      // Cascade: fetch all unpaid invoices for customer, oldest first
      invoicesToPay = await Invoice.find({
        customer_id: customer_id,
        balance_due: { $gt: 0.01 },
        status: { $ne: 'cancelled' },
      }).sort({ date: 1 });
    }

    // Cascade payment across invoices
    let advance = 0;

    for (let invoice of invoicesToPay) {
      if (paid <= 0) break;

      const currentDue = invoice.balance_due || 0;
      const amountToApply = Math.min(paid, currentDue);

      invoice.payments.push({ mode: mode || 'cash', amount: amountToApply, reference: reference || '' });
      invoice.amount_received = (invoice.amount_received || 0) + amountToApply;
      invoice.balance_due = currentDue - amountToApply;
      await invoice.save();

      // FIX: Reduce the specific manager's balance!
      if (customer.setManagerBalance && !customer.merged_by_admin && invoice.created_by) {
        const creatorId = invoice.created_by;
        let currentMB = customer.getManagerBalance(creatorId);
        customer.setManagerBalance(creatorId, currentMB - amountToApply);
      } else {
        customer.balance = customer.balance - amountToApply;
      }

      paid -= amountToApply;
    }

    // Remaining amount becomes advance
    advance = paid;

    // Update customer balance for the advance portion
    if (advance > 0) {
      if (customer.setManagerBalance && !customer.merged_by_admin) {
        // Apply advance to the manager who collected the payment
        const collectorId = req.user.id;
        let currentMB = customer.getManagerBalance(collectorId);
        customer.setManagerBalance(collectorId, currentMB - advance);
      } else {
        customer.balance = customer.balance - advance;
      }
    }
    await customer.save();

    const new_balance = customer.balance;

    // IST date computation
    const now = new Date();
    const istDate = new Date(now.getTime() + IST_OFFSET_MS);
    const ist_date = istDate.toISOString().slice(0, 10);
    const ist_formatted = formatIST(now);

    // Create Payment record
    const payment = await Payment.create({
      customer_id,
      amount: originalPaid,
      previous_balance,
      new_balance,
      mode: mode || 'cash',
      reference: reference || '',
      notes: notes || '',
      collected_by: req.user.id,
      invoice_id: invoice_id || null,
      date: now,
      ist_date,
      ist_formatted,
    });

    // Create Settlement entry
    const partyName = customer.name || 'Unknown Customer';
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
      ist_formatted,
      created_by: req.user.id,
    });

    // Log activity
    await logActivity(req, {
      action: 'payment',
      entity_type: 'customer',
      entity_id: customer._id,
      entity_name: partyName,
      description: `Collected ₹${originalPaid.toFixed(2)} via ${mode || 'cash'}. Prev Due: ₹${previous_balance.toFixed(2)} | Remaining: ₹${new_balance.toFixed(2)}`,
      changes: { mode: mode || 'cash', amount: originalPaid, previousBalance: previous_balance, remainingBalance: new_balance },
    });

    res.json({
      success: true,
      payment,
      message: advance > 0
        ? `Payment of ₹${originalPaid.toFixed(2)} recorded. ₹${advance.toFixed(2)} stored as advance credit.`
        : `Payment of ₹${originalPaid.toFixed(2)} recorded successfully.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
