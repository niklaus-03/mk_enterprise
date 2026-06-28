const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(dashPath, 'utf-8');

// 1. Initial State
if (!code.includes("driver_cash: '',")) {
  code = code.replace(
    "vehicle_number: '', driver_name: '', supplier: '',",
    "vehicle_number: '', driver_name: '', driver_cash: '', supplier: '',"
  );
  code = code.replace(
    "setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [], suppliers_data: [] });",
    "setDeliveryForm({ vehicle_number: '', driver_name: '', driver_cash: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [], suppliers_data: [] });"
  );
  code = code.replace(
    "driver_name: d.driver_name || '',",
    "driver_name: d.driver_name || '',\n      driver_cash: d.driver_cash || '',"
  );
}

// 2. Grid and Driver Cash Input
code = code.replace(
  "gridTemplateColumns: '1fr 1fr', gap: 20",
  "gridTemplateColumns: '1fr 1fr 1fr', gap: 20"
);

const driverNameEndAnchor = `{savedDrivers.map((d, i) => <option key={i} value={d} />)}\n                    </datalist>\n                  </div>`;
const driverCashInput = `\n                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash to Driver (₹)</label>
                    <input className="form-control" type="number"
                      value={deliveryForm.driver_cash}
                      onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                      placeholder="Amount ₹"
                      style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                  </div>`;

if (!code.includes("Cash to Driver (₹)")) {
  code = code.replace(driverNameEndAnchor, driverNameEndAnchor + driverCashInput);
}

// 3. Add Expense Display to Expanded Row
const expandedAnchor = `<div style={{ marginTop: 24 }}>`;
const expenseDisplay = `
                        {/* Driver Cash Info */}
                        {(d.driver_cash > 0 || (d.suppliers_data && d.suppliers_data.some(s => s.cash_given > 0))) && (
                          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total Driver Cash</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{fc(d.driver_cash || 0)}</div>
                            </div>
                            <div style={{ fontSize: 24, color: '#cbd5e1' }}>-</div>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Given to Suppliers</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{fc((d.driver_cash || 0) - (d.driver_expense || 0))}</div>
                            </div>
                            <div style={{ fontSize: 24, color: '#cbd5e1' }}>=</div>
                            <div>
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Driver Expense</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fc(d.driver_expense || 0)}</div>
                            </div>
                          </div>
                        )}
`;
if (!code.includes("Driver Cash Info")) {
  code = code.replace(expandedAnchor, expenseDisplay + '\n' + expandedAnchor);
}

fs.writeFileSync(dashPath, code);
console.log('Updated AdminDashboard.js with driver cash UI successfully!');
