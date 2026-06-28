const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');
const lines = code.split('\n');

const newSupplierCode = `                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
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

const newItemsCode = `                            <td style={{ padding: '10px 12px' }}>
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

// splice lines 1948 (0-indexed 1948) through 1957
lines.splice(1948, 10, newSupplierCode);
// wait, line numbers changed since I just spliced! Let's write the whole content first.
let joinedCode = lines.join('\n');
fs.writeFileSync(filePath, joinedCode);

// now read again
let newLines = fs.readFileSync(filePath, 'utf-8').split('\n');
// We need to find the items column start
const itemsStart = newLines.findIndex(line => line.includes('<div style={{ maxWidth: 180 }}>')) - 1;
if (itemsStart > 0) {
    newLines.splice(itemsStart, 14, newItemsCode);
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log('AdminDashboard.js patched part 3 by line numbers!');
} else {
    console.log("Could not find items start");
}

