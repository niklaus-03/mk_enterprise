const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Settlement = require('../models/Settlement');
const auth = require('../middleware/auth');

router.use(auth);

// GET all suppliers (with optional search)
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const query = { is_active: true };
    if (q && q.trim()) query.name = { $regex: q.trim(), $options: 'i' };
    const suppliers = await Supplier.find(query).sort({ name: 1 });
    res.json(suppliers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single supplier + their payment history
router.get('/:id/history', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Get all settlement entries for this supplier name
    const { date, all } = req.query;
    let query = { party_name: { $regex: supplier.name, $options: 'i' }, type: { $in: ['paid_to_supplier', 'other_expense'] } };

    if (all !== 'true' && date) {
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const start = new Date(new Date(date + 'T00:00:00.000+05:30').getTime());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: start, $lt: end };
    }

    const history = await Settlement.find(query).sort({ date: -1 }).limit(50);
    const totalPaid = history.reduce((s, h) => s + h.amount, 0);

    res.json({ supplier, history, totalPaid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create supplier
router.post('/', async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });
    const existing = await Supplier.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, is_active: true });
    if (existing) return res.status(400).json({ error: 'Supplier with this name already exists' });
    const supplier = await Supplier.create({ name: name.trim(), phone: phone || '', address: address || '', notes: notes || '' });
    res.status(201).json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (soft)
router.delete('/:id', async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;