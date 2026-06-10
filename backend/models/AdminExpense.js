const mongoose = require('mongoose');

const adminExpenseItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name: { type: String, required: true },
  qty: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'pcs' },
  price: { type: Number, default: 0 },  // Value at the time of taking
}, { _id: false });

const adminExpenseSchema = new mongoose.Schema({
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  type: { type: String, enum: ['item_taken', 'cash_taken', 'expense'], required: true },
  items: [adminExpenseItemSchema],           // Only for type='item_taken'
  amount: { type: Number, default: 0 },       // Cash amount (for cash_taken/expense) or total item value
  category: { type: String, default: 'other', trim: true },  // petrol, food, personal, other
  description: { type: String, default: '', trim: true },
  date: { type: Date, default: Date.now },
  ist_formatted: { type: String, default: '' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

adminExpenseSchema.index({ date: -1 });
adminExpenseSchema.index({ admin_id: 1, date: -1 });
adminExpenseSchema.index({ type: 1 });

module.exports = mongoose.model('AdminExpense', adminExpenseSchema);
