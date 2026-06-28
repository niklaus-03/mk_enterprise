const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf-8');

const startStr = "  const handleSaveDelivery = async () => {";
const endStr = "      setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] });";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const replacement = `  const handleSaveDelivery = async () => {
    if (!deliveryForm.vehicle_number) return toast.error('Vehicle number required');
    if (!deliveryForm.expected_arrival) return toast.error('Expected arrival time required');
    
    const hasGlobalItems = deliveryForm.items && deliveryForm.items.some(i => i.item_name && i.item_name.trim());
    const hasSupplierItems = deliveryForm.suppliers_data && deliveryForm.suppliers_data.some(s => s.items && s.items.some(i => i.item_name && i.item_name.trim()));
    
    if (!hasGlobalItems && !hasSupplierItems) {
      return toast.error('Please add at least one item (either globally or under a supplier)');
    }

    setDeliverySaving(true);
    try {
      const filteredItems = deliveryForm.items.filter(i => i.item_name && i.item_name.trim()).map(i => ({
        ...i, quantity: parseFloat(i.quantity) || 0,
      }));
      
      const processedSuppliersData = deliveryForm.suppliers_data ? deliveryForm.suppliers_data.map(s => ({
        ...s,
        items: s.items ? s.items.filter(i => i.item_name && i.item_name.trim()).map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 })) : []
      })) : [];

      if (editDeliveryId) {
        // Edit mode
        const payload = { ...deliveryForm, items: filteredItems, suppliers_data: processedSuppliersData };
        await deliveryApi.update(editDeliveryId, payload);
        toast.success('Delivery updated');
      } else {
        // Create mode
        const payload = { 
          ...deliveryForm, 
          supplier: selectedSuppliers.length > 0 ? selectedSuppliers.join(', ') : deliveryForm.supplier.trim(),
          items: filteredItems, 
          suppliers_data: processedSuppliersData 
        };
        const newDelivery = await deliveryApi.create(payload);
        if (payload.vehicle_number && payload.vehicle_number.trim().toUpperCase() === 'WALK-IN') {
          await deliveryApi.updateStatus(newDelivery._id, 'delivered');
        }
        toast.success('Delivery entry saved');
      }

      if (deliveryForm.vehicle_number) {
        const freshV = (() => { try { return JSON.parse(localStorage.getItem('mk_custom_vehicles') || '[]'); } catch { return []; } })();
        if (!freshV.includes(deliveryForm.vehicle_number.trim())) {
          const updated = [...freshV, deliveryForm.vehicle_number.trim()];
          setSavedVehicles(updated);
          localStorage.setItem('mk_custom_vehicles', JSON.stringify(updated));
        }
      }
      if (deliveryForm.driver_name) {
        const freshD = (() => { try { return JSON.parse(localStorage.getItem('mk_custom_drivers') || '[]'); } catch { return []; } })();
        if (!freshD.includes(deliveryForm.driver_name.trim())) {
          const updated = [...freshD, deliveryForm.driver_name.trim()];
          setSavedDrivers(updated);
          localStorage.setItem('mk_custom_drivers', JSON.stringify(updated));
        }
      }

`;

code = code.slice(0, startIndex) + replacement + code.slice(endIndex);

fs.writeFileSync('frontend/src/pages/AdminDashboard.js', code);
console.log('Successfully patched handleSaveDelivery');
