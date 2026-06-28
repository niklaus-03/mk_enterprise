const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'routes', 'deliveries.js');
let code = fs.readFileSync(filePath, 'utf-8');

const startStr = "await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '";
const endStr = "', 'i') } }, {";

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  // Replace everything between startStr and endStr with just '$'
  // But wait, the string we want to restore is:
  // await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {
  
  const originalStr = `await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {`;
  
  code = code.slice(0, startIdx) + originalStr + code.slice(endIdx + endStr.length);
  
  // WAIT! There was a second replace call in patch_deliveries.js!
  // Put logic also had settlementLogic! Did it break too?!
  // Let's fix ALL occurrences of this breakage in the file!
}

// Let's do a while loop to fix all breakages!
while (true) {
  const sIdx = code.indexOf(startStr);
  if (sIdx === -1) break;
  
  const eIdx = code.indexOf(endStr, sIdx);
  if (eIdx === -1) break;
  
  const originalStr = `await Supplier.findOneAndUpdate({ name: { $regex: new RegExp('^' + s.supplier_name.trim() + '$', 'i') } }, {`;
  code = code.slice(0, sIdx) + originalStr + code.slice(eIdx + endStr.length);
}

fs.writeFileSync(filePath, code);
console.log('deliveries.js syntax fixed!');
