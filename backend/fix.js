const mongoose=require('mongoose'); 
const Invoice=require('./models/Invoice'); 

mongoose.connect('mongodb://localhost:27017/mk_enterprise').then(async () => { 
  const invoices = await Invoice.find({ amount_received: { $gt: 0 } }); 
  for(let inv of invoices) { 
    if (inv.amount_received > inv.total) { 
      const overpayment = inv.amount_received - inv.total; 
      inv.amount_received = inv.total; 
      inv.balance_due = 0;
      await inv.save(); 
      const older = await Invoice.find({ customer_id: inv.customer_id, _id: { $ne: inv._id }, balance_due: { $gt: 0 } }).sort({ date: 1 }); 
      let remaining = overpayment; 
      for (let old of older) { 
        if (remaining <= 0) break; 
        const apply = Math.min(remaining, old.balance_due); 
        old.amount_received += apply; 
        old.balance_due = Math.max(0, old.total - old.amount_received); 
        await old.save(); 
        remaining -= apply; 
      } 
    } 
  } 
  console.log('Done!'); 
  process.exit(); 
});
