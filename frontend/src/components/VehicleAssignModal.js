import React, { useState, useEffect } from 'react';
import { walkinApi } from '../utils/api';
import toast from 'react-hot-toast';
import { Truck, X, ShieldAlert, Send } from 'lucide-react';

export default function VehicleAssignModal({ onAssigned, isEdit = false, initialData = null, onClose }) {
  const [form, setForm] = useState({ vehicle_number: '', driver_name: '', destination: '' });
  const [loading, setLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const toTitleCase = (str) => {
    return str.split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');
  };

  useEffect(() => {
    if (isEdit && initialData) {
      setForm({
        vehicle_number: initialData.vehicle_number || '',
        driver_name: initialData.driver_name || '',
        destination: initialData.destination || ''
      });
    }
  }, [isEdit, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        const res = await walkinApi.updateVehicle(form);
        toast.success(`Vehicle updated! (${res.data.remaining_updates} updates remaining)`);
      } else {
        await walkinApi.assignVehicle(form);
        toast.success('Vehicle assigned! You can now load inventory.');
      }
      if (onAssigned) onAssigned();
      if (onClose) onClose();
    } catch (err) {
      if (err.response?.data?.error_code === 'NEW_TRIP_REQUIRED' || 
         (err.response?.data?.error && err.response.data.error.includes('already submitted a report today'))) {
        setShowPermissionModal(true);
      } else {
        toast.error(err.response?.data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 30, width: '100%', maxWidth: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', position: 'relative' }}>
        {isEdit && (
          <button onClick={onClose} style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#dbeafe', color: '#2563eb', padding: 10, borderRadius: '50%' }}>
            <Truck size={24} />
          </div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{isEdit ? 'Edit Vehicle Details' : 'Assign Vehicle'}</h2>
        </div>
        <p style={{ color: '#64748b', marginBottom: 20 }}>
          {isEdit ? 'Update the vehicle details if there was a change.' : 'Please assign a vehicle before you start loading inventory.'}
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Vehicle Number</label>
            <input 
              required
              type="text" 
              className="form-control"
              placeholder="e.g. MH 12 AB 1234"
              value={form.vehicle_number}
              onChange={e => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Driver Name</label>
            <input 
              required
              type="text" 
              className="form-control"
              placeholder="Driver's full name"
              value={form.driver_name}
              onChange={e => setForm({ ...form, driver_name: toTitleCase(e.target.value) })}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500, fontSize: 14 }}>Destination</label>
            <input 
              required
              type="text" 
              className="form-control"
              placeholder="e.g. City Center, Main Street"
              value={form.destination}
              onChange={e => setForm({ ...form, destination: toTitleCase(e.target.value) })}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              marginTop: 10, padding: 12, background: 'var(--primary)', color: '#fff', border: 'none', 
              borderRadius: 8, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Saving...' : (isEdit ? 'Update Vehicle' : 'Assign Vehicle & Start')}
          </button>
        </form>
      </div>

      {/* Permission Modal */}
      {showPermissionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 30, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: 15, borderRadius: '50%', marginBottom: 20 }}>
              <ShieldAlert size={36} />
            </div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: 20, color: 'var(--text)' }}>Permission Required</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 25, fontSize: 14, lineHeight: 1.5 }}>
              You have already submitted a Daily Report today. To start an additional trip, you must request permission from the Admin.
            </p>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '12px', fontWeight: 600, borderRadius: 10 }}
                disabled={requestLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setRequestLoading(true);
                  try {
                    await walkinApi.requestNextTrip({ notes: 'Requesting permission for an additional trip today.' });
                    toast.success('Request sent to Admin! Please wait for approval.');
                    setShowPermissionModal(false);
                    if (onClose) onClose();
                  } catch (e) {
                    toast.error(e.response?.data?.error || e.message);
                  } finally {
                    setRequestLoading(false);
                  }
                }}
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px', fontWeight: 600, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none' }}
                disabled={requestLoading}
              >
                {requestLoading ? 'Sending...' : <><Send size={16} /> Request Admin</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

