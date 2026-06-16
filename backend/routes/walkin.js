const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Admin = require('../models/Admin');
const VehicleTrip = require('../models/VehicleTrip');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Notification = require('../models/Notification');
const ProductList = require('../models/ProductList');
const DailyReport = require('../models/DailyReport');
const TripBypassRequest = require('../models/TripBypassRequest');
const { logActivity } = require('./activityLogs');
const { formatIST } = require('../utils/timeUtils');

// Middleware to ensure user is walkin_manager or supervisor
const requireWalkinOrSupervisor = (req, res, next) => {
  if (req.user.role !== 'walkin_manager' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Access denied. Walk-in Manager or Supervisor only.' });
  }
  next();
};

// GET active vehicle trip for the current manager
router.get('/active-trip', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const reportsToday = await DailyReport.find({
      manager_id: req.user.id,
      date: { $regex: `^${todayIST}` }
    }).limit(1);
    const report_submitted_today = reportsToday.length > 0;

    if (!admin.is_trip_active) {
      const pendingNewTrip = await TripBypassRequest.exists({ manager_id: req.user.id, status: 'pending', request_type: 'new_trip' });
      return res.json({ 
        active: false, 
        report_submitted_today, 
        new_trip_approved: admin.new_trip_approved,
        pending_request: !!pendingNewTrip
      });
    }

    const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
    if (!trip) {
      admin.is_trip_active = false;
      admin.active_vehicle_number = '';
      admin.active_driver_name = '';
      admin.active_destination = '';
      await admin.save();
      const pendingNewTrip = await TripBypassRequest.exists({ manager_id: req.user.id, status: 'pending', request_type: 'new_trip' });
      return res.json({ 
        active: false,
        report_submitted_today,
        new_trip_approved: admin.new_trip_approved,
        pending_request: !!pendingNewTrip
      });
    }
    const pendingNewSupply = await TripBypassRequest.exists({ manager_id: req.user.id, status: 'pending', request_type: 'new_supply' });
    res.json({ active: true, trip, admin, pending_request: !!pendingNewSupply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET previous trip remaining items for today
router.get('/previous-trip-remaining', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const todayIST = formatIST(new Date()).split(' ')[0]; // Returns "DD/MM/YYYY" ? Wait, formatIST format is DD/MM/YYYY hh:mm A. Actually, standard date used is Date().toISOString().split('T')[0] or local time.
    // DailyReport date is saved as YYYY-MM-DD. We should just use standard timezone offset.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Fetch the most recent report submitted today
    const reports = await DailyReport.find({
      manager_id: req.user.id,
      date: { $regex: `^${today}` }
    }).sort({ createdAt: -1 }).limit(1);

    if (reports.length > 0 && reports[0].walkin_trip_summary && reports[0].walkin_trip_summary.remaining_items) {
      return res.json({ remaining_items: reports[0].walkin_trip_summary.remaining_items });
    }
    res.json({ remaining_items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all active trips (for Supervisor/Admin)
router.get('/all-active-trips', auth, async (req, res) => {
  try {
    if (req.user.role !== 'supervisor') return res.status(403).json({ error: 'Access denied.' });
    const trips = await VehicleTrip.find({ status: 'active' }).lean();
    res.json({ success: true, trips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST assign vehicle (start trip) — D.1: sends notification to admin
router.post('/assign-vehicle', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const { vehicle_number, driver_name, destination } = req.body;
    if (!vehicle_number || !driver_name || !destination) {
      return res.status(400).json({ error: 'Vehicle number, driver name, and destination are required.' });
    }

    const admin = await Admin.findById(req.user.id);
    if (admin.is_trip_active) {
      return res.status(400).json({ error: 'Trip already active. Please finish the current trip first.' });
    }

    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const reportsToday = await DailyReport.find({
      manager_id: req.user.id,
      date: { $regex: `^${todayIST}` }
    }).limit(1);

    if (reportsToday.length > 0) {
      if (!admin.new_trip_approved) {
        return res.status(400).json({ error: 'You have already submitted a report today. Please request a New Trip from the admin.', error_code: 'NEW_TRIP_REQUIRED' });
      }
      // Consume the approval
      admin.new_trip_approved = false;
    }

    admin.is_trip_active = true;
    admin.active_vehicle_number = vehicle_number;
    admin.active_driver_name = driver_name;
    admin.active_destination = destination;
    await admin.save();

    // Create a new VehicleTrip record
    const trip = await VehicleTrip.create({
      manager_id: admin._id,
      vehicle_number,
      driver_name,
      destination,
      status: 'active',
      initial_stock: []
    });

    // D.1: Send secret notification to admin (supervisor)
    const managerName = admin.display_name || admin.username;
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: admin._id,
        sender_name: managerName,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'vehicle_assigned',
        title: `🚚 Vehicle Assigned`,
        message: `Vehicle ${vehicle_number} assigned to ${destination} by ${managerName}. Driver: ${driver_name}.`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { vehicle_number, driver_name, destination, manager_name: managerName }
      });
    }

    // Log activity for admin panel
    logActivity(req, {
      action: 'create',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: vehicle_number,
      description: `Vehicle ${vehicle_number} assigned to ${destination} by ${managerName}. Driver: ${driver_name}.`,
    });

    res.json({ success: true, trip, admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update vehicle details — D.2: limited to 5 times, notification with "edited" tag
router.put('/update-vehicle', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const { vehicle_number, driver_name, destination } = req.body;
    const admin = await Admin.findById(req.user.id);
    if (!admin.is_trip_active) {
      return res.status(400).json({ error: 'No active trip found.' });
    }

    const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
    if (!trip) {
      return res.status(404).json({ error: 'Trip record not found.' });
    }

    if (trip.trip_started) {
      return res.status(400).json({ error: 'Trip already started. Vehicle details cannot be changed.' });
    }

    if (trip.vehicle_update_count >= 5) {
      return res.status(400).json({ error: 'Vehicle details can only be updated 5 times. Limit reached.' });
    }

    // Track what changed
    const changes = [];
    if (vehicle_number && vehicle_number !== trip.vehicle_number) {
      changes.push(`Vehicle: ${trip.vehicle_number} → ${vehicle_number}`);
    }
    if (driver_name && driver_name !== trip.driver_name) {
      changes.push(`Driver: ${trip.driver_name} → ${driver_name}`);
    }
    if (destination && destination !== trip.destination) {
      changes.push(`Destination: ${trip.destination} → ${destination}`);
    }

    if (changes.length === 0) {
      return res.json({ success: true, message: 'No changes detected.', trip });
    }

    // Update trip
    trip.vehicle_number = vehicle_number || trip.vehicle_number;
    trip.driver_name = driver_name || trip.driver_name;
    trip.destination = destination || trip.destination;
    trip.vehicle_update_count += 1;
    await trip.save();

    // Update admin fields too
    admin.active_vehicle_number = trip.vehicle_number;
    admin.active_driver_name = trip.driver_name;
    admin.active_destination = trip.destination;
    await admin.save();

    // D.2: Secret notification to admin — "edited" tag
    const managerName = admin.display_name || admin.username;
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: admin._id,
        sender_name: managerName,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'vehicle_assigned',
        title: `🚚 Vehicle Details Updated (Edited)`,
        message: `${managerName} updated vehicle details: ${changes.join(', ')}. Current: ${trip.vehicle_number} → ${trip.destination}, Driver: ${trip.driver_name}. (Edit ${trip.vehicle_update_count}/5)`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { changes, vehicle_number: trip.vehicle_number, driver_name: trip.driver_name, destination: trip.destination }
      });
    }

    logActivity(req, {
      action: 'update',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: trip.vehicle_number,
      description: `Vehicle details edited by ${managerName}: ${changes.join(', ')}. (Edit ${trip.vehicle_update_count}/5)`,
    });

    res.json({ success: true, trip, admin, remaining_updates: 5 - trip.vehicle_update_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST start trip — D.2: locks all editing except price, sends secret notification to admin
router.post('/start-trip', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin.is_trip_active) {
      return res.status(400).json({ error: 'No active trip found.' });
    }

    const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
    if (!trip) {
      return res.status(404).json({ error: 'Trip record not found.' });
    }

    if (trip.trip_started) {
      return res.status(400).json({ error: 'Trip already started.' });
    }

    // Snapshot current inventory into initial_stock
    const products = await Product.find({ created_by: req.user.id, stock: { $gt: 0 } });
    trip.initial_stock = products.map(p => ({
      product_id: p._id,
      product_name: p.name,
      quantity: p.stock,
      price: p.price,
      amount: p.stock * p.price
    }));
    trip.trip_started = true;
    await trip.save();

    // D.2: Secret notification to admin with loaded items
    const managerName = admin.display_name || admin.username;
    const itemsList = trip.initial_stock.map(s => `${s.product_name}: ${s.quantity} units @ ₹${s.price}`).join(', ');
    const totalValue = trip.initial_stock.reduce((sum, s) => sum + s.amount, 0);

    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: admin._id,
        sender_name: managerName,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'trip_started',
        title: `🚀 Trip Started — ${trip.vehicle_number}`,
        message: `${managerName} started trip to ${trip.destination}. Vehicle: ${trip.vehicle_number}, Driver: ${trip.driver_name}. Items loaded: ${itemsList}. Total value: ₹${totalValue.toFixed(2)}.`,
        priority: 'high',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: {
          vehicle_number: trip.vehicle_number,
          driver_name: trip.driver_name,
          destination: trip.destination,
          items: trip.initial_stock,
          total_value: totalValue
        }
      });
    }

    logActivity(req, {
      action: 'update',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: trip.vehicle_number,
      description: `Trip started by ${managerName}. ${trip.initial_stock.length} items loaded, total value ₹${totalValue.toFixed(2)}.`,
      changes: { items: trip.initial_stock, total_value: totalValue, destination: trip.destination }
    });

    res.json({ success: true, trip, message: 'Trip started! You can now create invoices.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST mark inventory complete (kept for backwards compat, now replaced by start-trip)
router.post('/mark-complete', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin.is_trip_active) {
      return res.status(400).json({ error: 'No active trip found.' });
    }

    const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
    if (!trip) {
      return res.status(404).json({ error: 'Trip record not found.' });
    }

    // Fetch all products loaded by this manager
    const products = await Product.find({ created_by: req.user.id, stock: { $gt: 0 } });
    
    trip.initial_stock = products.map(p => ({
      product_id: p._id,
      product_name: p.name,
      quantity: p.stock,
      price: p.price,
      amount: p.stock * p.price
    }));

    await trip.save();

    res.json({ success: true, message: 'Inventory loading complete. Secret report recorded.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all trips for supervisor
router.get('/all-trips', auth, async (req, res) => {
  try {
    if (req.user.role !== 'supervisor') return res.status(403).json({ error: 'Supervisor only' });
    const trips = await VehicleTrip.find().populate('manager_id', 'username display_name').sort({ createdAt: -1 });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET catalog products for walk-in manager to load
router.get('/global-products', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    // Only return products explicitly created by or shared with this walk-in manager.
    // The user explicitly requested that they should not see the entire global store unless shared.
    // Include shared product lists
    const sharedLists = await ProductList.find({ 'shares.manager_id': req.user.id });
    let sharedProductIds = [];
    sharedLists.forEach(list => {
      const share = list.shares.find(s => s.manager_id.toString() === req.user.id);
      if (share) {
        list.products.forEach(pId => {
          const override = share.overrides.find(o => o.product_id.toString() === pId.toString());
          if (!override || !override.is_excluded) {
            sharedProductIds.push(pId);
          }
        });
      }
    });

    const products = await Product.find({
      $or: [
        { created_by: req.user.id },
        { allowed_managers: req.user.id },
        { _id: { $in: sharedProductIds } }
      ]
    }).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST load products from global inventory to walkin manager inventory
// D.2: Limited to 5 loads per trip
router.post('/load-products', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin.is_trip_active) {
      return res.status(400).json({ error: 'Trip is not active. Please start a trip before loading items.' });
    }

    const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
    if (!trip) {
      return res.status(400).json({ error: 'No active trip found.' });
    }

    if (trip.trip_started && !trip.allow_reload) {
      return res.status(400).json({ error: 'Trip already started. Loading is no longer allowed unless new supply is approved.' });
    }

    if (trip.load_count >= 5) {
      return res.status(400).json({ error: 'Loading limit reached (5 times). You cannot load more products.' });
    }

    const results = [];
    const errors = [];

    // Process each item
    for (const item of items) {
      const { product_id, qty } = item;
      
      // 1. Fetch global product
      const globalProduct = await Product.findById(product_id);
      if (!globalProduct) {
        errors.push(`Global product not found for ID: ${product_id}`);
        continue;
      }
      
      const loadQty = parseFloat(qty);
      if (isNaN(loadQty) || loadQty <= 0) {
        errors.push(`Invalid quantity for ${globalProduct.name}`);
        continue;
      }

      // Check stock
      if (globalProduct.stock < loadQty) {
        errors.push(`Insufficient stock for ${globalProduct.name}. Requested: ${loadQty}, Available: ${globalProduct.stock}`);
        continue;
      }

      // 2. Deduct from global product
      const globalStockBefore = globalProduct.stock;
      globalProduct.stock -= loadQty;
      await globalProduct.save();

      // D.3: Log global movement — "taken by X walkin admin"
      const managerName = admin.display_name || admin.username;
      await StockMovement.create({
        product_id: globalProduct._id,
        product_name: globalProduct.name,
        created_by: req.user.id,
        type: 'outgoing',
        qty: loadQty,
        stock_before: globalStockBefore,
        stock_after: globalProduct.stock,
        reference: `Taken by ${managerName} (Walk-in Manager)`,
        notes: `Loaded into vehicle ${admin.active_vehicle_number} by walk-in manager ${managerName}`,
        source: 'Supply',
        vehicle_number: admin.active_vehicle_number,
        driver_name: admin.active_driver_name,
        ist_formatted: formatIST(new Date()),
      });

      // 3. Find or Create local product for walkin_manager
      let localProduct = await Product.findOne({ 
        created_by: req.user.id, 
        name: globalProduct.name 
      });

      if (localProduct) {
        const localStockBefore = localProduct.stock;
        localProduct.stock += loadQty;
        await localProduct.save();

        // Incoming local movement log removed as per request
      } else {
        // Create new local product cloned from global
        localProduct = await Product.create({
          name: globalProduct.name,
          category: globalProduct.category,
          price: globalProduct.price,
          unit: globalProduct.unit,
          stock: loadQty,
          created_by: req.user.id,
          gst: globalProduct.gst,
          hsn_code: globalProduct.hsn_code,
          weight_per_unit: globalProduct.weight_per_unit,
          custom_low_stock: 2
        });

        // Incoming local movement log removed as per request
      }

      // 4. Auto-add loaded product to walkin manager's personal list
      const autoList = await ProductList.findOne({ auto_for_manager: req.user.id });
      if (autoList && !autoList.products.some(pid => pid.toString() === localProduct._id.toString())) {
        autoList.products.push(localProduct._id);
        await autoList.save();
      }

      results.push({ name: globalProduct.name, loaded: loadQty });
    }

    // Increment load count and reset allow_reload
    if (results.length > 0) {
      trip.load_count += 1;
      trip.allow_reload = false;
      await trip.save();
    }

    res.json({ success: true, results, errors, load_count: trip.load_count, remaining_loads: 5 - trip.load_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/walkin/requests ────────
router.get('/requests', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const query = req.user.role === 'supervisor' ? { status: 'pending' } : { manager_id: req.user.id, status: 'pending' };
    const requests = await TripBypassRequest.find(query).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── POST /api/walkin/request-next-trip ────────
router.post('/request-next-trip', auth, requireWalkinOrSupervisor, async (req, res) => {
  try {
    const { type } = req.body; // 'new_trip' or 'new_supply'
    const requestType = type === 'new_supply' ? 'new_supply' : 'new_trip';
    
    const admin = await Admin.findById(req.user.id);
    let trip = null;
    
    if (requestType === 'new_supply') {
      if (!admin.is_trip_active) return res.status(400).json({ error: 'No active trip to request supply for.' });
      trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
      if (!trip) return res.status(400).json({ error: 'Active trip not found.' });
    }

    // Check if already requested
    const existing = await TripBypassRequest.findOne({ manager_id: req.user.id, status: 'pending', request_type: requestType });
    if (existing) {
      return res.status(400).json({ error: 'Request already sent and pending.' });
    }

    const requestData = {
      manager_id: req.user.id,
      manager_name: admin.display_name || admin.username,
      request_type: requestType
    };
    if (trip) {
      requestData.trip_id = trip._id;
    }

    const request = await TripBypassRequest.create(requestData);

    const managerName = admin.display_name || admin.username;
    const recipients = await Admin.find({ role: { $in: ['admin', 'supervisor'] } }, '_id role');
    const notifTitle = requestType === 'new_supply' ? '📦 New Supply Request' : '🚚 New Trip Request';
    const notifMessage = requestType === 'new_supply' 
      ? `Manager ${managerName} is asking for new supply during their trip. Figure this out by yourself.` 
      : `Manager ${managerName} is asking to start a new trip. Figure this out by yourself.`;

    for (const rec of recipients) {
      await Notification.create({
        sender_id: admin._id,
        sender_name: managerName,
        recipient_id: rec._id,
        recipient_role: rec.role,
        type: 'trip_bypass_request',
        title: notifTitle,
        message: notifMessage,
        priority: 'high',
        entity_type: 'trip_request',
        entity_id: request._id,
        metadata: { request_id: request._id, request_type: requestType }
      });
    }

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/walkin/approve-next-trip/:requestId ────────
router.post('/approve-next-trip/:requestId', auth, async (req, res) => {
  if (!['admin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Admin or Supervisor can approve requests.' });
  }

  try {
    const request = await TripBypassRequest.findById(req.params.requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ error: 'Pending request not found.' });
    }

    if (request.request_type === 'new_trip') {
      // 1. New Trip Request: Just set the manager's new_trip_approved flag
      await Admin.findByIdAndUpdate(request.manager_id, { new_trip_approved: true });
      
      request.status = 'approved';
      request.resolved_by = req.user.id;
      request.resolved_at = new Date();
      await request.save();

      await Notification.create({
        type: 'general',
        title: 'New Trip Approved',
        message: 'Your request to start a new trip was approved! You can now assign a vehicle.',
        recipient_id: request.manager_id,
        sender_id: req.user.id,
        sender_name: req.user.username,
      });

      return res.json({ success: true, message: `New Trip approved for ${request.manager_name}.` });

    } else if (request.request_type === 'new_supply') {
      // 2. New Supply Request: Unlock the current active trip's allow_reload
      const trip = await VehicleTrip.findById(request.trip_id);
      if (!trip || trip.status !== 'active') {
        request.status = 'rejected';
        await request.save();
        return res.status(400).json({ error: 'Trip is no longer active.' });
      }

      trip.allow_reload = true;
      await trip.save();

      request.status = 'approved';
      request.resolved_by = req.user.id;
      request.resolved_at = new Date();
      await request.save();

      await Notification.create({
        type: 'general',
        title: 'New Supply Approved',
        message: 'Your request for new supply was approved! You can now load more products.',
        recipient_id: request.manager_id,
        sender_id: req.user.id,
        sender_name: req.user.username,
      });

      return res.json({ success: true, message: `New Supply approved for ${request.manager_name}.` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/walkin/reject-request/:requestId ────────
router.post('/reject-request/:requestId', auth, async (req, res) => {
  if (!['admin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Admin or Supervisor can reject requests.' });
  }
  try {
    const request = await TripBypassRequest.findById(req.params.requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ error: 'Pending request not found.' });
    }
    request.status = 'rejected';
    request.resolved_by = req.user.id;
    request.resolved_at = new Date();
    await request.save();

    await Notification.create({
      type: 'general',
      title: request.request_type === 'new_supply' ? 'Supply Request Rejected' : 'New Trip Rejected',
      message: request.request_type === 'new_supply' 
        ? 'Your request for new supply was rejected by Admin.' 
        : 'Your request to start a new trip was rejected by Admin.',
      recipient_id: request.manager_id,
      sender_id: req.user.id,
      sender_name: req.user.username,
    });

    res.json({ success: true, message: 'Request rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
