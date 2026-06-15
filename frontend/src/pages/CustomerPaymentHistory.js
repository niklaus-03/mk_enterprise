import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { customerApi, invoiceApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { ArrowLeft, Calendar, CreditCard, Users, Wallet, Printer, IndianRupee, ArrowDownLeft, ArrowUpRight, Clock, Receipt, FileText, X, Plus, Edit3 } from 'lucide-react';

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer'];

export default function CustomerPaymentHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useApp();
  const { user } = useAuth();
  const fc = formatCurrency;

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [isFullHistory, setIsFullHistory] = useState(true);
  const [ledgerView, setLedgerView] = useState('all');

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '', selectedInvoices: [] });
  const [collecting, setCollecting] = useState(false);

  const [selectedEntries, setSelectedEntries] = useState([]);
  const [consolidating, setConsolidating] = useState(false);

  const longPressTimer = React.useRef(null);

  const handleTouchStart = (item) => {
    if (item.type !== 'invoice' || !item.is_ledger_entry) return;
    longPressTimer.current = setTimeout(() => {
      toggleEntry(null, item._id);
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEndOrMove = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const toggleEntry = (e, itemId) => {
    if (e) e.stopPropagation();
    setSelectedEntries(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const handleConsolidate = async () => {
    if (!selectedEntries.length) return;
    if (!window.confirm(`Consolidate ${selectedEntries.length} entries into a single Invoice?`)) return;
    
    setConsolidating(true);
    try {
      await invoiceApi.consolidate({ customer_id: id, entryIds: selectedEntries });
      toast.success('Invoices consolidated successfully!');
      setSelectedEntries([]);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Consolidation failed');
    } finally {
      setConsolidating(false);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await customerApi.getPaymentHistory(id, { all: 'true' });
      setPayments(res.payments || []);
      setInvoices(res.invoices || []);
      setCustomer(res.customer || null);
      setTotalPaid(res.totalPaid || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  // Auto-open collect modal when navigated from Customers page with openCollect state
  useEffect(() => {
    if (state?.openCollect && customer && !loading) {
      setShowCollectModal(true);
      if (unpaidInvoices.length > 1) {
        setCollectForm(prev => ({ ...prev, selectedInvoices: unpaidInvoices.map(i => i._id), amount: (customer.balance || 0).toFixed(2) }));
      }
      // Clean up state so refresh doesn't re-open
      window.history.replaceState({}, document.title);
    }
  }, [state, customer, loading]);

  // Build combined ledger
  const buildLedger = () => {
    let items = [];

    if (ledgerView === 'all' || ledgerView === 'payments') {
      payments.forEach(p => {
        items.push({
          type: 'payment',
          date: p.date,
          amount: p.amount,
          mode: p.mode,
          reference: p.reference,
          notes: p.notes,
          previous_balance: p.previous_balance,
          new_balance: p.new_balance,
          collected_by: p.collected_by,
          ist_date: p.ist_date,
          ist_formatted: p.ist_formatted,
          _id: p._id,
        });
      });
    }

    if (ledgerView === 'all' || ledgerView === 'invoices') {
      invoices.forEach(i => {
        if (i.status === 'consolidated') return;
        items.push({
          type: 'invoice',
          date: i.date,
          amount: i.total,
          invoice_number: i.invoice_number,
          balance_due: i.balance_due,
          ist_formatted: i.ist_formatted,
          is_ledger_entry: !!i.is_ledger_entry,
          _id: i._id,
        });
      });
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Date filter
    if (!isFullHistory && dateFilter) {
      items = items.filter(item => {
        if (item.ist_date) return item.ist_date === dateFilter;
        // Fallback: convert date to IST date string
        const d = new Date(item.date);
        const istD = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return istD.toISOString().slice(0, 10) === dateFilter;
      });
    }

    return items;
  };

  const ledger = buildLedger();
  const unpaidInvoices = invoices.filter(i => i.balance_due > 0.01);
  const unpaidInvoicesSum = unpaidInvoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const unpaidOpeningBalance = Math.max(0, (customer?.balance || 0) - unpaidInvoicesSum);
  
  const itemsToClear = [...unpaidInvoices];
  if (unpaidOpeningBalance > 0.01) {
    itemsToClear.unshift({ _id: '000000000000000000000000', invoice_number: 'Opening Balance', ist_formatted: 'From Ledger', balance_due: unpaidOpeningBalance, isOpeningBalance: true });
  }
  
  const hasMultipleUnpaid = itemsToClear.length > 1;

  const handleCollectPayment = async () => {
    const amt = parseFloat(collectForm.amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    if (!collectForm.mode) return toast.error('Select payment mode');

    setCollecting(true);
    try {
      const res = await customerApi.collectPayment(id, {
        amount: amt,
        invoice_ids: collectForm.selectedInvoices,
        mode: collectForm.mode,
        reference: collectForm.reference,
        notes: collectForm.notes,
      });
      toast.success(res.message || 'Payment recorded!');
      setShowCollectModal(false);
      setCollectForm({ amount: '', mode: 'cash', reference: '', notes: '', selectedInvoices: [] });
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCollecting(false);
    }
  };

  const printReceipt = (p) => {
    const prevTitle = document.title;
    document.title = `Payment-Receipt-${p.ist_date || 'receipt'}`;
    const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
    const timeStr = p.date ? new Date(p.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
    const collectorName = p.collected_by ? (p.collected_by.display_name || p.collected_by.username || 'Admin') : 'Admin';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title}</title>
      <style>
        @page { margin: 12mm 10mm; size: A5; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 20px; }
        .receipt-box { max-width: 420px; margin: 0 auto; border: 2px solid #1a1f2e; border-radius: 12px; overflow: hidden; }
        .receipt-header { background: linear-gradient(135deg, #1a1f2e, #2d3a5c); color: #fff; padding: 20px 24px; text-align: center; }
        .receipt-header h2 { margin: 0 0 4px; font-size: 18px; letter-spacing: 0.5px; }
        .receipt-header .sub { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; }
        .receipt-body { padding: 20px 24px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .row:last-child { border-bottom: none; }
        .row .label { color: #64748b; font-weight: 600; font-size: 12px; }
        .row .value { font-weight: 700; color: #1e293b; text-align: right; }
        .amount-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 10px; padding: 16px; text-align: center; margin: 16px 0; }
        .amount-box .amt { font-size: 28px; font-weight: 900; color: #16a34a; }
        .amount-box .mode { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
        .balance-row { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; }
        .balance-card { flex: 1; padding: 10px; border-radius: 8px; text-align: center; }
        .balance-card.prev { background: #fef2f2; border: 1px solid #fecaca; }
        .balance-card.new { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .balance-card .bl { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
        .balance-card .bv { font-size: 16px; font-weight: 800; margin-top: 4px; }
        .balance-card.prev .bv { color: #dc2626; }
        .balance-card.new .bv { color: #16a34a; }
        .receipt-footer { background: #f8fafc; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style></head><body>
      <div class="receipt-box">
        <div class="receipt-header">
          <h2>MK Enterprise</h2>
          <div class="sub">Payment Receipt</div>
        </div>
        <div class="receipt-body">
          <div class="row"><span class="label">Customer</span><span class="value">${customer?.name || 'N/A'}</span></div>
          ${customer?.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${customer.phone}</span></div>` : ''}
          <div class="row"><span class="label">Date</span><span class="value">${dateStr}</span></div>
          <div class="row"><span class="label">Time</span><span class="value">${timeStr}</span></div>

          <div class="amount-box">
            <div class="amt">₹${p.amount?.toLocaleString('en-IN')}</div>
            <div class="mode">Paid via ${(p.mode || 'cash').replace('_', ' ')}</div>
          </div>

          ${p.reference ? `<div class="row"><span class="label">Reference</span><span class="value">${p.reference}</span></div>` : ''}
          ${p.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${p.notes}</span></div>` : ''}
          <div class="row"><span class="label">Collected By</span><span class="value">${collectorName}</span></div>

          <div class="balance-row">
            <div class="balance-card prev">
              <div class="bl">Previous Due</div>
              <div class="bv">₹${(p.previous_balance || 0).toLocaleString('en-IN')}</div>
            </div>
            <div class="balance-card new">
              <div class="bl">Current Due</div>
              <div class="bv">₹${(p.new_balance || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
        <div class="receipt-footer">Thank you for your payment</div>
      </div></body></html>`;
    const win = window.open('', '_blank', 'width=500,height=700');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); setTimeout(() => { win.close(); document.title = prevTitle; }, 500); };
  };

  const modeColor = (mode) => {
    if (mode === 'cash') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    if (mode === 'upi') return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
    if (mode === 'bank_transfer') return { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' };
    return { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  if (loading) {
    return <div className="loading" style={{ minHeight: 300 }}><span className="spinner"></span></div>;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── HEADER ── */}
      <div className="page-header" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('/customers')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', padding: 0 }}>
              <ArrowLeft size={22} />
            </button>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <Users size={22} />
            </span>
            <span>{customer?.name || 'Customer'} — Ledger</span>
          </div>
          <div className="page-subtitle" style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Balance: <strong style={{ color: customer?.balance > 0 ? '#dc2626' : customer?.balance < 0 ? '#16a34a' : '#64748b' }}>
              {customer?.balance > 0 ? `${fc(customer.balance)} Due` : customer?.balance < 0 ? `${fc(Math.abs(customer.balance))} Advance` : 'Clear'}
            </strong></span>
            <span>Total Paid: <strong style={{ color: '#16a34a' }}>{fc(totalPaid)}</strong></span>
            {customer?.phone && <span>Phone: {customer.phone}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-primary" onClick={() => {
              setShowCollectModal(true);
              if (hasMultipleUnpaid) {
                setCollectForm(prev => ({ ...prev, selectedInvoices: unpaidInvoices.map(i => i._id), amount: (customer?.balance || 0).toFixed(2) }));
              } else {
                setCollectForm(prev => ({ ...prev, amount: (customer?.balance || 0).toFixed(2) }));
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
            <CreditCard size={15} /> Collect Payment
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140, borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={14} /> Current Balance
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: customer?.balance > 0 ? '#dc2626' : '#16a34a', letterSpacing: '-0.5px' }}>
            {fc(Math.abs(customer?.balance || 0))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {customer?.balance > 0 ? 'Due' : customer?.balance < 0 ? 'Advance' : 'Clear'}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140, borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IndianRupee size={14} /> Total Paid
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', letterSpacing: '-0.5px' }}>
            {fc(totalPaid)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{payments.length} payment(s)</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Receipt size={14} /> Total Invoices
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#3b82f6', letterSpacing: '-0.5px' }}>
            {invoices.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {fc(invoices.reduce((s, i) => s + (i.total || 0), 0))} billed
          </div>
        </div>
      </div>

      {/* ── MAIN CARD ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ key: 'all', label: 'All' }, { key: 'payments', label: 'Payments' }, { key: 'invoices', label: 'Invoices' }].map(v => (
              <button key={v.key} onClick={() => setLedgerView(v.key)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: ledgerView === v.key ? 'var(--primary)' : '#f1f5f9',
                  color: ledgerView === v.key ? '#fff' : 'var(--text-muted)'
                }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Date filter & Consolidate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const unbilledIds = ledger.filter(i => i.type === 'invoice' && i.is_ledger_entry).map(i => i._id);
                if (unbilledIds.length === 0) return toast('No unbilled entries to select');
                const allSelected = unbilledIds.every(id => selectedEntries.includes(id));
                setSelectedEntries(allSelected ? [] : unbilledIds);
              }}
              className="btn btn-outline btn-sm"
              style={{ borderRadius: 8, fontWeight: 700, padding: '6px 12px' }}
            >
              Select All Unbilled
            </button>
            {selectedEntries.length > 0 && (
              <button
                onClick={handleConsolidate}
                disabled={consolidating}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: 8, fontWeight: 700, padding: '6px 12px' }}
              >
                {consolidating ? 'Consolidating...' : `Consolidate (${selectedEntries.length})`}
              </button>
            )}
            {!isFullHistory ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px' }}>
                  <Calendar size={14} style={{ marginRight: 8, color: 'var(--text-muted)' }} />
                  <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, color: 'var(--text)' }} />
                </div>
                <button onClick={() => setIsFullHistory(true)} className="btn btn-outline btn-sm" style={{ borderRadius: 8, fontWeight: 600 }}>
                  Full History
                </button>
              </>
            ) : (
              <button onClick={() => { setIsFullHistory(false); if (!dateFilter) setDateFilter(todayStr); }}
                className="btn btn-outline btn-sm" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Calendar size={14} /> Filter by Date
              </button>
            )}
          </div>
        </div>

        <div className="card-body no-pad">
          {ledger.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 16 }}>No records found</div>
              {!isFullHistory && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Try selecting a different date or viewing Full History</div>}
            </div>
          ) : isMobile ? (
            /* ── MOBILE CARD VIEW ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ledger.map((item, idx) => (
                <div key={item._id} 
                  onTouchStart={() => handleTouchStart(item)}
                  onTouchEnd={handleTouchEndOrMove}
                  onTouchMove={handleTouchEndOrMove}
                  onTouchCancel={handleTouchEndOrMove}
                  style={{
                  padding: '14px 16px', borderBottom: '1px solid #f1f5f9',
                  background: selectedEntries.includes(item._id) ? '#eff6ff' : (idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg)'),
                  transition: 'background 0.2s',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {item.type === 'invoice' && item.is_ledger_entry && (
                        <div style={{ paddingTop: '2px' }} onClick={(e) => toggleEntry(e, item._id)}>
                          <input 
                            type="checkbox" 
                            checked={selectedEntries.includes(item._id)} 
                            onChange={(e) => toggleEntry(e, item._id)} 
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {formatDate(item.date)}
                          <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>{formatTime(item.date)}</span>
                        </div>
                      {item.type === 'payment' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', marginTop: 4 }}>
                          <ArrowDownLeft size={10} /> Payment Received
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', marginTop: 4 }}>
                          <ArrowUpRight size={10} /> Invoice
                        </span>
                      )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: item.type === 'payment' ? '#16a34a' : '#dc2626', letterSpacing: '-0.5px' }}>
                        {item.type === 'payment' ? '−' : '+'}{fc(item.amount)}
                      </div>
                    </div>
                  </div>
                  {item.type === 'payment' && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ ...(() => { const mc = modeColor(item.mode); return { background: mc.bg, color: mc.color, border: `1px solid ${mc.border}` }; })(), padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                          {(item.mode || 'cash').replace('_', ' ')}
                        </span>
                        {item.collected_by && <span style={{ fontSize: 11 }}>by {item.collected_by.display_name || item.collected_by.username}</span>}
                        {item.reference && <span style={{ fontSize: 11 }}>Ref: {item.reference}</span>}
                      </div>
                      <div style={{ fontSize: 11, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>₹{(item.previous_balance || 0).toLocaleString('en-IN')}</span>
                        <span style={{ color: '#16a34a' }}>→</span>
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{(item.new_balance || 0).toLocaleString('en-IN')}</span>
                        <button onClick={() => printReceipt(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 2 }}>
                          <Printer size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  {item.type === 'invoice' && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => navigate(`/invoices/${item._id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace', fontSize: 12, padding: 0 }}>
                        {item.invoice_number}
                      </button>
                      {item.balance_due > 0.01 ? (
                        <span className="badge badge-danger" style={{ fontSize: 10 }}>{fc(item.balance_due)} due</span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: 10 }}>Paid</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── DESKTOP TABLE VIEW ── */
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table style={{ width: '100%', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px', width: 40 }}></th>
                    <th style={{ padding: '14px 20px' }}>Date & Time</th>
                    <th style={{ padding: '14px 20px' }}>Type</th>
                    <th style={{ padding: '14px 20px' }}>Details</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Amount ₹</th>
                    <th style={{ padding: '14px 20px', width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((item, idx) => (
                    <tr key={item._id} 
                      onDoubleClick={() => { if (item.type === 'invoice' && item.is_ledger_entry) toggleEntry(null, item._id); }}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        background: selectedEntries.includes(item._id) ? '#eff6ff' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                        transition: 'background 0.2s',
                        cursor: item.type === 'invoice' && item.is_ledger_entry ? 'pointer' : 'default',
                        userSelect: 'none'
                      }}>
                      <td style={{ padding: '14px 20px' }}>
                        {item.type === 'invoice' && item.is_ledger_entry && (
                          <div onClick={(e) => toggleEntry(e, item._id)} style={{ display: 'inline-block' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedEntries.includes(item._id)} 
                              onChange={(e) => toggleEntry(e, item._id)} 
                              style={{ width: 18, height: 18, cursor: 'pointer', pointerEvents: 'none' }}
                            />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{formatDate(item.date)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {formatTime(item.date)}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {item.type === 'payment' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                            <ArrowDownLeft size={12} /> Payment
                          </span>
                        ) : item.type === 'invoice' ? (
                          item.is_ledger_entry ? (
                            <span className="badge badge-warning" style={{ fontSize: 11, fontWeight: 600 }}>📝 Khata Entry</span>
                          ) : item.source_entries && item.source_entries.length > 0 ? (
                            <span className="badge" style={{ fontSize: 11, fontWeight: 600, background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>📦 Consolidated</span>
                          ) : (
                            <span className="badge badge-danger" style={{ fontSize: 11, fontWeight: 600 }}>↗ Invoice</span>
                          )
                        ) : null}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {item.type === 'payment' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {(() => { const mc = modeColor(item.mode); return (
                                <span style={{ background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, padding: '2px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
                                  ● {(item.mode || 'cash').replace('_', ' ')}
                                </span>
                              ); })()}
                              {item.collected_by && (
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                  by {item.collected_by.display_name || item.collected_by.username}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ background: '#fef2f2', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>₹{(item.previous_balance || 0).toLocaleString('en-IN')}</span>
                              <span style={{ color: '#16a34a', fontWeight: 800 }}>→</span>
                              <span style={{ background: '#f0fdf4', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>₹{(item.new_balance || 0).toLocaleString('en-IN')}</span>
                            </div>
                            {item.reference && <div style={{ fontSize: 11, color: '#94a3b8' }}>Ref: {item.reference}</div>}
                            {item.notes && <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.notes}</div>}
                          </div>
                        ) : (
                          <div>
                            <button onClick={() => navigate(`/invoices/${item._id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace', fontSize: 13, padding: 0 }}>
                              {item.invoice_number}
                            </button>
                            {item.balance_due > 0.01 ? (
                              <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10 }}>{fc(item.balance_due)} due</span>
                            ) : (
                              <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 10 }}>Paid</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: 17, color: item.type === 'payment' ? '#16a34a' : '#dc2626', letterSpacing: '-0.5px' }}>
                          {item.type === 'payment' ? '−' : '+'}{fc(item.amount)}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {item.type === 'payment' && (
                          <button onClick={() => printReceipt(item)} title="Print Receipt"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}>
                            <Printer size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── COLLECT PAYMENT MODAL ── */}
      {showCollectModal && (
        <div className="modal-overlay" onClick={() => setShowCollectModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--sidebar-bg)', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: '#fff' }}>
                <CreditCard size={18} style={{ color: '#facc15' }} />
                Collect Payment
              </div>
              <button onClick={() => setShowCollectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              {/* Customer info */}
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{customer?.name}</div>
                {hasMultipleUnpaid && itemsToClear && itemsToClear.length > 0 ? (
                  <div style={{ marginTop: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Select Invoices to Clear:</div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}>
                      {itemsToClear.map((inv, idx) => {
                        const isSelected = collectForm.selectedInvoices && collectForm.selectedInvoices.includes(inv._id);
                        return (
                          <div 
                            key={inv._id || idx}
                            onClick={() => {
                              let newSelected = [...(collectForm.selectedInvoices || [])];
                              if (isSelected) {
                                newSelected = newSelected.filter(id => id !== inv._id);
                              } else {
                                newSelected.push(inv._id);
                              }
                              
                              const newAmount = itemsToClear
                                .filter(i => newSelected.includes(i._id))
                                .reduce((s, i) => s + (i.balance_due || 0), 0);

                              setCollectForm({ ...collectForm, selectedInvoices: newSelected, amount: newAmount > 0 ? newAmount.toFixed(2) : '' });
                            }}
                            style={{ 
                              display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: idx < itemsToClear.length - 1 ? '1px solid var(--border)' : 'none',
                              cursor: 'pointer', background: isSelected ? '#f0fdf4' : '#fff', transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${isSelected ? '#22c55e' : '#cbd5e1'}`, background: isSelected ? '#22c55e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              {isSelected && <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>✓</div>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inv.invoice_number || 'Walk-in Bill'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.ist_formatted ? inv.ist_formatted.split(',')[0] : 'Historical'}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>
                              {fc(inv.balance_due)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#dc2626' }}>
                    Due: {fc(Math.max(0, customer?.balance || 0))}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Amount Received ₹ *</label>
                <input className="form-control" type="number" step="0.01" min="0" autoFocus
                  value={collectForm.amount} onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })}
                  placeholder="0.00" style={{ borderRadius: 8, fontSize: 16, fontWeight: 700 }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Due: {fc(Math.max(0, customer?.balance || 0))} ·{' '}
                  {customer?.balance > 0 && (
                    <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setCollectForm({ ...collectForm, amount: (customer.balance).toFixed(2) })}>
                      Full Amount
                    </span>
                  )}
                </div>
                {parseFloat(collectForm.amount) > (customer?.balance || 0) && parseFloat(collectForm.amount) > 0 && (
                  <div style={{ marginTop: 6, padding: '7px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12.5, color: '#1d4ed8' }}>
                    Extra <strong>{fc(parseFloat(collectForm.amount) - (customer?.balance || 0))}</strong> will be stored as advance credit.
                  </div>
                )}
              </div>

              {/* Payment Mode */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Payment Mode *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PAYMENT_MODES.map(m => (
                    <button key={m} type="button"
                      className={`btn btn-sm ${collectForm.mode === m ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setCollectForm({ ...collectForm, mode: m })}
                      style={{ borderRadius: 8, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.3px' }}>
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Reference / UPI ID (optional)</label>
                <input className="form-control" value={collectForm.reference} onChange={e => setCollectForm({ ...collectForm, reference: e.target.value })}
                  placeholder="Transaction ID or UPI ref" style={{ borderRadius: 8 }} />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Notes (optional)</label>
                <input className="form-control" value={collectForm.notes} onChange={e => setCollectForm({ ...collectForm, notes: e.target.value })}
                  placeholder="Payment notes" style={{ borderRadius: 8 }} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setShowCollectModal(false)} style={{ borderRadius: 8 }}>Cancel</button>
                <button className="btn btn-success" onClick={handleCollectPayment} disabled={collecting}
                  style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {collecting ? <><span className="spinner"></span> Saving...</> : <><CreditCard size={15} /> Record Payment</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
