import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Truck, MapPin, Package, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HawkEye() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
    const interval = setInterval(loadTrips, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadTrips = async () => {
    try {
      const res = await api.get('/walkin/all-trips');
      setTrips(Array.isArray(res.data) ? res.data : (res.data?.trips || []));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load active trips');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading Hawk Eye data...</div>;

  const activeTrips = (trips || []).filter(t => t.status === 'active');
  const completedTrips = (trips || []).filter(t => t.status === 'completed');

  return (
    <div style={{ padding: 20 }}>
      <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Truck color="#2563eb" /> Active Walk-in Deliveries ({activeTrips.length})
      </h3>
      
      {activeTrips.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12, textAlign: 'center', color: '#64748b' }}>
          No active walk-in trips at the moment.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {activeTrips.map(trip => (
            <div key={trip._id} style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 15, marginBottom: 15 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{trip.manager_id?.display_name || trip.manager_id?.username}</div>
                <div style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Active</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569' }}>
                  <Truck size={16} /> <strong>Vehicle:</strong> {trip.vehicle_number} (Driver: {trip.driver_name})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569' }}>
                  <MapPin size={16} /> <strong>Destination:</strong> {trip.destination}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#475569', marginTop: 10 }}>
                  <Package size={16} style={{ marginTop: 2 }} /> 
                  <div>
                    <strong>Loaded Inventory:</strong>
                    <ul style={{ margin: 0, paddingLeft: 20, marginTop: 5, fontSize: 13 }}>
                      {trip.initial_stock?.map((item, idx) => (
                        <li key={idx}>{item.product_name}: {item.quantity} units (₹{item.amount})</li>
                      ))}
                      {(!trip.initial_stock || trip.initial_stock.length === 0) && <li>No inventory loaded</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 40, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckCircle color="#10b981" /> Recently Completed ({completedTrips.length})
      </h3>
      {completedTrips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {completedTrips.slice(0, 10).map(trip => (
            <div key={trip._id} style={{ background: '#f8fafc', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 15, marginBottom: 15 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{trip.manager_id?.display_name || trip.manager_id?.username}</div>
                <div style={{ background: '#d1fae5', color: '#047857', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Completed</div>
              </div>
              <div style={{ color: '#475569', fontSize: 14 }}>
                <div><strong>Vehicle:</strong> {trip.vehicle_number}</div>
                <div><strong>Sales Amount:</strong> ₹{trip.total_sales_amount?.toLocaleString()}</div>
                <div><strong>Ended:</strong> {new Date(trip.completed_at).toLocaleString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
