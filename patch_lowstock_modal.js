const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Add state variable
const stateInsertionAnchor = "const [productSuggestIdx, setProductSuggestIdx] = useState(null); // which row is open";
if (code.includes(stateInsertionAnchor) && !code.includes('vehicleLowStockModal')) {
  code = code.replace(stateInsertionAnchor, stateInsertionAnchor + "\n  const [vehicleLowStockModal, setVehicleLowStockModal] = useState(null);");
}

// 2. Replace handleFetchLowStock
const oldFetchFuncStart = "const handleFetchLowStock = async (sIdx) => {";
const oldFetchFuncEndStr = "toast.error('Failed to fetch low stock items');\n    }\n  };";

const startIdx = code.indexOf(oldFetchFuncStart);
const endIdx = code.indexOf(oldFetchFuncEndStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFetchFunc = `const handleFetchLowStock = async (sIdx) => {
    try {
      const res = await productApi.getLowStock();
      const lowStockItems = res.data || [];
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
      toast.error('Failed to fetch low stock items');
    }
  };`;
  
  code = code.slice(0, startIdx) + newFetchFunc + code.slice(endIdx + oldFetchFuncEndStr.length);
}

// 3. Add Modal JSX
const modalJsx = `
      {/* Vehicle Low Stock Selection Modal */}
      {vehicleLowStockModal && vehicleLowStockModal.show && (
        <div className="modal-overlay" onClick={() => setVehicleLowStockModal(null)} style={{ padding: '12px' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
            }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3a5c 100%)',
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Select Low Stock Items</div>
              <button
                onClick={() => setVehicleLowStockModal(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff', width: 28, height: 28, borderRadius: 8 }}
              >✕</button>
            </div>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 16px' }}>
              {vehicleLowStockModal.items.map((item, idx) => (
                <div key={item._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <input 
                      type="checkbox" 
                      checked={item.selected}
                      onChange={e => {
                        setVehicleLowStockModal(prev => {
                          const items = [...prev.items];
                          items[idx].selected = e.target.checked;
                          return { ...prev, items };
                        });
                      }}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Qty:</span>
                    <input 
                      type="number" 
                      value={item.orderQty}
                      onChange={e => {
                        setVehicleLowStockModal(prev => {
                          const items = [...prev.items];
                          items[idx].orderQty = Math.max(1, parseInt(e.target.value) || 1);
                          return { ...prev, items };
                        });
                      }}
                      style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, textAlign: 'center' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setVehicleLowStockModal(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
              <button 
                onClick={() => {
                  const selectedItems = vehicleLowStockModal.items.filter(i => i.selected);
                  if (selectedItems.length === 0) {
                    toast('No items selected', { icon: 'ℹ️' });
                    return;
                  }
                  
                  setDeliveryForm(f => {
                    const updated = [...f.suppliers_data];
                    let supplierItems = [...updated[vehicleLowStockModal.supplierIndex].items];
                    
                    if (supplierItems.length === 1 && !supplierItems[0].item_name) {
                      supplierItems = [];
                    }
                    
                    let added = 0;
                    selectedItems.forEach(p => {
                      if (!supplierItems.find(i => i.product_id === p._id)) {
                         supplierItems.push({
                           item_name: p.name,
                           quantity: String(p.orderQty),
                           unit: p.unit || 'pcs',
                           product_id: p._id,
                           base_price: p.supplier_base_price || 0,
                           is_new_item: false,
                           label: 'Goods'
                         });
                         added++;
                      }
                    });
                    
                    updated[vehicleLowStockModal.supplierIndex].items = checkAutoAddRow(supplierItems);
                    if (added > 0) toast.success(\`Added \${added} selected low stock items\`);
                    else toast('Items already in list', { icon: 'ℹ️' });
                    return { ...f, suppliers_data: updated };
                  });
                  setVehicleLowStockModal(null);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >Add Selected to List</button>
            </div>
          </div>
        </div>
      )}
`;

const modalInsertionAnchor = "{/* Low Stock Edit & Send Modal — Redesigned, Fully Responsive */}";
if (code.includes(modalInsertionAnchor) && !code.includes('Vehicle Low Stock Selection Modal')) {
  code = code.replace(modalInsertionAnchor, modalJsx + '\n\n      ' + modalInsertionAnchor);
  fs.writeFileSync(filePath, code);
  console.log('Successfully patched modal into AdminDashboard.js');
} else {
  console.log('Failed to insert modal. Anchor not found or already inserted.');
}
