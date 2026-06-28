const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

const targetHtml = `<span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>`;

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

// Insert the function if it doesn't exist
if (!code.includes('const handleFetchLowStock = async')) {
  const functionAnchor = 'const searchSuppliers = async (q) => {';
  const functionAnchorIdx = code.indexOf(functionAnchor);
  if (functionAnchorIdx !== -1) {
    code = code.slice(0, functionAnchorIdx) + fetchFunctionStr + code.slice(functionAnchorIdx);
  }
}

const buttonHtml = `
                          <button 
                            type="button"
                            onClick={() => handleFetchLowStock(sIdx)}
                            style={{ padding: '6px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginRight: 12 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                            Fetch Low Stock
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
`;

if (code.includes(targetHtml) && !code.includes('handleFetchLowStock(sIdx)')) {
  code = code.replace(targetHtml, buttonHtml);
  fs.writeFileSync(filePath, code);
  console.log('Added Fetch Low Stock button to AdminDashboard.js');
} else {
  console.log('Could not find target html or already patched.');
}
