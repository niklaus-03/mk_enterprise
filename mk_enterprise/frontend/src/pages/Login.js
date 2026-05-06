import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Briefcase, AlertTriangle, Key, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, verifySecret } = useAuth();

  // Steps: 'credentials' → 'secret' (only for supervisors)
  const [step, setStep] = useState('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const passwordRef = useRef(null);
  const secretRef = useRef(null);

  // Step 1: Submit username + password
  const handleCredentials = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!identifier.trim()) { setErrorMsg('Please enter your username or phone number.'); return; }
    if (!password) { setErrorMsg('Please enter your password.'); return; }
    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);

      // If supervisor → backend says "now give me the secret key"
      if (res.requires_secret) {
        setSupervisorUsername(res.username);
        setStep('secret');
        setErrorMsg('');
        setTimeout(() => secretRef.current?.focus(), 100);
        return;
      }

      // Manager/Driver → login complete
      toast.success(`Welcome back, ${res.display_name || res.username}! 👋`);
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (_) {}
      navigate('/');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit secret key (supervisor only)
  const handleSecretKey = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!secretKey.trim()) { setErrorMsg('Please enter the secret key.'); return; }
    setLoading(true);
    try {
      const res = await verifySecret(supervisorUsername, secretKey.trim());
      toast.success(`Welcome back, ${res.display_name || res.username}! 👋`);
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (_) {}
      navigate('/');
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect secret key.');
    } finally {
      setLoading(false);
    }
  };

  // Go back to credentials step
  const handleBack = () => {
    setStep('credentials');
    setSecretKey('');
    setErrorMsg('');
    setSupervisorUsername('');
  };

  // Shared input style
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '13px 44px 13px 14px', borderRadius: 10, fontSize: 14,
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    color: '#fff', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block', fontSize: 12.5, fontWeight: 600,
    color: 'rgba(255,255,255,0.6)', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '16px',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Background decorative circles */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            color: '#fff',
          }}><Briefcase size={30} /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>MK Enterprise</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Business Billing & Management</div>
        </div>

        {/* ─── STEP 1: Credentials ─── */}
        {step === 'credentials' && (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
              Sign in to continue to your account
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={16} className="text-danger" style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCredentials} autoComplete="off">
              {/* Username / Phone */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Username or Phone</label>
                <input
                  type="text"
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter username or phone number"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setErrorMsg(''); }}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={passwordRef}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.4)', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    Verifying...
                  </>
                ) : <><Key size={16} /> Sign In</>}
              </button>
            </form>

            {/* Forgot Password */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={() => navigate('/forgot-password')}
                style={{ background: 'none', border: 'none', color: 'rgba(99,102,241,0.8)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}

        {/* ─── STEP 2: Secret Key (Supervisor only) ─── */}
        {step === 'secret' && (
          <>
            {/* Back button */}
            <button onClick={handleBack} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 6, padding: 0,
            }}>
              ← Back to login
            </button>

            {/* Success indicator */}
            <div style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
              color: '#86efac', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle size={16} className="text-success" style={{ flexShrink: 0 }} />
              <span>Password verified for <strong>{supervisorUsername}</strong>. Enter your secret key to continue.</span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Key size={18} className="text-warning" /> Supervisor Verification</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
              This extra step keeps your admin account secure.
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={16} className="text-danger" style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSecretKey} autoComplete="off">
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Secret Key</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={secretRef}
                    type={showSecret ? 'text' : 'password'}
                    autoFocus
                    placeholder="Enter your supervisor secret key"
                    value={secretKey}
                    onChange={e => { setSecretKey(e.target.value); setErrorMsg(''); }}
                    style={{
                      ...inputStyle,
                      border: '1.5px solid rgba(250,204,21,0.3)',
                      background: 'rgba(250,204,21,0.05)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(250,204,21,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(250,204,21,0.3)'}
                  />
                  <button type="button" onClick={() => setShowSecret(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.3)', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: loading ? 'rgba(250,204,21,0.4)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(245,158,11,0.4)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    Verifying...
                  </>
                ) : <><Key size={16} /> Verify & Enter</>}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
