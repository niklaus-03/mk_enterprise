const mongoose = require('mongoose');

const cargoSchema = new mongoose.Schema({
  invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  amount_to_collect: { type: Number, default: 0 },
  owner_name: { type: String, default: '' },
  owner_phone: { type: String, default: '' },
  goods_types: [{ type: String }], // Legacy fallback
  description: { type: String, default: '' },
  weight: { type: Number, default: 0 }, // kg/tons
  status: { type: String, enum: ['pending', 'delivered'], default: 'pending' },
  items: [{
    name: { type: String },
    quantity: { type: Number },
    weight: { type: Number }
  }]
}, { _id: false });

// Timeline entry (start, expense, reached, loading, returning, end)
const timelineEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['trip_start', 'expense', 'reached_destination', 'loading', 'returning', 'trip_end', 'note'],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  // For expenses
  expense_type: { type: String, default: '' }, // fuel, toll, challan, service, food, other
  expense_amount: { type: Number, default: 0 },
  expense_note: { type: String, default: '' },
  // For destination/loading events
  location: { type: String, default: '' },
  note: { type: String, default: '' },
  // Return leg cargo
  return_cargo: [cargoSchema],
}, { timestamps: true });

// Leg of a trip (outbound, return, etc.)
const tripLegSchema = new mongoose.Schema({
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  cargo: [cargoSchema],
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
}, { timestamps: true });

const tripSchema = new mongoose.Schema({
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  driver_name: { type: String, default: '' },
  vehicle_number: { type: String, required: true },
  invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  transport_invoice_number: { type: String, unique: true, sparse: true },
  type: { type: String, enum: ['short', 'long'], required: true },
  amount_to_collect: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },

  // Route legs
  legs: [tripLegSchema],

  // Flat timeline of all events (start, expenses, reaching, etc.)
  timeline: [timelineEntrySchema],

  // Totals (auto-calculated)
  total_expenses: { type: Number, default: 0 },

  // Edit history
  edit_history: [{
    edited_at: { type: Date, default: Date.now },
    edited_field: { type: String, default: '' },
    old_value: { type: String, default: '' },
    new_value: { type: String, default: '' },
  }],

  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
}, { timestamps: true });

// Auto-calculate total expenses and generate transport_invoice_number before saving
tripSchema.pre('save', async function (next) {
  this.total_expenses = this.timeline
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.expense_amount || 0), 0);
    
  if (this.vehicle_number) {
    this.vehicle_number = this.vehicle_number.toUpperCase();
  }

  if (this.isNew && !this.transport_invoice_number && this.vehicle_number) {
    try {
      const vnum = this.vehicle_number.replace(/\s+/g, '');
      const last4 = vnum.length >= 4 ? vnum.slice(-4) : vnum.padStart(4, '0');
      
      const count = await mongoose.model('Trip').countDocuments();
      const sequence = count + 1;
      this.transport_invoice_number = `${last4}INV-${String(sequence).padStart(5, '0')}`;
    } catch (err) {
      console.error('Error generating transport invoice number:', err);
    }
  }

  next();
});

tripSchema.index({ driver_id: 1, status: 1 });
tripSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Trip', tripSchema);
