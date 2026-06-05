const fs = require('fs');

const file = 'backend/routes/invoices.js';
let content = fs.readFileSync(file, 'utf8');

const targetLogic = `      let newBalance = prevBalance + total - actual_payments_made;

      if (customer.setManagerBalance && !customer.merged_by_admin) {
        customer.setManagerBalance(invoiceCreatorId, newBalance);
      } else {
        customer.balance = newBalance;
      }`;

const repLogic = `      // Fix: Use the actual ledger balance instead of the potentially customized prevBalance
      if (customer.setManagerBalance && !customer.merged_by_admin) {
        let currentDBBalance = customer.getManagerBalance(invoiceCreatorId);
        customer.setManagerBalance(invoiceCreatorId, currentDBBalance + total - actual_payments_made);
      } else {
        customer.balance = (customer.balance || 0) + total - actual_payments_made;
      }`;

content = content.replace(targetLogic, repLogic);

fs.writeFileSync(file, content);
console.log("Patched invoices.js to protect ledger integrity");
