const fs = require('fs');

const file = 'frontend/src/pages/NewInvoice.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for breakdownSelections
if (!content.includes('const [breakdownSelections')) {
  const targetState = `const [balanceBreakdown, setBalanceBreakdown] = useState(null);`;
  const repState = `const [balanceBreakdown, setBalanceBreakdown] = useState(null);
  const [breakdownSelections, setBreakdownSelections] = useState(null);`;
  content = content.replace(targetState, repState);
}

// 2. Set breakdownSelections in useEffect when balanceBreakdown changes
if (!content.includes('setBreakdownSelections({')) {
  const targetEffectEnd = `  useEffect(() => {
    setEditedPrevDue(prevBalance.toString());
  }, [prevBalance]);`;
  
  const repEffectEnd = `  useEffect(() => {
    setEditedPrevDue(prevBalance.toString());
  }, [prevBalance]);

  useEffect(() => {
    if (balanceBreakdown) {
      setBreakdownSelections({
        opening_balance: { selected: true, amount: balanceBreakdown.opening_balance || 0 },
        advance: { selected: true, amount: balanceBreakdown.unregistered_advance || 0 },
        invoices: (balanceBreakdown.unpaid_invoices || []).reduce((acc, inv) => {
          acc[inv._id] = { selected: true, amount: inv.balance_due || 0 };
          return acc;
        }, {})
      });
    } else {
      setBreakdownSelections(null);
    }
  }, [balanceBreakdown]);

  const getComputedTreeBalance = () => {
    if (!breakdownSelections) return parseFloat(editedPrevDue) || 0;
    let sum = 0;
    if (breakdownSelections.opening_balance?.selected) sum += parseFloat(breakdownSelections.opening_balance.amount) || 0;
    Object.values(breakdownSelections.invoices || {}).forEach(inv => {
      if (inv.selected) sum += parseFloat(inv.amount) || 0;
    });
    if (breakdownSelections.advance?.selected) sum -= parseFloat(breakdownSelections.advance.amount) || 0;
    return sum;
  };`;
  content = content.replace(targetEffectEnd, repEffectEnd);
}

// 3. Update activePrevBalance logic
const targetActive = `const activePrevBalance = allowEditPrevDue ? (parseFloat(editedPrevDue) || 0) : prevBalance;`;
const repActive = `const activePrevBalance = allowEditPrevDue ? (balanceBreakdown && breakdownSelections ? getComputedTreeBalance() : (parseFloat(editedPrevDue) || 0)) : prevBalance;`;
content = content.replace(targetActive, repActive);

// 4. Update the Allow editing Previous Due UI
const targetUI = `                            <input 
                              type="checkbox" 
                              checked={allowEditPrevDue} 
                              onChange={(e) => setAllowEditPrevDue(e.target.checked)} 
                              style={{ cursor: 'pointer' }}
                            />
                            Allow editing Previous Due
                          </label>
                          {allowEditPrevDue && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>New Amount:</span>
                              <input 
                                type="number" 
                                className="form-control form-control-sm"
                                value={editedPrevDue}
                                onChange={(e) => setEditedPrevDue(e.target.value)}
                                style={{ width: '100px', padding: '4px 8px' }}
                              />
                            </div>
                          )}`;

const repUI = `                            <input 
                              type="checkbox" 
                              checked={allowEditPrevDue} 
                              onChange={(e) => setAllowEditPrevDue(e.target.checked)} 
                              style={{ cursor: 'pointer' }}
                            />
                            {balanceBreakdown ? 'Customize Previous Due' : 'Allow editing Previous Due'}
                          </label>
                          {allowEditPrevDue && (
                            <div style={{ marginTop: 8 }}>
                              {!balanceBreakdown ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>New Amount:</span>
                                  <input 
                                    type="number" 
                                    className="form-control form-control-sm"
                                    value={editedPrevDue}
                                    onChange={(e) => setEditedPrevDue(e.target.value)}
                                    style={{ width: '100px', padding: '4px 8px' }}
                                  />
                                </div>
                              ) : (
                                breakdownSelections && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '2px solid var(--primary)', paddingLeft: 10 }}>
                                    {balanceBreakdown.opening_balance > 0.01 && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: 0, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={breakdownSelections.opening_balance?.selected} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, opening_balance: { ...prev.opening_balance, selected: e.target.checked } }))} />
                                          Opening Balance
                                        </label>
                                        <input type="number" className="form-control form-control-sm" value={breakdownSelections.opening_balance?.amount} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, opening_balance: { ...prev.opening_balance, amount: e.target.value } }))} style={{ width: 80, fontSize: 12, padding: '2px 6px', height: 26 }} />
                                      </div>
                                    )}
                                    
                                    {balanceBreakdown.unpaid_invoices.map(inv => (
                                      <div key={inv._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: 0, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={breakdownSelections.invoices[inv._id]?.selected} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, invoices: { ...prev.invoices, [inv._id]: { ...prev.invoices[inv._id], selected: e.target.checked } } }))} />
                                          {inv.invoice_number || 'Walk-in Bill'}
                                        </label>
                                        <input type="number" className="form-control form-control-sm" value={breakdownSelections.invoices[inv._id]?.amount} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, invoices: { ...prev.invoices, [inv._id]: { ...prev.invoices[inv._id], amount: e.target.value } } }))} style={{ width: 80, fontSize: 12, padding: '2px 6px', height: 26 }} />
                                      </div>
                                    ))}

                                    {balanceBreakdown.unregistered_advance > 0.01 && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: 0, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={breakdownSelections.advance?.selected} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, advance: { ...prev.advance, selected: e.target.checked } }))} />
                                          Advance (Subtracts)
                                        </label>
                                        <input type="number" className="form-control form-control-sm" value={breakdownSelections.advance?.amount} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, advance: { ...prev.advance, amount: e.target.value } }))} style={{ width: 80, fontSize: 12, padding: '2px 6px', height: 26 }} />
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>Customized Due:</span>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{fc(getComputedTreeBalance())}</span>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}`;

content = content.replace(targetUI, repUI);

fs.writeFileSync(file, content);
console.log("Patched NewInvoice.js for interactive breakdown");
