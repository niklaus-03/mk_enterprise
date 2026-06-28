import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { walkinApi } from '../utils/api';
import { Truck, X, Zap } from 'lucide-react';

export default function AdminReinforcementModal({ onClose, onSuccess, trip }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_number: trip?.reinforcement?.vehicle_number || '',
    driver_name: trip?.reinforcement?.driver_name || '',
    note: trip?.reinforcement?.note || ''
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const managerName = trip?.manager_id?.display_name || trip?.manager_id?.username || 'Manager';
  const hasExistingReinforcement = !!(trip?.reinforcement?.vehicle_number);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'vehicle_number') {
      formattedValue = value.toUpperCase();
    } else if (name === 'driver_name') {
      formattedValue = value.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleKeyDown = (e, nextFieldName) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldName) {
        const nextField = document.querySelector(`[name="${nextFieldName}"]`);
        if (nextField) nextField.focus();
      } else {
        document.getElementById('reinforcement-form').requestSubmit();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_number.trim() || !formData.driver_name.trim()) {
      return toast.error('Vehicle number and driver name are required.');
    }

    const manager_id = trip?.manager_id?._id || trip?.manager_id;
    if (!manager_id) return toast.error('Manager not found.');

    setSaving(true);
    try {
      const res = await walkinApi.assignReinforcement({
        manager_id,
        vehicle_number: formData.vehicle_number.trim(),
        driver_name: formData.driver_name.trim(),
        note: formData.note.trim()
      });
      toast.success(res.message || 'Reinforcement vehicle assigned!');
      if (onSuccess) onSuccess(res.trip);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to assign reinforcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '12px', zIndex: 9999 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 470,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          margin: '5vh auto 0'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)'
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#92400e' }}>
            <Zap size={18} style={{ color: '#d97706' }} />
            {hasExistingReinforcement ? 'Update Reinforcement Vehicle' : 'Send Reinforcement Vehicle'}
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>

          {/* Info banner */}
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            background: '#fffbeb',
            borderRadius: 10,
            border: '1px solid #fde68a',
            fontSize: 13
          }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
              🚛 Sending reinforcement to: {managerName}
            </div>
            <div style={{ color: '#78350f' }}>
              Current vehicle: <strong>{trip?.vehicle_number}</strong> — Driver: <strong>{trip?.driver_name}</strong>
            </div>
            {hasExistingReinforcement && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: '#fef9c3', borderRadius: 6, color: '#713f12', fontSize: 12, fontWeight: 600 }}>
                ⚠️ Existing reinforcement: {trip.reinforcement.vehicle_number} ({trip.reinforcement.driver_name}) — will be overwritten
              </div>
            )}
            <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>
              The manager will be able to select this reinforcement vehicle when creating invoices.
            </div>
          </div>

          <form id="reinforcement-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Reinforcement Vehicle Number
              </label>
              <input
                name="vehicle_number"
                className="form-control"
                value={formData.vehicle_number}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, 'driver_name')}
                placeholder="e.g. MH 12 AB 5678"
                required
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Reinforcement Driver Name
              </label>
              <input
                name="driver_name"
                className="form-control"
                value={formData.driver_name}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, 'note')}
                placeholder="Driver Name"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Note <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span>
              </label>
              <input
                name="note"
                className="form-control"
                value={formData.note}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, null)}
                placeholder="e.g. Carrying extra aaloo and tamatar"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid #fef3c7', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#fffbeb' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving} style={{ padding: '10px 18px', borderRadius: 8 }}>
            Cancel
          </button>
          <button
            type="submit"
            form="reinforcement-form"
            disabled={saving}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: saving ? '#d97706aa' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              boxShadow: '0 2px 8px rgba(217,119,6,0.3)'
            }}
          >
            {saving ? <span className="spinner" /> : <><Zap size={16} /> {hasExistingReinforcement ? 'Update Reinforcement' : 'Send Reinforcement'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
