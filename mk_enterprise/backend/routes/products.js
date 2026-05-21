const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Setting = require('../models/Setting');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');
const { formatIST } = require('../utils/timeUtils');

router.use(auth);

// Helper: managers see ONLY products they created or are explicitly allowed to view
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

// Helper: get global low stock threshold from settings
async function getGlobalThreshold() {
  const row = await Setting.findOne({ key: 'low_stock_threshold' });
  return row ? (parseInt(row.value) || 10) : 10;
}

// GET all products
router.get('/', async (req, res) => {
  try {
    const { search, limit = 200 } = req.query;
    const query = { is_active: true, ...ownerFilter(req) };
    if (search) {
      const searchFilter = { name: { $regex: search.trim(), $options: 'i' } };
      if (query.$or) {
        const ownerOr = query.$or;
        delete query.$or;
        query.$and = [{ $or: ownerOr }, searchFilter];
      } else {
        Object.assign(query, searchFilter);
      }
    }
    const products = await Product.find(query).sort({ name: 1 }).limit(parseInt(limit));
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET autocomplete - returns products visible to user
router.get('/autocomplete', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const query = { is_active: true, ...ownerFilter(req) };
    if (q.trim()) {
      const searchFilter = { name: { $regex: q.trim(), $options: 'i' } };
      if (query.$or) {
        const ownerOr = query.$or;
        delete query.$or;
        query.$and = [{ $or: ownerOr }, searchFilter];
      } else {
        Object.assign(query, searchFilter);
      }
    }
    const products = await Product.find(query, { name: 1, price: 1, gst: 1, unit: 1, stock: 1 }).limit(20);
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET low stock - respects per-product OR global threshold
router.get('/low-stock', async (req, res) => {
  try {
    const globalThreshold = await getGlobalThreshold();
    const products = await Product.find({ is_active: true });
    const lowStock = products.filter(p => {
      const threshold = (p.custom_low_stock !== null && p.custom_low_stock !== undefined)
        ? p.custom_low_stock : globalThreshold;
      return p.stock <= threshold;
    }).sort((a, b) => a.stock - b.stock);
    res.json(lowStock);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!product) return res.status(404).json({ error: 'Product not found or access denied' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const { name, price, stock, gst, unit, hsn_code, custom_low_stock, weight_per_unit, suggested_price, allowed_managers } = req.body;
    if (!name || price === undefined || stock === undefined || gst === undefined)
      return res.status(400).json({ error: 'name, price, stock, gst required' });
    const productData = {
      name: name.trim(), price, stock, gst,
      unit: unit || 'pcs',
      hsn_code: hsn_code || '',
      custom_low_stock: (custom_low_stock !== '' && custom_low_stock !== undefined) ? parseFloat(custom_low_stock) : null,
      weight_per_unit: parseFloat(weight_per_unit) || 0,
      suggested_price: parseFloat(suggested_price) || 0,
      created_by: req.user.id,
    };
    if (allowed_managers && Array.isArray(allowed_managers)) {
      productData.allowed_managers = allowed_managers;
    }
    const product = await Product.create(productData);

    // Log activity
    logActivity(req, {
      action: 'create',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Product created. Price: ₹${product.price}, Stock: ${product.stock} ${product.unit}`,
    });

    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const checkProduct = await Product.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!checkProduct) return res.status(404).json({ error: 'Product not found or access denied' });

    const { custom_low_stock, weight_per_unit, suggested_price, ...rest } = req.body;
    const updateData = {
      ...rest,
      custom_low_stock: (custom_low_stock !== '' && custom_low_stock !== undefined) ? parseFloat(custom_low_stock) : null,
      weight_per_unit: parseFloat(weight_per_unit) || 0,
      suggested_price: parseFloat(suggested_price) || 0,
    };
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Product updated`,
    });

    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH stock adjustment
router.patch('/:id/stock', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!product) return res.status(404).json({ error: 'Product not found or access denied' });

    const { qty, type, qty_unit, vehicle_number, driver_name, supplier, notes } = req.body;
    const stock_before = product.stock;
    if (type === 'incoming') {
      product.stock += parseFloat(qty);
    } else {
      if (product.stock < parseFloat(qty)) return res.status(400).json({ error: 'Insufficient stock' });
      product.stock -= parseFloat(qty);
    }
    await product.save();
    await StockMovement.create({
      product_id: product._id, product_name: product.name, type, qty: parseFloat(qty),
      qty_unit: qty_unit || product.unit || 'pcs',
      stock_before, stock_after: product.stock,
      vehicle_number: vehicle_number || '', driver_name: driver_name || '',
      supplier: supplier || '', notes: notes || '',
      source: 'manual', ist_formatted: formatIST(new Date()),
    });

    // Log activity
    logActivity(req, {
      action: 'stock_adjust',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Stock ${type}: ${qty} ${qty_unit || product.unit || 'pcs'}. ${stock_before} → ${product.stock}`,
    });

    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (soft)
router.delete('/:id', async (req, res) => {
  try {
    const checkProduct = await Product.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!checkProduct) return res.status(404).json({ error: 'Product not found or access denied' });

    await Product.findByIdAndUpdate(req.params.id, { is_active: false });

    // Log activity
    logActivity(req, {
      action: 'delete',
      entity_type: 'product',
      entity_id: checkProduct._id,
      entity_name: checkProduct.name,
      description: `Product soft-deleted`,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST delegate product to another manager
router.post('/:id/delegate', async (req, res) => {
  try {
    const { manager_id } = req.body;
    if (!manager_id) return res.status(400).json({ error: 'manager_id is required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Only creator or supervisor can delegate
    if (req.user.role !== 'supervisor' && product.created_by?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the product creator or supervisor can delegate' });
    }

    // Avoid duplicates
    const already = product.allowed_managers.some(m => m.toString() === manager_id);
    if (!already) {
      product.allowed_managers.push(manager_id);
      await product.save();
    }

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Product delegated to manager ${manager_id}`,
    });

    res.json({ success: true, allowed_managers: product.allowed_managers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
