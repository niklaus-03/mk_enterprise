const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // Who performed the action
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  username: { type: String, required: true },
  user_role: { type: String, enum: ['supervisor', 'manager', 'temp_manager', 'walkin_manager', 'driver'], required: true },

  // What action was performed
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'login', 'logout', 'failed_login', 'security_alert', 'payment', 'stock_adjust', 'status_change', 'report_submitted', 'other'],
    required: true,
  },

  // On which entity
  entity_type: {
    type: String,
    enum: ['invoice', 'product', 'customer', 'settlement', 'order', 'delivery', 'trip', 'manager', 'driver', 'Admin', 'setting', 'walkin', 'stock', 'daily_report', 'other'],
    required: true,
  },
  entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  entity_name: { type: String, default: '' }, // human-readable label (e.g., "INV-00012", "Cement 50kg")

  // What changed (for updates)
  description: { type: String, default: '' }, // e.g., "Updated price from ₹500 to ₹550"
  changes: { type: mongoose.Schema.Types.Mixed, default: null }, // { field: { old: x, new: y } }

  // Metadata
  ip_address: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, expires: '30d' }, // Auto-deletes 30 days after this date
}, { timestamps: true });

activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ user_id: 1, timestamp: -1 });
activityLogSchema.index({ entity_type: 1, timestamp: -1 });

activityLogSchema.post('save', function(doc) {
  if (global.io) {
    global.io.to('role:supervisor').emit('new_activity_log', doc);
  }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
