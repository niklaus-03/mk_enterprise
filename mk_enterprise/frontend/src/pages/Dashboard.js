import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashboardApi, settlementApi, orderApi, deliveryApi, supplierApi, customerApi, productApi } from '../utils/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/helpers';
import { Calendar, Clock, Users, Package, FileText, Truck, AlertTriangle, Briefcase, ChevronDown, ChevronUp, ArrowUpDown, Lightbulb, CheckCircle, XCircle, Edit2, RotateCcw, CreditCard, Trash2, Check, ClipboardList, UserCheck } from 'lucide-react';


const PAYMENT_MODES = ['cash', 'upi', 'online', 'others'];

// Must be defined OUTSIDE the component so it is available everywhere in the file
function getTodayIST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

// Reusable sort dropdown — same style as customer sort
function SortDropdown({ options, value, onChange, open, onToggle }) {
  const current = options.find(o => o.key === value);
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-outline btn-sm"
        style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
        onClick={onToggle}
      >
        <span>⇅</span>
        <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label || 'Sort'}
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, background: '#fff',
          border: '1.5px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 200, overflow: 'hidden',
        }}>
          {options.map(opt => (
            <div key={opt.key}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                background: value === opt.key ? 'var(--primary-light)' : 'transparent',
                fontWeight: value === opt.key ? 700 : 400,
                color: value === opt.key ? 'var(--primary)' : 'var(--text)',
                borderBottom: '1px solid #f3f4f6',
              }}
              onClick={() => onChange(opt.key)}
              onMouseEnter={e => { if (value !== opt.key) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { if (value !== opt.key) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Live IST clock — updates every second
function useLiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salesSortDesc, setSalesSortDesc] = useState(true);
  const [orderQty, setOrderQty] = useState({});
  const [showTodaySales, setShowTodaySales] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showWalkinMatchModal, setShowWalkinMatchModal] = useState(false);
  const [walkinMatch, setWalkinMatch] = useState(null);
  const salesPanelRef = React.useRef(null);
  const statementPanelRef = React.useRef(null);
  const duesPanelRef = React.useRef(null);
  const customersPanelRef = React.useRef(null);
  const productsPanelRef = React.useRef(null);

  // Fix 3: Only one summary dropdown open at a time
  const closeAllSummaryPanels = (except) => {
    // Use selectedDate so reopening keeps the global date
    if (except !== 'sales') { setShowTodaySales(false); setSalesSearch(''); setSalesSuggestions([]); setCardSalesData(null); setTodaySalesCardDate(selectedDate); }
    if (except !== 'statement') setShowStatement(false);
    if (except !== 'dues') { setShowAllDues(false); setDuesSearch(''); setShowWalkinDueForm(false); }
    if (except !== 'customers') { setShowCustomerDues(false); setCustomerSearch(''); }
    if (except !== 'products') { setShowProducts(false); setProductSearch(''); }
    if (except !== 'departure') { setShowDeparture(false); setShowDeliveryForm(false); setShowWalkinDelivery(false); }
  };
  // Fix 2 & 3 & 4: Settlement state — includes search, sort, view mode
  const [settlementData, setSettlementData] = useState({ settlements: [], totalOut: 0, totalIn: 0, partyNames: [] });
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const addSettlementRef = React.useRef(null);
  const [settlementForm, setSettlementForm] = useState({
    type: 'paid_to_supplier', party_name: '', amount: '', mode: 'cash',
    reference: '', notes: '', received_category: 'not_applicable'
  });
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [showPaidOutDetail, setShowPaidOutDetail] = useState(false);
  const [showReceivedDetail, setShowReceivedDetail] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showLowStockEditor, setShowLowStockEditor] = useState(false);
  // Show More / Less states for dashboard grid blocks
  const [showMoreDues, setShowMoreDues] = useState(false);
  const [showMoreLowStock, setShowMoreLowStock] = useState(false);
  const [showMoreMovements, setShowMoreMovements] = useState(false);
  const [showMoreSales, setShowMoreSales] = useState(false);
  const [showMoreTopProducts, setShowMoreTopProducts] = useState(false);
  const [editableLowStock, setEditableLowStock] = useState([]);

  // Fix 5: Supplier management within Settlement
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null); // for history view
  const [supplierHistory, setSupplierHistory] = useState({ history: [], totalPaid: 0 });

  const loadSuppliers = (q) => {
    supplierApi.getAll(q || '').then(setSuppliers).catch(() => { });
  };

  const loadSupplierHistory = (supplierId, date, all) => {
    supplierApi.getHistory(supplierId, { date: date || settlementCardDate, all: all ? 'true' : undefined })
      .then(res => { setSelectedSupplier(res.supplier); setSupplierHistory({ history: res.history, totalPaid: res.totalPaid }); })
      .catch(() => { });
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) return toast.error('Supplier name is required');
    setSupplierSaving(true);
    try {
      await supplierApi.create(supplierForm);
      toast.success('Supplier added');
      setSupplierForm({ name: '', phone: '', address: '', notes: '' });
      setShowAddSupplier(false);
      loadSuppliers();
    } catch (err) { toast.error(err.message); }
    finally { setSupplierSaving(false); }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Remove this supplier?')) return;
    try {
      await supplierApi.delete(id);
      toast.success('Supplier removed');
      if (selectedSupplier?._id === id) setSelectedSupplier(null);
      loadSuppliers();
    } catch (err) { toast.error(err.message); }
  };
  // Fix 2: Search and sort controls
  const [settlementSearch, setSettlementSearch] = useState('');
  const [settlementSortDate, setSettlementSortDate] = useState('desc');
  const [settlementSortAmount, setSettlementSortAmount] = useState('');
  const [settlementSortOpen, setSettlementSortOpen] = useState(false);
  // Combined sort key for SortDropdown
  const settlementSortKey = settlementSortAmount === 'desc' ? 'amount_desc'
    : settlementSortAmount === 'asc' ? 'amount_asc'
      : settlementSortDate === 'asc' ? 'date_asc' : 'date_desc';
  // Fix 3: View mode — 'date' = selected date, 'all' = full history
  const [settlementViewMode, setSettlementViewMode] = useState('date');

  const scrollToPanel = (ref) => {
    setTimeout(() => {
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
  };

  // Global selected date — drives full dashboard refresh
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  // Reactive — recalculates on every render when selectedDate changes
  const isToday = selectedDate === getTodayIST();

  // Live clock
  const liveTime = useLiveClock();
  const liveTimeIST = liveTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const liveDateIST = liveTime.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const [showCustomerDues, setShowCustomerDues] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');


  const loadAllCustomers = () => {
    setCustomersLoading(true);
    customerApi.getAll()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.customers || res?.data || []);
        setAllCustomers(list);
      })
      .catch(() => { })
      .finally(() => setCustomersLoading(false));
  };

  // Per-card date states — each section can filter independently
  const [settlementCardDate, setSettlementCardDate] = useState(getTodayIST());
  const [todaySalesCardDate, setTodaySalesCardDate] = useState(getTodayIST());
  const [pendingDuesCardDate, setPendingDuesCardDate] = useState(getTodayIST());
  const [customerDuesCardDate, setCustomerDuesCardDate] = useState(getTodayIST());
  const [productsCardDate, setProductsCardDate] = useState(getTodayIST());

  const [cardSalesData, setCardSalesData] = useState(null);
  const [cardDuesData, setCardDuesData] = useState(null);

  // Today's Sales search state
  const [salesSearch, setSalesSearch] = useState('');
  const [salesSuggestions, setSalesSuggestions] = useState([]);
  const [salesSearchFocused, setSalesSearchFocused] = useState(false);
  // Unified sort states — one per summary block
  const [salesSort, setSalesSort] = useState('time_desc');
  const [salesSortOpen, setSalesSortOpen] = useState(false);
  const [duesSortOpen, setDuesSortOpen] = useState(false);
  const [productSort, setProductSort] = useState('name_asc');
  const [productSortOpen, setProductSortOpen] = useState(false);
  const [vehicleSort, setVehicleSort] = useState('time_asc');
  const [vehicleSortOpen, setVehicleSortOpen] = useState(false);
  const [customerSort, setCustomerSort] = useState('due_desc');
  const [customerSortOpen, setCustomerSortOpen] = useState(false);
  const [showCustomerSortMenu, setShowCustomerSortMenu] = useState(false);

  // Close all sort dropdowns when opening a new one
  const closeAllSortMenus = (except) => {
    if (except !== 'sales') setSalesSortOpen(false);
    if (except !== 'dues') setDuesSortOpen(false);
    if (except !== 'product') setProductSortOpen(false);
    if (except !== 'vehicle') setVehicleSortOpen(false);
    if (except !== 'customer') { setCustomerSortOpen(false); setShowCustomerSortMenu(false); }
  };

  // Load card-specific sales data for a chosen date without refreshing dashboard
  const loadCardSales = (date) => {
    dashboardApi.get(date).then(d => setCardSalesData(d)).catch(() => { });
  };
  const loadCardDues = (date) => {
    dashboardApi.get(date).then(d => setCardDuesData(d)).catch(() => { });
  };
  // Departure / Incoming goods state
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showDeparture, setShowDeparture] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  // Helper: get current datetime in datetime-local input format (IST)
  const getNowDateTimeLocal = () => {
    const now = new Date();
    // Offset to IST
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 16);
  };

  const [deliveryForm, setDeliveryForm] = useState({
    vehicle_number: '', driver_name: '', supplier: '',
    expected_arrival: getNowDateTimeLocal(), // default = today now
    notes: '',
    items: [
      { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' },
      { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' },
    ],
  });
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [editDeliveryId, setEditDeliveryId] = useState(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [deliveryDateFilter, setDeliveryDateFilter] = useState('');
  const [deliveryDateInput, setDeliveryDateInput] = useState(''); // temp input before OK
  const [showWalkinDelivery, setShowWalkinDelivery] = useState(false);
  const [walkinDeliveryForm, setWalkinDeliveryForm] = useState({
    supplier: '', items: [{ item_name: '', quantity: '0', unit: 'bag', price: '' }],
    notes: '', mode: 'cash', paid: false,
  });
  const [walkinDeliverySaving, setWalkinDeliverySaving] = useState(false);

  const ITEM_LABELS = ['Goods', 'Fruits', 'Vegetables', 'Hardware', 'Others'];

  const DEFAULT_UNITS = ['bag', 'kg', 'g', 'ltr', 'ml', 'pcs', 'box', 'quintal', 'ton', 'mtr', 'dozen', 'pkt', 'strip'];
  const [customUnits, setCustomUnits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_units') || '[]'); } catch { return []; }
  });
  // Always merge with fresh localStorage so units saved in any form appear everywhere
  const allUnits = [...new Set([
    ...DEFAULT_UNITS,
    ...(() => { try { return JSON.parse(localStorage.getItem('custom_units') || '[]'); } catch { return []; } })(),
    ...customUnits,
  ])];

  const addCustomUnit = (unit) => {
    const trimmed = unit.trim().toLowerCase();
    if (!trimmed) return;
    // Always read fresh from localStorage to avoid stale closure
    const fresh = (() => { try { return JSON.parse(localStorage.getItem('custom_units') || '[]'); } catch { return []; } })();
    if ([...DEFAULT_UNITS, ...fresh].includes(trimmed)) return;
    const updated = [...fresh, trimmed];
    setCustomUnits(updated);
    localStorage.setItem('custom_units', JSON.stringify(updated));
  };

  const handleWalkinDelivery = async () => {
    if (!walkinDeliveryForm.supplier.trim()) return toast.error('Supplier/Party name is required');
    const validItems = walkinDeliveryForm.items.filter(i => i.item_name && parseFloat(i.quantity) > 0);
    if (!validItems.length) return toast.error('Add at least one item with quantity');
    setWalkinDeliverySaving(true);
    try {
      // Store as a delivery with no vehicle_number
      const totalAmount = validItems.reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)), 0);
      // Fix 5: Save supplier if new (not in existing list)
      const existingSupplier = suppliers.find(s => s.name.toLowerCase() === walkinDeliveryForm.supplier.trim().toLowerCase());
      if (!existingSupplier && walkinDeliveryForm.supplier.trim()) {
        try { await supplierApi.create({ name: walkinDeliveryForm.supplier.trim() }); } catch (e) { }
      }

      await deliveryApi.create({
        vehicle_number: 'WALK-IN',
        supplier: walkinDeliveryForm.supplier,
        driver_name: '',
        expected_arrival: new Date().toISOString(),
        items: validItems,
        notes: walkinDeliveryForm.notes,
      });
      // If paid, record in settlement
      if (walkinDeliveryForm.paid && totalAmount > 0) {
        await settlementApi.create({
          type: 'paid_to_supplier',
          party_name: walkinDeliveryForm.supplier,
          amount: totalAmount,
          mode: walkinDeliveryForm.mode,
          notes: 'Walk-in delivery payment',
        });
      }
      toast.success('Walk-in delivery recorded');
      setShowWalkinDelivery(false);
      setWalkinDeliveryForm({ supplier: '', items: [{ item_name: '', quantity: '0', unit: 'bag', price: '' }], notes: '', mode: 'cash', paid: false });
      // Refresh settlements so paid walk-in appears in settlement panel
      loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
      loadDeliveries(deliveryDateFilter || getTodayIST());
    } catch (err) { toast.error(err.message); }
    finally { setWalkinDeliverySaving(false); }
  };

  const updateWalkinItem = (idx, field, value) => {
    setWalkinDeliveryForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      // Auto-add row when last row has item_name
      if (idx === items.length - 1 && field === 'item_name' && value.trim()) {
        items.push({ item_name: '', quantity: '', unit: 'pcs', price: '', label: 'Goods' });
      }
      return { ...f, items };
    });
  };
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSuggestIdx, setProductSuggestIdx] = useState(null); // which row is open

  const searchSuppliers = (q) => {
    if (!q.trim()) { setSupplierSuggestions([]); return; }
    // Search both supplier records and settlement party names
    supplierApi.getAll(q)
      .then(results => {
        setSupplierSuggestions(results);
        // If few results, also check settlement party names
        if (results.length < 3 && settlementData.partyNames?.length > 0) {
          const extra = settlementData.partyNames
            .filter(p => p.toLowerCase().includes(q.toLowerCase()) && !results.find(r => r.name === p))
            .slice(0, 5)
            .map(p => ({ _id: p, name: p, phone: '', fromSettlement: true }));
          if (extra.length) setSupplierSuggestions([...results, ...extra]);
        }
      })
      .catch(() => { });
  };

  const searchProducts = (q) => {
    if (!q.trim()) { setProductSuggestions([]); return; }
    productApi.getAll({ search: q }).then(setProductSuggestions).catch(() => { });
  };

  const checkAutoAddRow = (items) => {
    const last = items[items.length - 1];
    if (last && last.item_name.trim()) {
      return [...items, { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' }];
    }
    return items;
  };

  const departureRef = React.useRef(null);

  const scrollToDeparture = () => {
    setShowDeparture(true);
    loadDeliveries(getTodayIST());
    setTimeout(() => {
      departureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const loadDeliveries = (date) => {
    deliveryApi.getAll({ date: date || getTodayIST() })
      .then(setDeliveries)
      .catch(() => { });
  };

  const loadOrders = (date) => {
    orderApi.getAll({ date: date || getTodayIST() })
      .then(setOrders)
      .catch(() => { });
  };

  // Notification: count active (non-delivered) deliveries today
  const activeDeliveries = deliveries.filter(d => d.status !== 'delivered' && d.status !== 'not_delivered');
  const arrivingSoon = deliveries.filter(d => d.status === 'arriving_soon');

  useEffect(() => {
    const today = getTodayIST();
    loadDeliveries(today);
    loadOrders(today);
  }, []);

  const handleSaveDelivery = async () => {
    if (!deliveryForm.vehicle_number) return toast.error('Vehicle number required');
    if (!deliveryForm.expected_arrival) return toast.error('Expected arrival time required');
    if (!deliveryForm.items[0]?.item_name) return toast.error('At least one item required');
    setDeliverySaving(true);
    try {
      const payload = {
        ...deliveryForm,
        items: deliveryForm.items.filter(i => i.item_name).map(i => ({
          ...i, quantity: parseFloat(i.quantity) || 0,
        })),
      };
      if (editDeliveryId) {
        await deliveryApi.update(editDeliveryId, payload);
        toast.success('Delivery updated');
      } else {
        await deliveryApi.create(payload);
        toast.success('Delivery entry saved');
      }
      setDeliveryForm({ vehicle_number: '', driver_name: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [{ item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' }] });
      setShowDeliveryForm(false);
      setEditDeliveryId(null);
      loadDeliveries(getTodayIST());
    } catch (err) { toast.error(err.message); }
    finally { setDeliverySaving(false); }
  };

  const handleDeliveryStatus = async (id, status) => {
    try {
      await deliveryApi.updateStatus(id, status);
      if (status === 'delivered') toast.success('✅ Marked delivered — stock updated automatically');
      else toast.success('Status updated');
      // Use deliveryDateFilter if set, otherwise today
      const refreshDate = deliveryDateFilter || getTodayIST();
      loadDeliveries(refreshDate);
      // Refresh dashboard data so stock/price shows updated values immediately
      dashboardApi.get(selectedDate).then(setData).catch(() => { });
    } catch (err) { toast.error(err.message); }
  };

  const handleMarkWalkinPaid = async (id, mode) => {
    try {
      await deliveryApi.updatePayment(id, 'paid', mode || 'cash');
      toast.success('✅ Walk-in delivery marked as paid');
      loadDeliveries(deliveryDateFilter || getTodayIST());
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteDelivery = async (id) => {
    if (!window.confirm('Delete this delivery entry?')) return;
    try {
      await deliveryApi.delete(id);
      toast.success('Entry deleted');
      loadDeliveries(deliveryDateFilter || getTodayIST());
    } catch (err) { toast.error(err.message); }
  };

  const openEditDelivery = (d) => {
    setEditDeliveryId(d._id);
    // Convert UTC arrival to local datetime-local input format
    const localStr = new Date(d.expected_arrival).toISOString().slice(0, 16);
    setDeliveryForm({
      vehicle_number: d.vehicle_number,
      driver_name: d.driver_name || '',
      supplier: d.supplier || '',
      expected_arrival: localStr,
      notes: d.notes || '',
      items: d.items.length ? d.items.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, product_id: i.product_id || '' })) : [{ item_name: '', quantity: '', unit: 'pcs', product_id: '' }],
    });
    setShowDeliveryForm(true);
    setShowDeparture(true);
  };

  const addDeliveryItem = () =>
    setDeliveryForm(f => ({ ...f, items: [...f.items, { item_name: '', quantity: '', unit: 'pcs', product_id: '' }] }));

  const removeDeliveryItem = (idx) =>
    setDeliveryForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const updateDeliveryItem = (idx, field, value) =>
    setDeliveryForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });

  // Fix 3: Also store invoice received for settlement date (separate from global dashboard)
  const [settlementInvoiceReceived, setSettlementInvoiceReceived] = useState(0);

  const loadSettlements = (date, viewMode, search, sortDate, sortAmount) => {
    setSettlementLoading(true);
    const params = {
      date: viewMode === 'all' ? undefined : date,
      all: viewMode === 'all',
      party: search || undefined,
      sort_date: sortDate || 'desc',
      sort_amount: sortAmount || undefined,
    };
    settlementApi.get(params)
      .then(setSettlementData)
      .catch(e => toast.error(e.message))
      .finally(() => setSettlementLoading(false));

    // Fix 3: Fetch invoice received for this specific settlement date
    if (date && viewMode !== 'all') {
      dashboardApi.get(date)
        .then(d => setSettlementInvoiceReceived(d?.statementData?.totalReceived || 0))
        .catch(() => setSettlementInvoiceReceived(0));
    } else {
      setSettlementInvoiceReceived(0);
    }
  };

  const handleAddSettlement = async () => {
    if (!settlementForm.amount || parseFloat(settlementForm.amount) <= 0)
      return toast.error('Enter a valid amount');
    if (!settlementForm.party_name && settlementForm.type === 'paid_to_supplier')
      return toast.error('Enter supplier/company name');
    setSettlementSaving(true);
    try {
      await settlementApi.create({ ...settlementForm, amount: parseFloat(settlementForm.amount) });
      toast.success('Settlement entry added');
      setSettlementForm({ type: 'paid_to_supplier', party_name: '', amount: '', mode: 'cash', reference: '', notes: '', received_category: 'not_applicable' });
      setShowAddSettlement(false);
      // Reload with current filter state
      // Fix 4: use settlementCardDate not selectedDate
      loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
    } catch (err) { toast.error(err.message); }
    finally { setSettlementSaving(false); }
  };

  const handleDeleteSettlement = async (id) => {
    if (!window.confirm('Delete this settlement entry?')) return;
    try {
      await settlementApi.delete(id);
      toast.success('Entry deleted');
      // Fix 4: use settlementCardDate not selectedDate
      loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
    } catch (err) { toast.error(err.message); }
  };
  const [showAllDues, setShowAllDues] = useState(false);
  const [duesSearch, setDuesSearch] = useState('');
  const [duesCardDate, setDuesCardDate] = useState(getTodayIST());
  const [duesSort, setDuesSort] = useState('amount_desc');
  const [showWalkinDueForm, setShowWalkinDueForm] = useState(false);
  const [walkinDueForm, setWalkinDueForm] = useState({ name: '', amount: '', phone: '', notes: '' });
  const [walkinDueSaving, setWalkinDueSaving] = useState(false);

  const handleCreateWalkinDue = async () => {
    if (!walkinDueForm.name.trim()) return toast.error('Customer name is required');
    if (!walkinDueForm.amount || parseFloat(walkinDueForm.amount) <= 0) return toast.error('Enter a valid amount');
    setWalkinDueSaving(true);
    try {
      const res = await dashboardApi.createWalkinDue({
        name: walkinDueForm.name,
        amount: parseFloat(walkinDueForm.amount),
        phone: walkinDueForm.phone,
        notes: walkinDueForm.notes,
      });
      toast.success(res.message);
      setWalkinDueForm({ name: '', amount: '', phone: '', notes: '' });
      setShowWalkinDueForm(false);
      // Refresh dashboard to show new due
      dashboardApi.get(selectedDate).then(setData).catch(() => { });
    } catch (err) { toast.error(err.message); }
    finally { setWalkinDueSaving(false); }
  };
  const [dueDateInvoices, setDueDateInvoices] = useState(null); // invoices for selected dues date
  const [allClearedInvoiceIds, setAllClearedInvoiceIds] = useState(new Set());

  // Load invoices for a specific date to check which dues existed that day
  const loadDueDateData = (date) => {
    if (!date) { setDueDateInvoices(null); return; }
    dashboardApi.get(date).then(d => {
      setDueDateInvoices(d.todayPendingDues || []);
    }).catch(() => { });
  };
  const [payModal, setPayModal] = useState(null); // { invoice_id, customer_id, name, balance, type }
  const [payForm, setPayForm] = useState({ amount: '', mode: 'cash', reference: '' });
  const [paying, setPaying] = useState(false);
  const { settings, t } = useApp();

  const handleRecordPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return toast.error('Enter a valid amount');
    setPaying(true);
    try {
      // Fix 3: For registered customers, pass invoice_id if available from the dues data
      const invoiceId = payModal.invoice_id ||
        (payModal.type === 'registered' ? null : null);

      const res = await dashboardApi.recordPayment({
        invoice_id: invoiceId,
        customer_id: payModal.customer_id || null,
        amount: parseFloat(payForm.amount),
        mode: payForm.mode,
        reference: payForm.reference,
      });
      toast.success(res.message || `₹${payForm.amount} recorded via ${payForm.mode.toUpperCase()}`);
      if (res.advance_stored > 0) {
        toast(`₹${res.advance_stored.toFixed(2)} stored as advance credit for customer`, { icon: '💳', duration: 4000 });
      }
      setPayModal(null);
      setPayForm({ amount: '', mode: 'cash', reference: '' });
      // Refresh dashboard with current selected date
      dashboardApi.get(selectedDate).then(setData).catch(e => toast.error(e.message));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  // Returns the order quantity for a product (defaults to "needed" amount)
  const getOrderQty = (p) => {
    if (orderQty[p._id] !== undefined) return orderQty[p._id];
    const threshold = parseInt(settings?.low_stock_threshold) || 10;
    // Use custom_low_stock if defined and >= 0, otherwise global threshold
    const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0)
      ? p.custom_low_stock
      : threshold;
    return Math.max(1, minStock - p.stock); // at least 1 so there's always something to order
  };

  const adjustOrderQty = (id, delta) => {
    const p = data.lowStockProducts.find(x => x._id === id);
    const threshold = parseInt(settings?.low_stock_threshold) || 10;
    const minStock = (p?.custom_low_stock != null) ? p.custom_low_stock : threshold;
    const defaultQty = Math.max(0, minStock - (p?.stock ?? 0));
    setOrderQty(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] !== undefined ? prev[id] : defaultQty) + delta),
    }));
  };

  // Re-fetches whenever selectedDate changes — no manual refresh needed
  useEffect(() => {
    setLoading(true);
    setSalesSearch('');
    setSalesSuggestions([]);
    setCardSalesData(null);

    dashboardApi.get(selectedDate)
      .then(d => {
        setData(d);

        // Auto-refresh any open panels with new date
        if (showTodaySales) {
          setTodaySalesCardDate(selectedDate);
          loadCardSales(selectedDate);
        }
        if (showStatement) {
          setSettlementCardDate(selectedDate);
          loadSettlements(selectedDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
        }
        if (showAllDues) {
          setDuesCardDate(selectedDate);
          setDueDateInvoices(null); // clear stale data
          loadDueDateData(selectedDate);
        }
        if (showDeparture) {
          setDeliveryDateFilter(selectedDate);
          setDeliveryDateInput(selectedDate);
          loadDeliveries(selectedDate);
        }
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  if (loading) return (
    <div className="loading">
      <div className="spinner" style={{ width: 32, height: 32, marginBottom: 12 }}></div>
      <div>Loading dashboard...</div>
    </div>
  );
  if (!data) return (
    <div className="empty-state">
      <div className="empty-icon">⚠️</div>
      <div className="empty-text">Could not load dashboard</div>
      <div className="empty-sub">Make sure the backend server is running and MongoDB is connected.</div>
    </div>
  );

  const fc = formatCurrency;

  const handleLowStockPdf = () => {
    if (!data?.lowStockProducts?.length) return toast.error('No low stock items to export');
    const threshold = parseInt(settings?.low_stock_threshold) || 10;
    const prevTitle = document.title;
    document.title = `Stock-Order-${new Date().toISOString().slice(0, 10)}`;
    const rows = data.lowStockProducts.map((p, i) => {
      const minStock = (p.custom_low_stock != null) ? p.custom_low_stock : threshold;
      const toOrder = getOrderQty(p); // order qty, NOT current stock
      return `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 12px">${i + 1}</td>
          <td style="padding:8px 12px;font-weight:600">${p.name}</td>
          <td style="padding:8px 12px;text-align:center">${p.unit}</td>
          <td style="padding:8px 12px;text-align:right;color:${p.stock === 0 ? '#dc2626' : '#d97706'};font-weight:700">${p.stock}</td>
          <td style="padding:8px 12px;text-align:right">${minStock}</td>
          <td style="padding:8px 12px;text-align:right;color:#2563eb;font-weight:800">${toOrder > 0 ? toOrder : '—'}</td>
          <td style="padding:8px 12px;text-align:right">₹${Number(p.price).toFixed(2)}</td>
        </tr>`;
    }).join('');
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title}</title>
        <style>@page{margin:12mm 10mm;size:A4;}body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;}
        table{width:100%;border-collapse:collapse;}thead tr{background:#1a1f2e;color:#fff;}
        th{padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;}
        footer{margin-top:24px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px;}</style>
      </head><body>
        <div style="display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #1a1f2e;margin-bottom:18px">
          <div><h2 style="margin:0;font-size:20px;font-weight:800">${settings?.business_name || 'My Shop'}</h2>
          <p style="margin:4px 0;color:#6b7280">Low Stock Report — ${today}</p></div>
          <div style="text-align:right;font-size:12px;color:#6b7280">${settings?.business_phone ? '📞 ' + settings?.business_phone : ''}</div>
        </div>
        <table><thead><tr><th>#</th><th>Product</th><th>Unit</th>
          <th style="text-align:right">Current Stock</th>
          <th style="text-align:right">Min. Required</th>
          <th style="text-align:right;color:#93c5fd">Order Qty (Editable)</th>
          <th style="text-align:right">Unit Price</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <footer>Generated by ShopBill Pro${settings?.business_gstin ? ' · GSTIN: ' + settings?.business_gstin : ''}</footer>
      </body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); setTimeout(() => { win.close(); document.title = prevTitle; }, 500); };
  };

  const handleLowStockWhatsApp = () => {
    if (!data?.lowStockProducts?.length) return toast.error('No low stock items to share');
    const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const lines = data.lowStockProducts.map(p => {
      const toOrder = getOrderQty(p); // order qty only, current stock unchanged
      return `  • ${p.name}: Current ${p.stock} ${p.unit} → *Please send ${toOrder} ${p.unit}*`;
    }).join('\n');
    const msg = encodeURIComponent(
      `⚠️ *Low Stock Alert — ${settings?.business_name || 'My Shop'}*\nDate: ${today}\n` +
      `━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━\n` +
      `Total items needing restock: *${data.lowStockProducts.length}*\nPlease arrange stock at the earliest.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div>
      {/* ── Dashboard Header (Premium Command Center) ─────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 20,
        padding: '24px 28px',
        marginBottom: 24,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
        boxShadow: '0 10px 30px -5px rgba(2, 6, 23, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        {/* LEFT — Contextual Greeting (Ultra-Minimal) */}
        <div style={{ flex: '1 1 300px' }}>
          {isAdmin ? (
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: '#fff', margin: 0 }}>
              Welcome
            </h1>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Welcome back, {user?.display_name || user?.username || 'Manager'}
            </div>
          )}
        </div>

        {/* RIGHT — Live Metrics & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          
          {/* Glassmorphic Live Clock & Date */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '10px 18px',
            boxShadow: 'inset 0 0 12px rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '1px', color: '#fff' }}>
                {liveTimeIST.split(' ')[0]} <span style={{ fontSize: 12, opacity: 0.6 }}>{liveTimeIST.split(' ')[1]}</span>
              </div>
            </div>
            
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', position: 'relative' }}>
              <Calendar size={18} style={{ color: '#fcd34d' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: -2 }}>
                  {isToday ? 'Today' : 'Archive'}
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  max={getTodayIST()}
                  onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
                  style={{
                    border: 'none', outline: 'none', fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit', background: 'transparent',
                    cursor: 'pointer', color: isToday ? '#fff' : '#fcd34d', width: 110,
                  }}
                />
              </div>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(getTodayIST())}
                  style={{
                    background: '#fcd34d', border: 'none', cursor: 'pointer',
                    color: '#92400e', fontWeight: 800, fontSize: 10, padding: '4px 8px',
                    borderRadius: 6, whiteSpace: 'nowrap', transition: 'all 0.2s',
                    boxShadow: '0 4px 10px rgba(252, 211, 77, 0.2)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >↩ Today</button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link 
              to="/invoices/new" 
              className="btn" 
              style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                color: '#fff',
                border: 'none', 
                padding: '12px 20px',
                borderRadius: 14,
                fontWeight: 800,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(37, 99, 235, 0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(37, 99, 235, 0.4)'; }}
            >
              <FileText size={18} /> {t('New Bill', 'नया बिल')}
            </Link>
            
            <Link 
              to="/orders/new" 
              className="btn" 
              style={{ 
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                color: '#fff',
                border: 'none', 
                padding: '12px 20px',
                borderRadius: 14,
                fontWeight: 800,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 10px 20px -5px rgba(217, 119, 6, 0.4)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(217, 119, 6, 0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(217, 119, 6, 0.4)'; }}
            >
              <Package size={18} /> {t('New Order', 'नया ऑर्डर')}
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      {/* Notification bar — shows if any deliveries are arriving soon */}
      {arrivingSoon.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 8,
          padding: '10px 16px', marginBottom: 14, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} style={{ color: '#f59e0b' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                {arrivingSoon.length} vehicle{arrivingSoon.length > 1 ? 's' : ''} arriving soon!
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {arrivingSoon.map(d => `${d.vehicle_number} (${d.expected_arrival_ist})`).join(' · ')}
              </div>
            </div>
          </div>
          <button className="btn btn-warning btn-sm" onClick={scrollToDeparture}>
            View Details
          </button>
        </div>
      )}

      {/* Orders Notification */}
      {orders.length > 0 && (
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #3b82f6',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 14
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            📦 Orders Due Today: {orders.length}
          </div>

          {orders.map(o => (
            <div key={o._id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              fontSize: 13
            }}>
              <div>
                {o.customer_name} — {o.items?.[0]?.product_name} ({o.items?.[0]?.qty})
              </div>

              <Link
                to={`/invoices/new?orderId=${o._id}`}
                className="btn btn-primary btn-sm"
              >
                Generate Invoice
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Stats — all driven by selectedDate via global calendar */}

      <div className="stats-grid">

        {/* Today Sales card — dropdown + per-card calendar */}
        <div className="stat-card green" style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => {
            setShowTodaySales(d => {
              if (!d) {
                closeAllSummaryPanels('sales');
                setTodaySalesCardDate(selectedDate);
                setCardSalesData(null);
                loadCardSales(selectedDate);
                scrollToPanel(salesPanelRef);
              }
              return !d;
            });
          }}
        >
          <div className="stat-icon"><Calendar size={24} /></div>
          <div className="stat-value">{fc(data.todaySales)}</div>
          <div className="stat-label">
            {t("Today's Sales", 'आज की बिक्री')} · {data.todayCount} {t('bills', 'बिल')}
            <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2, fontWeight: 600 }}>
              {showTodaySales ? '▲ Hide' : '▼ View Bills'}
            </div>
          </div>
        </div>

        {/* Pending Dues card — dropdown + per-card calendar */}
        {/* Pending Dues — calendar removed from card, kept only inside dropdown */}
        <div className="stat-card red" style={{ cursor: 'pointer' }}
          onClick={() => setShowAllDues(d => {
            if (!d) {
              closeAllSummaryPanels('dues');
              setDuesCardDate(selectedDate);
              setDueDateInvoices(null);
              loadDueDateData(selectedDate);
              scrollToPanel(duesPanelRef);
            }
            return !d;
          })}
        >
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-value">{fc(data.pendingBalance)}</div>
          <div className="stat-label">
            {t("Today's Pending Dues", 'आज का बकाया')}
            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2, fontWeight: 600 }}>
              {showAllDues ? '▲ Hide' : '▼ View All Unpaid'}
            </div>
          </div>
        </div>

        {/* Customers — calendar removed, opens full customer list */}
        <div className="stat-card purple" style={{ cursor: 'pointer' }}
          onClick={() => {
            setShowCustomerDues(d => {
              if (!d) {
                closeAllSummaryPanels('customers');
                loadAllCustomers();
                scrollToPanel(customersPanelRef);
              }
              return !d;
            });
          }}
        >
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-value">{data.pendingCustomers?.length || 0}</div>
          <div className="stat-label">
            {t('Customers with Dues', 'बकाया ग्राहक')}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
              {showCustomerDues ? '▲ Hide' : '▼ View All Customers'}
            </div>
          </div>
        </div>



        {/* Products — shows top seller of day on card */}
        <div className="stat-card blue" style={{ cursor: 'pointer' }}
          onClick={() => { setShowProducts(d => { if (!d) { closeAllSummaryPanels('products'); scrollToPanel(productsPanelRef); } return !d; }); }}
        >
          <div className="stat-icon"><Package size={24} /></div>
          <div className="stat-value">{data.productCount}</div>
          <div className="stat-label">
            {t('Products', 'उत्पाद')}
            {/* Show top selling product of the day if available */}
            {data.topProducts?.[0] && (
              <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: 'var(--success)' }}>↑</span>
                {data.topProducts[0].product_name}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontWeight: 600 }}>
              {showProducts ? '▲ Hide' : '▼ View Stock & Price'}
            </div>
          </div>
        </div>

        {/* Settlement — replaces Total Invoices */}
        {/* Fix 4: Opens with today's data by default, auto-resets per day */}
        <div className="stat-card orange" style={{ cursor: 'pointer' }} onClick={() => {
          setShowStatement(d => {
            if (!d) {
              closeAllSummaryPanels('statement');
              setSettlementViewMode('date');
              setSettlementSearch('');
              setSettlementSortDate('desc');
              setSettlementSortAmount('');
              setSettlementCardDate(selectedDate);
              loadSettlements(selectedDate, 'date', '', 'desc', '');
              scrollToPanel(statementPanelRef);
            }
            return !d;
          });
        }}>

          <div className="stat-icon"><FileText size={24} /></div>
          <div className="stat-value">
            {settlementData.settlements.length > 0 ? settlementData.settlements.length : 0}
          </div>
          <div className="stat-label">
            {t('Settlement', 'सेटलमेंट')}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
              {settlementData.settlements.length > 0 ? (
                <>
                  {/* Entries = Paid Out + Received (all types) */}
                  {settlementData.settlements.length} entries ·{' '}
                  {settlementData.settlements.filter(s => s.type !== 'other_income').length} out
                </>
              ) : 'No entries today'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2, fontWeight: 600 }}>
              {showStatement ? '▲ Hide' : '▼ Daily Records'}
            </div>
          </div>
        </div>

        {/* Departure / Incoming goods quick-view card */}
        {/* Incoming Vehicles — dropdown + per-card date to view past deliveries */}
        {/* Incoming Vehicles — calendar removed from card */}
        <div className="stat-card amber" style={{ cursor: 'pointer', borderLeft: activeDeliveries.length > 0 ? '3px solid var(--warning)' : undefined }}
          onClick={() => {
            setShowDeparture(d => {
              if (!d) {
                closeAllSummaryPanels('departure');
                setDeliveryDateFilter(selectedDate);
                setDeliveryDateInput(selectedDate);
                loadDeliveries(selectedDate);
              }
              return !d;
            });
          }}
        >
          <div className="stat-icon"><Truck size={24} /></div>
          <div className="stat-value" style={{ color: activeDeliveries.length > 0 ? 'var(--warning)' : undefined }}>
            {activeDeliveries.length}
          </div>
          <div className="stat-label">
            {t('Departures / Incoming', 'डिलीवरी')}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
              {arrivingSoon.length > 0
                ? `⚠️ ${arrivingSoon.length} arriving soon`
                : showDeparture ? '▲ Hide' : '▼ View Vehicles'}
            </div>
          </div>
        </div>
      </div>


      {/* Products dropdown */}
      {showProducts && (
        <div className="card" style={{ marginBottom: 20 }} ref={productsPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title">
              📦 Products
              {data.allProducts?.length > 0 && (
                <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 11 }}>{data.allProducts.length}</span>
              )}
              {data.topProducts?.[0] && (
                <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                  ↑ Top Today: {data.topProducts[0].product_name}
                </span>
              )}
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <SortDropdown
                options={[
                  { key: 'name_asc', label: 'A-Z Name' },
                  { key: 'stock_asc', label: '↑ Low Stock First' },
                  { key: 'stock_desc', label: '↓ High Stock First' },
                  { key: 'price_asc', label: '↑ Low Price' },
                  { key: 'price_desc', label: '↓ High Price' },
                ]}
                value={productSort}
                onChange={v => { setProductSort(v); setProductSortOpen(false); }}
                open={productSortOpen}
                onToggle={() => { closeAllSortMenus('product'); setProductSortOpen(o => !o); }}
              />
              {/* PDF export of product list */}
              <button className="btn btn-outline btn-sm" onClick={() => {
                const rows = (data.allProducts || []).map((p, i) => `
                    <tr>
                      <td style="padding:7px 10px">${i + 1}</td>
                      <td style="padding:7px 10px;font-weight:600">${p.name}</td>
                      <td style="padding:7px 10px;text-align:right;color:${p.stock === 0 ? '#dc2626' : p.stock <= (parseInt(settings?.low_stock_threshold) || 10) ? '#d97706' : '#16a34a'};font-weight:700">${p.stock} ${p.unit}</td>
                      <td style="padding:7px 10px;text-align:right;font-family:monospace">₹${Number(p.price).toFixed(2)}</td>
                    </tr>`).join('');
                const win = window.open('', '_blank', 'width=800,height=600');
                const prevTitle = document.title;
                document.title = `Products-${getTodayIST()}`;
                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title}</title>
                    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:0;}table{width:100%;border-collapse:collapse;}
                    thead tr{background:#1a1f2e;color:#fff;}th{padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;}
                    tr:nth-child(even){background:#f9f9f9;}@page{margin:10mm;size:A4;}</style></head><body>
                    <div style="display:flex;justify-content:space-between;padding-bottom:12px;border-bottom:2px solid #1a1f2e;margin-bottom:14px">
                      <div><h2 style="margin:0">${settings?.business_name || 'My Shop'}</h2>
                      <p style="margin:4px 0;color:#6b7280">Product Stock List — ${getTodayIST()}</p></div></div>
                    <table><thead><tr><th>#</th><th>Product</th><th style="text-align:right">Stock</th><th style="text-align:right">Price</th></tr></thead>
                    <tbody>${rows}</tbody></table></body></html>`);
                win.document.close();
                win.onload = () => { win.print(); setTimeout(() => { win.close(); document.title = prevTitle; }, 500); };
              }}>📄 PDF</button>
              {/* WhatsApp share of product list */}
              <button className="btn btn-outline btn-sm" onClick={() => {
                const lines = (data.allProducts || []).map(p =>
                  `  • ${p.name}: *${p.stock} ${p.unit}* @ ₹${p.price}`
                ).join('\n');
                const msg = encodeURIComponent(
                  `📦 *Product Stock — ${settings?.business_name || 'My Shop'}*\nDate: ${getTodayIST()}\n━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━\nTotal: ${data.allProducts?.length} products`
                );
                window.open(`https://wa.me/?text=${msg}`, '_blank');
              }}>💬 WhatsApp</button>
              <Link to="/products?action=add" className="btn btn-primary btn-sm">+ Add Product</Link>
              <button className="btn btn-outline btn-sm" onClick={() => { setShowProducts(false); setProductSearch(''); }}>✕ Close</button>
            </div>
          </div>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            {/* Dynamic search */}

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                className="form-control"
                placeholder="🔍 Search product... (e.g. cement, rice)"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{ paddingLeft: 14 }}
              />
              {productSearch && (
                <button style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                  onClick={() => setProductSearch('')}>✕</button>
              )}
            </div>
          </div>
          <div className="card-body no-pad">
            {!data.allProducts?.length ? (
              <div className="empty-state" style={{ padding: 20 }}>
                No products yet. <Link to="/products" style={{ color: 'var(--primary)', fontWeight: 600 }}>Add your first product →</Link>
              </div>
            ) : (() => {
              const threshold = parseInt(settings?.low_stock_threshold) || 10;
              let filtered = productSearch.trim()
                ? data.allProducts.filter(p => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
                : [...data.allProducts];

              filtered = filtered.sort((a, b) => {
                if (productSort === 'stock_asc') return (a.stock || 0) - (b.stock || 0);
                if (productSort === 'stock_desc') return (b.stock || 0) - (a.stock || 0);
                if (productSort === 'price_asc') return (a.price || 0) - (b.price || 0);
                if (productSort === 'price_desc') return (b.price || 0) - (a.price || 0);
                return (a.name || '').localeCompare(b.name || ''); // name_asc default
              });

              if (!filtered.length) return (
                <div className="empty-state" style={{ padding: 20 }}>No products match "{productSearch}"</div>
              );

              return (
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Product</th>
                        <th style={{ padding: '9px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Stock</th>
                        <th style={{ padding: '9px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Price ₹</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, idx) => {
                        const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0) ? p.custom_low_stock : threshold;
                        const stockColor = p.stock === 0 ? 'var(--danger)' : p.stock <= minStock ? 'var(--warning)' : 'var(--success)';
                        // Highlight matching text
                        const hl = (text) => {
                          if (!productSearch.trim() || !text) return text;
                          const i = text.toLowerCase().indexOf(productSearch.trim().toLowerCase());
                          if (i === -1) return text;
                          return <>{text.slice(0, i)}<mark style={{ background: '#fef08a', padding: 0, borderRadius: 2 }}>{text.slice(i, i + productSearch.trim().length)}</mark>{text.slice(i + productSearch.trim().length)}</>;
                        };
                        return (
                          <tr key={p._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '9px 16px', fontWeight: 600 }}>{hl(p.name)}</td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 700, color: stockColor }}>
                              {p.stock} {p.unit}
                              {p.stock === 0 && <span style={{ marginLeft: 4, fontSize: 10, background: '#fef2f2', color: 'var(--danger)', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>Out</span>}
                            </td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fc(p.price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Customer Full Dropdown — all customers, name/phone/last invoice/due status */}
      {showCustomerDues && (
        <div className="card" style={{ marginBottom: 20 }} ref={customersPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title">
              👥 All Customers
              {allCustomers.length > 0 && (
                <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 11 }}>{allCustomers.length}</span>
              )}
            </div>
            <div className="flex gap-2">
              <SortDropdown
                options={[
                  { key: 'due_desc', label: '↓ High Due First' },
                  { key: 'due_asc', label: '↑ Low Due First' },
                  { key: 'name_asc', label: 'A-Z Name' },
                  { key: 'name_desc', label: 'Z-A Name' },
                  { key: 'registered_first', label: '✦ Registered First' },
                  { key: 'walkin_first', label: '◈ Walk-in First' },
                ]}
                value={customerSort}
                onChange={v => { setCustomerSort(v); setCustomerSortOpen(false); }}
                open={customerSortOpen}
                onToggle={() => { closeAllSortMenus('customer'); setCustomerSortOpen(o => !o); }}
              />
              <Link to="/customers?action=add" className="btn btn-primary btn-sm">+ Add Customer</Link>
              <button className="btn btn-outline btn-sm" onClick={() => {
                setShowCustomerDues(false);
                setCustomerSearch('');
              }}>✕ Close</button>
            </div>
          </div>
          <div className="card-body">
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                className="form-control"
                placeholder="🔍 Search by name or phone..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                style={{ paddingLeft: 14 }}
              />
              {customerSearch && (
                <button style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                  onClick={() => setCustomerSearch('')}>✕</button>
              )}
            </div>
          </div>


          <div className="card-body no-pad">
            {customersLoading ? (
              <div className="loading"><span className="spinner"></span></div>
            ) : (() => {
              const q = customerSearch.trim().toLowerCase();
              // Build a dues map from pendingCustomers for quick lookup
              const duesMap = {};
              (data.pendingCustomers || []).forEach(c => {
                duesMap[String(c._id)] = c.balance;
              });

              let filtered = q
                ? allCustomers.filter(c =>
                  (c.name || '').toLowerCase().includes(q) ||
                  (c.phone || '').toLowerCase().includes(q)
                )
                : [...allCustomers];

              // Apply customer sort
              filtered = filtered.sort((a, b) => {
                const dueA = duesMap[String(a._id)] || a.balance || 0;
                const dueB = duesMap[String(b._id)] || b.balance || 0;
                if (customerSort === 'due_asc') return dueA - dueB;
                if (customerSort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
                if (customerSort === 'name_desc') return (b.name || '').localeCompare(a.name || '');
                if (customerSort === 'registered_first') return (a.type === 'registered' ? -1 : 1);
                if (customerSort === 'walkin_first') return (a.type === 'walkin' ? -1 : 1);
                return dueB - dueA; // due_desc default
              });

              if (!filtered.length) return (
                <div className="empty-state" style={{ padding: 24 }}>
                  {q ? `No customers match "${customerSearch}"` : 'No customers yet. Click "+ Add Customer" to add one.'}
                </div>
              );

              return (
                <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {['Customer', 'Phone', 'Balance Due', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Balance Due' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c, idx) => {
                        const due = duesMap[String(c._id)] || c.balance || 0;
                        const hasDue = due > 0.01;
                        return (
                          <tr key={c._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 16px' }}>
                              <Link to={`/customers`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                                {c.name}
                              </Link>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              {c.phone ? (
                                hasDue ? (
                                  <a
                                    href={`https://wa.me/91${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hello ' + c.name + ',\nThis is a gentle reminder from ' + (settings?.business_name || 'our store') + '.\nYour outstanding balance is Rs.' + (due && due.toFixed ? due.toFixed(2) : due) + '.\nKindly clear at your earliest convenience.\nThank you.')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#25d366', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                                  >
                                    💬 {c.phone}
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.phone}</span>
                                )
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: hasDue ? 'var(--danger)' : 'var(--success)' }}>
                              {hasDue ? fc(due) : '—'}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              {hasDue ? (
                                <span className="badge badge-danger" style={{ fontSize: 10 }}>Due: {fc(due)}</span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: 10 }}>✓ Clear</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* Departure / Incoming Goods Panel */}
      {showDeparture && (
        <div className="card" style={{ marginBottom: 20 }} ref={departureRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Truck size={18} /> Incoming Goods
              {activeDeliveries.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 11 }}>
                  {activeDeliveries.length} active
                </span>
              )}
              {deliveryDateFilter && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                  — {new Date(deliveryDateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {/* Calendar with OK button inside dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                <Calendar size={13} className="text-muted" style={{ marginRight: 4 }} />
                <input
                  type="date"
                  value={deliveryDateInput || getTodayIST()}
                  max={getTodayIST()}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
                  onChange={e => {
                    // Apply instantly on select — no OK button needed
                    const d = e.target.value || getTodayIST();
                    setDeliveryDateInput(d);
                    setDeliveryDateFilter(d);
                    loadDeliveries(d);
                  }}
                />
                {deliveryDateFilter && deliveryDateFilter !== getTodayIST() && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: 11, color: 'var(--text-muted)' }}
                    onClick={() => {
                      setDeliveryDateFilter('');
                      setDeliveryDateInput('');
                      loadDeliveries(getTodayIST());
                    }}
                  >✕ Today</button>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditDeliveryId(null);
                  setDeliveryForm({
                    vehicle_number: '', driver_name: '', supplier: '',
                    expected_arrival: getNowDateTimeLocal(), // always default to now
                    notes: '',
                    items: [
                      { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' },
                      { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' },
                    ]
                  });
                  setShowDeliveryForm(d => !d);
                  setShowWalkinDelivery(false);
                }}
              >
                {showDeliveryForm && !editDeliveryId ? '✕ Cancel' : '+ Add Vehicle'}
              </button>
              {/* Walk-in Delivery button */}
              <button
                className="btn btn-warning btn-sm"
                onClick={() => {
                  setShowWalkinDelivery(d => !d);
                  setShowDeliveryForm(false);
                }}
              >
                {showWalkinDelivery ? '✕ Cancel' : <><UserCheck size={13} style={{ marginRight: 4 }} /> Walk-in Delivery</>}
              </button>
              <SortDropdown
                options={[
                  { key: 'time_asc', label: '↑ Expected Time' },
                  { key: 'time_desc', label: '↓ Expected Time' },
                  { key: 'supplier_asc', label: 'A-Z Supplier' },
                  { key: 'items_desc', label: '↓ Most Items' },
                  { key: 'delivered_first', label: '✓ Delivered First' },
                  { key: 'pending_first', label: '⧗ Pending First' },
                ]}
                value={vehicleSort}
                onChange={v => { setVehicleSort(v); setVehicleSortOpen(false); }}
                open={vehicleSortOpen}
                onToggle={() => { closeAllSortMenus('vehicle'); setVehicleSortOpen(o => !o); }}
              />
              <button className="btn btn-outline btn-sm" onClick={() => {
                setShowDeparture(false);
                setShowDeliveryForm(false);
                setShowWalkinDelivery(false);
              }}>✕ Close</button>
            </div>
          </div>

          <div className="card-body">

            {/* Walk-in Delivery Form */}
            {showWalkinDelivery && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🚶 Walk-in Delivery (No Vehicle Required)</div>
                <div className="form-row">
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Supplier / Party Name *</label>
                    <input className="form-control"
                      value={walkinDeliveryForm.supplier}
                      onChange={e => {
                        setWalkinDeliveryForm(f => ({ ...f, supplier: e.target.value }));
                        searchSuppliers(e.target.value);
                      }}
                      onBlur={() => setTimeout(() => setSupplierSuggestions([]), 200)}
                      placeholder="Type supplier name..." />
                    {/* Supplier suggestions + add-new */}
                    {walkinDeliveryForm.supplier && supplierSuggestions !== null && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100 }}>
                        {supplierSuggestions.map(s => (
                          <div key={s._id}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                            onMouseDown={() => { setWalkinDeliveryForm(f => ({ ...f, supplier: s.name })); setSupplierSuggestions([]); }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            {s.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.phone}</div>}
                          </div>
                        ))}
                        {/* Always show add-new supplier option */}
                        <div
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                          onMouseDown={() => {
                            // Keep typed name, close dropdown
                            setSupplierSuggestions([]);
                            // Will be saved to supplier list on delivery via handleWalkinDelivery
                            toast('Supplier will be saved when delivery is recorded', { icon: 'ℹ️', duration: 2500 });
                          }}
                        >
                          + Add "{walkinDeliveryForm.supplier}" as new supplier
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-control" value={walkinDeliveryForm.notes}
                      onChange={e => setWalkinDeliveryForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional notes" />
                  </div>
                </div>

                {/* Items — same dynamic logic as Incoming Vehicle, Type removed */}
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📦 Items</div>
                {walkinDeliveryForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                    {/* Item Name with product suggestions */}
                    <div style={{ position: 'relative' }}>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Item Name *</div>}
                      <input className="form-control" value={item.item_name}
                        placeholder="Type to search..."
                        onChange={e => {
                          const val = e.target.value;
                          updateWalkinItem(idx, 'item_name', val);
                          // Auto qty to 1 on first char
                          if (val && item.quantity === '0') updateWalkinItem(idx, 'quantity', '1');
                          setProductSuggestIdx(1000 + idx); // offset to differentiate from delivery form
                          searchProducts(val);
                        }}
                        onBlur={() => setTimeout(() => { setProductSuggestions([]); setProductSuggestIdx(null); }, 200)}
                      />
                      {productSuggestIdx === 1000 + idx && item.item_name.trim() && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto' }}>
                          {productSuggestions.map(p => (
                            <div key={p._id}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}
                              onMouseDown={() => {
                                setWalkinDeliveryForm(f => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], item_name: p.name, quantity: '1', unit: p.unit || 'bag', product_id: p._id };
                                  if (idx === items.length - 1) items.push({ item_name: '', quantity: '0', unit: 'bag', price: '', label: 'Goods' });
                                  return { ...f, items };
                                });
                                setProductSuggestions([]); setProductSuggestIdx(null);
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stock: {p.stock} {p.unit} · ₹{p.price}</div>
                              </div>
                            </div>
                          ))}
                          <div
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                            onMouseDown={() => { setProductSuggestions([]); setProductSuggestIdx(null); toast('New item saved on delivery', { icon: 'ℹ️' }); }}
                          >
                            + Use "{item.item_name}" as new item
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Qty</div>}
                      <input className="form-control" type="number" min="0" step="0.01"
                        value={item.quantity}
                        onChange={e => updateWalkinItem(idx, 'quantity', e.target.value)}
                        placeholder="0" />
                    </div>

                    {/* Unit — dynamic search */}
                    <div style={{ position: 'relative' }}>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Unit</div>}
                      <input className="form-control" value={item.unit || ''}
                        placeholder="bag"
                        onChange={e => { updateWalkinItem(idx, 'unit', e.target.value); setProductSuggestIdx(`wunit_${idx}`); }}
                        onFocus={() => setProductSuggestIdx(`wunit_${idx}`)}
                        onBlur={() => setTimeout(() => setProductSuggestIdx(null), 200)}
                      />
                      {productSuggestIdx === `wunit_${idx}` && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto' }}>
                          {allUnits
                            .filter(u => !item.unit || u.toLowerCase().includes((item.unit || '').toLowerCase()))
                            .map(u => (
                              <div key={u}
                                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                                onMouseDown={() => { updateWalkinItem(idx, 'unit', u); setProductSuggestIdx(null); }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >{u}</div>
                            ))}
                          {item.unit && !allUnits.includes(item.unit.toLowerCase().trim()) && (
                            <div
                              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                              onMouseDown={() => { addCustomUnit(item.unit); setProductSuggestIdx(null); toast(`Unit "${item.unit}" saved`, { icon: '✓' }); }}
                            >+ Add "{item.unit}" as new unit</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Price ₹</div>}
                      <input className="form-control" type="number" min="0" step="0.01"
                        value={item.price}
                        onChange={e => updateWalkinItem(idx, 'price', e.target.value)}
                        placeholder="0.00" />
                    </div>

                    <div>
                      {walkinDeliveryForm.items.length > 1 && (
                        <button className="btn btn-danger btn-sm"
                          onClick={() => setWalkinDeliveryForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>✕</button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total + Payment */}
                {(() => {
                  const total = walkinDeliveryForm.items.reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)), 0);
                  return total > 0 ? (
                    <div style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Total: <span style={{ color: 'var(--primary)' }}>{fc(total)}</span></div>
                        {/* Fix 5: Unpaid indicator */}
                        {!walkinDeliveryForm.paid && (
                          <span style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                            ⚠️ Unpaid
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
                          <input type="checkbox" checked={walkinDeliveryForm.paid}
                            onChange={e => setWalkinDeliveryForm(f => ({ ...f, paid: e.target.checked }))} />
                          Mark as Paid
                        </label>
                        {walkinDeliveryForm.paid && (
                          <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
                            value={walkinDeliveryForm.mode}
                            onChange={e => setWalkinDeliveryForm(f => ({ ...f, mode: e.target.value }))}>
                            <option value="cash">💵 Cash</option>
                            <option value="upi">📱 UPI</option>
                            <option value="online">🌐 Online</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setShowWalkinDelivery(false)}>Cancel</button>
                  <button className="btn btn-warning" onClick={handleWalkinDelivery} disabled={walkinDeliverySaving}>
                    {walkinDeliverySaving ? <><span className="spinner"></span> Saving...</> : '💾 Save Walk-in Delivery'}
                  </button>
                </div>
              </div>
            )}

            {/* Add / Edit Delivery Form */}
            {showDeliveryForm && (
              <div style={{ background: '#f8fafc', border: '1.5px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                  {editDeliveryId ? '✏️ Edit Delivery Entry' : '➕ New Incoming Vehicle'}
                </div>

                <div className="form-row">
                  {/* Fix 4: Vehicle number — auto uppercase */}
                  <div className="form-group">
                    <label className="form-label">Vehicle Number *</label>
                    <input className="form-control"
                      value={deliveryForm.vehicle_number}
                      onChange={e => setDeliveryForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                      placeholder="e.g. UK07AB1234"
                      style={{ textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'monospace' }} />
                  </div>
                  <div className="form-group">
                      <label className="form-label">Driver Name</label>
                      <input className="form-control"
                        value={deliveryForm.driver_name}
                        onChange={e => {
                          const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                          setDeliveryForm(f => ({ ...f, driver_name: val }));
                        }}
                        placeholder="e.g. Pankaj Singh" />
                    </div>
                  {/* Fix 4: Supplier from Settlement supplier data */}
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Supplier / Party</label>
                    <input className="form-control"
                      value={deliveryForm.supplier}
                      onChange={e => {
                        setDeliveryForm(f => ({ ...f, supplier: e.target.value }));
                        searchSuppliers(e.target.value);
                      }}
                      onBlur={() => setTimeout(() => setSupplierSuggestions([]), 200)}
                      placeholder="Type to search suppliers..." />
                    {/* Same dropdown as walk-in — includes add-new option */}
                    {deliveryForm.supplier && supplierSuggestions !== null && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto' }}>
                        {supplierSuggestions.map(s => (
                          <div key={s._id}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13.5, borderBottom: '1px solid #f3f4f6' }}
                            onMouseDown={() => {
                              setDeliveryForm(f => ({ ...f, supplier: s.name }));
                              setSupplierSuggestions([]);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            {s.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.phone}</div>}
                          </div>
                        ))}
                        {/* Add new supplier option — same as walk-in */}
                        <div
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                          onMouseDown={() => {
                            setSupplierSuggestions([]);
                            toast('Supplier will be saved when delivery is marked complete', { icon: 'ℹ️', duration: 2500 });
                          }}
                        >
                          + Add "{deliveryForm.supplier}" as new supplier
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expected Arrival Date & Time *</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input className="form-control" type="datetime-local"
                        value={deliveryForm.expected_arrival}
                        onChange={e => setDeliveryForm(f => ({ ...f, expected_arrival: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                      {deliveryForm.expected_arrival && (
                        <button
                          className="btn btn-success btn-sm"
                          type="button"
                          onClick={() => toast.success(
                            `Set: ${new Date(deliveryForm.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
                            { duration: 2000 }
                          )}
                          style={{ whiteSpace: 'nowrap' }}
                        >✓ OK</button>
                      )}
                    </div>
                    {deliveryForm.expected_arrival && (
                      <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                        📅 {new Date(deliveryForm.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fix 4: Items — product suggestions + auto-new row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>📦 Items</div>
                  {/* Fetch from Low Stock — always visible, not conditional */}
                  <button
                    className="btn btn-warning btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      const threshold = parseInt(settings?.low_stock_threshold) || 10;
                      const lowItems = data?.lowStockProducts || [];

                      if (!lowItems.length) {
                        toast('No low stock items found. All products adequately stocked.', { icon: '✅' });
                        return;
                      }

                      const mapped = lowItems.map(p => {
                        const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0)
                          ? p.custom_low_stock : threshold;
                        const neededQty = Math.max(1, minStock - p.stock);
                        return {
                          item_name: p.name,
                          quantity: String(neededQty),
                          unit: p.unit || 'bag',
                          product_id: p._id,
                          label: 'Goods',
                          is_new_item: false,
                        };
                      });

                      setDeliveryForm(f => ({
                        ...f,
                        items: [
                          ...mapped,
                          { item_name: '', quantity: '0', unit: 'bag', product_id: '', label: 'Goods' },
                        ],
                      }));
                      toast.success(`${mapped.length} low stock item${mapped.length !== 1 ? 's' : ''} imported`);
                    }}
                  >
                    ⚠️ Fetch from Low Stock
                  </button>
                </div>

                {deliveryForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>

                    {/* Item Name — live product search, always shows add-new */}
                    <div style={{ position: 'relative' }}>
                      {idx === 0 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Item Name *
                        </div>
                      )}
                      <input
                        className="form-control"
                        value={item.item_name}
                        placeholder="Type to search..."
                        onChange={e => {
                          const val = e.target.value;
                          // Auto qty=1 when user starts typing item name
                          setDeliveryForm(f => {
                            const updated = [...f.items];
                            updated[idx] = {
                              ...updated[idx],
                              item_name: val,
                              // Set qty to 1 when first character typed and qty is still 0
                              quantity: (val && updated[idx].quantity === '0') ? '1' : updated[idx].quantity,
                            };
                            return { ...f, items: checkAutoAddRow(updated) };
                          });
                          setProductSuggestIdx(idx);
                          searchProducts(val);
                        }}
                        onBlur={() => setTimeout(() => { setProductSuggestions([]); setProductSuggestIdx(null); }, 200)}
                      />
                      {/* Dropdown: always shown when typing — products + add-new */}
                      {productSuggestIdx === idx && item.item_name.trim() && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto',
                        }}>
                          {/* Existing product matches */}
                          {productSuggestions.map(p => (
                            <div key={p._id}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              onMouseDown={() => {
                                setDeliveryForm(f => {
                                  const updated = [...f.items];
                                  updated[idx] = {
                                    ...updated[idx],
                                    item_name: p.name,
                                    quantity: '1', // auto set to 1 on product select
                                    unit: p.unit || 'bag',
                                    product_id: p._id,
                                    is_new_item: false,
                                  };
                                  return { ...f, items: checkAutoAddRow(updated) };
                                });
                                setProductSuggestions([]);
                                setProductSuggestIdx(null);
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Stock: {p.stock} {p.unit} · ₹{p.price}
                                </div>
                              </div>
                              <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 7px', borderRadius: 10, color: 'var(--text-muted)' }}>
                                {p.unit}
                              </span>
                            </div>
                          ))}
                          {/* Always show add-new option when typing */}
                          <div
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff', borderTop: productSuggestions.length > 0 ? '1px solid #bfdbfe' : 'none' }}
                            onMouseDown={() => {
                              setDeliveryForm(f => {
                                const updated = [...f.items];
                                updated[idx] = {
                                  ...updated[idx],
                                  product_id: '',
                                  quantity: updated[idx].quantity === '0' ? '1' : updated[idx].quantity,
                                  is_new_item: true,
                                };
                                return { ...f, items: checkAutoAddRow(updated) };
                              });
                              setProductSuggestions([]);
                              setProductSuggestIdx(null);
                              toast('New product will be created when delivery is marked complete', { icon: 'ℹ️', duration: 3000 });
                            }}
                          >
                            + Use "{item.item_name}" as new product (created on delivery)
                          </div>
                        </div>
                      )}
                      {/* New item badge */}
                      {item.is_new_item && item.item_name && (
                        <div style={{ fontSize: 10, color: '#92400e', background: '#fffbeb', padding: '1px 6px', borderRadius: 6, marginTop: 3, display: 'inline-block' }}>
                          🆕 New — will be created on delivery
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      {idx === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Qty</div>}
                      <input className="form-control" type="number" min="0" step="0.01"
                        value={item.quantity}
                        onChange={e => updateDeliveryItem(idx, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </div>

                    {/* Unit — dynamic search + add new */}
                    <div style={{ position: 'relative' }}>
                      {idx === 0 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Unit</div>
                      )}
                      <input
                        className="form-control"
                        value={item.unit || ''}
                        placeholder="bag"
                        onChange={e => {
                          updateDeliveryItem(idx, 'unit', e.target.value);
                          // open suggestions
                          setProductSuggestIdx(`unit_${idx}`);
                        }}
                        onFocus={() => setProductSuggestIdx(`unit_${idx}`)}
                        onBlur={() => setTimeout(() => setProductSuggestIdx(null), 200)}
                      />
                      {productSuggestIdx === `unit_${idx}` && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: '#fff', border: '1.5px solid var(--border)', borderRadius: 6,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto',
                        }}>
                          {allUnits
                            .filter(u => !item.unit || u.toLowerCase().includes((item.unit || '').toLowerCase()))
                            .map(u => (
                              <div key={u}
                                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                                onMouseDown={() => {
                                  updateDeliveryItem(idx, 'unit', u);
                                  setProductSuggestIdx(null);
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >{u}</div>
                            ))}
                          {/* Add new unit option */}
                          {item.unit && !allUnits.includes(item.unit.toLowerCase().trim()) && (
                            <div
                              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: '#eff6ff' }}
                              onMouseDown={() => {
                                addCustomUnit(item.unit);
                                setProductSuggestIdx(null);
                                toast(`Unit "${item.unit}" saved for future use`, { icon: '✓', duration: 2000 });
                              }}
                            >
                              + Add "{item.unit}" as new unit
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Remove row */}
                    <div>
                      {deliveryForm.items.length > 1 && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeDeliveryItem(idx)}>✕</button>
                      )}
                    </div>

                  </div>
                ))}

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-control"
                    value={deliveryForm.notes}
                    onChange={e => setDeliveryForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes" />
                </div>

                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => { setShowDeliveryForm(false); setEditDeliveryId(null); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveDelivery} disabled={deliverySaving}>
                    {deliverySaving ? <><span className="spinner"></span> Saving...</> : editDeliveryId ? '💾 Update' : '💾 Save Entry'}
                  </button>
                </div>
              </div>
            )}

            {/* Deliveries List — sorted */}
            {(() => {
              const sorted = [...deliveries].sort((a, b) => {
                if (vehicleSort === 'time_desc') return new Date(b.expected_arrival) - new Date(a.expected_arrival);
                if (vehicleSort === 'supplier_asc') return (a.supplier || '').localeCompare(b.supplier || '');
                if (vehicleSort === 'items_desc') return (b.items?.length || 0) - (a.items?.length || 0);
                if (vehicleSort === 'delivered_first') return a.status === 'delivered' ? -1 : 1;
                if (vehicleSort === 'pending_first') return a.status !== 'delivered' ? -1 : 1;
                return new Date(a.expected_arrival) - new Date(b.expected_arrival);
              });
              return sorted.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  No incoming vehicles scheduled for today. Click "+ Add Vehicle" to add one.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Vehicle', 'Driver', 'Supplier', 'Expected At', 'Items', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((d, idx) => {
                        const statusColors = {
                          pending: 'badge-gray',
                          on_the_way: 'badge-primary',
                          arriving_soon: 'badge-warning',
                          delivered: 'badge-success',
                          not_delivered: 'badge-danger',
                        };
                        const statusLabels = {
                          pending: '⏳ Pending',
                          on_the_way: '🚛 On the Way',
                          arriving_soon: '⚠️ Arriving Soon',
                          delivered: '✅ Delivered',
                          not_delivered: '❌ Not Delivered',
                        };
                        return (
                          <tr key={d._id} style={{
                            borderBottom: '1px solid #f3f4f6',
                            background: d.vehicle_number === 'WALK-IN' && d.payment_status !== 'paid'
                              ? '#fffbeb'  // yellow for unpaid walk-in
                              : d.status === 'arriving_soon'
                                ? '#fef9ec'
                                : idx % 2 === 0 ? '#fff' : '#fafafa',
                            borderLeft: d.vehicle_number === 'WALK-IN' && d.status !== 'delivered'
                              ? '3px solid #f59e0b' : 'none',
                          }}>
                            <td style={{ padding: '10px 12px' }}>
                              <Link
                                to={`/vehicle/${d._id}`}
                                style={{ fontWeight: 800, fontFamily: 'monospace', letterSpacing: 0.5, color: 'var(--primary)', textDecoration: 'none' }}
                              >
                                {d.vehicle_number}
                              </Link>
                              {d.vehicle_number === 'WALK-IN' && d.payment_status !== 'paid' && (
                                <div style={{ fontSize: 10, background: '#fef08a', color: '#92400e', padding: '1px 6px', borderRadius: 8, marginTop: 2, display: 'inline-block', fontWeight: 700 }}>
                                  ⚠️ Unpaid
                                </div>
                              )}
                              {d.vehicle_number === 'WALK-IN' && d.payment_status === 'paid' && (
                                <div style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 8, marginTop: 2, display: 'inline-block', fontWeight: 700 }}>
                                  ✅ Paid{d.payment_mode ? ` · ${d.payment_mode}` : ''}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{d.driver_name || '—'}</td>
                            <td style={{ padding: '10px 12px' }}>{d.supplier || '—'}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                              {d.expected_arrival_ist}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ maxWidth: 180 }}>
                                {d.items.slice(0, 3).map((item, i) => (
                                  <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {item.item_name}: <strong>{item.quantity} {item.unit}</strong>
                                  </div>
                                ))}
                                {d.items.length > 3 && (
                                  <Link to={`/vehicle/${d._id}`} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                                    +{d.items.length - 3} more →
                                  </Link>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span className={`badge ${statusColors[d.status]}`} style={{ fontSize: 11 }}>
                                {statusLabels[d.status]}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                                {/* Only show Delivered / Not Delivered for non-completed entries */}
                                {d.status !== 'delivered' && d.status !== 'not_delivered' && (
                                  <>
                                    <button
                                      className="btn btn-success btn-sm"
                                      style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      onClick={() => {
                                        if (window.confirm(`Mark as delivered? Stock will be updated automatically for matched products.`))
                                          handleDeliveryStatus(d._id, 'delivered');
                                      }}
                                    ><CheckCircle size={11} /> Delivered</button>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      onClick={() => handleDeliveryStatus(d._id, 'not_delivered')}
                                    ><XCircle size={11} /> Not Delivered</button>
                                    <button
                                      className="btn btn-warning btn-sm"
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}
                                      onClick={() => openEditDelivery(d)}
                                    ><Edit2 size={11} /></button>
                                  </>
                                )}
                                {/* Allow re-open if not_delivered */}
                                {d.status === 'not_delivered' && (
                                  <button
                                    className="btn btn-outline btn-sm"
                                    style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => handleDeliveryStatus(d._id, 'pending')}
                                  ><RotateCcw size={11} /> Reopen</button>
                                )}
                                {/* Walk-in specific: Paid button separate from delivery status */}
                                {d.vehicle_number === 'WALK-IN' && d.payment_status !== 'paid' && (
                                  <button
                                    className="btn btn-warning btn-sm"
                                    style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => {
                                      const mode = window.prompt('Payment mode? (cash/upi/online)', 'cash');
                                      if (mode !== null) handleMarkWalkinPaid(d._id, mode || 'cash');
                                    }}
                                  ><CreditCard size={11} /> Mark Paid</button>
                                )}
                                {d.status !== 'delivered' && (
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}
                                    onClick={() => handleDeleteDelivery(d._id)}
                                  ><Trash2 size={11} /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            {/* Stock update note */}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span><strong>Auto Stock Update:</strong> When a delivery is marked "Delivered", stock is automatically increased for items that have a matching product linked. Items without a product link are logged as movements only.</span>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Panel */}
      {showStatement && (
        <div className="card" style={{ marginBottom: 20 }} ref={statementPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="card-title">
              📋 Settlement
              {/* Fix 3 & 4: Show which date/mode is active */}
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                {settlementViewMode === 'all'
                  ? '— Full History'
                  : `— ${new Date(settlementCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
              </span>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <SortDropdown
                options={[
                  { key: 'date_desc', label: '↓ Latest Date' },
                  { key: 'date_asc', label: '↑ Oldest Date' },
                  { key: 'amount_desc', label: '↓ High Amount' },
                  { key: 'amount_asc', label: '↑ Low Amount' },
                ]}
                value={settlementSortKey}
                onChange={v => {
                  setSettlementSortOpen(false);
                  if (v === 'amount_desc') { setSettlementSortAmount('desc'); setSettlementSortDate(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, '', 'desc'); }
                  else if (v === 'amount_asc') { setSettlementSortAmount('asc'); setSettlementSortDate(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, '', 'asc'); }
                  else if (v === 'date_asc') { setSettlementSortDate('asc'); setSettlementSortAmount(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, 'asc', ''); }
                  else { setSettlementSortDate('desc'); setSettlementSortAmount(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, 'desc', ''); }
                }}
                open={settlementSortOpen}
                onToggle={() => setSettlementSortOpen(o => !o)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => {
                setShowAddSettlement(a => {
                  if (!a) {
                    // Scroll into view after state update
                    setTimeout(() => {
                      addSettlementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 80);
                  }
                  return !a;
                });
              }}>
                {showAddSettlement ? '✕ Cancel' : '+ Add Entry'}
              </button>
              <Link to="/suppliers" className="btn btn-outline btn-sm">🏭 Suppliers</Link>
              <button className="btn btn-outline btn-sm" onClick={() => setShowStatement(false)}>✕ Close</button>
            </div>
          </div>

          <div className="card-body">

            {/* Fix 4: Settlement date controls — independent of global calendar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>View:</span>

              {/* Today — loads today's settlements only */}
              <button
                className={`btn btn-sm ${settlementViewMode === 'date' && settlementCardDate === getTodayIST() ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setSettlementViewMode('date');
                  setSettlementCardDate(getTodayIST());
                  loadSettlements(getTodayIST(), 'date', settlementSearch, settlementSortDate, settlementSortAmount);
                }}
              >Today</button>

              {/* Yesterday — loads yesterday's settlements only */}
              {/* Yesterday removed — use calendar instead */}

              {/* Fix 4: Calendar input — changes only settlement view, not global dashboard */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                <span style={{ fontSize: 13 }}>📅</span>
                <input
                  type="date"
                  value={settlementCardDate}
                  max={getTodayIST()}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                  onChange={e => {
                    const d = e.target.value;
                    if (!d) return;
                    setSettlementCardDate(d);
                    setSettlementViewMode('date');
                    // Fix 4: Load for this specific date WITHOUT affecting global selectedDate
                    loadSettlements(d, 'date', settlementSearch, settlementSortDate, settlementSortAmount);
                  }}
                />
              </div>

              {/* Fix 4 & 5: Full history toggle */}
              <button
                className={`btn btn-sm ${settlementViewMode === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  const newMode = settlementViewMode === 'all' ? 'date' : 'all';
                  setSettlementViewMode(newMode);
                  loadSettlements(selectedDate, newMode, settlementSearch, settlementSortDate, settlementSortAmount);
                }}
              >
                {settlementViewMode === 'all' ? '▲ Hide Full History' : '📚 Full History'}
              </button>
            </div>

            {/* Fix 2: Search by party + Sort controls */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Party name search */}
              <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Search by Party</div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    placeholder="Supplier / party name..."
                    value={settlementSearch}
                    onChange={e => {
                      setSettlementSearch(e.target.value);
                      // Search in real-time with slight delay
                      clearTimeout(window._settlementSearchTimer);
                      window._settlementSearchTimer = setTimeout(() => {
                        loadSettlements(selectedDate, settlementViewMode, e.target.value, settlementSortDate, settlementSortAmount);
                      }, 400);
                    }}
                    style={{ paddingRight: settlementSearch ? 32 : 12 }}
                  />
                  {settlementSearch && (
                    <button
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                      onClick={() => {
                        setSettlementSearch('');
                        loadSettlements(selectedDate, settlementViewMode, '', settlementSortDate, settlementSortAmount);
                      }}
                    >✕</button>
                  )}
                </div>
                {/* Professional dropdown suggestions — shown only when typing */}
                {settlementSearch.trim() && settlementData.partyNames?.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1.5px solid var(--border)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 2,
                  }}>
                    {settlementData.partyNames
                      .filter(p => p.toLowerCase().includes(settlementSearch.toLowerCase()))
                      .slice(0, 8)
                      .map(p => (
                        <div key={p}
                          style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}
                          onMouseDown={() => {
                            setSettlementSearch(p);
                            loadSettlements(settlementCardDate, settlementViewMode, p, settlementSortDate, settlementSortAmount);
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontSize: 14 }}>🏭</span>
                          <span style={{ fontWeight: 600 }}>{p}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Sort controls moved to card header */}

            </div>

            {/* Fix 1: Received = invoice payments collected + other_income entries */}
            {(() => {
              // Fix 3: Use the settlement card's date to fetch correct received amount
              // statementData is from the global dashboard (selectedDate)
              // When settlementCardDate differs, we need the right received amount
              // Fix 3: Use settlement-date-specific received, not global dashboard date
              const invoiceReceived = settlementInvoiceReceived || data?.statementData?.totalReceived || 0;
              const otherIncome = settlementData.totalIn || 0;
              // Total received = both combined
              const totalReceived = invoiceReceived + otherIncome;
              const net = totalReceived - (settlementData.totalOut || 0);

              // Fix 2: Build paid-out and received detail entries
              const paidOutEntries = (settlementData.settlements || [])
                .filter(s => s.type !== 'other_income');
              const receivedEntries = [
                // Invoice payments
                ...(data?.statementData?.byMode
                  ? Object.entries(data.statementData.byMode).map(([mode, amt]) => ({
                    label: `Invoice Payments`,
                    party: 'Customers',
                    mode,
                    amount: amt,
                    reason: 'Invoice cleared / partial payment',
                    ist_formatted: settlementCardDate,
                  }))
                  : []),
                // Other income settlement entries
                ...(settlementData.settlements || [])
                  .filter(s => s.type === 'other_income')
                  .map(s => ({
                    label: s.party_name || 'Other Income',
                    party: s.party_name || '—',
                    mode: s.mode,
                    amount: s.amount,
                    reason: s.notes || 'Other income',
                    ist_formatted: s.ist_formatted,
                  })),
              ];

              return (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    {/* Fix 2: Paid Out — clickable */}
                    <div
                      style={{ background: '#fef2f2', border: `1.5px solid ${showPaidOutDetail ? '#dc2626' : '#fca5a5'}`, borderRadius: 8, padding: '12px 18px', flex: 1, minWidth: 130, cursor: 'pointer' }}
                      onClick={() => { setShowPaidOutDetail(d => !d); setShowReceivedDetail(false); }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>
                        Paid Out {showPaidOutDetail ? '▲' : '▼'}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)', marginTop: 4 }}>{fc(settlementData.totalOut)}</div>
                    </div>

                    {/* Fix 2: Received — clickable */}
                    <div
                      style={{ background: '#f0fdf4', border: `1.5px solid ${showReceivedDetail ? '#16a34a' : '#86efac'}`, borderRadius: 8, padding: '12px 18px', flex: 1, minWidth: 130, cursor: 'pointer' }}
                      onClick={() => { setShowReceivedDetail(d => !d); setShowPaidOutDetail(false); }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>
                        Received {showReceivedDetail ? '▲' : '▼'}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{fc(totalReceived)}</div>
                      {invoiceReceived > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          Invoices: {fc(invoiceReceived)} · Other: {fc(otherIncome)}
                        </div>
                      )}
                    </div>

                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 18px', flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>Net</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: net >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>{fc(net)}</div>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 18px', flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entries</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{settlementData.settlements.length}</div>
                    </div>
                  </div>

                  {/* Fix 2: Paid Out detail panel */}
                  {showPaidOutDetail && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--danger)' }}>💸 Paid Out — Details</div>
                      {paidOutEntries.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No paid-out entries for this date.</div>
                      ) : paidOutEntries.map((s, i) => (
                        <div key={s._id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < paidOutEntries.length - 1 ? '1px solid #fca5a5' : 'none', fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.party_name || 'Unknown'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {s.mode?.toUpperCase()} · {s.ist_formatted ? s.ist_formatted.split(' ').slice(1).join(' ') : '—'}
                              {s.notes ? ` · ${s.notes}` : ''}
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, color: 'var(--danger)', fontFamily: 'monospace' }}>−{fc(s.amount)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fix 2: Received detail panel */}
                  {showReceivedDetail && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--success)' }}>📥 Received — Details</div>
                      {receivedEntries.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No received entries for this date.</div>
                      ) : receivedEntries.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < receivedEntries.length - 1 ? '1px solid #86efac' : 'none', fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{r.party || r.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {r.mode?.toUpperCase()} · {r.reason}
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, color: 'var(--success)', fontFamily: 'monospace' }}>+{fc(r.amount)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Supplier management moved to dedicated Suppliers page — see sidebar */}

            {/* Add Entry Form */}
            {showAddSettlement && (
              <div ref={addSettlementRef} style={{ background: '#f8fafc', border: '1.5px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>➕ New Settlement Entry</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-control" value={settlementForm.type}
                      onChange={e => setSettlementForm({ ...settlementForm, type: e.target.value })}>
                      <option value="paid_to_supplier">💸 Paid to Supplier/Company</option>
                      <option value="other_expense">📤 Other Expense</option>
                      <option value="other_income">📥 Other Income</option>
                    </select>
                  </div>
                  {/* Category — only for other_income */}
                  {settlementForm.type === 'other_income' && (
                    <div className="form-group">
                      <label className="form-label">Received Category</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          { key: 'today_invoice', label: '📄 Today Invoice' },
                          { key: 'due_cleared', label: '✅ Clear Due' },
                          { key: 'advance_payment', label: '💳 Advance' },
                          { key: 'not_applicable', label: '— Other' },
                        ].map(cat => (
                          <button
                            key={cat.key}
                            type="button"
                            className={`btn btn-sm ${settlementForm.received_category === cat.key ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSettlementForm({ ...settlementForm, received_category: cat.key })}
                            style={{ fontSize: 12 }}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">{settlementForm.type === 'paid_to_supplier' ? 'Supplier / Company *' : 'Party Name'}</label>
                    {/* Fix 2: Datalist for reusable party names from history */}
                    <input
                      className="form-control"
                      list="party-names-list"
                      value={settlementForm.party_name}
                      onChange={e => setSettlementForm({ ...settlementForm, party_name: e.target.value })}
                      placeholder="Type or select party name"
                    />
                    <datalist id="party-names-list">
                      {settlementData.partyNames?.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount ₹ *</label>
                    <input className="form-control" type="number" step="0.01" min="0"
                      value={settlementForm.amount}
                      onChange={e => setSettlementForm({ ...settlementForm, amount: e.target.value })}
                      placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="form-control" value={settlementForm.mode}
                      onChange={e => setSettlementForm({ ...settlementForm, mode: e.target.value })}>
                      <option value="cash">💵 Cash</option>
                      <option value="upi">📱 UPI</option>
                      <option value="online">🌐 Online</option>
                      <option value="others">💳 Others</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Reference (optional)</label>
                    <input className="form-control" value={settlementForm.reference}
                      onChange={e => setSettlementForm({ ...settlementForm, reference: e.target.value })}
                      placeholder="Transaction ID / UPI ref" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-control" value={settlementForm.notes}
                      onChange={e => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                      placeholder="e.g. Monthly supply payment" />
                  </div>
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setShowAddSettlement(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleAddSettlement} disabled={settlementSaving}>
                    {settlementSaving ? <><span className="spinner"></span> Saving...</> : '💾 Save Entry'}
                  </button>
                </div>
              </div>
            )}

            {/* Fix 5: Settlement Records Table — date-wise */}
            {settlementLoading ? (
              <div className="loading"><span className="spinner"></span></div>
            ) : !settlementData.settlements.length ? (
              <div className="empty-state" style={{ padding: 24 }}>
                {settlementSearch
                  ? `No entries found for party "${settlementSearch}".`
                  : `No settlement entries for this ${settlementViewMode === 'all' ? 'search' : 'date'}. Click "+ Add Entry" to record one.`}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                    <tr>
                      {/* Fix 5: Date column shown in full history mode */}
                      {settlementViewMode === 'all' && (
                        <th style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>Date</th>
                      )}
                      {['Time', 'Type', 'Party / Supplier', 'Mode', 'Amount', 'Notes', ''].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Amount' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settlementData.settlements.map((s, idx) => (
                      <tr key={s._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {/* Fix 5: Show IST date in full history mode */}
                        {settlementViewMode === 'all' && (
                          <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {s.ist_date
                              ? new Date(s.ist_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                        )}
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {s.ist_formatted ? s.ist_formatted.split(' ').slice(1).join(' ') : '—'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span className={`badge ${s.type === 'other_income' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                            {s.type === 'paid_to_supplier' ? '💸 Supplier' : s.type === 'other_expense' ? '📤 Expense' : '📥 Income'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600 }}>{s.party_name || '—'}</td>
                        <td style={{ padding: '9px 12px', textTransform: 'uppercase', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {s.mode === 'cash' ? '💵' : s.mode === 'upi' ? '📱' : s.mode === 'online' ? '🌐' : '💳'} {s.mode}
                          {s.reference && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.reference}</div>}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: s.type === 'other_income' ? 'var(--success)' : 'var(--danger)' }}>
                          {s.type === 'other_income' ? '+' : '−'}{fc(s.amount)}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12 }}>
                          {s.type === 'other_income' && s.received_category && s.received_category !== 'not_applicable' && (
                            <span style={{ display: 'inline-block', fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 8, fontWeight: 700, marginRight: 5 }}>
                              {s.received_category === 'today_invoice' ? '📄 Invoice'
                                : s.received_category === 'due_cleared' ? '✅ Due'
                                  : s.received_category === 'advance_payment' ? '💳 Advance'
                                    : ''}
                            </span>
                          )}
                          <span style={{ color: 'var(--text-muted)' }}>{s.notes || '—'}</span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleDeleteSettlement(s._id)}
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* All-time Pending Dues Drill-down — with search + calendar */}
      {showAllDues && (
        <div className="card" style={{ marginBottom: 20 }} ref={duesPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title">
              ⏳ Pending Dues
              <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 11 }}>
                {data.pendingCustomers?.length || 0}
              </span>
            </div>
            <div className="flex gap-2">
              <SortDropdown
                options={[
                  { key: 'amount_desc', label: '↓ High Due First' },
                  { key: 'amount_asc', label: '↑ Low Due First' },
                  { key: 'name_asc', label: 'A-Z Name' },
                  { key: 'inv_asc', label: '# Invoice No. ↑' },
                  { key: 'inv_desc', label: '# Invoice No. ↓' },
                  { key: 'walkin_first', label: '◈ Walk-in First' },
                  { key: 'registered_first', label: '✦ Registered First' },
                ]}
                value={duesSort}
                onChange={v => { setDuesSort(v); setDuesSortOpen(false); }}
                open={duesSortOpen}
                onToggle={() => { closeAllSortMenus('dues'); setDuesSortOpen(o => !o); }}
              />
              <span className="badge badge-warning">{fc(data.allTimePendingBalance || 0)} total</span>
              <button className="btn btn-warning btn-sm" onClick={() => setShowWalkinDueForm(w => !w)}>
                {showWalkinDueForm ? '✕' : '+ Walk-in Due'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => {
                setShowAllDues(false);
                setDuesSearch('');
                setDuesCardDate('');
                setDueDateInvoices(null);
                setShowWalkinDueForm(false);
              }}>✕ Close</button>
            </div>
          </div>
          <div className="card-body">
            {/* Fix 6: Walk-in due form */}
            {showWalkinDueForm && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>➕ Add Walk-in Due (No Invoice)</div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Customer Name *</label>
                    <input className="form-control" value={walkinDueForm.name}
                      onChange={e => setWalkinDueForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Ramesh Kumar" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Due Amount ₹ *</label>
                    <input className="form-control" type="number" min="0" step="0.01"
                      value={walkinDueForm.amount}
                      onChange={e => setWalkinDueForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Phone (optional)</label>
                    <input className="form-control" value={walkinDueForm.phone}
                      onChange={e => setWalkinDueForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Mobile number" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Reason / Notes</label>
                    <input className="form-control" value={walkinDueForm.notes}
                      onChange={e => setWalkinDueForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Advance taken, goods pending" />
                  </div>
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowWalkinDueForm(false)}>Cancel</button>
                  <button className="btn btn-warning btn-sm" onClick={handleCreateWalkinDue} disabled={walkinDueSaving}>
                    {walkinDueSaving ? <><span className="spinner"></span></> : '💾 Save Due'}
                  </button>
                </div>
              </div>
            )}

            {/* Search + Calendar inside dropdown */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Search</div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    placeholder="Customer name, phone, invoice number..."
                    value={duesSearch}
                    onChange={e => setDuesSearch(e.target.value)}
                    style={{ paddingLeft: 32 }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
                  {duesSearch && (
                    <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                      onClick={() => setDuesSearch('')}>✕</button>
                  )}
                </div>
              </div>

              {/* Fix 5: Calendar — filters dues to show who had balance on that date */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Filter by Date {duesCardDate ? `— ${new Date(duesCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : '(All Time)'}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="date"
                    className="form-control"
                    value={duesCardDate}
                    max={getTodayIST()}
                    style={{ width: 150, fontSize: 13 }}
                    onChange={e => {
                      const d = e.target.value;
                      setDuesCardDate(d);
                      if (d) loadDueDateData(d);
                      else setDueDateInvoices(null);
                    }}
                  />
                  {duesCardDate && duesCardDate !== getTodayIST() && (
                    <button className="btn btn-outline btn-sm" onClick={() => {
                      setDuesCardDate(getTodayIST());
                      loadDueDateData(getTodayIST());
                    }}>Today</button>
                  )}
                  {duesCardDate && (
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setDuesCardDate('');
                      setDueDateInvoices(null);
                    }}>✕ All</button>
                  )}
                </div>
              </div>
            </div>

          </div>
          <div className="card-body no-pad">
            {(() => {
              let filtered = data.pendingCustomers || [];

              if (duesSearch.trim()) {
                const q = duesSearch.trim().toLowerCase();
                filtered = filtered.filter(c =>
                  (c.name || '').toLowerCase().includes(q) ||
                  (c.phone || '').toLowerCase().includes(q) ||
                  (c.invoice_number || '').toLowerCase().includes(q)
                );
              }

              // Date filter: for walkin we have ist_formatted, for registered we match on date
              if (duesCardDate) {
                filtered = filtered.filter(c => {
                  if (c.ist_formatted) {
                    return c.ist_formatted.startsWith(duesCardDate) ||
                      (c.ist_formatted || '').includes(new Date(duesCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
                  }
                  return true; // registered customers show for all dates
                });
              }

              if (!filtered.length) return (
                <div className="empty-state" style={{ padding: 24 }}>
                  {duesSearch || duesCardDate ? `No matching dues found.` : '✅ No pending dues'}
                </div>
              );

              // Compute display dues here for the full section
              let allDues = data.pendingCustomers || [];
              let displayDues = allDues;
              let isHistoricalView = false;

              if (duesCardDate && dueDateInvoices) {
                isHistoricalView = true;
                displayDues = dueDateInvoices;
              } else if (duesCardDate && !dueDateInvoices) {
                displayDues = []; // still loading
              }

              if (duesSearch.trim()) {
                const q = duesSearch.trim().toLowerCase();
                displayDues = displayDues.filter(c =>
                  (c.name || '').toLowerCase().includes(q) ||
                  (c.phone || '').toLowerCase().includes(q) ||
                  (c.invoice_number || '').toLowerCase().includes(q)
                );
              }

              // Apply dues sort
              displayDues = [...displayDues].sort((a, b) => {
                if (duesSort === 'amount_asc') return (a.balance || 0) - (b.balance || 0);
                if (duesSort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
                if (duesSort === 'walkin_first') return a.type === 'walkin' ? -1 : 1;
                if (duesSort === 'registered_first') return a.type === 'registered' ? -1 : 1;
                if (duesSort === 'inv_asc') return (a.invoice_number || '').localeCompare(b.invoice_number || '', undefined, { numeric: true });
                if (duesSort === 'inv_desc') return (b.invoice_number || '').localeCompare(a.invoice_number || '', undefined, { numeric: true });
                return (b.balance || 0) - (a.balance || 0); // amount_desc default
              });

              const currentDueIds = new Set(allDues.map(c => String(c._id)));
              const isPaidNow = (c) => isHistoricalView && !currentDueIds.has(String(c._id));

              if (!displayDues.length) return (
                <div className="empty-state" style={{ padding: 24 }}>
                  {duesSearch || duesCardDate ? 'No matching dues found.' : '✅ No pending dues'}
                </div>
              );

              return (
                <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {['Invoice', 'Customer', 'Phone', 'Type', isHistoricalView ? 'Was Due' : 'Balance Due', 'Action'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('Due') ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayDues.map((c, idx) => {
                        const paid = isPaidNow(c);
                        return (
                          <tr key={`${c._id}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6', background: paid ? '#f0fdf4' : idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 14px' }}>
                              {c.invoice_number ? (
                                <Link to={`/invoices/${c.type === 'walkin' ? c._id : '#'}`} style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5 }}>
                                  {c.invoice_number}
                                </Link>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong>{c.name}</strong>
                                {paid && (
                                  <span style={{ background: '#16a34a', color: '#fff', fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    ✓ Cleared
                                  </span>
                                )}
                              </div>
                              {paid && (
                                <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2, fontWeight: 600 }}>
                                  {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} — Due Cleared
                                </div>
                              )}
                              {!paid && c.ist_formatted && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                  Since {c.ist_formatted}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {c.phone ? (
                                (c.balance > 0.01) ? (
                                  <a
                                    href={`https://wa.me/91${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      'Hello ' + c.name +
                                      ',\nThis is a reminder from ' + (settings?.business_name || 'our store') +
                                      '.\nYour pending due amount is Rs.' +
                                      (c.balance && c.balance.toFixed ? c.balance.toFixed(2) : c.balance) +
                                      '.\nPlease clear at your earliest convenience.\nThank you.'
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: '#25d366',
                                      fontWeight: 600,
                                      fontSize: 13,
                                      textDecoration: 'none'
                                    }}
                                  >
                                    💬 {c.phone}
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                    {c.phone}
                                  </span>
                                )
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {c.type === 'walkin'
                                ? <span className="badge badge-warning" style={{ fontSize: 10 }}>Walk-in</span>
                                : <span className="badge badge-primary" style={{ fontSize: 10 }}>Registered</span>}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: paid ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                              {fc(c.balance)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {paid ? (
                                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✅ Paid</span>
                              ) : (
                                <button className="btn btn-success btn-sm"
                                  onClick={() => {
                                    setPayModal({
                                      invoice_id: c.type === 'walkin' ? c._id : (c.invoice_id || null),
                                      customer_id: c.type === 'registered' ? c._id : null,
                                      name: c.name,
                                      balance: c.balance,
                                      invoice_number: c.invoice_number,
                                      type: c.type,
                                    });
                                    setPayForm({ amount: c.balance.toFixed(2), mode: 'cash', reference: '' });
                                  }}
                                >💰 Collect</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {displayDues.length !== allDues.length && (
                    <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                      Showing {displayDues.length} of {allDues.length} records
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Today Sale Drill-down Panel */}
      {showTodaySales && (
        <div className="card mb-5" style={{ marginBottom: 20 }} ref={salesPanelRef}>
          <div className="card-header">
            <div className="card-title">
              📅 {todaySalesCardDate === getTodayIST() ? "Today's" : new Date(todaySalesCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} Invoices
              {/* Fix 1: Show actual sum of invoices shown in this dropdown */}
              {(() => {
                const src = cardSalesData?.todayInvoices || data.todayInvoices || [];
                const sum = src.reduce((s, i) => s + (i.total || 0), 0);
                const cnt = src.length;
                return cnt > 0 ? (
                  <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                    {cnt} bill{cnt !== 1 ? 's' : ''} · {fc(sum)}
                  </span>
                ) : null;
              })()}
            </div>
            {/* after this*/}

            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              <SortDropdown
                options={[
                  { key: 'time_desc', label: '↓ Latest First' },
                  { key: 'time_asc', label: '↑ Oldest First' },
                  { key: 'amount_desc', label: '↓ High Amount' },
                  { key: 'amount_asc', label: '↑ Low Amount' },
                  { key: 'inv_asc', label: '# Invoice No.' },
                ]}
                value={salesSort}
                onChange={v => { setSalesSort(v); setSalesSortOpen(false); }}
                open={salesSortOpen}
                onToggle={() => { closeAllSortMenus('sales'); setSalesSortOpen(o => !o); }}
              />
              <input
                type="date"
                value={todaySalesCardDate}
                max={getTodayIST()}
                className="form-control"
                style={{ width: 145, fontSize: 13 }}
                onChange={e => {
                  const d = e.target.value;
                  if (!d) return;
                  setTodaySalesCardDate(d);
                  setCardSalesData(null);
                  loadCardSales(d);
                }}
              />
              <button className="btn btn-outline btn-sm" onClick={() => {
                setShowTodaySales(false);
                setTodaySalesCardDate(getTodayIST());  // reset date on close
                setCardSalesData(null);
                setSalesSearch('');
                setSalesSuggestions([]);
              }}>✕ Close</button>
            </div>
          </div>
          <div className="card-body no-pad">
            {(() => {
              // Source invoices from card-specific data or global dashboard data
              const allInvoices = cardSalesData?.todayInvoices || data.todayInvoices || [];
              const q = salesSearch.trim().toLowerCase();
              let filtered = q
                ? allInvoices.filter(inv =>
                  (inv.invoice_number || '').toLowerCase().includes(q) ||
                  (inv.customer_name || '').toLowerCase().includes(q) ||
                  (inv.customer_phone || '').toLowerCase().includes(q)
                )
                : [...allInvoices];

              // Apply sort
              filtered = filtered.sort((a, b) => {
                if (salesSort === 'amount_desc') return (b.total || 0) - (a.total || 0);
                if (salesSort === 'amount_asc') return (a.total || 0) - (b.total || 0);
                if (salesSort === 'inv_asc') return (a.invoice_number || '').localeCompare(b.invoice_number || '');
                if (salesSort === 'time_asc') return new Date(a.date || 0) - new Date(b.date || 0);
                return new Date(b.date || 0) - new Date(a.date || 0); // time_desc default
              });

              // Auto-suggestions: top 6 matches across all three fields
              const buildSuggestions = (query) => {
                if (!query) return [];
                const seen = new Set();
                const suggestions = [];
                for (const inv of allInvoices) {
                  if (suggestions.length >= 6) break;
                  const fields = [
                    { type: 'Invoice', value: inv.invoice_number },
                    { type: 'Customer', value: inv.customer_name },
                    { type: 'Phone', value: inv.customer_phone },
                  ];
                  for (const f of fields) {
                    if (f.value && f.value.toLowerCase().includes(query) && !seen.has(f.value)) {
                      seen.add(f.value);
                      suggestions.push({ label: f.value, type: f.type, inv });
                    }
                  }
                }
                return suggestions;
              };

              return (
                <>


                  {/* Dynamic search box with auto-suggestion */}
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1.5px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
                      <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search by invoice number, customer name, or phone..."
                        value={salesSearch}
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, flex: 1, fontFamily: 'inherit' }}
                        onFocus={() => {
                          setSalesSearchFocused(true);
                          setSalesSuggestions(buildSuggestions(salesSearch.trim().toLowerCase()));
                        }}
                        onBlur={() => setTimeout(() => setSalesSearchFocused(false), 180)}
                        onChange={e => {
                          const val = e.target.value;
                          setSalesSearch(val);
                          setSalesSuggestions(buildSuggestions(val.trim().toLowerCase()));
                        }}
                      />
                      {salesSearch && (
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}
                          onClick={() => { setSalesSearch(''); setSalesSuggestions([]); }}
                        >✕</button>
                      )}
                      {/* Result count badge */}
                      {salesSearch && (
                        <span style={{ fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Suggestion dropdown */}
                    {salesSearchFocused && salesSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden',
                      }}>
                        {salesSuggestions.map((s, i) => (
                          <div
                            key={i}
                            style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < salesSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: 13.5 }}
                            onMouseDown={() => {
                              // Auto-fill: set search to the clicked suggestion value
                              setSalesSearch(s.label);
                              setSalesSuggestions([]);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {/* Highlight matching portion */}
                              <span style={{ fontWeight: 600 }}>
                                {(() => {
                                  const idx = s.label.toLowerCase().indexOf(salesSearch.trim().toLowerCase());
                                  if (idx === -1) return s.label;
                                  return (
                                    <>
                                      {s.label.slice(0, idx)}
                                      <mark style={{ background: '#fef08a', borderRadius: 2, padding: 0 }}>
                                        {s.label.slice(idx, idx + salesSearch.trim().length)}
                                      </mark>
                                      {s.label.slice(idx + salesSearch.trim().length)}
                                    </>
                                  );
                                })()}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {s.inv.customer_name !== s.label ? `· ${s.inv.customer_name}` : ''}
                              </span>
                            </div>
                            <span style={{ fontSize: 10, background: '#f3f4f6', padding: '2px 7px', borderRadius: 20, color: 'var(--text-muted)', fontWeight: 600 }}>
                              {s.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Invoice table */}
                  {filtered.length === 0 ? (
                    <div className="empty-state" style={{ padding: 24 }}>
                      {salesSearch
                        ? `No invoices match "${salesSearch}".`
                        : 'No invoices for this date.'}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Invoice #</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Customer</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Time</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Total</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((inv, idx) => {
                            // Highlight matching text in a cell value
                            const highlight = (text) => {
                              if (!salesSearch.trim() || !text) return text || '—';
                              const q2 = salesSearch.trim().toLowerCase();
                              const i2 = text.toLowerCase().indexOf(q2);
                              if (i2 === -1) return text;
                              return (
                                <>
                                  {text.slice(0, i2)}
                                  <mark style={{ background: '#fef08a', borderRadius: 2, padding: 0 }}>
                                    {text.slice(i2, i2 + q2.length)}
                                  </mark>
                                  {text.slice(i2 + q2.length)}
                                </>
                              );
                            };

                            return (
                              <tr key={inv._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '10px 14px' }}>
                                  <Link to={`/invoices/${inv._id}`} style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace' }}>
                                    {highlight(inv.invoice_number)}
                                  </Link>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 500 }}>{highlight(inv.customer_name)}</div>
                                  {inv.customer_phone && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {highlight(inv.customer_phone)}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                                  {inv.ist_formatted ? inv.ist_formatted.split(' ').slice(1).join(' ') : '—'}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                  {fc(inv.total)}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  {inv.balance_due > 0.01
                                    ? <span className="badge badge-danger">{fc(inv.balance_due)} due</span>
                                    : <span className="badge badge-success">Paid ✓</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="dashboard-grid">

        {/* Today's Pending Dues — max 8, scrollable, sorted latest first */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ⏳ {t("Today's Pending Dues", 'आज का बकाया')}
              {data.todayPendingDues?.length > 0 && (
                <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 11 }}>
                  {data.todayPendingDues.length}
                </span>
              )}
            </div>
            <Link to="/customers" className="btn btn-outline btn-sm">{t('All Dues', 'सभी बकाया')}</Link>
          </div>
          <div className="card-body no-pad">
            {!data.todayPendingDues?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>✅ No pending dues today</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Invoice</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Customer</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Type</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Balance Due</th>
                    </tr>
                  </thead>
                </table>
                {/* Scrollable body — max 8 rows visible */}
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <tbody>
                      {(showMoreDues ? data.todayPendingDues : data.todayPendingDues.slice(0, 7)).map((c, idx) => (
                        <tr key={c._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <Link to={`/invoices/${c._id}`} style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5 }}>
                              {c.invoice_number}
                            </Link>
                            {c.ist_formatted && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.ist_formatted}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <strong>{c.name}</strong>
                            {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {c.type === 'walkin'
                              ? <span className="badge badge-warning" style={{ fontSize: 10 }}>Walk-in</span>
                              : <span className="badge badge-primary" style={{ fontSize: 10 }}>Registered</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>
                            {fc(c.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.todayPendingDues.length > 7 && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
                      onClick={() => setShowMoreDues(d => !d)}
                    >
                      {showMoreDues
                        ? `▲ Show Less`
                        : `▼ Show ${data.todayPendingDues.length - 7} More`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚠️ {t('Low Stock Alerts', 'कम स्टॉक')}</div>
            <div className="flex gap-2">
              {data.lowStockProducts?.length > 0 && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const threshold = parseInt(settings?.low_stock_threshold) || 10;
                    setEditableLowStock(data.lowStockProducts.map(p => ({
                      ...p,
                      orderQty: orderQty[p._id] !== undefined
                        ? orderQty[p._id]
                        : Math.max(1, ((p.custom_low_stock != null && p.custom_low_stock >= 0 ? p.custom_low_stock : threshold) - p.stock)),
                    })));
                    setShowLowStockEditor(true);
                  }}>✏️ Edit & Send</button>
                  {/* Quick WhatsApp send using current order quantities */}
                  <button className="btn btn-success btn-sm" onClick={() => {
                    const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                    const lines = data.lowStockProducts
                      .map(p => `  • ${p.name}: *${getOrderQty(p)} ${p.unit}*`)
                      .join('\n');
                    const msg = encodeURIComponent(
                      `⚠️ *Stock Order — ${settings?.business_name || 'My Shop'}*\nDate: ${today}\n━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━\nTotal: ${data.lowStockProducts.length} items`
                    );
                    window.open(`https://wa.me/?text=${msg}`, '_blank');
                  }}>💬 Send Order</button>
                </>
              )}
              <Link to="/products" className="btn btn-outline btn-sm">{t('Manage', 'प्रबंधन')}</Link>
            </div>
          </div>
          <div className="card-body no-pad">
            {!data.lowStockProducts?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>✅ All products adequately stocked</div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                {/* One item per row — clean layout, no overflow */}
                <div style={{ maxHeight: showMoreLowStock ? 480 : 320, overflowY: 'auto', transition: 'max-height 0.3s ease', padding: '4px 0' }}>
                  {data.lowStockProducts.map((p, idx) => {
                    const toOrder = getOrderQty(p);
                    return (
                      <div key={p._id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: idx < data.lowStockProducts.length - 1 ? '1px solid #f3f4f6' : 'none',
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        flexWrap: 'wrap', gap: 8,
                      }}>
                        {/* Item name — wraps cleanly */}
                        <div style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 120, wordBreak: 'break-word' }}>
                          {p.name}
                          <span style={{ marginLeft: 6, fontSize: 11, color: p.stock === 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>
                            ({p.stock === 0 ? 'Out' : `${p.stock} ${p.unit}`})
                          </span>
                        </div>
                        {/* Order qty controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: 14, lineHeight: 1 }} onClick={() => adjustOrderQty(p._id, -1)}>−</button>
                          <input
                            type="number" min="0"
                            value={toOrder}
                            onChange={e => { const val = parseInt(e.target.value) || 0; setOrderQty(prev => ({ ...prev, [p._id]: Math.max(0, val) })); }}
                            style={{ width: 56, textAlign: 'center', fontWeight: 700, color: 'var(--primary)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '3px 4px', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
                          />
                          <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: 14, lineHeight: 1 }} onClick={() => adjustOrderQty(p._id, 1)}>+</button>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>{p.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>


              </div>

            )}
            {data.lowStockProducts.length > 7 && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
                  onClick={() => setShowMoreLowStock(d => !d)}
                >
                  {showMoreLowStock ? '▲ Collapse' : `▼ Expand all ${data.lowStockProducts.length} items`}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Today's Stock Movements */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📦 {t("Today's Stock Movements", 'आज का स्टॉक')}</div>
            <Link to="/stock-movements" className="btn btn-outline btn-sm">{t('All Movements', 'सभी')}</Link>
          </div>
          <div className="card-body no-pad">
            {!data.todayMovements?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No stock movements today</div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="tr">Qty</th>
                    <th>Reference</th>
                  </tr></thead>
                  <tbody>
                    {(showMoreMovements ? data.todayMovements : data.todayMovements.slice(0, 7)).map(m => (
                      <tr key={m._id}>
                        <td>{m.product_name}</td>
                        <td>
                          <span className={`badge ${m.type === 'incoming' ? 'badge-success' : 'badge-danger'}`}>
                            {m.type === 'incoming' ? '↓ In' : '↑ Out'}
                          </span>
                        </td>
                        <td className="tr mono">{m.qty}</td>
                        <td>
                          {m.vehicle_number ? (
                            /* Vehicle reference */
                            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>
                              🚛 {m.vehicle_number}
                            </span>
                          ) : m.invoice_id ? (
                            /* Fallback: link to invoice */
                            <Link to={`/invoices/${m.invoice_id}`}
                              style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                              {m.invoice_number || 'INV'}
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.todayMovements.length > 7 && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
                      onClick={() => setShowMoreMovements(d => !d)}
                    >
                      {showMoreMovements ? `▲ Show Less` : `▼ Show ${data.todayMovements.length - 7} More`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sales last 7 days */}
        <div className="card span-2">
          <div className="card-header">
            <div className="card-title">📈 {t('Sales — Last 7 Days', 'पिछले 7 दिन')}</div>
            <button className="btn btn-outline btn-sm" onClick={() => setSalesSortDesc(d => !d)}>
              {salesSortDesc ? '↓ Newest First' : '↑ Oldest First'}
            </button>
          </div>
          <div className="card-body no-pad">
            {!data.salesByDay?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No sales in last 7 days</div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr><th>Date</th><th className="tr">Bills</th><th className="tr">Sales</th></tr></thead>
                  <tbody>

                    {(() => {
                      const sorted = [...data.salesByDay].sort((a, b) =>
                        salesSortDesc ? b.day.localeCompare(a.day) : a.day.localeCompare(b.day)
                      );

                      const visible = showMoreSales ? sorted : sorted.slice(0, 7);

                      return (
                        <>
                          {visible.map(d => {

                            const isToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
                            const isYesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
                            const isTodayMatch = d.day === isToday;
                            const isYesterdayMatch = d.day === isYesterday;

                            return (
                              <tr key={d.day} style={{ background: isTodayMatch ? '#f0fdf4' : isYesterdayMatch ? '#eff6ff' : '' }}>
                                <td>
                                  {new Date(d.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                                  {isTodayMatch && <span className="badge badge-success" style={{ marginLeft: 6, fontSize: 10 }}>Today</span>}
                                  {isYesterdayMatch && <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: 10 }}>Yesterday</span>}
                                </td>
                                <td className="tr">{d.count}</td>
                                <td className="tr mono fw-600">{fc(d.sales)}</td>
                              </tr>
                            );
                          })}

                          {sorted.length > 7 && (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setShowMoreSales(d => !d)}
                                >
                                  {showMoreSales
                                    ? '▲ Show Less'
                                    : `▼ Show ${sorted.length - 7} More`}
                                </button>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="card span-2">
          <div className="card-header"><div className="card-title">🏆 {t('Top Selling Products', 'टॉप उत्पाद')}</div></div>
          <div className="card-body no-pad">
            {!data.topProducts?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No sales data yet</div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr><th>#</th><th>Product</th><th className="tr">Qty Sold</th><th className="tr">Revenue</th></tr></thead>
                  <tbody>
                    {(showMoreTopProducts ? data.topProducts : data.topProducts.slice(0, 7)).map((p, i) => (
                      <tr key={i}>
                        <td className="text-muted fw-600">{i + 1}</td>
                        <td><strong>{p.product_name}</strong></td>
                        <td className="tr">{p.total_qty}</td>
                        <td className="tr mono fw-600">{fc(p.revenue)}</td>
                      </tr>
                    ))}
                    {data.topProducts.length > 7 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
                            onClick={() => setShowMoreTopProducts(d => !d)}
                          >
                            {showMoreTopProducts ? `▲ Show Less` : `▼ Show ${data.topProducts.length - 7} More`}
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Low Stock Edit & Send Modal */}
      {showLowStockEditor && (
        <div className="modal-overlay" onClick={() => setShowLowStockEditor(false)}>
          <div className="modal" style={{ maxWidth: 680, width: '96vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">⚠️ Edit Order List — Low Stock</div>
              <button className="modal-close" onClick={() => setShowLowStockEditor(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Edit quantities before sending. You can add/remove items and adjust amounts.
              </div>

              {/* Editable item list */}
              <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Item Name', 'Order Qty', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Order Qty' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editableLowStock.map((p, idx) => (
                      <tr key={p._id || idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          <input className="form-control" style={{ fontSize: 13 }}
                            value={p.name}
                            onChange={e => setEditableLowStock(prev => {
                              const u = [...prev]; u[idx] = { ...u[idx], name: e.target.value }; return u;
                            })} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <input
                            type="number" min="0"
                            className="form-control"
                            style={{ width: 80, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}
                            value={p.orderQty}
                            onChange={e => setEditableLowStock(prev => {
                              const u = [...prev];
                              u[idx] = { ...u[idx], orderQty: Math.max(0, parseInt(e.target.value) || 0) };
                              return u;
                            })}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => setEditableLowStock(prev => prev.filter((_, i) => i !== idx))}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add custom item */}
              <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}
                onClick={() => setEditableLowStock(prev => [...prev, { _id: `custom-${Date.now()}`, name: '', stock: 0, unit: 'pcs', orderQty: 1 }])}>
                + Add Item
              </button>

              {/* Action buttons */}
              <div className="flex gap-2" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn btn-outline" onClick={() => setShowLowStockEditor(false)}>Cancel</button>


                {/* PDF */}
                <button className="btn btn-primary" onClick={() => {
                  const prevTitle = document.title;
                  document.title = `Stock-Order-${getTodayIST()}`;
                  const rows = editableLowStock.filter(p => p.orderQty > 0 && p.name).map((p, i) =>
                    `<tr style="border-bottom:1px solid #e5e7eb">
                        <td style="padding:8px 12px">${i + 1}</td>
                        <td style="padding:8px 12px;font-weight:600">${p.name}</td>
                        <td style="padding:8px 12px;text-align:right;color:#2563eb;font-weight:800">${p.orderQty} ${p.unit || ''}</td>
                      </tr>`).join('');
                  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title}</title>
                      <style>@page{margin:12mm 10mm;size:A4;}body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;}
                      table{width:100%;border-collapse:collapse;}thead tr{background:#1a1f2e;color:#fff;}
                      th{padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;}</style>
                      </head><body>
                      <div style="display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #1a1f2e;margin-bottom:18px">
                        <div><h2 style="margin:0">${settings?.business_name || 'My Shop'}</h2>
                        <p style="margin:4px 0;color:#6b7280">Stock Order — ${today}</p></div>
                      </div>
                      <table><thead><tr><th>#</th><th>Item Name</th>
                        <th style="text-align:right;color:#93c5fd">Order Qty</th></tr></thead>
                      <tbody>${rows}</tbody></table>
                      </body></html>`;
                  const win = window.open('', '_blank', 'width=900,height=700');
                  win.document.write(html);
                  win.document.close();
                  win.onload = () => { win.focus(); win.print(); setTimeout(() => { win.close(); document.title = prevTitle; }, 500); };
                }}>📄 PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Match Modal */}
      {showWalkinMatchModal && walkinMatch && (
        <div className="modal-overlay" onClick={() => setShowWalkinMatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title">
                {walkinMatch.type === 'customer' ? '👥 Customer Already Exists' : '⏳ Pending Due Found'}
              </div>
              <button className="modal-close" onClick={() => setShowWalkinMatchModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {walkinMatch.type === 'customer' && (
                <>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{walkinMatch.data.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>📞 {walkinMatch.data.phone}</div>
                    {walkinMatch.data.balance > 0 && (
                      <div style={{ marginTop: 6, color: 'var(--danger)', fontWeight: 700 }}>
                        Previous Due: ₹{walkinMatch.data.balance?.toFixed(2)}
                      </div>
                    )}
                    {walkinMatch.data.balance < 0 && (
                      <div style={{ marginTop: 6, color: 'var(--success)', fontWeight: 700 }}>
                        Advance Credit: ₹{Math.abs(walkinMatch.data.balance)?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>
                    This customer is already registered. Would you like to link the invoice to their account?
                  </div>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={() => setShowWalkinMatchModal(false)}>
                      Continue as Walk-in
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                      setCustomerMode('existing');
                      setCustomerId(walkinMatch.data._id);
                      setCustomerSearch(`${walkinMatch.data.name} (${walkinMatch.data.phone || ''})`);
                      setShowWalkinMatchModal(false);
                    }}>
                      ✓ Use Registered Account
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">💰 Collect Payment</div>
              <button className="modal-close" onClick={() => setPayModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{payModal.name}</div>
                {payModal.invoice_number && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Invoice: {payModal.invoice_number}</div>
                )}
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>
                  Due: {fc(payModal.balance)}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Amount Received ₹ *</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  autoFocus
                />
                <div className="form-hint">
                  Due: {fc(payModal.balance)} ·{' '}
                  <span
                    style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setPayForm({ ...payForm, amount: payModal.balance.toFixed(2) })}
                  >
                    Full Amount
                  </span>
                </div>
                {parseFloat(payForm.amount) > payModal.balance && parseFloat(payForm.amount) > 0 && (
                  <div style={{ marginTop: 6, padding: '7px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12.5, color: '#1d4ed8' }}>
                    💳 Extra <strong>{fc(parseFloat(payForm.amount) - payModal.balance)}</strong> will be stored as advance credit for this customer.
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {PAYMENT_MODES.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`btn btn-sm ${payForm.mode === m ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPayForm({ ...payForm, mode: m })}
                    >
                      {m === 'cash' ? '💵' : m === 'upi' ? '📱' : m === 'online' ? '🌐' : '💳'} {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / UPI ID (optional)</label>
                <input
                  className="form-control"
                  value={payForm.reference}
                  onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                  placeholder="Transaction ID or UPI ref"
                />
              </div>

              <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => setPayModal(null)}>Cancel</button>
                <button className="btn btn-success" onClick={handleRecordPayment} disabled={paying}>
                  {paying ? <><span className="spinner"></span> Saving...</> : '✅ Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}