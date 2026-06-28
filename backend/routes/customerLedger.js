const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

router.use(auth);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Helper: get IST date string from a JS Date
function toISTDateStr(d) {
  const istD = new Date(new Date(d).getTime() + IST_OFFSET_MS);
  return istD.toISOString().slice(0, 10);
}

// GET /api/customer-ledger/:customer_id
// Returns a fully computed ledger with running balances, summary KPIs, and brought-forward logic
router.get('/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const { date, all } = req.query;

    const customer = await Customer.findById(customer_id).select('name phone balance');
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Fetch ALL invoices and payments (no artificial limit)
    const [payments, invoices] = await Promise.all([
      Payment.find({ customer_id })
        .populate('collected_by', 'username display_name role')
        .sort({ date: -1 })
        .lean(),
      Invoice.find({ customer_id, status: { $ne: 'cancelled' } })
        .sort({ date: -1 })
        .lean(),
    ]);

    // Calculate total paid across ALL payments
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Build raw ledger items
    let items = [];

    // Add Payments
    payments.forEach(p => {
      items.push({
        _raw: p,
        type: 'payment',
        dateObj: new Date(p.date),
        id: p._id.toString(),
        ref: p.reference || p.mode,
        desc: p.notes || `Payment via ${(p.mode || 'cash').replace('_', ' ')}`,
        invoiceAmt: 0,
        receivedAmt: p.amount,
        mode: p.mode,
        collected_by: p.collected_by,
        ist_date: p.ist_date,
      });
    });

    // Add Invoices & Goods Entries
    invoices.forEach(i => {
      if (i.is_ledger_entry) {
        items.push({
          _raw: i,
          type: 'goods_entry',
          dateObj: new Date(i.date),
          id: i._id.toString(),
          ref: i.invoice_number || 'Khata Entry',
          desc: (i.consolidated_into ? 'Billed in Invoice' : 'Unbilled Goods Entry') + 
                (i.vehicle_number ? ` - Veh: ${i.vehicle_number.toUpperCase()}` : '') +
                (i.driver_name ? ` (${i.driver_name})` : ''),
          invoiceAmt: 0,
          receivedAmt: 0,
          isBilled: !!i.consolidated_into,
          billedInId: i.consolidated_into ? i.consolidated_into.toString() : null,
          ist_date: i.ist_formatted ? i.ist_formatted.split(' ')[0] : null,
        });
      } else {
        items.push({
          _raw: i,
          type: 'invoice',
          dateObj: new Date(i.date),
          id: i._id.toString(),
          ref: i.invoice_number,
          desc: i.notes || 'Sales Invoice',
          invoiceAmt: i.total,
          receivedAmt: 0,
          ist_date: i.ist_formatted ? i.ist_formatted.split(' ')[0] : null,
        });
      }
    });

    // Determine IST date for each item
    items.forEach(item => {
      if (!item.ist_date) {
        item.ist_date = toISTDateStr(item.dateObj);
      }
    });

    // Filter by date if needed
    const isAllHistory = all === 'true';
    if (!isAllHistory) {
      let filterDate = date;
      if (!filterDate || !/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
        const nowIST = new Date(Date.now() + IST_OFFSET_MS);
        filterDate = nowIST.toISOString().slice(0, 10);
      }
      items = items.filter(item => item.ist_date === filterDate);
    }

    // Sort oldest to newest for running balance computation
    items.sort((a, b) => a.dateObj - b.dateObj);

    // Calculate sum of due changes
    let sumDueChanges = 0;
    items.forEach(item => {
      sumDueChanges += (item.invoiceAmt - item.receivedAmt);
    });

    // Brought Forward: ensures actual balance matches computed ending balance
    const broughtForward = (customer.balance || 0) - sumDueChanges;
    let currentBalance = broughtForward;
    let computedLedger = [];

    // Add Brought Forward row
    if (Math.abs(broughtForward) > 0.01 || (items.length > 0 && invoices.length >= 100)) {
      computedLedger.push({
        type: 'opening_balance',
        date: items.length > 0 ? new Date(items[0].dateObj.getTime() - 1000).toISOString() : new Date().toISOString(),
        id: 'brought_forward',
        ref: '-',
        desc: 'Previous Balance (Brought Forward)',
        openingBalance: 0,
        invoiceAmt: broughtForward > 0 ? broughtForward : 0,
        receivedAmt: broughtForward < 0 ? Math.abs(broughtForward) : 0,
        dueChange: broughtForward,
        runningBalance: broughtForward,
        isBroughtForward: true,
      });
    }

    // Compute running balance for each item
    items.forEach(item => {
      const opBal = currentBalance;
      const dueChange = item.invoiceAmt - item.receivedAmt;
      currentBalance += dueChange;

      computedLedger.push({
        type: item.type,
        date: item.dateObj.toISOString(),
        id: item.id,
        ref: item.ref,
        desc: item.desc,
        openingBalance: opBal,
        invoiceAmt: item.invoiceAmt,
        receivedAmt: item.receivedAmt,
        dueChange: dueChange,
        runningBalance: currentBalance,
        isBilled: item.isBilled || false,
        billedInId: item.billedInId || null,
        mode: item.mode || null,
        collected_by: item.collected_by || null,
        details: item._raw,
      });
    });

    // Reverse to show newest first
    computedLedger.reverse();

    // Summary KPIs
    const totalPurchases = invoices.filter(i => !i.is_ledger_entry).reduce((s, i) => s + (i.total || 0), 0);
    const totalConcession = invoices.filter(i => !i.is_ledger_entry).reduce((s, i) => s + (i.discount || 0), 0);
    const totalOutstanding = Math.max(0, customer.balance || 0);
    const advanceBalance = Math.max(0, -(customer.balance || 0));
    const totalBilled = (customer.balance || 0) + totalPaid + totalConcession;

    res.json({
      customer: {
        name: customer.name,
        phone: customer.phone,
        balance: customer.balance,
      },
      summary: {
        totalOutstanding,
        totalPurchases,
        totalBilled,
        totalReceived: totalPaid,
        advanceBalance,
        totalConcession,
      },
      ledger: computedLedger,
      // Also send raw data for features that need it (consolidation, collect payment modal)
      invoices,
      payments,
      totalPaid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
