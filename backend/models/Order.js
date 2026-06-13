const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name: { type: String, required: true },
  qty: { type: Number, required: true, min: 0 },
  price: { type: Number, default: 0 },
  is_loose: { type: Boolean, default: false },
});

const orderSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name: { type: String, required: true },
  customer_phone: { type: String, required: true },

  items: [orderItemSchema],

  delivery_date: { type: Date, required: true },
  delivery_date_ist: { type: String },   // 🔥 same as deliveries

  advance_paid: { type: Number, default: 0 },
  advance_mode: { type: String, default: 'cash' },
  notes: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);