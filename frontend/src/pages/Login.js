import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Briefcase, AlertTriangle, Key, CheckCircle, Eye, EyeOff, Shield, User } from 'lucide-react';

// Premium welcome toast — light mode
const showWelcomeToast = (name, role) => {
  const isAdmin = role === 'admin' || role === 'supervisor';
  toast.custom((t) => (
    <div
      style={{
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.95)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        background: '#ffffff',
        border: `1.5px solid ${isAdmin ? 'rgba(250,204,21,0.5)' : 'rgba(99,102,241,0.5)'}`,
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: `0 20px 40px -10px rgba(0,0,0,0.1), 0 0 20px -5px ${isAdmin ? 'rgba(250,204,21,0.15)' : 'rgba(99,102,241,0.15)'}`,
        minWidth: 300,
        maxWidth: 420,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shimmer effect */}
      <div style={{
        position: 'absolute', top: 0, left: '-100%', width: '200%', height: '100%',
        background: `linear-gradient(90deg, transparent, ${isAdmin ? 'rgba(250,204,21,0.06)' : 'rgba(99,102,241,0.06)'}, transparent)`,
        animation: 'welcomeShimmer 2s ease-in-out',
        pointerEvents: 'none',
      }} />
      
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: isAdmin
          ? 'linear-gradient(135deg, rgba(250,204,21,0.1), rgba(245,158,11,0.05))'
          : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(59,130,246,0.05))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${isAdmin ? 'rgba(250,204,21,0.25)' : 'rgba(99,102,241,0.25)'}`,
      }}>
        {isAdmin
          ? <Shield size={22} style={{ color: '#d97706' }} />
          : <User size={22} style={{ color: '#4f46e5' }} />
        }
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14.5, fontWeight: 800, color: '#0f172a',
          letterSpacing: '-0.3px', marginBottom: 3,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          Welcome back, {name}
          <span style={{
            fontSize: 9, fontWeight: 800,
            background: isAdmin ? 'rgba(250,204,21,0.2)' : 'rgba(99,102,241,0.2)',
            color: isAdmin ? '#b45309' : '#4338ca',
            padding: '2px 8px', borderRadius: 6,
            textTransform: 'uppercase', letterSpacing: '0.5px',
            border: `1px solid ${isAdmin ? 'rgba(250,204,21,0.2)' : 'rgba(99,102,241,0.2)'}`,
          }}>
            {isAdmin ? 'Admin' : 'Manager'}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: '#64748b', fontWeight: 500,
        }}>
          {new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
          {' · '}
          {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
      
      {/* Pulse dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: isAdmin
          ? 'linear-gradient(135deg, #fcd34d, #f59e0b)'
          : 'linear-gradient(135deg, #818cf8, #6366f1)',
        boxShadow: `0 0 8px ${isAdmin ? 'rgba(250,204,21,0.5)' : 'rgba(99,102,241,0.5)'}`,
        animation: 'welcomePulse 2s ease-in-out infinite',
      }} />
    </div>
  ), { duration: 4000, id: 'welcome-toast' });
};

export default function Login() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const navigate = useNavigate();
  const { login, verifySecret } = useAuth();
  const { authApi } = require('../utils/api');

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
  const [isValidUser, setIsValidUser] = useState(false);
  const passwordRef = useRef(null);
  const secretRef = useRef(null);

  useEffect(() => {
    const check = async () => {
      if (identifier.trim().length < 4) {
        setIsValidUser(false);
        return;
      }
      try {
        const res = await authApi.checkUser(identifier.trim());
        setIsValidUser(res.exists);
      } catch (err) {
        setIsValidUser(false);
      }
    };
    const timeoutId = setTimeout(check, 400);
    return () => clearTimeout(timeoutId);
  }, [identifier]);

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
      showWelcomeToast(res.display_name || res.username, res.role || 'manager');
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
      showWelcomeToast(res.display_name || res.username, 'admin');
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
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    color: '#0f172a', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block', fontSize: 12.5, fontWeight: 600,
    color: '#475569', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  };

  return (
    <div className="login-page-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1f5f9',
      padding: '16px',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        /* Force light mode styles regardless of global data-theme */
        .login-page-container input {
          background: #f8fafc !important;
          color: #0f172a !important;
          border-color: #e2e8f0 !important;
        }
        .login-page-container input:focus {
          border-color: #6366f1 !important;
        }
        .login-page-container button[type="submit"]:not(:disabled) {
          background-image: linear-gradient(135deg, #2563eb, #7c3aed) !important;
          background-color: transparent !important;
          color: #ffffff !important;
          cursor: pointer !important;
        }
        .login-page-container button[type="submit"]:disabled {
          background-image: none !important;
          background-color: rgba(99,102,241,0.5) !important;
          color: rgba(255,255,255,0.9) !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
        }
        /* Override Chrome Autofill styling */
        .login-page-container input:-webkit-autofill,
        .login-page-container input:-webkit-autofill:hover, 
        .login-page-container input:-webkit-autofill:focus, 
        .login-page-container input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      {/* Background decorative circles */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />
      </div>

      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.05)',
        borderRadius: 24,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', background: '#F8F9FA',
            boxShadow: '0 4px 16px rgba(197,160,89,0.3)',
            border: '2px solid #C5A059',
            margin: '0 auto 16px',
          }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }} fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="60" cy="60" r="48" stroke="#C5A059" strokeWidth="3.5" />
              <circle cx="60" cy="60" r="41" stroke="#C5A059" strokeWidth="1" />
              <ellipse cx="60" cy="60" rx="17" ry="41" stroke="#C5A059" strokeWidth="1" />
              <path d="M19 60 H101" stroke="#C5A059" strokeWidth="1" />
              <path d="M60 19 V101" stroke="#C5A059" strokeWidth="1" />
              <circle cx="60" cy="60" r="26" fill="#F8F9FA" />
              <circle cx="60" cy="60" r="26" stroke="#C5A059" strokeWidth="2" />
              <text x="60" y="75" fontFamily="Georgia, 'Times New Roman', serif" fontSize="42" fontWeight="bold" textAnchor="middle" fill="#0B132B" letterSpacing="-2">MK</text>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>MK Enterprise</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Enterprise Operations Hub</div>
        </div>

        {/* ─── STEP 1: Credentials ─── */}
        {step === 'credentials' && (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
              Sign in to continue to your account
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={16} className="text-danger" style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCredentials} autoComplete="off">
              {/* Username / Phone */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Username, Phone, or Vehicle No.</label>
                <input
                  type="text"
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter username, phone, or vehicle number"
                  value={identifier}
                  onChange={e=> { setIdentifier(e.target.value); setErrorMsg(''); }}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
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
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', padding: 0,
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
                  border: 'none', color: '#ffffff', fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.3)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    Verifying...
                  </>
                ) : <><Key size={16} /> Sign In</>}
              </button>
            </form>

            {/* Forgot Password */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={() => navigate('/forgot-password')}
                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
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
            <button 
              onClick={handleBack} 
              style={{
                background: 'transparent', border: 'none', color: '#64748b',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20,
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.transform = 'translateX(-4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              ← Back to login
            </button>

            {/* Success indicator */}
            <div style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
              color: '#15803d', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle size={16} className="text-success" style={{ flexShrink: 0 }} />
              <span>Password verified for <strong>{supervisorUsername}</strong>. Enter your secret key to continue.</span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Key size={18} className="text-warning" /> Supervisor Verification</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
              This extra step keeps your admin account secure.
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
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
                      border: '1.5px solid rgba(250,204,21,0.5)',
                      background: 'rgba(250,204,21,0.05)',
                    }}
                    onFocus={e => e.target.style.borderColor = '#eab308'}
                    onBlur={e => e.target.style.borderColor = 'rgba(250,204,21,0.5)'}
                  />
                  <button type="button" onClick={() => setShowSecret(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', padding: 0,
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
                  background: loading ? 'rgba(250,204,21,0.6)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none', color: '#ffffff', fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(245,158,11,0.3)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
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
        input::placeholder { color: #94a3b8; }
        @keyframes welcomeShimmer { 0% { transform: translateX(-50%); } 100% { transform: translateX(50%); } }
        @keyframes welcomePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.85); } }
      `}</style>
    </div>
  );
}
