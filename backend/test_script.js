const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const VehicleTrip = require('./models/VehicleTrip');
const Invoice = require('./models/Invoice');
mongoose.connect('mongodb://localhost:27017/mk_enterprise').then(async () => {
  try {
    const tripId = '6a1d3a243a31696645f329a3';
    const trip = await VehicleTrip.findById(tripId).populate('manager_id', 'username display_name');
    console.log('Manager:', trip.manager_id);
    const invoices = await Invoice.find({
      created_by: trip.manager_id ? trip.manager_id._id : null,
      createdAt: { $gte: trip.started_at },
      status: { $ne: 'cancelled' }
    });
    console.log('Invoices count:', invoices.length);
  } catch(err) {
    console.error('Error:', err);
  }
  process.exit(0);
});
