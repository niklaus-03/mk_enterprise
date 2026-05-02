import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';

function getTodayIST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

export default function VehicleIncoming() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [viewAll, setViewAll] = useState(false);
  const navigate = useNavigate();
  const fc = formatCurrency;

  const load = (date, all) => {
    setLoading(true);
    deliveryApi.getAll(all ? { all: true } : { date })
      .then(setDeliveries)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(selectedDate, false); }, [selectedDate]);

  const statusColors = {
    pending: '#6b7280', on_the_way: '#3b82f6',
    arriving_soon: '#f59e0b', delivered: '#16a34a', not_delivered: '#dc2626',
  };
  const statusLabels = {
    pending: '⏳ Pending', on_the_way: '🚛 On the Way',
    arriving_soon: '⚠️ Arriving Soon', delivered: '✅ Delivered', not_delivered: '❌ Not Delivered',
  };

  // Group deliveries by IST date
  const grouped = deliveries.reduce((acc, d) => {
    const dateKey = d.arrival_date_ist || getTodayIST();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(d);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🚛 Incoming Vehicles</div>
          <div className="page-subtitle">Date-wise history of all incoming deliveries</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!viewAll && (
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              max={getTodayIST()}
              style={{ width: 160 }}
              onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
            />
          )}
          <button
            className={`btn ${viewAll ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              const next = !viewAll;
              setViewAll(next);
              load(selectedDate, next);
            }}
          >
            {viewAll ? '📅 Date View' : '📚 All History'}
          </button>
          <Link to="/" className="btn btn-outline">← Dashboard</Link>
        </div>
      </div>

      {loading ? (
        <div className="loading"><span className="spinner"></span></div>
      ) : deliveries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚛</div>
          <div className="empty-text">No vehicles found</div>
          <div className="empty-sub">
            {viewAll ? 'No delivery records exist yet.' : `No deliveries on ${selectedDate}`}
          </div>
        </div>
      ) : (
        <div>
          {(viewAll ? sortedDates : [selectedDate]).map(dateKey => {
            const entries = grouped[dateKey] || [];
            if (!entries.length) return null;
            return (
              <div key={dateKey} className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title">
                    📅 {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                    })}
                    <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 11 }}>
                      {entries.length} vehicle{entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {entries.filter(d => d.status === 'delivered').length} delivered ·{' '}
                    {entries.filter(d => d.status !== 'delivered' && d.status !== 'not_delivered').length} active
                  </div>
                </div>
                <div className="card-body no-pad">
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Vehicle No.', 'Supplier', 'Expected At', 'Items', 'Status', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((d, idx) => (
                          <tr key={d._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 14px' }}>
                              {/* Click vehicle number → detail page */}
                              <Link
                                to={`/vehicle/${d._id}`}
                                style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'monospace', fontSize: 13, letterSpacing: 0.5, textDecoration: 'none' }}
                              >
                                {d.vehicle_number}
                              </Link>
                              {d.driver_name && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>👤 {d.driver_name}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>{d.supplier || '—'}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                              <div>{d.expected_arrival_ist || '—'}</div>
                              {d.status === 'delivered' && d.delivered_at_ist && (
                                <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>
                                  ✅ Delivered: {d.delivered_at_ist}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {/* Show max 3 items, then Show More link */}
                              {d.items.slice(0, 3).map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  {item.item_name}: <strong>{item.quantity} {item.unit}</strong>
                                </div>
                              ))}
                              {d.items.length > 3 && (
                                <Link
                                  to={`/vehicle/${d._id}`}
                                  style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 2, display: 'inline-block' }}
                                >
                                  +{d.items.length - 3} more items →
                                </Link>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[d.status], background: statusColors[d.status] + '15', padding: '3px 8px', borderRadius: 20 }}>
                                {statusLabels[d.status]}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <Link to={`/vehicle/${d._id}`} className="btn btn-outline btn-sm" style={{ fontSize: 11 }}>
                                📋 Details
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}