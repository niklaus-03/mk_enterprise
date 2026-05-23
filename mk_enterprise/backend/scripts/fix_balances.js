const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  console.log('Connected to MongoDB');
  const invs = await Invoice.find();
  console.log(`Found ${invs.length} invoices`);
  
  let changed = 0;
  for(let i of invs) {
    let total = parseFloat(i.total) || 0;
    let received = parseFloat(i.amount_received) || 0;
    let correct_due = Math.max(0, total - received);
    
    if(Math.abs(correct_due - (i.balance_due || 0)) > 0.01) {
      console.log(`Fixing ${i.invoice_number} | Old due: ${i.balance_due} | New due: ${correct_due}`);
      i.balance_due = correct_due;
      await i.save();
      changed++;
    }
  }
  
  console.log(`Fixed ${changed} invoices.`);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
