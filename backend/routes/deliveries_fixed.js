const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Supplier = require('../models/Supplier');
const Settlement = require('../models/Settlement');
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

    if (req.user && req.user.role === 'supervisor' && req.query.manager_id) {
      query.created_by = req.query.manager_id;
    } else if (req.user && ['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
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
    const { vehicle_number, driver_name, driver_cash, supplier, expected_arrival, items, suppliers_data, notes, delivery_type, payment_status } = req.body;
    const hasItems = (items && items.length > 0) || (suppliers_data && suppliers_data.some(s => s.items && s.items.length > 0));
    if (!vehicle_number || !expected_arrival || !hasItems) {
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
      items: items ? items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit || 'pcs',
        product_id: i.product_id || null,
        base_price: parseFloat(i.base_price) || 0,
        final_price: parseFloat(i.final_price) || 0,
      })) : [],
      suppliers_data: suppliers_data ? suppliers_data.map(s => ({
        supplier_name: s.supplier_name,
        supplier_id: s.supplier_id || null,
        cash_given: parseFloat(s.cash_given) || 0,
        cash_given_note: s.cash_given_note || '',
        is_settled: false,
        items: s.items ? s.items.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || 'pcs',
          product_id: i.product_id || null,
          base_price: parseFloat(i.base_price) || 0,
          final_price: parseFloat(i.final_price) || 0,
          sell_price: parseFloat(i.sell_price) || 0,
          margin: parseFloat(i.margin) || 0,
          weight: parseFloat(i.weight) || 0,
        })) : []
      })) : [],
      notes: (notes || '').trim(),
      delivery_type: delivery_type || 'vehicle_incoming',
      payment_status: payment_status || 'unpaid',
      created_by: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null,
    });

    
    // Process cash_given settlements
    if (delivery.suppliers_data && delivery.suppliers_data.length > 0) {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);
      
      let needsSave = false;
      for (let s of delivery.suppliers_data) {
        if (s.cash_given > 0 && !s.is_settled) {
          // Create settlement
          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: s.supplier_name,
            amount: s.cash_given,
            mode: 'cash',
            notes: s.cash_given_note || 'Cash given by driver before transit',
            date: now,
            ist_date,
            ist_formatted: formatIST(now), // requires formatIST in scope, check imports!
            created_by: delivery.created_by
          });
          
          // Deduct from supplier balance
          if (s.supplier_id) {
            await Supplier.findByIdAndUpdate(s.supplier_id, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          } else {
            // fallback by name
            await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          }
          
          s.is_settled = true;
          needsSave = true;
        }
      }
      if (needsSave) await delivery.save();
    }

    
    // Process cash_given settlements
    if (delivery.suppliers_data && delivery.suppliers_data.length > 0) {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);
      
      let needsSave = false;
      for (let s of delivery.suppliers_data) {
        if (s.cash_given > 0 && !s.is_settled) {
          // Create settlement
          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: s.supplier_name,
            amount: s.cash_given,
            mode: 'cash',
            notes: s.cash_given_note || 'Cash given by driver before transit',
            date: now,
            ist_date,
            ist_formatted: formatIST(now), // requires formatIST in scope, check imports!
            created_by: delivery.created_by
          });
          
          // Deduct from supplier balance
          if (s.supplier_id) {
            await Supplier.findByIdAndUpdate(s.supplier_id, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          } else {
            // fallback by name
            await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '
    const amountStr = allItems.reduce((sum, item) => sum + ((parseFloat(item.base_price) || 0) * (parseFloat(item.quantity) || 0)), 0);
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
      const itemSummary = allItems.map(i => `${i.item_name} x${i.quantity}`).join(', ');
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
    const delivery = await Delivery.findById(req.params.id).lean();
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    
    if (delivery.status !== 'delivered') {
      const Product = require('../models/Product');
      for (let item of delivery.items) {
        if (item.product_id) {
          const prod = await Product.findById(item.product_id).select('supplier_base_price price');
          if (prod) {
            if (!item.base_price || item.base_price === 0) {
              item.base_price = prod.supplier_base_price || 0;
            }
          }
        }
      }
    }
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

    // ─── Helper: find or create a product for a delivery item ────────────────
    const findOrCreateProduct = async (item) => {
      let product = null;
      if (item.product_id) {
        try { product = await Product.findById(item.product_id); } catch (e) {}
      }
      if (!product && item.item_name) {
        product = await Product.findOne({
          name: { $regex: `^${item.item_name.trim()}$`, $options: 'i' },
          is_active: true,
        });
      }
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
      return product;
    };

    // ─── Helper: apply pricing fields to product ─────────────────────────────
    const applyPricingToProduct = (product, item) => {
      product.last_updated_by = req.user.id;
      product.last_manual_edit_at = new Date();
      if (item.base_price > 0) product.supplier_base_price = parseFloat(item.base_price);
      if (item.final_price > 0) {
        product.price = parseFloat(item.final_price);
        product.last_delivery_final_price = parseFloat(item.final_price);
      } else if (item.base_price > 0) {
        const quintalAdj = (item.quintal_charge > 0 && item.weight > 0)
          ? (item.quintal_charge * item.weight) / 100 : 0;
        const beforeGST = item.base_price + quintalAdj;
        const gstAmt = (beforeGST * (item.gst || 0)) / 100;
        product.price = parseFloat((beforeGST + gstAmt).toFixed(2));
      }
      if (item.gst > 0) product.gst = item.gst;
      if (item.weight > 0) {
        const incomingQty = (item.final_stock != null && item.final_stock >= 0) ? item.final_stock : item.quantity;
        if (incomingQty > 0) product.weight_per_unit = parseFloat((item.weight / incomingQty).toFixed(3));
      }
    };

    // ─── AUTO-CREATE SUPPLIER ─────────────────────────────────────────────────
    if (status === 'delivered' || status === 'arrived') {
      const Supplier = require('../models/Supplier');
      const suppliersToCheck = (delivery.suppliers_data && delivery.suppliers_data.length > 0)
        ? delivery.suppliers_data.map(s => s.supplier_name.trim())
        : (delivery.supplier ? [delivery.supplier.trim()] : []);
        
      for (const sName of suppliersToCheck) {
        if (!sName) continue;
        const existingSupplier = await Supplier.findOne({
          name: { $regex: `^${sName.replace(/[.*+?^${}()|[\]\\]/g, '\\// ─── AUTO-CREATE SUPPLIER ─────────────────────────────────────────────────
    if ((status === 'delivered' || status === 'arrived') && delivery.supplier) {
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
    }')}const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Supplier = require('../models/Supplier');
const Settlement = require('../models/Settlement');
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

    if (req.user && req.user.role === 'supervisor' && req.query.manager_id) {
      query.created_by = req.query.manager_id;
    } else if (req.user && ['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
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
    const { vehicle_number, driver_name, driver_cash, supplier, expected_arrival, items, suppliers_data, notes, delivery_type, payment_status } = req.body;
    const hasItems = (items && items.length > 0) || (suppliers_data && suppliers_data.some(s => s.items && s.items.length > 0));
    if (!vehicle_number || !expected_arrival || !hasItems) {
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
      items: items ? items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit || 'pcs',
        product_id: i.product_id || null,
        base_price: parseFloat(i.base_price) || 0,
        final_price: parseFloat(i.final_price) || 0,
      })) : [],
      suppliers_data: suppliers_data ? suppliers_data.map(s => ({
        supplier_name: s.supplier_name,
        supplier_id: s.supplier_id || null,
        cash_given: parseFloat(s.cash_given) || 0,
        cash_given_note: s.cash_given_note || '',
        is_settled: false,
        items: s.items ? s.items.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || 'pcs',
          product_id: i.product_id || null,
          base_price: parseFloat(i.base_price) || 0,
          final_price: parseFloat(i.final_price) || 0,
        })) : []
      })) : [],
      notes: (notes || '').trim(),
      delivery_type: delivery_type || 'vehicle_incoming',
      payment_status: payment_status || 'unpaid',
      created_by: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null,
    });

    
    // Process cash_given settlements
    if (delivery.suppliers_data && delivery.suppliers_data.length > 0) {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);
      
      let needsSave = false;
      for (let s of delivery.suppliers_data) {
        if (s.cash_given > 0 && !s.is_settled) {
          // Create settlement
          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: s.supplier_name,
            amount: s.cash_given,
            mode: 'cash',
            notes: s.cash_given_note || 'Cash given by driver before transit',
            date: now,
            ist_date,
            ist_formatted: formatIST(now), // requires formatIST in scope, check imports!
            created_by: delivery.created_by
          });
          
          // Deduct from supplier balance
          if (s.supplier_id) {
            await Supplier.findByIdAndUpdate(s.supplier_id, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          } else {
            // fallback by name
            await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          }
          
          s.is_settled = true;
          needsSave = true;
        }
      }
      if (needsSave) await delivery.save();
    }

    
    // Process cash_given settlements
    if (delivery.suppliers_data && delivery.suppliers_data.length > 0) {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);
      
      let needsSave = false;
      for (let s of delivery.suppliers_data) {
        if (s.cash_given > 0 && !s.is_settled) {
          // Create settlement
          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: s.supplier_name,
            amount: s.cash_given,
            mode: 'cash',
            notes: s.cash_given_note || 'Cash given by driver before transit',
            date: now,
            ist_date,
            ist_formatted: formatIST(now), // requires formatIST in scope, check imports!
            created_by: delivery.created_by
          });
          
          // Deduct from supplier balance
          if (s.supplier_id) {
            await Supplier.findByIdAndUpdate(s.supplier_id, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          } else {
            // fallback by name
            await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '
    const amountStr = allItems.reduce((sum, item) => sum + ((parseFloat(item.base_price) || 0) * (parseFloat(item.quantity) || 0)), 0);
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
      const itemSummary = allItems.map(i => `${i.item_name} x${i.quantity}`).join(', ');
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
    const delivery = await Delivery.findById(req.params.id).lean();
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    
    if (delivery.status !== 'delivered') {
      const Product = require('../models/Product');
      for (let item of delivery.items) {
        if (item.product_id) {
          const prod = await Product.findById(item.product_id).select('supplier_base_price price');
          if (prod) {
            if (!item.base_price || item.base_price === 0) {
              item.base_price = prod.supplier_base_price || 0;
            }
          }
        }
      }
    }
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

    // ─── Helper: find or create a product for a delivery item ────────────────
    const findOrCreateProduct = async (item) => {
      let product = null;
      if (item.product_id) {
        try { product = await Product.findById(item.product_id); } catch (e) {}
      }
      if (!product && item.item_name) {
        product = await Product.findOne({
          name: { $regex: `^${item.item_name.trim()}$`, $options: 'i' },
          is_active: true,
        });
      }
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
      return product;
    };

    // ─── Helper: apply pricing fields to product ─────────────────────────────
    const applyPricingToProduct = (product, item) => {
      product.last_updated_by = req.user.id;
      product.last_manual_edit_at = new Date();
      if (item.base_price > 0) product.supplier_base_price = parseFloat(item.base_price);
      if (item.final_price > 0) {
        product.price = parseFloat(item.final_price);
        product.last_delivery_final_price = parseFloat(item.final_price);
      } else if (item.base_price > 0) {
        const quintalAdj = (item.quintal_charge > 0 && item.weight > 0)
          ? (item.quintal_charge * item.weight) / 100 : 0;
        const beforeGST = item.base_price + quintalAdj;
        const gstAmt = (beforeGST * (item.gst || 0)) / 100;
        product.price = parseFloat((beforeGST + gstAmt).toFixed(2));
      }
      if (item.gst > 0) product.gst = item.gst;
      if (item.weight > 0) {
        const incomingQty = (item.final_stock != null && item.final_stock >= 0) ? item.final_stock : item.quantity;
        if (incomingQty > 0) product.weight_per_unit = parseFloat((item.weight / incomingQty).toFixed(3));
      }
    };

    , $options: 'i' },
          is_active: true,
        });
        if (!existingSupplier) {
          try {
            await Supplier.create({ name: sName, is_active: true, created_by: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null });
          } catch (e) { /* ignore duplicate */ }
        }
      }
    }

    // ─── MARK ARRIVED: Provisional stock (still editable) ────────────────────
    if (status === 'arrived' && !delivery.temp_stock_added) {
      for (let i = 0; i < delivery.items.length; i++) {
        const item = delivery.items[i];
        const product = await findOrCreateProduct(item);
        if (!product) continue;

        const incomingQty = (item.final_stock != null && item.final_stock >= 0)
          ? item.final_stock : item.quantity;

        const stock_before = product.stock;
        product.stock += incomingQty;
        await product.save();

        // Track how much was provisionally added per item
        delivery.items[i].temp_qty_added = incomingQty;

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
          notes: `Provisional (Arrived): ${delivery.vehicle_number}${item.weight ? ` | Weight: ${item.weight}kg` : ''}`,
          source: 'manual',
          ist_formatted: formatIST(new Date()),
          created_by: req.user.id,
        });
      }
      delivery.temp_stock_added = true;
      // stock_updated stays FALSE — editing remains open until Delivered
      delivery.arrived_at = new Date();
      delivery.arrived_at_ist = formatIST(new Date());
    }

    // ─── MARK DELIVERED: Finalize & reconcile stock ───────────────────────────
    if (status === 'delivered') {
      if (delivery.temp_stock_added && !delivery.stock_updated) {
        // NEW FLOW: provisional stock was added on arrived → reconcile qty + update prices
        for (const item of delivery.items) {
          const product = await findOrCreateProduct(item);
          if (!product) continue;

          const finalQty = (item.final_stock != null && item.final_stock >= 0)
            ? item.final_stock : item.quantity;
          const prevTempQty = item.temp_qty_added != null ? item.temp_qty_added : finalQty;
          const diff = finalQty - prevTempQty;

          const stock_before = product.stock;
          if (diff !== 0) product.stock += diff;

          applyPricingToProduct(product, item);
          await product.save();

          if (diff !== 0) {
            await StockMovement.create({
              product_id: product._id,
              product_name: product.name,
              type: diff > 0 ? 'incoming' : 'adjustment',
              qty: Math.abs(diff),
              qty_unit: item.unit || product.unit || 'pcs',
              stock_before,
              stock_after: product.stock,
              vehicle_number: delivery.vehicle_number,
              driver_name: delivery.driver_name,
              supplier: delivery.supplier,
              notes: `Delivery Reconciliation: ${delivery.vehicle_number} (${diff > 0 ? '+' : ''}${diff} qty adjustment)`,
              source: 'manual',
              ist_formatted: formatIST(new Date()),
              created_by: req.user.id,
            });
          }
        }
        delivery.stock_updated = true;
      } else if (delivery.stock_updated && !delivery.temp_stock_added) {
        // OLD FLOW: was marked arrived with old code (stock_updated=true, no temp tracking)
        // Stock qty is already in — ONLY apply edited prices, do not add more qty
        for (const item of delivery.items) {
          const product = await findOrCreateProduct(item);
          if (!product) continue;
          applyPricingToProduct(product, item);
          await product.save();
        }
      } else if (!delivery.stock_updated) {
        // SKIP ARRIVED: vehicle went directly to delivered without Mark Arrived — full update
        for (const item of delivery.items) {
          const product = await findOrCreateProduct(item);
          if (!product) continue;

          const incomingQty = (item.final_stock != null && item.final_stock >= 0)
            ? item.final_stock : item.quantity;

          const stock_before = product.stock;
          product.stock += incomingQty;
          applyPricingToProduct(product, item);
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
      }
    }

    if (status === 'delivered' && !delivery.delivered_at) {
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
    const { vehicle_number, driver_name, supplier, expected_arrival, items, suppliers_data, notes } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot edit an entry after it has been marked Delivered' });
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

    if (suppliers_data?.length) {
      delivery.suppliers_data = suppliers_data.map(s => ({
        supplier_name: s.supplier_name,
        supplier_id: s.supplier_id || null,
        cash_given: parseFloat(s.cash_given) || 0,
        cash_given_note: s.cash_given_note || '',
        is_settled: s.is_settled || false,
        items: s.items ? s.items.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || 'pcs',
          product_id: i.product_id || null,
          weight: parseFloat(i.weight) || 0,
          base_price: parseFloat(i.base_price) || 0,
          quintal_charge: parseFloat(i.quintal_charge) || 0,
          supplier_charge_per_item: parseFloat(i.supplier_charge_per_item) || 0,
          gst: parseFloat(i.gst) || 0,
          final_price: parseFloat(i.final_price) || 0,
          final_stock: i.final_stock != null ? parseFloat(i.final_stock) : null,
          label: i.label || 'Goods',
          is_new_item: i.is_new_item || false,
        })) : []
      }));
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
        supplier_charge_per_item: parseFloat(i.supplier_charge_per_item) || 0,
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
    const { payment_status, payment_mode, notes, actual_paid_amount, payment_action } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    
    delivery.payment_mode = payment_mode || 'cash';
    if (actual_paid_amount !== undefined) {
      delivery.amount_paid = (delivery.amount_paid || 0) + parseFloat(actual_paid_amount);
    }
    
    // Explicitly handle payment actions
    if (payment_action === 'partial') {
      delivery.payment_status = 'unpaid';
    } else {
      delivery.payment_status = payment_status || 'paid';
    }

    if (delivery.payment_status === 'paid' || payment_action === 'partial') {
      if (delivery.payment_status === 'paid') {
        delivery.paid_at = new Date();
        delivery.paid_at_ist = formatIST(new Date());
      }

      // Sync to Settlement as Paid Out when delivery is marked paid (or partial)
      const Settlement = require('../models/Settlement');
      const invoiceTotal = delivery.items.reduce((s, i) => {
        const priceToUse = parseFloat(i.base_price) || parseFloat(i.final_price) || 0;
        return s + (priceToUse * (parseFloat(i.quantity) || 0));
      }, 0);
      const finalSettlementAmount = actual_paid_amount !== undefined ? parseFloat(actual_paid_amount) : invoiceTotal;
      if (finalSettlementAmount > 0 || invoiceTotal > 0) {
        const now = new Date();
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + IST_OFFSET_MS);
        const ist_date = istDate.toISOString().slice(0, 10);
        
        const deliveryTypeStr = delivery.vehicle_number === 'WALK-IN' ? 'Walk-in delivery' : 'Delivery';
        const actionStr = payment_action === 'partial' ? 'Partial payment' : payment_action === 'advance' ? 'Advance payment' : 'Payment';
        const defaultNote = delivery.items.length > 1 
          ? `${deliveryTypeStr} ${actionStr} — ${delivery.items[0].item_name} and more products`
          : `${deliveryTypeStr} ${actionStr} — ${delivery.items[0]?.item_name || 'Goods'}`;
        const finalNotes = notes && notes.trim() !== '' ? notes.trim() : defaultNote;

        await Settlement.create({
          type: 'paid_to_supplier',
          party_name: delivery.supplier || 'Walk-in Supplier',
          amount: finalSettlementAmount,
          mode: payment_mode || 'cash',
          notes: finalNotes,
          date: now,
          ist_date,
          ist_formatted: formatIST(now),
          created_by: req.user ? req.user.id : (req.admin ? req.admin.id : null),
        });

        // Only create a discount if it is explicitly negotiated
        if (payment_action === 'negotiated') {
          const discountAmt = invoiceTotal - finalSettlementAmount;
          if (discountAmt > 0) {
            await Settlement.create({
              type: 'paid_to_supplier',
              party_name: delivery.supplier || 'Walk-in Supplier',
              amount: discountAmt,
              mode: 'discount',
              notes: `Negotiation Discount for ${deliveryTypeStr}`,
              date: now,
              ist_date,
              ist_formatted: formatIST(now),
              created_by: req.user ? req.user.id : (req.admin ? req.admin.id : null),
            });
          }
        }

        // GOODS EXCHANGE AUTOMATION: Sync to Linked Customer
        if (payment_mode === 'goods_exchange') {
            const Supplier = require('../models/Supplier');
            const Customer = require('../models/Customer');
            const Invoice = require('../models/Invoice');
            const supplier = await Supplier.findOne({ name: { $regex: `^${(delivery.supplier || '').trim()}$`, $options: 'i' } });
            if (supplier && supplier.linked_customer_id) {
              const customer = await Customer.findById(supplier.linked_customer_id);
              if (customer) {
                const invoice = await Invoice.create({
                  customer_id: customer._id,
                  customer_name: customer.name,
                  total_amount: finalSettlementAmount,
                  paid_amount: 0,
                  status: 'unpaid',
                  items: [{
                    item_name: 'Goods Exchange against Walk-in Delivery',
                    quantity: 1,
                    base_price: finalSettlementAmount,
                    final_price: finalSettlementAmount
                  }],
                  date: now,
                  ist_date,
                  created_by: req.user ? req.user.id : null
                });
                customer.balance = (customer.balance || 0) + finalSettlementAmount;
                await customer.save();
                
                const ActivityLog = require('../models/ActivityLog');
                await ActivityLog.create({
                  user_id: req.user ? req.user.id : null,
                  username: req.user ? req.user.username : 'Admin',
                  user_role: req.user ? req.user.role : 'admin',
                  action: 'create',
                  entity_type: 'invoice',
                  entity_id: invoice._id,
                  entity_name: customer.name,
                  description: `Auto-generated Invoice for Goods Exchange with Supplier`,
                });
              }
            }
          }
        }

      // Notify manager who created it
      const currentUserId = req.user?.id || req.user?._id || req.admin?.id || req.admin?._id;
      if (delivery.created_by && String(delivery.created_by) !== String(currentUserId)) {
        try {
          const Notification = require('../models/Notification');
          const invoiceTotal = delivery.items.reduce((s, i) => {
            const priceToUse = parseFloat(i.base_price) || parseFloat(i.final_price) || 0;
            return s + (priceToUse * (parseFloat(i.quantity) || 0));
          }, 0);
          const finalNotificationAmount = actual_paid_amount !== undefined ? parseFloat(actual_paid_amount) : invoiceTotal;
          
          let actorName = 'Admin';
          if (req.user && req.user.username) actorName = req.user.username;
          if (req.user && req.user.display_name) actorName = req.user.display_name;

          await Notification.create({
            recipient_id: delivery.created_by,
            type: 'general',
            title: '💸 Walk-in Paid',
            message: `${actorName} marked walk-in from ${delivery.supplier || 'Unknown'} as PAID (₹${finalNotificationAmount}).`,
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
    if (delivery.status === 'delivered' || delivery.stock_updated) {
      return res.status(400).json({ error: 'Cannot delete an entry after stock has been finalized. Mark as not_delivered first.' });
    }
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- POST /api/deliveries/:id/dispatch-walkin -----------------------------
// Assigns a delivery (vehicle) to a walkin_manager and converts it to a trip
router.post('/:id/dispatch-walkin', checkProductEditPermission, async (req, res) => {
  try {
    const { manager_id, items } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.status === 'delivered') return res.status(400).json({ error: 'Already delivered.' });

    const Admin = require('../models/Admin');
    const VehicleTrip = require('../models/VehicleTrip');
    const Product = require('../models/Product');

    const manager = await Admin.findOne({ _id: manager_id, role: 'walkin_manager' });
    if (!manager) return res.status(404).json({ error: 'Walk-in manager not found' });
    if (manager.is_trip_active) return res.status(400).json({ error: 'Manager already has an active trip' });

    // Update global products
    for (const item of items) {
      if (item.product_id) {
        const p = await Product.findById(item.product_id);
        if (p) {
          p.price = parseFloat(item.final_price || item.base_price || 0);
          p.last_delivery_final_price = p.price;
          p.last_updated_by = req.user.id;
          p.last_manual_edit_at = new Date();
          await p.save();
        }
      }
    }

    // Update delivery
    delivery.items = items;
    delivery.status = 'delivered'; // Finish the inward phase
    delivery.stock_updated = true;
    await delivery.save();

    // Start active trip for manager
    manager.is_trip_active = true;
    manager.active_vehicle_number = delivery.vehicle_number;
    manager.active_driver_name = delivery.driver_name;
    manager.active_destination = delivery.destination || 'Walk-in Sales';
    await manager.save();

    // Create VehicleTrip
    await VehicleTrip.create({
      manager_id: manager._id,
      vehicle_number: delivery.vehicle_number,
      driver_name: delivery.driver_name,
      destination: delivery.destination || 'Walk-in Sales',
      status: 'active',
      initial_stock: items.map(i => ({
        product_id: i.product_id,
        item_name: i.item_name,
        quantity: i.quantity,
        price: parseFloat(i.final_price || i.base_price || 0),
        unit: i.unit || 'pcs'
      }))
    });

    res.json({ success: true, message: 'Dispatched to manager successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;