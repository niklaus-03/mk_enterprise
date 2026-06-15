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
      paid: false,
      mode: 'cash',
      items: [{ item_name: '', quantity: '1', unit: 'bag', base_price: '', final_price: '' }],
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
      items.push({ item_name: '', quantity: '0', unit: 'bag', base_price: '', final_price: '' });
    }
    return { ...f, items };
  });

  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

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
        payment_status: form.paid ? 'paid' : 'unpaid',
        delivery_type: 'walkin_delivery',
      });

      if (submitAction === 'save') {
        await deliveryApi.updateStatus(newDelivery._id, 'delivered');
      }

      // 3. Settlement if Paid
      // Note: We use final_price * qty for total, or base_price * qty?
      // For Walk-in delivery, if paying the supplier, usually it's base_price (cost).
      // If selling, it's final_price. Walk-in delivery means we receive goods and pay them.
      const totalAmount = validItems.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0);
      
      if (form.paid && totalAmount > 0) {
        await settlementApi.create({
          type: 'paid_to_supplier',
          party_name: form.supplier.trim(),
          amount: totalAmount,
          mode: form.mode,
          notes: 'Walk-in delivery payment',
        });
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
                        onBlur={() => setTimeout(() => { setProductSuggestions([]); setProductSuggestIdx(null); }, 200)}
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
                                  items[idx] = { ...items[idx], item_name: p.name, quantity: '1', unit: p.unit || 'bag', base_price: p.supplier_base_price || '', final_price: '' };
                                  if (idx === items.length - 1) {
                                    items.push({ item_name: '', quantity: '0', unit: 'bag', base_price: '', final_price: '' });
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
                      <select className="form-control" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ fontSize: 12, borderRadius: 6 }}>
                        <option value="">-</option>
                        {QTY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
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

            {/* Total + Payment */}
            {totalBase > 0 && (
              <div style={{ background: 'linear-gradient(to right, #fffbeb, #fef3c7)', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, boxShadow: '0 4px 6px -1px rgba(251, 191, 36, 0.1)', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#92400e' }}>Base Total: <span style={{ color: '#d97706', fontSize: 18 }}>{fc ? fc(totalBase) : `₹${totalBase.toFixed(2)}`}</span></div>
                  {!form.paid && (
                    <span style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={14} /> Unpaid</span>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Paid / Unpaid Toggle */}
                  <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 8, gap: 4 }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, paid: false }))}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        background: !form.paid ? '#ef4444' : 'transparent',
                        color: !form.paid ? '#fff' : '#64748b',
                        boxShadow: !form.paid ? '0 2px 4px rgba(239, 68, 68, 0.2)' : 'none'
                      }}>
                      UNPAID
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, paid: true }))}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        background: form.paid ? '#22c55e' : 'transparent',
                        color: form.paid ? '#fff' : '#64748b',
                        boxShadow: form.paid ? '0 2px 4px rgba(34, 197, 94, 0.2)' : 'none'
                      }}>
                      PAID
                    </button>
                  </div>

                  {form.paid && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {['cash', 'upi', 'online', 'others'].map(m => (
                        <button
                          key={m} type="button"
                          onClick={() => setForm(f => ({ ...f, mode: m }))}
                          style={{
                            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            border: form.mode === m ? 'none' : '1px solid #cbd5e1',
                            background: form.mode === m ? '#2563eb' : '#fff',
                            color: form.mode === m ? '#fff' : '#475569',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            boxShadow: form.mode === m ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          {m === 'cash' && <Wallet size={14} />}
                          {m === 'upi' && <Smartphone size={14} />}
                          {m === 'online' && <Globe size={14} />}
                          {m === 'others' && <CreditCard size={14} />}
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            </form>
          </div> {/* End Scrollable Body */}

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', padding: '16px 22px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" form="walkin-form" className="btn btn-primary" onClick={() => setSubmitAction('save')} disabled={saving}>
              {saving && submitAction === 'save' ? 'Saving...' : '✓ Save Entry'}
            </button>
            {(userRole === 'manager' || userRole === 'admin') && (
              <button type="submit" form="walkin-form" className="btn btn-primary" onClick={() => setSubmitAction('send')} disabled={saving}>
                {saving && submitAction === 'send' ? 'Sending...' : '✓ Send to Admin'}
              </button>
            )}
          </div>
      </div>
    </div>
  );
}
