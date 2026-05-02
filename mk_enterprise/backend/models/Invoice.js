const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name: { type: String, required: true },
  qty: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  gst: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  returned_qty: { type: Number, default: 0 },
  is_defective: { type: Boolean, default: false },
  adjustment: { type: Number, default: 0 },
  return_reason: { type: String, default: '' },
});

const paymentSchema = new mongoose.Schema({
  mode: { type: String, enum: ['cash', 'upi', 'online', 'others'], required: true },
  amount: { type: Number, required: true, min: 0 },
  reference: { type: String, default: '' },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoice_number: { type: String, unique: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customer_name: { type: String, default: 'Walk-in Customer' },
  customer_phone: { type: String, default: '' },
  customer_address: { type: String, default: '' },
  previous_balance: { type: Number, default: 0 },
  items: [invoiceItemSchema],
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  gst_total: { type: Number, default: 0 },
  vehicle_charge: { type: Number, default: 0 },
  labour_charge: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  total_with_prev_balance: { type: Number, default: 0 },
  payments: [paymentSchema],
  amount_received: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  concession_reason: { type: String, default: '' },
  // Enhancement 2: driver & vehicle details on invoice
  driver_name: { type: String, default: '' },
  vehicle_number: { type: String, default: '' },
  // Enhancement 3: manual bill entry
  is_manual_bill: { type: Boolean, default: false },
  manual_bill_ref: { type: String, default: '' },
  status: { type: String, enum: ['active', 'edited', 'partially_returned', 'cancelled'], default: 'active' },
  gst_enabled: { type: Boolean, default: true },
  discount_enabled: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  ist_formatted: { type: String, default: '' },
  signature: { type: String, default: '' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

invoiceSchema.pre('save', async function (next) {
  if (!this.invoice_number) {
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoice_number = `INV-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

invoiceSchema.index({ date: -1 });
invoiceSchema.index({ customer_id: 1, date: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
