import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invoiceApi, productApi, customerApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';

const PAYMENT_MODES = ['cash', 'upi', 'online', 'others'];

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
        style={{ fontSize: 13, padding: '6px 8px' }}
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
  const { settings } = useApp();
  const gstEnabled = settings.gst_enabled !== false;

  const [original, setOriginal] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([{ mode: 'cash', amount: '', reference: '' }]);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoiceApi.get(id).then(inv => {
      setOriginal(inv);
      setItems(inv.items.map(i => ({ ...i, _key: Math.random() })));
      setPayments(inv.payments?.length ? inv.payments : [{ mode: 'cash', amount: '', reference: '' }]);
      setDiscount(inv.discount || '');
      setNotes(inv.notes || '');
    }).catch(e => { toast.error(e.message); navigate('/invoices'); })
      .finally(() => setLoading(false));
  }, [id]);

  const updateItem = (idx, changes) => {
    setItems(prev => { const next = [...prev]; next[idx] = calcItem({ ...next[idx], ...changes }, gstEnabled); return next; });
  };

  const addItem = () => setItems(prev => [...prev, { _key: Date.now(), product_id: '', product_name: '', qty: 1, price: '', gst: 0, returned_qty: 0, is_defective: false, adjustment: 0, taxable_amount: 0, cgst: 0, sgst: 0, total: 0 }]);
  const removeItem = (idx) => { if (items.length === 1) return; setItems(prev => prev.filter((_, i) => i !== idx)); };
  const updatePayment = (idx, c) => setPayments(prev => { const n = [...prev]; n[idx] = { ...n[idx], ...c }; return n; });

  const subtotal = items.reduce((s, i) => s + (i.taxable_amount || 0), 0);
  const gstTotal = gstEnabled ? items.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0) : 0;
  const dis = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal + gstTotal - dis);
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
        payments: payments.filter(p => parseFloat(p.amount) > 0).map(p => ({ ...p, amount: parseFloat(p.amount) })),
        discount: dis,
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
      <div className="page-header no-print">
        <div>
          <div className="page-title">✏️ Edit Invoice — {original?.invoice_number}</div>
          <div className="page-subtitle">Modify items, handle returns or defectives</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => navigate(-1)}>← Back</button>
          <button className="btn btn-success btn-lg" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner"></span> Saving...</> : '💾 Save Changes'}
          </button>
        </div>
      </div>

      <div className="alert alert-warning">
        ⚠️ <strong>Edit Invoice:</strong> Original stock will be restored and re-deducted based on updated quantities. Returns and defectives will be accounted for automatically.
      </div>

      <div className="billing-layout">
        <div>
          {/* Items with return/defective handling */}
          <div className="card mb-5">
            <div className="card-header">
              <div className="card-title">📋 Items (with Return / Defective Handling)</div>
              <button className="btn btn-outline btn-sm" onClick={addItem}>+ Add Row</button>
            </div>
            <div className="card-body" style={{ padding: '12px 16px', overflowX: 'auto' }}>
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 180 }}>Product</th>
                    <th style={{ width: 65 }}>Orig Qty</th>
                    <th style={{ width: 80 }}>Returned</th>
                    <th style={{ width: 75 }}>Rate ₹</th>
                    {gstEnabled && <th style={{ width: 65 }}>GST %</th>}
                    <th style={{ width: 80 }}>Defective</th>
                    <th style={{ width: 90 }}>Adj ₹</th>
                    <th style={{ width: 90 }}>Reason</th>
                    <th style={{ width: 90 }}>Total ₹</th>
                    <th style={{ width: 32 }}></th>
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
                        <input className="form-control" type="number" min="0" step="0.01" max={item.qty} value={item.returned_qty || ''}
                          onChange={e => updateItem(idx, { returned_qty: e.target.value })}
                          placeholder="0" style={{ textAlign: 'right', background: item.returned_qty > 0 ? '#fefce8' : '' }} />
                      </td>
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.price}
                          onChange={e => updateItem(idx, { price: e.target.value })} style={{ textAlign: 'right' }} />
                      </td>
                      {gstEnabled && (
                        <td>
                          <select className="form-control" value={item.gst} onChange={e => updateItem(idx, { gst: e.target.value })}>
                            {[0, 0.25, 1, 3, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                          </select>
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!item.is_defective} onChange={e => updateItem(idx, { is_defective: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </td>
                      <td>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.adjustment || ''}
                          onChange={e => updateItem(idx, { adjustment: e.target.value })} placeholder="₹0" style={{ textAlign: 'right', background: item.adjustment > 0 ? '#fef9f0' : '' }} />
                      </td>
                      <td>
                        <input className="form-control" value={item.return_reason || ''}
                          onChange={e => updateItem(idx, { return_reason: e.target.value })} placeholder="Reason" style={{ fontSize: 12 }} />
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fc(item.total || 0)}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" style={{ padding: '4px 7px' }} onClick={() => removeItem(idx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-outline btn-sm mt-3" onClick={addItem}>+ Add Row</button>
            </div>
          </div>

          {/* Payments */}
          <div className="card mb-5">
            <div className="card-header">
              <div className="card-title">💳 Payments</div>
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
                  <button className="btn btn-ghost btn-sm" onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))}>✕</button>
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
        <div>
          <div className="summary-box">
            <div className="summary-title">💰 Updated Summary</div>
            <div className="summary-row"><span className="text-muted">Subtotal</span><span className="mono">{fc(subtotal)}</span></div>
            {gstEnabled && <>
              <div className="summary-row"><span className="text-muted">CGST</span><span className="mono">{fc(gstTotal / 2)}</span></div>
              <div className="summary-row"><span className="text-muted">SGST</span><span className="mono">{fc(gstTotal / 2)}</span></div>
            </>}
            {dis > 0 && <div className="summary-row text-success"><span>Discount</span><span className="mono">- {fc(dis)}</span></div>}
            <div className="summary-row total"><span>Total</span><span className="mono">{fc(total)}</span></div>
            {prevBal > 0 && <div className="summary-row prev"><span>+ Prev. Balance</span><span className="mono">{fc(prevBal)}</span></div>}
            {prevBal > 0 && <div className="summary-row total" style={{ fontSize: 15 }}><span>Net Payable</span><span className="mono">{fc(totalWithPrev)}</span></div>}
            <hr className="divider" />
            <div className="summary-row paid"><span>Amount Received</span><span className="mono">{fc(amtReceived)}</span></div>
            <div className={`summary-row ${balanceDue > 0.01 ? 'due' : 'paid'}`}>
              <span>{balanceDue > 0.01 ? 'Balance Due' : 'Change'}</span>
              <span className="mono">{fc(Math.abs(balanceDue))}</span>
            </div>
            <button className="btn btn-success btn-block btn-lg mt-3" onClick={handleSave} disabled={saving} style={{ justifyContent: 'center' }}>
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
            <button className="btn btn-outline btn-block mt-2" onClick={() => navigate(-1)} style={{ justifyContent: 'center' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
