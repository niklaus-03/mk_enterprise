const axios = require('axios');
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise');
  const User = require('./models/User');
  const admin = await User.findOne({ role: 'admin' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: admin._id, role: admin.role, company_id: admin.company_id }, 'secret', { expiresIn: '1d' });
  
  const res = await axios.get('http://localhost:5000/api/dashboard?date=2026-06-14', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const watch = res.data.lowStockProducts.find(p => p.name === 'Watch');
  console.log(watch);
  process.exit();
}
test();
