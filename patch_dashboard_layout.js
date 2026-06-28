const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(file, 'utf-8');

// 1. Fix the Calendar button corruption
const brokenCal = `<Calendar size={13} /> {new Date(deliveryForm.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    )}
                  </div>`;

const fixedCal = `>✓ OK</button>
                      )}
                    </div>
                    {deliveryForm.expected_arrival && (
                      <div style={{ fontSize: 11, color: '#10b981', marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={13} /> {new Date(deliveryForm.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    )}
                  </div>`;

if (code.includes(brokenCal)) {
  code = code.replace(brokenCal, fixedCal);
  console.log("Fixed corrupted Calendar!");
} else {
  console.log("Calendar string not found (maybe already fixed?)");
}

// 2. Fix the Items header layout and inject the wrapper
const oldHeader = `<h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={18} style={{ color: '#0ea5e9' }} /> Items {selectedSuppliers.length > 0 ? \`for \${selectedSuppliers.join(', ')}\` : ''}
                    </h4>
                    <div style={{ position: 'relative' }}>`;

const newHeader = `<h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={18} style={{ color: '#0ea5e9' }} /> Items {selectedSuppliers.length > 0 ? \`for \${selectedSuppliers.join(', ')}\` : ''}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
                        <input className="form-control" type="number"
                          value={deliveryForm.driver_cash}
                          onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                          placeholder="Amount ₹"
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 500, width: 100, boxSizing: 'border-box', margin: 0 }} />
                      </div>
                      <div style={{ position: 'relative' }}>`;

if (code.includes(oldHeader)) {
  code = code.replace(oldHeader, newHeader);
  console.log("Replaced items header!");
  
  // Close the extra div
  const oldMenuEnd = `</div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>`;

  const newMenuEnd = `</div>
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>`;
  
  if (code.includes(oldMenuEnd)) {
    code = code.replace(oldMenuEnd, newMenuEnd);
    console.log("Closed wrapper div!");
  }
} else {
  console.log("Items header not found! Did you already replace it?");
}

fs.writeFileSync(file, code);
