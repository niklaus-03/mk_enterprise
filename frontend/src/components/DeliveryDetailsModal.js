import React from 'react';
import { X, Package, Calendar, UserCheck, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function DeliveryDetailsModal({ isOpen, onClose, delivery }) {
  const { fc } = useApp();
  
  if (!isOpen || !delivery) return null;

  const totalBase = delivery.items?.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0) || 0;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', 
      backdropFilter: 'blur(4px)', zIndex: 9998, display: 'flex', 
      alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        animation: 'slideUp 0.2s ease-out', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} color="#3b82f6" />
            Delivery Details
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        
        <div style={{ padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Supplier / Party</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={14} color="#64748b" /> {delivery.supplier || 'Walk-in'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Expected At</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color="#64748b" /> {new Date(delivery.expected_arrival).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>Items Received</div>
          
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#475569' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderRadius: '6px 0 0 6px' }}>Item Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Rate</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, borderRadius: '0 6px 6px 0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {delivery.items?.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>{item.item_name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{item.quantity} {item.unit}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>₹{parseFloat(item.base_price || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                    ₹{((parseFloat(item.base_price) || 0) * (parseFloat(item.quantity) || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalBase > 0 && (
            <div style={{ background: 'linear-gradient(to right, #fffbeb, #fef3c7)', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>Total Amount</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#d97706' }}>{fc ? fc(totalBase) : `₹${totalBase.toFixed(2)}`}</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status:</span>
              {delivery.payment_status === 'paid' ? (
                 <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>PAID</span>
              ) : (
                 <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                   <AlertTriangle size={12} /> UNPAID
                 </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
