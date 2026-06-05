const mongoose = require('mongoose');
const Settlement = require('./models/Settlement');

async function fixNotes() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to DB');

    const result = await Settlement.updateMany(
      { notes: 'Auto-recorded payment' },
      { $set: { notes: 'Due Received' } }
    );
    console.log(`Updated ${result.modifiedCount} settlements.`);

    await mongoose.disconnect();
    console.log('Done');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixNotes();
