import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, managerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useRegisterRefresh } from '../context/PullToRefreshContext';
import { FileText, Edit, Trash2, ArrowUpDown, ChevronDown, ChevronUp, Share2, Plus, Phone, Wallet, X, AlertTriangle, Users, User, Search, MapPin, ArrowRight, Clock, CreditCard } from 'lucide-react';
import { parseCustomerName, formatCustomerName, isHindi, titleCase, getPrefixOptions, applyAutoSuffix } from '../utils/nameFormatter';

const EMPTY = { prefix: 'Shree', name: '', phone: '', alternate_phones: [], address: '', balance: '', gstin: '' };

export default function Customers() {
  const { t } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'supervisor';
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
  
  const location = useLocation();
  const [highlightId, setHighlightId] = useState(location.state?.highlightCustomerId || null);

  // Sync highlightId when navigating
  useEffect(() => {
    if (location.state?.highlightCustomerId) {
      setHighlightId(location.state.highlightCustomerId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Scroll to highlighted customer
  useEffect(() => {
    if (highlightId && customers.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`customer-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightId, customers]);

  // Clean up highlight on first click anywhere
  useEffect(() => {
    if (highlightId) {
      const handleClick = () => setHighlightId(null);
      const timer = setTimeout(() => document.addEventListener('click', handleClick), 500);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClick);
      };
    }
  }, [highlightId]);
  
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const balanceRef = useRef(null);
  const addressRef = useRef(null);

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleNameBlur = () => {
    // Removed auto suffix to keep raw name
    // setForm(prev => ({ ...prev, name: applyAutoSuffix(prev.name) }));
  };
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState(null);

  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeResolution, setMergeResolution] = useState({ name: '', address: '', gstin: '' });
  const [selectedPhones, setSelectedPhones] = useState([]);
  const [customMergePhone, setCustomMergePhone] = useState('');

  const [managers, setManagers] = useState([]);
  const [shareModal, setShareModal] = useState(null); // customer obj
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    managerApi.getAll().then(res => setManagers(res.managers || [])).catch(e => console.error('Failed to load managers', e));
  }, []);

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!selectedManagerId) return toast.error('Select a manager to share with');
    setSharing(true);
    try {
      await customerApi.delegate(shareModal._id, selectedManagerId);
      toast.success('Customer shared successfully');
      setShareModal(null);
      setSelectedManagerId('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSharing(false);
    }
  };

  const toggleMergeMode = () => {
    setIsMergeMode(!isMergeMode);
    setSelectedCustomers([]);
  };

  const toggleSelectCustomer = (id) => {
    setSelectedCustomers(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleMergeConfirm = async (e) => {
    if (e) e.preventDefault();
    if (!mergePrimaryId) return toast.error('Please select a base account');
    if (!mergeResolution.name) return toast.error('Please select a name for the merged account');
    
    setMerging(true);
    try {
      const secondary_ids = selectedCustomers.filter(id => id !== mergePrimaryId);
      const mainPhone = selectedPhones.length > 0 ? selectedPhones[0] : '';
      const altPhones = selectedPhones.length > 1 ? selectedPhones.slice(1) : [];
      
      await customerApi.merge({ 
        primary_id: mergePrimaryId, 
        secondary_ids,
        merged_data: { 
          ...mergeResolution, 
          phone: mainPhone,
          alternate_phones: altPhones
        }
      });
      toast.success('Customers merged successfully');
      setShowMergeModal(false);
      setIsMergeMode(false);
      setSelectedCustomers([]);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMerging(false);
    }
  };

  const openMergeModal = () => {
    const selectedData = customers.filter(c => selectedCustomers.includes(c._id));
    const first = selectedData[0];
    
    const uniquePhones = [...new Set(selectedData.flatMap(c => [c.phone, ...(c.alternate_phones || [])]).filter(Boolean))];
    const uniqueAddresses = [...new Set(selectedData.map(c => c.address).filter(Boolean))];
    const uniqueGstins = [...new Set(selectedData.map(c => c.gstin).filter(Boolean))];

    setMergePrimaryId(first._id);
    setSelectedPhones(uniquePhones);
    setCustomMergePhone('');
    setMergeResolution({
      name: first.name,
      address: uniqueAddresses.length > 0 ? uniqueAddresses[0] : '',
      gstin: uniqueGstins.length > 0 ? uniqueGstins[0] : ''
    });
    setShowMergeModal(true);
  };

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
    const t = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const refreshCustomers = useCallback(() => {
    return customerApi.getAll({ search }).then(setCustomers).catch(e => toast.error(e.message));
  }, [search]);
  useRegisterRefresh(refreshCustomers);

  // Auto-open add form when navigated from dashboard with ?action=add
  useEffect(() => {
    if (fromDashboard) {
      // Open your existing add modal here — replace openAdd() with whatever
      // function your Customers page uses to show the add form
      openAdd();
    }
  }, []);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (c) => { 
    const parsed = parseCustomerName(c.name);
    setForm({ 
      prefix: parsed.prefix,
      name: parsed.name, 
      phone: c.phone || '', 
      alternate_phones: c.alternate_phones || [],
      address: c.address || '', 
      balance: c.balance, 
      gstin: c.gstin || '' 
    }); 
    setEditId(c._id); 
    setShowModal(true); 
    setTimeout(() => nameRef.current?.focus(), 100);
  };
  const closeModal = () => { setShowModal(false); setForm(EMPTY); setEditId(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Customer name required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        balance: parseFloat(form.balance) || 0,
        alternate_phones: (form.alternate_phones || []).filter(p => p.trim() !== '')
      };
      if (editId) {
        await customerApi.update(editId, payload);
        toast.success('Customer updated');
        closeModal();
        load();
      } else {
        const res = await customerApi.create(payload);
        if (res.was_duplicate) {
          toast.success('Customer created. Note: An account with this phone already exists. Admin review may be needed.', { duration: 6000, icon: '⚠️' });
        } else {
          toast.success('Customer added');
        }
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

  const handleDelete = (c) => {
    setDeleteConfirmCustomer(c);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmCustomer) return;
    try { 
      await customerApi.delete(deleteConfirmCustomer._id); 
      toast.success('Deleted'); 
      load(); 
    }
    catch (err) { toast.error(err.message); }
    finally { setDeleteConfirmCustomer(null); }
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
          background: 'var(--danger-light)', 
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
          background: 'var(--success-light)', 
          color: '#059669', 
          border: '1px solid #a7f3d0' 
        }}>
          {fc(Math.abs(b))} (Advance)
        </span>
      );
    }
    return (
      <span style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        padding: '4px 10px', 
        borderRadius: 20, 
        fontSize: 12, 
        fontWeight: 700, 
        background: '#f1f5f9', 
        color: '#64748b', 
        border: '1px solid #e2e8f0' 
      }}>
        Balance Clear
      </span>
    );
  };

  const selectedData = customers.filter(c => selectedCustomers.includes(c._id));
  const uniqueNames = [...new Set(selectedData.map(c => c.name).filter(Boolean))];
  const uniquePhones = [...new Set(selectedData.map(c => c.phone).filter(Boolean))];
  const uniqueAddresses = [...new Set(selectedData.map(c => c.address).filter(Boolean))];
  const uniqueGstins = [...new Set(selectedData.map(c => c.gstin).filter(Boolean))];

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
        <div style={{ display: 'flex', gap: 12 }}>
          {isAdmin && (
            <button 
              className={`btn ${isMergeMode ? 'btn-danger' : 'btn-secondary'}`} 
              onClick={toggleMergeMode} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}
            >
              {isMergeMode ? 'Cancel Merge' : 'Merge Duplicates'}
            </button>
          )}
          {isMergeMode && selectedCustomers.length >= 2 ? (
            <button 
              className="btn btn-primary" 
              onClick={openMergeModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}
            >
              Merge Selected ({selectedCustomers.length})
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
              <Plus size={14} />{t('Add Customer', 'ग्राहक जोड़ें')}</button>
          )}
        </div>
      </div>

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
              onChange={e=> { setSearch(e.target.value); }} 
              style={{ paddingLeft: 36, fontSize: 14, borderRadius: 8 }} 
            />
          </div>
        </div>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--bg)' }}>
              {customers.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No customers found. <button className="btn btn-outline btn-sm" onClick={openAdd} style={{ marginTop: 8 }}>Add first customer</button>
                </div>
              ) : (
                customers.map(c => (
                  <div id={`customer-${c._id}`} key={c._id} style={{ 
                    background: highlightId === c._id ? 'var(--warning-light)' : selectedCustomers.includes(c._id) ? 'var(--primary-light)' : 'var(--bg-card)', 
                    transition: 'background-color 0.5s ease',
                    borderRadius: 12, 
                    padding: 16, 
                    border: '1px solid',
                    borderColor: highlightId === c._id ? '#f59e0b' : selectedCustomers.includes(c._id) ? '#3b82f6' : 'var(--border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    cursor: isMergeMode ? 'pointer' : 'default'
                  }} onClick={() => isMergeMode && toggleSelectCustomer(c._id)}>
                    {isMergeMode && (
                      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input 
                          type="checkbox" 
                          checked={selectedCustomers.includes(c._id)} 
                          onChange={() => toggleSelectCustomer(c._id)}
                          style={{ width: 18, height: 18 }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Select to Merge</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{c.name}</div>
                          </div>
                          {c.created_by && c.created_by.role !== 'supervisor' && user?.role === 'supervisor' && (
                            <div style={{ fontSize: 11, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                              <User size={12} /> {c.added_by_admin ? 'Admin -> ' : 'By: '} {c.created_by.display_name || c.created_by.username}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                          {c.phone && (
                            <a href={`tel:${c.phone}`} style={{ fontSize: 12, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 600 }}>
                              <Phone size={12} /> {c.phone}
                            </a>
                          )}
                          {c.alternate_phones && c.alternate_phones.map((p, idx) => (
                            <a key={idx} href={`tel:${p}`} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 600, marginLeft: 16 }}>
                              {p}
                            </a>
                          ))}
                        </div>
                      </div>
                      {balanceCell(c.balance)}
                    </div>

                    {(c.address || c.gstin) && (
                      <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.address && <div style={{ display: 'flex', gap: 6 }}><MapPin size={12} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} /> <span>{c.address}</span></div>}
                        {c.gstin && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 18 }}>GSTIN: {c.gstin}</div>}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {user?.role !== 'temp_manager' && (
                          <Link to={`/customers/${c._id}/history`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                            <Clock size={13} /> History <ArrowRight size={12} />
                          </Link>
                        )}
                        {c.balance > 0 && (
                          <Link to={`/customers/${c._id}/history`} state={{ openCollect: true }} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, borderRadius: 6, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none' }}>
                            <CreditCard size={13} /> Collect
                          </Link>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {user?.role === 'temp_manager' && (
                          <Link to={`/invoices/new?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12, borderRadius: 6, fontWeight: 600, color: '#16a34a', borderColor: '#bbf7d0' }}>
                            <FileText size={13} /> New Bill
                          </Link>
                        )}
                        {user?.role !== 'walkin_manager' && (
                          <button className="btn btn-outline btn-sm" onClick={() => setShareModal(c)} title="Share" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 6, color: '#3b82f6', borderColor: '#bfdbfe' }}>
                            <Share2 size={14} />
                          </button>
                        )}
                        {user?.role !== 'temp_manager' && (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} title="Edit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 6, color: 'var(--text-muted)' }}>
                              <Edit size={14} />
                            </button>
                            {user?.role !== 'walkin_manager' && (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c)} title="Delete" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, borderRadius: 6, color: '#ef4444' }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
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
                    {isMergeMode && <th style={{ width: 40, padding: '12px 16px' }}></th>}
                    <th style={{ padding: '12px 16px' }}>{t('Name', 'नाम')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('Phone', 'फ़ोन')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('Address', 'पता')}</th>
                    {user?.role !== 'walkin_manager' && <th style={{ padding: '12px 16px' }}>GSTIN</th>}
                    <th style={{ padding: '12px 16px' }} className="tr">Balance</th>
                    <th style={{ padding: '12px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={isMergeMode ? 7 : 6} style={{ textAlign: 'center', padding: 32 }}>
                        No customers. <button className="btn btn-outline btn-sm" onClick={openAdd}>Add first customer</button>
                      </td>
                    </tr>
                  ) : (
                    customers.map(c => (
                      <tr id={`customer-${c._id}`} key={c._id} style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: isMergeMode ? 'pointer' : 'default', 
                        transition: 'background-color 0.5s ease',
                        background: highlightId === c._id ? 'var(--warning-light)' : selectedCustomers.includes(c._id) ? 'var(--primary-light)' : 'transparent' 
                      }} onClick={() => isMergeMode && toggleSelectCustomer(c._id)}>
                        {isMergeMode && (
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedCustomers.includes(c._id)} 
                              onChange={() => toggleSelectCustomer(c._id)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                              {c.name}
                            </div>
                            {c.created_by && c.created_by.role !== 'supervisor' && user?.role === 'supervisor' && (
                              <div style={{ fontSize: 11, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                <User size={12} /> {c.added_by_admin ? 'Admin -> ' : 'By: '} {c.created_by.display_name || c.created_by.username}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                                <Phone size={12} /> {c.phone}
                              </a>
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>—</span>
                            )}
                            {c.alternate_phones && c.alternate_phones.map((p, idx) => (
                              <a key={idx} href={`tel:${p}`} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 600, paddingLeft: 16 }}>
                                {p}
                              </a>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }} title={c.address}>
                          {c.address ? (c.address.length > 40 ? `${c.address.substring(0, 40)}...` : c.address) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        {user?.role !== 'walkin_manager' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{c.gstin || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        )}
                        <td style={{ padding: '12px 16px' }} className="tr">{balanceCell(c.balance)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {user?.role === 'temp_manager' && (
                              <Link to={`/invoices/new?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600, color: '#16a34a', borderColor: '#bbf7d0' }}>
                                <FileText size={12} /> New Bill
                              </Link>
                            )}
                            {user?.role !== 'temp_manager' && (
                              <Link to={`/customers/${c._id}/history`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                                <Clock size={12} /> History
                              </Link>
                            )}
                            {c.balance > 0 && (
                              <Link to={`/customers/${c._id}/history`} state={{ openCollect: true }} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none' }}>
                                <CreditCard size={12} /> Collect
                              </Link>
                            )}
                            {user?.role !== 'walkin_manager' && (
                              <button className="btn btn-outline btn-sm" onClick={() => setShareModal(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600, color: '#3b82f6', borderColor: '#bfdbfe' }}>
                                <Share2 size={12} /> Share
                              </button>
                            )}
                            {user?.role !== 'temp_manager' && (
                              <>
                                <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                                  <Edit size={12} />{t('Edit', 'संपादित करें')}</button>
                                {user?.role !== 'walkin_manager' && (
                                  <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: '6px', borderRadius: 6 }} onClick={() => handleDelete(c)} title="Delete">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
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
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--sidebar-bg)', borderBottom: '1px solid #e2e8f0' }}>
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '16px', color: 'var(--text)' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                  {editId ? <Edit size={18} /> : <Plus size={18} />}
                </span>
                <span>{editId ? 'Edit Customer Details' : 'Add New Customer'}</span>
              </div>
              <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
                  {/* Full Name */}
                  <div className="form-group" style={{ gridColumn: 'span 12' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>Full Name *</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                        {getPrefixOptions(form.name).map(opt => (
                          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
                            <input 
                              type="radio" 
                              name="customerPrefix" 
                              value={opt.value}
                              checked={form.prefix === opt.value}
                              onChange={e => setForm({ ...form, prefix: e.target.value })}
                              style={{ margin: 0, cursor: 'pointer' }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <input 
                        ref={nameRef}
                        className="form-control" 
                        value={form.name} 
                        onChange={e => {
                          const val = e.target.value;
                          const newName = val.replace(/\b[a-zA-Z]/g, c => c.toUpperCase());
                          const wasH = isHindi(form.name);
                          const isH = isHindi(newName);
                          let newPrefix = form.prefix || 'Shree';
                          if (wasH !== isH) {
                            if (isH) {
                              if (newPrefix === 'Shree' || newPrefix === 'Mr.') newPrefix = 'श्री';
                              else if (newPrefix === 'Shreemati' || newPrefix === 'Mrs.') newPrefix = 'श्रीमती';
                            } else {
                              if (newPrefix === 'श्री') newPrefix = 'Shree';
                              else if (newPrefix === 'श्रीमती') newPrefix = 'Shreemati';
                            }
                          }
                          setForm({ ...form, name: newName, prefix: newPrefix });
                        }}
                        onBlur={handleNameBlur}
                        onKeyDown={e => handleKeyDown(e, phoneRef)}
                        placeholder="Customer name" 
                        autoFocus 
                        style={{ flex: 1, borderRadius: 8 }} 
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 6' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Primary Phone *</label>
                    <input 
                      ref={phoneRef}
                      className="form-control" 
                      type="tel" 
                      maxLength={10} 
                      value={form.phone} 
                      onChange={e => setForm({ ...form, phone: e.target.value })} 
                      onKeyDown={e => handleKeyDown(e, balanceRef)}
                      placeholder="10-digit mobile" 
                      style={{ borderRadius: 8 }} 
                    />
                    {form.alternate_phones && form.alternate_phones.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>ALTERNATE PHONES:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {form.alternate_phones.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input 
                                className="form-control" 
                                type="tel" 
                                maxLength={10} 
                                value={p} 
                                onChange={e => {
                                  const newAlts = [...form.alternate_phones];
                                  newAlts[idx] = e.target.value;
                                  setForm({ ...form, alternate_phones: newAlts });
                                }} 
                                placeholder="10-digit mobile" 
                                style={{ borderRadius: 8, flex: 1, padding: '8px 12px', height: 'auto' }} 
                              />
                              <button 
                                type="button" 
                                className="btn btn-ghost btn-sm" 
                                style={{ color: '#ef4444', padding: '6px' }}
                                onClick={() => {
                                  const newAlts = form.alternate_phones.filter((_, i) => i !== idx);
                                  setForm({ ...form, alternate_phones: newAlts });
                                }}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => setForm({ ...form, alternate_phones: [...(form.alternate_phones || []), ''] })}
                      style={{ 
                        background: 'transparent', border: '1.5px dashed #cbd5e1', color: 'var(--text-muted)', 
                        padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, 
                        display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, cursor: 'pointer',
                        width: '100%', justifyContent: 'center'
                      }}
                    >
                      <Plus size={14} /> Add Another Number
                    </button>
                  </div>

                  {/* Opening Balance */}
                  <div className="form-group" style={{ gridColumn: isMobile ? 'span 12' : 'span 6' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Opening Balance ₹</label>
                    <input 
                      ref={balanceRef}
                      className="form-control" 
                      type="number" 
                      step="0.01" 
                      value={form.balance} 
                      onChange={e => setForm({ ...form, balance: e.target.value })} 
                      onKeyDown={e => handleKeyDown(e, addressRef)}
                      placeholder="0.00" 
                      style={{ borderRadius: 8 }} 
                    />
                    <div className="form-hint" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Positive = owes you. Negative = advance paid.
                    </div>
                  </div>

                  {/* Address */}
                  <div className="form-group" style={{ gridColumn: 'span 12' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>{t('Address', 'पता')}</label>
                    <textarea 
                      ref={addressRef}
                      className="form-control" 
                      rows={2} 
                      value={form.address} 
                      onChange={e => {
                        const val = e.target.value;
                        const capitalized = val.replace(/\b[a-zA-Z]/g, c => c.toUpperCase());
                        setForm({ ...form, address: capitalized });
                      }} 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSave(e);
                        }
                      }}
                      placeholder="Full address" 
                      style={{ borderRadius: 8 }} 
                    />
                  </div>

                  {/* GSTIN */}
                  <div className="form-group" style={{ gridColumn: 'span 12' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>GSTIN (optional)</label>
                    <input 
                      className="form-control" 
                      value={form.gstin} 
                      onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} 
                      placeholder="Customer's GSTIN" 
                      style={{ borderRadius: 8 }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>{t('Cancel', 'रद्द करें')}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
                    {saving ? 'Saving...' : editId ? 'Update Customer' : 'Add Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCustomer && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ background: 'var(--danger-light)', color: '#ef4444', padding: 12, borderRadius: '50%', flexShrink: 0 }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Delete Customer?</h3>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>Are you sure you want to delete "{deleteConfirmCustomer.name}"? This action cannot be undone.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setDeleteConfirmCustomer(null)} style={{ borderRadius: 8, padding: '8px 16px' }}>{t('Cancel', 'रद्द करें')}</button>
              <button className="btn btn-primary" onClick={confirmDelete} style={{ background: '#ef4444', borderColor: '#ef4444', borderRadius: 8, padding: '8px 16px' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
      {showMergeModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3>Merge Resolution</h3>
              <button className="btn-close" onClick={() => setShowMergeModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                You are merging <strong>{selectedCustomers.length}</strong> accounts. Please choose the exact details to keep for the final Master Account. Balances will be safely summed up.
              </p>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 800, color: 'var(--sidebar-bg)', marginBottom: 12, fontSize: 15 }}>1. Select Base Account <span style={{fontWeight: 500, color: 'var(--text-muted)'}}>(Internal Reference)</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedData.map(c => (
                    <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '2px solid', borderColor: mergePrimaryId === c._id ? 'var(--primary)' : 'var(--border)', background: mergePrimaryId === c._id ? 'var(--primary-light)' : 'var(--bg-card)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <input type="radio" name="primaryAccount" checked={mergePrimaryId === c._id} onChange={() => setMergePrimaryId(c._id)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: mergePrimaryId === c._id ? '#1e40af' : '#334155' }}>
                        {c.name} {c.phone ? <span style={{fontWeight: 500}}>({c.phone})</span> : ''} 
                        <span style={{ fontSize: 12, color: mergePrimaryId === c._id ? '#60a5fa' : '#94a3b8', marginLeft: 8 }}>ID: {c._id.slice(-6)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 800, color: 'var(--sidebar-bg)', marginBottom: 12, fontSize: 15 }}>2. Select Final Name</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {uniqueNames.map((val, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', background: mergeResolution.name === val ? 'var(--success-light)' : 'var(--bg)', border: '1.5px solid', borderColor: mergeResolution.name === val ? '#22c55e' : 'var(--border)', borderRadius: 8, transition: 'all 0.15s' }}>
                      <input type="radio" name="mergeName" checked={mergeResolution.name === val} onChange={() => setMergeResolution(p => ({...p, name: val}))} style={{ accentColor: '#22c55e' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: mergeResolution.name === val ? '#166534' : 'var(--text-muted)' }}>{val}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 800, color: 'var(--sidebar-bg)', marginBottom: 12, fontSize: 15 }}>3. Select Final Phone Number(s)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {uniquePhones.length === 0 && (
                    <span style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>No phones available</span>
                  )}
                  {uniquePhones.map((val, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', background: selectedPhones.includes(val) ? 'var(--primary-light)' : 'var(--bg)', border: '1.5px solid', borderColor: selectedPhones.includes(val) ? '#6366f1' : 'var(--border)', borderRadius: 8, transition: 'all 0.15s' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedPhones.includes(val)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPhones([...selectedPhones, val]);
                          else setSelectedPhones(selectedPhones.filter(p => p !== val));
                        }} 
                        style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: selectedPhones.includes(val) ? '#3730a3' : 'var(--text-muted)' }}>{val}</span>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input 
                    type="tel" 
                    maxLength={10}
                    placeholder="Add custom 10-digit number..."
                    value={customMergePhone}
                    onChange={(e) => setCustomMergePhone(e.target.value)}
                    style={{ flex: 1, maxWidth: 250, padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline btn-sm"
                    disabled={!customMergePhone || customMergePhone.length < 10}
                    onClick={() => {
                      if (!selectedPhones.includes(customMergePhone)) {
                        setSelectedPhones([...selectedPhones, customMergePhone]);
                      }
                      setCustomMergePhone('');
                    }}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    Add to List
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 800, color: 'var(--sidebar-bg)', marginBottom: 12, fontSize: 15 }}>4. Select Final Address</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', background: mergeResolution.address === '' ? 'var(--danger-light)' : 'var(--bg)', border: '1.5px solid', borderColor: mergeResolution.address === '' ? '#ef4444' : 'var(--border)', borderRadius: 8, transition: 'all 0.15s' }}>
                    <input type="radio" name="mergeAddress" checked={mergeResolution.address === ''} onChange={() => setMergeResolution(p => ({...p, address: ''}))} style={{ accentColor: '#ef4444' }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: mergeResolution.address === '' ? '#991b1b' : '#94a3b8', fontStyle: mergeResolution.address === '' ? 'normal' : 'italic' }}>None (Leave Blank)</span>
                  </label>
                  {uniqueAddresses.map((val, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', background: mergeResolution.address === val ? 'var(--warning-light)' : 'var(--bg)', border: '1.5px solid', borderColor: mergeResolution.address === val ? '#f59e0b' : 'var(--border)', borderRadius: 8, transition: 'all 0.15s' }}>
                      <input type="radio" name="mergeAddress" checked={mergeResolution.address === val} onChange={() => setMergeResolution(p => ({...p, address: val}))} style={{ accentColor: '#f59e0b' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: mergeResolution.address === val ? '#92400e' : 'var(--text-muted)' }}>{val}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, color: 'var(--sidebar-bg)', marginBottom: 12, fontSize: 15 }}>5. Select Final GSTIN</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', background: mergeResolution.gstin === '' ? 'var(--danger-light)' : 'var(--bg)', border: '1.5px solid', borderColor: mergeResolution.gstin === '' ? '#ef4444' : 'var(--border)', borderRadius: 8, transition: 'all 0.15s' }}>
                    <input type="radio" name="mergeGstin" checked={mergeResolution.gstin === ''} onChange={() => setMergeResolution(p => ({...p, gstin: ''}))} style={{ accentColor: '#ef4444' }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: mergeResolution.gstin === '' ? '#991b1b' : '#94a3b8', fontStyle: mergeResolution.gstin === '' ? 'normal' : 'italic' }}>None (Leave Blank)</span>
                  </label>
                  {uniqueGstins.map((val, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', background: mergeResolution.gstin === val ? '#faf5ff' : 'var(--bg)', border: '1.5px solid', borderColor: mergeResolution.gstin === val ? '#a855f7' : 'var(--border)', borderRadius: 8, transition: 'all 0.15s' }}>
                      <input type="radio" name="mergeGstin" checked={mergeResolution.gstin === val} onChange={() => setMergeResolution(p => ({...p, gstin: val}))} style={{ accentColor: '#a855f7' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: mergeResolution.gstin === val ? '#6b21a8' : 'var(--text-muted)', textTransform: 'uppercase' }}>{val}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setShowMergeModal(false)}>{t('Cancel', 'रद्द करें')}</button>
                <button className="btn btn-primary" onClick={handleMergeConfirm} disabled={merging}>
                  {merging ? 'Merging...' : 'Confirm Final Merge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Share Customer</h3>
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
                    {sharing ? 'Sharing...' : 'Share Customer'}
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
