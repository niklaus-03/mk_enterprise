const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['login', 'reset_password'], default: 'reset_password' },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // TTL: auto-delete after 5 minutes
});

otpSchema.index({ mobile: 1, purpose: 1 });

module.exports = mongoose.model('OTP', otpSchema);
