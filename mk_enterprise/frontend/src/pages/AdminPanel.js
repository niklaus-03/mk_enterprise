import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { managerApi, driverApi, activityLogApi, authApi } from '../utils/api';
import { Users, Plus, Edit2, Trash2, Key, Shield, CheckCircle, XCircle, Activity, Truck, Unlock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t, settings } = useApp();
  const [managers, setManagers] = useState([]);
  const [mgrLoading, setMgrLoading] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showEditManager, setShowEditManager] = useState(null);
  const [mgrForm, setMgrForm] = useState({ username: '', phone: '', password: '', display_name: '', can_edit_products: false });
  const [mgrCreating, setMgrCreating] = useState(false);
  const [mgrResetModal, setMgrResetModal] = useState(null);
  const [mgrResetPw, setMgrResetPw] = useState('');

  // Tabs State
  const [activeTab, setActiveTab] = useState('managers'); // 'managers', 'drivers', 'activity'

  // Driver State
  const [drivers, setDrivers] = useState([]);
  const [driverLoading, setDriverLoading] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showEditDriver, setShowEditDriver] = useState(null);
  const [driverForm, setDriverForm] = useState({ username: '', phone: '', password: '', display_name: '' });
  const [driverCreating, setDriverCreating] = useState(false);
  const [driverResetModal, setDriverResetModal] = useState(null);
  const [driverResetPw, setDriverResetPw] = useState('');

  // Activity Log State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Recovery Requests State
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [resolvePw, setResolvePw] = useState('');

  // Default to today's date in local time
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = (new Date(today - tzOffset)).toISOString().split('T')[0];
  
  const [logFilters, setLogFilters] = useState({ date: localISOTime, user_role: '', action: '' });

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


  const loadDrivers = useCallback(async () => {
    if (!isAdmin) return;
    setDriverLoading(true);
    try {
      const res = await driverApi.getAll();
      setDrivers(res.drivers || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load drivers');
    } finally {
      setDriverLoading(false);
    }
  }, [isAdmin]);

  const loadActivityLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLogsLoading(true);
    try {
      const params = { limit: 50 };
      if (logFilters.date) params.date = logFilters.date;
      if (logFilters.user_role) params.user_role = logFilters.user_role;
      if (logFilters.action) params.action = logFilters.action;
      
      const res = await activityLogApi.getAll(params);
      setLogs(res.logs || []);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLogsLoading(false);
    }
  }, [isAdmin, logFilters]);
  
  const loadRequests = useCallback(async () => {
    if (!isAdmin) return;
    setRequestsLoading(true);
    try {
      const res = await authApi.getRecoveryRequests();
      setRequests(res.requests || []);
    } catch (err) {
      toast.error('Failed to load recovery requests');
    } finally {
      setRequestsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'managers') loadManagers();
    else if (activeTab === 'drivers') loadDrivers();
    else if (activeTab === 'activity') loadActivityLogs();
    else if (activeTab === 'requests') loadRequests();
  }, [activeTab, loadManagers, loadDrivers, loadActivityLogs, loadRequests]);



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


  // --- Driver Handlers ---
  const handleCreateDriver = async (e) => {
    e.preventDefault();
    if (!driverForm.username || !driverForm.password) return toast.error('Username and password are required');
    if (driverForm.password.length < 6) return toast.error('Password must be at least 6 characters');
    setDriverCreating(true);
    try {
      await driverApi.create(driverForm);
      toast.success('Driver created successfully!');
      setShowAddDriver(false);
      setDriverForm({ username: '', phone: '', password: '', display_name: '' });
      loadDrivers();
    } catch (err) { toast.error(err.message); }
    finally { setDriverCreating(false); }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    setDriverCreating(true);
    try {
      await driverApi.update(showEditDriver._id, driverForm);
      toast.success('Driver updated successfully!');
      setShowEditDriver(null);
      setDriverForm({ username: '', phone: '', password: '', display_name: '' });
      loadDrivers();
    } catch (err) { toast.error(err.message); }
    finally { setDriverCreating(false); }
  };

  const handleDeleteDriver = async (dr) => {
    if (!window.confirm(`Delete driver "${dr.display_name || dr.username}"?\n\nNote: All records created by this driver will be preserved.`)) return;
    try {
      await driverApi.delete(dr._id);
      toast.success(`Driver "${dr.username}" removed`);
      loadDrivers();
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleDriver = async (dr) => {
    try {
      await driverApi.update(dr._id, { is_active: !dr.is_active });
      toast.success(`${dr.display_name || dr.username} ${dr.is_active ? 'disabled' : 'enabled'}`);
      loadDrivers();
    } catch (err) { toast.error(err.message); }
  };

  const handleResetDriverPw = async () => {
    if (!driverResetPw || driverResetPw.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await driverApi.resetPassword(driverResetModal._id, driverResetPw);
      toast.success(`Password reset for "${driverResetModal.username}"`);
      setDriverResetModal(null);
      setDriverResetPw('');
    } catch (err) { toast.error(err.message); }
  };

  const openEditDriverModal = (dr) => {
    setDriverForm({
      username: dr.username || '',
      phone: dr.phone || '',
      display_name: dr.display_name || ''
    });
    setShowEditDriver(dr);
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

  
  const handleResolveRequest = async () => {
    if (!resolvePw || resolvePw.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await authApi.resolveRecoveryRequest(resolveModal._id, resolvePw);
      toast.success(`Password reset for ${resolveModal.username}`);
      setResolveModal(null);
      setResolvePw('');
      loadRequests();
    } catch (err) { toast.error(err.message); }
  };

  const translateAction = (act) => {
    if (!t) return act;
    const map = {
      'create': t('create', 'बनाया गया'),
      'update': t('update', 'अपडेट किया गया'),
      'delete': t('delete', 'हटाया गया'),
      'login': t('login', 'लॉग इन किया'),
      'logout': t('logout', 'लॉग आउट किया'),
      'error': t('error', 'त्रुटि')
    };
    return map[act] || act.replace(/_/g, ' ');
  };

  
  const translateDetails = (details) => {
    if (!details) return details;
    let s = details;
    if (settings.language === 'hi') {
      s = s.replace(/Invoice created for (.*)\. Total: ₹(.*)/, 'बिल बनाया गया $1 के लिए। कुल: ₹$2');
      s = s.replace(/Invoice updated for (.*)/, 'बिल अपडेट किया गया $1 के लिए');
      s = s.replace(/User (.*) deleted/, 'उपयोगकर्ता $1 को हटा दिया गया');
      s = s.replace(/Logged in successfully/, 'सफलतापूर्वक लॉग इन किया');
      s = s.replace(/Logged out/, 'लॉग आउट किया');
    }
    return s;
  };

  const handleRowClick = (log) => {
    if (!log.entity_id) return;
    if (log.entity_type === 'invoice') navigate(`/invoices/${log.entity_id}`);
    else if (log.entity_type === 'trip') navigate(`/trip/${log.entity_id}`);
    else if (log.entity_type === 'vehicle') navigate(`/vehicle/${log.entity_id}`);
    else if (log.entity_type === 'customer') navigate(`/customers`);
    // Ignore products as per user request
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)', paddingBottom: 40 }}>
      {/* Premium Header */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, 
        marginBottom: 24, padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
        borderRadius: 16, color: '#fff', boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
              <Shield size={24} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{t('Admin Panel', 'एडमिन पैनल')}</h1>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{t('Manage users, drivers, and system activity logs.', 'उपयोगकर्ता, ड्राइवर और सिस्टम गतिविधि लॉग प्रबंधित करें।')}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <button 
              onClick={() => setActiveTab('managers')}
              style={{ 
                padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                border: 'none', transition: 'all 0.2s',
                background: activeTab === 'managers' ? '#fff' : 'rgba(255,255,255,0.06)', 
                color: activeTab === 'managers' ? '#0f172a' : '#cbd5e1'
              }}
            >
              <Users size={16} /> {t('Managers', 'मैनेजर')}
            </button>
            <button 
              onClick={() => setActiveTab('drivers')}
              style={{ 
                padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                border: 'none', transition: 'all 0.2s',
                background: activeTab === 'drivers' ? '#fff' : 'rgba(255,255,255,0.06)', 
                color: activeTab === 'drivers' ? '#0f172a' : '#cbd5e1'
              }}
            >
              <Truck size={16} /> {t('Drivers', 'ड्राइवर')}
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              style={{ 
                padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                border: 'none', transition: 'all 0.2s',
                background: activeTab === 'activity' ? '#fff' : 'rgba(255,255,255,0.06)', 
                color: activeTab === 'activity' ? '#0f172a' : '#cbd5e1'
              }}
            >
              <Activity size={16} /> {t('Activity Logs', 'गतिविधि लॉग')}
            </button>
            <button 
              onClick={() => setActiveTab('requests')}
              style={{ 
                padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                border: 'none', transition: 'all 0.2s',
                background: activeTab === 'requests' ? '#fff' : 'rgba(255,255,255,0.06)', 
                color: activeTab === 'requests' ? '#0f172a' : '#cbd5e1'
              }}
            >
              <Unlock size={16} /> Recovery Requests
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-end' }}>
          {activeTab === 'managers' && (
            <button 
              style={{ 
                background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', 
                padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, 
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' 
              }} 
              onClick={() => { setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false }); setShowAddManager(true); }}
            >
              <Plus size={18} /> Add Manager
            </button>
          )}
          {activeTab === 'drivers' && (
            <button 
              style={{ 
                background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', 
                padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, 
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' 
              }} 
              onClick={() => { setDriverForm({ username: '', phone: '', password: '', display_name: '' }); setShowAddDriver(true); }}
            >
              <Plus size={18} /> Add Driver
            </button>
          )}
        </div>
      </div>

      {activeTab === 'managers' && (
      <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}><Users size={18} /></div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{t('Managers', 'मैनेजर')} List</span>
        </div>
        
        <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 180px 100px', gap: 16, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <div>User Info</div>
          <div>Phone</div>
          <div>Status</div>
          <div>Permissions</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        <div style={{ background: '#fff' }}>
          {mgrLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading managers...</div>
          ) : managers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No managers found</div>
          ) : (
            managers.map((mgr, idx) => (
              <div key={mgr._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 180px 100px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < managers.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', fontWeight: 700, fontSize: 16 }}>
                    {(mgr.display_name || mgr.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2 }}>{mgr.display_name || '-'}</div>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>@{mgr.username}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{mgr.phone || '-'}</div>
                <div>
                  <button 
                    onClick={() => handleToggleManager(mgr)}
                    style={{ background: mgr.is_active ? '#dcfce7' : '#fee2e2', color: mgr.is_active ? '#166534' : '#991b1b', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}
                  >
                    {mgr.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: mgr.can_edit_products ? '#f0fdf4' : '#f1f5f9', color: mgr.can_edit_products ? '#15803d' : '#64748b', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {mgr.can_edit_products ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {mgr.can_edit_products ? 'Can Edit Stock' : 'View Only'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => openEditModal(mgr)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setMgrResetModal(mgr)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.color = '#92400e'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#b45309'; }}>
                    <Key size={14} />
                  </button>
                  <button onClick={() => handleDeleteManager(mgr)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#991b1b'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {activeTab === 'drivers' && (
        <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}><Truck size={18} /></div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{t('Drivers', 'ड्राइवर')} List</span>
          </div>
          
          <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 100px', gap: 16, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>Driver Info</div>
            <div>Phone</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          <div style={{ background: '#fff' }}>
            {driverLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading drivers...</div>
            ) : drivers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No drivers found</div>
            ) : (
              drivers.map((dr, idx) => (
                <div key={dr._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 100px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < drivers.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #fef2f2, #fecaca)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c', fontWeight: 700, fontSize: 16 }}>
                      {(dr.display_name || dr.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2 }}>{dr.display_name || '-'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>@{(dr.username || '').toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{dr.phone || '-'}</div>
                  <div>
                    <button 
                      onClick={() => handleToggleDriver(dr)}
                      style={{ background: dr.is_active ? '#dcfce7' : '#fee2e2', color: dr.is_active ? '#166534' : '#991b1b', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}
                    >
                      {dr.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button onClick={() => openEditDriverModal(dr)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDriverResetModal(dr)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.color = '#92400e'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#b45309'; }}>
                      <Key size={14} />
                    </button>
                    <button onClick={() => handleDeleteDriver(dr)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#991b1b'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}><Activity size={18} /></div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{t('System Activity Logs', 'सिस्टम गतिविधि लॉग')}</span>
            </div>
            
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input 
                type="date" 
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569', outline: 'none' }}
                value={logFilters.date} 
                onChange={e => setLogFilters(f => ({ ...f, date: e.target.value }))}
              />
              <select 
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569', outline: 'none', backgroundColor: '#fff' }}
                value={logFilters.user_role} 
                onChange={e => setLogFilters(f => ({ ...f, user_role: e.target.value }))}
              >
                <option value="">{t('All Roles', 'सभी भूमिकाएं')}</option>
                <option value="manager">Manager</option>
                <option value="driver">Driver</option>
                <option value="supervisor">Admin</option>
              </select>
              <select 
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569', outline: 'none', backgroundColor: '#fff' }}
                value={logFilters.action} 
                onChange={e => setLogFilters(f => ({ ...f, action: e.target.value }))}
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">{t('Delete', 'हटाएं')}</option>
                <option value="login">Login</option>
                <option value="failed_login">Failed Login</option>
                <option value="security_alert">Security Alert</option>
                <option value="payment">Payment</option>
                <option value="logout">Logout</option>
              </select>
            </div>
          </div>
          
          <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 140px minmax(200px, 1fr)', gap: 16, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>Time</div>
            <div>User</div>
            <div>Action</div>
            <div>Details</div>
          </div>
          
          <div style={{ background: '#fff' }}>
            {logsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading logs...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No activity found</div>
            ) : (
              logs.map((log, idx) => {
                const isClickable = ['invoice', 'trip', 'vehicle', 'customer'].includes(log.entity_type) && log.entity_id;
                return (
                  <div 
                    key={log._id} 
                    onClick={() => handleRowClick(log)}
                    style={{ 
                      display: 'grid', gridTemplateColumns: '150px 180px 140px minmax(200px, 1fr)', gap: 16, padding: '16px 24px', alignItems: 'center', 
                      borderBottom: idx < logs.length - 1 ? '1px solid #f1f5f9' : 'none', 
                      borderLeft: isClickable ? '3px solid #3b82f6' : '3px solid transparent',
                      cursor: isClickable ? 'pointer' : 'default', transition: 'background 0.2s' 
                    }}
                    onMouseEnter={e => { if (isClickable) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (isClickable) e.currentTarget.style.background = '#fff'; }}
                  >
                    <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{log.username || 'System'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{t(log.user_role?.toUpperCase(), log.user_role === 'supervisor' ? 'सुपरवाइजर' : (log.user_role === 'manager' ? 'मैनेजर' : log.user_role?.toUpperCase()))}</div>
                    </div>
                    <div>
                      {log.action === 'create' && <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>}
                      {(log.action === 'update' || log.action === 'edit') && <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>}
                      {log.action === 'delete' && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>}
                      {log.action === 'login' && <span style={{ background: '#cffafe', color: '#155e75', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>}
                      {log.action === 'payment' && <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>}
                      {log.action === 'escalate' && <span style={{ background: '#f3f4f6', color: '#1f2937', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>}
                      {log.action === 'security_alert' && <span style={{ background: '#fecaca', color: '#7f1d1d', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{translateAction(log.action)}</span>}
                      {log.action === 'failed_login' && <span style={{ background: '#fecaca', color: '#7f1d1d', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{translateAction(log.action)}</span>}
                      {!['create', 'update', 'edit', 'delete', 'login', 'payment', 'escalate', 'security_alert', 'failed_login'].includes(log.action) && (
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.4 }}>
                      {translateDetails(log.description) || '-'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}><Unlock size={18} /></div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Password Recovery Requests</span>
          </div>
          
          <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 150px 100px minmax(180px, 1fr)', gap: 16, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>Requested At</div>
            <div>Username</div>
            <div>Phone</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          
          <div style={{ background: '#fff' }}>
            {requestsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading requests...</div>
            ) : requests.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No pending requests</div>
            ) : (
              requests.map((req, idx) => (
                <div key={req._id} style={{ display: 'grid', gridTemplateColumns: '150px 180px 150px 100px minmax(180px, 1fr)', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < requests.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(req.createdAt).toLocaleString('en-IN')}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{req.username}</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{req.phone || '-'}</div>
                  <div>
                    <span style={{ background: req.status === 'resolved' ? '#dcfce7' : '#fef3c7', color: req.status === 'resolved' ? '#166534' : '#b45309', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {req.status === 'resolved' ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {req.status === 'pending' && (
                      <button 
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }} 
                        onClick={() => setResolveModal(req)}
                      >
                        Resolve
                      </button>
                    )}
                    {req.status === 'resolved' && (
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Resolved</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Manager Modal */}
      {(showAddManager || showEditManager) && (
        <div className="modal-overlay" onClick={() => { setShowAddManager(false); setShowEditManager(null); }} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showAddManager ? <Plus size={20} /> : <Edit2 size={20} />}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{showAddManager ? 'Add New Manager' : 'Edit Manager'}</div>
            </div>
            
            <form onSubmit={showAddManager ? handleCreateManager : handleUpdateManager} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {fld('username', 'Username *', 'e.g. rahul')}
                {fld('display_name', 'Display Name', 'e.g. Rahul Sharma')}
                {fld('phone', 'Phone Number', '10-digit phone')}
                
                {showAddManager && (
                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Password *</label>
                    <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrForm.password} onChange={e => setMgrForm({ ...mgrForm, password: e.target.value })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  </div>
                )}

                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0, fontWeight: 600, color: '#334155' }}>
                    <input 
                      type="checkbox" 
                      checked={mgrForm.can_edit_products}
                      onChange={(e) => setMgrForm({ ...mgrForm, can_edit_products: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
                    />
                    Allow Stock & Price Edits
                  </label>
                  <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 28, marginTop: 4, lineHeight: 1.4 }}>
                    If enabled, this manager can edit product prices, names, and update incoming vehicle stock.
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => { setShowAddManager(false); setShowEditManager(null); }} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('Cancel', 'रद्द करें')}</button>
                <button type="submit" disabled={mgrCreating} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                  {mgrCreating ? 'Saving...' : 'Save Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {mgrResetModal && (
        <div className="modal-overlay" onClick={() => setMgrResetModal(null)} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={20} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Reset Password</div>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>New Password for @{mgrResetModal.username}</label>
                <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrResetPw} onChange={e => setMgrResetPw(e.target.value)} autoFocus style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setMgrResetModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('Cancel', 'रद्द करें')}</button>
                <button onClick={handleResetManagerPw} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>Reset Password</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Driver Modal */}
      {(showAddDriver || showEditDriver) && (
        <div className="modal-overlay" onClick={() => { setShowAddDriver(false); setShowEditDriver(null); }} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showAddDriver ? <Plus size={20} /> : <Edit2 size={20} />}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{showAddDriver ? 'Add New Driver' : 'Edit Driver'}</div>
            </div>
            
            <form onSubmit={showAddDriver ? handleCreateDriver : handleUpdateDriver} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Username *</label>
                  <input className="form-control" type="text" placeholder="e.g. driver1" value={driverForm.username} onChange={e => setDriverForm({ ...driverForm, username: e.target.value })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Display Name</label>
                  <input className="form-control" type="text" placeholder="e.g. Ramesh Singh" value={driverForm.display_name} onChange={e => setDriverForm({ ...driverForm, display_name: e.target.value })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Phone Number</label>
                  <input className="form-control" type="text" placeholder="10-digit phone" value={driverForm.phone} onChange={e=> setDriverForm({ ...driverForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
                
                {showAddDriver && (
                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Password *</label>
                    <input className="form-control" type="password" placeholder="Min 6 characters" value={driverForm.password} onChange={e => setDriverForm({ ...driverForm, password: e.target.value })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => { setShowAddDriver(false); setShowEditDriver(null); }} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('Cancel', 'रद्द करें')}</button>
                <button type="submit" disabled={driverCreating} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                  {driverCreating ? 'Saving...' : 'Save Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Driver Password Modal */}
      {driverResetModal && (
        <div className="modal-overlay" onClick={() => setDriverResetModal(null)} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={20} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Reset Password</div>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>New Password for @{driverResetModal.username}</label>
                <input className="form-control" type="password" placeholder="Min 6 characters" value={driverResetPw} onChange={e => setDriverResetPw(e.target.value)} autoFocus style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setDriverResetModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('Cancel', 'रद्द करें')}</button>
                <button onClick={handleResetDriverPw} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>Reset Password</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Recovery Request Modal */}
      {resolveModal && (
        <div className="modal-overlay" onClick={() => setResolveModal(null)} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Unlock size={20} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Resolve Recovery Request</div>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Set New Password for @{resolveModal.username}</label>
                <input className="form-control" type="password" placeholder="Min 6 characters" value={resolvePw} onChange={e => setResolvePw(e.target.value)} autoFocus style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setResolveModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('Cancel', 'रद्द करें')}</button>
                <button onClick={handleResolveRequest} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>Resolve & Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
