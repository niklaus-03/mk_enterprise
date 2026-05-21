import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { deliveryApi } from '../utils/api';
import { UserCheck, Plus, X, Trash2, Calendar, Clock, Package, CheckCircle, AlertCircle, Search, Filter, ChevronDown } from 'lucide-react';

const QTY_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'bag', 'box', 'dozen', 'quintal', 'ton', 'mtr', 'other'];

const STATUS_META = {
  pending:       { label: 'Pending',       bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  arriving_soon: { label: 'Arriving Soon', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  on_the_way:    { label: 'On the Way',    bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  delivered:     { label: 'Delivered',     bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  not_delivered: { label: 'Not Delivered', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

const EMPTY_FORM = {
  supplier: '',
  notes: '',
  expected_arrival: '',
  items: [{ item_name: '', quantity: 1, unit: 'pcs' }],
};

export default function WalkInDelivery() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  });
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = showAll ? { all: 'true', delivery_type: 'walkin_delivery' } : { date: filterDate, delivery_type: 'walkin_delivery' };
      // WalkIn deliveries use vehicle_number = 'WALK-IN'
      const all = await deliveryApi.getAll({ ...params, all: showAll ? 'true' : undefined, date: showAll ? undefined : filterDate });
      // Filter only walk-in entries (vehicle_number === 'WALK-IN' or delivery_type === 'walkin_delivery')
      setDeliveries(all.filter(d => d.vehicle_number === 'WALK-IN' || d.delivery_type === 'walkin_delivery'));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterDate, showAll]);

  const openModal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setForm({ ...EMPTY_FORM, expected_arrival: now.toISOString().slice(0, 16), items: [{ item_name: '', quantity: 1, unit: 'pcs' }] });
    setShowModal(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { item_name: '', quantity: 1, unit: 'pcs' }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: value };
    return { ...f, items };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.expected_arrival) return toast.error('Arrival date/time is required');
    if (!form.items.length || !form.items[0].item_name) return toast.error('At least one item is required');

    setSaving(true);
    try {
      await deliveryApi.create({
        vehicle_number: 'WALK-IN',
        driver_name: '',
        supplier: form.supplier || 'Walk-in Customer',
        expected_arrival: new Date(form.expected_arrival).toISOString(),
        items: form.items.filter(i => i.item_name.trim()).map(i => ({
          item_name: i.item_name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit || 'pcs',
        })),
        notes: form.notes,
        delivery_type: 'walkin_delivery',
      });
      toast.success('Walk-in delivery recorded!');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const markStatus = async (id, status) => {
    try {
      await deliveryApi.updateStatus(id, status);
      toast.success(`Marked as ${STATUS_META[status]?.label}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this walk-in delivery record?')) return;
    try {
      await deliveryApi.delete(id);
      toast.success('Deleted');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const filtered = deliveries.filter(d =>
    !search ||
    d.supplier?.toLowerCase().includes(search.toLowerCase()) ||
    d.notes?.toLowerCase().includes(search.toLowerCase()) ||
    d.items?.some(i => i.item_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const todayCount = deliveries.filter(d => {
    const today = new Date().toISOString().slice(0, 10);
    return (d.arrival_date_ist || '').slice(0, 10) === today;
  }).length;

  const pendingCount = deliveries.filter(d => d.status === 'pending' || d.status === 'arriving_soon').length;
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex' }}><UserCheck size={22} /></span>
            <span>Walk-in Delivery</span>
          </div>
          <div className="page-subtitle">Record and manage counter/walk-in deliveries</div>
        </div>
        <button className="btn btn-primary" onClick={openModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
          <Plus size={14} /> New Walk-in
        </button>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: "Today's Entries", value: todayCount, icon: '🛍️', bg: '#eff6ff', color: '#2563eb' },
          { label: 'Pending / Coming', value: pendingCount, icon: '⏳', bg: '#fffbeb', color: '#d97706' },
          { label: 'Delivered Today', value: deliveredCount, icon: '✅', bg: '#f0fdf4', color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="card" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="form-control" placeholder="Search by supplier, item..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, borderRadius: 8, fontSize: 14 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#475569' }}>
            <Calendar size={14} />
            <input type="date" className="form-control" value={filterDate} onChange={e => { setFilterDate(e.target.value); setShowAll(false); }} style={{ width: 160, borderRadius: 8, fontSize: 13 }} disabled={showAll} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            All History
          </label>
          <div style={{ marginLeft: 'auto', background: '#f1f5f9', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>
            {filtered.length} records
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="card" style={{ borderRadius: 12 }}>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-icon">🛍️</div>
              <div className="empty-text">No walk-in deliveries found</div>
              <div className="empty-sub">Click "+ New Walk-in" to record one</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>Time</th>
                    <th style={{ padding: '12px 16px' }}>Supplier / Party</th>
                    <th style={{ padding: '12px 16px' }}>Items</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const sm = STATUS_META[d.status] || STATUS_META.pending;
                    return (
                      <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                            {d.expected_arrival_ist || new Date(d.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {new Date(d.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                          {d.supplier || 'Walk-in Customer'}
                          {d.notes && <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 400, marginTop: 2 }}>{d.notes}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {d.items?.slice(0, 3).map((item, i) => (
                            <div key={i} style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                              <strong>{item.quantity}</strong> {item.unit} × {item.item_name}
                            </div>
                          ))}
                          {d.items?.length > 3 && <div style={{ fontSize: 11, color: '#94a3b8' }}>+{d.items.length - 3} more items</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                            {d.status === 'delivered' ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {sm.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {d.status !== 'delivered' && (
                              <button className="btn btn-outline btn-sm" onClick={() => markStatus(d._id, 'delivered')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600, color: '#16a34a', borderColor: '#bbf7d0' }}>
                                <CheckCircle size={12} /> Delivered
                              </button>
                            )}
                            {d.status !== 'not_delivered' && d.status !== 'delivered' && (
                              <button className="btn btn-outline btn-sm" onClick={() => markStatus(d._id, 'not_delivered')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600, color: '#dc2626', borderColor: '#fecaca' }}>
                                <AlertCircle size={12} /> Not Delivered
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(d._id)} style={{ color: '#ef4444', padding: '5px', borderRadius: 6 }} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9999, backdropFilter: 'blur(4px)', padding: 16 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '16px', color: '#1e293b' }}>
                <UserCheck size={18} className="text-primary" /> Record Walk-in Delivery
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Supplier / Party Name</label>
                    <input className="form-control" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. Ramesh Traders" autoFocus style={{ borderRadius: 8 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Date & Time *</label>
                    <input type="datetime-local" className="form-control" value={form.expected_arrival} onChange={e => setForm(f => ({ ...f, expected_arrival: e.target.value }))} required style={{ borderRadius: 8, fontSize: 13 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Notes</label>
                  <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any remarks..." style={{ borderRadius: 8 }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontWeight: 700, color: '#475569', fontSize: 13.5 }}>Items *</label>
                    <button type="button" onClick={addItem} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, borderRadius: 6 }}>
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {form.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: 8, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                        <input className="form-control" placeholder="Item name *" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} required style={{ fontSize: 13, borderRadius: 6 }} />
                        <input className="form-control" type="number" min="0.01" step="0.01" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ fontSize: 13, borderRadius: 6 }} />
                        <select className="form-control" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ fontSize: 12, borderRadius: 6 }}>
                          {QTY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{ borderRadius: 8 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
                    {saving ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : <CheckCircle size={14} />}
                    {saving ? 'Saving...' : 'Record Walk-in'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
