import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { managerApi } from '../utils/api';
import { Truck, MapPin, Package, CheckCircle, Plus, User, Eye, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import WalkinManagerAssignModal from './WalkinManagerAssignModal';
import AdminAssignVehicleModal from './AdminAssignVehicleModal';
import AdminReinforcementModal from './AdminReinforcementModal';
import LiveTripMonitorModal from './LiveTripMonitorModal';

export default function HawkEye() {
  const [trips, setTrips] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModalTrip, setAssignModalTrip] = useState(null);
  const [assignVehicleModalManager, setAssignVehicleModalManager] = useState(null);
  const [reinforcementModalTrip, setReinforcementModalTrip] = useState(null);
  const [liveMonitorTrip, setLiveMonitorTrip] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [tripsRes, managersRes] = await Promise.all([
        api.get('/walkin/all-trips'),
        managerApi.getAll()
      ]);
      setTrips(Array.isArray(tripsRes) ? tripsRes : (tripsRes?.trips || []));
      setManagers(managersRes?.managers || (Array.isArray(managersRes) ? managersRes : []));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Hawk Eye data');
    } finally {
      setLoading(false);
    }
  };

  const walkinManagers = managers.filter(m => ['walkin_manager', 'temp_manager'].includes(m.role));
  const activeTrips = trips.filter(t => t.status === 'active');
  const completedTrips = trips.filter(t => t.status === 'completed');
  
  const idleManagers = walkinManagers.filter(m => !activeTrips.find(t => 
    (t.manager_id?._id === m._id || t.manager_id === m._id)
  ));

  return (
    <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
      {assignModalTrip && (
        <WalkinManagerAssignModal 
          trip={assignModalTrip} 
          onClose={() => setAssignModalTrip(null)}
          onSuccess={() => loadData()}
        />
      )}
      {assignVehicleModalManager && (
        <AdminAssignVehicleModal
          manager={assignVehicleModalManager}
          onClose={() => setAssignVehicleModalManager(null)}
          onSuccess={(newTrip) => {
            loadData();
            if (newTrip) {
              // The backend populates manager_id with display_name and username in some routes,
              // but in admin-assign-vehicle it might just be the ObjectId or the manager object from the db.
              // To ensure the UI works smoothly in the next modal, let's attach the manager object we already have.
              setAssignModalTrip({ ...newTrip, manager_id: assignVehicleModalManager });
            }
          }}
        />
      )}

      <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 200px 120px minmax(250px, 2fr) 120px', gap: 16, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>Manager / Trip Info</div>
            <div>Vehicle & Driver</div>
            <div>Status</div>
            <div>Loaded Inventory</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          <div style={{ background: '#fff' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading Hawk Eye data...</div>
            ) : (idleManagers.length === 0 && activeTrips.length === 0 && completedTrips.length === 0) ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No managers or trips at the moment.</div>
            ) : (
              <>
                {/* IDLE MANAGERS */}
                {idleManagers.map((manager, idx) => (
                  <div key={`idle-${manager._id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 200px 120px minmax(250px, 2fr) 120px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 700, fontSize: 16 }}>
                        {(manager.display_name || manager.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2 }}>
                          {manager.display_name || manager.username}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} /> {manager.role === 'temp_manager' ? 'Temp Manager' : manager.role === 'walkin_manager' ? 'Walk-in Manager' : 'Manager'}
                        </div>
                      </div>
                    </div>
                    <div><span style={{ color: '#94a3b8', fontSize: 13 }}>No Vehicle Assigned</span></div>
                    <div>
                      <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Idle</span>
                    </div>
                    <div><span style={{ color: '#94a3b8', fontSize: 12 }}>-</span></div>
                    <div style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => setAssignVehicleModalManager(manager)}
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#059669', borderColor: '#a7f3d0', background: '#fff' }}
                      >
                        <Truck size={14} /> Assign Vehicle
                      </button>
                    </div>
                  </div>
                ))}

                {/* ACTIVE TRIPS */}
                {activeTrips.map((trip, idx) => (
                  <div key={`active-${trip._id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 200px 120px minmax(250px, 2fr) 120px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', fontWeight: 700, fontSize: 16 }}>
                        {(trip.manager_id?.display_name || trip.manager_id?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2 }}>
                          {trip.manager_id?.display_name || trip.manager_id?.username || '-'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {trip.destination || '-'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Truck size={14} /> {trip.vehicle_number || '-'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: trip.reinforcement?.vehicle_number ? 4 : 0 }}>Driver: {trip.driver_name || '-'}</div>
                      {trip.reinforcement?.vehicle_number && (
                        <div style={{ marginTop: 4, padding: '4px 6px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 11, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
                            🚛 {trip.reinforcement.vehicle_number}
                          </div>
                          <div style={{ fontSize: 11, color: '#78350f' }}>Dr: {trip.reinforcement.driver_name}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Active</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        {trip.initial_stock && trip.initial_stock.length > 0 ? (
                          <>
                            {trip.initial_stock.slice(0, 2).map((item, i) => (
                              <div key={i} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, color: '#334155' }}>{item.quantity}x</span>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={item.product_name}>{item.product_name}</span>
                              </div>
                            ))}
                            {trip.initial_stock.length > 2 && (
                              <div 
                                style={{ color: '#64748b', fontSize: 12, fontWeight: 600, marginTop: 2, cursor: 'help' }}
                                title={trip.initial_stock.slice(2).map(item => `${item.quantity}x ${item.product_name}`).join('\n')}
                              >
                                + {trip.initial_stock.length - 2} more items
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 13 }}>No inventory loaded</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <button 
                        onClick={() => setLiveMonitorTrip(trip)}
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0f172a', borderColor: '#cbd5e1', background: '#f8fafc' }}
                      >
                        <Eye size={14} /> Live Monitor
                      </button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => setReinforcementModalTrip(trip)}
                          className="btn btn-outline" 
                          style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', borderColor: '#fde68a', background: '#fffbeb' }}
                          title={trip.reinforcement?.vehicle_number ? 'Update Reinforcement' : 'Send Reinforcement'}
                        >
                          <Truck size={14} /> {trip.reinforcement?.vehicle_number ? 'Update Reinf.' : 'Send Reinf.'}
                        </button>
                        <button 
                          onClick={() => setAssignModalTrip(trip)}
                          className="btn btn-outline" 
                          style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb', borderColor: '#bfdbfe', background: '#fff' }}
                        >
                          <Package size={14} /> Preload Stock
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* COMPLETED TRIPS */}
                {completedTrips.map((trip, idx) => (
                  <div key={`completed-${trip._id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 200px 120px minmax(250px, 2fr) 120px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < completedTrips.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s', background: '#f8fafc' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 700, fontSize: 16 }}>
                        {(trip.manager_id?.display_name || trip.manager_id?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 2 }}>
                          {trip.manager_id?.display_name || trip.manager_id?.username || '-'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {trip.destination || '-'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><Truck size={14} /> {trip.vehicle_number || '-'}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Driver: {trip.driver_name || '-'}</div>
                    </div>
                    <div>
                      <span style={{ background: '#d1fae5', color: '#047857', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Completed</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        <strong>Sales:</strong> ₹{trip.total_sales_amount?.toLocaleString() || 0}<br />
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Ended: {new Date(trip.completed_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => {
                          const dateObj = new Date(trip.completed_at || trip.started_at);
                          // Adjust for IST to avoid timezone date shifts
                          const istDate = new Date(dateObj.getTime() + (5.5 * 60 * 60 * 1000));
                          navigate('/daily-report', { 
                            state: { 
                              managerId: trip.manager_id?._id || trip.manager_id, 
                              date: istDate.toISOString().split('T')[0] 
                            } 
                          });
                        }}
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569', borderColor: '#cbd5e1', background: '#fff' }}
                      >
                        <FileText size={14} /> View Report
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      {assignVehicleModalManager && (
        <AdminAssignVehicleModal
          manager={assignVehicleModalManager}
          onClose={() => setAssignVehicleModalManager(null)}
          onSuccess={(newTrip) => {
            loadData();
            if (newTrip) {
              setAssignModalTrip(newTrip);
            }
          }}
        />
      )}

      {assignModalTrip && (
        <WalkinManagerAssignModal
          trip={assignModalTrip}
          onClose={() => setAssignModalTrip(null)}
          onSuccess={() => {
            loadData();
            toast.success('Inventory successfully loaded to trip!');
          }}
        />
      )}

      {reinforcementModalTrip && (
        <AdminReinforcementModal
          trip={reinforcementModalTrip}
          onClose={() => setReinforcementModalTrip(null)}
          onSuccess={(updatedTrip) => {
            loadData();
            // Automatically open the preload stock modal for this trip
            setAssignModalTrip(updatedTrip);
          }}
        />
      )}

      {liveMonitorTrip && (
        <LiveTripMonitorModal
          trip={liveMonitorTrip}
          onClose={() => setLiveMonitorTrip(null)}
        />
      )}
    </div>
  );
}

