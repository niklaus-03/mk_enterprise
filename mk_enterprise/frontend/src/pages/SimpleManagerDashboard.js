import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { AlertTriangle, UserCheck, Search, Phone } from 'lucide-react';

function getTodayIST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

export default function SimpleManagerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    dashboardApi.get(getTodayIST())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
        Loading dashboard...
      </div>
    );
  }

  if (!data) return null;

  // Derive dues display
  const allDues = data.pendingCustomers || [];
  const q = customerSearch.trim().toLowerCase();
  const filteredDues = q
    ? allDues.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
    : allDues;

  const fc = formatCurrency;

  return (
    <div style={{ padding: '16px 12px', paddingBottom: 100 }}>
      {/* 1. Walk-in Delivery Main Card */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/walkin-delivery" style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1877f2 0%, #0d47a1 100%)',
            color: '#fff',
            padding: 20,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 15px rgba(24,119,242,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 14, borderRadius: 14 }}>
                <UserCheck size={28} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Walk-in Delivery</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Process walk-in customers</div>
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, opacity: 0.8 }}>→</div>
          </div>
        </Link>
      </div>

      <div className="dashboard-grid">
        
        {/* 2. Today's Pending Dues */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              Today's Pending Bills
              {data.todayPendingDues?.length > 0 && (
                <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 11 }}>
                  {data.todayPendingDues.length}
                </span>
              )}
            </div>
          </div>
          <div className="card-body no-pad">
            {!data.todayPendingDues?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No pending bills today ✅</div>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <tbody>
                    {data.todayPendingDues.map((c, idx) => (
                      <tr key={c._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <Link to={`/invoices/${c._id}`} style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13.5 }}>
                                {c.invoice_number}
                              </Link>
                              <div style={{ marginTop: 4, fontWeight: 600 }}>{c.name}</div>
                              {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><Phone size={10} style={{marginRight:2}}/> {c.phone}</div>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: 'var(--danger)', fontWeight: 800, fontSize: 14 }}>{fc(c.balance_due)}</div>
                              {c.type === 'walkin' && <span className="badge badge-warning" style={{ fontSize: 10, marginTop: 4 }}>Walk-in</span>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 3. Customer Dues (Overall) */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">Customer Dues</div>
              <span className="badge badge-warning">{fc(data.allTimePendingBalance || 0)} Total</span>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search customers..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="form-control"
                style={{ paddingLeft: 32, height: 36, fontSize: 13 }}
              />
            </div>
          </div>
          <div className="card-body no-pad" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {!filteredDues.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No customers found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <tbody>
                  {filteredDues.map((c, idx) => (
                    <tr key={c._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</div>
                            {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><Phone size={10} style={{marginRight:2}}/> {c.phone}</div>}
                          </div>
                          <div style={{ color: 'var(--danger)', fontWeight: 800, fontSize: 14 }}>
                            {fc(c.balance)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 4. Products (Low Stock Alert) */}
        <div className="card" style={{ borderColor: data.lowStockProducts?.length ? '#fca5a5' : 'var(--border)' }}>
          <div className="card-header" style={{ background: data.lowStockProducts?.length ? '#fef2f2' : '' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: data.lowStockProducts?.length ? '#b91c1c' : '' }}>
              {data.lowStockProducts?.length > 0 && <AlertTriangle size={16} />}
              Low Stock Alerts
              {data.lowStockProducts?.length > 0 && (
                <span className="badge badge-danger" style={{ marginLeft: 4 }}>{data.lowStockProducts.length}</span>
              )}
            </div>
          </div>
          <div className="card-body no-pad">
            {!data.lowStockProducts?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>All products adequately stocked ✅</div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <tbody>
                    {data.lowStockProducts.map((p, idx) => (
                      <tr key={p._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Current: <strong style={{ color: '#b91c1c' }}>{p.stock_quantity} {p.unit}</strong>
                          </div>
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
    </div>
  );
}
