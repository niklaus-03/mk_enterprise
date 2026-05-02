import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { stockApi, productApi } from '../utils/api';
import { formatIST } from '../utils/helpers';

// Enhancement 7: extended unit options
const QTY_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'bag', 'box', 'dozen', 'quintal', 'ton', 'mtr', 'other'];

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', source: '' });
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

  const handleCreate = async () => {
    if (!form.product_id || !form.qty || parseFloat(form.qty) <= 0) return toast.error('Select product and enter quantity');
    setSaving(true);
    try {
      await stockApi.create({ ...form, qty: parseFloat(form.qty) });
      toast.success('Stock movement recorded');
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

  const typeColors = { incoming: 'badge-success', outgoing: 'badge-danger' };
  const sourceColors = { invoice: 'badge-primary', manual: 'badge-gray', return: 'badge-warning', adjustment: 'badge-warning' };

  // Auto-set qty_unit from selected product
  const onProductChange = (e) => {
    const p = products.find(p => p._id === e.target.value);
    setForm({ ...form, product_id: e.target.value, qty_unit: p?.unit || 'pcs' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📦 Stock Movements</div>
          <div className="page-subtitle">{total} total records · Tracks incoming & outgoing stock</div>
        </div>
        <button className="btn btn-primary" onClick={openModal}>+ Record Movement</button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="flex gap-2 flex-center">
              <span className="text-muted fs-13 fw-600">Type:</span>
              {[['', 'All'], ['incoming', '↓ Incoming'], ['outgoing', '↑ Outgoing']].map(([v, l]) => (
                <button key={v} className={`btn btn-sm ${filter.type === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f => ({ ...f, type: v }))}>{l}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-center">
              <span className="text-muted fs-13 fw-600">Source:</span>
              {[['', 'All'], ['invoice', 'Invoice'], ['manual', 'Manual'], ['return', 'Return']].map(([v, l]) => (
                <button key={v} className={`btn btn-sm ${filter.source === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f => ({ ...f, source: v }))}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-pad">
          {loading ? <div className="loading"><span className="spinner"></span></div> : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr>
                  <th>Date (IST)</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th className="tr">Qty</th>
                  <th>Unit</th>
                  <th className="tr">Before</th>
                  <th className="tr">After</th>
                  <th>Vehicle #</th>
                  <th>Driver</th>
                  <th>Notes</th>
                </tr></thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32 }}>No stock movements found.</td></tr>
                  ) : movements.map(m => (
                    <tr key={m._id}>
                      <td style={{ fontSize: 12.5 }}>{m.ist_formatted || formatIST(m.date)}</td>
                      <td><strong>{m.product_name}</strong></td>
                      <td><span className={`badge ${typeColors[m.type]}`}>{m.type === 'incoming' ? '↓ In' : '↑ Out'}</span></td>
                      <td><span className={`badge ${sourceColors[m.source] || 'badge-gray'}`}>{m.source}</span></td>
                      <td className="tr mono fw-700">{m.qty}</td>
                      <td className="text-muted" style={{ fontSize: 12.5 }}>{m.qty_unit || '—'}</td>
                      <td className="tr mono text-muted">{m.stock_before}</td>
                      <td className="tr mono fw-600">{m.stock_after}</td>
                      <td>{m.vehicle_number || <span className="text-muted">—</span>}</td>
                      <td>{m.driver_name || <span className="text-muted">—</span>}</td>
                      <td className="text-muted" style={{ fontSize: 12.5 }}>{m.notes || m.supplier || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Record Movement Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📦 Record Stock Movement</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select className="form-control" value={form.product_id} onChange={onProductChange}>
                  <option value="">-- Select Product --</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} (Stock: {p.stock} {p.unit})</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Movement Type *</label>
                  <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="incoming">↓ Incoming (Stock In)</option>
                    <option value="outgoing">↑ Outgoing (Stock Out)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-control" type="number" min="0.01" step="0.01" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="0" />
                </div>
                {/* Enhancement 7: quantity unit */}
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-control" value={form.qty_unit} onChange={e => setForm({ ...form, qty_unit: e.target.value })}>
                    {QTY_UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              {/* Enhancement 7: vehicle and driver fields */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">🚛 Vehicle Number</label>
                  <input className="form-control" value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. UK07 AB 1234" />
                </div>
                <div className="form-group">
                  <label className="form-label">👤 Driver Name</label>
                  <input className="form-control" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Supplier / Notes</label>
                <input className="form-control" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name, party details, or notes" />
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.product_id}>
                  {saving ? 'Saving...' : '💾 Record Movement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
