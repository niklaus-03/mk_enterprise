const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Initial State
code = code.replace(
  `items: [
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
    ],`,
  `items: [], suppliers_data: [],`
);

// 2. handleSaveDelivery logic
const oldSaveDelivery = `      if (editDeliveryId) {
        // Edit mode: single supplier only
        const payload = { ...deliveryForm, items: filteredItems };
        await deliveryApi.update(editDeliveryId, payload);
        toast.success('Delivery updated');
      } else {
        // Create mode: support multiple suppliers
        const suppliersToSave = selectedSuppliers.length > 0 ? selectedSuppliers : (deliveryForm.supplier.trim() ? [deliveryForm.supplier.trim()] : ['']);
        for (const supplierName of suppliersToSave) {
          const payload = { ...deliveryForm, supplier: supplierName, items: filteredItems };
          const newDelivery = await deliveryApi.create(payload);
          if (payload.vehicle_number && payload.vehicle_number.trim().toUpperCase() === 'WALK-IN') {
            await deliveryApi.updateStatus(newDelivery._id, 'delivered');
          }
        }
        toast.success(suppliersToSave.length > 1 ? \`\${suppliersToSave.length} delivery entries saved for each supplier\` : 'Delivery entry saved');
      }`;

const newSaveDelivery = `      if (editDeliveryId) {
        // Clean items in suppliers_data
        const payload = { 
          ...deliveryForm, 
          suppliers_data: deliveryForm.suppliers_data.map(s => ({
            ...s,
            items: s.items.filter(i => i.item_name).map(i => ({...i, quantity: parseFloat(i.quantity) || 0}))
          }))
        };
        await deliveryApi.update(editDeliveryId, payload);
        toast.success('Delivery updated');
      } else {
        // Create single Delivery entry with multiple suppliers_data
        if (selectedSuppliers.length === 0 && deliveryForm.supplier.trim()) {
           // fallback single supplier
           deliveryForm.suppliers_data = [{
             supplier_name: deliveryForm.supplier.trim(),
             supplier_id: '', cash_given: 0, cash_given_note: '',
             items: deliveryForm.items || []
           }];
        }
        const payload = { 
          ...deliveryForm, 
          suppliers_data: deliveryForm.suppliers_data.map(s => ({
            ...s,
            items: s.items.filter(i => i.item_name).map(i => ({...i, quantity: parseFloat(i.quantity) || 0}))
          }))
        };
        const newDelivery = await deliveryApi.create(payload);
        if (payload.vehicle_number && payload.vehicle_number.trim().toUpperCase() === 'WALK-IN') {
          await deliveryApi.updateStatus(newDelivery._id, 'delivered');
        }
        toast.success('Delivery entry saved');
      }`;

code = code.replace(oldSaveDelivery, newSaveDelivery);

// 3. Reset form
code = code.replace(
  `setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] });`,
  `setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [], suppliers_data: [] });`
);

// 4. openEditDelivery
const oldOpenEdit = `setDeliveryForm({
      vehicle_number: d.vehicle_number,
      driver_name: d.driver_name || '',
      supplier: d.supplier || '',
      expected_arrival: localStr,
      notes: d.notes || '',
      items: d.items.length ? d.items.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, product_id: i.product_id || '' })) : [{ item_name: '', quantity: '', unit: 'unit', product_id: '' }],
    });`;

const newOpenEdit = `
    const hasSuppliersData = d.suppliers_data && d.suppliers_data.length > 0;
    if (hasSuppliersData) {
      setSelectedSuppliers(d.suppliers_data.map(s => s.supplier_name));
    } else if (d.supplier) {
      setSelectedSuppliers([d.supplier]);
    }
    setDeliveryForm({
      vehicle_number: d.vehicle_number,
      driver_name: d.driver_name || '',
      supplier: d.supplier || '',
      expected_arrival: localStr,
      notes: d.notes || '',
      items: [],
      suppliers_data: hasSuppliersData ? d.suppliers_data.map(s => ({
        supplier_name: s.supplier_name,
        supplier_id: s.supplier_id || '',
        cash_given: s.cash_given || '',
        cash_given_note: s.cash_given_note || '',
        is_settled: s.is_settled || false,
        items: s.items?.length ? s.items.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, product_id: i.product_id || '' })) : [{ item_name: '', quantity: '', unit: 'unit', product_id: '' }]
      })) : (d.supplier ? [{
        supplier_name: d.supplier,
        supplier_id: '',
        cash_given: '', cash_given_note: '', is_settled: false,
        items: d.items?.length ? d.items.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, product_id: i.product_id || '' })) : [{ item_name: '', quantity: '', unit: 'unit', product_id: '' }]
      }] : [])
    });`;

code = code.replace(oldOpenEdit, newOpenEdit);

// 5. Add / Remove supplier in UI (Supplier input interactions)
// When selecting a supplier from suggestions:
code = code.replace(
  `if (!selectedSuppliers.includes(s.name)) {
                                  setSelectedSuppliers(prev => [...prev, s.name]);
                                }`,
  `if (!selectedSuppliers.includes(s.name)) {
                                  setSelectedSuppliers(prev => [...prev, s.name]);
                                  setDeliveryForm(f => ({
                                    ...f, 
                                    suppliers_data: [...(f.suppliers_data||[]), { supplier_name: s.name, supplier_id: s._id, cash_given: '', cash_given_note: '', items: [{ item_name: '', quantity: '', unit: 'unit', product_id: '' }] }]
                                  }));
                                }`
);

// When adding new supplier:
code = code.replace(
  `if (newName && !selectedSuppliers.includes(newName)) {
                                  setSelectedSuppliers(prev => [...prev, newName]);
                                }`,
  `if (newName && !selectedSuppliers.includes(newName)) {
                                  setSelectedSuppliers(prev => [...prev, newName]);
                                  setDeliveryForm(f => ({
                                    ...f, 
                                    suppliers_data: [...(f.suppliers_data||[]), { supplier_name: newName, supplier_id: '', cash_given: '', cash_given_note: '', items: [{ item_name: '', quantity: '', unit: 'unit', product_id: '' }] }]
                                  }));
                                }`
);

// When removing a chip:
code = code.replace(
  `onClick={() => setSelectedSuppliers(prev => prev.filter((_, i) => i !== idx))}`,
  `onClick={() => {
                              setSelectedSuppliers(prev => prev.filter((_, i) => i !== idx));
                              setDeliveryForm(f => ({ ...f, suppliers_data: f.suppliers_data.filter((_, i) => i !== idx) }));
                            }}`
);

// Let's rewrite the UI block for Items rendering to map over suppliers_data.
// Since it's large, we'll replace the whole "<div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}> ... " block for Items.

// Wait, I will use a clever replace. I'll define a new function `renderSupplierItems` and replace the original Items map.

fs.writeFileSync(filePath, code);
console.log('AdminDashboard.js patched part 1!');
