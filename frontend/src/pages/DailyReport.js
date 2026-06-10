import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { dashboardApi, invoiceApi, deliveryApi, settlementApi, dailyReportApi, customerApi, supplierApi, productApi, managerApi, walkinApi } from '../utils/api';
import { Moon, Send, Plus, CheckCircle, AlertTriangle, DollarSign, FileText, Truck, X, ChevronDown, ChevronUp, Clock, Package, Users, Building2, TrendingUp, Loader, Coffee, CreditCard, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

// Helper: get today's date in IST as YYYY-MM-DD
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().slice(0, 10);
}

export default function DailyReport() {
  const location = useLocation();
  const { user, isAdmin, socket } = useAuth();
  const { t } = useApp();
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingReport, setExistingReport] = useState(null);
  const [submitConfirmMethod, setSubmitConfirmMethod] = useState(''); // 'cash', 'upi', 'credit', 'later'

  const [requestingTrip, setRequestingTrip] = useState(false);
  const [pendingTripRequest, setPendingTripRequest] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // System summary data
  const [dashData, setDashData] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [settlements, setSettlements] = useState([]);

  // Local storage helpers to persist form data if user navigates away
  const getInitialState = (key, defaultVal) => {
    try {
      // Add a fallback for user?._id to prevent crashes if it's somehow missing on first render
      const userKey = user?._id || 'unknown';
      const stored = localStorage.getItem(`mk_report_${userKey}_${key}`);
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return defaultVal;
  };

  // Quick entry form
  const [quickEntries, setQuickEntries] = useState(() => getInitialState('entries', []));
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickFormType, setQuickFormType] = useState('bill');
  const [quickForm, setQuickForm] = useState({ customer_name: '', supplier_name: '', expense_for: '', expense_category: 'Fuel', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });

  // Reconciliation
  const [actualCash, setActualCash] = useState(() => getInitialState('cash', ''));
  const [discrepancyNotes, setDiscrepancyNotes] = useState(() => getInitialState('notes', ''));
  const [openingBalance, setOpeningBalance] = useState(0);
  const [walkinProducts, setWalkinProducts] = useState([]);
  
  // Previous reports summary for multiple trips
  const [prevReportsSum, setPrevReportsSum] = useState({ sales: 0, received: 0, debt: 0, bills: 0, deliveries: 0, settlementExpenses: 0, settlementIncome: 0 });

  // Sync to local storage
  useEffect(() => { 
    if(user?._id) localStorage.setItem(`mk_report_${user._id}_entries`, JSON.stringify(quickEntries)); 
  }, [quickEntries, user?._id]);
  
  useEffect(() => { 
    if(user?._id) localStorage.setItem(`mk_report_${user._id}_cash`, JSON.stringify(actualCash)); 
  }, [actualCash, user?._id]);
  
  useEffect(() => { 
    if(user?._id) localStorage.setItem(`mk_report_${user._id}_notes`, JSON.stringify(discrepancyNotes)); 
  }, [discrepancyNotes, user?._id]);

  // Suggestions
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);

  // Admin view
  const [adminSelectedDate, setAdminSelectedDate] = useState(getTodayIST());
  const [allReports, setAllReports] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  const [managerSelectedDate, setManagerSelectedDate] = useState(getTodayIST());
  const today = managerSelectedDate; // Keep variable name "today" to avoid renaming everywhere

  const loadData = useCallback(async () => {
    setLoading(true);
    setSubmitted(false);
    setExistingReport(null);
    try {
      let currentIsTripActive = user?.is_trip_active;
      if (user?.role === 'walkin_manager') {
        try {
          const me = await authApi.me();
          currentIsTripActive = me.is_trip_active;
        } catch(e) {}
      }

      const allMyReports = await dailyReportApi.getAll();
      const todaysReports = Array.isArray(allMyReports) ? allMyReports.filter(r => r.date === today || r.date.startsWith(today + '_')) : [];
      const myReport = todaysReports.length > 0 ? todaysReports[todaysReports.length - 1] : null;
      if (myReport && !(user?.role === 'walkin_manager' && currentIsTripActive)) {
        setExistingReport(myReport);
        setSubmitted(true);
      }

      // Find the most recent report before today for the opening balance
      if (Array.isArray(allMyReports)) {
        if (user?.role === 'walkin_manager') {
          // Walkin managers always start a new day/trip with 0 cash balance
          setOpeningBalance(0);
        } else {
          const pastReports = allMyReports.filter(r => r.date < today);
          if (pastReports.length > 0) {
            setOpeningBalance(pastReports[0].actual_cash_reported || 0);
          }
        }

        // Calculate sums from previous reports for TODAY (for multiple trips)
        if (user?.role === 'walkin_manager' && currentIsTripActive) {
          const todaysReports = allMyReports.filter(r => r.date === today || r.date.startsWith(today + '_'));
          let pSum = { sales: 0, received: 0, debt: 0, bills: 0, deliveries: 0, settlementExpenses: 0, settlementIncome: 0 };
          todaysReports.forEach(r => {
            pSum.sales += (r.system_sales_reported || 0);
            pSum.received += (r.system_money_received || 0);
            pSum.debt += (r.system_debt_reported || 0);
            pSum.bills += (r.system_bills_reported || 0);
            pSum.deliveries += (r.system_deliveries_reported || 0);
            pSum.settlementExpenses += (r.system_expenses_reported || 0);
          });
          setPrevReportsSum(pSum);
        } else {
          setPrevReportsSum({ sales: 0, received: 0, debt: 0, bills: 0, deliveries: 0, settlementExpenses: 0, settlementIncome: 0 });
        }
      }

      // Load dashboard data for system summary
      const dash = await dashboardApi.get(today);
      setDashData(dash?.data || dash);

      // Load today's deliveries
      const dels = await deliveryApi.getAll({ date: today });
      setDeliveries(Array.isArray(dels) ? dels : []);

      // Load today's settlements
      const setts = await settlementApi.get({ date: today });
      setSettlements(setts.settlements || []);

      if (user?.role === 'walkin_manager') {
        try {
          const prods = await productApi.getAll();
          setWalkinProducts(Array.isArray(prods) ? prods.filter(p => p.stock > 0) : []);
          
          if (user?.is_trip_active) {
            const tripRes = await walkinApi.getActiveTrip();
            if (tripRes && tripRes.pending_request) {
              setPendingTripRequest(true);
            }
          }
        } catch (e) { console.error('Failed to load walkin data', e); }
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Admin: load all reports and merge with managers
  const loadAdminReports = useCallback(async () => {
    setAdminLoading(true);
    try {
      const [reports, managersRes, activeTripsRes] = await Promise.all([
        dailyReportApi.getAll({ date: adminSelectedDate }),
        managerApi.getAll(),
        walkinApi.allActiveTrips().catch(() => ({ trips: [] })) // Fetch active walkin trips
      ]);
      const activeManagers = Array.isArray(managersRes) ? managersRes : (managersRes?.managers || []);
      const loadedReports = Array.isArray(reports) ? reports : [];
      const activeTrips = Array.isArray(activeTripsRes?.trips) ? activeTripsRes.trips : [];
      
      const combined = activeManagers.map(m => {
        const found = loadedReports.find(r => r.manager_id === m._id);
        if (found) return found;
        
        // If no report submitted yet, check if there's an active trip
        const activeTrip = activeTrips.find(t => t.manager_id === m._id);
        
        return {
          _id: 'pending-' + m._id,
          manager_id: m._id,
          manager_name: m.display_name || m.username,
          date: adminSelectedDate,
          status: 'pending_submission',
          // If active trip exists, inject the initial_load so Admin can see it immediately
          walkin_trip_summary: activeTrip ? { initial_load: activeTrip.initial_stock } : null
        };
      });

      setAllReports(combined);
    } catch (err) {
      console.error('Failed to load admin reports:', err);
    } finally {
      setAdminLoading(false);
    }
  }, [adminSelectedDate]);

  const refreshPage = useCallback(() => {
    loadData();
    if (isAdmin) loadAdminReports();
  }, [loadData, isAdmin, loadAdminReports]);
  useRegisterRefresh(refreshPage);

  useEffect(() => {
    if (isAdmin) loadAdminReports();
  }, [isAdmin, loadAdminReports]);

  // Auto-refresh when a manager submits a report (real-time via socket)
  useEffect(() => {
    if (!isAdmin || !socket) return;
    const handleReportSubmitted = () => {
      loadAdminReports();
    };
    socket.on('report_submitted', handleReportSubmitted);
    return () => socket.off('report_submitted', handleReportSubmitted);
  }, [isAdmin, socket, loadAdminReports]);

  useEffect(() => {
    if (isAdmin && allReports.length > 0 && location.state?.openReportId) {
      setExpandedReport(location.state.openReportId);
    }
  }, [isAdmin, allReports, location.state]);

  // ─── CALCULATE SUMMARY STATS ───
  const baseSales = Math.max(0, (dashData?.todaySales || 0) - prevReportsSum.sales);
  const moneyReceivedFromSales = Math.max(0, (dashData?.statementData?.totalReceived || 0) - prevReportsSum.received); // We will adjust total later
  const todayDebt = Math.max(0, baseSales - moneyReceivedFromSales);
  const totalBills = Math.max(0, (dashData?.todayCount || 0) - prevReportsSum.bills);
  const totalDeliveries = Math.max(0, deliveries.filter(d => d.status === 'delivered').length - prevReportsSum.deliveries);
  const totalSettlements = settlements.length;
  
  const settlementExpenses = Math.max(0, settlements.filter(s => ['paid_to_supplier', 'other_expense', 'vehicle_expense'].includes(s.type)).reduce((sum, s) => sum + s.amount, 0) - prevReportsSum.settlementExpenses);
  
  // Expenses from Quick Catch-up
  const quickExpenses = quickEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const quickVehicleExpenses = quickEntries.filter(e => e.type === 'vehicle_expense').reduce((sum, e) => sum + e.amount, 0);
  const quickPaidOut = quickEntries.filter(e => e.type === 'payment_out').reduce((sum, e) => sum + e.amount, 0);

  const totalExpenses = quickExpenses + quickVehicleExpenses;
  const totalPaidOut = settlementExpenses + quickPaidOut;

  // Income from Quick Catch-up
  const quickIncome = quickEntries.filter(e => e.type === 'payment_in' || e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);

  // Income from formal Settlements (e.g. collecting past due cash, advance, old invoice paid)
  // We approximate the previous trip's settlement income by seeing how much was subtracted from total money received
  const prevSettlementIncome = Math.max(0, prevReportsSum.received - prevReportsSum.sales);
  const settlementIncome = Math.max(0, settlements.filter(s => ['other_income', 'by_invoice', 'due_cleared', 'advance_received', 'received_from_customer'].includes(s.type)).reduce((sum, s) => sum + s.amount, 0) - prevSettlementIncome);

  const totalMoneyReceived = moneyReceivedFromSales + settlementIncome + quickIncome;

  // Net Total = Opening Balance + Total Money Received - (Total Paid Out + Total Expenses)
  const systemCash = openingBalance + totalMoneyReceived - (totalPaidOut + totalExpenses);

  const cashDifference = actualCash !== '' ? parseFloat(actualCash) - systemCash : 0;

  // Quick entry handlers
  const addQuickEntry = () => {
    let custName = quickForm.customer_name.trim();

    if (quickFormType === 'bill' && !custName) {
      if (quickForm.is_paid !== false) {
        custName = 'Anonymous Customer';
      } else {
        return toast.error('Customer name required for unpaid bills');
      }
    }
    
    if (quickFormType === 'payment_in' && !custName) return toast.error(t('Customer name required', 'ग्राहक का नाम आवश्यक है'));
    if (quickFormType === 'payment_out' && !quickForm.supplier_name.trim()) return toast.error(t('Supplier name required', 'आपूर्तिकर्ता का नाम आवश्यक है'));
    if (quickFormType === 'expense' && !quickForm.expense_for.trim()) return toast.error(t('Expense details required', 'खर्च का विवरण आवश्यक है'));
    if (quickFormType === 'vehicle_expense') {
      if (quickForm.expense_category !== 'Other' && !quickForm.expense_for.trim()) return toast.error(t('Vehicle expense details required', 'वाहन खर्च का विवरण आवश्यक है'));
      if (quickForm.expense_category === 'Other' && !quickForm.notes.trim()) return setValidationError('Please write a note for Other expenses');
    }
    if (quickForm.amount <= 0) return toast.error(t('Amount must be greater than 0', 'राशि 0 से अधिक होनी चाहिए'));

    setQuickEntries(prev => [...prev, {
      type: quickFormType,
      customer_name: custName,
      supplier_name: quickForm.supplier_name.trim(),
      expense_for: quickFormType === 'vehicle_expense' ? `[Vehicle - ${quickForm.expense_category}] ${quickForm.expense_category === 'Other' ? '' : quickForm.expense_for.trim()}` : quickForm.expense_for.trim(),
      product_name: quickForm.product_name.trim(),
      quantity: parseFloat(quickForm.quantity) || 1,
      amount: parseFloat(quickForm.amount) || 0,
      notes: quickForm.notes.trim(),
      is_paid: quickForm.is_paid !== false, // default to true
    }]);
    setQuickForm({ customer_name: '', supplier_name: '', expense_for: '', expense_category: 'Fuel', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });
    setShowQuickForm(false);
    toast.success('Entry added to report');
  };

  const removeQuickEntry = (idx) => {
    setQuickEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // Search suggestions
  const searchCustomers = async (q) => {
    if (!q || q.length < 2) { setCustomerSuggestions([]); return; }
    try {
      const res = await customerApi.getAll({ search: q, limit: 5 });
      setCustomerSuggestions(Array.isArray(res) ? res : res?.customers || []);
    } catch { setCustomerSuggestions([]); }
  };

  const searchSuppliers = async (q) => {
    if (!q || q.length < 2) { setSupplierSuggestions([]); return; }
    try {
      const res = await supplierApi.getAll(q);
      setSupplierSuggestions(Array.isArray(res) ? res.slice(0, 5) : []);
    } catch { setSupplierSuggestions([]); }
  };

  const searchProducts = async (q) => {
    if (!q || q.length < 2) { setProductSuggestions([]); return; }
    try {
      const res = await productApi.autocomplete(q);
      setProductSuggestions(Array.isArray(res) ? res.slice(0, 5) : []);
    } catch { setProductSuggestions([]); }
  };

  const handleSubmit = () => {
    if (user?.role !== 'walkin_manager' && actualCash === '') return toast.error('Please enter your actual physical cash amount');
    setShowSubmitConfirm(true);
  };

  const executeSubmit = async () => {
    setShowSubmitConfirm(false);
    setSubmitting(true);
    try {
      await dailyReportApi.submit({
        date: today,
        opening_balance: openingBalance,
        system_sales_reported: baseSales,
        system_money_received: totalMoneyReceived,
        system_debt_reported: todayDebt,
        system_cash_reported: systemCash,
        actual_cash_reported: user?.role === 'walkin_manager' ? systemCash : (parseFloat(actualCash) || 0),
        system_bills_reported: totalBills,
        system_deliveries_reported: totalDeliveries,
        system_expenses_reported: settlementExpenses + totalExpenses,
        discrepancy_notes: discrepancyNotes.trim(),
        quick_entries: quickEntries,
      });
      toast.success('✅ Daily report submitted successfully!');
      
      // Clear from storage upon success
      localStorage.removeItem('mk_daily_report_entries');
      localStorage.removeItem('mk_daily_report_cash');
      localStorage.removeItem('mk_daily_report_notes');
      
      // Clear react state
      setQuickEntries([]);
      setActualCash('');
      setDiscrepancyNotes('');
      
      setSubmitted(true);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin: mark reviewed
  const handleReview = async (reportId) => {
    try {
      await dailyReportApi.review(reportId);
      toast.success('Report marked as reviewed');
      loadAdminReports();
    } catch (err) {
      toast.error(err.message || 'Failed to review report');
    }
  };

  // Admin: Send reminder
  const handleRemind = async (managerId, e) => {
    if (e) e.stopPropagation();
    try {
      await dailyReportApi.remind(managerId, adminSelectedDate);
      toast.success('Reminder sent successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to send reminder');
    }
  };

  // ── Admin View ──
  if (isAdmin) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Moon size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Manager Daily Reports</h1>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Review end-of-day reports from your managers</p>
            </div>
          </div>
          <div>
            <input 
              type="date" 
              className="form-control"
              value={adminSelectedDate}
              max={getTodayIST()}
              onChange={e => setAdminSelectedDate(e.target.value)}
              style={{ fontWeight: 700, padding: '8px 12px', background: 'var(--bg-card)' }}
            />
          </div>
        </div>

        {adminLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader size={28} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading reports...</div>
          </div>
        ) : allReports.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Moon size={40} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>No reports submitted yet</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Manager reports will appear here once submitted</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allReports.map(report => (
              <div key={report._id} className="card report-card-hover" style={{ overflow: 'hidden', transition: 'all 0.2s', border: expandedReport === report._id ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                <style>{`
                  .report-card-hover:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    transform: translateY(-1px);
                  }
                `}</style>
                <div
                  style={{
                    padding: '14px 18px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: expandedReport === report._id ? 'var(--bg)' : 'var(--bg-card)',
                    cursor: (report.status !== 'pending_submission' || report.walkin_trip_summary) ? 'pointer' : 'default',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => (report.status !== 'pending_submission' || report.walkin_trip_summary) && setExpandedReport(expandedReport === report._id ? null : report._id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: report.status === 'reviewed' ? 'var(--success-light)' : report.status === 'pending_submission' ? 'var(--danger-light)' : 'var(--warning-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {report.status === 'reviewed'
                        ? <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                        : report.status === 'pending_submission' ? <AlertTriangle size={18} style={{ color: 'var(--danger)' }} /> : <Clock size={18} style={{ color: 'var(--warning)' }} />
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {report.manager_name}
                        <span style={{
                          fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: report.status === 'reviewed' ? 'var(--success-light)' : report.status === 'pending_submission' ? 'var(--danger-light)' : 'var(--warning-light)',
                          color: report.status === 'reviewed' ? 'var(--success)' : report.status === 'pending_submission' ? 'var(--danger)' : 'var(--warning)',
                          padding: '3px 8px', borderRadius: 20, marginLeft: 8,
                        }}>
                          {report.status === 'reviewed' 
                            ? <><CheckCircle size={10} /> {t('Reviewed', 'समीक्षा की गई')}</> 
                            : report.status === 'pending_submission' ? <><AlertTriangle size={10} /> {adminSelectedDate < getTodayIST() ? t('Not Submitted', 'जमा नहीं किया') : t('No Report', 'कोई रिपोर्ट नहीं')}</> : <><Clock size={10} /> {t('Pending Review', 'समीक्षा लंबित')}</>}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(report.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {report.status !== 'pending_submission' && report.createdAt && (
                          <>
                            {' · '}{t('Submitted', 'जमा किया गया')} {new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {report.status === 'pending_submission' ? (
                      adminSelectedDate >= getTodayIST() && (
                        <button 
                          className="btn btn-sm btn-outline" 
                          onClick={(e) => handleRemind(report.manager_id, e)}
                          style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        >
                          <Bell size={12} /> Send Reminder
                        </button>
                      )
                    ) : report.actual_cash_reported !== report.system_cash_reported && (
                      <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                    )}
                    {report.status !== 'pending_submission' ? (
                      expandedReport === report._id ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
                    ) : report.walkin_trip_summary ? (
                      expandedReport === report._id ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
                    ) : null}
                  </div>
                </div>

                {expandedReport === report._id && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
                    {/* Summary Grid */}
                    {report.status !== 'pending_submission' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginTop: 14 }}>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('SYSTEM CASH', 'सिस्टम कैश')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>₹{report.system_cash_reported?.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('ACTUAL CASH', 'वास्तविक नकद')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: report.actual_cash_reported === report.system_cash_reported ? 'var(--success)' : 'var(--danger)' }}>
                          ₹{report.actual_cash_reported?.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('TOTAL SALES', 'कुल बिक्री')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>₹{report.system_sales_reported?.toLocaleString('en-IN') || 0}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('MONEY RECEIVED', 'प्राप्त धन')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>₹{report.system_money_received?.toLocaleString('en-IN') || 0}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('DEBT CREATED', 'बनाया गया कर्ज')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>₹{report.system_debt_reported?.toLocaleString('en-IN') || 0}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('BILLS', 'बिल')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{report.system_bills_reported}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('DELIVERIES', 'वितरण')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{report.system_deliveries_reported}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('OPENING BAL', 'प्रारंभिक शेष')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--info)' }}>₹{report.opening_balance?.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('TOTAL PAID OUT', 'कुल भुगतान')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>₹{((report.quick_entries || []).filter(e => e.type === 'payment_out').reduce((s, e) => s + e.amount, 0)).toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('TOTAL EXPENSES', 'कुल खर्च')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>₹{((report.quick_entries || []).filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                    )}

                    {/* Cash Difference */}
                    {report.actual_cash_reported !== report.system_cash_reported && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 10,
                        background: 'var(--danger-light)', border: '1px solid var(--danger)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                          {t('Cash Discrepancy:', 'नकद में अंतर:')} ₹{(report.actual_cash_reported - report.system_cash_reported).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {report.discrepancy_notes && (
                      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t("Manager's Notes", 'मैनेजर के नोट्स')}</div>
                        {report.discrepancy_notes}
                      </div>
                    )}

                    {/* Walkin Trip Summary */}
                    {report.walkin_trip_summary && (report.walkin_trip_summary.initial_load?.length > 0 || report.walkin_trip_summary.remaining_items?.length > 0) && (
                      <div style={{ marginTop: 16, padding: '16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Truck size={16} color="var(--primary)" />
                          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('Walk-in Trip Inventory Summary', 'वाहन इन्वेंटरी सारांश')}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {report.walkin_trip_summary.initial_load.map((item, i) => {
                            const soldItem = report.walkin_trip_summary.sold_items?.find(s => s.product_name === item.product_name);
                            const remItem = report.walkin_trip_summary.remaining_items?.find(r => r.product_name === item.product_name);
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{item.product_name}</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: 8, minWidth: 54, border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>{t('Loaded', 'लोड')}</span>
                                    <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{item.quantity}</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--success-light)', padding: '4px 12px', borderRadius: 8, minWidth: 54, border: '1px solid rgba(34,197,94,0.2)' }}>
                                    <span style={{ fontSize: 9, color: 'var(--success)', textTransform: 'uppercase', fontWeight: 800 }}>{t('Sold', 'बिका')}</span>
                                    <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700 }}>{soldItem ? soldItem.quantity : 0}</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--danger-light)', padding: '4px 12px', borderRadius: 8, minWidth: 54, border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <span style={{ fontSize: 9, color: 'var(--danger)', textTransform: 'uppercase', fontWeight: 800 }}>{t('Unsold', 'बचा')}</span>
                                    <span style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 700 }}>{remItem ? remItem.quantity : 0}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Entries */}
                    {report.quick_entries?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          {t('Quick Entries', 'त्वरित प्रविष्टियाँ')} ({report.quick_entries.length})
                        </div>
                        {report.quick_entries.map((entry, i) => (
                          <div key={i} style={{
                            padding: '8px 12px', borderRadius: 8, background: 'var(--bg)',
                            marginBottom: 4, fontSize: 12.5, display: 'flex', justifyContent: 'space-between', color: 'var(--text)'
                          }}>
                            <div>
                              <span style={{
                                fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                                padding: '2px 6px', borderRadius: 4, marginRight: 8,
                                background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning-light)' : 'var(--danger-light)',
                                color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning)' : 'var(--danger)',
                              }}>
                                {entry.type === 'bill' ? t('BILL', 'बिल') : entry.type === 'payment_in' ? t('PAYMENT IN', 'भुगतान प्राप्त') : entry.type === 'vehicle_expense' ? t('VEHICLE EXPENSE', 'वाहन खर्च') : entry.type === 'expense' ? t('EXPENSE', 'खर्च') : t('PAYMENT OUT', 'भुगतान किया')}
                              </span>
                              {entry.customer_name || entry.supplier_name || entry.expense_for}
                              {entry.type === 'bill' && (
                                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: entry.is_paid ? 'var(--success)' : 'var(--danger)' }}>
                                  ({entry.is_paid ? t('PAID', 'भुगतान हो गया') : t('UNPAID', 'बकाया')})
                                </span>
                              )}
                              {entry.product_name && <span style={{ color: 'var(--text-muted)' }}> · {entry.product_name} x{entry.quantity}</span>}
                              {entry.notes && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> — {entry.notes}</span>}
                            </div>
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>₹{entry.amount?.toLocaleString('en-IN')}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review Button */}
                    {report.status === 'pending_submission' ? (
                      <div style={{ marginTop: 16, padding: '16px', background: 'var(--danger-light)', borderRadius: 10, textAlign: 'center', color: 'var(--danger)' }}>
                        <AlertTriangle size={24} style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {adminSelectedDate < getTodayIST()
                            ? `${report.manager_name} did not submit a report for this day.`
                            : `${report.manager_name} hasn't submitted a report for this day yet.`}
                        </div>
                      </div>
                    ) : report.status !== 'reviewed' && (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 14, width: '100%', fontWeight: 700 }}
                        onClick={(e) => { e.stopPropagation(); handleReview(report._id); }}
                      >
                        <CheckCircle size={15} style={{ marginRight: 6 }} /> Mark as Reviewed
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Manager View ──
  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 12px' }}></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading today's summary...</div>
        </div>
      </div>
    );
  }

  if (submitted && existingReport) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 600, margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '50px 24px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: existingReport.status === 'reviewed' ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {existingReport.status === 'reviewed'
              ? <CheckCircle size={32} color="#22c55e" />
              : <Send size={28} color="#6366f1" />
            }
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>
            {existingReport.status === 'reviewed' ? t('Report Reviewed', 'रिपोर्ट की समीक्षा की गई') : t('Report Submitted', 'रिपोर्ट सबमिट की गई')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            {existingReport.status === 'reviewed'
              ? t('Your admin has reviewed your daily report.', 'आपके एडमिन ने आपकी दैनिक रिपोर्ट की समीक्षा की है।')
              : t('Your daily report has been sent to the admin for review.', 'आपकी दैनिक रिपोर्ट समीक्षा के लिए एडमिन को भेज दी गई है।')
            }
          </p>

          {/* Quick summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', marginBottom: 16 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('System Cash', 'सिस्टम नकद')}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>₹{existingReport.system_cash_reported?.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Actual Cash', 'वास्तविक नकद')}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>₹{existingReport.actual_cash_reported?.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div style={{
            fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px',
            background: 'var(--bg)', borderRadius: 8,
          }}>
            Submitted at {new Date(existingReport.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {existingReport.total_quick_entries > 0 && ` · ${existingReport.total_quick_entries} quick entries`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 650, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #1e293b, #334155)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Moon size={22} color="#fcd34d" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>{t('End of Day Report', 'दिन के अंत की रिपोर्ट')}</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
              {new Date(today + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        {user?.role !== 'walkin_manager' && (
          <div>
            <input 
              type="date" 
              className="form-control"
              value={managerSelectedDate}
              max={getTodayIST()}
              onChange={e => setManagerSelectedDate(e.target.value)}
              style={{ fontWeight: 700, padding: '8px 12px', background: 'var(--bg-card)' }}
            />
          </div>
        )}
      </div>

      {user?.role === 'walkin_manager' && (
        <div style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Truck size={20} color="#4338ca" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ color: '#3730a3', fontSize: 13 }}>
            <strong>Walk-in Delivery Trip Ending:</strong> Submitting this report will automatically conclude your active trip, send the remaining unsold stock to the Admin, and reset your vehicle inventory to 0.
          </div>
        </div>
      )}

      {/* ─── Section 1: System Summary ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} /> {t("Today's System Summary", "आज का सिस्टम सारांश")}
          </div>
        </div>
        <div className="card-body" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {user?.role !== 'walkin_manager' && (
            <div style={{
              background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `var(--primary-light)`, color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CreditCard size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('OPENING BALANCE', 'ओपनिंग बैलेंस')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px' }}>₹</span>
                  <input 
                    type="number" 
                    value={openingBalance} 
                    onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)} 
                    style={{ 
                      border: 'none', background: 'transparent', outline: 'none', 
                      fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)',
                      width: '100%', padding: 0
                    }} 
                  />
                </div>
              </div>
            </div>
          )}
          <SummaryCard icon={<DollarSign size={20} />} label={t('TOTAL SALES', 'कुल बिक्री')} value={`₹${baseSales.toLocaleString('en-IN')}`} color="var(--info)" />
          <SummaryCard icon={<CreditCard size={20} />} label={t('TOTAL MONEY RECEIVED', 'कुल प्राप्त धन')} value={`₹${totalMoneyReceived.toLocaleString('en-IN')}`} color="var(--success)" />
          <SummaryCard icon={<AlertTriangle size={20} />} label={t('DEBT CREATED TODAY', 'आज का ऋण')} value={`₹${todayDebt.toLocaleString('en-IN')}`} color="var(--danger)" />
          <SummaryCard icon={<FileText size={20} />} label={t('BILLS CREATED', 'बनाए गए बिल')} value={totalBills} color="var(--primary)" />
          {user?.role !== 'walkin_manager' && <SummaryCard icon={<Truck size={20} />} label={t('DELIVERIES DONE', 'पूरी की गई डिलीवरी')} value={totalDeliveries} color="var(--warning)" />}
          {user?.role !== 'walkin_manager' && <SummaryCard icon={<Package size={20} />} label={t('TOTAL PAID OUT', 'कुल भुगतान')} value={`₹${totalPaidOut.toLocaleString('en-IN')}`} color="var(--danger)" />}
          <SummaryCard icon={<Coffee size={20} />} label={t('TOTAL EXPENSES', 'कुल खर्च')} value={`₹${totalExpenses.toLocaleString('en-IN')}`} color="var(--danger)" />
        </div>
      </div>

      {/* ─── Section 2: Quick Catch-Up ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> {t('Quick Catch-Up & Expenses', 'त्वरित प्रविष्टियां और खर्च')}
            {quickEntries.length > 0 && (
              <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: 10 }}>{quickEntries.length}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('Forgot something during rush hour or want to log an expense? Add it here', 'भीड़ के समय कुछ भूल गए या खर्च दर्ज करना चाहते हैं? इसे यहाँ जोड़ें')}</div>
        </div>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          {/* Listed entries */}
          {quickEntries.map((entry, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', marginBottom: 6,
            }}>
              <div style={{ fontSize: 13 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  padding: '2px 6px', borderRadius: 4, marginRight: 8,
                  background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning-light)' : 'var(--danger-light)',
                  color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning)' : 'var(--danger)',
                }}>
                  {entry.type === 'bill' ? t('Bill', 'बिल') : entry.type === 'payment_in' ? t('Payment In', 'पेमेंट इन') : entry.type === 'vehicle_expense' ? t('Vehicle Expense', 'वाहन खर्च') : entry.type === 'expense' ? t('Expense', 'खर्च') : t('Payment Out', 'पेमेंट आउट')}
                </span>
                <strong>{entry.customer_name || entry.supplier_name || entry.expense_for}</strong>
                {entry.type === 'bill' && (
                  <span style={{ 
                    marginLeft: 6, fontSize: 10, fontWeight: 700,
                    color: entry.is_paid ? 'var(--success)' : 'var(--danger)' 
                  }}>
                    ({entry.is_paid ? t('PAID', 'नकद') : t('UNPAID', 'बाकी')})
                  </span>
                )}
                {entry.product_name && <span style={{ color: 'var(--text-muted)' }}> · {entry.product_name} x{entry.quantity}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>₹{entry.amount.toLocaleString('en-IN')}</span>
                <button onClick={() => removeQuickEntry(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Quick form */}
          {showQuickForm ? (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              border: '1.5px solid var(--primary)', background: 'var(--bg)',
              marginTop: 8,
            }}>
              {/* Type selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {(user?.role === 'walkin_manager' ? [
                  { key: 'bill', label: t('Forgot Bill', 'भूला हुआ बिल'), icon: <FileText size={13} /> },
                  { key: 'payment_in', label: t('Payment In', 'पेमेंट इन'), icon: <DollarSign size={13} /> },
                  { key: 'vehicle_expense', label: 'Expense', icon: <Coffee size={13} /> }
                ] : [
                  { key: 'bill', label: t('Forgot Bill', 'भूला हुआ बिल'), icon: <FileText size={13} /> },
                  { key: 'payment_in', label: t('Payment In', 'पेमेंट इन'), icon: <DollarSign size={13} /> },
                  { key: 'payment_out', label: t('Payment Out', 'पेमेंट आउट'), icon: <Building2 size={13} /> },
                  { key: 'expense', label: t('Expense', 'खर्च'), icon: <Coffee size={13} /> },
                ]).map(t => (
                  <button
                    key={t.key}
                    className={`btn btn-sm ${quickFormType === t.key ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setQuickFormType(t.key)}
                    style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Name field */}
              {(quickFormType === 'bill' || quickFormType === 'payment_in') && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input
                    className="form-control"
                    placeholder={t('Customer Name', 'ग्राहक का नाम')}
                    value={quickForm.customer_name}
                    onChange={e => { setQuickForm({ ...quickForm, customer_name: e.target.value }); searchCustomers(e.target.value); }}
                    style={{ fontSize: 13 }}
                  />
                  {customerSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 140, overflow: 'auto' }}>
                      {customerSuggestions.map(c => (
                        <div key={c._id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)' }}
                          onClick={() => { setQuickForm({ ...quickForm, customer_name: c.name }); setCustomerSuggestions([]); }}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {quickFormType === 'payment_out' && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input
                    className="form-control"
                    placeholder={t('Supplier Name', 'आपूर्तिकर्ता का नाम')}
                    value={quickForm.supplier_name}
                    onChange={e => { setQuickForm({ ...quickForm, supplier_name: e.target.value }); searchSuppliers(e.target.value); }}
                    style={{ fontSize: 13 }}
                  />
                  {supplierSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 140, overflow: 'auto' }}>
                      {supplierSuggestions.map(s => (
                        <div key={s._id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)' }}
                          onClick={() => { setQuickForm({ ...quickForm, supplier_name: s.name }); setSupplierSuggestions([]); }}>
                          {s.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {['expense', 'vehicle_expense'].includes(quickFormType) && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  {quickFormType === 'vehicle_expense' && (
                    <select 
                      className="form-control"
                      value={quickForm.expense_category}
                      onChange={e => setQuickForm({ ...quickForm, expense_category: e.target.value })}
                      style={{ marginBottom: 8, fontSize: 13 }}
                    >
                      <option value="Fuel">Fuel</option>
                      <option value="Food">Food</option>
                      <option value="Service">Service</option>
                      <option value="Other">Other</option>
                    </select>
                  )}
                  {!(quickFormType === 'vehicle_expense' && quickForm.expense_category === 'Other') && (
                    <input
                      className="form-control"
                      placeholder={quickFormType === 'vehicle_expense' ? t('Vehicle Expense For (e.g. Petrol pump, reason)', 'वाहन खर्च (उदा. पेट्रोल पंप, कारण)') : t('Expense For (e.g. Labour, Tea)', 'खर्च का विवरण (जैसे मज़दूरी, चाय)')}
                      value={quickForm.expense_for}
                      onChange={e => setQuickForm({ ...quickForm, expense_for: e.target.value })}
                      style={{ fontSize: 13 }}
                    />
                  )}
                </div>
              )}

              {/* Product & qty (only for bill type) */}
              {quickFormType === 'bill' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-control"
                      placeholder={t('Product Name', 'उत्पाद का नाम')}
                      value={quickForm.product_name}
                      onChange={e => { setQuickForm({ ...quickForm, product_name: e.target.value }); searchProducts(e.target.value); }}
                      style={{ fontSize: 13 }}
                    />
                    {productSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 140, overflow: 'auto' }}>
                        {productSuggestions.map(p => (
                          <div key={p._id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)' }}
                            onClick={() => { 
                              setQuickForm({ 
                                ...quickForm, 
                                product_name: p.name, 
                                product_price: p.price,
                                amount: p.price * quickForm.quantity 
                              }); 
                              setProductSuggestions([]); 
                            }}>
                            {p.name} <span style={{ color: 'var(--text-muted)' }}>(₹{p.price})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    className="form-control"
                    type="number"
                    placeholder={t('Qty', 'मात्रा')}
                    value={quickForm.quantity}
                    onChange={e => {
                      const qty = parseFloat(e.target.value) || 0;
                      setQuickForm({ 
                        ...quickForm, 
                        quantity: e.target.value,
                        amount: quickForm.product_price ? (quickForm.product_price * qty) : quickForm.amount
                      });
                    }}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}

              {/* Amount */}
              <div style={{ marginBottom: 8 }}>
                <input
                  className="form-control"
                  type="number"
                  placeholder={quickFormType === 'bill' ? t('Total Amount (₹)', 'कुल राशि (₹)') : t('₹ Amount', '₹ राशि')}
                  value={quickForm.amount || ''}
                  onChange={e => setQuickForm({ ...quickForm, amount: e.target.value })}
                  style={{ fontSize: 13 }}
                />
              </div>

              {/* Payment Status (only for bill type) */}
              {quickFormType === 'bill' && (
                <div style={{ 
                  display: 'flex', gap: 12, marginBottom: 12, 
                  padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 8 
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="is_paid" 
                      checked={quickForm.is_paid !== false} 
                      onChange={() => setQuickForm({ ...quickForm, is_paid: true })} 
                    />
                    {t('Paid (Cash)', 'भुगतान (नकद)')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="is_paid" 
                      checked={quickForm.is_paid === false} 
                      onChange={() => setQuickForm({ ...quickForm, is_paid: false })} 
                    />
                    {t('Unpaid (Due)', 'अदत्त (बाकी)')}
                  </label>
                </div>
              )}

              {/* Notes */}
              <input
                className="form-control"
                placeholder={(quickFormType === 'vehicle_expense' && quickForm.expense_category === 'Other') ? t('Quick note (required)', 'संक्षिप्त नोट (आवश्यक)') : t('Quick note (optional)', 'संक्षिप्त नोट (वैकल्पिक)')}
                value={quickForm.notes}
                onChange={e => setQuickForm({ ...quickForm, notes: e.target.value })}
                style={{ fontSize: 12.5, marginBottom: 10 }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={addQuickEntry} style={{ flex: 1, fontWeight: 700 }}>
                  <Plus size={14} style={{ marginRight: 4 }} /> {t('Add Entry', 'प्रविष्टि जोड़ें')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowQuickForm(false)} style={{ fontWeight: 600 }}>{t('Cancel', 'रद्द करें')}</button>
              </div>
            </div>
          ) : (
            <button 
              className="btn" 
              style={{ width: '100%', background: 'var(--bg-hover)', color: 'var(--text)', border: '1px dashed var(--border)' }}
              onClick={() => setShowQuickForm(true)}
            >
              <Plus size={16} /> {t('Add Missed Entry or Expense', 'छूटी हुई प्रविष्टि या खर्च जोड़ें')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Section 3: Cash Reconciliation ─── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={16} /> {t('Cash Reconciliation', 'नकद मिलान')}
          </div>
        </div>
        <div className="card-body" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'walkin_manager' ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ textAlign: user?.role === 'walkin_manager' ? 'center' : 'left' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('SYSTEM SAYS', 'सिस्टम के अनुसार')}</label>
              <div style={{
                background: 'var(--bg)', borderRadius: 10, padding: '14px 16px',
                fontSize: 22, fontWeight: 900, color: 'var(--primary)',
              }}>
                ₹{systemCash.toLocaleString('en-IN')}
              </div>
            </div>
            {user?.role !== 'walkin_manager' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('YOUR DRAWER', 'आपके दराज में')}</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder={t('₹ Actual Cash', '₹ वास्तविक नकद')}
                  value={actualCash}
                  onChange={e => setActualCash(e.target.value)}
                  style={{
                    fontSize: 18, fontWeight: 800, padding: '12px 16px',
                    textAlign: 'center', borderRadius: 10,
                    border: actualCash !== '' && cashDifference !== 0 ? '2px solid #ef4444' : undefined,
                  }}
                />
              </div>
            )}
          </div>

          {user?.role !== 'walkin_manager' && actualCash !== '' && cashDifference !== 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 12,
              background: systemCash < 0 ? 'var(--danger-light)' : (cashDifference > 0 ? 'var(--success-light)' : 'var(--danger-light)'),
              border: `1px solid ${systemCash < 0 ? 'var(--danger)' : (cashDifference > 0 ? 'var(--success)' : 'var(--danger)')}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={16} style={{ color: systemCash < 0 ? 'var(--danger)' : (cashDifference > 0 ? 'var(--success)' : 'var(--danger)') }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: systemCash < 0 ? 'var(--danger)' : (cashDifference > 0 ? 'var(--success)' : 'var(--danger)') }}>
                {systemCash < 0 
                  ? `-₹${cashDifference.toLocaleString('en-IN')} ${t('Negative Sale', 'नकारात्मक बिक्री')}`
                  : (cashDifference > 0 ? `₹${cashDifference.toLocaleString('en-IN')} ${t('Extra', 'अतिरिक्त')}` : `₹${Math.abs(cashDifference).toLocaleString('en-IN')} ${t('Short', 'कम')}`)
                }
              </span>
            </div>
          )}

          {user?.role !== 'walkin_manager' && (
            <textarea
              className="form-control"
              placeholder={t("Any notes about discrepancies? (optional) — e.g. 'Forgot to log a ₹500 cash payment from Amit'", "विसंगतियों के बारे में कोई नोट? (वैकल्पिक) - उदाहरण: 'अमित से ₹500 नकद भुगतान लॉग करना भूल गया'")}
              value={discrepancyNotes}
              onChange={e => setDiscrepancyNotes(e.target.value)}
              rows={3}
              style={{ fontSize: 12.5, resize: 'vertical' }}
            />
          )}
        </div>
      </div>

      {/* ─── Submit Button ─── */}
      <button
        className="btn btn-primary"
        disabled={submitting}
        onClick={handleSubmit}
        style={{
          width: '100%', padding: '14px 20px',
          fontWeight: 800, fontSize: 15,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none',
          boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
        }}
      >
        {submitting ? (
          <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }}></span> {t('Submitting...', 'सबमिट कर रहा है...')}</>
        ) : (
          <><Send size={16} style={{ marginRight: 8 }} /> {t('Submit Daily Report to Admin', 'एडमिन को दैनिक रिपोर्ट सबमिट करें')}</>
        )}
      </button>
      

      {/* ─── Custom Submit Confirmation Modal ─── */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', padding: 30, borderRadius: 24, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Send size={32} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, color: '#1e293b', letterSpacing: '-0.5px' }}>
              {t('Confirm Submission', 'सबमिशन की पुष्टि करें')}
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>
              {t("Are you sure you want to submit? Once submitted, you won't be able to edit this report or submit another one for today.", "क्या आप सुनिश्चित हैं कि आप सबमिट करना चाहते हैं? एक बार सबमिट करने के बाद, आप आज के लिए इस रिपोर्ट को संपादित या दूसरी रिपोर्ट सबमिट नहीं कर पाएंगे।")}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button 
                onClick={() => setShowSubmitConfirm(false)}
                style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                {t('Go Back', 'वापस जाएँ')}
              </button>
              <button 
                onClick={executeSubmit}
                style={{ padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 16px rgba(79,70,229,0.25)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 20px rgba(79,70,229,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(79,70,229,0.25)'; }}
              >
                {t('Yes, Submit', 'हाँ, सबमिट करें')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Modal */}
      {validationError && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setValidationError(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '24px 20px', width: '90%', maxWidth: '320px', textAlign: 'center', border: '1px solid var(--border)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={24} />
            </div>
            <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Action Required</h4>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              {validationError}
            </p>
            <button className="btn btn-primary" onClick={() => setValidationError(null)} style={{ width: '100%', fontWeight: 700 }}>
              Okay, Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small summary card component ──
function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px' }}>{value}</div>
      </div>
    </div>
  );
}
