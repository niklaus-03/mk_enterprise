import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productApi, settingsApi, managerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Package, Plus, Trash2, Edit, Check, X, Scale, IndianRupee, AlertTriangle, Save, Sparkles, Info, Search, Share2, Clock, List, ArrowDownAZ, CheckSquare, Square, CheckCircle2, User } from 'lucide-react';
import ProductLists from './ProductLists';
import { productListApi } from '../utils/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto' }}>
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
              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: 'var(--primary-light)' }}
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
  const location = useLocation();
  const [highlightId, setHighlightId] = useState(location.state?.highlightProductId || null);
  const fromDashboard = searchParams.get('action') === 'add';
  const { t, settings } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'supervisor';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 25;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [priceCalculated, setPriceCalculated] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [managers, setManagers] = useState([]);
  const [shareModal, setShareModal] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [sharing, setSharing] = useState(false);

  // New State for Overhaul
  const [activeTab, setActiveTab] = useState('products');
  const [sortBy, setSortBy] = useState('recently_added');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [addToListMode, setAddToListMode] = useState('existing'); // 'existing' | 'new'
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [itemLists, setItemLists] = useState([]);
  const [addingToList, setAddingToList] = useState(false);

  // Sync highlightId when navigating to the same page
  useEffect(() => {
    if (location.state?.highlightProductId) {
      setHighlightId(location.state.highlightProductId);
      // Clean up the history state immediately so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    managerApi.getAll().then(res => setManagers(res.managers || [])).catch(e => console.error('Failed to load managers', e));
    if (isAdmin) {
      productListApi.getAll().then(setItemLists).catch(e => console.error('Failed to load item lists', e));
    }
  }, [isAdmin]);

  // Scroll to highlighted product when products array changes (meaning they've been rendered)
  useEffect(() => {
    if (highlightId && products.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`product-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightId, products]);

  // Clean up highlight on first click anywhere
  useEffect(() => {
    if (highlightId) {
      const handleClick = () => {
        setHighlightId(null);
      };
      // Delay attaching the listener slightly so the initial navigation click doesn't clear it instantly
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClick);
      }, 500);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClick);
      };
    }
  }, [highlightId]);

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!selectedManagerId) return toast.error('Select a manager to share with');
    setSharing(true);
    try {
      await productApi.delegate(shareModal._id, selectedManagerId);
      toast.success('Product shared successfully');
      setShareModal(null);
      setSelectedManagerId('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const fc = formatCurrency;

  const isNewProduct = (createdAt) => {
    if (!createdAt) return false;
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return diffMs < 3 * 60 * 60 * 1000; // 3 hours
  };

  const formatLastUpdated = (updatedAt) => {
    if (!updatedAt) return '';
    const d = new Date(updatedAt);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}, ${time}`;
  };

  // Removed local sortedProducts array as sorting is now handled server-side
  const sortedProducts = products;

  const handleAddToListSubmit = async (e) => {
    e.preventDefault();
    if (selectedProductIds.length === 0) return toast.error('No products selected');
    setAddingToList(true);
    try {
      if (addToListMode === 'new') {
        if (!newListName.trim()) {
          setAddingToList(false);
          return toast.error('New list name is required');
        }
        await productListApi.create({ name: newListName.trim(), products: selectedProductIds });
        toast.success(`Created new list "${newListName}" with ${selectedProductIds.length} items`);
      } else {
        if (!selectedListId) {
          setAddingToList(false);
          return toast.error('Select an existing list');
        }
        const existingList = itemLists.find(l => l._id === selectedListId);
        if (!existingList) throw new Error('List not found');
        const existingIds = existingList.products.map(p => p._id || p);
        const mergedIds = [...new Set([...existingIds, ...selectedProductIds])];
        await productListApi.update(selectedListId, { products: mergedIds });
        toast.success(`Added ${selectedProductIds.length} items to "${existingList.name}"`);
      }
      // Refresh item lists
      productListApi.getAll().then(setItemLists).catch(console.error);
      setSelectedProductIds([]);
      setShowAddToListModal(false);
      setNewListName('');
      setSelectedListId('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingToList(false);
    }
  };

  const load = useCallback((q = '', p = page, s = sortBy) => {
    setLoading(true);
    // If highlighting, fetch a large limit so the product is guaranteed to be in the list
    const requestLimit = highlightId ? 1000 : LIMIT;
    productApi.getAll({ search: q, paginate: true, page: p, limit: requestLimit, sort: s })
      .then(res => {
        setProducts(res.products || []);
        setTotalPages(res.pages || 1);
        setTotalItems(res.total || 0);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, sortBy, highlightId]);

  useEffect(() => { load(search, page, sortBy); }, [load, search, page, sortBy]);

  // Reset page when search or sort changes
  useEffect(() => { setPage(1); }, [search, sortBy]);

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

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await productApi.delete(deleteConfirmId);
      toast.success('Product deleted');
      load(search);
    } catch (err) { toast.error(err.message); }
    finally { setDeleteConfirmId(null); }
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
          <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1.5px solid #e2e8f0', marginBottom: 24, padding: '0 4px' }}>
        <div 
          onClick={() => setActiveTab('products')} 
          style={{ padding: '10px 4px', borderBottom: activeTab === 'products' ? '2.5px solid var(--primary)' : '2.5px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'products' ? 700 : 600, color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }}
        >
          All Products
        </div>
        <div 
          onClick={() => setActiveTab('lists')} 
          style={{ padding: '10px 4px', borderBottom: activeTab === 'lists' ? '2.5px solid var(--primary)' : '2.5px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'lists' ? 700 : 600, color: activeTab === 'lists' ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <List size={16} /> Item Lists
        </div>
      </div>

      {activeTab === 'lists' && (
        <ProductLists />
      )}

      {activeTab === 'products' && (
        <>
          {/* Add / Edit Form */}
      {showForm && (
        <div className="modal-overlay" onMouseDown={() => { setShowForm(false); setEditId(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '20px' }}>
          <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: '800px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1.5px solid #e2e8f0', background: 'var(--sidebar-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: editId ? 'var(--warning-light)' : 'var(--success-light)', color: editId ? '#d97706' : '#059669', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {editId ? <Edit size={16} /> : <Plus size={16} />}
                </div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15.5px', color: 'var(--text)' }}>
                  {editId ? 'Edit Product Details' : 'Add New Product Inventory'}
                </h3>
              </div>
              <button className="btn-close" onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(12, 1fr)', 
              gap: '16px',
              alignItems: 'start'
            }}>
              {/* Name */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 4' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Product Name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => {
                    const val = e.target.value;
                    const capitalized = val.replace(/\b[a-zA-Z]/g, c => c.toUpperCase());
                    setForm(f => ({ ...f, name: capitalized }));
                  }}
                  placeholder="e.g. Cement Bag, Rice" autoFocus style={{ borderRadius: 8 }} />
              </div>

              {/* Unit — dynamic */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Unit</label>
                <UnitInput value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} />
              </div>

              {/* Weight per unit */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Weight per Unit (kg)</label>
                <input className="form-control" type="number" min="0" step="0.01"
                  value={form.weight_per_unit}
                  onChange={e => { setForm(f => ({ ...f, weight_per_unit: e.target.value })); setPriceCalculated(false); }}
                  placeholder="e.g. 50" style={{ borderRadius: 8 }} />
                <div className="form-hint" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>Used for quintal price calculation</div>
              </div>

              {/* Base Price */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Base Price ₹ *</label>
                <input className="form-control" type="number" min="0" step="0.01"
                  value={form.price}
                  onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setPriceCalculated(false); }}
                  onFocus={e => { if (form.price === '0') setForm(f => ({ ...f, price: '' })); }}
                  onBlur={e => { if (form.price === '') setForm(f => ({ ...f, price: '0' })); }}
                  placeholder="0.00" style={{ borderRadius: 8 }} />
              </div>

              {/* GST */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>GST %</label>
                <select className="form-control" value={form.gst}
                  onChange={e => { setForm(f => ({ ...f, gst: e.target.value })); setPriceCalculated(false); }}
                  style={{ borderRadius: 8 }}>
                  {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>

              {/* Suggested Final Price */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 5' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>
                  <span>Suggested Final Price ₹</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, borderColor: '#6366f1', color: '#6366f1', background: '#f5f3ff', borderRadius: 6, fontWeight: 600 }}
                    onClick={calcSuggestedPrice}
                  >
                    <Sparkles size={11} fill="#6366f1" /> Calculate
                  </button>
                </label>
                <input className="form-control" type="number" min="0" step="0.01"
                  value={form.suggested_price}
                  onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))}
                  placeholder="Auto-calculated or manual" style={{ borderRadius: 8 }} />
                <div className="form-hint" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                  Formula: Base + (Weight ÷ 100 × Quintal Charge) + GST.
                </div>
              </div>

              {/* Stock */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 3' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Current Stock</label>
                <input className="form-control" type="number" min="0"
                  value={form.stock}
                  onChange={e => {
                    let val = e.target.value;
                    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                      val = val.replace(/^0+/, '');
                    }
                    if (val === '') val = '0';
                    setForm(f => ({ ...f, stock: val }));
                  }}
                  onFocus={e => { if (form.stock === '0') setForm(f => ({ ...f, stock: '' })); }}
                  onBlur={e => { if (form.stock === '') setForm(f => ({ ...f, stock: '0' })); }}
                  placeholder="0" style={{ borderRadius: 8 }} />
              </div>

              {/* Custom Low Stock Alert */}
              <div className="form-group" style={{ gridColumn: isMobile ? 'span 6' : 'span 4' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Custom Low Stock Alert</label>
                <input className="form-control" type="number" min="0"
                  value={form.custom_low_stock}
                  onChange={e => setForm(f => ({ ...f, custom_low_stock: e.target.value }))}
                  placeholder={`Global: ${threshold}`} style={{ borderRadius: 8 }} />
                <div className="form-hint" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>Leave blank to use global threshold ({threshold})</div>
              </div>
            </div>

            </div>

            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, justifyContent: 'flex-end', background: 'var(--bg)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }} onClick={() => { setShowForm(false); setEditId(null); }}>
                {t('Cancel', 'रद्द करें')}
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

      {/* Search & Sort */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={16} />
            </span>
            <input
              className="form-control"
              placeholder="Search products by name..."
              value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value); }}
              style={{ paddingLeft: 36, fontSize: 14, borderRadius: 8, height: '100%' }}
            />
            {search && (
              <button
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                onClick={() => { setSearch(''); load(''); }}
              >✕</button>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }} title="Sort Products" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', color: '#64748b' }}>
              <ArrowDownAZ size={18} />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', appearance: 'none' }}
            >
              <option value="recently_added">Sort: Recently Added</option>
              <option value="last_updated">Sort: Last Updated</option>
              <option value="name_asc">Sort: Name (A - Z)</option>
              <option value="name_desc">Sort: Name (Z - A)</option>
              <option value="price_asc">Sort: Price (Low - High)</option>
              <option value="price_desc">Sort: Price (High - Low)</option>
            </select>
          </div>
          {totalItems > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {totalItems} product{totalItems !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Products</div>
          <span className="badge badge-primary">{totalItems}</span>
        </div>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : products.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ color: '#cbd5e1', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Package size={48} /></div>
              <div className="empty-text" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>{search ? `No products match "${search}"` : 'No products yet'}</div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 16px', padding: '10px 14px', background: 'var(--primary-light)', border: '1px solid #bae6fd', borderRadius: 10, color: '#0369a1', fontSize: 12, fontWeight: 500 }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>Swipe horizontally ↔ to view full details (GST, Weight, Stock, Actions).</span>
                </div>
              )}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Product Name', 'Base Price', 'GST', 'Final Price', 'Weight', 'Stock', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('Price') || h === 'Stock' || h === 'GST' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((p, idx) => {
                    const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0) ? p.custom_low_stock : threshold;
                    const stockColor = p.stock === 0 ? 'var(--danger)' : p.stock <= minStock ? 'var(--warning)' : 'var(--success)';

                    // Highlight search match
                    const hl = (text) => {
                      if (!search.trim() || !text) return text || '—';
                      const i = text.toLowerCase().indexOf(search.trim().toLowerCase());
                      if (i === -1) return text;
                      return <>{text.slice(0, i)}<mark style={{ background: 'var(--warning-light)', padding: 0, borderRadius: 2 }}>{text.slice(i, i + search.trim().length)}</mark>{text.slice(i + search.trim().length)}</>;
                    };

                    return (
                      <tr id={`product-${p._id}`} key={p._id} style={{ borderBottom: '1px solid #f3f4f6', background: highlightId === p._id ? 'var(--warning-light)' : (!p.is_active ? 'var(--bg-hover)' : idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)'), transition: 'background-color 0.5s ease' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {hl(p.name)}
                              {isNewProduct(p.createdAt) && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 800, letterSpacing: 0.5 }}>NEW</span>}
                              {!p.is_active && <span style={{ fontSize: 10, background: 'var(--border)', color: '#6b7280', padding: '1px 6px', borderRadius: 8 }}>Inactive</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span>{p.unit}</span>
                              {/* Removed shared by label per request */}
                            </div>
                            {p.created_by && p.created_by.role !== 'supervisor' && (
                              <div style={{ fontSize: 11, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, marginTop: 2 }}>
                                <User size={12} /> By: {p.created_by.display_name || p.created_by.username}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                          <div style={{ fontSize: 14 }}>{fc(p.price)}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {formatLastUpdated(p.updatedAt)}</div>
                            {p.last_updated_by && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>by {p.last_updated_by.display_name || p.last_updated_by.username}</div>}
                          </div>
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
                            <span style={{ marginLeft: 4, fontSize: 10, background: 'var(--danger-light)', color: 'var(--danger)', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>Out</span>
                          )}
                          {p.stock > 0 && p.stock <= minStock && (
                            <span style={{ marginLeft: 4, fontSize: 10, background: 'var(--warning-light)', color: '#92400e', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>Low</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {isAdmin && (
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => setShareModal(p)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600, color: '#3b82f6', borderColor: '#bfdbfe' }}
                              >
                                <Share2 size={12} /> Share
                              </button>
                            )}
                            <button 
                              className="btn btn-outline btn-sm" 
                              onClick={() => openEdit(p)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}
                            >
                              <Edit size={12} />{t('Edit', 'संपादित करें')}</button>
                            <button 
                              className="btn btn-ghost btn-sm" 
                              style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }}
                              onClick={() => setDeleteConfirmId(p._id)}
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
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div 
            className={isMobile ? "card-body" : "card-body flex-between"} 
            style={{ 
              paddingTop: 12, 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: isMobile ? 12 : 0,
              borderTop: '1px solid var(--border)'
            }}
          >
            <div className="text-muted fs-13" style={{ textAlign: 'center' }}>
              Showing {Math.min((page - 1) * LIMIT + 1, totalItems)}–{Math.min(page * LIMIT, totalItems)} of {totalItems}
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                // simple pagination window
                let p = page;
                if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                if (p > 0 && p <= totalPages) {
                  return (
                    <button 
                      key={p} 
                      className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} 
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                }
                return null;
              })}
              <button 
                className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" 
                disabled={page >= totalPages} 
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ background: 'var(--danger-light)', color: '#ef4444', padding: 12, borderRadius: '50%', flexShrink: 0 }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Delete Product?</h3>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>Are you sure you want to delete this product? This action cannot be undone.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setDeleteConfirmId(null)} style={{ borderRadius: 8, padding: '8px 16px' }}>{t('Cancel', 'रद्द करें')}</button>
              <button className="btn btn-primary" onClick={confirmDelete} style={{ background: '#ef4444', borderColor: '#ef4444', borderRadius: 8, padding: '8px 16px' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Share Product</h3>
              <button className="btn-close" onClick={() => setShareModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                Give a manager access to <strong>{shareModal.name}</strong>.
              </p>
              <form onSubmit={handleShareSubmit}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Select Manager</label>
                  <select 
                    className="form-control" 
                    value={selectedManagerId} 
                    onChange={e => setSelectedManagerId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Manager --</option>
                    {managers.filter(m => m._id !== user._id).map(m => (
                      <option key={m._id} value={m._id}>{m.display_name || m.username}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShareModal(null)}>{t('Cancel', 'रद्द करें')}</button>
                  <button type="submit" className="btn btn-primary" disabled={sharing}>
                    {sharing ? 'Sharing...' : 'Share Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Add To List Modal */}
      {showAddToListModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Add {selectedProductIds.length} Items to List</h3>
              <button className="btn-close" onClick={() => setShowAddToListModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div onClick={() => setAddToListMode('existing')} style={{ flex: 1, textAlign: 'center', padding: '10px', background: addToListMode === 'existing' ? 'var(--primary-light)' : 'var(--bg)', border: `1px solid ${addToListMode === 'existing' ? '#bfdbfe' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', fontWeight: addToListMode === 'existing' ? 700 : 500, color: addToListMode === 'existing' ? '#1d4ed8' : 'var(--text-muted)' }}>
                  Existing List
                </div>
                <div onClick={() => setAddToListMode('new')} style={{ flex: 1, textAlign: 'center', padding: '10px', background: addToListMode === 'new' ? 'var(--primary-light)' : 'var(--bg)', border: `1px solid ${addToListMode === 'new' ? '#bfdbfe' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', fontWeight: addToListMode === 'new' ? 700 : 500, color: addToListMode === 'new' ? '#1d4ed8' : 'var(--text-muted)' }}>
                  Create New List
                </div>
              </div>

              {addToListMode === 'existing' ? (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Select List</label>
                  {itemLists.length > 0 ? (
                    <select className="form-control" value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
                      <option value="">-- Choose a list --</option>
                      {itemLists.map(l => (
                        <option key={l._id} value={l._id}>{l.name} ({l.products?.length || 0} items)</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '10px 0' }}>No lists found. Please create a new one.</div>
                  )}
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>New List Name</label>
                  <input className="form-control" placeholder="e.g. Weekly Items" value={newListName} onChange={e => setNewListName(e.target.value)} autoFocus />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddToListModal(false)}>{t('Cancel', 'रद्द करें')}</button>
                <button type="button" className="btn btn-primary" onClick={handleAddToListSubmit} disabled={addingToList}>
                  {addingToList ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}