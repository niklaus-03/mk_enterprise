const mongoose = require('mongoose');

// Individual cargo entry
const cargoSchema = new mongoose.Schema({
  owner_name: { type: String, default: '' },
  owner_phone: { type: String, default: '' },
  goods_types: [{ type: String }], // Legacy fallback
  description: { type: String, default: '' },
  weight: { type: Number, default: 0 }, // kg/tons
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
  type: { type: String, enum: ['short', 'long'], required: true },
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

// Auto-calculate total expenses before saving
tripSchema.pre('save', function (next) {
  this.total_expenses = this.timeline
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.expense_amount || 0), 0);
  next();
});

tripSchema.index({ driver_id: 1, status: 1 });
tripSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Trip', tripSchema);
