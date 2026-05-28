import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { dashboardApi, invoiceApi, deliveryApi, settlementApi, dailyReportApi, customerApi, supplierApi, productApi } from '../utils/api';
import { Moon, Send, Plus, CheckCircle, AlertTriangle, DollarSign, FileText, Truck, X, ChevronDown, ChevronUp, Clock, Package, Users, Building2, TrendingUp, Loader, Coffee } from 'lucide-react';
import toast from 'react-hot-toast';

// Helper: get today's date in IST as YYYY-MM-DD
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().slice(0, 10);
}

export default function DailyReport() {
  const { user, isAdmin } = useAuth();
  const { t } = useApp();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingReport, setExistingReport] = useState(null);

  // System summary data
  const [dashData, setDashData] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [settlements, setSettlements] = useState([]);

  // Quick entry form
  const [quickEntries, setQuickEntries] = useState([]);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickFormType, setQuickFormType] = useState('bill');
  const [quickForm, setQuickForm] = useState({ customer_name: '', supplier_name: '', expense_for: '', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });

  // Reconciliation
  const [actualCash, setActualCash] = useState('');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);

  // Suggestions
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);

  // Admin view
  const [allReports, setAllReports] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  const today = getTodayIST();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load reports to check if submitted today and to find opening balance
      const allMyReports = await dailyReportApi.getAll();
      const myReport = Array.isArray(allMyReports) ? allMyReports.find(r => r.date === today) : null;
      if (myReport) {
        setExistingReport(myReport);
        setSubmitted(true);
      }

      // Find the most recent report before today for the opening balance
      if (Array.isArray(allMyReports)) {
        const pastReports = allMyReports.filter(r => r.date < today);
        if (pastReports.length > 0) {
          setOpeningBalance(pastReports[0].actual_cash_reported || 0);
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
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Admin: load all reports
  const loadAdminReports = useCallback(async () => {
    setAdminLoading(true);
    try {
      const reports = await dailyReportApi.getAll({});
      setAllReports(Array.isArray(reports) ? reports : []);
    } catch (err) {
      console.error('Failed to load admin reports:', err);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadAdminReports();
  }, [isAdmin, loadAdminReports]);

  const baseSales = dashData?.todaySales || 0;
  const totalBills = dashData?.todayCount || 0;
  const totalDeliveries = deliveries.filter(d => d.status === 'delivered').length;
  const totalSettlements = settlements.length;
  
  const settlementExpenses = settlements.filter(s => ['paid_to_supplier', 'other_expense', 'vehicle_expense'].includes(s.type)).reduce((sum, s) => sum + s.amount, 0);
  
  // Expenses from Quick Catch-up (Manual entries from the 'Expense' tab)
  const totalExpenses = quickEntries.filter(e => e.type === 'expense' || e.type === 'payment_out').reduce((sum, e) => sum + e.amount, 0);

  // Income from Quick Catch-up
  const quickIncome = quickEntries.filter(e => e.type === 'bill' || e.type === 'payment_in').reduce((sum, e) => sum + e.amount, 0);

  // Income from formal Settlements (e.g. collecting past due cash)
  const settlementIncome = settlements.filter(s => ['other_income', 'by_invoice', 'due_cleared', 'advance_received', 'received_from_customer'].includes(s.type)).reduce((sum, s) => sum + s.amount, 0);

  // Expected Cash = Opening Balance + (Base Sales + Quick Income + Settlement Income) - (Total Paid Out + Quick Expenses)
  const systemCash = openingBalance + (baseSales + quickIncome + settlementIncome) - (settlementExpenses + totalExpenses);

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
    if (quickForm.amount <= 0) return toast.error(t('Amount must be greater than 0', 'राशि 0 से अधिक होनी चाहिए'));

    setQuickEntries(prev => [...prev, {
      type: quickFormType,
      customer_name: custName,
      supplier_name: quickForm.supplier_name.trim(),
      expense_for: quickForm.expense_for.trim(),
      product_name: quickForm.product_name.trim(),
      quantity: parseFloat(quickForm.quantity) || 1,
      amount: parseFloat(quickForm.amount) || 0,
      notes: quickForm.notes.trim(),
      is_paid: quickForm.is_paid !== false, // default to true
    }]);
    setQuickForm({ customer_name: '', supplier_name: '', expense_for: '', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });
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

  // Submit report
  const handleSubmit = async () => {
    if (actualCash === '') return toast.error('Please enter your actual physical cash amount');
    setSubmitting(true);
    try {
      await dailyReportApi.submit({
        date: today,
        opening_balance: openingBalance,
        system_cash_reported: systemCash,
        actual_cash_reported: parseFloat(actualCash) || 0,
        system_bills_reported: totalBills,
        system_deliveries_reported: totalDeliveries,
        discrepancy_notes: discrepancyNotes.trim(),
        quick_entries: quickEntries,
      });
      toast.success('✅ Daily report submitted successfully!');
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

  // ── Admin View ──
  if (isAdmin) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
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
              <div key={report._id} className="card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '14px 18px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: expandedReport === report._id ? 'var(--bg-hover)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => setExpandedReport(expandedReport === report._id ? null : report._id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: report.status === 'reviewed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {report.status === 'reviewed'
                        ? <CheckCircle size={18} color="#22c55e" />
                        : <Clock size={18} color="#f59e0b" />
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {report.manager_name}
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: report.status === 'reviewed' ? '#dcfce7' : '#fef3c7',
                          color: report.status === 'reviewed' ? '#15803d' : '#92400e',
                          padding: '2px 8px', borderRadius: 20, marginLeft: 8,
                        }}>
                          {report.status === 'reviewed' ? '✓ Reviewed' : '⏳ Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(report.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' · '}Submitted {new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {report.actual_cash_reported !== report.system_cash_reported && (
                      <AlertTriangle size={16} color="#ef4444" />
                    )}
                    {expandedReport === report._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {expandedReport === report._id && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
                    {/* Summary Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 14 }}>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Cash</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>₹{report.system_cash_reported?.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actual Cash</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: report.actual_cash_reported === report.system_cash_reported ? '#22c55e' : '#ef4444' }}>
                          ₹{report.actual_cash_reported?.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bills</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{report.system_bills_reported}</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deliveries</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{report.system_deliveries_reported}</div>
                      </div>
                    </div>

                    {/* Cash Difference */}
                    {report.actual_cash_reported !== report.system_cash_reported && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <AlertTriangle size={16} color="#ef4444" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                          Cash Discrepancy: ₹{(report.actual_cash_reported - report.system_cash_reported).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {report.discrepancy_notes && (
                      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', fontSize: 13 }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Manager's Notes</div>
                        {report.discrepancy_notes}
                      </div>
                    )}

                    {/* Quick Entries */}
                    {report.quick_entries?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          Quick Entries ({report.quick_entries.length})
                        </div>
                        {report.quick_entries.map((entry, i) => (
                          <div key={i} style={{
                            padding: '8px 12px', borderRadius: 8, background: 'var(--bg)',
                            marginBottom: 4, fontSize: 12.5, display: 'flex', justifyContent: 'space-between',
                          }}>
                            <div>
                              <span style={{
                                fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                                padding: '2px 6px', borderRadius: 4, marginRight: 8,
                                background: entry.type === 'bill' ? '#dbeafe' : entry.type === 'payment_in' ? '#dcfce7' : '#fee2e2',
                                color: entry.type === 'bill' ? '#1d4ed8' : entry.type === 'payment_in' ? '#15803d' : '#b91c1c',
                              }}>
                                {entry.type === 'bill' ? 'BILL' : entry.type === 'payment_in' ? 'PAYMENT IN' : 'PAYMENT OUT'}
                              </span>
                              {entry.customer_name || entry.supplier_name}
                              {entry.product_name && <span style={{ color: 'var(--text-muted)' }}> · {entry.product_name} x{entry.quantity}</span>}
                              {entry.notes && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> — {entry.notes}</span>}
                            </div>
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>₹{entry.amount?.toLocaleString('en-IN')}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review Button */}
                    {report.status !== 'reviewed' && (
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
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

      {/* ─── Section 1: System Summary ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} /> {t("Today's System Summary", "आज का सिस्टम सारांश")}
          </div>
        </div>
        <div className="card-body" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SummaryCard icon={<CreditCard size={20} />} label={t('OPENING BALANCE', 'ओपनिंग बैलेंस')} value={`₹${openingBalance.toLocaleString('en-IN')}`} color="var(--primary)" />
          <SummaryCard icon={<DollarSign size={20} />} label={t('TOTAL SALES', 'कुल बिक्री')} value={`₹${baseSales.toLocaleString('en-IN')}`} color="var(--success)" />
          <SummaryCard icon={<FileText size={20} />} label={t('BILLS CREATED', 'बनाए गए बिल')} value={totalBills} color="var(--info)" />
          <SummaryCard icon={<Truck size={20} />} label={t('DELIVERIES DONE', 'पूरी की गई डिलीवरी')} value={totalDeliveries} color="var(--warning)" />
          <SummaryCard icon={<Package size={20} />} label={t('TOTAL PAID OUT', 'कुल भुगतान')} value={`₹${settlementExpenses.toLocaleString('en-IN')}`} color="var(--danger)" />
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
                  background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : entry.type === 'expense' ? 'var(--warning-light)' : 'var(--danger-light)',
                  color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : entry.type === 'expense' ? 'var(--warning)' : 'var(--danger)',
                }}>
                  {entry.type === 'bill' ? t('Bill', 'बिल') : entry.type === 'payment_in' ? t('Payment In', 'पेमेंट इन') : entry.type === 'expense' ? t('Expense', 'खर्च') : t('Payment Out', 'पेमेंट आउट')}
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
                {[
                  { key: 'bill', label: t('Forgot Bill', 'भूला हुआ बिल'), icon: <FileText size={13} /> },
                  { key: 'payment_in', label: t('Payment In', 'पेमेंट इन'), icon: <DollarSign size={13} /> },
                  { key: 'payment_out', label: t('Payment Out', 'पेमेंट आउट'), icon: <Building2 size={13} /> },
                  { key: 'expense', label: t('Expense', 'खर्च'), icon: <Coffee size={13} /> },
                ].map(t => (
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

              {quickFormType === 'expense' && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input
                    className="form-control"
                    placeholder={t('Expense For (e.g. Labour, Tea)', 'खर्च का विवरण (जैसे मज़दूरी, चाय)')}
                    value={quickForm.expense_for}
                    onChange={e => setQuickForm({ ...quickForm, expense_for: e.target.value })}
                    style={{ fontSize: 13 }}
                  />
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
                placeholder={t('Quick note (optional)', 'संक्षिप्त नोट (वैकल्पिक)')}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('SYSTEM SAYS', 'सिस्टम के अनुसार')}</label>
              <div style={{
                background: 'var(--bg)', borderRadius: 10, padding: '14px 16px',
                fontSize: 22, fontWeight: 900, color: 'var(--primary)',
              }}>
                ₹{systemCash.toLocaleString('en-IN')}
              </div>
            </div>
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
          </div>

          {actualCash !== '' && cashDifference !== 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 12,
              background: cashDifference > 0 ? 'var(--success-light)' : 'var(--danger-light)',
              border: `1px solid ${cashDifference > 0 ? 'var(--success)' : 'var(--danger)'}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={16} style={{ color: cashDifference > 0 ? 'var(--success)' : 'var(--danger)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: cashDifference > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {cashDifference > 0 ? `₹${cashDifference.toLocaleString('en-IN')} ${t('Extra', 'अतिरिक्त')}` : `₹${Math.abs(cashDifference).toLocaleString('en-IN')} ${t('Short', 'कम')}`}
              </span>
            </div>
          )}

          <textarea
            className="form-control"
            placeholder={t("Any notes about discrepancies? (optional) — e.g. 'Forgot to log a ₹500 cash payment from Amit'", "विसंगतियों के बारे में कोई नोट? (वैकल्पिक) - उदाहरण: 'अमित से ₹500 नकद भुगतान लॉग करना भूल गया'")}
            value={discrepancyNotes}
            onChange={e => setDiscrepancyNotes(e.target.value)}
            rows={3}
            style={{ fontSize: 12.5, resize: 'vertical' }}
          />
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
