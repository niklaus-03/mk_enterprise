import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi, seedApi, managerApi } from '../utils/api';
import { 
  Settings as SettingsIcon, Users, Plus, Phone, Trash2, Key, CheckCircle, CheckCircle2,
  Briefcase, CreditCard, FileText, AlertTriangle, User, Truck, DollarSign, 
  Activity, Calendar, Building2, Shield, Languages, Save, Package
} from 'lucide-react';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

export default function Settings() {
  const { settings, updateSettings } = useApp();
  const { admin, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState(isAdmin ? 'general' : 'billing');

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
  useRegisterRefresh(loadManagers);

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
    if (!window.confirm(`Delete manager "${mgr.display_name || mgr.username}"?\n\n\\nNote: All records created by this manager will be preserved.`)) return;
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


  const handleUpdateSetting = async (key, value) => {
    if (form[key] === value) return;
    const newForm = { ...form, [key]: value };
    setForm(newForm);
    try { 
      await updateSettings(newForm); 
      toast.success('Setting updated'); 
    }
    catch (err) { toast.error(err.message); }
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
      <input 
        className="form-control" 
        type={type} 
        value={form[key] || ''} 
        placeholder={placeholder} 
        onChange={e => setForm({ ...form, [key]: e.target.value })} 
        onBlur={e => handleUpdateSetting(key, e.target.value)}
      />
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );

  const radioGroup = (key, options, label, hint = '') => (
    <div className="form-group">
      {label && <label className="form-label" style={{ marginBottom: 12 }}>{label}</label>}
      <div className="list-group-radio">
        {options.map((opt) => (
          <div 
            key={opt.value} 
            className={`list-group-item-radio ${form[key] === opt.value ? 'active' : ''}`}
            onClick={() => handleUpdateSetting(key, opt.value)}
          >
            <div className="radio-indicator" />
            <div className="radio-content">
              <span className="radio-title">{opt.title}</span>
              {opt.desc && <span className="radio-desc">{opt.desc}</span>}
            </div>
          </div>
        ))}
      </div>
      {hint && <div className="form-hint" style={{ marginTop: -12, marginBottom: 16 }}>{hint}</div>}
    </div>
  );

  const lang = settings.language === 'hi';
  const t = (en, hi_text) => lang ? hi_text : en;

  const tabs = [
    ...(isAdmin ? [
      { id: 'general', label: t('General', 'सामान्य'), icon: <Building2 size={18} /> },
    ] : []),
    { id: 'billing', label: t('Billing', 'बिलिंग'), icon: <FileText size={18} /> },
    ...(admin?.role !== 'temp_manager' ? [
      { id: 'inventory', label: t('Inventory', 'इन्वेंट्री'), icon: <Package size={18} /> },
    ] : []),
    { id: 'security', label: t('Security', 'सुरक्षा'), icon: <Key size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
      <div className="page-header" style={{ textAlign: 'center', alignItems: 'center' }}>
        <div style={{ margin: '0 auto' }}>
          <div className="page-title d-flex align-items-center justify-content-center gap-2">
            <SettingsIcon size={22} className="text-secondary" /> 
            {t('Settings', 'सेटिंग्स')}
          </div>
        </div>
      </div>

      <div className="settings-container">
        {/* Sidebar Navigation */}
        <div className="settings-sidebar">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="settings-main">
          
          {activeTab === 'general' && isAdmin && (
            <div className="flex flex-column gap-4">
              <div className="card">
                <div className="card-header"><div className="card-title">🏪 Business Information</div></div>
                <div className="card-body">
                  {fld('business_name', 'Shop / Business Name *', 'e.g. Ram General Store')}
                  {fld('business_address', 'Address', 'Full address with pincode')}
                  {fld('business_phone', 'Phone Number', '10-digit mobile')}
                  {fld('business_email', 'Email (optional)', 'business@email.com', 'email')}
                  {fld('business_gstin', 'GSTIN', '22AAAAA0000A1Z5')}
                  {fld('business_state', 'State', 'e.g. Uttarakhand')}
                  {fld('invoice_prefix', 'Invoice Prefix', 'INV', 'text', 'Invoices will be: INV-00001, INV-00002...')}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">📱 UPI & Bank Details</div></div>
                <div className="card-body">
                  {fld('upi_id', 'UPI ID', 'yourname@upi', 'text', 'QR code generated on invoice')}
                  {fld('upi_name', 'UPI Display Name', 'Your Shop Name')}
                  <hr className="divider" style={{ margin: '20px 0' }} />
                  <div className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🏦 Bank Transfer Details</div>
                  {fld('bank_name', 'Bank Name', 'e.g. State Bank of India')}
                  {fld('bank_account', 'Account Number', 'e.g. 1234567890')}
                  {fld('bank_ifsc', 'IFSC Code', 'e.g. SBIN0001234')}
                  {fld('bank_branch', 'Branch (optional)', 'e.g. Main Branch, Delhi')}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">⏰ Daily Report Reminders</div></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Report Reminder Time (IST)</label>
                    <input className="form-control" type="time" value={form.report_reminder_time || '19:00'} onChange={e => setForm({ ...form, report_reminder_time: e.target.value })} onBlur={e => handleUpdateSetting('report_reminder_time', e.target.value)} />
                    <div className="form-hint">Managers will receive an automatic notification at this time to submit their report.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="flex flex-column gap-4">
              <div className="card">
                <div className="card-header"><div className="card-title">🧾 Billing Preferences</div></div>
                <div className="card-body">
                  {admin?.role !== 'temp_manager' && radioGroup('gst_enabled', [
                    { value: true, title: '✅ GST Enabled', desc: 'CGST/SGST columns will be shown on invoices and reports.' },
                    { value: false, title: '❌ GST Disabled', desc: 'Tax columns will be hidden for a cleaner look.' }
                  ], 'GST Mode')}

                  {admin?.role !== 'temp_manager' && radioGroup('customize_prev_due_enabled', [
                    { value: true, title: '✅ Show Customize Previous Due', desc: 'Allow managers to selectively include/exclude past invoices when printing new bills.' },
                    { value: false, title: '❌ Hide Customize Previous Due', desc: 'Strictly enforce the system-calculated previous due without allowing manual edits.' }
                  ], 'Customize Previous Due')}

                  {radioGroup('discount_enabled', [
                    { value: true, title: '✅ Show Discount', desc: 'Enable overall discount field during billing.' },
                    { value: false, title: '❌ Hide Discount', desc: 'Keep billing simplified without discount fields.' }
                  ], 'Discount Field')}

                  {form.discount_enabled && (
                    <div style={{ paddingLeft: '16px', marginTop: '-12px', marginBottom: '24px', borderLeft: '2px solid var(--primary)' }}>
                      {radioGroup('discount_type', [
                        { value: 'amount', title: '₹ Amount (Flat)', desc: 'Enter a fixed discount amount (e.g. ₹50)' },
                        { value: 'percentage', title: '% Percentage', desc: 'Enter a percentage of the total (e.g. 5%)' }
                      ], 'Discount Type')}
                    </div>
                  )}

                  {radioGroup('vehicle_charge_enabled', [
                    { value: true, title: '✅ Show Vehicle Charge', desc: 'Add a field for transportation/delivery costs.' },
                    { value: false, title: '❌ Hide Vehicle Charge', desc: 'Do not show transportation costs on bill.' }
                  ], 'Transport Costs')}

                  {radioGroup('labour_charge_enabled', [
                    { value: true, title: '✅ Show Labour Charge', desc: 'Add a field for loading/unloading charges.' },
                    { value: false, title: '❌ Hide Labour Charge', desc: 'Do not show labour costs on bill.' }
                  ], 'Labour Charges')}

                  {admin?.role !== 'temp_manager' && radioGroup('signature_enabled', [
                    { value: true, title: '✅ Enabled', desc: 'A drawing canvas appears during billing for authorized signature.' },
                    { value: false, title: '❌ Disabled', desc: 'Signature field will be hidden from invoices.' }
                  ], 'Authorized Signature')}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && admin?.role !== 'temp_manager' && (
            <div className="flex flex-column gap-4">
              <div className="card">
                <div className="card-header"><div className="card-title">⚠️ Stock Alert Settings</div></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Global Low Stock Threshold</label>
                    <input className="form-control" type="number" min="0" value={form.low_stock_threshold ?? ""}
                      onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value === "" ? "" : Number(e.target.value) })} 
                      onBlur={(e) => handleUpdateSetting('low_stock_threshold', e.target.value === "" ? "" : Number(e.target.value))} />
                    <div className="form-hint">Products with stock at or below this value show as alerts.</div>
                  </div>
                  <div className="alert alert-info">
                    💡 <strong>Tip:</strong> You can override this value for specific products in the Product menu.
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">⚖️ Quintal-Based Tax System</div></div>
                <div className="card-body">
                  {radioGroup('quintal_tax_enabled', [
                    { value: true, title: '✅ Enabled', desc: 'System suggests prices based on weight (kg) per unit × Tax per Quintal.' },
                    { value: false, title: '❌ Disabled', desc: 'Use standard item-based pricing only.' }
                  ], 'Quintal Tax Mode')}

                  {form.quintal_tax_enabled && (
                    <div className="form-group mt-3">
                      <label className="form-label">Tax per Quintal (₹/100kg)</label>
                      <input className="form-control" type="number" min="0" step="0.01" value={form.tax_per_quintal ?? ''} 
                        onChange={e => setForm({ ...form, tax_per_quintal: e.target.value })} 
                        onBlur={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setForm({ ...form, tax_per_quintal: val });
                          handleUpdateSetting('tax_per_quintal', val);
                        }}
                        placeholder="e.g. 250" />
                      <div className="form-hint">Formula: (Weight ÷ 100) × Tax per Quintal</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}



          {activeTab === 'security' && (
            <div className="flex flex-column gap-4">
              <div className="card">
                <div className="card-header"><div className="card-title">🖥️ Interface Preferences</div></div>
                <div className="card-body">
                  <div className="form-group mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>Dark Mode</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Switch to a dark theme for low-light environments.</div>
                    </div>
                    <div 
                      className={`theme-toggle-track ${theme === 'dark' ? 'on' : ''}`} 
                      onClick={toggleTheme}
                    >
                      <div className="theme-toggle-thumb">
                        {theme === 'dark' ? '🌙' : '☀️'}
                      </div>
                    </div>
                  </div>

                  {radioGroup('language', [
                    { value: 'en', title: '🇬🇧 English', desc: 'Use English for all labels and reports.' },
                    { value: 'hi', title: '🇮🇳 हिन्दी', desc: 'सभी लेबल और रिपोर्ट के लिए हिन्दी का प्रयोग करें।' }
                  ], 'System Language')}
                </div>
              </div>

              {isAdmin && (
                <div className="card">
                  <div className="card-header"><div className="card-title">🔐 Change Password</div></div>
                  <div className="card-body">
                    <div className="alert mb-4" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}>Logged in as <strong>{admin?.username}</strong> (Admin)</div>
                    <form onSubmit={handlePwChange}>
                      {fld('current_password', 'Current Password', 'Current password', 'password')}
                      {fld('new_password', 'New Password', 'At least 6 characters', 'password')}
                      {fld('confirm_password', 'Confirm New Password', 'Re-enter new password', 'password')}
                      <div className="form-group mt-4">
                        <button type="submit" className="btn btn-warning" disabled={pwSaving}>
                          <Key size={16} /> {pwSaving ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}


        </div>
      </div>




      {/* Modals */}
      {showAddManager && (
        <div className="modal-overlay" onClick={() => setShowAddManager(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>➕ Add New Manager</div>
            <form onSubmit={handleCreateManager}>
              {fld('username', 'Username *', 'e.g. rahul')}
              {fld('display_name', 'Display Name', 'e.g. Rahul Sharma')}
              {fld('phone', 'Phone Number', '10-digit phone')}
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrForm.password} onChange={e => setMgrForm({ ...mgrForm, password: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowAddManager(false)}>{t('Cancel', 'रद्द करें')}</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={mgrCreating}>{mgrCreating ? 'Creating...' : '✅ Create Manager'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mgrResetModal && (
        <div className="modal-overlay" onClick={() => setMgrResetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>🔑 Reset Password</div>
            <div className="form-group">
              <label className="form-label">New Password for {mgrResetModal.username}</label>
              <input className="form-control" type="password" placeholder="Min 6 characters" value={mgrResetPw} onChange={e => setMgrResetPw(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn btn-outline flex-1" onClick={() => setMgrResetModal(null)}>{t('Cancel', 'रद्द करें')}</button>
              <button className="btn btn-primary flex-1" onClick={handleResetManagerPw}>✅ Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
