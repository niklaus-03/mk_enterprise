import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Truck, Calendar, ArrowLeft, CheckCircle, Clock, User, AlertTriangle, FileText, X, ArrowRight, Home, ChevronRight } from 'lucide-react';

function getTodayIST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

export default function VehicleIncoming() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [viewAll, setViewAll] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const fc = formatCurrency;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const load = (date, all) => {
    setLoading(true);
    deliveryApi.getAll(all ? { all: true } : { date })
      .then(setDeliveries)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(selectedDate, false); }, [selectedDate]);

  const statusConfig = {
    pending: { label: 'Pending', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: <Clock size={12} /> },
    on_the_way: { label: 'On the Way', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: <Truck size={12} /> },
    arriving_soon: { label: 'Arriving Soon', bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: <AlertTriangle size={12} /> },
    delivered: { label: 'Delivered', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', icon: <CheckCircle size={12} /> },
    not_delivered: { label: 'Not Delivered', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: <X size={12} /> },
  };

  const getStatusBadge = (status) => {
    const config = statusConfig[status] || { label: status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: <Clock size={12} /> };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: "'Inter', sans-serif",
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`
      }}>
        {config.icon}
        {config.label}
      </span>
    );
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
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <Truck size={24} />
            </span>
            <span>Incoming Vehicles</span>
          </div>
          <div className="page-subtitle">Date-wise history of all incoming deliveries</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!viewAll && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <Calendar size={14} />
              </span>
              <input
                type="date"
                className="form-control"
                value={selectedDate}
                max={getTodayIST()}
                style={{ width: 160, paddingLeft: 30, borderRadius: 8, fontSize: 13.5 }}
                onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
              />
            </div>
          )}
          <button
            className={`btn ${viewAll ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              const next = !viewAll;
              setViewAll(next);
              load(selectedDate, next);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, fontSize: 13 }}
          >
            <Calendar size={14} />
            {viewAll ? 'Date View' : 'All History'}
          </button>
          <Link to="/" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, fontSize: 13 }}>
            <Home size={14} /> Dashboard
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loading"><span className="spinner"></span></div>
      ) : deliveries.length === 0 ? (
        <div className="empty-state" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <div className="empty-icon" style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
          <div className="empty-text" style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>No Vehicles Found</div>
          <div className="empty-sub" style={{ fontSize: 13.5, color: '#64748b' }}>
            {viewAll ? 'No delivery records exist yet.' : `No deliveries registered on ${selectedDate}`}
          </div>
        </div>
      ) : (
        <div>
          {(viewAll ? sortedDates : [selectedDate]).map(dateKey => {
            const entries = grouped[dateKey] || [];
            if (!entries.length) return null;
            const hasMultiple = entries.length > 1;
            const cardBg = hasMultiple ? '#f0f7ff' : '#ffffff';
            const cardBorder = hasMultiple ? '1px solid #93c5fd' : '1px solid #e2e8f0';
            const headerBg = hasMultiple ? '#e0f2fe' : '#f8fafc';
            const headerBorder = hasMultiple ? '1px solid #93c5fd' : '1px solid #e2e8f0';

            return (
              <div key={dateKey} className="card" style={{ 
                marginBottom: 20, 
                borderRadius: 16, 
                border: cardBorder, 
                background: cardBg,
                boxShadow: hasMultiple ? '0 4px 14px rgba(37, 99, 235, 0.05)' : '0 1px 3px rgba(0,0,0,0.02)', 
                overflow: 'hidden' 
              }}>
                <div className="card-header" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: headerBg, 
                  padding: '12px 18px', 
                  borderBottom: headerBorder, 
                  flexWrap: 'wrap', 
                  gap: 8 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: hasMultiple ? '#0284c7' : '#4f46e5', display: 'flex', alignItems: 'center' }}>
                      <Calendar size={16} />
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1e293b' }}>
                      {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                      })}
                    </span>
                    <span className="badge badge-primary" style={{ fontSize: 11, background: hasMultiple ? '#bae6fd' : '#e0e7ff', color: hasMultiple ? '#0369a1' : '#4f46e5', padding: '3px 8px', borderRadius: 12 }}>
                      {entries.length} vehicle{entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                    <span style={{ color: '#16a34a' }}>{entries.filter(d => d.status === 'delivered').length} delivered</span>
                    {' · '}
                    <span style={{ color: '#2563eb' }}>{entries.filter(d => d.status !== 'delivered' && d.status !== 'not_delivered').length} active</span>
                  </div>
                </div>

                <div className="card-body no-pad" style={{ background: isMobile ? (hasMultiple ? '#f0f7ff' : '#f8fafc') : (hasMultiple ? '#f0f7ff' : '#fff') }}>
                  {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                      {entries.map(d => (
                        <div key={d._id} style={{
                          background: '#fff',
                          borderRadius: 12,
                          padding: 16,
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Link
                                  to={`/vehicle/${d._id}`}
                                  style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'monospace', fontSize: 14.5, letterSpacing: 0.5, textDecoration: 'none' }}
                                >
                                  {d.vehicle_number}
                                </Link>
                                {d.vehicle_number?.toUpperCase().includes('WALK') ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                                    🚶 Walk-in
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                                    🚛 Vehicle
                                  </span>
                                )}
                              </div>
                              {d.driver_name && (
                                <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: 500 }}>
                                  <User size={12} style={{ color: '#64748b' }} /> {d.driver_name}
                                </div>
                              )}
                            </div>
                            {getStatusBadge(d.status)}
                          </div>

                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 600, color: '#64748b' }}>Supplier:</span>
                              <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.supplier || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontWeight: 600, color: '#64748b' }}>Expected At:</span>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{d.expected_arrival_ist || '—'}</div>
                                {d.status === 'delivered' && d.delivered_at_ist && (
                                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                                    Delivered: {d.delivered_at_ist}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: 12.5 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Incoming Items:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {d.items.slice(0, 3).map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dashed #f1f5f9', color: '#475569' }}>
                                  <span>{item.item_name}</span>
                                  <strong style={{ color: '#1e293b' }}>{item.quantity} {item.unit}</strong>
                                </div>
                              ))}
                              {d.items.length > 3 && (
                                <Link
                                  to={`/vehicle/${d._id}`}
                                  style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                >
                                  +{d.items.length - 3} more items <ChevronRight size={12} />
                                </Link>
                              )}
                            </div>
                          </div>

                          <Link
                            to={`/vehicle/${d._id}`}
                            className="btn btn-outline btn-sm"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px', fontSize: 12.5, borderRadius: 8, fontWeight: 700, background: '#fafafa', marginTop: 4 }}
                          >
                            <FileText size={13} /> View Vehicle Details
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Vehicle No.</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Type</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Supplier</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Expected At</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Items</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((d, idx) => (
                            <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', transition: 'all 0.2s' }}>
                              <td style={{ padding: '12px 16px' }}>
                                <Link
                                  to={`/vehicle/${d._id}`}
                                  style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: '14px', textDecoration: 'none' }}
                                >
                                  {d.vehicle_number}
                                </Link>
                                {d.driver_name && (
                                  <div style={{ fontSize: '11.5px', fontFamily: "'Inter', sans-serif", color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <User size={11} /> {d.driver_name}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {d.vehicle_number?.toUpperCase().includes('WALK') ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: '11.5px', fontWeight: 700, fontFamily: "'Inter', sans-serif", background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                                    🚶 Walk-in
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: '11.5px', fontWeight: 700, fontFamily: "'Inter', sans-serif", background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                                    🚛 Vehicle
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{d.supplier || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                              <td style={{ padding: '12px 16px', fontSize: '12.5px', color: '#334155', fontFamily: "'Inter', sans-serif" }}>
                                <div style={{ fontWeight: 600 }}>{d.expected_arrival_ist || '—'}</div>
                                {d.status === 'delivered' && d.delivered_at_ist && (
                                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={11} /> Delivered: {d.delivered_at_ist}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'Inter', sans-serif" }}>
                                  {d.items.slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ fontSize: '12px', color: '#475569' }}>
                                      {item.item_name}: <strong style={{ color: '#1e293b' }}>{item.quantity} {item.unit}</strong>
                                    </div>
                                  ))}
                                  {d.items.length > 3 && (
                                    <Link
                                      to={`/vehicle/${d._id}`}
                                      style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                    >
                                      +{d.items.length - 3} more items <ChevronRight size={11} />
                                    </Link>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {getStatusBadge(d.status)}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <Link to={`/vehicle/${d._id}`} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '12px', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                                  <FileText size={12} /> Details
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}