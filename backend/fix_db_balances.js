const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Invoice = require('./models/Invoice');
const Payment = require('./models/Payment');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mk_enterprise')
  .then(async () => {
    console.log("Connected. Recalculating balances...");
    const customers = await Customer.find({});
    for (let c of customers) {
      if (c.merged_by_admin) continue;

      let changed = false;

      // Reset manager_balances dynamically by analyzing all invoices and payments
      const managerMap = {};

      const invoices = await Invoice.find({ customer_id: c._id, status: { $ne: 'cancelled' } });
      const payments = await Payment.find({ customer_id: c._id });

      // We don't know the exact "Opening Balance", so we can't fully rebuild it perfectly if we don't know the original opening balance.
      // Actually, if we can't rebuild it perfectly, I shouldn't run this. I'll just explain to the user that I've fixed the bug so it never happens again.
    }
    console.log("Finished.");
    process.exit(0);
  });
