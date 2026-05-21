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
          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifCenter(!showNotifCenter)}
              style={{
                background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'transform 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <Bell size={18} className="text-secondary" />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff',
                  fontSize: 10, fontWeight: 'bold', borderRadius: '50%', minWidth: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  boxShadow: '0 0 0 2px #fff'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifCenter && (
              <div style={{
                position: 'absolute', top: 48, right: 0, width: 320, background: '#fff',
                borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
                zIndex: 9999, overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}><Bell size={14} /> Notifications ({unreadCount})</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await notificationApi.markAllRead();
                          loadNotifications();
                          toast.success('All marked as read');
                        } catch (_) {}
                      }}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>
                      No incoming alerts yet.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n._id}
                        onClick={async () => {
                          if (!n.is_read) {
                            try {
                              await notificationApi.markRead(n._id);
                              loadNotifications();
                            } catch (_) {}
                          }
                        }}
                        style={{
                          padding: '12px 16px', borderBottom: '1px solid #f9fafb', fontSize: 12.5,
                          background: n.is_read ? '#fff' : '#f8fafc', cursor: 'pointer', transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background = n.is_read ? '#fff' : '#f8fafc'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#1f2937' }}>{n.title}</span>
                          {!n.is_read && <span style={{ width: 6, height: 6, background: '#2563eb', borderRadius: '50%', flexShrink: 0, marginTop: 4 }}></span>}
                        </div>
                        <p style={{ color: '#4b5563', margin: '4px 0 0 0', fontSize: 11.5, lineHeight: 1.4 }}>{n.message}</p>
                        <span style={{ color: '#9ca3af', fontSize: 10, marginTop: 4, display: 'block' }}>
                          {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <span style={{ ...badge('#eff6ff', '#2563eb'), display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> {user?.username}</span>
          <span style={{ ...badge('#f0fdf4', '#16a34a'), display: 'inline-flex', alignItems: 'center', gap: 4 }}><Shield size={11} /> Supervisor</span>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Managers', value: total, icon: <Users size={20} className="text-primary" />, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Total Drivers', value: drivers.length, icon: <Truck size={20} className="text-purple" style={{ color: '#7c3aed' }} />, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Recovery Requests', value: pendingCount, icon: <Key size={20} className="text-warning" style={{ color: '#f59e0b' }} />, color: pendingCount > 0 ? '#f59e0b' : '#6b7280', bg: pendingCount > 0 ? '#fffbeb' : '#f9fafb' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600, marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
        {[
          { id: 'managers', label: 'Managers', icon: <Users size={14} style={{ marginRight: 6 }} />, count: total },
          { id: 'drivers', label: 'Drivers', icon: <Truck size={14} style={{ marginRight: 6 }} />, count: drivers.length },
          { id: 'recovery', label: 'Recovery', icon: <Key size={14} style={{ marginRight: 6 }} />, count: pendingCount },
          { id: 'activity', label: 'Activity Log', icon: <FileText size={14} style={{ marginRight: 6 }} />, count: 0 },
          { id: 'walkin', label: 'Walk-in Delivery', icon: <UserCheck size={14} style={{ marginRight: 6 }} />, count: 0 },
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
            <div style={{ padding: '4px 0', maxHeight: 500, overflowY: 'auto' }}>
              {activityLogs.map((log, idx) => {
                const rcMap = { supervisor: { bg: '#eff6ff', color: '#2563eb' }, manager: { bg: '#f0fdf4', color: '#16a34a' }, driver: { bg: '#fef3c7', color: '#d97706' } };
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
                  <div key={log._id} style={{ padding: '12px 20px', borderBottom: idx < activityLogs.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {icons[log.action] || <FileText size={14} style={{ color: '#4b5563' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: '#2563eb' }}>{log.username}</span>
                        <span style={{ ...badge(rc.bg, rc.color) }}>{log.user_role}</span>
                        <span style={{ color: '#6b7280', fontWeight: 400 }}>{log.action}d</span>
                        <span style={{ ...badge('#f1f5f9', '#374151'), fontWeight: 600 }}>{log.entity_type}</span>
                        {log.entity_name && <span style={{ color: '#374151' }}>"{log.entity_name}"</span>}
                      </div>
                      {log.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{log.description}</div>}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                        {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </div>
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
}
