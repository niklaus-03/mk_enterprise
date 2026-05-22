const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, required: true },
  type: { type: String, enum: ['incoming', 'outgoing'], required: true },
  qty: { type: Number, required: true },
  // Enhancement 7: support multiple quantity units
  qty_unit: {
    type: String,
    default: 'pcs',
    trim: true
  },
  stock_after: { type: Number, default: 0 },
 vehicle_number: { type: String, default: '' },
  driver_name: { type: String, default: '' },
  invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  invoice_number: { type: String, default: '' },
  driver_name: { type: String, default: '', trim: true },
  supplier: { type: String, default: '', trim: true },
  notes: { type: String, default: '' },
  reference: { type: String, default: '' },
  source: { type: String, enum: ['invoice', 'manual', 'return', 'adjustment'], default: 'manual' },
  date: { type: Date, default: Date.now },
  ist_formatted: { type: String, default: '' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

stockMovementSchema.index({ date: -1 });
stockMovementSchema.index({ product_id: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
