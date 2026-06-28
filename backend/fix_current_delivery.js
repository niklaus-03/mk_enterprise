const mongoose = require('mongoose');
const Delivery = require('./models/Delivery');
const Supplier = require('./models/Supplier');

require('dotenv').config({ path: './.env' });

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise');
  console.log('Connected to DB');

  // Find deliveries with suppliers_data that has multiple suppliers
  const deliveries = await Delivery.find({ 'suppliers_data.1': { $exists: true } });
  
  for (let d of deliveries) {
    console.log("Delivery " + d.vehicle_number + " has " + d.suppliers_data.length + " suppliers.");
    let changed = false;
    
    // Check if items array is missing supplier_name
    for (let item of d.items) {
      if (!item.supplier_name) {
        // Try to find which supplier in suppliers_data has this item
        for (let s of d.suppliers_data) {
          const matchingItem = s.items.find(si => si.item_name === item.item_name && si.quantity === item.quantity);
          if (matchingItem) {
            item.supplier_name = s.supplier_name;
            changed = true;
            break;
          }
        }
      }
    }
    
    if (changed) {
      console.log("Updated items in delivery " + d._id + " with supplier names");
      await Delivery.updateOne({ _id: d._id }, { $set: { items: d.items } });
    }
  }

  // Find and remove the combined supplier "SDS, BTC" or similar
  const badSuppliers = await Supplier.find({ name: { $regex: /,/ } });
  for (let s of badSuppliers) {
    console.log("Found combined supplier: " + s.name + " with balance " + s.balance);
    // Check if there are settlements for this bad supplier
    const Settlement = require('./models/Settlement');
    const settlements = await Settlement.find({ party_name: s.name });
    if (settlements.length === 0) {
      console.log("Deleting bad supplier: " + s.name);
      await Supplier.deleteOne({ _id: s._id });
    } else {
      console.log("Cannot delete " + s.name + " safely, it has settlements");
    }
  }
  
  // also need to ensure individual suppliers exist for that delivery
  for (let d of deliveries) {
    for (let s of d.suppliers_data) {
        const sName = s.supplier_name.trim();
        const existing = await Supplier.findOne({ name: { $regex: new RegExp("^" + sName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + "$", 'i') } });
        if (!existing) {
            console.log("Creating missing supplier: " + sName);
            await Supplier.create({ name: sName, is_active: true });
        }
    }
  }

  mongoose.disconnect();
}

fix().catch(console.error);
