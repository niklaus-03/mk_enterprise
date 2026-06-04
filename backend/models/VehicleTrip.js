const mongoose = require('mongoose');

const vehicleTripSchema = new mongoose.Schema({
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  vehicle_number: { type: String, required: true },
  driver_name: { type: String, required: true },
  destination: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  allow_reload: { type: Boolean, default: false },
  load_count: { type: Number, default: 0 },          // how many times products have been loaded (max 5)
  vehicle_update_count: { type: Number, default: 0 }, // how many times vehicle details have been edited (max 5)
  trip_started: { type: Boolean, default: false },     // true once manager hits "Start Trip" — locks editing
  initial_stock: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    product_name: String,
    quantity: Number,
    price: Number,
    amount: Number
  }],
  final_stock: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number
  }],
  total_sales_amount: { type: Number, default: 0 },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null }
}, { timestamps: true });

vehicleTripSchema.index({ manager_id: 1, status: 1 });

module.exports = mongoose.model('VehicleTrip', vehicleTripSchema);
