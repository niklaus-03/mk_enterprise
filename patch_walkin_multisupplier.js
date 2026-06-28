const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/components/WalkInDeliveryModal.js';
let code = fs.readFileSync(file, 'utf8');

if (code.includes('selectedSuppliers')) {
  console.log('Already patched!');
  process.exit(0);
}

// 1. Add selectedSuppliers state
code = code.replace(
  /const \[savedDraftsList, setSavedDraftsList\] = useState\(\(\) => \{[^}]*\}\);\s*/s,
  `$&
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
`
);

// 2. Modify supplier input and suggestions
const supplierInputStart = `<div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier / Party Name *</label>`;

const newSupplierUI = `<div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier / Party Name {selectedSuppliers.length === 0 ? '*' : ''}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control"
                    value={form.supplier}
                    onChange={e => {
                      setForm(f => ({ ...f, supplier: e.target.value }));
                      searchSuppliers(e.target.value);
                    }}
                    onBlur={() => setTimeout(() => setSupplierSuggestions(null), 200)}
                    placeholder={selectedSuppliers.length > 0 ? "Add another supplier..." : "Supplier Name"}
                    required={selectedSuppliers.length === 0} 
                    style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, flex: 1 }}
                  />
                  {form.supplier.trim() && (
                    <button type="button" onClick={() => {
                      const sName = form.supplier.trim();
                      if (sName && !selectedSuppliers.includes(sName)) {
                        setSelectedSuppliers(prev => [...prev, sName]);
                        setForm(f => ({ ...f, supplier: '', items: [...f.items, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods', supplier_name: sName }] }));
                      }
                    }} style={{ background: '#0284c7', color: 'white', border: 'none', borderRadius: 10, padding: '0 16px', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                  )}
                </div>

                {selectedSuppliers.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {selectedSuppliers.map(supp => (
                      <div key={supp} style={{ display: 'inline-flex', alignItems: 'center', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 16, fontSize: 13, fontWeight: 600 }}>
                        {supp}
                        <button type="button" onClick={() => setSelectedSuppliers(prev => prev.filter(s => s !== supp))} style={{ background: 'transparent', border: 'none', marginLeft: 6, color: '#0369a1', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                )}`;

// Replace supplier input
code = code.replace(
  /<div style=\{\{ position: 'relative' \}\}>\s*<label[^>]*>Supplier \/ Party Name \*<\/label>\s*<input className="form-control"[\s\S]*?<\/div>\s*\}\)\}\s*<\/div>\s*\)\}\s*<\/div>/,
  (match) => {
    // We want to replace the outer relative div and its suggestions block
    // We will inject our newSupplierUI, but we also need the suggestion logic!
    let newBlock = match.replace(/<div style=\{\{ position: 'relative' \}\}>[\s\S]*?<\/div>\s*\{form\.supplier && supplierSuggestions/, newSupplierUI + `\n                {form.supplier && supplierSuggestions`);
    
    // Update the onMouseDown for suggestions to add to selectedSuppliers
    newBlock = newBlock.replace(
      /onMouseDown=\{\(\) => \{ setForm\(f => \(\{ \.\.\.f, supplier: s\.name \}\)\); setSupplierSuggestions\(null\); \}\}/g,
      `onMouseDown={() => { 
        if (!selectedSuppliers.includes(s.name)) {
          setSelectedSuppliers(prev => [...prev, s.name]);
          setForm(f => ({ ...f, supplier: '', items: [...f.items, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods', supplier_name: s.name }] }));
        }
        setSupplierSuggestions(null); 
      }}`
    );
    newBlock = newBlock.replace(
      /onMouseDown=\{\(\) => \{ setSupplierSuggestions\(null\); toast\('Supplier will be saved', \{ icon: 'ℹ️' \}\); \}\}/,
      `onMouseDown={() => { 
        const sName = form.supplier.trim();
        if (sName && !selectedSuppliers.includes(sName)) {
          setSelectedSuppliers(prev => [...prev, sName]);
          setForm(f => ({ ...f, supplier: '', items: [...f.items, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods', supplier_name: sName }] }));
        }
        setSupplierSuggestions(null); 
      }}`
    );
    return newBlock;
  }
);

// 3. Update the Items grouping UI
const mapBlockRegex = /\{form\.items\.map\(\(item, idx\) => \{[\s\S]*?return \([\s\S]*?<div key=\{idx\}[^>]*>[\s\S]*?<\/div>\s*\);\s*\}\)\}/;
const mapMatch = code.match(mapBlockRegex);
if (mapMatch) {
  const originalMapBlock = mapMatch[0];
  // Replace the original map block with the grouped logic!
  const itemRowJSX = originalMapBlock.replace('{form.items.map((item, idx) => {', '').replace(/}\s*\)$/, '');
  
  const groupedMapBlock = `{selectedSuppliers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {selectedSuppliers.map(supp => (
                      <div key={supp} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                          <h4 style={{ margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 700 }}>Items from {supp}</h4>
                          <button type="button" onClick={() => setForm(f => ({ ...f, items: [...f.items, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods', supplier_name: supp }] }))} style={{ background: '#e0f2fe', border: 'none', color: '#0284c7', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add Item to {supp}</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {form.items.map((item, idx) => {
                             if (item.supplier_name !== supp) return null;
                             ${itemRowJSX}
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    ${originalMapBlock}
                  </div>
                )}`;
  code = code.replace(originalMapBlock, groupedMapBlock);
}

// 4. Update the Payment UI to allow selecting a supplier
code = code.replace(
  /<select className="form-control" value=\{p\.mode\}/g,
  `{selectedSuppliers.length > 0 && (
                                  <select className="form-control" value={p.supplier_name || ''} onChange={e => updatePayment(idx, 'supplier_name', e.target.value)} required style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, minWidth: 140 }}>
                                    <option value="">Select Supplier</option>
                                    {selectedSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                )}
                                <select className="form-control" value={p.mode}`
);

// 5. Update handleSubmit to iterate over selectedSuppliers
code = code.replace(
  /const newDelivery = await deliveryApi\.create\(\{[\s\S]*?\}\);/,
  `let suppliersToSubmit = selectedSuppliers.length > 0 ? selectedSuppliers : [form.supplier.trim() || 'Unknown'];
      let deliveriesCreated = [];
      for (const suppName of suppliersToSubmit) {
        const suppItems = selectedSuppliers.length > 0 ? validItems.filter(i => i.supplier_name === suppName) : validItems;
        if (suppItems.length === 0 && selectedSuppliers.length > 0) continue;
        
        const suppTotalAmount = selectedSuppliers.length > 0 ? suppItems.reduce((sum, i) => sum + (parseFloat(i.final_price) || 0), 0) : grandTotal;
        const suppPayments = selectedSuppliers.length > 0 ? validPayments.filter(p => p.supplier_name === suppName) : validPayments;
        
        const newDelivery = await deliveryApi.create({
          ...form,
          supplier: suppName,
          items: suppItems,
          payments: suppPayments,
          total_amount: suppTotalAmount,
          settle_fully: selectedSuppliers.length > 0 ? false : form.settle_fully // Settle fully logic is too complex for multi, turn it off
        });
        deliveriesCreated.push(newDelivery);
      }
      
      const newDelivery = deliveriesCreated[0]; // For notifications`
);

fs.writeFileSync(file, code);
console.log('Successfully patched WalkInDeliveryModal.js for multiple suppliers!');
