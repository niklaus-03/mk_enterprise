const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const Product = require('./models/Product');
  const docs = await Product.find({ name: { $in: ['Watch', 'Mobile', 'Earbud'] } }).select('name price stock unit gst is_active custom_low_stock weight_per_unit created_by saved_order_qty created_from_order is_custom last_updated_by updatedAt').lean();
  console.log(docs);
  process.exit();
});
