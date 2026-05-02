const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const Setting = require('../models/Setting');

// POST /api/seed — seeds sample data. Also creates admin if not exists.
// Call once after setup. Safe to call multiple times (idempotent).
router.post('/', async (req, res) => {
  try {
    const results = {};

    // Create admin if not exists
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'Admin@123';
      const mobile = process.env.ADMIN_MOBILE || '9800000000';
      const secret_key = process.env.ADMIN_SECRET_KEY || '98765';
      await Admin.create({
        username,
        password,
        mobile,
        phone: mobile,
        secret_key,
        role: 'supervisor',
        display_name: 'Supervisor Admin',
        is_active: true,
      });
      results.admin = `Created supervisor admin: ${username} / mobile: ${mobile}`;
    } else {
      // Ensure existing admin has all required fields persisted in the database
      // (Mongoose defaults don't write to DB until save, so fields may be missing)
      const existingAdmin = await Admin.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
      if (existingAdmin) {
        let needsSave = false;
        const rawDoc = await Admin.collection.findOne({ _id: existingAdmin._id });

        // Ensure role is persisted (not just a Mongoose default)
        if (!rawDoc.role) {
          existingAdmin.role = 'supervisor';
          needsSave = true;
        }
        // Ensure is_active is persisted
        if (rawDoc.is_active === undefined) {
          existingAdmin.is_active = true;
          needsSave = true;
        }
        existingAdmin.display_name = existingAdmin.display_name || 'Supervisor Admin';
        existingAdmin.phone = existingAdmin.phone || existingAdmin.mobile || '';
        if (!rawDoc.secret_key) {
          existingAdmin.secret_key = process.env.ADMIN_SECRET_KEY || '98765';
          needsSave = true;
        }

        if (needsSave) {
          await existingAdmin.save();
          results.admin = 'Existing admin upgraded — missing fields persisted to database';
        } else {
          results.admin = 'Admin already exists with all fields set';
        }
      }
    }

    // Seed products
    const pc = await Product.countDocuments();
    if (pc === 0) {
      await Product.insertMany([
        { name: 'Rice (1kg)', price: 55, stock: 100, gst: 5, unit: 'kg', hsn_code: '1006', weight_per_unit: 1 },
        { name: 'Wheat Flour (1kg)', price: 40, stock: 80, gst: 5, unit: 'kg' },
        { name: 'Sugar (1kg)', price: 45, stock: 60, gst: 5, unit: 'kg' },
        { name: 'Cooking Oil (1L)', price: 130, stock: 40, gst: 5, unit: 'ltr' },
        { name: 'Biscuits (Parle-G)', price: 10, stock: 200, gst: 18, unit: 'pkt' },
        { name: 'Soap Bar', price: 35, stock: 150, gst: 18, unit: 'pcs' },
        { name: 'Shampoo (100ml)', price: 85, stock: 50, gst: 18, unit: 'pcs' },
        { name: 'Toothpaste (150g)', price: 65, stock: 75, gst: 12, unit: 'pcs' },
        { name: 'Dal (1kg)', price: 95, stock: 90, gst: 5, unit: 'kg' },
        { name: 'Salt (1kg)', price: 20, stock: 120, gst: 0, unit: 'kg' },
      ]);
      results.products = '10 sample products created';
    } else {
      results.products = `${pc} products already exist`;
    }

    // Seed customers
    const cc = await Customer.countDocuments();
    if (cc === 0) {
      await Customer.insertMany([
        { name: 'Ramesh Kumar', phone: '9812345678', address: 'Village Road, Near Temple', balance: 0 },
        { name: 'Sunita Devi', phone: '9856789012', address: 'Market Colony, Block B', balance: 250 },
        { name: 'Mahesh Singh', phone: '9898765432', address: 'Old Bazaar, Shop No. 12', balance: 0 },
      ]);
      results.customers = '3 sample customers created';
    } else {
      results.customers = `${cc} customers already exist`;
    }

    
    // Seed default settings including low_stock_threshold
    const Setting = require('../models/Setting');
    const defaultSettings = [
      { key: 'low_stock_threshold', value: '10' },
      { key: 'bank_name', value: '' },
      { key: 'bank_account', value: '' },
      { key: 'bank_ifsc', value: '' },
      { key: 'bank_branch', value: '' },
      { key: 'quintal_tax_enabled', value: 'false' },
      { key: 'tax_per_quintal', value: '0' },
    ];
    for (const s of defaultSettings) {
      const exists = await Setting.findOne({ key: s.key });
      if (!exists) await Setting.create(s);
    }
    results.settings = 'Default settings seeded';

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
