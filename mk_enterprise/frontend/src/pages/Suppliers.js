import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supplierApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [history, setHistory] = useState({ history: [], totalPaid: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAll, setHistoryAll] = useState(false);
  const fc = formatCurrency;

  const load = (q = '') => {
    setLoading(true);
    supplierApi.getAll(q)
      .then(setSuppliers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadHistory = (supplier, all = false) => {
    setHistoryLoading(true);
    setHistoryAll(all);
    supplierApi.getHistory(supplier._id, { all: all ? 'true' : undefined })
      .then(res => {
        setSelectedSupplier(res.supplier);
        setHistory({ history: res.history, totalPaid: res.totalPaid });
      })
      .catch(e => toast.error(e.message))
      .finally(() => setHistoryLoading(false));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Supplier name is required');
    setSaving(true);
    try {
      await supplierApi.create(form);
      toast.success('Supplier added');
      setForm({ name: '', phone: '', address: '', notes: '' });
      setShowAddForm(false);
      load(search);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this supplier?')) return;
    try {
      await supplierApi.delete(id);
      toast.success('Supplier removed');
      if (selectedSupplier?._id === id) setSelectedSupplier(null);
      load(search);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🏭 Suppliers</div>
          <div className="page-subtitle">Manage suppliers and view payment history</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowAddForm(f => !f)}>
            {showAddForm ? '✕ Cancel' : '+ Add Supplier'}
          </button>
          <Link to="/" className="btn btn-outline">← Dashboard</Link>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">➕ New Supplier</div>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ramesh Traders" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Mobile number" />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-control" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-control" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner"></span> Saving...</> : '💾 Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedSupplier ? '1fr 1.4fr' : '1fr', gap: 20 }}>

        {/* Supplier List */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              All Suppliers
              <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 11 }}>
                {suppliers.length}
              </span>
            </div>
          </div>
          <div className="card-body" style={{ paddingBottom: 8 }}>
            <input
              className="form-control"
              placeholder="🔍 Search supplier name or phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value); }}
              style={{ marginBottom: 0 }}
            />
          </div>
          <div className="card-body no-pad">
            {loading ? (
              <div className="loading"><span className="spinner"></span></div>
            ) : suppliers.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-icon">🏭</div>
                <div className="empty-text">
                  {search ? `No suppliers match "${search}"` : 'No suppliers yet'}
                </div>
                <div className="empty-sub">Click "+ Add Supplier" to get started</div>
              </div>
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {suppliers.map((s, idx) => (
                  <div
                    key={s._id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      background: selectedSupplier?._id === s._id
                        ? 'var(--primary-light)' : idx % 2 === 0 ? '#fff' : '#fafafa',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => {
                      if (selectedSupplier?._id === s._id) {
                        setSelectedSupplier(null);
                      } else {
                        loadHistory(s, false);
                      }
                    }}
                    onMouseEnter={e => { if (selectedSupplier?._id !== s._id) e.currentTarget.style.background = '#f0f9ff'; }}
                    onMouseLeave={e => { if (selectedSupplier?._id !== s._id) e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                      {s.phone && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          📞 {s.phone}
                        </div>
                      )}
                      {s.address && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {s.address}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {selectedSupplier?._id === s._id && (
                        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                          ● Selected
                        </span>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); handleDelete(s._id); }}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment History Panel */}
        {selectedSupplier && (
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="card-title">💸 {selectedSupplier.name}</div>
                <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>
                  Total Paid: {fc(history.totalPaid)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${!historyAll ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => loadHistory(selectedSupplier, false)}
                >📅 Recent</button>
                <button
                  className={`btn btn-sm ${historyAll ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => loadHistory(selectedSupplier, true)}
                >📚 All History</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSupplier(null)}>✕</button>
              </div>
            </div>
            <div className="card-body no-pad">
              {historyLoading ? (
                <div className="loading"><span className="spinner"></span></div>
              ) : history.history.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  No payment records found for this supplier.
                </div>
              ) : (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {['Date', 'Time', 'Mode', 'Notes', 'Amount'].map(h => (
                          <th key={h} style={{
                            padding: '10px 14px',
                            textAlign: h === 'Amount' ? 'right' : 'left',
                            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            borderBottom: '1.5px solid var(--border)',
                            whiteSpace: 'nowrap'
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.history.map((h, idx) => (
                        <tr key={h._id} style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: idx % 2 === 0 ? '#fff' : '#fafafa'
                        }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {h.ist_date
                              ? new Date(h.ist_date + 'T00:00:00').toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric'
                                })
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {h.ist_formatted ? h.ist_formatted.split(' ').slice(1).join(' ') : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, textTransform: 'uppercase' }}>
                            {h.mode === 'cash' ? '💵' : h.mode === 'upi' ? '📱' : '🌐'} {h.mode}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                            {h.notes || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)', fontFamily: 'monospace' }}>
                            −{fc(h.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}