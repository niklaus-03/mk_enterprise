const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const { requireSupervisor } = require('../middleware/auth');

router.use(auth);

// ── Helper: log an activity (used by other routes too) ────────────────────────
async function logActivity(req, { action, entity_type, entity_id, entity_name, description, changes }) {
  try {
    await ActivityLog.create({
      user_id: req.user.id,
      username: req.user.username,
      user_role: req.user.role,
      action,
      entity_type,
      entity_id: entity_id || null,
      entity_name: entity_name || '',
      description: description || '',
      changes: changes || null,
      ip_address: req.ip || req.connection?.remoteAddress || '',
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

// ── GET /api/activity-logs — Admin only, paginated ────────────────────────────
router.get('/', requireSupervisor, async (req, res) => {
  try {
    const { page = 1, limit = 50, user_id, entity_type, action, date, user_role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (user_id) query.user_id = user_id;
    if (entity_type) query.entity_type = entity_type;
    if (action) query.action = action;
    if (user_role) query.user_role = user_role;

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const start = new Date(date + 'T00:00:00.000+05:30');
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      query.timestamp = { $gte: start, $lt: end };
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)),
      ActivityLog.countDocuments(query),
    ]);

    res.json({ logs, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/activity-logs/user/:userId — Activity for a specific user ────────
router.get('/user/:userId', requireSupervisor, async (req, res) => {
  try {
    const { page = 1, limit = 30, date } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { user_id: req.params.userId };

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const start = new Date(date + 'T00:00:00.000+05:30');
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      query.timestamp = { $gte: start, $lt: end };
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)),
      ActivityLog.countDocuments(query),
    ]);

    res.json({ logs, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export the helper for use in other routes
module.exports = router;
module.exports.logActivity = logActivity;
