const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, default: 0, min: 0 },
  gst: { type: Number, required: true, default: 0, min: 0, max: 100 },
  unit: { type: String, default: 'pcs', trim: true },
  weight_per_unit: { type: Number, default: 0 },   // kg per unit (e.g. 1 bag = 50 kg)
  suggested_price: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  // Enhancement 1: per-product low stock threshold (overrides global setting if set)
  custom_low_stock: { type: Number, default: null },
  // Phase 2: Visibility — which managers can see this product
  allowed_managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

productSchema.index({ name: 1 });
productSchema.index({ name: 'text' });

module.exports = mongoose.model('Product', productSchema);
