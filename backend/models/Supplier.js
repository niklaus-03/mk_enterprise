const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true }, // Legacy
  contact_numbers: [{
    note: { type: String, trim: true },
    number: { type: String, trim: true }
  }],
  address: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  balance: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  linked_customer_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  assigned_managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
}, { timestamps: true });

supplierSchema.index({ name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);