const mongoose = require('mongoose');
require('dotenv').config();

const Customer = require('./models/Customer');
const Invoice = require('./models/Invoice');

async function fixRohan() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mk_enterprise');
  const rohan = await Customer.findOne({ phone: '9569466846' });
  if (!rohan) return console.log('Rohan not found');

  const unpaid = await Invoice.find({ customer_id: rohan._id, balance_due: { $gt: 0 }, status: { $ne: 'cancelled' } });
  const totalDue = unpaid.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
  
  console.log(`Rohan true due is: ${totalDue}`);
  
  rohan.balance = totalDue;
  rohan.manager_balances = [];
  
  for (let inv of unpaid) {
    if (inv.created_by) {
      const entry = rohan.manager_balances.find(mb => mb.manager_id.toString() === inv.created_by.toString());
      if (entry) {
        entry.balance += (inv.balance_due || 0);
      } else {
        rohan.manager_balances.push({ manager_id: inv.created_by, balance: (inv.balance_due || 0) });
      }
    }
  }
  
  await rohan.save();
  console.log('Fixed Rohan balances!');
  process.exit(0);
}

fixRohan();
