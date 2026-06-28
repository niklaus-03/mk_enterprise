const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const res = await mongoose.connection.collection('deliveries').updateMany(
    { expected_arrival_ist: /01:11 pm/ },
    { $set: { amount_paid: 500 } }
  );
  console.log(res);
  process.exit(0);
});
