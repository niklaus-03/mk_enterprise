import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { walkinApi } from '../utils/api';
import { Truck, X } from 'lucide-react';

export default function AdminAssignVehicleModal({ onClose, onSuccess, manager }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_number: '',
    driver_name: '',
    destination: ''
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    
    if (name === 'vehicle_number') {
      formattedValue = value.toUpperCase();
    } else if (name === 'driver_name' || name === 'destination') {
      formattedValue = value.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_number || !formData.driver_name || !formData.destination) {
      return toast.error('Please fill all fields');
    }

    setSaving(true);
    try {
      const res = await walkinApi.adminAssignVehicle({
        manager_id: manager._id,
        vehicle_number: formData.vehicle_number,
        driver_name: formData.driver_name,
        destination: formData.destination
      });
      
      toast.success('Vehicle successfully assigned to manager!');
      if (onSuccess) onSuccess(res.trip);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to assign vehicle');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e, nextFieldName) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldName) {
        const nextField = document.querySelector(`input[name="${nextFieldName}"]`);
        if (nextField) nextField.focus();
      } else {
        // Last field, trigger submit
        document.getElementById('assign-vehicle-form').requestSubmit();
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '12px', zIndex: 9999 }}>
      <div 
        className="walkin-delivery-modal"
        onClick={e => e.stopPropagation()} 
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 450, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden', margin: '5vh auto 0' }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center' }}>
            <Truck size={18} style={{ marginRight: 8, color: 'var(--primary)' }} /> 
            Assign Vehicle to Manager
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 20, padding: 12, background: '#f0fdf4', borderRadius: 8, color: '#166534', fontSize: 13 }}>
            <strong>Manager:</strong> {manager.display_name || manager.username}
            <div style={{ marginTop: 4 }}>This will start a new active vehicle trip for this manager.</div>
          </div>

          <form id="assign-vehicle-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Vehicle Number</label>
              <input 
                name="vehicle_number"
                className="form-control"
                value={formData.vehicle_number}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, 'driver_name')}
                placeholder="e.g. MH 12 AB 1234"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Driver Name</label>
              <input 
                name="driver_name"
                className="form-control"
                value={formData.driver_name}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, 'destination')}
                placeholder="Driver Name"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Destination</label>
              <input 
                name="destination"
                className="form-control"
                value={formData.destination}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, null)}
                placeholder="Destination City/Area"
                required
              />
            </div>
          </form>
        </div>

        <div style={{ padding: '16px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f8fafc' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving} style={{ padding: '10px 18px', borderRadius: 8 }}>
            Cancel
          </button>
          <button type="submit" form="assign-vehicle-form" className="btn btn-primary" disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <span className="spinner"></span> : <><Truck size={16} /> Assign Vehicle</>}
          </button>
        </div>
      </div>
    </div>
  );
}
