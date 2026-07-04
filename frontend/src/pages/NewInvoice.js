import React, { useState, useEffect, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productApi, customerApi, invoiceApi, dashboardApi, orderApi, managerApi, walkinApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  User, Users, Phone, MapPin, Calendar, Truck, FileText, 
  FileSpreadsheet, CheckCircle, AlertTriangle, Plus, Trash2, 
  Monitor, Check, ArrowLeft, Receipt, FolderOpen, Inbox, 
  Clock, Tag, Wallet, PenTool, Save, Package, X, ChevronDown
} from 'lucide-react';
import { parseCustomerName, formatCustomerName, isHindi, applyAutoSuffix } from '../utils/nameFormatter';

import CustomerSelectStep from '../components/invoice/CustomerSelectStep';
import BookletSelectStep from '../components/invoice/BookletSelectStep';
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

const PaymentModeSelector = ({ mode, onChange, modes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="form-control"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          height: '38px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', textAlign: 'left', width: '100%', cursor: 'pointer', padding: '0 12px',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border)',
          boxShadow: isOpen ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none'
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text)' }}>{mode ? mode.toUpperCase().replace('_', ' ') : 'Select Mode'}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, padding: '4px',
          display: 'flex', flexDirection: 'column', gap: '2px',
          maxHeight: '200px', overflowY: 'auto'
        }}>
          {modes.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { onChange(m); setIsOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                background: mode === m ? 'var(--primary-light)' : 'transparent',
                color: mode === m ? 'var(--primary)' : 'var(--text)',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '13px', fontWeight: mode === m ? '600' : '500',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => { if (mode !== m) e.target.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (mode !== m) e.target.style.background = 'transparent'; }}
            >
              {m.toUpperCase().replace('_', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [discountType, setDiscountType] = useState(settings.discount_type || 'amount');
  const customizePrevDueEnabled = settings.customize_prev_due_enabled !== false;
  
  const [step, setStep] = useState((user?.role === 'supervisor') ? 0 : 1); // Wizard Steps: 0 = Booklet, 1 = Customer, 2 = Product, 3 = Details
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
  const [showDrafts, setShowDrafts] = useState(params.get('drafts') === 'true');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedManagerForBill, setSelectedManagerForBill] = useState('');
  const [managers, setManagers] = useState([]);
  const [walkIn, setWalkIn] = useState({ prefix: 'Shree', name: '', phone: '', address: '' });
  const [prevBalance, setPrevBalance] = useState(0);
  const [balanceBreakdown, setBalanceBreakdown] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [breakdownSelections, setBreakdownSelections] = useState(null);
  const [allowEditPrevDue, setAllowEditPrevDue] = useState(false);
  const [editedPrevDue, setEditedPrevDue] = useState('');
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
  const [isTransportationInvoice, setIsTransportationInvoice] = useState(() => new URLSearchParams(location.search).get('type') === 'transportation');
  const [isManualBill, setIsManualBill] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [qrForCurrentBill, setQrForCurrentBill] = useState(false);

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

  // Watch URL params for drafts
  useEffect(() => {
    const isDrafts = new URLSearchParams(location.search).get('drafts') === 'true';
    if (isDrafts) {
      setShowDrafts(true);
      setStep(prev => prev === 0 ? 1 : prev);
    }
  }, [location.search]);

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
    
    const draftCustomerName = customerMode === 'existing' 
      ? (customerSearch ? customerSearch.split(' (')[0] : 'Existing Customer')
      : (walkIn.name ? `${walkIn.prefix || 'Shree'} ${walkIn.name}`.trim() : 'Walk-in Customer');

    const draft = {
      items, customerMode, customerId, walkIn, payments, discount, discountType,
      concessionReason, notes, driverName, vehicleNumber, totalWeight, vehicleCharge,
      labourCharge, billDate, isManualBill, manualBillRef, savedAt: Date.now(),
      customerName: draftCustomerName, step, selectedManagerForBill,
    };
    localStorage.setItem(AUTO_DRAFT_KEY, JSON.stringify(draft));
  }, [items, customerMode, customerId, walkIn, payments, discount, discountType, notes,
    driverName, vehicleNumber, totalWeight, vehicleCharge, labourCharge, billDate, isManualBill, manualBillRef, isDraftLoaded, customerSearch, step, selectedManagerForBill]);

  // Load customers and managers
  useEffect(() => {
    customerApi.getAll({ limit: 500 }).then(res => {
      const list = Array.isArray(res) ? res : (res?.customers || res?.data || []);
      setCustomers(list);
    }).catch(err => {
      console.error('[NewInvoice] customer fetch failed:', err);
    });

    if (user?.role === 'supervisor' || user?.role === 'temp_manager') {
      managerApi.getAll().then(res => {
        setManagers(res.managers || []);
      }).catch(err => console.error('[NewInvoice] manager fetch failed:', err));
    }
  }, [user?.role]);

  const [activeTrip, setActiveTrip] = useState(null);

  // Load pending dues for walk-ins
  useEffect(() => {
    dashboardApi.get().then(d => {
      setAllPendingDues(d.pendingCustomers || []);
    }).catch(() => { });
    
    // For walk-in manager, fetch active trip to auto-fill logistics
    if (user?.role === 'walkin_manager') {
      walkinApi.getActiveTrip().then(res => {
        if (res.active && res.trip) {
          setActiveTrip(res.trip);
          setVehicleNumber(res.trip.vehicle_number || '');
          setDriverName(res.trip.driver_name || '');
        }
      }).catch(err => console.error('Failed to fetch walkin trip details:', err));
    }
  }, [user?.role]);

  // Load drafts list
  useEffect(() => {
    let stored = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    if (!Array.isArray(stored)) stored = [];
    
    // Auto-delete drafts older than 36 hours
    const thirtySixHours = 36 * 60 * 60 * 1000;
    const validDrafts = stored.filter(d => (Date.now() - (d.savedAt || d.id || 0)) <= thirtySixHours);
    
    if (validDrafts.length !== stored.length) {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(validDrafts));
    }
    
    setDrafts(validDrafts);
  }, []);

  // Move auto-draft to Drafts list on mount instead of auto-loading
  useEffect(() => {
    const saved = localStorage.getItem(AUTO_DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        const thirtySixHours = 36 * 60 * 60 * 1000;
        if (Date.now() - draft.savedAt <= thirtySixHours) {
          let existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
          if (!Array.isArray(existing)) existing = [];
          
          const validItems = (draft.items || []).filter(i => i.product_name && parseFloat(i.qty) > 0);
          const totalAmount = validItems.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
          
          let customerName = draft.customerName || (draft.customerMode === 'existing' ? 'Existing Customer' : (draft.walkIn?.name || 'Walk-in Customer'));
          
          const newDraft = {
            id: Date.now() + Math.random(), 
            customerName: `[Auto-recovered] ${customerName}`, 
            totalAmount, 
            itemCount: validItems.length,
            ...draft
          };
          
          const updated = [newDraft, ...existing];
          localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
          setDrafts(updated);
        }
      } catch (e) {}
      localStorage.removeItem(AUTO_DRAFT_KEY);
    }
    setIsDraftLoaded(true);
  }, []);

  // Previous balance for existing customer
  useEffect(() => {
    if (customerMode === 'existing' && customerId) {
      const c = customers.find(c => c._id === customerId);
      if (c) {
        if (c.merged_by_admin) {
          setPrevBalance(c.balance || 0);
        } else if (selectedManagerForBill && c.manager_balances) {
          const mb = c.manager_balances.find(m => m.manager_id === selectedManagerForBill);
          setPrevBalance(mb ? mb.balance : (c.balance || 0));
        } else {
          setPrevBalance(c.balance || 0);
        }
        customerApi.getBalanceBreakdown(customerId, { manager_id: selectedManagerForBill })
          .then(res => {
            setBalanceBreakdown(res);
            setPrevBalance(res.total_balance || 0);
          })
          .catch(err => console.error(err));
          
        customerApi.getTimelineSinceLastInvoice(customerId, { manager_id: selectedManagerForBill })
          .then(res => setTimelineData(res))
          .catch(err => console.error(err));
      } else {
        setPrevBalance(0);
        setBalanceBreakdown(null);
      }
    } else {
      setPrevBalance(0);
      setBalanceBreakdown(null);
    }
  }, [customerId, customerMode, customers, selectedManagerForBill]);

  useEffect(() => {
    setEditedPrevDue(prevBalance.toString());
  }, [prevBalance]);

  useEffect(() => {
    if (balanceBreakdown) {
      setBreakdownSelections({
        opening_balance: { selected: true, amount: balanceBreakdown.opening_balance || 0 },
        advance: { selected: true, amount: balanceBreakdown.unregistered_advance || 0 },
        invoices: (balanceBreakdown.unpaid_invoices || []).reduce((acc, inv) => {
          acc[inv._id] = { selected: true, amount: inv.balance_due || 0 };
          return acc;
        }, {})
      });
    } else {
      setBreakdownSelections(null);
    }
  }, [balanceBreakdown]);

  const getComputedTreeBalance = () => {
    if (!breakdownSelections) return parseFloat(editedPrevDue) || 0;
    let sum = 0;
    if (breakdownSelections.opening_balance?.selected) sum += parseFloat(breakdownSelections.opening_balance.amount) || 0;
    Object.values(breakdownSelections.invoices || {}).forEach(inv => {
      if (inv.selected) sum += parseFloat(inv.amount) || 0;
    });
    if (breakdownSelections.advance?.selected) sum -= parseFloat(breakdownSelections.advance.amount) || 0;
    return sum;
  };

  const handleConvertToOrder = () => {
    const validItems = items.filter(i => i.product_name && parseFloat(i.qty) > 0);
    
    // Get customer info using getCustomerInfo helper
    let cName = '';
    let cPhone = '';
    
    if (customerMode === 'walkin') {
      cName = formatCustomerName(walkIn.prefix, walkIn.name).trim();
      cPhone = walkIn.phone || '';
    } else if (customerId) {
      const c = customers.find(c => c._id === customerId);
      cName = c?.name || '';
      cPhone = c?.phone || '';
    }

    const prefillData = {
      customerName: cName,
      customerPhone: cPhone,
      items: validItems.length > 0 ? validItems.map(i => ({
        product_name: i.product_name,
        product_id: i.product_id,
        qty: String(i.qty),
        price: String(i.price),
      })) : [{ product_name: '', product_id: '', qty: '', price: '' }, { product_name: '', product_id: '', qty: '', price: '' }],
    };

    navigate('/orders/new', { state: { prefill: prefillData } });
  };

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
        
      let prevBal = registeredMatch.balance || 0;
      if (selectedManagerForBill && registeredMatch.manager_balances) {
         const mb = registeredMatch.manager_balances.find(m => m.manager_id === selectedManagerForBill || m.manager_id?._id === selectedManagerForBill);
         prevBal = mb ? mb.balance : 0;
      }
      setPrevBalance(prevBal);
      
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
          override_creator_id: selectedManagerForBill || undefined,
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
    setDiscountType(draft.discountType || settings.discount_type || 'amount');
    setNotes(draft.notes || '');
    setDriverName(draft.driverName || '');
    setVehicleNumber(draft.vehicleNumber || '');
    setTotalWeight(draft.totalWeight || '');
    setVehicleCharge(draft.vehicleCharge || '');
    setLabourCharge(draft.labourCharge || '');
    setBillDate(draft.billDate || getISTDateTime());
    setIsManualBill(draft.isManualBill || false);
    setManualBillRef(draft.manualBillRef || '');
    if (draft.selectedManagerForBill) setSelectedManagerForBill(draft.selectedManagerForBill);
    setLoadedDraftId(draft.id);
    setShowDrafts(false);
    setStep(draft.step || 3); // restore the exact step where it was saved
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
      items: targetItems, customerMode, customerId, walkIn, payments, discount, discountType, notes,
      driverName, vehicleNumber, totalWeight, vehicleCharge, labourCharge,
      billDate, isManualBill, manualBillRef, savedAt: Date.now(), step,
    };
    const updated = [newDraft, ...existing];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
    setDrafts(updated);
    toast.success('Draft saved!');
    navigate('/admin/dashboard');
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

  const processSubmit = async (finalPayments, isLedgerEntry = false) => {
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
        const key = item.product_id ? `${item.product_id}_${item.is_loose ? 'loose' : 'bulk'}` : `custom_${item.product_name}`;
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
        ledger_payments: timelineData?.recent_payments || [],
        starting_balance: timelineData ? timelineData.starting_balance : prevBalance,
        signature: isLedgerEntry ? '' : sigRef.current.toDataURL("image/png"),
        override_creator_id: selectedManagerForBill,
        qr_for_current_bill: qrForCurrentBill,
        is_ledger_entry: isLedgerEntry,
        is_transportation_invoice: isTransportationInvoice,
      };

      if (allowEditPrevDue) {
        payload.override_previous_balance = editedPrevDue;
      } else {
        // ALWAYS send what the frontend calculated to prevent backend from recalculating with wrong manager context
        payload.override_previous_balance = prevBalance;
      }

      const invoice = await invoiceApi.create(payload);
      toast.success(isLedgerEntry ? 'Ledger Entry saved!' : 'Invoice created!');
      if (invoice.auto_conversions && invoice.auto_conversions.length > 0) {
        invoice.auto_conversions.forEach(conv => {
          toast(`Auto-converted: ${conv.parent_qty} ${conv.parent_unit} ${conv.parent_name} → ${conv.child_qty} ${conv.child_unit} ${conv.child_name}`, {
            icon: '🔄',
            duration: 6000,
          });
        });
      }
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
            override_creator_id: selectedManagerForBill || undefined,
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

      if (isLedgerEntry) {
        if (invoice.customer_id) {
          navigate(`/customers/${invoice.customer_id}`);
        } else {
          navigate(`/invoices`);
        }
      } else {
        navigate(`/invoices/${invoice._id}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save invoice');
      setSaving(false);
    }
  };

  const handleSubmit = (isLedgerEntry = false) => {
    const filledItems = items.filter(i => i.product_name && parseFloat(i.qty) > 0);
    if (filledItems.length === 0) return toast.error('Add at least one valid item');
    if (customerMode === 'existing' && !customerId) return toast.error('Select a customer');
    if (!isLedgerEntry && (!sigRef.current || sigRef.current.isEmpty())) return toast.error("Authorised signature is required");

    const currentAmtReceived = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const balanceDue = totalWithPrev - currentAmtReceived;

    if (balanceDue > 0) {
      if (customerMode === 'walkin' && currentAmtReceived === 0) {
        setPaymentConfirmModal({
          title: "⚠️ Unpaid Walk-in Bill",
          message: `You haven't entered any payment for this Walk-in bill.\n\nDo you want to automatically record this as FULLY PAID IN CASH (₹${totalWithPrev.toFixed(2)})?`,
          type: 'walkin_zero',
          isLedgerEntry
        });
        return;
      }
    }

    processSubmit(payments, isLedgerEntry);
  };

  const handleWalkInNameBlur = () => {
    // setWalkIn(prev => ({ ...prev, name: applyAutoSuffix(prev.name) }));
  };

  const addPayment = () => setPayments(prev => [...prev, { mode: 'cash', amount: '', reference: '' }]);
  const removePayment = (idx) => { if (payments.length === 1) return; setPayments(prev => prev.filter((_, i) => i !== idx)); };
  const updatePayment = (idx, changes) => setPayments(prev => { const next = [...prev]; next[idx] = { ...next[idx], ...changes }; return next; });

  const subtotal = items.reduce((s, i) => s + (i.taxable_amount || 0), 0);
  const gstTotal = gstEnabled ? items.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0) : 0;
  const disInput = parseFloat(discount) || 0;
  const vc = parseFloat(vehicleCharge) || 0;
  const lc = parseFloat(labourCharge) || 0;
  const dis = discountType === 'percentage' ? (subtotal + gstTotal + vc + lc) * (disInput / 100) : disInput;
  const total = Math.max(0, subtotal + gstTotal + vc + lc - dis);
  const activePrevBalance = allowEditPrevDue ? (balanceBreakdown && breakdownSelections ? getComputedTreeBalance() : (parseFloat(editedPrevDue) || 0)) : prevBalance;
  const totalWithPrev = total + activePrevBalance;
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
    setStep(user?.role === 'supervisor' ? 0 : 1);
    setCancelConfirmModal(false);
    toast.success("Bill cancelled and cleared.");
  };

  const selectedCustomer = customers.find(c => c._id === customerId);

  // ── Render Wizard Steps ───────────────────────────────────────────────────

  if (step === 0) {
    return (
      <BookletSelectStep
        managers={managers}
        onSelect={(managerId) => {
          setSelectedManagerForBill(managerId);
          setStep(1);
        }}
        onBack={() => navigate('/admin/dashboard')}
      />
    );
  }

  const draftsPanelNode = showDrafts && (
    <div className="animate-fade-in" style={{ paddingBottom: '24px' }}>
      {drafts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          <div style={{ background: 'var(--bg-card)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Inbox size={32} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text)', fontWeight: 700 }}>No drafts saved yet</h3>
          <p style={{ margin: 0, fontSize: 14 }}>Drafts you save will securely appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {drafts.map(d => {
              const savedDate = d.savedAt
                ? new Date(d.savedAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })
                : '—';
              return (
                <div
                  key={d.id}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 14, overflow: 'hidden',
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => loadDraft(d)}
                >
                  <div style={{ padding: '16px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                         <div style={{ background: 'var(--bg)', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                           <User size={16} />
                         </div>
                         <div>
                           <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1.2 }}>{d.customerName || 'Walk-in Customer'}</div>
                           <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.itemCount || 0} items</div>
                         </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(d.totalAmount || 0)}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Clock size={13} /> {savedDate}
                      </div>
                      {d.selectedManagerForBill && (
                        <div style={{ background: 'var(--bg-secondary)', color: 'var(--primary)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          For: {managers.find(m => m._id === d.selectedManagerForBill)?.display_name || managers.find(m => m._id === d.selectedManagerForBill)?.username || 'Unknown'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <button 
                      className="btn btn-ghost" 
                      style={{ flex: 1, padding: 12, borderRadius: 0, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }} 
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={(e) => { e.stopPropagation(); loadDraft(d); }}
                    >
                      <FolderOpen size={14} /> Load
                    </button>
                    <div style={{ width: 1, background: 'var(--border)' }}></div>
                    <button 
                      className="btn btn-ghost" 
                      style={{ padding: '12px 18px', borderRadius: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }} 
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={(e) => { e.stopPropagation(); deleteDraft(d.id); }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );

  if (step === 1) {
    return (
      <CustomerSelectStep
        customers={customers}
        managers={managers}
        selectedManager={selectedManagerForBill}
        onManagerChange={setSelectedManagerForBill}
        draftsCount={drafts.length}
        onShowDrafts={() => setShowDrafts(!showDrafts)}
        showDrafts={showDrafts}
        draftsPanel={draftsPanelNode}
        onSelectCustomer={(customer) => {
          setCustomerMode('existing');
          setCustomerId(customer._id);
          setCustomerSearch(customer.name);
          
          let prevBal = customer.balance || 0;
          if (selectedManagerForBill && customer.manager_balances) {
             const mb = customer.manager_balances.find(m => m.manager_id === selectedManagerForBill || m.manager_id?._id === selectedManagerForBill);
             prevBal = mb ? mb.balance : 0;
          }
          setPrevBalance(prevBal);
          setStep(2);
        }}
        onWalkIn={() => {
          setCustomerMode('walkin');
          setCustomerId('');
          setWalkIn({ prefix: 'Shree', name: '', phone: '', address: '' });
          setStep(2);
        }}
        onBack={() => {
          if (user?.role === 'supervisor') {
            setStep(0);
          } else {
            navigate('/admin/dashboard');
          }
        }}
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
      <>
        <ProductGridStep
          selectedCustomer={selectedCustomer}
          walkInData={customerMode === 'walkin' ? walkIn : null}
          initialItems={initialItemsMapped}
          selectedManager={selectedManagerForBill}
          draftsCount={drafts.length}
          onShowDrafts={() => { setStep(1); setShowDrafts(true); }}
          onBack={() => setStep(1)}
          onSaveDraft={(selectedProducts) => {
            const mappedItems = selectedProducts.map(p => {
              const item = {
                _key: Date.now() + Math.random(),
                product_id: p.product_id,
                product_name: p.product_name,
                is_loose: p.is_loose || false,
                qty: p.qty,
                price: p.price,
                gst: p.gst,
                unit: p.unit || 'bag',
                weight_per_unit: p.is_loose ? '' : (p.weight_per_unit || ''),
                weight: p.is_loose ? (p.unit?.toLowerCase() === 'kg' ? p.qty : (['gm', 'g'].includes(p.unit?.toLowerCase()) ? p.qty / 1000 : '')) : (p.weight_per_unit ? (p.qty * p.weight_per_unit) : ''),
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
                is_loose: p.is_loose || false,
                qty: p.qty,
                price: p.price,
                gst: p.gst,
                unit: p.unit || 'bag',
                weight_per_unit: p.is_loose ? '' : (p.weight_per_unit || ''),
                weight: p.is_loose ? (p.unit?.toLowerCase() === 'kg' ? p.qty : (['gm', 'g'].includes(p.unit?.toLowerCase()) ? p.qty / 1000 : '')) : (p.weight_per_unit ? (p.qty * p.weight_per_unit) : ''),
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
        {cancelConfirmModal && (
          <div className="modal-overlay" onClick={() => setCancelConfirmModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
            <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
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
      </>
    );
  }

  
  // Step 3 layout (Payment & Adjustments)
  if (step === 3) {
    return (
      <div style={{ paddingBottom: '60px' }}>


        {/* Step 3 Header bar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 0,
        borderBottom: '1px solid var(--border)', paddingBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap' }}>
          <button 
            type="button"
            onClick={() => setStep(2)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--bg-hover)', color: 'var(--text)', background: 'var(--bg-hover)', cursor: 'pointer' }}
            title="Back to Products"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={17} style={{ color: 'var(--primary)' }} />{t('Payment & Adjustments', 'भुगतान और समायोजन')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Customer: <strong style={{ color: 'var(--primary)' }}>{selectedCustomer ? selectedCustomer.name : (walkIn ? `Walk-in: ${walkIn.name || 'Anonymous'}` : 'Walk-in Customer')}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', flex: 1, minWidth: '200px', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginRight: 'auto', flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={() => saveDraft(items)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#dcfce7',
                border: '1.5px solid #bbf7d0',
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: '#166534',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#bbf7d0';
                e.currentTarget.style.border = '1.5px solid #86efac';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#dcfce7';
                e.currentTarget.style.border = '1.5px solid #bbf7d0';
              }}
            >
              <Save size={13} /> Save Draft
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrafts(v => !v); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: showDrafts ? 'var(--primary)' : 'var(--bg-hover)',
                border: showDrafts ? 'none' : '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: showDrafts ? 'var(--bg-card)' : 'var(--text-muted)',
                boxShadow: showDrafts ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              <FolderOpen size={13} /> Drafts
              {drafts.length > 0 && (
                <span style={{
                  background: showDrafts ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                  color: 'var(--bg-card)', borderRadius: 10, padding: '1px 6px', fontSize: 11,
                }}>
                  {drafts.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={cancelBill}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--danger-light)',
              border: '1.5px solid #fecaca',
              borderRadius: 6, padding: '7px 14px', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              color: '#dc2626',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={13} />{t('Cancel Bill', 'बिल रद्द करें')}
          </button>
        </div>
      </div>

      
        {/* Drafts panel */}
      {draftsPanelNode}

      {!showDrafts && (
        <div className="row g-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {user?.role === 'walkin_manager' && activeTrip?.reinforcement?.vehicle_number && (
            <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid #fde68a', background: '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fde68a', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} style={{ color: '#d97706' }} /> Select Vehicle (Reinforced Team)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div 
                  onClick={() => {
                    setVehicleNumber(activeTrip.vehicle_number);
                    setDriverName(activeTrip.driver_name);
                  }}
                  style={{ flex: 1, minWidth: '200px', padding: '12px', border: vehicleNumber === activeTrip.vehicle_number ? '2px solid #d97706' : '1.5px solid #fcd34d', borderRadius: '8px', background: vehicleNumber === activeTrip.vehicle_number ? '#fef3c7' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>🚚 Original Vehicle</div>
                  <div style={{ fontSize: 13, color: '#78350f' }}><strong>{activeTrip.vehicle_number}</strong></div>
                  <div style={{ fontSize: 12, color: '#92400e' }}>Dr: {activeTrip.driver_name}</div>
                </div>

                <div 
                  onClick={() => {
                    setVehicleNumber(activeTrip.reinforcement.vehicle_number);
                    setDriverName(activeTrip.reinforcement.driver_name);
                  }}
                  style={{ flex: 1, minWidth: '200px', padding: '12px', border: vehicleNumber === activeTrip.reinforcement.vehicle_number ? '2px solid #d97706' : '1.5px solid #fcd34d', borderRadius: '8px', background: vehicleNumber === activeTrip.reinforcement.vehicle_number ? '#fef3c7' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>🚛 Reinforcement</div>
                  <div style={{ fontSize: 13, color: '#78350f' }}><strong>{activeTrip.reinforcement.vehicle_number}</strong></div>
                  <div style={{ fontSize: 12, color: '#92400e' }}>Dr: {activeTrip.reinforcement.driver_name}</div>
                </div>
              </div>
            </div>
          )}

          {user?.role !== 'walkin_manager' && (
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
                <div className="form-group mb-0" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label d-inline-flex align-items-center gap-1 mb-0" style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}><Package size={13} /> {t('Total Weight', 'कुल वजन')}</label>
                  <div style={{ display: 'inline-flex', alignItems: 'stretch', border: '1.5px solid var(--border)', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ 
                        border: 'none', 
                        borderRadius: 0, 
                        padding: '6px 8px',
                        width: `${Math.max(60, (String(totalWeight || '').length * 10) + 20)}px`,
                        transition: 'width 0.2s',
                        textAlign: 'center'
                      }}
                      value={totalWeight}
                      onChange={e => setTotalWeight(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Moved Transportation & Labour Inputs */}
              <div style={{ background: 'var(--bg-hover)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '20px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Transportation & Labour Charges</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>{t('Vehicle Charge (₹)', 'वाहन शुल्क (₹)')}</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={vehicleCharge} onChange={e => setVehicleCharge(e.target.value)} placeholder="0.00" style={{ height: '40px', padding: '8px 12px', fontSize: '14px', borderRadius: '6px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>{t('Labour Charge (₹)', 'श्रम शुल्क (₹)')}</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={labourCharge} onChange={e => setLabourCharge(e.target.value)} placeholder="0.00" style={{ height: '40px', padding: '8px 12px', fontSize: '14px', borderRadius: '6px' }} />
                  </div>
                </div>

              </div>

            </div>
          )}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '13px' }}>{t('Total', 'कुल')}</span>
              <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{fc(subtotal + gstTotal + vc + lc)}</strong>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group mb-0" style={{ flex: '0 0 160px' }}>
                <div style={{ marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', marginBottom: 0 }}>
                    {t('Discount', 'छूट')}
                  </label>
                </div>
                <div className="input-group">
                  {discountType === 'amount' && <span className="input-group-text px-2" style={{ fontSize: '13px', background: 'var(--bg)', color: 'var(--text-muted)', borderRight: 0 }}>₹</span>}
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    placeholder="0.00"
                    style={discountType === 'amount' ? { borderLeft: 0, paddingLeft: '4px' } : { borderRight: 0 }}
                  />
                  {discountType === 'percentage' && <span className="input-group-text px-2" style={{ fontSize: '13px', background: 'var(--bg)', color: 'var(--text-muted)', borderLeft: 0 }}>%</span>}
                </div>
              </div>
              <div className="form-group mb-0" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>{t('Concession Reason', 'रियायत का कारण')}</label>
                <input
                  className="form-control"
                  value={concessionReason}
                  onChange={e => setConcessionReason(e.target.value)}
                  placeholder={t('concession(optional)', 'रियायत (वैकल्पिक)')}
                />
              </div>
            </div>

            {(dis > 0 || prevBalance !== 0) && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {dis > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--success)', fontWeight: '600' }}>Discount Applied {discountType === 'percentage' ? `(${disInput}%)` : ''}</span>
                    <strong style={{ color: 'var(--success)', fontWeight: '700' }}>-{fc(dis)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: prevBalance !== 0 ? '6px' : 0 }}>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Grand Total', 'कुल राशि')}</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: '700' }}>{fc(total)}</strong>
                </div>
                {prevBalance !== 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12.5px' }}>
                      <span style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                        {prevBalance > 0 ? 'Previous Due' : 'Previous Advance'}
                      </span>
                      <strong style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' }}>{fc(prevBalance)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Net Payable', 'देय राशि')}</span>
                      <strong style={{ color: 'var(--text)', fontSize: '14.5px', fontWeight: '800' }}>{fc(totalWithPrev)}</strong>
                    </div>
                  </>
                )}
              </div>
            )}

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
                      <PaymentModeSelector
                        mode={p.mode}
                        onChange={mode => updatePayment(idx, { mode })}
                        modes={PAYMENT_MODES}
                      />
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

                    {idx === 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', alignItems: 'flex-end', paddingBottom: '2px' }}>
                        <button 
                          type="button"
                          className="btn" 
                          style={{ fontSize: '12.5px', fontWeight: '600', padding: '5px 10px', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', transition: 'all 0.2s', height: '32px', whiteSpace: 'nowrap' }} 
                          onClick={() => setPayments([{ mode: p.mode || 'cash', amount: totalWithPrev.toFixed(2), reference: p.reference || '' }])}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <CheckCircle size={14} /> {t('Full', 'पूरा')}
                        </button>
                        <button 
                          type="button"
                          className="btn" 
                          style={{ fontSize: '12.5px', fontWeight: '600', padding: '5px 10px', borderRadius: '20px', background: 'rgba(107, 114, 128, 0.1)', color: '#4b5563', border: '1px solid rgba(107, 114, 128, 0.2)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', transition: 'all 0.2s', height: '32px', whiteSpace: 'nowrap' }} 
                          onClick={() => setPayments([{ mode: p.mode || 'cash', amount: '', reference: p.reference || '' }])}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(107, 114, 128, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <X size={14} /> {t('Clear', 'साफ़')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* QR Code Options inside Payment Records */}
            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                QR Code Amount Preference
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <input 
                  type="checkbox" 
                  checked={qrForCurrentBill} 
                  onChange={(e) => setQrForCurrentBill(e.target.checked)} 
                  style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontWeight: qrForCurrentBill ? '700' : '500', color: qrForCurrentBill ? 'var(--primary)' : 'inherit' }}>
                    Generate QR code ONLY for Current Bill (₹{total.toFixed(2)})
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
                    If unchecked, the QR code will default to the Net Payable amount (₹{totalWithPrev.toFixed(2)}).
                  </div>
                </div>
              </label>
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

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontVariantNumeric: 'tabular-nums' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('Subtotal (Before Tax)', 'उप-कुल (कर से पहले)')}</span>
                  <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(subtotal)}</strong>
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

                {Number(vehicleCharge) > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Transportation</span>
                    <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Number(vehicleCharge))}</strong>
                  </li>
                )}

                {Number(labourCharge) > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Labour</span>
                    <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Number(labourCharge))}</strong>
                  </li>
                )}

                {dis > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '14px' }}>
                    <span style={{ fontWeight: '700' }}>
                      Discount Applied {discountType === 'percentage' ? `(${disInput}%)` : ''}
                    </span>
                    <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>- {fc(dis)}</strong>
                  </li>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Grand Total', 'कुल राशि')}</span>
                  <strong style={{ color: 'var(--primary)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(total)}</strong>
                </li>

                {prevBalance !== 0 && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {prevBalance > 0 ? 'Previous Due' : 'Previous Advance'}
                      </span>
                      <strong style={{ color: prevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(prevBalance)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Net Payable', 'देय राशि')}</span>
                      <strong style={{ color: 'var(--text)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(totalWithPrev)}</strong>
                    </li>
                  </>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)' }}>
                  <span>{t('Amount Paid', 'भुगतान की गई राशि')}</span>
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
                    {balanceDue > 0.01 ? 'Balance Due' : balanceDue < -0.01 ? 'Excess Paid' : 'Fully Paid'}
                  </span>
                  <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Math.abs(balanceDue))}</strong>
                </li>
              </ul>
              
              {timelineData && timelineData.recent_payments && timelineData.recent_payments.length > 0 && (
                <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Account History</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text)' }}>Starting Balance</span>
                    <strong style={{ fontWeight: '600' }}>{fc(timelineData.starting_balance)}</strong>
                  </div>
                  {timelineData.recent_payments.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--success)', marginTop: '4px' }}>
                      <span>Received ({new Date(p.date).toLocaleDateString()})</span>
                      <strong style={{ fontWeight: '600' }}>- {fc(p.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>


            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 20px 20px 20px' }}>
              <button
                className="btn btn-primary"
                onClick={() => setStep(4)}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '16px',
                  letterSpacing: '0.5px',
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
      )}
      </div>
    );
  }

  // Step 4 layout (Review & Finalize)
  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Step 3 Header bar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 0,
        borderBottom: '1px solid var(--border)', paddingBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap' }}>
          <button 
            type="button"
            onClick={() => setStep(3)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--bg-hover)', color: 'var(--text)', background: 'var(--bg-hover)', cursor: 'pointer' }}
            title="Back to Payments"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={17} style={{ color: 'var(--primary)' }} /> Bill Details & Review
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Customer: <strong style={{ color: 'var(--primary)' }}>{selectedCustomer ? selectedCustomer.name : (walkIn ? `Walk-in: ${walkIn.name || 'Anonymous'}` : 'Walk-in Customer')}</strong>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', justifyContent: 'space-between', flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', gap: 8, marginRight: 'auto', flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={() => saveDraft(items)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#dcfce7',
                border: '1.5px solid #bbf7d0',
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: '#166534',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#bbf7d0';
                e.currentTarget.style.border = '1.5px solid #86efac';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#dcfce7';
                e.currentTarget.style.border = '1.5px solid #bbf7d0';
              }}
            >
              <Save size={13} /> Save Draft
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrafts(v => !v); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: showDrafts ? 'var(--primary)' : 'var(--bg-hover)',
                border: showDrafts ? 'none' : '1.5px solid var(--border)',
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: showDrafts ? 'var(--bg-card)' : 'var(--text-muted)',
                boxShadow: showDrafts ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              <FolderOpen size={13} /> Drafts
              {drafts.length > 0 && (
                <span style={{
                  background: showDrafts ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                  color: 'var(--bg-card)', borderRadius: 10, padding: '1px 6px', fontSize: 11,
                }}>
                  {drafts.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={cancelBill}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--danger-light)', border: '1.5px solid #fecaca',
              color: '#dc2626', transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={13} />{t('Cancel Bill', 'बिल रद्द करें')}
          </button>
        </div>
      </div>

      
      {/* Drafts panel */}
      {draftsPanelNode}

      
      <div className="mt-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Customer Summary Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '22px', flexShrink: 0, boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)', border: '3px solid var(--bg-card)' }}>
                  {customerMode === 'existing' && selectedCustomer ? selectedCustomer.name?.[0]?.toUpperCase() : <User size={28} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontWeight: '900', fontSize: '18px', color: 'var(--text)', letterSpacing: '-0.3px' }}>
                      {customerMode === 'existing' && selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                    </div>
                    {customerMode === 'existing' && (
                      <span style={{ fontSize: '11px', background: 'var(--success-light)', color: '#16a34a', padding: '3px 10px', borderRadius: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Registered
                      </span>
                    )}
                  </div>
                  {customerMode === 'existing' && selectedCustomer && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                      {selectedCustomer.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-hover)', padding: '4px 12px', borderRadius: '20px', color: 'var(--text)', fontWeight: '600' }}>
                          <Phone size={12} style={{ color: 'var(--primary)' }} />+91 {selectedCustomer.phone}
                        </span>
                      )}
                      {selectedCustomer.address && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-hover)', padding: '4px 12px', borderRadius: '20px', color: 'var(--text)', fontWeight: '600' }}>
                          <MapPin size={12} style={{ color: 'var(--primary)' }} />{selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  )}
                  {customerMode !== 'existing' && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Unregistered Customer</div>
                  )}
                </div>
              </div>
            </div>
            
            {customerMode === 'existing' && selectedCustomer && activePrevBalance !== 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>{activePrevBalance > 0 ? 'Pending Balance Due' : 'Advance Balance Available'}</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: activePrevBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {formatCurrency(Math.abs(activePrevBalance))}
                </div>
              </div>
            )}
            
            {customerMode !== 'existing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed var(--border)' }}>
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

            {/* Bill Date row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Bill Date</label>
                <input className="form-control" type="datetime-local" value={billDate} max={new Date().toISOString().slice(0, 16)} onChange={e => setBillDate(e.target.value)} />
              </div>
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

                {Number(vehicleCharge) > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Transportation</span>
                    <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Number(vehicleCharge))}</strong>
                  </li>
                )}

                {Number(labourCharge) > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Labour</span>
                    <strong style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Number(labourCharge))}</strong>
                  </li>
                )}

                {dis > 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '14px' }}>
                    <span style={{ fontWeight: '700' }}>
                      Discount Applied {discountType === 'percentage' ? `(${disInput}%)` : ''}
                    </span>
                    <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>- {fc(dis)}</strong>
                  </li>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Grand Total', 'कुल राशि')}</span>
                  <strong style={{ color: 'var(--primary)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(total)}</strong>
                </li>

                {activePrevBalance !== 0 && (
                  <>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: activePrevBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {activePrevBalance > 0 ? 'Previous Due' : 'Previous Advance'}
                      </span>
                      <strong style={{ fontWeight: '700', fontFamily: 'monospace', color: activePrevBalance > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '14px' }}>{fc(activePrevBalance)}</strong>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text)' }}>{t('Net Payable', 'देय राशि')}</span>
                      <strong style={{ color: 'var(--text)', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(totalWithPrev)}</strong>
                    </li>
                  </>
                )}

                <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)' }}>
                  <span>{t('Amount Paid', 'भुगतान की गई राशि')}</span>
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
                    {balanceDue > 0.01 ? 'Balance Due' : balanceDue < -0.01 ? 'Excess Paid' : 'Fully Paid'}
                  </span>
                  <strong style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' }}>{fc(Math.abs(balanceDue))}</strong>
                </li>
              </ul>
            </div>

            {/* Notes / Remarks Card */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                  <FileText size={13} style={{ color: 'var(--primary)' }} /> {t('Notes / Remarks', 'नोट्स / टिप्पणी')}
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('Any additional remarks...', 'कोई अतिरिक्त टिप्पणी...')}
                  style={{ resize: 'vertical' }}
                />
              </div>
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
                className="btn"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '16px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                }}
              >
                {saving ? 'Saving...' : 'Save as Ledger Entry (Unbilled)'}
              </button>

              <button
                className="btn btn-primary"
                onClick={() => handleSubmit(false)}
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
          <div className="modal card" style={{ maxWidth: '450px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
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
          <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
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
                  <button className="btn btn-danger" onClick={() => { const isLedger = paymentConfirmModal.isLedgerEntry; setPaymentConfirmModal(null); processSubmit(payments, isLedger); }}>Pending Due</button>
                  <button className="btn btn-primary" onClick={() => { const isLedger = paymentConfirmModal.isLedgerEntry; setPaymentConfirmModal(null); processSubmit([{ mode: 'cash', amount: totalWithPrev.toFixed(2), reference: '' }], isLedger); }}>{t('Full Cash', 'पूरा नकद')}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline" onClick={() => setPaymentConfirmModal(null)}>{t('Cancel', 'रद्द करें')}</button>
                  <button className="btn btn-primary" onClick={() => { const isLedger = paymentConfirmModal.isLedgerEntry; setPaymentConfirmModal(null); processSubmit(payments, isLedger); }}>Proceed</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelConfirmModal && (
        <div className="modal-overlay" onClick={() => setCancelConfirmModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', animation: 'scaleUp 0.25s' }}>
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
