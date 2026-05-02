import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi, productApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supplierCharge, setSupplierCharge] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  // Fix 6: Global quintal charge applied to all items
  const [globalQuintalCharge, setGlobalQuintalCharge] = useState('');
  const [applyingQuintal, setApplyingQuintal] = useState(false);
  const [supplierChargeApplied, setSupplierChargeApplied] = useState(false);
  const fc = formatCurrency;

  const loadDelivery = () => {
    setLoading(true);
    // Use direct ID lookup — faster and always gets latest saved data
    deliveryApi.getById(id)
      .then(d => {
        if (!d) { toast.error('Delivery not found'); navigate('/vehicle-incoming'); return; }
        setDelivery(d);
        // Pre-fill all saved pricing fields — persists across page visits
        setItems(d.items.map(item => ({
          ...item,
          weight: item.weight > 0 ? String(item.weight) : '',
          base_price: item.base_price > 0 ? String(item.base_price) : '',
          quintal_charge: item.quintal_charge > 0 ? String(item.quintal_charge) : '',
          gst: item.gst || 0,
          final_price: item.final_price > 0 ? String(item.final_price) : '',
          // Use saved final_stock if exists, otherwise default to quantity
          final_stock: item.final_stock != null ? String(item.final_stock) : String(item.quantity),
          current_stock: null,
        })));
        // Restore global quintal charge from saved data
        const firstQC = d.items.find(i => i.quintal_charge > 0);
        if (firstQC) setGlobalQuintalCharge(String(firstQC.quintal_charge));
      })
      .catch(e => { toast.error('Could not load delivery'); navigate('/vehicle-incoming'); })
      .finally(() => setLoading(false));
  };

  // Load current stock for each item
  useEffect(() => {
    loadDelivery();
  }, [id]);

  useEffect(() => {
    if (!items.length) return;
    items.forEach((item, idx) => {
      if (item.product_id) {
        productApi.getById(item.product_id)
          .then(p => {
            setItems(prev => {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                current_stock: p.stock,
                current_price: p.price,
                // Fix 9: auto-fetch product weight if stored
                weight: updated[idx].weight || (p.weight_per_unit ? String(p.weight_per_unit) : ''),
                gst: updated[idx].gst || p.gst || 0,
              };
              return updated;
            });
          })
          .catch(() => {});
      }
    });
  }, [delivery]);

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      // Auto-calculate final price when pricing inputs change
      const it = updated[idx];
      const base = parseFloat(it.base_price) || 0;
      const qCharge = parseFloat(it.quintal_charge) || 0;
      const weight = parseFloat(it.weight) || 0;
      const gst = parseFloat(it.gst) || 0;

      if (base > 0) {
        const quintalAdj = qCharge > 0 && weight > 0 ? (qCharge * weight) / 100 : 0;
        const beforeGST = base + quintalAdj;
        const gstAmt = (beforeGST * gst) / 100;
        updated[idx].final_price = parseFloat((beforeGST + gstAmt).toFixed(2));
      }

      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save updated item details back to delivery
      await deliveryApi.update(id, {
        ...delivery,
        items: items.map(item => ({
          item_name: item.item_name,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit,
          product_id: item.product_id || null,
          label: item.label || 'Goods',
          weight: parseFloat(item.weight) || 0,
          base_price: parseFloat(item.base_price) || 0,
          quintal_charge: parseFloat(item.quintal_charge) || 0,
          gst: parseFloat(item.gst) || 0,
          final_price: parseFloat(item.final_price) || 0,
          final_stock: parseFloat(item.final_stock) || parseFloat(item.quantity) || 0,
          is_new_item: !item.product_id,
        })),
      });
      toast.success('Details saved');
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleMarkDelivered = async () => {
    if (!window.confirm('Mark as delivered? Stock and prices will be updated automatically.')) return;
    // Save pricing first, then mark delivered
    await handleSave();
    setSaving(true);
    try {
      await deliveryApi.updateStatus(id, 'delivered');
      toast.success('✅ Delivered! Stock and prices updated.');
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const getLowStockColor = (stock, threshold = 10) => {
    if (stock === 0) return 'var(--danger)';
    if (stock <= threshold) return 'var(--warning)';
    return 'var(--success)';
  };

  const statusLabels = {
    pending: '⏳ Pending', on_the_way: '🚛 On the Way',
    arriving_soon: '⚠️ Arriving Soon', delivered: '✅ Delivered', not_delivered: '❌ Not Delivered',
  };

  if (loading) return <div className="loading"><span className="spinner"></span></div>;
  if (!delivery) return <div className="empty-state"><div className="empty-text">Not found</div></div>;

  const isDelivered = delivery.status === 'delivered';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
            🚛 {delivery.vehicle_number}
          </div>
          <div className="page-subtitle">
            {delivery.supplier && <span>📦 {delivery.supplier} · </span>}
            {delivery.expected_arrival_ist}
            <span style={{ marginLeft: 10, fontWeight: 700, color: delivery.status === 'delivered' ? 'var(--success)' : 'var(--warning)' }}>
              {statusLabels[delivery.status]}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!isDelivered && (
            <>
              <button className="btn btn-outline" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner"></span></> : '💾 Save Changes'}
              </button>
              <button className="btn btn-success" onClick={handleMarkDelivered} disabled={saving}>
                ✅ Mark Delivered & Update Stock
              </button>
            </>
          )}
          <Link to="/vehicle-incoming" className="btn btn-outline">← Back</Link>
        </div>
      </div>

      {isDelivered && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13.5, color: '#15803d', fontWeight: 600 }}>
          ✅ This delivery is complete. Stock and prices were updated at {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}.
        </div>
      )}

      {/* Global Charges — Supplier + Quintal in single compact row */}
      {!isDelivered && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>

              {/* Supplier Charges */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🏭 Supplier Charges (Total ₹)</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min="0" step="0.01"
                    className="form-control"
                    style={{ width: 120 }}
                    value={supplierCharge}
                    placeholder="e.g. 1000"
                    onChange={e => { setSupplierCharge(e.target.value); setSupplierChargeApplied(false); }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const totalCharge = parseFloat(supplierCharge) || 0;
                      const validItems = items.filter(i => i.item_name);
                      if (!validItems.length) return toast.error('No items to distribute charge to');

                      /*
                       * Correct distribution logic:
                       * Step 1: divide totalCharge equally among distinct items
                       *         chargePerItem = totalCharge / numItems
                       * Step 2: divide chargePerItem by that item's quantity
                       *         perUnitCharge = chargePerItem / itemQty
                       * Final price += perUnitCharge (per unit, so multiply back by qty when needed)
                       * Since final_price is a per-unit price: add perUnitCharge to it
                       */
                      const numItems = validItems.length;
                      const chargePerItem = totalCharge / numItems;

                      setItems(prev => prev.map(item => {
                        if (!item.item_name) return item;
                        const qty = parseFloat(item.quantity) || 1;
                        // Per-unit supplier charge for this item
                        const perUnitSupplierCharge = chargePerItem / qty;

                        // Recalculate final price incrementally — never reset existing value
                        // Use saved final_price as base if no base_price, otherwise recalculate clean
                        const base = parseFloat(item.base_price) || 0;
                        const weight = parseFloat(item.weight) || 0;
                        const qc = parseFloat(item.quintal_charge) || 0;
                        const gst = parseFloat(item.gst) || 0;

                        let newFinal;
                        if (base > 0) {
                          // Full recalculation from base
                          const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                          const beforeGST = base + quintalAdj + perUnitSupplierCharge;
                          const gstAmt = (beforeGST * gst) / 100;
                          newFinal = parseFloat((beforeGST + gstAmt).toFixed(2));
                        } else {
                          // No base price — add per-unit supplier charge to existing final price
                          const existing = parseFloat(item.final_price) || 0;
                          newFinal = parseFloat((existing + perUnitSupplierCharge).toFixed(2));
                        }

                        return {
                          ...item,
                          supplier_charge_per_item: parseFloat(perUnitSupplierCharge.toFixed(4)),
                          final_price: newFinal,
                        };
                      }));

                      setSupplierChargeApplied(true);
                      toast.success(
                        `₹${totalCharge.toFixed(0)} split: ₹${chargePerItem.toFixed(2)}/item across ${numItems} items`
                      );
                    }}
                  >Distribute</button>
                  {supplierChargeApplied && (
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✓ Applied</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Per item: ₹{((parseFloat(supplierCharge) || 0) / Math.max(1, items.filter(i => i.item_name).length)).toFixed(2)} → then ÷ qty per item
                </div>
              </div>

              {/* Quintal Charge */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⚖️ Quintal Charge (₹ per 100 kg)</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min="0" step="0.01"
                    className="form-control"
                    style={{ width: 120 }}
                    value={globalQuintalCharge}
                    placeholder="e.g. 50"
                    onChange={e => setGlobalQuintalCharge(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const qc = parseFloat(globalQuintalCharge) || 0;
                      setApplyingQuintal(true);
                      setItems(prev => prev.map(item => {
                        const base = parseFloat(item.base_price) || 0;
                        const weight = parseFloat(item.weight) || 0;
                        const gst = parseFloat(item.gst) || 0;
                        const scPU = item.supplier_charge_per_item || 0;
                        const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                        // Include supplier charge if already applied
                        const beforeGST = base + quintalAdj + scPU;
                        const gstAmt = (beforeGST * gst) / 100;
                        const finalPrice = base > 0
                          ? parseFloat((beforeGST + gstAmt).toFixed(2))
                          : item.final_price;
                        return { ...item, quintal_charge: String(qc), final_price: finalPrice || item.final_price };
                      }));
                      setTimeout(() => setApplyingQuintal(false), 300);
                      toast.success(`₹${qc}/quintal applied to all items`);
                    }}
                  >
                    {applyingQuintal ? <span className="spinner"></span> : 'Apply All'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Formula: Base + (QC × Weight ÷ 100) + SupplierCharge + GST
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📦 Item Details & Pricing</div>
          
          {!isDelivered && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Edit weight & pricing below. Final Price is auto-calculated but editable.
            </div>
          )}
        </div>
        <div className="card-body no-pad">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[
                    'Item', 'Type', 'Current Stock', 'Incoming Qty',
                    'Final Stock', 'Weight (kg)',
                    'Base Price ₹', 'Quintal Charge ₹', 'GST %', 'Final Price ₹'
                  ].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const expectedStock = (item.current_stock || 0) + (parseFloat(item.quantity) || 0);
                  const stockColor = getLowStockColor(item.current_stock || 0);

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {/* Item Name */}
                      <td style={{ padding: '10px 12px', minWidth: 130 }}>
                        <div style={{ fontWeight: 700 }}>{item.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</div>
                        {!item.product_id && (
                          <span style={{ fontSize: 10, background: '#fffbeb', color: '#92400e', padding: '1px 5px', borderRadius: 6, fontWeight: 600 }}>
                            New Item
                          </span>
                        )}
                      </td>
                      {/* Label */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 8 }}>{item.label || 'Goods'}</span>
                      </td>
                      {/* Current Stock */}
                      <td style={{ padding: '10px 12px' }}>
                        {item.current_stock != null ? (
                          <span style={{ fontWeight: 700, color: stockColor }}>
                            {item.current_stock} {item.unit}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {item.product_id ? 'Loading...' : '—'}
                          </span>
                        )}
                      </td>
                      {/* Incoming Qty */}
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--primary)' }}>
                        +{item.quantity} {item.unit}
                      </td>
                      {/* Final Stock (editable) */}
                      <td style={{ padding: '10px 12px', minWidth: 110 }}>
                        {isDelivered ? (
                          <span style={{ fontWeight: 700 }}>{item.final_stock ?? item.quantity} {item.unit}</span>
                        ) : (
                          <div>
                            <input
                              type="number" min="0" step="0.01"
                              className="form-control"
                              style={{ width: 90, fontSize: 12 }}
                              value={item.final_stock}
                              onChange={e => updateItem(idx, 'final_stock', e.target.value)}
                            />
                            {item.current_stock != null && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                → {(item.current_stock + (parseFloat(item.final_stock) || 0)).toFixed(0)} total
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Weight */}
                      <td style={{ padding: '10px 12px', minWidth: 100 }}>
                        {isDelivered ? (
                          <span>{item.weight || '—'}</span>
                        ) : (
                          <input type="number" min="0" step="0.01" className="form-control"
                            style={{ width: 85, fontSize: 12 }}
                            value={item.weight}
                            placeholder="0"
                            onChange={e => updateItem(idx, 'weight', e.target.value)} />
                        )}
                      </td>
                      {/* Base Price */}
                      <td style={{ padding: '10px 12px', minWidth: 110 }}>
                        {isDelivered ? (
                          <span>{item.base_price ? fc(item.base_price) : '—'}</span>
                        ) : (
                          <input type="number" min="0" step="0.01" className="form-control"
                            style={{ width: 90, fontSize: 12 }}
                            value={item.base_price}
                            placeholder="0.00"
                            onChange={e => updateItem(idx, 'base_price', e.target.value)} />
                        )}
                      </td>
                      {/* Quintal Charge */}
                      <td style={{ padding: '10px 12px', minWidth: 120 }}>
                        {isDelivered ? (
                          <span>{item.quintal_charge ? fc(item.quintal_charge) : '—'}</span>
                        ) : (
                          <div>
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: 90, fontSize: 12 }}
                              value={item.quintal_charge}
                              placeholder="per 100kg"
                              onChange={e => updateItem(idx, 'quintal_charge', e.target.value)} />
                            {parseFloat(item.quintal_charge) > 0 && parseFloat(item.weight) > 0 && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                +{fc((parseFloat(item.quintal_charge) * parseFloat(item.weight)) / 100)} added
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {/* GST */}
                      <td style={{ padding: '10px 12px', minWidth: 80 }}>
                        {isDelivered ? (
                          <span>{item.gst}%</span>
                        ) : (
                          <select className="form-control" style={{ width: 70, fontSize: 12 }}
                            value={item.gst}
                            onChange={e => updateItem(idx, 'gst', e.target.value)}>
                            {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                          </select>
                        )}
                      </td>
                      {/* Final Price */}
                      <td style={{ padding: '10px 12px', minWidth: 110 }}>
                        {isDelivered ? (
                          <span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                            {item.final_price ? fc(item.final_price) : '—'}
                          </span>
                        ) : (
                          <div>
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: 90, fontSize: 12, fontWeight: 700 }}
                              value={item.final_price}
                              placeholder="Auto"
                              onChange={e => updateItem(idx, 'final_price', e.target.value)} />
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Auto-calculated · editable
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pricing Formula Info */}
      {!isDelivered && (
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, color: '#1e40af' }}>
          💡 <strong>Pricing Formula:</strong> Final Price = Base Price + (Quintal Charge × Weight ÷ 100) + GST%
          <span style={{ marginLeft: 12, opacity: 0.7 }}>· Final Price is auto-calculated but can be manually overridden</span>
        </div>
      )}
    </div>
  );
}