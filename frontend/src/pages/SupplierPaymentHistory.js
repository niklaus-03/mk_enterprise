import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { supplierApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { ArrowLeft, Calendar, CreditCard, User, Building2 } from 'lucide-react';

export default function SupplierPaymentHistory() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useApp();
  const fc = formatCurrency;

  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyData, setHistoryData] = useState({ history: [], totalPaid: 0 });
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [historyDateFilter, setHistoryDateFilter] = useState(todayStr);
  const [isFullHistory, setIsFullHistory] = useState(false);
  
  // If state was passed from navigation, use it. Otherwise fallback to generic name.
  const supplierName = state?.supplier?.name || t('Supplier', 'आपूर्तिकर्ता');

  useEffect(() => {
    loadHistory();
  }, [id]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await supplierApi.getHistory(id, { all: 'true' });
      setHistoryData({ history: res.history || [], totalPaid: res.totalPaid || 0 });
    } catch (e) {
      toast.error(e.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  let filteredHistory = historyData.history;
  if (!isFullHistory && historyDateFilter) {
    filteredHistory = filteredHistory.filter(h => h.ist_date === historyDateFilter);
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── HEADER ── */}
      <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <CreditCard size={24} />
            </span>
            <span>{supplierName} — Payment History</span>
          </div>
          <div className="page-subtitle" style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <span>Total Paid: <strong style={{ color: '#16a34a' }}>{fc(historyData.totalPaid)}</strong></span>
            <span>{filteredHistory.length} transactions found</span>
          </div>
        </div>
      </div>

      {/* ── MAIN CARD ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
             <Building2 size={18} className="text-muted" /> {isFullHistory ? 'All Payments & Settlements' : 'Payments by Date'}
          </div>
          
          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isFullHistory ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px' }}>
                  <Calendar size={14} className="text-muted" style={{ marginRight: 8 }} />
                  <input
                    type="date"
                    value={historyDateFilter}
                    onChange={e => setHistoryDateFilter(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, color: 'var(--text)' }}
                  />
                </div>
                <button 
                  onClick={() => setIsFullHistory(true)} 
                  className="btn btn-outline btn-sm" 
                  style={{ borderRadius: 8, fontWeight: 600 }}
                >
                  Full History
                </button>
              </>
            ) : (
              <button 
                onClick={() => {
                  setIsFullHistory(false);
                  if (!historyDateFilter) setHistoryDateFilter(todayStr);
                }} 
                className="btn btn-outline btn-sm" 
                style={{ borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <Calendar size={14} /> Select Date
              </button>
            )}
          </div>
        </div>

        <div className="card-body no-pad">
          {historyLoading ? (
            <div className="loading" style={{ padding: 40 }}><span className="spinner"></span></div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-icon" style={{ fontSize: 40, marginBottom: 16 }}>💸</div>
              <div className="empty-text" style={{ fontSize: 16 }}>No payment records found</div>
              {!isFullHistory && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Try selecting a different date or viewing Full History</div>}
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table style={{ width: '100%', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px' }}>Date & Time</th>
                    <th style={{ padding: '14px 20px' }}>Paid By</th>
                    <th style={{ padding: '14px 20px' }}>Mode</th>
                    <th style={{ padding: '14px 20px' }}>Notes / Details</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Amount ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((h, i) => (
                    <tr key={h._id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {h.ist_date ? new Date(h.ist_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {h.ist_formatted ? h.ist_formatted.split(' ').slice(1).join(' ') : '—'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                         <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Payment By</span>
                           <span style={{ fontSize: 13.5, fontWeight: 600, color: '#64748b' }}>
                             {h.created_by ? (h.created_by.display_name || h.created_by.username) : 'Admin'}
                           </span>
                         </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', color: h.mode === 'cash' ? '#16a34a' : h.mode === 'upi' ? '#2563eb' : 'var(--text-muted)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: h.mode === 'cash' ? '#16a34a' : h.mode === 'upi' ? '#2563eb' : 'var(--text-muted)' }} />
                          {h.mode ? h.mode : '—'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                        {h.notes ? h.notes : <span style={{ color: '#cbd5e1' }}>—</span>}
                        {h.reference && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Ref: {h.reference}</div>}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 900, color: '#ef4444', fontSize: 17, letterSpacing: '-0.5px' }}>
                        {fc(h.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
