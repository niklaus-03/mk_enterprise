const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const ProductList = require('./models/ProductList');
const Product = require('./models/Product');
require('dotenv').config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mk_enterprise');
    const lists = await ProductList.find({ auto_for_manager: { $ne: null } });
    let count = 0;

    for (const list of lists) {
      // Find all products created by this manager
      const products = await Product.find({ created_by: list.auto_for_manager });
      const productIds = products.map(p => p._id);
      
      // Update the list with these products
      if (productIds.length > 0) {
        // use Set to avoid duplicates if any already exist
        const currentIds = list.products.map(id => id.toString());
        for (const pid of productIds) {
          if (!currentIds.includes(pid.toString())) {
            list.products.push(pid);
            count++;
          }
        }
        await list.save();
      }
    }
    console.log('Added ' + count + ' existing products to their respective manager lists.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
