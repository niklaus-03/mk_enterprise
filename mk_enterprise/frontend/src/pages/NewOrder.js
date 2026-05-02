import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { orderApi, productApi, settlementApi } from '../utils/api';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';

// Title-case helper — first letter of each word capitalized
const titleCase = (str) =>
  str.replace(/\b\w/g, c => c.toUpperCase());

const emptyItem = () => ({ product_name: '', product_id: '', qty: '', price: '' });

export default function NewOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useApp();
  const fc = formatCurrency;

  // ── Form state ─────────────────────────────────────────────
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem(), emptyItem()]);
  const [advancePaid, setAdvancePaid] = useState('');
  const [advanceMode, setAdvanceMode] = useState('cash');
  const [saving, setSaving] = useState(false);

  // ── Product search state ────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestIdx, setActiveSuggestIdx] = useState(null);

  // Default delivery date = today (IST)
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
    setDeliveryDate(today);
  }, []);

  // ── Item helpers ────────────────────────────────────────────
  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };

      // Auto-expand: if last row has product_name, add new empty row
      if (field === 'product_name' && value.trim() && idx === next.length - 1) {
        next.push(emptyItem());
      }
      return next;
    });
  };

  const removeItem = (idx) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // Always keep minimum 2 rows
      while (next.length < 2) next.push(emptyItem());
      return next;
    });
  };

  // ── Product search ──────────────────────────────────────────
  const searchProducts = (q, idx) => {
    if (!q.trim()) { setSuggestions([]); setActiveSuggestIdx(null); return; }
    productApi.getAll({ search: q })
      .then(res => {
        setSuggestions(res || []);
        setActiveSuggestIdx(idx);
      })
      .catch(() => { });
  };

  const selectProduct = (p, idx) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = {
        product_name: p.name,
        product_id: p._id,
        qty: next[idx].qty || '1',
        price: String(p.suggested_price || p.price || ''),
      };
      // Auto-expand after select
      if (idx === next.length - 1) next.push(emptyItem());
      return next;
    });
    setSuggestions([]);
    setActiveSuggestIdx(null);
  };

  // ── Totals ──────────────────────────────────────────────────
  const itemTotal = items.reduce((sum, i) => {
    const q = parseFloat(i.qty) || 0;
    const p = parseFloat(i.price) || 0;
    return sum + q * p;
  }, 0);
  const advance = parseFloat(advancePaid) || 0;
  const balance = Math.max(0, itemTotal - advance);

  // ── Phone validation ────────────────────────────────────────
  const handlePhone = (val) => {
    // Strip non-digits, limit to 10
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setCustomerPhone(digits);
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customerName.trim()) return toast.error('Customer name is required');
    if (!customerPhone || customerPhone.length !== 10)
      return toast.error('Enter a valid 10-digit phone number');
    if (!deliveryDate) return toast.error('Delivery date is required');

    const validItems = items.filter(i => i.product_name.trim() && parseFloat(i.qty) > 0);
    if (!validItems.length) return toast.error('Add at least one item with quantity');

    setSaving(true);
    try {
      const order = await orderApi.create({
        customer_name: customerName.trim(),
        customer_phone: customerPhone,
        items: validItems.map(i => ({
          product_id: i.product_id || null,
          product_name: i.product_name.trim(),
          qty: parseFloat(i.qty) || 1,
          price: parseFloat(i.price) || 0,
        })),
        delivery_date: deliveryDate,
        advance_paid: advance,
        advance_mode: advanceMode,
        notes: notes.trim(),
      });

      // If advance paid → create a settlement Received entry
      if (advance > 0) {
        try {
          await settlementApi.create({
            type: 'other_income',
            party_name: customerName.trim(),
            amount: advance,
            mode: advanceMode,
            notes: `Advance for order — ${validItems.map(i => i.product_name).join(', ')}`,
            received_category: 'advance_payment',
          });
        } catch (e) {
          // Don't block order save if settlement fails
          toast('Order saved but settlement entry failed', { icon: '⚠️' });
        }
      }

      toast.success('Order created successfully!');
      navigate('/orders');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📦 New Order</div>
          <div className="page-subtitle">Create a new customer order</div>
        </div>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Customer Info ─────────────────────────────── */}
        <div className="card" style={{ marginBottom: 16, border: '1.5px solid #e5e7eb', borderRadius: 12 }}>
          <div className="card-header" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14, marginBottom: 0 }}>
            <div className="card-title">👤 Customer Details</div>
          </div>
          <div className="card-body">
            <div className="form-row">
              {/* Name */}
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  className="form-control"
                  value={customerName}
                  onChange={e => setCustomerName(titleCase(e.target.value))}
                  placeholder="e.g. Ramesh Kumar"
                  autoFocus
                />
              </div>

              {/* Phone — +91 prefix, 10 digits only */}
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                  <span style={{
                    padding: '9px 10px', background: '#f8fafc', borderRight: '1.5px solid var(--border)',
                    fontSize: 13.5, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  }}>+91</span>
                  <input
                    style={{ border: 'none', outline: 'none', padding: '9px 10px', fontSize: 14, flex: 1, fontFamily: 'monospace', letterSpacing: 1, background: 'transparent' }}
                    value={customerPhone}
                    onChange={e => handlePhone(e.target.value)}
                    placeholder="9876543210"
                    inputMode="numeric"
                    maxLength={10}
                  />
                  {customerPhone.length > 0 && (
                    <span style={{ paddingRight: 10, fontSize: 11, color: customerPhone.length === 10 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                      {customerPhone.length}/10
                    </span>
                  )}
                </div>
              </div>

              {/* Delivery Date */}
              <div className="form-group">
                <label className="form-label">Delivery Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input
                  className="form-control"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Special instructions, remarks..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Items ─────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 16, border: '1.5px solid #e5e7eb', borderRadius: 12 }}>
          <div className="card-header" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14 }}>
            <div className="card-title">📋 Order Items</div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setItems(prev => [...prev, emptyItem()])}
            >+ Add Row</button>
          </div>
          <div className="card-body">
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1fr auto', gap: 8, marginBottom: 6 }}>
              {['Item / Product *', 'Qty', 'Price ₹', ''].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</div>
              ))}
            </div>

            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>

                {/* Item name with live search */}
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    value={item.product_name}
                    placeholder="Type to search product..."
                    onChange={e => {
                      const val = titleCase(e.target.value);
                      updateItem(idx, 'product_name', val);
                      searchProducts(val, idx);
                    }}
                    onBlur={() => setTimeout(() => {
                      setSuggestions([]);
                      setActiveSuggestIdx(null);
                    }, 180)}
                  />
                  {/* Suggestion dropdown */}
                  {activeSuggestIdx === idx && item.product_name.trim() && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: '#fff', border: '1.5px solid var(--border)', borderRadius: 7,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
                    }}>
                      {suggestions.length > 0 && suggestions.map(p => (
                        <div
                          key={p._id}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseDown={() => selectProduct(p, idx)}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Stock: {p.stock} {p.unit} · ₹{p.suggested_price || p.price}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, background: '#f3f4f6', padding: '2px 7px', borderRadius: 10, color: 'var(--text-muted)' }}>{p.unit}</span>
                        </div>
                      ))}
                      {/* Add new item option */}
                      <div
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                        onMouseDown={() => {
                          updateItem(idx, 'product_id', '');
                          setSuggestions([]);
                          setActiveSuggestIdx(null);
                          toast('New item will be added to the order', { icon: '✓', duration: 1500 });
                        }}
                      >
                        + Add "{item.product_name}" as new item
                      </div>
                    </div>
                  )}
                </div>

                {/* Qty */}
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.qty}
                  onChange={e => updateItem(idx, 'qty', e.target.value)}
                  placeholder="0"
                  style={{ textAlign: 'center' }}
                />

                {/* Price */}
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={e => updateItem(idx, 'price', e.target.value)}
                  placeholder="0.00"
                  style={{ textAlign: 'right', fontFamily: 'monospace' }}
                />

                {/* Remove — small dustbin, spaced from price */}
                <button
                  onClick={() => removeItem(idx)}
                  title="Remove row"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#d1d5db', fontSize: 15, padding: '8px 4px',
                    transition: 'color 0.15s', lineHeight: 1,
                    marginLeft: 2,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                >🗑️</button>
              </div>
            ))}

            {/* Item total */}
            {itemTotal > 0 && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Items Total</span>
                <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)' }}>{fc(itemTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Advance Payment ───────────────────────────── */}
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid #e5e7eb', borderRadius: 12 }}>
          <div className="card-header" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14 }}>
            <div className="card-title">💳 Advance Payment</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Optional — will appear in Settlement → Received</span>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Advance Amount ₹</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="0.01"
                  value={advancePaid}
                  onChange={e => setAdvancePaid(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['cash', 'upi', 'online', 'others'].map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`btn btn-sm ${advanceMode === m ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setAdvanceMode(m)}
                    >
                      {m === 'cash' ? '💵' : m === 'upi' ? '📱' : m === 'online' ? '🌐' : '💳'} {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary box */}
            {itemTotal > 0 && (
              <div style={{ marginTop: 12, background: advance > 0 ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${advance > 0 ? '#86efac' : 'var(--border)'}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Items Total</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fc(itemTotal)}</span>
                </div>
                {advance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                      ✅ Advance Paid ({advanceMode.toUpperCase()})
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>−{fc(advance)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '2px solid var(--border)', fontSize: 16 }}>
                  <span style={{ fontWeight: 800 }}>Balance Due on Delivery</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {balance > 0 ? fc(balance) : '✓ Fully Paid'}
                  </span>
                </div>
                {advance > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', background: '#eff6ff', borderRadius: 6, padding: '6px 10px' }}>
                    ℹ️ Advance of {fc(advance)} via {advanceMode.toUpperCase()} will be recorded in Settlement as Received → Advance Payment
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons ────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 40 }}>
          <button className="btn btn-outline" onClick={() => navigate('/orders')}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <><span className="spinner"></span> Saving...</>
              : '💾 Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}