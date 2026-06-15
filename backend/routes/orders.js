const express = require('express');
const router = express.Router();
const { logActivity } = require('./activityLogs');
const Order = require('../models/Order');
const Settlement = require('../models/Settlement');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

// Helper: build ownership filter
function ownerFilter(req, extra = {}) {
  if (req.user && ['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
    return { ...extra, created_by: req.user.id };
  }
  return extra;
}

function getISTDateStr(date) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
}

/**
 * GET /api/orders
 * ?date=YYYY-MM-DD
 */
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let query = ownerFilter(req, { status: 'pending' });

    if (date) {
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istMidnight = new Date(date + 'T00:00:00.000Z');
      const start = new Date(istMidnight.getTime() - IST_OFFSET_MS);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      query.delivery_date = { $gte: start, $lt: end };
    }

    const orders = await Order.find(query).sort({ delivery_date: 1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/orders
 */
router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, items, delivery_date, advance_paid } = req.body;

    if (!customer_name || !customer_phone || !delivery_date || !items?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const date = new Date(delivery_date);
    const advanceAmount = parseFloat(advance_paid) || 0;
    const advanceMode = req.body.advance_mode || 'cash';

    // Auto-create products for new items & update saved_order_qty
    for (const item of items) {
      const qty = parseFloat(item.qty) || 1;
      if (!item.product_id && item.product_name) {
        // New product — create it with ordered qty
        try {
          const newProd = await Product.create({
            name: item.product_name,
            price: item.price || 0,
            stock: 0,
            gst: 0,
            created_from_order: true,
            saved_order_qty: qty,
            created_by: req.user ? req.user.id : null
          });
          item.product_id = newProd._id;
        } catch (e) {
          console.error('Failed to create product for order item:', e.message);
        }
      } else if (item.product_id) {
        // Existing product — accumulate ordered qty so it shows in Low Stock
        try {
          await Product.findByIdAndUpdate(item.product_id, {
            $inc: { saved_order_qty: qty }
          });
        } catch (e) {
          console.error('Failed to update saved_order_qty:', e.message);
        }
      }
    }

    const order = await Order.create({
      customer_name,
      customer_phone,
      items,
      delivery_date: date,
      delivery_date_ist: getISTDateStr(date),
      advance_paid: advanceAmount,
      advance_mode: advanceMode,
      notes: req.body.notes || '',
      created_by: req.user ? req.user.id : null,
    });

    // Auto-create settlement entry for advance payment
    if (advanceAmount > 0) {
      try {
        const itemNames = (items || []).map(i => i.product_name).filter(Boolean).join(', ');
        await Settlement.create({
          type: 'other_income',
          party_name: customer_name,
          amount: advanceAmount,
          mode: advanceMode,
          notes: `Advance payment for order — ${itemNames}`,
          received_category: 'advance_payment',
        });
      } catch (e) {
        console.error('Settlement creation failed for advance:', e.message);
      }
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH → mark completed
 */
router.patch('/:id/complete', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = 'completed';
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE order
 */
router.delete('/:id', async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET single order
 */
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;