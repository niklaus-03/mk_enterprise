const mongoose = require('mongoose');

const productListSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  shares: [{
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    overrides: [{
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      is_excluded: { type: Boolean, default: false },
      custom_price: { type: Number, default: null }, // null means use original price
      custom_stock: { type: Number, default: null }  // null means use original stock
    }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('ProductList', productListSchema);
