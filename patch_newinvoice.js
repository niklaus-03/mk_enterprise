const fs = require('fs');

const file = 'frontend/src/pages/NewInvoice.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
const targetState = `const [prevBalance, setPrevBalance] = useState(0);`;
const repState = `const [prevBalance, setPrevBalance] = useState(0);\n  const [balanceBreakdown, setBalanceBreakdown] = useState(null);`;
if (!content.includes('const [balanceBreakdown')) {
  content = content.replace(targetState, repState);
}

// 2. Add API call in useEffect
const targetEffect = `          setPrevBalance(c.balance || 0);
        }
      } else {
        setPrevBalance(0);`;
const repEffect = `          setPrevBalance(c.balance || 0);
        }
        customerApi.getBalanceBreakdown(customerId, { manager_id: selectedManagerForBill })
          .then(res => setBalanceBreakdown(res))
          .catch(err => console.error(err));
      } else {
        setPrevBalance(0);
        setBalanceBreakdown(null);`;
content = content.replace(targetEffect, repEffect);

const targetEffectElse = `    } else {
      setPrevBalance(0);
    }`;
const repEffectElse = `    } else {
      setPrevBalance(0);
      setBalanceBreakdown(null);
    }`;
content = content.replace(targetEffectElse, repEffectElse);

// 3. Render tree in UI
const targetUI = `                        <strong style={{ fontFamily: 'monospace' }}>{fc(prevBalance)}</strong>
                      </div>`;
const repUI = `                        <strong style={{ fontFamily: 'monospace' }}>{fc(prevBalance)}</strong>
                      </div>
                      
                      {balanceBreakdown && prevBalance > 0 && !allowEditPrevDue && (
                        <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: '2px solid var(--border)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {balanceBreakdown.opening_balance > 0.01 && (
                             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                               <span>Opening Balance:</span>
                               <span style={{ fontFamily: 'monospace' }}>{fc(balanceBreakdown.opening_balance)}</span>
                             </div>
                          )}
                          {balanceBreakdown.unpaid_invoices_sum > 0.01 && (
                             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                               <span>Previous Invoices ({balanceBreakdown.unpaid_invoices.length}):</span>
                               <span style={{ fontFamily: 'monospace' }}>{fc(balanceBreakdown.unpaid_invoices_sum)}</span>
                             </div>
                          )}
                          {balanceBreakdown.unregistered_advance > 0.01 && (
                             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                               <span>Unregistered Balance:</span>
                               <span style={{ fontFamily: 'monospace' }}>-{fc(balanceBreakdown.unregistered_advance)}</span>
                             </div>
                          )}
                        </div>
                      )}`;
content = content.replace(targetUI, repUI);

fs.writeFileSync(file, content);
console.log("Patched NewInvoice.js");
