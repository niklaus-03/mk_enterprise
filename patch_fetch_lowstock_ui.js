const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

// Replace the JSX for Vehicle Low Stock Selection Modal
const startAnchor = "{/* Vehicle Low Stock Selection Modal */}";
const endAnchor = "          </div>\n        </div>\n      )}";

const startIdx = code.indexOf(startAnchor);
const endIdx = code.indexOf(endAnchor, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newModalJsx = `{/* Vehicle Low Stock Selection Modal */}
      {vehicleLowStockModal && vehicleLowStockModal.show && (
        <div className="modal-overlay" onClick={() => setVehicleLowStockModal(null)} style={{ padding: '12px' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 660,
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

            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: '#fff', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder={t('Search items...', 'आइटम खोजें...')} 
                  value={vehicleLowStockModal.search || ''}
                  onChange={e => setVehicleLowStockModal(p => ({ ...p, search: e.target.value }))}
                  style={{ width: '100%', height: 32, paddingLeft: 30, borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <SortDropdown 
                options={[
                  { key: 'all', label: t('All (A-Z)', 'सभी (A-Z)') },
                  { key: 'order', label: t('Order from Customer', 'ग्राहक द्वारा ऑर्डर') },
                  { key: 'low', label: t('Low Stock', 'कम स्टॉक') }
                ]}
                value={vehicleLowStockModal.sort || 'all'}
                onChange={val => setVehicleLowStockModal(p => ({ ...p, sort: p.sort === val ? 'all' : val, sortOpen: false }))}
                open={vehicleLowStockModal.sortOpen}
                onToggle={() => setVehicleLowStockModal(p => ({ ...p, sortOpen: !p.sortOpen }))}
              />
            </div>

            {productLists.length > 0 && vehicleLowStockModal.items?.length > 0 && (
            <div className="hide-scrollbar" style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: '#fafbff', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => setVehicleLowStockModal(p => ({ ...p, activeFilter: null }))}
                style={{ height: 28, flexShrink: 0, padding: '0 14px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', background: vehicleLowStockModal.activeFilter == null ? 'var(--primary)' : '#f1f5f9', color: vehicleLowStockModal.activeFilter == null ? '#ffffff' : '#64748b' }}
                onMouseEnter={e => { if (vehicleLowStockModal.activeFilter != null) e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { if (vehicleLowStockModal.activeFilter != null) e.currentTarget.style.background = '#f1f5f9'; }}
              >
                All Items
              </button>
                {productLists.map(list => {
                  const listProductIds = (list.products || []).map(p => p._id || p);
                  const lowInList = vehicleLowStockModal.items.filter(p => listProductIds.includes(p._id)).length;
                  if (lowInList === 0) return null;
                  const isActive = vehicleLowStockModal.activeFilter === list._id;
                  return (
                    <button
                      key={list._id}
                      onClick={() => setVehicleLowStockModal(p => ({ ...p, activeFilter: isActive ? null : list._id }))}
                      style={{ height: 28, flexShrink: 0, padding: '0 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6, background: isActive ? 'var(--primary)' : '#f1f5f9', color: isActive ? '#ffffff' : '#64748b' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e2e8f0'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                    >
                      {list.name}
                    </button>
                  );
                })}
              </div>
            )}
            
            <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '12px 16px' }}>
              {(() => {
                let indices = vehicleLowStockModal.items.map((_, i) => i);
                indices = indices.filter(i => {
                  const p = vehicleLowStockModal.items[i];
                  if (vehicleLowStockModal.activeFilter) {
                    const lst = productLists.find(l => l._id === vehicleLowStockModal.activeFilter);
                    const inList = lst ? (lst.products || []).some(lp => (lp._id || lp) === p._id) : true;
                    if (!inList) return false;
                  }
                  if (vehicleLowStockModal.search) {
                    const q = vehicleLowStockModal.search.toLowerCase();
                    if (!p.name?.toLowerCase().includes(q)) return false;
                  }
                  return true;
                });

                indices.sort((i, j) => {
                  const a = vehicleLowStockModal.items[i];
                  const b = vehicleLowStockModal.items[j];
                  if (vehicleLowStockModal.sort === 'order') {
                    if (a.created_from_order && !b.created_from_order) return -1;
                    if (!a.created_from_order && b.created_from_order) return 1;
                  } else if (vehicleLowStockModal.sort === 'low') {
                    const aIsOOS = a.stock === 0;
                    const bIsOOS = b.stock === 0;
                    if (aIsOOS && !bIsOOS) return -1;
                    if (!aIsOOS && bIsOOS) return 1;
                  }
                  return (a.name || '').localeCompare(b.name || '', 'hi', { numeric: true });
                });

                if (indices.length === 0) {
                  return <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No items match your filter.</div>;
                }

                return indices.map((idx) => {
                  const item = vehicleLowStockModal.items[idx];
                  return (
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
                  );
                });
              })()}
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
      )}`;

  code = code.slice(0, startIdx) + newModalJsx + code.slice(endIdx + endAnchor.length);
  fs.writeFileSync(filePath, code);
  console.log('Successfully patched vehicleLowStockModal with filters/search!');
} else {
  console.log('Could not find the target JSX in AdminDashboard.js');
}
