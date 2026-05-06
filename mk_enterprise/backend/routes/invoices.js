const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const auth = require('../middleware/auth');
const { formatIST } = require('../utils/timeUtils');

router.use(auth);

// ── Ownership filter: managers see only their records ─────────────────────────
function ownerFilter(req, extra = {}) {
  if (req.user && req.user.role === 'manager') {
    return { ...extra, created_by: req.user.id };
  }
  return extra;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcItem(item, gstEnabled) {
  const qty = parseFloat(item.qty) || 0;
  const price = parseFloat(item.price) || 0;
  const gst = gstEnabled ? (parseFloat(item.gst) || 0) : 0;
  const taxable_amount = qty * price;
  const gst_amount = (taxable_amount * gst) / 100;
  const cgst = gst_amount / 2;
  const sgst = gst_amount / 2;
  const adjustment = parseFloat(item.adjustment) || 0;
  const total = Math.max(0, taxable_amount + gst_amount - adjustment);
  return { ...item, qty, price, gst, taxable_amount, cgst, sgst, total };
}

function buildTotals(items, discount, prevBalance, gstEnabled) {
  let subtotal = 0, gst_total = 0;
  const processedItems = items.map(i => {
    const ci = calcItem(i, gstEnabled);
    subtotal += ci.taxable_amount;
    gst_total += (ci.cgst + ci.sgst);
    return ci;
  });
  const dis = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal + gst_total - dis);
  const total_with_prev_balance = total + (parseFloat(prevBalance) || 0);
  return { processedItems, subtotal, gst_total, total, total_with_prev_balance };
}

// ── GET all invoices ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { limit = 50, page = 1, customer_id, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = ownerFilter(req, { status: { $ne: 'cancelled' } });
    if (customer_id) query.customer_id = customer_id;
    if (search) query.$or = [
      { customer_name: { $regex: search, $options: 'i' } },
      { invoice_number: { $regex: search, $options: 'i' } },
    ];
    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Invoice.countDocuments(query),
    ]);
    res.json({ invoices, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET single invoice ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST create invoice (no transactions) ─────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const now = new Date();
    const istDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    req.body.ist_formatted = istDate.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const {
      customer_id, customer_name, customer_phone, customer_address,
      items, payments = [], discount = 0, notes = '', concession_reason = '',
      gst_enabled = true, discount_enabled = false,
      bill_date, is_manual_bill = false, manual_bill_ref = '',
      driver_name = '', vehicle_number = '',
      vehicle_charge = 0, labour_charge = 0,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'At least one item required' });
    }

    // 1. Get previous customer balance (per-manager)
    let prevBalance = 0;
    let customer = null;
    if (customer_id) {
      customer = await Customer.findById(customer_id);
      if (customer) {
        // Use per-manager balance if available, fallback to global
        prevBalance = customer.getManagerBalance
          ? customer.getManagerBalance(req.user.id)
          : customer.balance;
      }
    }

    // 2. Auto-create new products & validate stock
    for (const item of items) {
      // Clean up empty product_id strings to null
      if (!item.product_id || item.product_id === '') {
        item.product_id = null;
      }

      // Auto-create new product if flagged
      if (item.is_new_product && !item.product_id) {
        const qty = parseFloat(item.qty) || 1;
        const basePrice = parseFloat(item.price) || 0;
        const gstRate = gst_enabled ? (parseFloat(item.gst) || 0) : 0;
        // Store price as final price per unit (base + tax)
        const finalPricePerUnit = basePrice + (basePrice * gstRate / 100);

        const newProduct = await Product.create({
          name: item.product_name,
          price: parseFloat(finalPricePerUnit.toFixed(2)),
          stock: qty,  // default stock = qty being sold (will become 0 after deduction)
          gst: gstRate,
          unit: item.unit || 'pcs',
          created_by: req.user.id,
        });
        item.product_id = newProduct._id;
        item.is_new_product = false;
      }

      if (item.product_id) {
        const product = await Product.findById(item.product_id);
        if (!product) {
          return res.status(400).json({ error: `Product not found: ${item.product_name}` });
        }
        if (product.stock < parseFloat(item.qty)) {
          return res.status(400).json({
            error: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.qty}`,
          });
        }
      }
    }

    // 3. Calculate totals (vehicle charge added to grand total)
    const { processedItems, subtotal, gst_total, total: itemsTotal, total_with_prev_balance: baseTotal } =
      buildTotals(items, discount, prevBalance, gst_enabled);

    const vc = parseFloat(vehicle_charge) || 0;
    const lc = parseFloat(labour_charge) || 0;
    const total = itemsTotal + vc + lc;
    const total_with_prev_balance = baseTotal + vc + lc;

    const amount_received = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const balance_due = total_with_prev_balance - amount_received;
    const invoiceDate = bill_date ? new Date(bill_date) : new Date();

    // 4. Create invoice
    const invoice = new Invoice({
      customer_id: customer_id || null,
      customer_name: customer_name || 'Walk-in Customer',
      customer_phone: customer_phone || '',
      customer_address: customer_address || '',
      previous_balance: prevBalance,
      items: processedItems,
      subtotal,
      discount: parseFloat(discount) || 0,
      gst_total,
      vehicle_charge: vc,
      labour_charge: lc,
      total,
      total_with_prev_balance,
      payments,
      amount_received,
      balance_due,
      notes,
      concession_reason,
      gst_enabled,
      discount_enabled,
      is_manual_bill,
      manual_bill_ref,
      driver_name,
      vehicle_number,
      date: invoiceDate,
      ist_formatted: formatIST(invoiceDate),
      signature: req.body.signature || '',
      created_by: req.user ? req.user.id : null,
    });
    await invoice.save();

    // 5. Deduct stock and log movements sequentially
    for (const item of processedItems) {
      if (item.product_id && item.product_id.toString().length === 24) {
        const product = await Product.findById(item.product_id);
        if (product) {
          const stock_before = product.stock;
          product.stock = Math.max(0, product.stock - item.qty);
          await product.save();
          await StockMovement.create({
            product_id: product._id,
            product_name: product.name,
            type: 'outgoing',
            qty: item.qty,
            qty_unit: product.unit || 'pcs',
            stock_before,
            stock_after: product.stock,
            reference: invoice._id.toString(),
            source: 'invoice',
            vehicle_number: vehicle_number || '',
            driver_name: driver_name || '',
            ist_formatted: formatIST(invoiceDate),
          });
        }
      }
    }

    // 6. Update customer balance (per-manager ledger)
    if (customer) {
      if (customer.setManagerBalance) {
        customer.setManagerBalance(req.user.id, balance_due);
      } else {
        customer.balance = balance_due;
      }
      await customer.save();
    }

    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PUT edit invoice (no transactions) ────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const original = await Invoice.findById(req.params.id);
    if (!original) return res.status(404).json({ error: 'Invoice not found' });
    if (original.status === 'cancelled') return res.status(400).json({ error: 'Cannot edit a cancelled invoice' });

    const { items, payments = [], discount = 0, notes = '', concession_reason = '', gst_enabled = true,
      customer_id, customer_name, customer_phone, customer_address } = req.body;

    // 1. Restore stock from original items
    for (const old of original.items) {
      if (old.product_id) {
        const product = await Product.findById(old.product_id);
        if (product) {
          const netDeducted = old.qty - (old.returned_qty || 0);
          if (netDeducted > 0) {
            const stock_before = product.stock;
            product.stock += netDeducted;
            await product.save();
            await StockMovement.create({
              product_id: product._id, product_name: product.name, type: 'incoming', qty: netDeducted,
              stock_before, stock_after: product.stock, reference: original._id.toString(),
              source: 'return', notes: 'Invoice edit - restoring stock', ist_formatted: formatIST(new Date()),
            });
          }
        }
      }
    }

    // 2. Validate new stock before deducting
    for (const item of items) {
      if (item.product_id) {
        const product = await Product.findById(item.product_id);
        if (!product) return res.status(400).json({ error: `Product not found: ${item.product_name}` });
        const netQty = (parseFloat(item.qty) || 0) - (parseFloat(item.returned_qty) || 0);
        if (netQty > 0 && product.stock < netQty) {
          return res.status(400).json({ error: `Insufficient stock for "${product.name}". Available: ${product.stock}` });
        }
      }


    }

    

    // 3. Deduct new stock
    for (const item of items) {
      if (item.product_id) {
        const product = await Product.findById(item.product_id);
        if (product) {
          const netQty = (parseFloat(item.qty) || 0) - (parseFloat(item.returned_qty) || 0);
          if (netQty > 0) {
            const stock_before = product.stock;
            product.stock -= netQty;
            await product.save();
            await StockMovement.create({
              product_id: product._id, product_name: product.name, type: 'outgoing', qty: netQty,
              stock_before, stock_after: product.stock, reference: original._id.toString(),
              source: 'invoice', notes: 'Invoice edited', ist_formatted: formatIST(new Date()),
            });
          }
        }
      }
    }

    // 4. Recalculate totals
    const { processedItems, subtotal, gst_total, total, total_with_prev_balance } =
      buildTotals(items, discount, original.previous_balance, gst_enabled);
    const amount_received = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const balance_due = total_with_prev_balance - amount_received;
    const hasReturns = items.some(i => (i.returned_qty || 0) > 0 || i.is_defective);

    // 5. Update invoice
    const updated = await Invoice.findByIdAndUpdate(req.params.id, {
      customer_id: customer_id || original.customer_id,
      customer_name: customer_name || original.customer_name,
      customer_phone: customer_phone !== undefined ? customer_phone : original.customer_phone,
      customer_address: customer_address !== undefined ? customer_address : original.customer_address,
      items: processedItems, subtotal, discount: parseFloat(discount) || 0,
      gst_total, total, total_with_prev_balance, payments, amount_received,
      balance_due, notes, gst_enabled,
      status: hasReturns ? 'partially_returned' : 'edited',
    }, { new: true });

    // 6. Update customer balance (per-manager ledger)
    const custId = customer_id || original.customer_id;
    if (custId) {
      const cust = await Customer.findById(custId);
      if (cust) {
        if (cust.setManagerBalance) {
          cust.setManagerBalance(req.user.id, balance_due);
        } else {
          cust.balance = balance_due;
        }
        await cust.save();
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE cancel invoice (no transactions) ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    // 1. Restore stock
    for (const item of invoice.items) {
      if (item.product_id) {
        const product = await Product.findById(item.product_id);
        if (product) {
          const netQty = item.qty - (item.returned_qty || 0);
          const stock_before = product.stock;
          product.stock += netQty;
          await product.save();
          await StockMovement.create({
            product_id: product._id, product_name: product.name, type: 'incoming', qty: netQty,
            stock_before, stock_after: product.stock, reference: invoice._id.toString(),
            source: 'return', notes: 'Invoice cancelled', ist_formatted: formatIST(new Date()),
          });
        }
      }
    }

    // 2. Reverse customer balance (per-manager ledger)
    if (invoice.customer_id) {
      const cust = await Customer.findById(invoice.customer_id);
      if (cust) {
        if (cust.setManagerBalance && invoice.created_by) {
          cust.setManagerBalance(invoice.created_by, invoice.previous_balance);
        } else {
          cust.balance = invoice.previous_balance;
        }
        await cust.save();
      }
    }

    // 3. Mark cancelled
    invoice.status = 'cancelled';
    await invoice.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
