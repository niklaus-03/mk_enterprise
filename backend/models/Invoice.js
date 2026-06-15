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
  is_loose: { type: Boolean, default: false },
});

const paymentSchema = new mongoose.Schema({
  mode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'advance_credit', 'online', 'others', 'goods_exchange'], required: true },
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
  // Timeline feature
  ledger_payments: [{
    amount: { type: Number, default: 0 },
    date: { type: Date },
    ist_formatted: { type: String, default: '' },
    mode: { type: String, default: '' }
  }],
  starting_balance: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  concession_reason: { type: String, default: '' },
  qr_for_current_bill: { type: Boolean, default: false },
  // Enhancement 2: driver & vehicle details on invoice
  driver_name: { type: String, default: '' },
  vehicle_number: { type: String, default: '' },
  total_weight: { type: Number, default: 0 },
  // Enhancement 3: manual bill entry
  is_manual_bill: { type: Boolean, default: false },
  manual_bill_ref: { type: String, default: '' },
  is_report: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'edited', 'partially_returned', 'cancelled', 'consolidated'], default: 'active' },
  // Khata/Ledger fields
  is_ledger_entry: { type: Boolean, default: false },
  consolidated_into: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  source_entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],
  gst_enabled: { type: Boolean, default: true },
  discount_enabled: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  ist_formatted: { type: String, default: '' },
  signature: { type: String, default: '' },
  company_details: { type: mongoose.Schema.Types.Mixed, default: null }, // Snapshot of business settings at time of creation
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  actual_creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  shared_with: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
}, { timestamps: true });

invoiceSchema.pre('save', async function (next) {
  if (!this.invoice_number) {
    try {
      const Admin = mongoose.model('Admin');
      let prefix = 'INV-';

      if (this.is_ledger_entry) {
        prefix = 'CH-';
      } else if (this.created_by) {
        const creator = await Admin.findById(this.created_by);
        if (creator) {
          if (creator.role === 'supervisor') {
            prefix = 'INV-';
          } else if (creator.role === 'manager') {
            const nameToUse = creator.display_name || creator.username || 'M';
            const initials = nameToUse.split(' ').filter(n => n).map(n => n.charAt(0).toUpperCase()).join('');
            prefix = `${initials}INV-`;
          }
        }
      }

      if (this.is_report) {
        prefix = `REPORT${prefix}`;
      }

      // Find the latest invoice with the same prefix
      const InvoiceModel = mongoose.model('Invoice');
      const lastInvoice = await InvoiceModel.findOne({
        invoice_number: { $regex: `^${prefix}` }
      }).collation({ locale: "en_US", numericOrdering: true }).sort({ invoice_number: -1 });

      let sequence = 1;
      if (lastInvoice && lastInvoice.invoice_number) {
        const match = lastInvoice.invoice_number.match(/\d+$/);
        if (match) {
          sequence = parseInt(match[0], 10) + 1;
        } else {
          sequence = (await InvoiceModel.countDocuments({ invoice_number: { $regex: `^${prefix}` } })) + 1;
        }
      } else {
        sequence = (await InvoiceModel.countDocuments({ invoice_number: { $regex: `^${prefix}` } })) + 1;
      }

      this.invoice_number = `${prefix}${String(sequence).padStart(6, '0')}`;
    } catch (err) {
      // Fallback: global count-based
      const lastInvoice = await mongoose.model('Invoice').findOne().collation({ locale: "en_US", numericOrdering: true }).sort({ invoice_number: -1 });
      let sequence = 1;
      if (lastInvoice && lastInvoice.invoice_number) {
         const match = lastInvoice.invoice_number.match(/\d+$/);
         if (match) sequence = parseInt(match[0], 10) + 1;
         else sequence = (await mongoose.model('Invoice').countDocuments()) + 1;
      }
      this.invoice_number = `INV-${String(sequence).padStart(6, '0')}`;
    }
  }
  next();
});

invoiceSchema.index({ date: -1 });
invoiceSchema.index({ customer_id: 1, date: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
