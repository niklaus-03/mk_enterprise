const express = require('express');
const router = express.Router();
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { formatIST, todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { product_id, type, source, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};
    if (product_id) query.product_id = product_id;
    if (type) query.type = type;
    if (source) query.source = source;
    const [movements, total] = await Promise.all([
      StockMovement.find(query).sort({ date: -1 }).skip(skip).limit(parseInt(limit)).populate('product_id', 'name unit'),
      StockMovement.countDocuments(query),
    ]);
    res.json({ movements, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/today', async (req, res) => {
  try {
    const { startUTC, endUTC } = todayUTCRange();
    const movements = await StockMovement.find({ date: { $gte: startUTC, $lt: endUTC } })
      .sort({ date: -1 }).populate('product_id', 'name unit');
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
    });
    res.status(201).json(movement);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
