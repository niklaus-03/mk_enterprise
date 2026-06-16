const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { formatIST, todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

// Helper: managers see only their own settlements
function ownerFilter(req) {
  if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
    return { created_by: req.user.id };
  }
  return {};
}

// Helper: convert IST date string to UTC range
function istDateToUTCRange(dateStr) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istMidnight = new Date(dateStr + 'T00:00:00.000Z');
  const startUTC = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { startUTC, endUTC };
}

/**
 * GET /api/settlements
 * Query params:
 *   date       — YYYY-MM-DD (IST), filters to that day only. Ignored if all=true
 *   all        — 'true' fetches all history (no date filter)
 *   party      — string, partial match on party_name (search)
 *   sort_amount — 'asc' | 'desc'
 *   sort_date  — 'asc' | 'desc' (default: desc = latest first)
 */
router.get('/', async (req, res) => {
  try {
    const { date, all, party, sort_amount, sort_date } = req.query;
    let query = { ...ownerFilter(req) };

    // Fix 4: When not fetching all history, default to selected date (today if none given)
    if (all !== 'true') {
      let startUTC, endUTC;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Fix 3: Use provided date (today / yesterday / calendar pick)
        ({ startUTC, endUTC } = istDateToUTCRange(date));
      } else {
        // Default to today
        ({ startUTC, endUTC } = todayUTCRange());
      }
      query.date = { $gte: startUTC, $lt: endUTC };
    }

    // Fix 2: Search by party name (case-insensitive partial match)
    if (party && party.trim()) {
      query.party_name = { $regex: party.trim(), $options: 'i' };
    }

    // Fix 2: Build sort object
    let sortObj = {};
    if (sort_amount === 'asc') sortObj.amount = 1;
    else if (sort_amount === 'desc') sortObj.amount = -1;
    // Date sort: default latest first (desc)
    if (sort_date === 'asc') sortObj.date = 1;
    else sortObj.date = -1; // default

    const settlements = await Settlement.find(query).sort(sortObj).limit(200).populate('created_by', 'display_name username role');

    // Fix 4: Totals for the fetched period (daily or all-time)
    const totalOut = settlements
      .filter(s => s.type !== 'other_income')
      .reduce((sum, s) => sum + s.amount, 0);
    const totalIn = settlements
      .filter(s => s.type === 'other_income')
      .reduce((sum, s) => sum + s.amount, 0);

    // Fix 2: Return unique party names for autocomplete in frontend
    const allParties = await Settlement.distinct('party_name');
    const partyNames = allParties.filter(Boolean).sort();

    res.json({ settlements, totalOut, totalIn, partyNames });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create settlement entry
router.post('/', async (req, res) => {
  try {
    const { type, party_name, amount, mode, reference, notes, date } = req.body;
    if (!type || !amount) return res.status(400).json({ error: 'type and amount are required' });

    const entryDate = date ? new Date(date) : new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(entryDate.getTime() + IST_OFFSET_MS);
    const ist_date = istDate.toISOString().slice(0, 10);

    const settlement = await Settlement.create({
      type,
      party_name: (party_name || '').trim(),
      amount: parseFloat(amount),
      mode: mode || 'cash',
      reference: (reference || '').trim(),
      notes: (notes || '').trim(),
      date: entryDate,
      ist_date,
      ist_formatted: formatIST(entryDate),
      created_by: req.user.id,
    });

    // Create Activity Log
    const isPaidOut = type !== 'other_income';
    const actionDesc = isPaidOut ? `Paid Out: ₹${amount} to ${party_name || 'Supplier'} via ${mode.toUpperCase()} (Ref: ${reference || 'N/A'}) - ${notes}` 
                                 : `Received: ₹${amount} from ${party_name || 'Customer'} via ${mode.toUpperCase()} (Ref: ${reference || 'N/A'}) - ${notes}`;
                                 
    await ActivityLog.create({
      user_id: req.user.id,
      username: req.user.username,
      user_role: req.user.role,
      action: 'payment',
      entity_type: 'settlement',
      entity_id: settlement._id,
      entity_name: party_name || (isPaidOut ? 'Supplier' : 'Customer'),
      description: actionDesc,
      changes: settlement.toObject(),
      ip_address: req.ip
    });

    // Send Notification if Paid Out
    if (isPaidOut) {
      await Notification.create({
        recipient_role: 'supervisor',
        sender_id: req.user.id,
        sender_name: req.user.username,
        type: 'general',
        title: `Payment Made: ₹${amount}`,
        message: `To ${party_name || 'Supplier'} via ${mode.toUpperCase()}. Ref: ${reference || 'N/A'} - ${notes}`,
        priority: 'high',
        entity_type: 'settlement',
        entity_id: settlement._id,
        metadata: {
          is_paid_out: true,
          amount,
          party_name,
          mode
        }
      });
    }

    // GOODS EXCHANGE AUTOMATION: Sync to Linked Customer
    if (type === 'paid_to_supplier' && mode === 'goods_exchange') {
      const Supplier = require('../models/Supplier');
      const Customer = require('../models/Customer');
      const Invoice = require('../models/Invoice');
      
      const supplier = await Supplier.findOne({ name: { $regex: `^${(party_name || '').trim()}$`, $options: 'i' } });
      if (supplier && supplier.linked_customer_id) {
        const customer = await Customer.findById(supplier.linked_customer_id);
        if (customer) {
          const invoice = await Invoice.create({
            customer_id: customer._id,
            customer_name: customer.name,
            total_amount: parseFloat(amount),
            paid_amount: 0,
            status: 'unpaid',
            items: [{
              item_name: 'Goods Exchange against Supplier Due',
              quantity: 1,
              base_price: parseFloat(amount),
              final_price: parseFloat(amount)
            }],
            date: entryDate,
            ist_date,
            created_by: req.user.id
          });
          
          customer.balance = (customer.balance || 0) + parseFloat(amount);
          await customer.save();
          
          await ActivityLog.create({
            user_id: req.user.id,
            username: req.user.username,
            user_role: req.user.role,
            action: 'create',
            entity_type: 'invoice',
            entity_id: invoice._id,
            entity_name: customer.name,
            description: `Auto-generated Invoice for Goods Exchange with Supplier`,
          });
        }
      }
    }

    res.status(201).json(settlement);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE settlement entry
router.delete('/:id', async (req, res) => {
  try {
    await Settlement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;