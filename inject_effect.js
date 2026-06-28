const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf-8');
const lines = code.split('\n');
const insertIndex = lines.findIndex(l => l.includes('const [deliverySaving'));
if (insertIndex !== -1) {
  const effectCode = `
  // Sync selectedSuppliers with deliveryForm.suppliers_data
  useEffect(() => {
    setDeliveryForm(f => {
      let updatedSuppliers = [...(f.suppliers_data || [])];
      
      // Remove unselected
      updatedSuppliers = updatedSuppliers.filter(s => selectedSuppliers.includes(s.supplier_name));
      
      // Add new
      selectedSuppliers.forEach(supplierName => {
        if (!updatedSuppliers.some(s => s.supplier_name === supplierName)) {
          updatedSuppliers.push({
            supplier_name: supplierName,
            cash_given: '',
            purchase_bill_amount: '',
            items: [
              { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods', is_new_item: false }
            ]
          });
        }
      });
      
      return { ...f, suppliers_data: updatedSuppliers };
    });
  }, [selectedSuppliers]);
`;
  lines.splice(insertIndex + 1, 0, effectCode);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.js', lines.join('\n'));
  console.log('Successfully injected selectedSuppliers useEffect!');
}
