const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const ProductList = require('./models/ProductList');
require('dotenv').config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mk_enterprise');
    const managers = await Admin.find({ role: { $in: ['manager', 'temp_manager', 'walkin_manager'] } });
    let count = 0;
    
    // Fallback admin ID to use as created_by if manager doesn't have one
    const supervisor = await Admin.findOne({ role: 'supervisor' });
    const fallbackId = supervisor ? supervisor._id : new mongoose.Types.ObjectId();

    for (const m of managers) {
      const existing = await ProductList.findOne({ auto_for_manager: m._id });
      if (!existing) {
        await ProductList.create({
          name: m.display_name || m.username,
          created_by: m.created_by || fallbackId,
          auto_for_manager: m._id,
          products: [],
          shares: [{ manager_id: m._id, overrides: [] }]
        });
        count++;
      }
    }
    console.log('Created ' + count + ' lists for existing managers.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
