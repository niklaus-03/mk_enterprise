require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const Admin = require('../models/Admin');
  const Product = require('../models/Product');
  const ProductList = require('../models/ProductList');
  const Trip = require('../models/Trip');
  const Invoice = require('../models/Invoice');
  const StockMovement = require('../models/StockMovement');

  const walkinManagers = await Admin.find({ role: 'walkin_manager' }).select('_id');
  const walkinManagerIds = walkinManagers.map(m => m._id);

  console.log(`Found ${walkinManagerIds.length} walkin managers.`);

  const clonedProducts = await Product.find({ created_by: { $in: walkinManagerIds } });
  console.log(`Found ${clonedProducts.length} cloned products to migrate.`);

  let migratedCount = 0;

  for (const clone of clonedProducts) {
    const managerId = clone.created_by;

    // Find master product
    let master = await Product.findOne({ name: clone.name, created_by: { $nin: walkinManagerIds } });
    if (!master) {
      console.log(`WARN: No master product found for ${clone.name}. Leaving clone as is or converting to master...`);
      // If no master exists, we can convert this clone to a master by assigning to first admin
      const superAdmin = await Admin.findOne({ role: { $in: ['admin', 'supervisor'] } });
      if (superAdmin) {
        clone.created_by = superAdmin._id;
        clone.manager_stock.push({ manager_id: managerId, stock: clone.stock });
        clone.stock = 0; // The stock is fully in the vehicle
        await clone.save();
      }
      continue;
    }

    // Add stock to master's manager_stock
    const ms = master.manager_stock.find(m => m.manager_id.toString() === managerId.toString());
    if (ms) {
      ms.stock += clone.stock;
    } else {
      master.manager_stock.push({ manager_id: managerId, stock: clone.stock });
    }
    await master.save();

    // 1. Update ProductLists
    const lists = await ProductList.find({ products: clone._id });
    for (const list of lists) {
      list.products = list.products.filter(pid => pid.toString() !== clone._id.toString());
      if (!list.products.some(pid => pid.toString() === master._id.toString())) {
        list.products.push(master._id);
      }
      await list.save();
    }

    // 2. Update Trips
    await Trip.collection.updateMany(
      { 'initial_stock.product_id': clone._id },
      { $set: { 'initial_stock.$[elem].product_id': master._id } },
      { arrayFilters: [{ 'elem.product_id': clone._id }] }
    );

    // 3. Update Invoices
    await Invoice.collection.updateMany(
      { 'items.product_id': clone._id },
      { $set: { 'items.$[elem].product_id': master._id } },
      { arrayFilters: [{ 'elem.product_id': clone._id }] }
    );

    // 4. Update Stock Movements
    await StockMovement.updateMany(
      { product_id: clone._id },
      { $set: { product_id: master._id } }
    );

    // Finally, delete the clone
    await Product.findByIdAndDelete(clone._id);
    migratedCount++;
    console.log(`Migrated clone ${clone.name} for manager ${managerId}`);
  }

  console.log(`Migration complete. ${migratedCount} clones deleted/merged.`);
  process.exit(0);
}

migrate().catch(console.error);
