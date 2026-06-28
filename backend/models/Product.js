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
  profit_margin: { type: Number, default: 0 },     // % profit margin
  is_active: { type: Boolean, default: true },
  // Enhancement 1: per-product low stock threshold (overrides global setting if set)
  custom_low_stock: { type: Number, default: null },
  // Phase 2: Visibility — which managers can see this product
  allowed_managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
  // Track specific stock for each walk-in manager vehicle
  manager_stock: [{
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    stock: { type: Number, default: 0 }
  }],
  created_from_order: { type: Boolean, default: false }, // True if auto-created from New Order
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  last_updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  last_manual_edit_at: { type: Date, default: null },
  // Single-Product Loose Item Tracking
  has_loose: { type: Boolean, default: false },
  loose_stock: { type: Number, default: 0, min: 0 },
  loose_price: { type: Number, default: 0, min: 0 },
  loose_name: { type: String, default: '', trim: true },
  loose_unit: { type: String, default: '', trim: true },
  loose_conversion_factor: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.index({ name: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
