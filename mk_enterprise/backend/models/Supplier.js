const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

supplierSchema.index({ name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);