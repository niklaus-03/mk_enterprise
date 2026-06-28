const { execSync } = require('child_process');
const fs = require('fs');

const files = [
  'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js',
  'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/ManagerDashboard.js'
];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  
  // Get original file from HEAD
  const gitPath = file.split('mk_enterprise/')[1];
  let headCode = '';
  try {
    headCode = execSync(`git show HEAD:${gitPath}`, { encoding: 'utf8' });
  } catch (e) {
    console.log('Failed to read from HEAD for ' + file);
    continue;
  }
  
  // Extract original map block from HEAD
  const startMarker = "{deliveryForm.items.map((item, idx) => (";
  const mapBlockStart = headCode.indexOf(startMarker);
  if (mapBlockStart === -1) {
    console.log('Start marker not found in HEAD for ' + file);
    continue;
  }
  
  let openBraces = 0;
  let mapBlockEnd = -1;
  let inString = false;
  let stringChar = '';
  
  for (let i = mapBlockStart; i < headCode.length; i++) {
    const char = headCode[i];
    if ((char === "'" || char === '"' || char === '`') && headCode[i-1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') {
        openBraces--;
        if (openBraces === 0) {
          mapBlockEnd = i + 1;
          break;
        }
      }
    }
  }

  if (mapBlockEnd === -1) {
    console.log('Could not parse map block in HEAD for ' + file);
    continue;
  }

  const originalMapBlock = headCode.substring(mapBlockStart, mapBlockEnd);
  
  // Transform the block
  let transformedBlock = originalMapBlock;
  transformedBlock = transformedBlock.replace(/deliveryForm\.items/g, 'items');
  transformedBlock = transformedBlock.replace(/removeDeliveryItem\((.*?)\)/g, 'onChangeItems(items.filter((_, i) => i !== $1))');
  transformedBlock = transformedBlock.replace(/updateDeliveryItem\(/g, 'updateItem(');
  // Correctly use template literals here to avoid runtime Unicode escape errors
  transformedBlock = transformedBlock.replace(/setProductSuggestIdx\((.*?)\)/g, "setProductSuggestIdx(suppName ? `${suppName}_${$1}` : $1)");
  transformedBlock = transformedBlock.replace(/productSuggestIdx === (.*?) /g, "productSuggestIdx === (suppName ? `${suppName}_${$1}` : $1) ");

  transformedBlock = transformedBlock.replace(/setDeliveryForm\(f => \{\s*const updated = \[\.\.\.f\.items\];\s*updated\[idx\] = \{\s*\.\.\.updated\[idx\],\s*item_name: val,\s*quantity: \(val && updated\[idx\]\.quantity === '0'\) \? '1' : updated\[idx\]\.quantity,\s*\};\s*return \{ \.\.\.f, items: checkAutoAddRow\(updated\) \};\s*\}\);/, `
    const updated = [...items];
    updated[idx] = { ...updated[idx], item_name: val, quantity: (val && updated[idx].quantity === '0') ? '1' : updated[idx].quantity };
    onChangeItems(checkAutoAddRow(updated));
  `);
  
  transformedBlock = transformedBlock.replace(/setDeliveryForm\(f => \{\s*const updated = \[\.\.\.f\.items\];\s*updated\[idx\] = \{\s*\.\.\.updated\[idx\],\s*item_name: p\.name,\s*quantity: '1',\s*unit: p\.unit \|\| 'unit',\s*product_id: p\._id,\s*is_new_item: false,\s*\};\s*return \{ \.\.\.f, items: checkAutoAddRow\(updated\) \};\s*\}\);/, `
    const updated = [...items];
    updated[idx] = { ...updated[idx], item_name: p.name, quantity: '1', unit: p.unit || 'unit', product_id: p._id, is_new_item: false };
    onChangeItems(checkAutoAddRow(updated));
  `);
  
  transformedBlock = transformedBlock.replace(/setDeliveryForm\(f => \{\s*const updated = \[\.\.\.f\.items\];\s*updated\[idx\] = \{\s*\.\.\.updated\[idx\],\s*product_id: '',\s*quantity: updated\[idx\]\.quantity === '0' \? '1' : updated\[idx\]\.quantity,\s*is_new_item: true,\s*\};\s*return \{ \.\.\.f, items: checkAutoAddRow\(updated\) \};\s*\}\);/, `
    const updated = [...items];
    updated[idx] = { ...updated[idx], product_id: '', quantity: updated[idx].quantity === '0' ? '1' : updated[idx].quantity, is_new_item: true };
    onChangeItems(checkAutoAddRow(updated));
  `);

  const renderFuncBody = `
  const renderDeliveryItems = (items, updateItem, onChangeItems, suppName) => {
    return (
      <>${transformedBlock}</>
    );
  };
  `;

  // Now, read the current corrupted file
  let currentCode = fs.readFileSync(file, 'utf8');

  // We need to replace everything from `const renderDeliveryItems =` down to `  return (\n    <div>`
  const renderFuncStart = currentCode.indexOf('  const renderDeliveryItems =');
  
  let returnIdx = currentCode.indexOf('  return (\n    <div>', renderFuncStart);
  if (returnIdx === -1) {
    returnIdx = currentCode.indexOf('  return (\r\n    <div>', renderFuncStart);
  }
  
  if (renderFuncStart === -1 || returnIdx === -1) {
    console.log('Could not find boundaries in current code for ' + file);
    continue;
  }

  // Also in AdminDashboard, the replace wiped out some things that used to be right before the return statement.
  // Wait, no. The modal `WalkinManagerAssignModal` was right below `  return (\n    <div>`.
  // So all we lost was the `renderDeliveryItems` block itself!
  // BUT WAIT. The `addCustomUnit` was inside `renderDeliveryItems` body!
  // By extracting the whole body from `HEAD` and putting it back in `renderDeliveryItems`, it restores `addCustomUnit`!
  // And it correctly closes the `<>`.
  
  const blockToReplace = currentCode.substring(renderFuncStart, returnIdx);
  currentCode = currentCode.replace(blockToReplace, renderFuncBody + '\\n');
  
  fs.writeFileSync(file, currentCode);
  console.log('Restored ' + file);
}
