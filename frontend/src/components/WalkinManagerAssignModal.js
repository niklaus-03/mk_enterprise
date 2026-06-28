import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { walkinApi, productApi, managerApi } from '../utils/api';
import { Truck, X, Plus, Trash2, Package } from 'lucide-react';

export default function WalkinManagerAssignModal({ onClose, onSuccess, trip = null }) {
  const { t } = useApp();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: '1', stock: 0, price: 0 }]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [activeSuggestIdx, setActiveSuggestIdx] = useState(null);
  
  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState(trip ? (trip.manager_id?._id || trip.manager_id) : '');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    if (!trip) {
      // Fetch managers if no trip is provided
      managerApi.getAll()
        .then(res => setManagers(res.managers || []))
        .catch(err => console.error('Failed to load managers', err));
    }
    
    return () => { document.body.style.overflow = 'unset'; };
  }, [trip]);

  const searchProducts = (q) => {
    if (!q.trim()) { setProductSuggestions([]); return; }
    productApi.getAll({ search: q })
      .then(res => {
        const sorted = (res || []).sort((a,b) => a.name.localeCompare(b.name));
        setProductSuggestions(sorted);
      })
      .catch(() => {});
  };

  const updateItem = (idx, updates) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[idx] = { ...newItems[idx], ...updates };
      
      if ('product_name' in updates && updates.product_name && idx === newItems.length - 1) {
        newItems.push({ product_id: '', product_name: '', quantity: '0', stock: 0, price: 0 });
      }
      return newItems;
    });
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleKeyDown = (e, field, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'search') {
        const qtyField = document.getElementById(`qty-${idx}`);
        if (qtyField) {
          qtyField.focus();
          qtyField.select();
        }
      } else if (field === 'price') {
        const qtyField = document.getElementById(`qty-${idx}`);
        if (qtyField) {
          qtyField.focus();
          qtyField.select();
        }
      } else if (field === 'qty') {
        const nextSearchField = document.getElementById(`search-${idx + 1}`);
        if (nextSearchField) {
          nextSearchField.focus();
        } else {
          document.getElementById('assign-form').requestSubmit();
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedManagerId) return toast.error('Please select a manager');

    const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) return toast.error('Please add at least one valid item');

    const payloadItems = validItems.map(i => ({
      product_id: i.product_id,
      qty: parseFloat(i.quantity),
      price: parseFloat(i.price) || 0
    }));

    setSaving(true);
    try {
      await walkinApi.adminAssignItems({
        manager_id: selectedManagerId,
        items: payloadItems
      });
      
      toast.success('Items successfully assigned to manager!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to assign items');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '12px', zIndex: 9999 }}>
      <div 
        className="walkin-delivery-modal"
        onClick={e => e.stopPropagation()} 
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden', margin: '5vh auto 0' }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center' }}>
            <Truck size={18} style={{ marginRight: 8, color: 'var(--primary)' }} /> 
            Walk-in Delivery (Assign to Manager)
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          
          {!trip && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Manager</label>
              <select 
                className="form-control" 
                value={selectedManagerId} 
                onChange={e => setSelectedManagerId(e.target.value)}
                required
              >
                <option value="">-- Choose Manager --</option>
                {managers.map(m => (
                  <option key={m._id} value={m._id}>{m.display_name || m.username}</option>
                ))}
              </select>
            </div>
          )}

          {trip && (
            <div style={{ marginBottom: 20, padding: 12, background: '#f0fdf4', borderRadius: 8, color: '#166534', fontSize: 13 }}>
              <strong>Manager:</strong> {trip.manager_id?.display_name || trip.manager_id?.username} | <strong>Vehicle:</strong> {trip.vehicle_number}
              {trip.reinforcement?.vehicle_number && (
                <span> | <strong>Reinforcement:</strong> {trip.reinforcement.vehicle_number}</span>
              )}
              <div style={{ marginTop: 4 }}>Items assigned here will be deducted from global inventory and immediately added to this manager's active vehicle trip.</div>
            </div>
          )}

          {(!trip) && (
            <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 8, color: '#475569', fontSize: 13, border: '1px solid #e2e8f0' }}>
              Items assigned here will be deducted from global inventory and immediately added to the selected manager's local inventory. If they have an active trip, it will also be added to their trip's loaded stock.
            </div>
          )}

          <form id="assign-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Items to Load</label>
              <div style={{ border: '1.5px solid var(--border)', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid var(--border)', width: '50%', borderTopLeftRadius: 11 }}>Product Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid var(--border)', width: '20%' }}>Price</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid var(--border)', width: '20%' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid var(--border)', width: '10%', borderTopRightRadius: 11 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none', position: 'relative' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <input 
                            id={`search-${idx}`}
                            className="form-control form-control-sm"
                            autoComplete="off"
                            value={item.product_name}
                            onChange={e => {
                              updateItem(idx, { product_name: e.target.value, product_id: '' });
                              setActiveSuggestIdx(idx);
                              searchProducts(e.target.value);
                            }}
                            onKeyDown={e => handleKeyDown(e, 'search', idx)}
                            onBlur={() => setTimeout(() => setActiveSuggestIdx(null), 200)}
                            placeholder="Search product..."
                            style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none', fontSize: 14 }}
                          />
                          
                          {activeSuggestIdx === idx && productSuggestions.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 12, width: '300px', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                              {productSuggestions.map(p => (
                                <div key={p._id}
                                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}
                                  onMouseDown={() => { 
                                    const newItems = [...items];
                                    newItems[idx] = { ...newItems[idx], product_name: p.name, product_id: p._id, stock: p.stock, price: p.price };
                                    if (idx === newItems.length - 1) {
                                      newItems.push({ product_id: '', product_name: '', quantity: '0', stock: 0, price: 0 });
                                    }
                                    setItems(newItems);
                                    setProductSuggestions([]);
                                    // Focus QTY after selection
                                    setTimeout(() => {
                                      const qtyField = document.getElementById(`qty-${idx}`);
                                      if (qtyField) { qtyField.focus(); qtyField.select(); }
                                    }, 50);
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                  onMouseLeave={e => e.currentTarget.style.background = ''}
                                >
                                  <span>{p.name}</span>
                                  <span style={{ color: p.stock > 0 ? '#16a34a' : '#ef4444', fontSize: 11 }}>Stock: {p.stock}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input 
                            id={`price-${idx}`}
                            type="number" min="0" step="any"
                            className="form-control form-control-sm"
                            value={item.price || ''}
                            onChange={e => updateItem(idx, { price: e.target.value })}
                            onKeyDown={e => handleKeyDown(e, 'price', idx)}
                            style={{ border: 'none', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, width: '100%', fontSize: 14, color: '#166534', fontWeight: 600 }}
                            placeholder="Price"
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input 
                            id={`qty-${idx}`}
                            type="number" min="0" step="any"
                            className="form-control form-control-sm"
                            value={item.quantity}
                            onChange={e => updateItem(idx, { quantity: e.target.value })}
                            onKeyDown={e => handleKeyDown(e, 'qty', idx)}
                            style={{ border: 'none', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, width: '100%', fontSize: 14 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} style={{ background: 'none', border: 'none', color: items.length === 1 ? '#cbd5e1' : '#ef4444', cursor: items.length === 1 ? 'not-allowed' : 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </div>

        <div style={{ padding: '16px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f8fafc' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving} style={{ padding: '10px 18px', borderRadius: 8 }}>
            Cancel
          </button>
          <button type="submit" form="assign-form" className="btn btn-primary" disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <span className="spinner"></span> : <><Package size={16} /> Assign Items</>}
          </button>
        </div>
      </div>
    </div>
  );
}
