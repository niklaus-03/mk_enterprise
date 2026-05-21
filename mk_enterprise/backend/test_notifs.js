const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise')
  .then(async () => {
    const Notification = require('./models/Notification');
    const notifs = await Notification.find({ type: { $in: ['trip_started', 'trip_completed', 'general'] } }).sort({createdAt: -1}).limit(5);
    console.log(JSON.stringify(notifs, null, 2));
    process.exit(0);
  });
