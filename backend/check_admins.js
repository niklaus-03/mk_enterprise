const mongoose = require('mongoose');
const Admin = require('./models/Admin');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      const admins = await Admin.find({});
      console.log('--- All Admin Collection Records ---');
      admins.forEach(admin => {
        console.log(`Username: ${admin.username}, Role: ${admin.role}, DisplayName: ${admin.display_name}, IsActive: ${admin.is_active}`);
      });
      console.log('-------------------------------------');
      
      const supervisors = admins.filter(a => a.role === 'supervisor');
      console.log(`Total supervisors: ${supervisors.length}`);
    } catch (err) {
      console.error('Error fetching admins', err);
    } finally {
      mongoose.connection.close();
    }
  })
  .catch(err => {
    console.error('Connection error', err);
  });
