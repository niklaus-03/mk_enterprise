const fs = require('fs');
const path = require('path');

const suppliersRoutePath = path.join(__dirname, 'backend', 'routes', 'suppliers.js');
let code = fs.readFileSync(suppliersRoutePath, 'utf-8');

// Update deliveryQuery
const oldDeliveryQueryStr = "let deliveryQuery = { supplier: { $regex: new RegExp(`^${supplier.name}$`, 'i') }, status: { $in: ['delivered'] } };";
const newDeliveryQueryStr = `let deliveryQuery = {
      $or: [
        { supplier: { $regex: new RegExp(\`^\${supplier.name}$\`, 'i') } },
        { "suppliers_data.supplier_name": { $regex: new RegExp(\`^\${supplier.name}$\`, 'i') } }
      ]
      // removed status filter so pending vehicles also show up
    };`;

code = code.replace(oldDeliveryQueryStr, newDeliveryQueryStr);

// Update delivery map logic
const oldMapStr = `      ...deliveries.map(d => {
        let amount = 0;
        d.items.forEach(i => {
          amount += ((parseFloat(i.quantity) || 0) * (parseFloat(i.base_price) || 0));
        });
        return {
          type: 'delivery',
          _id: d._id,
          date: d.delivered_at || d.createdAt,
          amount: amount,
          items: d.items,
          notes: d.notes || d.vehicle_number || d.delivery_type,
          created_by: d.created_by,
          ist_date: d.arrival_date_ist,
          ist_formatted: d.delivered_at_ist || d.expected_arrival_ist,
          payment_status: d.payment_status,
          payment_mode: d.payment_mode
        };
      })`;

const newMapStr = `      ...deliveries.map(d => {
        let amount = 0;
        // Check if new suppliers_data is used
        const sData = d.suppliers_data && d.suppliers_data.find(s => s.supplier_name.toLowerCase() === supplier.name.toLowerCase());
        const itemsToUse = (sData && sData.items && sData.items.length > 0) ? sData.items : d.items;
        
        itemsToUse.forEach(i => {
          amount += ((parseFloat(i.quantity) || 0) * (parseFloat(i.base_price) || 0));
        });
        return {
          type: 'delivery',
          _id: d._id,
          date: d.delivered_at || d.createdAt,
          amount: amount,
          items: itemsToUse,
          notes: d.notes ? \`[\${d.status.toUpperCase()}] \${d.vehicle_number} - \${d.notes}\` : \`[\${d.status.toUpperCase()}] \${d.vehicle_number}\`,
          created_by: d.created_by,
          ist_date: d.arrival_date_ist,
          ist_formatted: d.delivered_at_ist || d.expected_arrival_ist,
          payment_status: d.payment_status,
          payment_mode: d.payment_mode,
          status: d.status
        };
      })`;

if (code.includes("d.items.forEach(i => {")) {
  code = code.replace(oldMapStr, newMapStr);
  fs.writeFileSync(suppliersRoutePath, code);
  console.log('Updated suppliers.js');
} else {
  console.log('Could not find map string in suppliers.js');
}
