const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const d = await mongoose.connection.collection('deliveries').updateMany({ expected_arrival_ist: /01:12 pm/ }, { $set: { status: 'delivered', stock_updated: true } });
  console.log(d);
  process.exit(0);
});
