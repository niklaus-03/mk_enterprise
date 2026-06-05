const fs = require('fs');

const file = 'frontend/src/utils/api.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `getInvoices: (id) => api.get(\`/customers/\${id}/invoices\`),`;
const repStr = `getInvoices: (id) => api.get(\`/customers/\${id}/invoices\`),
  getBalanceBreakdown: (id, params) => api.get(\`/customers/\${id}/balance-breakdown\`, { params }),`;

content = content.replace(targetStr, repStr);

fs.writeFileSync(file, content);
console.log("Patched api.js with getBalanceBreakdown");
