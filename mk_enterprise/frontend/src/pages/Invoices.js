import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invoiceApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/helpers';
import { FileText, Plus, Search, Eye, Edit, Trash2, ChevronLeft, ChevronRight, X, CheckCircle, Phone } from 'lucide-react';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const customer_id = searchParams.get('customer_id');
  const { isAdmin } = useAuth();
  const LIMIT = 25;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const totalSales = invoices.reduce((s, i) => s + i.total, 0);
  const totalDue = invoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const pages = Math.ceil(total / LIMIT);
  const fc = formatCurrency;

  const paymentBadge = (payments) => {
    if (!payments?.length) return null;
    const modes = [...new Set(payments.map(p => p.mode.toUpperCase()))];
    return modes.join(' + ');
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
          {customer_id && <Link to="/invoices" className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1"><X size={12} /> Clear Filter</Link>}
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
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Link to={`/invoices/${inv._id}`} style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'monospace', fontSize: 15 }}>
                        {inv.invoice_number}
                      </Link>
                      <span className={`badge ${inv.status === 'active' ? 'badge-success' : inv.status === 'partially_returned' ? 'badge-warning' : 'badge-gray'}`} style={{ fontSize: 11 }}>
                        {inv.status}
                      </span>
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
                      <Link to={`/invoices/${inv._id}`} className="btn btn-outline btn-sm" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Eye size={12} /> View
                      </Link>
                      <Link to={`/invoices/${inv._id}/edit`} className="btn btn-warning btn-sm" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Edit size={12} /> Edit
                      </Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
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
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>
                        No invoices found. <Link to="/invoices/new" className="btn btn-outline btn-sm">Create one!</Link>
                      </td></tr>
                    ) : invoices.map(inv => (
                      <tr key={inv._id}>
                        <td>
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
                          <span className={`badge ${inv.status === 'active' ? 'badge-success' : inv.status === 'partially_returned' ? 'badge-warning' : 'badge-gray'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link to={`/invoices/${inv._id}`} className="btn btn-outline btn-sm" title="View"><Eye size={12} /></Link>
                            <Link to={`/invoices/${inv._id}/edit`} className="btn btn-warning btn-sm" title="Edit"><Edit size={12} /></Link>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv)} title="Delete"><Trash2 size={12} /></button>
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
          <div className="card-body flex-between" style={{ paddingTop: 12 }}>
            <div className="text-muted fs-13">Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}</div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={13} /> Prev</button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
