require('mongoose').connect('mongodb://localhost:27017/mk_enterprise').then(async () => { 
  const ActivityLog = require('./models/ActivityLog'); 
  await ActivityLog.updateMany({ description: /Extra Items: undefined/ }, { $set: { description: 'Report sent. Cash in drawer left: ₹200 (Expected: ₹-55,000).\n\nExtra Items:\n• [PAYMENT OUT] BTC (₹50000)\n• [EXPENSE] dl - chai (₹5000)' } }); 
  console.log('Updated logs'); 
  process.exit(); 
}).catch(console.error);
