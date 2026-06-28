const mongoose = require('mongoose');

async function unmerge() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise');
  console.log('Connected to DB');

  const Customer = mongoose.connection.db.collection('customers');
  const Invoice = mongoose.connection.db.collection('invoices');
  const Payment = mongoose.connection.db.collection('payments');

  const primary = await Customer.findOne({ name: /jaggu/i });
  if (!primary) {
    console.log('No Jaggu found');
    process.exit(0);
  }

  const primaryId = primary._id;
  console.log('Primary Jaggu:', primaryId);

  const invoices = await Invoice.find({ customer_id: primaryId }).toArray();
  const payments = await Payment.find({ customer_id: primaryId }).toArray();

  const creators = new Set();
  invoices.forEach(i => creators.add(i.created_by?.toString()));
  payments.forEach(p => creators.add(p.created_by?.toString()));
  creators.delete(undefined);
  creators.delete('undefined');
  creators.delete(null);

  console.log('Creators found:', Array.from(creators));

  if (creators.size <= 1) {
    console.log('Nothing to unmerge (1 or 0 creators).');
    process.exit(0);
  }

  const creatorArray = Array.from(creators);
  const primaryCreator = primary.created_by?.toString() || creatorArray[0];

  await Customer.updateOne({ _id: primaryId }, {
    $set: { 
      allowed_managers: [new mongoose.Types.ObjectId(primaryCreator)],
      manager_balances: primary.manager_balances ? primary.manager_balances.filter(mb => mb.manager_id.toString() === primaryCreator) : []
    }
  });

  for (const creatorId of creatorArray) {
    if (creatorId === primaryCreator) continue;
    console.log('Creating new customer for creator:', creatorId);
    
    const newCustomer = {
      ...primary,
      _id: new mongoose.Types.ObjectId(),
      created_by: new mongoose.Types.ObjectId(creatorId),
      allowed_managers: [new mongoose.Types.ObjectId(creatorId)],
      manager_balances: primary.manager_balances ? primary.manager_balances.filter(mb => mb.manager_id.toString() === creatorId) : [],
      balance: 0,
    };
    
    await Customer.insertOne(newCustomer);
    const newId = newCustomer._id;

    await Invoice.updateMany(
      { customer_id: primaryId, created_by: new mongoose.Types.ObjectId(creatorId) },
      { $set: { customer_id: newId } }
    );
    await Payment.updateMany(
      { customer_id: primaryId, created_by: new mongoose.Types.ObjectId(creatorId) },
      { $set: { customer_id: newId } }
    );
  }
  console.log('Unmerge complete.');
  process.exit(0);
}
unmerge().catch(console.error);
