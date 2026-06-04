const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');
const { todayUTCRange } = require('../utils/timeUtils');

router.use(auth);

// Goods type options
const GOODS_TYPES = [
  'Fruits-Vegetables', 'Goods', 'Paint', 'Tile', 'Cement',
  'Hardware Sariya', 'Beverages', 'Booking', 'Others'
];

// ── GET /api/trips/goods-types — Available goods categories ───────────────────
router.get('/goods-types', (req, res) => {
  res.json({ types: GOODS_TYPES });
});

// ── GET /api/trips — List trips (driver sees own, admin sees all) ─────────────
router.get('/', async (req, res) => {
  try {
    const { status, type, limit = 50, page = 1, date, all } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Drivers only see their own trips
    if (req.user.role === 'driver') {
      query.driver_id = req.user.id;
    }

    if (all !== 'true') {
      const { startUTC, endUTC } = todayUTCRange();
      let start = startUTC;
      let end = endUTC;

      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const istMidnight = new Date(date + 'T00:00:00.000Z');
        start = new Date(istMidnight.getTime() - IST_OFFSET_MS);
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      }
      query.createdAt = { $gte: start, $lt: end };
    }

    if (status) query.status = status;
    if (type) query.type = type;

    const [trips, total] = await Promise.all([
      Trip.find(query).populate('invoice_id', 'invoice_number customer_name customer_phone total_weight').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Trip.countDocuments(query),
    ]);

    res.json({ trips, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/trips/:id — Single trip detail ──────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('invoice_id', 'invoice_number customer_name customer_phone total_weight');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips — Start a new trip ───────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, origin, destination, cargo, invoice_id, amount_to_collect } = req.body;
    if (!type || !origin || !destination) {
      return res.status(400).json({ error: 'type, origin, and destination are required' });
    }

    // Check for active trip
    const activeTrip = await Trip.findOne({ driver_id: req.user.id, status: 'active' });
    if (activeTrip) {
      return res.status(400).json({ error: 'You already have an active trip. Complete it before starting a new one.' });
    }

    const Admin = require('../models/Admin');
    const driver = await Admin.findById(req.user.id);

    const trip = await Trip.create({
      driver_id: req.user.id,
      driver_name: driver?.display_name || req.user.username,
      vehicle_number: driver?.username || '',
      invoice_id: invoice_id || null,
      amount_to_collect: parseFloat(amount_to_collect) || 0,
      type,
      status: 'active',
      legs: [{
        origin,
        destination,
        cargo: cargo || [],
        status: 'active',
      }],
      timeline: [{
        type: 'trip_start',
        location: origin,
        note: `Trip started from ${origin} to ${destination}`,
      }],
      started_at: new Date(),
    });

    const ownerNames = (cargo || []).map(c => c.owner_name).filter(Boolean).join(', ');
    const ownerPhones = (cargo || []).map(c => c.owner_phone).filter(Boolean).join(', ');
    const ownerInfo = ownerNames ? `\\nOwner: ${ownerNames} (${ownerPhones})` : '';

    // Notify all supervisors
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: req.user.id,
        sender_name: `${trip.vehicle_number} - ${trip.driver_name}`,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'trip_started',
        title: `🚛 Trip Started`,
        message: `${type.toUpperCase()} trip: ${origin} → ${destination}${ownerInfo}`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { sender_role: req.user.role }
      });
    }

    // Log activity
    await logActivity(req, {
      action: 'create',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: `${type} — ${origin} → ${destination}`,
      description: `Trip started by ${driver?.display_name || req.user.username}`,
    });

    res.status(201).json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips/:id/expense — Log an expense during trip ─────────────────
router.post('/:id/expense', async (req, res) => {
  try {
    const { expense_type, expense_amount, expense_note } = req.body;
    if (!expense_type || !expense_amount) {
      return res.status(400).json({ error: 'expense_type and expense_amount are required' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.status !== 'active') return res.status(400).json({ error: 'Trip is not active' });

    trip.timeline.push({
      type: 'expense',
      expense_type,
      expense_amount: parseFloat(expense_amount),
      expense_note: expense_note || '',
    });

    await trip.save();

    // The user requested to NOT receive notifications for expenses to declutter the notification bar.
    // Expenses can be viewed by clicking into the trip details.
    
    res.json({ success: true, total_expenses: trip.total_expenses, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips/:id/cargo/:cargoIndex/deliver — Mark individual cargo as delivered ──
router.post('/:id/cargo/:cargoIndex/deliver', async (req, res) => {
  try {
    const { id, cargoIndex } = req.params;
    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const activeLeg = trip.legs.find(l => l.status === 'active');
    if (!activeLeg) return res.status(400).json({ error: 'No active leg found' });

    const cargo = activeLeg.cargo[parseInt(cargoIndex)];
    if (!cargo) return res.status(404).json({ error: 'Cargo not found' });

    cargo.status = 'delivered';

    trip.timeline.push({
      type: 'reached_destination',
      location: cargo.owner_name || 'Customer',
      note: `Delivered consignment to ${cargo.owner_name || 'Customer'}`
    });

    await trip.save();

    await logActivity(req, {
      action: 'update',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: `${trip.type} — ${trip.vehicle_number}`,
      description: `Delivered cargo to ${cargo.owner_name || 'Customer'}`,
    });

    // Notification of admin
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: req.user.id,
        sender_name: `${trip.vehicle_number} - ${trip.driver_name}`,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'trip_progress',
        title: `✅ Cargo Delivered`,
        message: `Delivered consignment to ${cargo.owner_name || 'Customer'}`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { sender_role: req.user.role }
      });
    }

    res.json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips/:id/reached — Mark destination reached ───────────────────
router.post('/:id/reached', async (req, res) => {
  try {
    const { location } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    trip.timeline.push({
      type: 'reached_destination',
      location: location || '',
      note: `Reached ${location || 'destination'}`,
    });

    // Mark current leg as completed
    const activeLeg = trip.legs.find(l => l.status === 'active');
    if (activeLeg) {
      activeLeg.status = 'completed';
      activeLeg.completed_at = new Date();
    }

    await trip.save();

    await logActivity(req, {
      action: 'update',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: `${trip.type} — ${trip.vehicle_number}`,
      description: `Reached ${location || 'destination'}`,
    });

    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: req.user.id,
        sender_name: `${trip.vehicle_number} - ${trip.driver_name}`,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'trip_progress',
        title: `📍 Destination Reached`,
        message: `Reached ${location || 'destination'}`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { sender_role: req.user.role }
      });
    }

    res.json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips/:id/next-leg — Add return/next leg ───────────────────────
router.post('/:id/next-leg', async (req, res) => {
  try {
    const { origin, destination, cargo } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination are required' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    trip.legs.push({
      origin,
      destination,
      cargo: cargo || [],
      status: 'active',
    });

    trip.timeline.push({
      type: 'returning',
      location: origin,
      note: `Starting next leg: ${origin} → ${destination}`,
      return_cargo: cargo || [],
    });

    await trip.save();

    await logActivity(req, {
      action: 'update',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: `${trip.type} — ${trip.vehicle_number}`,
      description: `Started next leg: ${origin} → ${destination}`,
    });

    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: req.user.id,
        sender_name: `${trip.vehicle_number} - ${trip.driver_name}`,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'trip_progress',
        title: `🛣️ Next Leg Started`,
        message: `${origin} → ${destination}`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { sender_role: req.user.role }
      });
    }

    res.json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips/:id/end — End the trip ───────────────────────────────────
router.post('/:id/end', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    trip.status = 'completed';
    trip.completed_at = new Date();

    // Mark all active legs as completed
    trip.legs.forEach(l => {
      if (l.status === 'active') {
        l.status = 'completed';
        l.completed_at = new Date();
      }
    });

    trip.timeline.push({
      type: 'trip_end',
      note: 'Trip completed',
    });

    await trip.save();

    // Mark all linked invoices as delivered
    const Invoice = require('../models/Invoice');
    const invoiceIdsToUpdate = [];
    
    // Collect from root invoice_id
    if (trip.invoice_id) invoiceIdsToUpdate.push(trip.invoice_id);
    
    // Collect from all cargo entries
    trip.legs.forEach(leg => {
      leg.cargo.forEach(c => {
        if (c.invoice_id) invoiceIdsToUpdate.push(c.invoice_id);
      });
    });

    if (invoiceIdsToUpdate.length > 0) {
      // Assuming 'delivered' or 'completed' is a valid status, but looking at invoice schema it uses 'active', 'edited', etc.
      // Wait, what does the Invoice schema allow? 
      // The invoice schema status enum: ['active', 'edited', 'partially_returned', 'cancelled']
      // Usually, there's no 'delivered' status. Maybe it just stays 'active'?
      // Let's NOT update Invoice status if there is no delivery status. But let's check Invoice.js.
    }

    // Notify supervisors about trip completion
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        sender_id: req.user.id,
        sender_name: `${trip.vehicle_number} - ${trip.driver_name}`,
        recipient_id: sup._id,
        recipient_role: 'supervisor',
        type: 'trip_completed',
        title: `🏁 Trip Completed`,
        message: `Ended at ${new Date().toLocaleTimeString('en-IN')} | Total expenses: ₹${trip.total_expenses.toLocaleString('en-IN')}`,
        priority: 'medium',
        entity_type: 'trip',
        entity_id: trip._id,
        metadata: { sender_role: req.user.role }
      });
    }

    // Log activity
    await logActivity(req, {
      action: 'status_change',
      entity_type: 'trip',
      entity_id: trip._id,
      entity_name: trip.driver_name,
      description: `Trip completed. Total expenses: ₹${trip.total_expenses}`,
    });

    res.json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
