const mongoose = require('mongoose');
const Settlement = require('./models/Settlement');
const Admin = require('./models/Admin');

mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      const docs = await Settlement.find().limit(2).populate('created_by', 'name role display_name username');
      console.log('Docs:', JSON.stringify(docs, null, 2));
    } catch (e) {
      console.error('Error:', e);
    }
    process.exit(0);
  });
