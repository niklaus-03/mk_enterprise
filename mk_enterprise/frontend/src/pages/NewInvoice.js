import React, { useState, useEffect, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productApi, customerApi, invoiceApi, dashboardApi, orderApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  User, Users, Phone, MapPin, Calendar, Truck, FileText, 
  FileSpreadsheet, CheckCircle, AlertTriangle, Plus, Trash2, 
  Monitor, Check, ArrowLeft, Receipt, FolderOpen, Inbox, 
  Clock, Tag, Wallet, PenTool, Save, Package 
} from 'lucide-react';
import { parseCustomerName, formatCustomerName, isHindi, applyAutoSuffix } from '../utils/nameFormatter';

import CustomerSelectStep from '../components/invoice/CustomerSelectStep';
import ProductGridStep from '../components/invoice/ProductGridStep';

const newItem = () => ({
  _key: Date.now() + Math.random(),
  product_id: '', product_name: '', qty: 0, weight: '', price: '0', gst: 0,
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

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'goods_exchange', 'others'];

export default function NewInvoice() {
  const { user } = useAuth();
  const userId = user?._id || 'global';
  const AUTO_DRAFT_KEY = `invoice_auto_draft_${userId}`;
  const DRAFTS_KEY = `invoice_drafts_${userId}`;
  const navigate = useNavigate();
  const { t, settings } = useApp();
  const { theme } = useTheme();
  const gstEnabled = settings.gst_enabled !== false;
  const discountEnabled = settings.discount_enabled !== false;
  
  const [step, setStep] = useState(1); // Wizard Steps: 1 = Customer Selection, 2 = Product Grid, 3 = Invoice & Payment Details
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([newItem()]);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('orderId');

  const sigRef = useRef();
  const nameRef = useRef();
  const phoneRef = useRef();
  const addressRef = useRef();

  const [customerMode, setCustomerMode] = useState('walkin');
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [walkIn, setWalkIn] = useState({ prefix: 'Shree', name: '', phone: '', address: '' });
  const [prevBalance, setPrevBalance] = useState(0);
  const [walkinMatch, setWalkinMatch] = useState(null);
  const [paymentConfirmModal, setPaymentConfirmModal] = useState(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState(false);
  const [walkinWarningModal, setWalkinWarningModal] = useState(null);
  const [allPendingDues, setAllPendingDues] = useState([]);
  const [payments, setPayments] = useState([{ mode: 'cash', amount: '', reference: '' }]);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [concessionReason, setConcessionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState(null);
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [vehicleCharge, setVehicleCharge] = useState('');
  const [labourCharge, setLabourCharge] = useState('');
  const [isManualBill, setIsManualBill] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

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

  // Load order parameter (if navigated from orders screen)
  useEffect(() => {
    if (!orderId) return;
    const loadOrder = async () => {
      try {
        const order = await orderApi.getById(orderId);
        setCustomerMode('walkin');
        const parsed = parseCustomerName(order.customer_name);
        setWalkIn({ prefix: parsed.prefix, name: parsed.name, phone: order.customer_phone, address: '' });
        const orderItems = order.items.map(i => {
          const base = newItem();
          const filled = { ...base, product_id: i.product_id || '', product_name: i.product_name, qty: i.qty || 1, price: i.price || '' };
          return calcItem(filled, gstEnabled);
        });
        setItems(orderItems);
        if (order.advance_paid && order.advance_paid > 0) {
          setPayments([{ mode: order.advance_mode || 'cash', amount: String(order.advance_paid), reference: 'Advance from order' }]);
        }
        setStep(3); // jump directly to details page when order is loaded
        toast.success('Order loaded — items, price & advance pre-filled');
      } catch (err) {
        console.error(err);
        toast.error('Failed to load order');
      }
    };
    loadOrder();
  }, [orderId, gstEnabled]);

  // Auto-save progress draft locally
  useEffect(() => {
    if (!isDraftLoaded) return;
    const hasProgress = items.some(i => i.product_name) || walkIn.name || walkIn.phone || customerId;
    if (!hasProgress) return;
    const draft = {
      items, customerMode, customerId, walkIn, payments, discount,
      concessionReason, notes, driverName, vehicleNumber, totalWeight, vehicleCharge,
      labourCharge, billDate, isManualBill, manualBillRef, savedAt: Date.now(),
    };
    localStorage.setItem(AUTO_DRAFT_KEY, JSON.stringify(draft));
  }, [items, customerMode, customerId, walkIn, payments, discount, notes,
    driverName, vehicleNumber, totalWeight, vehicleCharge, labourCharge, billDate, isManualBill, manualBillRef, isDraftLoaded]);

  // Load customers
  useEffect(() => {
    customerApi.getAll({ limit: 500 }).then(res => {
      const list = Array.isArray(res) ? res : (res?.customers || res?.data || []);
      setCustomers(list);
    }).catch(err => {
      console.error('[NewInvoice] customer fetch failed:', err);
    });
  }, []);

  // Load pending dues for walk-ins
  useEffect(() => {
    dashboardApi.get().then(d => {
      setAllPendingDues(d.pendingCustomers || []);
    }).catch(() => { });
  }, []);

  // Load drafts list
  useEffect(() => {
    let stored = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    if (!Array.isArray(stored)) stored = [];
    setDrafts(stored);
  }, []);

  // Restore auto-draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(AUTO_DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - draft.savedAt <= sevenDays) {
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
          setTotalWeight(draft.totalWeight || '');
          setVehicleCharge(draft.vehicleCharge || '');
          setLabourCharge(draft.labourCharge || '');
          setBillDate(draft.billDate || getISTDateTime());
          setIsManualBill(draft.isManualBill || false);
          setManualBillRef(draft.manualBillRef || '');
          
          // Determine the logical step to resume
          if (draft.customerId || draft.customerMode === 'walkin') {
            if (draft.items && draft.items.length > 0 && draft.items.some(i => i.product_name)) {
              setStep(3);
            } else {
              setStep(2);
            }
          } else {
            setStep(1);
          }
        } else {
          localStorage.removeItem(AUTO_DRAFT_KEY);
        }
      } catch {
        localStorage.removeItem(AUTO_DRAFT_KEY);
      }
    }
    setIsDraftLoaded(true);
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

  // Walk-in phone duplicate protection and auto-switch
  useEffect(() => {
    if (customerMode !== 'walkin') return;
    let phoneRaw = (walkIn.phone || '').replace(/\D/g, '');
    
    let phone = phoneRaw;
    if (phone.length > 10 && phone.startsWith('91')) phone = phone.slice(2);
    else if (phone.length > 10 && phone.startsWith('0')) phone = phone.slice(1);
    if (phone.length > 10) phone = phone.slice(-10);

    if (phone.length < 10) { setWalkinMatch(null); return; }

    const registeredMatch = customers.find(c => {
      let cp = (c.phone || '').replace(/\D/g, '');
      if (cp.length > 10 && cp.startsWith('91')) cp = cp.slice(2);
      else if (cp.length > 10 && cp.startsWith('0')) cp = cp.slice(1);
      if (cp.length > 10) cp = cp.slice(-10);
      return cp === phone;
    });

    if (registeredMatch) {
      setWalkinWarningModal({
        title: "⚠️ DISCLAIMER:",
        message: `This phone number belongs to registered customer "${registeredMatch.name}" (Balance: ₹${registeredMatch.balance?.toFixed(2) || 0}).\n\nAutomatically switching to their account to prevent duplicate walk-in entries.`
      });
      setCustomerMode('existing');
      setCustomerId(registeredMatch._id);
      setCustomerSearch(`${registeredMatch.name} (${registeredMatch.phone || ''})`);
      setPrevBalance(registeredMatch.balance || 0);
      setWalkinMatch(null);
      return;
    }

    const walkinDueMatch = allPendingDues.find(c => {
      if (c.type !== 'walkin' || (c.balance || 0) <= 0.01) return false;
      let cp = (c.phone || '').replace(/\D/g, '');
      if (cp.length > 10 && cp.startsWith('91')) cp = cp.slice(2);
      else if (cp.length > 10 && cp.startsWith('0')) cp = cp.slice(1);
      if (cp.length > 10) cp = cp.slice(-10);
      return cp === phone;
    });

    if (walkinDueMatch) {
      setWalkinWarningModal({
        title: "⚠️ DISCLAIMER:",
        message: `This phone number already has pending walk-in dues of ₹${walkinDueMatch.balance?.toFixed(2)} under the name "${walkinDueMatch.name}".\n\nCarrying this balance forward to the current bill!`
      });
      setPrevBalance(walkinDueMatch.balance || 0);
      setWalkinMatch(null);
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

  // Auto-calculate total weight from items whenever items change
  useEffect(() => {
    const autoWeight = items.reduce((sum, item) => {
      let wpv = parseFloat(item.weight);
      if (isNaN(wpv) || wpv === 0) {
        // Fallback based on unit if weight_per_unit is not set
        const unit = (item.unit || '').toLowerCase();
        if (unit === 'kg' || unit === 'kgs' || unit === 'kilo') {
          wpv = parseFloat(item.qty) || 0;
        } else if (unit === 'gm' || unit === 'g' || unit === 'gram' || unit === 'grams') {
          wpv = (parseFloat(item.qty) || 0) / 1000;
        } else if (unit === 'ton' || unit === 'tonne' || unit === 'tons') {
          wpv = (parseFloat(item.qty) || 0) * 1000;
        } else if (unit === 'ltr' || unit === 'l' || unit === 'liter' || unit === 'liters') {
          wpv = parseFloat(item.qty) || 0; // approx 1kg per ltr
        } else if (unit === 'ml') {
          wpv = (parseFloat(item.qty) || 0) / 1000;
        } else {
          wpv = 0;
        }
      }
      return sum + wpv;
    }, 0);
    if (autoWeight > 0) {
      setTotalWeight(parseFloat(autoWeight.toFixed(2)).toString());
    }
  }, [items]);

  const loadDraft = (draft) => {
    setItems(draft.items || [newItem()]);
    setCustomerMode(draft.customerMode || 'walkin');
    setCustomerId(draft.customerId || '');
    if (draft.customerMode === 'existing') {
      const customer = customers.find(c => c._id === draft.customerId);
      setCustomerSearch(customer ? `${customer.name} (${customer.phone || ''})` : draft.customerName || '');
    }
    setWalkIn(draft.walkIn || { prefix: 'Shree', name: '', phone: '', address: '' });
    setPayments(draft.payments || [{ mode: 'cash', amount: '', reference: '' }]);
    setDiscount(draft.discount || '');
    setNotes(draft.notes || '');
    setDriverName(draft.driverName || '');
    setVehicleNumber(draft.vehicleNumber || '');
    setTotalWeight(draft.totalWeight || '');
    setVehicleCharge(draft.vehicleCharge || '');
    setLabourCharge(draft.labourCharge || '');
    setBillDate(draft.billDate || getISTDateTime());
    setIsManualBill(draft.isManualBill || false);
    setManualBillRef(draft.manualBillRef || '');
    setLoadedDraftId(draft.id);
    setShowDrafts(false);
    setStep(3); // go straight to step 3 details
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

  const saveDraft = (itemsToSave) => {
    const targetItems = Array.isArray(itemsToSave) ? itemsToSave : items;
    let existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    if (!Array.isArray(existing)) existing = [];
    const customerName = customerMode === 'existing'
      ? customers.find(c => c._id === customerId)?.name || 'Customer'
      : (walkIn.name ? formatCustomerName(walkIn.prefix, walkIn.name) : 'Walk-in Customer');
    const validItems = targetItems.filter(i => i.product_name && i.price && parseFloat(i.qty) > 0);
    const totalAmount = validItems.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    const newDraft = {
      id: Date.now(), customerName, totalAmount, itemCount: validItems.length,
      items: targetItems, customerMode, customerId, walkIn, payments, discount, notes,
      driverName, vehicleNumber, totalWeight, vehicleCharge, labourCharge,
      billDate, isManualBill, manualBillRef, savedAt: Date.now(),
    };
    const updated = [newDraft, ...existing];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
    setDrafts(updated);
    toast.success('Draft saved!');
  };

  const getCustomerInfo = (finalPayments = payments) => {
    if (customerMode === 'existing' && customerId) {
      const c = customers.find(c => c._id === customerId);
      return { customer_id: customerId, customer_name: c?.name || '', customer_phone: c?.phone || '', customer_address: c?.address || '' };
    }
    
    // Calculate balance to see if fully paid
    const sub = items.reduce((s, i) => s + (i.taxable_amount || 0), 0);
    const gstT = gstEnabled ? items.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0) : 0;
    const d = parseFloat(discount) || 0;
    const v = parseFloat(vehicleCharge) || 0;
    const l = parseFloat(labourCharge) || 0;
    const tot = Math.max(0, sub + gstT - d) + v + l;
    const totPrev = tot + prevBalance;
    const recv = finalPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    
    let defaultName = 'Walk-in Customer';
    if (totPrev - recv <= 0.01) {
      defaultName = 'Anonymous Customer';
    }

    return { 
      customer_id: null, 
      customer_name: walkIn.name ? formatCustomerName(walkIn.prefix, walkIn.name) : defaultName, 
      customer_phone: walkIn.phone, 
      customer_address: walkIn.address 
    };
  };

  const processSubmit = async (finalPayments) => {
    setSaving(true);
    try {
      const rawItems = items.map(({ _key, taxable_amount, cgst, sgst, total, ...i }) => ({
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
        ...getCustomerInfo(finalPayments),
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
        payments: finalPayments.filter(p => parseFloat(p.amount) > 0).map(p => ({ ...p, amount: parseFloat(p.amount) })),
        discount: dis,
        concession_reason: concessionReason,
        notes,
        gst_enabled: gstEnabled,
        discount_enabled: discountEnabled,
        driver_name: driverName,
        vehicle_number: vehicleNumber,
        total_weight: totalWeight,
        vehicle_charge: vc,
        labour_charge: lc,
        bill_date: billDate,
        is_manual_bill: isManualBill,
        manual_bill_ref: manualBillRef,
        signature: sigRef.current.toDataURL("image/png"),
      };

      const invoice = await invoiceApi.create(payload);
      toast.success('Invoice created!');
      localStorage.removeItem(AUTO_DRAFT_KEY);

      // Auto-register walk-in if 10 digit number and name is provided
      if (customerMode === 'walkin' && walkIn.phone?.length === 10 && walkIn.name?.trim()) {
        const alreadyExists = customers.find(c =>
          (c.phone || '').replace(/\D/g, '') === walkIn.phone.replace(/\D/g, '')
        );
        if (!alreadyExists) {
          customerApi.create({
            name: formatCustomerName(walkIn.prefix, walkIn.name).trim(),
            phone: walkIn.phone,
            address: walkIn.address?.trim() || '',
            balance: invoice.balance_due > 0.01 ? invoice.balance_due : 0,
          }).catch(() => { });
        }
      }

      // Delete drafts
      if (loadedDraftId) {
        const existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
        const cleaned = existing.filter(d => d.id !== loadedDraftId);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleaned));
        setDrafts(cleaned);
      }

      navigate(`/invoices/${invoice._id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to save invoice');
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    const filledItems = items.filter(i => i.product_name && parseFloat(i.qty) > 0);
    if (filledItems.length === 0) return toast.error('Add at least one valid item');
    if (customerMode === 'existing' && !customerId) return toast.error('Select a customer');
    if (!sigRef.current || sigRef.current.isEmpty()) return toast.error("Authorised signature is required");

    const currentAmtReceived = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const balanceDue = totalWithPrev - currentAmtReceived;

    if (balanceDue > 0) {
      if (customerMode === 'walkin' && currentAmtReceived === 0) {
        setPaymentConfirmModal({
          title: "⚠️ Unpaid Walk-in Bill",
          message: `You haven't entered any payment for this Walk-in bill.\n\nDo you want to automatically record this as FULLY PAID IN CASH (₹${totalWithPrev.toFixed(2)})?`,
          type: 'walkin_zero'
        });
        return;
      } else {
        setPaymentConfirmModal({
          title: "⚠️ Pending Due Confirmation",
          message: currentAmtReceived === 0
            ? `You haven't entered any payment for this bill.\n\nThe full amount of ₹${totalWithPrev.toFixed(2)} will be added to the customer's pending due.\n\nProceed?`
            : `You have entered a partial payment of ₹${currentAmtReceived.toFixed(2)}.\n\nThe remaining balance of ₹${balanceDue.toFixed(2)} will be added to the customer's pending due.\n\nProceed?`,
          type: 'partial_or_existing'
        });
        return;
      }
    }

    processSubmit(payments);
  };

  const handleWalkInNameBlur = () => {
    // setWalkIn(prev => ({ ...prev, name: applyAutoSuffix(prev.name) }));
  };

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

  const cancelBill = () => {
    setCancelConfirmModal(true);
  };

  const confirmCancelBill = () => {
    localStorage.removeItem(AUTO_DRAFT_KEY);
    setItems([newItem()]);
    setCustomerMode('walkin');
    setCustomerId('');
    setWalkIn({ prefix: 'Shree', name: '', phone: '', address: '' });
    setPayments([{ mode: 'cash', amount: '', reference: '' }]);
    setDiscount('');
    setConcessionReason('');
    setNotes('');
    setDriverName('');
    setVehicleNumber('');
    setTotalWeight('');
    setVehicleCharge('');
    setLabourCharge('');
    setIsManualBill(false);
    setManualBillRef('');
    setStep(1);
    setCancelConfirmModal(false);
    toast.success("Bill cancelled and cleared.");
  };

  const selectedCustomer = customers.find(c => c._id === customerId);

  // ── Render Wizard Steps ───────────────────────────────────────────────────

  if (step === 1) {
    return (
      <CustomerSelectStep
        customers={customers}
        onSelectCustomer={(customer) => {
          setCustomerMode('existing');
          setCustomerId(customer._id);
          setCustomerSearch(customer.name);
          setPrevBalance(customer.balance || 0);
          setStep(2);
        }}
        onWalkIn={() => {
          setCustomerMode('walkin');
          setCustomerId('');
          setWalkIn({ prefix: 'Shree', name: '', phone: '', address: '' });
          setStep(2);
        }}
        onBack={() => navigate(-1)}
        onCustomerCreated={(customer) => {
          setCustomers(prev => [customer, ...prev]);
          setCustomerMode('existing');
          setCustomerId(customer._id);
          setCustomerSearch(customer.name);
          setPrevBalance(customer.balance || 0);
          setStep(2);
        }}
      />
    );
  }

  if (step === 2) {
    const initialItemsMapped = items
      .filter(i => i.product_name && i.product_id)
      .map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        qty: parseFloat(i.qty) || 0,
        price: parseFloat(i.price) || 0,
        gst: parseFloat(i.gst) || 0,
        unit: i.unit || 'bag',
        stock: 9999,
        weight_per_unit: i.weight_per_unit || '',
        _isNew: i._isNew || false,
      }));

    return (
      <ProductGridStep
        selectedCustomer={selectedCustomer}
        walkInData={customerMode === 'walkin' ? walkIn : null}
        initialItems={initialItemsMapped}
        onBack={() => setStep(1)}
        onSaveDraft={(selectedProducts) => {
          const mappedItems = selectedProducts.map(p => {
            const item = {
              _key: Date.now() + Math.random(),
              product_id: p.product_id,
              product_name: p.product_name,
              qty: p.qty,
              price: p.price,
              gst: p.gst,
              unit: p.unit || 'bag',
              weight_per_unit: p.weight_per_unit || '',
              weight: p.weight_per_unit ? (p.qty * p.weight_per_unit) : '',
              adjustment: 0,
            };
            return calcItem(item, gstEnabled);
          });
          setItems(mappedItems);
          saveDraft(mappedItems);
        }}
        onNext={(selectedProducts) => {
          const mappedItems = selectedProducts.map(p => {
            const item = {
              _key: Date.now() + Math.random(),
              product_id: p.product_id,
              product_name: p.product_name,
              qty: p.qty,
              price: p.price,
              gst: p.gst,
              unit: p.unit || 'bag',
              weight_per_unit: p.weight_per_unit || '',
              weight: p.weight_per_unit ? (p.qty * p.weight_per_unit) : '',
              adjustment: 0,
            };
            return calcItem(item, gstEnabled);
          });
          setItems(mappedItems);
          setStep(3);
        }}
        onCancel={cancelBill}
        gstEnabled={gstEnabled}
      />
    );
  }

  
  // Step 3 layout (Payment & Adjustments)
  if (step === 3) {
    return (
      <div style={{ paddingBottom: '60px' }}>
        {/* Step 3 Header bar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 20,
        background: 'var(--bg-card)', borderRadius: 12, padding: '12px 18px',
        border: '1.5px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={17} style={{ color: 'var(--primary)' }} />{t('Payment & Adjustments', 'भुगतान और समायोजन')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{t('Enter payments, transportation charges, and discounts', 'भुगतान, परिवहन शुल्क और छूट दर्ज करें')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrafts(v => !v); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: showDrafts ? 'var(--primary)' : 'var(--border)',
                border: showDrafts ? 'none' : '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600,
                color: showDrafts ? 'var(--bg-card)' : 'var(--text-muted)',
                boxShadow: showDrafts ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <FolderOpen size={12.5} /> Drafts
              {drafts.length > 0 && (
                <span style={{
                  background: showDrafts ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                  color: 'var(--bg-card)', borderRadius: 10, padding: '1px 6px', fontSize: 10,
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
                background: 'var(--border)', border: '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              <FileSpreadsheet size={12.5} />{t('Orders', 'ऑर्डर')}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={cancelBill}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--danger-light)', border: '1.5px solid #fecaca',
              color: '#dc2626', transition: 'all 0.15s',
            }}
          >
            <Trash2 size={14} />{t('Cancel Bill', 'बिल रद्द करें')}</button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn btn-outline"
            style={{ borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />{t('Back to Products', 'उत्पादों पर वापस')}</button>
          <button
            type="button"
            onClick={() => setStep(4)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--sidebar-bg)',
              border: 'none', color: 'var(--bg-card)',
              boxShadow: '0 2px 10px rgba(22,163,74,0.35)',
              transition: 'all 0.15s',
            }}
          >{t('Review & Finalize', 'समीक्षा और अंतिम रूप')}<Check size={14} />
          </button>
        </div>
      </div>

      
        {/* Drafts panel */}
      {showDrafts && (
        <div className="card mb-3 animate-fade-in" style={{ border: '1.5px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center' }}>
              <FolderOpen size={14.5} style={{ marginRight: 6 }} /> Saved Drafts
              {drafts.length > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--primary)', color: 'var(--bg-card)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                  {drafts.length}
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={() => setShowDrafts(false)}>✕ Close</button>
          </div>
          <div style={{ padding: drafts.length === 0 ? 24 : '8px 12px' }}>
            {drafts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Inbox size={28} className="text-muted" style={{ marginBottom: 8 }} />
                <div>No drafts saved yet. Click "Save Draft" to save one.</div>
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
                        background: 'var(--bg)', border: '1.5px solid var(--border)',
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
                           <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: '1px 7px' }}>Draft</span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                           <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {savedDate}</span>
                           <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileSpreadsheet size={12} /> {d.itemCount || 0} items</span>
                           <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{formatCurrency(d.totalAmount || 0)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-primary btn-sm" onClick={() => loadDraft(d)}><FolderOpen size={12} /> Load</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteDraft(d.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      
        <div className="row g-4 mt-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Payments Section Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} style={{ color: 'var(--success)' }} />{t('Payment Records', 'भुगतान रिकॉर्ड')}</div>
              <button 
                onClick={addPayment}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', fontWeight: '700' }}
              >
                + Add Mode
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {payments.map((p, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    background: 'var(--bg-hover)', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    border: '1.5px solid var(--border)',
                    position: 'relative'
                  }}
                >
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePayment(idx)}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Remove Payment"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: payments.length > 1 ? '16px' : 0 }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Mode</div>
                      <select
                        className="form-control"
                        value={p.mode}
                        onChange={e => updatePayment(idx, { mode: e.target.value })}
                        style={{ height: '38px', borderRadius: '6px' }}
                      >
                        {PAYMENT_MODES.map(m => (
                          <option key={m} value={m}>{m.toUpperCase().replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Amount (₹)</div>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="0.00"
                        value={p.amount}
                        onChange={e => updatePayment(idx, { amount: e.target.value })}
                        style={{ height: '38px', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Ref / UPI Transaction ID</div>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t('Optional', 'वैकल्पिक')}
                        value={p.reference}
                        onChange={e => updatePayment(idx, { reference: e.target.value })}
                        style={{ height: '38px', borderRadius: '6px' }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }} onClick={() => setPayments([{ mode: 'cash', amount: totalWithPrev.toFixed(2), reference: '' }])}>{t('Full Cash', 'पूरा नकद')}</button>
                <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }} onClick={() => setPayments([{ mode: 'upi', amount: totalWithPrev.toFixed(2), reference: '' }])}>{t('Full UPI', 'पूरा यूपीआई')}</button>
                <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }} onClick={() => setPayments([{ mode: 'cash', amount: '', reference: '' }])}>{t('Clear Amount', 'राशि साफ़ करें')}</button>
              </div>
            </div>
          </div>

          
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} style={{ color: 'var(--primary)' }} />{t('Logistics & Delivery Info', 'लॉजिस्टिक्स और डिलीवरी जानकारी')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="form-group mb-0">
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600' }}><Truck size={13} /> {t('Vehicle Number', 'वाहन संख्या')}</label>
                <input
                  className="form-control"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. UK04CB0199"
                  style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600' }}><User size={13} /> {t('Driver Name', 'ड्राइवर का नाम')}</label>
                <input
                  className="form-control"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder={t('Enter driver name...', 'ड्राइवर का नाम दर्ज करें...')}
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: '600' }}><Package size={13} /> {t('Total Weight', 'कुल वजन')}</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    style={{ border: 'none', borderRadius: 0, flex: 1, padding: '6px' }}
                    value={totalWeight}
                    onChange={e => setTotalWeight(e.target.value)}
                    placeholder={t('Auto-calculated', 'स्वत: गणना')}
                  />
                  <span style={{ padding: '0 10px', background: 'var(--bg)', borderLeft: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>kg</span>
                </div>
              </div>
            </div>
          </div>

            {/* Discount & Remarks Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>{t('Discount Amount (₹)', 'छूट राशि (₹)')}</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  placeholder="0.00 (optional)"
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>{t('Concession Reason', 'रियायत का कारण')}</label>
                <input
                  className="form-control"
                  value={concessionReason}
                  onChange={e => setConcessionReason(e.target.value)}
                  placeholder={t('e.g. Loyal customer (optional)', 'जैसे: नियमित ग्राहक (वैकल्पिक)')}
                />
              </div>
              <div className="form-group mb-0" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>{t('Notes / Remarks', 'नोट्स / टिप्पणी')}</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('Any additional remarks...', 'कोई अतिरिक्त टिप्पणी...')}
                />
              </div>
            </div>
          </div>

        
          </div>
          <div style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Summary Panel */}
          <div className="position-sticky" style={{ top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '16px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={18} />{t('Billing Summary', 'बिलिंग सारांश')}</span>
                <span style={{ fontSize: '11px', background: 'var(--primary)', color: 'var(--bg-card)', padding: '3px 8px', borderRadius: '12px' }}>
                  {items.length} Items
                </span>
              </h4>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('Subtotal (Before Tax)', 'उप-कुल (कर से पहले)')}</span>
                  <strong style={{ fontFamily: 'monospace' }}>{fc(subtotal)}</strong>
                </li>

                {gstEnabled && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Central GST (CGST)</span>
                      <span style={{ fontFamily: 'monospace' }}>{fc(gstTotal / 2)}</span>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>State GST (SGST)</span>
                      <span style={{ fontFamily: 'monospace' }}>{fc(gstTotal / 2)}</span>
                    </li>
                  </>
                )}

                {/* Extra charges */}
                <li style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Transportation & Labour</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>{t('Vehicle ₹', 'वाहन ₹')}</label>
                      <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={vehicleCharge} onChange={e => setVehicleCharge(e.target.value)} placeholder="0.00" style={{ height: '30px', padding: '4px 6px', fontSize: '12px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>{t('Labour ₹', 'श्रम ₹')}</label>
                      <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={labourCharge} onChange={e => setLabourCharge(e.target.value)} placeholder="0.00" style={{ height: '30px', padding: '4px 6px', fontSize: '12px' }} />
                    </div>
                  </div>
                </li>

                {dis > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '14px', background: 'var(--success-light)', padding: '8px 12px', borderRadius: '8px', border: '1px dashed #a7f3d0' }}>
                    <span style={{ fontWeight: '700' }}>Discount Applied</span>
                    <strong style={{ fontFamily: 'monospace' }}>- {fc(dis)}</strong>
                  </li>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Grand Total', 'कुल राशि')}</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '17px', fontFamily: 'monospace' }}>{fc(total)}</strong>
                </li>

                {prevBalance !== 0 && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--bg-hover)', padding: '6px 12px', borderRadius: '6px' }}>
                      <span style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' }}>
                        {prevBalance > 0 ? '⚠️ Previous Due' : '✅ Previous Advance'}
                      </span>
                      <strong style={{ fontFamily: 'monospace' }}>{fc(prevBalance)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Net Payable', 'देय राशि')}</span>
                      <strong style={{ color: 'var(--text)', fontSize: '17px', fontFamily: 'monospace' }}>{fc(totalWithPrev)}</strong>
                    </li>
                  </>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>{t('Amount Paid', 'भुगतान की गई राशि')}</span>
                  <strong style={{ fontFamily: 'monospace' }}>{fc(amtReceived)}</strong>
                </li>

                <li 
                  className={balanceDue > 0.01 ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '15px', 
                    padding: '12px', 
                    borderRadius: '8px',
                    background: balanceDue > 0.01 ? 'var(--danger-light)' : 'var(--success-light)',
                    color: balanceDue > 0.01 ? 'var(--danger)' : 'var(--success)',
                    border: '1.5px solid var(--border)'
                  }}
                >
                  <span style={{ fontWeight: '800' }}>
                    {balanceDue > 0.01 ? 'Balance Due' : balanceDue < -0.01 ? 'Excess Paid' : 'Fully Paid'}
                  </span>
                  <strong style={{ fontSize: '17px', fontFamily: 'monospace' }}>{fc(Math.abs(balanceDue))}</strong>
                </li>
              </ul>
            </div>

            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 20px 20px 20px' }}>
              <button
                className="btn btn-primary"
                onClick={() => setStep(4)}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '16px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >{t('Review & Finalize', 'समीक्षा और अंतिम रूप')}</button>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 4 layout (Review & Finalize)
  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Step 3 Header bar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 20,
        background: 'var(--bg-card)', borderRadius: 12, padding: '12px 18px',
        border: '1.5px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={17} style={{ color: 'var(--primary)' }} /> Bill Details & Review
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Review items and adjust transportation, payments & signature
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrafts(v => !v); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: showDrafts ? 'var(--primary)' : 'var(--border)',
                border: showDrafts ? 'none' : '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600,
                color: showDrafts ? 'var(--bg-card)' : 'var(--text-muted)',
                boxShadow: showDrafts ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <FolderOpen size={12.5} /> Drafts
              {drafts.length > 0 && (
                <span style={{
                  background: showDrafts ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                  color: 'var(--bg-card)', borderRadius: 10, padding: '1px 6px', fontSize: 10,
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
                background: 'var(--border)', border: '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              <FileSpreadsheet size={12.5} />{t('Orders', 'ऑर्डर')}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={cancelBill}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--danger-light)', border: '1.5px solid #fecaca',
              color: '#dc2626', transition: 'all 0.15s',
            }}
          >
            <Trash2 size={14} />{t('Cancel Bill', 'बिल रद्द करें')}</button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="btn btn-outline"
            style={{ borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to Payments
          </button>
          <button
            type="button"
            onClick={() => saveDraft(items)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--sidebar-bg)',
              border: 'none', color: 'var(--bg-card)',
              boxShadow: '0 2px 10px rgba(22,163,74,0.35)',
              transition: 'all 0.15s',
            }}
          >
            <Save size={14} /> Save Draft
          </button>
        </div>
      </div>

      
      {/* Drafts panel */}
      {showDrafts && (
        <div className="card mb-3 animate-fade-in" style={{ border: '1.5px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center' }}>
              <FolderOpen size={14.5} style={{ marginRight: 6 }} /> Saved Drafts
              {drafts.length > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--primary)', color: 'var(--bg-card)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                  {drafts.length}
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={() => setShowDrafts(false)}>✕ Close</button>
          </div>
          <div style={{ padding: drafts.length === 0 ? 24 : '8px 12px' }}>
            {drafts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Inbox size={28} className="text-muted" style={{ marginBottom: 8 }} />
                <div>No drafts saved yet. Click "Save Draft" to save one.</div>
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
                        background: 'var(--bg)', border: '1.5px solid var(--border)',
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
                           <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: '1px 7px' }}>Draft</span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                           <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {savedDate}</span>
                           <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileSpreadsheet size={12} /> {d.itemCount || 0} items</span>
                           <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{formatCurrency(d.totalAmount || 0)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-primary btn-sm" onClick={() => loadDraft(d)}><FolderOpen size={12} /> Load</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteDraft(d.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      
      <div className="row g-4 mt-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Customer Summary Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} style={{ color: 'var(--primary)' }} />{t('Customer & Bill Details', 'ग्राहक और बिल विवरण')}</div>
              <button 
                onClick={() => setStep(1)}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', fontWeight: '700' }}
              >{t('Change Customer', 'ग्राहक बदलें')}</button>
            </div>
            
            {customerMode === 'existing' && selectedCustomer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--sidebar-bg)', color: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                    {selectedCustomer.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('Registered Customer', 'पंजीकृत ग्राहक')}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '12px', padding: '12px', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '13px' }}>
                  {selectedCustomer.phone && <div><strong>Phone:</strong> +91 {selectedCustomer.phone}</div>}
                  {selectedCustomer.address && <div><strong>Address:</strong> {selectedCustomer.address}</div>}
                  {prevBalance !== 0 && (
                    <div style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' }}>
                      {prevBalance > 0 ? 'Pending Due:' : 'Advance Balance:'} {formatCurrency(Math.abs(prevBalance))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>
                  Walk-in Customer Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Walk-in Name</label>
                    <input
                      className="form-control"
                      value={walkIn.name || ''}
                      onChange={e => setWalkIn({ ...walkIn, name: e.target.value })}
                      onBlur={handleWalkInNameBlur}
                      placeholder="Enter customer name..."
                    />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Walk-in Phone</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                      <span style={{ padding: '6px 8px', background: 'var(--bg)', borderRight: '1px solid var(--border)', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>+91</span>
                      <input
                        className="form-control"
                        style={{ border: 'none', borderRadius: 0, padding: '6px' }}
                        value={walkIn.phone || ''}
                        onChange={e => setWalkIn({ ...walkIn, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10-digit number"
                      />
                    </div>
                  </div>
                  <div className="form-group mb-0" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>{t('Address', 'पता')}</label>
                    <input
                      className="form-control"
                      value={walkIn.address || ''}
                      onChange={e => setWalkIn({ ...walkIn, address: e.target.value })}
                      placeholder="Enter address..."
                    />
                  </div>
                </div>
              </div>
            )}

            <hr className="divider" style={{ margin: '20px 0' }} />

            {/* Bill Type & Driver row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Bill Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className={`btn btn-sm ${!isManualBill ? 'btn-primary' : 'btn-outline'} d-inline-flex align-items-center gap-1`} style={{ flex: 1 }} onClick={() => setIsManualBill(false)}><Monitor size={12} />{t('Digital', 'डिजिटल')}</button>
                  <button type="button" className={`btn btn-sm ${isManualBill ? 'btn-warning' : 'btn-outline'} d-inline-flex align-items-center gap-1`} style={{ flex: 1 }} onClick={() => setIsManualBill(true)}><FileText size={12} />{t('Manual', 'मैनुअल')}</button>
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Bill Date</label>
                <input className="form-control" type="datetime-local" value={billDate} max={new Date().toISOString().slice(0, 16)} onChange={e => setBillDate(e.target.value)} />
              </div>
              {isManualBill && (
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Manual Ref. No.</label>
                  <input className="form-control" value={manualBillRef} onChange={e => setManualBillRef(e.target.value)} placeholder="e.g. HW-042" />
                </div>
              )}
            </div>

            {/* Removed Logistics inputs from Step 4 */}
          </div>

          
          {/* Selected Items Summary Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: 'var(--primary)' }} /> Selected Products ({items.length})
              </div>
              <button 
                onClick={() => setStep(2)}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', fontWeight: '700' }}
              >{t('Edit Products', 'उत्पाद संपादित करें')}</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {items.map((item, idx) => (
                <div 
                  key={item._key || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--bg-hover)',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border)',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.product_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {item.qty} {item.unit || 'bag'} × {formatCurrency(item.price)}
                      {item.weight && <span style={{ marginLeft: '12px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{item.weight} kg</span>}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', fontFamily: 'monospace' }}>
                      {formatCurrency(item.total)}
                    </div>
                    {item.gst > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        Incl. GST ({item.gst}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          
        </div>
        <div style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Panel */}
          <div className="position-sticky" style={{ top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '16px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={18} />{t('Billing Summary', 'बिलिंग सारांश')}</span>
                <span style={{ fontSize: '11px', background: 'var(--primary)', color: 'var(--bg-card)', padding: '3px 8px', borderRadius: '12px' }}>
                  {items.length} Items
                </span>
              </h4>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('Subtotal (Before Tax)', 'उप-कुल (कर से पहले)')}</span>
                  <strong style={{ fontFamily: 'monospace' }}>{fc(subtotal)}</strong>
                </li>

                {gstEnabled && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Central GST (CGST)</span>
                      <span style={{ fontFamily: 'monospace' }}>{fc(gstTotal / 2)}</span>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>State GST (SGST)</span>
                      <span style={{ fontFamily: 'monospace' }}>{fc(gstTotal / 2)}</span>
                    </li>
                  </>
                )}

                {/* Logistics & Delivery Summary (Read-Only) */}
                {(vehicleCharge > 0 || labourCharge > 0 || vehicleNumber || driverName || totalWeight > 0) && (
                  <li style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Logistics & Delivery</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      {vehicleNumber && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Vehicle</span><span style={{ fontWeight: '600' }}>{vehicleNumber}</span></div>}
                      {driverName && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Driver</span><span style={{ fontWeight: '600' }}>{driverName}</span></div>}
                      {totalWeight > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Total Weight</span><span style={{ fontWeight: '600' }}>{totalWeight} kg</span></div>}
                      {vehicleCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span style={{ color: 'var(--text-muted)' }}>Vehicle Charge</span><span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{fc(vehicleCharge)}</span></div>}
                      {labourCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Labour Charge</span><span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{fc(labourCharge)}</span></div>}
                    </div>
                  </li>
                )}

                {dis > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '14px', background: 'var(--success-light)', padding: '8px 12px', borderRadius: '8px', border: '1px dashed #a7f3d0' }}>
                    <span style={{ fontWeight: '700' }}>Discount Applied</span>
                    <strong style={{ fontFamily: 'monospace' }}>- {fc(dis)}</strong>
                  </li>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Grand Total', 'कुल राशि')}</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '17px', fontFamily: 'monospace' }}>{fc(total)}</strong>
                </li>

                {prevBalance !== 0 && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--bg-hover)', padding: '6px 12px', borderRadius: '6px' }}>
                      <span style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' }}>
                        {prevBalance > 0 ? '⚠️ Previous Due' : '✅ Previous Advance'}
                      </span>
                      <strong style={{ fontFamily: 'monospace' }}>{fc(prevBalance)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Net Payable', 'देय राशि')}</span>
                      <strong style={{ color: 'var(--text)', fontSize: '17px', fontFamily: 'monospace' }}>{fc(totalWithPrev)}</strong>
                    </li>
                  </>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>{t('Amount Paid', 'भुगतान की गई राशि')}</span>
                  <strong style={{ fontFamily: 'monospace' }}>{fc(amtReceived)}</strong>
                </li>

                <li 
                  className={balanceDue > 0.01 ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '15px', 
                    padding: '12px', 
                    borderRadius: '8px',
                    background: balanceDue > 0.01 ? 'var(--danger-light)' : 'var(--success-light)',
                    color: balanceDue > 0.01 ? 'var(--danger)' : 'var(--success)',
                    border: '1.5px solid var(--border)'
                  }}
                >
                  <span style={{ fontWeight: '800' }}>
                    {balanceDue > 0.01 ? 'Balance Due' : balanceDue < -0.01 ? 'Excess Paid' : 'Fully Paid'}
                  </span>
                  <strong style={{ fontSize: '17px', fontFamily: 'monospace' }}>{fc(Math.abs(balanceDue))}</strong>
                </li>
              </ul>
            </div>

            
          {/* Signature Canvas */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <PenTool size={13} />{t('Authorised Signature', 'अधिकृत हस्ताक्षर')}</div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>{t('Authorized signatory should sign below before finalized invoice', 'अंतिम बिल बनाने से पहले अधिकृत हस्ताक्षरकर्ता नीचे हस्ताक्षर करें')}</p>
              
              <div style={{ background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', padding: '4px' }}>
                <SignatureCanvas
                  ref={sigRef}
                  penColor={theme === 'dark' ? '#ffffff' : '#0f172a'}
                  minWidth={1.5}
                  maxWidth={3}
                  throttle={16}
                  canvasProps={{ width: 340, height: 110, className: "sigCanvas w-100", style: { borderRadius: '6px' } }}
                />
              </div>
              
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-start' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                  onClick={() => sigRef.current.clear()}
                >
                  <Trash2 size={11} />{t('Clear Signature', 'हस्ताक्षर साफ़ करें')}</button>
              </div>
            </div>

            
          
            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '16px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {saving ? t('Creating Invoice...', 'बिल बन रहा है...') : t('Finalize & Create Invoice', 'बिल फाइनल करें और बनाएं')}
                {!saving && <CheckCircle size={18} />}
              </button>
              
              <button
                className="btn btn-outline"
                onClick={() => navigate(-1)}
                style={{ height: '42px', borderRadius: '10px', fontWeight: '700' }}
              >
                {t('Cancel Invoice', 'बिल रद्द करें')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Disclaimers & Warning overlays */}

      {walkinWarningModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="modal card" style={{ maxWidth: '450px', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
            <div style={{ fontSize: '17px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              {walkinWarningModal.title}
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '0 0 20px 0' }}>
              {walkinWarningModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setWalkinWarningModal(null)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentConfirmModal && (
        <div className="modal-overlay" onClick={() => setPaymentConfirmModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
            <div style={{ fontSize: '17px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              {paymentConfirmModal.title}
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '0 0 20px 0' }}>
              {paymentConfirmModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {paymentConfirmModal.type === 'walkin_zero' ? (
                <>
                  <button className="btn btn-outline" onClick={() => setPaymentConfirmModal(null)}>{t('Cancel', 'रद्द करें')}</button>
                  <button className="btn btn-danger" onClick={() => { setPaymentConfirmModal(null); processSubmit(payments); }}>Pending Due</button>
                  <button className="btn btn-primary" onClick={() => { setPaymentConfirmModal(null); processSubmit([{ mode: 'cash', amount: totalWithPrev.toFixed(2), reference: '' }]); }}>{t('Full Cash', 'पूरा नकद')}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline" onClick={() => setPaymentConfirmModal(null)}>{t('Cancel', 'रद्द करें')}</button>
                  <button className="btn btn-primary" onClick={() => { setPaymentConfirmModal(null); processSubmit(payments); }}>Proceed</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelConfirmModal && (
        <div className="modal-overlay" onClick={() => setCancelConfirmModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
            <div style={{ fontSize: '17px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <Trash2 size={18} /> Cancel Bill?
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text)', whiteSpace: 'pre-wrap', margin: '0 0 20px 0' }}>
              Are you sure you want to cancel this bill? All unsaved progress will be permanently lost.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-outline" onClick={() => setCancelConfirmModal(false)}>Keep Working</button>
              <button className="btn btn-danger" onClick={confirmCancelBill}>Yes, Cancel Bill</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
