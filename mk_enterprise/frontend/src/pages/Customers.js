import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';;
import toast from 'react-hot-toast';
import { customerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { Users, Search, FileText, Edit, Trash2, Plus, Phone, MapPin, X, ArrowRight } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (b > 0.01) {
      return (
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          padding: '4px 10px', 
          borderRadius: 20, 
          fontSize: 12, 
          fontWeight: 700, 
          background: '#fef2f2', 
          color: '#dc2626', 
          border: '1px solid #fecaca' 
        }}>
          {fc(b)} (Due)
        </span>
      );
    }
    if (b < -0.01) {
      return (
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          padding: '4px 10px', 
          borderRadius: 20, 
          fontSize: 12, 
          fontWeight: 700, 
          background: '#ecfdf5', 
          color: '#059669', 
          border: '1px solid #a7f3d0' 
        }}>
          {fc(Math.abs(b))} (Advance)
        </span>
      );
    }
    return <span style={{ color: '#94a3b8', fontWeight: 500 }}>—</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><Users size={22} /></span>
            <span>Customers Directory</span>
          </div>
          <div className="page-subtitle">{customers.length} customers · Total dues: {fc(totalDue)}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}><Plus size={14} /> Add Customer</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', maxWidth: isMobile ? '100%' : '320px' }}>
            <span style={{ position: 'absolute', left: 12, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={16} />
            </span>
            <input 
              className="form-control" 
              placeholder="Search by name or phone..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); }} 
              style={{ paddingLeft: 36, fontSize: 14, borderRadius: 8 }} 
            />
          </div>
        </div>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: '#f8fafc' }}>
              {customers.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No customers found. <button className="btn btn-outline btn-sm" onClick={openAdd} style={{ marginTop: 8 }}>Add first customer</button>
                </div>
              ) : (
                customers.map(c => (
                  <div key={c._id} style={{ 
                    background: '#fff', 
                    borderRadius: 12, 
                    padding: 16, 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{c.name}</div>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} style={{ fontSize: 12, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, textDecoration: 'none', fontWeight: 600 }}>
                            <Phone size={12} /> {c.phone}
                          </a>
                        )}
                      </div>
                      {balanceCell(c.balance)}
                    </div>

                    {(c.address || c.gstin) && (
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.address && <div style={{ display: 'flex', gap: 6 }}><MapPin size={12} style={{ flexShrink: 0, marginTop: 2, color: '#64748b' }} /> <span>{c.address}</span></div>}
                        {c.gstin && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginLeft: 18 }}>GSTIN: {c.gstin}</div>}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                      <Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                        <FileText size={13} /> View Bills <ArrowRight size={12} />
                      </Link>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}><Edit size={13} /> Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c)} style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>Name</th>
                    <th style={{ padding: '12px 16px' }}>Phone</th>
                    <th style={{ padding: '12px 16px' }}>Address</th>
                    <th style={{ padding: '12px 16px' }}>GSTIN</th>
                    <th style={{ padding: '12px 16px' }} className="tr">Balance</th>
                    <th style={{ padding: '12px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                        No customers. <button className="btn btn-outline btn-sm" onClick={openAdd}>Add first customer</button>
                      </td>
                    </tr>
                  ) : (
                    customers.map(c => (
                      <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {c.phone ? (
                            <a href={`tel:${c.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                              <Phone size={12} /> {c.phone}
                            </a>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }} title={c.address}>
                          {c.address ? (c.address.length > 40 ? `${c.address.substring(0, 40)}...` : c.address) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{c.gstin || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={{ padding: '12px 16px' }} className="tr">{balanceCell(c.balance)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                              <FileText size={12} /> Bills
                            </Link>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                              <Edit size={12} /> Edit
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }} onClick={() => handleDelete(c)} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={closeModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0' }}>
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '16px', color: '#1e293b' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                  {editId ? <Edit size={18} /> : <Plus size={18} />}
                </span>
                <span>{editId ? 'Edit Customer Details' : 'Add New Customer'}</span>
              </div>
              <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
                  {/* Full Name */}
                  <div className="form-group" style={{ gridColumn: 'span 12' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Full Name *</label>
                    <input 
                      className="form-control" 
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                      placeholder="Customer name" 
                      autoFocus 
                      style={{ borderRadius: 8 }} 
                    />
                  </div>

                  {/* Phone */}
                  <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 6' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Phone Number</label>
                    <input 
                      className="form-control" 
                      type="tel" 
                      maxLength={10} 
                      value={form.phone} 
                      onChange={e => setForm({ ...form, phone: e.target.value })} 
                      placeholder="10-digit mobile" 
                      style={{ borderRadius: 8 }} 
                    />
                  </div>

                  {/* Opening Balance */}
                  <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 6' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Opening Balance ₹</label>
                    <input 
                      className="form-control" 
                      type="number" 
                      step="0.01" 
                      value={form.balance} 
                      onChange={e => setForm({ ...form, balance: e.target.value })} 
                      placeholder="0.00" 
                      style={{ borderRadius: 8 }} 
                    />
                    <div className="form-hint" style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Positive = owes you. Negative = advance paid.
                    </div>
                  </div>

                  {/* Address */}
                  <div className="form-group" style={{ gridColumn: 'span 12' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>Address</label>
                    <textarea 
                      className="form-control" 
                      rows={2} 
                      value={form.address} 
                      onChange={e => setForm({ ...form, address: e.target.value })} 
                      placeholder="Full address" 
                      style={{ borderRadius: 8 }} 
                    />
                  </div>

                  {/* GSTIN */}
                  <div className="form-group" style={{ gridColumn: 'span 12' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>GSTIN (optional)</label>
                    <input 
                      className="form-control" 
                      value={form.gstin} 
                      onChange={e => setForm({ ...form, gstin: e.target.value })} 
                      placeholder="Customer's GSTIN" 
                      style={{ borderRadius: 8 }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
                    {saving ? 'Saving...' : editId ? 'Update Customer' : 'Add Customer'}
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
