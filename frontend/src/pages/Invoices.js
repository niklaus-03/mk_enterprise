import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invoiceApi, driverApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useRegisterRefresh } from '../context/PullToRefreshContext';
import { formatCurrency, formatIST } from '../utils/helpers';
import { FileText, Plus, Search, Eye, Edit, Trash2, ChevronLeft, ChevronRight, X, CheckCircle, Phone, Send, User } from 'lucide-react';

export default function Invoices() {
  const { t } = useApp();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const customer_id = searchParams.get('customer_id');
  const { isAdmin, token, user } = useAuth();
  const LIMIT = 25;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const [highlightId, setHighlightId] = useState(location.state?.highlightInvoiceId || null);

  useEffect(() => {
    if (location.state?.highlightInvoiceId) {
      setHighlightId(location.state.highlightInvoiceId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (highlightId && invoices.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`invoice-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [highlightId, invoices]);

  useEffect(() => {
    if (highlightId) {
      const handleClick = () => setHighlightId(null);
      const timer = setTimeout(() => document.addEventListener('click', handleClick), 500);
      return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
    }
  }, [highlightId]);

  // Batch dispatch states
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [staff, setStaff] = useState([]);
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [sendingBatch, setSendingBatch] = useState(false);

  // Long press selection logic
  const [pressTimer, setPressTimer] = useState(null);

  const handlePressStart = (invId) => {
    if (selectedInvoices.length > 0) return; // Already in selection mode
    const timer = setTimeout(() => {
      setSelectedInvoices([invId]);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  const isSelectionMode = selectedInvoices.length > 0;

  const handleRowClick = (invId) => {
    if (isSelectionMode) {
      handleToggleInvoice(invId);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadStaff = async () => {
    setFetchingStaff(true);
    try {
      const res = await driverApi.getAll();
      setStaff(res.data?.drivers || res.drivers || []);
    } catch (err) {
      toast.error('Failed to load drivers');
      setStaff([]);
    } finally {
      setFetchingStaff(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    const requestLimit = highlightId ? 1000 : LIMIT;
    invoiceApi.getAll({ limit: requestLimit, page, search: search || undefined, customer_id: customer_id || undefined })
      .then(d => { setInvoices(d.invoices); setTotal(d.total); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, search, customer_id, highlightId]);

  useEffect(() => { setPage(1); }, [search, customer_id]);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  const handleDelete = async (inv) => {
    if (!window.confirm(`Cancel invoice ${inv.invoice_number}? Stock will be restored.`)) return;
    try { await invoiceApi.delete(inv._id); toast.success('Invoice cancelled'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const getInvoiceDue = (i) => Math.max(0, i.total - (i.amount_received || 0));
  const getTrueBalance = (i) => Math.max(0, (i.total_with_prev_balance || i.total) - (i.amount_received || 0));

  const totalSales = parseFloat(invoices.reduce((s, i) => s + i.total, 0).toFixed(2));
  const totalDue = parseFloat(invoices.reduce((s, i) => s + getInvoiceDue(i), 0).toFixed(2));
  const pages = Math.ceil(total / LIMIT);
  const fc = formatCurrency;

  const getCustomerLink = (inv) => {
    const q = inv.customer_phone || inv.customer_name;
    return `/customers?booklet=all&search=${encodeURIComponent(q)}`;
  };

  const handleToggleInvoice = (invId) => {
    setSelectedInvoices(prev => 
      prev.includes(invId) ? prev.filter(id => id !== invId) : [...prev, invId]
    );
  };

  const handleToggleAll = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(invoices.map(i => i._id));
    }
  };

  const handleBatchDispatch = async () => {
    if (!selectedDriverId) return toast.error('Please select a driver');
    setSendingBatch(true);
    try {
      await invoiceApi.batchShare({ invoiceIds: selectedInvoices, driverId: selectedDriverId });
      toast.success('Batch dispatch sent successfully!');
      setShowBatchModal(false);
      setSelectedInvoices([]);
      setSelectedDriverId('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingBatch(false);
    }
  };

  const paymentBadge = (payments) => {
    if (!payments?.length) return null;
    const modes = [...new Set(payments.map(p => p.mode.toUpperCase()))];
    return modes.join(' + ');
  };

  const getInvoiceStatusBadge = (inv) => {
    if (inv.status === 'cancelled') {
      return <span className="badge badge-gray" style={{ fontSize: 11 }}>Cancelled</span>;
    }
    if (getInvoiceDue(inv) > 0.01) {
      return <span className="badge badge-danger" style={{ fontSize: 11, background: 'var(--danger-light)', color: '#dc2626', border: '1px solid #fee2e2' }}>Pending</span>;
    }
    return <span className="badge badge-success" style={{ fontSize: 11, background: 'var(--success-light)', color: '#059669', border: '1px solid #d1fae5' }}>Paid</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title d-flex align-items-center gap-2"><FileText size={22} className="text-primary" /> Invoice History</div>
          <div className="page-subtitle">{total} invoices · Sales: {fc(totalSales)} · Due: {fc(totalDue)}</div>
        </div>
        <Link to="/invoices/new" className="btn btn-primary d-inline-flex align-items-center gap-1"><Plus size={14} /> New Invoice</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-wrap" style={{ position: 'relative' }}>
            <span className="search-icon" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}><Search size={14} style={{ color: '#94a3b8' }} /></span>
            <input className="form-control" placeholder="Search by customer or invoice number..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: 320, paddingLeft: 36 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedInvoices.length > 0 && (
              <>
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setSelectedInvoices([])}
                >
                  <X size={14} className="me-1" />{t('Cancel', 'रद्द करें')}</button>
                {user?.role !== 'temp_manager' && (
                  <button 
                    className="btn btn-success btn-sm" 
                    onClick={() => {
                      loadStaff();
                      setShowBatchModal(true);
                    }}
                  >
                    Batch Dispatch ({selectedInvoices.length})
                  </button>
                )}
              </>
            )}
            {customer_id && <Link to="/invoices" className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1"><X size={12} /> Clear Filter</Link>}
          </div>
        </div>
        <div className={isMobile ? "card-body" : "card-body no-pad"}>
          {loading ? <div className="loading"><span className="spinner"></span></div> : (
            isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {invoices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No invoices found. <Link to="/invoices/new" className="btn btn-outline btn-sm">Create one!</Link>
                  </div>
                ) : invoices.map(inv => (
                  <div id={`invoice-${inv._id}`} key={inv._id} style={{
                    background: highlightId === inv._id ? 'var(--warning-light)' : 'var(--bg-card)',
                    border: '1px solid',
                    borderColor: highlightId === inv._id ? '#f59e0b' : '#e2e8f0',
                    borderRadius: 14,
                    padding: 16,
                    boxShadow: '0 4px 6px -1px rgba(15,23,42,0.03), 0 2px 4px -1px rgba(15,23,42,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'all 0.5s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(15,23,42,0.03), 0 2px 4px -1px rgba(15,23,42,0.01)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                  onTouchStart={() => handlePressStart(inv._id)}
                  onTouchEnd={handlePressEnd}
                  onMouseDown={() => handlePressStart(inv._id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeaveCapture={handlePressEnd}
                  onClick={() => handleRowClick(inv._id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSelectionMode && (
                          <div onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedInvoices.includes(inv._id)}
                              onChange={() => handleToggleInvoice(inv._id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </div>
                        )}
                        <Link to={`/invoices/${inv._id}`} style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'monospace', fontSize: 15 }}>
                          {inv.invoice_number}
                        </Link>
                      </div>
                      {getInvoiceStatusBadge(inv)}
                    </div>

                    <Link to={getCustomerLink(inv)} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                      <div style={{ fontSize: 13.5, color: 'var(--text)' }}>
                        <div style={{ fontWeight: 700 }}>{inv.customer_name}</div>
                        {inv.customer_phone && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Phone size={11} /> {inv.customer_phone}
                          </div>
                        )}
                      </div>
                    </Link>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>{inv.ist_formatted || formatIST(inv.date)}</span>
                        {isAdmin && (
                          <div style={{ fontSize: 11, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                            <User size={12} /> By: {inv.actual_creator?.display_name || inv.actual_creator?.username || inv.created_by?.display_name || inv.created_by?.username || 'Admin'}
                          </div>
                        )}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 4,
                      background: 'var(--bg)',
                      padding: '10px 8px',
                      borderRadius: 10,
                      textAlign: 'center'
                    }}>
                        <div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap' }}>{t('Total', 'कुल')}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace' }}>{fc(inv.total)}</div>
                          {((inv.total_with_prev_balance || inv.total) - inv.total) > 0.01 && (
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                              Prev Due: +{fc((inv.total_with_prev_balance || inv.total) - inv.total)}
                            </div>
                          )}
                        </div>
                      <div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap' }}>Rec'd</div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{fc(inv.amount_received)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap' }}>Due</div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: getInvoiceDue(inv) > 0.01 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace' }}>
                          {getInvoiceDue(inv) > 0.01 ? fc(getInvoiceDue(inv)) : 'Paid'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap' }}>Cust Bal</div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace' }}>
                          {(() => {
                            if (!inv.customer_id) return '—';
                            let bal = getTrueBalance(inv);
                            return <span style={{ color: bal > 0.01 ? 'var(--danger)' : 'var(--success)' }}>{fc(bal)}</span>;
                          })()}
                        </div>
                      </div>
                    </div>

                    {inv.payments && inv.payments.length > 0 && (
                      <div style={{ marginTop: 4, padding: '8px 12px', background: 'rgba(5, 150, 105, 0.04)', borderRadius: 8, border: '1px solid rgba(5, 150, 105, 0.1)' }}>
                        <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Payment History</div>
                        {inv.payments.map((p, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-dark)', marginBottom: i !== inv.payments.length - 1 ? 4 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CheckCircle size={10} color="#059669" /> 
                              <span style={{ textTransform: 'capitalize' }}>{p.mode}</span>
                              {p.reference && <span style={{ color: 'var(--text-muted)' }}>({p.reference})</span>}
                            </div>
                            <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{fc(p.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <Link to={`/invoices/${inv._id}`} className="btn btn-outline btn-sm" onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Eye size={12} /> View
                      </Link>
                      <Link to={`/invoices/${inv._id}/edit`} className="btn btn-warning btn-sm" onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Edit size={12} />{t('Edit', 'संपादित करें')}</Link>
                      <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(inv); }} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Trash2 size={12} />{t('Cancel', 'रद्द करें')}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr>
                    <th style={{ width: '40px' }}>
                      {isSelectionMode && (
                        <input 
                          type="checkbox" 
                          checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
                          onChange={handleToggleAll}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      )}
                    </th>
                    <th>Invoice #</th>
                    <th>Date & Time (IST)</th>
                    <th>Customer</th>
                    {isAdmin && <th>Created By</th>}
                    <th style={{ width: 110 }} className="tr">Payment</th>
                    <th className="tr">{t('Total', 'कुल')}</th>
                    <th className="tr">Received</th>
                    <th className="tr">{t('Balance Due', 'शेष बकाया')}</th>
                    <th className="tr">Cust. Due</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>
                        No invoices found. <Link to="/invoices/new" className="btn btn-outline btn-sm">Create one!</Link>
                      </td></tr>
                    ) : invoices.map(inv => (
                      <tr 
                        id={`invoice-${inv._id}`}
                        key={inv._id}
                        onTouchStart={() => handlePressStart(inv._id)}
                        onTouchEnd={handlePressEnd}
                        onMouseDown={() => handlePressStart(inv._id)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        onClick={() => handleRowClick(inv._id)}
                        style={{ 
                          cursor: isSelectionMode ? 'pointer' : 'default', 
                          backgroundColor: highlightId === inv._id ? 'var(--warning-light)' : selectedInvoices.includes(inv._id) ? 'rgba(99, 102, 241, 0.08)' : 'inherit',
                          transition: 'background-color 0.5s ease'
                        }}
                      >
                        <td>
                          {isSelectionMode && (
                            <div onClick={e => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={selectedInvoices.includes(inv._id)}
                                onChange={() => handleToggleInvoice(inv._id)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </div>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <Link to={`/invoices/${inv._id}`} style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace' }}>
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td style={{ fontSize: 12.5 }}>{inv.ist_formatted || formatIST(inv.date)}</td>
                        <td>
                          <Link to={getCustomerLink(inv)} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                            <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
                            {inv.customer_phone && <small className="text-muted" style={{ display: 'block' }}>{inv.customer_phone}</small>}
                          </Link>
                        </td>
                        {isAdmin && <td>
                          <div style={{ fontSize: 11, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                            <User size={12} /> By: {inv.actual_creator?.display_name || inv.actual_creator?.username || inv.created_by?.display_name || inv.created_by?.username || 'Admin'}
                          </div>
                        </td>}
                        <td style={{ maxWidth: 120 }} className="tr">
                          {inv.payments && inv.payments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {inv.payments.map((p, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{p.mode}</span>
                                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>{fc(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>No payment received</span>
                          )}
                        </td>
                          <td className="tr">
                            <div className="mono fw-700">{fc(inv.total)}</div>
                            {((inv.total_with_prev_balance || inv.total) - inv.total) > 0.01 && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                                Prev Due: +{fc((inv.total_with_prev_balance || inv.total) - inv.total)}
                              </div>
                            )}
                          </td>
                        <td className="tr mono text-success">{fc(inv.amount_received)}</td>
                        <td className="tr">
                          {getInvoiceDue(inv) > 0.01
                             ? <span className="badge badge-danger">{fc(getInvoiceDue(inv))}</span>
                             : <span className="badge badge-success d-inline-flex align-items-center gap-1">Paid <CheckCircle size={11} /></span>}
                        </td>
                        <td className="tr mono">
                          {(() => {
                            if (!inv.customer_id) return '—';
                            let bal = getTrueBalance(inv);
                            return bal > 0.01 
                              ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fc(bal)}</span> 
                              : <span style={{ color: 'var(--success)', fontWeight: 700 }}>{fc(bal)}</span>;
                          })()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link to={`/invoices/${inv._id}`} className="btn btn-outline btn-sm" onClick={e => e.stopPropagation()}><Eye size={14}/></Link>
                            <Link to={`/invoices/${inv._id}/edit`} className="btn btn-warning btn-sm" onClick={e => e.stopPropagation()}><Edit size={14}/></Link>
                            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(inv); }}><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
        {/* Pagination */}
        {pages > 1 && (
          <div 
            className={isMobile ? "card-body" : "card-body flex-between"} 
            style={{ 
              paddingTop: 12, 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: isMobile ? 12 : 0 
            }}
          >
            <div className="text-muted fs-13" style={{ textAlign: 'center' }}>Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={13} /> Prev</button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title d-flex align-items-center gap-2"><Send size={18} className="text-primary" /> Batch Dispatch ({selectedInvoices.length} Invoices)</div>
              <button className="modal-close" onClick={() => setShowBatchModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 15px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 15 }}>
                Select a driver to instantly dispatch this batch of invoices to their dashboard.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fetchingStaff ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading staff list...</div>
                ) : staff.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No drivers found.</div>
                ) : (
                  <>
                    <div style={{ marginTop: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        🚚 Drivers Present
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {staff.map(person => {
                          const isSelected = selectedDriverId === person._id;
                          return (
                            <div 
                              key={person._id}
                              onClick={() => setSelectedDriverId(isSelected ? '' : person._id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-light)',
                                border: isSelected ? '1px solid #6366f1' : '1px solid var(--border)',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input 
                                  type="radio" 
                                  checked={isSelected}
                                  onChange={() => {}} 
                                  style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 14, fontWeight: isSelected ? 600 : 500, color: isSelected ? '#6366f1' : 'var(--text-dark)' }}>{person.display_name || person.username}</span>
                              </div>
                              <span className="badge" style={{ background: 'var(--warning-light)', color: '#d97706', fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 600 }}>Driver</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleBatchDispatch}
                  disabled={sendingBatch || !selectedDriverId}
                  className="btn btn-primary btn-block d-inline-flex align-items-center gap-2"
                  style={{ justifyContent: 'center', background: '#6366f1', borderColor: '#6366f1' }}
                >
                  <Send size={14} /> {sendingBatch ? 'Sending...' : 'Send Batch to Driver'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
