import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState('identifier'); // 'identifier' | 'password'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [identifierValid, setIdentifierValid] = useState(null); // null | true | false
  const passwordRef = useRef(null);
  const secretRef = useRef(null);

  const handleIdentifierKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (identifier.trim()) {
        setStep('password');
        setErrorMsg('');
        setTimeout(() => passwordRef.current?.focus(), 80);
      }
    }
  };

  const handlePasswordKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      secretRef.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!identifier.trim()) { setErrorMsg('Please enter your username or phone number.'); return; }
    if (!password) { setErrorMsg('Please enter your password.'); return; }
    setLoading(true);
    try {
      const res = await login(identifier.trim(), password, secretKey.trim() || undefined);
      toast.success(`Welcome back, ${res.display_name || res.username}! 👋`);
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (_) {}
      navigate('/');
    } catch (err) {
      const msg = err.message || 'Invalid credentials.';
      setErrorMsg(msg);
      if (msg.toLowerCase().includes('account not found')) {
        setStep('identifier');
        setIdentifierValid(false);
      }
    } finally {
      setLoading(false);
    }
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
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
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
            fontSize: 28, margin: '0 auto 14px',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
          }}>🏪</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>MK Enterprise</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Business Billing & Management</div>
        </div>

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
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Username / Phone */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Username or Phone
            </label>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              placeholder="Enter username or phone number"
              value={identifier}
              onChange={e => { setIdentifier(e.target.value); setErrorMsg(''); setIdentifierValid(null); }}
              onKeyDown={handleIdentifierKeyDown}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 10, fontSize: 14,
                background: 'rgba(255,255,255,0.07)',
                border: `1.5px solid ${identifierValid === false ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'}`,
                color: '#fff', outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
              onBlur={e => e.target.style.borderColor = identifierValid === false ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'}
            />
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>
              Press Enter to continue to password
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                ref={passwordRef}
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                onKeyDown={handlePasswordKeyDown}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 14,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: '#fff', outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                color: 'rgba(255,255,255,0.4)', padding: 0,
              }}>{showPass ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {/* Secret Key — always shown, hint for supervisors */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Secret Key
              <span style={{ fontSize: 10.5, fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                (Supervisor Admin only)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                ref={secretRef}
                type={showSecret ? 'text' : 'password'}
                placeholder="Leave empty if you're a Manager"
                value={secretKey}
                onChange={e => { setSecretKey(e.target.value); setErrorMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e); }}}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 14,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1.5px dashed rgba(255,255,255,0.1)',
                  color: '#fff', outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(250,204,21,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button type="button" onClick={() => setShowSecret(v => !v)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                color: 'rgba(255,255,255,0.3)', padding: 0,
              }}>{showSecret ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {/* Submit Button */}
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
                Signing in...
              </>
            ) : '🔐 Sign In'}
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

        {/* Role hint */}
        <div style={{
          marginTop: 24, padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
          borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center',
        }}>
          👑 Supervisor Admin — use username + password + secret key<br />
          👤 Manager — use username/phone + password only
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
