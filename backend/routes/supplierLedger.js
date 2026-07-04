const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Settlement = require('../models/Settlement');
const Delivery = require('../models/Delivery');
const auth = require('../middleware/auth');

router.use(auth);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Helper: get IST date string from a JS Date
function toISTDateStr(d) {
  const istD = new Date(new Date(d).getTime() + IST_OFFSET_MS);
  return istD.toISOString().slice(0, 10);
}

// GET /api/supplier-ledger/:supplier_id/master
router.get('/:supplier_id/master', async (req, res) => {
  try {
    const { supplier_id } = req.params;
    const Supplier = require('../models/Supplier');
    const Settlement = require('../models/Settlement');
    const Delivery = require('../models/Delivery');
    const Customer = require('../models/Customer');
    const Invoice = require('../models/Invoice');
    const Payment = require('../models/Payment');

    const supplier = await Supplier.findById(supplier_id)
      .populate({ path: 'linked_customer_ids', select: 'name balance created_by', populate: { path: 'created_by', select: 'display_name username' } })
      .lean();

    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const supplierName = supplier.name;
    const customerIds = supplier.linked_customer_ids ? supplier.linked_customer_ids.map(c => c._id) : [];

    // 1. Supplier Data
    const settlementQuery = {
      party_name: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      type: { $in: ['paid_to_supplier', 'other_expense', 'walkin_delivery'] },
    };
    const deliveryQuery = {
      $or: [
        { supplier: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { "suppliers_data.supplier_name": { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ],
      status: { $in: ['delivered'] },
    };

    const [settlements, deliveries] = await Promise.all([
      Settlement.find(settlementQuery).populate('created_by', 'username display_name').lean(),
      Delivery.find(deliveryQuery).populate('created_by', 'username display_name').lean()
    ]);

    // 2. Customer Data
    const [invoices, payments] = await Promise.all([
      Invoice.find({ customer: { $in: customerIds } }).populate('created_by', 'username display_name').lean(),
      Payment.find({ customer: { $in: customerIds } }).populate('collected_by', 'username display_name').lean()
    ]);

    const rawHistory = [];

    settlements.forEach(s => {
      rawHistory.push({
        type: 'supplier_payment',
        date: s.date,
        amount: s.amount,
        original: s
      });
    });

    deliveries.forEach(d => {
      let amount = 0;
      const matchingItems = (d.items || []).filter(i => (i.supplier_name && i.supplier_name === supplierName) || (!i.supplier_name && d.supplier === supplierName));
      matchingItems.forEach(i => {
        const base = parseFloat(i.base_price) || 0; const extra = parseFloat(i.supplier_charge_per_item) || 0; amount += (i.quantity * (base + extra));
      });
      if (d.supplier === supplierName && d.grand_total != null) amount = d.grand_total;

      rawHistory.push({
        type: 'supplier_delivery',
        date: d.delivered_at || d.createdAt,
        amount: amount,
        original: { ...d, amount }
      });

      if (d.suppliers_data && Array.isArray(d.suppliers_data)) {
         const supData = d.suppliers_data.find(sd => sd.supplier_name === supplierName);
         if (supData && supData.cash_given) {
            rawHistory.push({
              type: 'supplier_payment',
              date: d.delivered_at || d.createdAt,
              amount: supData.cash_given,
              original: { mode: 'cash', amount: supData.cash_given, created_by: d.created_by }
            });
         }
      }
    });

    invoices.forEach(inv => {
      rawHistory.push({
        type: 'customer_invoice',
        date: inv.date,
        amount: inv.total,
        original: inv
      });
    });

    payments.forEach(p => {
      rawHistory.push({
        type: 'customer_payment',
        date: p.date,
        amount: p.amount,
        original: { ...p, created_by: p.collected_by }
      });
    });

    rawHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalCustomerBal = 0;
    if (supplier.linked_customer_ids) {
       supplier.linked_customer_ids.forEach(c => totalCustomerBal += (c.balance || 0));
    }
    let rb = totalCustomerBal - (supplier.balance || 0);
    const ob = rb;

    const ledger = [];
    rawHistory.forEach(row => {
       if (row.type === 'supplier_delivery') {
         rb -= row.amount;
       } else if (row.type === 'supplier_payment') {
         rb += row.amount;
       } else if (row.type === 'customer_invoice') {
         rb += row.amount;
       } else if (row.type === 'customer_payment') {
         rb -= row.amount;
       }
       ledger.push({
         ...row,
         runningBalance: rb
       });
    });

    let currentSupBal = supplier.balance || 0;
    let supPurchases = 0;
    let supPaid = 0;
    rawHistory.forEach(r => {
      if (r.type === 'supplier_delivery') supPurchases += r.amount;
      if (r.type === 'supplier_payment') supPaid += r.amount;
    });
    currentSupBal = currentSupBal + supPurchases - supPaid;

    let currentCustBal = totalCustomerBal;
    let custPurchases = 0;
    let custPaid = 0;
    rawHistory.forEach(r => {
      if (r.type === 'customer_invoice') custPurchases += r.amount;
      if (r.type === 'customer_payment') custPaid += r.amount;
    });
    currentCustBal = currentCustBal + custPurchases - custPaid;

    res.json({
      supplier,
      ledger,
      openingBalance: ob,
      currentSupplierBalance: currentSupBal,
      currentCustomerBalance: currentCustBal,
      summary: {
         totalDue: rb > 0 ? rb : 0,
         totalAdvance: rb < 0 ? -rb : 0,
         totalPaid: supPaid + custPaid,
         totalPurchases: supPurchases + custPurchases,
         currentBalance: rb
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/supplier-ledger/:supplier_id
// Returns a fully computed supplier ledger with running balances and payment-delivery merging
router.get('/:supplier_id', async (req, res) => {
  try {
    const { supplier_id } = req.params;
    const { date, all } = req.query;

    // Handle virtual suppliers (ad-hoc payments)
    let supplier;
    if (supplier_id.startsWith('virtual_')) {
      const name = supplier_id.replace('virtual_', '').replace(/_/g, ' ');
      supplier = { _id: supplier_id, name, is_virtual: true, balance: 0 };
    } else {
      supplier = await Supplier.findById(supplier_id)
        .populate('linked_customer_ids', 'name balance')
        .lean();
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplierName = supplier.name;

    // Fetch settlements (payments to supplier) and deliveries
    const settlementQuery = {
      party_name: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      type: { $in: ['paid_to_supplier', 'other_expense', 'walkin_delivery'] },
    };
    const deliveryQuery = {
      $or: [
        { supplier: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { "suppliers_data.supplier_name": { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ],
      status: { $in: ['delivered'] },
    };

    const [settlements, deliveries] = await Promise.all([
      Settlement.find(settlementQuery)
        .sort({ date: -1 })
        .populate('created_by', 'username display_name role')
        .lean(),
      Delivery.find(deliveryQuery)
        .sort({ delivered_at: -1 })
        .populate('created_by', 'username display_name role')
        .lean(),
    ]);

    // Build unified history items
    const rawHistory = [
      ...settlements.map(s => ({
        type: 'payment',
        _id: s._id.toString(),
        date: s.date,
        amount: s.amount,
        mode: s.mode,
        notes: s.notes,
        created_by: s.created_by,
        ist_date: s.ist_date,
        ist_formatted: s.ist_formatted,
      })),
      ...deliveries.flatMap(d => {
        let amount = 0;
        const matchingItems = (d.items || []).filter(i => (i.supplier_name && i.supplier_name === supplierName) || (!i.supplier_name && d.supplier === supplierName));
        matchingItems.forEach(i => {
          const base = parseFloat(i.base_price) || 0; const extra = parseFloat(i.supplier_charge_per_item) || 0; amount += (i.quantity * (base + extra));
        });

        if (d.supplier === supplierName && d.grand_total != null) {
          amount = d.grand_total;
        }

        let cashGiven = 0;
        if (d.suppliers_data && Array.isArray(d.suppliers_data)) {
           const supData = d.suppliers_data.find(sd => sd.supplier_name === supplierName);
           if (supData && supData.cash_given) cashGiven = supData.cash_given;
        }

        const deliveryEvent = {
          type: 'delivery',
          _id: d._id.toString(),
          date: d.delivered_at || d.createdAt,
          amount: amount,
          items: matchingItems,
          notes: d.notes || d.vehicle_number || d.delivery_type,
          created_by: d.created_by,
          ist_date: d.arrival_date_ist,
          ist_formatted: d.delivered_at_ist || d.expected_arrival_ist,
          payment_status: d.payment_status,
          payment_mode: d.payment_mode,
        };

        const events = [deliveryEvent];

        if (cashGiven > 0) {
           events.push({
             type: 'payment',
             _id: d._id.toString() + '_cash_given',
             date: d.delivered_at || d.createdAt,
             amount: cashGiven,
             mode: 'cash',
             notes: 'Payment made during vehicle arrival',
             created_by: d.created_by,
             ist_date: d.arrival_date_ist,
             ist_formatted: d.delivered_at_ist || d.expected_arrival_ist,
           });
        }
        return events;
      }),
    ];

    // Sort oldest first
    rawHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Pass 1: Identify matching payments within 2 minutes of a delivery and merge them
    const skipIds = new Set();
    rawHistory.forEach(item => {
      if (item.type === 'delivery') {
        const matchingPayments = rawHistory.filter(p =>
          p.type === 'payment' &&
          !skipIds.has(p._id) &&
          Math.abs(new Date(p.date) - new Date(item.date)) < 120000 && // within 2 minutes
          true // Merge the advance payment into the delivery
        );

        if (matchingPayments.length > 0) {
          item.actual_paid_amount = matchingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          matchingPayments.forEach(p => skipIds.add(p._id));
        }
      }
    });

    // Pass 2: Build merged items with running balance
    let mergedItems = [];
    let runningBal = supplier.balance || 0;

    rawHistory.forEach(item => {
      if (!skipIds.has(item._id)) {
        const invoiceAmt = item.type === 'delivery' ? item.amount : 0;
        let receivedAmt = item.type === 'payment' ? item.amount : 0;
        let discount = 0;

        if (item.type === 'delivery' && item.actual_paid_amount !== undefined) {
          receivedAmt = item.actual_paid_amount;
          // No automatic discount/negotiation applied. 
          // The remaining amount will naturally stay in the due balance.
        }

        const dueChange = invoiceAmt - receivedAmt - discount;
        runningBal += dueChange;

        // Compute IST date for each item
        let istDate = item.ist_date;
        if (!istDate) {
          istDate = toISTDateStr(item.date);
        }
        // Normalize ist_date format (handle DD/MM/YYYY format)
        if (istDate && istDate.includes('/')) {
          istDate = istDate.split(' ')[0].split('/').reverse().join('-');
        }

        mergedItems.push({
          ...item,
          ist_date_normalized: istDate,
          invoiceAmt,
          receivedAmt,
          dueChange,
          runningBalance: runningBal,
        });
      }
    });

    // Filter by date if needed
    const isAllHistory = all === 'true';
    let items = mergedItems;
    let broughtForward = 0;

    if (!isAllHistory) {
      let filterDate = date;
      if (!filterDate || !/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
        const nowIST = new Date(Date.now() + IST_OFFSET_MS);
        filterDate = nowIST.toISOString().slice(0, 10);
      }

      const beforeFilter = items.filter(item => item.ist_date_normalized < filterDate);
      if (beforeFilter.length > 0) {
        broughtForward = beforeFilter[beforeFilter.length - 1].runningBalance;
      }

      items = items.filter(item => item.ist_date_normalized === filterDate);
    }

    // Build computed ledger
    let computedLedger = [];

    // Add Brought Forward / Opening Balance row
    if (
      (!isAllHistory && Math.abs(broughtForward) > 0.01) ||
      (isAllHistory && Math.abs(supplier.balance || 0) > 0.01)
    ) {
      const openingBalAmount = isAllHistory ? (supplier.balance || 0) : broughtForward;
      computedLedger.push({
        type: 'opening_balance',
        date: items.length > 0 ? new Date(new Date(items[0].date).getTime() - 1000).toISOString() : new Date().toISOString(),
        _id: 'brought_forward',
        notes: openingBalAmount < 0
          ? (isAllHistory ? 'Opening Advance' : 'Previous Advance (Brought Forward)')
          : (isAllHistory ? 'Opening Balance' : 'Previous Balance (Brought Forward)'),
        invoiceAmt: openingBalAmount > 0 ? openingBalAmount : 0,
        receivedAmt: openingBalAmount < 0 ? Math.abs(openingBalAmount) : 0,
        dueChange: openingBalAmount,
        runningBalance: openingBalAmount,
        isBroughtForward: true,
      });
    }

    // Add all items
    items.forEach(item => {
      computedLedger.push(item);
    });

    // Reverse to show newest first
    computedLedger.reverse();

    // Summary KPIs
    let additionalPayments = 0;
    deliveries.forEach(d => {
      if (d.suppliers_data && Array.isArray(d.suppliers_data)) {
        const supData = d.suppliers_data.find(sd => sd.supplier_name === supplierName);
        if (supData && supData.cash_given) {
          additionalPayments += supData.cash_given;
        }
      }
    });

    const totalPaid = settlements.reduce((s, h) => s + (h.amount || 0), 0) + additionalPayments;
    const totalPurchases = deliveries.reduce((s, d) => {
      let amt = 0;
      (d.items || []).forEach(i => {
         if ((i.supplier_name && i.supplier_name === supplierName) || (!i.supplier_name && d.supplier === supplierName)) {
           const base = parseFloat(i.base_price) || 0;
           const extra = parseFloat(i.supplier_charge_per_item) || 0;
           amt += (i.quantity * (base + extra));
         }
      });
      if (d.supplier === supplierName && d.grand_total != null) {
        amt = d.grand_total;
      }
      return s + amt;
    }, 0);

    // Current balance = opening + totalPurchases - totalPaid
    const currentBalance = (supplier.balance || 0) + totalPurchases - totalPaid;

    res.json({
      supplier,
      summary: {
        totalDue: Math.max(0, currentBalance),
        totalAdvance: Math.max(0, -currentBalance),
        totalPaid,
        totalPurchases,
        currentBalance,
      },
      ledger: computedLedger,
      // Raw data for features that need it
      history: rawHistory.filter(h => !skipIds.has(h._id)),
      totalPaid,
      totalPurchases,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
