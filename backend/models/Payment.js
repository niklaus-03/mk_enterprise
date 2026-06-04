const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  previous_balance: { type: Number, required: true },
  new_balance: { type: Number, required: true },
  mode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'other'], default: 'cash' },
  reference: { type: String, default: '' },
  notes: { type: String, default: '' },
  collected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  date: { type: Date, default: Date.now },
  ist_date: { type: String, default: '' },        // YYYY-MM-DD IST
  ist_formatted: { type: String, default: '' },    // human readable IST datetime
}, { timestamps: true });

paymentSchema.index({ customer_id: 1 });
paymentSchema.index({ date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
