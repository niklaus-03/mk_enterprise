const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const Settlement = require('../models/Settlement');
const auth = require('../middleware/auth');
const { logActivity } = require('./activityLogs');
const { formatIST } = require('../utils/timeUtils');

router.use(auth);

// ── Ownership filter: managers see only their records ─────────────────────────
function ownerFilter(req, extra = {}) {
  if (req.user && req.user.role === 'manager') {
    return { 
      ...extra, 
      $or: [
        { created_by: req.user.id },
        { shared_with: req.user.id }
      ]
    };
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

// ── POST share via email ──────────────────────────────────────────────────────
router.post('/:id/send-email', async (req, res) => {
  try {
    const { email } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    // Simulate sending email
    console.log(`Sending invoice ${invoice.invoice_number} to ${email}`);
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST share with staff ─────────────────────────────────────────────────────
router.post('/:id/share', async (req, res) => {
  try {
    const { staffIds } = req.body;
    if (!staffIds || !Array.isArray(staffIds)) {
      return res.status(400).json({ error: 'staffIds array is required' });
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    
    // Add to shared_with, avoiding duplicates
    const currentShared = invoice.shared_with || [];
    const newShared = [...new Set([...currentShared.map(id => id.toString()), ...staffIds])];
    invoice.shared_with = newShared;
    await invoice.save();
    
    res.json({ message: 'Invoice shared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST batch share with driver ───────────────────────────────────────────────
router.post('/batch-share', async (req, res) => {
  try {
    const { invoiceIds, driverId } = req.body;
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'invoiceIds array is required' });
    }
    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }

    const driverUser = await Admin.findById(driverId);
    if (!driverUser || driverUser.role !== 'driver') {
      return res.status(400).json({ error: 'Valid driver ID is required' });
    }

    const invoices = await Invoice.find({ _id: { $in: invoiceIds } });
    if (invoices.length === 0) return res.status(404).json({ error: 'No valid invoices found' });

    // Update shared_with for all invoices
    await Promise.all(invoices.map(async (inv) => {
      const currentShared = inv.shared_with || [];
      const newShared = [...new Set([...currentShared.map(id => id.toString()), driverId.toString()])];
      inv.shared_with = newShared;
      await inv.save();
    }));

    // Build bundled payload
    const bundledInvoices = invoices.map(inv => ({
      invoice_id: inv._id,
      customer_name: inv.customer_name,
      customer_phone: inv.customer_phone,
      destination: inv.customer_address,
      amount_to_collect: inv.balance_due > 0 ? inv.balance_due : inv.total,
      total_weight: inv.total_weight || 0,
      items: inv.items.map(item => ({
        goods_type: `${item.product_name} x${item.qty}`,
        weight: item.weight ? parseFloat(item.weight) : 0
      }))
    }));

    // Send single batch notification
    await Notification.create({
      recipient_id: driverUser._id,
      recipient_role: 'driver',
      type: 'driver_dispatch',
      title: `📦 Batch Delivery Dispatch — ${invoices.length} Customers`,
      message: `You have been assigned a batch of ${invoices.length} invoices to deliver.`,
      priority: 'high',
      metadata: { invoices: bundledInvoices }
    });

    res.json({ message: 'Batch dispatch sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
      driver_name = '', vehicle_number = '', total_weight = 0,
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
        
        let stockToUse = product.stock;
        
        // Handle list override if provided
        if (req.body.product_list_id) {
          const ProductList = require('../models/ProductList');
          const list = await ProductList.findById(req.body.product_list_id);
          if (list) {
            const share = list.shares.find(s => s.manager_id.toString() === (req.user ? req.user.id : ''));
            if (share) {
               const override = share.overrides.find(o => o.product_id.toString() === product._id.toString());
               if (override && override.custom_stock !== null) {
                  stockToUse = override.custom_stock;
               }
            }
          }
        }
        
        if (stockToUse < parseFloat(item.qty)) {
          return res.status(400).json({
            error: `Insufficient stock for "${product.name}". Available: ${stockToUse}, Requested: ${item.qty}`,
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

    let amount_received = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    
    // Auto-apply advance balance if customer has any
    if (prevBalance < 0) {
      let advance_applied = Math.min(total, Math.abs(prevBalance));
      if (advance_applied > 0) {
        amount_received += advance_applied;
        payments.push({
          mode: 'advance_credit',
          amount: advance_applied,
          reference: 'Auto-applied from ledger',
          date: new Date()
        });
      }
    }

    const balance_due = Math.max(0, total - amount_received);
    const invoiceDate = bill_date ? new Date(bill_date) : new Date();

    // Fetch current settings for snapshot
    const settingsDoc = await Setting.findOne({ key: 'company_details' });
    const company_details = settingsDoc ? settingsDoc.value : null;

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
      total_weight: parseFloat(total_weight) || 0,
      date: invoiceDate,
      ist_formatted: formatIST(invoiceDate),
      signature: req.body.signature || '',
      company_details: company_details,
      created_by: req.user ? req.user.id : null,
    });
    await invoice.save();

    // Bypass Mongoose strict schema to ensure company_details saves even if server isn't restarted
    if (company_details) {
      await Invoice.collection.updateOne(
        { _id: invoice._id }, 
        { $set: { company_details: company_details } }
      );
    }

    // 5. Deduct stock and log movements sequentially
    for (const item of processedItems) {
      if (item.product_id && item.product_id.toString().length === 24) {
        const product = await Product.findById(item.product_id);
        if (product) {
          const stock_before = product.stock;
          product.stock = Math.max(0, product.stock - item.qty);
          await product.save();
          
          // Deduct from list override custom_stock if applicable
          if (req.body.product_list_id) {
            const ProductList = require('../models/ProductList');
            const list = await ProductList.findById(req.body.product_list_id);
            if (list) {
              const share = list.shares.find(s => s.manager_id.toString() === (req.user ? req.user.id : ''));
              if (share) {
                 const override = share.overrides.find(o => o.product_id.toString() === product._id.toString());
                 if (override && override.custom_stock !== null) {
                    override.custom_stock = Math.max(0, override.custom_stock - item.qty);
                    // Mongoose needs markModified for deep nested arrays sometimes
                    list.markModified('shares');
                    await list.save();
                 }
              }
            }
          }

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
            created_by: req.user ? req.user.id : null,
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

    // 7. Auto-create Settlement records for received payments
    if (payments && payments.length > 0) {
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(invoiceDate.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);

      for (const p of payments) {
        if (parseFloat(p.amount) > 0) {
          await Settlement.create({
            type: 'other_income',
            received_category: 'today_invoice',
            party_name: (customer_name || 'Walk-in Customer').trim(),
            amount: parseFloat(p.amount),
            mode: p.mode || 'cash',
            reference: p.reference || invoice.invoice_number,
            notes: `Auto-recorded from invoice ${invoice.invoice_number}`,
            date: invoiceDate,
            ist_date,
            ist_formatted: formatIST(invoiceDate),
            created_by: req.user ? req.user.id : null,
          });
        }
      }
    }

    res.status(201).json(invoice);

    // Log activity (fire-and-forget, after response)
    logActivity(req, {
      action: 'create',
      entity_type: 'invoice',
      entity_id: invoice._id,
      entity_name: invoice.invoice_number,
      description: `Invoice created for ${invoice.customer_name}. Total: ₹${invoice.total}`,
    });

    // Driver dispatch notification
    if (req.body.send_to_driver && req.body.driver_id) {
      try {
        const driverUser = await Admin.findById(req.body.driver_id);
        if (driverUser) {
          const itemSummary = processedItems.map(i => `${i.product_name} x${i.qty}`).join(', ');
          await Notification.create({
            recipient_id: driverUser._id,
            recipient_role: 'driver',
            type: 'driver_dispatch',
            title: `📦 Delivery Dispatch — ${invoice.invoice_number}`,
            message: `Items: ${itemSummary}. Collect ₹${invoice.balance_due > 0 ? invoice.balance_due : invoice.total} from ${invoice.customer_name}.${invoice.customer_address ? ' Destination: ' + invoice.customer_address : ''} Total Weight: ${invoice.total_weight} kg.`,
            priority: 'high',
            entity_type: 'invoice',
            entity_id: invoice._id,
            metadata: { total_weight: invoice.total_weight }
          });
        }
      } catch (notifErr) {
        console.error('Driver dispatch notification error:', notifErr.message);
      }
    }
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
      customer_id, customer_name, customer_phone, customer_address, total_weight } = req.body;

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
              created_by: req.user ? req.user.id : null,
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
              created_by: req.user ? req.user.id : null,
            });
          }
        }
      }
    }

    // 4. Recalculate totals
    const { processedItems, subtotal, gst_total, total, total_with_prev_balance } =
      buildTotals(items, discount, original.previous_balance, gst_enabled);
    let amount_received = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    // Note: Since this is an edit, we don't automatically pull more advance credit.
    // If they want to use advance credit on edit, they should add a payment manually.
    const balance_due = Math.max(0, total - amount_received);
    const hasReturns = items.some(i => (i.returned_qty || 0) > 0 || i.is_defective);

    // Fetch current settings to update the snapshot on edit
    const Setting = require('../models/Setting');
    const settingsDoc = await Setting.findOne({ key: 'company_details' });
    const company_details = settingsDoc ? settingsDoc.value : null;

    // 5. Update invoice
    const updated = await Invoice.findByIdAndUpdate(req.params.id, {
      customer_id: customer_id || original.customer_id,
      customer_name: customer_name || original.customer_name,
      customer_phone: customer_phone !== undefined ? customer_phone : original.customer_phone,
      customer_address: customer_address !== undefined ? customer_address : original.customer_address,
      total_weight: total_weight !== undefined ? parseFloat(total_weight) || 0 : original.total_weight,
      items: processedItems, subtotal, discount: parseFloat(discount) || 0,
      gst_total, total, total_with_prev_balance, payments, amount_received,
      balance_due, notes, gst_enabled,
      status: hasReturns ? 'partially_returned' : 'edited',
    }, { new: true });

    // Bypass strict schema to ensure snapshot updates on edit
    if (company_details) {
      await Invoice.collection.updateOne(
        { _id: updated._id }, 
        { $set: { company_details: company_details } }
      );
      updated.company_details = company_details;
    }

    // 6. Update customer balance (per-manager ledger)
    const custId = customer_id || original.customer_id;
    if (custId) {
      const cust = await Customer.findById(custId);
      if (cust) {
        const difference = total - original.total;
        if (cust.setManagerBalance) {
          const currentBal = cust.getManagerBalance(req.user.id) || 0;
          cust.setManagerBalance(req.user.id, currentBal + difference);
        } else {
          cust.balance = (cust.balance || 0) + difference;
        }
        await cust.save();
      }
    }

    res.json(updated);

    // Log activity (fire-and-forget)
    logActivity(req, {
      action: 'update',
      entity_type: 'invoice',
      entity_id: updated._id,
      entity_name: updated.invoice_number,
      description: `Invoice edited. New total: ₹${updated.total}${hasReturns ? ' (has returns)' : ''}`,
    });
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
            created_by: req.user ? req.user.id : null,
          });
        }
      }
    }

    // 2. Reverse customer balance (per-manager ledger)
    if (invoice.customer_id) {
      const cust = await Customer.findById(invoice.customer_id);
      if (cust) {
        if (cust.setManagerBalance && invoice.created_by) {
          const currentBal = cust.getManagerBalance(invoice.created_by) || 0;
          cust.setManagerBalance(invoice.created_by, currentBal - invoice.total);
        } else {
          cust.balance = (cust.balance || 0) - invoice.total;
        }
        await cust.save();
      }
    }

    // 3. Mark cancelled
    invoice.status = 'cancelled';
    await invoice.save();

    // Log activity
    await logActivity(req, {
      action: 'delete',
      entity_type: 'invoice',
      entity_id: invoice._id,
      entity_name: invoice.invoice_number,
      description: `Invoice cancelled. Original total: ₹${invoice.total}`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
