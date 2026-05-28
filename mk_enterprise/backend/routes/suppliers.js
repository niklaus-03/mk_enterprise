const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Settlement = require('../models/Settlement');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');

router.use(auth);

// GET all suppliers (with optional search) — scoped by manager
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const query = { is_active: true };
    if (q && q.trim()) query.name = { $regex: q.trim(), $options: 'i' };

    // Removed manager scoping: all managers can see all suppliers as requested
    // They will still only see their own payment history due to the limitation below

    let suppliers = await Supplier.find(query).sort({ name: 1 });

    // If manager, compute amount paid by them
    if (req.user.role === 'manager') {
      const mongoose = require('mongoose');
      const managerId = req.user.id;
      
      const settlements = await Settlement.aggregate([
        { 
          $match: { 
            type: { $in: ['paid_to_supplier', 'other_expense'] }, 
            created_by: new mongoose.Types.ObjectId(managerId) 
          } 
        },
        { 
          $group: { 
            _id: { $toLower: "$party_name" }, 
            total_paid: { $sum: "$amount" } 
          } 
        }
      ]);
      
      const paymentMap = {};
      settlements.forEach(s => {
        paymentMap[s._id] = s.total_paid;
      });
      
      const matchedNames = new Set();
      suppliers = suppliers.map(s => {
        const obj = s.toObject();
        obj.manager_paid_amount = paymentMap[(obj.name || '').toLowerCase()] || 0;
        matchedNames.add((obj.name || '').toLowerCase());
        return obj;
      });

      // Add virtual suppliers for anyone paid by the manager who isn't in the DB!
      settlements.forEach(s => {
        if (!matchedNames.has(s._id) && s.total_paid > 0) {
          suppliers.push({
            _id: 'virtual_' + s._id.replace(/\\s+/g, '_'), 
            name: s._id.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
            phone: '',
            address: 'Ad-hoc / Walk-in Payment',
            is_virtual: true,
            manager_paid_amount: s.total_paid
          });
        }
      });
    }

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
      const start = new Date(new Date(date + 'T00:00:00.000+05:30').getTime());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: start, $lt: end };
    }

    const history = await Settlement.find(query).sort({ date: -1 }).limit(50);
    const totalPaid = history.reduce((s, h) => s + h.amount, 0);

    res.json({ supplier, history, totalPaid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create supplier — set created_by
router.post('/', async (req, res) => {
  try {
    const { name, phone, address, notes, balance } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });
    const existing = await Supplier.findOne({ name: { $regex: `^${name}$`, $options: 'i' }, is_active: true });
    if (existing) return res.status(400).json({ error: 'Supplier with this name already exists' });

    const supplier = await Supplier.create({
      name: name.trim(),
      phone: phone || '', // legacy fallback
      contact_numbers: req.body.contact_numbers || [],
      address: address || '',
      notes: notes || '',
      balance: parseFloat(balance) || 0,
      created_by: req.user.id,
    });

    // Log activity
    logActivity(req, {
      action: 'create',
      entity_type: 'other',
      entity_id: supplier._id,
      entity_name: supplier.name,
      description: `Supplier created. Phone: ${supplier.phone || 'N/A'}`,
    });

    res.status(201).json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'other',
      entity_id: supplier._id,
      entity_name: supplier.name,
      description: `Supplier updated`,
    });

    res.json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (soft)
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    await Supplier.findByIdAndUpdate(req.params.id, { is_active: false });

    // Log activity
    logActivity(req, {
      action: 'delete',
      entity_type: 'other',
      entity_id: supplier._id,
      entity_name: supplier.name,
      description: `Supplier soft-deleted`,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;