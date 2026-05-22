import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invoiceApi, driverApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/helpers';
import { FileText, Plus, Search, Eye, Edit, Trash2, ChevronLeft, ChevronRight, X, CheckCircle, Phone, Send } from 'lucide-react';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const customer_id = searchParams.get('customer_id');
  const { isAdmin, token } = useAuth();
  const LIMIT = 25;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

  const load = () => {
    setLoading(true);
    invoiceApi.getAll({ limit: LIMIT, page, search: search || undefined, customer_id: customer_id || undefined })
      .then(d => { setInvoices(d.invoices); setTotal(d.total); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); }, [search, customer_id]);
  useEffect(() => { load(); }, [page, search, customer_id]);

  const handleDelete = async (inv) => {
    if (!window.confirm(`Cancel invoice ${inv.invoice_number}? Stock will be restored.`)) return;
    try { await invoiceApi.delete(inv._id); toast.success('Invoice cancelled'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const totalSales = parseFloat(invoices.reduce((s, i) => s + i.total, 0).toFixed(2));
  const totalDue = parseFloat(invoices.reduce((s, i) => s + (i.balance_due || 0), 0).toFixed(2));
  const pages = Math.ceil(total / LIMIT);
  const fc = formatCurrency;

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
    if (inv.balance_due > 0.01) {
      return <span className="badge badge-danger" style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>Pending</span>;
    }
    return <span className="badge badge-success" style={{ fontSize: 11, background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5' }}>Paid</span>;
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
                  <X size={14} className="me-1" /> Cancel
                </button>
                <button 
                  className="btn btn-success btn-sm" 
                  onClick={() => {
                    loadStaff();
                    setShowBatchModal(true);
                  }}
                >
                  Batch Dispatch ({selectedInvoices.length})
                </button>
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
                  <div key={inv._id} style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: 16,
                    boxShadow: '0 4px 6px -1px rgba(15,23,42,0.03), 0 2px 4px -1px rgba(15,23,42,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(15,23,42,0.03), 0 2px 4px -1px rgba(15,23,42,0.01)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
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

                    <div style={{ fontSize: 13.5, color: 'var(--text)' }}>
                      <div style={{ fontWeight: 700 }}>{inv.customer_name}</div>
                      {inv.customer_phone && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Phone size={11} /> {inv.customer_phone}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>{inv.ist_formatted || formatIST(inv.date)}</span>
                      {isAdmin && (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>
                          {inv.created_by_name || 'MGR-1'}
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      background: '#f8fafc',
                      padding: '10px 12px',
                      borderRadius: 10,
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Total</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace' }}>{fc(inv.total)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Received</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{fc(inv.amount_received)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Due</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: inv.balance_due > 0.01 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace' }}>
                          {inv.balance_due > 0.01 ? fc(inv.balance_due) : 'Paid'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <Link to={`/invoices/${inv._id}`} className="btn btn-outline btn-sm" onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Eye size={12} /> View
                      </Link>
                      <Link to={`/invoices/${inv._id}/edit`} className="btn btn-warning btn-sm" onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Edit size={12} /> Edit
                      </Link>
                      <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(inv); }} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Trash2 size={12} /> Cancel
                      </button>
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
                    {isAdmin && <th>Creator</th>}
                    <th>Payment</th>
                    <th className="tr">Total</th>
                    <th className="tr">Received</th>
                    <th className="tr">Balance Due</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32 }}>
                        No invoices found. <Link to="/invoices/new" className="btn btn-outline btn-sm">Create one!</Link>
                      </td></tr>
                    ) : invoices.map(inv => (
                      <tr 
                        key={inv._id}
                        onTouchStart={() => handlePressStart(inv._id)}
                        onTouchEnd={handlePressEnd}
                        onMouseDown={() => handlePressStart(inv._id)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        onClick={() => handleRowClick(inv._id)}
                        style={{ cursor: isSelectionMode ? 'pointer' : 'default', backgroundColor: selectedInvoices.includes(inv._id) ? 'rgba(99, 102, 241, 0.08)' : 'inherit' }}
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
                          <div>{inv.customer_name}</div>
                          {inv.customer_phone && <small className="text-muted">{inv.customer_phone}</small>}
                        </td>
                        {isAdmin && <td>
                          <span className="badge badge-gray" style={{ fontSize: 10 }}>
                             {inv.created_by_name || 'MGR-1'}
                          </span>
                        </td>}
                        <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{paymentBadge(inv.payments) || '—'}</span></td>
                        <td className="tr mono fw-700">{fc(inv.total)}</td>
                        <td className="tr mono text-success">{fc(inv.amount_received)}</td>
                        <td className="tr">
                          {inv.balance_due > 0.01
                             ? <span className="badge badge-danger">{fc(inv.balance_due)}</span>
                             : <span className="badge badge-success d-inline-flex align-items-center gap-1">Paid <CheckCircle size={11} /></span>}
                        </td>
                        <td>
                          {getInvoiceStatusBadge(inv)}
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
                              <span className="badge" style={{ background: '#fef3c7', color: '#d97706', fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 600 }}>Driver</span>
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
