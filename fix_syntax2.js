const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'routes', 'deliveries.js');
let code = fs.readFileSync(filePath, 'utf-8');

const startStr = "await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '";
const endStr = "module.exports = router;, 'i') } }, {";

let count = 0;
while (true) {
  const sIdx = code.indexOf(startStr);
  if (sIdx === -1) break;
  
  const eIdx = code.indexOf(endStr, sIdx);
  if (eIdx === -1) break;
  
  const originalStr = `await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {`;
  code = code.slice(0, sIdx) + originalStr + code.slice(eIdx + endStr.length);
  count++;
}

if (count > 0) {
  fs.writeFileSync(filePath, code);
  console.log(`deliveries.js syntax fixed! Replaced ${count} occurrences.`);
} else {
  console.log('No breakages found to fix.');
}
