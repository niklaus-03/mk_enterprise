import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { managerApi } from '../utils/api';
import { Users, Plus, Edit2, Trash2, Key, Shield, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const { settings } = useApp();
  const [managers, setManagers] = useState([]);
  const [mgrLoading, setMgrLoading] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showEditManager, setShowEditManager] = useState(null);
  const [mgrForm, setMgrForm] = useState({ username: '', phone: '', password: '', display_name: '', can_edit_products: false });
  const [mgrCreating, setMgrCreating] = useState(false);
  const [mgrResetModal, setMgrResetModal] = useState(null);
  const [mgrResetPw, setMgrResetPw] = useState('');

  const loadManagers = useCallback(async () => {
    if (!isAdmin) return;
    setMgrLoading(true);
    try {
      const res = await managerApi.getAll();
      setManagers(res.managers || []);
    } catch (err) { 
      toast.error(err.message || 'Failed to load managers'); 
    } finally { 
      setMgrLoading(false); 
    }
  }, [isAdmin]);

  useEffect(() => { loadManagers(); }, [loadManagers]);

  const handleCreateManager = async (e) => {
    e.preventDefault();
    if (!mgrForm.username || !mgrForm.password) return toast.error('Username and password are required');
    if (mgrForm.password.length < 6) return toast.error('Password must be at least 6 characters');
    setMgrCreating(true);
    try {
      await managerApi.create(mgrForm);
      toast.success('Manager created successfully!');
      setShowAddManager(false);
      setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false });
      loadManagers();
    } catch (err) { toast.error(err.message); }
    finally { setMgrCreating(false); }
  };

  const handleUpdateManager = async (e) => {
    e.preventDefault();
    setMgrCreating(true);
    try {
      await managerApi.update(showEditManager._id, mgrForm);
      toast.success('Manager updated successfully!');
      setShowEditManager(null);
      setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false });
      loadManagers();
    } catch (err) { toast.error(err.message); }
    finally { setMgrCreating(false); }
  };

  const handleDeleteManager = async (mgr) => {
    if (!window.confirm(`Delete manager "${mgr.display_name || mgr.username}"?\n\nNote: All records created by this manager will be preserved.`)) return;
    try {
      await managerApi.delete(mgr._id);
      toast.success(`Manager "${mgr.username}" removed`);
      loadManagers();
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleManager = async (mgr) => {
    try {
      await managerApi.update(mgr._id, { is_active: !mgr.is_active });
      toast.success(`${mgr.display_name || mgr.username} ${mgr.is_active ? 'disabled' : 'enabled'}`);
      loadManagers();
    } catch (err) { toast.error(err.message); }
  };

  const handleResetManagerPw = async () => {
    if (!mgrResetPw || mgrResetPw.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await managerApi.resetPassword(mgrResetModal._id, mgrResetPw);
      toast.success(`Password reset for "${mgrResetModal.username}"`);
      setMgrResetModal(null);
      setMgrResetPw('');
    } catch (err) { toast.error(err.message); }
  };

  const openEditModal = (mgr) => {
    setMgrForm({
      username: mgr.username || '',
      phone: mgr.phone || '',
      display_name: mgr.display_name || '',
      can_edit_products: mgr.can_edit_products || false
    });
    setShowEditManager(mgr);
  };

  const fld = (key, label, placeholder, type = 'text') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-control" type={type} value={mgrForm[key]} placeholder={placeholder} onChange={e => setMgrForm({ ...mgrForm, [key]: e.target.value })} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title d-flex align-items-center gap-2">
            <Shield size={22} className="text-primary" /> Admin Panel
          </div>
          <div className="page-subtitle">Manage users, permissions, and system access.</div>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false });
          setShowAddManager(true);
        }}>
          <Plus size={16} /> Add Manager
        </button>
      </div>

      <div className="card mt-4">
        <div className="card-header border-bottom">
          <div className="card-title d-flex align-items-center gap-2">
            <Users size={18} /> Managers List
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Name / Username</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Product Permissions</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mgrLoading ? (
                <tr><td colSpan="5" className="text-center py-4">Loading managers...</td></tr>
              ) : managers.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-4 text-muted">No managers found</td></tr>
              ) : (
                managers.map(mgr => (
                  <tr key={mgr._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{mgr.display_name || '-'}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>@{mgr.username}</div>
                    </td>
                    <td>{mgr.phone || '-'}</td>
                    <td>
                      <button 
                        onClick={() => handleToggleManager(mgr)}
                        className={`badge ${mgr.is_active ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                      >
                        {mgr.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      {mgr.can_edit_products ? (
                        <span className="badge bg-primary-light text-primary d-inline-flex align-items-center gap-1">
                          <CheckCircle size={12} /> Can Edit Stock
                        </span>
                      ) : (
                        <span className="badge bg-secondary-light text-secondary d-inline-flex align-items-center gap-1">
                          <XCircle size={12} /> View Only
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-icon btn-outline-secondary" title="Edit Manager" onClick={() => openEditModal(mgr)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-icon btn-outline-warning" title="Reset Password" onClick={() => setMgrResetModal(mgr)}>
                          <Key size={14} />
                        </button>
                        <button className="btn btn-icon btn-outline-danger" title="Delete Manager" onClick={() => handleDeleteManager(mgr)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Manager Modal */}
      {(showAddManager || showEditManager) && (
        <div className="modal-overlay" onClick={() => { setShowAddManager(false); setShowEditManager(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              {showAddManager ? <Plus size={20} className="text-primary" /> : <Edit2 size={20} className="text-primary" />}
              {showAddManager ? 'Add New Manager' : 'Edit Manager'}
            </div>
            
            <form onSubmit={showAddManager ? handleCreateManager : handleUpdateManager}>
              {fld('username', 'Username *', 'e.g. rahul')}
              {fld('display_name', 'Display Name', 'e.g. Rahul Sharma')}
              {fld('phone', 'Phone Number', '10-digit phone')}
              
              {showAddManager && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrForm.password} onChange={e => setMgrForm({ ...mgrForm, password: e.target.value })} />
                </div>
              )}

              <div className="form-group mt-4 p-3 bg-light rounded" style={{ border: '1px solid #e5e7eb' }}>
                <label className="form-label d-flex align-items-center gap-2 mb-2" style={{ cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={mgrForm.can_edit_products}
                    onChange={(e) => setMgrForm({ ...mgrForm, can_edit_products: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  Allow Stock & Price Edits
                </label>
                <div style={{ fontSize: 12, color: '#6b7280', paddingLeft: 24 }}>
                  If enabled, this manager can edit product prices, names, and update incoming vehicle stock.
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button type="button" className="btn btn-outline flex-1" onClick={() => { setShowAddManager(false); setShowEditManager(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={mgrCreating}>
                  {mgrCreating ? 'Saving...' : 'Save Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {mgrResetModal && (
        <div className="modal-overlay" onClick={() => setMgrResetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={20} className="text-warning" /> Reset Password
            </div>
            <div className="form-group">
              <label className="form-label">New Password for {mgrResetModal.username}</label>
              <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrResetPw} onChange={e => setMgrResetPw(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn btn-outline flex-1" onClick={() => setMgrResetModal(null)}>Cancel</button>
              <button className="btn btn-warning flex-1" onClick={handleResetManagerPw}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
