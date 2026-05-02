import React, { useState, useEffect, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productApi, customerApi, invoiceApi, dashboardApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useLocation } from 'react-router-dom';
import { orderApi } from '../utils/api';
import { useApp } from '../context/AppContext';

const newItem = () => ({
  _key: Date.now() + Math.random(),
  product_id: '', product_name: '', qty: 0, price: '0', gst: 0,
  taxable_amount: 0, cgst: 0, sgst: 0, total: 0, adjustment: 0,
});

function calcItem(item, gstEnabled) {
  const qty = parseFloat(item.qty) || 0;
  const price = parseFloat(item.price) || 0;
  const gst = gstEnabled ? (parseFloat(item.gst) || 0) : 0;
  const taxable_amount = qty * price;
  const gst_amount = (taxable_amount * gst) / 100;
  const cgst = gst_amount / 2;
  const sgst = gst_amount / 2;
  const adj = parseFloat(item.adjustment) || 0;
  const total = Math.max(0, taxable_amount + gst_amount - adj);
  return { ...item, qty, price, gst, taxable_amount, cgst, sgst, total };
}

function calcItemFromTotal(item, gstEnabled, newTotal) {
  const qty = parseFloat(item.qty) || 1;
  const gst = gstEnabled ? (parseFloat(item.gst) || 0) : 0;
  const totalNum = parseFloat(newTotal) || 0;
  const price = gst > 0
    ? totalNum / qty / (1 + gst / 100)
    : totalNum / qty;
  const taxable_amount = qty * price;
  const gst_amount = (taxable_amount * gst) / 100;
  const cgst = gst_amount / 2;
  const sgst = gst_amount / 2;
  const total = Math.max(0, taxable_amount + gst_amount);
  return {
    ...item,
    qty,
    price: parseFloat(price.toFixed(4)),
    taxable_amount: parseFloat(taxable_amount.toFixed(2)),
    gst_amount: parseFloat(gst_amount.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

const PAYMENT_MODES = ['cash', 'upi', 'online', 'others'];

function ProductAutocomplete({ value, onSelect, onNameChange, inputRef, onEnter }) {
  const [query, setQuery] = useState(value || '');
  const [allProducts, setAllProducts] = useState([]);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    productApi.getAll({ limit: 500 }).then(res => {
      const list = Array.isArray(res) ? res : (res?.products || res?.data || []);
      setAllProducts(list);
      setResults(list);
    }).catch(() => { });
  }, []);

  const filter = useCallback((q) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setResults(allProducts);
    } else {
      setResults(allProducts.filter(p => (p.name || '').toLowerCase().includes(trimmed)));
    }
  }, [allProducts]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    onNameChange(v);
    filter(v);
  };

  const handleFocus = () => {
    filter(query);
    setOpen(true);
  };

  const handleSelect = (p) => {
    setQuery(p.name);
    setOpen(false);
    onSelect(p);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="form-control"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Select or type product..."
        style={{ fontSize: 13, padding: '6px 8px' }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setOpen(false);
            onEnter && onEnter();
          }
        }}
      />
      {open && (
        <div className="autocomplete-dropdown" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div>
              {query.trim() ? (
                <div
                  onMouseDown={() => {
                    setOpen(false);
                    onSelect({
                      _id: '',
                      name: query.trim(),
                      price: 0,
                      gst: 0,
                      stock: 0,
                      unit: 'bag',
                      _isNew: true,
                    });
                  }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                  onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                >
                  <span style={{ fontSize: 13, color: '#6b7280' }}>
                    No match for <strong style={{ color: '#111827' }}>"{query}"</strong>
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                    background: '#fff', border: '1.5px solid #bfdbfe',
                    padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    ➕ Add as new
                  </span>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Type to search products...
                </div>
              )}
            </div>
          ) : results.map(p => (
            <div
              key={p._id}
              className="autocomplete-item"
              onMouseDown={() => handleSelect(p)}
              style={{ opacity: p.stock === 0 ? 0.5 : 1 }}
            >
              <div>
                <div className="autocomplete-item-name">{p.name}</div>
                <div className="autocomplete-item-meta">
                  Stock: <span style={{ color: p.stock <= 5 ? 'var(--danger)' : 'inherit' }}>{p.stock}</span> {p.unit}
                  {' · '}GST: {p.gst}%
                  {p.stock === 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>OUT OF STOCK</span>}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {formatCurrency(p.price)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewInvoice() {
  const AUTO_DRAFT_KEY = 'invoice_auto_draft';
  const DRAFTS_KEY = 'invoice_drafts';
  const navigate = useNavigate();
  const { settings } = useApp();
  const gstEnabled = settings.gst_enabled !== false;
  const discountEnabled = settings.discount_enabled !== false;
  const [customers, setCustomers] = useState([]);
  const createInitialItems = () => Array.from({ length: 2 }, () => newItem());
  const [items, setItems] = useState(createInitialItems());
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('orderId');

  useEffect(() => {
    if (!orderId) return;
    const loadOrder = async () => {
      try {
        const order = await orderApi.getById(orderId);
        setCustomerMode('walkin');
        setWalkIn({ name: order.customer_name, phone: order.customer_phone, address: '' });
        const orderItems = order.items.map(i => {
          const base = newItem();
          const filled = { ...base, product_id: i.product_id || '', product_name: i.product_name, qty: i.qty || 1, price: i.price || '' };
          return calcItem(filled, gstEnabled);
        });
        setItems([...orderItems, newItem()]);
        if (order.advance_paid && order.advance_paid > 0) {
          setPayments([{ mode: order.advance_mode || 'cash', amount: String(order.advance_paid), reference: 'Advance from order' }]);
        }
        toast.success('Order loaded — items, price & advance pre-filled');
      } catch (err) {
        console.error(err);
        toast.error('Failed to load order');
      }
    };
    loadOrder();
  }, [orderId]);

  const sigRef = useRef();
  const productRefs = useRef([]);
  const nameRef = useRef();
  const phoneRef = useRef();
  const addressRef = useRef();
  const qtyRefs = useRef([]);
  const priceRefs = useRef([]);
  const customerInputRef = useRef(null);

  const [customerMode, setCustomerMode] = useState('walkin');
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 300 });
  const [walkIn, setWalkIn] = useState({ name: '', phone: '', address: '' });
  const [prevBalance, setPrevBalance] = useState(0);
  const [walkinMatch, setWalkinMatch] = useState(null);
  const [showWalkinMatchModal, setShowWalkinMatchModal] = useState(false);
  const [allPendingDues, setAllPendingDues] = useState([]);
  const [payments, setPayments] = useState([{ mode: 'cash', amount: '', reference: '' }]);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [concessionReason, setConcessionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState(null);
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleCharge, setVehicleCharge] = useState('');
  const [labourCharge, setLabourCharge] = useState('');
  const [isManualBill, setIsManualBill] = useState(false);

  const getISTDateTime = () => {
    const now = new Date();
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now).replace(' ', 'T');
  };

  const [billDate, setBillDate] = useState(getISTDateTime());
  const [manualBillRef, setManualBillRef] = useState('');

  // Auto-draft save
  useEffect(() => {
    const draft = {
      items, customerMode, customerId, walkIn, payments, discount,
      concessionReason, notes, driverName, vehicleNumber, vehicleCharge,
      labourCharge, billDate, isManualBill, manualBillRef, savedAt: Date.now(),
    };
    localStorage.setItem(AUTO_DRAFT_KEY, JSON.stringify(draft));
  }, [items, customerMode, customerId, walkIn, payments, discount, notes,
    driverName, vehicleNumber, vehicleCharge, labourCharge, billDate, isManualBill, manualBillRef]);

  // Load customers
  useEffect(() => {
    customerApi.getAll({ limit: 500 }).then(res => {
      const list = Array.isArray(res) ? res : (res?.customers || res?.data || []);
      console.log('[NewInvoice] customers loaded:', list.length, list[0]);
      setCustomers(list);
    }).catch(err => {
      console.error('[NewInvoice] customer fetch failed:', err);
    });
  }, []);

  // Load pending dues
  useEffect(() => {
    dashboardApi.get().then(d => {
      setAllPendingDues(d.pendingCustomers || []);
    }).catch(() => { });
  }, []);

  // Load drafts list
  useEffect(() => {
    let stored = JSON.parse(localStorage.getItem('invoice_drafts') || '[]');
    if (!Array.isArray(stored)) stored = [];
    setDrafts(stored);
  }, []);

  // Restore auto-draft
  useEffect(() => {
    const saved = localStorage.getItem(AUTO_DRAFT_KEY);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - draft.savedAt > sevenDays) {
        localStorage.removeItem(AUTO_DRAFT_KEY);
        return;
      }
      setItems(draft.items || [newItem()]);
      setCustomerMode(draft.customerMode || 'walkin');
      setCustomerId(draft.customerId || '');
      setWalkIn(draft.walkIn || {});
      setPayments(draft.payments || [{ mode: 'cash', amount: '', reference: '' }]);
      setDiscount(draft.discount || '');
      setConcessionReason(draft.concessionReason || '');
      setNotes(draft.notes || '');
      setDriverName(draft.driverName || '');
      setVehicleNumber(draft.vehicleNumber || '');
      setVehicleCharge(draft.vehicleCharge || '');
      setLabourCharge(draft.labourCharge || '');
      setBillDate(draft.billDate || getISTDateTime());
      setIsManualBill(draft.isManualBill || false);
      setManualBillRef(draft.manualBillRef || '');
    } catch {
      localStorage.removeItem(AUTO_DRAFT_KEY);
    }
  }, []);

  // Previous balance for existing customer
  useEffect(() => {
    if (customerMode === 'existing' && customerId) {
      const c = customers.find(c => c._id === customerId);
      setPrevBalance(c ? c.balance : 0);
    } else {
      setPrevBalance(0);
    }
  }, [customerId, customerMode, customers]);

  // Walk-in detection — phone is PRIMARY key
  useEffect(() => {
    if (customerMode !== 'walkin') return;
    const phone = (walkIn.phone || '').replace(/\D/g, '');
    if (phone.length !== 10) { setWalkinMatch(null); return; }

    const registeredMatch = customers.find(c =>
      (c.phone || '').replace(/\D/g, '') === phone
    );
    if (registeredMatch) {
      setCustomerMode('existing');
      setCustomerId(registeredMatch._id);
      setCustomerSearch(`${registeredMatch.name} (${registeredMatch.phone || ''})`);
      setPrevBalance(registeredMatch.balance || 0);
      setWalkinMatch(null);
      if (registeredMatch.balance > 0.01) {
        toast(`✅ Switched to ${registeredMatch.name} · Due: ₹${registeredMatch.balance?.toFixed(2)} carried forward`, { duration: 4000 });
      } else {
        toast.success(`✅ Switched to registered customer: ${registeredMatch.name}`);
      }
      return;
    }

    const walkinDueMatch = allPendingDues.find(c =>
      c.type === 'walkin' &&
      (c.phone || '').replace(/\D/g, '') === phone &&
      (c.balance || 0) > 0.01
    );
    if (walkinDueMatch) {
      setPrevBalance(walkinDueMatch.balance || 0);
      setWalkinMatch(null);
      toast(`⚠️ Pending due ₹${walkinDueMatch.balance?.toFixed(2)} from ${walkinDueMatch.name} carried forward`, { icon: '⚠️', duration: 5000 });
      const nameToUse = walkIn.name?.trim() || walkinDueMatch.name?.trim();
      if (nameToUse && phone) {
        customerApi.create({
          name: nameToUse, phone, address: walkIn.address?.trim() || '',
          balance: walkinDueMatch.balance || 0,
        }).then(() => {
          customerApi.getAll().then(res => {
            const list = Array.isArray(res) ? res : (res?.customers || res?.data || []);
            setCustomers(list);
          }).catch(() => { });
          toast.success(`✅ ${nameToUse} registered as customer`, { duration: 3000 });
        }).catch(() => { });
      }
      return;
    }

    setWalkinMatch(null);
    setPrevBalance(0);
  }, [walkIn.phone, customerMode, customers, allPendingDues]);

  const updateItem = (idx, changes) => {
    setItems(prev => {
      const next = [...prev];
      const updated = { ...next[idx], ...changes };
      next[idx] = calcItem(updated, gstEnabled);
      const item = next[idx];
      const isLastRow = idx === next.length - 1;
      const isFilled = item.product_name && item.price && parseFloat(item.qty) > 0;
      if (isLastRow && isFilled) next.push(newItem());
      return next;
    });
  };

  const saveDraft = () => {
    let existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    if (!Array.isArray(existing)) existing = [];
    const customerName = customerMode === 'existing'
      ? customers.find(c => c._id === customerId)?.name || 'Customer'
      : walkIn?.name || 'Walk-in Customer';
    const validItems = items.filter(i => i.product_name && i.price && parseFloat(i.qty) > 0);
    const totalAmount = validItems.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    const newDraft = {
      id: Date.now(), customerName, totalAmount, itemCount: validItems.length,
      items, customerMode, customerId, walkIn, payments, discount, notes,
      driverName, vehicleNumber, vehicleCharge, labourCharge,
      billDate, isManualBill, manualBillRef, savedAt: Date.now(),
    };
    const updated = [newDraft, ...existing];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
    setDrafts(updated);
    toast.success('Draft saved!');
  };

  const onProductSelect = (idx, p) => {
    if (p._isNew) {
      updateItem(idx, { product_id: '', product_name: p.name, price: 0, gst: 0, qty: 1, unit: p.unit || 'bag', _isNew: true });
    } else {
      updateItem(idx, { product_id: p._id, product_name: p.name, price: p.price, gst: p.gst, qty: 1, unit: p.unit || 'pcs', _isNew: false });
    }
  };

  const addItem = () => setItems(prev => [...prev, newItem()]);
  const removeItem = (idx) => { if (items.length === 1) return; setItems(prev => prev.filter((_, i) => i !== idx)); };
  const addPayment = () => setPayments(prev => [...prev, { mode: 'cash', amount: '', reference: '' }]);
  const removePayment = (idx) => { if (payments.length === 1) return; setPayments(prev => prev.filter((_, i) => i !== idx)); };
  const updatePayment = (idx, changes) => setPayments(prev => { const next = [...prev]; next[idx] = { ...next[idx], ...changes }; return next; });

  const subtotal = items.reduce((s, i) => s + (i.taxable_amount || 0), 0);
  const gstTotal = gstEnabled ? items.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0) : 0;
  const dis = parseFloat(discount) || 0;
  const vc = parseFloat(vehicleCharge) || 0;
  const lc = parseFloat(labourCharge) || 0;
  const total = Math.max(0, subtotal + gstTotal - dis) + vc + lc;
  const totalWithPrev = total + prevBalance;
  const amtReceived = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const balanceDue = totalWithPrev - amtReceived;
  const fc = formatCurrency;

  const getCustomerInfo = () => {
    if (customerMode === 'existing' && customerId) {
      const c = customers.find(c => c._id === customerId);
      return { customer_id: customerId, customer_name: c?.name || '', customer_phone: c?.phone || '', customer_address: c?.address || '' };
    }
    return { customer_id: null, customer_name: walkIn.name || 'Walk-in Customer', customer_phone: walkIn.phone, customer_address: walkIn.address };
  };

  const loadDraft = (draft) => {
    setItems(draft.items || [newItem()]);
    setCustomerMode(draft.customerMode || 'walkin');
    setCustomerId(draft.customerId || '');
    if (draft.customerMode === 'existing') {
      const customer = customers.find(c => c._id === draft.customerId);
      setCustomerSearch(customer ? `${customer.name} (${customer.phone || ''})` : draft.customerName || '');
    }
    setWalkIn(draft.walkIn || {});
    setPayments(draft.payments || [{ mode: 'cash', amount: '', reference: '' }]);
    setDiscount(draft.discount || '');
    setNotes(draft.notes || '');
    setDriverName(draft.driverName || '');
    setVehicleNumber(draft.vehicleNumber || '');
    setVehicleCharge(draft.vehicleCharge || '');
    setLabourCharge(draft.labourCharge || '');
    setBillDate(draft.billDate || getISTDateTime());
    setIsManualBill(draft.isManualBill || false);
    setManualBillRef(draft.manualBillRef || '');
    setLoadedDraftId(draft.id);
    setShowDrafts(false);
    toast.success('Draft loaded!');
  };

  const deleteDraft = (id) => {
    let existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    if (!Array.isArray(existing)) existing = [];
    const updated = existing.filter(d => d.id !== id);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
    setDrafts(updated);
    toast.success('Draft deleted!');
  };

  const handleSubmit = async () => {
    const filledItems = items.filter(i => i.product_name && parseFloat(i.qty) > 0);
    if (filledItems.length === 0) return toast.error('Add at least one valid item');
    if (customerMode === 'existing' && !customerId) return toast.error('Select a customer');
    if (!sigRef.current || sigRef.current.isEmpty()) return toast.error("Authorised signature is required");

    const signature = sigRef.current.toDataURL("image/png");
    setSaving(true);
    try {
      const rawItems = items.map(({ _key, taxable_amount, cgst, sgst, total, _totalEdit, _priceEdit, ...i }) => ({
        ...i,
        qty: parseFloat(i.qty) || 0,
        price: parseFloat(i.price) || 0,
        gst: parseFloat(i.gst) || 0,
        adjustment: parseFloat(i.adjustment) || 0,
      }));
      const mergedMap = new Map();
      rawItems.forEach(item => {
        const key = item.product_id || `custom_${item.product_name}`;
        if (item.product_id && mergedMap.has(key)) {
          mergedMap.get(key).qty += item.qty;
        } else {
          mergedMap.set(key, { ...item });
        }
      });
      const mergedItems = Array.from(mergedMap.values());

      const payload = {
        ...getCustomerInfo(),
        items: mergedItems
          .filter(i => i.product_name && parseFloat(i.qty) > 0)
          .map(i => ({
            ...i,
            product_id: i.product_id || null,
            qty: parseFloat(i.qty) || 1,
            price: parseFloat(i.price) || 0,
            unit: i.unit || 'bag',
            is_new_product: !!i._isNew,
            per_unit_price: parseFloat(i.price) || 0,
          })),
        payments: payments.filter(p => parseFloat(p.amount) > 0).map(p => ({ ...p, amount: parseFloat(p.amount) })),
        discount: dis,
        concession_reason: concessionReason,
        notes,
        gst_enabled: gstEnabled,
        discount_enabled: discountEnabled,
        driver_name: driverName,
        vehicle_number: vehicleNumber,
        vehicle_charge: vc,
        labour_charge: lc,
        bill_date: billDate,
        is_manual_bill: isManualBill,
        manual_bill_ref: manualBillRef,
        signature,
      };

      const invoice = await invoiceApi.create(payload);
      toast.success('Invoice created!');
      localStorage.removeItem(AUTO_DRAFT_KEY);

      // Auto-register walk-in if name + phone provided
      if (customerMode === 'walkin' && walkIn.phone?.length === 10 && walkIn.name?.trim()) {
        const alreadyExists = customers.find(c =>
          (c.phone || '').replace(/\D/g, '') === walkIn.phone.replace(/\D/g, '')
        );
        if (!alreadyExists) {
          customerApi.create({
            name: walkIn.name.trim(),
            phone: walkIn.phone,
            address: walkIn.address?.trim() || '',
            balance: invoice.balance_due > 0.01 ? invoice.balance_due : 0,
          }).catch(() => { });
        }
      }

      // Delete loaded draft
      if (loadedDraftId) {
        const existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
        const cleaned = existing.filter(d => d.id !== loadedDraftId);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleaned));
        setDrafts(cleaned);
      }

      navigate(`/invoices/${invoice._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find(c => c._id === customerId);
  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return false;
    const digitsOnly = q.replace(/\D/g, '');
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (digitsOnly.length > 0 && (c.phone || '').replace(/\D/g, '').includes(digitsOnly)) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Header bar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 20,
        background: '#fff', borderRadius: 12, padding: '12px 18px',
        border: '1.5px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* LEFT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>🧾 New Bill</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {isManualBill ? '📝 Manual Bill Entry' : 'Create a new sales invoice'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrafts(v => !v); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: showDrafts ? 'var(--primary)' : '#f3f4f6',
                border: showDrafts ? 'none' : '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600,
                color: showDrafts ? '#fff' : 'var(--text-muted)',
                boxShadow: showDrafts ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              📂 Drafts
              {drafts.length > 0 && (
                <span style={{
                  background: showDrafts ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                  color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10,
                }}>
                  {drafts.length}
                </span>
              )}
            </button>
            <span style={{ width: 1, height: 20, background: '#d1d5db', flexShrink: 0 }} />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/orders'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#f3f4f6', border: '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              📦 Orders
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/orders/new?from=invoice'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: 'transparent', border: '1.5px solid #e5e7eb', color: '#374151',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >
            📦 New Order
          </button>
          <button
            type="button"
            onClick={saveDraft}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              border: 'none', color: '#fff',
              boxShadow: '0 2px 10px rgba(22,163,74,0.35)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(22,163,74,0.35)'; e.currentTarget.style.transform = 'none'; }}
          >
            💾 Save Invoice
          </button>
        </div>
      </div>

      {/* Drafts panel */}
      {showDrafts && (
        <div className="card mb-3" style={{ border: '1.5px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>
              📂 Saved Drafts
              {drafts.length > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                  {drafts.length}
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={() => setShowDrafts(false)}>✕ Close</button>
          </div>
          <div style={{ padding: drafts.length === 0 ? 24 : '8px 12px' }}>
            {drafts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                No drafts saved yet. Click "Save Invoice" to save one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {drafts.map(d => {
                  const savedDate = d.savedAt
                    ? new Date(d.savedAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true,
                        timeZone: 'Asia/Kolkata',
                      })
                    : '—';
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: '#f8fafc', border: '1.5px solid var(--border)',
                        borderRadius: 10, padding: '12px 14px',
                        cursor: 'pointer', transition: 'border-color 0.15s', gap: 10,
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      onClick={() => loadDraft(d)}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{d.customerName || 'Walk-in Customer'}</span>
                          <span style={{ background: '#eff6ff', color: 'var(--primary)', fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: '1px 7px' }}>Draft</span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🕐 {savedDate}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📦 {d.itemCount || 0} item{d.itemCount !== 1 ? 's' : ''}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>₹{(d.totalAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }} onClick={() => loadDraft(d)}>📂 Load</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => deleteDraft(d.id)}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="billing-layout">
        <div>
          {/* Customer + Bill Type */}
          <div className="card mb-5" style={{ overflow: 'visible' }}>
            <div className="card-header"><div className="card-title">👤 Customer & Bill Details</div></div>
            <div className="card-body" style={{ overflow: 'visible' }}>
              <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
                {[['walkin', '🚶 Walk-in'], ['existing', '👥 Existing Customer']].map(([v, l]) => (
                  <button key={v} className={`btn ${customerMode === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCustomerMode(v)}>{l}</button>
                ))}
              </div>

              {customerMode === 'existing' ? (
                <div>
                  <div className="form-group">
                    <label className="form-label">Select Customer *</label>
                    <input
                      ref={customerInputRef}
                      className="form-control"
                      placeholder="Search by name or phone..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerList(true);
                      }}
                      onFocus={() => {
                        setShowCustomerList(true);
                        if (customerInputRef.current) {
                          const rect = customerInputRef.current.getBoundingClientRect();
                          setDropdownPos({
                            top: rect.bottom + window.scrollY,
                            left: rect.left + window.scrollX,
                            width: rect.width,
                          });
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowCustomerList(false), 300)}
                    />

                    {/* Fixed position dropdown */}
                    {showCustomerList && (
                      <div
                        onMouseDown={e => e.preventDefault()}
                        style={{
                          position: 'fixed',
                          top: dropdownPos.top + 4,
                          left: dropdownPos.left,
                          width: dropdownPos.width,
                          maxHeight: 280,
                          overflowY: 'auto',
                          background: '#fff',
                          border: '1.5px solid #d1d5db',
                          borderRadius: 10,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                          zIndex: 99999,
                        }}
                      >
                        {(() => {
                          const list = customerSearch.trim() ? filteredCustomers : customers.slice(0, 10);
                          if (list.length === 0) {
                            return (
                              <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                                {customerSearch.trim() ? `No customer found matching "${customerSearch}"` : 'No customers available'}
                              </div>
                            );
                          }
                          return list.map((c, idx) => (
                            <div
                              key={c._id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setCustomerId(c._id);
                                setCustomerSearch(`${c.name} (${c.phone || ''})`);
                                setShowCustomerList(false);
                                setPrevBalance(c.balance || 0);
                              }}
                              style={{
                                padding: '10px 14px', cursor: 'pointer',
                                borderBottom: idx < list.length - 1 ? '1px solid #f3f4f6' : 'none',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: '#fff', transition: 'background 0.1s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📞 {c.phone || 'No phone'}</div>
                              </div>
                              {c.balance > 0.01 && (
                                <span style={{ fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 8 }}>
                                  Due ₹{c.balance?.toFixed(2)}
                                </span>
                              )}
                              {c.balance < 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 8 }}>
                                  Adv ₹{Math.abs(c.balance)?.toFixed(2)}
                                </span>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Selected customer card */}
                  {selectedCustomer && (
                    <div style={{ border: '1.5px solid #bfdbfe', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
                      <div style={{
                        background: 'linear-gradient(90deg, #2563eb, #1d4ed8)',
                        padding: '8px 14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 14, color: '#fff',
                          }}>
                            {selectedCustomer.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{selectedCustomer.name}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Registered Customer</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setCustomerId(''); setCustomerSearch(''); setPrevBalance(0); }}
                          style={{
                            background: 'rgba(255,255,255,0.15)', border: 'none',
                            cursor: 'pointer', borderRadius: 6, padding: '4px 8px',
                            color: '#fff', fontSize: 12, fontWeight: 600,
                          }}
                        >✕ Clear</button>
                      </div>
                      <div style={{
                        background: '#f8fafc',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 0,
                      }}>
                        {[
                          { label: '📞 Phone', value: selectedCustomer.phone ? `+91 ${selectedCustomer.phone}` : '—' },
                          { label: '📍 Address', value: selectedCustomer.address || '—' },
                          ...(prevBalance !== 0 ? [{ label: prevBalance > 0 ? '⚠️ Due' : '✅ Advance', value: `₹${Math.abs(prevBalance).toFixed(2)}`, color: prevBalance > 0 ? '#dc2626' : '#16a34a' }] : []),
                        ].map((infoItem, i, arr) => (
                          <div key={i} style={{ padding: '9px 14px', borderRight: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>{infoItem.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: infoItem.color || '#111827' }}>{infoItem.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      ref={nameRef}
                      className="form-control"
                      value={walkIn.name}
                      onChange={e => {
                        const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                        setWalkIn({ ...walkIn, name: val });
                      }}
                      placeholder="Customer name"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus(); } }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      border: '1.5px solid var(--border)', borderRadius: 6,
                      overflow: 'hidden', background: '#fff',
                      width: '100%', boxSizing: 'border-box',
                    }}>
                      <span style={{
                        padding: '9px 8px', background: '#f8fafc',
                        borderRight: '1.5px solid var(--border)',
                        fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>+91</span>
                      <input
                        ref={phoneRef}
                        style={{
                          border: 'none', outline: 'none',
                          padding: '9px 8px', fontSize: 14,
                          flex: 1, minWidth: 0,
                          fontFamily: 'inherit', background: 'transparent', width: '100%',
                        }}
                        value={walkIn.phone}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setWalkIn({ ...walkIn, phone: digits });
                        }}
                        placeholder="Phone Number"
                        inputMode="numeric"
                        maxLength={10}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addressRef.current?.focus(); } }}
                      />
                      {walkIn.phone?.length > 0 && (
                        <span style={{
                          paddingRight: 8, fontSize: 10, flexShrink: 0,
                          color: walkIn.phone.length === 10 ? 'var(--success)' : 'var(--warning)',
                          fontWeight: 700,
                        }}>
                          {walkIn.phone.length}/10
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input
                      ref={addressRef}
                      className="form-control"
                      value={walkIn.address}
                      onChange={e => {
                        const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                        setWalkIn({ ...walkIn, address: val });
                      }}
                      placeholder="e.g. Ganai Gangoli"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setTimeout(() => productRefs.current[0]?.focus(), 50);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <hr className="divider" />

              {/* Bill Type row */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bill Type</label>
                  <div className="flex gap-2">
                    <button type="button" className={`btn btn-sm ${!isManualBill ? 'btn-primary' : 'btn-outline'}`} onClick={() => setIsManualBill(false)}>🖥️ Digital</button>
                    <button type="button" className={`btn btn-sm ${isManualBill ? 'btn-warning' : 'btn-outline'}`} onClick={() => setIsManualBill(true)}>📝 Manual Entry</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{isManualBill ? '📅 Backdated Bill Date' : '📅 Bill Date'}</label>
                  <input className="form-control" type="datetime-local" value={billDate} max={new Date().toISOString().slice(0, 16)} onChange={e => setBillDate(e.target.value)} />
                </div>
                {isManualBill && (
                  <div className="form-group">
                    <label className="form-label">Manual Bill Ref. No.</label>
                    <input className="form-control" value={manualBillRef} onChange={e => setManualBillRef(e.target.value)} placeholder="e.g. HW-042" />
                  </div>
                )}
              </div>

              {/* Driver & Vehicle */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">🚛 Vehicle Number</label>
                  <input
                    className="form-control"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. UK04CB0199 (optional)"
                    style={{ textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">👤 Driver Name</label>
                  <input
                    className="form-control"
                    value={driverName}
                    onChange={e => {
                      const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                      setDriverName(val);
                    }}
                    placeholder="Driver name (optional)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card mb-5">
            <div className="card-header">
              <div className="card-title">📋 Items</div>
              <button className="btn btn-outline btn-sm" onClick={addItem}>+ Add Row</button>
            </div>
            <div className="card-body" style={{ padding: '12px 16px' }}>
              <div className="items-table-wrap">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>Product</th>
                      <th style={{ width: 70 }}>Qty</th>
                      <th style={{ width: 100 }}>Rate ₹</th>
                      {gstEnabled && (
                        <>
                          <th style={{ width: 70 }}>GST %</th>
                          <th style={{ width: 85 }}>Taxable</th>
                          <th style={{ width: 75 }}>CGST</th>
                          <th style={{ width: 75 }}>SGST</th>
                        </>
                      )}
                      <th style={{ width: 95 }}>
                        Total ₹
                        {gstEnabled && (
                          <span style={{ fontSize: 9, color: '#93c5fd', display: 'block', fontWeight: 400 }}>editable</span>
                        )}
                      </th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item._key}>
                        <td>
                          <ProductAutocomplete
                            value={item.product_name}
                            inputRef={el => (productRefs.current[idx] = el)}
                            onSelect={p => onProductSelect(idx, p)}
                            onNameChange={v => updateItem(idx, { product_id: '', product_name: v, _isNew: false, qty: v ? 1 : '' })}
                            onEnter={() => {
                              setTimeout(() => qtyRefs.current[idx]?.focus(), 50);
                            }}
                            placeholder="Item name"
                          />
                          {item._isNew && item.product_name && (
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', padding: '1px 7px', borderRadius: 8 }}>
                                🆕 New Product
                              </span>
                              <select
                                style={{ fontSize: 11, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 5, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                                value={item.unit || 'bag'}
                                onChange={e => updateItem(idx, { unit: e.target.value })}
                              >
                                {['bag', 'kg', 'g', 'ltr', 'ml', 'pcs', 'box', 'quintal', 'ton', 'mtr', 'dozen', 'pkt', 'strip'].map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Saved on invoice creation</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            ref={el => (qtyRefs.current[idx] = el)}
                            className="form-control"
                            type="text"
                            inputMode="decimal"
                            value={item.qty}
                            placeholder="Qty"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^[0-9]*[.]?[0-9]*$/.test(val)) {
                                updateItem(idx, { qty: val });
                              }
                            }}
                            onBlur={() => {
                              setItems(prev => {
                                const next = [...prev];
                                next[idx] = calcItem(next[idx], gstEnabled);
                                return next;
                              });
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                priceRefs.current[idx]?.focus();
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input
                            ref={el => (priceRefs.current[idx] = el)}
                            className="form-control"
                            type="text"
                            inputMode="decimal"
                            value={item._priceEdit !== undefined ? item._priceEdit : (item.price || '')}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^[0-9]*[.]?[0-9]*$/.test(val)) {
                                setItems(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], _priceEdit: val };
                                  return next;
                                });
                              }
                            }}
                            onBlur={() => {
                              setItems(prev => {
                                const next = [...prev];
                                const rawVal = next[idx]._priceEdit;
                                if (rawVal !== undefined) {
                                  next[idx] = calcItem({ ...next[idx], price: rawVal, _priceEdit: undefined }, gstEnabled);
                                } else {
                                  next[idx] = calcItem(next[idx], gstEnabled);
                                }
                                return next;
                              });
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const isLast = idx === items.length - 1;
                                const isFilled = item.product_name && parseFloat(item.qty) > 0;
                                if (isLast && isFilled) addItem();
                                setTimeout(() => productRefs.current[idx + 1]?.focus(), 50);
                              }
                            }}
                          />
                          {gstEnabled && parseFloat(item.gst) > 0 && item._totalEdit === undefined && item.price > 0 && (
                            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                              base ₹{parseFloat(item.price).toFixed(2)}
                            </div>
                          )}
                        </td>
                        {gstEnabled && (
                          <>
                            <td>
                              <select className="form-control" value={item.gst} onChange={e => updateItem(idx, { gst: e.target.value })}>
                                {[0, 0.25, 1, 3, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                              </select>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12.5 }}>{fc(item.taxable_amount)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12.5 }}>{fc(item.cgst)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12.5 }}>{fc(item.sgst)}</td>
                          </>
                        )}
                        <td style={{ textAlign: 'right' }}>
                          {gstEnabled && parseFloat(item.gst) > 0 ? (
                            <input
                              className="form-control"
                              type="text"
                              inputMode="decimal"
                              value={item._totalEdit !== undefined ? item._totalEdit : (item.total || '0')}
                              style={{
                                textAlign: 'right', fontFamily: 'monospace',
                                fontWeight: 700, fontSize: 13,
                                border: '1.5px solid #bfdbfe',
                                background: '#eff6ff',
                                width: 90,
                              }}
                              title="Edit total → base price auto-recalculates"
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^[0-9]*[.]?[0-9]*$/.test(val)) {
                                  setItems(prev => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], _totalEdit: val };
                                    if (val !== '' && parseFloat(val) >= 0) {
                                      const recalced = calcItemFromTotal(next[idx], gstEnabled, val);
                                      next[idx] = { ...recalced, _totalEdit: val };
                                    }
                                    return next;
                                  });
                                }
                              }}
                              onBlur={() => {
                                setItems(prev => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], _totalEdit: undefined };
                                  return next;
                                });
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setItems(prev => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], _totalEdit: undefined };
                                    return next;
                                  });
                                  const isLast = idx === items.length - 1;
                                  if (isLast) addItem();
                                  setTimeout(() => productRefs.current[idx + 1]?.focus(), 50);
                                }
                              }}
                            />
                          ) : (
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fc(item.total)}</span>
                          )}
                        </td>
                        <td style={{ width: 28 }}>
                          <button
                            onClick={() => removeItem(idx)}
                            title="Remove"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#d1d5db', fontSize: 14, padding: '4px',
                              borderRadius: 4, lineHeight: 1, transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-outline btn-sm mt-3" onClick={addItem}>+ Add Another Item</button>
            </div>
          </div>

          {/* Payments */}
          <div className="card mb-5">
            <div className="card-header">
              <div className="card-title">💳 Payment Received</div>
              <button className="btn btn-outline btn-sm" onClick={addPayment}>+ Add Mode</button>
            </div>
            <div className="card-body">
              {payments.map((p, idx) => (
                <div key={idx} style={{ marginBottom: 10, background: '#f8fafc', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    {PAYMENT_MODES.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updatePayment(idx, { mode: m })}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700,
                          cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                          background: p.mode === m ? 'var(--primary)' : '#e5e7eb',
                          color: p.mode === m ? '#fff' : 'var(--text-muted)',
                          boxShadow: p.mode === m ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                        }}
                      >
                        {m === 'cash' ? '💵' : m === 'upi' ? '📱' : m === 'online' ? '🌐' : '💳'} {m.toUpperCase()}
                      </button>
                    ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 'auto', color: 'var(--danger)', fontSize: 12 }}
                      onClick={() => removePayment(idx)}
                    >✕ Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Amount ₹</div>
                      <input className="form-control" type="number" min="0" step="0.01" placeholder="0.00" value={p.amount} onChange={e => updatePayment(idx, { amount: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Ref / UPI ID</div>
                      <input className="form-control" placeholder="Optional reference" value={p.reference} onChange={e => updatePayment(idx, { reference: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <button className="btn btn-outline btn-sm" onClick={() => setPayments([{ mode: 'cash', amount: totalWithPrev.toFixed(2), reference: '' }])}>Full Cash</button>
                <button className="btn btn-outline btn-sm" onClick={() => setPayments([{ mode: 'upi', amount: totalWithPrev.toFixed(2), reference: '' }])}>Full UPI</button>
                <button className="btn btn-outline btn-sm" onClick={() => setPayments([{ mode: 'cash', amount: '', reference: '' }])}>Clear</button>
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="card mb-5">
            <div className="card-header">
              <div className="card-title">🏷️ Discount / Concession</div>
              {dis > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>− {fc(dis)} applied</span>}
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Discount Amount ₹ <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className="form-control" type="number" min="0" step="0.01"
                    value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0.00"
                  />
                  {dis > 0 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✅ Discount of {fc(dis)} will be deducted from the total</div>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Concession Reason <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className="form-control"
                    value={concessionReason} onChange={e => setConcessionReason(e.target.value)}
                    placeholder="e.g. Festival offer, loyal customer..."
                  />
                </div>
              </div>
              {dis > 0 && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  border: '1.5px solid #86efac', borderRadius: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                    Items Total: {fc(subtotal + gstTotal)}
                    <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>−</span>
                    Discount: {fc(dis)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>Net Total: {fc(total)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes / Remarks</label>
                <textarea className="form-control" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Summary */}
        <div>
          <div className="summary-box">
            <div className="summary-title">💰 Invoice Summary</div>
            <div className="summary-row"><span className="text-muted">Subtotal</span><span className="mono">{fc(subtotal)}</span></div>
            {gstEnabled && (
              <>
                <div className="summary-row"><span className="text-muted">CGST</span><span className="mono">{fc(gstTotal / 2)}</span></div>
                <div className="summary-row"><span className="text-muted">SGST</span><span className="mono">{fc(gstTotal / 2)}</span></div>
              </>
            )}

            {/* Vehicle + Labour in one row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>🚛 Vehicle ₹</label>
                <input className="form-control" type="number" min="0" step="0.01" value={vehicleCharge} onChange={e => setVehicleCharge(e.target.value)} placeholder="0.00" style={{ fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>👷 Labour ₹</label>
                <input className="form-control" type="number" min="0" step="0.01" value={labourCharge} onChange={e => setLabourCharge(e.target.value)} placeholder="0.00" style={{ fontSize: 13 }} />
              </div>
            </div>
            {(vc > 0 || lc > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12.5 }}>
                {vc > 0 && <span style={{ color: 'var(--warning)', fontWeight: 600 }}>🚛 +{fc(vc)}</span>}
                {lc > 0 && <span style={{ color: '#7c3aed', fontWeight: 600 }}>👷 +{fc(lc)}</span>}
              </div>
            )}

            {orderId && amtReceived > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, padding: '8px 12px', marginTop: 8, fontSize: 12.5 }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✅ Advance Included: {fc(amtReceived)}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>(from order)</span>
              </div>
            )}

            {dis > 0 && (
              <div className="summary-row text-success" style={{ marginTop: 4 }}>
                <span>🏷️ Discount</span>
                <span className="mono">- {fc(dis)}</span>
              </div>
            )}

            <div className="summary-row total"><span>Grand Total</span><span className="mono">{fc(total)}</span></div>
            {prevBalance > 0 && <div className="summary-row prev"><span>+ Prev. Balance</span><span className="mono">{fc(prevBalance)}</span></div>}
            {prevBalance > 0 && <div className="summary-row total" style={{ fontSize: 15 }}><span>Net Payable</span><span className="mono">{fc(totalWithPrev)}</span></div>}
            <hr className="divider" />
            <div className="summary-row paid"><span>Amount Received</span><span className="mono">{fc(amtReceived)}</span></div>
            <div className={`summary-row ${balanceDue > 0.01 ? 'due' : 'paid'}`}>
              <span>
                {balanceDue > 0.01 ? '⚠️ Balance Due' : balanceDue < -0.01 ? '💰 Excess Paid (Advance)' : '✅ Fully Paid'}
              </span>
              {Math.abs(balanceDue) > 0.01 && <span className="mono">{fc(Math.abs(balanceDue))}</span>}
            </div>

            {/* Signature */}
            <div className="card mb-4" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-title">✍️ Authorised Signature</div>
              </div>
              <div className="card-body">
                <div className="form-hint mb-2">Authorised person can sign here before generating invoice</div>
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#111827"
                  minWidth={1}
                  maxWidth={2.5}
                  throttle={16}
                  velocityFilterWeight={0.7}
                  canvasProps={{ width: 400, height: 150, className: "sigCanvas" }}
                />
                <div className="mt-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => sigRef.current.clear()}>
                    Clear Signature
                  </button>
                </div>
              </div>
            </div>

            <button
              className="btn btn-success btn-block btn-lg mt-3"
              onClick={handleSubmit}
              disabled={saving}
              style={{ justifyContent: 'center', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
            >
              {saving ? <><span className="spinner"></span> Creating...</> : '✅ Finalize & Create Invoice'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
              Signature required to finalize
            </div>
            <button className="btn btn-outline btn-block mt-2" onClick={() => navigate(-1)} style={{ justifyContent: 'center' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}