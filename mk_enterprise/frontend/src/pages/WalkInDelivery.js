import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { deliveryApi, notificationApi } from '../utils/api';
import { UserCheck, Plus, X, Trash2, Calendar, Clock, Package, CheckCircle, AlertCircle, Search, Filter, ChevronDown, CreditCard } from 'lucide-react';
import WalkInDeliveryModal from '../components/WalkInDeliveryModal';
import PaymentModal from '../components/PaymentModal';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';

const QTY_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'bag', 'box', 'dozen', 'quintal', 'ton', 'mtr', 'other'];

const STATUS_META = {
  pending:       { label: 'Pending',       bg: 'var(--warning-light)', color: '#d97706', border: '#fde68a' },
  arriving_soon: { label: 'Arriving Soon', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  on_the_way:    { label: 'On the Way',    bg: 'var(--primary-light)', color: '#2563eb', border: '#bfdbfe' },
  delivered:     { label: 'Delivered',     bg: 'var(--success-light)', color: '#16a34a', border: '#bbf7d0' },
  not_delivered: { label: 'Not Delivered', bg: 'var(--danger-light)', color: '#dc2626', border: '#fecaca' },
};

export default function WalkInDelivery() {
  const { t } = useApp();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [paymentDelivery, setPaymentDelivery] = useState(null);
  const [detailsDelivery, setDetailsDelivery] = useState(null);
  const [filterDate, setFilterDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  });
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = showAll ? { all: 'true', delivery_type: 'walkin_delivery' } : { date: filterDate, delivery_type: 'walkin_delivery' };
      // WalkIn deliveries use vehicle_number = 'WALK-IN'
      const all = await deliveryApi.getAll({ ...params, all: showAll ? 'true' : undefined, date: showAll ? undefined : filterDate });
      // Filter only walk-in entries (vehicle_number === 'WALK-IN' or delivery_type === 'walkin_delivery')
      setDeliveries(all.filter(d => d.vehicle_number === 'WALK-IN' || d.delivery_type === 'walkin_delivery'));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterDate, showAll]);

  const openModal = () => {
    setShowModal(true);
  };

  const markStatus = async (id, status) => {
    try {
      await deliveryApi.updateStatus(id, status);
      toast.success(`Marked as ${STATUS_META[status]?.label}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleMarkWalkinPaid = async (id, mode) => {
    try {
      await deliveryApi.updatePayment(id, 'paid', mode || 'cash');
      toast.success('Walk-in delivery marked as paid');
      setPaymentDelivery(null);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this walk-in delivery record?')) return;
    try {
      await deliveryApi.delete(id);
      toast.success('Deleted');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const filtered = deliveries.filter(d =>
    !search ||
    d.supplier?.toLowerCase().includes(search.toLowerCase()) ||
    d.notes?.toLowerCase().includes(search.toLowerCase()) ||
    d.items?.some(i => i.item_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const todayCount = deliveries.filter(d => {
    const today = new Date().toISOString().slice(0, 10);
    return (d.arrival_date_ist || '').slice(0, 10) === today;
  }).length;

  const pendingCount = deliveries.filter(d => d.status === 'pending' || d.status === 'arriving_soon').length;
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--primary)', display: 'flex' }}><UserCheck size={22} /></span>
            <span>Walk-in Delivery</span>
          </div>
          <div className="page-subtitle">Record and manage counter/walk-in deliveries</div>
        </div>
        <button className="btn btn-primary" onClick={openModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
          <Plus size={14} /> New Walk-in
        </button>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: "Today's Entries", value: todayCount, icon: <Package size={28} />, bg: 'var(--primary-light)', color: '#2563eb' },
          { label: 'Pending / Coming', value: pendingCount, icon: <Clock size={28} />, bg: 'var(--warning-light)', color: '#d97706' },
          { label: 'Delivered Today', value: deliveredCount, icon: <CheckCircle size={28} />, bg: 'var(--success-light)', color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="card" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="form-control" placeholder="Search by supplier, item..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, borderRadius: 8, fontSize: 14 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            <Calendar size={14} />
            <input type="date" className="form-control" value={filterDate} onChange={e => { setFilterDate(e.target.value); setShowAll(false); }} style={{ width: 160, borderRadius: 8, fontSize: 13 }} disabled={showAll} />
          </label>
          <button 
            className={`btn ${showAll ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowAll(!showAll)}
            style={{ borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '6px 14px' }}
          >
            All History
          </button>
          <div style={{ marginLeft: 'auto', background: 'var(--bg-hover)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>
            {filtered.length} records
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="card" style={{ borderRadius: 12 }}>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-icon"><Package size={48} color="#94a3b8" /></div>
              <div className="empty-text">No walk-in deliveries found</div>
              <div className="empty-sub">Click "+ New Walk-in" to record one</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>Time</th>
                    <th style={{ padding: '12px 16px' }}>Supplier / Party</th>
                    <th style={{ padding: '12px 16px' }}>Items</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const sm = STATUS_META[d.status] || STATUS_META.pending;
                    return (
                      <tr key={d._id} 
                        style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => setDetailsDelivery(d)}
                      >
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                            {d.expected_arrival_ist || new Date(d.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {new Date(d.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                          {d.supplier || 'Walk-in Customer'}
                          {d.notes && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>{d.notes}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {d.items?.slice(0, expandedRows[d._id] ? d.items.length : 2).map((item, i) => (
                            <div key={i} style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                              <strong>{item.quantity}</strong> {item.unit} {item.item_name}
                            </div>
                          ))}
                          {d.items?.length > 2 && (
                            <div 
                              onClick={(e) => { e.stopPropagation(); toggleRow(d._id); }}
                              style={{ fontSize: 11.5, color: '#4f46e5', cursor: 'pointer', marginTop: 4, fontWeight: 600 }}
                            >
                              {expandedRows[d._id] ? 'Show less' : `+${d.items.length - 2} more items (Click to see more)`}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                            {d.status === 'delivered' ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {sm.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {d.status !== 'delivered' && (
                              <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); markStatus(d._id, 'delivered'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                                <CheckCircle size={12} /> Delivered
                              </button>
                            )}
                            {d.status !== 'not_delivered' && d.status !== 'delivered' && (
                              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); markStatus(d._id, 'not_delivered'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                                <AlertCircle size={12} /> Not Delivered
                              </button>
                            )}
                            {d.payment_status !== 'paid' && (
                              <button className="btn btn-warning btn-sm" onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPaymentDelivery(d);
                              }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>
                                <CreditCard size={12} /> Mark Paid {(() => {
                                  const amt = d.items?.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0);
                                  return amt > 0 ? `(₹${amt.toLocaleString('en-IN')})` : '';
                                })()}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {showModal && <WalkInDeliveryModal onClose={() => setShowModal(false)} onSuccess={load} userRole="admin" />}
      
      {paymentDelivery && (
        <PaymentModal 
          isOpen={true} 
          onClose={() => setPaymentDelivery(null)}
          onConfirm={(mode) => handleMarkWalkinPaid(paymentDelivery._id, mode)}
          amount={paymentDelivery?.items?.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0) || 0}
        />
      )}
      
      <DeliveryDetailsModal 
        isOpen={!!detailsDelivery}
        onClose={() => setDetailsDelivery(null)}
        delivery={detailsDelivery}
      />
    </div>
  );
}
