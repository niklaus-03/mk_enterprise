const fs = require('fs');
const path = require('path');

const supplierLedgerPath = path.join(__dirname, 'backend', 'routes', 'supplierLedger.js');
let code = fs.readFileSync(supplierLedgerPath, 'utf-8');

const oldDeliveryQueryStr = "const deliveryQuery = {\n      supplier: { $regex: new RegExp(`^${supplierName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') },\n      status: { $in: ['delivered'] },\n    };";
const newDeliveryQueryStr = `const deliveryQuery = {
      $or: [
        { supplier: { $regex: new RegExp(\`^\${supplierName.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i') } },
        { "suppliers_data.supplier_name": { $regex: new RegExp(\`^\${supplierName.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}$\`, 'i') } }
      ]
    };`;

if (code.includes("status: { $in: ['delivered'] }")) {
  code = code.replace(oldDeliveryQueryStr, newDeliveryQueryStr);
  fs.writeFileSync(supplierLedgerPath, code);
  console.log('Updated supplierLedger.js');
} else {
  console.log('Could not find string in supplierLedger.js');
}
