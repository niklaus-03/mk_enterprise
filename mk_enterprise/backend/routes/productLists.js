const express = require('express');
const router = express.Router();
const ProductList = require('../models/ProductList');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');

router.use(auth);

// GET all lists accessible to the current user
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'manager') {
      query = { created_by: req.user.id };
    }
    const lists = await ProductList.find(query)
      .populate('created_by', 'username display_name role')
      .populate('products')
      .populate('shares.manager_id', 'username display_name');
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a specific list
router.get('/:id', async (req, res) => {
  try {
    const list = await ProductList.findById(req.params.id)
      .populate('products')
      .populate('shares.manager_id', 'username display_name');
    
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (req.user.role === 'manager') {
      const isOwner = list.created_by.toString() === req.user.id;
      const isShared = list.shares.some(s => s.manager_id._id.toString() === req.user.id);
      if (!isOwner && !isShared) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new list
router.post('/', async (req, res) => {
  try {
    const { name, products } = req.body;
    if (!name) return res.status(400).json({ error: 'List name is required' });

    const list = await ProductList.create({
      name,
      created_by: req.user.id,
      products: products || [],
      shares: []
    });

    logActivity(req, {
      action: 'create',
      entity_type: 'product_list',
      entity_id: list._id,
      entity_name: list.name,
      description: `Created product list "${list.name}" with ${list.products.length} items`
    });

    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a list (Add/Remove products, change name)
router.put('/:id', async (req, res) => {
  try {
    const list = await ProductList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (req.user.role !== 'supervisor' && list.created_by.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator or supervisor can edit this list' });
    }

    const { name, products } = req.body;
    if (name) list.name = name;
    if (products) list.products = products;

    await list.save();

    logActivity(req, {
      action: 'update',
      entity_type: 'product_list',
      entity_id: list._id,
      entity_name: list.name,
      description: `Updated product list "${list.name}"`
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT share a list (Admin only)
router.put('/:id/share', async (req, res) => {
  try {
    if (req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Only supervisors can set sharing overrides' });
    }

    const list = await ProductList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    const { shares } = req.body; // Array of share objects
    if (Array.isArray(shares)) {
      list.shares = shares;
      await list.save();

      logActivity(req, {
        action: 'update',
        entity_type: 'product_list',
        entity_id: list._id,
        entity_name: list.name,
        description: `Updated sharing overrides for list "${list.name}"`
      });

      res.json(list);
    } else {
      res.status(400).json({ error: 'Invalid shares format' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a list
router.delete('/:id', async (req, res) => {
  try {
    const list = await ProductList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (req.user.role !== 'supervisor' && list.created_by.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator or supervisor can delete this list' });
    }

    await ProductList.findByIdAndDelete(req.params.id);

    logActivity(req, {
      action: 'delete',
      entity_type: 'product_list',
      entity_id: list._id,
      entity_name: list.name,
      description: `Deleted product list "${list.name}"`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
