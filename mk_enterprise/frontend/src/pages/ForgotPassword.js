import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../utils/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [message, setMessage] = useState('');

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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: 16, fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
        padding: '40px 36px', width: '100%', maxWidth: 400,
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/login')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
        >
          ← Back to Login
        </button>

        <div style={{ fontSize: 32, marginBottom: 10 }}>🔑</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Forgot Password?</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28, lineHeight: 1.6 }}>
          Enter your username or phone number. Your <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Supervisor Admin</strong> will be notified to reset your password.
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ color: '#86efac', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Request Submitted!</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              {message}
            </div>
            <div style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: 'rgba(250,204,21,0.8)', textAlign: 'left', lineHeight: 1.6 }}>
              💡 <strong>What happens next:</strong><br />
              Your Supervisor Admin will see your request in the Admin Panel and reset your password. Contact them directly to get your new credentials.
            </div>
            <button
              onClick={() => navigate('/login')}
              style={{
                marginTop: 20, width: '100%', padding: '12px', borderRadius: 10,
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {status === 'error' && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                color: '#fca5a5', fontSize: 13,
              }}>
                ⚠️ {message}
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Username or Phone
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Your username or phone number"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setStatus(null); }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 10, fontSize: 14,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: '#fff', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: loading || !identifier.trim() ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: loading || !identifier.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Submitting...' : '📩 Submit Recovery Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
