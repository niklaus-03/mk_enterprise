import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { deliveryApi, notificationApi, supplierApi, settlementApi, productApi } from '../utils/api';
import { UserCheck, X, Trash2, CheckCircle, AlertTriangle, Wallet, Smartphone, Globe, CreditCard } from 'lucide-react';

const QTY_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'bag', 'box', 'dozen', 'quintal', 'ton', 'mtr', 'other'];

export default function WalkInDeliveryModal({ onClose, onSuccess, userRole = 'manager' }) {
  const { user } = useAuth();
  const { t, fc } = useApp();
  const [saving, setSaving] = useState(false);
  const [submitAction, setSubmitAction] = useState('save');

  React.useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  const [form, setForm] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return {
      supplier: '',
      expected_arrival: now.toISOString().slice(0, 16),
      notes: '',
      payments: [{ amount: '', mode: 'cash' }],
      items: [{ item_name: '', quantity: '1', unit: '', base_price: '', final_price: '' }],
    };
  });

  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSuggestIdx, setProductSuggestIdx] = useState(null);

  const searchSuppliers = (q) => {
    if (!q.trim()) { setSupplierSuggestions([]); return; }
    supplierApi.getAll(q)
      .then(results => setSupplierSuggestions(results))
      .catch(() => {});
  };

  const searchProducts = (q) => {
    if (!q.trim()) { setProductSuggestions([]); return; }
    productApi.getAll({ search: q })
      .then(setProductSuggestions)
      .catch(() => {});
  };

  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: value };
    // Auto-add new row if we're typing the item_name of the last row
    if (field === 'item_name' && value && idx === items.length - 1) {
      items.push({ item_name: '', quantity: '0', unit: '', base_price: '', final_price: '' });
    }
    return { ...f, items };
  });

  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const addPayment = () => setForm(f => ({ ...f, payments: [...f.payments, { amount: '', mode: 'cash' }] }));
  const removePayment = (idx) => setForm(f => ({ ...f, payments: f.payments.filter((_, i) => i !== idx) }));
  const updatePayment = (idx, field, value) => setForm(f => {
    const payments = [...f.payments];
    payments[idx] = { ...payments[idx], [field]: value };
    return { ...f, payments };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier.trim()) return toast.error('Supplier/Party name is required');
    if (!form.expected_arrival) return toast.error('Arrival date/time is required');
    
    const validItems = form.items.filter(i => i.item_name.trim() && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) return toast.error('Please add at least one valid item');

    setSaving(true);
    try {
      // 1. Create Supplier if new
      const existingSupplier = supplierSuggestions.find(s => s.name.toLowerCase() === form.supplier.trim().toLowerCase());
      if (!existingSupplier && form.supplier.trim()) {
        try { await supplierApi.create({ name: form.supplier.trim() }); } catch (e) { }
      }

      // 2. Create Delivery
      const newDelivery = await deliveryApi.create({
        vehicle_number: 'WALK-IN',
        supplier: form.supplier.trim(),
        driver_name: '',
        expected_arrival: new Date(form.expected_arrival).toISOString(),
        items: validItems.map(i => ({
          item_name: i.item_name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit || 'pcs',
          base_price: i.base_price ? parseFloat(i.base_price) : 0,
          final_price: i.final_price ? parseFloat(i.final_price) : 0,
        })),
        notes: form.notes,
        payment_status: form.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) > 0 ? 'paid' : 'unpaid',
        delivery_type: 'walkin_delivery',
      });

      // 3. Settlement if Paid
      for (const p of form.payments) {
        const amt = parseFloat(p.amount) || 0;
        if (amt > 0) {
          if (!p.mode) return toast.error("Please select a payment mode for the amount: " + amt);
          await settlementApi.create({
            type: 'paid_to_supplier',
            party_name: form.supplier.trim(),
            amount: amt,
            mode: p.mode,
            notes: 'Walk-in delivery payment (Negotiated)',
          });
        }
      }

      if (submitAction === 'save') {
        await deliveryApi.updateStatus(newDelivery._id, 'delivered');
      }

      // 4. Send Notification if Send to Admin
      if (submitAction === 'send') {
        toast.success('Walk-in delivery sent to Admin!');
        try {
          await notificationApi.create({
            type: 'info',
            title: 'Walk-in Delivery Submitted',
            message: `Walk-in delivery for ${form.supplier || 'Walk-in Customer'} needs review.`,
            target_roles: ['admin']
          });
        } catch (e) { }
      } else {
        toast.success('Walk-in delivery recorded!');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const totalBase = form.items.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '12px', zIndex: 9999 }}>
      <div 
        className="walkin-delivery-modal"
        onClick={e => e.stopPropagation()} 
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 650, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden', margin: '5vh auto 0' }}
      >
        
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center' }}>
            <UserCheck size={18} style={{ marginRight: 8, color: 'var(--primary)' }} /> Record Walk-in Delivery
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <form id="walkin-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Supplier / Party Name *</label>
                <input className="form-control"
                  value={form.supplier}
                  onChange={e => {
                    setForm(f => ({ ...f, supplier: e.target.value }));
                    searchSuppliers(e.target.value);
                  }}
                  onBlur={() => setTimeout(() => setSupplierSuggestions([]), 200)}
                  placeholder="e.g. Ramesh Traders" autoFocus required />
                
                {/* Supplier Suggestions */}
                {form.supplier && supplierSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100 }}>
                    {supplierSuggestions.map(s => (
                      <div key={s._id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                        onMouseDown={() => { setForm(f => ({ ...f, supplier: s.name })); setSupplierSuggestions([]); }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        {s.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.phone}</div>}
                      </div>
                    ))}
                    {!supplierSuggestions.some(s => s.name.toLowerCase() === form.supplier.trim().toLowerCase()) && (
                      <div
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                        onMouseDown={() => { setSupplierSuggestions([]); toast('Supplier will be saved', { icon: 'ℹ️' }); }}
                      >
                        + Add "{form.supplier}" as new supplier
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Date & Time *</label>
                <input type="datetime-local" className="form-control" value={form.expected_arrival} onChange={e => setForm(f => ({ ...f, expected_arrival: e.target.value }))} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any remarks..." />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Order Items <span style={{ color: '#ef4444' }}>*</span></div>
              </div>
              <datalist id="unit-options">
                {QTY_UNITS.map(u => <option key={u} value={u} />)}
              </datalist>
              <div className="hide-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
                {form.items.map((item, idx) => (
                  <div key={idx} style={{ minWidth: 550, display: 'grid', gridTemplateColumns: (user?.role === 'walkin_manager' || user?.role === 'temp_manager') ? '2fr 70px 80px 100px auto' : '2fr 70px 80px 100px 100px auto', gap: 12, alignItems: 'center' }}>
                    
                    {/* Item Name */}
                    <div style={{ position: 'relative' }}>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Item Name *</div>}
                      <input className="form-control" placeholder="Type to search..." 
                        value={item.item_name}
                        onChange={e => {
                          const val = e.target.value;
                          updateItem(idx, 'item_name', val);
                          if (val && item.quantity === '0') updateItem(idx, 'quantity', '1');
                          setProductSuggestIdx(idx);
                          searchProducts(val);
                        }}
                        onBlur={() => setTimeout(() => { 
                          const match = productSuggestions.find(p => p.name.toLowerCase() === item.item_name.trim().toLowerCase());
                          if (match) {
                            setForm(f => {
                              const newItems = [...f.items];
                              if (!newItems[idx].base_price && match.supplier_base_price) newItems[idx].base_price = match.supplier_base_price;
                              if (match.unit) newItems[idx].unit = match.unit;
                              return { ...f, items: newItems };
                            });
                          }
                          setProductSuggestions([]); 
                          setProductSuggestIdx(null); 
                        }, 200)}
                        style={{ fontSize: 13, borderRadius: 6 }} 
                      />
                      {productSuggestIdx === idx && item.item_name.trim() && productSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto' }}>
                          {productSuggestions.map(p => (
                            <div key={p._id}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}
                              onMouseDown={() => {
                                setForm(f => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], item_name: p.name, quantity: '1', unit: p.unit || '', base_price: p.supplier_base_price || '', final_price: '' };
                                  if (idx === items.length - 1) {
                                    items.push({ item_name: '', quantity: '0', unit: '', base_price: '', final_price: '' });
                                  }
                                  return { ...f, items };
                                });
                                setProductSuggestions([]); setProductSuggestIdx(null);
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stock: {p.stock} {p.unit} · ₹{p.price}</div>
                              </div>
                            </div>
                          ))}
                          <div
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                            onMouseDown={() => { setProductSuggestions([]); setProductSuggestIdx(null); }}
                          >
                            + Use "{item.item_name}" as new item
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Qty</div>}
                      <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ fontSize: 13, borderRadius: 6 }} />
                    </div>

                    {/* Unit */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Unit</div>}
                      <input 
                        className="form-control" 
                        value={item.unit} 
                        onChange={e => updateItem(idx, 'unit', e.target.value)} 
                        list="unit-options"
                        style={{ fontSize: 13, borderRadius: 6 }} 
                        placeholder="unit"
                      />
                    </div>

                    {/* Base Price */}
                    {user?.role !== 'walkin_manager' && user?.role !== 'temp_manager' && (
                      <div>
                        {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Base (Supp.) ₹</div>}
                        <input className="form-control" type="number" min="0" step="0.01" value={item.base_price} onChange={e => updateItem(idx, 'base_price', e.target.value)} placeholder="0.00" style={{ fontSize: 13, borderRadius: 6 }} />
                      </div>
                    )}

                    {/* Final Price */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Final (Sell) ₹</div>}
                      <input className="form-control" type="number" min="0" step="0.01" value={item.final_price} onChange={e => updateItem(idx, 'final_price', e.target.value)} placeholder="0.00" style={{ fontSize: 13, borderRadius: 6 }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {idx === 0 && <div style={{ fontSize: 10, height: 18, marginBottom: 4 }}>&nbsp;</div>}
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Base Total Display */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '16px 4px', borderTop: '1px solid #f1f5f9', marginTop: 16 }}>
               <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-muted)', marginRight: 12 }}>Base Total:</span>
               <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--primary)' }}>{fc ? fc(totalBase) : `₹${totalBase.toFixed(2)}`}</span>
            </div>

            {/* Payments Section */}
            <div className="card" style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={18} style={{ color: 'var(--success)' }} />
                  Payment Details
                </div>
                <button 
                  type="button"
                  onClick={() => setForm(f => ({ ...f, payments: [...f.payments, { mode: 'cash', amount: '' }] }))}
                  className="btn btn-outline"
                  style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', fontWeight: '700' }}
                >
                  + Add Mode
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {form.payments.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Payment Mode</label>
                      <select 
                        className="form-control" 
                        value={p.mode} 
                        onChange={e => {
                          const newP = [...form.payments];
                          newP[idx].mode = e.target.value;
                          setForm(f => ({ ...f, payments: newP }));
                        }}
                        style={{ height: '38px', fontSize: '13px', borderRadius: '6px' }}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="online">Online</option>
                        <option value="others">Others</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Paid Amount ₹</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="0.00" 
                        value={p.amount}
                        onChange={e => {
                          const newP = [...form.payments];
                          newP[idx].amount = e.target.value;
                          setForm(f => ({ ...f, payments: newP }));
                        }}
                        style={{ height: '38px', fontSize: '14px', borderRadius: '6px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '2px' }}>
                      {idx === 0 ? (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newP = [...form.payments];
                            const currentOtherPaid = newP.filter((_, i) => i !== 0).reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0);
                            newP[0].amount = String(Math.max(0, totalBase - currentOtherPaid));
                            setForm(f => ({ ...f, payments: newP }));
                          }}
                          style={{ height: '38px', padding: '0 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px', border: '1px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                        >
                          Full
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => {
                            const newP = form.payments.filter((_, i) => i !== idx);
                            setForm(f => ({ ...f, payments: newP }));
                          }}
                          style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            </form>
          </div> {/* End Scrollable Body */}

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', padding: '16px 22px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" form="walkin-form" className="btn btn-primary" onClick={() => setSubmitAction('save')} disabled={saving}>
              {saving && submitAction === 'save' ? 'Saving...' : '✓ Save Entry'}
            </button>
          </div>
      </div>
    </div>
  );
}
