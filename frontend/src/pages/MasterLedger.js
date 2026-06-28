import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supplierApi } from '../utils/api';
import { ArrowLeft, Building2, ChevronDown, ChevronUp, ExternalLink, Download, Link, ArrowDownLeft, ArrowUpRight, Wallet, Package, X } from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
};

export default function MasterLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await supplierApi.getMasterLedger(id);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load master ledger');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (index) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleRowClick = (i, row) => {
    if (row.type === 'customer_invoice') {
      const prevBal = row.running_balance - row.original.total_with_prev_balance + row.original.previous_balance; 
      // Wait, running_balance = prev_balance + amount (for invoice, amount is total)
      // Actually, running_balance includes the invoice amount. So prev_balance is running_balance - row.amount.
      const prevBalCalc = row.running_balance - row.amount;
      navigate(`/invoices/${row.original._id}?masterBalance=${prevBalCalc}`);
    } else if (row.type === 'supplier_delivery') {
      setSelectedDelivery(row.original);
    } else if (row.type === 'supplier_payment' || row.type === 'customer_payment') {
      setSelectedPayment(row);
    } else {
      toggleRow(i);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="spinner" style={{ borderColor: '#e2e8f0', borderTopColor: '#4f46e5', width: 32, height: 32, margin: '0 auto' }}></div>
        <p style={{ marginTop: 16, color: '#64748b' }}>Loading master ledger...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
        <h2>{error || 'Not found'}</h2>
        <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>Go Back</button>
      </div>
    );
  }

  const { supplier, ledger } = data;
  const customers = supplier.linked_customer_ids || [];

  const finalBalance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : (data.openingBalance || 0);
  const isOweThem = finalBalance < 0;

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', width: isMobile ? '100%' : 'auto' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Building2 size={22} className="text-primary" /> Master Ledger: {supplier.name}
            </div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Combined statement for Supplier <strong>{supplier.name}</strong>
            </div>
            {customers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', alignItems: 'center', gap: 6, overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: isMobile ? 4 : 0, maxWidth: '100%', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontSize: 12, fontWeight: 700, background: '#e0e7ff', padding: '4px 10px', borderRadius: 12, flexShrink: 0 }}>
                  <Link size={12} /> and Customers:
                </div>
                {customers.map(c => (
                  <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid #e0e7ff', color: '#334155', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                    {c.name}
                    <span style={{ color: '#4f46e5', fontSize: 10, background: '#eff6ff', padding: '2px 6px', borderRadius: 10, marginLeft: 2 }}>
                      {c.created_by?.display_name || c.created_by?.username || 'Admin'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {isOweThem && (
          <div style={{ width: isMobile ? '100%' : 'auto', display: 'flex', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
            <button 
              className="btn" 
              onClick={() => navigate(`/suppliers/${supplier._id}`)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#16a34a', color: 'white', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, width: isMobile ? '100%' : 'auto', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <Wallet size={16} /> Record Payment
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 8 : 16, marginBottom: 24 }}>
        
        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowDownLeft size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Supplier Balance</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: (data?.currentSupplierBalance || 0) > 0 ? '#dc2626' : (data?.currentSupplierBalance || 0) < 0 ? '#16a34a' : '#0f172a', letterSpacing: '-0.5px' }}>
            {formatCurrency(-(data?.currentSupplierBalance || 0))}
            <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 500, marginLeft: 6, color: '#64748b' }}>
              {(data?.currentSupplierBalance || 0) > 0 ? '(Due)' : (data?.currentSupplierBalance || 0) < 0 ? '(Adv)' : ''}
            </span>
          </div>
        </div>

        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: '#ccfbf1', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowUpRight size={isMobile ? 14 : 18} />
            </div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Customer Balance</div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {formatCurrency(data?.currentCustomerBalance || 0)}
          </div>
        </div>

        <div style={{ padding: isMobile ? '12px' : '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', gridColumn: isMobile ? '1 / -1' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginBottom: isMobile ? 8 : 12 }}>
            {(() => {
              const finalBalance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : (data.openingBalance || 0);
              const isOweThem = finalBalance < 0;
              const isSettled = finalBalance === 0;
              return (
                <>
                  <div style={{ width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '8px', background: isSettled ? '#f1f5f9' : (isOweThem ? '#fee2e2' : '#f0fdf4'), color: isSettled ? '#64748b' : (isOweThem ? '#dc2626' : '#16a34a'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={isMobile ? 14 : 18} />
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>Overall Net Balance</div>
                </>
              );
            })()}
          </div>
          <div style={{ fontSize: isMobile ? 16 : 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {(() => {
              const finalBalance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : (data.openingBalance || 0);
              return (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  {formatCurrency(finalBalance)}
                  <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 500, color: '#64748b' }}>
                    {finalBalance > 0 ? '(They owe us)' : finalBalance < 0 ? '(We owe them)' : '(Settled)'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

      </div>

      {/* LEDGER TABLE */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Debit (₹)<br/><span style={{fontSize: 10, textTransform: 'none', color: '#94a3b8'}}>(They Purchased)</span></th>
                <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Credit (₹)<br/><span style={{fontSize: 10, textTransform: 'none', color: '#94a3b8'}}>(We Purchased)</span></th>
                <th style={{ padding: '16px 24px', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Balance (₹)</th>
                <th style={{ padding: '16px 24px', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>No transactions found</div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>Record a payment or invoice to see it here.</div>
                  </td>
                </tr>
              ) : (
                [...ledger].reverse().map((row, idx) => {
                  const originalIndex = ledger.length - 1 - idx;
                  const isExpanded = expandedRows[originalIndex];
                  const d = row.original;
                  
                  let desc = '';
                  let debitAmount = null;
                  let creditAmount = null;
                  
                  if (row.type === 'supplier_delivery') {
                    desc = `Purchased from Supplier`;
                    creditAmount = row.amount; // We owe them -> Credit
                  } else if (row.type === 'supplier_payment') {
                    desc = `Paid to Supplier via ${d.mode || 'Cash'}`;
                    debitAmount = row.amount; // We paid -> Debit
                  } else if (row.type === 'customer_invoice') {
                    desc = `Invoice #${d.invoice_number}`;
                    debitAmount = row.amount; // Customer owes us -> Debit
                  } else if (row.type === 'customer_payment') {
                    desc = `Received from Customer via ${d.mode || 'Cash'}`;
                    creditAmount = row.amount; // Customer paid -> Credit
                  }

                  return (
                    <React.Fragment key={idx}>
                      <tr 
                        onClick={() => handleRowClick(originalIndex, row)}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isExpanded ? '#e0e7ff' : idx % 2 === 0 ? 'white' : '#f8fafc', transition: 'background 0.2s' }}
                        className="hover-row"
                      >
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>
                            {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            {new Date(row.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.type.includes('supplier') ? '#d97706' : '#4f46e5' }} />
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{desc}</div>
                              {d.notes && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{d.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: debitAmount ? '#16a34a' : '#cbd5e1' }}>
                          {debitAmount ? formatCurrency(debitAmount) : '-'}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: creditAmount ? '#dc2626' : '#cbd5e1' }}>
                          {creditAmount ? formatCurrency(creditAmount) : '-'}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: row.runningBalance > 0 ? '#16a34a' : row.runningBalance < 0 ? '#dc2626' : '#64748b' }}>
                            {formatCurrency(row.runningBalance)}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: '#94a3b8' }}>
                            {Math.abs(row.runningBalance) < 0.01 ? 'Settled' : row.runningBalance > 0 ? 'They owe us' : 'We owe them'}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center', color: '#94a3b8' }}>
                          {row.type !== 'customer_invoice' && (
                            <ArrowUpRight size={18} style={{ opacity: 0.4 }} />
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
              
              {/* OPENING BALANCE ROWS AT THE BOTTOM */}
              {(() => {
                let currentBal = 0;
                const rows = [];
                
                // Supplier Opening
                if (supplier) {
                  let activeDate = supplier.createdAt;
                  if (!activeDate && ledger.length > 0) activeDate = ledger[ledger.length - 1].date; // oldest transaction
                  rows.push({
                    id: 'sup_open',
                    date: activeDate,
                    rawDate: activeDate ? new Date(activeDate).getTime() : 0,
                    name: `${supplier.name} (Supplier)`,
                    desc: 'Opening Balance - Supplier',
                    debit: null,
                    credit: supplier.balance || 0,
                    isSupplier: true,
                    amount: supplier.balance || 0,
                    color: '#d97706'
                  });
                }

                // Customers Opening
                customers.forEach(c => {
                  let activeDate = c.createdAt || c.updatedAt;
                  if (!activeDate) {
                    // Find their oldest transaction
                    const txs = ledger.filter(l => {
                      if (l.type.startsWith('customer')) {
                         const cid = l.original.customer?._id || l.original.customer;
                         return cid && cid.toString() === c._id.toString();
                      }
                      return false;
                    });
                    if (txs.length > 0) activeDate = txs[txs.length - 1].date;
                  }
                  
                  // Final fallback to make sure they get a date so the UI doesn't break
                  if (!activeDate) {
                     activeDate = supplier?.createdAt || new Date(2026, 0, 1).toISOString(); 
                  }

                  rows.push({
                    id: `cust_open_${c._id}`,
                    date: activeDate,
                    rawDate: activeDate ? new Date(activeDate).getTime() : 0,
                    name: `${c.name} (${c.created_by?.display_name || c.created_by?.username || 'Admin'})`,
                    desc: `Opening Balance - Customer`,
                    debit: c.balance || 0,
                    credit: null,
                    isSupplier: false,
                    amount: c.balance || 0,
                    color: '#4f46e5'
                  });
                });

                // Sort chronologically (oldest first)
                rows.sort((a, b) => a.rawDate - b.rawDate);

                // Calculate running balances in chronological order
                rows.forEach(r => {
                  if (r.isSupplier) {
                    currentBal -= r.amount;
                  } else {
                    currentBal += r.amount;
                  }
                  r.balance = currentBal;
                });

                // Render in reverse chronological (newest at the top of the opening balance block)
                return rows.reverse().map((r, idx) => (
                  <tr key={r.id} style={{ background: '#fdf8f6', borderTop: idx === 0 ? '2px solid #e2e8f0' : '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 600, color: '#64748b' }}>Account Start</div>
                      {r.date ? (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                          Added {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                          Added previously
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#475569' }}>{r.desc}</div>
                          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{r.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: r.debit ? '#16a34a' : '#cbd5e1' }}>
                      {r.debit ? formatCurrency(r.debit) : '-'}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: r.credit ? '#dc2626' : '#cbd5e1' }}>
                      {r.credit ? formatCurrency(r.credit) : '-'}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: r.balance > 0 ? '#16a34a' : r.balance < 0 ? '#dc2626' : '#64748b' }}>
                        {formatCurrency(r.balance)}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: '#94a3b8' }}>
                        {Math.abs(r.balance) < 0.01 ? 'Settled' : r.balance > 0 ? 'They owe us' : 'We owe them'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}></td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DELIVERY MODAL ── */}
      {selectedDelivery && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedDelivery(null)} />
          <div className="modal-content" style={{ position: 'relative', background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                  <Package size={18} />
                </span>
                <span>Itemized Goods Breakdown</span>
              </div>
              <button onClick={() => setSelectedDelivery(null)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes / Info</span>
                <span style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{selectedDelivery.notes || 'No extra notes provided'}</span>
              </div>

              <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>Item</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 12 }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 12 }}>Rate</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 12 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDelivery.items?.map((item, i) => {
                      const total = (item.quantity * (item.base_price || item.price || 0)) || 0;
                      return (
                        <tr key={i} style={{ borderBottom: i === selectedDelivery.items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: 600, color: '#334155' }}>{item.item_name || item.product_id?.name}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{item.quantity} <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.unit || 'pcs'}</span></td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{formatCurrency(item.base_price || item.price || 0)}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    {(() => {
                      const totalBaseValue = selectedDelivery.items?.reduce((sum, item) => sum + (item.quantity * (item.base_price || item.price || 0)), 0) || 0;
                      const totalExtraCharges = selectedDelivery.items?.reduce((sum, item) => sum + (item.quantity * (item.supplier_charge_per_item || 0)), 0) || 0;
                      const finalGoodsValue = selectedDelivery.grand_total || selectedDelivery.amount || selectedDelivery.total_amount || (totalBaseValue + totalExtraCharges);
                      const totalVehicleCharges = finalGoodsValue - totalBaseValue - totalExtraCharges;

                      return (
                        <>
                          <tr>
                            <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}>Total Base Value:</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 13 }}>{formatCurrency(totalBaseValue)}</td>
                          </tr>
                          {totalExtraCharges > 0 && (
                            <tr>
                              <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}>Total Extra Charges:</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 13 }}>{formatCurrency(totalExtraCharges)}</td>
                            </tr>
                          )}
                          {Math.abs(totalVehicleCharges) > 0.01 && (
                            <tr>
                              <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}>Vehicle Charge (Quintal/Custom):</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 13 }}>{totalVehicleCharges > 0 ? '+' : ''}{formatCurrency(totalVehicleCharges)}</td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
              
              {selectedDelivery.actual_paid_amount > 0 && (
                <div style={{ marginTop: 16, display: 'inline-block', background: '#ecfdf5', color: '#059669', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: '1px solid #a7f3d0' }}>
                  ✓ Paid {formatCurrency(selectedDelivery.actual_paid_amount)} on the spot
                </div>
              )}
            </div>
            
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Final Goods Value</div>
               <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7' }}>{formatCurrency(selectedDelivery.grand_total || selectedDelivery.amount || selectedDelivery.total_amount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ── */}
      {selectedPayment && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedPayment(null)} />
          <div className="modal-content" style={{ position: 'relative', background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                  <Wallet size={18} />
                </span>
                <span>Payment Details</span>
              </div>
              <button onClick={() => setSelectedPayment(null)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Amount</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{formatCurrency(selectedPayment.amount)}</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Payment Mode</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginTop: 4, textTransform: 'capitalize' }}>
                    {selectedPayment.original.mode || 'Cash'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    {selectedPayment.type === 'supplier_payment' ? 'Paid By' : 'Collected By'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#4f46e5', marginTop: 4 }}>
                    {selectedPayment.original.created_by?.display_name || selectedPayment.original.created_by?.username || 'Admin'}
                  </div>
                </div>
              </div>

              {selectedPayment.original.reference && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Reference No.</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#334155', marginTop: 4, background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    {selectedPayment.original.reference}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
