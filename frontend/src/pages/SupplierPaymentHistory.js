import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { supplierApi, settlementApi, customerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { ArrowLeft, Calendar, CreditCard, Building2, Wallet, ArrowDownLeft, ArrowUpRight, Clock, FileText, X, Link, Unlink } from 'lucide-react';
import MasterLedgerModal from '../components/MasterLedgerModal';

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'goods_exchange'];

export default function SupplierPaymentHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useApp();
  const { isAdmin } = useAuth();
  const fc = formatCurrency;

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);
  const [history, setHistory] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showMasterLedger, setShowMasterLedger] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [linking, setLinking] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [isFullHistory, setIsFullHistory] = useState(false);

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '' });
  const [collecting, setCollecting] = useState(false);

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await supplierApi.getHistory(id, { all: 'true' });
      setHistory(res.history || []);
      setSupplier(res.supplier || null);
      setTotalPaid(res.totalPaid || 0);
      setTotalPurchases(res.totalPurchases || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (showCollectModal || selectedDelivery) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showCollectModal, selectedDelivery]);

  const buildLedger = () => {
    let sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    let skipIds = new Set();

    // Pass 1: Identify all matching payments for deliveries and tag them to skip
    sortedHistory.forEach(item => {
      if (item.type === 'delivery') {
        let matchingPayments = sortedHistory.filter(p => 
          p.type === 'payment' && 
          !skipIds.has(p._id) &&
          Math.abs(new Date(p.date) - new Date(item.date)) < 120000 // within 2 minutes
        );

        if (matchingPayments.length > 0) {
          item.actual_paid_amount = matchingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          matchingPayments.forEach(p => skipIds.add(p._id));
        }
      }
    });

    // Pass 2: Build mergedItems and calculate true running balance from the ground up
    let mergedItems = [];
    let runningBal = supplier?.balance || 0;
    
    sortedHistory.forEach(item => {
      if (!skipIds.has(item._id)) {
        const invoiceAmt = item.type === 'delivery' ? item.amount : 0;
        let receivedAmt = item.type === 'payment' ? item.amount : 0;
        let discount = 0;
        
        if (item.type === 'delivery' && item.actual_paid_amount !== undefined) {
          receivedAmt = item.actual_paid_amount;
          discount = invoiceAmt - receivedAmt;
          item.ledger_discount = discount;
        }

        let dueChange = invoiceAmt - receivedAmt - discount;
        runningBal += dueChange;

        mergedItems.push({
          ...item,
          invoiceAmt,
          receivedAmt,
          dueChange,
          runningBalance: runningBal
        });
      }
    });

    let items = mergedItems;
    let broughtForward = 0;

    // Filter by Date if needed
    if (!isFullHistory && dateFilter) {
      const beforeFilter = items.filter(item => {
        let dtStr = item.ist_date;
        if (dtStr && dtStr.includes('/')) dtStr = dtStr.split(' ')[0].split('/').reverse().join('-');
        if (!dtStr) {
          const d = new Date(item.date);
          const istD = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
          dtStr = istD.toISOString().slice(0, 10);
        }
        return dtStr < dateFilter;
      });
      
      if (beforeFilter.length > 0) {
        broughtForward = beforeFilter[beforeFilter.length - 1].runningBalance;
      }
      
      items = items.filter(item => {
        let dtStr = item.ist_date;
        if (dtStr && dtStr.includes('/')) dtStr = dtStr.split(' ')[0].split('/').reverse().join('-');
        if (dtStr) return dtStr === dateFilter;
        const d = new Date(item.date);
        const istD = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return istD.toISOString().slice(0, 10) === dateFilter;
      });
    }

    let computedLedger = [];

    // Add Brought Forward row
    if ((!isFullHistory && dateFilter && Math.abs(broughtForward) > 0.01) || (isFullHistory && Math.abs(supplier?.balance || 0) > 0.01)) {
      const openingBalAmount = isFullHistory ? (supplier?.balance || 0) : broughtForward;
      computedLedger.push({
        type: 'opening_balance',
        date: items.length > 0 ? new Date(new Date(items[0].date).getTime() - 1000).toISOString() : new Date().toISOString(),
        _id: 'brought_forward',
        ref: '-',
        notes: openingBalAmount < 0 ? (isFullHistory ? 'Opening Advance' : 'Previous Advance (Brought Forward)') : (isFullHistory ? 'Opening Balance' : 'Previous Balance (Brought Forward)'),
        openingBalance: 0,
        invoiceAmt: openingBalAmount > 0 ? openingBalAmount : 0,
        receivedAmt: openingBalAmount < 0 ? Math.abs(openingBalAmount) : 0,
        dueChange: openingBalAmount,
        runningBalance: openingBalAmount,
        isBroughtForward: true
      });
    }

    items.forEach(item => {
      computedLedger.push(item);
    });

    // Reverse to show newest first
    return computedLedger.reverse();
  };

  const ledger = buildLedger();

  const handleCollect = async (e) => {
    e.preventDefault();
    if (!collectForm.amount || isNaN(collectForm.amount) || Number(collectForm.amount) <= 0) {
      return toast.error('Enter a valid amount');
    }
    setCollecting(true);
    try {
      await settlementApi.create({
        type: 'paid_to_supplier',
        party_name: supplier?.name,
        amount: Number(collectForm.amount),
        mode: collectForm.mode,
        reference: collectForm.reference,
        notes: collectForm.notes
      });
      toast.success('Payment recorded successfully!');
      setShowCollectModal(false);
      setCollectForm({ amount: '', mode: 'cash', reference: '', notes: '' });
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Payment failed');
    } finally {
      setCollecting(false);
    }
  };

  const handleOpenLinkModal = async () => {
    setShowLinkModal(true);
    try {
      const res = await customerApi.getAll();
      setCustomers(res.data || []);
    } catch (e) {
      toast.error('Failed to load customers');
    }
  };

  const handleLinkCustomer = async (customerId) => {
    setLinking(true);
    try {
      await supplierApi.linkCustomer(supplier._id, customerId);
      toast.success('Account linked successfully');
      setShowLinkModal(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to link account');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkCustomer = async () => {
    if (!window.confirm('Are you sure you want to unlink this account?')) return;
    try {
      await supplierApi.unlinkCustomer(supplier._id);
      toast.success('Account unlinked successfully');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to unlink account');
    }
  };

  // True running balance at the end of the selected period (or all time)
  const currentBalance = ledger.length > 0 ? ledger[0].runningBalance : 0;

  return (
    <div style={{ paddingBottom: 60 }}>
      
      {/* ── STANDARD HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back to Suppliers"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, marginTop: '4px' }}>
              <Building2 size={22} className="text-primary" /> {supplier?.name || 'Supplier'} Ledger
            </div>
            <div className="page-subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Ledger statement & payment history
              {supplier?.linked_customer_id ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                  <Link size={12} /> Linked to Customer: {supplier.linked_customer_id.name}
                  <button onClick={handleUnlinkCustomer} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, cursor: 'pointer', color: '#ef4444' }} title="Unlink Account">
                    <Unlink size={12} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: isMobile ? 6 : 12, flexShrink: 0, flexDirection: isMobile ? 'column' : 'row' }}>
          {!supplier?.linked_customer_id && (
            <button 
              className="btn btn-outline" 
              onClick={handleOpenLinkModal}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : undefined, fontSize: isMobile ? 12 : undefined }}
            >
              <Link size={14} /> Link Customer Account
            </button>
          )}
          {supplier?.linked_customer_id && (
            <button 
              className="btn btn-outline" 
              onClick={() => setShowMasterLedger(true)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : undefined, fontSize: isMobile ? 12 : undefined, background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}
            >
              <FileText size={14} /> View Master Ledger
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={() => setShowCollectModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : undefined, fontSize: isMobile ? 12 : undefined }}
          >
            <Wallet size={14} /> Record Payment
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', background: currentBalance < 0 ? '#ecfdf5' : '#fffbeb', border: `1px solid ${currentBalance < 0 ? '#a7f3d0' : '#fde68a'}`, borderLeft: `6px solid ${currentBalance < 0 ? '#10b981' : '#f59e0b'}`, borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Wallet size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {currentBalance < 0 ? 'Advance Paid To Supplier' : 'Total Due To Supplier'}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: currentBalance < 0 ? '#059669' : '#d97706' }}>
            {fc(Math.abs(currentBalance))}
          </div>
        </div>
        
        <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '6px solid #ef4444', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ArrowUpRight size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Paid</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{fc(totalPaid)}</div>
        </div>

        <div style={{ padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '6px solid #3b82f6', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ArrowDownLeft size={18} color="#475569" />
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Purchases</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>{fc(totalPurchases)}</div>
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
                <button onClick={() => setIsFullHistory(true)} className="btn btn-outline btn-sm" style={{ borderRadius: 8, fontWeight: 600 }}>
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
          {loading ? (
            <div className="loading" style={{ padding: 60 }}><span className="spinner"></span></div>
          ) : ledger.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-icon" style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📖</div>
              <div className="empty-text" style={{ fontSize: 16 }}>No transactions found</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>Record a payment or add a delivery to see it here.</div>
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'white', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Details</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goods (₹)</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid (₹)</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, idx) => {
                  const isPayment = row.type === 'payment';
                  const isOpening = row.type === 'opening_balance';
                  const isDelivery = row.type === 'delivery';
                  
                  return (
                    <React.Fragment key={row._id + idx}>
                      <tr 
                        onClick={() => isDelivery && setSelectedDelivery(row)}
                        style={{ 
                          borderBottom: '4px solid #ffffff', 
                          background: isOpening ? '#f8fafc' : isPayment ? '#fef2f2' : isDelivery ? '#f0fdfa' : 'white',
                          cursor: isDelivery ? 'pointer' : 'default',
                          transition: 'background 0.2s'
                        }}
                        className={isDelivery ? "hover-row" : ""}
                      >
                        <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                            {isOpening ? '-' : row.ist_date ? new Date((row.ist_date.includes('/') ? row.ist_date.split(' ')[0].split('/').reverse().join('-') : row.ist_date) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 
                             new Date(row.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          {!isOpening && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                              {row.ist_formatted ? row.ist_formatted.split(' ').slice(1).join(' ') : new Date(row.date || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          {!isOpening && row.created_by && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                              By: {row.created_by.display_name || row.created_by.username || 'Admin'}
                            </div>
                          )}
                        </td>
                        
                        <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ 
                              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              background: isOpening ? '#e2e8f0' : isPayment ? '#fee2e2' : (row.actual_paid_amount !== undefined ? '#dcfce7' : '#ccfbf1'),
                              color: isOpening ? '#64748b' : isPayment ? '#ef4444' : (row.actual_paid_amount !== undefined ? '#15803d' : '#0f766e')
                            }}>
                              {isOpening ? <Clock size={16} /> : isPayment ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: isOpening ? '#64748b' : 'var(--text)' }}>
                                {isOpening ? row.notes : isPayment ? `Payment via ${(row.mode||'').toUpperCase()}` : (row.actual_paid_amount !== undefined ? `Goods Received & Paid` : 'Goods Received')}
                              </div>
                              
                              {!isOpening && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {isPayment && row.notes && <div>{row.notes}</div>}
                                  {isDelivery && row.notes && <div>Ref: {row.notes}</div>}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, color: isDelivery ? '#0f766e' : 'var(--text-muted)', fontSize: 15 }}>
                          {isOpening ? '-' : row.invoiceAmt > 0 ? fc(row.invoiceAmt) : '-'}
                        </td>
                        
                        <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, color: isPayment ? '#ef4444' : 'var(--text-muted)', fontSize: 15 }}>
                          {isOpening ? '-' : row.receivedAmt > 0 ? fc(row.receivedAmt) : '-'}
                          {row.ledger_discount > 0 && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>+ {fc(row.ledger_discount)} Negotiated</div>}
                        </td>
                        
                        <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 800, color: row.runningBalance > 0 ? '#b45309' : row.runningBalance < 0 ? '#16a34a' : 'var(--text)', fontSize: 15 }}>
                          {row.runningBalance !== 0 ? fc(Math.abs(row.runningBalance)) : '₹0.00'}
                          {row.runningBalance < 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginTop: 4, letterSpacing: '0.5px' }}>ADVANCE</div>}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── DELIVERY MODAL ── */}
      {selectedDelivery && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedDelivery(null)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 600, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ width: 48, height: 48, background: '#e0f2fe', color: '#0284c7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 4px 6px -1px rgba(2,132,199,0.1)' }}>
                  <FileText size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Itemized Goods Breakdown</h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                  {selectedDelivery.notes}
                </p>
              </div>
              <button onClick={() => setSelectedDelivery(null)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '0', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 }}>Item</th>
                    <th style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 }}>Qty</th>
                    <th style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 }}>Rate</th>
                    <th style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDelivery.items?.map((item, i) => {
                    const total = item.final_price || (item.quantity * item.base_price) || 0;
                    return (
                      <tr key={i} style={{ borderBottom: i === selectedDelivery.items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px 24px', fontWeight: 600, color: '#1e293b' }}>{item.item_name}</td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{item.quantity} {item.unit}</td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{fc(item.base_price || 0)}</td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fc(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
               <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginRight: 16 }}>Total Amount:</div>
               <div style={{ fontSize: 20, fontWeight: 800, color: '#0f766e' }}>{fc(selectedDelivery.amount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ── */}
      {showCollectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCollectModal(false)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ width: 48, height: 48, background: '#fee2e2', color: '#ef4444', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 4px 6px -1px rgba(239,68,68,0.1)' }}>
                  <Wallet size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Record Payment</h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                  Paying {supplier?.name}
                </p>
              </div>
              <button onClick={() => setShowCollectModal(false)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <form id="collectForm" onSubmit={handleCollect}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {PAYMENT_MODES.map(mode => (
                      <div 
                        key={mode} 
                        onClick={() => setCollectForm({ ...collectForm, mode })}
                        style={{ 
                          padding: '12px', border: `2px solid ${collectForm.mode === mode ? '#ef4444' : '#e2e8f0'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontWeight: 600, fontSize: 14, color: collectForm.mode === mode ? '#ef4444' : '#64748b', background: collectForm.mode === mode ? '#fef2f2' : 'white', transition: 'all 0.2s' 
                        }}
                      >
                        {mode.toUpperCase().replace('_', ' ')}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Paid *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#ef4444', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      required
                      value={collectForm.amount}
                      onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })}
                      style={{ width: '100%', padding: '16px 16px 16px 40px', fontSize: 24, fontWeight: 800, border: '2px solid #e2e8f0', borderRadius: 12, outline: 'none', color: '#0f172a', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      placeholder="0.00"
                    />
                  </div>
                  {currentBalance > 0 && (
                     <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                       <span>Total Due: <strong style={{ color: '#b45309' }}>{fc(currentBalance)}</strong></span>
                       <span style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600 }} onClick={() => setCollectForm({ ...collectForm, amount: currentBalance })}>
                         Pay Full Amount
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
                style={{ flex: 2, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15, background: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {collecting ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Wallet size={18} />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LINK CUSTOMER MODAL ── */}
      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLinkModal(false)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ width: 48, height: 48, background: '#e0e7ff', color: '#4f46e5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 4px 6px -1px rgba(79,70,229,0.1)' }}>
                  <Link size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Link Customer Account</h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                  Select a customer to link with {supplier?.name}. Goods exchanged will automatically reflect in both ledgers.
                </p>
              </div>
              <button onClick={() => setShowLinkModal(false)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {customers.map(c => (
                  <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{c.phone || 'No phone'}</div>
                    </div>
                    <button 
                      onClick={() => handleLinkCustomer(c._id)}
                      disabled={linking}
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#4f46e5', borderColor: '#4f46e5' }}
                    >
                      {linking ? 'Linking...' : 'Link'}
                    </button>
                  </div>
                ))}
                {customers.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>No customers found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-row:hover td {
          background-color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
