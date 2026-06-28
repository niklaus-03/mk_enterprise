import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { customerApi, invoiceApi, supplierApi } from '../utils/api';
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [linkedSupplier, setLinkedSupplier] = useState(null);

  const [ledger, setLedger] = useState([]);
  const [summary, setSummary] = useState({ totalOutstanding: 0, totalPurchases: 0, totalReceived: 0, advanceBalance: 0 });

  const todayStr = new Date().toLocaleDateString('en-CA');
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [isFullHistory, setIsFullHistory] = useState(false);

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '', selectedInvoices: [] });
  const [collecting, setCollecting] = useState(false);
  const [breakdownModalData, setBreakdownModalData] = useState(null);

  const [selectedEntries, setSelectedEntries] = useState([]);
  const [consolidating, setConsolidating] = useState(false);
  const [showConsolidateConfirm, setShowConsolidateConfirm] = useState(false);

  const toggleEntry = (e, itemId) => {
    if (e) e.stopPropagation();
    setSelectedEntries(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const clickTimer = useRef(null);
  const touchTimer = useRef(null);
  const touchMoved = useRef(false);

  const handleRowClick = (item) => {
    if (selectedEntries.length > 0) {
      toggleEntry(null, item.id);
      return;
    }
    if (item.type !== 'payment' && item.type !== 'invoice' && item.type !== 'goods_entry') return;
    setBreakdownModalData(item);
  };

  const handleTouchStart = (item) => {
    if (item.type === 'goods_entry' && !item.isBilled) {
      touchMoved.current = false;
      touchTimer.current = setTimeout(() => {
        if (!touchMoved.current) {
          toggleEntry(null, item.id);
          if (navigator.vibrate) navigator.vibrate(50);
        }
        touchTimer.current = null;
      }, 500);
    }
  };

  const handleTouchMove = () => {
    touchMoved.current = true;
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  const handleConsolidate = async () => {
    if (!selectedEntries.length) return;
    setShowConsolidateConfirm(true);
  };

  const confirmConsolidate = async () => {
    setShowConsolidateConfirm(false);
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
      const params = isFullHistory ? { all: 'true' } : { date: dateFilter };
      const res = await customerApi.getLedger(id, params);
      setCustomer(res.customer || null);
      setLedger(res.ledger || []);
      setSummary(res.summary || { totalOutstanding: 0, totalPurchases: 0, totalBilled: 0, totalReceived: 0, advanceBalance: 0, totalConcession: 0 });
      setPayments(res.payments || []);
      setInvoices(res.invoices || []);
      setTotalPaid(res.totalPaid || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id, dateFilter, isFullHistory]);

  useEffect(() => {
    const fetchLinkedSupplier = async () => {
      if (customer?.linked_supplier_id) {
        try {
          const suppId = typeof customer.linked_supplier_id === 'object' ? customer.linked_supplier_id._id : customer.linked_supplier_id;
          const allSuppliers = await supplierApi.getAll();
          const list = Array.isArray(allSuppliers) ? allSuppliers : (allSuppliers.data || []);
          const found = list.find(s => s._id === suppId);
          if (found) setLinkedSupplier(found);
        } catch (e) { console.error('Failed to load linked supplier'); }
      }
    };
    fetchLinkedSupplier();
  }, [customer]);

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

  const kpis = {
    totalPurchases: summary.totalPurchases,
    totalBilled: summary.totalBilled,
    totalOutstanding: summary.totalOutstanding,
    totalAdv: summary.advanceBalance,
    totalConcession: summary.totalConcession || 0,
    lastDate: ledger.length > 0 && ledger[0].date ? formatDate(ledger[0].date) : 'N/A',
  };

  if (loading) {
    return <div className="loading" style={{ minHeight: 300 }}><span className="spinner"></span></div>;
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: isMobile ? '8px' : '16px', marginBottom: isMobile ? '12px' : '24px', overflowX: 'auto', whiteSpace: 'nowrap', flexDirection: isMobile ? 'column' : 'row' }} className="no-print">
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
              <Users size={22} className="text-primary" /> {customer?.name || 'Customer'}
            </div>
            <div className="page-subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Ledger statement & payment history
              {linkedSupplier && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                  🔗 Linked to Supplier: {linkedSupplier.name}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto auto', gap: isMobile ? 8 : 12, alignItems: 'center', flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
          <button 
            className="btn" 
            onClick={() => setShowCollectModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : '8px 14px', fontSize: isMobile ? 12 : 13, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', width: isMobile ? '100%' : 'auto', fontWeight: 600 }}
          >
            <Wallet size={14} /> Record Payment
          </button>
          {linkedSupplier && (
            <button 
              className="btn" 
              onClick={() => navigate(`/suppliers/${linkedSupplier._id}/master-ledger`)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : '8px 14px', fontSize: isMobile ? 12 : 13, background: '#ffedd5', border: '1px solid #fdba74', color: '#c2410c', width: isMobile ? '100%' : 'auto', fontWeight: 600, gridColumn: isMobile ? '1 / -1' : 'auto', marginTop: isMobile ? 12 : 0 }}
            >
              <FileText size={14} /> View Master Ledger
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 24 }}>
        
        {/* 1. Total Balance (Billed + Opening) Card */}
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowUpRight size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Total Billed</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{fc(kpis.totalBilled)}</div>
        </div>

        {/* 2. Total Received Card */}
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#dcfce7', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowDownLeft size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Amount Received</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{fc(totalPaid)}</div>
        </div>

        {/* 3. Dynamic Balance Card (Outstanding/Advance) */}
        {kpis.totalAdv > 0 ? (
          <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
              <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <CreditCard size={isMobile ? 14 : 18} />
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Advance Balance</div>
            </div>
            <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>{fc(kpis.totalAdv)}</div>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
              <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Wallet size={isMobile ? 14 : 18} />
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Balance Due</div>
            </div>
            <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.5px' }}>{fc(kpis.totalOutstanding)}</div>
          </div>
        )}

        {/* 4. Concessions Given Card */}
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#fce7f3', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Package size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Total Discount</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{fc(kpis.totalConcession)}</div>
        </div>
      </div>

      {/* ── LEDGER CARD ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', gap: 12, background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>
            <Clock size={18} className="text-primary" /> 
            {isFullHistory ? 'Complete Ledger Statement' : 'Ledger for Date'}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 800 : 1000 }}>
            <thead style={{ background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'white', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: isMobile ? '10px 16px' : '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ padding: isMobile ? '10px 16px' : '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Details</th>
                <th style={{ padding: isMobile ? '10px 16px' : '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice (₹)</th>
                <th style={{ padding: isMobile ? '10px 16px' : '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid (₹)</th>
                <th style={{ padding: isMobile ? '10px 16px' : '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No transaction history available.</td></tr>
              ) : ledger.map((item, idx) => {
                const isPayment = item.type === 'payment';
                const isOpening = item.isBroughtForward;
                const isInvoice = item.type === 'invoice';
                const isGoodsEntry = item.type === 'goods_entry';
                
                let rowBg = 'white';
                let hoverBg = '#f8fafc';
                let iconBg = '';
                let iconColor = '';
                let detailText = item.desc;
                
                if (isOpening) {
                  iconBg = '#e2e8f0'; iconColor = '#64748b';
                } else if (isPayment) {
                  iconBg = '#dcfce7'; iconColor = '#15803d'; // Green for incoming payment
                  rowBg = '#f0fdf4'; 
                  hoverBg = '#dcfce7';
                } else if (isInvoice) {
                  const isFullyPaid = ((item.receivedAmt || 0) + (item.details?.discount || 0)) >= (item.invoiceAmt || 0) && (item.invoiceAmt > 0 || item.receivedAmt > 0);
                  const isPartiallyPaid = (item.receivedAmt || 0) > 0 && !isFullyPaid;
                  
                  if (isFullyPaid) {
                    iconBg = '#e0e7ff'; iconColor = '#4f46e5'; // Indigo
                    rowBg = '#eef2ff'; 
                    hoverBg = '#e0e7ff';
                  } else if (isPartiallyPaid) {
                    iconBg = '#fef3c7'; iconColor = '#d97706'; // Amber
                    rowBg = '#fffbeb'; 
                    hoverBg = '#fef3c7';
                  } else {
                    iconBg = '#fee2e2'; iconColor = '#ef4444'; // Red (Due)
                    rowBg = '#fff5f5'; 
                    hoverBg = '#fee2e2';
                  }
                } else if (isGoodsEntry) {
                  iconBg = item.isBilled ? '#f1f5f9' : '#fee2e2'; 
                  iconColor = item.isBilled ? '#64748b' : '#dc2626';
                  rowBg = item.isBilled ? 'white' : '#fff5f5';
                  hoverBg = item.isBilled ? '#f8fafc' : '#fee2e2';
                }

                return (
                  <React.Fragment key={item.id + idx}>
                    <tr 
                      onClick={() => handleRowClick(item)}
                      onTouchStart={() => handleTouchStart(item)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchEnd}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer',
                        userSelect: 'none',
                        background: selectedEntries.includes(item.id) ? '#e0f2fe' : (isOpening ? '#fdf8f6' : rowBg),
                        boxShadow: selectedEntries.includes(item.id) ? 'inset 4px 0 0 #0284c7' : 'none',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={e => { if(!selectedEntries.includes(item.id)) e.currentTarget.style.background = hoverBg }}
                      onMouseLeave={e => { if(!selectedEntries.includes(item.id)) e.currentTarget.style.background = isOpening ? '#fdf8f6' : rowBg }}
                    >
                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                          {isOpening ? '-' : formatDate(item.date).replace(/ /g, ' ')}
                        </div>
                        {!isOpening && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {formatTime(item.date)}
                          </div>
                        )}
                        {!isOpening && item.collected_by && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                            By: {item.collected_by.display_name || item.collected_by.username || 'Admin'}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: iconBg,
                            color: iconColor
                          }}>
                            {isOpening ? <Clock size={16} /> : isPayment ? <ArrowDownLeft size={16} /> : isGoodsEntry ? <Package size={16} /> : <FileText size={16} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: isOpening ? '#64748b' : 'var(--text)' }}>
                              {detailText}
                            </div>
                        
                            {!isOpening && (
                              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {item.ref && (
                                  <div>Ref: {isInvoice || isGoodsEntry ? (
                                    <Link to={`/invoices/${item.id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                                      {item.ref}
                                    </Link>
                                  ) : item.ref.toUpperCase()}</div>
                                )}
                                {item.isBilled && item.billedInId && (
                                  <div><Link to={`/invoices/${item.billedInId}`} onClick={e => e.stopPropagation()} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>→ View Bill</Link></div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, color: (isInvoice || isGoodsEntry) ? '#0f766e' : 'var(--text-muted)', fontSize: 15 }}>
                        {isOpening ? '-' : item.invoiceAmt > 0 ? fc(item.invoiceAmt) : '-'}
                      </td>
                      
                      <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, color: isPayment ? '#16a34a' : 'var(--text-muted)', fontSize: 15 }}>
                        {isOpening ? '-' : item.receivedAmt > 0 ? fc(item.receivedAmt) : '-'}
                        {item.details?.discount > 0 && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>+ {fc(item.details.discount)} Discount</div>}
                      </td>
                      
                      <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 800, color: item.runningBalance > 0 ? '#dc2626' : item.runningBalance < 0 ? '#16a34a' : 'var(--text)', fontSize: 15 }}>
                        {item.runningBalance !== 0 ? fc(Math.abs(item.runningBalance)) : '₹0.00'}
                        {item.runningBalance > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 4, letterSpacing: '0.5px' }}>DUE</div>}
                        {item.runningBalance < 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginTop: 4, letterSpacing: '0.5px' }}>ADVANCE</div>}
                      </td>
                    </tr>
                    </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BREAKDOWN MODAL ── */}
      {breakdownModalData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setBreakdownModalData(null)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 18, color: '#0f172a' }}>
                  <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', background: '#e0f2fe', padding: 8, borderRadius: 8 }}>
                    <FileText size={20} />
                  </span>
                  <span>Transaction Details</span>
                </div>
              </div>
              <button onClick={() => setBreakdownModalData(null)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                {breakdownModalData.type === 'payment' ? (
                  <div style={{ fontSize: 14, color: '#475569', display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>Mode:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{(breakdownModalData.mode||'').toUpperCase()}</div>
                    <div style={{ fontWeight: 600 }}>Reference:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{breakdownModalData.ref || 'N/A'}</div>
                    <div style={{ fontWeight: 600 }}>Collected By:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{breakdownModalData.collected_by?.display_name || breakdownModalData.collected_by?.username || 'Admin'}</div>
                    <div style={{ fontWeight: 600 }}>Notes:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{(breakdownModalData.details?.notes) || 'N/A'}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: '#475569', display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{breakdownModalData.type === 'goods_entry' ? 'Challan No:' : 'Invoice No:'}</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{breakdownModalData.ref}</div>
                    <div style={{ fontWeight: 600 }}>Items Count:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{breakdownModalData.details?.items?.length || 0}</div>
                    {breakdownModalData.details?.vehicle_number && <><div style={{ fontWeight: 600 }}>Vehicle No:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{breakdownModalData.details.vehicle_number.toUpperCase()}</div></>}
                    {breakdownModalData.details?.driver_name && <><div style={{ fontWeight: 600 }}>Driver Name:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{breakdownModalData.details.driver_name}</div></>}
                    {breakdownModalData.details?.vehicle_charge > 0 && <><div style={{ fontWeight: 600 }}>Driver Charge:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{fc(breakdownModalData.details.vehicle_charge)}</div></>}
                    {breakdownModalData.details?.labour_charge > 0 && <><div style={{ fontWeight: 600 }}>Labour Charge:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{fc(breakdownModalData.details.labour_charge)}</div></>}
                    {breakdownModalData.details?.amount_received > 0 && <><div style={{ fontWeight: 600 }}>Amount Rcvd:</div><div style={{ color: '#16a34a', fontWeight: 700 }}>{fc(breakdownModalData.details.amount_received)}</div></>}
                    <div style={{ fontWeight: 600 }}>Subtotal:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{fc(breakdownModalData.details?.subtotal || 0)}</div>
                    <div style={{ fontWeight: 600 }}>Discount:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{fc(breakdownModalData.details?.discount || 0)}</div>
                    <div style={{ fontWeight: 600 }}>Final Total:</div><div style={{ fontWeight: 800, color: '#0284c7', fontSize: 16 }}>{fc(breakdownModalData.details?.total || 0)}</div>
                    <div style={{ fontWeight: 600 }}>Notes:</div><div style={{ fontWeight: 500, color: '#0f172a' }}>{(breakdownModalData.details?.notes) || 'N/A'}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {breakdownModalData.type === 'payment' && (
                  <button className="btn btn-outline" onClick={() => printReceipt(breakdownModalData.details)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Printer size={16} style={{ marginRight: 8 }}/> Print Receipt
                  </button>
                )}
                {(breakdownModalData.type === 'invoice' || breakdownModalData.type === 'goods_entry') && (
                  <button className="btn btn-primary" onClick={() => navigate(`/invoices/${breakdownModalData.id}`)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} style={{ marginRight: 8 }}/> View Full Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COLLECT PAYMENT MODAL ── */}
      {showCollectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCollectModal(false)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ width: 48, height: 48, background: '#dcfce3', color: '#16a34a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 4px 6px -1px rgba(22,163,74,0.1)' }}>
                  <Wallet size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Receive Payment</h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                  From {customer?.name}
                </p>
              </div>
              <button onClick={() => setShowCollectModal(false)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <form id="collectForm" onSubmit={e => { e.preventDefault(); handleCollectPayment(); }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {PAYMENT_MODES.map(mode => (
                      <div 
                        key={mode} 
                        onClick={() => setCollectForm({ ...collectForm, mode })}
                        style={{ 
                          padding: '12px', border: `2px solid ${collectForm.mode === mode ? '#16a34a' : '#e2e8f0'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontWeight: 600, fontSize: 14, color: collectForm.mode === mode ? '#16a34a' : '#64748b', background: collectForm.mode === mode ? '#f0fdf4' : 'white', transition: 'all 0.2s' 
                        }}
                      >
                        {mode.toUpperCase().replace('_', ' ')}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Received *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#16a34a', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={collectForm.amount}
                      onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })}
                      style={{ width: '100%', padding: '16px 16px 16px 40px', fontSize: 24, fontWeight: 800, border: '2px solid #e2e8f0', borderRadius: 12, outline: 'none', color: '#0f172a', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      placeholder="0.00"
                    />
                  </div>
                  {customer?.balance > 0 && (
                     <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                       <span>Total Due: <strong style={{ color: '#b45309' }}>{fc(customer.balance)}</strong></span>
                       <span style={{ color: '#16a34a', cursor: 'pointer', fontWeight: 600 }} onClick={() => setCollectForm({ ...collectForm, amount: customer.balance.toFixed(2) })}>
                         Receive Full Amount
                       </span>
                     </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reference No. <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span></label>
                  <input
                    type="text"
                    value={collectForm.reference}
                    onChange={e => setCollectForm({ ...collectForm, reference: e.target.value })}
                    className="form-control"
                    placeholder="e.g. UTR / Cheque No"
                    style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span></label>
                  <textarea
                    value={collectForm.notes}
                    onChange={e => setCollectForm({ ...collectForm, notes: e.target.value })}
                    className="form-control"
                    placeholder="Add payment details..."
                    style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, minHeight: 80, resize: 'vertical' }}
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowCollectModal(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15 }}
                type="button"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="collectForm"
                className="btn btn-primary"
                disabled={collecting}
                style={{ flex: 2, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15, background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {collecting ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Wallet size={18} />}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS EXCLUDED */}
      {/* ── CONSOLIDATE CONFIRM MODAL ── */}
      {showConsolidateConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 16 : 24 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowConsolidateConfirm(false)} />
          
          <div style={{ position: 'relative', background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: 400, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Package size={28} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.5px' }}>Consolidate Entries</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
                Are you sure you want to consolidate <strong>{selectedEntries.length}</strong> selected entries into a single invoice? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => setShowConsolidateConfirm(false)}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmConsolidate}
                  style={{ flex: 1, padding: '12px', background: '#3b82f6', color: 'white', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(59,130,246,0.3)' }}
                >
                  Yes, Consolidate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
