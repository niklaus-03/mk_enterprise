import React from 'react';
import { X, Wallet, Smartphone, Globe, CreditCard, Package } from 'lucide-react';

export default function PaymentModal({ isOpen, onClose, onConfirm, amount }) {
  if (!isOpen) return null;

  const [notes, setNotes] = React.useState('');

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', 
      backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', 
      alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 360,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        animation: 'slideUp 0.2s ease-out', overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Select Payment Mode</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        
        <div style={{ padding: 24 }}>
          {amount > 0 && (
             <div style={{ textAlign: 'center', marginBottom: 20 }}>
               <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Amount to Pay</div>
               <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>₹{amount.toLocaleString('en-IN')}</div>
             </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <input 
              type="text" 
              placeholder="Add an optional note..." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => onConfirm('cash', notes)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Wallet size={24} color="#3b82f6" />
              Cash
            </button>
            <button onClick={() => onConfirm('upi', notes)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Smartphone size={24} color="#10b981" />
              UPI
            </button>
            <button onClick={() => onConfirm('online', notes)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#8b5cf6'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Globe size={24} color="#8b5cf6" />
              Online
            </button>
            <button onClick={() => onConfirm('goods_exchange', notes)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#ec4899'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Package size={24} color="#ec4899" />
              Goods Exchange
            </button>
            <button onClick={() => onConfirm('others', notes)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <CreditCard size={24} color="#f59e0b" />
              Others
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
