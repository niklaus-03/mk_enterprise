const fs = require('fs');

const file = 'frontend/src/pages/NewInvoice.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `{balanceBreakdown && prevBalance > 0 && !allowEditPrevDue && (`;
const repStr = `{balanceBreakdown && prevBalance > 0 && !allowEditPrevDue && customizePrevDueEnabled && (`;

content = content.replace(targetStr, repStr);

fs.writeFileSync(file, content);
console.log("Patched NewInvoice.js to hide static breakdown when feature is disabled");
