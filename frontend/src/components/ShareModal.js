import React, { useState, useEffect } from 'react';
import { managerApi } from '../utils/api';
import toast from 'react-hot-toast';
import { Share2, UserCheck, X } from 'lucide-react';

export default function ShareModal({ item, type, onShared, onClose }) {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [selected, setSelected] = useState(item.allowed_managers || []);

  useEffect(() => {
    managerApi.getAll()
      .then(res => setManagers(res.managers || []))
      .catch(err => toast.error('Failed to load managers'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (mgrId) => {
    setSelected(prev => 
      prev.includes(mgrId) 
        ? prev.filter(id => id !== mgrId)
        : [...prev, mgrId]
    );
  };

  const handleSave = async () => {
    setSharing(true);
    try {
      await onShared(selected);
      toast.success('Sharing updated successfully');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={18} /> Share {type}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Select managers who should have access to <strong>{item.name}</strong>.
          </p>

          {loading ? (
            <div className="loading" style={{ padding: 20 }}><span className="spinner"></span></div>
          ) : managers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
              No other managers found.
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
              {managers.map(mgr => (
                <div 
                  key={mgr._id}
                  onClick={() => handleToggle(mgr._id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', cursor: 'pointer',
                    background: selected.includes(mgr._id) ? 'var(--primary-light)' : 'transparent',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: '50%', 
                      background: selected.includes(mgr._id) ? 'var(--primary)' : 'var(--border)',
                      color: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700
                    }}>
                      {mgr.display_name?.charAt(0).toUpperCase() || 'M'}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{mgr.display_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{mgr.username}</div>
                    </div>
                  </div>
                  {selected.includes(mgr._id) && <UserCheck size={18} style={{ color: 'var(--primary)' }} />}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={sharing || loading}>
              {sharing ? 'Saving...' : 'Update Sharing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
