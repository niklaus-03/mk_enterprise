const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const Admin = mongoose.model('Admin', new mongoose.Schema({ username: String, role: String }, { strict: false }));
  const Delivery = mongoose.model('Delivery', new mongoose.Schema({ created_by: mongoose.Schema.Types.ObjectId }, { strict: false }));
  
  const managers = await Admin.find({ role: 'manager' });
  console.log('MANAGERS:');
  for (const m of managers) {
    const count = await Delivery.countDocuments({ created_by: m._id });
    console.log(m._id, m.username, 'Deliveries:', count);
  }
  
  mongoose.disconnect();
}).catch(console.error);
