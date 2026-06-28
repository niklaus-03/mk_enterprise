const fs = require('fs');
const files = ['c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js', 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/ManagerDashboard.js'];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  if (code.includes('renderDeliveryItems')) {
    console.log('Already modified ' + file);
    continue;
  }

  // Find the exact block we want to extract
  const startMarker = "{deliveryForm.items.map((item, idx) => (";
  const mapBlockStart = code.indexOf(startMarker);
  if (mapBlockStart === -1) {
    console.log('Start marker not found in ' + file);
    continue;
  }
  
  // Find the outer div start which is <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  let startIdx = code.lastIndexOf("<div", mapBlockStart);

  let openBraces = 0;
  let mapBlockEnd = -1;
  let inString = false;
  let stringChar = '';
  
  for (let i = mapBlockStart; i < code.length; i++) {
    const char = code[i];
    if ((char === "'" || char === '"' || char === '`') && code[i-1] !== '\\') {
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
    console.log('Could not parse map block in ' + file);
    continue;
  }

  // Find the closing </div> of the container
  let endIdx = code.indexOf("</div>", mapBlockEnd) + 6;

  const mapBlock = code.substring(mapBlockStart, mapBlockEnd);

  // Now we need to transform mapBlock to use local variables
  let transformedBlock = mapBlock;
  transformedBlock = transformedBlock.replace(/deliveryForm\.items/g, 'items');
  transformedBlock = transformedBlock.replace(/removeDeliveryItem\((.*?)\)/g, 'onChangeItems(items.filter((_, i) => i !== $1))');
  transformedBlock = transformedBlock.replace(/updateDeliveryItem\(/g, 'updateItem(');
  transformedBlock = transformedBlock.replace(/setProductSuggestIdx\((.*?)\)/g, "setProductSuggestIdx(suppName ? \\`\\${suppName}_\\${$1}\\` : $1)");
  transformedBlock = transformedBlock.replace(/productSuggestIdx === (.*?) /g, "productSuggestIdx === (suppName ? \\`\\${suppName}_\\${$1}\\` : $1) ");

  // Fix the inline setDeliveryForm logic
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

  const renderFunc = `
  const renderDeliveryItems = (items, updateItem, onChangeItems, suppName) => {
    return (
      ${transformedBlock}
    );
  };
  `;

  // Now replace the original block
  const replacementJsx = `
                {(!editDeliveryId && selectedSuppliers.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {selectedSuppliers.map(supp => {
                      const currentItems = deliveryForm.itemsBySupplier?.[supp] || [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }];
                      
                      const updateItem = (idx, field, value) => {
                        setDeliveryForm(f => {
                          const arr = [...(f.itemsBySupplier[supp] || [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }])];
                          arr[idx] = { ...arr[idx], [field]: value };
                          return { ...f, itemsBySupplier: { ...f.itemsBySupplier, [supp]: arr } };
                        });
                      };
                      
                      const onChangeItems = (newItems) => {
                        setDeliveryForm(f => ({ ...f, itemsBySupplier: { ...f.itemsBySupplier, [supp]: newItems } }));
                      };
                      
                      return (
                        <div key={supp}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0369a1', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                             Items for {supp}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {renderDeliveryItems(currentItems, updateItem, onChangeItems, supp)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {renderDeliveryItems(deliveryForm.items, updateDeliveryItem, (newItems) => setDeliveryForm(f => ({ ...f, items: newItems })), null)}
                  </div>
                )}
  `;

  let codeBase = fs.readFileSync(file, 'utf8');
  const blockToReplace = codeBase.substring(startIdx, endIdx);
  codeBase = codeBase.replace(blockToReplace, replacementJsx);
  
  // Now find return again and insert renderFunc
  let newReturnIdx = codeBase.indexOf('  return (\n    <div>');
  if (newReturnIdx === -1) {
    newReturnIdx = codeBase.indexOf('  return (\r\n    <div>');
  }

  if (newReturnIdx !== -1) {
    codeBase = codeBase.substring(0, newReturnIdx) + renderFunc + '\\n' + codeBase.substring(newReturnIdx);
    fs.writeFileSync(file, codeBase);
    console.log('Processed UI ' + file);
  } else {
    console.log('Return statement not found after replacement in ' + file);
  }
}
