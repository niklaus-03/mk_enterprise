const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name: { type: String, required: true },
  qty: { type: Number, required: true, min: 0 },
  weight: { type: Number, default: 0 },
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
  total_weight: { type: Number, default: 0 },
  // Enhancement 3: manual bill entry
  is_manual_bill: { type: Boolean, default: false },
  manual_bill_ref: { type: String, default: '' },
  status: { type: String, enum: ['active', 'edited', 'partially_returned', 'cancelled'], default: 'active' },
  gst_enabled: { type: Boolean, default: true },
  discount_enabled: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  ist_formatted: { type: String, default: '' },
  signature: { type: String, default: '' },
  company_details: { type: mongoose.Schema.Types.Mixed, default: null }, // Snapshot of business settings at time of creation
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  shared_with: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
}, { timestamps: true });

invoiceSchema.pre('save', async function (next) {
  if (!this.invoice_number) {
    try {
      const Admin = mongoose.model('Admin');
      let levelDigit = 1; // default for supervisor

      if (this.created_by) {
        const creator = await Admin.findById(this.created_by);
        if (creator) {
          if (creator.role === 'supervisor') {
            levelDigit = 1;
          } else if (creator.role === 'manager') {
            // Find sequential index among all active managers sorted by creation date
            const allManagers = await Admin.find(
              { role: 'manager', is_active: true },
              { _id: 1 }
            ).sort({ createdAt: 1 });
            const managerIndex = allManagers.findIndex(
              m => m._id.toString() === creator._id.toString()
            );
            // First manager = 3, second = 4, etc.
            levelDigit = 3 + Math.max(0, managerIndex);
          }
        }
      }

      // Count existing invoices with the same level digit prefix
      const prefix = levelDigit.toString();
      const InvoiceModel = mongoose.model('Invoice');
      const count = await InvoiceModel.countDocuments({
        invoice_number: { $regex: `^${prefix}` },
      });

      // Format as 6-digit: e.g. 100001, 300001, 400002
      const sequence = count + 1;
      this.invoice_number = `${prefix}${String(sequence).padStart(5, '0')}`;
    } catch (err) {
      // Fallback: global count-based
      const count = await mongoose.model('Invoice').countDocuments();
      this.invoice_number = `1${String(count + 1).padStart(5, '0')}`;
    }
  }
  next();
});

invoiceSchema.index({ date: -1 });
invoiceSchema.index({ customer_id: 1, date: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
