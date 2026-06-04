const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const auth = require('../middleware/auth');

router.use(auth);

const DEFAULTS = {
  business_name: 'My Shop',
  business_address: '123, Main Street, Your City - 000000',
  business_phone: '9800000000',
  business_gstin: '22AAAAA0000A1Z5',
  business_state: 'Uttarakhand',
  business_email: '',
  upi_id: '',
  upi_name: 'My Shop',
  invoice_prefix: 'INV',
  // Enhancement 1: global low stock threshold
  low_stock_threshold: 10,
  language: 'en',
  gst_enabled: true,
  discount_enabled: false,
  currency_symbol: '₹',
  // Enhancement 5: bank details for invoice
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  bank_branch: '',
  // Enhancement 6: quintal-based tax system
  quintal_tax_enabled: false,
  tax_per_quintal: 0,           // ₹ per quintal (100 kg)
};

router.get('/', async (req, res) => {
  try {
    const rows = await Setting.find({});
    const settings = { ...DEFAULTS };
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/', async (req, res) => {
  try {
    const ops = Object.entries(req.body).map(([key, value]) => ({
      updateOne: { filter: { key }, update: { $set: { key, value } }, upsert: true },
    }));
    if (ops.length) await Setting.bulkWrite(ops);
    const rows = await Setting.find({});
    const settings = { ...DEFAULTS };
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
