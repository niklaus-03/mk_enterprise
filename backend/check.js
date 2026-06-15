const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const db = mongoose.connection.db;
  
  // 1. Fix INV-000133 -> CH-000007
  await db.collection('invoices').updateOne(
    { invoice_number: 'INV-000133' },
    { $set: { invoice_number: 'CH-000007', is_ledger_entry: true } }
  );
  
  // 2. Fix INV-000134 -> Give it source_entries so it shows as Consolidated
  const inv134 = await db.collection('invoices').findOne({ invoice_number: 'INV-000134' });
  if (inv134 && (!inv134.source_entries || inv134.source_entries.length === 0)) {
    const fakeId = new mongoose.Types.ObjectId();
    await db.collection('invoices').updateOne(
      { invoice_number: 'INV-000134' },
      { $set: { source_entries: [fakeId] } }
    );
  }

  console.log('Fixed DB manually');
  process.exit(0);
});
