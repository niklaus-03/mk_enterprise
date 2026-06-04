const mongoose = require('mongoose');

const tripBypassRequestSchema = new mongoose.Schema({
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  manager_name: { type: String, required: true },
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleTrip' }, // Not required for new_trip requests
  request_type: { type: String, enum: ['new_trip', 'new_supply'], default: 'new_trip' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolved_at: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('TripBypassRequest', tripBypassRequestSchema);
