import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { supplierApi, settlementApi, customerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { ArrowLeft, Calendar, CreditCard, Building2, Wallet, ArrowDownLeft, ArrowUpRight, Clock, FileText, X, Link, Unlink, PackagePlus, Package, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import RecordSupplierEntryModal from '../components/RecordSupplierEntryModal';

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'goods_exchange'];

export default function SupplierPaymentHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'supervisor';
  const fc = formatCurrency;

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linking, setLinking] = useState(false);
  const [mergeSelected, setMergeSelected] = useState([]);
  const [merging, setMerging] = useState(false);

  const [ledger, setLedger] = useState([]);
  const [summaryData, setSummaryData] = useState({ totalDue: 0, totalAdvance: 0, totalPaid: 0, totalPurchases: 0, currentBalance: 0 });

  const todayStr = new Date().toLocaleDateString('en-CA');
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [isFullHistory, setIsFullHistory] = useState(false);

  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', mode: 'cash', reference: '', notes: '' });
  const [collecting, setCollecting] = useState(false);

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [breakdownModalData, setBreakdownModalData] = useState(null);
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
      const res = await supplierApi.getLedger(id, params);
      setSupplier(res.supplier || null);
      setLedger(res.ledger || []);
      setSummaryData(res.summary || { totalDue: 0, totalAdvance: 0, totalPaid: 0, totalPurchases: 0, currentBalance: 0 });
      setTotalPaid(res.totalPaid || 0);
      setTotalPurchases(res.totalPurchases || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id, dateFilter, isFullHistory]);

  useEffect(() => {
    if (showCollectModal || showEntryModal || selectedDelivery) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showCollectModal, showEntryModal, selectedDelivery]);

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
      setCustomers(Array.isArray(res) ? res : (res.data || []));
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

  const toggleMergeSelect = (id) => {
    setMergeSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleMultiLink = async () => {
    if (mergeSelected.length === 0) {
      toast.error('Select at least 1 customer to link');
      return;
    }
    
    setMerging(true);
    try {
      await supplierApi.linkCustomer(supplier._id, { customer_ids: mergeSelected });
      toast.success('Accounts linked successfully');
      setShowLinkModal(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to link customers');
    } finally {
      setMerging(false);
    }
  };

  const handleUnlinkCustomer = async () => {
    try {
      await supplierApi.unlinkCustomer(supplier._id);
      toast.success('Account unlinked successfully');
      setShowUnlinkConfirm(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to unlink account');
    }
  };

  // Current balance from the server-computed summary
  const currentBalance = summaryData.currentBalance || 0;

  const adjustedTotalPurchases = totalPurchases + (supplier?.balance > 0 ? supplier.balance : 0);
  const adjustedTotalPaid = totalPaid + (supplier?.balance < 0 ? Math.abs(supplier.balance) : 0);


  const getSupplierPhones = () => {
    const phones = [];
    if (supplier?.phone) phones.push(supplier.phone);
    if (supplier?.contact_numbers) supplier.contact_numbers.forEach(cn => { if (cn.number) phones.push(cn.number) });
    return phones;
  };

  const isSuggested = (c) => {
    const sName = (supplier?.name || '').toLowerCase().trim();
    const cName = (c.name || '').toLowerCase().trim();
    if (sName && cName && (sName.includes(cName) || cName.includes(sName))) return true;

    const sPhones = getSupplierPhones();
    const cPhones = [];
    if (c.phone) cPhones.push(c.phone);
    if (c.alternate_phones) c.alternate_phones.forEach(p => { if(p) cPhones.push(p) });
    
    if (sPhones.some(sp => cPhones.includes(sp))) return true;

    return false;
  };

  const filteredCustomers = customers.filter(c => {
    const isAlreadyLinked = supplier?.linked_customer_ids?.some(linked => linked._id === c._id || linked === c._id);
    if (isAlreadyLinked) return false;
    
    return c.name?.toLowerCase().includes(linkSearchQuery.toLowerCase()) || 
           c.phone?.includes(linkSearchQuery);
  });

  const suggestedCustomers = filteredCustomers.filter(isSuggested);
  const otherCustomers = filteredCustomers.filter(c => !isSuggested(c));

  return (
    <div style={{ paddingBottom: 60 }}>
      
      {/* ── STANDARD HEADER ── */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: isMobile ? '8px' : '16px', marginBottom: isMobile ? '12px' : '24px' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: isMobile ? '100%' : 'auto' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Back to Suppliers"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Building2 size={22} className="text-primary" /> {supplier?.name || 'Supplier'} Ledger
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Ledger statement & payment history</div>
            {supplier?.linked_customer_ids?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', alignItems: 'center', gap: 6, overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: isMobile ? 4 : 0, maxWidth: '100%', marginTop: 4 }}>
                {isAdmin && (
                <button onClick={handleOpenLinkModal} style={{ background: '#f3e8ff', border: '1px dashed #d8b4fe', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7e22ce', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }} title="Link Another Customer">
                  <Plus size={14} />
                </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontSize: 12, fontWeight: 700, background: '#e0e7ff', padding: '4px 10px', borderRadius: 12, flexShrink: 0 }}>
                  <Link size={12} /> Linked to:
                </div>
                {supplier.linked_customer_ids.map(c => (
                  <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #e0e7ff', color: '#334155', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                    {c.name}
                    <span style={{ color: '#4f46e5', fontSize: 10, background: '#eff6ff', padding: '2px 6px', borderRadius: 10, marginLeft: 2 }}>
                      {c.created_by?.display_name || c.created_by?.username || 'Admin'}
                    </span>
                  </div>
                ))}
                {isAdmin && (
                <button onClick={() => setShowUnlinkConfirm(true)} style={{ background: '#fee2e2', border: '1px solid #fecaca', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }} title="Unlink Account">
                  <Unlink size={12} />
                </button>
                )}
              </div>
            )}
          </div>
          {isMobile && isAdmin && (!supplier?.linked_customer_ids || supplier.linked_customer_ids.length === 0) && (
            <button onClick={handleOpenLinkModal} style={{ background: '#f3e8ff', border: '1px dashed #d8b4fe', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7e22ce', transition: 'all 0.2s', flexShrink: 0, marginLeft: 'auto' }} title="Link Customer Account">
              <Link size={15} />
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', overflowX: isMobile ? 'visible' : 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', gap: isMobile ? 8 : 12, alignItems: 'center', flexShrink: 0, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-start' : 'flex-end', paddingBottom: 4 }}>
          {isAdmin && (!supplier?.linked_customer_ids || supplier.linked_customer_ids.length === 0) && !isMobile && (
            <button 
              className="btn" 
              onClick={handleOpenLinkModal}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : '8px 14px', fontSize: isMobile ? 12 : 13, background: '#f3e8ff', border: '1px dashed #d8b4fe', color: '#7e22ce', width: 'auto', fontWeight: 600, flexShrink: 0 }}
            >
              <Link size={14} /> Link Customer Account
            </button>
          )}
          <button 
            className="btn" 
            onClick={() => setShowEntryModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : '8px 14px', fontSize: isMobile ? 12 : 13, background: '#dbeafe', border: '1px solid #93c5fd', color: '#1d4ed8', width: isMobile ? '100%' : 'auto', fontWeight: 600, flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto' }}
          >
            <PackagePlus size={14} /> Record Entry
          </button>
          <button 
            className="btn" 
            onClick={() => setShowCollectModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : '8px 14px', fontSize: isMobile ? 12 : 13, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', width: isMobile ? '100%' : 'auto', fontWeight: 600, flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto' }}
          >
            <Wallet size={14} /> Record Payment
          </button>
          {isAdmin && supplier?.linked_customer_ids?.length > 0 && (
            <button 
              className="btn" 
              onClick={() => navigate(`/suppliers/${supplier._id}/master-ledger`)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, padding: isMobile ? '6px 10px' : '8px 14px', fontSize: isMobile ? 12 : 13, background: '#ffedd5', border: '1px solid #fdba74', color: '#c2410c', width: isMobile ? '100%' : 'auto', fontWeight: 600, flex: isMobile ? '1 1 100%' : '0 0 auto' }}
            >
              <FileText size={14} /> View Master Ledger
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 24 }}>
        
        {/* 1. Total Purchase Value Card */}
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowDownLeft size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Total Purchase Value</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{fc(adjustedTotalPurchases)}</div>
        </div>

        {/* 2. Total Paid Till Now Card */}
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#ccfbf1', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowUpRight size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Total Paid Till Now</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{fc(adjustedTotalPaid)}</div>
        </div>

        {/* 3. Dynamic Balance Card (Outstanding/Advance) */}
        {currentBalance < 0 ? (
          <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
              <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <CreditCard size={isMobile ? 14 : 18} />
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Advance Paid</div>
            </div>
            <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>{fc(Math.abs(currentBalance))}</div>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
              <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Wallet size={isMobile ? 14 : 18} />
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Remaining Amount Due</div>
            </div>
            <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.5px' }}>{fc(Math.abs(currentBalance))}</div>
          </div>
        )}
        {/* 4. Ledger Date Filter Card */}
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Clock size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>{isFullHistory ? 'Ledger Statement' : 'Ledger for Date'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            {!isFullHistory ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flex: 1, minWidth: 0 }}>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: isMobile ? 11 : 13.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, color: 'var(--text)', width: '100%', minWidth: 0 }}
                  />
                </div>
                <button onClick={() => setIsFullHistory(true)} className="btn btn-outline btn-sm" style={{ borderRadius: 8, fontWeight: 600, fontSize: isMobile ? 11 : 12, padding: isMobile ? '4px 8px' : '6px 12px' }}>
                  Full History
                </button>
              </>
            ) : (
              <button onClick={() => { setIsFullHistory(false); if (!dateFilter) setDateFilter(todayStr); }} className="btn btn-outline btn-sm" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, background: 'white', fontSize: isMobile ? 11 : 12 }}>
                <Calendar size={14} /> View Today
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── LEDGER CARD ── */}
      <div className="card" style={{ overflow: 'hidden' }}>

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
            <table style={{ width: '100%', minWidth: isMobile ? '100%' : 800, borderCollapse: 'collapse' }}>
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
                  
                  let rowBg = 'white';
                  let hoverBg = '#f8fafc';
                  let iconBg = '';
                  let iconColor = '';
                  let detailText = '';
                  
                  if (isOpening) {
                    iconBg = '#e2e8f0'; iconColor = '#64748b';
                    detailText = row.notes;
                  } else if (isPayment) {
                    iconBg = '#fee2e2'; iconColor = '#ef4444';
                    detailText = `Payment via ${(row.mode||'').toUpperCase()}`;
                    rowBg = '#fff5f5'; // very dim red
                    hoverBg = '#fee2e2';
                  } else if (isDelivery) {
                    const isFullyPaid = ((row.receivedAmt || 0) + (row.ledger_discount || 0)) >= (row.invoiceAmt || 0) && (row.invoiceAmt > 0 || row.receivedAmt > 0);
                    const isPartiallyPaid = (row.receivedAmt || 0) > 0 && !isFullyPaid;
                    
                    if (isFullyPaid) {
                      iconBg = '#dcfce7'; iconColor = '#15803d'; 
                      detailText = 'Goods Received & Paid';
                      rowBg = '#f0fdf4'; // very dim green
                      hoverBg = '#dcfce7';
                    } else {
                      iconBg = '#e0f2fe'; iconColor = '#0369a1'; 
                      detailText = 'Goods Received (Due)';
                      rowBg = '#f0f9ff'; // very dim blue
                      hoverBg = '#e0f2fe';
                    }
                  }

                  return (
                    <React.Fragment key={row._id + idx}>
                      <tr 
                        onClick={() => isDelivery && setBreakdownModalData(row)}
                        style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          background: rowBg,
                          cursor: isDelivery ? 'pointer' : 'default',
                          transition: 'background 0.2s'
                        }}
                        className={isDelivery ? "hover-row" : ""}
                        onMouseEnter={e => { if(isDelivery) e.currentTarget.style.background = hoverBg }}
                        onMouseLeave={e => { if(isDelivery) e.currentTarget.style.background = rowBg }}
                      >
                        <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                            {row.ist_date ? new Date((row.ist_date.includes('/') ? row.ist_date.split(' ')[0].split('/').reverse().join('-') : row.ist_date) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 
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
                              background: iconBg,
                              color: iconColor
                            }}>
                              {isOpening ? <Clock size={16} /> : isPayment ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: isOpening ? '#64748b' : 'var(--text)' }}>
                                {detailText}
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
                          {row.runningBalance !== 0 ? fc(-row.runningBalance) : '₹0.00'}
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



      {/* ── BREAKDOWN MODAL ── */}
      {breakdownModalData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setBreakdownModalData(null)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 600, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 18, color: '#0f172a' }}>
                  <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', background: '#e0f2fe', padding: 8, borderRadius: 8 }}>
                    <Package size={20} />
                  </span>
                  <span>Itemized Goods Breakdown</span>
                </div>
              </div>
              <button onClick={() => setBreakdownModalData(null)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes / Info</span>
                  <span style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{breakdownModalData.notes || 'No extra notes provided'}</span>
                </div>
                <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Recorded by:</span>
                  <span style={{ color: '#4f46e5', fontWeight: 700 }}>{breakdownModalData.created_by?.display_name || breakdownModalData.created_by?.username || 'Admin'}</span>
                </div>
              </div>
              <table style={{ width: '100%', background: 'white', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 700 }}>Item</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#475569', fontWeight: 700 }}>Qty</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#475569', fontWeight: 700 }}>Base Rate</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: '#475569', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownModalData.items?.map((item, i) => {
                    const baseRate = item.base_price || item.price || 0;
                    const total = item.quantity * baseRate;
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>{item.item_name || item.product_id?.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{item.quantity} <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.unit || 'pcs'}</span></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{fc(baseRate)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fc(total)}</td>
                      </tr>
                    );
                  })}
                  
                  {(() => {
                    const totalBaseValue = breakdownModalData.items?.reduce((sum, item) => sum + (item.quantity * (item.base_price || item.price || 0)), 0) || 0;
                    const totalExtraCharges = breakdownModalData.items?.reduce((sum, item) => sum + (item.quantity * (item.supplier_charge_per_item || 0)), 0) || 0;
                    const finalGoodsValue = breakdownModalData.grand_total || breakdownModalData.amount || breakdownModalData.total_amount || (totalBaseValue + totalExtraCharges);
                    const totalVehicleCharges = finalGoodsValue - totalBaseValue - totalExtraCharges;
                    
                    return (
                      <>
                        <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                          <td colSpan={3} style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}>Total Base Value:</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 13 }}>{fc(totalBaseValue)}</td>
                        </tr>
                        {totalExtraCharges > 0 && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}>Total Extra Charges:</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 13 }}>{fc(totalExtraCharges)}</td>
                          </tr>
                        )}
                        {Math.abs(totalVehicleCharges) > 0.01 && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}>Vehicle Charge (Quintal/Custom):</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 13 }}>{totalVehicleCharges > 0 ? '+' : ''}{fc(totalVehicleCharges)}</td>
                          </tr>
                        )}
                        <tr style={{ background: '#f1f5f9' }}>
                          <td colSpan={3} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#334155', textTransform: 'uppercase', borderTop: '1px solid #e2e8f0' }}>Final Goods Value:</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 15, borderTop: '1px solid #e2e8f0' }}>{fc(finalGoodsValue)}</td>
                        </tr>
                      </>
                    );
                  })()}

                  {breakdownModalData.actual_paid_amount > 0 && (
                    <tr style={{ background: '#ecfdf5', borderTop: '2px solid #a7f3d0' }}>
                      <td colSpan={3} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Advance Paid by Vehicle (Driver):</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: 14 }}>{fc(breakdownModalData.actual_paid_amount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
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

      {/* ── RECORD ENTRY MODAL ── */}
      {showEntryModal && (
        <RecordSupplierEntryModal 
          supplier={supplier} 
          onClose={() => setShowEntryModal(false)} 
          onSuccess={loadData} 
        />
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
              <div style={{ marginBottom: 16 }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search by name or phone..." 
                  value={linkSearchQuery} 
                  onChange={e => setLinkSearchQuery(e.target.value)} 
                  style={{ borderRadius: 8 }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestedCustomers.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 8 }}>Suggested Matches</div>
                    {suggestedCustomers.map(c => (
                      <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '2px solid #e0e7ff', background: mergeSelected.includes(c._id) ? '#eff6ff' : '#f8fafc', borderRadius: 12, cursor: 'pointer' }} onClick={() => toggleMergeSelect(c._id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <input 
                            type="checkbox" 
                            checked={mergeSelected.includes(c._id)} 
                            readOnly
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {c.name} 
                              <span style={{ fontSize: 11, background: '#e0e7ff', color: '#4f46e5', padding: '2px 6px', borderRadius: 6 }}>Suggested</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{c.phone || 'No phone'}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>By: {c.created_by?.display_name || c.created_by?.username || 'Admin'}</div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleLinkCustomer(c._id); }}
                          disabled={linking || merging}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                        >
                          {linking ? '...' : 'Link'}
                        </button>
                      </div>
                    ))}
                    {mergeSelected.length > 0 && (
                      <button 
                        onClick={handleMultiLink}
                        disabled={merging || linking}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', borderRadius: 12, fontWeight: 700, marginTop: 8 }}
                      >
                        {merging ? 'Linking...' : `Link ${mergeSelected.length} Selected Account${mergeSelected.length > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </>
                )}

                {otherCustomers.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: suggestedCustomers.length > 0 ? 16 : 8 }}>All Customers</div>
                    {otherCustomers.map(c => (
                      <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{c.name}</div>
                          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{c.phone || 'No phone'}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>By: {c.created_by?.display_name || c.created_by?.username || 'Admin'}</div>
                        </div>
                        <button 
                          onClick={() => handleLinkCustomer(c._id)}
                          disabled={linking || merging}
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#4f46e5', borderColor: '#4f46e5' }}
                        >
                          {linking ? '...' : 'Link'}
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {filteredCustomers.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>No customers found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UNLINK CONFIRMATION MODAL ── */}
      {showUnlinkConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowUnlinkConfirm(false)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Unlink size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Unlink Account?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>
              Are you sure you want to unlink this account? Goods exchanged will no longer automatically reflect in both ledgers.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowUnlinkConfirm(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleUnlinkCustomer}
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600, background: '#ef4444', borderColor: '#ef4444' }}
              >
                Yes, Unlink
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS EXCLUDED */}

      <style>{`
        .hover-row:hover td {
          background-color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
