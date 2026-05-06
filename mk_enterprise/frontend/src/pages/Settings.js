import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { authApi, seedApi, managerApi } from '../utils/api';
import { Settings as SettingsIcon, Users, Plus, Phone, Trash2, Key, CheckCircle, Briefcase, CreditCard, FileText, AlertTriangle, User, Truck, DollarSign, Activity, Calendar } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings } = useApp();
  const { admin, isAdmin } = useAuth();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // ── Manager Management State (supervisor only) ──────────────────────────────
  const [managers, setManagers] = useState([]);
  const [mgrTotal, setMgrTotal] = useState(0);
  const [mgrLimit, setMgrLimit] = useState(5);
  const [mgrRemaining, setMgrRemaining] = useState(5);
  const [mgrLoading, setMgrLoading] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [mgrForm, setMgrForm] = useState({ username: '', phone: '', password: '', display_name: '' });
  const [mgrCreating, setMgrCreating] = useState(false);
  const [mgrResetModal, setMgrResetModal] = useState(null);
  const [mgrResetPw, setMgrResetPw] = useState('');

  const loadManagers = useCallback(async () => {
    if (!isAdmin) return;
    setMgrLoading(true);
    try {
      const res = await managerApi.getAll();
      setManagers(res.managers || []);
      setMgrTotal(res.total || 0);
      setMgrLimit(res.limit || 5);
      setMgrRemaining(res.remaining ?? 5);
    } catch (err) { toast.error(err.message); }
    finally { setMgrLoading(false); }
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
      setMgrForm({ username: '', phone: '', password: '', display_name: '' });
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

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await updateSettings(form); toast.success('Settings saved!'); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password) return toast.error('Fill all password fields');
    if (pwForm.new_password.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error('Passwords do not match');
    setPwSaving(true);
    try {
      await authApi.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.message); }
    finally { setPwSaving(false); }
  };

  const handleSeed = async () => {
    if (!window.confirm('Load sample products and customers? (Safe if none exist)')) return;
    setSeeding(true);
    try { await seedApi.run(); toast.success('Sample data loaded!'); }
    catch (err) { toast.error(err.message); }
    finally { setSeeding(false); }
  };

  const fld = (key, label, placeholder, type = 'text', hint = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-control" type={type} value={form[key] || ''} placeholder={placeholder} onChange={e => setForm({ ...form, [key]: e.target.value })} />
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );

  const tog = (key, onLabel, offLabel, hint = '') => (
    <div className="form-group">
      <div className="flex gap-2">
        <button type="button" className={`btn btn-sm ${form[key] ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, [key]: true })}>{onLabel}</button>
        <button type="button" className={`btn btn-sm ${!form[key] ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, [key]: false })}>{offLabel}</button>
      </div>
      {hint && <div className="form-hint" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title d-flex align-items-center gap-2"><SettingsIcon size={22} className="text-secondary" /> Settings</div>
          <div className="page-subtitle">Configure business details, billing, and system preferences</div>
        </div>
      </div>

      {/* ══════════ MANAGER MANAGEMENT — Supervisor Only ══════════ */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="card-title d-flex align-items-center gap-2"><Users size={18} className="text-secondary" /> Manager Accounts</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {mgrTotal} / {mgrLimit} slots used · {mgrRemaining} remaining
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
              onClick={() => { if (mgrRemaining <= 0) return toast.error(`Manager limit reached (${mgrLimit}/${mgrLimit})`); setShowAddManager(true); }}
              style={{ opacity: mgrRemaining <= 0 ? 0.5 : 1 }}
            >
              <Plus size={14} /> Add New Manager
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {mgrLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading managers...</div>
            ) : managers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ marginBottom: 8, opacity: 0.6 }}><Briefcase size={36} className="text-secondary mx-auto" /></div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No managers yet. Click "Add New Manager" to create one.</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6, opacity: 0.7 }}>Managers can perform billing, manage customers, and products — but cannot see each other's profiles.</div>
              </div>
            ) : (
              <div>
                {managers.map((m, idx) => (
                  <div key={m._id} style={{
                    padding: '14px 20px',
                    borderBottom: idx < managers.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  }}>
                    {/* Left: avatar + info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 180 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: m.is_active ? 'linear-gradient(135deg, var(--primary), #8b5cf6)' : 'var(--text-muted)',
                        color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0,
                        transition: 'all 0.2s',
                      }}>
                        {(m.display_name || m.username)?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{m.display_name || m.username}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                          <span>@{m.username}</span>
                          {m.phone && <span className="d-inline-flex align-items-center gap-1"><Phone size={12} /> {m.phone}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Right: status + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`badge ${m.is_active ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10.5, fontWeight: 700 }}>
                        {m.is_active ? '● Active' : '○ Inactive'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {m.lastLogin ? `Last: ${new Date(m.lastLogin).toLocaleDateString('en-IN')}` : 'Never logged in'}
                      </span>
                      <button className="btn btn-outline btn-sm" onClick={() => handleToggleManager(m)}>
                        {m.is_active ? '⏸ Disable' : '▶ Enable'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setMgrResetModal(m); setMgrResetPw(''); }}>
                        🔑 Reset PW
                      </button>
                      <button className="btn btn-sm d-inline-flex align-items-center gap-1" style={{ background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #dc2626)', border: '1px solid var(--danger-border, #fecaca)' }} onClick={() => handleDeleteManager(m)}>
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Manager Modal ──────────────────────────────── */}
      {showAddManager && (
        <div className="modal-overlay" onClick={() => setShowAddManager(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>➕ Add New Manager</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Slots: {mgrTotal}/{mgrLimit} used · {mgrRemaining} remaining
            </div>
            <form onSubmit={handleCreateManager}>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-control" placeholder="e.g. rahul" value={mgrForm.username} onChange={e => setMgrForm({ ...mgrForm, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-control" placeholder="e.g. Rahul Sharma" value={mgrForm.display_name} onChange={e => setMgrForm({ ...mgrForm, display_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-control" placeholder="10-digit phone" value={mgrForm.phone} onChange={e => setMgrForm({ ...mgrForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrForm.password} onChange={e => setMgrForm({ ...mgrForm, password: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddManager(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, opacity: mgrCreating ? 0.6 : 1 }} disabled={mgrCreating}>
                  {mgrCreating ? 'Creating...' : '✅ Create Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Manager Password Modal ──────────────────── */}
      {mgrResetModal && (
        <div className="modal-overlay" onClick={() => setMgrResetModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🔑 Reset Password</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>For: <strong>{mgrResetModal.display_name || mgrResetModal.username}</strong></div>
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrResetPw} onChange={e => setMgrResetPw(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setMgrResetModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleResetManagerPw}>✅ Reset Password</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Business Info */}
        <div className="card">
          <div className="card-header"><div className="card-title">🏪 Business Information</div></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              {fld('business_name', 'Shop / Business Name *', 'e.g. Ram General Store')}
              {fld('business_address', 'Address', 'Full address with pincode')}
              {fld('business_phone', 'Phone Number', '10-digit mobile')}
              {fld('business_email', 'Email (optional)', 'business@email.com', 'email')}
              {fld('business_gstin', 'GSTIN', '22AAAAA0000A1Z5')}
              {fld('business_state', 'State', 'e.g. Uttarakhand')}
              {fld('invoice_prefix', 'Invoice Prefix', 'INV', 'text', 'Invoices will be: INV-00001, INV-00002...')}
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save Business Info'}</button>
            </form>
          </div>
        </div>

        {/* UPI + Bank Details */}
        <div className="card">
          <div className="card-header"><div className="card-title">📱 UPI & Bank Details</div></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              {fld('upi_id', 'UPI ID', 'yourname@upi', 'text', 'QR code generated on invoice')}
              {fld('upi_name', 'UPI Display Name', 'Your Shop Name')}
              <hr className="divider" />
              {/* Enhancement 5: bank details */}
              <div className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🏦 Bank Transfer Details (shown on invoice)</div>
              {fld('bank_name', 'Bank Name', 'e.g. State Bank of India')}
              {fld('bank_account', 'Account Number', 'e.g. 1234567890')}
              {fld('bank_ifsc', 'IFSC Code', 'e.g. SBIN0001234')}
              {fld('bank_branch', 'Branch (optional)', 'e.g. Main Branch, Delhi')}
              <div className="form-hint" style={{ marginBottom: 12 }}>Bank details will appear on every invoice if Account Number and IFSC are filled.</div>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save UPI & Bank'}</button>
            </form>
          </div>
        </div>

        {/* Billing Preferences */}
        <div className="card">
          <div className="card-header"><div className="card-title">🧾 Billing Preferences</div></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">GST Mode</label>
                {tog('gst_enabled', '✅ GST Enabled', '❌ GST Disabled', 'When disabled, CGST/SGST columns hidden from invoices.')}
              </div>
              <div className="form-group">
                <label className="form-label">Discount Field</label>
                {tog('discount_enabled', '✅ Show Discount', '❌ Hide Discount', 'Show/hide overall discount field during billing.')}
              </div>
              <div className="form-group">
                <label className="form-label">Interface Language</label>
                <div className="flex gap-2">
                  {[['en', '🇬🇧 English'], ['hi', '🇮🇳 हिन्दी']].map(([v, l]) => (
                    <button key={v} type="button" className={`btn ${form.language === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, language: v })}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Vehicle charge toggle */}
              <div className="form-group">
                <label className="form-label">🚛 Vehicle Charge Field</label>
                <div className="flex gap-2">
                  <button type="button" className={`btn btn-sm ${form.vehicle_charge_enabled !== false ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({ ...form, vehicle_charge_enabled: true })}>✅ Show</button>
                  <button type="button" className={`btn btn-sm ${form.vehicle_charge_enabled === false ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({ ...form, vehicle_charge_enabled: false })}>❌ Hide</button>
                </div>
                <div className="form-hint">Show or hide the vehicle charge field on invoice</div>
              </div>

              {/* Labour charge toggle */}
              <div className="form-group">
                <label className="form-label">👷 Labour Charge Field</label>
                <div className="flex gap-2">
                  <button type="button" className={`btn btn-sm ${form.labour_charge_enabled !== false ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({ ...form, labour_charge_enabled: true })}>✅ Show</button>
                  <button type="button" className={`btn btn-sm ${form.labour_charge_enabled === false ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({ ...form, labour_charge_enabled: false })}>❌ Hide</button>
                </div>
                <div className="form-hint">Show or hide the labour charge field on invoice</div>
              </div>

              {/* Signature toggle */}
              <div className="form-group">
                <label className="form-label">✍️ Authorized Signature</label>
                <div className="flex gap-2">
                  <button type="button" className={`btn btn-sm ${form.signature_enabled !== false ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({ ...form, signature_enabled: true })}>✅ Enabled</button>
                  <button type="button" className={`btn btn-sm ${form.signature_enabled === false ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({ ...form, signature_enabled: false })}>❌ Disabled</button>
                </div>
                <div className="form-hint">Enable or disable the signature field on invoices. When enabled, a drawing canvas appears during billing.</div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save Preferences'}</button>
            </form>
          </div>
        </div>

        {/* Enhancement 1: Low Stock Threshold */}
        <div className="card">
          <div className="card-header"><div className="card-title">⚠️ Low Stock Alert Settings</div></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Global Low Stock Threshold</label>
                <input className="form-control" type="number" min="0" value={form.low_stock_threshold ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;

                    setForm({
                      ...form,
                      low_stock_threshold: value === "" ? "" : Number(value)
                    });
                  }} />
                <div className="form-hint">Products with stock at or below this value show as low stock alerts. Each product can have its own override threshold set in the Product menu.</div>
              </div>
              <div className="alert alert-info">
                💡 <strong>Per-product override:</strong> Go to Products → Edit any product → set "Custom Low Stock Alert" to override this global value for that specific product.
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save Threshold'}</button>
            </form>
          </div>
        </div>

        {/* Enhancement 6: Quintal Tax System */}
        <div className="card">
          <div className="card-header"><div className="card-title">⚖️ Quintal-Based Tax System</div></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Quintal Tax Mode</label>
                {tog('quintal_tax_enabled', '✅ Enabled', '❌ Disabled', 'When enabled, system suggests prices based on weight (kg) per unit × Tax per Quintal.')}
              </div>
              {form.quintal_tax_enabled && (
                <>
                  <div className="form-group">
                    <label className="form-label">Tax per Quintal (₹/100kg)</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={form.tax_per_quintal || 0} onChange={e => setForm({ ...form, tax_per_quintal: parseFloat(e.target.value) })} placeholder="e.g. 250" />
                    <div className="form-hint">System will suggest: (Weight per unit ÷ 100) × Tax per Quintal as the product price. Admin can override the price freely.</div>
                  </div>
                  <div className="alert alert-warning">
                    ⚠️ Quintal tax is <strong>NOT shown separately</strong> on invoices. The suggested price already includes it. Admin has full control to override the final price.
                  </div>
                </>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save Quintal Settings'}</button>
            </form>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="card-header"><div className="card-title">🔐 Change Password</div></div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: 16 }}>Logged in as <strong>{admin?.username}</strong></div>
            <form onSubmit={handlePwChange}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-control" type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="Current password" />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-control" type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="At least 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-control" type="password" value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="Re-enter new password" />
              </div>
              <button type="submit" className="btn btn-warning" disabled={pwSaving}>{pwSaving ? 'Changing...' : '🔑 Change Password'}</button>
            </form>
          </div>
        </div>

        {/* Utilities */}
        <div className="card">
          <div className="card-header"><div className="card-title">🛠️ Utilities & Deployment</div></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Load Sample Data</label>
              <div className="form-hint" style={{ marginBottom: 8 }}>Adds 10 sample products and 3 sample customers (only if none exist).</div>
              <button className="btn btn-outline" onClick={handleSeed} disabled={seeding}>{seeding ? 'Loading...' : '📦 Load Sample Data'}</button>
            </div>
            <hr className="divider" />
            <div className="alert alert-info">
              <div>
                <strong>🌐 Online Deployment:</strong>
                <ol style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2.2 }}>
                  <li>Backend → <strong>Render.com</strong> (free tier)</li>
                  <li>Frontend → <strong>Vercel.com</strong> (free tier)</li>
                  <li>Set <code>REACT_APP_API_URL</code> to your backend URL on Vercel</li>
                  <li>Set <code>FRONTEND_URL</code> to your Vercel URL on Render</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Templates — full width */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">📝 Message Templates</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Edit reusable templates for reports and alerts</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Low Stock Template */}
            <div>
              <label className="form-label" style={{ fontWeight: 600 }}>⚠️ Low Stock Alert Template</label>
              <textarea
                className="form-control"
                rows={5}
                value={form.template_low_stock || ''}
                onChange={e => setForm({ ...form, template_low_stock: e.target.value })}
                placeholder={`⚠️ Low Stock Alert — {shop_name}\nDate: {date}\n{items}\nPlease arrange stock at earliest.`}
                style={{ fontFamily: 'monospace', fontSize: 12.5, resize: 'vertical' }}
              />
              <div className="form-hint">Variables: {'{shop_name}'}, {'{date}'}, {'{items}'}</div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginTop: 6 }}
                onClick={() => {
                  navigator.clipboard.writeText(form.template_low_stock || '');
                  toast.success('Template copied!');
                }}
              >📋 Copy Template</button>
            </div>

            {/* Due Reminder Template */}
            <div>
              <label className="form-label" style={{ fontWeight: 600 }}>💰 Due Reminder Template</label>
              <textarea
                className="form-control"
                rows={5}
                value={form.template_due_reminder || ''}
                onChange={e => setForm({ ...form, template_due_reminder: e.target.value })}
                placeholder={`Dear {customer_name},\nYour outstanding balance is ₹{amount}.\nPlease clear at earliest.\n— {shop_name}`}
                style={{ fontFamily: 'monospace', fontSize: 12.5, resize: 'vertical' }}
              />
              <div className="form-hint">Variables: {'{customer_name}'}, {'{amount}'}, {'{shop_name}'}</div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginTop: 6 }}
                onClick={() => {
                  navigator.clipboard.writeText(form.template_due_reminder || '');
                  toast.success('Template copied!');
                }}
              >📋 Copy Template</button>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Templates'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : '💾 Save All Settings'}</button>
      </div>
    </div>
  );
}
