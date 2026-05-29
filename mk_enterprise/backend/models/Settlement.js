const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  ist_date: { type: String, default: '' },       // YYYY-MM-DD IST
  ist_formatted: { type: String, default: '' },
  type: { type: String, enum: ['paid_to_supplier', 'other_expense', 'other_income', 'walkin_delivery', 'vehicle_expense', 'by_invoice', 'due_cleared', 'advance_received', 'received_from_customer'], required: true },
  party_name: { type: String, default: '', trim: true }, // supplier/company name
  amount: { type: Number, required: true, min: 0 },
  mode: { type: String, enum: ['cash', 'upi', 'online', 'others', 'bank_transfer', 'cheque', 'advance_credit', 'goods_exchange'], default: 'cash' },
  received_category: { type: String, enum: ['today_invoice', 'due_cleared', 'advance_payment', 'not_applicable', 'others'], default: 'not_applicable' },
  reference: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

settlementSchema.index({ date: -1 });
settlementSchema.index({ ist_date: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);