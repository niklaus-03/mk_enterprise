const fs = require('fs');
const path = require('path');

function patchDashboard(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Update the Collect button onClick logic
  const collectRegex = /let suggestedAmount = c\.balance \|\| 0;[\s\S]*?setPayForm\(\{ amount: suggestedAmount\.toFixed\(2\), mode: 'cash', reference: '' \}\);/m;
  const newCollectLogic = `let suggestedAmount = c.balance || 0;
                                    let hasMultipleUnpaid = false;
                                    let totalUnpaidBalance = suggestedAmount;
                                    let unpaidInvoices = [];

                                    if (c.customer_id) {
                                      const trueCustomer = (data.pendingCustomers || []).find(pc => pc._id === c.customer_id || pc.customer_id === c.customer_id);
                                      if (trueCustomer && trueCustomer.balance > suggestedAmount + 0.01) {
                                        suggestedAmount = trueCustomer.balance;
                                        hasMultipleUnpaid = true;
                                        totalUnpaidBalance = trueCustomer.balance;
                                        unpaidInvoices = trueCustomer.unpaid_invoices || [];
                                      }
                                    } else if (typeof isMultiple !== 'undefined' && isMultiple) {
                                      const sum = customerInvoices.reduce((acc, inv) => acc + (inv.balance || 0), 0);
                                      if (sum > suggestedAmount + 0.01) {
                                        suggestedAmount = sum;
                                        hasMultipleUnpaid = true;
                                        totalUnpaidBalance = sum;
                                        unpaidInvoices = customerInvoices.filter(inv => inv.balance > 0.01).map(inv => ({
                                          _id: inv._id || inv.invoice_id,
                                          invoice_number: inv.invoice_number,
                                          balance_due: inv.balance,
                                          date: inv.date,
                                          ist_formatted: inv.ist_formatted,
                                          total: inv.total
                                        }));
                                      }
                                    }

                                    const initialSelectedIds = hasMultipleUnpaid ? unpaidInvoices.map(inv => inv._id) : [(c.invoice_id || c._id)];

                                    setPayModal({
                                      invoice_id: c.invoice_id || (typeof isHistoricalView !== 'undefined' && isHistoricalView ? c._id : (c.type === 'walkin' ? c._id : null)),
                                      customer_id: c.customer_id || (typeof isHistoricalView !== 'undefined' && isHistoricalView ? null : (c.type === 'registered' ? c._id : null)),
                                      name: c.name,
                                      balance: c.balance,
                                      invoice_number: c.invoice_number,
                                      type: c.type,
                                      hasMultipleUnpaid,
                                      totalUnpaidBalance,
                                      unpaidInvoices
                                    });
                                    setPayForm({ amount: suggestedAmount.toFixed(2), mode: 'cash', reference: '', selectedInvoices: initialSelectedIds });`;
  
  if (content.match(collectRegex)) {
      content = content.replace(collectRegex, newCollectLogic);
      console.log('Patched Collect logic in', filePath);
  } else {
      console.log('Collect logic not found in', filePath);
  }

  // 2. Update the payModal render logic (Warning block -> Checklist)
  const renderRegex = /\{payModal\.hasMultipleUnpaid && \([\s\S]*?Extra <strong>\{fc\(parseFloat\(payForm\.amount\) - \(payModal\.hasMultipleUnpaid \? payModal\.totalUnpaidBalance : payModal\.balance\)\)\}<\/strong> will be stored as advance credit for this customer\.\n                  <\/div>\n                \)\}/m;

  const newRenderLogic = `{payModal.hasMultipleUnpaid && payModal.unpaidInvoices && payModal.unpaidInvoices.length > 0 ? (
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
                              
                              // Recalculate amount
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
                            <div style={{ width: 18, height: 18, borderRadius: 4, border: \`1px solid \${isSelected ? '#22c55e' : '#cbd5e1'}\`, background: isSelected ? '#22c55e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              {isSelected && <div style={{ color: '#fff', fontSize: 12 }}>✓</div>}
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
                    Due: {fc(payModal.balance)}
                  </div>
                )}
                
                {parseFloat(payForm.amount) > (payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance) && parseFloat(payForm.amount) > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12.5, color: '#1e3a8a' }}>
                    Extra <strong>{fc(parseFloat(payForm.amount) - (payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance))}</strong> will be stored as advance credit for this customer.
                  </div>
                )}`;
  
  if (content.match(renderRegex)) {
      content = content.replace(renderRegex, newRenderLogic);
      console.log('Patched UI render logic in', filePath);
  } else {
      console.log('UI render logic not found in', filePath);
  }

  // 3. Update the submit logic
  const submitRegex = /invoice_id: invoiceId,/g;
  const newSubmitLogic = `invoice_id: invoiceId, invoice_ids: payForm.selectedInvoices,`;
  if (content.match(submitRegex)) {
      content = content.replace(submitRegex, newSubmitLogic);
      console.log('Patched submit logic in', filePath);
  }

  fs.writeFileSync(filePath, content);
  console.log('Completed patching', filePath);
}

patchDashboard(path.join(__dirname, 'frontend/src/pages/AdminDashboard.js'));
patchDashboard(path.join(__dirname, 'frontend/src/pages/ManagerDashboard.js'));
