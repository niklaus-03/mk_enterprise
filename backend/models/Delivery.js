const mongoose = require('mongoose');

const deliveryItemSchema = new mongoose.Schema({
  item_name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'pcs', trim: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  // Pricing fields — saved with delivery, applied to product on delivery
  weight: { type: Number, default: 0 },           // total weight in kg
  base_price: { type: Number, default: 0 },       // price before charges
  quintal_charge: { type: Number, default: 0 },   // charge per quintal
  supplier_charge_per_item: { type: Number, default: 0 }, // extra charge per item
  gst: { type: Number, default: 0 },              // GST %
  final_price: { type: Number, default: 0 },      // calculated final price (landed cost)
  sell_price: { type: Number, default: 0 },       // explicit selling price from delivery
  margin: { type: Number, default: 0 },           // calculated profit margin from delivery
  final_stock: { type: Number, default: null },   // editable final stock (overrides quantity)
  label: { type: String, default: 'Goods' },      // Goods/Fruits/Vegetables/Hardware
  is_new_item: { type: Boolean, default: false }, // not in DB yet — create on delivery
  is_loose: { type: Boolean, default: false },
  temp_qty_added: { type: Number, default: null }, // qty provisionally added to stock on Mark Arrived
  supplier_name: { type: String, default: '' }, // to track supplier in flattened array
}, { _id: false });

const deliverySupplierSchema = new mongoose.Schema({
  supplier_name: { type: String, required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  items: [deliveryItemSchema],
  cash_given: { type: Number, default: 0 },
  cash_given_note: { type: String, default: '' },
  is_settled: { type: Boolean, default: false } // indicates if this cash_given has been deducted from supplier's balance
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  vehicle_number: { type: String, required: true, trim: true },
  driver_name: { type: String, default: '', trim: true },
  driver_cash: { type: Number, default: 0 },
  driver_expense: { type: Number, default: 0 },
  supplier: { type: String, default: '', trim: true }, // Legacy single supplier
  suppliers_data: [deliverySupplierSchema], // New multi-supplier format
  // Expected arrival stored as full datetime in UTC
  expected_arrival: { type: Date, required: true },
  // IST formatted string for display
  expected_arrival_ist: { type: String, default: '' },
  // IST date only (YYYY-MM-DD) for filtering by day
  arrival_date_ist: { type: String, default: '' },
  items: [deliveryItemSchema],
  status: {
    type: String,
    enum: ['pending', 'arriving_soon', 'on_the_way', 'delivered', 'not_delivered'],
    default: 'pending',
  },
  delivery_type: { 
    type: String, 
    enum: ['vehicle_incoming', 'walkin_delivery', 'outgoing'], 
    default: 'vehicle_incoming' 
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  notes: { type: String, default: '' },
  // When delivered, record actual time
  delivered_at: { type: Date, default: null },
  // Whether stock was already updated on delivery
  stock_updated: { type: Boolean, default: false },
  // Optional explicit grand total from frontend (overrides item sum in ledger)
  grand_total: { type: Number, default: null },
  delivered_at_ist: { type: String, default: '' },
  payment_status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
  paid_at: { type: Date, default: null },
  paid_at_ist: { type: String, default: '' },
  payment_mode: { type: String, default: 'cash' }, // IST formatted delivery time
}, { timestamps: true });

deliverySchema.index({ expected_arrival: 1 });
deliverySchema.index({ arrival_date_ist: 1 });
deliverySchema.index({ status: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);