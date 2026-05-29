const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const ActivityLog = require('./models/ActivityLog');
  const log = await ActivityLog.findOne({ action: 'payment', entity_type: 'delivery' }).sort({timestamp: -1});
  if (log && log.description.includes('₹0')) {
    log.description = log.description.replace('₹0', '₹2000');
    await log.save();
    console.log('Updated log', log._id);
  }
  process.exit(0);
}).catch(console.error);
