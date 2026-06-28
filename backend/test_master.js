const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise');
  
  const Supplier = require('./models/Supplier');
  const Customer = require('./models/Customer');
  const Delivery = require('./models/Delivery');
  const Settlement = require('./models/Settlement');
  const Invoice = require('./models/Invoice');
  const Payment = require('./models/Payment');
  const Product = require('./models/Product');

  try {
    const supplier_id = '6a3523aab5fb38bf1f278401';
    
    const supplier = await Supplier.findById(supplier_id)
      .populate('linked_customer_ids', 'name balance')
      .lean();
      
    if (!supplier) {
      console.log('Supplier not found');
      return;
    }

    const supplierName = supplier.name;

    // Fetch Supplier transactions
    const settlementQuery = {
      party_name: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') },
      type: { $in: ['paid_to_supplier', 'other_expense', 'walkin_delivery'] },
    };
    const deliveryQuery = {
      supplier: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') },
      status: { $in: ['delivered'] },
    };

    const settlements = await Settlement.find(settlementQuery).lean();
    console.log('settlements', settlements.length);
    
    const deliveries = await Delivery.find(deliveryQuery)
      .populate('items.product_id', 'name')
      .lean();
    console.log('deliveries', deliveries.length);

    let invoices = [];
    let payments = [];
    if (supplier.linked_customer_ids && supplier.linked_customer_ids.length > 0) {
      const cids = supplier.linked_customer_ids.map(c => c._id);
      invoices = await Invoice.find({ customer_id: { $in: cids } })
        .populate('items.product_id', 'name')
        .lean();
      payments = await Payment.find({ customer_id: { $in: cids } }).lean();
    }
    
    console.log('invoices', invoices.length);
    console.log('payments', payments.length);
    
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

test();
