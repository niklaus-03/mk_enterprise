const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Settlement = require('../models/Settlement');
const Delivery = require('../models/Delivery');
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

    let suppliers = await Supplier.find(query)
      .collation({ locale: 'hi', strength: 2 })
      .sort({ name: 1 });

    // Calculate true global balance dynamically
    const allSettlements = await Settlement.aggregate([
      { $match: { type: 'paid_to_supplier', party_name: { $ne: null } } },
      { $group: { _id: { $toLower: "$party_name" }, total_paid: { $sum: "$amount" } } }
    ]);
    const globalPaymentMap = {};
    allSettlements.forEach(s => globalPaymentMap[s._id] = s.total_paid);

    const allDeliveries = await Delivery.aggregate([
      { $match: { supplier: { $ne: null }, status: { $in: ['delivered'] } } },
      { $unwind: "$items" },
      { $group: { 
          _id: { $toLower: "$supplier" }, 
          total_purchased: { $sum: { $cond: [ "$items.final_price", "$items.final_price", { $multiply: ["$items.quantity", "$items.base_price"] } ] } } 
        } 
      }
    ]);
    const globalPurchaseMap = {};
    allDeliveries.forEach(d => globalPurchaseMap[d._id] = d.total_purchased);

    suppliers = suppliers.map(s => {
      const obj = s.toObject();
      const lowerName = (obj.name || '').toLowerCase();
      const totalPurchased = globalPurchaseMap[lowerName] || 0;
      const totalPaid = globalPaymentMap[lowerName] || 0;
      
      obj.balance = (obj.balance || 0) + totalPurchased - totalPaid;
      return obj;
    });

    // If manager, compute amount paid by them
    if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
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
        const obj = s.toObject ? s.toObject() : s;
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
    let supplier;
    if (req.params.id.startsWith('virtual_')) {
      const name = req.params.id.replace('virtual_', '').replace(/_/g, ' ');
      supplier = { _id: req.params.id, name, is_virtual: true };
    } else {
      supplier = await Supplier.findById(req.params.id).populate('linked_customer_id', 'name balance');
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get all settlement entries for this supplier name
    const { date, all } = req.query;
    let query = { party_name: { $regex: new RegExp(`^${supplier.name}$`, 'i') }, type: { $in: ['paid_to_supplier', 'other_expense', 'walkin_delivery'] } };
    let deliveryQuery = { supplier: { $regex: new RegExp(`^${supplier.name}$`, 'i') }, status: { $in: ['delivered'] } };

    if (all !== 'true' && date) {
      const start = new Date(new Date(date + 'T00:00:00.000+05:30').getTime());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: start, $lt: end };
      deliveryQuery.delivered_at = { $gte: start, $lt: end };
    }

    const settlements = await Settlement.find(query).sort({ date: -1 }).limit(100).populate('created_by', 'username display_name role').lean();
    const deliveries = await Delivery.find(deliveryQuery).sort({ delivered_at: -1 }).limit(100).populate('created_by', 'username display_name role').lean();

    const unifiedHistory = [
      ...settlements.map(s => ({
        type: 'payment',
        _id: s._id,
        date: s.date,
        amount: s.amount,
        mode: s.mode,
        notes: s.notes,
        created_by: s.created_by,
        ist_date: s.ist_date,
        ist_formatted: s.ist_formatted,
      })),
      ...deliveries.map(d => {
        let amount = 0;
        d.items.forEach(i => {
          amount += (i.final_price || (i.quantity * i.base_price) || 0);
        });
        return {
          type: 'delivery',
          _id: d._id,
          date: d.delivered_at || d.createdAt,
          amount: amount,
          items: d.items,
          notes: d.notes || d.vehicle_number || d.delivery_type,
          created_by: d.created_by,
          ist_date: d.arrival_date_ist,
          ist_formatted: d.delivered_at_ist || d.expected_arrival_ist,
          payment_status: d.payment_status,
          payment_mode: d.payment_mode
        };
      })
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalPaid = settlements.reduce((s, h) => s + (h.amount || 0), 0);
    const totalPurchases = deliveries.reduce((s, d) => {
      let amt = 0;
      d.items.forEach(i => amt += (i.final_price || (i.quantity * i.base_price) || 0));
      return s + amt;
    }, 0);

    res.json({ supplier, history: unifiedHistory, totalPaid, totalPurchases });
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
// POST link supplier to customer
router.post('/:id/link_customer', async (req, res) => {
  try {
    const { customer_id } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    
    const Customer = require('../models/Customer');
    const customer = await Customer.findById(customer_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    supplier.linked_customer_id = customer._id;
    await supplier.save();
    
    customer.linked_supplier_id = supplier._id;
    await customer.save();
    
    logActivity(req, {
      action: 'update',
      entity_type: 'other',
      entity_id: supplier._id,
      entity_name: supplier.name,
      description: `Linked to Customer: ${customer.name}`,
    });
    
    res.json({ success: true, supplier });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST unlink supplier from customer
router.post('/:id/unlink_customer', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    
    if (supplier.linked_customer_id) {
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(supplier.linked_customer_id);
      if (customer) {
        customer.linked_supplier_id = null;
        await customer.save();
      }
      supplier.linked_customer_id = null;
      await supplier.save();
    }
    
    logActivity(req, {
      action: 'update',
      entity_type: 'other',
      entity_id: supplier._id,
      entity_name: supplier.name,
      description: `Unlinked from Customer`,
    });
    
    res.json({ success: true, supplier });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;