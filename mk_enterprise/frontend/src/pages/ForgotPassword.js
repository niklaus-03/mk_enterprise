import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../utils/api';

export default function ForgotPassword() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [isValidUser, setIsValidUser] = useState(false);

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
        // If the backend API fails or hasn't restarted yet, default to allowing them to click it
        // so they don't get permanently locked out of a correct credential.
        setIsValidUser(true);
      }
    };
    const timeoutId = setTimeout(check, 400);
    return () => clearTimeout(timeoutId);
  }, [identifier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await authApi.forgotPassword(identifier.trim());
      setStatus('success');
      setMessage(res.message || 'Recovery request submitted.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9',
      padding: 16, fontFamily: "'Inter', 'Segoe UI', sans-serif",
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
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.05)', borderRadius: 24,
        padding: '40px 36px', width: '100%', maxWidth: 400,
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
      }}>
        {/* Back button */}
        <button 
          onClick={() => navigate('/login')} 
          style={{
            background: 'transparent', border: 'none', color: '#64748b',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24,
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

        <div style={{ fontSize: 32, marginBottom: 10 }}>🔑</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Forgot Password?</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>
          Enter your username, phone, or vehicle number. Your <strong style={{ color: '#0f172a' }}>Super Admin</strong> will be notified to reset your password.
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ color: '#15803d', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Request Submitted!</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              {message}
            </div>
            <div style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#b45309', textAlign: 'left', lineHeight: 1.6 }}>
              💡 <strong>What happens next:</strong><br />
              Your Super Admin will see your request in the Admin Panel and reset your password. Contact them directly to get your new credentials.
            </div>
            <button
              onClick={() => navigate('/login')}
              style={{
                marginTop: 20, width: '100%', padding: '12px', borderRadius: 10,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {status === 'error' && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                color: '#dc2626', fontSize: 13,
              }}>
                ⚠️ {message}
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Username, Phone, or Vehicle No.
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Enter username, phone, or vehicle number"
                value={identifier}
                onChange={e=> { setIdentifier(e.target.value); setStatus(null); }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 10, fontSize: 14,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#0f172a', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !isValidUser}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: loading || !isValidUser ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                border: 'none', color: '#ffffff', fontSize: 14, fontWeight: 700,
                cursor: loading || !isValidUser ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: loading || !isValidUser ? 'none' : '0 4px 20px rgba(37,99,235,0.3)',
              }}
            >
              {loading ? 'Submitting...' : '📩 Submit Recovery Request'}
            </button>
          </form>
        )}
      </div>
      
      <style>{`
        input::placeholder { color: #94a3b8; }
      `}</style>
    </div>
  );
}
