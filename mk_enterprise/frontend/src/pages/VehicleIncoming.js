import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi, tripApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Truck, Calendar, CheckCircle, Clock, User, AlertTriangle, FileText, X, Home, ChevronRight, Package, Car, MapPin, ArrowUpRight, ArrowDownLeft, UserCheck } from 'lucide-react';

function getTodayIST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

const TAB_CONFIG = {
  all:      { label: 'All',              icon: <Package size={14} />, color: '#1e293b' },
  incoming: { label: 'Incoming',         icon: <ArrowDownLeft size={14} />, color: '#2563eb' },
  walkin:   { label: 'Walk-in Delivery', icon: <UserCheck size={14} />, color: '#7c3aed' },
  outgoing: { label: 'Outgoing (Trips)', icon: <ArrowUpRight size={14} />, color: '#b45309' },
};

export default function VehicleIncoming() {
  const [deliveries, setDeliveries] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [viewAll, setViewAll] = useState(false);
  const [sortBy, setSortBy] = useState('time_desc');
  const [activeTab, setActiveTab] = useState('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadDeliveries = (date, all) => {
    return deliveryApi.getAll(all ? { all: true } : { date })
      .then(setDeliveries)
      .catch(e => toast.error(e.message));
  };

  const loadTrips = () => {
    return tripApi.getAll({ limit: 100 })
      .then(res => setTrips(res.trips || []))
      .catch(e => console.error('Failed to load trips', e));
  };

  const loadAll = (date, all) => {
    setLoading(true);
    Promise.all([loadDeliveries(date, all), loadTrips()])
      .finally(() => setLoading(false));
  };

  const pollAll = (date, all) => {
    Promise.all([loadDeliveries(date, all), loadTrips()]);
  };

  useEffect(() => { 
    loadAll(selectedDate, viewAll); 
    const interval = setInterval(() => pollAll(selectedDate, viewAll), 5000);
    return () => clearInterval(interval);
  }, [selectedDate, viewAll]);

  const statusConfig = {
    pending:        { label: 'Pending',       bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: <Clock size={12} /> },
    on_the_way:     { label: 'On the Way',    bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: <Truck size={12} /> },
    arriving_soon:  { label: 'Arriving Soon', bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: <AlertTriangle size={12} /> },
    delivered:      { label: 'Delivered',     bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', icon: <CheckCircle size={12} /> },
    not_delivered:  { label: 'Not Delivered', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: <X size={12} /> },
    active:         { label: 'On Trip',       bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', icon: <Truck size={12} /> },
    completed:      { label: 'Completed',     bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: <CheckCircle size={12} /> },
  };

  const getStatusBadge = (status) => {
    const config = statusConfig[status] || { label: status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: <Clock size={12} /> };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
        fontSize: '12px', fontWeight: 700, fontFamily: "'Inter', sans-serif",
        background: config.bg, color: config.color, border: `1px solid ${config.border}`
      }}>
        {config.icon} {config.label}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const badges = {
      incoming: { label: '🚛 Incoming', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
      walkin:   { label: '🚶 Walk-in', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
      outgoing: { label: '📦 Outgoing', bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
    };
    const b = badges[type] || badges.incoming;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20,
        fontSize: '11.5px', fontWeight: 700, fontFamily: "'Inter', sans-serif",
        background: b.bg, color: b.color, border: `1px solid ${b.border}`
      }}>
        {b.label}
      </span>
    );
  };

  // Normalize deliveries and trips into a unified list
  const normalizeDelivery = (d) => ({
    _id: d._id,
    source: 'delivery',
    vehicle_number: d.vehicle_number || '—',
    driver_name: d.driver_name || '',
    supplier: d.supplier || '',
    type: d.delivery_type || (d.vehicle_number?.toUpperCase().includes('WALK') ? 'walkin' : 'incoming'),
    expected_arrival: d.expected_arrival,
    expected_arrival_ist: d.expected_arrival_ist || '',
    arrival_date_ist: d.arrival_date_ist || getTodayIST(),
    items: d.items || [],
    status: d.status,
    delivered_at_ist: d.delivered_at_ist || '',
    link: `/vehicle/${d._id}`,
  });

  const normalizeTrip = (t) => {
    const leg = t.legs?.[0] || {};
    const cargoItems = [];
    (t.legs || []).forEach(l => {
      (l.cargo || []).forEach(c => {
        if (c.items && c.items.length > 0) {
          c.items.forEach(item => cargoItems.push({ item_name: item.name, quantity: item.quantity, unit: 'pcs' }));
        } else {
          (c.goods_types || []).forEach(g => cargoItems.push({ item_name: g, quantity: 1, unit: 'pcs' }));
        }
      });
    });
    return {
      _id: t._id,
      source: 'trip',
      vehicle_number: t.vehicle_number || '—',
      driver_name: t.driver_name || '',
      supplier: '',
      type: 'outgoing',
      expected_arrival: t.started_at || t.createdAt,
      expected_arrival_ist: new Date(t.started_at || t.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
      arrival_date_ist: new Date(t.started_at || t.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' }),
      items: cargoItems,
      status: t.status,
      delivered_at_ist: t.completed_at ? new Date(t.completed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'short' }) : '',
      link: `/trip/${t._id}`,
      origin: leg.origin || '',
      destination: leg.destination || '',
      total_expenses: t.total_expenses || 0,
      trip_type: t.type,
    };
  };

  const allNormalized = [
    ...deliveries.map(normalizeDelivery),
    ...trips.map(normalizeTrip),
  ];

  // Filter by active tab
  const filtered = activeTab === 'all' ? allNormalized
    : activeTab === 'incoming' ? allNormalized.filter(r => r.type === 'incoming')
    : activeTab === 'walkin' ? allNormalized.filter(r => r.type === 'walkin' || r.type === 'walkin_delivery')
    : allNormalized.filter(r => r.type === 'outgoing');

  // Group by date
  const grouped = filtered.reduce((acc, d) => {
    const dateKey = d.arrival_date_ist || getTodayIST();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(d);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Sort entries within each group
  const sortEntries = (entries) => entries.slice().sort((a, b) => {
    switch (sortBy) {
      case 'time_asc': return new Date(a.expected_arrival) - new Date(b.expected_arrival);
      case 'time_desc': return new Date(b.expected_arrival) - new Date(a.expected_arrival);
      case 'vehicle_asc': return (a.vehicle_number || '').localeCompare(b.vehicle_number || '');
      case 'vehicle_desc': return (b.vehicle_number || '').localeCompare(a.vehicle_number || '');
      case 'status': return (a.status || '').localeCompare(b.status || '');
      case 'type': return (a.type || '').localeCompare(b.type || '');
      default: return 0;
    }
  });

  // Counts for tab badges
  const counts = {
    all: allNormalized.length,
    incoming: allNormalized.filter(r => r.type === 'incoming').length,
    walkin: allNormalized.filter(r => r.type === 'walkin' || r.type === 'walkin_delivery').length,
    outgoing: allNormalized.filter(r => r.type === 'outgoing').length,
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <Truck size={24} />
            </span>
            <span>Vehicle Management</span>
          </div>
          <div className="page-subtitle">Track incoming, walk-in, and outgoing vehicle movements</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ width: 155, borderRadius: 8, fontSize: 13, padding: '6px 10px', fontWeight: 600, cursor: 'pointer' }}
          >
            <option value="time_desc">Latest First</option>
            <option value="time_asc">Oldest First</option>
            <option value="vehicle_asc">Vehicle A-Z</option>
            <option value="vehicle_desc">Vehicle Z-A</option>
            <option value="status">Status</option>
            <option value="type">Type</option>
          </select>
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
              loadAll(selectedDate, next);
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

      {/* ── TAB BAR ── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20, padding: '4px',
        background: '#f1f5f9', borderRadius: 14, flexWrap: 'wrap'
      }}>
        {Object.entries(TAB_CONFIG).map(([key, cfg]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: "'Inter', sans-serif",
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? cfg.color : '#64748b',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {cfg.icon} {cfg.label}
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
                background: isActive ? cfg.color : '#e2e8f0',
                color: isActive ? '#fff' : '#64748b',
                marginLeft: 2,
              }}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="loading"><span className="spinner"></span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <div className="empty-icon" style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
          <div className="empty-text" style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>No Records Found</div>
          <div className="empty-sub" style={{ fontSize: 13.5, color: '#64748b' }}>
            {viewAll ? 'No records exist yet.' : `No vehicle movements on ${selectedDate}`}
          </div>
        </div>
      ) : (
        <div>
          {(viewAll ? sortedDates : sortedDates.filter(d => !viewAll ? d === selectedDate : true)).map(dateKey => {
            const entries = sortEntries(grouped[dateKey] || []);
            if (!entries.length) return null;
            const hasMultiple = entries.length > 1;

            return (
              <div key={dateKey} className="card" style={{ 
                marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0',
                background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' 
              }}>
                <div className="card-header" style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#f8fafc', padding: '12px 18px', borderBottom: '1px solid #e2e8f0',
                  flexWrap: 'wrap', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4f46e5', display: 'flex', alignItems: 'center' }}>
                      <Calendar size={16} />
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1e293b' }}>
                      {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                      })}
                    </span>
                    <span className="badge badge-primary" style={{ fontSize: 11, background: '#e0e7ff', color: '#4f46e5', padding: '3px 8px', borderRadius: 12 }}>
                      {entries.length} record{entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#2563eb' }}>{entries.filter(e => e.type === 'incoming').length} incoming</span>
                    <span style={{ color: '#7c3aed' }}>{entries.filter(e => e.type === 'walkin' || e.type === 'walkin_delivery').length} walk-in</span>
                    <span style={{ color: '#b45309' }}>{entries.filter(e => e.type === 'outgoing').length} outgoing</span>
                  </div>
                </div>

                <div className="card-body no-pad" style={{ background: '#fff' }}>
                  {isMobile ? (
                    /* ── MOBILE CARDS ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                      {entries.map(d => (
                        <div key={d._id} onClick={() => navigate(d.link)} style={{
                          background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.01)', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'monospace', fontSize: 14.5 }}>
                                  {d.vehicle_number}
                                </span>
                                {getTypeBadge(d.type)}
                              </div>
                              {d.driver_name && (
                                <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: 500 }}>
                                  <User size={12} /> {d.driver_name}
                                </div>
                              )}
                            </div>
                            {getStatusBadge(d.status)}
                          </div>

                          {d.type === 'outgoing' ? (
                            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, color: '#475569' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <MapPin size={12} className="text-primary" />
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.origin} → {d.destination}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600, color: '#64748b' }}>Started:</span>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.expected_arrival_ist}</span>
                              </div>
                              {d.total_expenses > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                  <span style={{ fontWeight: 600, color: '#64748b' }}>Expenses:</span>
                                  <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{d.total_expenses.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              {d.items.length > 0 && (
                                <div style={{ marginTop: 6, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                                  {d.items.slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#475569' }}>
                                      {item.item_name}: <strong>{item.quantity} {item.unit}</strong>
                                    </div>
                                  ))}
                                  {d.items.length > 3 && <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>+{d.items.length - 3} more</span>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: 12, color: '#475569' }}>
                              {d.supplier && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontWeight: 600, color: '#64748b' }}>Supplier:</span>
                                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.supplier}</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600, color: '#64748b' }}>Expected:</span>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.expected_arrival_ist || '—'}</span>
                              </div>
                              {d.items.length > 0 && (
                                <div style={{ marginTop: 6, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                                  {d.items.slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#475569' }}>
                                      {item.item_name}: <strong>{item.quantity} {item.unit}</strong>
                                    </div>
                                  ))}
                                  {d.items.length > 3 && <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>+{d.items.length - 3} more</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* ── DESKTOP TABLE ── */
                    <div className="table-wrap" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                            {['Vehicle / Driver', 'Type', 'Route / Supplier', 'Time', 'Items / Cargo', 'Status', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((d, idx) => (
                            <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', transition: 'all 0.2s', cursor: 'pointer' }}
                                onClick={() => navigate(d.link)}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                            >
                              {/* Vehicle / Driver */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: '14px' }}>
                                  {d.vehicle_number}
                                </div>
                                {d.driver_name && (
                                  <div style={{ fontSize: '11.5px', fontFamily: "'Inter', sans-serif", color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <User size={11} /> {d.driver_name}
                                  </div>
                                )}
                              </td>
                              {/* Type */}
                              <td style={{ padding: '12px 16px' }}>
                                {getTypeBadge(d.type)}
                              </td>
                              {/* Route / Supplier */}
                              <td style={{ padding: '12px 16px', fontFamily: "'Inter', sans-serif" }}>
                                {d.type === 'outgoing' ? (
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <MapPin size={12} className="text-primary" /> {d.origin} → {d.destination}
                                    </div>
                                    {d.total_expenses > 0 && (
                                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: 3 }}>
                                        Expenses: ₹{d.total_expenses.toLocaleString('en-IN')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#1e293b', fontWeight: 600 }}>{d.supplier || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                                )}
                              </td>
                              {/* Time */}
                              <td style={{ padding: '12px 16px', fontSize: '12.5px', color: '#334155', fontFamily: "'Inter', sans-serif" }}>
                                <div style={{ fontWeight: 600 }}>{d.expected_arrival_ist || '—'}</div>
                                {d.status === 'delivered' && d.delivered_at_ist && (
                                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={11} /> Delivered: {d.delivered_at_ist}
                                  </div>
                                )}
                                {d.status === 'completed' && d.delivered_at_ist && (
                                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={11} /> Ended: {d.delivered_at_ist}
                                  </div>
                                )}
                              </td>
                              {/* Items / Cargo */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'Inter', sans-serif" }}>
                                  {d.items.slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ fontSize: '12px', color: '#475569' }}>
                                      {item.item_name}: <strong style={{ color: '#1e293b' }}>{item.quantity} {item.unit}</strong>
                                    </div>
                                  ))}
                                  {d.items.length > 3 && (
                                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      +{d.items.length - 3} more items <ChevronRight size={11} />
                                    </span>
                                  )}
                                  {d.items.length === 0 && <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>}
                                </div>
                              </td>
                              {/* Status */}
                              <td style={{ padding: '12px 16px' }}>
                                {getStatusBadge(d.status)}
                              </td>
                              {/* Actions */}
                              <td style={{ padding: '12px 16px' }}>
                                <Link to={d.link} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '12px', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                                  onClick={e => e.stopPropagation()}
                                >
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