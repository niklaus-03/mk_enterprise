import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Calendar, Wallet, FileText, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { customerApi, supplierApi } from '../utils/api';

export default function MasterLedgerModal({ supplier, onClose }) {
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState([]);
  const fc = formatCurrency;

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch Supplier History
        const suppRes = await supplierApi.getHistory(supplier._id, { all: 'true' });
        const suppData = suppRes.data;
        const suppLedger = suppData.history || [];

        // Fetch Customer History
        const custRes = await customerApi.getPaymentHistory(supplier.linked_customer_id._id, { all: 'true' });
        const custData = custRes.data;
        
        let combined = [];

        // Map supplier ledger
        suppLedger.forEach(item => {
          combined.push({
            date: item.date,
            type: 'supplier_' + item.type,
            desc: item.type === 'payment' ? `Paid to Supplier via ${item.mode}` : `Purchased from Supplier`,
            amount: item.amount || item.total,
            side: 'supplier',
            original: item
          });
        });

        // Map customer ledger
        if (custData.payments) {
          custData.payments.forEach(p => {
            combined.push({
              date: p.date,
              type: 'customer_payment',
              desc: `Received from Customer via ${p.mode}`,
              amount: p.amount,
              side: 'customer',
              original: p
            });
          });
        }
        if (custData.invoices) {
          custData.invoices.forEach(inv => {
            combined.push({
              date: inv.date,
              type: 'customer_invoice',
              desc: `Sold to Customer (Invoice #${inv.invoice_number})`,
              amount: inv.total_amount,
              side: 'customer',
              original: inv
            });
          });
        }

        // Sort by date oldest first to build running balance, then reverse
        combined.sort((a, b) => new Date(a.date) - new Date(b.date));

        let runningBalance = 0;
        
        combined = combined.map(item => {
          if (item.side === 'supplier') {
            if (item.type === 'supplier_delivery') runningBalance -= item.amount; // We owe them more
            if (item.type === 'supplier_payment') runningBalance += item.amount;  // We owe them less
          } else {
            if (item.type === 'customer_invoice') runningBalance += item.amount; // They owe us more
            if (item.type === 'customer_payment') runningBalance -= item.amount; // They owe us less
          }
          return { ...item, runningBalance };
        });

        setLedger(combined.reverse());
      } catch (err) {
        console.error('Failed to load master ledger:', err);
      } finally {
        setLoading(false);
      }
    }
    if (supplier && supplier.linked_customer_id) {
      fetchData();
    }
  }, [supplier]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 800, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
        
        <div style={{ padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              Master Ledger View
            </div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Combined Statement</h3>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8', fontSize: 14 }}>
              <span>Supplier: <strong style={{ color: 'white' }}>{supplier.name}</strong></span>
              <ArrowRight size={14} />
              <span>Customer: <strong style={{ color: 'white' }}>{supplier.linked_customer_id.name}</strong></span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', transition: 'all 0.2s' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 0, overflowY: 'auto', background: '#f8fafc', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" style={{ borderColor: '#e2e8f0', borderTopColor: '#4f46e5', width: 32, height: 32, margin: '0 auto' }}></div>
              <p style={{ marginTop: 16, color: '#64748b', fontWeight: 500 }}>Computing combined ledger...</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: 'white' }} className="hover-row">
                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                        {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        {new Date(row.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {row.side === 'supplier' ? (
                           <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} title="Supplier Transaction" />
                        ) : (
                           <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f46e5' }} title="Customer Transaction" />
                        )}
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{row.desc}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, color: '#475569', fontSize: 14 }}>
                      {fc(row.amount)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', verticalAlign: 'top', fontWeight: 800, fontSize: 15, color: row.runningBalance > 0 ? '#16a34a' : row.runningBalance < 0 ? '#dc2626' : '#64748b' }}>
                      {fc(Math.abs(row.runningBalance))}
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, opacity: 0.8 }}>
                        {Math.abs(row.runningBalance) < 0.01 ? 'Settled' : row.runningBalance > 0 ? 'They owe us' : 'We owe them'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <style>{`
        .hover-row:hover td {
          background-color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
