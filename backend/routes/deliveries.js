const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const { formatIST, todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

// Middleware: check if manager has permission to edit stock/prices (Problem 6)
const checkProductEditPermission = async (req, res, next) => {
  if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
    const user = await Admin.findById(req.user.id);
    if (!user || !user.can_edit_products) {
      return res.status(403).json({ error: "You don't have permission to adjust vehicles or incoming stock. Please contact Admin." });
    }
  }
  next();
};

// Helper: get IST date string from a Date object
function getISTDateStr(date) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
}

// Helper: format IST datetime for display
function formatISTDateTime(date) {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/**
 * GET /api/deliveries
 * ?date=YYYY-MM-DD  — filter by arrival date (IST), defaults to today
 * ?all=true         — return all (no date filter)
 * ?status=pending   — filter by status
 */
router.get('/', async (req, res) => {
  try {
    const { date, all, status } = req.query;
    let query = {};

    if (req.user && ['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      const mId = req.user?.id || req.user?._id || req.admin?.id || req.admin?._id;
      if (mId) {
        query.created_by = mId;
      } else {
        // Fallback to prevent showing everything if ID extraction fails
        query.created_by = '000000000000000000000000';
      }
    }

    if (all !== 'true') {
      // Default to today IST
      const { startUTC, endUTC } = todayUTCRange();
      let start = startUTC;
      let end = endUTC;

      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istMidnight = new Date(date + 'T00:00:00.000Z');
        start = new Date(istMidnight.getTime() - IST_OFFSET_MS);
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      }
      query.expected_arrival = { $gte: start, $lt: end };
    }

    if (status) query.status = status;

    const deliveries = await Delivery.find(query)
      .populate('created_by', 'display_name username')
      .sort({ expected_arrival: 1 });

    // Auto-update status based on time proximity
    const now = new Date();
    for (const d of deliveries) {
      if (d.status === 'pending' || d.status === 'on_the_way' || d.status === 'arriving_soon') {
        const diffMs = d.expected_arrival - now;
        const diffMin = diffMs / 60000;
        let newStatus = d.status;
        if (diffMin <= 0) newStatus = 'arriving_soon';        // past due time
        else if (diffMin <= 60) newStatus = 'arriving_soon';  // within 1 hour
        else if (diffMin <= 180) newStatus = 'on_the_way';    // within 3 hours

        if (newStatus !== d.status) {
          d.status = newStatus;
          await d.save();
        }
      }
    }

    res.json(deliveries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * POST /api/deliveries — create new delivery entry
 */
router.post('/', checkProductEditPermission, async (req, res) => {
  try {
    const { vehicle_number, driver_name, supplier, expected_arrival, items, notes, delivery_type, payment_status } = req.body;
    if (!vehicle_number || !expected_arrival || !items?.length) {
      return res.status(400).json({ error: 'vehicle_number, expected_arrival, and items are required' });
    }

    const arrivalDate = new Date(expected_arrival);
    if (isNaN(arrivalDate.getTime())) {
      return res.status(400).json({ error: 'Invalid expected_arrival date' });
    }

    const delivery = await Delivery.create({
      vehicle_number: vehicle_number.trim(),
      driver_name: (driver_name || '').trim(),
      supplier: (supplier || '').trim(),
      expected_arrival: arrivalDate,
      expected_arrival_ist: formatISTDateTime(arrivalDate),
      arrival_date_ist: getISTDateStr(arrivalDate),
      items: items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit || 'pcs',
        product_id: i.product_id || null,
        base_price: parseFloat(i.base_price) || 0,
        final_price: parseFloat(i.final_price) || 0,
      })),
      notes: (notes || '').trim(),
      delivery_type: delivery_type || 'regular',
      payment_status: payment_status || 'unpaid',
      created_by: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null,
    });

    const isWalkin = delivery.vehicle_number === 'WALK-IN' || delivery.delivery_type === 'walkin_delivery';
    const amountStr = items.reduce((sum, item) => sum + ((parseFloat(item.base_price) || 0) * (parseFloat(item.quantity) || 0)), 0);
    const paymentStr = delivery.payment_status === 'paid' ? 'Paid' : 'Unpaid';
    
    await ActivityLog.create({
      user_id: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null,
      username: req.user?.username || req.admin?.username || 'Unknown',
      user_role: req.user?.role || req.admin?.role || 'unknown',
      action: 'create',
      entity_type: 'delivery',
      entity_id: delivery._id,
      description: `${isWalkin ? 'Walk-in Delivery' : 'Delivery'} recorded from ${delivery.supplier || 'customer'} (${paymentStr}${amountStr > 0 ? ' - Amount: ₹' + amountStr : ''})`,
    });

    // Broadcast incoming vehicle notification to all non-driver team members
    try {
      const teamMembers = await Admin.find(
        { role: { $in: ['supervisor', 'manager'] }, is_active: true },
        '_id role'
      );
      const itemSummary = items.map(i => `${i.item_name} x${i.quantity}`).join(', ');
      const notifications = teamMembers.map(member => ({
        recipient_id: member._id,
        recipient_role: member.role,
        type: 'vehicle_incoming',
        title: `🚚 Vehicle Incoming — ${vehicle_number.trim()}`,
        message: `${(supplier || 'Unknown supplier').trim()} | Items: ${itemSummary} | ETA: ${formatISTDateTime(arrivalDate)}`,
        priority: 'medium',
        entity_type: 'delivery',
        entity_id: delivery._id,
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error('Delivery broadcast notification error:', notifErr.message);
    }

    res.status(201).json(delivery);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * GET /api/deliveries/:id — get single delivery by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json(delivery);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * PATCH /api/deliveries/:id/status — update status
 * body: { status: 'delivered' | 'not_delivered' | 'pending' }
 */
router.patch('/:id/status', checkProductEditPermission, async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    delivery.status = status;

    // When marked delivered — update stock for each item
    // On delivery: create new products, update stock & price
      // Auto-create supplier if not exists when marked delivered
      if (status === 'delivered' && delivery.supplier && !delivery.stock_updated) {
        const Supplier = require('../models/Supplier');
        const existingSupplier = await Supplier.findOne({
          name: { $regex: `^${delivery.supplier.trim()}$`, $options: 'i' },
          is_active: true,
        });
        if (!existingSupplier) {
          try {
            await Supplier.create({ name: delivery.supplier.trim(), is_active: true, created_by: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null });
          } catch (e) { /* ignore duplicate */ }
        }
      }

      if (status === 'delivered' && !delivery.stock_updated) {
        for (const item of delivery.items) {
          let product = null;

          // Step 1: Try to find linked product
          if (item.product_id) {
            try { product = await Product.findById(item.product_id); } catch (e) {}
          }

          // Step 2: Try to find by name
          if (!product && item.item_name) {
            product = await Product.findOne({
              name: { $regex: `^${item.item_name.trim()}$`, $options: 'i' },
              is_active: true,
            });
          }

          // Step 3: Create new product if not found (new item — only created on delivery)
          if (!product && item.item_name) {
            const finalPrice = item.final_price > 0 ? item.final_price
              : item.base_price > 0 ? item.base_price : 0;

            product = await Product.create({
              name: item.item_name.trim(),
              price: finalPrice,
              stock: 0,
              unit: item.unit || 'pcs',
              gst: item.gst || 0,
              is_active: true,
            });
          }

          if (!product) continue;

          // Use editable final_stock if set, otherwise use quantity
          const incomingQty = (item.final_stock != null && item.final_stock >= 0)
            ? item.final_stock
            : item.quantity;

          const stock_before = product.stock;
          product.stock += incomingQty;

          // Fix: Update final price in product — priority: final_price > calculated
          if (item.final_price > 0) {
            product.price = parseFloat(item.final_price);
          } else if (item.base_price > 0) {
            const quintalAdj = (item.quintal_charge > 0 && item.weight > 0)
              ? (item.quintal_charge * item.weight) / 100
              : 0;
            const beforeGST = item.base_price + quintalAdj;
            const gstAmt = (beforeGST * (item.gst || 0)) / 100;
            product.price = parseFloat((beforeGST + gstAmt).toFixed(2));
          }

          // Update GST if provided
          if (item.gst > 0) product.gst = item.gst;

          // Save weight_per_unit if item has weight info
          if (item.weight > 0 && incomingQty > 0) {
            product.weight_per_unit = parseFloat((item.weight / incomingQty).toFixed(3));
          }

          await product.save();

          await StockMovement.create({
            product_id: product._id,
            product_name: product.name,
            type: 'incoming',
            qty: incomingQty,
            qty_unit: item.unit || product.unit || 'pcs',
            stock_before,
            stock_after: product.stock,
            vehicle_number: delivery.vehicle_number,
            driver_name: delivery.driver_name,
            supplier: delivery.supplier,
            notes: `Delivery: ${delivery.vehicle_number}${item.weight ? ` | Weight: ${item.weight}kg` : ''}`,
            source: 'manual',
            ist_formatted: formatIST(new Date()),
            created_by: req.user.id,
          });
        }

        delivery.stock_updated = true;
        delivery.delivered_at = new Date();
        delivery.delivered_at_ist = formatIST(new Date());
      }

    await delivery.save();
    res.json(delivery);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * PUT /api/deliveries/:id — update delivery details
 */
router.put('/:id', checkProductEditPermission, async (req, res) => {
  try {
    const { vehicle_number, driver_name, supplier, expected_arrival, items, notes } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot edit a delivered entry' });
    }

    if (vehicle_number) delivery.vehicle_number = vehicle_number.trim();
    if (driver_name !== undefined) delivery.driver_name = driver_name.trim();
    if (supplier !== undefined) delivery.supplier = supplier.trim();
    if (notes !== undefined) delivery.notes = notes.trim();
    if (expected_arrival) {
      const arrivalDate = new Date(expected_arrival);
      delivery.expected_arrival = arrivalDate;
      delivery.expected_arrival_ist = formatISTDateTime(arrivalDate);
      delivery.arrival_date_ist = getISTDateStr(arrivalDate);
    }
    if (items?.length) {
      delivery.items = items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit || 'pcs',
        product_id: i.product_id || null,
        // Pricing fields — persist across saves
        weight: parseFloat(i.weight) || 0,
        base_price: parseFloat(i.base_price) || 0,
        quintal_charge: parseFloat(i.quintal_charge) || 0,
        gst: parseFloat(i.gst) || 0,
        final_price: parseFloat(i.final_price) || 0,
        final_stock: i.final_stock != null ? parseFloat(i.final_stock) : null,
        label: i.label || 'Goods',
        is_new_item: i.is_new_item || false,
      }));
    }

    await delivery.save();
    res.json(delivery);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * PATCH /api/deliveries/:id/payment — mark walk-in as paid
 */
router.patch('/:id/payment', async (req, res) => {
  try {
    const { payment_status, payment_mode, notes } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    delivery.payment_status = payment_status || 'paid';
    delivery.payment_mode = payment_mode || 'cash';
    if (payment_status === 'paid') {
      delivery.paid_at = new Date();
      delivery.paid_at_ist = formatIST(new Date());

      // Sync to Settlement as Paid Out when walk-in is marked paid
      if (delivery.vehicle_number === 'WALK-IN') {
        const Settlement = require('../models/Settlement');
        const totalAmount = delivery.items.reduce((s, i) => {
          const priceToUse = parseFloat(i.base_price) || parseFloat(i.final_price) || 0;
          return s + (priceToUse * (parseFloat(i.quantity) || 0));
        }, 0);
        if (totalAmount > 0) {
          const now = new Date();
          const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
          const istDate = new Date(now.getTime() + IST_OFFSET_MS);
          const ist_date = istDate.toISOString().slice(0, 10);
          const defaultNote = delivery.items.length > 1 
            ? `Walk-in delivery payment — ${delivery.items[0].item_name} and more products`
            : `Walk-in delivery payment — ${delivery.items[0]?.item_name || 'Goods'}`;
          const finalNotes = notes && notes.trim() !== '' ? notes.trim() : defaultNote;

          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: delivery.supplier || 'Walk-in Supplier',
            amount: totalAmount,
            mode: payment_mode || 'cash',
            notes: finalNotes,
            date: now,
            ist_date,
            ist_formatted: formatIST(now),
            created_by: req.user ? req.user.id : null,
          });
        }
      }

      // Notify manager who created it
      const currentUserId = req.user?.id || req.user?._id || req.admin?.id || req.admin?._id;
      if (delivery.created_by && String(delivery.created_by) !== String(currentUserId)) {
        try {
          const Notification = require('../models/Notification');
          const totalAmount = delivery.items.reduce((s, i) => {
            const priceToUse = parseFloat(i.base_price) || parseFloat(i.final_price) || 0;
            return s + (priceToUse * (parseFloat(i.quantity) || 0));
          }, 0);
          
          let actorName = 'Admin';
          if (req.user && req.user.username) actorName = req.user.username;
          if (req.user && req.user.display_name) actorName = req.user.display_name;

          await Notification.create({
            recipient_id: delivery.created_by,
            type: 'general',
            title: '💸 Walk-in Paid',
            message: `${actorName} marked walk-in from ${delivery.supplier || 'Unknown'} as PAID (₹${totalAmount}).`,
            priority: 'high',
            entity_type: 'delivery',
            entity_id: delivery._id
          });
        } catch (e) {
          console.error('Failed to notify manager about payment:', e.message);
        }
      }
    }
    
    await delivery.save();
    
    try {
      const ActivityLog = require('../models/ActivityLog');
      
      const totalAmount = delivery.items.reduce((s, i) => {
        const priceToUse = parseFloat(i.base_price) || parseFloat(i.final_price) || 0;
        return s + (priceToUse * (parseFloat(i.quantity) || 0));
      }, 0);

      await ActivityLog.create({
        user_id: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null,
        username: req.user?.username || req.admin?.username || 'Unknown',
        user_role: req.user?.role || req.admin?.role || 'unknown',
        action: 'payment',
        entity_type: 'delivery',
        entity_id: delivery._id,
        description: `Delivery payment marked as ${payment_status || 'paid'} via ${payment_mode || 'cash'} (Amount Paid: ₹${totalAmount})${notes ? ` - ${notes}` : ''}`
      });
    } catch (logErr) {
      console.error('Failed to log payment activity:', logErr.message);
    }
    
    res.json(delivery);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * DELETE /api/deliveries/:id
 */
router.delete('/:id', checkProductEditPermission, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot delete a delivered entry. Mark as not_delivered first.' });
    }
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;