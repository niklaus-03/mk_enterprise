import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi, tripApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Truck, Calendar, CheckCircle, Clock, User, AlertTriangle, FileText, X, Home, ChevronRight, Package, Car, MapPin, ArrowUpRight, ArrowDownLeft, UserCheck, ArrowLeft } from 'lucide-react';
import { useRegisterRefresh } from '../context/PullToRefreshContext';
import PaymentModal from '../components/PaymentModal';

function getTodayIST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

const TAB_CONFIG = {
  all:      { label: 'All',              icon: <Package size={14} />, color: 'var(--text)' },
  incoming: { label: 'Incoming',         icon: <ArrowDownLeft size={14} />, color: '#2563eb' },
  walkin:   { label: 'Walk-in Delivery', icon: <UserCheck size={14} />, color: '#7c3aed' },
  outgoing: { label: 'Outgoing (Trips)', icon: <ArrowUpRight size={14} />, color: '#b45309' },
};

export default function VehicleIncoming() {
  const { t } = useApp();
  const [deliveries, setDeliveries] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentConfirm, setPaymentConfirm] = useState(null);
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

  const loadTrips = (date, all) => {
    return tripApi.getAll({ limit: 100, date, all: all ? 'true' : undefined })
      .then(res => setTrips(res.trips || []))
      .catch(e => console.error('Failed to load trips', e));
  };

  const loadAll = (date, all) => {
    setLoading(true);
    Promise.all([loadDeliveries(date, all), loadTrips(date, all)])
      .finally(() => setLoading(false));
  };

  const pollAll = (date, all) => {
    Promise.all([loadDeliveries(date, all), loadTrips(date, all)]);
  };

  useEffect(() => { 
    loadAll(selectedDate, viewAll); 
    const interval = setInterval(() => pollAll(selectedDate, viewAll), 5000);
    return () => clearInterval(interval);
  }, [selectedDate, viewAll]);

  const refreshPage = useCallback(() => { loadAll(selectedDate, viewAll); }, [selectedDate, viewAll]);
  useRegisterRefresh(refreshPage);

  const statusConfig = {
    pending:        { label: 'Pending',       bg: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'var(--border)', icon: <Clock size={12} /> },
    on_the_way:     { label: 'On the Way',    bg: 'var(--primary-light)', color: '#2563eb', border: '#bfdbfe', icon: <Truck size={12} /> },
    arriving_soon:  { label: 'Arriving Soon', bg: 'var(--warning-light)', color: '#d97706', border: '#fde68a', icon: <AlertTriangle size={12} /> },
    arrived:        { label: 'Arrived',       bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe', icon: <MapPin size={12} /> },
    delivered:      { label: 'Delivered',     bg: 'var(--success-light)', color: '#059669', border: '#a7f3d0', icon: <CheckCircle size={12} /> },
    not_delivered:  { label: 'Not Delivered', bg: 'var(--danger-light)', color: '#dc2626', border: '#fecaca', icon: <X size={12} /> },
    active:         { label: 'On Trip',       bg: 'var(--success-light)', color: '#059669', border: '#a7f3d0', icon: <Truck size={12} /> },
    completed:      { label: 'Completed',     bg: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'var(--border)', icon: <CheckCircle size={12} /> },
  };

  const getStatusBadge = (status) => {
    const config = statusConfig[status] || { label: status, bg: 'var(--bg-hover)', color: 'var(--text-muted)', border: '#cbd5e1', icon: <Clock size={12} /> };
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
      incoming: { label: '🚛 Incoming', bg: 'var(--primary-light)', color: '#2563eb', border: '#bfdbfe' },
      walkin:   { label: '🚶 Walk-in', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
      outgoing: { label: '📦 Outgoing', bg: 'var(--warning-light)', color: '#b45309', border: '#fde68a' },
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
  const normalizeDelivery = (d) => {
    const allItems = (d.items || []).concat((d.suppliers_data || []).flatMap(s => s.items || []));
    const allSuppliers = (d.suppliers_data && d.suppliers_data.length > 0) 
      ? d.suppliers_data.map(s => s.supplier_name).join(', ') 
      : (d.supplier || '');

    return {
      _id: d._id,
      source: 'delivery',
      vehicle_number: d.vehicle_number || '—',
      driver_name: d.driver_name || '',
      supplier: allSuppliers,
      type: d.delivery_type || (d.vehicle_number?.toUpperCase().includes('WALK') ? 'walkin' : 'incoming'),
      expected_arrival: d.expected_arrival,
      expected_arrival_ist: d.expected_arrival_ist || '',
      arrival_date_ist: d.arrival_date_ist || getTodayIST(),
      items: allItems,
      status: d.status,
      delivered_at_ist: d.delivered_at_ist || '',
      link: `/vehicle/${d._id}`,
      payment_status: d.payment_status || 'unpaid',
      created_by: d.created_by ? (d.created_by.display_name || d.created_by.username) : '',
    };
  };

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
      case 'unpaid_first': {
        const aUnpaid = a.payment_status === 'unpaid' ? 0 : 1;
        const bUnpaid = b.payment_status === 'unpaid' ? 0 : 1;
        if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
        return new Date(b.expected_arrival) - new Date(a.expected_arrival);
      }
      case 'paid_first': {
        const aPaid = a.payment_status === 'paid' ? 0 : 1;
        const bPaid = b.payment_status === 'paid' ? 0 : 1;
        if (aPaid !== bPaid) return aPaid - bPaid;
        return new Date(b.expected_arrival) - new Date(a.expected_arrival);
      }
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, marginTop: '4px' }}>
              <Truck size={22} className="text-primary" /> Vehicle Management
            </div>
            <div className="page-subtitle" style={{ margin: 0 }}>Track incoming, walk-in, and outgoing vehicle movements</div>
          </div>
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
            <option value="unpaid_first">Unpaid First</option>
            <option value="paid_first">Paid First</option>
          </select>
          {!viewAll && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '6px 12px', background: 'var(--primary-light)', color: '#2563eb', borderRadius: 8, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} /> Today's Report
              </div>
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
            {viewAll ? "Today's Report" : 'All History'}
          </button>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 18,
        background: 'var(--border)', borderRadius: 12, padding: '4px 5px',
        width: 'fit-content', flexWrap: 'wrap'
      }}>
        {Object.entries(TAB_CONFIG).map(([key, cfg]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {cfg.icon} {cfg.label}
              {counts[key] > 0 && (
                <span style={{
                  background: isActive ? 'var(--primary)' : '#d1d5db',
                  color: isActive ? 'var(--bg-card)' : '#6b7280',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  marginLeft: 2,
                }}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="loading"><span className="spinner"></span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <div className="empty-icon" style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
          <div className="empty-text" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No Records Found</div>
          <div className="empty-sub" style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
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
                background: 'var(--bg-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' 
              }}>
                <div className="card-header" style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--bg)', padding: '12px 18px', borderBottom: '1px solid #e2e8f0',
                  flexWrap: 'wrap', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4f46e5', display: 'flex', alignItems: 'center' }}>
                      <Calendar size={16} />
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>
                      {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                      })}
                    </span>
                    <span className="badge badge-primary" style={{ fontSize: 11, background: 'var(--primary-light)', color: '#4f46e5', padding: '3px 8px', borderRadius: 12 }}>
                      {entries.length} record{entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#2563eb' }}>{entries.filter(e => e.type === 'incoming').length} incoming</span>
                    <span style={{ color: '#7c3aed' }}>{entries.filter(e => e.type === 'walkin' || e.type === 'walkin_delivery').length} walk-in</span>
                    <span style={{ color: '#b45309' }}>{entries.filter(e => e.type === 'outgoing').length} outgoing</span>
                  </div>
                </div>

                <div className="card-body no-pad" style={{ background: 'var(--bg-card)' }}>
                  {isMobile ? (
                    /* ── MOBILE CARDS ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                      {entries.map(d => (
                        <div key={d._id} onClick={() => navigate(d.link)} style={{
                          background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.01)', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 800, fontFamily: 'monospace', fontSize: 14.5 }}>
                                  {(d.vehicle_number || '').toUpperCase()}
                                </span>
                                {getTypeBadge(d.type)}
                                {(d.type === 'walkin' || d.type === 'walkin_delivery') && (
                                  <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{d.payment_status}</span>
                                )}
                              </div>
                              {d.driver_name && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: 500 }}>
                                  <User size={12} /> {d.driver_name}
                                </div>
                              )}
                            </div>
                            {getStatusBadge(d.status)}
                          </div>

                          {d.type === 'outgoing' ? (
                            <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <MapPin size={12} className="text-primary" />
                                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{d.origin} → {d.destination}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Started:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{d.expected_arrival_ist}</span>
                              </div>
                              {d.total_expenses > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Expenses:</span>
                                  <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{d.total_expenses.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              {d.items.length > 0 && (
                                <div style={{ marginTop: 6, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                                  {d.items.slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                      {item.item_name}: <strong>{item.quantity} {item.unit}</strong>
                                    </div>
                                  ))}
                                  {d.items.length > 3 && <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>+{d.items.length - 3} more</span>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                              {d.supplier && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Supplier:</span>
                                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{d.supplier}</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Expected:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{d.expected_arrival_ist || '—'}</span>
                              </div>
                              {d.items.length > 0 && (
                                <div style={{ marginTop: 6, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                                  {d.items.slice(0, 3).map((item, i) => (
                                    <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                          <tr style={{ background: 'var(--bg)', borderBottom: '1.5px solid #e2e8f0' }}>
                            {['Vehicle / Driver', 'Type', 'Route / Supplier', 'Time', 'Items / Cargo', 'Status'].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((d, idx) => (
                            <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', transition: 'all 0.2s', cursor: 'pointer' }}
                                onClick={() => navigate(d.link)}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)'}
                            >
                              {/* Vehicle / Driver */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: '14px' }}>
                                  {(d.vehicle_number || '').toUpperCase()}
                                </div>
                                {d.driver_name && (
                                  <div style={{ fontSize: '11.5px', fontFamily: "'Inter', sans-serif", color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <User size={11} /> {d.driver_name}
                                  </div>
                                )}
                                {(d.type === 'walkin' || d.type === 'walkin_delivery') && d.created_by && (
                                  <div style={{ fontSize: '11px', fontFamily: "'Inter', sans-serif", color: '#6366f1', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                    <UserCheck size={11} /> Received by: {d.created_by}
                                  </div>
                                )}
                              </td>
                              {/* Type */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                                  {getTypeBadge(d.type)}
                                  {(d.type === 'walkin' || d.type === 'walkin_delivery') && (
                                    <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                                      {d.payment_status}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* Route / Supplier */}
                              <td style={{ padding: '12px 16px', fontFamily: "'Inter', sans-serif" }}>
                                {d.type === 'outgoing' ? (
                                  <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <MapPin size={12} className="text-primary" /> {d.origin} → {d.destination}
                                    </div>
                                    {d.total_expenses > 0 && (
                                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: 3 }}>
                                        Expenses: ₹{d.total_expenses.toLocaleString('en-IN')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{d.supplier || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
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
                                    <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                      {item.item_name}: <strong style={{ color: 'var(--text)' }}>{item.quantity} {item.unit}</strong>
                                    </div>
                                  ))}
                                  {d.items.length > 3 && (
                                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      +{d.items.length - 3} more items <ChevronRight size={11} />
                                    </span>
                                  )}
                                  {d.items.length === 0 && <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>}
                                  {(d.type === 'walkin' || d.type === 'walkin_delivery') && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Amount: ₹{((d.items || []).reduce((sum, item) => sum + ((parseFloat(item.base_price) || parseFloat(item.final_price) || 0) * (parseFloat(item.quantity) || 0)), 0)).toLocaleString('en-IN')}</div>
                                      {d.payment_status === 'paid' && <div style={{ fontSize: '11px', color: '#64748b' }}>Mode: Cash</div>}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {getStatusBadge(d.status)}
                                {(d.type === 'walkin' || d.type === 'walkin_delivery') && d.payment_status === 'unpaid' && (
                                    <button
                                      className="btn btn-outline btn-sm"
                                      style={{ display: 'block', marginTop: 8, alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, fontSize: '10px', fontWeight: 700, color: '#059669', borderColor: '#34d399' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPaymentConfirm(d);
                                      }}
                                    >
                                      <CheckCircle size={10} /> Mark Paid
                                    </button>
                                )}
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

      {/* Payment Confirmation Modal */}
      <PaymentModal
        isOpen={!!paymentConfirm}
        onClose={() => setPaymentConfirm(null)}
        amount={((paymentConfirm?.items || []).reduce((sum, item) => sum + ((parseFloat(item.base_price) || parseFloat(item.final_price) || 0) * (parseFloat(item.quantity) || 0)), 0))}
        onConfirm={async (mode, notes, paidAmt, paymentAction) => {
          try {
            await deliveryApi.updatePayment(paymentConfirm._id, 'paid', mode, notes, paidAmt, paymentAction);
            toast.success('Marked as paid!');
            setPaymentConfirm(null);
            loadAll(selectedDate, viewAll);
          } catch (e) {
            toast.error(e.message || 'Failed to mark paid');
          }
        }}
      />
    </div>
  );
}