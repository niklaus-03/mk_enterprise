const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

const fetchFunctionStr = `
  const handleFetchLowStock = async (sIdx) => {
    try {
      const res = await productApi.getLowStock();
      const lowStockItems = res.data || [];
      if (lowStockItems.length === 0) {
        toast('No low stock items found', { icon: 'ℹ️' });
        return;
      }
      setDeliveryForm(f => {
        const updated = [...f.suppliers_data];
        let supplierItems = [...updated[sIdx].items];
        
        // Remove empty row if it's the only one
        if (supplierItems.length === 1 && !supplierItems[0].item_name) {
          supplierItems = [];
        }
        
        let added = 0;
        lowStockItems.forEach(p => {
          if (!supplierItems.find(i => i.product_id === p._id)) {
             supplierItems.push({
               item_name: p.name,
               quantity: p.saved_order_qty > 0 ? String(p.saved_order_qty) : '1',
               unit: p.unit || 'pcs',
               product_id: p._id,
               base_price: p.supplier_base_price || 0,
               is_new_item: false,
               label: 'Goods'
             });
             added++;
          }
        });
        
        updated[sIdx].items = checkAutoAddRow(supplierItems);
        if (added > 0) toast.success(\`Added \${added} low stock items\`);
        else toast('Items already in list', { icon: 'ℹ️' });
        return { ...f, suppliers_data: updated };
      });
    } catch(err) {
      toast.error('Failed to fetch low stock items');
    }
  };
`;

const anchor = 'const searchSuppliers = (q) => {';
if (code.includes(anchor) && !code.includes('const handleFetchLowStock = async')) {
  code = code.replace(anchor, fetchFunctionStr + '\n  ' + anchor);
  fs.writeFileSync(filePath, code);
  console.log('Inserted handleFetchLowStock correctly.');
} else {
  console.log('Anchor not found or already inserted.');
}
