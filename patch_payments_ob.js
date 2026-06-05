const fs = require('fs');
const file = 'backend/routes/payments.js';

let content = fs.readFileSync(file, 'utf8');

const targetObjId = `const invoiceIdsToFetch = req.body.invoice_ids || (invoice_id ? invoice_id.split(',').map(id => id.trim()) : null);`;
const repObjId = `let invoiceIdsToFetch = req.body.invoice_ids || (invoice_id ? invoice_id.split(',').map(id => id.trim()) : null);
    if (invoiceIdsToFetch && Array.isArray(invoiceIdsToFetch)) {
      invoiceIdsToFetch = invoiceIdsToFetch.filter(id => id && id.length === 24); // Remove 'OPENING_BALANCE'
    }`;

content = content.replace(targetObjId, repObjId);

fs.writeFileSync(file, content);
console.log("Patched payments.js");
