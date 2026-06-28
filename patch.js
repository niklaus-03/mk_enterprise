const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf-8');
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Package size={18}') && lines[i].includes('Items')) {
    console.log('Found h4 at line', i);
    if (lines[i+1].includes('</h4>')) {
      const inject = `                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
                        <input className="form-control" type="number"
                          value={deliveryForm.driver_cash}
                          onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                          placeholder="Amount ₹"
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 500, width: 100, boxSizing: 'border-box', margin: 0 }} />
                      </div>
                      <div style={{ position: 'relative' }}>`;
      lines.splice(i+2, 0, inject);
      console.log('Injected advance cash block!');
      break;
    }
  }
}

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('showLowStockMenu && (')) {
    for (let j = i; j < lines.length; j++) {
      if (lines[j].trim() === ')}') {
        console.log('Found showLowStockMenu end at line', j);
        if (lines[j+1].trim() === '</div>') {
           lines.splice(j+2, 0, '                  </div>');
           console.log('Injected closing div!');
           break;
        }
      }
    }
    break;
  }
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.js', lines.join('\n'));
