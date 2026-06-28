const fs = require('fs');
const path = require('path');

const deliveryModelPath = path.join(__dirname, 'backend', 'models', 'Delivery.js');
let deliveryModelCode = fs.readFileSync(deliveryModelPath, 'utf-8');

if (!deliveryModelCode.includes('driver_cash:')) {
  deliveryModelCode = deliveryModelCode.replace(
    "driver_name: { type: String, default: '', trim: true },",
    "driver_name: { type: String, default: '', trim: true },\n  driver_cash: { type: Number, default: 0 },\n  driver_expense: { type: Number, default: 0 },"
  );
  fs.writeFileSync(deliveryModelPath, deliveryModelCode);
  console.log('Updated Delivery model.');
} else {
  console.log('Delivery model already updated.');
}

const deliveriesRoutePath = path.join(__dirname, 'backend', 'routes', 'deliveries.js');
let deliveriesRouteCode = fs.readFileSync(deliveriesRoutePath, 'utf-8');

// Update POST route
deliveriesRouteCode = deliveriesRouteCode.replace(
  "const { vehicle_number, driver_name, supplier, expected_arrival, items, suppliers_data, notes, delivery_type, payment_status } = req.body;",
  "const { vehicle_number, driver_name, driver_cash, supplier, expected_arrival, items, suppliers_data, notes, delivery_type, payment_status } = req.body;"
);

let postSupplierMapStr = `      suppliers_data: suppliers_data ? suppliers_data.map(s => ({`;
let postSupplierMapReplacement = `      driver_cash: parseFloat(driver_cash) || 0,
      driver_expense: (parseFloat(driver_cash) || 0) - (suppliers_data ? suppliers_data.reduce((sum, s) => sum + (parseFloat(s.cash_given) || 0), 0) : 0),
      suppliers_data: suppliers_data ? suppliers_data.map(s => ({`;
deliveriesRouteCode = deliveriesRouteCode.replace(postSupplierMapStr, postSupplierMapReplacement);

// Update PUT route
deliveriesRouteCode = deliveriesRouteCode.replace(
  "    const { vehicle_number, driver_name, supplier, expected_arrival, items, suppliers_data, notes, status, payment_status, amount_paid, payment_mode } = req.body;",
  "    const { vehicle_number, driver_name, driver_cash, supplier, expected_arrival, items, suppliers_data, notes, status, payment_status, amount_paid, payment_mode } = req.body;"
);

let putUpdateObjStr = `      if (driver_name !== undefined) updateData.driver_name = driver_name.trim();`;
let putUpdateObjReplacement = `      if (driver_name !== undefined) updateData.driver_name = driver_name.trim();
      if (driver_cash !== undefined) updateData.driver_cash = parseFloat(driver_cash) || 0;
      if (suppliers_data !== undefined || driver_cash !== undefined) {
         const cash = driver_cash !== undefined ? (parseFloat(driver_cash) || 0) : delivery.driver_cash;
         const suppData = suppliers_data !== undefined ? suppliers_data : delivery.suppliers_data;
         updateData.driver_expense = cash - (suppData ? suppData.reduce((sum, s) => sum + (parseFloat(s.cash_given) || 0), 0) : 0);
      }`;
deliveriesRouteCode = deliveriesRouteCode.replace(putUpdateObjStr, putUpdateObjReplacement);

fs.writeFileSync(deliveriesRoutePath, deliveriesRouteCode);
console.log('Updated deliveries route.');
