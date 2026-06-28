import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi, productApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Truck, Calendar, ArrowLeft, CheckCircle, Clock, User, AlertTriangle, FileText, X, Check, ArrowRight, Save, LayoutGrid, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supplierCharge, setExtraCharge] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [globalQuintalCharge, setGlobalQuintalCharge] = useState('');
  const [applyingQuintal, setApplyingQuintal] = useState(false);
  const [supplierChargeApplied, setExtraChargeApplied] = useState(false);
  const [supplierInputCharges, setSupplierInputCharges] = useState({});
  const [supplierInputQuintals, setSupplierInputQuintals] = useState({});
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
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
          supplier_charge_per_item: item.supplier_charge_per_item > 0 ? String(item.supplier_charge_per_item) : '',
          final_stock: item.final_stock != null ? String(item.final_stock) : String(item.quantity),
          current_stock: null,
        })));
        const firstQC = d.items.find(i => i.quintal_charge > 0);
        if (firstQC) setGlobalQuintalCharge(String(firstQC.quintal_charge));

        const totalExtraCharge = d.items.reduce((sum, item) => {
          return sum + ((parseFloat(item.supplier_charge_per_item) || 0) * (parseFloat(item.quantity) || 1));
        }, 0);
        if (totalExtraCharge > 0) {
          setExtraCharge(String(parseFloat(totalExtraCharge.toFixed(2))));
          setExtraChargeApplied(true);
        }
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

      if (field !== 'final_price') {
        const it = updated[idx];
        const base = parseFloat(it.base_price) || 0;
        const qCharge = parseFloat(it.quintal_charge) || 0;
        const supplierCharge = parseFloat(it.supplier_charge_per_item) || 0;
        const weight = parseFloat(it.weight) || 0;
        const gst = parseFloat(it.gst) || 0;

        if (base > 0 || supplierCharge > 0) {
          const quintalAdj = qCharge > 0 && weight > 0 ? (qCharge * weight) / 100 : 0;
          const beforeGST = base + quintalAdj + supplierCharge;
          const gstAmt = (beforeGST * gst) / 100;
          updated[idx].final_price = parseFloat((beforeGST + gstAmt).toFixed(2));
        }
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
          supplier_charge_per_item: parseFloat(item.supplier_charge_per_item) || 0,
          gst: parseFloat(item.gst) || 0,
          final_price: parseFloat(item.final_price) || 0,
          final_stock: parseFloat(item.final_stock) || parseFloat(item.quantity) || 0,
          is_new_item: !item.product_id,
          supplier_name: item.supplier_name,
        })),
      });
      toast.success('Details saved');
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleMarkDelivered = () => {
    setShowDeliverModal(true);
  };

  const confirmDelivery = async () => {
    setShowDeliverModal(false);
    if (!delivery.stock_updated) {
      await handleSave();
    }
    setSaving(true);
    try {
      await deliveryApi.updateStatus(id, 'delivered');
      toast.success('✅ Delivered! Status updated.');
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const confirmArrived = async () => {
    setShowArrivedModal(false);
    await handleSave();
    setSaving(true);
    try {
      await deliveryApi.updateStatus(id, 'arrived');
      toast.success('📍 Marked Arrived! Items provisionally added to inventory. You can still edit prices & quantities.');
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
    arriving_soon: '⚠️ Arriving Soon', arrived: '📍 Arrived', delivered: '✅ Delivered', not_delivered: '❌ Not Delivered',
  };

  if (loading) return <div className="loading"><span className="spinner"></span></div>;
  if (!delivery) return <div className="empty-state"><div className="empty-text">Not found</div></div>;

  const isDelivered = delivery.status === 'delivered';
  const isArrived = delivery.status === 'arrived';
  const isStockUpdated = delivery.stock_updated;
  // Editing is locked ONLY when fully delivered — arrived keeps editing open
  const isLocked = isDelivered;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-print">
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
            <div className="page-title" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? '20px' : '24px', margin: 0, marginTop: '4px' }}>
              <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                <Truck size={24} />
              </span>
              <span>{(delivery.vehicle_number || '').toUpperCase()}</span>
            </div>
            <div className="page-subtitle" style={{ fontSize: '13.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 0 }}>
              {delivery.supplier && (
                <>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{delivery.supplier}</span>
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
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          {!isLocked && (
            <>
              <button className="btn btn-outline" onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, borderRadius: 8, fontSize: isMobile ? 11 : 13, padding: isMobile ? '6px 8px' : '8px 16px', whiteSpace: 'nowrap' }}>
                <Save size={13} /> {isMobile ? 'Save' : 'Save Changes'}
              </button>
              <button className="btn btn-primary" onClick={() => setShowArrivedModal(true)} disabled={saving || isArrived} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1.5, borderRadius: 8, fontSize: isMobile ? 11 : 13, padding: isMobile ? '6px 8px' : '8px 16px', whiteSpace: 'nowrap', background: isArrived ? '#6366f1' : '#4338ca', color: '#fff', border: 'none', opacity: isArrived ? 0.6 : 1 }}>
                <MapPin size={13} /> {isMobile ? (isArrived ? 'Arrived ✓' : 'Arrived') : (isArrived ? 'Arrived ✓' : 'Mark Arrived')}
              </button>
            </>
          )}
          {!isDelivered && (
            <button className="btn btn-success" onClick={handleMarkDelivered} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1.5, borderRadius: 8, fontSize: isMobile ? 11 : 13, padding: isMobile ? '6px 8px' : '8px 16px', whiteSpace: 'nowrap' }}>
              <CheckCircle size={13} /> {isMobile ? 'Deliver' : 'Mark Delivered'}
            </button>
          )}
        </div>
      </div>

      {isDelivered && (
        <div style={{ background: 'var(--success-light)', border: '1px solid #a7f3d0', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13.5, color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} style={{ color: '#059669' }} />
          <span>This delivery is complete. Stock and prices were updated at {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}.</span>
        </div>
      )}
      {isArrived && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13.5, color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={16} style={{ color: '#d97706' }} />
          <span>🚛 Vehicle arrived! Items provisionally in inventory. <strong>Edit prices, quantities, charges below</strong> — finalize by clicking <strong>Mark Delivered</strong>.</span>
        </div>
      )}

      
      {/* Grouped by Supplier */}
      {[...new Set(items.map(i => i.supplier_name || delivery?.supplier || 'Unknown Supplier'))].map(supplierName => {
        const supplierItems = items.map((item, originalIndex) => ({ item, originalIndex }))
          .filter(x => (x.item.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName);
        
        if (supplierItems.length === 0) return null;
        
        const scValue = supplierInputCharges[supplierName] || '';
        const qcValue = supplierInputQuintals[supplierName] || '';

        return (
          <div key={supplierName} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: 14 }}>
                Items for {supplierName}
              </div>
            </div>

            {/* Supplier Charges */}
            {!isLocked && (
              <div className="card" style={{ marginBottom: 16, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div className="card-body" style={{ padding: isMobile ? 12 : 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: isMobile ? 10 : 20, alignItems: 'flex-start' }}>

                    {/* Extra Charges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: isMobile ? 11 : 13, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span>🏭</span> {isMobile ? 'Extra (₹)' : 'Extra Charges (Total ₹)'}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="0" step="0.01"
                          className="form-control"
                          style={{ flex: 1, minWidth: 0, fontSize: isMobile ? 11.5 : 12.5, padding: isMobile ? '6px 8px' : '8px 12px', borderRadius: 6 }}
                          value={scValue}
                          placeholder={isMobile ? "1k" : "e.g. 1000"}
                          onChange={e => setSupplierInputCharges(prev => ({ ...prev, [supplierName]: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: 6, padding: isMobile ? '6px 8px' : '8px 14px', fontSize: isMobile ? 11 : 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
                          onClick={() => {
                            const totalCharge = parseFloat(scValue) || 0;
                            const validItems = supplierItems.filter(x => x.item.item_name);
                            if (!validItems.length) return toast.error('No items to distribute charge to');

                            const totalQty = validItems.reduce((sum, x) => sum + (parseFloat(x.item.quantity) || 1), 0);
                            const chargePerQty = totalCharge / totalQty;

                            setItems(prev => prev.map((item, idx) => {
                              // Only update items belonging to this supplier
                              const isThisSupplier = validItems.some(v => v.originalIndex === idx);
                              if (!isThisSupplier) return item;

                              const perUnitExtraCharge = chargePerQty;
                              const base = parseFloat(item.base_price) || 0;
                              const weight = parseFloat(item.weight) || 0;
                              const qc = parseFloat(item.quintal_charge) || 0;
                              const gst = parseFloat(item.gst) || 0;

                              let newFinal;
                              if (base > 0) {
                                const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                                const beforeGST = base + quintalAdj + perUnitExtraCharge;
                                const gstAmt = (beforeGST * gst) / 100;
                                newFinal = parseFloat((beforeGST + gstAmt).toFixed(2));
                              } else {
                                const existing = parseFloat(item.final_price) || 0;
                                newFinal = parseFloat((existing + perUnitExtraCharge).toFixed(2));
                              }

                              return {
                                ...item,
                                supplier_charge_per_item: parseFloat(perUnitExtraCharge.toFixed(4)),
                                final_price: newFinal,
                              };
                            }));
                            toast.success(`₹${totalCharge.toFixed(0)} distributed to ${supplierName}'s items`);
                          }}
                        >
                          {isMobile ? 'Split' : 'Distribute'}
                        </button>
                      </div>
                    </div>

                    {/* Quintal Charge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: isMobile ? 11 : 13, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span>⚖️</span> {isMobile ? 'Quintal' : 'Quintal Charge (₹ per 100 kg)'}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="0" step="0.01"
                          className="form-control"
                          style={{ flex: 1, minWidth: 0, fontSize: isMobile ? 11.5 : 12.5, padding: isMobile ? '6px 8px' : '8px 12px', borderRadius: 6 }}
                          value={qcValue}
                          placeholder={isMobile ? "50" : "e.g. 50"}
                          onChange={e => setSupplierInputQuintals(prev => ({ ...prev, [supplierName]: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: 6, padding: isMobile ? '6px 8px' : '8px 14px', fontSize: isMobile ? 11 : 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
                          onClick={() => {
                            const qc = parseFloat(qcValue) || 0;
                            setApplyingQuintal(true);
                            setItems(prev => prev.map((item, idx) => {
                              const isThisSupplier = supplierItems.some(v => v.originalIndex === idx);
                              if (!isThisSupplier) return item;

                              const base = parseFloat(item.base_price) || 0;
                              const weight = parseFloat(item.weight) || 0;
                              const gst = parseFloat(item.gst) || 0;
                              const scPU = parseFloat(item.supplier_charge_per_item) || 0;
                              const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                              const beforeGST = base + quintalAdj + scPU;
                              const gstAmt = (beforeGST * gst) / 100;
                              const finalPrice = base > 0
                                ? parseFloat((beforeGST + gstAmt).toFixed(2))
                                : item.final_price;
                              return { ...item, quintal_charge: String(qc), final_price: finalPrice || item.final_price };
                            }));
                            setTimeout(() => setApplyingQuintal(false), 300);
                            toast.success(`₹${qc}/quintal applied to ${supplierName}'s items`);
                          }}
                        >
                          {isMobile ? 'Apply' : 'Apply All'}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* Item Details Table */}
            <div className="card" style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div className="card-body no-pad" style={{ background: 'var(--bg-card)' }}>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1.5px solid #e2e8f0' }}>
                        {[
                          'Item', 'Current Stock', 'Incoming Qty',
                          'Final Stock', 'Weight (kg)',
                          ...(user?.role === 'supervisor' ? ['Base Price ₹', 'Supplier Total ₹'] : []), 'Extra Charge ₹', 'Quintal Charge ₹', 'GST %', 'Selling Price ₹'
                        ].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {supplierItems.map(({ item, originalIndex: idx }) => {
                        const expectedStock = (item.current_stock || 0) + (parseFloat(item.quantity) || 0);
                        const stockColor = getLowStockColor(item.current_stock || 0);

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', transition: 'all 0.2s' }}>
                            {/* Item Name */}
                            <td style={{ padding: '12px 16px', minWidth: 140, fontFamily: "'Inter', sans-serif" }}>
                              <div style={{ fontWeight: 800, color: 'var(--text)' }}>{item.item_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>{item.unit}</div>
                              {!item.product_id && (
                                <span style={{ fontSize: 10, background: 'var(--warning-light)', color: '#b45309', padding: '2px 6px', borderRadius: 6, fontWeight: 700, border: '1px solid #fef3c7', marginTop: 4, display: 'inline-block' }}>
                                  New Item
                                </span>
                              )}
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
                              {isLocked ? (
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
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                                      → {(item.current_stock + (parseFloat(item.final_stock) || 0)).toFixed(0)} total
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Weight */}
                            <td style={{ padding: '12px 16px', minWidth: 100, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
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
                            {user?.role === 'supervisor' && (
                              <td style={{ padding: '12px 16px', minWidth: 110, fontFamily: "'Inter', sans-serif" }}>
                                {isLocked ? (
                                  <span>{item.base_price ? fc(item.base_price) : '—'}</span>
                                ) : (
                                  <input type="number" min="0" step="0.01" className="form-control"
                                    style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                                    value={item.base_price}
                                    placeholder="0.00"
                                    onChange={e => updateItem(idx, 'base_price', e.target.value)} />
                                )}
                              </td>
                            )}
                            {/* Supplier Total */}
                            {user?.role === 'supervisor' && (
                              <td style={{ padding: '12px 16px', minWidth: 100, fontFamily: "'Inter', sans-serif" }}>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>{fc((parseFloat(item.quantity) || 0) * (parseFloat(item.base_price) || 0))}</span>
                              </td>
                            )}
                            {/* Extra Charge per unit */}
                            <td style={{ padding: '12px 16px', minWidth: 110, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span>{item.supplier_charge_per_item ? fc(item.supplier_charge_per_item) : '—'}</span>
                              ) : (
                                <input type="number" min="0" step="0.01" className="form-control"
                                  style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                                  value={item.supplier_charge_per_item || ''}
                                  placeholder="per unit"
                                  onChange={e => updateItem(idx, 'supplier_charge_per_item', e.target.value)} />
                              )}
                            </td>
                            {/* Quintal Charge */}
                            <td style={{ padding: '12px 16px', minWidth: 120, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span>{item.quintal_charge ? fc(item.quintal_charge) : '—'}</span>
                              ) : (
                                <div>
                                  <input type="number" min="0" step="0.01" className="form-control"
                                    style={{ width: 90, fontSize: 12.5, borderRadius: 8 }}
                                    value={item.quintal_charge}
                                    placeholder="per 100kg"
                                    onChange={e => updateItem(idx, 'quintal_charge', e.target.value)} />
                                  {parseFloat(item.quintal_charge) > 0 && parseFloat(item.weight) > 0 && (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                                      +{fc((parseFloat(item.quintal_charge) * parseFloat(item.weight)) / 100)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            {/* GST */}
                            <td style={{ padding: '12px 16px', minWidth: 80, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
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
                              {isLocked ? (
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
                                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
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
              </div>
            </div>
          </div>
        );
      })}
      
{/* Pricing Formula */}
      {!isLocked && (
        <div style={{ marginTop: 14, padding: '12px 18px', background: 'var(--primary-light)', border: '1px solid #bfdbfe', borderRadius: 12, fontSize: '13px', color: '#1e40af', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡</span>
          <span><strong>Pricing Formula:</strong> Selling Price = Base Price + Extra Charge + (Quintal Charge × Weight ÷ 100) + GST%. Selling Price is auto-calculated but can be manually overridden.</span>
        </div>
      )}

      {/* Custom Deliver Confirm Modal */}
      {showDeliverModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, color: 'var(--text)' }}>Confirm Delivery</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to mark this vehicle as delivered?<br/><br/>
              {!isStockUpdated && delivery.temp_stock_added && <span><strong>Prices will be locked in</strong> and any quantity changes since arrival will be reconciled in inventory.</span>}
              {!isStockUpdated && !delivery.temp_stock_added && <span><strong>Stock and prices will be updated automatically</strong> across your entire inventory.</span>}
              {isStockUpdated && <span>Stock has already been finalized.</span>}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowDeliverModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={confirmDelivery}>Yes, Mark Delivered</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Arrived Confirm Modal */}
      {showArrivedModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, color: 'var(--text)' }}>Mark Arrived</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to mark this vehicle as arrived?<br/><br/>
              <strong>Items will be provisionally added to inventory</strong> so you can start billing and loading vehicles immediately.<br/><br/>
              <span style={{ color: '#059669' }}>✅ You can still edit item prices &amp; quantities until you click <strong>Mark Delivered</strong>.</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowArrivedModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmArrived} style={{ background: '#4338ca', color: '#fff', border: 'none' }}>Yes, Mark Arrived</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}