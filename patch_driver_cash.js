const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf-8');

const targetStr = `<div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`;

const insertStr = `<div style={{ position: 'relative' }}>
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

if(code.includes(targetStr)) {
  code = code.replace(targetStr, insertStr);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.js', code);
  console.log('Successfully injected driver_cash at Top Grid');
} else {
  console.log('targetStr not found! Will search by regex');
  const regex = /<div style=\{\{ position: 'relative' \}\}>\s*<label style=\{\{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0\.5px' \}\}>Expected Arrival Date & Time \*<\/label>/;
  code = code.replace(regex, insertStr);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.js', code);
  console.log('Regex replace complete');
}
