import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Package, Wallet, CreditCard, Activity, Plus, Trash2, Search, Calendar, Filter, X, ChevronDown, Home, Minus } from 'lucide-react';
import { adminHomeApi, productApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/helpers';

const EXPENSE_CATEGORIES = ['petrol', 'food', 'personal', 'office', 'travel', 'other'];
const TABS = [
  { key: 'item_taken', label: 'Items Taken', icon: Package, color: '#3b82f6' },
  { key: 'cash_taken', label: 'Cash / Wallet', icon: Wallet, color: '#f59e0b' },
  { key: 'expense', label: 'Expenses', icon: CreditCard, color: '#ef4444' },
];

export default function AdminHome() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('item_taken');
  const [summary, setSummary] = useState({ items_total: 0, cash_total: 0, expense_total: 0, grand_total: 0, counts: {} });
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Item taken form
  const [itemSearch, setItemSearch] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemDescription, setItemDescription] = useState('');

  // Cash/Expense form
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 25 };
    if (filterType) params.type = filterType;
    if (filterDate) params.date = filterDate;
    Promise.all([
      adminHomeApi.getAll(params),
      adminHomeApi.getSummary()
    ]).then(([expData, sumData]) => {
      setExpenses(expData.expenses || []);
      setTotal(expData.total || 0);
      setSummary(sumData || { items_total: 0, cash_total: 0, expense_total: 0, grand_total: 0, counts: {} });
    }).catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [page, filterType, filterDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Product search for Items Taken
  useEffect(() => {
    if (!itemSearch.trim()) { setItemSuggestions([]); return; }
    const timer = setTimeout(() => {
      productApi.getAll({ search: itemSearch.trim() }).then(res => {
        const list = Array.isArray(res) ? res : (res?.products || []);
        setItemSuggestions(list.slice(0, 10));
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  const addItem = (product) => {
    const existing = selectedItems.find(i => i.product_id === product._id);
    if (existing) {
      setSelectedItems(prev => prev.map(i => i.product_id === product._id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setSelectedItems(prev => [...prev, {
        product_id: product._id,
        product_name: product.name,
        qty: 1,
        unit: product.unit || 'pcs',
        price: product.price || 0
      }]);
    }
    setItemSearch('');
    setItemSuggestions([]);
  };

  const removeItem = (idx) => setSelectedItems(prev => prev.filter((_, i) => i !== idx));
  const updateItemQty = (idx, delta) => {
    setSelectedItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(0.5, item.qty + delta);
      return { ...item, qty: newQty };
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const data = { type: activeTab };
      if (activeTab === 'item_taken') {
        if (!selectedItems.length) { toast.error('Add at least one item'); setSaving(false); return; }
        data.items = selectedItems;
        data.description = itemDescription;
      } else {
        if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); setSaving(false); return; }
        data.amount = parseFloat(amount);
        data.category = category;
        data.description = description;
      }
      await adminHomeApi.create(data);
      toast.success(activeTab === 'item_taken' ? 'Items recorded & stock deducted' : 'Entry recorded');
      // Reset forms
      setSelectedItems([]); setItemDescription(''); setAmount(''); setDescription(''); setCategory('other');
      loadData();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry? Stock will be restored if items were taken.')) return;
    try {
      await adminHomeApi.delete(id);
      toast.success('Entry deleted');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const getTypeLabel = (type) => {
    if (type === 'item_taken') return 'Items';
    if (type === 'cash_taken') return 'Cash';
    if (type === 'expense') return 'Expense';
    return type;
  };

  const getTypeColor = (type) => {
    if (type === 'item_taken') return '#3b82f6';
    if (type === 'cash_taken') return '#f59e0b';
    if (type === 'expense') return '#ef4444';
    return '#6b7280';
  };

  const fc = formatCurrency;
  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Home size={22} style={{ color: 'var(--primary)' }} />
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Admin Home</h2>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>Personal usage & expense tracker</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Items Value', value: summary.items_total, icon: Package, color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
          { label: 'Cash Taken', value: summary.cash_total, icon: Wallet, color: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)' },
          { label: 'Expenses', value: summary.expense_total, icon: CreditCard, color: '#ef4444', bg: 'linear-gradient(135deg, #fef2f2, #fecaca)' },
          { label: 'Total This Month', value: summary.grand_total, icon: Activity, color: '#8b5cf6', bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' },
        ].map((card, idx) => (
          <div key={idx} style={{
            background: card.bg, borderRadius: 14, padding: '18px 16px',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <card.icon size={18} color={card.color} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color, letterSpacing: '-0.5px' }}>{fc(card.value)}</div>
          </div>
        ))}
      </div>

      {/* Action Tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg-card)',
        borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden'
      }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
            background: activeTab === tab.key ? tab.color : 'transparent',
            color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
            fontWeight: activeTab === tab.key ? 700 : 500,
            fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.2s',
            borderRight: '1px solid var(--border)',
          }}>
            <tab.icon size={15} />
            <span className="hide-on-mobile-text">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Action Form */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 14, padding: 20,
        border: '1px solid var(--border)', marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {activeTab === 'item_taken' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Search & Add Products</label>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0 12px' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  placeholder="Search product name..."
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '10px 0', fontSize: 14, color: 'var(--text)' }}
                />
                {itemSearch && <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => { setItemSearch(''); setItemSuggestions([]); }} />}
              </div>
              {itemSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  maxHeight: 220, overflowY: 'auto', marginTop: 4,
                }}>
                  {itemSuggestions.map(p => (
                    <div key={p._id} onClick={() => addItem(p)} style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13.5,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>₹{p.price} · {p.stock} {p.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Items List */}
            {selectedItems.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {selectedItems.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: 'var(--bg)', borderRadius: 8, marginBottom: 6,
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{item.product_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => updateItemQty(idx, -1)} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                      <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{item.qty}</span>
                      <button onClick={() => updateItemQty(idx, 1)} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28 }}>{item.unit}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', minWidth: 60, textAlign: 'right' }}>₹{(item.price * item.qty).toFixed(0)}</span>
                    <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={15} /></button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>
                  Total: ₹{selectedItems.reduce((sum, i) => sum + (i.price * i.qty), 0).toFixed(0)}
                </div>
              </div>
            )}

            <input
              value={itemDescription}
              onChange={e => setItemDescription(e.target.value)}
              placeholder="Notes (optional)..."
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 13.5, color: 'var(--text)', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {activeTab === 'cash_taken' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Cash / Wallet Withdrawal</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount (₹)"
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10, boxSizing: 'border-box' }}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Purpose / Notes..."
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 13.5, color: 'var(--text)', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {activeTab === 'expense' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Personal Expense</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount (₹)"
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10, boxSizing: 'border-box' }}
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 13.5, color: 'var(--text)', marginBottom: 10, boxSizing: 'border-box' }}
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description..."
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontSize: 13.5, color: 'var(--text)', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            marginTop: 14, width: '100%', padding: '12px 0',
            background: TABS.find(t => t.key === activeTab)?.color || '#3b82f6',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14.5, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <Plus size={17} /> {saving ? 'Saving...' : activeTab === 'item_taken' ? 'Record Items Taken' : activeTab === 'cash_taken' ? 'Record Cash Taken' : 'Record Expense'}
        </button>
      </div>

      {/* History Section */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 14, padding: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>History</h3>
          <button onClick={() => setShowFilters(!showFilters)} style={{
            background: showFilters ? 'var(--primary-light)' : 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px',
            fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            color: showFilters ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600,
          }}>
            <Filter size={13} /> Filters
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={filterDate}
              onChange={e => { setFilterDate(e.target.value); setPage(1); }}
              style={{ padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}
            />
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPage(1); }}
              style={{ padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}
            >
              <option value="">All Types</option>
              <option value="item_taken">Items Taken</option>
              <option value="cash_taken">Cash / Wallet</option>
              <option value="expense">Expenses</option>
            </select>
            {(filterDate || filterType) && (
              <button onClick={() => { setFilterDate(''); setFilterType(''); setPage(1); }} style={{
                background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
                borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 8px' }}></div>
            Loading...
          </div>
        ) : expenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            <Home size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div style={{ fontSize: 14 }}>No entries yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Record your first entry above</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Details</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {exp.ist_formatted || new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
                          background: getTypeColor(exp.type) + '18',
                          color: getTypeColor(exp.type),
                        }}>{getTypeLabel(exp.type)}</span>
                      </td>
                      <td style={{ padding: '10px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.type === 'item_taken' && exp.items?.length ? (
                          <span>{exp.items.map(i => `${i.product_name} ×${i.qty}`).join(', ')}</span>
                        ) : (
                          <span>{exp.description || exp.category || '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: getTypeColor(exp.type) }}>
                        {fc(exp.amount)}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        <button onClick={() => handleDelete(exp._id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, opacity: 0.6
                        }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >← Prev</button>
                <span style={{ padding: '6px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
