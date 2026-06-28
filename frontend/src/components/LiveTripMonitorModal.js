import React, { useState, useEffect } from 'react';
import { X, Truck, Clock, MapPin, DollarSign, Receipt, Package, TrendingUp, IndianRupee, ChevronDown, ChevronUp } from 'lucide-react';
import { walkinApi } from '../utils/api';
import toast from 'react-hot-toast';

import { useNavigate } from 'react-router-dom';

export default function LiveTripMonitorModal({ trip, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [liveInventory, setLiveInventory] = useState([]);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    fetchLiveStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveStats, 30000);
    
    // Freeze background scrolling
    document.body.style.overflow = 'hidden';
    
    return () => {
      clearInterval(interval);
      document.body.style.overflow = 'auto'; // Restore background scrolling
    };
  }, [trip._id]);

  const fetchLiveStats = async () => {
    try {
      const res = await walkinApi.getTripLiveStats(trip._id);
      setStats(res.stats);
      setLiveInventory(res.liveInventory);
    } catch (err) {
      toast.error('Failed to fetch live stats');
    } finally {
      setLoading(false);
    }
  };

  const formatIST = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '12px', zIndex: 9999 }}>
      <div 
        className="live-monitor-modal"
        onClick={e => e.stopPropagation()} 
        style={{ background: '#f8fafc', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden', margin: '5vh auto 0' }}
      >
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#dbeafe', color: '#1d4ed8', padding: '8px', borderRadius: '10px' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Live Trip Monitor</div>
              <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #34d399' }}></span>
                Live Updates Active
              </div>
            </div>
          </div>
          <button style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading && !stats ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>Loading live trip data...</div>
          ) : (
            <>
              {/* Trip Info Card */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Manager</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{trip.manager_id?.display_name || trip.manager_id?.username}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Vehicle</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={14} /> {trip.vehicle_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Destination</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {trip.destination}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Started At</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {formatIST(trip.started_at)}</div>
                </div>
              </div>

              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Revenue</div>
                    <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px', borderRadius: 8 }}><IndianRupee size={16} /></div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>₹{stats?.totalRevenue.toLocaleString('en-IN') || 0}</div>
                </div>

                <div 
                  style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', borderLeft: '4px solid #10b981', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  onClick={() => setShowPayments(!showPayments)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Cash Collected</div>
                    <div style={{ background: '#ecfdf5', color: '#10b981', padding: '6px', borderRadius: 8 }}><IndianRupee size={16} /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>₹{stats?.cashCollected.toLocaleString('en-IN') || 0}</div>
                    {showPayments ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                  </div>
                  
                  {showPayments && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>Cash:</span>
                        <span style={{ fontWeight: 600 }}>₹{stats?.payments?.cash?.toLocaleString('en-IN') || 0}</span>
                      </div>
                      {(stats?.payments?.upi > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#64748b' }}>UPI:</span>
                          <span style={{ fontWeight: 600 }}>₹{stats?.payments?.upi?.toLocaleString('en-IN') || 0}</span>
                        </div>
                      )}
                      {(stats?.payments?.cheque > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#64748b' }}>Cheque:</span>
                          <span style={{ fontWeight: 600 }}>₹{stats?.payments?.cheque?.toLocaleString('en-IN') || 0}</span>
                        </div>
                      )}
                      {(stats?.payments?.other > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Other:</span>
                          <span style={{ fontWeight: 600 }}>₹{stats?.payments?.other?.toLocaleString('en-IN') || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div 
                  style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', borderLeft: '4px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  onClick={() => {
                    onClose();
                    const dateStr = trip.started_at ? new Date(trip.started_at).toISOString().split('T')[0] : '';
                    navigate('/invoices', { state: { managerId: trip.manager_id?._id, date: dateStr } });
                  }}
                  title="View Invoices"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Invoices Cut</div>
                    <div style={{ background: '#f5f3ff', color: '#8b5cf6', padding: '6px', borderRadius: 8 }}><Receipt size={16} /></div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{stats?.totalInvoices || 0}</div>
                </div>
              </div>

              {/* Live Inventory Table */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#334155' }}>
                  <Package size={16} /> Live Inventory Status
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>Product Name</th>
                        <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>Loaded</th>
                        <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>Sold</th>
                        <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' }}>Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveInventory.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No inventory loaded on this trip</td>
                        </tr>
                      ) : (
                        liveInventory.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < liveInventory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#334155' }}>{item.product_name}</td>
                            <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>{item.loaded_qty}</td>
                            <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{item.sold_qty}</td>
                            <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                              <span style={{ 
                                display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                background: item.remaining_qty > 0 ? '#eff6ff' : '#fee2e2',
                                color: item.remaining_qty > 0 ? '#3b82f6' : '#ef4444'
                              }}>
                                {item.remaining_qty}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
