const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise')
  .then(() => mongoose.connection.db.collection('deliveries').updateOne(
    { vehicle_number: 'UK04BC85632' },
    { $set: { 'items.0.supplier_name': 'BTC', 'items.1.supplier_name': 'BTC', 'items.2.supplier_name': 'bahwani' } }
  ))
  .then(() => {
    console.log('Fixed DB');
    process.exit(0);
  });
