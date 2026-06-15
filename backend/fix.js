const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const db = mongoose.connection.db;
  const result = await db.collection('invoices').updateMany(
    { invoice_number: { $in: ['INV-000133', 'INV-000134', 'INV-000135', 'INV-000136', 'INV-000137'] } },
    { $set: { is_ledger_entry: true } }
  );
  
  // also change invoice_number to CH-
  for (let i = 133; i <= 137; i++) {
    await db.collection('invoices').updateOne(
      { invoice_number: `INV-00013${i - 130}` }, // Wait, I'll just write them out explicitly
      { $set: { is_ledger_entry: true } }
    );
  }

  await db.collection('invoices').updateOne({ invoice_number: 'INV-000133' }, { $set: { invoice_number: 'CH-000001', is_ledger_entry: true } });
  await db.collection('invoices').updateOne({ invoice_number: 'INV-000134' }, { $set: { invoice_number: 'CH-000002', is_ledger_entry: true } });
  await db.collection('invoices').updateOne({ invoice_number: 'INV-000135' }, { $set: { invoice_number: 'CH-000003', is_ledger_entry: true } });
  await db.collection('invoices').updateOne({ invoice_number: 'INV-000136' }, { $set: { invoice_number: 'CH-000004', is_ledger_entry: true } });
  await db.collection('invoices').updateOne({ invoice_number: 'INV-000137' }, { $set: { invoice_number: 'CH-000005', is_ledger_entry: true } });
  
  console.log('Modified:', result.modifiedCount);
  process.exit(0);
});
