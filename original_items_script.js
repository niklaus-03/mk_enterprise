const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

const startStr = "<div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>";
const endStr = "</div>\n                <div style={{ position: 'relative' }}>\n                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find blocks to replace!");
  process.exit(1);
}

const newJSX = `
                {/* SUPPLIER DATA ITEMS */}
                {deliveryForm.suppliers_data && deliveryForm.suppliers_data.length > 0 ? (
                  deliveryForm.suppliers_data.map((supplierObj, sIdx) => (
                    <div key={sIdx} style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Package size={18} style={{ color: '#0ea5e9' }} /> Items for {supplierObj.supplier_name}
                        </h4>
                        
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Advance Cash Given:</span>
                          <input 
                            type="number"
                            placeholder="Amount ₹"
                            className="form-control"
                            value={supplierObj.cash_given}
                            onChange={(e) => setDeliveryForm(f => {
                              const updated = [...f.suppliers_data];
                              updated[sIdx].cash_given = e.target.value;
                              return { ...f, suppliers_data: updated };
                            })}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', width: 120, fontSize: 13 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {supplierObj.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 2fr) 80px 85px auto', gap: 12, alignItems: 'flex-end', background: 'white', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            {/* item_name input */}
                            <div style={{ position: 'relative' }}>
                              {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Item Name *</div>}
                              <input
                                className="form-control" value={item.item_name} placeholder="Type to search..."
                                onChange={e => {
                                  const val = e.target.value;
                                  setDeliveryForm(f => {
                                    const updatedSuppliers = [...f.suppliers_data];
                                    const updatedItems = [...updatedSuppliers[sIdx].items];
                                    updatedItems[idx] = {
                                      ...updatedItems[idx], item_name: val,
                                      quantity: (val && updatedItems[idx].quantity === '0') ? '1' : updatedItems[idx].quantity,
                                    };
                                    updatedSuppliers[sIdx].items = checkAutoAddRow(updatedItems);
                                    return { ...f, suppliers_data: updatedSuppliers };
                                  });
                                  setProductSuggestIdx(\`\${sIdx}_\${idx}\`);
                                  searchProducts(val);
                                }}
                                onBlur={() => setTimeout(() => { setProductSuggestions([]); setProductSuggestIdx(null); }, 200)}
                                style={{ ...(item.is_new_item && item.item_name ? { paddingRight: 40 } : {}), fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                              />
                              {item.is_new_item && item.item_name && (
                                <div style={{ position: 'absolute', bottom: 9, right: 9, fontSize: 9, color: '#92400e', background: '#fffbeb', padding: '2px 6px', borderRadius: 4, fontWeight: 800, pointerEvents: 'none' }}>NEW</div>
                              )}
                              
                              {productSuggestIdx === \`\${sIdx}_\${idx}\` && item.item_name.trim() && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                  {productSuggestions.map(p => (
                                    <div key={p._id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
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
                                      <div>
                                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>Stock: {p.stock} {p.unit} · ₹{p.price}</div>
                                      </div>
                                      <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 10, color: '#475569', fontWeight: 600 }}>{p.unit}</span>
                                    </div>
                                  ))}
                                  <div style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff', borderTop: productSuggestions.length > 0 ? '1px solid #bfdbfe' : 'none' }}
                                    onMouseDown={() => {
                                      setDeliveryForm(f => {
                                        const updatedSuppliers = [...f.suppliers_data];
                                        const updatedItems = [...updatedSuppliers[sIdx].items];
                                        updatedItems[idx] = { ...updatedItems[idx], product_id: '', quantity: updatedItems[idx].quantity === '0' ? '1' : updatedItems[idx].quantity, is_new_item: true };
                                        updatedSuppliers[sIdx].items = checkAutoAddRow(updatedItems);
                                        return { ...f, suppliers_data: updatedSuppliers };
                                      });
                                      setProductSuggestions([]); setProductSuggestIdx(null);
                                      toast('New product will be created when delivery is marked complete', { icon: 'ℹ️', duration: 3000 });
                                    }}
                                  >
                                    + Use "{item.item_name}" as new product
                                  </div>
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
                                  {item.unit && !allUnits.includes(item.unit.toLowerCase().trim()) && (
                                    <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff' }}
                                      onMouseDown={() => { addCustomUnit(item.unit); setProductSuggestIdx(null); toast(\`Unit "\${item.unit}" saved for future use\`, { icon: '✓', duration: 2000 }); }}
                                    >+ Add "{item.unit}" as new unit</div>
                                  )}
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
                                }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}><X size={16} /></button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                    <Package size={32} style={{ color: '#94a3b8', marginBottom: 12 }} />
                    <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Please select at least one supplier to add items</div>
                  </div>
                )}
`;

code = code.slice(0, startIndex) + newJSX + code.slice(endIndex - "</div>\n".length); // leave the notes div intact

fs.writeFileSync(filePath, code);
console.log('AdminDashboard.js patched part 2!');
