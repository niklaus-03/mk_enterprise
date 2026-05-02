const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  balance: { type: Number, default: 0 }, // positive = owes us, negative = advance
  gstin: { type: String, default: '', trim: true },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

customerSchema.index({ name: 1 });

module.exports = mongoose.model('Customer', customerSchema);
