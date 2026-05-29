const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  manager_name: { type: String, required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  opening_balance: { type: Number, required: true, default: 0 },
  system_sales_reported: { type: Number, default: 0 },
  system_money_received: { type: Number, default: 0 },
  system_debt_reported: { type: Number, default: 0 },
  system_cash_reported: { type: Number, required: true, default: 0 },
  actual_cash_reported: { type: Number, required: true, default: 0 },
  system_bills_reported: { type: Number, required: true, default: 0 },
  system_deliveries_reported: { type: Number, required: true, default: 0 },
  system_expenses_reported: { type: Number, default: 0 },
  discrepancy_notes: { type: String, default: '' },
  quick_entries: [{
    type: { type: String, enum: ['bill', 'payment_in', 'payment_out', 'expense'] },
    customer_name: { type: String },
    supplier_name: { type: String },
    expense_for: { type: String },
    product_name: { type: String },
    quantity: { type: Number },
    amount: { type: Number },
    notes: { type: String },
  }],
  total_quick_entries: { type: Number, default: 0 },
  status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  reviewed_at: { type: Date, default: null },
}, { timestamps: true });

dailyReportSchema.index({ manager_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
