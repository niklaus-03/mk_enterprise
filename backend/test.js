require('dotenv').config();
const mongoose = require('mongoose');
const TripBypassRequest = require('./models/TripBypassRequest');
const Notification = require('./models/Notification');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB.");

  const requests = await TripBypassRequest.find();
  console.log("Requests:");
  requests.forEach(r => console.log(`- ${r._id}: ${r.manager_name} for ${r.request_type} - status: ${r.status}`));

  const notifs = await Notification.find().sort({createdAt: -1}).limit(5);
  console.log("Notifs:");
  notifs.forEach(n => console.log(`- ${n.type}: ${n.title}`));

  process.exit(0);
}

run();
