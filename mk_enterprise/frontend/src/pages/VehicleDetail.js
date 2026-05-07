import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi, productApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Truck, Calendar, ArrowLeft, CheckCircle, Clock, User, AlertTriangle, FileText, X, Check, ArrowRight, Save, LayoutGrid } from 'lucide-react';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supplierCharge, setSupplierCharge] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [globalQuintalCharge, setGlobalQuintalCharge] = useState('');
  const [applyingQuintal, setApplyingQuintal] = useState(false);
  const [supplierChargeApplied, setSupplierChargeApplied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const fc = formatCurrency;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadDelivery = () => {
    setLoading(true);
    deliveryApi.getById(id)
      .then(d => {
        if (!d) { toast.error('Delivery not found'); navigate('/vehicle-incoming'); return; }
        setDelivery(d);
        setItems(d.items.map(item => ({
          ...item,
          weight: item.weight > 0 ? String(item.weight) : '',
          base_price: item.base_price > 0 ? String(item.base_price) : '',
          quintal_charge: item.quintal_charge > 0 ? String(item.quintal_charge) : '',
          gst: item.gst || 0,
          final_price: item.final_price > 0 ? String(item.final_price) : '',
          final_stock: item.final_stock != null ? String(item.final_stock) : String(item.quantity),
          current_stock: null,
        })));
        const firstQC = d.items.find(i => i.quintal_charge > 0);
        if (firstQC) setGlobalQuintalCharge(String(firstQC.quintal_charge));
      })
      .catch(e => { toast.error('Could not load delivery'); navigate('/vehicle-incoming'); })
      .finally(() => setLoading(false));
  };

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
    if (stock === 0) return '#dc2626';
    if (stock <= threshold) return '#d97706';
    return '#059669';
  };

  const statusLabels = {
    pending: '⏳ Pending', on_the_way: '🚛 On the Way',
    arriving_soon: '⚠️ Arriving Soon', delivered: '✅ Delivered', not_delivered: '❌ Not Delivered',
  };

  if (loading) return <div className="loading"><span className="spinner"></span></div>;
  if (!delivery) return <div className="empty-state"><div className="empty-text">Not found</div></div>;

  const isDelivered = delivery.status === 'delivered';

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="page-header" style={{ marginBottom: 20, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 16 }}>
        <div>
          <div className="page-title" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? '20px' : '24px' }}>
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <Truck size={24} />
            </span>
            <span>{delivery.vehicle_number}</span>
          </div>
          <div className="page-subtitle" style={{ fontSize: '13.5px', color: '#64748b', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {delivery.supplier && (
              <>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{delivery.supplier}</span>
                <span>·</span>
              </>
            )}
            <span>{delivery.expected_arrival_ist}</span>
            <span>·</span>
            <span style={{ fontWeight: 700, color: delivery.status === 'delivered' ? '#059669' : '#d97706' }}>
              {statusLabels[delivery.status]}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto', flexWrap: 'nowrap' }}>
          {!isDelivered && (
            <>
              <button className="btn btn-outline" onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, borderRadius: 8, fontSize: isMobile ? 11 : 13, padding: isMobile ? '6px 8px' : '8px 16px', whiteSpace: 'nowrap' }}>
                <Save size={13} /> {isMobile ? 'Save' : 'Save Changes'}
              </button>
              <button className="btn btn-success" onClick={handleMarkDelivered} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1.5, borderRadius: 8, fontSize: isMobile ? 11 : 13, padding: isMobile ? '6px 8px' : '8px 16px', whiteSpace: 'nowrap' }}>
                <CheckCircle size={13} /> {isMobile ? 'Deliver' : 'Mark Delivered & Update Stock'}
              </button>
            </>
          )}
          <Link to="/vehicle-incoming" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: isMobile ? 0.7 : 'initial', borderRadius: 8, fontSize: isMobile ? 11 : 13, padding: isMobile ? '6px 8px' : '8px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
            <ArrowLeft size={13} /> Back
          </Link>
        </div>
      </div>

      {isDelivered && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13.5, color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} style={{ color: '#059669' }} />
          <span>This delivery is complete. Stock and prices were updated at {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}.</span>
        </div>
      )}

      {/* Global Charges */}
      {!isDelivered && (
        <div className="card" style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div className="card-body" style={{ padding: isMobile ? 12 : 18 }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: isMobile ? 10 : 20, alignItems: 'flex-start' }}>

              {/* Supplier Charges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 11 : 13, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span>🏭</span> {isMobile ? 'Supplier (₹)' : 'Supplier Charges (Total ₹)'}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="number" min="0" step="0.01"
                    className="form-control"
                    style={{ flex: 1, minWidth: 0, fontSize: isMobile ? 11.5 : 12.5, padding: isMobile ? '6px 8px' : '8px 12px', borderRadius: 6 }}
                    value={supplierCharge}
                    placeholder={isMobile ? "1k" : "e.g. 1000"}
                    onChange={e => { setSupplierCharge(e.target.value); setSupplierChargeApplied(false); }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: 6, padding: isMobile ? '6px 8px' : '8px 14px', fontSize: isMobile ? 11 : 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const totalCharge = parseFloat(supplierCharge) || 0;
                      const validItems = items.filter(i => i.item_name);
                      if (!validItems.length) return toast.error('No items to distribute charge to');

                      const numItems = validItems.length;
                      const chargePerItem = totalCharge / numItems;

                      setItems(prev => prev.map(item => {
                        if (!item.item_name) return item;
                        const qty = parseFloat(item.quantity) || 1;
                        const perUnitSupplierCharge = chargePerItem / qty;

                        const base = parseFloat(item.base_price) || 0;
                        const weight = parseFloat(item.weight) || 0;
                        const qc = parseFloat(item.quintal_charge) || 0;
                        const gst = parseFloat(item.gst) || 0;

                        let newFinal;
                        if (base > 0) {
                          const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                          const beforeGST = base + quintalAdj + perUnitSupplierCharge;
                          const gstAmt = (beforeGST * gst) / 100;
                          newFinal = parseFloat((beforeGST + gstAmt).toFixed(2));
                        } else {
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
                      toast.success(`₹${totalCharge.toFixed(0)} split: ₹${chargePerItem.toFixed(2)}/item across ${numItems} items`);
                    }}
                  >
                    {isMobile ? 'Split' : 'Distribute'}
                  </button>
                  {supplierChargeApplied && !isMobile && (
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <Check size={12} /> Applied
                    </span>
                  )}
                </div>
                {!isMobile && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                    Per item: ₹{((parseFloat(supplierCharge) || 0) / Math.max(1, items.filter(i => i.item_name).length)).toFixed(2)} → then ÷ qty per item
                  </div>
                )}
              </div>

              {/* Quintal Charge */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 11 : 13, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span>⚖️</span> {isMobile ? 'Quintal' : 'Quintal Charge (₹ per 100 kg)'}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="number" min="0" step="0.01"
                    className="form-control"
                    style={{ flex: 1, minWidth: 0, fontSize: isMobile ? 11.5 : 12.5, padding: isMobile ? '6px 8px' : '8px 12px', borderRadius: 6 }}
                    value={globalQuintalCharge}
                    placeholder={isMobile ? "50" : "e.g. 50"}
                    onChange={e => setGlobalQuintalCharge(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: 6, padding: isMobile ? '6px 8px' : '8px 14px', fontSize: isMobile ? 11 : 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const qc = parseFloat(globalQuintalCharge) || 0;
                      setApplyingQuintal(true);
                      setItems(prev => prev.map(item => {
                        const base = parseFloat(item.base_price) || 0;
                        const weight = parseFloat(item.weight) || 0;
                        const gst = parseFloat(item.gst) || 0;
                        const scPU = item.supplier_charge_per_item || 0;
                        const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
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
                    {isMobile ? 'Apply' : 'Apply All'}
                  </button>
                </div>
                {!isMobile && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                    Formula: Base + (QC × Weight ÷ 100) + SupplierCharge + GST
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Details */}
      <div className="card" style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div className="card-header" style={{ background: '#f8fafc', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#1e293b', fontSize: '14.5px' }}>
            <span style={{ color: '#4f46e5', display: 'flex', alignItems: 'center' }}>
              <LayoutGrid size={16} />
            </span>
            <span>Item Details & Pricing</span>
          </div>
          {!isDelivered && (
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              Edit weight & pricing. Final Price is auto-calculated but editable.
            </div>
          )}
        </div>

        <div className="card-body no-pad" style={{ background: '#fff' }}>
          {false ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 12 }}>
              {items.map((item, idx) => {
                const expectedStock = (item.current_stock || 0) + (parseFloat(item.quantity) || 0);
                const stockColor = getLowStockColor(item.current_stock || 0);

                return (
                  <div key={idx} style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#1e293b' }}>{item.item_name}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, marginTop: 2 }}>Unit: {item.unit}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 8, fontFamily: "'Inter', sans-serif" }}>
                          {item.label || 'Goods'}
                        </span>
                        {!item.product_id && (
                          <span style={{ fontSize: 10.5, background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: 8, fontWeight: 700, border: '1px solid #fef3c7', fontFamily: "'Inter', sans-serif" }}>
                            New Item
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 10, borderRadius: 10, fontFamily: "'Inter', sans-serif" }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Current Stock:</div>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: stockColor }}>
                          {item.current_stock != null ? `${item.current_stock} ${item.unit}` : (item.product_id ? 'Loading...' : '—')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Incoming Qty:</div>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--primary)' }}>
                          +{item.quantity} {item.unit}
                        </div>
                      </div>
                    </div>

                    {isDelivered ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 10, fontFamily: "'Inter', sans-serif" }}>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Final Stock:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1e293b', marginLeft: 6 }}>
                            {item.final_stock ?? item.quantity} {item.unit}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Weight:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1e293b', marginLeft: 6 }}>
                            {item.weight ? `${item.weight} kg` : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Base Price:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1e293b', marginLeft: 6 }}>
                            {item.base_price ? fc(item.base_price) : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Quintal:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1e293b', marginLeft: 6 }}>
                            {item.quintal_charge ? fc(item.quintal_charge) : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>GST %:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1e293b', marginLeft: 6 }}>
                            {item.gst}%
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Final Price:</span>
                          <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--primary)', marginLeft: 6 }}>
                            {item.final_price ? fc(item.final_price) : '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10, fontFamily: "'Inter', sans-serif" }}>
                        
                        {/* Final Stock */}
                        <div style={{ gridColumn: 'span 6' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Final Stock</label>
                          <div>
                            <input
                              type="number" min="0" step="0.01"
                              className="form-control"
                              style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8 }}
                              value={item.final_stock}
                              onChange={e => updateItem(idx, 'final_stock', e.target.value)}
                            />
                            {item.current_stock != null && (
                              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                → {(item.current_stock + (parseFloat(item.final_stock) || 0)).toFixed(0)} total
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Weight */}
                        <div style={{ gridColumn: 'span 6' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Weight (kg)</label>
                          <input type="number" min="0" step="0.01" className="form-control"
                            style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8 }}
                            value={item.weight}
                            placeholder="0"
                            onChange={e => updateItem(idx, 'weight', e.target.value)} />
                        </div>

                        {/* Base Price */}
                        <div style={{ gridColumn: 'span 6' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Base Price ₹</label>
                          <input type="number" min="0" step="0.01" className="form-control"
                            style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8 }}
                            value={item.base_price}
                            placeholder="0.00"
                            onChange={e => updateItem(idx, 'base_price', e.target.value)} />
                        </div>

                        {/* Quintal Charge */}
                        <div style={{ gridColumn: 'span 6' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Quintal Charge ₹</label>
                          <div>
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8 }}
                              value={item.quintal_charge}
                              placeholder="per 100kg"
                              onChange={e => updateItem(idx, 'quintal_charge', e.target.value)} />
                            {parseFloat(item.quintal_charge) > 0 && parseFloat(item.weight) > 0 && (
                              <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                                +{fc((parseFloat(item.quintal_charge) * parseFloat(item.weight)) / 100)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* GST % */}
                        <div style={{ gridColumn: 'span 5' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>GST %</label>
                          <select className="form-control" style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8 }}
                            value={item.gst}
                            onChange={e => updateItem(idx, 'gst', e.target.value)}>
                            {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                          </select>
                        </div>

                        {/* Final Price */}
                        <div style={{ gridColumn: 'span 7' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Final Price ₹</label>
                          <div>
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: '100%', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, fontWeight: 700 }}
                              value={item.final_price}
                              placeholder="Auto"
                              onChange={e => updateItem(idx, 'final_price', e.target.value)} />
                            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2, fontWeight: 500 }}>Auto-calculated</div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    {[
                      'Item', 'Type', 'Current Stock', 'Incoming Qty',
                      'Final Stock', 'Weight (kg)',
                      'Base Price ₹', 'Quintal Charge ₹', 'GST %', 'Final Price ₹'
                    ].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const expectedStock = (item.current_stock || 0) + (parseFloat(item.quantity) || 0);
                    const stockColor = getLowStockColor(item.current_stock || 0);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', transition: 'all 0.2s' }}>
                        {/* Item Name */}
                        <td style={{ padding: '12px 16px', minWidth: 140, fontFamily: "'Inter', sans-serif" }}>
                          <div style={{ fontWeight: 800, color: '#1e293b' }}>{item.item_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>{item.unit}</div>
                          {!item.product_id && (
                            <span style={{ fontSize: 10, background: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: 6, fontWeight: 700, border: '1px solid #fef3c7', marginTop: 4, display: 'inline-block' }}>
                              New Item
                            </span>
                          )}
                        </td>
                        {/* Label */}
                        <td style={{ padding: '12px 16px', fontFamily: "'Inter', sans-serif" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 8 }}>{item.label || 'Goods'}</span>
                        </td>
                        {/* Current Stock */}
                        <td style={{ padding: '12px 16px', fontFamily: "'Inter', sans-serif" }}>
                          {item.current_stock != null ? (
                            <span style={{ fontWeight: 700, color: stockColor }}>
                              {item.current_stock} {item.unit}
                            </span>
                          ) : (
                            <span style={{ color: '#cbd5e1', fontSize: 12 }}>
                              {item.product_id ? 'Loading...' : '—'}
                            </span>
                          )}
                        </td>
                        {/* Incoming Qty */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', fontFamily: "'Inter', sans-serif" }}>
                          +{item.quantity} {item.unit}
                        </td>
                        {/* Final Stock (editable) */}
                        <td style={{ padding: '12px 16px', minWidth: 110, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span style={{ fontWeight: 700 }}>{item.final_stock ?? item.quantity} {item.unit}</span>
                          ) : (
                            <div>
                              <input
                                type="number" min="0" step="0.01"
                                className="form-control"
                                style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                                value={item.final_stock}
                                onChange={e => updateItem(idx, 'final_stock', e.target.value)}
                              />
                              {item.current_stock != null && (
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                                  → {(item.current_stock + (parseFloat(item.final_stock) || 0)).toFixed(0)} total
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        {/* Weight */}
                        <td style={{ padding: '12px 16px', minWidth: 100, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span>{item.weight || '—'}</span>
                          ) : (
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: 85, fontSize: 12.5, borderRadius: 8 }}
                              value={item.weight}
                              placeholder="0"
                              onChange={e => updateItem(idx, 'weight', e.target.value)} />
                        )}
                        </td>
                        {/* Base Price */}
                        <td style={{ padding: '12px 16px', minWidth: 110, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span>{item.base_price ? fc(item.base_price) : '—'}</span>
                          ) : (
                            <input type="number" min="0" step="0.01" className="form-control"
                              style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                              value={item.base_price}
                              placeholder="0.00"
                              onChange={e => updateItem(idx, 'base_price', e.target.value)} />
                          )}
                        </td>
                        {/* Quintal Charge */}
                        <td style={{ padding: '12px 16px', minWidth: 120, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span>{item.quintal_charge ? fc(item.quintal_charge) : '—'}</span>
                          ) : (
                            <div>
                              <input type="number" min="0" step="0.01" className="form-control"
                                style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                                value={item.quintal_charge}
                                placeholder="per 100kg"
                                onChange={e => updateItem(idx, 'quintal_charge', e.target.value)} />
                              {parseFloat(item.quintal_charge) > 0 && parseFloat(item.weight) > 0 && (
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                                  +{fc((parseFloat(item.quintal_charge) * parseFloat(item.weight)) / 100)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        {/* GST */}
                        <td style={{ padding: '12px 16px', minWidth: 80, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span>{item.gst}%</span>
                          ) : (
                            <select className="form-control" style={{ width: 75, fontSize: 12.5, borderRadius: 8 }}
                              value={item.gst}
                              onChange={e => updateItem(idx, 'gst', e.target.value)}>
                              {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                            </select>
                          )}
                        </td>
                        {/* Final Price */}
                        <td style={{ padding: '12px 16px', minWidth: 120, fontFamily: "'Inter', sans-serif" }}>
                          {isDelivered ? (
                            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                              {item.final_price ? fc(item.final_price) : '—'}
                            </span>
                          ) : (
                            <div>
                              <input type="number" min="0" step="0.01" className="form-control"
                                style={{ width: 90, fontSize: 12.5, borderRadius: 8, fontWeight: 700 }}
                                value={item.final_price}
                                placeholder="Auto"
                                onChange={e => updateItem(idx, 'final_price', e.target.value)} />
                              <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                                Auto-calculated
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
          )}
        </div>
      </div>

      {/* Pricing Formula */}
      {!isDelivered && (
        <div style={{ marginTop: 14, padding: '12px 18px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, fontSize: '13px', color: '#1e40af', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡</span>
          <span><strong>Pricing Formula:</strong> Final Price = Base Price + (Quintal Charge × Weight ÷ 100) + GST%. Final Price is auto-calculated but can be manually overridden.</span>
        </div>
      )}
    </div>
  );
}