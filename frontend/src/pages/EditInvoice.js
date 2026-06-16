import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invoiceApi, productApi, customerApi } from '../utils/api';
import { formatCurrency, formatIST } from '../utils/helpers';
import { Edit, Save, AlertTriangle, FileText, CreditCard, Coins, ArrowLeft, Wallet, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'goods_exchange', 'others'];

function ProductAutocomplete({ value, onSelect, onNameChange }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  const search = useCallback((q) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { const r = await productApi.autocomplete(q); setResults(r); setOpen(true); }
      catch { /* ignore */ }
    }, 200);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <input className="form-control" value={query}
        onChange={e => { setQuery(e.target.value); onNameChange(e.target.value); search(e.target.value); }}
        onFocus={() => query && search(query)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ fontSize: 13, padding: '6px 8px', width: 'auto', minWidth: '150px' }}
        size={Math.max((query || '').length, 10)}
        placeholder="Product name..." />
      {open && results.length > 0 && (
        <div className="autocomplete-dropdown">
          {results.map(p => (
            <div key={p._id} className="autocomplete-item" onMouseDown={() => { setQuery(p.name); setOpen(false); onSelect(p); }}>
              <div><div className="autocomplete-item-name">{p.name}</div><div className="autocomplete-item-meta">Stock: {p.stock}</div></div>
              <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{formatCurrency(p.price)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function calcItem(item, gstEnabled) {
  const qty = parseFloat(item.qty) || 0;
  const retQty = parseFloat(item.returned_qty) || 0;
  const price = parseFloat(item.price) || 0;
  const gst = gstEnabled ? (parseFloat(item.gst) || 0) : 0;
  const billableQty = Math.max(0, qty - retQty);
  const taxable_amount = billableQty * price;
  const gst_amount = (taxable_amount * gst) / 100;
  const cgst = gst_amount / 2;
  const sgst = gst_amount / 2;
  const adj = parseFloat(item.adjustment) || 0;
  const total = Math.max(0, taxable_amount + gst_amount - adj);
  return { ...item, billableQty, taxable_amount, cgst, sgst, total };
}

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, settings } = useApp();
  const gstEnabled = settings.gst_enabled !== false;

  const [original, setOriginal] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([{ mode: 'cash', amount: '', reference: '' }]);
  const [discount, setDiscount] = useState('');
  const [vehicleCharge, setVehicleCharge] = useState('');
  const [labourCharge, setLabourCharge] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoiceApi.get(id).then(inv => {
      setOriginal(inv);
      setItems(inv.items.map(i => ({ ...i, product_name: (i.product_name || '').replace(/\s*\(\d{1,2}\s+[A-Za-z]{3}\)/g, '').trim(), _key: Math.random() })));
      setPayments(inv.payments?.length ? inv.payments : [{ mode: 'cash', amount: '', reference: '' }]);
      setDiscount(inv.discount || '');
      setVehicleCharge(inv.vehicle_charge || '');
      setLabourCharge(inv.labour_charge || '');
      let currentNotes = (inv.notes || '').trim();
      let editCount = 1;
      const match = currentNotes.match(/Revision (\d+)/i);
      if (match) {
        editCount = parseInt(match[1], 10) + 1;
        currentNotes = currentNotes.replace(match[0], '').trim();
        if (currentNotes.startsWith('|') || currentNotes.startsWith('-')) currentNotes = currentNotes.substring(1).trim();
      } else if (currentNotes.startsWith('Consolidated from')) {
        currentNotes = '';
      }
      const editStr = `Revision ${editCount}`;
      setNotes(currentNotes ? `${editStr} - ${currentNotes}` : editStr);
    }).catch(e => { toast.error(e.message); navigate('/invoices'); })
      .finally(() => setLoading(false));
  }, [id]);

  const updateItem = (idx, changes) => {
    setItems(prev => { 
      const next = [...prev]; 
      
      if (changes.qty !== undefined) {
        const oldItem = original?.items?.find(i => i._id && i._id === next[idx]._id);
        if (oldItem && parseFloat(oldItem.qty) > 0) {
          const wpu = (parseFloat(oldItem.weight) || 0) / parseFloat(oldItem.qty);
          const newQty = parseFloat(changes.qty) || 0;
          changes.weight = parseFloat((wpu * newQty).toFixed(2));
        }
      }

      if (changes.qty !== undefined || changes.price !== undefined || changes.gst !== undefined || changes.returned_qty !== undefined || changes.adjustment !== undefined) {
        if (changes.total_override === undefined) {
          changes.total_override = '';
        }
      }
      
      next[idx] = calcItem({ ...next[idx], ...changes }, gstEnabled); 
      return next; 
    });
  };

  const addItem = () => setItems(prev => [...prev, { _key: Date.now(), product_id: '', product_name: '', qty: 1, price: '', gst: 0, returned_qty: 0, is_defective: false, adjustment: 0, taxable_amount: 0, cgst: 0, sgst: 0, total: 0 }]);
  const removeItem = (idx) => { if (items.length === 1) return; setItems(prev => prev.filter((_, i) => i !== idx)); };
  const updatePayment = (idx, c) => setPayments(prev => { const n = [...prev]; n[idx] = { ...n[idx], ...c }; return n; });

  const subtotal = items.reduce((s, i) => s + (i.taxable_amount || 0), 0);
  const gstTotal = gstEnabled ? items.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0) : 0;
  const dis = parseFloat(discount) || 0;
  const vc = parseFloat(vehicleCharge) || 0;
  const lc = parseFloat(labourCharge) || 0;
  const total = Math.max(0, subtotal + gstTotal + vc + lc - dis);
  const prevBal = original?.previous_balance || 0;
  const totalWithPrev = total + prevBal;
  const amtReceived = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const balanceDue = totalWithPrev - amtReceived;
  const fc = formatCurrency;

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoiceApi.update(id, {
        customer_id: original?.customer_id,
        customer_name: original?.customer_name,
        customer_phone: original?.customer_phone,
        customer_address: original?.customer_address,
        items: items.map(({ _key, taxable_amount, cgst, sgst, total, billableQty, ...i }) => ({
          ...i,
          returned_qty: parseFloat(i.returned_qty) || 0,
          adjustment: parseFloat(i.adjustment) || 0,
        })),
        total_weight: items.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0),
        payments: payments.filter(p => parseFloat(p.amount) > 0).map(p => ({ ...p, amount: parseFloat(p.amount) })),
        discount: dis,
        vehicle_charge: vc,
        labour_charge: lc,
        notes,
        gst_enabled: gstEnabled,
      });
      toast.success('Invoice updated!');
      navigate(`/invoices/${id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><span className="spinner" style={{ width: 32, height: 32 }}></span></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }} className="no-print invoice-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="page-title d-flex align-items-center gap-2" style={{ margin: 0, marginTop: '4px', fontSize: '1.25rem' }}><FileText size={20} className="text-primary" /> Edit Invoice — {original?.invoice_number}</div>
            <div className="page-subtitle" style={{ margin: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {original?.customer_name} {original?.customer_phone ? `· ${original.customer_phone}` : ''} {original?.date || original?.ist_formatted ? `· ${original?.ist_formatted || formatIST(original?.date)}` : ''}
            </div>
          </div>
        </div>
      </div>



      <div className="billing-layout">
        <div>
          {/* Items with return/defective handling */}
          <div className="card mb-3">
            <div className="card-header">
              <div className="card-title d-flex align-items-center gap-2"><FileText size={18} className="text-primary" /> Items (Add, Return, or Adjust)</div>
            </div>
            <div className="card-body" style={{ padding: '12px 16px', overflowX: 'auto' }}>
              <table className="items-table" style={{ width: 'max-content' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 150 }}>Product</th>
                    <th style={{ width: 75, minWidth: 75 }}>Orig Qty</th>
                    <th style={{ width: 85, minWidth: 85 }}>Returned</th>
                    <th style={{ width: 90, minWidth: 90 }}>Rate ₹</th>
                    {gstEnabled && <th style={{ width: 85, minWidth: 85 }}>GST %</th>}
                    <th style={{ width: 90, minWidth: 90 }}>Adjust ₹</th>
                    <th style={{ width: 110, minWidth: 110 }}>Total ₹</th>
                    <th style={{ width: 36, minWidth: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item._key || idx} style={{ background: item.returned_qty > 0 || item.is_defective ? '#fefce8' : '' }}>
                      <td>
                        <ProductAutocomplete
                          value={item.product_name}
                          onSelect={p => updateItem(idx, { product_id: p._id, product_name: p.name, price: p.price, gst: p.gst })}
                          onNameChange={v => updateItem(idx, { product_id: '', product_name: v })}
                        />
                      </td>
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.qty}
                          onChange={e => updateItem(idx, { qty: e.target.value })} style={{ textAlign: 'right' }} />
                      </td>
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" max={item.qty} value={item.returned_qty !== undefined && item.returned_qty !== null ? item.returned_qty : ''}
                          onChange={e => {
                            let val = e.target.value;
                            if (val !== '') {
                              const num = parseFloat(val);
                              const maxQty = parseFloat(item.qty) || 0;
                              if (num > maxQty) val = maxQty.toString();
                            }
                            updateItem(idx, { returned_qty: val });
                          }}
                          placeholder="0" style={{ textAlign: 'right', background: item.returned_qty > 0 ? '#fefce8' : '' }} />
                      </td>
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.price}
                          onChange={e => updateItem(idx, { price: e.target.value })} style={{ textAlign: 'right' }} />
                      </td>
                      {gstEnabled && (
                        <td>
                          <select className="form-control" value={item.gst} onChange={e => updateItem(idx, { gst: e.target.value })} style={{ padding: '6px 20px 6px 8px' }}>
                            {[0, 0.25, 1, 3, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                          </select>
                        </td>
                      )}
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.adjustment || ''}
                          onChange={e => updateItem(idx, { adjustment: e.target.value })} placeholder="₹0" style={{ textAlign: 'right', background: item.adjustment > 0 ? '#fef9f0' : '' }} />
                      </td>
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.total_override !== undefined && item.total_override !== '' ? item.total_override : (item.total || '')}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') {
                              updateItem(idx, { total_override: '' });
                              return;
                            }
                            const newTotal = parseFloat(val) || 0;
                            const billableQty = Math.max(0, (parseFloat(item.qty) || 0) - (parseFloat(item.returned_qty) || 0));
                            if (billableQty > 0) {
                              const gst = gstEnabled ? (parseFloat(item.gst) || 0) : 0;
                              const adj = parseFloat(item.adjustment) || 0;
                              const newTaxable = (newTotal + adj) / (1 + gst / 100);
                              const newPrice = newTaxable / billableQty;
                              updateItem(idx, { price: newPrice.toFixed(4), total_override: val });
                            } else {
                              updateItem(idx, { total_override: val });
                            }
                          }}
                          placeholder="0.00" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, minWidth: '80px' }} />
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm d-flex align-items-center justify-content-center" style={{ padding: '6px' }} onClick={() => removeItem(idx)} title="Remove Item"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-outline btn-sm mt-3" onClick={addItem}>+ Add Row</button>
            </div>
          </div>

          {/* Payments */}
          <div className="card mb-3">
            <div className="card-header">
              <div className="card-title d-flex align-items-center gap-2"><CreditCard size={18} className="text-primary" /> Payments</div>
              <button className="btn btn-outline btn-sm" onClick={() => setPayments(p => [...p, { mode: 'cash', amount: '', reference: '' }])}>+ Add Mode</button>
            </div>
            <div className="card-body">
              {payments.map((p, idx) => (
                <div className="payment-row" key={idx}>
                  <select className="form-control" value={p.mode} onChange={e => updatePayment(idx, { mode: e.target.value })}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                  <input className="form-control" type="number" min="0" step="0.01" placeholder="Amount ₹" value={p.amount} onChange={e => updatePayment(idx, { amount: e.target.value })} />
                  <input className="form-control" placeholder="Reference (optional)" value={p.reference} onChange={e => updatePayment(idx, { reference: e.target.value })} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="position-sticky" style={{ top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '16px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={18} />Billing Summary</span>
                <span style={{ fontSize: '11px', background: 'var(--primary)', color: 'var(--bg-card)', padding: '3px 8px', borderRadius: '12px' }}>
                  {items.length} Items
                </span>
              </h4>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal (Before Tax)</span>
                  <strong style={{ fontWeight: '700' }}>{fc(subtotal)}</strong>
                </li>

                {gstEnabled && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Central GST (CGST)</span>
                      <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(gstTotal / 2)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>State GST (SGST)</span>
                      <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(gstTotal / 2)}</strong>
                    </li>
                  </>
                )}

                {vc > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Transportation</span>
                    <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(vc)}</strong>
                  </li>
                )}

                {lc > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Labour</span>
                    <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(lc)}</strong>
                  </li>
                )}

                {dis > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '14px' }}>
                    <span style={{ fontWeight: '700' }}>Discount</span>
                    <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>- {fc(dis)}</strong>
                  </li>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>Grand Total</span>
                  <strong style={{ color: 'var(--primary)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(total)}</strong>
                </li>

                {prevBal !== 0 && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: prevBal > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {prevBal > 0 ? 'Previous Due' : 'Previous Advance'}
                      </span>
                      <strong style={{ fontWeight: '700', fontFamily: 'monospace', color: prevBal > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '14px' }}>{fc(prevBal)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>Net Payable</span>
                      <strong style={{ color: 'var(--text)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(totalWithPrev)}</strong>
                    </li>
                  </>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)' }}>
                  <span>Amount Paid</span>
                  <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(amtReceived)}</strong>
                </li>

                <li 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '14px', 
                    color: balanceDue > 0.01 ? 'var(--danger)' : 'var(--success)'
                  }}
                >
                  <span style={{ fontWeight: '700' }}>
                    {balanceDue > 0.01 ? 'Balance Due' : balanceDue < -0.01 ? 'Change' : 'Fully Paid'}
                  </span>
                  <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Math.abs(balanceDue))}</strong>
                </li>
              </ul>
            </div>

            <button className="btn btn-primary btn-block btn-lg d-inline-flex align-items-center justify-content-center gap-1" onClick={handleSave} disabled={saving} style={{ padding: '12px', width: '100%' }}>
              {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
