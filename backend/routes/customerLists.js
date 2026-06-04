const express = require('express');
const router = express.Router();
const CustomerList = require('../models/CustomerList');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');

router.use(auth);

// GET all lists accessible to the current user
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      query = {
        $or: [
          { created_by: req.user.id },
          { 'shares.manager_id': req.user.id }
        ]
      };
    }
    const lists = await CustomerList.find(query)
      .populate('created_by', 'username display_name role')
      .populate('customers')
      .populate('shares.manager_id', 'username display_name');
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a specific list
router.get('/:id', async (req, res) => {
  try {
    const list = await CustomerList.findById(req.params.id)
      .populate('customers')
      .populate('shares.manager_id', 'username display_name');
    
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
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
    const { name, customers } = req.body;
    if (!name) return res.status(400).json({ error: 'List name is required' });

    const list = await CustomerList.create({
      name,
      created_by: req.user.id,
      customers: customers || [],
      shares: []
    });

    logActivity(req, {
      action: 'create',
      entity_type: 'customer_list',
      entity_id: list._id,
      entity_name: list.name,
      description: `Created customer list "${list.name}" with ${list.customers.length} items`
    });

    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a list
router.put('/:id', async (req, res) => {
  try {
    const list = await CustomerList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (req.user.role !== 'supervisor' && list.created_by.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator or supervisor can edit this list' });
    }

    const { name, customers } = req.body;
    if (name) list.name = name;
    if (customers) list.customers = customers;

    await list.save();

    logActivity(req, {
      action: 'update',
      entity_type: 'customer_list',
      entity_id: list._id,
      entity_name: list.name,
      description: `Updated customer list "${list.name}"`
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

    const list = await CustomerList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    const { shares } = req.body;
    if (Array.isArray(shares)) {
      list.shares = shares;
      await list.save();

      logActivity(req, {
        action: 'update',
        entity_type: 'customer_list',
        entity_id: list._id,
        entity_name: list.name,
        description: `Updated sharing overrides for customer list "${list.name}"`
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
    const list = await CustomerList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (req.user.role !== 'supervisor' && list.created_by.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator or supervisor can delete this list' });
    }

    await CustomerList.findByIdAndDelete(req.params.id);

    logActivity(req, {
      action: 'delete',
      entity_type: 'customer_list',
      entity_id: list._id,
      entity_name: list.name,
      description: `Deleted customer list "${list.name}"`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
