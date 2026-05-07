import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productApi, settingsApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { Package, Plus, Trash2, Edit, Check, X, Scale, IndianRupee, AlertTriangle, Save, Sparkles, Info, Search } from 'lucide-react';

const DEFAULT_UNITS = ['bag', 'kg', 'g', 'ltr', 'ml', 'pcs', 'box', 'quintal', 'ton', 'mtr', 'dozen', 'pkt', 'strip'];

function UnitInput({ value, onChange, placeholder = 'bag' }) {
  const [open, setOpen] = useState(false);
  const [customUnits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_units') || '[]'); } catch { return []; }
  });
  const allUnits = [...new Set([...DEFAULT_UNITS, ...customUnits])];

  const addCustomUnit = (unit) => {
    const trimmed = unit.trim().toLowerCase();
    if (!trimmed || allUnits.includes(trimmed)) return;
    const existing = JSON.parse(localStorage.getItem('custom_units') || '[]');
    localStorage.setItem('custom_units', JSON.stringify([...existing, trimmed]));
  };

  const filtered = value
    ? allUnits.filter(u => u.toLowerCase().includes(value.toLowerCase()))
    : allUnits;

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-control"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto' }}>
          {filtered.map(u => (
            <div key={u}
              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
              onMouseDown={() => { onChange(u); setOpen(false); }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{u}</div>
          ))}
          {value && !allUnits.includes(value.toLowerCase().trim()) && (
            <div
              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
              onMouseDown={() => { addCustomUnit(value); onChange(value); setOpen(false); toast(`Unit "${value}" saved`, { icon: '✓' }); }}
            >+ Add "{value}" as new unit</div>
          )}
        </div>
      )}
    </div>
  );
}

const emptyForm = {
  name: '', price: '', gst: '0', unit: 'bag', stock: '0',
  weight_per_unit: '', suggested_price: '', custom_low_stock: '', is_active: true,
};

export default function Products() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromDashboard = searchParams.get('action') === 'add';
  const { settings } = useApp();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [priceCalculated, setPriceCalculated] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const fc = formatCurrency;

  const load = useCallback((q = '') => {
    setLoading(true);
    productApi.getAll({ search: q })
      .then(setProducts)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (fromDashboard) openAdd();
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setPriceCalculated(false);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditId(p._id);
    setForm({
      name: p.name || '',
      price: String(p.price || ''),
      gst: String(p.gst || '0'),
      unit: p.unit || 'bag',
      stock: String(p.stock || '0'),
      weight_per_unit: String(p.weight_per_unit || ''),
      suggested_price: String(p.suggested_price || ''),
      custom_low_stock: p.custom_low_stock != null ? String(p.custom_low_stock) : '',
      is_active: p.is_active !== false,
    });
    setPriceCalculated(false);
    setShowForm(true);
  };

  // Suggested price: Base + (weight/100 * quintal_charge) — calculated ONCE on button click
  const calcSuggestedPrice = () => {
    const base = parseFloat(form.price) || 0;
    const weight = parseFloat(form.weight_per_unit) || 0;
    const quintalCharge = parseFloat(settings?.tax_per_quintal) || 0;
    const gst = parseFloat(form.gst) || 0;

    if (!base) return toast.error('Enter base price first');

    const quintalAdj = weight > 0 && quintalCharge > 0
      ? (weight / 100) * quintalCharge
      : 0;
    const beforeGST = base + quintalAdj;
    const gstAmt = (beforeGST * gst) / 100;
    const suggested = parseFloat((beforeGST + gstAmt).toFixed(2));

    setForm(f => ({ ...f, suggested_price: String(suggested) }));
    setPriceCalculated(true);
    toast.success(`Suggested price: ₹${suggested}`, { duration: 2000 });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Product name required');
    if (!form.price) return toast.error('Base price required');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        gst: parseFloat(form.gst) || 0,
        unit: form.unit || 'bag',
        stock: parseFloat(form.stock) || 0,
        weight_per_unit: parseFloat(form.weight_per_unit) || 0,
        suggested_price: parseFloat(form.suggested_price) || 0,
        custom_low_stock: form.custom_low_stock !== '' ? parseFloat(form.custom_low_stock) : null,
        is_active: form.is_active,
      };
      if (editId) {
        await productApi.update(editId, payload);
        toast.success('Product updated');
      } else {
        await productApi.create(payload);
        toast.success('Product added');
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      if (fromDashboard && !editId) {
        navigate('/');
      } else {
        load(search);
      }
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productApi.delete(id);
      toast.success('Product deleted');
      load(search);
    } catch (err) { toast.error(err.message); }
  };

  const threshold = parseInt(settings?.low_stock_threshold) || 10;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><Package size={22} /></span>
            <span>Products Inventory</span>
          </div>
          <div className="page-subtitle">Manage inventory, pricing, and stock levels</div>
        </div>
        <div className="flex gap-2">
          {showForm ? (
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>✕ Cancel</button>
          ) : (
            <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid #6366f1', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.15)' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1.5px solid #e2e8f0' }}>
            <div style={{ background: editId ? '#fef3c7' : '#ecfdf5', color: editId ? '#d97706' : '#059669', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {editId ? <Edit size={16} /> : <Plus size={16} />}
            </div>
            <div className="card-title" style={{ margin: 0, fontWeight: 800, fontSize: '15.5px', color: '#1e293b' }}>
              {editId ? 'Edit Product Details' : 'Add New Product Inventory'}
            </div>
          </div>
          <div className="card-body" style={{ padding: '20px 24px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(12, 1fr)', 
              gap: '16px',
              alignItems: 'start'
            }}>
              {/* Name */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 4' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>Product Name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cement Bag, Rice" autoFocus style={{ borderRadius: 8 }} />
              </div>

              {/* Unit — dynamic */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>Unit</label>
                <UnitInput value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} />
              </div>

              {/* Weight per unit */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>Weight per Unit (kg)</label>
                <input className="form-control" type="number" min="0" step="0.01"
                  value={form.weight_per_unit}
                  onChange={e => { setForm(f => ({ ...f, weight_per_unit: e.target.value })); setPriceCalculated(false); }}
                  placeholder="e.g. 50" style={{ borderRadius: 8 }} />
                <div className="form-hint" style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>Used for quintal price calculation</div>
              </div>

              {/* Base Price */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>Base Price ₹ *</label>
                <input className="form-control" type="number" min="0" step="0.01"
                  value={form.price}
                  onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setPriceCalculated(false); }}
                  placeholder="0.00" style={{ borderRadius: 8 }} />
              </div>

              {/* GST */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>GST %</label>
                <select className="form-control" value={form.gst}
                  onChange={e => { setForm(f => ({ ...f, gst: e.target.value })); setPriceCalculated(false); }}
                  style={{ borderRadius: 8 }}>
                  {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>

              {/* Suggested Final Price */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 5' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: '#475569' }}>
                  <span>Suggested Final Price ₹</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, borderColor: '#6366f1', color: '#6366f1', background: '#f5f3ff', borderRadius: 6, fontWeight: 600 }}
                    onClick={calcSuggestedPrice}
                  >
                    <Sparkles size={11} fill="#6366f1" /> Calculate Suggested
                  </button>
                </label>
                <input className="form-control" type="number" min="0" step="0.01"
                  value={form.suggested_price}
                  onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))}
                  placeholder="Auto-calculated or manual" style={{ borderRadius: 8 }} />
                <div className="form-hint" style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                  Formula: Base + (Weight ÷ 100 × Quintal Charge) + GST.
                </div>
              </div>

              {/* Stock */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 3' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>Current Stock</label>
                <input className="form-control" type="number" min="0"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="0" style={{ borderRadius: 8 }} />
              </div>

              {/* Custom Low Stock Alert */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 4' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#475569' }}>Custom Low Stock Alert</label>
                <input className="form-control" type="number" min="0"
                  value={form.custom_low_stock}
                  onChange={e => setForm(f => ({ ...f, custom_low_stock: e.target.value }))}
                  placeholder={`Global: ${threshold}`} style={{ borderRadius: 8 }} />
                <div className="form-hint" style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>Leave blank to use global threshold ({threshold})</div>
              </div>
            </div>

            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }} onClick={() => { setShowForm(false); setEditId(null); }}>
                <X size={14} /> Cancel
              </button>
              <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }} onClick={handleSave} disabled={saving}>
                {saving ? (
                  <><span className="spinner"></span> Saving...</>
                ) : (
                  <>
                    <Save size={14} /> {editId ? 'Update Product' : 'Add Product'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 12, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={16} />
            </span>
            <input
              className="form-control"
              placeholder="Search products by name... (e.g. cement, rice, bag)"
              value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value); }}
              style={{ paddingLeft: 36, fontSize: 14, borderRadius: 8 }}
            />
            {search && (
              <button
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                onClick={() => { setSearch(''); load(''); }}
              >✕</button>
            )}
          </div>
          {products.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {products.length} product{products.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Products</div>
          <span className="badge badge-primary">{products.length}</span>
        </div>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : products.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ color: '#cbd5e1', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Package size={48} /></div>
              <div className="empty-text" style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>{search ? `No products match "${search}"` : 'No products yet'}</div>
              <div className="empty-sub" style={{ marginTop: 8 }}>
                {!search && (
                  <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, marginTop: 12 }}>
                    <Plus size={14} /> Add First Product
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {window.innerWidth < 768 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 16px', padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, color: '#0369a1', fontSize: 12, fontWeight: 500 }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>Swipe horizontally ↔ to view full details (GST, Weight, Stock, Actions).</span>
                </div>
              )}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Product Name', 'Base Price', 'GST', 'Final Price', 'Weight', 'Stock', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('Price') || h === 'Stock' || h === 'GST' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => {
                    const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0) ? p.custom_low_stock : threshold;
                    const stockColor = p.stock === 0 ? 'var(--danger)' : p.stock <= minStock ? 'var(--warning)' : 'var(--success)';

                    // Highlight search match
                    const hl = (text) => {
                      if (!search.trim() || !text) return text || '—';
                      const i = text.toLowerCase().indexOf(search.trim().toLowerCase());
                      if (i === -1) return text;
                      return <>{text.slice(0, i)}<mark style={{ background: '#fef08a', padding: 0, borderRadius: 2 }}>{text.slice(i, i + search.trim().length)}</mark>{text.slice(i + search.trim().length)}</>;
                    };

                    return (
                      <tr key={p._id} style={{ borderBottom: '1px solid #f3f4f6', background: !p.is_active ? '#fafafa' : idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {hl(p.name)}
                            {!p.is_active && <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 8 }}>Inactive</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.unit}</div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {fc(p.price)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {p.gst}%
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                          {p.suggested_price > 0 ? fc(p.suggested_price) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)' }}>
                          {p.weight_per_unit > 0 ? `${p.weight_per_unit} kg` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: stockColor }}>
                            {p.stock} {p.unit}
                          </span>
                          {p.stock === 0 && (
                            <span style={{ marginLeft: 4, fontSize: 10, background: '#fef2f2', color: 'var(--danger)', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>Out</span>
                          )}
                          {p.stock > 0 && p.stock <= minStock && (
                            <span style={{ marginLeft: 4, fontSize: 10, background: '#fffbeb', color: '#92400e', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>Low</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                              className="btn btn-outline btn-sm" 
                              onClick={() => openEdit(p)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}
                            >
                              <Edit size={12} /> Edit
                            </button>
                            <button 
                              className="btn btn-ghost btn-sm" 
                              style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }}
                              onClick={() => handleDelete(p._id)}
                              title="Delete Product"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></>
          )}
        </div>
      </div>
    </div>
  );
}