const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');

router.use(auth);

// ── Helper: build ownership filter for managers ────────────────────────────────
function ownerFilter(req, extra = {}) {
  if (req.user.role === 'manager') {
    return { ...extra, created_by: req.user.id };
  }
  return extra; // supervisor sees all
}

router.get('/', async (req, res) => {
  try {
    const { search, limit } = req.query;
    const query = { is_active: true, ...ownerFilter(req) };
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
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
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find({ customer_id: req.params.id }).sort({ date: -1 }).limit(50);
    res.json(invoices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, address, balance, gstin } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const customer = await Customer.create({
      name: name.trim(),
      phone: phone || '',
      address: address || '',
      balance: parseFloat(balance) || 0,
      gstin: gstin || '',
      created_by: req.user.id,
    });
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
