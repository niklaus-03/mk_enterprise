const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const Product = require('./models/Product');
  const docs = await Product.find({ name: { $in: ['Watch', 'Mobile', 'Earbud'] } });
  console.log(docs.map(d => ({name: d.name, stock: d.stock, created: d.created_from_order, custom: d.is_custom})));
  process.exit();
});
