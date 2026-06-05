const fs = require('fs');

let content = fs.readFileSync('frontend/src/pages/VehicleDetail.js', 'utf8');

// 1. Add supplier_charge_per_item to map when loading
content = content.replace(
  /final_price: item.final_price > 0 \? String\(item.final_price\) : '',/,
  `final_price: item.final_price > 0 ? String(item.final_price) : '',
          supplier_charge_per_item: item.supplier_charge_per_item > 0 ? String(item.supplier_charge_per_item) : '',`
);

// 2. Add supplier_charge_per_item to handleSave
content = content.replace(
  /quintal_charge: parseFloat\(item.quintal_charge\) \|\| 0,/,
  `quintal_charge: parseFloat(item.quintal_charge) || 0,
          supplier_charge_per_item: parseFloat(item.supplier_charge_per_item) || 0,`
);

// 3. updateItem function
content = content.replace(
  /const qCharge = parseFloat\(it.quintal_charge\) \|\| 0;\s+const weight = parseFloat\(it.weight\) \|\| 0;\s+const gst = parseFloat\(it.gst\) \|\| 0;\s+if \(base > 0\) \{\s+const quintalAdj = qCharge > 0 && weight > 0 \? \(qCharge \* weight\) \/ 100 : 0;\s+const beforeGST = base \+ quintalAdj;\s+const gstAmt = \(beforeGST \* gst\) \/ 100;\s+updated\[idx\].final_price = parseFloat\(\(beforeGST \+ gstAmt\).toFixed\(2\)\);\s+\}/,
  `const qCharge = parseFloat(it.quintal_charge) || 0;
      const supplierCharge = parseFloat(it.supplier_charge_per_item) || 0;
      const weight = parseFloat(it.weight) || 0;
      const gst = parseFloat(it.gst) || 0;

      if (base > 0 || supplierCharge > 0) {
        const quintalAdj = qCharge > 0 && weight > 0 ? (qCharge * weight) / 100 : 0;
        const beforeGST = base + quintalAdj + supplierCharge;
        const gstAmt = (beforeGST * gst) / 100;
        updated[idx].final_price = parseFloat((beforeGST + gstAmt).toFixed(2));
      }`
);

// 4. Distribute button
content = content.replace(
  /const numItems = validItems.length;\s+const chargePerItem = totalCharge \/ numItems;\s+setItems\(prev => prev.map\(item => \{\s+if \(!item.item_name\) return item;\s+const qty = parseFloat\(item.quantity\) \|\| 1;\s+const perUnitSupplierCharge = chargePerItem \/ qty;/,
  `const totalQty = validItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 1), 0);
                      const chargePerQty = totalCharge / totalQty;

                      setItems(prev => prev.map(item => {
                        if (!item.item_name) return item;
                        const qty = parseFloat(item.quantity) || 1;
                        const perUnitSupplierCharge = chargePerQty;`
);

// 5. Toast for distribute
content = content.replace(
  /toast.success\(\`₹\$\{totalCharge.toFixed\(0\)\} split: ₹\$\{chargePerItem.toFixed\(2\)\}\/item across \$\{numItems\} items\`\);/,
  `toast.success(\`₹\${totalCharge.toFixed(0)} distributed: ₹\${chargePerQty.toFixed(2)}/unit across \${totalQty} total units\`);`
);

// 6. Subtext under distribute button
content = content.replace(
  /Per item: ₹\{\(\(parseFloat\(supplierCharge\) \|\| 0\) \/ Math.max\(1, items.filter\(i => i.item_name\).length\)\).toFixed\(2\)\} → then ÷ qty per item/,
  `Distributed equally based on total quantity across all items (₹{(parseFloat(supplierCharge) || 0) / Math.max(1, items.reduce((sum, item) => item.item_name ? sum + (parseFloat(item.quantity) || 1) : sum, 0))} per unit)`
);

// 7. Apply All for quintal charge: scPU is already correctly extracted from item.supplier_charge_per_item

// 8. Mobile view delivered display
content = content.replace(
  /<span style={{ fontSize: 11, color: 'var\(--text-muted\)', fontWeight: 600 }}>Quintal:<\/span>\s*<span style={{ fontWeight: 800, fontSize: 12.5, color: 'var\(--text\)', marginLeft: 6 }}>\s*\{item.quintal_charge \? fc\(item.quintal_charge\) : '—'\}\s*<\/span>\s*<\/div>/,
  `<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Quintal:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--text)', marginLeft: 6 }}>
                            {item.quintal_charge ? fc(item.quintal_charge) : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Supplier:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--text)', marginLeft: 6 }}>
                            {item.supplier_charge_per_item ? fc(item.supplier_charge_per_item) : '—'}
                          </span>
                        </div>`
);

// 9. Mobile view edit display (grid columns)
content = content.replace(
  /<div style={{ gridColumn: 'span 6' }}>\s*<label style={{ fontSize: 11, fontWeight: 700, color: 'var\(--text-muted\)', display: 'block', marginBottom: 4 }}>Quintal Charge ₹<\/label>/,
  `<div style={{ gridColumn: 'span 6' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Supplier Charge ₹</label>
                          <input type="number" min="0" step="0.01" className="form-control"
                            style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8 }}
                            value={item.supplier_charge_per_item || ''}
                            placeholder="per unit"
                            onChange={e => updateItem(idx, 'supplier_charge_per_item', e.target.value)} />
                        </div>
                        <div style={{ gridColumn: 'span 6' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quintal Charge ₹</label>`
);

// 10. Table header
content = content.replace(
  /'Base Price ₹', 'Quintal Charge ₹', 'GST %', 'Final Price ₹'/,
  `'Base Price ₹', 'Supplier Charge ₹', 'Quintal Charge ₹', 'GST %', 'Final Price ₹'`
);

// 11. Table row delivered display
content = content.replace(
  /<td style={{ padding: '12px 16px', minWidth: 120, fontFamily: "'Inter', sans-serif" }}>\s*\{isDelivered \? \(\s*<span>\{item.quintal_charge \? fc\(item.quintal_charge\) : '—'\}<\/span>\s*\) : \(/,
  `<td style={{ padding: '12px 16px', minWidth: 110, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span>{item.supplier_charge_per_item ? fc(item.supplier_charge_per_item) : '—'}</span>
                          ) : (
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                              value={item.supplier_charge_per_item || ''}
                              placeholder="per unit"
                              onChange={e => updateItem(idx, 'supplier_charge_per_item', e.target.value)} />
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', minWidth: 120, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span>{item.quintal_charge ? fc(item.quintal_charge) : '—'}</span>
                          ) : (`
);

// 12. Pricing Formula text
content = content.replace(
  /Final Price = Base Price \+ \(Quintal Charge × Weight ÷ 100\) \+ GST%\. Final Price is auto-calculated but can be manually overridden\./,
  `Final Price = Base Price + Supplier Charge + (Quintal Charge × Weight ÷ 100) + GST%. Final Price is auto-calculated but can be manually overridden.`
);

// 13. Ensure `item.supplier_charge_per_item` handles string correctly during apply all
content = content.replace(
  /const scPU = item.supplier_charge_per_item \|\| 0;/,
  `const scPU = parseFloat(item.supplier_charge_per_item) || 0;`
);

fs.writeFileSync('frontend/src/pages/VehicleDetail.js', content);
console.log('Update finished.');
