import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { stockApi, productApi } from '../utils/api';
import { formatIST } from '../utils/helpers';
import { Package, Plus, Filter, ArrowDownRight, ArrowUpRight, FileText, Settings2, RefreshCcw, Truck, User, AlignLeft, Calendar, Info, Layers, CheckCircle2, X } from 'lucide-react';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

const QTY_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'bag', 'box', 'dozen', 'quintal', 'ton', 'mtr', 'other'];

export default function StockMovements() {
  const { t } = useApp();
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [filter, setFilter] = useState({ type: '', source: '', product_id: location.state?.filterProductId || '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'incoming', qty: '', qty_unit: 'pcs', vehicle_number: '', driver_name: '', supplier: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    stockApi.getAll({ ...filter, page, limit: 50 })
      .then(d => { setMovements(d.movements); setTotal(d.total); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { productApi.getAll().then(setProducts).catch(() => {}); }, []);
  useEffect(() => { load(); }, [filter, page]);

  const refreshPage = useCallback(() => {
    productApi.getAll().then(setProducts).catch(() => {});
    load();
  }, [filter, page]);
  useRegisterRefresh(refreshPage);

  const handleCreate = async () => {
    if (!form.product_id || !form.qty || parseFloat(form.qty) <= 0) return toast.error('Select product and enter a valid quantity');
    setSaving(true);
    try {
      await stockApi.create({ ...form, qty: parseFloat(form.qty) });
      toast.success('Stock movement recorded successfully');
      setShowModal(false);
      setForm({ product_id: '', type: 'incoming', qty: '', qty_unit: 'pcs', vehicle_number: '', driver_name: '', supplier: '', notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openModal = () => {
    setForm({ product_id: '', type: 'incoming', qty: '', qty_unit: 'pcs', vehicle_number: '', driver_name: '', supplier: '', notes: '' });
    setShowModal(true);
  };

  const onProductChange = (e) => {
    const p = products.find(p => p._id === e.target.value);
    setForm({ ...form, product_id: e.target.value, qty_unit: p?.unit || 'pcs' });
  };

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--warning-light)', color: '#d97706', padding: 8, borderRadius: 12, display: 'flex' }}>
              <Layers size={24} strokeWidth={2.5} />
            </div>
            <span>Stock Ledger</span>
          </div>
          <div className="page-subtitle" style={{ marginLeft: 50 }}>Track all incoming and outgoing inventory movements</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={openModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontWeight: 700, padding: '10px 18px', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
          >
            <Plus size={16} /> Record Movement
          </button>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="card" style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div className="card-body" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', background: 'var(--bg)', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={16} /> Filters
            </span>
            <select
              className="form-control"
              value={filter.type}
              onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
              style={{ width: 140, borderRadius: 8, fontSize: 13 }}
            >
              <option value="">All Types</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
            <select
              className="form-control"
              value={filter.source}
              onChange={e => setFilter(f => ({ ...f, source: e.target.value }))}
              style={{ width: 140, borderRadius: 8, fontSize: 13 }}
            >
              <option value="">All Sources</option>
              <option value="invoice">Invoice</option>
              <option value="manual">Manual</option>
              <option value="return">Return</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 10 }}>
            {filter.product_id && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10, borderRight: '1px solid #e2e8f0', color: 'var(--text)' }}>
                Product Filter Active 
                <button onClick={() => setFilter(f => ({ ...f, product_id: '' }))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </span>
            )}
            {total} Records Found
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="card" style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <div className="card-body no-pad" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner"></span></div>
          ) : movements.length === 0 ? (
             <div className="empty-state" style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ background: 'var(--bg)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#94a3b8' }}>
                  <Layers size={32} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No Movements Found</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try adjusting your filters or record a new movement.</div>
              </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg)', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  {['Date (IST)', 'Product', 'Type', 'Source', 'Qty', 'Unit', 'Before', 'Balance', 'Vehicle / Driver', 'Notes'].map((h, i) => (
                    <th key={h} style={{
                      padding: '16px 20px',
                      textAlign: (i === 4 || i === 6 || i === 7) ? 'right' : 'left',
                      fontSize: 11.5, fontWeight: 800, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => {
                  const isIncoming = m.type === 'incoming';
                  return (
                    <tr key={m._id} style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)',
                      transition: 'background 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'} onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)'}>
                      
                      <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{m.ist_formatted ? m.ist_formatted.split(' ')[0] : formatIST(m.date).split(' ')[0]}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{m.ist_formatted ? m.ist_formatted.split(' ').slice(1).join(' ') : formatIST(m.date).split(' ').slice(1).join(' ')}</div>
                      </td>

                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
                        {m.product_name}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          color: isIncoming ? '#16a34a' : '#ef4444',
                          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          {isIncoming ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                          {m.type}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          color: 'var(--text-muted)',
                          fontSize: 12, fontWeight: 600, textTransform: 'capitalize'
                        }}>
                          <span style={{ color: m.source === 'invoice' ? '#6366f1' : m.source === 'manual' ? '#94a3b8' : '#f59e0b', display: 'flex' }}>
                            {m.source === 'invoice' ? <FileText size={14} /> : m.source === 'manual' ? <Settings2 size={14} /> : <RefreshCcw size={14} />}
                          </span>
                          {m.source}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: 15, fontFamily: 'monospace', color: isIncoming ? '#16a34a' : '#dc2626' }}>
                        {isIncoming ? '+' : '−'}{m.qty}
                      </td>

                      <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                        {m.qty_unit || '—'}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#94a3b8' }}>
                        {m.stock_before ?? (isIncoming ? m.stock_after - m.qty : m.stock_after + m.qty)}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                        {m.stock_after}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {(m.vehicle_number || m.driver_name) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {m.vehicle_number && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} className="text-primary" /> {(m.vehicle_number || '').toUpperCase()}</span>}
                            {m.driver_name && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><User size={10} /> {m.driver_name}</span>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, fontStyle: 'italic' }}>
                            <User size={12} /> Self Pickup
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {(m.notes || m.supplier || m.created_by) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 180 }}>
                            {m.supplier && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.supplier}</span>}
                            {m.notes && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 4 }}><AlignLeft size={12} style={{ marginTop: 2, flexShrink: 0 }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes}</span></span>}
                            {m.created_by && <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><User size={10} /> By: {m.created_by.display_name || m.created_by.username}</span>}
                          </div>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── RECORD MODAL ── */}
      {showModal && (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div className="modal" style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 650, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', overflow: 'hidden', animation: 'modalSlideUp 0.3s ease' }}>
            
            <div className="modal-header" style={{ background: 'var(--bg)', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'var(--primary-light)', color: '#4f46e5', padding: 8, borderRadius: 10 }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Record Stock Movement</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Manually adjust inventory levels</div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--bg-hover)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-hover)'}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: 24 }}>
              
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Select Product <span className="text-danger">*</span></label>
                <select className="form-control" value={form.product_id} onChange={onProductChange} style={{ borderRadius: 12, border: '2px solid #e2e8f0', padding: '12px 16px', fontSize: 14, fontWeight: 600, color: form.product_id ? 'var(--sidebar-bg)' : '#94a3b8', cursor: 'pointer' }}>
                  <option value="">-- Choose a product from inventory --</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} (Current: {p.stock} {p.unit})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Movement Type <span className="text-danger">*</span></label>
                <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 10, padding: 4 }}>
                  <button onClick={() => setForm({ ...form, type: 'incoming' })} style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: form.type === 'incoming' ? 'var(--bg-card)' : 'transparent', color: form.type === 'incoming' ? '#16a34a' : 'var(--text-muted)', fontWeight: form.type === 'incoming' ? 700 : 600, fontSize: 14, boxShadow: form.type === 'incoming' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                    <ArrowDownRight size={18} /> Incoming
                  </button>
                  <button onClick={() => setForm({ ...form, type: 'outgoing' })} style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: form.type === 'outgoing' ? 'var(--bg-card)' : 'transparent', color: form.type === 'outgoing' ? '#dc2626' : 'var(--text-muted)', fontWeight: form.type === 'outgoing' ? 700 : 600, fontSize: 14, boxShadow: form.type === 'outgoing' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                    <ArrowUpRight size={18} /> Outgoing
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Quantity <span className="text-danger">*</span></label>
                  <input className="form-control" type="number" min="0.01" step="0.01" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="0.00" style={{ borderRadius: 12, border: '2px solid #e2e8f0', padding: '12px 16px', fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Unit</label>
                  <select className="form-control" value={form.qty_unit} onChange={e => setForm({ ...form, qty_unit: e.target.value })} style={{ borderRadius: 12, border: '2px solid #e2e8f0', padding: '12px', fontSize: 14, fontWeight: 600 }}>
                    {QTY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 12, border: '1px dashed #cbd5e1', marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={14} /> Optional Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <input className="form-control" value={(form.vehicle_number || '').toUpperCase()} onChange={e => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })} placeholder="Vehicle Number (e.g. UK07 AB 1234)" style={{ borderRadius: 10, fontSize: 13 }} />
                  </div>
                  <div>
                    <input className="form-control" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} placeholder="Driver Name" style={{ borderRadius: 10, fontSize: 13 }} />
                  </div>
                </div>
                <div>
                  <input className="form-control" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name or any additional remarks..." style={{ borderRadius: 10, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ borderRadius: 10, fontWeight: 600, padding: '10px 20px' }}>{t('Cancel', 'रद्द करें')}</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.product_id} style={{ borderRadius: 10, fontWeight: 700, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {saving ? <span className="spinner" style={{ width: 16, height: 16 }}></span> : <CheckCircle2 size={16} />} 
                  {saving ? 'Saving...' : 'Confirm Movement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
