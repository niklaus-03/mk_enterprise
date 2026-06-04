const mongoose = require('mongoose');

const customerListSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  customers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  shares: [{
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    overrides: [{
      customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
      is_excluded: { type: Boolean, default: false },
      custom_balance: { type: Number, default: null }, // null means use original balance
      custom_name: { type: String, default: '' },      // empty means use original name
      custom_phone: { type: String, default: '' }      // empty means use original phone
    }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('CustomerList', customerListSchema);
