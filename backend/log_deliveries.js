const mongoose = require('mongoose');
const Delivery = require('./models/Delivery');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise_db');
  const ds = await Delivery.find().sort({ _id: -1 }).limit(10);
  console.log('Last 10 Deliveries:');
  for (let d of ds) {
    console.log(d._id, 'Supplier:', d.supplier, 'suppliers_data len:', d.suppliers_data?.length || 0);
  }
  mongoose.disconnect();
}
run();
