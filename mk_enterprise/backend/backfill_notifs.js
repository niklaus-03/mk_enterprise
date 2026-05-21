const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise')
  .then(async () => {
    const Notification = require('./models/Notification');
    const Trip = require('./models/Trip');

    const notifs = await Notification.find({ type: { $in: ['trip_started', 'trip_completed', 'general'] }, entity_id: null });
    console.log(`Found ${notifs.length} old trip notifications.`);
    let updatedCount = 0;

    for (const notif of notifs) {
      if (!notif.sender_name) continue;
      
      const vehicleNumberMatch = notif.sender_name.match(/^([a-zA-Z0-9]+)\s*-/);
      if (vehicleNumberMatch) {
        const vehicleNumber = vehicleNumberMatch[1];
        const approxTime = new Date(notif.timestamp);

        // Find a trip by this vehicle near this time
        let trip;
        if (notif.type === 'trip_completed') {
            trip = await Trip.findOne({ 
                vehicle_number: vehicleNumber,
                completed_at: { $lte: new Date(approxTime.getTime() + 60000), $gte: new Date(approxTime.getTime() - 60000) }
            });
        } else {
            trip = await Trip.findOne({
                vehicle_number: vehicleNumber,
                createdAt: { $lte: new Date(approxTime.getTime() + 600000), $gte: new Date(approxTime.getTime() - 600000) }
            });
        }
        
        if (!trip) {
            // fallback: just find the most recent trip for this vehicle
            trip = await Trip.findOne({ vehicle_number: vehicleNumber }).sort({createdAt: -1});
        }

        if (trip) {
          notif.entity_type = 'trip';
          notif.entity_id = trip._id;
          await notif.save();
          updatedCount++;
        }
      }
    }
    console.log(`Updated ${updatedCount} notifications with entity_id.`);
    process.exit(0);
  });
