import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { deliveryApi, settlementApi, productApi } from '../utils/api';
import { UserCheck, X, Trash2, CheckCircle, AlertTriangle, Wallet, Smartphone, Globe, CreditCard, BarChart2, Scale, Save, FolderOpen } from 'lucide-react';

const QTY_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'bag', 'box', 'dozen', 'quintal', 'ton', 'mtr', 'other'];

export default function RecordSupplierEntryModal({ supplier, onClose, onSuccess }) {
  const { user } = useAuth();
  const { t, fc, settings } = useApp();
  const [saving, setSaving] = useState(false);
  const [submitAction, setSubmitAction] = useState('save');
  const DRAFT_KEY = 'supplier_entry_draft_' + (supplier?._id || 'new');

  const [customQuintalCharge, setCustomQuintalCharge] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved)._customQuintalCharge || '';
    } catch(e) {}
    return '';
  });
  
  const [customGrandTotal, setCustomGrandTotal] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved)._customGrandTotal || '';
    } catch(e) {}
    return '';
  });
  const [tempCustomQuintal, setTempCustomQuintal] = useState('');

  React.useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalBodyOverflow; };
  }, []);

  const [showDraftsMenu, setShowDraftsMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [savedDraftsList, setSavedDraftsList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('supplier_saved_drafts') || '[]'); } catch(e){ return []; }
  });

  const handleSaveDraft = () => {
    let name = supplier?.name || 'Supplier Draft';
    if (form.vehicle_number) {
      name += ` - ${form.vehicle_number}`;
    }
    const newDrafts = [...savedDraftsList, { id: Date.now(), name, date: new Date().toLocaleString(), supplierId: supplier?._id, form, customQuintalCharge, customGrandTotal }];
    setSavedDraftsList(newDrafts);
    localStorage.setItem('supplier_saved_drafts', JSON.stringify(newDrafts));
    toast.success('Draft saved successfully!');
  };

  const handleLoadDraft = (draft) => {
    setForm(draft.form);
    setCustomQuintalCharge(draft.customQuintalCharge || '');
    setCustomGrandTotal(draft.customGrandTotal || '');
    setShowDraftsMenu(false);
    toast.success(`Loaded draft: ${draft.name}`);
  };

  const handleDeleteDraft = (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved draft?')) return;
    const newDrafts = savedDraftsList.filter(d => d.id !== id);
    setSavedDraftsList(newDrafts);
    localStorage.setItem('supplier_saved_drafts', JSON.stringify(newDrafts));
  };

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return {
      expected_arrival: now.toISOString().slice(0, 16),
      vehicle_number: '',
      notes: '',
      payments: [{ amount: '', mode: 'cash' }],
      items: [{ item_name: '', quantity: '1', unit: '', weight: '', base_price: '', final_price: '', margin: '', sell_price: '' }],
      settle_fully: false,
      global_extra_charge: '',
      global_quintal_charge: '',
      global_profit_percent: '',
    };
  });

  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSuggestIdx, setProductSuggestIdx] = useState(null);

  React.useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, _customQuintalCharge: customQuintalCharge, _customGrandTotal: customGrandTotal }));
  }, [form, customQuintalCharge, customGrandTotal, DRAFT_KEY]);

  const searchProducts = (q) => {
    if (!q.trim()) { setProductSuggestions([]); return; }
    productApi.getAll({ search: q })
      .then(setProductSuggestions)
      .catch(() => {});
  };

  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: value };
    // Auto-add new row if we're typing the item_name of the last row
    if (field === 'item_name' && value && idx === items.length - 1) {
      items.push({ item_name: '', quantity: '0', unit: '', weight: '', base_price: '', final_price: '', margin: '', sell_price: '' });
    }
    return { ...f, items };
  });

  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const getWeightInKg = (unit, manualWeight) => {
    if (manualWeight && parseFloat(manualWeight) > 0) return parseFloat(manualWeight);
    const u = (unit || '').toLowerCase();
    if (u === 'kg') return 1;
    if (u === 'quintal') return 100;
    if (u === 'ton') return 1000;
    if (u === 'g') return 0.001;
    return 0;
  };

  React.useEffect(() => {
    setForm(f => {
      const extraChg = parseFloat(f.global_extra_charge) || 0;
      const qChg = parseFloat(f.global_quintal_charge) || 0;
      const profitPct = parseFloat(f.global_profit_percent) || 0;
      const validItems = f.items.filter(i => parseFloat(i.quantity) > 0 && i.item_name.trim());
      const validItemsCount = validItems.length || 1;
      let hasChanges = false;
      
      const newItems = f.items.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const base = parseFloat(item.base_price) || 0;
        
        if (qty > 0 && item.item_name.trim()) {
          const supplierChargePerItem = extraChg / validItemsCount / qty;
          const weight = getWeightInKg(item.unit, item.weight);
          const quintalAdj = qChg > 0 && weight > 0 ? (qChg * weight) / 100 : 0;
          const landedCost = parseFloat((base + supplierChargePerItem + quintalAdj).toFixed(2));
          
          if (base > 0 || supplierChargePerItem > 0 || quintalAdj > 0) {
             let newMargin = parseFloat(item.margin) || 0;
             let newSell = parseFloat(item.sell_price) || 0;
             
             if (profitPct > 0 && !item._manualSell) {
               if (settings?.margin_type === 'percentage') {
                 newMargin = parseFloat((landedCost * profitPct / 100).toFixed(2));
               } else {
                 newMargin = profitPct;
               }
               newSell = parseFloat((landedCost + newMargin).toFixed(2));
             } else if (item._manualSell) {
               // Reverse-calc margin from manually entered sell price
               newMargin = parseFloat((newSell - landedCost).toFixed(2));
             } else if (newSell > 0) {
               newMargin = parseFloat((newSell - landedCost).toFixed(2));
             } else if (!item._manualSell) {
               newSell = landedCost;
               newMargin = 0;
             }
             
             const changed = parseFloat(item.final_price || 0) !== landedCost ||
                             parseFloat(item.margin || 0) !== newMargin ||
                             parseFloat(item.sell_price || 0) !== newSell;
             if (changed) {
               hasChanges = true;
               return { ...item, final_price: String(landedCost), margin: newMargin ? String(newMargin) : '', sell_price: newSell ? String(newSell) : '' };
             }
          }
        }
        return item;
      });
      
      if (hasChanges) {
        setCustomGrandTotal('');
        setCustomQuintalCharge('');
        
        let n = f.notes || '';
        n = n.replace(/Quintal charge changed from [^|]*\|?/g, '').trim();
        n = n.replace(/Grand total changed from [^|]*\|?/g, '').trim();
        n = n.replace(/Quintal charge edited\|?/g, '').trim();
        n = n.replace(/Grand total edited\|?/g, '').trim();
        if (n.endsWith('|')) n = n.slice(0, -1).trim();
        
        return { ...f, items: newItems, notes: n };
      }
      return f;
    });
  }, [form.global_extra_charge, form.global_quintal_charge, form.global_profit_percent, JSON.stringify(form.items.map(i => ({ q: i.quantity, u: i.unit, w: i.weight, b: i.base_price, s: i.sell_price })))]);

  const updateSellPrice = (idx, value) => setForm(f => {
    const items = [...f.items];
    const item = items[idx];
    const landedCost = parseFloat(item.final_price) || 0;
    const sell = value === '' ? NaN : parseFloat(value);
    const margin = !isNaN(sell) ? parseFloat((sell - landedCost).toFixed(2)) : '';
    items[idx] = { ...item, sell_price: value, margin: margin !== '' ? String(margin) : '', _manualSell: true };
    return { ...f, items };
  });

  const updateMargin = (idx, value) => setForm(f => {
    const items = [...f.items];
    const item = items[idx];
    const landedCost = parseFloat(item.final_price) || 0;
    const margin = value === '' ? NaN : parseFloat(value);
    const sell = !isNaN(margin) ? parseFloat((landedCost + margin).toFixed(2)) : '';
    items[idx] = { ...item, margin: value, sell_price: sell !== '' ? String(sell) : '', _manualSell: false };
    return { ...f, items };
  });

  const totalBase = form.items.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0);
  const totalLandedCost = form.items.reduce((s, i) => s + ((parseFloat(i.final_price) || parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0);
  const totalSelling = form.items.reduce((s, i) => s + ((parseFloat(i.sell_price) || parseFloat(i.final_price) || parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0);
  
  const totalWeightQuintals = form.items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    if (qty <= 0) return sum;
    const weight = getWeightInKg(item.unit, item.weight);
    return sum + (weight > 0 ? (weight * qty) / 100 : 0);
  }, 0);
  
  const totalQuintalCharge = totalWeightQuintals * (parseFloat(form.global_quintal_charge) || 0);

  const effectiveQuintalCharge = customQuintalCharge !== '' ? parseFloat(customQuintalCharge) : totalQuintalCharge;
  const effectiveLandedCost = totalLandedCost - totalQuintalCharge + effectiveQuintalCharge;
  const totalFinal = effectiveLandedCost;
  const totalProfit = totalSelling - effectiveLandedCost;
  const effectiveGrandTotal = customGrandTotal !== '' ? parseFloat(customGrandTotal) : totalFinal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplier || !supplier.name) return toast.error('Supplier missing');
    if ((supplier?.name || '').trim().toLowerCase() === 'btc' && !(form.vehicle_number || '').trim()) return toast.error('Vehicle Number is mandatory for BTC');
    if (!form.expected_arrival) return toast.error('Arrival date/time is required');
    
    const validItems = form.items.filter(i => i.item_name.trim() && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) return toast.error('Please add at least one valid item');

    setSaving(true);
    try {
      const invoiceTotal = effectiveGrandTotal;
      const totalPaid = form.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      const newDelivery = await deliveryApi.create({
        vehicle_number: form.vehicle_number?.trim() || 'WALK-IN',
        supplier: supplier.name,
        driver_name: '',
        expected_arrival: new Date(form.expected_arrival).toISOString(),
        items: validItems.map(i => ({
          item_name: i.item_name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit || 'pcs',
          base_price: i.base_price ? parseFloat(i.base_price) : 0,
          final_price: i.final_price ? parseFloat(i.final_price) : 0,
          supplier_charge_per_item: (parseFloat(form.global_extra_charge) || 0) > 0 
            ? parseFloat(((parseFloat(form.global_extra_charge) / validItems.length) / (parseFloat(i.quantity) || 1)).toFixed(4))
            : 0,
          quintal_charge: parseFloat(form.global_quintal_charge) || 0,
          weight: getWeightInKg(i.unit, i.weight),
          sell_price: parseFloat(i.sell_price) || 0,
          margin: parseFloat(i.margin) || 0,
        })),
        notes: form.notes,
        payment_status: ((form.settle_fully && totalPaid > 0) || totalPaid >= invoiceTotal) ? 'paid' : 'unpaid',
        amount_paid: totalPaid,
        delivery_type: 'walkin_delivery',
        grand_total: effectiveGrandTotal
      });

      for (const p of form.payments) {
        const amt = parseFloat(p.amount) || 0;
        if (amt > 0) {
          if (!p.mode) return toast.error("Please select a payment mode for the amount: " + amt);
          await settlementApi.create({
            type: 'paid_to_supplier',
            party_name: supplier.name,
            amount: amt,
            mode: p.mode,
            notes: 'Supplier entry payment (Recorded)',
          });
        }
      }

      if (form.settle_fully && totalPaid > 0 && invoiceTotal > totalPaid) {
        await settlementApi.create({
          type: 'paid_to_supplier',
          party_name: supplier.name,
          amount: invoiceTotal - totalPaid,
          mode: 'discount',
          notes: 'Negotiation Discount for Record Entry',
        });
      }

      await deliveryApi.updateStatus(newDelivery._id, 'delivered');

      localStorage.removeItem(DRAFT_KEY);
      toast.success('Entry recorded successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to record entry');
    } finally {
      setSaving(false);
    }
  };


  const maxItemNameLen = Math.max(16, ...form.items.map(i => (i.item_name || '').length));
  const nameColWidth = `${maxItemNameLen + 5}ch`;

  const formatNum = (num) => {
    if (num === null || num === undefined) return '0';
    let formatted = fc ? fc(Math.abs(num)) : Math.abs(num).toFixed(2);
    formatted = formatted.replace(/[^\d.,]/g, '').trim();
    if (formatted.endsWith('.00')) {
      formatted = formatted.slice(0, -3);
    }
    return formatted;
  };

  const getDisplayVal = (val) => {
    if (val === '') return '';
    const num = Number(val);
    if (isNaN(num)) return val;
    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 850, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 32px)' }}>
        
        {/* Header */}
        <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ width: 48, height: 48, background: '#e0f2fe', color: '#0284c7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 4px 6px -1px rgba(2,132,199,0.1)' }}>
              <PackagePlus size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Record Entry</h3>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
              Entry for {supplier?.name}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <form id="entryForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier / Party Name</label>
                <input type="text" className="form-control" value={supplier?.name || ''} disabled style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, background: '#f8fafc', color: '#64748b', fontWeight: 600 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle Number</label>
                <input type="text" className="form-control" value={form.vehicle_number || ''} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))} placeholder="Vehicle No. (Mandatory for BTC)" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12.5, fontWeight: 500, textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date & Time *</label>
                <input type="datetime-local" className="form-control" value={form.expected_arrival} onChange={e => setForm(f => ({ ...f, expected_arrival: e.target.value }))} required style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <BarChart2 size={16} style={{ color: '#64748b' }} /> Extra Charges (₹)
                </label>
                <input type="number" min="0" step="0.01" className="form-control" value={form.global_extra_charge} onChange={e => setForm(f => ({ ...f, global_extra_charge: e.target.value }))} placeholder="e.g. 1000" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Scale size={16} style={{ color: '#64748b' }} /> Quintal Charge (₹)
                </label>
                <input type="number" min="0" step="0.01" className="form-control" value={form.global_quintal_charge} onChange={e => { setForm(f => ({ ...f, global_quintal_charge: e.target.value })); setCustomQuintalCharge(''); }} placeholder="e.g. 50" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14 }} />
                {totalWeightQuintals > 0 && (
                  <div style={{ fontSize: 13, color: '#ef4444', marginTop: 8, fontWeight: 700, letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ whiteSpace: 'nowrap' }}>+₹</span>
                    <input 
                        className="summary-input"
                        type="number" 
                        min="0"
                        step="0.01"
                        value={tempCustomQuintal !== '' ? tempCustomQuintal : (customQuintalCharge !== '' ? customQuintalCharge : (totalQuintalCharge ? getDisplayVal(totalQuintalCharge) : ''))}
                        onChange={e => {
                          setTempCustomQuintal(e.target.value);
                          setCustomQuintalCharge(e.target.value);
                          setCustomGrandTotal('');
                        }}
                        onBlur={() => setTempCustomQuintal('')}
                        placeholder="0"
                        title="Type total to override applied charge"
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', fontWeight: 700, width: `${Math.max(1, String(tempCustomQuintal !== '' ? tempCustomQuintal : (customQuintalCharge !== '' ? customQuintalCharge : getDisplayVal(totalQuintalCharge))).length) + 0.5}ch`, outline: 'none', padding: 0, fontSize: 13, textAlign: 'left' }}
                      />
                    <span style={{ whiteSpace: 'nowrap', marginLeft: 4, fontSize: 13, color: '#f87171', fontWeight: 600 }}>
                      {totalWeightQuintals > 0 && `(${Number((parseFloat(tempCustomQuintal !== '' ? tempCustomQuintal : (customQuintalCharge !== '' ? customQuintalCharge : totalQuintalCharge)) / totalWeightQuintals).toFixed(2))}/qtl)`}
                    </span>
                  </div>
                )}
              </div>
              {settings?.margin_enabled !== false && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📈 Profit Margin {settings?.margin_type === 'percentage' ? '%' : '₹'}
                  </label>
                  <input type="number" min="0" step="0.1" className="form-control" value={form.global_profit_percent} onChange={e => setForm(f => ({ ...f, global_profit_percent: e.target.value, items: f.items.map(i => ({ ...i, _manualSell: false })) }))} placeholder="e.g. 10" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
              )}
            </div>
<div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order Items *</label>
              <datalist id="unit-options-entry">
                {QTY_UNITS.map(u => <option key={u} value={u} />)}
              </datalist>
              <div className="hide-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
                {form.items.map((item, idx) => {
                  const cols = [`minmax(${nameColWidth}, 1.8fr)`, 'minmax(110px, 1fr)'];
                  if (parseFloat(form.global_quintal_charge) > 0) cols.push('minmax(80px, 0.8fr)');
                  cols.push('minmax(80px, 0.8fr)', 'minmax(80px, 0.8fr)');
                  if (settings?.margin_enabled !== false) cols.push('minmax(90px, 1fr)');
                  cols.push('minmax(80px, 1fr)', '32px');
                  const gridCols = cols.join(' ');

                  return (
                  <div key={idx} style={{ minWidth: parseFloat(form.global_quintal_charge) > 0 ? 750 : 670, display: 'grid', gridTemplateColumns: gridCols, gap: 10, alignItems: 'center' }}>
                    
                    <div style={{ position: 'relative' }}>
                      {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Item Name *</div>}
                      <input className="form-control" placeholder="Type to search..." 
                        value={item.item_name}
                        onChange={e => {
                          const val = e.target.value;
                          updateItem(idx, 'item_name', val);
                          if (val && item.quantity === '0') updateItem(idx, 'quantity', '1');
                          setProductSuggestIdx(idx);
                          searchProducts(val);
                        }}
                        onBlur={() => setTimeout(() => { 
                          const match = productSuggestions.find(p => p.name.toLowerCase() === item.item_name.trim().toLowerCase());
                          if (match) {
                            setForm(f => {
                              const newItems = [...f.items];
                              if (!newItems[idx].base_price && (match.suggested_price || match.price || match.supplier_base_price)) {
                                newItems[idx].base_price = String(match.suggested_price || match.price || match.supplier_base_price);
                              }
                              if (!newItems[idx].sell_price && (match.suggested_price || match.price)) {
                                newItems[idx].sell_price = String(match.suggested_price || match.price);
                                newItems[idx]._manualSell = true;
                              }
                              if (match.unit) newItems[idx].unit = match.unit;
                              if (match.weight_per_unit) newItems[idx].weight = String(match.weight_per_unit);
                              return { ...f, items: newItems };
                            });
                          }
                          setProductSuggestions([]); 
                          setProductSuggestIdx(null); 
                        }, 200)}
                        style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }} 
                      />
                      {productSuggestIdx === idx && item.item_name.trim() && productSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                          {productSuggestions.map(p => (
                            <div key={p._id}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}
                              onMouseDown={() => {
                                setForm(f => {
                                  const items = [...f.items];
                                  const sell = p.suggested_price || p.price;
                                  items[idx] = { ...items[idx], item_name: p.name, quantity: '1', unit: p.unit || '', weight: p.weight_per_unit ? String(p.weight_per_unit) : '', base_price: sell ? String(sell) : (p.supplier_base_price || ''), final_price: '', margin: '', sell_price: sell ? String(sell) : '', _manualSell: !!sell };
                                  if (idx === items.length - 1) {
                                    items.push({ item_name: '', quantity: '0', unit: '', weight: '', base_price: '', final_price: '', margin: '', sell_price: '' });
                                  }
                                  return { ...f, items };
                                });
                                setProductSuggestions([]); setProductSuggestIdx(null);
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <div style={{ fontWeight: 600, color: '#334155' }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Stock: {p.stock} {p.unit} · Sell: ₹{p.price}</div>
                              </div>
                            </div>
                          ))}
                          <div
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#0284c7', fontWeight: 600, background: '#f0f9ff' }}
                            onMouseDown={() => { setProductSuggestions([]); setProductSuggestIdx(null); }}
                          >
                            + Use "{item.item_name}" as new item
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Qty & Unit</div>}
                      <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ fontSize: 13, padding: '6px 0px 6px 6px', border: 'none', borderRight: '1px solid #cbd5e1', width: '50%', background: 'transparent', minWidth: 0, boxShadow: 'none', outline: 'none' }} />
                        <input className="form-control" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} list="unit-options-entry" style={{ fontSize: 13, padding: '6px 6px 6px 4px', border: 'none', width: '50%', background: 'transparent', minWidth: 0, boxShadow: 'none', outline: 'none' }} placeholder="unit" />
                      </div>
                    </div>

                    {parseFloat(form.global_quintal_charge) > 0 && (
                      <div>
                        {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Weight (kg)</div>}
                        <input className="form-control" type="number" min="0" step="0.01" value={item.weight} onChange={e => updateItem(idx, 'weight', e.target.value)} placeholder="0" style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }} />
                      </div>
                    )}

                    <div>
                      {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }} title="Supplier Price">Supp. ₹</div>}
                      <input className="form-control" type="number" min="0" step="0.01" value={item.base_price} onChange={e => updateItem(idx, 'base_price', e.target.value)} placeholder="0.00" style={{ fontSize: 13, borderRadius: 6, padding: '6px 6px', border: '1px solid #cbd5e1' }} />
                    </div>

                    {/* Landed Cost (auto-calculated, read-only style) */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }} title="Landed Cost">Cost ₹</div>}
                      <div style={{ fontSize: 13, padding: '6px 6px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', color: '#64748b', fontWeight: 600, minHeight: 30, display: 'flex', alignItems: 'center' }}>{item.final_price || '0.00'}</div>
                    </div>

                    {/* Margin (per item) */}
                    {settings?.margin_enabled !== false && (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 6 }}>Margin {settings?.margin_type === 'percentage' ? '%' : '₹'}</div>}
                          <input className="form-control" type="number" step="0.01" value={item.margin} onChange={e => updateMargin(idx, e.target.value)} placeholder="0" style={{ fontSize: 13, borderRadius: 6, padding: '6px 6px', border: '1px solid #a7f3d0', background: '#f0fdf4' }} />
                        </div>
                      </div>
                    )}

                    {/* Sell Price (editable) */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }} title="Selling Price">Sell ₹</div>}
                      <input className="form-control" type="number" step="0.01" value={item.sell_price} onChange={e => updateSellPrice(idx, e.target.value)} placeholder="0.00" style={{ fontSize: 13, borderRadius: 6, padding: '6px 6px', border: '1px solid #93c5fd', background: '#eff6ff', fontWeight: 600 }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {idx === 0 && <div style={{ fontSize: 11, height: 16, marginBottom: 6 }}>&nbsp;</div>}
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}><Trash2 size={16} /></button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Notes Section */}
            <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span></label>
              <input type="text" className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any remarks..." style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14 }} />
            </div>

            {/* 2-Column Bottom Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginTop: 16, alignItems: 'start' }}>
              
              {/* Left Column: Payments */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Payments Section */}
                <div style={{ background: '#f8fafc', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Wallet size={18} style={{ color: '#10b981' }} />
                      Payment Details
                    </h4>
                    <button 
                      type="button"
                      onClick={() => setForm(f => ({ ...f, payments: [...f.payments, { mode: 'cash', amount: '' }] }))}
                      style={{ background: 'white', border: '1px solid #e2e8f0', padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#475569', borderRadius: 8, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      + Add Mode
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {form.payments.map((p, idx) => (
                      <div key={idx} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, position: 'relative' }}>
                        {idx > 0 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newP = form.payments.filter((_, i) => i !== idx);
                              setForm(f => ({ ...f, payments: newP }));
                            }}
                            style={{ position: 'absolute', top: -10, right: -10, width: 24, height: 24, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                        
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8, display: 'block', letterSpacing: '0.5px' }}>Payment Mode</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {['cash', 'upi', 'online', 'bank_transfer', 'others'].map(mode => (
                              <div 
                                key={mode} 
                                onClick={() => {
                                  const newP = [...form.payments];
                                  newP[idx].mode = mode;
                                  setForm(f => ({ ...f, payments: newP }));
                                }}
                                style={{ 
                                  padding: '10px 8px', border: `2px solid ${p.mode === mode ? '#ef4444' : '#e2e8f0'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontWeight: 600, fontSize: 13, color: p.mode === mode ? '#ef4444' : '#64748b', background: p.mode === mode ? '#fef2f2' : 'white', transition: 'all 0.2s' 
                                }}
                              >
                                {mode.toUpperCase().replace('_', ' ')}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8, display: 'block', letterSpacing: '0.5px' }}>Paid Amount ₹</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#ef4444', fontWeight: 600 }}>₹</span>
                            <input 
                              type="number" 
                              placeholder="0.00" 
                              value={p.amount}
                              onChange={e => {
                                const newP = [...form.payments];
                                newP[idx].amount = e.target.value;
                                setForm(f => ({ ...f, payments: newP }));
                              }}
                              style={{ width: '100%', padding: '14px 14px 14px 40px', fontSize: 20, fontWeight: 800, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none', color: '#0f172a', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            />
                            {idx === 0 && (
                              <button 
                                type="button" 
                                onClick={() => {
                                  const newP = [...form.payments];
                                  const currentOtherPaid = newP.filter((_, i) => i !== 0).reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0);
                                  newP[0].amount = String(Math.max(0, totalFinal - currentOtherPaid));
                                  setForm(f => ({ ...f, payments: newP }));
                                }}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', height: 32, padding: '0 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0284c7', cursor: 'pointer' }}
                              >
                                Pay Full
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(() => {
                      const totalPaid = form.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                      if (totalPaid > 0 && totalPaid < totalFinal) {
                        return (
                          <div style={{ marginTop: 4, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>Payment Action</div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                              <input 
                                type="radio" 
                                name="recordEntryAction"
                                checked={form.settle_fully === true} 
                                onChange={() => setForm(f => ({ ...f, settle_fully: true }))} 
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: 13, color: '#334155' }}><strong>Negotiated Settlement</strong> (Mark fully paid & log discount)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                              <input 
                                type="radio" 
                                name="recordEntryAction"
                                checked={!form.settle_fully} 
                                onChange={() => setForm(f => ({ ...f, settle_fully: false }))} 
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: 13, color: '#334155' }}><strong>Partial Payment</strong> (Leave remainder due)</span>
                            </label>
                          </div>
                        );
                      }
                      if (totalPaid > totalFinal) {
                        return (
                          <div style={{ marginTop: 4, padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8 }}>
                            <span style={{ fontSize: 13, color: '#047857', fontWeight: 600 }}>You are paying extra. The difference will automatically be stored as an advance in the supplier ledger.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, columnGap: 16, padding: '24px', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', height: 'fit-content', alignItems: 'center' }}>
                 <style>{`
                   .summary-input::-webkit-inner-spin-button, .summary-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                   .summary-input { -moz-appearance: textfield; font-variant-numeric: tabular-nums; }
                 `}</style>

                 {/* Purchase Total */}
                 <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#64748b' }}>Purchase Total:</div>
                 <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>₹{formatNum(totalBase)}</div>
                 
                 {/* Extra Charges */}
                 {parseFloat(form.global_extra_charge) > 0 && (
                   <>
                     <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#64748b' }}>Extra Charges:</div>
                     <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>+₹{formatNum(form.global_extra_charge)}</div>
                   </>
                 )}

                 {/* Quintal Charges */}
                 {totalQuintalCharge > 0 && (
                   <>
                     <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#64748b' }}>Quintal Charges:</div>
                     <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                       +₹
                       <input 
                         className="summary-input"
                         type="number"
                         value={tempCustomQuintal !== '' ? tempCustomQuintal : (customQuintalCharge !== '' ? customQuintalCharge : getDisplayVal(totalQuintalCharge))}
                         onChange={e => {
                           const newVal = e.target.value;
                           setTempCustomQuintal(newVal);
                           setCustomQuintalCharge(newVal);
                           setCustomGrandTotal(''); // Reset to allow auto calculation
                           setForm(f => {
                             let n = f.notes || '';
                             if (newVal === '') {
                               n = n.replace(/Quintal charge changed from [^|]*\|?/g, '').trim();
                               n = n.replace(/Quintal charge edited\|?/g, '').trim();
                               if (n.endsWith('|')) n = n.slice(0, -1).trim();
                             } else {
                               const msg = `Quintal charge changed from ${getDisplayVal(totalQuintalCharge)} to ${newVal}`;
                               if (n.includes('Quintal charge changed from')) {
                                 n = n.replace(/Quintal charge changed from [0-9.]+ to [^|]*/, msg);
                               } else if (n.includes('Quintal charge edited')) {
                                 n = n.replace('Quintal charge edited', msg);
                               } else {
                                 n = n ? n + (n.endsWith(' | ') ? '' : ' | ') + msg : msg;
                               }
                             }
                             return { ...f, notes: n };
                           });
                         }}
                         onBlur={() => setTempCustomQuintal('')}
                         style={{ width: `${Math.max(1, String(tempCustomQuintal !== '' ? tempCustomQuintal : (customQuintalCharge !== '' ? customQuintalCharge : getDisplayVal(totalQuintalCharge))).length) + 0.2}ch`, border: 'none', background: 'transparent', color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', outline: 'none', textAlign: 'right', padding: 0 }}
                       />
                     </div>
                   </>
                 )}

                 {/* Landed Cost */}
                 <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#64748b' }}>Landed Cost:</div>
                 <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>₹{formatNum(effectiveLandedCost)}</div>

                 {/* Selling Total */}
                 {totalSelling > 0 && (
                   <>
                     <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#64748b' }}>Selling Total:</div>
                     <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>₹{formatNum(totalSelling)}</div>
                   </>
                 )}

                 {/* Profit */}
                 {totalProfit !== 0 && (
                   <>
                     <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#64748b' }}>Profit:</div>
                     <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: totalProfit >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                       {totalProfit >= 0 ? '+₹' : '-₹'}{formatNum(totalProfit)}
                     </div>
                   </>
                 )}

                 {/* Divider */}
                 <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #cbd5e1', paddingTop: 16, marginTop: 12 }}></div>

                 {/* Grand Total */}
                 <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grand Total:</div>
                 <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 24, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                   ₹
                   <input 
                     className="summary-input"
                     type="number"
                     value={customGrandTotal !== '' ? customGrandTotal : getDisplayVal(totalFinal)}
                     onChange={e => {
                       const newVal = e.target.value;
                       setCustomGrandTotal(newVal);
                       setForm(f => {
                         let n = f.notes || '';
                         if (newVal === '') {
                           n = n.replace(/Grand total changed from [^|]*\|?/g, '').trim();
                           n = n.replace(/Grand total edited\|?/g, '').trim();
                           if (n.endsWith('|')) n = n.slice(0, -1).trim();
                         } else {
                           const msg = `Grand total changed from ${getDisplayVal(totalFinal)} to ${newVal}`;
                           if (n.includes('Grand total changed from')) {
                             n = n.replace(/Grand total changed from [0-9.]+ to [^|]*/, msg);
                           } else if (n.includes('Grand total edited')) {
                             n = n.replace('Grand total edited', msg);
                           } else {
                             n = n ? n + (n.endsWith(' | ') ? '' : ' | ') + msg : msg;
                           }
                         }
                         return { ...f, notes: n };
                       });
                     }}
                     style={{ width: `${Math.max(1, String(customGrandTotal !== '' ? customGrandTotal : getDisplayVal(totalFinal)).length) + 0.2}ch`, border: 'none', background: 'transparent', color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', outline: 'none', textAlign: 'right', padding: 0 }}
                   />
                 </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button 
              type="button" 
              onClick={() => setShowClearConfirm(true)}
              style={{ padding: '12px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 12, color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Clear current form"
            >
              <Trash2 size={16} /> Clear
            </button>
            
            {showClearConfirm && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', width: 320, padding: 24, animation: 'fadeIn 0.2s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <div style={{ background: '#fee2e2', color: '#ef4444', padding: 12, borderRadius: '50%' }}>
                      <AlertTriangle size={24} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 8, textAlign: 'center' }}>
                    Clear this entry?
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 }}>
                    Are you sure you want to completely clear this form? All unsaved data will be lost.
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10, color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => {
                      localStorage.removeItem(DRAFT_KEY);
                      const now = new Date();
                      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                      setForm({ expected_arrival: now.toISOString().slice(0, 16), vehicle_number: '', notes: '', payments: [{ amount: '', mode: 'cash' }], items: [{ item_name: '', quantity: '1', unit: '', weight: '', base_price: '', final_price: '', margin: '', sell_price: '' }], settle_fully: false, global_extra_charge: '', global_quintal_charge: '', global_profit_percent: '' });
                      setCustomGrandTotal('');
                      setCustomQuintalCharge('');
                      setShowClearConfirm(false);
                      toast.success('Form cleared successfully');
                    }} style={{ flex: 1, padding: '10px', background: '#ef4444', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}>
                      Yes, Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button 
              type="button" 
              onClick={handleSaveDraft}
              style={{ padding: '12px 16px', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 12, color: '#0369a1', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Save this form as a reusable template"
            >
              <Save size={16} /> Save Draft
            </button>
            <button 
              type="button" 
              onClick={() => setShowDraftsMenu(!showDraftsMenu)}
              style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, color: '#b45309', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Load a saved draft"
            >
              <FolderOpen size={16} /> Load Draft
            </button>
            
            {showDraftsMenu && (
              <div style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', width: 320, zIndex: 100, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: 14, color: '#0f172a', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Saved Drafts
                  <X size={16} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setShowDraftsMenu(false)} />
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: 8 }}>
                  {savedDraftsList.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>No drafts saved yet.</div>
                  ) : (
                    savedDraftsList.map(draft => (
                      <div key={draft.id} onClick={() => handleLoadDraft(draft)} style={{ padding: '10px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }} className="draft-item" onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{draft.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{draft.date}</div>
                        </div>
                        <button type="button" onClick={(e) => handleDeleteDraft(draft.id, e)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="btn btn-outline"
            style={{ flex: 1, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15 }}
            type="button"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="entryForm"
            className="btn btn-primary"
            disabled={saving}
            style={{ flex: 2, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15, background: '#0284c7', borderColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <PackagePlus size={18} />}
            Confirm Entry
          </button>
        </div>
      </div>
    </div>
  );
}
