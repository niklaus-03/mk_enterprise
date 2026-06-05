const mongoose = require('mongoose');
const Customer = require('./backend/models/Customer');
require('dotenv').config({ path: './backend/.env' });

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mk_enterprise')
  .then(async () => {
    const customers = await Customer.find({});
    let count = 0;
    for (const c of customers) {
      if (c.created_by && c.manager_balances && c.manager_balances.length === 1) {
        const mb = c.manager_balances[0];
        if (mb.manager_id.toString() !== c.created_by.toString()) {
            console.log(`Fixing customer ${c.name}: changing manager_id from ${mb.manager_id} to ${c.created_by}`);
            mb.manager_id = c.created_by;
            await c.save();
            count++;
        }
      }
    }
    console.log(`Done. Fixed ${count} customers.`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
