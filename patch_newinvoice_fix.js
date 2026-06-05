const fs = require('fs');

const file = 'frontend/src/pages/NewInvoice.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix the desync by updating prevBalance from the API response
const targetApi = `.then(res => setBalanceBreakdown(res))`;
const repApi = `.then(res => {
            setBalanceBreakdown(res);
            setPrevBalance(res.total_balance || 0);
          })`;
content = content.replace(targetApi, repApi);

// 2. Make Opening Balance always show in the interactive tree
const targetOpening = `{balanceBreakdown.opening_balance > 0.01 && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>`;
const repOpening = `{true && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>`;
content = content.replace(targetOpening, repOpening);

// 3. Make Advance always show in the interactive tree
const targetAdvance = `{balanceBreakdown.unregistered_advance > 0.01 && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: 0, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={breakdownSelections.advance?.selected} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, advance: { ...prev.advance, selected: e.target.checked } }))} />
                                          Advance (Subtracts)
                                        </label>`;
const repAdvance = `{true && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: 0, cursor: 'pointer' }}>
                                          <input type="checkbox" checked={breakdownSelections.advance?.selected} onChange={(e) => setBreakdownSelections(prev => ({ ...prev, advance: { ...prev.advance, selected: e.target.checked } }))} />
                                          Unregistered Balance (Subtracts)
                                        </label>`;
content = content.replace(targetAdvance, repAdvance);

fs.writeFileSync(file, content);
console.log("Patched NewInvoice.js for always showing rows and fixing desync");
