import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';;
import toast from 'react-hot-toast';
import { customerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';

const EMPTY = { name: '', phone: '', address: '', balance: '', gstin: '' };

export default function Customers() {
  const { t } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromDashboard = searchParams.get('action') === 'add';
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Auto-open Add form if redirected from dashboard
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      openAdd();
    }
  }, []);

  const load = () => customerApi.getAll({ search }).then(setCustomers).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  // Auto-open add form when navigated from dashboard with ?action=add
  useEffect(() => {
    if (fromDashboard) {
      // Open your existing add modal here — replace openAdd() with whatever
      // function your Customers page uses to show the add form
      openAdd();
    }
  }, []);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (c) => { setForm({ name: c.name, phone: c.phone || '', address: c.address || '', balance: c.balance, gstin: c.gstin || '' }); setEditId(c._id); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setForm(EMPTY); setEditId(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Customer name required');
    setSaving(true);
    try {
      const data = { ...form, balance: parseFloat(form.balance) || 0 };
      if (editId) {
        await customerApi.update(editId, form);
        toast.success('Customer updated');
        closeModal();
        load();
      } else {
        await customerApi.create(form);
        toast.success('Customer added');
        closeModal();
        if (fromDashboard) {
          // Return to dashboard after adding from dashboard shortcut
          navigate('/');
        } else {
          load();
        }
      }
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await customerApi.delete(c._id); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const fc = formatCurrency;
  const totalDue = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);

  const balanceCell = (b) => {
    if (b > 0.01) return <span className="balance-due">{fc(b)} <small>(Due)</small></span>;
    if (b < -0.01) return <span className="balance-advance">{fc(Math.abs(b))} <small>(Advance)</small></span>;
    return <span className="balance-zero">—</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">👥 {t('Customers', 'ग्राहक')}</div>
          <div className="page-subtitle">{customers.length} customers · Total dues: {fc(totalDue)}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="form-control" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280, paddingLeft: 36 }} />
          </div>
        </div>
        <div className="card-body no-pad">
          {loading ? <div className="loading"><span className="spinner"></span></div> : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr>
                  <th>Name</th><th>Phone</th><th>Address</th><th>GSTIN</th><th className="tr">Balance</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                      No customers. <button className="btn btn-outline btn-sm" onClick={openAdd}>Add first customer</button>
                    </td></tr>
                  ) : customers.map(c => (
                    <tr key={c._id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.phone || <span className="text-muted">—</span>}</td>
                      <td className="text-muted">{c.address || '—'}</td>
                      <td className="text-muted">{c.gstin || '—'}</td>
                      <td className="tr">{balanceCell(c.balance)}</td>
                      <td>
                        <div className="flex gap-2">
                          <Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm">🧾 Bills</Link>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editId ? '✏️ Edit Customer' : '➕ Add Customer'}</div>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Customer name" autoFocus />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-control" type="tel" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Opening Balance ₹</label>
                    <input className="form-control" type="number" step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} placeholder="0.00" />
                    <div className="form-hint">Positive = owes you. Negative = advance paid.</div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-control" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
                </div>
                <div className="form-group">
                  <label className="form-label">GSTIN (optional)</label>
                  <input className="form-control" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="Customer's GSTIN" />
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Add Customer'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
