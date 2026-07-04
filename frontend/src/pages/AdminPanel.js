import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { managerApi, driverApi, activityLogApi, authApi, deliveryApi, supplierApi, walkinApi } from '../utils/api';
import { Users, Plus, Edit2, Trash2, Key, Shield, CheckCircle, XCircle, Activity, Truck, Unlock, PauseCircle, PlayCircle, Eye, UserCheck, Copy, ArrowLeft, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import HawkEye from '../components/HawkEye';
import WalkInDeliveryModal from '../components/WalkInDeliveryModal';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, user, socket } = useAuth();
  const { t, settings } = useApp();
  const [managers, setManagers] = useState([]);
  const [mgrLoading, setMgrLoading] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showEditManager, setShowEditManager] = useState(null);
  const [mgrForm, setMgrForm] = useState({ username: '', phone: '', password: '', display_name: '', can_edit_products: false, role: 'manager', assigned_managers: [] });
  const [mgrCreating, setMgrCreating] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [mgrResetModal, setMgrResetModal] = useState(null);
  const [mgrResetPw, setMgrResetPw] = useState('');
  const [cloneModal, setCloneModal] = useState(null);
  const [cloneForm, setCloneForm] = useState({ username: '', phone: '', password: '', display_name: '' });
  const [cloning, setCloning] = useState(false);

  // Walk-in Delivery Modal
  const [showWalkinModal, setShowWalkinModal] = useState(false);

  // Tabs State
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'managers';
  const setActiveTab = (tab) => setSearchParams({ tab });

  // Driver State
  const [drivers, setDrivers] = useState([]);
  const [driverLoading, setDriverLoading] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showEditDriver, setShowEditDriver] = useState(null);
  const [driverForm, setDriverForm] = useState({ username: '', phone: '', password: '', display_name: '' });
  const [driverCreating, setDriverCreating] = useState(false);
  const [driverResetModal, setDriverResetModal] = useState(null);
  const [driverResetPw, setDriverResetPw] = useState('');

  const [confirmHoldModal, setConfirmHoldModal] = useState(null);
  
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);
  const [deleteSecretKey, setDeleteSecretKey] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmDisableModal, setConfirmDisableModal] = useState(null);

  // Activity Log State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logDetailModal, setLogDetailModal] = useState(null);
  
  // Recovery Requests State
  const [requests, setRequests] = useState([]);
  const [tripRequests, setTripRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [resolvePw, setResolvePw] = useState('');
  const [tripApprovingId, setTripApprovingId] = useState(null);

  // Default to today's date in local time
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = (new Date(today - tzOffset)).toISOString().split('T')[0];
  
  const [logFilters, setLogFilters] = useState({ date: localISOTime, user_role: '', action: '', user_id: '', username: '' });

  // Handle incoming navigation state
  useEffect(() => {
    if (location.state) {
      if (location.state.activeTab) {
        setActiveTab(location.state.activeTab);
      }
      if (location.state.logUserId) {
        setLogFilters(f => ({ 
          ...f, 
          date: '', 
          user_id: location.state.logUserId, 
          username: location.state.logUsername || '' 
        }));
      }
      // Clear state after applying so it doesn't re-trigger on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadManagers = useCallback(async (isPolling = false) => {
    if (!isAdmin) return;
    if (!isPolling) setMgrLoading(true);
    try {
      const res = await managerApi.getAll();
      setManagers(res.managers || []);
    } catch (err) { 
      toast.error(err.message || 'Failed to load managers'); 
    } finally { 
      if (!isPolling) setMgrLoading(false); 
    }
  }, [isAdmin]);

  const loadDrivers = useCallback(async (isPolling = false) => {
    if (!isAdmin) return;
    if (!isPolling) setDriverLoading(true);
    try {
      const res = await driverApi.getAll();
      setDrivers(res.drivers || []);
    } catch (err) { 
      toast.error(err.message || 'Failed to load drivers'); 
    } finally { 
      if (!isPolling) setDriverLoading(false); 
    }
  }, [isAdmin]);

  const loadActivityLogs = useCallback(async (hideLoading = false) => {
    if (!isAdmin) return;
    if (!hideLoading) setLogsLoading(true);
    try {
      const params = { limit: 50 };
      if (logFilters.date) params.date = logFilters.date;
      if (logFilters.user_role) params.user_role = logFilters.user_role;
      if (logFilters.action) params.action = logFilters.action;
      if (logFilters.user_id) params.user_id = logFilters.user_id;
      
      const res = await activityLogApi.getAll(params);
      setLogs(res.logs || []);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLogsLoading(false);
    }
  }, [isAdmin, logFilters]);
  
  const loadRequests = useCallback(async (isPolling = false) => {
    if (!isAdmin) return;
    if (!isPolling) setRequestsLoading(true);
    try {
      const [res, tripRes] = await Promise.all([
        authApi.getRecoveryRequests(),
        walkinApi.getAllRequests().catch(() => ({ requests: [] }))
      ]);
      setRequests(res.requests || []);
      setTripRequests(tripRes.requests || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load requests');
    } finally {
      if (!isPolling) setRequestsLoading(false);
    }
  }, [isAdmin]);

  const handlePullRefresh = useCallback(async () => {
    if (activeTab === 'managers') await loadManagers(false);
    else if (activeTab === 'drivers') await loadDrivers(false);
    else if (activeTab === 'activity') await loadActivityLogs(false);
    else if (activeTab === 'requests') await loadRequests(false);
  }, [activeTab, loadManagers, loadDrivers, loadActivityLogs, loadRequests]);
  useRegisterRefresh(handlePullRefresh);

  useEffect(() => {
    if (activeTab === 'managers') loadManagers(false);
    else if (activeTab === 'drivers') loadDrivers(false);
    else if (activeTab === 'activity') loadActivityLogs(false);
    else if (activeTab === 'requests') loadRequests(false);

    if (socket) {
      const handleStatusUpdate = () => {
        if (activeTab === 'managers') loadManagers(true);
        if (activeTab === 'drivers') loadDrivers(true);
      };
      
      const handleNewActivity = () => {
        if (activeTab === 'activity') loadActivityLogs(true);
      };

      socket.on('status_update', handleStatusUpdate);
      socket.on('new_activity_log', handleNewActivity);

      return () => {
        socket.off('status_update', handleStatusUpdate);
        socket.off('new_activity_log', handleNewActivity);
      };
    }
  }, [activeTab, loadManagers, loadDrivers, loadActivityLogs, loadRequests, socket]);



  const handleCreateManager = async (e) => {
    e.preventDefault();
    if (!mgrForm.username || !mgrForm.password) return toast.error('Username and password are required');
    if (mgrForm.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (mgrForm.phone && mgrForm.phone.length !== 10) return toast.error('Phone number must be exactly 10 digits');
    setMgrCreating(true);
    try {
      await managerApi.create(mgrForm);
      toast.success('Manager created successfully!');
      setShowAddManager(false);
      setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false, role: 'manager', assigned_managers: [] });
      loadManagers();
    } catch (err) { toast.error(err.message); }
    finally { setMgrCreating(false); }
  };

  const handleUpdateManager = async (e) => {
    e.preventDefault();
    if (mgrForm.phone && mgrForm.phone.length !== 10) return toast.error('Phone number must be exactly 10 digits');
    setMgrCreating(true);
    try {
      await managerApi.update(showEditManager._id, mgrForm);
      toast.success('Manager updated successfully!');
      setShowEditManager(null);
      setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false, role: 'manager', assigned_managers: [] });
      loadManagers();
    } catch (err) { toast.error(err.message); }
    finally { setMgrCreating(false); }
  };



  const handleToggleManager = async (mgr) => {
    try {
      await managerApi.update(mgr._id, { is_active: !mgr.is_active });
      toast.success(`${mgr.display_name || mgr.username} ${mgr.is_active ? 'disabled' : 'enabled'}`);
      setConfirmDisableModal(null);
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

  const handleCloneManager = async (e) => {
    e.preventDefault();
    if (!cloneForm.username || !cloneForm.password) return toast.error('Username and password are required');
    if (cloneForm.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (cloneForm.phone && cloneForm.phone.length !== 10) return toast.error('Phone number must be exactly 10 digits');
    setCloning(true);
    try {
      const res = await managerApi.clone(cloneModal._id, cloneForm);
      const s = res.stats;
      toast.success(res.message || 'Manager cloned successfully!');
      toast(`Copied: ${s.customers} customers, ${s.products} products, ${s.invoices} invoices`, { icon: '📋', duration: 5000 });
      setCloneModal(null);
      setCloneForm({ username: '', phone: '', password: '', display_name: '' });
      loadManagers();
    } catch (err) { toast.error(err.message || 'Failed to clone manager'); }
    finally { setCloning(false); }
  };

  // --- Driver Handlers ---
  const handleCreateDriver = async (e) => {
    e.preventDefault();
    if (!driverForm.username || !driverForm.password) return toast.error('Username and password are required');
    if (driverForm.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (driverForm.phone && driverForm.phone.length !== 10) return toast.error('Phone number must be exactly 10 digits');
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
    if (driverForm.phone && driverForm.phone.length !== 10) return toast.error('Phone number must be exactly 10 digits');
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



  const handleToggleDriver = async (dr) => {
    try {
      await driverApi.update(dr._id, { is_active: !dr.is_active });
      toast.success(`${dr.display_name || dr.username} ${dr.is_active ? 'disabled' : 'enabled'}`);
      setConfirmDisableModal(null);
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
      can_edit_products: mgr.can_edit_products || false,
      role: mgr.role || 'manager',
      assigned_managers: mgr.assigned_managers || []
    });
    setShowEditManager(mgr);
  };

  const fld = (key, label, placeholder, type = 'text') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-control" type={type} value={mgrForm[key]} placeholder={placeholder} onChange={e => {
        let val = e.target.value;
        if (key === 'display_name') val = val.replace(/(?:^|\s)\S/g, c => c.toUpperCase());
        if (key === 'phone') val = val.replace(/\D/g, '').slice(0, 10);
        setMgrForm({ ...mgrForm, [key]: val });
      }} />
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

  const handleRowClick = async (log) => {
    if (log.action === 'report_submitted' && log.entity_id) {
      navigate('/daily-report', { state: { openReportId: log.entity_id } });
      return;
    }
    if (log.action === 'payment') {
      if (log.entity_type === 'delivery' || log.entity_type === 'settlement') {
        try {
          let supplierName = log.entity_name;
          if (log.entity_type === 'delivery') {
            const res = await deliveryApi.getById(log.entity_id);
            supplierName = res.data?.supplier;
          }
          if (supplierName && supplierName.toLowerCase() !== 'customer' && !supplierName.toLowerCase().includes('walk-in')) {
            const suppliers = await supplierApi.getAll();
            const matched = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
            if (matched) {
              navigate(`/suppliers/${matched._id}/history`, { state: { supplier: matched } });
            } else {
              const virtualId = 'virtual_' + supplierName.toLowerCase().replace(/\s+/g, '_');
              navigate(`/suppliers/${virtualId}/history`, { state: { supplier: { _id: virtualId, name: supplierName, is_virtual: true } } });
            }
            return;
          }
        } catch (err) {
          console.error('Failed to route payment log:', err);
        }
      }
      setLogDetailModal(log);
      return;
    }
    if (log.action === 'delete' || log.changes) {
      setLogDetailModal(log);
      return;
    }
    if (!log.entity_id) return;
    if (log.entity_type === 'invoice') navigate(`/invoices/${log.entity_id}`);
    else if (log.entity_type === 'trip') navigate(`/trip/${log.entity_id}`);
    else if (log.entity_type === 'vehicle') navigate(`/vehicles`);
    else if (log.entity_type === 'customer') navigate(`/customers`);
    else if (log.entity_type === 'delivery') navigate(`/walkin-delivery`);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, marginTop: '4px' }}>
              <Shield size={22} className="text-primary" /> {t('Admin Panel', 'एडमिन पैनल')}
            </div>
            <div className="page-subtitle" style={{ margin: 0 }}>Manage system access, view activity logs, and handle requests</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {activeTab === 'managers' && (
            <button 
              className="btn btn-primary"
              onClick={() => { setMgrForm({ username: '', phone: '', password: '', display_name: '', can_edit_products: false, role: 'manager', assigned_managers: [] }); setShowAddManager(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontWeight: 700, padding: '10px 18px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
            >
              <Plus size={16} /> Add Manager
            </button>
          )}
          {activeTab === 'drivers' && (
            <button 
              className="btn btn-primary"
              onClick={() => { setDriverForm({ username: '', phone: '', password: '', display_name: '' }); setShowAddDriver(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontWeight: 700, padding: '10px 18px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
            >
              <Plus size={16} /> Add Driver
            </button>
          )}
        </div>
      </div>

      {/* Standard Tabs */}
      <div className="hide-scroll" style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('managers')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
            background: activeTab === 'managers' ? 'var(--primary-light)' : 'transparent', 
            color: activeTab === 'managers' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          <Users size={16} /> {t('Managers', 'मैनेजर')}
        </button>
        <button 
          onClick={() => setActiveTab('drivers')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
            background: activeTab === 'drivers' ? 'var(--primary-light)' : 'transparent', 
            color: activeTab === 'drivers' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          <Truck size={16} /> {t('Drivers', 'ड्राइवर')}
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
            background: activeTab === 'activity' ? 'var(--primary-light)' : 'transparent', 
            color: activeTab === 'activity' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          <Activity size={16} /> {t('Activity Logs', 'गतिविधि लॉग')}
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
            background: activeTab === 'requests' ? 'var(--primary-light)' : 'transparent', 
            color: activeTab === 'requests' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          <Unlock size={16} /> Pending Requests
          {(requests.length > 0 || tripRequests.length > 0) && (
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
              {requests.length + tripRequests.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('hawkeye')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
            background: activeTab === 'hawkeye' ? 'var(--primary-light)' : 'transparent', 
            color: activeTab === 'hawkeye' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          <Eye size={16} /> Hawk Eye
        </button>
      </div>

      {activeTab === 'hawkeye' && <HawkEye />}

      {activeTab === 'managers' && (
      <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
        
        <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
          <div style={{ minWidth: 900 }}>
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
              <div key={mgr._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 180px 100px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < managers.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s', background: mgr.is_on_hold ? '#fefce8' : '#fff' }} onMouseEnter={e => e.currentTarget.style.background = mgr.is_on_hold ? '#fef9c3' : '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = mgr.is_on_hold ? '#fefce8' : '#fff'}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background 0.2s' }}
                  onClick={() => {
                    setLogFilters(f => ({ ...f, user_id: mgr._id, username: mgr.display_name || mgr.username, user_role: '' }));
                    setActiveTab('activity');
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title={`View Activity Logs for ${mgr.display_name || mgr.username}`}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', fontWeight: 700, fontSize: 16 }}>
                    {(mgr.display_name || mgr.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {mgr.display_name || '-'}
                      {mgr.role?.toLowerCase() === 'temp_manager' && (
                        <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>ASSISTANT</span>
                      )}
                      {mgr.role?.toLowerCase() === 'walkin_manager' && (
                        <span style={{ fontSize: 9, background: 'rgba(234,179,8,0.15)', color: '#ca8a04', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>SUPPLY MGR</span>
                      )}
                      {mgr.role?.toLowerCase() === 'supervisor' && (
                        <span style={{ fontSize: 9, background: 'rgba(147,51,234,0.15)', color: '#9333ea', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>SUPERVISOR</span>
                      )}
                      {(!mgr.role || mgr.role?.toLowerCase() === 'manager') && (
                        <span style={{ fontSize: 9, background: 'rgba(37,99,235,0.15)', color: '#2563eb', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>MANAGER</span>
                      )}
                      {mgr.role?.toLowerCase() === 'admin' && (
                        <span style={{ fontSize: 9, background: 'rgba(220,38,38,0.15)', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>ADMIN</span>
                      )}
                      {(mgr.role && !['manager', 'temp_manager', 'walkin_manager', 'supervisor', 'admin'].includes(mgr.role.toLowerCase())) && (
                        <span style={{ fontSize: 9, background: 'rgba(71,85,105,0.15)', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>{mgr.role.toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>@{mgr.username}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{mgr.phone || '-'}</div>
                <div>
                  <button 
                    onClick={() => {
                      if (mgr.is_active) setConfirmDisableModal({ user: mgr, type: 'manager' });
                      else handleToggleManager(mgr);
                    }}
                    style={{ background: mgr.is_on_hold ? '#fef08a' : !mgr.is_active ? '#fee2e2' : mgr.is_online ? '#dcfce7' : '#f1f5f9', color: mgr.is_on_hold ? '#a16207' : !mgr.is_active ? '#991b1b' : mgr.is_online ? '#166534' : '#475569', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}
                    title={mgr.is_active ? "Click to Disable" : "Click to Enable"}
                  >
                    {mgr.is_on_hold ? 'On Hold' : !mgr.is_active ? 'Disabled' : mgr.is_online ? 'Active' : 'Offline'}
                  </button>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: mgr.can_edit_products ? '#f0fdf4' : '#f1f5f9', color: mgr.can_edit_products ? '#15803d' : '#64748b', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {mgr.can_edit_products ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {mgr.can_edit_products ? 'Can Edit Stock' : 'View Only'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button onClick={() => setConfirmHoldModal({ user: mgr, type: 'manager' })} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: mgr.is_on_hold ? '#fef08a' : '#f1f5f9', color: mgr.is_on_hold ? '#a16207' : '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} title={mgr.is_on_hold ? "Lift Hold" : "Put on Hold"}>
                      {mgr.is_on_hold ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                      <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{mgr.is_on_hold ? 'Un-Hold' : 'Hold'}</span>
                  </button>
                  <button onClick={() => { setCloneForm({ username: '', phone: '', password: '', display_name: '' }); setCloneModal(mgr); }} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#f0fdf4', color: '#15803d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.color = '#166534'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#15803d'; }} title="Clone this manager (duplicate with same data access)">
                    <Copy size={14} />
                    <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Clone</span>
                  </button>
                  <button onClick={() => openEditModal(mgr)} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                    <Edit2 size={14} />
                    <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Edit</span>
                  </button>
                  <button onClick={() => setMgrResetModal(mgr)} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#fef3c7', color: '#b45309', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.color = '#92400e'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#b45309'; }}>
                    <Key size={14} />
                    <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Reset PW</span>
                  </button>
                  <button onClick={() => setConfirmDeleteModal({ user: mgr, type: 'manager' })} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#b91c1c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#991b1b'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}>
                    <Trash2 size={14} />
                    <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'drivers' && (
        <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          
          <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
            <div style={{ minWidth: 900 }}>
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
                <div key={dr._id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 100px', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < drivers.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s', background: dr.is_on_hold ? '#fefce8' : '#fff' }} onMouseEnter={e => e.currentTarget.style.background = dr.is_on_hold ? '#fef9c3' : '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = dr.is_on_hold ? '#fefce8' : '#fff'}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background 0.2s' }}
                    onClick={() => {
                      setLogFilters(f => ({ ...f, user_id: dr._id, username: dr.display_name || dr.username, user_role: '' }));
                      setActiveTab('activity');
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title={`View Activity Logs for ${dr.display_name || dr.username}`}
                  >
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
                      onClick={() => {
                        if (dr.is_active) setConfirmDisableModal({ user: dr, type: 'driver' });
                        else handleToggleDriver(dr);
                      }}
                      style={{ background: dr.is_on_hold ? '#fef08a' : !dr.is_active ? '#fee2e2' : dr.is_online ? '#dcfce7' : '#f1f5f9', color: dr.is_on_hold ? '#a16207' : !dr.is_active ? '#991b1b' : dr.is_online ? '#166534' : '#475569', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}
                      title={dr.is_active ? "Click to Disable" : "Click to Enable"}
                    >
                      {dr.is_on_hold ? 'On Hold' : !dr.is_active ? 'Disabled' : dr.is_online ? 'Active' : 'Offline'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button onClick={() => setConfirmHoldModal({ user: dr, type: 'driver' })} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: dr.is_on_hold ? '#fef08a' : '#f1f5f9', color: dr.is_on_hold ? '#a16207' : '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} title={dr.is_on_hold ? "Lift Hold" : "Put on Hold"}>
                        {dr.is_on_hold ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                        <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{dr.is_on_hold ? 'Un-Hold' : 'Hold'}</span>
                      </button>
                    <button onClick={() => openEditDriverModal(dr)} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                      <Edit2 size={14} />
                      <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Edit</span>
                    </button>
                    <button onClick={() => setDriverResetModal(dr)} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#fef3c7', color: '#b45309', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fde68a'; e.currentTarget.style.color = '#92400e'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#b45309'; }}>
                      <Key size={14} />
                      <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Reset PW</span>
                    </button>
                    <button onClick={() => setConfirmDeleteModal({ user: dr, type: 'driver' })} style={{ width: 'auto', minWidth: 40, height: 'auto', padding: '6px 4px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#b91c1c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#991b1b'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}>
                      <Trash2 size={14} />
                      <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
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
              {logFilters.user_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e0e7ff', color: '#3730a3', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  <Users size={14} /> {logFilters.username}
                  <button 
                    onClick={() => setLogFilters(f => ({ ...f, user_id: '', username: '' }))} 
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#3730a3', padding: 0, display: 'flex', marginLeft: 4 }} 
                    title="Clear User Filter"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
            <div style={{ minWidth: 900 }}>
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
                const isClickable = (['invoice', 'trip', 'vehicle', 'customer', 'delivery'].includes(log.entity_type) && log.entity_id) || log.action === 'report_submitted';
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
                      {log.action === 'report_submitted' && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{translateAction(log.action)}</span>}
                      {!['create', 'update', 'edit', 'delete', 'login', 'payment', 'escalate', 'security_alert', 'failed_login', 'report_submitted'].includes(log.action) && (
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{translateAction(log.action)}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {translateDetails(log.description) || '-'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <>
          <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
            
            <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
              <div style={{ minWidth: 900 }}>
                <div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 120px 150px minmax(180px, 1fr)', gap: 16, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <div>Date</div>
              <div>Manager</div>
              <div>Type</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>
            
            <div style={{ background: '#fff' }}>
              {requestsLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading requests...</div>
              ) : tripRequests.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No pending trip requests</div>
              ) : (
                tripRequests.map((req, idx) => (
                  <div key={req._id} style={{ display: 'grid', gridTemplateColumns: '150px 180px 120px 150px minmax(180px, 1fr)', gap: 16, padding: '16px 24px', alignItems: 'center', borderBottom: idx < tripRequests.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(req.createdAt).toLocaleString('en-IN')}</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{req.manager_name}</div>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: req.request_type === 'new_supply' ? '#0ea5e9' : '#eab308' }}>
                        {req.request_type === 'new_supply' ? 'New Supply' : 'New Trip'}
                      </span>
                    </div>
                    <div>
                      <span style={{ background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: req.status === 'approved' ? '#166534' : req.status === 'rejected' ? '#991b1b' : '#b45309', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {req.status === 'pending' && (
                        <>
                          <button 
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }} 
                            disabled={tripApprovingId === req._id}
                            onClick={async () => {
                              try {
                                setTripApprovingId(req._id);
                                await walkinApi.approveNextTrip(req._id);
                                toast.success('Approved!');
                                loadRequests();
                              } catch (err) {
                                toast.error(err.response?.data?.error || err.message);
                              } finally {
                                setTripApprovingId(null);
                              }
                            }}
                          >
                            {tripApprovingId === req._id ? 'Approving...' : 'Approve'}
                          </button>
                          <button 
                            style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }} 
                            onClick={async () => {
                              try {
                                setTripApprovingId(req._id);
                                await walkinApi.rejectRequest(req._id);
                                toast.success('Rejected.');
                                loadRequests();
                              } catch (err) {
                                toast.error(err.response?.data?.error || err.message);
                              } finally {
                                setTripApprovingId(null);
                              }
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
              </div>
            </div>
          </div>

        <div className="card mt-4" style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden' }}>
          
          <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
            <div style={{ minWidth: 900 }}>
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
          </div>
        </div>
        </>
      )}

      {/* Add / Edit Manager Modal */}
      {(showAddManager || showEditManager) && (
        <div className="modal-overlay" onMouseDown={() => { setShowAddManager(false); setShowEditManager(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.60)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px' }}>
          <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', margin: 'auto' }}>
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

                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Role</label>
                  <div 
                    tabIndex={0} 
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setRoleDropdownOpen(false);
                      }
                    }}
                    style={{ position: 'relative', outline: 'none' }}
                  >
                    <div 
                      onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                      className="form-control"
                      style={{ borderRadius: 8, border: roleDropdownOpen ? '1px solid #3b82f6' : '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', boxShadow: roleDropdownOpen ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none', transition: 'all 0.2s' }}
                    >
                      <span>{mgrForm.role === 'manager' ? 'Manager' : mgrForm.role === 'temp_manager' ? 'Assistant' : 'Supply Manager'}</span>
                      <ChevronDown size={18} style={{ color: '#64748b', transform: roleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </div>
                    {roleDropdownOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
                        {[
                          { value: 'manager', label: 'Manager' },
                          { value: 'temp_manager', label: 'Assistant' },
                          { value: 'walkin_manager', label: 'Supply Manager' }
                        ].map(opt => (
                          <div
                            key={opt.value}
                            onClick={() => { setMgrForm({ ...mgrForm, role: opt.value }); setRoleDropdownOpen(false); }}
                            style={{ padding: '10px 14px', cursor: 'pointer', background: mgrForm.role === opt.value ? '#eff6ff' : '#fff', color: mgrForm.role === opt.value ? '#1d4ed8' : '#334155', fontWeight: mgrForm.role === opt.value ? 600 : 400, transition: 'background 0.1s' }}
                            onMouseEnter={e => { if (mgrForm.role !== opt.value) e.currentTarget.style.background = '#f8fafc' }}
                            onMouseLeave={e => { if (mgrForm.role !== opt.value) e.currentTarget.style.background = '#fff' }}
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {mgrForm.role === 'temp_manager' && (
                  <div className="form-group mb-0" style={{ padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <label className="form-label" style={{ fontWeight: 600, color: '#334155', marginBottom: 8 }}>Assign Absent Managers</label>
                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {managers.filter(m => m.role === 'manager').map(m => (
                        <label key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                          <input 
                            type="checkbox" 
                            checked={mgrForm.assigned_managers.includes(m._id)}
                            onChange={(e) => {
                              const newAssigned = e.target.checked 
                                ? [...mgrForm.assigned_managers, m._id] 
                                : mgrForm.assigned_managers.filter(id => id !== m._id);
                              setMgrForm({ ...mgrForm, assigned_managers: newAssigned });
                            }}
                            style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                          />
                          <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{m.display_name || m.username}</span>
                        </label>
                      ))}
                      {managers.filter(m => m.role === 'manager').length === 0 && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>No managers available to assign.</div>
                      )}
                    </div>
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

      {/* Clone Manager Modal */}
      {cloneModal && (
        <div className="modal-overlay" onMouseDown={() => setCloneModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.60)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px' }}>
          <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', margin: 'auto' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #15803d, #166534)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Copy size={20} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Clone Manager</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Duplicating from: <strong>{cloneModal.display_name || cloneModal.username}</strong></div>
              </div>
            </div>
            
            <form onSubmit={handleCloneManager} style={{ padding: '24px' }}>
              <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 20, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                <strong>What will be copied:</strong>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Customers', 'Products', 'Invoices', 'Customer Lists', 'Product Lists'].map(item => (
                    <span key={item} style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>✓ {item}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Username *</label>
                  <input className="form-control" type="text" placeholder="e.g. suresh" value={cloneForm.username} onChange={e => setCloneForm({ ...cloneForm, username: e.target.value })} autoFocus style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Display Name</label>
                  <input className="form-control" type="text" placeholder="e.g. Suresh Kumar" value={cloneForm.display_name} onChange={e => setCloneForm({ ...cloneForm, display_name: e.target.value })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Phone Number</label>
                  <input className="form-control" type="text" placeholder="10-digit phone" value={cloneForm.phone} onChange={e => setCloneForm({ ...cloneForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Password *</label>
                  <input className="form-control" type="password" placeholder="Min 6 characters" value={cloneForm.password} onChange={e => setCloneForm({ ...cloneForm, password: e.target.value })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setCloneModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>{t('Cancel', 'रद्द करें')}</button>
                <button type="submit" disabled={cloning} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #22c55e, #15803d)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Copy size={16} />
                  {cloning ? 'Cloning...' : 'Clone Manager'}
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
                  <input className="form-control" type="text" placeholder="e.g. Ramesh Singh" value={driverForm.display_name} onChange={e => setDriverForm({ ...driverForm, display_name: e.target.value.replace(/(?:^|\s)\S/g, c => c.toUpperCase()) })} style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
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

      {/* Log Detail Modal */}
      {logDetailModal && (
        <div className="modal-overlay" onClick={() => setLogDetailModal(null)} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={20} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Activity Details</div>
            </div>
            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <strong>Action:</strong> {translateAction(logDetailModal.action)}<br />
                <strong>Entity:</strong> {logDetailModal.entity_name} ({logDetailModal.entity_type})<br />
                <strong>User:</strong> {logDetailModal.username} ({logDetailModal.user_role})<br />
                <strong>Time:</strong> {new Date(logDetailModal.timestamp).toLocaleString('en-IN')}
              </div>
              
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#334155', marginBottom: 16, border: '1px solid #e2e8f0' }}>
                {translateDetails(logDetailModal.description)}
              </div>

              {logDetailModal.changes && logDetailModal.changes.items && logDetailModal.changes.items.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <strong style={{ fontSize: 14, color: '#1e293b', marginBottom: 12, display: 'block', display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={16} color="var(--primary)" /> Loaded Inventory</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {logDetailModal.changes.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{item.product_name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>₹{item.price?.toLocaleString('en-IN')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#e0e7ff', padding: '4px 12px', borderRadius: 8, minWidth: 54 }}>
                            <span style={{ fontSize: 9, color: '#4338ca', textTransform: 'uppercase', fontWeight: 800 }}>Qty</span>
                            <span style={{ fontSize: 14, color: '#3730a3', fontWeight: 700 }}>{item.quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {logDetailModal.changes.total_value > 0 && (
                    <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: 15 }}>
                      Total Value: ₹{logDetailModal.changes.total_value.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              ) : logDetailModal.changes && (
                <div style={{ marginTop: 16 }}>
                  <strong style={{ fontSize: 14, color: '#1e293b', marginBottom: 8, display: 'block' }}>Changes / Details:</strong>
                  <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 12, color: '#475569', overflowX: 'auto', border: '1px solid #e2e8f0' }}>
                    {JSON.stringify(logDetailModal.changes, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setLogDetailModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Close</button>
                {logDetailModal.action !== 'delete' && logDetailModal.entity_type && ['invoice', 'trip', 'vehicle', 'customer'].includes(logDetailModal.entity_type) && logDetailModal.entity_id && (
                  <button 
                    onClick={() => {
                      setLogDetailModal(null);
                      if (logDetailModal.entity_type === 'invoice') navigate(`/invoices/${logDetailModal.entity_id}`);
                      else if (logDetailModal.entity_type === 'trip') navigate(`/trip/${logDetailModal.entity_id}`);
                      else if (logDetailModal.entity_type === 'vehicle') navigate(`/vehicles`);
                      else if (logDetailModal.entity_type === 'customer') navigate(`/customers/${logDetailModal.entity_id}/history`);
                    }} 
                    style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 8, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                  >
                    View Record
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Hold Modal */}
      {confirmHoldModal && (
        <div className="modal-overlay" onClick={() => setConfirmHoldModal(null)} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: confirmHoldModal.user.is_on_hold ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #b45309, #78350f)', color: '#fff' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                {confirmHoldModal.user.is_on_hold ? <PlayCircle size={20} /> : <PauseCircle size={20} />}
                Confirm Action
              </h3>
            </div>
            <div style={{ padding: '24px', color: '#334155', fontSize: 15, lineHeight: 1.5 }}>
              Are you sure you want to <strong>{confirmHoldModal.user.is_on_hold ? 'lift the hold on' : 'put on hold'}</strong> the account for <strong>{confirmHoldModal.user.display_name || confirmHoldModal.user.username}</strong>?
              {!confirmHoldModal.user.is_on_hold && (
                <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: '#64748b' }}>
                  If they are currently logged in, their very next action will result in them being logged out instantly.
                </p>
              )}
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-secondary" onClick={() => setConfirmHoldModal(null)} style={{ padding: '8px 16px', borderRadius: 8 }}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                const newHold = !confirmHoldModal.user.is_on_hold;
                const api = confirmHoldModal.type === 'manager' ? managerApi : driverApi;
                api.update(confirmHoldModal.user._id, { is_on_hold: newHold })
                  .then(() => { 
                    toast.success(`${confirmHoldModal.type === 'manager' ? 'Manager' : 'Driver'} ${newHold ? 'put on hold' : 'hold lifted'}`); 
                    if (confirmHoldModal.type === 'manager') loadManagers();
                    else loadDrivers();
                    setConfirmHoldModal(null);
                  })
                  .catch(err => toast.error(err.message));
              }} style={{ padding: '8px 16px', borderRadius: 8, background: confirmHoldModal.user.is_on_hold ? '#10b981' : '#f59e0b', color: '#fff', border: 'none', fontWeight: 600 }}>
                {confirmHoldModal.user.is_on_hold ? 'Lift Hold' : 'Put on Hold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteModal && (
        <div className="modal-overlay" onClick={() => { if(!isDeleting) { setConfirmDeleteModal(null); setDeleteSecretKey(''); } }} style={{ padding: '16px', backdropFilter: 'blur(5px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', color: '#fff' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={20} />
                Delete {confirmDeleteModal.type === 'manager' ? 'Manager' : 'Driver'}
              </h3>
            </div>
            <div style={{ padding: '24px', color: '#334155', fontSize: 15, lineHeight: 1.5 }}>
              Are you sure you want to permanently delete the account for <strong>{confirmDeleteModal.user.display_name || confirmDeleteModal.user.username}</strong>?
              
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#166534' }}>
                <strong>Data Preservation:</strong> The user's account will be permanently removed, but all invoices, deliveries, dues, and records they created will be preserved in the system exactly as they are.
              </div>

              <div style={{ marginTop: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Supervisor Secret Code Required</label>
                <input 
                  type="password"
                  autoFocus
                  placeholder="Enter your secret code..."
                  value={deleteSecretKey}
                  onChange={e => setDeleteSecretKey(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isDeleting || !deleteSecretKey) return;
                      setIsDeleting(true);
                      try {
                        const token = localStorage.getItem('shopbill_token');
                        const baseUrl = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;
                        const verifyRes = await fetch(`${baseUrl}/auth/verify-secret`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ username: user?.username || 'admin', secret_key: deleteSecretKey })
                        });
                        if (!verifyRes.ok) {
                          const errorData = await verifyRes.json();
                          throw new Error(errorData.error || 'Incorrect supervisor secret code.');
                        }
                        const api = confirmDeleteModal.type === 'manager' ? managerApi : driverApi;
                        await api.delete(confirmDeleteModal.user._id, deleteSecretKey);
                        toast.success(`${confirmDeleteModal.type === 'manager' ? 'Manager' : 'Driver'} deleted successfully`);
                        if (confirmDeleteModal.type === 'manager') loadManagers();
                        else loadDrivers();
                        setConfirmDeleteModal(null);
                        setDeleteSecretKey('');
                      } catch (err) {
                        toast.error(err.message || 'Invalid secret code or failed to delete');
                      } finally {
                        setIsDeleting(false);
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-secondary" disabled={isDeleting} onClick={() => { setConfirmDeleteModal(null); setDeleteSecretKey(''); }} style={{ padding: '8px 16px', borderRadius: 8 }}>Cancel</button>
              <button id="confirm-delete-btn" className="btn-primary" disabled={isDeleting || !deleteSecretKey} onClick={async () => {
                setIsDeleting(true);
                try {
                  const token = localStorage.getItem('shopbill_token');
                  const baseUrl = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;
                  const verifyRes = await fetch(`${baseUrl}/auth/verify-secret`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ username: user?.username || 'admin', secret_key: deleteSecretKey })
                  });
                  
                  if (!verifyRes.ok) {
                    const errorData = await verifyRes.json();
                    throw new Error(errorData.error || 'Incorrect supervisor secret code.');
                  }
                  
                  const api = confirmDeleteModal.type === 'manager' ? managerApi : driverApi;
                  await api.delete(confirmDeleteModal.user._id, deleteSecretKey);
                  
                  toast.success(`${confirmDeleteModal.type === 'manager' ? 'Manager' : 'Driver'} deleted successfully`);
                  if (confirmDeleteModal.type === 'manager') loadManagers();
                  else loadDrivers();
                  
                  setConfirmDeleteModal(null);
                  setDeleteSecretKey('');
                } catch (err) {
                  toast.error(err.message || 'Invalid secret code or failed to delete');
                } finally {
                  setIsDeleting(false);
                }
              }} style={{ padding: '8px 16px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 600 }}>
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDisableModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', borderRadius: 16, overflow: 'hidden', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ background: '#b91c1c', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <PauseCircle size={24} color="#fff" />
              <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Confirm Action</h2>
            </div>
            <div style={{ padding: 24, background: '#fff' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: 15, color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to <strong>disable</strong> the account for <strong>{confirmDisableModal.user.display_name || confirmDisableModal.user.username}</strong>?
              </p>
              <p style={{ margin: '0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                If they are currently logged in, their very next action will result in them being logged out instantly.
              </p>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setConfirmDisableModal(null)} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 600 }}>Cancel</button>
              <button 
                onClick={() => confirmDisableModal.type === 'manager' ? handleToggleManager(confirmDisableModal.user) : handleToggleDriver(confirmDisableModal.user)} 
                className="btn-primary" 
                style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 600, background: '#dc2626', borderColor: '#dc2626' }}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {showWalkinModal && <WalkInDeliveryModal onClose={() => setShowWalkinModal(false)} userRole="admin" />}
    </div>
  );
}
