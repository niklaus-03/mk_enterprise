const express = require('express');
const router = express.Router();
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { formatIST, todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { product_id, type, source, search, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};
    if (req.user && ['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      query.created_by = req.user.id;
    }
    if (product_id) query.product_id = product_id;
    if (type) query.type = type;
    if (source) query.source = source;
    if (search) {
      query.$or = [
        { product_name: { $regex: search, $options: 'i' } },
        { vehicle_number: { $regex: search, $options: 'i' } },
        { driver_name: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }
    const [movements, total] = await Promise.all([
      StockMovement.find(query).sort({ date: -1 }).skip(skip).limit(parseInt(limit)).populate('product_id', 'name unit').populate('created_by', 'username display_name role').lean(),
      StockMovement.countDocuments(query),
    ]);
    const Invoice = require('../models/Invoice');
    for (let m of movements) {
      if ((m.source === 'invoice' || m.source === 'return') && m.reference && m.reference.length === 24 && !m.invoice_number) {
        try {
          const inv = await Invoice.findById(m.reference).select('invoice_number').lean();
          if (inv) m.invoice_number = inv.invoice_number;
        } catch(e) {}
      }
    }
    res.json({ movements, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/today', async (req, res) => {
  try {
    const { startUTC, endUTC } = todayUTCRange();
    const query = { date: { $gte: startUTC, $lt: endUTC } };
    if (req.user && ['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      query.created_by = req.user.id;
    }
    const movements = await StockMovement.find(query)
      .sort({ date: -1 }).populate('product_id', 'name unit').populate('created_by', 'username display_name role').lean();
    const Invoice = require('../models/Invoice');
    for (let m of movements) {
      if ((m.source === 'invoice' || m.source === 'return') && m.reference && m.reference.length === 24 && !m.invoice_number) {
        try {
          const inv = await Invoice.findById(m.reference).select('invoice_number').lean();
          if (inv) m.invoice_number = inv.invoice_number;
        } catch(e) {}
      }
    }
    res.json(movements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { product_id, type, qty, vehicle_number, driver_name, supplier, notes } = req.body;
    if (!product_id || !type || !qty) return res.status(400).json({ error: 'product_id, type, qty required' });
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const stock_before = product.stock;
    if (type === 'incoming') {
      product.stock += parseFloat(qty);
    } else {
      if (product.stock < parseFloat(qty)) return res.status(400).json({ error: 'Insufficient stock' });
      product.stock -= parseFloat(qty);
    }
    await product.save();
    const movement = await StockMovement.create({
      product_id, product_name: product.name, type, qty: parseFloat(qty),
      stock_before, stock_after: product.stock,
      vehicle_number: vehicle_number || '', driver_name: driver_name || '',
      supplier: supplier || '', notes: notes || '',
      source: 'manual', ist_formatted: formatIST(new Date()),
      created_by: req.user ? req.user.id : null,
    });
    res.status(201).json(movement);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
