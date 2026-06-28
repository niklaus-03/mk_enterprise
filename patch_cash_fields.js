const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf-8');

// 1. Remove driver_cash from the Items Header Flex
// The exact structure is:
/*
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
                        <input className="form-control" type="number"
                          value={deliveryForm.driver_cash}
                          onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                          placeholder="Amount ₹"
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 500, width: 100, boxSizing: 'border-box', margin: 0 }} />
                      </div>
                      <div style={{ position: 'relative' }}>
*/

const oldDriverCashBlock = `<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
                        <input className="form-control" type="number"
                          value={deliveryForm.driver_cash}
                          onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                          placeholder="Amount ₹"
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 500, width: 100, boxSizing: 'border-box', margin: 0 }} />
                      </div>
                      <div style={{ position: 'relative' }}>`;

code = code.replace(oldDriverCashBlock, `<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>\n                      <div style={{ position: 'relative' }}>`);

// 2. Add driver_cash to the Top Grid (just before Expected Arrival Date)
const expectedArrivalMatch = `<div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`;

const newDriverCashBlock = `<div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advance Cash Given (to driver)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: '#64748b' }}>₹</span>
                      <input className="form-control" type="number"
                        value={deliveryForm.driver_cash}
                        onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                        placeholder="Amount"
                        style={{ padding: '12px 16px 12px 30px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`;

code = code.replace(expectedArrivalMatch, newDriverCashBlock);


// 3. Add DISTRIBUTE ADVANCE CASH logic below the top grid
const itemsBlockStartMatch = `<div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>`;

const distributeCashBlock = `              {selectedSuppliers.length > 0 && (
                <div style={{ background: '#fffbeb', padding: '16px 20px', borderRadius: 16, border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>Advance Cash Given</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {selectedSuppliers.map(supplierName => (
                    <div key={supplierName} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', padding: '8px 12px', borderRadius: 8, border: '1px solid #fcd34d' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>{supplierName}:</span>
                      <input 
                        type="number"
                        className="form-control"
                        placeholder="₹ Amount"
                        value={deliveryForm.suppliers_data?.find(s => s.supplier_name === supplierName)?.cash_given || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setDeliveryForm(f => {
                            const updatedData = [...(f.suppliers_data || [])];
                            const idx = updatedData.findIndex(s => s.supplier_name === supplierName);
                            if (idx >= 0) {
                              updatedData[idx] = { ...updatedData[idx], cash_given: val };
                            } else {
                              updatedData.push({ supplier_name: supplierName, cash_given: val, purchase_bill_amount: '' });
                            }
                            return { ...f, suppliers_data: updatedData };
                          });
                        }}
                        style={{ width: 100, padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  ))}
                  </div>
                </div>
              )}

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>`;

code = code.replace(itemsBlockStartMatch, distributeCashBlock);

fs.writeFileSync('frontend/src/pages/AdminDashboard.js', code);
