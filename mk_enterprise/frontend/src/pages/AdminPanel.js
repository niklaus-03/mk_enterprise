import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { managerApi, recoveryApi, driverApi, activityLogApi, notificationApi } from '../utils/api';
import { Users, Shield, Key, Bell, CheckCircle, Truck, FileText, Plus, Trash2, Phone, Pause, Play, Clock, User, LogIn, CreditCard, Package, UserCheck } from 'lucide-react';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [total, setTotal] = useState(0);
  const [drivers, setDrivers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recoveryRequests, setRecoveryRequests] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', phone: '', password: '', display_name: '' });
  const [creating, setCreating] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resolveModal, setResolveModal] = useState(null);
  const [resolvePassword, setResolvePassword] = useState('');

  // Edit User Modal
  const [editUserModal, setEditUserModal] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', display_name: '', phone: '', role: '' });
  const [editingUser, setEditingUser] = useState(false);

  // User Activity Modal
  const [userActivityModal, setUserActivityModal] = useState(null);
  const [userActivityLogs, setUserActivityLogs] = useState({});
  const [loadingUserActivity, setLoadingUserActivity] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifCenter, setShowNotifCenter] = useState(false);

  // Redirect non-admin
  useEffect(() => {
    if (!isAdmin) { navigate('/'); toast.error('Access denied'); }
  }, [isAdmin, navigate]);

  const loadManagers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await managerApi.getAll();
      setManagers(res.managers || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }, []);

  const loadDrivers = useCallback(async () => {
    try {
      const res = await driverApi.getAll();
      setDrivers(res.drivers || []);
    } catch (_) {}
  }, []);

  const [logFilter, setLogFilter] = useState({ role: '', entity_type: '' });
  const [logDate, setLogDate] = useState('');

  const loadActivityLogs = useCallback(async (filters = {}) => {
    try {
      setLogsLoading(true);
      const res = await activityLogApi.getAll({ limit: 100, ...filters });
      setActivityLogs(res.logs || []);
    } catch (_) {}
    finally { setLogsLoading(false); }
  }, []);

  const loadRecovery = useCallback(async () => {
    try {
      const res = await recoveryApi.getAll();
      setRecoveryRequests(res.requests || []);
    } catch (_) {}
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.getAll({ limit: 15 });
      setNotifications(res.notifications || []);
      const countRes = await notificationApi.getUnreadCount();
      setUnreadCount(countRes.count || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadManagers();
    loadRecovery();
    loadDrivers();
    loadNotifications();
    
    // Poll for notifications every 5 seconds for real-time feel
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadManagers, loadRecovery, loadDrivers, loadNotifications]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.username || !createForm.password) return toast.error('Username and password required');
    if (createForm.password.length < 6) return toast.error('Password must be 6+ chars');
    setCreating(true);
    try {
      await managerApi.create(createForm);
      toast.success('Manager created!');
      setShowCreate(false);
      setCreateForm({ username: '', phone: '', password: '', display_name: '' });
      loadManagers();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (mgr) => {
    if (!window.confirm(`Delete manager "${mgr.username}"? This cannot be undone.`)) return;
    try {
      await managerApi.delete(mgr._id);
      toast.success(`Manager "${mgr.username}" deleted`);
      loadManagers();
    } catch (err) { toast.error(err.message); }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) return toast.error('Minimum 6 chars');
    try {
      await managerApi.resetPassword(resetModal._id, resetPassword);
      toast.success(`Password reset for "${resetModal.username}"`);
      setResetModal(null); setResetPassword('');
    } catch (err) { toast.error(err.message); }
  };

  const handleResolve = async () => {
    if (!resolvePassword || resolvePassword.length < 6) return toast.error('Minimum 6 chars');
    try {
      await recoveryApi.resolve(resolveModal._id, resolvePassword);
      toast.success('Recovery resolved & password reset!');
      setResolveModal(null); setResolvePassword('');
      loadRecovery();
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleActive = async (mgr) => {
    try {
      await managerApi.update(mgr._id, { is_active: !mgr.is_active });
      toast.success(`${mgr.username} ${mgr.is_active ? 'deactivated' : 'activated'}`);
      loadManagers();
    } catch (err) { toast.error(err.message); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.username) return toast.error('Username/Vehicle number is required');
    setEditingUser(true);
    try {
      if (editForm.role === 'manager') {
        await managerApi.update(editUserModal._id, { username: editForm.username, display_name: editForm.display_name, phone: editForm.phone });
        toast.success('Manager updated successfully');
        loadManagers();
      } else if (editForm.role === 'driver') {
        await driverApi.update(editUserModal._id, { username: editForm.username, display_name: editForm.display_name, phone: editForm.phone });
        toast.success('Driver updated successfully');
        loadDrivers();
      }
      setEditUserModal(null);
    } catch (err) { toast.error(err.message); }
    finally { setEditingUser(false); }
  };

  const viewUserActivity = async (u, role) => {
    setUserActivityModal({ ...u, role });
    setLoadingUserActivity(true);
    try {
      const res = await activityLogApi.getByUser(u._id, { days: 10, limit: 500 });
      // Group by date
      const grouped = {};
      (res.logs || []).forEach(log => {
        const d = new Date(log.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(log);
      });
      setUserActivityLogs(grouped);
    } catch (err) { toast.error('Failed to load activity'); }
    finally { setLoadingUserActivity(false); }
  };

  const pendingCount = recoveryRequests.filter(r => r.status === 'pending').length;

  if (!isAdmin) return null;

  // ── Styles ──────────────────────────────────
  const card = { background: '#fff', borderRadius: 14, border: '1.5px solid #e5e7eb', overflow: 'hidden' };
  const cardHead = { padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 };
  const badge = (bg, color) => ({ background: bg, color, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, display: 'inline-block' });
  const btnPrimary = { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  const btnDanger = { background: '#fef2f2', border: '1.5px solid #fecaca', color: '#dc2626', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  const btnOutline = { background: '#f8fafc', border: '1.5px solid #e5e7eb', color: '#374151', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' };
  const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 };
  const modalBox = { background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' };

  return (
    <div>
      {/* ── Header ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={22} className="text-secondary" /> Admin Panel</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Manage your team & system access</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative' }}>


          <span style={{ ...badge('#eff6ff', '#2563eb'), display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> {user?.username}</span>
          <span style={{ ...badge('#f0fdf4', '#16a34a'), display: 'inline-flex', alignItems: 'center', gap: 4 }}><Shield size={11} /> Supervisor</span>
        </div>
      </div>


      {/* ── Tab Bar ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
        {[
          { id: 'managers', label: 'Managers', icon: <Users size={14} style={{ marginRight: 6 }} />, count: total },
          { id: 'drivers', label: 'Drivers', icon: <Truck size={14} style={{ marginRight: 6 }} />, count: drivers.length },
          { id: 'recovery', label: 'Recovery', icon: <Key size={14} style={{ marginRight: 6 }} />, count: pendingCount },
          { id: 'activity', label: 'Activity Log', icon: <FileText size={14} style={{ marginRight: 6 }} />, count: 0 },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'activity') loadActivityLogs({}); if (t.id === 'walkin') navigate('/walkin-delivery'); }} style={{
            flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#111827' : '#6b7280',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', fontFamily: 'inherit',
            minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {t.icon}
            {t.label} {t.count > 0 && <span style={{ ...badge(tab === t.id ? '#2563eb' : '#d1d5db', tab === t.id ? '#fff' : '#6b7280'), marginLeft: 4 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ══════════ MANAGERS TAB ══════════ */}
      {tab === 'managers' && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={16} /> Manager Accounts</div>
            <button onClick={() => setShowCreate(true)} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Manager
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : managers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 14, color: '#9ca3af' }}><FileText size={36} /></div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>No managers yet. Click "Add Manager" to create one.</div>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {managers.map((m, idx) => (
                <div key={m._id} style={{ padding: '14px 20px', borderBottom: idx < managers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 180 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: m.is_active ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#d1d5db', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
                    }}>{(m.display_name || m.username)?.[0]?.toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.display_name || m.username}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2, alignItems: 'center' }}>
                        <span>@{m.username}</span>
                        {m.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {m.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ ...badge(m.is_active ? '#f0fdf4' : '#fef2f2', m.is_active ? '#16a34a' : '#dc2626') }}>
                      {m.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {m.lastLogin ? `Last: ${new Date(m.lastLogin).toLocaleDateString('en-IN')}` : 'Never logged in'}
                    </span>
                    <button onClick={() => handleToggleActive(m)} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {m.is_active ? <><Pause size={12} /> Disable</> : <><Play size={12} /> Enable</>}
                    </button>
                    <button onClick={() => {
                      setEditUserModal(m);
                      setEditForm({ username: m.username, display_name: m.display_name || '', phone: m.phone || '', role: 'manager' });
                    }} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> Edit</button>
                    <button onClick={() => viewUserActivity(m, 'manager')} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} /> Activity</button>
                    <button onClick={() => { setResetModal(m); setResetPassword(''); }} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}><Key size={12} /> Reset PW</button>
                    <button onClick={() => handleDelete(m)} style={{ ...btnDanger, display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={13} /> Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Password Recovery Requests Tab ──────────────── */}
      {tab === 'recovery' && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Key size={16} /> Password Recovery Requests</div>
          </div>
          {recoveryRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 14, color: '#16a34a' }}><CheckCircle size={36} /></div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>No recovery requests.</div>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {recoveryRequests.map((r, idx) => (
                <div key={r._id} style={{ padding: '14px 20px', borderBottom: idx < recoveryRequests.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {r.username || r.identifier}
                      {r.phone && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8, fontSize: 12 }}>({r.phone})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      Requested: {new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ ...badge(r.status === 'pending' ? '#fffbeb' : '#f0fdf4', r.status === 'pending' ? '#f59e0b' : '#16a34a'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {r.status === 'pending' ? <><Clock size={12} /> Pending</> : <><CheckCircle size={12} /> Resolved</>}
                    </span>
                    {r.status === 'pending' && (
                      <button onClick={() => { setResolveModal(r); setResolvePassword(''); }} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 4 }}><Key size={12} /> Reset & Resolve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Drivers Tab ────────────────────────── */}
      {tab === 'drivers' && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={16} /> Driver Accounts</div>
            <button onClick={() => {
              const vn = prompt('Vehicle Number (will be username & default password):');
              if (!vn) return;
              const dn = prompt('Driver Name:');
              if (!dn) return;
              const ph = prompt('Driver Phone (optional):') || '';
              driverApi.create({ vehicle_number: vn, driver_name: dn, phone: ph })
                .then(() => { toast.success('Driver created!'); loadDrivers(); })
                .catch(err => toast.error(err.message));
            }} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Add Driver</button>
          </div>
          {drivers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 14, color: '#9ca3af' }}><Truck size={36} /></div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>No drivers yet. Click "Add Driver" to create one.</div>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {drivers.map((d, idx) => (
                <div key={d._id} style={{ padding: '14px 20px', borderBottom: idx < drivers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 180 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: d.is_active ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#d1d5db', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
                    }}>{(d.display_name || d.username)?.[0]?.toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{d.display_name || d.username}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2, alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Truck size={12} /> {d.username}</span>
                        {d.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {d.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ ...badge(d.is_active ? '#f0fdf4' : '#fef2f2', d.is_active ? '#16a34a' : '#dc2626') }}>
                      {d.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    <button onClick={() => {
                      driverApi.update(d._id, { is_active: !d.is_active })
                        .then(() => { toast.success(`${d.display_name} ${d.is_active ? 'deactivated' : 'activated'}`); loadDrivers(); })
                        .catch(err => toast.error(err.message));
                    }} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}>{d.is_active ? <><Pause size={12} /> Disable</> : <><Play size={12} /> Enable</>}</button>
                    <button onClick={() => {
                      setEditUserModal(d);
                      setEditForm({ username: d.username, display_name: d.display_name || '', phone: d.phone || '', role: 'driver' });
                    }} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} /> Edit</button>
                    <button onClick={() => viewUserActivity(d, 'driver')} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} /> Activity</button>
                    <button onClick={() => {
                      const pw = prompt('New password for driver:');
                      if (!pw || pw.length < 4) return toast.error('Min 4 chars');
                      driverApi.resetPassword(d._id, pw)
                        .then(() => toast.success('Password reset!'))
                        .catch(err => toast.error(err.message));
                    }} style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 4 }}><Key size={12} /> Reset PW</button>
                    <button onClick={() => {
                      if (!window.confirm(`Delete driver "${d.display_name}"?`)) return;
                      driverApi.delete(d._id)
                        .then(() => { toast.success('Driver deleted'); loadDrivers(); })
                        .catch(err => toast.error(err.message));
                    }} style={{ ...btnDanger, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activity Log Tab ────────────────────── */}
      {tab === 'activity' && (
        <div style={card}>
          <div style={{ ...cardHead, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={16} /> Global Activity Log</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }} value={logFilter.role}
                onChange={e => { const r = e.target.value; setLogFilter(f => ({ ...f, role: r })); loadActivityLogs({ ...(r ? { user_role: r } : {}), ...(logFilter.entity_type ? { entity_type: logFilter.entity_type } : {}), ...(logDate ? { date: logDate } : {}) }); }}>
                <option value="">All Roles</option>
                <option value="supervisor">Admin / Supervisor</option>
                <option value="manager">Manager</option>
                <option value="driver">Driver</option>
              </select>
              <select style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }} value={logFilter.entity_type}
                onChange={e => { const et = e.target.value; setLogFilter(f => ({ ...f, entity_type: et })); loadActivityLogs({ ...(logFilter.role ? { user_role: logFilter.role } : {}), ...(et ? { entity_type: et } : {}), ...(logDate ? { date: logDate } : {}) }); }}>
                <option value="">All Types</option>
                <option value="invoice">Invoice</option>
                <option value="customer">Customer</option>
                <option value="product">Product</option>
                <option value="walkin">Walk-in</option>
                <option value="delivery">Delivery</option>
                <option value="trip">Trip</option>
                <option value="stock">Stock</option>
              </select>
              <input type="date" style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }} value={logDate}
                onChange={e => { setLogDate(e.target.value); loadActivityLogs({ ...(logFilter.role ? { user_role: logFilter.role } : {}), ...(logFilter.entity_type ? { entity_type: logFilter.entity_type } : {}), ...(e.target.value ? { date: e.target.value } : {}) }); }} />
              <button onClick={() => { setLogFilter({ role: '', entity_type: '' }); setLogDate(''); loadActivityLogs({}); }} style={btnOutline}>✕ Clear</button>
              <button onClick={() => loadActivityLogs({ ...(logFilter.role ? { user_role: logFilter.role } : {}), ...(logFilter.entity_type ? { entity_type: logFilter.entity_type } : {}), ...(logDate ? { date: logDate } : {}) })} style={btnOutline}>🔄 Refresh</button>
            </div>
          </div>
          {logsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : activityLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 14, color: '#9ca3af' }}><FileText size={36} /></div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>No activity logged yet. Actions will appear here as they happen.</div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', maxHeight: 600, overflowY: 'auto' }}>
              {(() => {
                const grouped = {};
                activityLogs.forEach(log => {
                  const d = new Date(log.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
                  if (!grouped[d]) grouped[d] = [];
                  grouped[d].push(log);
                });
                return Object.entries(grouped).map(([dateStr, logs]) => (
                  <div key={dateStr} style={{ marginBottom: 28, padding: '0 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e5e7eb', paddingBottom: 6, marginBottom: 12 }}>
                      {dateStr}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {logs.map(log => {
                        const rcMap = { supervisor: { bg: '#eff6ff', color: '#2563eb' }, manager: { bg: '#f0fdf4', color: '#16a34a' }, driver: { bg: '#fffbeb', color: '#d97706' } };
                        const rc = rcMap[log.user_role] || { bg: '#f3f4f6', color: '#374151' };
                        const icons = {
                          create: <Plus size={14} style={{ color: '#16a34a' }} />,
                          update: <FileText size={14} style={{ color: '#2563eb' }} />,
                          delete: <Trash2 size={14} style={{ color: '#dc2626' }} />,
                          login: <Key size={14} style={{ color: '#d97706' }} />,
                          payment: <CreditCard size={14} style={{ color: '#16a34a' }} />,
                          stock_adjust: <Package size={14} style={{ color: '#0284c7' }} />,
                          other: <FileText size={14} style={{ color: '#4b5563' }} />
                        };
                        return (
                          <div key={log._id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: rc.bg, padding: '12px 16px', borderRadius: 10, border: `1px solid ${rc.color}30` }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${rc.color}40` }}>
                              {icons[log.action] || <FileText size={14} style={{ color: '#4b5563' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: rc.color, fontWeight: 800 }}>{log.username}</span>
                                <span style={{ ...badge('#fff', rc.color), border: `1px solid ${rc.color}40` }}>{log.user_role}</span>
                                <span style={{ color: '#6b7280', fontWeight: 500 }}>{log.action}d</span>
                                <span style={{ ...badge('#fff', '#374151'), border: '1px solid #d1d5db' }}>{log.entity_type}</span>
                                {log.entity_name && <span style={{ color: '#111827', fontWeight: 700 }}>"{log.entity_name}"</span>}
                              </div>
                              {log.description && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>{log.description}</div>}
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontWeight: 600 }}>
                                {new Date(log.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Create Manager Modal ───────────────── */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={18} className="text-primary" /> Create New Manager</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              No limit — add as many managers as needed
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Username *</label>
                <input style={inputStyle} placeholder="e.g. rahul" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Display Name</label>
                <input style={inputStyle} placeholder="e.g. Rahul Sharma" value={createForm.display_name} onChange={e => setCreateForm({ ...createForm, display_name: e.target.value })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Phone Number</label>
                <input style={inputStyle} placeholder="10-digit phone" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Password *</label>
                <input style={inputStyle} type="password" placeholder="Min 6 characters" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ ...btnOutline, flex: 1, padding: '10px' }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ ...btnPrimary, flex: 1, padding: '10px', opacity: creating ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {creating ? 'Creating...' : <><CheckCircle size={14} /> Create Manager</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ───────────────── */}
      {resetModal && (
        <div style={modalOverlay} onClick={() => setResetModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Key size={18} className="text-primary" /> Reset Password</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>For: <strong>{resetModal.username}</strong></div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>New Password *</label>
              <input style={inputStyle} type="password" placeholder="Min 6 characters" value={resetPassword} onChange={e => setResetPassword(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setResetModal(null)} style={{ ...btnOutline, flex: 1, padding: '10px' }}>Cancel</button>
              <button onClick={handleResetPassword} style={{ ...btnPrimary, flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle size={14} /> Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resolve Recovery Modal ─────────────── */}
      {resolveModal && (
        <div style={modalOverlay} onClick={() => setResolveModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Key size={18} className="text-warning" style={{ color: '#d97706' }} /> Resolve Recovery Request</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>User: <strong>{resolveModal.username || resolveModal.identifier}</strong></div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Set New Password *</label>
              <input style={inputStyle} type="password" placeholder="Min 6 characters" value={resolvePassword} onChange={e => setResolvePassword(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setResolveModal(null)} style={{ ...btnOutline, flex: 1, padding: '10px' }}>Cancel</button>
              <button onClick={handleResolve} style={{ ...btnPrimary, flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle size={14} /> Reset & Resolve</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ────────────────────── */}
      {editUserModal && (
        <div style={modalOverlay} onClick={() => setEditUserModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><User size={18} className="text-primary" /> Edit {editForm.role === 'manager' ? 'Manager' : 'Driver'} Details</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Update the account profile and login information.
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>{editForm.role === 'manager' ? 'Username' : 'Vehicle Number (Username)'} *</label>
                <input style={inputStyle} value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Display Name</label>
                <input style={inputStyle} value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Phone Number</label>
                <input style={inputStyle} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setEditUserModal(null)} style={{ ...btnOutline, flex: 1, padding: '10px' }}>Cancel</button>
                <button type="submit" disabled={editingUser} style={{ ...btnPrimary, flex: 1, padding: '10px', opacity: editingUser ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {editingUser ? 'Saving...' : <><CheckCircle size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── User Activity Modal ─────────────── */}
      {userActivityModal && (
        <div style={modalOverlay} onClick={() => setUserActivityModal(null)}>
          <div style={{...modalBox, maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column'}} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={20} className="text-primary" /> Activity Log (Last 10 Days)
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  For: <strong>{userActivityModal.display_name || userActivityModal.username}</strong> ({userActivityModal.role})
                </div>
              </div>
              <button onClick={() => setUserActivityModal(null)} style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
              {loadingUserActivity ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading activity...</div>
              ) : Object.keys(userActivityLogs).length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ color: '#6b7280', fontSize: 14 }}>No activity found for this user in the last 10 days.</div>
                </div>
              ) : (
                Object.entries(userActivityLogs).map(([dateStr, logs]) => (
                  <div key={dateStr} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e5e7eb', paddingBottom: 6, marginBottom: 12 }}>
                      {dateStr}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {logs.map((log) => {
                        const icons = {
                          create: <Plus size={14} style={{ color: '#16a34a' }} />,
                          update: <FileText size={14} style={{ color: '#2563eb' }} />,
                          delete: <Trash2 size={14} style={{ color: '#dc2626' }} />,
                          login: <Key size={14} style={{ color: '#d97706' }} />,
                          payment: <CreditCard size={14} style={{ color: '#16a34a' }} />,
                          stock_adjust: <Package size={14} style={{ color: '#0284c7' }} />,
                          other: <FileText size={14} style={{ color: '#4b5563' }} />
                        };
                        return (
                          <div key={log._id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#f8fafc', padding: '10px 14px', borderRadius: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                              {icons[log.action] || <FileText size={12} style={{ color: '#4b5563' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                                <span style={{ color: '#6b7280', fontWeight: 400 }}>{log.action}d</span> <span style={{ color: '#374151', fontWeight: 600 }}>{log.entity_type}</span>
                                {log.entity_name && <span style={{ color: '#374151' }}> "{log.entity_name}"</span>}
                              </div>
                              {log.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{log.description}</div>}
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                {new Date(log.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
