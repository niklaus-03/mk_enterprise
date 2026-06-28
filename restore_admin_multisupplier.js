const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Supplier label and driver cash
code = code.replace(
  /<label style=\{\{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' \}\}>Supplier \/ Party Name \*<\/label>/g,
  `<label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
    Supplier / Party Name {selectedSuppliers.length > 0 ? <span style={{ textTransform: 'none', fontWeight: 500 }}>(select multiple)</span> : '*'}
  </label>`
);

const expectedArrivalInputBlock = `<div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`;

const cashGivenInputBlock = `<div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advance Cash Given (to driver)</label>
                    <input className="form-control" type="number"
                      value={deliveryForm.driver_cash || ''}
                      onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                      placeholder="Amount ₹"
                      style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`;

if (!code.includes("Advance Cash Given (to driver)")) {
  code = code.replace(expectedArrivalInputBlock, cashGivenInputBlock);
}

// 2. Visually distinct item sections
const itemsHeaderBlock = `<h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={18} style={{ color: '#0ea5e9' }} /> Items
                    </h4>
                    <div style={{ position: 'relative' }}>
                      <button type="button" onClick={() => setShowLowStockModal(true)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fetch from Low Stock</button>
                    </div>`;

const newItemsHeaderBlock = `<h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={18} style={{ color: '#0ea5e9' }} /> Items {selectedSuppliers.length > 0 ? \`for \${selectedSuppliers.join(', ')}\` : ''}
                    </h4>
                    <div style={{ position: 'relative' }}>
                      <button type="button" onClick={() => setShowLowStockModal(true)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fetch from Low Stock</button>
                    </div>`;

if (!code.includes("Items {selectedSuppliers.length > 0")) {
  code = code.replace(itemsHeaderBlock, newItemsHeaderBlock);
}

// Group items loop
const mapBlockRegex = /\{deliveryForm\.items\.map\(\(item, idx\) => \{[\s\S]*?return \([\s\S]*?<div key=\{idx\}[^>]*>[\s\S]*?<\/div>\s*\);\s*\}\)\}/;
const mapMatch = code.match(mapBlockRegex);
if (mapMatch && !code.includes("Items for {supp}")) {
  const originalMapBlock = mapMatch[0];
  const itemRowJSX = originalMapBlock.replace('{deliveryForm.items.map((item, idx) => {', '').replace(/}\s*\)$/, '');
  
  const groupedMapBlock = `{selectedSuppliers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {selectedSuppliers.map(supp => {
                       const sData = deliveryForm.suppliers_data?.find(s => s.supplier_name === supp) || {};
                       return (
                      <div key={supp} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={18} style={{ color: '#0ea5e9' }} /> Items for {supp}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
                            <input className="form-control" type="number"
                              value={sData.advance_cash || ''}
                              onChange={e => {
                                setDeliveryForm(f => {
                                  const nd = [...(f.suppliers_data || [])];
                                  const i = nd.findIndex(x => x.supplier_name === supp);
                                  if (i >= 0) nd[i].advance_cash = e.target.value;
                                  return { ...f, suppliers_data: nd };
                                });
                              }}
                              placeholder="Amount ₹"
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 500, width: 100, boxSizing: 'border-box', margin: 0 }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {deliveryForm.items.map((item, idx) => {
                             if (item.supplier_name !== supp) return null;
                             ${itemRowJSX}
                          })}
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    ${originalMapBlock}
                  </div>
                )}`;
  code = code.replace(originalMapBlock, groupedMapBlock);
}

fs.writeFileSync(file, code);
console.log('Successfully applied multi-supplier UI to AdminDashboard.js!');
