const fs = require('fs');
const path = require('path');

const file = 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js';
let code = fs.readFileSync(file + '.bak', 'utf8');

// 1. Initial State
code = code.replace(
  `items: [
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
    ],`,
  `items: [], suppliers_data: [],`
);
code = code.replace(
  `setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
    ] });`,
  `setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [], suppliers_data: [] });`
);


// 2. Add useEffect for sync
const useEffectBlock = `
  // Sync selectedSuppliers with deliveryForm.suppliers_data
  useEffect(() => {
    setDeliveryForm(prev => {
      let updated = prev.suppliers_data || [];
      // Remove any that are no longer in selectedSuppliers
      updated = updated.filter(s => selectedSuppliers.includes(s.supplier_name));
      // Add new ones
      selectedSuppliers.forEach(name => {
        if (!updated.find(s => s.supplier_name === name)) {
          updated.push({ 
            supplier_name: name, 
            cash_given: '', 
            items: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] 
          });
        }
      });
      return { ...prev, suppliers_data: updated };
    });
  }, [selectedSuppliers]);
`;
code = code.replace(
  `const [selectedSuppliers, setSelectedSuppliers] = useState([]);`,
  `const [selectedSuppliers, setSelectedSuppliers] = useState([]);\n${useEffectBlock}`
);


// 3. Fix labels and add driver cash
code = code.replace(
  /<label style=\{\{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' \}\}>Supplier \/ Party Name \*<\/label>/g,
  `<label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
    Supplier / Party {selectedSuppliers.length > 0 ? <span style={{ textTransform: 'none', fontWeight: 500 }}>(select multiple)</span> : '*'}
  </label>`
);

const driverCashInput = `<div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advance Cash Given (to driver)</label>
                    <input className="form-control" type="number"
                      value={deliveryForm.driver_cash || ''}
                      onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                      placeholder="Amount ₹"
                      style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`;

code = code.replace(
  `<div style={{ flex: 1, minWidth: 200 }}>\n                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`,
  driverCashInput
);
code = code.replace(
  `<div style={{ flex: 1, minWidth: 200 }}>\r\n                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>`,
  driverCashInput
);


// 4. Update the handleSaveDelivery to process suppliers correctly!
const saveReplacement = `      } else {
        // Create mode: support multiple suppliers
        if (selectedSuppliers.length > 0) {
          let validSuppliers = deliveryForm.suppliers_data.filter(s => {
             const hasValidItems = s.items.some(i => i.item_name.trim() !== '' && parseFloat(i.quantity) > 0);
             return hasValidItems;
          });
          if (validSuppliers.length === 0) {
             toast.error('Please enter valid items (with qty > 0) for at least one supplier');
             setDeliverySaving(false);
             return;
          }
          const payload = { 
              ...deliveryForm, 
              items: [], 
              suppliers_data: validSuppliers
          };
          await deliveryApi.create(payload);
        } else {
          const payload = { ...deliveryForm, supplier: deliveryForm.supplier, items: filteredItems };
          await deliveryApi.create(payload);
        }
        toast.success('Deliveries created successfully');
`;
const oldSaveLogic = `      } else {
        // Create mode: support multiple suppliers
        const suppliersToSave = selectedSuppliers.length > 0 ? selectedSuppliers : (deliveryForm.supplier.trim() ? [deliveryForm.supplier.trim()] : ['']);
        for (const supplierName of suppliersToSave) {
          const payload = { ...deliveryForm, supplier: supplierName, items: filteredItems };
          await deliveryApi.create(payload);
        }
        toast.success(suppliersToSave.length > 1 ? 'Deliveries created successfully' : 'Delivery created successfully');`;
code = code.replace(oldSaveLogic, saveReplacement);


// 5. Replace Items Map Block with the full UI
// The original wrapper start in .bak
const wrapperStartStr = "<div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>";
const sIdx = code.indexOf(wrapperStartStr);
const notesIdx = code.indexOf("Notes</label>", sIdx);
const eIdx = code.lastIndexOf("<div style={{ position: 'relative' }}>", notesIdx);

if (sIdx === -1 || notesIdx === -1 || eIdx === -1 || eIdx < sIdx) {
    console.error("Could not find boundaries! sIdx:", sIdx, "notesIdx:", notesIdx, "eIdx:", eIdx);
    process.exit(1);
}

const innerStart = sIdx + wrapperStartStr.length;
const innerEnd = code.lastIndexOf("</div>", eIdx - 1); // Closing tag of the f8fafc wrapper

const multiSupplierJSX = `
                {(!editDeliveryId && selectedSuppliers.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {deliveryForm.suppliers_data && deliveryForm.suppliers_data.map((supplierObj, sIdx) => (
                      <div key={supplierObj.supplier_name} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={18} style={{ color: '#0ea5e9' }} /> Items for {supplierObj.supplier_name}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Advance Cash Given:</label>
                            <input className="form-control" type="number"
                              value={supplierObj.cash_given || ''}
                              onChange={e => {
                                setDeliveryForm(f => {
                                  const updatedData = [...(f.suppliers_data || [])];
                                  updatedData[sIdx].cash_given = e.target.value;
                                  return { ...f, suppliers_data: updatedData };
                                });
                              }}
                              placeholder="₹ Amount"
                              style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }} />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {supplierObj.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              
                              {/* Product Search Input */}
                              <div style={{ flex: 2, minWidth: 200, position: 'relative' }}>
                                {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Product / Item Name *</div>}
                                <input
                                  className="form-control"
                                  value={item.item_name}
                                  placeholder="Type product name..."
                                  style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items[idx].item_name = val;
                                      updatedSuppliers[sIdx].items[idx].product_id = '';
                                      updatedSuppliers[sIdx].items[idx].is_new_item = true;
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                    if (val.trim().length > 0) {
                                      const matches = data.allProducts.filter(p => p.name.toLowerCase().includes(val.toLowerCase()));
                                      setProductSuggestions(matches);
                                      setProductSuggestIdx(\`\${sIdx}_\${idx}\`);
                                    } else {
                                      setProductSuggestions([]);
                                      setProductSuggestIdx(null);
                                    }
                                  }}
                                  onFocus={e => {
                                    if (e.target.value.trim().length > 0) {
                                      const matches = data.allProducts.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase()));
                                      setProductSuggestions(matches);
                                      setProductSuggestIdx(\`\${sIdx}_\${idx}\`);
                                    }
                                  }}
                                  onBlur={() => setTimeout(() => { setProductSuggestIdx(null); setProductSuggestions([]); }, 200)}
                                />
                                {productSuggestIdx === \`\${sIdx}_\${idx}\` && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                    {productSuggestions.map(p => (
                                      <div key={p._id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        onMouseDown={() => {
                                          setDeliveryForm(f => {
                                            const updatedSuppliers = [...f.suppliers_data];
                                            const updatedItems = [...updatedSuppliers[sIdx].items];
                                            updatedItems[idx] = { ...updatedItems[idx], item_name: p.name, quantity: '1', unit: p.unit || 'unit', product_id: p._id, is_new_item: false };
                                            updatedSuppliers[sIdx].items = checkAutoAddRow(updatedItems);
                                            return { ...f, suppliers_data: updatedSuppliers };
                                          });
                                          setProductSuggestions([]); setProductSuggestIdx(null);
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.background = ''}
                                      >
                                        <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: '#64748b' }}>Stock: {p.stock} {p.unit} · ₹{p.price}</div></div>
                                      </div>
                                    ))}
                                    {!productSuggestions.some(p => p.name.toLowerCase() === item.item_name.toLowerCase()) && (
                                      <div style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff' }}
                                        onMouseDown={() => {
                                          setDeliveryForm(f => {
                                            const updatedSuppliers = [...f.suppliers_data];
                                            const updatedItems = [...updatedSuppliers[sIdx].items];
                                            updatedItems[idx] = { ...updatedItems[idx], product_id: '', quantity: updatedItems[idx].quantity === '0' ? '1' : updatedItems[idx].quantity, is_new_item: true };
                                            updatedSuppliers[sIdx].items = checkAutoAddRow(updatedItems);
                                            return { ...f, suppliers_data: updatedSuppliers };
                                          });
                                          setProductSuggestions([]); setProductSuggestIdx(null);
                                        }}
                                      >
                                        + Use "{item.item_name}" as new product
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Qty Input */}
                              <div>
                                {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Qty</div>}
                                <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} placeholder="0" style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                                  onChange={e => {
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items[idx].quantity = e.target.value;
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                  }}
                                />
                              </div>

                              {/* Unit Input */}
                              <div style={{ position: 'relative' }}>
                                {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>}
                                <input className="form-control" value={item.unit || ''} placeholder="bag" style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                                  onChange={e => {
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items[idx].unit = e.target.value;
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                    setProductSuggestIdx(\`unit_\${sIdx}_\${idx}\`);
                                  }}
                                  onFocus={() => setProductSuggestIdx(\`unit_\${sIdx}_\${idx}\`)}
                                  onBlur={() => setTimeout(() => setProductSuggestIdx(null), 200)}
                                />
                                {productSuggestIdx === \`unit_\${sIdx}_\${idx}\` && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                                    {allUnits.filter(u => !item.unit || u.toLowerCase().includes((item.unit || '').toLowerCase())).map(u => (
                                      <div key={u} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                                        onMouseDown={() => {
                                          setDeliveryForm(f => {
                                            const updatedSuppliers = [...f.suppliers_data];
                                            updatedSuppliers[sIdx].items[idx].unit = u;
                                            return { ...f, suppliers_data: updatedSuppliers };
                                          });
                                          setProductSuggestIdx(null);
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.background = ''}
                                      >{u}</div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Remove button */}
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {idx === 0 && <div style={{ fontSize: 11, height: 16, marginBottom: 6 }}>&nbsp;</div>}
                                {supplierObj.items.length > 1 && (
                                  <button type="button" onClick={() => {
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items = updatedSuppliers[sIdx].items.filter((_, i) => i !== idx);
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                  }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : editDeliveryId ? (
                   // FALLBACK: SINGLE ITEM RENDERER FOR EDIT MODE!
                   <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                     ${code.substring(innerStart, innerEnd)}
                   </div>
                ) : (
                  // EMPTY STATE
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                    <Package size={32} style={{ color: '#94a3b8', marginBottom: 12 }} />
                    <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Please select at least one supplier to add items</div>
                  </div>
                )}
`;

code = code.substring(0, sIdx) + multiSupplierJSX + code.substring(innerEnd + 6); // +6 for </div>


fs.writeFileSync(file, code);
console.log("AdminDashboard.js successfully patched with complete multi-supplier UI!");
