import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deliveryApi, productApi, productListApi, authApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { Truck, Calendar, ArrowLeft, CheckCircle, Clock, User, AlertTriangle, FileText, X, Check, ArrowRight, Save, LayoutGrid, MapPin, Building, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useApp();
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
  const [supplierInputMargins, setSupplierInputMargins] = useState({});
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [vacantManagers, setVacantManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [hiddenSupplierCharges, setHiddenSupplierCharges] = useState({});
  const [hiddenSupplierQuintals, setHiddenSupplierQuintals] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [showNewItemListsModal, setShowNewItemListsModal] = useState(false);
  const [newlyCreatedItems, setNewlyCreatedItems] = useState([]);
  const [inventoryLists, setInventoryLists] = useState([]);
  const [selectedListsForItem, setSelectedListsForItem] = useState({});
  const [savingLists, setSavingLists] = useState(false);
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

      const it = updated[idx];
      const supplierName = it.supplier_name || delivery?.supplier || 'Unknown Supplier';

      if (field === 'final_stock') {
        const totalCharge = parseFloat(supplierInputCharges[supplierName]) || 0;
        if (totalCharge > 0) {
          const validItems = updated.filter(x => x.item_name && (x.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName);
          const totalQty = validItems.reduce((sum, x) => sum + (parseFloat(x.final_stock ?? x.quantity) || 1), 0);
          const chargePerQty = totalQty > 0 ? totalCharge / totalQty : 0;
          
          updated.forEach(x => {
            if (x.item_name && (x.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName) {
              x.supplier_charge_per_item = String(chargePerQty);
              const base = parseFloat(x.base_price) || 0;
              const qCharge = parseFloat(x.quintal_charge) || 0;
              const weight = parseFloat(x.weight) || 0;
              const gst = parseFloat(x.gst) || 0;
              const margin = parseFloat(x.margin) || 0;
              
              if (base > 0 || chargePerQty > 0) {
                const quintalAdj = qCharge > 0 && weight > 0 ? (qCharge * weight) / 100 : 0;
                const beforeGST = base + quintalAdj + chargePerQty;
                const gstAmt = (beforeGST * gst) / 100;
                const landedCost = parseFloat((beforeGST + gstAmt).toFixed(2));
                x.final_price = parseFloat((landedCost + margin).toFixed(2));
              }
            }
          });
        }
      }

      const base = parseFloat(it.base_price) || 0;
      const qCharge = parseFloat(it.quintal_charge) || 0;
      const supplierCharge = parseFloat(it.supplier_charge_per_item) || 0;
      const weight = parseFloat(it.weight) || 0;
      const gst = parseFloat(it.gst) || 0;
      const margin = parseFloat(it.margin) || 0;

      if (base > 0 || supplierCharge > 0) {
        const quintalAdj = qCharge > 0 && weight > 0 ? (qCharge * weight) / 100 : 0;
        const beforeGST = base + quintalAdj + supplierCharge;
        const gstAmt = (beforeGST * gst) / 100;
        const landedCost = parseFloat((beforeGST + gstAmt).toFixed(2));

        if (field === 'final_price') {
          const finalP = parseFloat(it.final_price) || 0;
          const newMargin = finalP - landedCost;
          updated[idx].margin = String(parseFloat(newMargin.toFixed(2)));
        } else if (field !== 'final_stock' || (parseFloat(supplierInputCharges[supplierName]) || 0) === 0) {
          updated[idx].final_price = parseFloat((landedCost + margin).toFixed(2));
        }
      }

      return updated;
    });
  };

  const handleSave = async (silent = false) => {
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
          margin: parseFloat(item.margin) || 0,
          final_price: parseFloat(item.final_price) || 0,
          final_stock: parseFloat(item.final_stock) || parseFloat(item.quantity) || 0,
          is_new_item: !item.product_id,
          supplier_name: item.supplier_name,
        })),
      });
      if (!silent) toast.success('Details saved');
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
      await handleSave(true);
    }
    setSaving(true);
    try {
      await deliveryApi.updateStatus(id, 'delivered');
      toast.success('Delivered! Status updated.');
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const confirmArrived = async () => {
    setShowArrivedModal(false);
    
    // Identify new items BEFORE saving
    const newItemsBeforeSave = items.filter(i => !i.product_id && i.item_name && i.item_name.trim() !== '');

    await handleSave(true);
    setSaving(true);
    try {
      await deliveryApi.updateStatus(id, 'arrived');
      toast.success('Marked Arrived! Items provisionally added to inventory.');
      
      const res = await deliveryApi.getById(id);
      const updatedDelivery = res.data;
      
      if (newItemsBeforeSave.length > 0 && updatedDelivery) {
         const newlyCreated = [];
         newItemsBeforeSave.forEach(oldItem => {
            const matchedNew = updatedDelivery.items.find(i => i.item_name === oldItem.item_name && i.product_id);
            if (matchedNew) {
               newlyCreated.push({
                  item_name: matchedNew.item_name,
                  product_id: matchedNew.product_id
               });
            }
         });
         
         if (newlyCreated.length > 0) {
             setNewlyCreatedItems(newlyCreated);
             const initialSel = {};
             newlyCreated.forEach(i => initialSel[i.product_id] = []);
             setSelectedListsForItem(initialSel);
             
             try {
                const listsRes = await productListApi.getAll();
                setInventoryLists(listsRes.data || []);
             } catch(e) {}
             
             setShowNewItemListsModal(true);
         }
      }
      
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const confirmDispatch = async () => {
    if (!selectedManager) {
      toast.error('Please select a manager to assign');
      return;
    }
    setShowDispatchModal(false);
    
    // Identify new items BEFORE saving
    const newItemsBeforeSave = items.filter(i => !i.product_id && i.item_name && i.item_name.trim() !== '');

    // We do NOT call handleSave here because dispatchWalkin will save the delivery items
    setSaving(true);
    try {
      const payload = {
        manager_id: selectedManager,
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
          margin: parseFloat(item.margin) || 0,
          final_price: parseFloat(item.final_price) || 0,
          final_stock: parseFloat(item.final_stock) || parseFloat(item.quantity) || 0,
          is_new_item: !item.product_id,
          supplier_name: item.supplier_name,
        }))
      };

      await deliveryApi.dispatchWalkin(id, payload);
      toast.success('Dispatched successfully to manager!');
      
      const res = await deliveryApi.getById(id);
      const updatedDelivery = res.data;
      
      if (newItemsBeforeSave.length > 0 && updatedDelivery) {
         const newlyCreated = [];
         newItemsBeforeSave.forEach(oldItem => {
            const matchedNew = updatedDelivery.items.find(i => i.item_name === oldItem.item_name && i.product_id);
            if (matchedNew) {
               newlyCreated.push({
                  item_name: matchedNew.item_name,
                  product_id: matchedNew.product_id
               });
            }
         });
         
         if (newlyCreated.length > 0) {
             setNewlyCreatedItems(newlyCreated);
             const initialSel = {};
             newlyCreated.forEach(i => initialSel[i.product_id] = []);
             setSelectedListsForItem(initialSel);
             
             try {
                const listsRes = await productListApi.getAll();
                setInventoryLists(listsRes.data || []);
             } catch(e) {}
             
             setShowNewItemListsModal(true);
         }
      }
      
      loadDelivery();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleSaveNewItemLists = async () => {
    setSavingLists(true);
    try {
      for (const item of newlyCreatedItems) {
        const listIds = selectedListsForItem[item.product_id] || [];
        for (const listId of listIds) {
          const list = inventoryLists.find(l => l._id === listId);
          if (list) {
            // Append product to this list
            const currentProducts = list.products ? list.products.map(p => typeof p === 'object' ? p._id : p) : [];
            if (!currentProducts.includes(item.product_id)) {
              currentProducts.push(item.product_id);
              await productListApi.update(listId, { products: currentProducts });
            }
          }
        }
      }
      toast.success('Items successfully added to selected lists!');
      setShowNewItemListsModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update lists');
    } finally {
      setSavingLists(false);
    }
  };

  const getLowStockColor = (stock, threshold = 10) => {
    if (stock === 0) return '#dc2626';
    if (stock <= threshold) return '#d97706';
    return '#059669';
  };

  const statusLabels = {
    pending: <><Clock size={12} /> <span>Pending</span></>, 
    on_the_way: <><Truck size={12} /> <span>On the Way</span></>,
    arriving_soon: <><AlertTriangle size={12} /> <span>Arriving Soon</span></>, 
    arrived: <><MapPin size={12} /> <span>Arrived</span></>, 
    delivered: <><CheckCircle size={12} /> <span>Delivered</span></>, 
    not_delivered: <><X size={12} /> <span>Not Delivered</span></>,
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
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '24px', gap: isMobile ? '16px' : '0' }} className="no-print">
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: isMobile ? '4px' : '0' }}
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
            <div className="page-subtitle" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                <User size={12} style={{ color: '#94a3b8' }}/> 
                <span>Driver: <strong style={{ color: '#334155' }}>{delivery.driver_name || 'Not Assigned'}</strong></span>
              </div>
              {delivery.supplier && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  <Building size={12} style={{ color: '#94a3b8' }}/> 
                  <span>Supplier: <strong style={{ color: '#334155' }}>{delivery.supplier}</strong></span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', color: '#334155', fontWeight: 600 }}>
                <Calendar size={12} style={{ color: '#94a3b8' }}/> 
                {delivery.status === 'delivered'
                  ? `Delivered: ${delivery.delivered_at_ist || delivery.expected_arrival_ist}`
                  : isArrived
                    ? `Arrived: ${delivery.arrived_at_ist || delivery.expected_arrival_ist}`
                    : `Expected: ${delivery.expected_arrival_ist}`
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: delivery.status === 'delivered' ? '#ecfdf5' : (delivery.status === 'pending' ? '#f8fafc' : '#fff7ed'), border: delivery.status === 'delivered' ? '1px solid #a7f3d0' : (delivery.status === 'pending' ? '1px solid #e2e8f0' : '1px solid #fed7aa'), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', color: delivery.status === 'delivered' ? '#065f46' : (delivery.status === 'pending' ? '#64748b' : '#9a3412'), fontWeight: 700 }}>
                {statusLabels[delivery.status]}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: isMobile ? '100%' : 'auto', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: isMobile ? '4px' : '0' }} className="hide-scrollbar">
          {!isLocked && (
            <>
              <button onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1, borderRadius: '8px', fontSize: '12px', fontWeight: 600, padding: '6px 10px', whiteSpace: 'nowrap', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s' }}>
                <Save size={13} /> {isMobile ? 'Save' : 'Save Changes'}
              </button>
              {!isArrived && (
                <button onClick={() => setShowArrivedModal(true)} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1.2, borderRadius: '8px', fontSize: '12px', fontWeight: 600, padding: '6px 10px', whiteSpace: 'nowrap', background: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <MapPin size={13} /> {isMobile ? 'Arrived' : 'Mark Arrived'}
                </button>
              )}
            </>
          )}
          {!isDelivered && isArrived && delivery.delivery_type !== 'walkin_delivery' && (
            <button onClick={() => {
              authApi.getVacantWalkinManagers().then(res => {
                setVacantManagers(res.managers || []);
                if (res.managers && res.managers.length > 0) setSelectedManager(res.managers[0]._id);
                setShowDispatchModal(true);
              }).catch(err => toast.error('Failed to load managers'));
            }} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1.2, borderRadius: '8px', fontSize: '12px', fontWeight: 600, padding: '6px 10px', whiteSpace: 'nowrap', background: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc', cursor: 'pointer', transition: 'all 0.2s' }}>
              <MapPin size={13} /> {isMobile ? 'Dispatch' : 'Dispatch Vehicle'}
            </button>
          )}
          {!isDelivered && (
            <button onClick={handleMarkDelivered} disabled={saving || !isArrived} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1.2, borderRadius: '8px', fontSize: '12px', fontWeight: 600, padding: '6px 10px', whiteSpace: 'nowrap', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', cursor: (!isArrived) ? 'not-allowed' : 'pointer', opacity: (!isArrived) ? 0.6 : 1, transition: 'all 0.2s' }}>
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
        <div style={{ background: '#eef2ff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '12px 18px', marginBottom: '20px', fontSize: '13.5px', color: '#3730a3', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} style={{ color: '#4f46e5', flexShrink: 0 }} />
          <span style={{ lineHeight: '1.5' }}>🚛 Vehicle arrived! Items provisionally in inventory. <strong style={{ color: '#312e81' }}>Edit prices, quantities, and charges below</strong> — finalize by clicking <strong style={{ color: '#312e81' }}>Mark Delivered</strong>.</span>
        </div>
      )}

      
      {/* Grouped by Supplier */}
      {[...new Set(items.map(i => i.supplier_name || delivery?.supplier || 'Unknown Supplier'))].map(supplierName => {
        const supplierItems = items.map((item, originalIndex) => ({ item, originalIndex }))
          .filter(x => (x.item.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName);
        
        if (supplierItems.length === 0) return null;
        
        const scValue = supplierInputCharges[supplierName] || '';
        const qcValue = supplierInputQuintals[supplierName] || '';
        const marginValue = supplierInputMargins[supplierName] || '';

        return (
          <div key={supplierName} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', gap: isMobile ? '12px' : '16px', marginBottom: '16px', background: '#f8fafc', padding: isMobile ? '12px' : '8px 12px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '6px', fontWeight: 800, fontSize: 13, alignSelf: isMobile ? 'flex-start' : 'auto' }}>
                <Package size={14} />
                <span>Items from {supplierName}</span>
              </div>

              {/* Supplier Charges inline */}
              {!isLocked && (
                <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: '8px', alignItems: isMobile ? 'flex-end' : 'center', width: isMobile ? '100%' : 'auto' }}>
                  
                  {/* Extra Charges */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '4px' : '6px', flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? 11 : 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      {!isMobile && <span style={{ fontSize: '13px' }}>🏭</span>} {isMobile ? 'Charges' : 'Charges (₹)'}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%' }}>
                      <input
                        type="number" min="0" step="0.01"
                        className="form-control"
                        style={{ width: isMobile ? '100%' : '80px', fontSize: 12, padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: !scValue ? '#f8fafc' : '#ffffff', transition: 'all 0.2s', boxSizing: 'border-box' }}
                        value={scValue}
                        placeholder={isMobile ? '₹' : 'Total ₹'}
                        onChange={e => {
                          const val = e.target.value;
                          setSupplierInputCharges(prev => ({ ...prev, [supplierName]: val }));
                          
                          setItems(prev => {
                            const currentSupplierItems = prev.map((item, originalIndex) => ({ item, originalIndex }))
                              .filter(x => (x.item.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName);
                            const validItems = currentSupplierItems.filter(x => x.item.item_name);
                            if (!validItems.length) return prev;

                            const totalQty = validItems.reduce((sum, x) => sum + (parseFloat(x.item.final_stock ?? x.item.quantity) || 1), 0);
                            const totalCharge = parseFloat(val) || 0;
                            const chargePerQty = totalCharge / totalQty;

                            return prev.map((item, idx) => {
                              const isThisSupplier = validItems.some(v => v.originalIndex === idx);
                              if (!isThisSupplier) return item;

                              const perUnitExtraCharge = chargePerQty;
                              const base = parseFloat(item.base_price) || 0;
                              const weight = parseFloat(item.weight) || 0;
                              const qc = parseFloat(item.quintal_charge) || 0;
                              const gst = parseFloat(item.gst) || 0;

                              const margin = parseFloat(item.margin) || 0;

                              let newFinal;
                              if (base > 0) {
                                const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                                const beforeGST = base + quintalAdj + perUnitExtraCharge;
                                const gstAmt = (beforeGST * gst) / 100;
                                const landedCost = parseFloat((beforeGST + gstAmt).toFixed(2));
                                newFinal = parseFloat((landedCost + margin).toFixed(2));
                              } else {
                                const existing = parseFloat(item.final_price) || 0;
                                newFinal = parseFloat((existing + perUnitExtraCharge).toFixed(2));
                              }

                              return {
                                ...item,
                                supplier_charge_per_item: parseFloat(perUnitExtraCharge.toFixed(4)),
                                final_price: newFinal,
                              };
                            });
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* Quintal Charge */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '4px' : '6px', flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? 11 : 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      {!isMobile && <span style={{ fontSize: '13px' }}>⚖️</span>} {isMobile ? 'Quintal' : 'Quintal (₹)'}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%' }}>
                      <input
                        type="number" min="0" step="0.01"
                        className="form-control"
                        style={{ width: isMobile ? '100%' : '70px', fontSize: 12, padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: !qcValue ? '#f8fafc' : '#ffffff', transition: 'all 0.2s', boxSizing: 'border-box' }}
                        value={qcValue}
                        placeholder={isMobile ? '₹' : '₹/100kg'}
                        onChange={e => {
                          const val = e.target.value;
                          setSupplierInputQuintals(prev => ({ ...prev, [supplierName]: val }));
                          
                          setItems(prev => {
                            const currentSupplierItems = prev.map((item, originalIndex) => ({ item, originalIndex }))
                              .filter(x => (x.item.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName);
                            
                            return prev.map((item, idx) => {
                              const isThisSupplier = currentSupplierItems.some(v => v.originalIndex === idx);
                              if (!isThisSupplier) return item;

                              const base = parseFloat(item.base_price) || 0;
                              const weight = parseFloat(item.weight) || 0;
                              const gst = parseFloat(item.gst) || 0;
                              const scPU = parseFloat(item.supplier_charge_per_item) || 0;
                              const margin = parseFloat(item.margin) || 0;
                              const qc = parseFloat(val) || 0;
                              const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                              const beforeGST = base + quintalAdj + scPU;
                              const gstAmt = (beforeGST * gst) / 100;
                              const landedCost = parseFloat((beforeGST + gstAmt).toFixed(2));
                              const finalPrice = base > 0
                                ? parseFloat((landedCost + margin).toFixed(2))
                                : item.final_price;
                              return { ...item, quintal_charge: String(qc), final_price: finalPrice || item.final_price };
                            });
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* Profit Margin % */}
                  {settings?.margin_enabled !== false && (
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '4px' : '6px', flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: isMobile ? 11 : 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        {!isMobile && <span style={{ fontSize: '13px' }}>📈</span>} {isMobile ? 'Margin' : 'Profit Margin'} {settings?.margin_type === 'percentage' ? '%' : '₹'}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%' }}>
                        <input
                          type="number" min="0" step="0.01"
                          className="form-control"
                          style={{ width: isMobile ? '100%' : '70px', fontSize: 12, padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: !marginValue ? '#f8fafc' : '#ffffff', transition: 'all 0.2s', boxSizing: 'border-box' }}
                          value={marginValue}
                          placeholder={isMobile ? '%' : 'e.g. 10'}
                          onChange={e => {
                            const val = e.target.value;
                            setSupplierInputMargins(prev => ({ ...prev, [supplierName]: val }));
                            
                            const marginPct = parseFloat(val) || 0;
                            setItems(prev => {
                              const currentSupplierItems = prev.map((item, originalIndex) => ({ item, originalIndex }))
                                .filter(x => (x.item.supplier_name || delivery?.supplier || 'Unknown Supplier') === supplierName);
                              
                              return prev.map((item, idx) => {
                                const isThisSupplier = currentSupplierItems.some(v => v.originalIndex === idx);
                                if (!isThisSupplier) return item;

                                const base = parseFloat(item.base_price) || 0;
                                const weight = parseFloat(item.weight) || 0;
                                const gst = parseFloat(item.gst) || 0;
                                const scPU = parseFloat(item.supplier_charge_per_item) || 0;
                                const qc = parseFloat(item.quintal_charge) || 0;
                                
                                if (base > 0) {
                                  const quintalAdj = qc > 0 && weight > 0 ? (qc * weight) / 100 : 0;
                                  const beforeGST = base + quintalAdj + scPU;
                                  const gstAmt = (beforeGST * gst) / 100;
                                  const landedCost = parseFloat((beforeGST + gstAmt).toFixed(2));
                                  
                                  const newMargin = marginPct > 0 ? parseFloat((landedCost * marginPct / 100).toFixed(2)) : 0;
                                  const finalPrice = parseFloat((landedCost + newMargin).toFixed(2));
                                  
                                  return { ...item, margin: String(newMargin), final_price: finalPrice };
                                }
                                return item;
                              });
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Item Details Table */}
            <div className="card" style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              <div className="card-body no-pad" style={{ background: 'var(--bg-card)' }}>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1.5px solid #e2e8f0' }}>
                        {[
                          'Item', 'Stock Update', 'Weight (kg)',
                          ...(user?.role === 'supervisor' ? ['Base Price ₹', 'Supplier Total ₹'] : []), 'Extra Charge ₹', 'Quintal Charge ₹', 'GST %', 
                          ...(settings?.margin_enabled !== false ? [`Margin ${settings?.margin_type === 'percentage' ? '%' : '₹'}`] : []), 
                          'Selling Price ₹'
                        ].map(h => (
                          <th key={h} style={{ padding: '8px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {supplierItems.map(({ item, originalIndex: idx }) => {
                        const expectedStock = (item.current_stock || 0) + (parseFloat(item.quantity) || 0);
                        const stockColor = getLowStockColor(item.current_stock || 0);

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', transition: 'all 0.2s', verticalAlign: 'top' }}>
                            {/* Item Name */}
                            <td style={{ padding: '8px 8px', minWidth: 110, fontFamily: "'Inter', sans-serif" }}>
                              <div style={{ fontWeight: 800, color: 'var(--text)' }}>{item.item_name}</div>
                              {!item.product_id && (
                                <span style={{ fontSize: 10, color: '#ca8a04', fontWeight: 700, marginTop: 4, display: 'inline-block' }}>
                                  New Item
                                </span>
                              )}
                            </td>

                            {/* Stock Update (Inline Equation) */}
                            <td style={{ padding: '8px 8px', minWidth: 180, fontFamily: "'Inter', sans-serif" }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                {/* Current Stock */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: stockColor, minWidth: 35, textAlign: 'center' }}>
                                      {item.current_stock != null ? item.current_stock : 0}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 700, textTransform: 'uppercase' }}>Current</span>
                                </div>
                                
                                <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ color: '#94a3b8', fontWeight: 700 }}>+</span>
                                </div>
                                
                                {/* Editable Incoming Qty (formerly final_stock) */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                                    {isLocked ? (
                                      <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: 50, textAlign: 'center' }}>
                                        {item.final_stock ?? item.quantity}
                                      </span>
                                    ) : (
                                      <input
                                        type="number" min="0" step="0.01"
                                        className="form-control"
                                        style={{ width: 60, height: '28px', fontSize: 13, borderRadius: 6, padding: '0 4px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)', border: '1px solid #cbd5e1' }}
                                        value={item.final_stock}
                                        onChange={e => updateItem(idx, 'final_stock', e.target.value)}
                                      />
                                    )}
                                  </div>
                                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 700, textTransform: 'uppercase' }}>Incoming</span>
                                </div>
                                
                                <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ color: '#94a3b8', fontWeight: 700 }}>=</span>
                                </div>
                                
                                {/* Final Stock Math */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ fontWeight: 800, color: '#334155', textAlign: 'center' }}>
                                        {((item.current_stock || 0) + (parseFloat(item.final_stock) || 0)).toFixed(0)}
                                      </span>
                                      {item.unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, paddingTop: 1 }}>{item.unit}</span>}
                                    </div>
                                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 700, textTransform: 'uppercase' }}>Final</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Weight */}
                            <td style={{ padding: '8px 8px', minWidth: 80, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span>{item.weight || '—'}</span>
                              ) : (
                                <input type="number" min="0" step="0.01" className="form-control"
                                  style={{ width: 65, fontSize: 12, borderRadius: 8, padding: '4px 6px' }}
                                  value={item.weight}
                                  placeholder="0"
                                  onChange={e => updateItem(idx, 'weight', e.target.value)} />
                            )}
                            </td>
                            {/* Base Price */}
                            {user?.role === 'supervisor' && (
                              <td style={{ padding: '8px 8px', minWidth: 80, fontFamily: "'Inter', sans-serif" }}>
                                {isLocked ? (
                                  <span>{item.base_price ? fc(item.base_price) : '—'}</span>
                                ) : (
                                  <input type="number" min="0" step="0.01" className="form-control"
                                    style={{ width: 70, fontSize: 12, borderRadius: 8, padding: '4px 6px' }}
                                    value={item.base_price}
                                    placeholder="0.00"
                                    onChange={e => updateItem(idx, 'base_price', e.target.value)} />
                                )}
                              </td>
                            )}
                            {/* Supplier Total */}
                            {user?.role === 'supervisor' && (
                              <td style={{ padding: '8px 8px', minWidth: 80, fontFamily: "'Inter', sans-serif" }}>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>{((parseFloat(item.final_stock ?? item.quantity) || 0) * (parseFloat(item.base_price) || 0)).toFixed(2)}</span>
                              </td>
                            )}
                            {/* Extra Charge per unit */}
                            <td style={{ padding: '8px 8px', minWidth: 85, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span>{item.supplier_charge_per_item ? fc(item.supplier_charge_per_item) : '—'}</span>
                              ) : (
                                <input type="number" min="0" step="0.01" className="form-control"
                                  style={{ width: 70, fontSize: 12, borderRadius: 8, padding: '4px 6px' }}
                                  value={item.supplier_charge_per_item || ''}
                                  placeholder="per unit"
                                  onChange={e => updateItem(idx, 'supplier_charge_per_item', e.target.value)} />
                              )}
                            </td>
                            {/* Quintal Charge */}
                            <td style={{ padding: '8px 8px', minWidth: 85, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span>{item.quintal_charge && item.weight ? fc((parseFloat(item.quintal_charge) * parseFloat(item.weight)) / 100) : '—'}</span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input type="number" min="0" step="0.01" className="form-control"
                                    style={{ width: 65, fontSize: 12, borderRadius: 8, padding: '4px 6px' }}
                                    value={item.quintal_charge && item.weight ? ((parseFloat(item.quintal_charge) * parseFloat(item.weight)) / 100).toFixed(2) : ''}
                                    placeholder="Total ₹"
                                    onChange={e => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const weight = parseFloat(item.weight) || 0;
                                      const newRate = weight > 0 ? (val * 100) / weight : 0;
                                      updateItem(idx, 'quintal_charge', newRate);
                                    }} />
                                </div>
                              )}
                            </td>
                            {/* GST */}
                            <td style={{ padding: '8px 8px', minWidth: 60, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span>{item.gst}%</span>
                              ) : (
                                <select className="form-control" style={{ 
                                  width: 65, 
                                  fontSize: 13,
                                  fontWeight: 600,
                                  borderRadius: 8, 
                                  padding: '4px 20px 4px 8px',
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 4px center',
                                  backgroundSize: '16px 16px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  transition: 'border-color 0.2s, box-shadow 0.2s'
                                }}
                                  value={item.gst}
                                  onChange={e => updateItem(idx, 'gst', e.target.value)}>
                                  {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                                </select>
                              )}
                            </td>
                            {/* Margin ₹ */}
                            {settings?.margin_enabled !== false && (
                              <td style={{ padding: '8px 8px', minWidth: 80, fontFamily: "'Inter', sans-serif" }}>
                                {isLocked ? (
                                  <span style={{ fontWeight: 600, color: '#10b981' }}>{item.margin ? fc(item.margin) : '—'}</span>
                                ) : (
                                  <div>
                                    <input type="number" min="0" step="0.01" className="form-control"
                                      style={{ width: 70, fontSize: 12, borderRadius: 8, padding: '4px 6px', border: '1px solid #a7f3d0', background: '#f0fdf4' }}
                                      value={item.margin || ''}
                                      placeholder={`margin ${settings?.margin_type === 'percentage' ? '%' : '₹'}`}
                                      onChange={e => updateItem(idx, 'margin', e.target.value)} />
                                  </div>
                                )}
                              </td>
                            )}
                            {/* Final Price */}
                            <td style={{ padding: '8px 8px', minWidth: 85, fontFamily: "'Inter', sans-serif" }}>
                              {isLocked ? (
                                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                                  {item.final_price ? fc(item.final_price) : '—'}
                                </span>
                              ) : (
                                <div>
                                  <input type="number" min="0" step="0.01" className="form-control"
                                    style={{ width: 75, fontSize: 12, borderRadius: 8, fontWeight: 700, padding: '4px 6px' }}
                                    value={item.final_price}
                                    placeholder="Auto"
                                    onChange={e => updateItem(idx, 'final_price', e.target.value)} />
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

      {/* Global Discrepancy Notes Section */}
      {(() => {
        const hasDiscrepancy = items.some(item => parseFloat(item.final_stock) !== parseFloat(item.quantity));
        if (!hasDiscrepancy) return null;

        const getItemCharges = (item, qty) => {
          const base = parseFloat(item.base_price) || 0;
          const sup = parseFloat(item.supplier_charge_per_item) || 0;
          const quin = parseFloat(item.quintal_charge) || 0;
          const wt = parseFloat(item.weight) || 0;
          const chargePerUnit = sup + ((quin * wt) / 100);
          return {
            baseTotal: base * qty,
            chargeTotal: chargePerUnit * qty,
            grandTotal: (base * qty) + (chargePerUnit * qty)
          };
        };

        let origOverall = 0;
        let updOverall = 0;
        
        items.forEach(item => {
          const orig = getItemCharges(item, parseFloat(item.quantity) || 0);
          const upd = getItemCharges(item, parseFloat(item.final_stock ?? item.quantity) || 0);
          origOverall += orig.grandTotal;
          updOverall += upd.grandTotal;
        });

        return (
          <div style={{ marginTop: 16, padding: '16px 20px', background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />
              Quantity Adjustments Summary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items
                .filter(item => parseFloat(item.final_stock) !== parseFloat(item.quantity))
                .map((item, idx) => {
                  const origQty = parseFloat(item.quantity) || 0;
                  const updQty = parseFloat(item.final_stock) || 0;
                  const orig = getItemCharges(item, origQty);
                  const upd = getItemCharges(item, updQty);
                  const chargeDiff = upd.chargeTotal - orig.chargeTotal;
                  
                  return (
                    <div key={idx} style={{ fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }}></div>
                      <span><strong>{item.item_name}</strong> {item.supplier_name ? <span style={{ color: '#b45309' }}>({item.supplier_name})</span> : ''}: Incoming qty changed from <strong>{origQty}</strong> to <strong>{updQty}</strong>. 
                      {item.base_price > 0 && <span> (New Supplier Total: <strong>{fc(upd.baseTotal)}</strong>)</span>}
                      {(orig.chargeTotal > 0 || upd.chargeTotal > 0) && chargeDiff < 0 && (
                        <span>
                           {' • Extra charges decreased by '} 
                           <strong>{fc(Math.abs(chargeDiff))}</strong> 
                           {' '}(New Charges: <strong>{fc(upd.chargeTotal)}</strong>)
                        </span>
                      )}
                      </span>
                    </div>
                  );
              })}
            </div>
            {origOverall > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #fcd34d', display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                <span>Total was: <span style={{ fontWeight: 800 }}>{fc(origOverall)}</span></span>
                <span style={{ color: '#b45309' }}>Updated Grand Total (including charges): <span style={{ fontWeight: 800 }}>{fc(updOverall)}</span></span>
              </div>
            )}
          </div>
        );
      })()}



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
              <span style={{ color: '#059669' }}>✅ You can still edit item prices &amp; quantities until you click <strong>Mark Delivered</strong> or <strong>Dispatch Vehicle</strong>.</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => {
                setShowArrivedModal(false);
                authApi.getVacantWalkinManagers().then(res => {
                  setVacantManagers(res.managers || []);
                  if (res.managers && res.managers.length > 0) setSelectedManager(res.managers[0]._id);
                  setShowDispatchModal(true);
                }).catch(err => toast.error('Failed to load managers'));
              }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={14} /> Dispatch Vehicle
              </button>
              <button className="btn btn-primary" onClick={confirmArrived} style={{ background: '#4338ca', color: '#fff', border: 'none' }}>Yes, Mark Arrived</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => setShowArrivedModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Assignment Modal */}
      {showDispatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, color: 'var(--text)' }}>New Dispatch Assignment</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Are you sure you want to dispatch this vehicle?<br/>
              <strong>Prices updated in the main table will be assigned.</strong>
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Assign Walk-in Manager</label>
              <select className="form-control" value={selectedManager} onChange={e => setSelectedManager(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <option value="" disabled>Select a vacant manager</option>
                {vacantManagers.map(m => (
                  <option key={m._id} value={m._id}>{m.display_name || m.username}</option>
                ))}
              </select>
              {vacantManagers.length === 0 && <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>No vacant managers found.</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowDispatchModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmDispatch} disabled={!selectedManager} style={{ background: '#4338ca', color: '#fff', border: 'none', opacity: selectedManager ? 1 : 0.6 }}>Confirm Dispatch</button>
            </div>
          </div>
        </div>
      )}

      {/* New Item Lists Selection Modal */}
      {showNewItemListsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px 32px', borderRadius: 20, width: '90%', maxWidth: 500, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, color: '#1e293b' }}>New Items Detected!</h3>
              <button onClick={() => setShowNewItemListsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              You have added new items that aren't in any inventory list yet. Select which lists (including manager lists) these items should be added to so they can access them.
            </p>
            
            <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 8, marginBottom: 24 }}>
              {newlyCreatedItems.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 12, fontSize: 16 }}>
                    📦 {item.item_name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {inventoryLists.length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>No lists available</span>
                    ) : (
                      inventoryLists.map(list => (
                        <label key={list._id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#334155' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedListsForItem[item.product_id]?.includes(list._id) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedListsForItem(prev => {
                                const current = prev[item.product_id] || [];
                                return {
                                  ...prev,
                                  [item.product_id]: checked ? [...current, list._id] : current.filter(id => id !== list._id)
                                };
                              });
                            }}
                            style={{ width: 16, height: 16, accentColor: '#4f46e5', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 500 }}>{list.name}</span>
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>
                            (Shared with: {list.shared_with?.length || 0} users)
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowNewItemListsModal(false)}>Skip for now</button>
              <button className="btn btn-primary" onClick={handleSaveNewItemLists} disabled={savingLists} style={{ background: '#4f46e5', color: '#fff', border: 'none', minWidth: 120 }}>
                {savingLists ? 'Saving...' : 'Add to Lists'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}