const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise');
  console.log('Connected to DB');

  const Supplier = mongoose.connection.db.collection('suppliers');

  await Supplier.updateMany(
    { linked_customer_id: { $ne: null } },
    [ { $set: { linked_customer_ids: ['$linked_customer_id'] } } ]
  );
  
  console.log('Migrated');
  process.exit(0);
}
migrate().catch(console.error);
