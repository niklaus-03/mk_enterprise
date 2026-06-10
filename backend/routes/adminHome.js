const express = require('express');
const router = express.Router();
const AdminExpense = require('../models/AdminExpense');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const auth = require('../middleware/auth');
const { formatIST } = require('../utils/timeUtils');
const { logActivity } = require('./activityLogs');

router.use(auth);

// Middleware: supervisor only
const supervisorOnly = (req, res, next) => {
  if (req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
};

router.use(supervisorOnly);

// GET / — List expenses
router.get('/', async (req, res) => {
  try {
    const { type, date, from, to, limit = 50, page = 1 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (date) {
      const start = new Date(date + 'T00:00:00+05:30');
      const end = new Date(date + 'T23:59:59+05:30');
      query.date = { $gte: start, $lte: end };
    } else if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from + 'T00:00:00+05:30');
      if (to) query.date.$lte = new Date(to + 'T23:59:59+05:30');
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [expenses, total] = await Promise.all([
      AdminExpense.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('admin_id', 'username display_name')
        .lean(),
      AdminExpense.countDocuments(query)
    ]);
    res.json({
      expenses,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /summary — Monthly summary
router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(`${year}-${String(mon).padStart(2, '0')}-01T00:00:00+05:30`);
    const end = new Date(year, mon, 0, 23, 59, 59); // last day of month
    end.setHours(end.getHours() + 5); end.setMinutes(end.getMinutes() + 30);

    const expenses = await AdminExpense.find({ date: { $gte: start, $lte: end } }).lean();
    let items_total = 0, cash_total = 0, expense_total = 0;
    let counts = { item_taken: 0, cash_taken: 0, expense: 0 };
    expenses.forEach(e => {
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.type === 'item_taken') items_total += e.amount || 0;
      else if (e.type === 'cash_taken') cash_total += e.amount || 0;
      else if (e.type === 'expense') expense_total += e.amount || 0;
    });
    res.json({
      month,
      items_total,
      cash_total,
      expense_total,
      grand_total: items_total + cash_total + expense_total,
      counts
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST / — Create expense
router.post('/', async (req, res) => {
  try {
    const { type, items, amount, category, description } = req.body;
    if (!type) return res.status(400).json({ error: 'Type is required' });

    let totalAmount = 0;
    if (type === 'item_taken') {
      if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });
      // Process each item — deduct stock
      for (const item of items) {
        if (!item.product_name && !item.product_id) continue;
        const product = item.product_id ? await Product.findById(item.product_id) : null;
        if (product) {
          const qty = parseFloat(item.qty) || 0;
          const stock_before = product.stock;
          product.stock = Math.max(0, product.stock - qty);
          await product.save();
          // Create stock movement
          await StockMovement.create({
            product_id: product._id,
            product_name: product.name,
            type: 'outgoing',
            qty,
            qty_unit: item.unit || product.unit || 'pcs',
            stock_before,
            stock_after: product.stock,
            source: 'admin_usage',
            notes: `Admin personal usage: ${description || 'Item taken'}`,
            ist_formatted: formatIST(new Date()),
            created_by: req.user.id,
          });
          item.price = item.price || product.price || 0;
          totalAmount += (item.price * qty);
        } else {
          totalAmount += ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0));
        }
      }
    } else {
      totalAmount = parseFloat(amount) || 0;
      if (totalAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const expense = await AdminExpense.create({
      admin_id: req.user.id,
      type,
      items: type === 'item_taken' ? items : [],
      amount: totalAmount,
      category: category || 'other',
      description: description || '',
      ist_formatted: formatIST(new Date()),
      created_by: req.user.id,
    });

    logActivity(req, {
      action: 'create',
      entity_type: 'admin_expense',
      entity_id: expense._id,
      entity_name: type,
      description: `Admin ${type}: ₹${totalAmount.toFixed(2)}${description ? ' — ' + description : ''}`,
    });

    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /:id — Delete expense (and restore stock if items were taken)
router.delete('/:id', async (req, res) => {
  try {
    const expense = await AdminExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // If items were taken, restore stock
    if (expense.type === 'item_taken' && expense.items.length) {
      for (const item of expense.items) {
        if (item.product_id) {
          const product = await Product.findById(item.product_id);
          if (product) {
            const qty = parseFloat(item.qty) || 0;
            const stock_before = product.stock;
            product.stock += qty;
            await product.save();
            await StockMovement.create({
              product_id: product._id,
              product_name: product.name,
              type: 'incoming',
              qty,
              qty_unit: item.unit || product.unit || 'pcs',
              stock_before,
              stock_after: product.stock,
              source: 'admin_usage',
              notes: 'Admin usage entry deleted — stock restored',
              ist_formatted: formatIST(new Date()),
              created_by: req.user.id,
            });
          }
        }
      }
    }

    await AdminExpense.findByIdAndDelete(req.params.id);

    logActivity(req, {
      action: 'delete',
      entity_type: 'admin_expense',
      entity_id: expense._id,
      entity_name: expense.type,
      description: `Admin expense deleted: ₹${expense.amount}`,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
