const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');

router.use(auth);

// ── Helper: build ownership filter for managers ────────────────────────────────
// Managers see customers they created OR are in allowed_managers
function ownerFilter(req, extra = {}) {
  if (req.user.role === 'manager') {
    return {
      ...extra,
      $or: [
        { created_by: req.user.id },
        { allowed_managers: req.user.id },
      ],
    };
  }
  return extra; // supervisor sees all
}

router.get('/', async (req, res) => {
  try {
    const { search, limit } = req.query;
    const query = { is_active: true, ...ownerFilter(req) };
    if (search) {
      // Merge search $or with ownership $or properly
      const searchOr = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
      if (query.$or) {
        // Manager filter: use $and to combine both conditions
        const ownerOr = query.$or;
        delete query.$or;
        query.$and = [{ $or: ownerOr }, { $or: searchOr }];
      } else {
        query.$or = searchOr;
      }
    }
    let q = Customer.find(query).sort({ name: 1 });
    if (limit) q = q.limit(parseInt(limit));
    const customers = await q;
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pending-dues', async (req, res) => {
  try {
    const query = { balance: { $gt: 0 }, is_active: true, ...ownerFilter(req) };
    const customers = await Customer.find(query).sort({ balance: -1 });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!customer) return res.status(404).json({ error: 'Customer not found or access denied' });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/invoices', async (req, res) => {
  try {
    const filter = { customer_id: req.params.id };
    // Managers only see their own invoices for this customer
    if (req.user.role === 'manager') {
      filter.created_by = req.user.id;
    }
    const invoices = await Invoice.find(filter).sort({ date: -1 }).limit(50);
    res.json(invoices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, address, balance, gstin, allowed_managers } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const initialBalance = parseFloat(balance) || 0;
    const customerData = {
      name: name.trim(),
      phone: phone || '',
      address: address || '',
      balance: initialBalance,
      gstin: gstin || '',
      created_by: req.user.id,
    };

    // If admin specifies which managers can see this customer
    if (allowed_managers && Array.isArray(allowed_managers)) {
      customerData.allowed_managers = allowed_managers;
    }

    // Initialize manager_balances with the creator's balance
    if (initialBalance !== 0) {
      customerData.manager_balances = [{ manager_id: req.user.id, balance: initialBalance }];
    }

    const customer = await Customer.create(customerData);

    // Log activity
    logActivity(req, {
      action: 'create',
      entity_type: 'customer',
      entity_id: customer._id,
      entity_name: customer.name,
      description: `Customer created. Phone: ${customer.phone || 'N/A'}`,
    });

    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const checkCust = await Customer.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!checkCust) return res.status(404).json({ error: 'Customer not found or access denied' });

    const { allowed_managers, ...rest } = req.body;
    const updateData = { ...rest };
    if (allowed_managers !== undefined) {
      updateData.allowed_managers = allowed_managers;
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, updateData, { new: true });

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'customer',
      entity_id: customer._id,
      entity_name: customer.name,
      description: `Customer updated`,
    });

    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const checkCust = await Customer.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!checkCust) return res.status(404).json({ error: 'Customer not found or access denied' });

    await Customer.findByIdAndUpdate(req.params.id, { is_active: false });

    // Log activity
    logActivity(req, {
      action: 'delete',
      entity_type: 'customer',
      entity_id: checkCust._id,
      entity_name: checkCust.name,
      description: `Customer soft-deleted`,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST delegate customer to another manager
router.post('/:id/delegate', async (req, res) => {
  try {
    const { manager_id } = req.body;
    if (!manager_id) return res.status(400).json({ error: 'manager_id is required' });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Only creator or supervisor can delegate
    if (req.user.role !== 'supervisor' && customer.created_by?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the customer creator or supervisor can delegate' });
    }

    // Avoid duplicates in allowed_managers
    const already = customer.allowed_managers.some(m => m.toString() === manager_id);
    if (!already) {
      customer.allowed_managers.push(manager_id);
    }

    // Initialize their ledger entry in manager_balances if not present
    const hasLedger = customer.manager_balances.some(mb => mb.manager_id.toString() === manager_id);
    if (!hasLedger) {
      customer.manager_balances.push({ manager_id, balance: 0 });
    }

    await customer.save();

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'customer',
      entity_id: customer._id,
      entity_name: customer.name,
      description: `Customer delegated to manager ${manager_id}`,
    });

    res.json({ success: true, allowed_managers: customer.allowed_managers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
