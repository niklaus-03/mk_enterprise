const fs = require('fs');

const file = 'frontend/src/pages/CustomerPaymentHistory.js';
let content = fs.readFileSync(file, 'utf8');

const targetCondition = `{hasMultipleUnpaid && unpaidInvoices && unpaidInvoices.length > 0 ? (`
const repCondition = `{hasMultipleUnpaid && itemsToClear && itemsToClear.length > 0 ? (`

content = content.replace(targetCondition, repCondition);

fs.writeFileSync(file, content);
console.log("Patched condition");
