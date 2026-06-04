const fs = require('fs');
const file = 'frontend/src/pages/CustomerPaymentHistory.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add selectedInvoices to collectForm
content = content.replace(
  "const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '' });",
  "const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '', selectedInvoices: [] });"
);

// 2. Add unpaidInvoices calculation
if (!content.includes('const unpaidInvoices =')) {
  content = content.replace(
    "const ledger = buildLedger();",
    "const ledger = buildLedger();\n  const unpaidInvoices = invoices.filter(i => i.balance_due > 0.01);\n  const hasMultipleUnpaid = unpaidInvoices.length > 1;"
  );
}

// 3. Update the handleCollectPayment to send invoice_ids
content = content.replace(
  "amount: amt,",
  "amount: amt,\n        invoice_ids: collectForm.selectedInvoices,"
);
content = content.replace(
  "setCollectForm({ amount: '', mode: 'cash', reference: '', notes: '' });",
  "setCollectForm({ amount: '', mode: 'cash', reference: '', notes: '', selectedInvoices: [] });"
);

// 4. In useEffect for openCollect, initialize selectedInvoices to all unpaid invoices
content = content.replace(
  "setShowCollectModal(true);",
  "setShowCollectModal(true);\n      if (unpaidInvoices.length > 1) {\n        setCollectForm(prev => ({ ...prev, selectedInvoices: unpaidInvoices.map(i => i._id), amount: (customer.balance || 0).toFixed(2) }));\n      }"
);

// 5. Also for the actual "Collect Payment" button onClick
content = content.replace(
  "onClick={() => setShowCollectModal(true)}",
  "onClick={() => {\n              setShowCollectModal(true);\n              if (hasMultipleUnpaid) {\n                setCollectForm(prev => ({ ...prev, selectedInvoices: unpaidInvoices.map(i => i._id), amount: (customer?.balance || 0).toFixed(2) }));\n              } else {\n                setCollectForm(prev => ({ ...prev, amount: (customer?.balance || 0).toFixed(2) }));\n              }\n            }}"
);

// 6. Replace the Customer Info block with the interactive checklist
const target = `              {/* Customer info */}
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{customer?.name}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#dc2626' }}>
                  Due: {fc(Math.max(0, customer?.balance || 0))}
                </div>
              </div>`;

const replacement = `              {/* Customer info */}
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{customer?.name}</div>
                {hasMultipleUnpaid && unpaidInvoices && unpaidInvoices.length > 0 ? (
                  <div style={{ marginTop: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Select Invoices to Clear:</div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
                      {unpaidInvoices.map((inv, idx) => {
                        const isSelected = collectForm.selectedInvoices && collectForm.selectedInvoices.includes(inv._id);
                        return (
                          <div 
                            key={inv._id || idx}
                            onClick={() => {
                              let newSelected = [...(collectForm.selectedInvoices || [])];
                              if (isSelected) {
                                newSelected = newSelected.filter(id => id !== inv._id);
                              } else {
                                newSelected.push(inv._id);
                              }
                              
                              const newAmount = unpaidInvoices
                                .filter(i => newSelected.includes(i._id))
                                .reduce((s, i) => s + (i.balance_due || 0), 0);

                              setCollectForm({ ...collectForm, selectedInvoices: newSelected, amount: newAmount > 0 ? newAmount.toFixed(2) : '' });
                            }}
                            style={{ 
                              display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: idx < unpaidInvoices.length - 1 ? '1px solid var(--border)' : 'none',
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
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#dc2626' }}>
                    Due: {fc(Math.max(0, customer?.balance || 0))}
                  </div>
                )}
              </div>`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log('Patched CustomerPaymentHistory.js');
