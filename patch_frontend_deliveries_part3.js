const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

const supplierStart = code.indexOf(`<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>\n                              {d.vehicle_number === 'WALK-IN'`);
if (supplierStart !== -1) {
  const supplierEnd = code.indexOf('</td>', supplierStart) + 5;
  const newSupplierTD = `<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                              {d.vehicle_number === 'WALK-IN' 
                                ? (d.supplier || '—') 
                                : (
                                  <>
                                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>{d.driver_name || '—'}</div>
                                    {d.suppliers_data && d.suppliers_data.length > 0 ? (
                                      <div style={{ fontSize: 11, marginTop: 2 }}>{d.suppliers_data.map(s => s.supplier_name).join(', ')}</div>
                                    ) : (
                                      d.supplier && <div style={{ fontSize: 11, marginTop: 2 }}>{d.supplier}</div>
                                    )}
                                  </>
                                )}
                            </td>`;
  code = code.slice(0, supplierStart) + newSupplierTD + code.slice(supplierEnd);
} else {
  console.log("Could not find supplierStart");
}

const itemsStart = code.indexOf(`<div style={{ maxWidth: 180 }}>\n                                {d.items.slice(0, 2).map((item, i) => (`);
if (itemsStart !== -1) {
  const containerStart = code.lastIndexOf(`<td style={{ padding: '10px 12px' }}>`, itemsStart);
  const containerEnd = code.indexOf('</td>', itemsStart) + 5;
  
  const newItemsTD = `<td style={{ padding: '10px 12px' }}>
                              <div style={{ maxWidth: 180 }}>
                                {(() => {
                                  const allItems = (d.items || []).concat((d.suppliers_data || []).flatMap(s => s.items || []));
                                  return (
                                    <>
                                      {allItems.slice(0, 2).map((item, i) => (
                                        <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                          {item.item_name}
                                        </div>
                                      ))}
                                      {allItems.length > 2 && (
                                        <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                                          +{allItems.length - 2} more
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>`;
                            
  code = code.slice(0, containerStart) + newItemsTD + code.slice(containerEnd);
} else {
  console.log("Could not find itemsStart");
}

fs.writeFileSync(filePath, code);
console.log('AdminDashboard.js patched part 3!');
