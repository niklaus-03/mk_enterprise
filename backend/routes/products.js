const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');
const { formatIST } = require('../utils/timeUtils');

router.use(auth);

// Middleware: check if manager has permission to edit stock/prices (Problem 6)
const checkProductEditPermission = async (req, res, next) => {
  if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
    const Admin = require('../models/Admin');
    const user = await Admin.findById(req.user.id);
    if (!user || !user.can_edit_products) {
      return res.status(403).json({ error: "You don't have permission to edit stock or prices. Please contact the Admin." });
    }
  }
  next();
};

// Helper: get global low stock threshold from settings
async function getGlobalThreshold() {
  const row = await Setting.findOne({ key: 'low_stock_threshold' });
  return row ? (parseInt(row.value) || 10) : 10;
}

const ProductList = require('../models/ProductList');

// Helper: managers see ONLY products they created, are explicitly allowed to view, or are part of a shared ProductList
async function getOwnerFilter(req, extra = {}) {
  if (req.user.role === 'walkin_manager') {
    // Walk-in manager's inventory is strictly what is in their vehicle (cloned products)
    return { ...extra, created_by: req.user.id };
  } else if (req.user.role === 'manager') {
    const sharedLists = await ProductList.find({ 'shares.manager_id': req.user.id });
    let sharedProductIds = [];
    sharedLists.forEach(list => {
      const share = list.shares.find(s => s.manager_id.toString() === req.user.id);
      if (share) {
        list.products.forEach(pId => {
          const override = share.overrides.find(o => o.product_id.toString() === pId.toString());
          if (!override || !override.is_excluded) {
            sharedProductIds.push(pId);
          }
        });
      }
    });

    return {
      ...extra,
      $or: [
        { created_by: req.user.id },
        { allowed_managers: req.user.id },
        { _id: { $in: sharedProductIds } }
      ],
    };
  } else if (req.user.role === 'temp_manager') {
    const assignedIds = req.user.assigned_managers || [];
    const sharedLists = await ProductList.find({ 'shares.manager_id': req.user.id });
    let sharedProductIds = [];
    sharedLists.forEach(list => {
      const share = list.shares.find(s => s.manager_id.toString() === req.user.id);
      if (share) {
        list.products.forEach(pId => {
          const override = share.overrides.find(o => o.product_id.toString() === pId.toString());
          if (!override || !override.is_excluded) {
            sharedProductIds.push(pId);
          }
        });
      }
    });

    return {
      ...extra,
      $or: [
        { allowed_managers: req.user.id },
        { _id: { $in: sharedProductIds } }
      ],
    };
  }
  return extra; // supervisor sees all
}



// Helper: Apply list overrides to a list of products
async function applyListOverrides(req, products, listId) {
  if (!listId) return products;
  try {
    const list = await ProductList.findById(listId);
    if (!list) return products;

    // Determine the share overrides for this user
    let userOverrides = [];
    if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      const share = list.shares.find(s => s.manager_id.toString() === req.user.id);
      if (share) userOverrides = share.overrides;
    } else {
      // If admin, we don't apply overrides unless we want to simulate a manager, but for now we won't.
    }

    // Filter to only products in the list
    const listProductIds = list.products.map(id => id.toString());
    
    return products.filter(p => {
      // Must be in the list
      if (!listProductIds.includes(p._id.toString())) return false;
      
      // Must not be excluded
      const override = userOverrides.find(o => o.product_id.toString() === p._id.toString());
      if (override && override.is_excluded) return false;
      
      return true;
    }).map(p => {
      const override = userOverrides.find(o => o.product_id.toString() === p._id.toString());
      if (override) {
        if (override.custom_price !== null) p.price = override.custom_price;
        if (override.custom_stock !== null) p.stock = override.custom_stock;
      }
      return p;
    });
  } catch (err) {
    console.error('List override error:', err);
    return products;
  }
}

// GET all products
router.get('/', async (req, res) => {
  try {
    const { search, limit = 200, list_id, paginate, page = 1, sort } = req.query;
    let query = { is_active: true };

    if (req.user && req.user.role === 'walkin_manager') {
      const Admin = require('../models/Admin');
      const adminUser = await Admin.findById(req.user.id);
      if (!adminUser || !adminUser.is_trip_active) {
        // If no active trip, walkin managers see NO products
        if (paginate) {
          return res.json({ products: [], total: 0, pages: 1, currentPage: parseInt(page) || 1 });
        }
        return res.json([]);
      }
      // Walkin managers can only see products they've loaded into their vehicle (created_by them) in the main grid
      query.created_by = req.user.id;
    } else {
      query = { ...query, ...(await getOwnerFilter(req)) };
    }

    if (search) {
      const searchFilter = { name: { $regex: search.trim(), $options: 'i' } };
      if (query.$or) {
        const ownerOr = query.$or;
        delete query.$or;
        query.$and = [{ $or: ownerOr }, searchFilter];
      } else {
        Object.assign(query, searchFilter);
      }
    }
    
    // Determine sorting logic
    let sortObj = { name: 1 };
    if (sort === 'recently_added') sortObj = { createdAt: -1 };
    else if (sort === 'last_updated') sortObj = { updatedAt: -1 };
    else if (sort === 'name_asc') sortObj = { name: 1 };
    else if (sort === 'name_desc') sortObj = { name: -1 };
    else if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };

    if (paginate === 'true') {
      const limitNum = parseInt(limit) || 25;
      const pageNum = parseInt(page) || 1;
      const skip = (pageNum - 1) * limitNum;
      
      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('created_by', 'username display_name role')
          .populate('last_updated_by', 'username display_name role')
          .populate('parent_product', 'name stock unit')
          .collation({ locale: 'hi', strength: 2 })
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(query)
      ]);
      
      return res.json({ 
        products, 
        total, 
        pages: Math.ceil(total / limitNum),
        currentPage: pageNum 
      });
    }

    // Legacy unpaginated behavior
    let products = await Product.find(query)
      .populate('created_by', 'username display_name role')
      .populate('last_updated_by', 'username display_name role')
      .populate('parent_product', 'name stock unit')
      .collation({ locale: 'hi', strength: 2 })
      .sort(sortObj)
      .limit(list_id ? 1000 : parseInt(limit))
      .lean();
    
    if (list_id) {
      products = await applyListOverrides(req, products, list_id);
    }
    
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET autocomplete - returns products visible to user
router.get('/autocomplete', async (req, res) => {
  try {
    const { q = '', list_id } = req.query;
    if (req.user && req.user.role === 'walkin_manager') {
      const Admin = require('../models/Admin');
      const adminUser = await Admin.findById(req.user.id);
      if (!adminUser || !adminUser.is_trip_active) {
        return res.json([]);
      }
    }
    const query = { is_active: true, ...(await getOwnerFilter(req)) };
    if (q.trim()) {
      const searchFilter = { name: { $regex: q.trim(), $options: 'i' } };
      if (query.$or) {
        const ownerOr = query.$or;
        delete query.$or;
        query.$and = [{ $or: ownerOr }, searchFilter];
      } else {
        Object.assign(query, searchFilter);
      }
    }
    let products = await Product.find(query, { name: 1, price: 1, gst: 1, unit: 1, stock: 1, supplier_base_price: 1, last_delivery_final_price: 1 }).limit(list_id ? 1000 : 20).lean();
    
    if (list_id) {
      products = await applyListOverrides(req, products, list_id);
      products = products.slice(0, 20); // re-limit after overrides
    }
    
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET distinct categories
router.get('/categories', async (req, res) => {
  try {
    const filter = { is_active: true, ...(await getOwnerFilter(req)) };
    const categories = await Product.distinct('category', filter);
    // Filter out empty strings, sort alphabetically
    const sorted = categories.filter(c => c && c.trim()).sort((a, b) => a.localeCompare(b, 'hi'));
    res.json(sorted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

  // GET low stock - respects per-product OR global threshold
  router.get('/low-stock', async (req, res) => {
    try {
      let globalThreshold = await getGlobalThreshold();
      if (req.user && req.user.role === 'walkin_manager') {
        globalThreshold = 2; // Hardcode default to 2 for walkin_manager
      }
      
      const filter = { is_active: true, ...(await getOwnerFilter(req)) };
      const products = await Product.find(filter);
      
      const lowStock = products.filter(p => {
        const threshold = (p.custom_low_stock !== null && p.custom_low_stock !== undefined)
          ? p.custom_low_stock : globalThreshold;
        return p.stock <= threshold;
      }).sort((a, b) => a.stock - b.stock);
      res.json(lowStock);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...(await getOwnerFilter(req)) }).populate('parent_product', 'name stock unit').populate('created_by', 'username display_name role').populate('last_updated_by', 'username display_name role');
    if (!product) return res.status(404).json({ error: 'Product not found or access denied' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create product
router.post('/', checkProductEditPermission, async (req, res) => {
  try {
    const { name, price, stock, gst, unit, hsn_code, custom_low_stock, weight_per_unit, suggested_price, allowed_managers, category } = req.body;
    if (!name || price === undefined || stock === undefined || gst === undefined)
      return res.status(400).json({ error: 'name, price, stock, gst required' });
      let final_low_stock = (custom_low_stock != null && custom_low_stock !== '') ? parseFloat(custom_low_stock) : null;
      if (req.user.role === 'walkin_manager' && final_low_stock === null) {
        final_low_stock = 2;
      }

      const productData = {
        name: name.trim(), price, stock, gst,
        unit: unit || 'pcs',
        hsn_code: hsn_code || '',
        custom_low_stock: final_low_stock,
        weight_per_unit: parseFloat(weight_per_unit) || 0,
      suggested_price: parseFloat(suggested_price) || 0,
      category: (category || '').trim(),
      parent_product: req.body.parent_product || null,
      conversion_factor: parseFloat(req.body.conversion_factor) || 0,
      is_loose_item: !!req.body.parent_product,
      created_by: req.user.id,
    };
    if (allowed_managers && Array.isArray(allowed_managers)) {
      productData.allowed_managers = allowed_managers;
    }
    const product = await Product.create(productData);

    await StockMovement.create({
      product_id: product._id,
      product_name: product.name,
      type: 'incoming',
      qty: stock,
      qty_unit: product.unit || 'pcs',
      stock_before: 0,
      stock_after: stock,
      source: 'manual',
      notes: `Product Created`,
      ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    // If a manager created this product, auto-add it to their personal ProductList
    if (['manager', 'temp_manager', 'walkin_manager'].includes(req.user.role)) {
      const autoList = await ProductList.findOne({ auto_for_manager: req.user.id });
      if (autoList) {
        autoList.products.push(product._id);
        await autoList.save();
      }
    }

    // Log activity
    logActivity(req, {
      action: 'create',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Product created. Price: ₹${product.price}, Stock: ${product.stock} ${product.unit}`,
      changes: product.toObject()
    });

    // Auto-create loose child product if requested
    let looseProduct = null;
    if (req.body.create_loose_item && req.body.loose_unit && req.body.loose_conversion_factor) {
      const looseName = `${name.trim()} (${req.body.loose_unit})`;
      const looseStock = parseFloat(req.body.initial_loose_stock) || 0;
      const loosePrice = parseFloat(req.body.loose_price) || 0;
      const looseFactor = parseFloat(req.body.loose_conversion_factor) || 1;

      looseProduct = await Product.create({
        name: looseName,
        price: loosePrice,
        stock: looseStock,
        gst: parseFloat(gst) || 0,
        unit: req.body.loose_unit,
        parent_product: product._id,
        conversion_factor: looseFactor,
        is_loose_item: true,
        created_by: req.user.id,
      });

      if (looseStock > 0) {
        await StockMovement.create({
          product_id: looseProduct._id,
          product_name: looseProduct.name,
          type: 'incoming',
          qty: looseStock,
          qty_unit: req.body.loose_unit,
          stock_before: 0,
          stock_after: looseStock,
          source: 'manual',
          notes: 'Initial loose stock on creation',
          ist_formatted: formatIST(new Date()),
          created_by: req.user.id,
        });
      }

      logActivity(req, {
        action: 'create',
        entity_type: 'product',
        entity_id: looseProduct._id,
        entity_name: looseProduct.name,
        description: `Auto-created loose item. Price: ₹${loosePrice}, Stock: ${looseStock} ${req.body.loose_unit}, Factor: ${looseFactor}:1`,
      });
    }

    res.status(201).json({ product, looseProduct });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update product
// Update saved_order_qty in bulk
router.all('/bulk-order-qty', async (req, res) => {
  try {
    const { updates } = req.body; // Array of { _id, saved_order_qty }
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected updates array' });

    for (let u of updates) {
      if (u._id && !u._id.startsWith('custom-')) {
        const product = await Product.findOne({ _id: u._id, ...(await getOwnerFilter(req)) });
        if (product) {
          const newQty = parseInt(u.saved_order_qty) || 0;
          if (product.saved_order_qty !== newQty) {
            await Product.updateOne(
              { _id: u._id },
              { $set: { saved_order_qty: newQty, last_updated_by: req.user.id } }
            );
          }
        }
      }
    }
    res.json({ message: 'Order quantities saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkProductEditPermission, async (req, res) => {
  try {
    const checkProduct = await Product.findOne({ _id: req.params.id, ...(await getOwnerFilter(req)) });
    if (!checkProduct) return res.status(404).json({ error: 'Product not found or access denied' });

    const { custom_low_stock, weight_per_unit, suggested_price, category, parent_product, conversion_factor, ...rest } = req.body;
    const updateData = {
      ...rest,
      custom_low_stock: (custom_low_stock != null && custom_low_stock !== '') ? parseFloat(custom_low_stock) : null,
      weight_per_unit: parseFloat(weight_per_unit) || 0,
      suggested_price: parseFloat(suggested_price) || 0,
      category: category !== undefined ? (category || '').trim() : undefined,
      parent_product: parent_product || null,
      conversion_factor: parseFloat(conversion_factor) || 0,
      is_loose_item: !!parent_product,
      last_updated_by: req.user.id,
    };
    // Remove undefined keys
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    if (updateData.stock !== undefined && updateData.stock !== checkProduct.stock) {
      const diff = updateData.stock - checkProduct.stock;
      if (diff !== 0) {
        await StockMovement.create({
          product_id: product._id,
          product_name: product.name,
          type: diff > 0 ? 'incoming' : 'outgoing',
          qty: Math.abs(diff),
          qty_unit: product.unit || 'pcs',
          stock_before: checkProduct.stock,
          stock_after: product.stock,
          source: 'manual',
          notes: `Stock updated via Edit Product`,
          ist_formatted: formatIST(new Date()),
          created_by: req.user.id,
        });
      }
    }

    // Log activity
    const priceChanged = updateData.price !== undefined && updateData.price !== checkProduct.price;
    const descParts = ['Product updated'];
    if (priceChanged) {
      descParts.push(`Price: ₹${checkProduct.price} → ₹${updateData.price}`);
    }
    logActivity(req, {
      action: 'update',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: descParts.join('. '),
      changes: { old_price: checkProduct.price, new_price: product.price, ...product.toObject() }
    });

    // If walkin_manager changed the price, notify supervisors
    if (req.user.role === 'walkin_manager' && priceChanged) {
      const Admin = require('../models/Admin');
      const walkinUser = await Admin.findById(req.user.id);
      const managerName = walkinUser?.display_name || walkinUser?.username || 'Walk-in Manager';
      const supervisors = await Admin.find({ role: 'supervisor' }, '_id');
      for (const sup of supervisors) {
        await Notification.create({
          sender_id: req.user.id,
          sender_name: managerName,
          recipient_id: sup._id,
          recipient_role: 'supervisor',
          type: 'price_review',
          title: `💰 Price Changed — ${product.name}`,
          message: `${managerName} changed the price of "${product.name}" from ₹${checkProduct.price} to ₹${product.price} in their local inventory.`,
          priority: 'medium',
          entity_type: 'product',
          entity_id: product._id,
          metadata: {
            product_name: product.name,
            old_price: checkProduct.price,
            new_price: product.price,
            manager_name: managerName,
            manager_id: req.user.id
          }
        });
      }
    }

    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH stock adjustment
router.patch('/:id/stock', checkProductEditPermission, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...(await getOwnerFilter(req)) });
    if (!product) return res.status(404).json({ error: 'Product not found or access denied' });

    const { qty, type, qty_unit, vehicle_number, driver_name, supplier, notes } = req.body;
    const stock_before = product.stock;
    if (type === 'incoming') {
      product.stock += parseFloat(qty);
    } else {
      if (product.stock < parseFloat(qty)) return res.status(400).json({ error: 'Insufficient stock' });
      product.stock -= parseFloat(qty);
    }
    await product.save();
    await StockMovement.create({
      product_id: product._id, product_name: product.name, type, qty: parseFloat(qty),
      qty_unit: qty_unit || product.unit || 'pcs',
      stock_before, stock_after: product.stock,
      vehicle_number: vehicle_number || '', driver_name: driver_name || '',
      supplier: supplier || '', notes: notes || '',
      source: 'manual', ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    // Log activity
    logActivity(req, {
      action: 'stock_adjust',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Stock ${type}: ${qty} ${qty_unit || product.unit || 'pcs'}. ${stock_before} → ${product.stock}`,
    });

    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST delegate product to another manager
router.post('/:id/delegate', async (req, res) => {
  try {
    const { manager_id } = req.body;
    if (!manager_id) return res.status(400).json({ error: 'manager_id is required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Only creator or supervisor can delegate
    if (req.user.role !== 'supervisor' && product.created_by?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the product creator or supervisor can delegate' });
    }

    // Avoid duplicates in allowed_managers
    const already = product.allowed_managers.some(m => m.toString() === manager_id);
    if (!already) {
      product.allowed_managers.push(manager_id);
    }

    await product.save();

    // Log activity
    logActivity(req, {
      action: 'update',
      entity_type: 'product',
      entity_id: product._id,
      entity_name: product.name,
      description: `Product delegated to manager ${manager_id}`,
    });

    res.json({ success: true, allowed_managers: product.allowed_managers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /:id/convert — Convert bulk stock to loose stock (open bags → loose units)
router.post('/:id/convert', checkProductEditPermission, async (req, res) => {
  try {
    const { qty, child_product_id } = req.body;
    if (!qty || parseFloat(qty) <= 0) return res.status(400).json({ error: 'Quantity to convert is required' });
    if (!child_product_id) return res.status(400).json({ error: 'Child product ID is required' });

    const parentProduct = await Product.findById(req.params.id);
    if (!parentProduct) return res.status(404).json({ error: 'Parent product not found' });

    const childProduct = await Product.findById(child_product_id);
    if (!childProduct) return res.status(404).json({ error: 'Child (loose) product not found' });
    if (!childProduct.parent_product || childProduct.parent_product.toString() !== parentProduct._id.toString()) {
      return res.status(400).json({ error: 'Child product is not linked to this parent' });
    }

    const convertQty = parseFloat(qty);
    if (parentProduct.stock < convertQty) {
      return res.status(400).json({ error: `Insufficient parent stock. Available: ${parentProduct.stock}` });
    }

    const looseQty = convertQty * (childProduct.conversion_factor || 1);

    // Deduct from parent
    const parentBefore = parentProduct.stock;
    parentProduct.stock -= convertQty;
    await parentProduct.save();

    // Add to child
    const childBefore = childProduct.stock;
    childProduct.stock += looseQty;
    await childProduct.save();

    // Stock movements for both
    await StockMovement.create({
      product_id: parentProduct._id,
      product_name: parentProduct.name,
      type: 'outgoing',
      qty: convertQty,
      qty_unit: parentProduct.unit || 'pcs',
      stock_before: parentBefore,
      stock_after: parentProduct.stock,
      source: 'conversion',
      notes: `Converted ${convertQty} ${parentProduct.unit} → ${looseQty} ${childProduct.unit} of ${childProduct.name}`,
      ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    await StockMovement.create({
      product_id: childProduct._id,
      product_name: childProduct.name,
      type: 'incoming',
      qty: looseQty,
      qty_unit: childProduct.unit || 'pcs',
      stock_before: childBefore,
      stock_after: childProduct.stock,
      source: 'conversion',
      notes: `Converted from ${convertQty} ${parentProduct.unit} of ${parentProduct.name}`,
      ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    logActivity(req, {
      action: 'stock_adjust',
      entity_type: 'product',
      entity_id: parentProduct._id,
      entity_name: parentProduct.name,
      description: `Bulk-to-loose conversion: ${convertQty} ${parentProduct.unit} → ${looseQty} ${childProduct.unit} ${childProduct.name}`,
    });

    res.json({
      success: true,
      parent: { _id: parentProduct._id, name: parentProduct.name, stock: parentProduct.stock },
      child: { _id: childProduct._id, name: childProduct.name, stock: childProduct.stock },
      converted: { parent_qty: convertQty, child_qty: looseQty }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /:id/children — Get all loose items linked to this parent product
router.get('/:id/children', async (req, res) => {
  try {
    const children = await Product.find({ parent_product: req.params.id, is_active: true }).lean();
    res.json(children);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /:id/pack-bulk — Pack loose items back into bulk (reverse conversion)
router.post('/:id/pack-bulk', checkProductEditPermission, async (req, res) => {
  try {
    const { qty } = req.body; // qty = number of BULK units to form
    if (!qty || parseFloat(qty) <= 0) return res.status(400).json({ error: 'Quantity to pack is required' });

    const childProduct = await Product.findById(req.params.id);
    if (!childProduct) return res.status(404).json({ error: 'Loose product not found' });
    if (!childProduct.parent_product) return res.status(400).json({ error: 'This product has no parent bulk item' });

    const parentProduct = await Product.findById(childProduct.parent_product);
    if (!parentProduct) return res.status(404).json({ error: 'Parent bulk product not found' });

    const packQty = parseFloat(qty);
    const looseNeeded = packQty * (childProduct.conversion_factor || 1);

    if (childProduct.stock < looseNeeded) {
      return res.status(400).json({ error: `Insufficient loose stock. Need ${looseNeeded} ${childProduct.unit}, available: ${childProduct.stock}` });
    }

    // Deduct from child (loose)
    const childBefore = childProduct.stock;
    childProduct.stock -= looseNeeded;
    await childProduct.save();

    // Add to parent (bulk)
    const parentBefore = parentProduct.stock;
    parentProduct.stock += packQty;
    await parentProduct.save();

    // Stock movements
    await StockMovement.create({
      product_id: childProduct._id,
      product_name: childProduct.name,
      type: 'outgoing',
      qty: looseNeeded,
      qty_unit: childProduct.unit || 'pcs',
      stock_before: childBefore,
      stock_after: childProduct.stock,
      source: 'conversion',
      notes: `Packed ${looseNeeded} ${childProduct.unit} → ${packQty} ${parentProduct.unit} of ${parentProduct.name}`,
      ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    await StockMovement.create({
      product_id: parentProduct._id,
      product_name: parentProduct.name,
      type: 'incoming',
      qty: packQty,
      qty_unit: parentProduct.unit || 'pcs',
      stock_before: parentBefore,
      stock_after: parentProduct.stock,
      source: 'conversion',
      notes: `Packed from ${looseNeeded} ${childProduct.unit} of ${childProduct.name}`,
      ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    logActivity(req, {
      action: 'stock_adjust',
      entity_type: 'product',
      entity_id: parentProduct._id,
      entity_name: parentProduct.name,
      description: `Loose-to-bulk packing: ${looseNeeded} ${childProduct.unit} → ${packQty} ${parentProduct.unit} ${parentProduct.name}`,
    });

    res.json({
      success: true,
      parent: { _id: parentProduct._id, name: parentProduct.name, stock: parentProduct.stock },
      child: { _id: childProduct._id, name: childProduct.name, stock: childProduct.stock },
      packed: { parent_qty: packQty, child_qty: looseNeeded }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (soft)
router.delete('/:id', checkProductEditPermission, async (req, res) => {
  try {
    const checkProduct = await Product.findOne({ _id: req.params.id, ...(await getOwnerFilter(req)) });
    if (!checkProduct) return res.status(404).json({ error: 'Product not found or access denied' });

    await Product.findByIdAndUpdate(req.params.id, { is_active: false });

    // Log activity
    logActivity(req, {
      action: 'delete',
      entity_type: 'product',
      entity_id: checkProduct._id,
      entity_name: checkProduct.name,
      description: `Product soft-deleted`,
      changes: checkProduct.toObject()
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


module.exports = router;
// trigger nodemon
