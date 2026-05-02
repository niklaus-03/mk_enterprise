const mongoose = require('mongoose');

const passwordResetRequestSchema = new mongoose.Schema({
  identifier: { type: String, required: true, trim: true }, // username or phone submitted
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  username: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'resolved'],
    default: 'pending',
  },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolved_at: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
