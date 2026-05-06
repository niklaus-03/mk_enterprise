const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');

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
    const { status, type, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Drivers only see their own trips
    if (req.user.role === 'driver') {
      query.driver_id = req.user.id;
    }

    if (status) query.status = status;
    if (type) query.type = type;

    const [trips, total] = await Promise.all([
      Trip.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
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
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/trips — Start a new trip ───────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, origin, destination, cargo } = req.body;
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

    // Notify all supervisors
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        user_id: sup._id,
        type: 'system',
        title: `🚛 Trip Started — ${driver?.display_name || req.user.username}`,
        message: `${type.toUpperCase()} trip: ${origin} → ${destination}`,
        priority: 'normal',
      });
    }

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

    // Notify supervisors about expense
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        user_id: sup._id,
        type: 'system',
        title: `💰 ${expense_type.toUpperCase()} — ₹${parseFloat(expense_amount).toLocaleString('en-IN')}`,
        message: `Driver ${trip.driver_name} (${trip.vehicle_number}): ${expense_note || expense_type}`,
        priority: 'normal',
      });
    }

    res.json({ success: true, total_expenses: trip.total_expenses, trip });
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

    // Notify supervisors about trip completion
    const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
    for (const sup of supervisors) {
      await Notification.create({
        user_id: sup._id,
        type: 'system',
        title: `🏁 Trip Completed — ${trip.driver_name}`,
        message: `Total expenses: ₹${trip.total_expenses.toLocaleString('en-IN')}`,
        priority: 'normal',
      });
    }

    res.json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
