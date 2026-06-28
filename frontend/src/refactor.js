const fs = require('fs');
const files = ['c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js', 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/ManagerDashboard.js'];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  if (code.includes('itemsBySupplier')) {
    console.log('Already modified ' + file);
    continue;
  }

  // 1. Add itemsBySupplier to deliveryForm initial state
  code = code.replace(
    /notes: '',\s*items:/,
    "notes: '', itemsBySupplier: {}, items:"
  );
  
  // 2. Add itemsBySupplier clearing on add vehicle
  code = code.replace(
    /setDeliveryForm\(\{\s*vehicle_number: '', driver_name: '', supplier: '',\s*expected_arrival: getNowDateTimeLocal\(\),\s*notes: '',\s*items: \[/g,
    "setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', itemsBySupplier: {}, items: ["
  );

  // 3. Add itemsBySupplier initialization when supplier is selected
  code = code.replace(
    /setSelectedSuppliers\(prev => \[\.\.\.prev, s\.name\]\);/g,
    "setSelectedSuppliers(prev => [...prev, s.name]); setDeliveryForm(f => ({ ...f, itemsBySupplier: { ...f.itemsBySupplier, [s.name]: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] } }));"
  );
  
  code = code.replace(
    /setSelectedSuppliers\(prev => \[\.\.\.prev, newName\]\);/g,
    "setSelectedSuppliers(prev => [...prev, newName]); setDeliveryForm(f => ({ ...f, itemsBySupplier: { ...f.itemsBySupplier, [newName]: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] } }));"
  );

  // 4. Update handleSaveDelivery
  code = code.replace(
    /const payload = \{ \.\.\.deliveryForm, supplier: supplierName, items: filteredItems \};/g,
    "const itemsToSave = (selectedSuppliers.length > 0 && deliveryForm.itemsBySupplier && deliveryForm.itemsBySupplier[supplierName]) ? deliveryForm.itemsBySupplier[supplierName].filter(i => i.item_name).map(i => ({...i, quantity: parseFloat(i.quantity) || 0})) : filteredItems; const payload = { ...deliveryForm, supplier: supplierName, items: itemsToSave };"
  );
  code = code.replace(
    /const payload = \{ \.\.\.deliveryForm, supplier: supplierName, items \};/g,
    "const itemsToSave = (selectedSuppliers.length > 0 && deliveryForm.itemsBySupplier && deliveryForm.itemsBySupplier[supplierName]) ? deliveryForm.itemsBySupplier[supplierName].filter(i => i.item_name).map(i => ({...i, quantity: parseFloat(i.quantity) || 0})) : items; const payload = { ...deliveryForm, supplier: supplierName, items: itemsToSave };"
  );

  fs.writeFileSync(file, code);
  console.log('Processed ' + file);
}
