import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { orderApi, productApi, settlementApi } from '../utils/api';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';
import { FileSpreadsheet, ArrowLeft, User, Trash2, CreditCard, Wallet, Smartphone, Globe, CheckCircle, Info, Save, FileText, Calendar } from 'lucide-react';

// Title-case helper — first letter of each word capitalized
const titleCase = (str) =>
  str.replace(/\b\w/g, c => c.toUpperCase());

const emptyItem = () => ({ product_name: '', product_id: '', qty: '', price: '' });

export default function NewOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t, settings } = useApp();
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

    // Check for pre-filled data from location state (e.g. from NewInvoice)
    if (location.state?.prefill) {
      const { customerName, customerPhone, items: prefillItems } = location.state.prefill;
      if (customerName) setCustomerName(customerName);
      if (customerPhone) setCustomerPhone(customerPhone);
      if (prefillItems && prefillItems.length > 0) {
        setItems(prefillItems);
      }
    }
  }, [location.state]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px', marginTop: '8px' }}>
      {/* Header */}
      <div className="cs-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, marginTop: '4px', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              New Order
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          <button className="btn btn-outline-danger" onClick={() => navigate('/orders')} style={{ fontWeight: 600, borderRadius: 20, padding: '6px 12px', whiteSpace: 'nowrap' }}>{t('Cancel Order', 'ऑर्डर रद्द करें')}</button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'var(--bg-hover)',
              border: '1.5px solid var(--border)',
              borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              color: 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <FileText size={14} /> Orders
          </button>
        </div>
      </div>

      <div style={{ width: '100%', marginTop: '20px' }}>
        <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          
          {/* ── LEFT COLUMN ── */}
          <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Customer Info ─────────────────────────────── */}
        <div className="card" style={{ marginBottom: 16, border: '1.5px solid #e5e7eb', borderRadius: 12 }}>
          <div className="card-header" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14, marginBottom: 0 }}>
            <div className="card-title d-flex align-items-center gap-2"><User size={18} className="text-secondary" /> Customer Details</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {/* Name */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}><User size={13} /> Customer Name *</label>
                <input
                  className="form-control"
                  value={customerName}
                  onChange={e => setCustomerName(titleCase(e.target.value))}
                  placeholder="e.g. Ramesh Kumar"
                  autoFocus
                />
              </div>

              {/* Phone — +91 prefix, 10 digits only */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}><Smartphone size={13} /> Phone Number *</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-card)' }}>
                  <span style={{
                    padding: '9px 10px', background: 'var(--bg)', borderRight: '1.5px solid var(--border)',
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
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}><Calendar size={13} /> Delivery Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}><FileText size={13} /> Notes (optional)</label>
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
          <div className="card-header" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title d-flex align-items-center gap-2"><FileSpreadsheet size={18} className="text-secondary" /> Order Items</div>
          </div>
          <div className="card-body" style={{ padding: '16px 8px' }}>
            <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
              <div style={{ minWidth: '480px', padding: '0 4px', paddingBottom: '16px' }}>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 32px', gap: 12, marginBottom: 8, padding: '0 4px' }}>
                  {['Item / Product *', 'Qty', 'Price ₹', ''].map((h, i) => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i === 1 ? 'center' : i === 2 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>

            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 32px', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>

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
                      background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 7,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', minWidth: '220px'
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
                          <span style={{ fontSize: 10, background: 'var(--border)', padding: '2px 7px', borderRadius: 10, color: 'var(--text-muted)' }}>{p.unit}</span>
                        </div>
                      ))}
                      {/* Add new item option */}
                      <div
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: '#d97706', fontWeight: 600, background: '#fffbeb' }}
                        onMouseDown={() => {
                          updateItem(idx, 'product_id', '');
                          setSuggestions([]);
                          setActiveSuggestIdx(null);
                          toast('Item will be added as Order', { icon: '📦', duration: 1500 });
                        }}
                      >
                        + Add "{item.product_name}" as Order
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
                    background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, cursor: 'pointer',
                    color: '#ef4444', height: '100%', width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            {/* Item total */}
            {itemTotal > 0 && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Items Total</span>
                <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)' }}>{fc(itemTotal)}</span>
              </div>
            )}
            </div>
          </div>
          </div>
        </div>
        </div>
        {/* END LEFT COLUMN */}

        {/* ── RIGHT COLUMN ── */}
          <div style={{ flex: '1 1 35%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Advance Payment ───────────────────────────── */}
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid #e5e7eb', borderRadius: 12 }}>
          <div className="card-header" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14 }}>
            <div className="card-title d-flex align-items-center gap-2"><CreditCard size={18} className="text-secondary" /> Advance Payment</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Optional — will appear in Settlement → Received</span>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}><CreditCard size={13} /> Advance Amount ₹</label>
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
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {['cash', 'upi', 'online', 'others'].map(m => {
                    const isActive = advanceMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAdvanceMode(m)}
                        style={{
                          width: '100%', justifyContent: 'center', padding: '10px', borderRadius: 8,
                          border: isActive ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
                          background: isActive ? '#eff6ff' : '#f8fafc',
                          color: isActive ? '#2563eb' : '#64748b',
                          fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', gap: 6
                        }}
                        onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                      >
                        {m === 'cash' ? <Wallet size={14} /> : m === 'upi' ? <Smartphone size={14} /> : m === 'online' ? <Globe size={14} /> : <CreditCard size={14} />}
                        {m.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary box */}
            {itemTotal > 0 && (
              <div style={{ marginTop: 12, background: advance > 0 ? 'var(--success-light)' : 'var(--bg)', border: `1.5px solid ${advance > 0 ? '#86efac' : 'var(--border)'}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Items Total</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fc(itemTotal)}</span>
                </div>
                {advance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                    <span style={{ color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} /> Advance Paid ({advanceMode.toUpperCase()})
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>−{fc(advance)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '2px solid var(--border)', fontSize: 16 }}>
                  <span style={{ fontWeight: 800 }}>Balance Due on Delivery</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {balance > 0 ? fc(balance) : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={14} /> Fully Paid</span>}
                  </span>
                </div>
                {advance > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--primary-light)', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={13} /> <span>Advance of {fc(advance)} via {advanceMode.toUpperCase()} will be recorded in Settlement as Received → Advance Payment</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons Moved to Bottom ────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', marginBottom: 40 }}>
          <button
            className="action-glow-btn action-glow-btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <><span className="spinner"></span> Saving...</>
              : <><Save size={18} /> Create Order</>}
          </button>
        </div>
        </div>
        {/* END RIGHT COLUMN */}

        </div>
      </div>
    </div>
  );
}