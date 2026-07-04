import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supplierApi, customerApi, managerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Building2, Search, Phone, MapPin, Trash2, Plus, X, Edit, CreditCard, FileText, ArrowRight, Calendar, User, ChevronDown, ChevronUp, ArrowLeft, ArrowUpDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

const EMPTY = { name: '', phone: '', contact_numbers: [], address: '', notes: '', balance: '', created_by: '', assigned_managers: [] };

export default function Suppliers() {
  const { t } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'supervisor';
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sortBy, setSortBy] = useState('A-Z Name');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [managers, setManagers] = useState([]);
  const [selectedManagerFilter, setSelectedManagerFilter] = useState('');
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const fc = formatCurrency;
  
  const phoneRef = React.useRef();
  const addressRef = React.useRef();
  const balanceRef = React.useRef();
  const [phoneMatch, setPhoneMatch] = useState(null);
  const submitBtnRef = React.useRef();
  useEffect(() => {
    const checkPhones = async () => {
      if (!showModal) return;
      const numbers = [];
      if (form.phone && form.phone.length >= 10) numbers.push(form.phone);
      if (form.contact_numbers) {
        form.contact_numbers.forEach(c => {
          if (c.number && c.number.length >= 10) numbers.push(c.number);
        });
      }
      if (numbers.length === 0) {
        setPhoneMatch(null);
        return;
      }
      try {
        const res = await customerApi.getAll();
        const allCustomers = res.data || res || [];
        const matched = allCustomers.find(c => {
          return numbers.some(num => c.phone === num || (c.alternate_phones || []).includes(num));
        });
        setPhoneMatch(matched || null);
      } catch {
        setPhoneMatch(null);
      }
    };
    const timeoutId = setTimeout(checkPhones, 400);
    return () => clearTimeout(timeoutId);
  }, [form.phone, form.contact_numbers, showModal]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const load = (q = '') => {
    setLoading(true);
    supplierApi.getAll(q)
      .then(setSuppliers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { 
    load(); 
    if (isAdmin) {
      managerApi.getAll().then(res => setManagers(res.managers || [])).catch(console.error);
    }
  }, [isAdmin]);

  const refreshPage = useCallback(() => { load(search); }, [search]);
  useRegisterRefresh(refreshPage);

  const openAdd = () => { setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => { 
    setForm({ 
      ...s, 
      balance: s.balance ? -s.balance : '',
      contact_numbers: s.contact_numbers ? JSON.parse(JSON.stringify(s.contact_numbers)) : [],
      created_by: s.created_by?._id || s.created_by || '',
      assigned_managers: s.assigned_managers || []
    }); 
    setShowModal(true); 
  };
  const closeModal = () => { setShowModal(false); setForm(EMPTY); setAssignDropdownOpen(false); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Supplier name required');
    if (form.phone && form.phone.trim().length !== 10) return toast.error('Phone number must be exactly 10 digits');
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.balance !== '' && payload.balance !== undefined && payload.balance !== null) {
        payload.balance = -Number(payload.balance);
      }
      if (form._id) {
        await supplierApi.update(form._id, payload);
        toast.success('Supplier updated');
      } else {
        await supplierApi.create(payload);
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

  const filtered = suppliers.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search);
    const matchManager = selectedManagerFilter ? (s.created_by?._id === selectedManagerFilter || s.created_by === selectedManagerFilter || (s.assigned_managers && s.assigned_managers.some(m => m === selectedManagerFilter || m._id === selectedManagerFilter))) : true;
    return matchSearch && matchManager;
  }).sort((a, b) => {
    if (sortBy === 'High Balance First') return (b.balance || 0) - (a.balance || 0);
    if (sortBy === 'Low Balance First') return (a.balance || 0) - (b.balance || 0);
    if (sortBy === 'A-Z Name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'Z-A Name') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });


  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px', marginBottom: '24px' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: 0 }}>
            <button 
              onClick={() => navigate(-1)}
              className="btn btn-outline" 
              style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Building2 size={22} className="text-primary" /> 
              <div style={{ lineHeight: 1.2 }}>Suppliers{isMobile ? <br /> : ' '}Directory</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
            {isAdmin && (
              <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : undefined, fontSize: isMobile ? 12 : undefined }}>
                <Plus size={isMobile ? 12 : 14} /> Add Supplier
              </button>
            )}
          </div>
        </div>
        <div className="page-subtitle" style={{ margin: 0, marginLeft: '52px', marginTop: isMobile ? '-8px' : '0' }}>
          {suppliers.length} suppliers · Manage contacts and payment history
        </div>
      </div>

      {/* ── SEARCH AND FILTERS ROW (LIKE PRODUCTS) ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', borderBottom: '1.5px solid #e2e8f0', marginBottom: 24, padding: '0 4px', paddingBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', flex: 1, minWidth: 200 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', minWidth: 60 }}>
            <span style={{ position: 'absolute', left: 8, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={14} />
            </span>
            <input
              className="form-control"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e=> setSearch(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 13, borderRadius: 8, height: 34, width: '100%' }}
            />
            {search && (
              <button
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                onClick={() => setSearch('')}
              >✕</button>
            )}
          </div>


          
          {isAdmin && (
            <div style={{ position: 'relative', width: isMobile ? 34 : 'auto', flexShrink: 0 }}>
              <div 
                onClick={() => setManagerDropdownOpen(!managerDropdownOpen)}
                style={{ borderRadius: 8, padding: isMobile ? '8px 4px' : '0 14px', height: 34, background: 'white', border: '1px solid #e2e8f0', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', fontWeight: 600, fontSize: 13, minWidth: isMobile ? 'auto' : 160, transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
              >
                {isMobile ? <User size={16} color={selectedManagerFilter ? '#16a34a' : '#64748b'} /> : (
                  <>
                    <span style={{ color: selectedManagerFilter ? '#16a34a' : 'inherit' }}>
                      {selectedManagerFilter ? managers.find(m => m._id === selectedManagerFilter)?.display_name || managers.find(m => m._id === selectedManagerFilter)?.username || 'Selected' : 'All Managers'}
                    </span>
                    <ChevronDown size={14} style={{ opacity: 0.5, marginLeft: 8 }} />
                  </>
                )}
              </div>
              
              {managerDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setManagerDropdownOpen(false)} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 200, maxHeight: 300, overflowY: 'auto' }}>
                    <div 
                      onClick={() => { setSelectedManagerFilter(''); setManagerDropdownOpen(false); }}
                      style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', background: !selectedManagerFilter ? '#f0fdf4' : 'white', color: !selectedManagerFilter ? '#16a34a' : '#334155', fontWeight: !selectedManagerFilter ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      All Managers {!selectedManagerFilter && <Check size={14} />}
                    </div>
                    {managers.map(m => (
                      <div 
                        key={m._id}
                        onClick={() => { setSelectedManagerFilter(m._id); setManagerDropdownOpen(false); }}
                        style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid #f1f5f9', background: selectedManagerFilter === m._id ? '#f0fdf4' : 'white', color: selectedManagerFilter === m._id ? '#16a34a' : '#334155', fontWeight: selectedManagerFilter === m._id ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = selectedManagerFilter === m._id ? '#f0fdf4' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = selectedManagerFilter === m._id ? '#f0fdf4' : 'white'}
                      >
                        {m.display_name || m.username} {selectedManagerFilter === m._id && <Check size={14} />}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CARD ── */}
      <div className="card" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>All Suppliers</h2>
        </div>

        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
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
                  ) : filtered.map(s => {
                    const bal = s.balance || 0;
                    let rowBg = bal > 0 ? '#fffaf5' : 'white';
                    let hoverBg = bal > 0 ? '#fff7ed' : '#f8fafc';
                    if (s.linked_customer_ids?.length > 0) {
                      rowBg = '#f8fafc';
                      hoverBg = '#f1f5f9';
                    }
                    return (
                      <tr 
                      key={s._id} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer', 
                        transition: 'background-color 0.2s',
                        background: rowBg
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}
                      onClick={(e) => {
                        if (e.target.closest('td:last-child') || e.target.closest('a') || e.target.closest('button')) return;
                        openHistory(s);
                      }}
                    >
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0, boxShadow: '0 2px 4px rgba(67, 56, 202, 0.1)' }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>
                              {s.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {s.phone ? (
                            <a href={`tel:${s.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: 12, background: '#eff6ff', padding: '2px 8px', borderRadius: 16, width: 'fit-content', border: '1px solid #dbeafe', transition: 'all 0.2s' }}>
                              <Phone size={11} /> {s.phone}
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic', paddingLeft: 4 }}>Not provided</span>
                          )}
                          {s.contact_numbers && s.contact_numbers.map((cn, i) => (
                            <a key={i} href={`tel:${cn.number}`} style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 500, paddingLeft: 12 }}>
                              ↳ {cn.note ? `${cn.note}: ` : ''}{cn.number}
                            </a>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }} title={s.address}>
                        {s.address ? (s.address.length > 40 ? `${s.address.substring(0, 40)}...` : s.address) : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>—</span>}
                      </td>
                      {isAdmin ? (
                        <>
                          <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 14, color: (s.balance || 0) > 0 ? '#dc2626' : (s.balance || 0) < 0 ? '#059669' : '#64748b' }}>
                              <span>{fc(-(s.balance || 0))}</span>
                              {(s.balance || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c' }}>DUE</span>}
                              {(s.balance || 0) < 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: '#d1fae5', color: '#047857' }}>ADV</span>}
                            </div>
                          </td>
                          <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button className="btn btn-ghost btn-sm" style={{ padding: '6px', borderRadius: 6 }} onClick={() => openEdit(s)} title="Edit">
                                <Edit size={14} />
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: '6px', borderRadius: 6, background: '#fef2f2' }} onClick={() => handleDelete(s)} title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : s.manager_paid_amount > 0 ? (
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums', fontSize: 14, verticalAlign: 'middle' }}>
                          {fc(s.manager_paid_amount)}
                        </td>
                      ) : (
                        <td style={{ padding: '16px', textAlign: 'right', color: '#cbd5e1', verticalAlign: 'middle' }}>—</td>
                      )}
                    </tr>
                  )})}
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
                  }} placeholder="Supplier Name" autoFocus style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus(); } }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ gridColumn: isMobile ? '1' : '1 / span 2' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                      Contact Numbers
                      <button type="button" onClick={() => setForm({ ...form, contact_numbers: [...(form.contact_numbers || []), { note: '', number: '' }] })} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>+ Add Number</button>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input className="form-control" type="tel" ref={phoneRef} value={form.phone} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 10); setForm({ ...form, phone: val }); }} placeholder="Primary Mobile number (legacy)" style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addressRef.current?.focus(); } }} />
                      {phoneMatch && (
                        <div style={{ marginTop: 6, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                          ⚠️ A customer "{phoneMatch.name}" already exists with this phone number.
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#b45309' }}>You can link them from the ledger page.</span>
                        </div>
                      )}
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
                    <input className="form-control" type="number" ref={balanceRef} step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} placeholder="Positive = Advance, Negative = Due" style={{ borderRadius: 8 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitBtnRef.current?.click(); } }} />
                  </div>
                </div>
                {isAdmin && (
                  <div className="form-group" style={{ marginTop: 8, position: 'relative' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Assign to Managers</label>
                    <div 
                      className="form-control" 
                      style={{ borderRadius: 8, cursor: 'pointer', minHeight: 40, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', userSelect: 'none' }}
                      onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
                    >
                      {form.assigned_managers && form.assigned_managers.length > 0 ? (
                        form.assigned_managers.map(mgrId => {
                          const m = managers.find(x => x._id === mgrId);
                          return m ? (
                            <span key={mgrId} style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {m.display_name || m.username}
                              <button type="button" onClick={(e) => {
                                e.stopPropagation();
                                setForm({...form, assigned_managers: form.assigned_managers.filter(id => id !== mgrId)});
                              }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#4338ca', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 14 }}>Select Managers...</span>
                      )}
                      <ChevronUp size={16} color="#94a3b8" style={{ marginLeft: 'auto', transform: assignDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                    {assignDropdownOpen && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setAssignDropdownOpen(false)} />
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1), 0 -8px 10px -6px rgba(0,0,0,0.1)', zIndex: 20, maxHeight: 240, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 8px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                            Select Managers
                          </div>
                          {managers.map(m => {
                            const isSelected = form.assigned_managers && form.assigned_managers.includes(m._id);
                            return (
                              <div 
                                key={m._id}
                                onClick={() => {
                                  let newAssigned = [...(form.assigned_managers || [])];
                                  if (isSelected) {
                                    newAssigned = newAssigned.filter(id => id !== m._id);
                                  } else {
                                    newAssigned.push(m._id);
                                  }
                                  setForm({...form, assigned_managers: newAssigned});
                                }}
                                style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'transparent', borderRadius: 8, transition: 'all 0.2s', border: '1px solid', borderColor: isSelected ? '#bbf7d0' : 'transparent' }}
                                onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid', borderColor: isSelected ? '#16a34a' : '#cbd5e1', background: isSelected ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
                                  {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                                </div>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isSelected ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#166534' : '#64748b', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                  {(m.display_name || m.username).charAt(0).toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: 14, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#166534' : '#334155', lineHeight: 1.2 }}>{m.display_name || m.username}</span>
                                  <span style={{ fontSize: 11, color: isSelected ? '#22c55e' : '#94a3b8' }}>@{m.username}</span>
                                </div>
                              </div>
                            );
                          })}
                          {managers.length === 0 && <div style={{ padding: '12px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No managers found</div>}
                        </div>
                      </>
                    )}
                  </div>
                )}
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