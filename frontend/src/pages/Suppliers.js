import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supplierApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Building2, Search, Phone, MapPin, Trash2, Plus, X, Edit, CreditCard, FileText, ArrowRight, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

const EMPTY = { name: '', phone: '', contact_numbers: [], address: '', notes: '', balance: '' };

export default function Suppliers() {
  const { t } = useApp();
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const fc = formatCurrency;
  
  const phoneRef = React.useRef();
  const addressRef = React.useRef();
  const balanceRef = React.useRef();
  const submitBtnRef = React.useRef();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const load = (q = '') => {
    setLoading(true);
    supplierApi.getAll(q)
      .then(setSuppliers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const refreshPage = useCallback(() => { load(search); }, [search]);
  useRegisterRefresh(refreshPage);

  const openAdd = () => { setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => { 
    setForm({ 
      ...s, 
      contact_numbers: s.contact_numbers ? JSON.parse(JSON.stringify(s.contact_numbers)) : [] 
    }); 
    setShowModal(true); 
  };
  const closeModal = () => { setShowModal(false); setForm(EMPTY); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Supplier name required');
    if (form.phone && form.phone.trim().length !== 10) return toast.error('Phone number must be exactly 10 digits');
    setSaving(true);
    try {
      if (form._id) {
        await supplierApi.update(form._id, form);
        toast.success('Supplier updated');
      } else {
        await supplierApi.create(form);
        toast.success('Supplier added');
      }
      closeModal();
      load(search);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    try {
      await supplierApi.delete(s._id);
      toast.success('Supplier removed');
      load(search);
    } catch (err) { toast.error(err.message); }
  };

  const openHistory = (s) => {
    navigate(`/suppliers/${s._id}/history`, { state: { supplier: s } });
  };

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );


  return (
    <div>
      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <Building2 size={22} />
            </span>
            <span>Suppliers Directory</span>
          </div>
          <div className="page-subtitle">
            {suppliers.length} suppliers · Manage contacts and payment history
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
            <Plus size={14} /> Add Supplier
          </button>
        )}
      </div>

      {/* ── MAIN CARD ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', maxWidth: isMobile ? '100%' : '320px' }}>
            <span style={{ position: 'absolute', left: 12, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={16} />
            </span>
            <input
              className="form-control"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e=> setSearch(e.target.value)}
              style={{ paddingLeft: 36, fontSize: 14, borderRadius: 8 }}
            />
          </div>
        </div>

        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : isMobile ? (
            /* ── MOBILE CARDS ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--bg)' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No suppliers found. <button className="btn btn-outline btn-sm" onClick={openAdd} style={{ marginTop: 8 }}>Add first supplier</button>
                </div>
              ) : filtered.map(s => (
                <div key={s._id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{s.name}</div>
                      {s.phone && (
                        <a href={`tel:${s.phone}`} style={{ fontSize: 12, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, textDecoration: 'none', fontWeight: 600 }}>
                          <Phone size={12} /> {s.phone}
                        </a>
                      )}
                      {s.contact_numbers && s.contact_numbers.map((cn, i) => (
                        <a key={i} href={`tel:${cn.number}`} style={{ fontSize: 12, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: s.phone || i > 0 ? 12 : 0, textDecoration: 'none', fontWeight: 600 }}>
                          <Phone size={12} /> {cn.note ? `${cn.note}: ` : ''}{cn.number}
                        </a>
                      ))}
                    </div>
                  </div>
                  {s.address && (
                    <div style={{ background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                      <MapPin size={12} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} />
                      <span>{s.address}</span>
                    </div>
                  )}
                  {isAdmin ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, flexWrap: 'wrap', gap: 10 }}>
                      <button onClick={() => openHistory(s)} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                        <CreditCard size={13} /> Payment History <ArrowRight size={12} />
                      </button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)} style={{ padding: '6px', borderRadius: 6 }} title="Edit">
                          <Edit size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(s)} style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : s.manager_paid_amount > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                        Paid by You:
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>
                        {fc(s.manager_paid_amount)}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            /* ── DESKTOP TABLE ── */
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>{t('Name', 'नाम')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('Phone', 'फ़ोन')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('Address', 'पता')}</th>
                    {isAdmin ? (
                      <>
                        <th style={{ padding: '12px 16px' }}>Balance ₹</th>
                        <th style={{ padding: '12px 16px' }}>Notes</th>
                        <th style={{ padding: '12px 16px' }}>Actions</th>
                      </>
                    ) : (
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid by You</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 32 }}>
                        No suppliers found. <button className="btn btn-outline btn-sm" onClick={openAdd}>Add first supplier</button>
                      </td>
                    </tr>
                  ) : filtered.map(s => (
                    <tr key={s._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {s.phone && (
                            <a href={`tel:${s.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                              <Phone size={12} /> {s.phone}
                            </a>
                          )}
                          {s.contact_numbers && s.contact_numbers.map((cn, i) => (
                            <a key={i} href={`tel:${cn.number}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                              <Phone size={12} /> {cn.note ? `${cn.note}: ` : ''}{cn.number}
                            </a>
                          ))}
                          {!s.phone && (!s.contact_numbers || s.contact_numbers.length === 0) && (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }} title={s.address}>
                        {s.address ? (s.address.length > 40 ? `${s.address.substring(0, 40)}...` : s.address) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      {isAdmin ? (
                        <>
                          <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: (s.balance || 0) > 0 ? '#ef4444' : (s.balance || 0) < 0 ? '#16a34a' : 'var(--text-muted)' }}>
                            {fc(Math.abs(s.balance || 0))} {(s.balance || 0) > 0 ? '(Due)' : (s.balance || 0) < 0 ? '(Adv)' : ''}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                            {s.notes || <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button onClick={() => openHistory(s)} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                                <CreditCard size={12} /> Payments
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ padding: '6px', borderRadius: 6 }} onClick={() => openEdit(s)} title="Edit">
                                <Edit size={14} />
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }} onClick={() => handleDelete(s)} title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : s.manager_paid_amount > 0 ? (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace', fontSize: 15 }}>
                          {fc(s.manager_paid_amount)}
                        </td>
                      ) : (
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#cbd5e1' }}>—</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD SUPPLIER MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '20px' }}>
          <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', margin: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--sidebar-bg)', borderBottom: '1px solid #e2e8f0' }}>
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                  {form._id ? <Edit size={18} /> : <Plus size={18} />}
                </span>
                {form._id ? 'Edit Supplier' : 'Add New Supplier'}
              </div>
              <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Supplier Name *</label>
                  <input className="form-control" value={form.name} onChange={e => {
                    const val = e.target.value;
                    const capitalized = val.replace(/\b[a-zA-Z]/g, c => c.toUpperCase());
                    setForm({ ...form, name: capitalized });
                  }} placeholder="e.g. Ramesh Traders" autoFocus style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus(); } }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ gridColumn: isMobile ? '1' : '1 / span 2' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                      Contact Numbers
                      <button type="button" onClick={() => setForm({ ...form, contact_numbers: [...(form.contact_numbers || []), { note: '', number: '' }] })} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>+ Add Number</button>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input className="form-control" type="tel" ref={phoneRef} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Primary Mobile number (legacy)" style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addressRef.current?.focus(); } }} />
                      {(form.contact_numbers || []).map((cn, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8 }}>
                          <input className="form-control" value={cn.note} onChange={e => {
                            const newCn = [...form.contact_numbers];
                            newCn[idx].note = e.target.value;
                            setForm({ ...form, contact_numbers: newCn });
                          }} placeholder="Note (e.g. Work)" style={{ borderRadius: 8, flex: 1 }} />
                          <input className="form-control" type="tel" value={cn.number} onChange={e => {
                            const newCn = [...form.contact_numbers];
                            newCn[idx].number = e.target.value;
                            setForm({ ...form, contact_numbers: newCn });
                          }} placeholder="Number" style={{ borderRadius: 8, flex: 2 }} />
                          <button type="button" onClick={() => {
                            const newCn = form.contact_numbers.filter((_, i) => i !== idx);
                            setForm({ ...form, contact_numbers: newCn });
                          }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 8px' }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>{t('Address', 'पता')}</label>
                    <input className="form-control" ref={addressRef} value={form.address} onChange={e => {
                      const val = e.target.value;
                      const capitalized = val.replace(/\b[a-zA-Z]/g, c => c.toUpperCase());
                      setForm({ ...form, address: capitalized });
                    }} placeholder="City / Location" style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); balanceRef.current?.focus(); } }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Notes (optional)</label>
                    <input className="form-control" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional info" style={{ borderRadius: 8 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Opening Balance ₹</label>
                    <input className="form-control" type="number" ref={balanceRef} step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} placeholder="Positive = Due, Negative = Advance" style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitBtnRef.current?.click(); } }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>{t('Cancel', 'रद्द करें')}</button>
                  <button type="submit" ref={submitBtnRef} className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
                    {saving ? 'Saving...' : form._id ? 'Save Changes' : 'Add Supplier'}
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