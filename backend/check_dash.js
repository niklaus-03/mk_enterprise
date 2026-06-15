const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise').then(async () => {
  const Product = require('./models/Product');
  const req = { user: { id: '69e0c9d1e169b61bb524d130', role: 'admin' } };
  
  const getProductOwnerFilter = async (r) => {
    return {
      $or: [
        { created_by: new mongoose.Types.ObjectId(r.user.id) },
        { allowed_managers: new mongoose.Types.ObjectId(r.user.id) }
      ],
    };
  };

  const allActiveProducts = await Product.find({ is_active: true, ...(await getProductOwnerFilter(req)) }).select('name price stock unit gst is_active custom_low_stock weight_per_unit created_by saved_order_qty created_from_order is_custom last_updated_by updatedAt').lean();
  
  const w = allActiveProducts.find(p => p.name === 'Watch');
  console.log("Watch from DB:", w);

  const lowStockProducts = allActiveProducts.filter(p => p.stock <= 10 || (p.saved_order_qty && p.saved_order_qty > 0));
  
  const mapped = lowStockProducts.map(p => ({
        _id: p._id,
        name: p.name,
        saved_order_qty: p.saved_order_qty || 0,
        created_from_order: p.created_from_order || false,
        is_custom: p.is_custom || false,
  }));
  
  const wm = mapped.find(p => p.name === 'Watch');
  console.log("Mapped Watch:", wm);

  process.exit();
});
