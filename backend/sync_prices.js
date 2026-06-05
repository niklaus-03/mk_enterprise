const mongoose = require('mongoose');
const Product = require('./models/Product');
const Delivery = require('./models/Delivery');

mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const products = await Product.find({});
    for (let p of products) {
      const recentDel = await Delivery.findOne({ 'items.product_id': p._id, status: 'delivered' }).sort({ created_at: -1 });
      if (recentDel) {
        const item = recentDel.items.find(i => i.product_id && i.product_id.toString() === p._id.toString());
        if (item) {
          if (item.base_price > 0) p.supplier_base_price = item.base_price;
          if (item.final_price > 0) p.last_delivery_final_price = item.final_price;
          await p.save();
        }
      }
    }
    console.log('Prices synced successfully!');
    process.exit(0);
  })
  .catch(e => console.log(e));
