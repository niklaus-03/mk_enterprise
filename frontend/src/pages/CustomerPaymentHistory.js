import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { customerApi, invoiceApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { ArrowLeft, Calendar, CreditCard, Users, Wallet, Printer, IndianRupee, ArrowDownLeft, ArrowUpRight, Clock, Receipt, FileText, X, Plus, Edit3, ChevronDown, ChevronUp, Package } from 'lucide-react';

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque'];

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
  const [isFullHistory, setIsFullHistory] = useState(false);

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '', selectedInvoices: [] });
  const [collecting, setCollecting] = useState(false);

  const [expandedRow, setExpandedRow] = useState(null);

  const [selectedEntries, setSelectedEntries] = useState([]);
  const [consolidating, setConsolidating] = useState(false);

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
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

  useEffect(() => {
    if (showCollectModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showCollectModal]);

  useEffect(() => {
    if (state?.openCollect && customer && !loading) {
      setShowCollectModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [state, customer, loading]);

  const buildLedger = () => {
    let items = [];

    // Add Payments
    payments.forEach(p => {
      items.push({
        _raw: p,
        type: 'payment',
        dateObj: new Date(p.date),
        id: p._id,
        ref: p.reference || p.mode,
        desc: p.notes || `Payment via ${(p.mode||'cash').replace('_',' ')}`,
        invoiceAmt: 0,
        receivedAmt: p.amount,
        mode: p.mode,
        collected_by: p.collected_by
      });
    });

    // Add Invoices & Goods Entries
    invoices.forEach(i => {
      if (i.is_ledger_entry) {
        items.push({
          _raw: i,
          type: 'goods_entry',
          dateObj: new Date(i.date),
          id: i._id,
          ref: i.invoice_number || 'Khata Entry',
          desc: i.consolidated_into ? 'Billed in Invoice' : 'Unbilled Goods Entry',
          invoiceAmt: 0, // Doesn't hit running balance until consolidated
          receivedAmt: 0,
          isBilled: !!i.consolidated_into,
          billedInId: i.consolidated_into
        });
      } else {
        items.push({
          _raw: i,
          type: 'invoice',
          dateObj: new Date(i.date),
          id: i._id,
          ref: i.invoice_number,
          desc: i.notes || 'Sales Invoice',
          invoiceAmt: i.total,
          receivedAmt: 0
        });
      }
    });

    // Filter by Date if needed
    if (!isFullHistory && dateFilter) {
      items = items.filter(item => {
        if (item._raw.ist_date) return item._raw.ist_date === dateFilter;
        const d = new Date(item.dateObj);
        const istD = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return istD.toISOString().slice(0, 10) === dateFilter;
      });
    }

    // Sort oldest to newest to compute running balance
    items.sort((a, b) => a.dateObj - b.dateObj);

    // Calculate sum of due changes
    let sumDueChanges = 0;
    items.forEach(item => {
      sumDueChanges += (item.invoiceAmt - item.receivedAmt);
    });

    // Brought Forward logic ensures actual balance matches the computed ending balance
    let broughtForward = (customer?.balance || 0) - sumDueChanges;
    let currentBalance = broughtForward;
    let computedLedger = [];

    // Add Brought Forward row
    if (Math.abs(broughtForward) > 0.01 || (items.length > 0 && invoices.length === 100)) {
      computedLedger.push({
        type: 'opening_balance',
        dateObj: items.length > 0 ? new Date(items[0].dateObj.getTime() - 1000) : new Date(),
        id: 'brought_forward',
        ref: '-',
        desc: 'Previous Balance (Brought Forward)',
        openingBalance: 0,
        invoiceAmt: broughtForward > 0 ? broughtForward : 0,
        receivedAmt: broughtForward < 0 ? Math.abs(broughtForward) : 0,
        dueChange: broughtForward,
        runningBalance: broughtForward,
        isBroughtForward: true
      });
    }

    items.forEach(item => {
      let opBal = currentBalance;
      let dueChange = item.invoiceAmt - item.receivedAmt;
      currentBalance += dueChange;
      
      computedLedger.push({
        ...item,
        openingBalance: opBal,
        dueChange: dueChange,
        runningBalance: currentBalance
      });
    });

    // Reverse to show newest first
    computedLedger.reverse();
    return computedLedger;
  };

  const ledger = buildLedger();
  const unpaidInvoices = invoices.filter(i => !i.is_ledger_entry && i.balance_due > 0.01);
  const unpaidInvoicesSum = unpaidInvoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const unpaidOpeningBalance = Math.max(0, (customer?.balance || 0) - unpaidInvoicesSum);
  
  const itemsToClear = [...unpaidInvoices];
  if (unpaidOpeningBalance > 0.01) {
    itemsToClear.unshift({ _id: '000000000000000000000000', invoice_number: 'Opening Balance', ist_formatted: 'From Ledger', balance_due: unpaidOpeningBalance, isOpeningBalance: true });
  }

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

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  const getTypeStyle = (type, isBilled) => {
    switch (type) {
      case 'payment': return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Payment', icon: <ArrowDownLeft size={12} /> };
      case 'invoice': return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Invoice', icon: <ArrowUpRight size={12} /> };
      case 'goods_entry': return { bg: isBilled ? '#f8fafc' : '#fff7ed', color: isBilled ? '#94a3b8' : '#ea580c', border: isBilled ? '#e2e8f0' : '#fed7aa', label: 'Goods Entry', icon: <Package size={12} /> };
      case 'opening_balance': return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Balance', icon: <Wallet size={12} /> };
      default: return { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', label: 'Other', icon: null };
    }
  };

  const calculateKPIs = () => {
    let totalPurchases = invoices.filter(i => !i.is_ledger_entry).reduce((s, i) => s + (i.total || 0), 0);
    let totalOutstanding = Math.max(0, customer?.balance || 0);
    let totalAdv = Math.max(0, -(customer?.balance || 0));
    let lastDate = ledger.length > 0 ? formatDate(ledger[0].dateObj) : 'N/A';
    return { totalPurchases, totalOutstanding, totalAdv, lastDate };
  };

  if (loading) {
    return <div className="loading" style={{ minHeight: 300 }}><span className="spinner"></span></div>;
  }

  const kpis = calculateKPIs();

  return (
    <div style={{ paddingBottom: 60 }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/customers')}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back to Customers"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, marginTop: '4px' }}>
              <Users size={22} className="text-primary" /> {customer?.name || 'Customer'} Ledger
            </div>
            <div className="page-subtitle" style={{ margin: 0 }}>
              Ledger statement & payment history
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: isMobile ? 6 : 12, flexShrink: 0, flexDirection: isMobile ? 'column' : 'row' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowCollectModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : undefined, fontSize: isMobile ? 12 : undefined }}
          >
            <CreditCard size={14} /> Record Payment
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => window.print()} 
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : undefined, fontSize: isMobile ? 12 : undefined, background: 'white' }}
          >
            <Printer size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '6px solid #f59e0b', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Wallet size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Outstanding</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{fc(kpis.totalOutstanding)}</div>
        </div>
        
        <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '6px solid #ef4444', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ArrowUpRight size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Purchases</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{fc(kpis.totalPurchases)}</div>
        </div>

        <div style={{ padding: '16px 20px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderLeft: '6px solid #10b981', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ArrowDownLeft size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Received</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>{fc(totalPaid)}</div>
        </div>

        <div style={{ padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '6px solid #3b82f6', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <CreditCard size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advance Balance</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>{fc(kpis.totalAdv)}</div>
        </div>
      </div>

      {/* ── LEDGER CARD ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
            <Clock size={18} className="text-primary" /> 
            {isFullHistory ? 'Complete Ledger Statement' : 'Ledger for Date'}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => {
                const unbilledIds = ledger.filter(i => i.type === 'goods_entry' && !i.isBilled).map(i => i.id);
                if (unbilledIds.length === 0) return toast.error('No unbilled entries to select');
                const allSelected = unbilledIds.length > 0 && unbilledIds.every(id => selectedEntries.includes(id));
                setSelectedEntries(allSelected ? [] : unbilledIds);
              }}
              className="btn btn-outline btn-sm"
              style={{ borderRadius: 8, fontWeight: 600, background: 'white' }}
            >
              Select All Unbilled
            </button>
            {selectedEntries.length > 0 && (
              <button
                onClick={handleConsolidate}
                disabled={consolidating}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                {consolidating ? 'Consolidating...' : `Consolidate (${selectedEntries.length})`}
              </button>
            )}

            {!isFullHistory ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Calendar size={14} className="text-muted" style={{ marginRight: 8 }} />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, color: 'var(--text)' }}
                  />
                </div>
                <button onClick={() => setIsFullHistory(true)} className="btn btn-outline btn-sm" style={{ borderRadius: 8, fontWeight: 600, background: 'white' }}>
                  Full History
                </button>
              </>
            ) : (
              <button onClick={() => { setIsFullHistory(false); if (!dateFilter) setDateFilter(todayStr); }} className="btn btn-outline btn-sm" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, background: 'white' }}>
                <Calendar size={14} /> View Today
              </button>
            )}
          </div>
        </div>

        <div className="card-body no-pad" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 }}>
            <thead style={{ background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'white', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ref No.</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Op. Balance</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice Amt (Dr)</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Received (Cr)</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Change</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Running Bal</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No transaction history available.</td></tr>
              ) : ledger.map((item, idx) => {
                const ts = getTypeStyle(item.type, item.isBilled);
                const isExpanded = expandedRow === item.id;
                return (
                  <React.Fragment key={item.id + idx}>
                    <tr 
                      onClick={() => {
                        if (item.type === 'goods_entry' && !item.isBilled) {
                          toggleEntry(null, item.id);
                        } else {
                          setExpandedRow(isExpanded ? null : item.id);
                        }
                      }}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer',
                        background: selectedEntries.includes(item.id) ? '#eff6ff' : (isExpanded ? '#f8fafc' : (item.isBroughtForward ? '#fdf8f6' : '#fff')),
                        transition: 'background 0.2s ease'
                      }}
                      className="hover-bg-slate-50"
                    >
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          {item.type === 'goods_entry' && !item.isBilled && (
                            <div onClick={(e) => toggleEntry(e, item.id)} style={{ paddingTop: 2 }}>
                              <input 
                                type="checkbox" 
                                checked={selectedEntries.includes(item.id)} 
                                onChange={(e) => toggleEntry(e, item.id)} 
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.isBroughtForward ? '-' : formatDate(item.dateObj)}</div>
                            {!item.isBroughtForward && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{formatTime(item.dateObj)}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                          {ts.icon} {ts.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                        {item.type === 'invoice' || item.type === 'goods_entry' ? (
                          <Link to={`/invoices/${item.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            {item.ref}
                          </Link>
                        ) : (
                          item.ref?.toUpperCase()
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', color: '#475569' }}>
                        <div style={{ fontWeight: 500 }}>{item.desc}</div>
                        {item.isBilled && item.billedInId && (
                          <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                            → <Link to={`/invoices/${item.billedInId}`} onClick={e => e.stopPropagation()} style={{ color: '#3b82f6', textDecoration: 'none' }}>View Bill</Link>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', fontWeight: 500, color: '#64748b' }}>
                        {item.isBroughtForward ? '-' : fc(item.openingBalance)}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: item.invoiceAmt > 0 ? '#dc2626' : '#94a3b8' }}>
                        {item.isBroughtForward ? '-' : item.invoiceAmt > 0 ? fc(item.invoiceAmt) : '-'}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: item.receivedAmt > 0 ? '#16a34a' : '#94a3b8' }}>
                        {item.isBroughtForward ? '-' : item.receivedAmt > 0 ? fc(item.receivedAmt) : '-'}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: item.dueChange > 0 ? '#dc2626' : item.dueChange < 0 ? '#16a34a' : '#94a3b8' }}>
                        {item.dueChange > 0 ? `+${fc(item.dueChange)}` : item.dueChange < 0 ? `${fc(item.dueChange)}` : '-'}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', fontWeight: 800, color: item.runningBalance > 0 ? '#dc2626' : item.runningBalance < 0 ? '#16a34a' : '#1e293b', background: '#f8fafc', borderLeft: '1px solid #e2e8f0' }}>
                        {item.runningBalance !== 0 ? fc(Math.abs(item.runningBalance)) : '₹0.00'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="9" style={{ padding: 0 }}>
                          <div style={{ background: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 280 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Transaction Details</div>
                                {item.type === 'payment' ? (
                                  <div style={{ fontSize: 13, color: '#475569', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>Mode:</div><div>{(item.mode||'').toUpperCase()}</div>
                                    <div style={{ fontWeight: 600 }}>Reference:</div><div>{item.ref || 'N/A'}</div>
                                    <div style={{ fontWeight: 600 }}>Collected By:</div><div>{item.collected_by?.display_name || item.collected_by?.username || 'Admin'}</div>
                                    <div style={{ fontWeight: 600 }}>Notes:</div><div>{item._raw.notes || 'N/A'}</div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 13, color: '#475569', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>Invoice No:</div><div>{item.ref}</div>
                                    <div style={{ fontWeight: 600 }}>Items Count:</div><div>{item._raw.items?.length || 0}</div>
                                    <div style={{ fontWeight: 600 }}>Subtotal:</div><div>{fc(item._raw.subtotal || 0)}</div>
                                    <div style={{ fontWeight: 600 }}>Discount:</div><div>{fc(item._raw.discount || 0)}</div>
                                    <div style={{ fontWeight: 600 }}>Total:</div><div>{fc(item._raw.total || 0)}</div>
                                    <div style={{ fontWeight: 600 }}>Notes:</div><div>{item._raw.notes || 'N/A'}</div>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                {item.type === 'payment' && (
                                  <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); printReceipt(item._raw); }} style={{ background: '#fff', display: 'flex', alignItems: 'center' }}>
                                    <Printer size={14} style={{ marginRight: 6 }}/> Print Receipt
                                  </button>
                                )}
                                {(item.type === 'invoice' || item.type === 'goods_entry') && (
                                  <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${item.id}`); }} style={{ display: 'flex', alignItems: 'center' }}>
                                    <FileText size={14} style={{ marginRight: 6 }}/> View Full Invoice
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── COLLECT PAYMENT MODAL ── */}
      {showCollectModal && (
        <div className="modal-overlay" onClick={() => setShowCollectModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.60)', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
                <CreditCard size={18} style={{ color: '#facc15' }} />
                Receive Payment
              </div>
              <button onClick={() => setShowCollectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{customer?.name}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#dc2626' }}>
                  Current Due: {fc(Math.max(0, customer?.balance || 0))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Amount Received ₹ *</label>
                <input className="form-control" type="number" step="0.01" min="0" autoFocus
                  value={collectForm.amount} onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })}
                  placeholder="0.00" style={{ borderRadius: 8, fontSize: 16, fontWeight: 700 }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {customer?.balance > 0 && (
                    <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setCollectForm({ ...collectForm, amount: (customer.balance).toFixed(2) })}>
                      Settle Full Amount
                    </span>
                  )}
                </div>
              </div>

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

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Reference / UPI ID (optional)</label>
                <input className="form-control" value={collectForm.reference} onChange={e => setCollectForm({ ...collectForm, reference: e.target.value })}
                  placeholder="Transaction ID or UPI ref" style={{ borderRadius: 8 }} />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Notes (optional)</label>
                <input className="form-control" value={collectForm.notes} onChange={e => setCollectForm({ ...collectForm, notes: e.target.value })}
                  placeholder="Payment notes" style={{ borderRadius: 8 }} />
              </div>

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
