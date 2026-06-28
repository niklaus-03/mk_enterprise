const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'routes', 'deliveries.js');
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Add Supplier and Settlement models to imports if not there
if (!code.includes("const Settlement = require('../models/Settlement');")) {
  code = code.replace(
    "const Admin = require('../models/Admin');",
    "const Admin = require('../models/Admin');\nconst Settlement = require('../models/Settlement');\nconst Supplier = require('../models/Supplier');"
  );
}

// 2. Patch POST /api/deliveries
code = code.replace(
  `const { vehicle_number, driver_name, supplier, expected_arrival, items, notes, delivery_type, payment_status } = req.body;`,
  `const { vehicle_number, driver_name, supplier, expected_arrival, items, suppliers_data, notes, delivery_type, payment_status } = req.body;`
);

code = code.replace(
  `if (!vehicle_number || !expected_arrival || !items?.length) {
      return res.status(400).json({ error: 'vehicle_number, expected_arrival, and items are required' });
    }`,
  `if (!vehicle_number || !expected_arrival || (!items?.length && !suppliers_data?.length)) {
      return res.status(400).json({ error: 'vehicle_number, expected_arrival, and items/suppliers are required' });
    }`
);

// Map suppliers_data for DB
const deliveryCreateBlock = `const delivery = await Delivery.create({
      vehicle_number: vehicle_number.trim(),
      driver_name: (driver_name || '').trim(),
      supplier: (supplier || '').trim(),
      expected_arrival: arrivalDate,
      expected_arrival_ist: formatISTDateTime(arrivalDate),
      arrival_date_ist: getISTDateStr(arrivalDate),
      items: items ? items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit || 'pcs',
        product_id: i.product_id || null,
        base_price: parseFloat(i.base_price) || 0,
        final_price: parseFloat(i.final_price) || 0,
      })) : [],
      suppliers_data: suppliers_data ? suppliers_data.map(s => ({
        supplier_name: s.supplier_name,
        supplier_id: s.supplier_id || null,
        cash_given: parseFloat(s.cash_given) || 0,
        cash_given_note: s.cash_given_note || '',
        is_settled: false,
        items: s.items ? s.items.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || 'pcs',
          product_id: i.product_id || null,
          base_price: parseFloat(i.base_price) || 0,
          final_price: parseFloat(i.final_price) || 0,
        })) : []
      })) : [],
      notes: (notes || '').trim(),
      delivery_type: delivery_type || 'vehicle_incoming',
      payment_status: payment_status || 'unpaid',
      created_by: req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null,
    });`;

code = code.replace(
  /const delivery = await Delivery\.create\({[\s\S]*?created_by:.*?,?\s*\}\);/,
  deliveryCreateBlock
);

// Process settlements after delivery create
const settlementLogic = `
    // Process cash_given settlements
    if (delivery.suppliers_data && delivery.suppliers_data.length > 0) {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);
      
      let needsSave = false;
      for (let s of delivery.suppliers_data) {
        if (s.cash_given > 0 && !s.is_settled) {
          // Create settlement
          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: s.supplier_name,
            amount: s.cash_given,
            mode: 'cash',
            notes: s.cash_given_note || 'Cash given by driver before transit',
            date: now,
            ist_date,
            ist_formatted: formatIST(now), // requires formatIST in scope, check imports!
            created_by: delivery.created_by
          });
          
          // Deduct from supplier balance
          if (s.supplier_id) {
            await Supplier.findByIdAndUpdate(s.supplier_id, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          } else {
            // fallback by name
            await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          }
          
          s.is_settled = true;
          needsSave = true;
        }
      }
      if (needsSave) await delivery.save();
    }
`;

code = code.replace(
  `const isWalkin = delivery.vehicle_number === 'WALK-IN' || delivery.delivery_type === 'walkin_delivery';`,
  settlementLogic + `\n    const isWalkin = delivery.vehicle_number === 'WALK-IN' || delivery.delivery_type === 'walkin_delivery';`
);

// For itemSummary, include suppliers_data items
code = code.replace(
  `const amountStr = items.reduce((sum, item) => sum + ((parseFloat(item.base_price) || 0) * (parseFloat(item.quantity) || 0)), 0);`,
  `const allItems = (items || []).concat((suppliers_data || []).flatMap(s => s.items || []));\n    const amountStr = allItems.reduce((sum, item) => sum + ((parseFloat(item.base_price) || 0) * (parseFloat(item.quantity) || 0)), 0);`
);

code = code.replace(
  `const itemSummary = items.map(i => \`\${i.item_name} x\${i.quantity}\`).join(', ');`,
  `const itemSummary = allItems.map(i => \`\${i.item_name} x\${i.quantity}\`).join(', ');`
);


// 3. Patch PUT /api/deliveries/:id
code = code.replace(
  `const { vehicle_number, driver_name, supplier, expected_arrival, items, notes } = req.body;`,
  `const { vehicle_number, driver_name, supplier, expected_arrival, items, suppliers_data, notes } = req.body;`
);

const putSupplierDataBlock = `
    if (suppliers_data?.length) {
      delivery.suppliers_data = suppliers_data.map(s => ({
        supplier_name: s.supplier_name,
        supplier_id: s.supplier_id || null,
        cash_given: parseFloat(s.cash_given) || 0,
        cash_given_note: s.cash_given_note || '',
        is_settled: s.is_settled || false,
        items: s.items ? s.items.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit || 'pcs',
          product_id: i.product_id || null,
          weight: parseFloat(i.weight) || 0,
          base_price: parseFloat(i.base_price) || 0,
          quintal_charge: parseFloat(i.quintal_charge) || 0,
          supplier_charge_per_item: parseFloat(i.supplier_charge_per_item) || 0,
          gst: parseFloat(i.gst) || 0,
          final_price: parseFloat(i.final_price) || 0,
          final_stock: i.final_stock != null ? parseFloat(i.final_stock) : null,
          label: i.label || 'Goods',
          is_new_item: i.is_new_item || false,
        })) : []
      }));
    }
`;

code = code.replace(
  `    if (items?.length) {`,
  putSupplierDataBlock + `\n    if (items?.length) {`
);

// We need to do settlements in PUT too if they changed
const putSettlementLogic = `
    await delivery.save();
    
    // Process cash_given settlements for PUT
    if (delivery.suppliers_data && delivery.suppliers_data.length > 0) {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + IST_OFFSET_MS);
      const ist_date = istDate.toISOString().slice(0, 10);
      
      let needsSave = false;
      for (let s of delivery.suppliers_data) {
        if (s.cash_given > 0 && !s.is_settled) {
          // Create settlement
          const userId = req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null;
          await Settlement.create({
            type: 'paid_to_supplier',
            party_name: s.supplier_name,
            amount: s.cash_given,
            mode: 'cash',
            notes: s.cash_given_note || 'Cash given by driver before transit',
            date: now,
            ist_date,
            ist_formatted: formatIST(now),
            created_by: userId
          });
          
          if (s.supplier_id) {
            await Supplier.findByIdAndUpdate(s.supplier_id, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          } else {
            await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {
              $inc: { balance: -Math.abs(s.cash_given) }
            });
          }
          
          s.is_settled = true;
          needsSave = true;
        }
      }
      if (needsSave) await delivery.save();
    }
`;

code = code.replace(
  `    await delivery.save();\n    res.json(delivery);`,
  putSettlementLogic + `\n    res.json(delivery);`
);

fs.writeFileSync(filePath, code);
console.log('deliveries.js patched successfully!');
