const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const CustomerList = require('../models/CustomerList');
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');

router.use(auth);

// ── Helper: build ownership filter for managers ────────────────────────────────
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

// Helper: Apply list overrides to customers
async function applyCustomerListOverrides(req, customers, listId) {
  if (!listId) return customers;
  try {
    const list = await CustomerList.findById(listId);
    if (!list) return customers;

    let userOverrides = [];
    if (req.user.role === 'manager') {
      const share = list.shares.find(s => s.manager_id.toString() === req.user.id);
      if (share) userOverrides = share.overrides;
    }

    const listCustomerIds = list.customers.map(id => id.toString());

    return customers.filter(c => {
      if (!listCustomerIds.includes(c._id.toString())) return false;
      const override = userOverrides.find(o => o.customer_id.toString() === c._id.toString());
      if (override && override.is_excluded) return false;
      return true;
    }).map(c => {
      const override = userOverrides.find(o => o.customer_id.toString() === c._id.toString());
      if (override) {
        if (override.custom_balance !== null) c.balance = override.custom_balance;
        if (override.custom_name) c.name = override.custom_name;
        if (override.custom_phone) c.phone = override.custom_phone;
      }
      return c;
    });
  } catch (err) {
    console.error('List override error:', err);
    return customers;
  }
}

router.get('/', async (req, res) => {
  try {
    const { search, limit, list_id } = req.query;
    const query = { is_active: true, ...ownerFilter(req) };
    if (search) {
      const searchOr = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { alternate_phones: { $regex: search, $options: 'i' } },
      ];
      if (query.$or) {
        const ownerOr = query.$or;
        delete query.$or;
        query.$and = [{ $or: ownerOr }, { $or: searchOr }];
      } else {
        query.$or = searchOr;
      }
    }
    let q = Customer.find(query)
      .collation({ locale: 'hi', strength: 2 })
      .populate('created_by', 'username display_name role')
      .sort({ name: 1 })
      .lean();
    if (limit && !list_id) q = q.limit(parseInt(limit));
    else if (list_id) q = q.limit(1000); // get more to filter locally

    let customers = await q;

    if (list_id) {
      customers = await applyCustomerListOverrides(req, customers, list_id);
      if (limit) customers = customers.slice(0, parseInt(limit));
    }

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
    const customer = await Customer.findOne({ _id: req.params.id, ...ownerFilter(req) }).populate('created_by', 'username display_name role');
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

    let was_duplicate = false;
    if (phone) {
      const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanedPhone.length >= 10) {
        const customerRegex = new RegExp(cleanedPhone);
        const existing = await Customer.findOne({
          $or: [
            { phone: { $regex: customerRegex } },
            { alternate_phones: { $regex: customerRegex } }
          ],
          is_active: true,
        });
        if (existing) {
          was_duplicate = true;
        }
      }
    }

    const initialBalance = parseFloat(balance) || 0;
    const customerData = {
      name: name.trim(),
      phone: phone || '',
      alternate_phones: req.body.alternate_phones || [],
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
      description: `Customer "${customer.name}" created. Phone: ${customer.phone || 'N/A'}`,
      changes: customer.toObject()
    });

    const customerResponse = customer.toJSON();
    customerResponse.was_duplicate = was_duplicate;
    res.status(201).json(customerResponse);
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
      changes: customer.toObject()
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
      changes: checkCust.toObject()
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

    // Creator, supervisor, or already allowed managers can delegate
    const isAllowed = req.user.role === 'supervisor' || 
                      customer.created_by?.toString() === req.user.id || 
                      customer.allowed_managers.some(m => m.toString() === req.user.id);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Only managers with access or supervisor can delegate' });
    }

    // Avoid duplicates in allowed_managers
    const already = customer.allowed_managers.some(m => m.toString() === manager_id);
    if (!already) {
      customer.allowed_managers.push(manager_id);
    }

    // Initialize their ledger entry in manager_balances if not present
    let initialBalance = 0;
    if (req.user.role === 'manager') {
      initialBalance = customer.getManagerBalance(req.user.id);
    } else {
      initialBalance = customer.balance || 0;
    }

    const hasLedger = customer.manager_balances.some(mb => mb.manager_id.toString() === manager_id);
    if (!hasLedger) {
      customer.manager_balances.push({ manager_id, balance: initialBalance });
    }

    await customer.save();

    // Create real-time notification for the receiving manager
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient_id: manager_id,
        sender_id: req.user.id,
        sender_name: req.user.display_name || req.user.username || 'System',
        type: 'customer_info',
        title: 'New Customer Received',
        message: `${req.user.display_name || req.user.username} shared customer "${customer.name}" with you. Shared Balance: ₹${initialBalance}.`,
        priority: 'high',
        entity_type: 'customer',
        entity_id: customer._id,
      });
    } catch (notifErr) {
      console.error('Failed to trigger customer delegation notification:', notifErr.message);
    }

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'customer',
      entity_id: customer._id,
      entity_name: customer.name,
      description: `Customer delegated to manager ${manager_id} with initial balance ${initialBalance}`,
    });

    res.json({ success: true, allowed_managers: customer.allowed_managers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST merge duplicate customers (Supervisor only)
router.post('/merge', async (req, res) => {
  try {
    if (req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Only supervisors can merge customers' });
    }

    const { primary_id, secondary_ids, merged_data } = req.body;
    if (!primary_id || !Array.isArray(secondary_ids) || secondary_ids.length === 0) {
      return res.status(400).json({ error: 'primary_id and non-empty secondary_ids array required' });
    }

    const primary = await Customer.findById(primary_id);
    if (!primary) return res.status(404).json({ error: 'Primary customer not found' });

    const secondaries = await Customer.find({ _id: { $in: secondary_ids } });
    if (secondaries.length === 0) return res.status(404).json({ error: 'Secondary customers not found' });

    for (const sec of secondaries) {

      // Merge manager_balances
      for (const mb of sec.manager_balances) {
        const existing = primary.manager_balances.find(pmb => pmb.manager_id.toString() === mb.manager_id.toString());
        if (existing) {
          existing.balance += mb.balance;
        } else {
          primary.manager_balances.push({ manager_id: mb.manager_id, balance: mb.balance });
        }
      }

      // Merge allowed_managers (excluding the created_by)
      for (const am of sec.allowed_managers) {
        if (!primary.allowed_managers.some(pam => pam.toString() === am.toString())) {
          primary.allowed_managers.push(am);
        }
      }
    }

    // Automatically collect and merge all phone numbers of primary and duplicate accounts
    let allPhones = new Set();
    if (primary.phone) allPhones.add(primary.phone.trim());
    if (primary.alternate_phones && primary.alternate_phones.length) {
      primary.alternate_phones.forEach(p => allPhones.add(p.trim()));
    }
    secondaries.forEach(sec => {
      if (sec.phone) allPhones.add(sec.phone.trim());
      if (sec.alternate_phones && sec.alternate_phones.length) {
        sec.alternate_phones.forEach(p => allPhones.add(p.trim()));
      }
    });

    const primaryPhone = merged_data?.phone ? merged_data.phone.trim() : (primary.phone || '').trim();
    if (primaryPhone) {
      allPhones.delete(primaryPhone);
    }
    primary.phone = primaryPhone;
    primary.alternate_phones = Array.from(allPhones);

    // Apply merged overrides if provided (excluding phone/alternate_phones which we already merged above)
    if (merged_data) {
      if (merged_data.name) primary.name = merged_data.name;
      if (merged_data.address !== undefined) primary.address = merged_data.address;
      if (merged_data.gstin !== undefined) primary.gstin = merged_data.gstin;
    }

    // Recalculate global balance
    primary.balance = primary.manager_balances.reduce((sum, mb) => sum + mb.balance, 0);
    await primary.save();

    // Update references in other collections
    await Invoice.updateMany({ customer_id: { $in: secondary_ids } }, { customer_id: primary_id });
    
    // Attempt to update Orders if Order model exists
    try {
      const Order = require('../models/Order');
      if (Order) {
        await Order.updateMany({ customer_id: { $in: secondary_ids } }, { customer_id: primary_id });
      }
    } catch (e) { /* ignore if Order doesn't exist */ }

    // Update CustomerLists
    const lists = await CustomerList.find({
      $or: [
        { customers: { $in: secondary_ids } },
        { 'shares.overrides.customer_id': { $in: secondary_ids } }
      ]
    });

    for (const list of lists) {
      // Update customers array
      let updatedCustomers = list.customers.filter(id => !secondary_ids.includes(id.toString()));
      if (!updatedCustomers.some(id => id.toString() === primary_id.toString())) {
        updatedCustomers.push(primary_id);
      }
      list.customers = updatedCustomers;

      // Update overrides
      for (const share of list.shares) {
        for (const override of share.overrides) {
          if (secondary_ids.includes(override.customer_id.toString())) {
            override.customer_id = primary_id;
          }
        }
      }
      await list.save();
    }

    // Delete the secondary customers
    await Customer.deleteMany({ _id: { $in: secondary_ids } });

    logActivity(req, {
      action: 'update',
      entity_type: 'customer',
      entity_id: primary._id,
      entity_name: primary.name,
      description: `Merged ${secondary_ids.length} duplicate customer(s) into this account.`,
    });

    res.json({ success: true, primary_customer: primary });
  } catch (err) {
    console.error('Merge error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
