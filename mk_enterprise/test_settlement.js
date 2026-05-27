const mongoose = require('mongoose');
const Settlement = require('./backend/models/Settlement');
const Admin = require('./backend/models/Admin'); // ensure it's loaded

mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      const docs = await Settlement.find().limit(5).populate('created_by', 'name role');
      console.log('Success:', docs);
    } catch (e) {
      console.error('Error:', e);
    }
    process.exit(0);
  });
