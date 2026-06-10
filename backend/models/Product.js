const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, default: '', trim: true },
  price: { type: Number, required: true, min: 0 },
  supplier_base_price: { type: Number, default: 0 }, // Last incoming base purchase price
  last_delivery_final_price: { type: Number, default: 0 }, // Final price set in recent delivery
  saved_order_qty: { type: Number, default: 0 }, // Persisted order qty for Low Stock Alerts
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
  last_updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  // Bulk-to-Loose linking
  parent_product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  conversion_factor: { type: Number, default: 0 },   // How many of THIS item = 1 parent unit (e.g. 50 for 1kg sugar from 50kg bag)
  is_loose_item: { type: Boolean, default: false },
}, { timestamps: true });

productSchema.index({ name: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
