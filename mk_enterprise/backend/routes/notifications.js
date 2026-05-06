const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { requireSupervisor } = require('../middleware/auth');

router.use(auth);

// ── Helper: create a notification (used by other routes) ──────────────────────
async function createNotification({ sender_id, sender_name, recipient_id, recipient_role, type, title, message, priority, entity_type, entity_id }) {
  try {
    return await Notification.create({
      sender_id: sender_id || null,
      sender_name: sender_name || 'System',
      recipient_id: recipient_id || null,
      recipient_role: recipient_role || 'supervisor',
      type,
      title,
      message: message || '',
      priority: priority || 'medium',
      entity_type: entity_type || '',
      entity_id: entity_id || null,
    });
  } catch (err) {
    console.error('Notification error:', err.message);
    return null;
  }
}

// ── GET /api/notifications — Get notifications for current user ───────────────
router.get('/', async (req, res) => {
  try {
    const { unread_only, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      $or: [
        { recipient_id: req.user.id },
        { recipient_role: req.user.role },
        { recipient_role: 'all' },
      ],
    };

    if (unread_only === 'true') {
      query.is_read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, is_read: false }),
    ]);

    res.json({ notifications, total, unreadCount, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/notifications/unread-count — Quick count for bell badge ──────────
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      $or: [
        { recipient_id: req.user.id },
        { recipient_role: req.user.role },
        { recipient_role: 'all' },
      ],
      is_read: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications — Create a notification (managers/drivers send alerts) ─
router.post('/', async (req, res) => {
  try {
    const { type, title, message, priority, recipient_role, entity_type, entity_id } = req.body;
    if (!type || !title) {
      return res.status(400).json({ error: 'type and title are required' });
    }

    const notification = await createNotification({
      sender_id: req.user.id,
      sender_name: req.user.username,
      recipient_role: recipient_role || 'supervisor',
      type,
      title,
      message,
      priority,
      entity_type,
      entity_id,
    });

    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/notifications/:id/read — Mark as read ────────────────────────────
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { is_read: true, read_at: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/notifications/read-all — Mark all as read ────────────────────────
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      {
        $or: [
          { recipient_id: req.user.id },
          { recipient_role: req.user.role },
          { recipient_role: 'all' },
        ],
        is_read: false,
      },
      { is_read: true, read_at: new Date() }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export helper for use in other routes
router.createNotification = createNotification;

module.exports = router;
