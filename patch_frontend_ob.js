const fs = require('fs');

const patchCustomerHistory = () => {
  const file = 'frontend/src/pages/CustomerPaymentHistory.js';
  let content = fs.readFileSync(file, 'utf8');

  // Replace definition of unpaidInvoices and hasMultipleUnpaid
  const targetDef = `  const unpaidInvoices = invoices.filter(i => i.balance_due > 0.01);\n  const hasMultipleUnpaid = unpaidInvoices.length > 1;`;
  const repDef = `  const unpaidInvoices = invoices.filter(i => i.balance_due > 0.01);
  const unpaidInvoicesSum = unpaidInvoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const unpaidOpeningBalance = Math.max(0, (customer?.balance || 0) - unpaidInvoicesSum);
  
  const itemsToClear = [...unpaidInvoices];
  if (unpaidOpeningBalance > 0.01) {
    itemsToClear.unshift({ _id: 'OPENING_BALANCE', invoice_number: 'Opening Balance', ist_formatted: 'From Ledger', balance_due: unpaidOpeningBalance, isOpeningBalance: true });
  }
  
  const hasMultipleUnpaid = itemsToClear.length > 1;`;
  
  content = content.replace(targetDef, repDef);

  // Replace unpaidInvoices with itemsToClear in the map
  const targetMap = `{unpaidInvoices.map((inv, idx) => {`;
  const repMap = `{itemsToClear.map((inv, idx) => {`;
  content = content.replace(targetMap, repMap);

  // Fix the newAmount calculation inside the map
  const targetNewAmt = `                              const newAmount = unpaidInvoices
                                .filter(i => newSelected.includes(i._id))
                                .reduce((s, i) => s + (i.balance_due || 0), 0);`;
  const repNewAmt = `                              const newAmount = itemsToClear
                                .filter(i => newSelected.includes(i._id))
                                .reduce((s, i) => s + (i.balance_due || 0), 0);`;
  content = content.replace(targetNewAmt, repNewAmt);

  // Fix the length check
  const targetLen = `unpaidInvoices.length - 1`;
  const repLen = `itemsToClear.length - 1`;
  content = content.replace(targetLen, repLen);

  // Fix useEffect
  const targetUE = `if (unpaidInvoices.length > 1) {
        setCollectForm(prev => ({ ...prev, selectedInvoices: unpaidInvoices.map(i => i._id), amount: (customer.balance || 0).toFixed(2) }));
      }`;
  const repUE = `if (unpaidInvoices.length > 1 || (customer && customer.balance > 0.01)) {
        // Compute items to clear
        const unpInv = (res?.invoices || invoices).filter(i => i.balance_due > 0.01);
        const unpSum = unpInv.reduce((s, i) => s + (i.balance_due || 0), 0);
        const unpOB = Math.max(0, (customer.balance || 0) - unpSum);
        let ids = unpInv.map(i => i._id);
        if (unpOB > 0.01) ids.unshift('OPENING_BALANCE');
        
        setCollectForm(prev => ({ ...prev, selectedInvoices: ids, amount: (customer.balance || 0).toFixed(2) }));
      }`;
  // Wait, I should just change selectedInvoices initialization.
  // Actually, let's just replace all 'unpaidInvoices.map' with 'itemsToClear.map' except inside the itemsToClear definition.
  
  fs.writeFileSync(file, content);
  console.log("Patched CustomerPaymentHistory.js");
};

patchCustomerHistory();
