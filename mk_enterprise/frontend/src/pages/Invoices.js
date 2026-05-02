import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invoiceApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/helpers';

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
          <div className="page-title">📋 Invoice History</div>
          <div className="page-subtitle">{total} invoices · Sales: {fc(totalSales)} · Due: {fc(totalDue)}</div>
        </div>
        <Link to="/invoices/new" className="btn btn-primary">+ New Invoice</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="form-control" placeholder="Search by customer or invoice number..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: 320, paddingLeft: 36 }} />
          </div>
          {customer_id && <Link to="/invoices" className="btn btn-outline btn-sm">✕ Clear Filter</Link>}
        </div>
        <div className="card-body no-pad">
          {loading ? <div className="loading"><span className="spinner"></span></div> : (
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
                          : <span className="badge badge-success">Paid ✓</span>}
                      </td>
                      <td>
                        <span className={`badge ${inv.status === 'active' ? 'badge-success' : inv.status === 'partially_returned' ? 'badge-warning' : 'badge-gray'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link to={`/invoices/${inv._id}`} className="btn btn-outline btn-sm">👁️</Link>
                          <Link to={`/invoices/${inv._id}/edit`} className="btn btn-warning btn-sm">✏️</Link>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Pagination */}
        {pages > 1 && (
          <div className="card-body flex-between" style={{ paddingTop: 12 }}>
            <div className="text-muted fs-13">Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}</div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
