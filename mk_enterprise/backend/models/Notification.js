const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who should receive this notification
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }, // null = admin/broadcast
  recipient_role: { type: String, enum: ['supervisor', 'manager', 'driver', 'all'], default: 'supervisor' },

  // Who sent it
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  sender_name: { type: String, default: 'System' },

  // Notification content
  type: {
    type: String,
    enum: [
      'vehicle_incoming',    // Stock arrival
      'invoice_approval',    // Invoice needs admin review
      'low_stock',           // Low stock alert from manager
      'order_placed',        // New order created
      'password_reset',      // Password reset request
      'due_cleared',         // Customer due payment cleared
      'customer_info',       // Customer info fetch request
      'price_review',        // Product price review request
      'driver_cash_request', // Driver requesting cash for trip
      'driver_cash_given',   // Cash given to driver
      'trip_started',        // Driver started a trip
      'trip_completed',      // Driver completed a trip
      'trip_progress',       // Driver reached destination or started next leg
      'expense',             // Trip expense logged
      'driver_dispatch',     // Invoice dispatched to driver for delivery
      'dispatch_assigned',   // Dispatch assigned to driver
      'invoice_shared',      // Invoice shared with a manager
      'batch_dispatch',      // Batch of invoices dispatched to driver
      'trip_update',         // General trip update
      'system_alert',        // General system alerts
      'general',             // Generic notification
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  
  // Visual properties
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  
  // Reference to related entity
  entity_type: { type: String, default: '' },
  entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Status
  is_read: { type: Boolean, default: false },
  read_at: { type: Date, default: null },

  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

notificationSchema.index({ recipient_role: 1, is_read: 1, timestamp: -1 });
notificationSchema.index({ recipient_id: 1, is_read: 1, timestamp: -1 });

notificationSchema.post('save', function(doc) {
  if (global.io) {
    if (doc.recipient_id) {
      global.io.to(doc.recipient_id.toString()).emit('new_notification', doc);
    } else {
      global.io.to(`role:${doc.recipient_role}`).emit('new_notification', doc);
    }
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
