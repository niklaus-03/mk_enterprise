import React from 'react';
import { X, Wallet, Smartphone, Globe, CreditCard, Package } from 'lucide-react';

export default function PaymentModal({ isOpen, onClose, onConfirm, amount }) {
  if (!isOpen) return null;

  const [notes, setNotes] = React.useState('');
  const [paidAmt, setPaidAmt] = React.useState(amount);
  const [paymentAction, setPaymentAction] = React.useState('full');

  React.useEffect(() => {
    setPaidAmt(amount);
  }, [amount]);

  React.useEffect(() => {
    const numPaid = parseFloat(paidAmt) || 0;
    const numAmt = parseFloat(amount) || 0;
    if (numPaid < numAmt) {
      if (paymentAction !== 'partial' && paymentAction !== 'negotiated') setPaymentAction('negotiated');
    } else if (numPaid > numAmt) {
      setPaymentAction('advance');
    } else {
      setPaymentAction('full');
    }
  }, [paidAmt, amount]);

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
               <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                 <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>₹</span>
                 <input 
                   type="number"
                   value={paidAmt}
                   onChange={e => setPaidAmt(e.target.value)}
                   style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', width: String(paidAmt).length * 18 + 20 + 'px', minWidth: '80px', maxWidth: '100%', textAlign: 'center', border: 'none', borderBottom: '2px dashed #cbd5e1', outline: 'none', background: 'transparent' }}
                 />
               </div>
               {Number(paidAmt) !== Number(amount) && Number(paidAmt) < Number(amount) && (
                 <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                   <span>Original Bill:</span>
                   <span style={{ textDecoration: 'line-through' }}>₹{amount.toLocaleString('en-IN')}</span>
                 </div>
               )}
             </div>
          )}

          {Number(paidAmt) < Number(amount) && (
            <div style={{ marginBottom: 20, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Payment Action</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                <input type="radio" name="paymentAction" checked={paymentAction === 'negotiated'} onChange={() => setPaymentAction('negotiated')} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: 14, color: '#334155' }}><strong>Negotiated Settlement</strong> (Log discount)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="paymentAction" checked={paymentAction === 'partial'} onChange={() => setPaymentAction('partial')} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: 14, color: '#334155' }}><strong>Partial Payment</strong> (Leave remainder due)</span>
              </label>
            </div>
          )}

          {Number(paidAmt) > Number(amount) && (
            <div style={{ marginBottom: 20, background: '#ecfdf5', padding: '12px 16px', borderRadius: 8, border: '1px solid #a7f3d0', color: '#047857', fontSize: 13, fontWeight: 500 }}>
              You are paying extra. The difference will automatically be stored as an advance in the supplier ledger.
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
            <button onClick={() => onConfirm('cash', notes, parseFloat(paidAmt) || 0, paymentAction)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Wallet size={24} color="#3b82f6" />
              Cash
            </button>
            <button onClick={() => onConfirm('upi', notes, parseFloat(paidAmt) || 0, paymentAction)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Smartphone size={24} color="#10b981" />
              UPI
            </button>
            <button onClick={() => onConfirm('online', notes, parseFloat(paidAmt) || 0, paymentAction)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#8b5cf6'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Globe size={24} color="#8b5cf6" />
              Online
            </button>
            <button onClick={() => onConfirm('goods_exchange', notes, parseFloat(paidAmt) || 0, paymentAction)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px',
              border: '1.5px solid #cbd5e1', borderRadius: 12, background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: 600, transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.borderColor = '#ec4899'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
              <Package size={24} color="#ec4899" />
              Goods Exchange
            </button>
            <button onClick={() => onConfirm('others', notes, parseFloat(paidAmt) || 0, paymentAction)} style={{
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
