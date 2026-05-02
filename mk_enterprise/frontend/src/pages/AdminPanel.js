import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { managerApi, recoveryApi } from '../utils/api';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(5);
  const [remaining, setRemaining] = useState(5);
  const [loading, setLoading] = useState(true);
  const [recoveryRequests, setRecoveryRequests] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', phone: '', password: '', display_name: '' });
  const [creating, setCreating] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resolveModal, setResolveModal] = useState(null);
  const [resolvePassword, setResolvePassword] = useState('');

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
      setLimit(res.limit || 5);
      setRemaining(res.remaining ?? 5);
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }, []);

  const loadRecovery = useCallback(async () => {
    try {
      const res = await recoveryApi.getAll();
      setRecoveryRequests(res.requests || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadManagers(); loadRecovery(); }, [loadManagers, loadRecovery]);

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
  const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16, backdropFilter: 'blur(2px)' };
  const modalBox = { background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' };

  return (
    <div>
      {/* ── Header ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>👑 Admin Panel</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Manage your team & system access</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...badge('#eff6ff', '#2563eb') }}>👤 {user?.username}</span>
          <span style={{ ...badge('#f0fdf4', '#16a34a') }}>Supervisor</span>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Managers', value: total, icon: '👥', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Manager Slots', value: `${total} / ${limit}`, icon: '📊', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Remaining Slots', value: remaining, icon: '➕', color: remaining > 0 ? '#16a34a' : '#dc2626', bg: remaining > 0 ? '#f0fdf4' : '#fef2f2' },
          { label: 'Recovery Requests', value: pendingCount, icon: '🔑', color: pendingCount > 0 ? '#f59e0b' : '#6b7280', bg: pendingCount > 0 ? '#fffbeb' : '#f9fafb' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600, marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
        {[
          { id: 'managers', label: '👥 Managers', count: total },
          { id: 'recovery', label: '🔑 Recovery Requests', count: pendingCount },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#111827' : '#6b7280',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            {t.label} {t.count > 0 && <span style={{ ...badge(tab === t.id ? '#2563eb' : '#d1d5db', tab === t.id ? '#fff' : '#6b7280'), marginLeft: 6 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ══════════ MANAGERS TAB ══════════ */}
      {tab === 'managers' && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>👥 Manager Accounts</div>
            <button onClick={() => { if (remaining <= 0) return toast.error('Manager limit reached (5/5)'); setShowCreate(true); }} style={{ ...btnPrimary, opacity: remaining <= 0 ? 0.5 : 1 }}>
              ➕ Add Manager
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : managers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
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
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                        <span>@{m.username}</span>
                        {m.phone && <span>📞 {m.phone}</span>}
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
                    <button onClick={() => handleToggleActive(m)} style={btnOutline}>
                      {m.is_active ? '⏸ Disable' : '▶ Enable'}
                    </button>
                    <button onClick={() => { setResetModal(m); setResetPassword(''); }} style={btnOutline}>🔑 Reset PW</button>
                    <button onClick={() => handleDelete(m)} style={btnDanger}>🗑️ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ RECOVERY TAB ══════════ */}
      {tab === 'recovery' && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🔑 Password Recovery Requests</div>
          </div>
          {recoveryRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
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
                    <span style={{ ...badge(r.status === 'pending' ? '#fffbeb' : '#f0fdf4', r.status === 'pending' ? '#f59e0b' : '#16a34a') }}>
                      {r.status === 'pending' ? '⏳ Pending' : '✅ Resolved'}
                    </span>
                    {r.status === 'pending' && (
                      <button onClick={() => { setResolveModal(r); setResolvePassword(''); }} style={btnPrimary}>🔑 Reset & Resolve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ CREATE MANAGER MODAL ══════════ */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>➕ Create New Manager</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Slots: {total}/{limit} used · {remaining} remaining
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
                <button type="submit" disabled={creating} style={{ ...btnPrimary, flex: 1, padding: '10px', opacity: creating ? 0.6 : 1 }}>
                  {creating ? 'Creating...' : '✅ Create Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ RESET PASSWORD MODAL ══════════ */}
      {resetModal && (
        <div style={modalOverlay} onClick={() => setResetModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🔑 Reset Password</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>For: <strong>{resetModal.username}</strong></div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>New Password *</label>
              <input style={inputStyle} type="password" placeholder="Min 6 characters" value={resetPassword} onChange={e => setResetPassword(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setResetModal(null)} style={{ ...btnOutline, flex: 1, padding: '10px' }}>Cancel</button>
              <button onClick={handleResetPassword} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>✅ Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ RESOLVE RECOVERY MODAL ══════════ */}
      {resolveModal && (
        <div style={modalOverlay} onClick={() => setResolveModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🔑 Resolve Recovery Request</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>User: <strong>{resolveModal.username || resolveModal.identifier}</strong></div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Set New Password *</label>
              <input style={inputStyle} type="password" placeholder="Min 6 characters" value={resolvePassword} onChange={e => setResolvePassword(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setResolveModal(null)} style={{ ...btnOutline, flex: 1, padding: '10px' }}>Cancel</button>
              <button onClick={handleResolve} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>✅ Reset & Resolve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
