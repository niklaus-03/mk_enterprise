const fs = require('fs');

function fixAdminDashboard() {
  let content = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf8');
  
  const regex = /<div style=\{\{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 \}\}>[\s\S]*?Due: \{fc\(payModal\.hasMultipleUnpaid \? payModal\.totalUnpaidBalance : payModal\.balance\)\}\n                <\/div>\n              <\/div>/m;
  
  const replacement = `<div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{payModal.name}</div>
                {payModal.invoice_number && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Invoice: {payModal.invoice_number}</div>
                )}
                {payModal.hasMultipleUnpaid && payModal.unpaidInvoices && payModal.unpaidInvoices.length > 0 ? (
                  <div style={{ marginTop: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Select Invoices to Clear:</div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
                      {payModal.unpaidInvoices.map((inv, idx) => {
                        const isSelected = payForm.selectedInvoices && payForm.selectedInvoices.includes(inv._id);
                        return (
                          <div 
                            key={inv._id || idx}
                            onClick={() => {
                              let newSelected = [...(payForm.selectedInvoices || [])];
                              if (isSelected) {
                                newSelected = newSelected.filter(id => id !== inv._id);
                              } else {
                                newSelected.push(inv._id);
                              }
                              
                              const newAmount = payModal.unpaidInvoices
                                .filter(i => newSelected.includes(i._id))
                                .reduce((s, i) => s + (i.balance_due || 0), 0);

                              setPayForm({ ...payForm, selectedInvoices: newSelected, amount: newAmount > 0 ? newAmount.toFixed(2) : '' });
                            }}
                            style={{ 
                              display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: idx < payModal.unpaidInvoices.length - 1 ? '1px solid var(--border)' : 'none',
                              cursor: 'pointer', background: isSelected ? '#f0fdf4' : '#fff', transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ width: 18, height: 18, borderRadius: 10, border: \`1px solid \${isSelected ? '#22c55e' : '#cbd5e1'}\`, background: isSelected ? '#22c55e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}></div>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inv.invoice_number || 'Walk-in Bill'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.ist_formatted ? inv.ist_formatted.split(',')[0] : 'Historical'}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>
                              {fc(inv.balance_due)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>
                    Due: {fc(payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance)}
                  </div>
                )}
              </div>`;
  
  if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('frontend/src/pages/AdminDashboard.js', content);
    console.log('Fixed AdminDashboard UI block');
  } else {
    console.log('Failed to match AdminDashboard UI block');
  }
}

fixAdminDashboard();
