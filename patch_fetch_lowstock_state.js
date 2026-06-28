const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

const oldFuncStart = 'const handleFetchLowStock = async (sIdx) => {';
const oldFuncEnd = 'toast.error(\'Failed to fetch low stock items\');\n    }\n  };';

const startIdx = code.indexOf(oldFuncStart);
const endIdx = code.indexOf(oldFuncEnd, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFunc = `const handleFetchLowStock = (sIdx) => {
    try {
      // Use the pre-fetched low stock items from the dashboard state
      const lowStockItems = data.lowStockProducts || [];
      if (lowStockItems.length === 0) {
        toast('No low stock items found', { icon: 'ℹ️' });
        return;
      }
      
      const itemsWithSelection = lowStockItems.map(p => ({
        ...p,
        selected: true,
        orderQty: p.saved_order_qty > 0 ? p.saved_order_qty : 1
      }));
      
      setVehicleLowStockModal({
        show: true,
        items: itemsWithSelection,
        supplierIndex: sIdx
      });
    } catch(err) {
      toast.error('Failed to prepare low stock items');
    }
  };`;
  
  code = code.slice(0, startIdx) + newFunc + code.slice(endIdx + oldFuncEnd.length);
  fs.writeFileSync(filePath, code);
  console.log('Successfully patched handleFetchLowStock to use data.lowStockProducts.');
} else {
  console.log('Failed to find handleFetchLowStock bounds.');
}
