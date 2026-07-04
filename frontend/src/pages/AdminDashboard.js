import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashboardApi, settlementApi, orderApi, deliveryApi, supplierApi, customerApi, productApi, managerApi, productListApi } from '../utils/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/helpers';
import { Calendar, Clock, Users, Package, FileText, Truck, AlertTriangle, Briefcase, ChevronDown, ChevronUp, ArrowUpDown, Lightbulb, CheckCircle, XCircle, Edit2, RotateCcw, CreditCard, Trash2, Check, ClipboardList, UserCheck, Search, Plus, Wallet, Activity, User, Phone, MessageSquare, Download, List, Minus, Save, X } from 'lucide-react';
import WalkInDeliveryModal from '../components/WalkInDeliveryModal';
import WalkinManagerAssignModal from '../components/WalkinManagerAssignModal';
import PaymentModal from '../components/PaymentModal';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';


const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'goods_exchange', 'others'];

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
        style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 10px', borderRadius: 6 }}
        onClick={onToggle}
      >
        <span>⇅</span>
        <span className="hide-on-mobile" style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salesSortDesc, setSalesSortDesc] = useState(true);
  const [orderQty, setOrderQty] = useState({});
  const [showTodaySales, setShowTodaySales] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showWalkinMatchModal, setShowWalkinMatchModal] = useState(false);
  const [showWalkinManagerModal, setShowWalkinManagerModal] = useState(false);
  const [paymentDelivery, setPaymentDelivery] = useState(null);
  const [detailsDelivery, setDetailsDelivery] = useState(null);
  const [allManagers, setAllManagers] = useState([]);
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
    if (except !== 'departure') { setShowDeparture(false); setShowDeliveryForm(false); setShowWalkinModal(false); }
  };
  // Fix 2 & 3 & 4: Settlement state — includes search, sort, view mode
  const [settlementData, setSettlementData] = useState({ settlements: [], totalOut: 0, totalIn: 0, partyNames: [] });
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const addSettlementRef = React.useRef(null);

  const [showPartyList, setShowPartyList] = useState(false);
  const partyInputRef = React.useRef(null);
  const [partyDropdownPos, setPartyDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [settlementForm, setSettlementForm] = useState({
    type: '', party_name: '', amount: '', mode: 'cash',
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
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSort, setModalSort] = useState('');
  const [modalSortOpen, setModalSortOpen] = useState(false);
  const [focusedItemIdx, setFocusedItemIdx] = useState(null);
  const [productLists, setProductLists] = useState([]);
  const [activeListFilter, setActiveListFilter] = useState(null);
  const [showListFilter, setShowListFilter] = useState(false);

  // Fix 5: Supplier management within Settlement
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  useEffect(() => {
    if (showAddSettlement) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showAddSettlement]);
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
  const [settlementSortRole, setSettlementSortRole] = useState('');
  const [settlementSortOpen, setSettlementSortOpen] = useState(false);
  // Combined sort key for SortDropdown
  const settlementSortKey = settlementSortRole === 'admin' ? 'admin_first'
    : settlementSortRole === 'manager' ? 'manager_first'
    : settlementSortAmount === 'desc' ? 'amount_desc'
    : settlementSortAmount === 'asc' ? 'amount_asc'
    : settlementSortDate === 'asc' ? 'date_asc' : 'date_desc';
  // Fix 3: View mode — 'date' = selected date, 'all' = full history
  const [settlementViewMode, setSettlementViewMode] = useState('date');

  const scrollToPanel = (ref) => {
    setTimeout(() => {
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const { globalDate: selectedDate, setGlobalDate: setSelectedDate, t, settings } = useApp();
  // Reactive — recalculates on every render when selectedDate changes
  const isToday = selectedDate === getTodayIST();

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

  const [showLowStockMenu, setShowLowStockMenu] = useState(false);
  const [selectedLowLists, setSelectedLowLists] = useState([]);

  const [deliveryForm, setDeliveryForm] = useState({
    vehicle_number: '', driver_name: '', driver_cash: '', supplier: '',
    expected_arrival: getNowDateTimeLocal(), // default = today now
    notes: '',
    items: [
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
      { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
    ],
  });
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [editDeliveryId, setEditDeliveryId] = useState(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [vehicleFocus, setVehicleFocus] = useState(false);
  const [driverFocus, setDriverFocus] = useState(false);

  // Sync selectedSuppliers with deliveryForm.suppliers_data
  useEffect(() => {
    setDeliveryForm(prev => {
      let updated = prev.suppliers_data || [];
      // Remove any that are no longer in selectedSuppliers
      updated = updated.filter(s => selectedSuppliers.includes(s.supplier_name));
      // Add new ones
      selectedSuppliers.forEach(name => {
        if (!updated.find(s => s.supplier_name === name)) {
          updated.push({ 
            supplier_name: name, 
            cash_given: '', 
            items: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] 
          });
        }
      });
      return { ...prev, suppliers_data: updated };
    });
  }, [selectedSuppliers]);

  const [deliveryDateFilter, setDeliveryDateFilter] = useState('');
  const [deliveryDateInput, setDeliveryDateInput] = useState(''); // temp input before OK
  const [showWalkinModal, setShowWalkinModal] = useState(false);

  const ITEM_LABELS = ['Goods', 'Fruits', 'Vegetables', 'Hardware', 'Others'];

  const DEFAULT_UNITS = ['bag', 'kg', 'g', 'ltr', 'ml', 'pcs', 'box', 'quintal', 'ton', 'mtr', 'dozen', 'pkt', 'strip'];
  const [customUnits, setCustomUnits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_units') || '[]'); } catch { return []; }
  });
  const [savedVehicles, setSavedVehicles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mk_custom_vehicles') || '[]'); } catch { return []; }
  });
  const [savedDrivers, setSavedDrivers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mk_custom_drivers') || '[]'); } catch { return []; }
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


  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSuggestIdx, setProductSuggestIdx] = useState(null); // which row is open

  const searchSuppliers = (q) => {
    if (!q.trim()) { setSupplierSuggestions(null); return; }
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
      return [...items, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }];
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
  const arrivingSoon = deliveries.filter(d => d.status === 'arriving_soon' && d.vehicle_number !== 'WALK-IN');

  useEffect(() => {
    const today = getTodayIST();
    loadDeliveries(today);
    loadOrders(today);
    loadSuppliers();
    managerApi.getAll()
      .then(res => setAllManagers(res?.managers || []))
      .catch(() => {});
  }, []);

  // Prevent background scrolling when major modals are open
  const isModalOpen = showDeliveryForm || showWalkinModal || showStatement || showAddSettlement || showProducts || showSuppliers || showPartyList;
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const handleSaveDelivery = async () => {
    if (!deliveryForm.vehicle_number) return toast.error('Vehicle number required');
    if (!deliveryForm.expected_arrival) return toast.error('Expected arrival time required');
    // Items are now optional for vehicle entries
    setDeliverySaving(true);
    try {
      const filteredItems = deliveryForm.items.filter(i => i.item_name).map(i => ({
        ...i, quantity: parseFloat(i.quantity) || 0,
      }));

      if (editDeliveryId) {
        // Edit mode: single supplier only
        const payload = { ...deliveryForm, items: filteredItems };
        await deliveryApi.update(editDeliveryId, payload);
        toast.success('Delivery updated');
      } else {
        // Create mode: support multiple suppliers
        const suppliersToSave = selectedSuppliers.length > 0 ? selectedSuppliers : (deliveryForm.supplier.trim() ? [deliveryForm.supplier.trim()] : ['']);
        for (const supplierName of suppliersToSave) {
          const sData = (deliveryForm.suppliers_data || []).find(s => s.supplier_name === supplierName);
          let sItems = filteredItems;
          let sCash = deliveryForm.driver_cash;
          if (sData) {
            sItems = (sData.items || []).filter(i => i.item_name && i.item_name.trim() !== '').map(i => {
              const item = { ...i, quantity: parseFloat(i.quantity) || 0 };
              if (!item.product_id) delete item.product_id;
              return item;
            });
            if (sData.cash_given !== undefined && sData.cash_given !== '') {
              sCash = parseFloat(sData.cash_given) || 0;
            }
          } else {
            sItems = sItems.map(i => {
              const item = { ...i };
              if (!item.product_id) delete item.product_id;
              return item;
            });
          }

          const payload = { 
            ...deliveryForm, 
            supplier: supplierName, 
            items: sItems,
            driver_cash: sCash
          };
          delete payload.suppliers_data;
          
          const newDelivery = await deliveryApi.create(payload);
          if (payload.vehicle_number && payload.vehicle_number.trim().toUpperCase() === 'WALK-IN') {
            await deliveryApi.updateStatus(newDelivery._id, 'delivered');
          }
        }
        toast.success(suppliersToSave.length > 1 ? `${suppliersToSave.length} delivery entries saved for each supplier` : 'Delivery entry saved');
      }

      if (deliveryForm.vehicle_number) {
        const freshV = (() => { try { return JSON.parse(localStorage.getItem('mk_custom_vehicles') || '[]'); } catch { return []; } })();
        if (!freshV.includes(deliveryForm.vehicle_number)) {
          const updated = [...freshV, deliveryForm.vehicle_number];
          setSavedVehicles(updated);
          localStorage.setItem('mk_custom_vehicles', JSON.stringify(updated));
        }
      }
      if (deliveryForm.driver_name) {
        const freshD = (() => { try { return JSON.parse(localStorage.getItem('mk_custom_drivers') || '[]'); } catch { return []; } })();
        if (!freshD.includes(deliveryForm.driver_name)) {
          const updated = [...freshD, deliveryForm.driver_name];
          setSavedDrivers(updated);
          localStorage.setItem('mk_custom_drivers', JSON.stringify(updated));
        }
      }

      setDeliveryForm({ vehicle_number: '', driver_name: '', driver_cash: '', supplier: '', expected_arrival: getNowDateTimeLocal(), notes: '', items: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }, { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }] });
      setSelectedSuppliers([]);
      setShowDeliveryForm(false);
      setEditDeliveryId(null);
      loadDeliveries(getTodayIST());
    } catch (err) { toast.error(err.message); }
    finally { setDeliverySaving(false); }
  };

  const handleDeliveryStatus = async (id, status) => {
    try {
      await deliveryApi.updateStatus(id, status);
      if (status === 'delivered') toast.success('Marked delivered — stock updated automatically');
      else toast.success('Status updated');
      // Use deliveryDateFilter if set, otherwise today
      const refreshDate = deliveryDateFilter || getTodayIST();
      loadDeliveries(refreshDate);
      // Refresh dashboard data so stock/price shows updated values immediately
      dashboardApi.get(selectedDate).then(setData).catch(() => { });
    } catch (err) { toast.error(err.message); }
  };

  const handleMarkWalkinPaid = async (id, mode, notes, paidAmt, paymentAction) => {
    try {
      await deliveryApi.updatePayment(id, 'paid', mode || 'cash', notes, paidAmt, paymentAction);
      toast.success('Walk-in delivery marked as paid');
      setPaymentDelivery(null);
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
    setSelectedSuppliers([]);
    // Convert UTC arrival to local datetime-local input format
    const localStr = new Date(d.expected_arrival).toISOString().slice(0, 16);
    setDeliveryForm({
      vehicle_number: d.vehicle_number,
      driver_name: d.driver_name || '',
      driver_cash: d.driver_cash || '',
      supplier: d.supplier || '',
      expected_arrival: localStr,
      notes: d.notes || '',
      items: d.items.length ? d.items.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit: i.unit, product_id: i.product_id || '' })) : [{ item_name: '', quantity: '', unit: 'unit', product_id: '' }],
    });
    setShowDeliveryForm(true);
    setShowDeparture(true);
  };

  const addDeliveryItem = () =>
    setDeliveryForm(f => ({ ...f, items: [...f.items, { item_name: '', quantity: '', unit: 'unit', product_id: '' }] }));

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
    if (!settlementForm.type)
      return toast.error('Select a category');
    if (!settlementForm.amount || parseFloat(settlementForm.amount) <= 0)
      return toast.error('Enter a valid amount');
    if (!settlementForm.party_name && settlementForm.type === 'paid_to_supplier')
      return toast.error('Enter supplier/company name');
    setSettlementSaving(true);
    try {
      await settlementApi.create({ ...settlementForm, amount: parseFloat(settlementForm.amount) });
      toast.success('Settlement entry added');
      setSettlementForm({ type: '', party_name: '', amount: '', mode: 'cash', reference: '', notes: '', received_category: 'not_applicable' });
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

  const [walkinConfirmModal, setWalkinConfirmModal] = useState(null);

  const executeCreateWalkinDue = async (force_walkin = false) => {
    setWalkinDueSaving(true);
    try {
      const res = await dashboardApi.createWalkinDue({
        name: walkinDueForm.name,
        amount: parseFloat(walkinDueForm.amount),
        phone: walkinDueForm.phone,
        notes: walkinDueForm.notes,
        force_walkin
      });
      toast.success(res.message);
      setWalkinDueForm({ name: '', amount: '', phone: '', notes: '' });
      setShowWalkinDueForm(false);
      setWalkinConfirmModal(null);
      // Refresh dashboard to show new due
      dashboardApi.get(selectedDate).then(d => {
        setData(d);
        if (dueDateInvoices !== null) {
          if (selectedDate === duesCardDate) setDueDateInvoices(d.todayPendingDues || []);
          else loadDueDateData(duesCardDate);
        }
      }).catch(() => { });
      loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
    } catch (err) { toast.error(err.message); }
    finally { setWalkinDueSaving(false); }
  };

  const handleCreateWalkinDue = async () => {
    if (!walkinDueForm.name.trim()) return toast.error('Customer name is required');
    if (!walkinDueForm.amount || parseFloat(walkinDueForm.amount) <= 0) return toast.error('Enter a valid amount');
    
    if (walkinDueForm.phone && walkinDueForm.phone.trim().length >= 10) {
      try {
        const phoneCheck = await dashboardApi.checkPhone(walkinDueForm.phone);
        if (phoneCheck.registered) {
          setWalkinConfirmModal({
            title: '⚠️ Phone Number Warning',
            message: `This phone number belongs to registered customer "${phoneCheck.registered.name}" (Balance: ₹${phoneCheck.registered.balance}).\n\nAre you SURE you want to create a separate Walk-in due?`,
            onConfirm: () => executeCreateWalkinDue(true)
          });
          return;
        } else if (phoneCheck.walkin_invoices && phoneCheck.walkin_invoices.length > 0) {
          setWalkinConfirmModal({
            title: '⚠️ Phone Number Warning',
            message: `This phone number already has ${phoneCheck.walkin_invoices.length} unpaid walk-in dues totaling ₹${phoneCheck.total_walkin_due}.\n\nAre you sure you want to add another Walk-in due?`,
            onConfirm: () => executeCreateWalkinDue(false)
          });
          return;
        }
      } catch (err) {
        // Ignore error and proceed if check fails
      }
    }

    executeCreateWalkinDue(false);
  };
  const [dueDateInvoices, setDueDateInvoices] = useState(null); // invoices for selected dues date

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


  const handleRecordPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return toast.error('Enter a valid amount');
    setPaying(true);
    try {
      // If the admin enters an amount greater than the single invoice balance, 
      // we remove the specific invoiceId so the backend cascades the payment across ALL unpaid bills.
      // If they enter an amount equal or less than the single invoice, we keep the invoiceId
      // so it ONLY pays off that specific bill!
      let invoiceId = payModal.invoice_id || null;
      if (payModal.hasMultipleUnpaid && parseFloat(payForm.amount) > payModal.balance) {
        invoiceId = null;
      }

      const res = await dashboardApi.recordPayment({
        invoice_id: invoiceId, invoice_ids: payForm.selectedInvoices, invoice_ids: payForm.selectedInvoices,
        customer_id: payModal.customer_id || null,
        amount: parseFloat(payForm.amount),
        mode: payForm.mode,
        reference: payForm.reference,
      });
      toast.success(res.message || `₹${payForm.amount} recorded via ${payForm.mode.toUpperCase()}`);
      if (res.advance_stored > 0) {
        toast(`₹${res.advance_stored.toFixed(2)} stored as advance credit for customer`, { icon: '✓', duration: 4000 });
      }
      setPayModal(null);
      setPayForm({ amount: '', mode: 'cash', reference: '' });
      // Refresh dashboard with current selected date
      dashboardApi.get(selectedDate).then(d => {
        setData(d);
        if (dueDateInvoices !== null) {
          if (selectedDate === duesCardDate) setDueDateInvoices(d.todayPendingDues || []);
          else loadDueDateData(duesCardDate);
        }
      }).catch(e => toast.error(e.message));
      loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  // Returns the order quantity for a product (defaults to "needed" amount)
  const getOrderQty = (p) => {
    if (orderQty[p._id] !== undefined) return orderQty[p._id];
    if (p.saved_order_qty > 0) return p.saved_order_qty;
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
    const defaultQty = p?.saved_order_qty > 0 ? p.saved_order_qty : Math.max(0, minStock - (p?.stock ?? 0));
    setOrderQty(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] !== undefined ? prev[id] : defaultQty) + delta),
    }));
  };

  // Re-fetches whenever selectedDate changes — no manual refresh needed
  // Load product lists for Low Stock filter
  useEffect(() => {
    productListApi.getAll().then(res => setProductLists(res || [])).catch(() => {});
  }, []);

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
      <div className="empty-icon"><AlertTriangle size={36} className="text-warning" /></div>
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
          <div style="text-align:right;font-size:12px;color:#6b7280">${settings?.business_phone ? 'Phone: ' + settings?.business_phone : ''}</div>
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
      `*Low Stock Alert — ${settings?.business_name || 'My Shop'}*\nDate: ${today}\n` +
      `━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━\n` +
      `Total items needing restock: *${data.lowStockProducts.length}*\nPlease arrange stock at the earliest.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div>
      {showWalkinManagerModal && (
        <WalkinManagerAssignModal 
          trip={null}
          onClose={() => setShowWalkinManagerModal(false)}
          onSuccess={() => {
            dashboardApi.get(selectedDate).then(setData).catch(() => {});
          }}
        />
      )}
      {showWalkinModal && (
        <WalkInDeliveryModal
          isOpen={showWalkinModal}
          onClose={() => setShowWalkinModal(false)}
          onSuccess={() => {
            loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, settlementSortDate, settlementSortAmount);
            loadDeliveries(deliveryDateFilter || getTodayIST());
            dashboardApi.get(selectedDate).then(setData).catch(() => {});
            loadSuppliers('');
          }}
          suppliers={suppliers}
          allUnits={allUnits}
          onAddCustomUnit={addCustomUnit}
          onSearchSuppliers={searchSuppliers}
          supplierSuggestions={supplierSuggestions}
          setSupplierSuggestions={setSupplierSuggestions}
          onSearchProducts={searchProducts}
          productSuggestions={productSuggestions}
        />
      )}

      {showWalkinMatchModal && walkinMatch && (
        <div className="modal-overlay" onClick={() => setShowWalkinMatchModal(false)}>
          {/* ... existing modal code ... */}
        </div>
      )}

      {/* ── MODALS ── */}
      {paymentDelivery && (
        <PaymentModal 
          isOpen={true} 
          onClose={() => setPaymentDelivery(null)}
          onConfirm={(mode, notes, paidAmt, paymentAction) => handleMarkWalkinPaid(paymentDelivery._id, mode, notes, paidAmt, paymentAction)}
          amount={(() => {
            const baseAmt = paymentDelivery?.items?.reduce((s, i) => s + ((parseFloat(i.base_price) || 0) * (parseFloat(i.quantity) || 0)), 0) || 0;
            return Math.max(0, baseAmt - (paymentDelivery?.amount_paid || 0));
          })()}
        />
      )}
      
      <DeliveryDetailsModal 
        isOpen={!!detailsDelivery}
        onClose={() => setDetailsDelivery(null)}
        delivery={detailsDelivery}
      />



      {/* Stats */}
      {/* Notification bar — shows if any deliveries are arriving soon */}
      {arrivingSoon.length > 0 && (
        <div 
          onClick={scrollToDeparture}
          style={{
            background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 8,
            padding: '10px 16px', marginBottom: 14, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            cursor: 'pointer'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} style={{ color: '#f59e0b' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} /> {arrivingSoon.length} vehicle{arrivingSoon.length > 1 ? 's' : ''} arriving soon!
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {arrivingSoon.map(d => `${d.vehicle_number} (${d.expected_arrival_ist})`).join(' · ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Notification Removed */}

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
                ? `${arrivingSoon.length} arriving soon`
                : showDeparture ? '▲ Hide' : '▼ View Vehicles'}
            </div>
          </div>
        </div>
      </div>


      {/* Products dropdown */}
      {showProducts && (
        <div className="card" style={{ marginBottom: 20 }} ref={productsPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                <div style={{ whiteSpace: 'nowrap' }}>
                  <Package size={18} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> Products
                </div>
                {data.allProducts?.length > 0 && (
                  <span className="badge badge-primary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{data.allProducts.length}</span>
                )}
                {data.topProducts?.[0] && (
                  <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ↑ Top Today: {data.topProducts[0].product_name}
                  </span>
                )}
              </div>
              <Link to="/products?action=add" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '4px 10px', fontSize: 12 }}>+ Add Product</Link>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>

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
              }}><FileText size={14} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} /> PDF</button>
              {/* WhatsApp share of product list */}
              <button className="btn btn-outline btn-sm" onClick={() => {
                const lines = (data.allProducts || []).map(p =>
                  `• ${p.name} ${p.stock} ${p.unit} @${p.price}`
                ).join('\n\n');
                const msg = encodeURIComponent(
                  `Product Report — ${settings?.business_name || 'My Shop'}\nDate: ${getTodayIST()}\n━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━\nTotal: ${data.allProducts?.length} products`
                );
                window.open(`https://wa.me/?text=${msg}`, '_blank');
              }}><MessageSquare size={14} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} /> WhatsApp</button>
            </div>
          </div>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            {/* Dynamic search */}

            <div style={{ display: 'flex', gap: '8px', marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  className="form-control"
                  placeholder="Search product... (e.g. cement, rice)"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{ paddingLeft: 14 }}
                />
                {productSearch && (
                  <button style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                    onClick={() => setProductSearch('')}>✕</button>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
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
              </div>
            </div>
          </div>
          <div className="no-pad" style={{ padding: 0 }}>
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
                return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()); // name_asc default
              });

              if (!filtered.length) return (
                <div className="empty-state" style={{ padding: 20 }}>No products match "{productSearch}"</div>
              );

              return (
                <div style={{ maxHeight: 380, overflowY: 'auto', width: '100%' }}>
                  <table style={{ display: 'table', width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '100%', padding: '10px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Product</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Stock</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Price ₹</th>
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
                            <td style={{ padding: '10px 10px', fontWeight: 600 }}>
                              <div>{hl(p.name)}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
                                Added by: {p.created_by?.display_name || p.created_by?.username || 'System / Admin'}
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: stockColor }}>
                              {p.stock} {p.unit}
                              {p.stock === 0 && <span style={{ marginLeft: 4, fontSize: 10, background: '#fef2f2', color: 'var(--danger)', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>Out</span>}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fc(p.price)}</td>
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
              <Users size={18} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> All Customers
              {allCustomers.length > 0 && (
                <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 11 }}>{allCustomers.length}</span>
              )}
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <Link to="/customers?action=add" className="btn btn-primary btn-sm" style={{ height: 32, display: 'inline-flex', alignItems: 'center', borderRadius: 6, fontWeight: 600 }}>+ Add Customer</Link>
            </div>
          </div>
          <div className="card-body">
            {/* Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  className="form-control"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{ paddingLeft: 14 }}
                />
                {customerSearch && (
                  <button style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                    onClick={() => setCustomerSearch('')}>✕</button>
                )}
              </div>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {['Customer', 'Phone', 'Balance Due'].map(h => (
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
                              {c.created_by && (
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <User size={10} /> {c.created_by.display_name || c.created_by.username} 
                                  <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>({c.created_by.role?.replace('_', ' ')})</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              {c.phone ? (
                                hasDue ? (
                                  <a
                                    href={`https://wa.me/91${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      t(
                                        `Hello ${c.name},\n\nThis is a reminder from *${settings?.business_name || 'our store'}*.\nYour pending due amount is *₹${due && due.toFixed ? due.toFixed(2) : due}*.\n\nPlease clear it at your earliest convenience. 🙏\nThank you!`,
                                        `नमस्ते ${c.name},\n\nयह *${settings?.business_name || 'हमारे स्टोर'}* की ओर से एक रिमाइंडर है।\nआपकी बकाया राशि *₹${due && due.toFixed ? due.toFixed(2) : due}* है।\n\nकृपया जल्द से जल्द भुगतान करें। 🙏\nधन्यवाद!`
                                      )
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#25d366', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                                  >
                                    <><MessageSquare size={14} style={{ marginRight: 4, color: '#25d366', display: 'inline-block', verticalAlign: 'middle' }} /> {c.phone}</>
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.phone}</span>
                                )
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: hasDue ? 'var(--danger)' : 'var(--success)' }}>
                              {hasDue ? fc(due) : <span className="badge badge-success" style={{ fontSize: 10 }}>✓ Clear</span>}
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
          <div className="card-header incoming-header-flex">
            <div className="card-title incoming-header-title">
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
            <div className="incoming-header-actions">
              {/* Calendar with OK button inside dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                  <input
                    type="date"
                    value={deliveryDateInput || getTodayIST()}
                    max={getTodayIST()}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--text)' }}
                    onChange={e => {
                      // Apply instantly on select — no OK button needed
                      const d = e.target.value || getTodayIST();
                      setDeliveryDateInput(d);
                      setDeliveryDateFilter(d);
                      loadDeliveries(d);
                    }}
                  />
                </div>
                {deliveryDateFilter && deliveryDateFilter !== getTodayIST() && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => {
                      setDeliveryDateFilter('');
                      setDeliveryDateInput('');
                      loadDeliveries(getTodayIST());
                    }}
                  >
                    <RotateCcw size={12} /> Today
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: '#d97706', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, padding: '4px 6px', fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={() => setShowWalkinModal(true)}
                >
                  <UserCheck size={12} /> Walk-in
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4px 6px', fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    setEditDeliveryId(null);
                    setDeliveryForm({
                      vehicle_number: '', driver_name: '', supplier: '',
                      expected_arrival: getNowDateTimeLocal(), // always default to now
                      notes: '',
                      items: [
                        { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
                        { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
                      ]
                    });
                    setShowDeliveryForm(d => !d);
                  }}
                >
                  {showDeliveryForm && !editDeliveryId ? '✕ Cancel' : '+ Vehicle'}
                </button>
              </div>

              </div>
              <div className="incoming-header-sort">
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
              </div>
            </div>

          <div className="card-body">

            {/* Add / Edit Delivery Form */}
            {showDeliveryForm && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowDeliveryForm(false); setEditDeliveryId(null); }} />
                <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 650, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
                  
                  <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 48, height: 48, background: '#e0f2fe', color: '#0ea5e9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {editDeliveryId ? <Edit2 size={24} /> : <Plus size={24} />}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{editDeliveryId ? 'Edit Delivery Entry' : 'New Incoming Vehicle'}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>{editDeliveryId ? 'Update details' : 'Record incoming goods transport'}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowDeliveryForm(false); setEditDeliveryId(null); }} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div style={{ padding: '20px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="incoming-form-grid" style={{ flex: 1 }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle Number *</label>
                    <input className="form-control"
                      value={deliveryForm.vehicle_number}
                      onChange={e => setDeliveryForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                      onFocus={() => setVehicleFocus(true)}
                      onBlur={() => setTimeout(() => setVehicleFocus(false), 200)}
                      placeholder="UK05 4199"
                      style={{ padding: '12px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace', width: '100%', boxSizing: 'border-box' }} />
                    {vehicleFocus && savedVehicles.filter(v => v.toLowerCase().includes(deliveryForm.vehicle_number.toLowerCase())).length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                        {savedVehicles.filter(v => v.toLowerCase().includes(deliveryForm.vehicle_number.toLowerCase())).map((v, i) => (
                          <div key={i}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13.5, fontWeight: 500, fontFamily: 'monospace' }}
                            onMouseDown={() => {
                              setDeliveryForm(f => ({ ...f, vehicle_number: v }));
                              setVehicleFocus(false);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            {v}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver Name</label>
                    <input className="form-control"
                      value={deliveryForm.driver_name}
                      onChange={e => {
                        const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                        setDeliveryForm(f => ({ ...f, driver_name: val }));
                      }}
                      onFocus={() => setDriverFocus(true)}
                      onBlur={() => setTimeout(() => setDriverFocus(false), 200)}
                      placeholder="Driver Name"
                      style={{ padding: '12px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                    {driverFocus && savedDrivers.filter(d => d.toLowerCase().includes(deliveryForm.driver_name.toLowerCase())).length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                        {savedDrivers.filter(d => d.toLowerCase().includes(deliveryForm.driver_name.toLowerCase())).map((d, i) => (
                          <div key={i}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13.5, fontWeight: 500 }}
                            onMouseDown={() => {
                              setDeliveryForm(f => ({ ...f, driver_name: d }));
                              setDriverFocus(false);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="desktop-only" style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash Given to Driver</label>
                    <input className="form-control" type="number" min="0" step="1"
                      value={deliveryForm.driver_cash}
                      onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                      placeholder="₹ Amount"
                      style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                  <div className="mobile-only" style={{ alignSelf: 'end' }}>
                    <div 
                      onClick={() => {
                        const dateInput = document.getElementById('mobile-incoming-date');
                        if (dateInput && typeof dateInput.showPicker === 'function') {
                          try { dateInput.showPicker(); } catch(e) {}
                        }
                      }}
                      style={{ position: 'relative', width: 46.6, height: 46.6, background: '#f1f5f9', borderRadius: 10, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Calendar size={20} color="#475569" />
                      <input id="mobile-incoming-date" type="datetime-local" value={deliveryForm.expected_arrival} onChange={e => setDeliveryForm(f => ({ ...f, expected_arrival: e.target.value }))} required style={{ position: 'fixed', top: '40%', left: '0%', width: 0, height: 0, opacity: 0 }} title="Set Date & Time" />
                    </div>
                  </div>
                </div>
                
                <div className="mobile-only" style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash Given to Driver</label>
                  <input className="form-control" type="number" min="0" step="1"
                    value={deliveryForm.driver_cash}
                    onChange={e => setDeliveryForm(f => ({ ...f, driver_cash: e.target.value }))}
                    placeholder="₹ Amount"
                    style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier Names {!editDeliveryId && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>(select multiple)</span>}</label>

                    <input className="form-control"
                      value={deliveryForm.supplier}
                      onChange={e => {
                        setDeliveryForm(f => ({ ...f, supplier: e.target.value }));
                        searchSuppliers(e.target.value);
                      }}
                      onBlur={() => setTimeout(() => setSupplierSuggestions(null), 200)}
                      placeholder={editDeliveryId ? "Supplier name..." : (selectedSuppliers.length > 0 ? "Add another supplier..." : "Type to search suppliers...")}
                      style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                    {deliveryForm.supplier && supplierSuggestions !== null && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                        {supplierSuggestions.map(s => (
                          <div key={s._id}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13.5, borderBottom: '1px solid #f3f4f6', background: selectedSuppliers.includes(s.name) ? '#f0fdf4' : '' }}
                            onMouseDown={() => {
                              if (editDeliveryId) {
                                setDeliveryForm(f => ({ ...f, supplier: s.name }));
                              } else {
                                if (!selectedSuppliers.includes(s.name)) {
                                  setSelectedSuppliers(prev => [...prev, s.name]);
                                }
                                setDeliveryForm(f => ({ ...f, supplier: '' }));
                              }
                              setSupplierSuggestions(null);
                            }}
                            onMouseEnter={e => { if (!selectedSuppliers.includes(s.name)) e.currentTarget.style.background = '#f0f9ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = selectedSuppliers.includes(s.name) ? '#f0fdf4' : ''; }}
                          >
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{s.name} {selectedSuppliers.includes(s.name) && <span style={{ color: '#16a34a', fontSize: 11 }}>✓ Added</span>}</div>
                            {s.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{s.phone}</div>}
                          </div>
                        ))}
                        {!supplierSuggestions.some(s => s.name.toLowerCase() === deliveryForm.supplier.trim().toLowerCase()) && (
                          <div
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff' }}
                            onMouseDown={() => {
                              if (editDeliveryId) {
                                setSupplierSuggestions(null);
                              } else {
                                const newName = deliveryForm.supplier.trim();
                                if (newName && !selectedSuppliers.includes(newName)) {
                                  setSelectedSuppliers(prev => [...prev, newName]);
                                }
                                setDeliveryForm(f => ({ ...f, supplier: '' }));
                                setSupplierSuggestions(null);
                              }
                              toast('Supplier will be saved when delivery is marked complete', { icon: 'ℹ️', duration: 2500 });
                            }}
                          >
                            + Add "{deliveryForm.supplier}" as new supplier
                          </div>
                        )}
                      </div>
                    )}
                    {/* Selected supplier chips */}
                    {!editDeliveryId && selectedSuppliers.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {selectedSuppliers.map((name, idx) => (
                          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>
                            {name}
                            <button onClick={() => setSelectedSuppliers(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', padding: 0, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>&times;</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="desktop-only" style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Arrival Date & Time *</label>
                      <input className="form-control" type="datetime-local"
                        value={deliveryForm.expected_arrival}
                        onChange={e => setDeliveryForm(f => ({ ...f, expected_arrival: e.target.value }))}
                        style={{ padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13.5, fontWeight: 500, width: 'fit-content', minWidth: '220px', boxSizing: 'border-box' }}
                      />
                      {deliveryForm.expected_arrival && (
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} /> {new Date(deliveryForm.expected_arrival).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                
                {(!editDeliveryId && selectedSuppliers.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {deliveryForm.suppliers_data && deliveryForm.suppliers_data.map((supplierObj, sIdx) => (
                      <div key={supplierObj.supplier_name} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Package size={18} style={{ color: '#0ea5e9' }} /> Items for {supplierObj.supplier_name}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Cash Given:</label>
                            <input className="form-control" type="number"
                              value={supplierObj.cash_given || ''}
                              onChange={e => {
                                setDeliveryForm(f => {
                                  const updatedData = [...(f.suppliers_data || [])];
                                  updatedData[sIdx].cash_given = e.target.value;
                                  return { ...f, suppliers_data: updatedData };
                                });
                              }}
                              placeholder="₹ Amount"
                              style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }} />
                            {/* Fetch Low Stock Button for Supplier */}
                            <div style={{ position: 'relative' }}>
                              <div 
                                onClick={() => setShowLowStockMenu(showLowStockMenu === `supplier_${sIdx}` ? false : `supplier_${sIdx}`)}
                                style={{
                                  padding: '8px 12px',
                                  border: '1px solid #fcd34d',
                                  borderRadius: 8,
                                  background: '#fffbf1',
                                  color: '#d97706',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                              >
                                <span className="desktop-only">{selectedLowLists.length ? `${selectedLowLists.length} list(s) selected` : 'Fetch Low Stock'}</span>
                                <span className="mobile-only"><Package size={14} style={{ marginRight: 4 }}/> {selectedLowLists.length ? selectedLowLists.length : 'Stock'}</span>
                                <span style={{ marginLeft: 6 }}>▾</span>
                              </div>

                              {showLowStockMenu === `supplier_${sIdx}` && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: 8,
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 12,
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                  zIndex: 100,
                                  width: 240,
                                  maxHeight: 320,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 800, fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Lists</span>
                                    <button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (selectedLowLists.length === 0) {
                                          setShowLowStockMenu(false);
                                          return;
                                        }
                                        
                                        const threshold = parseInt(settings?.low_stock_threshold) || 10;
                                        let lowItems = data?.lowStockProducts || [];

                                        if (!selectedLowLists.includes('ALL')) {
                                          let allSelectedProductIds = new Set();
                                          productLists.forEach(l => {
                                            if (selectedLowLists.includes(l._id)) {
                                              (l.products || []).forEach(p => allSelectedProductIds.add(p._id || p));
                                            }
                                          });
                                          lowItems = lowItems.filter(p => allSelectedProductIds.has(p._id));
                                        }

                                        if (!lowItems.length && !selectedLowLists.includes('ALL')) {
                                          toast('No low stock items found in selected list(s).', { icon: 'ℹ️' });
                                          return;
                                        } else if (!lowItems.length) {
                                          toast('No low stock items found. All products adequately stocked.', { icon: '✓' });
                                          return;
                                        }

                                        const mapped = lowItems.filter(p => p.saved_order_qty !== -1).map(p => {
                                          const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0)
                                            ? p.custom_low_stock : threshold;
                                          const neededQty = p.saved_order_qty > 0
                                            ? p.saved_order_qty
                                            : Math.max(1, minStock - p.stock);
                                          return {
                                            item_name: p.name,
                                            quantity: String(neededQty),
                                            unit: p.unit || 'unit',
                                            product_id: p._id,
                                            label: 'Goods',
                                            is_new_item: false,
                                          };
                                        });

                                        const customSaved = JSON.parse(localStorage.getItem('mk_custom_low_stock') || '[]');
                                        const mappedCustom = customSaved.map(c => ({
                                          item_name: c.name,
                                          quantity: String(c.orderQty),
                                          unit: c.unit || 'unit',
                                          product_id: '',
                                          label: 'Goods',
                                          is_new_item: true,
                                        }));

                                        const finalCustom = selectedLowLists.includes('ALL') ? mappedCustom : [];

                                        setDeliveryForm(f => {
                                          const updatedSuppliers = [...f.suppliers_data];
                                          const existingItems = updatedSuppliers[sIdx].items.filter(item => item.item_name.trim() !== '' || (item.quantity !== '0' && item.quantity !== ''));
                                          const existingIds = new Set(existingItems.filter(i => i.product_id).map(i => i.product_id));
                                          const existingNames = new Set(existingItems.filter(i => !i.product_id).map(i => i.item_name.toLowerCase()));

                                          const newItems = [...mapped, ...finalCustom].filter(m => {
                                            if (m.product_id && existingIds.has(m.product_id)) return false;
                                            if (!m.product_id && existingNames.has(m.item_name.toLowerCase())) return false;
                                            return true;
                                          });

                                          updatedSuppliers[sIdx].items = checkAutoAddRow([
                                            ...existingItems,
                                            ...newItems,
                                            { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods', is_new_item: true }
                                          ]);

                                          return { ...f, suppliers_data: updatedSuppliers };
                                        });
                                        
                                        const totalAdded = mapped.length + finalCustom.length;
                                        toast.success(`${totalAdded} low stock item${totalAdded !== 1 ? 's' : ''} imported`);
                                        setShowLowStockMenu(false);
                                        setSelectedLowLists([]);
                                      }}
                                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, background: '#0ea5e9', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14,165,233,0.2)' }}
                                    >
                                      Fetch
                                    </button>
                                  </div>
                                  <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 4 }}>
                                    {productLists.map(l => (
                                      <label key={l._id} 
                                        style={{ 
                                          display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', margin: 0,
                                          background: selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id) ? '#f0f9ff' : 'transparent',
                                          borderBottom: '1px solid #f1f5f9',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = (selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)) ? '#e0f2fe' : '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = (selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)) ? '#f0f9ff' : 'transparent'}
                                      >
                                        <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                          <input 
                                            type="checkbox"
                                            checked={selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)}
                                            onChange={(e) => {
                                              let newList = [...selectedLowLists];
                                              if (newList.includes('ALL')) {
                                                newList = productLists.map(p => p._id);
                                              }
                                              if (e.target.checked) {
                                                newList.push(l._id);
                                                if (productLists.length > 0 && productLists.every(p => newList.includes(p._id))) {
                                                  newList.push('ALL');
                                                }
                                              } else {
                                                newList = newList.filter(id => id !== l._id && id !== 'ALL');
                                              }
                                              setSelectedLowLists(newList);
                                            }}
                                            style={{ accentColor: '#0ea5e9', transform: 'scale(1.35)', margin: 0, cursor: 'pointer' }}
                                          />
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: (selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)) ? '#0369a1' : '#334155' }}>{l.name}</span>
                                      </label>
                                    ))}

                                    <label 
                                      style={{ 
                                        display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', margin: 0,
                                        background: selectedLowLists.includes('ALL') ? '#f0f9ff' : 'transparent',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = selectedLowLists.includes('ALL') ? '#e0f2fe' : '#f8fafc'}
                                      onMouseLeave={e => e.currentTarget.style.background = selectedLowLists.includes('ALL') ? '#f0f9ff' : 'transparent'}
                                    >
                                      <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        <input 
                                          type="checkbox" 
                                          checked={selectedLowLists.includes('ALL')}
                                          onChange={(e) => {
                                            if (e.target.checked) setSelectedLowLists(['ALL', ...productLists.map(p => p._id)]);
                                            else setSelectedLowLists([]);
                                          }}
                                          style={{ accentColor: '#0ea5e9', transform: 'scale(1.35)', margin: 0, cursor: 'pointer' }}
                                        />
                                      </div>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: selectedLowLists.includes('ALL') ? '#0369a1' : '#1e293b' }}>All Items</span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {supplierObj.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              
                              {/* Product Search Input */}
                              <div style={{ flex: 2, minWidth: 120, position: 'relative' }}>
                                {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Item Name</div>}
                                <input
                                  className="form-control"
                                  value={item.item_name}
                                  placeholder="Type product name..."
                                  style={{ fontSize: 13, borderRadius: 8, padding: '10px 8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items[idx].item_name = val;
                                      updatedSuppliers[sIdx].items[idx].product_id = '';
                                      updatedSuppliers[sIdx].items[idx].is_new_item = true;
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                    if (val.trim().length > 0) {
                                      const matches = data.allProducts.filter(p => p.name.toLowerCase().includes(val.toLowerCase()));
                                      setProductSuggestions(matches);
                                      setProductSuggestIdx(`${sIdx}_${idx}`);
                                    } else {
                                      setProductSuggestions([]);
                                      setProductSuggestIdx(null);
                                    }
                                  }}
                                  onFocus={e => {
                                    if (e.target.value.trim().length > 0) {
                                      const matches = data.allProducts.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase()));
                                      setProductSuggestions(matches);
                                      setProductSuggestIdx(`${sIdx}_${idx}`);
                                    }
                                  }}
                                  onBlur={() => setTimeout(() => { setProductSuggestIdx(null); setProductSuggestions([]); }, 200)}
                                />
                                {productSuggestIdx === `${sIdx}_${idx}` && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                                    {productSuggestions.map(p => (
                                      <div key={p._id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        onMouseDown={() => {
                                          setDeliveryForm(f => {
                                            const updatedSuppliers = [...f.suppliers_data];
                                            const updatedItems = [...updatedSuppliers[sIdx].items];
                                            updatedItems[idx] = { ...updatedItems[idx], item_name: p.name, quantity: '1', unit: p.unit || 'unit', product_id: p._id, is_new_item: false };
                                            updatedSuppliers[sIdx].items = checkAutoAddRow(updatedItems);
                                            return { ...f, suppliers_data: updatedSuppliers };
                                          });
                                          setProductSuggestions([]); setProductSuggestIdx(null);
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.background = ''}
                                      >
                                        <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: '#64748b' }}>Stock: {p.stock} {p.unit} · ₹{p.price}</div></div>
                                      </div>
                                    ))}
                                    {!productSuggestions.some(p => p.name.toLowerCase() === item.item_name.toLowerCase()) && (
                                      <div style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff' }}
                                        onMouseDown={() => {
                                          setDeliveryForm(f => {
                                            const updatedSuppliers = [...f.suppliers_data];
                                            const updatedItems = [...updatedSuppliers[sIdx].items];
                                            updatedItems[idx] = { ...updatedItems[idx], product_id: '', quantity: updatedItems[idx].quantity === '0' ? '1' : updatedItems[idx].quantity, is_new_item: true };
                                            updatedSuppliers[sIdx].items = checkAutoAddRow(updatedItems);
                                            return { ...f, suppliers_data: updatedSuppliers };
                                          });
                                          setProductSuggestions([]); setProductSuggestIdx(null);
                                        }}
                                      >
                                        + Use "{item.item_name}" as new product
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Qty Input */}
                              <div style={{ flex: 1, minWidth: 50 }}>
                                {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Qty</div>}
                                <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} placeholder="0" style={{ fontSize: 13, borderRadius: 8, padding: '10px 8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                                  onChange={e => {
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items[idx].quantity = e.target.value;
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                  }}
                                />
                              </div>

                              {/* Unit Input */}
                              <div style={{ flex: 1, minWidth: 60, position: 'relative' }}>
                                {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>}
                                <input className="form-control" value={item.unit || ''} placeholder="bag" style={{ fontSize: 13, borderRadius: 8, padding: '10px 8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                                  onChange={e => {
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items[idx].unit = e.target.value;
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                    setProductSuggestIdx(`unit_${sIdx}_${idx}`);
                                  }}
                                  onFocus={() => setProductSuggestIdx(`unit_${sIdx}_${idx}`)}
                                  onBlur={() => setTimeout(() => setProductSuggestIdx(null), 200)}
                                />
                                {productSuggestIdx === `unit_${sIdx}_${idx}` && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                                    {allUnits.filter(u => !item.unit || u.toLowerCase().includes((item.unit || '').toLowerCase())).map(u => (
                                      <div key={u} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                                        onMouseDown={() => {
                                          setDeliveryForm(f => {
                                            const updatedSuppliers = [...f.suppliers_data];
                                            updatedSuppliers[sIdx].items[idx].unit = u;
                                            return { ...f, suppliers_data: updatedSuppliers };
                                          });
                                          setProductSuggestIdx(null);
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.background = ''}
                                      >{u}</div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Remove button */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {idx === 0 && <div style={{ fontSize: 11, height: 16, marginBottom: 6 }}>&nbsp;</div>}
                                {supplierObj.items.length > 1 && (
                                  <button type="button" onClick={() => {
                                    setDeliveryForm(f => {
                                      const updatedSuppliers = [...f.suppliers_data];
                                      updatedSuppliers[sIdx].items = updatedSuppliers[sIdx].items.filter((_, i) => i !== idx);
                                      return { ...f, suppliers_data: updatedSuppliers };
                                    });
                                  }} 
                                    style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                                    title="Remove Item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : editDeliveryId ? (
                   // FALLBACK: SINGLE ITEM RENDERER FOR EDIT MODE!
                   <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                     
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={18} style={{ color: '#0ea5e9' }} /> Items
                    </h4>
                    <div style={{ position: 'relative' }}>
                      <div 
                        onClick={() => setShowLowStockMenu(!showLowStockMenu)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #fcd34d',
                          borderRadius: 8,
                          background: '#fffbf1',
                          color: '#d97706',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 12,
                          display: 'flex',
                          justifyContent: 'space-between',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                              >
                                <span className="desktop-only">{selectedLowLists.length ? `${selectedLowLists.length} list(s) selected` : 'Fetch Low Stock'}</span>
                                <span className="mobile-only"><Package size={14} style={{ marginRight: 4 }}/> {selectedLowLists.length ? selectedLowLists.length : 'Stock'}</span>
                                <span style={{ marginLeft: 6 }}>▾</span>
                              </div>

                    {showLowStockMenu && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 8,
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: 12,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        width: 240,
                        maxHeight: 320,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                      }}>
                        <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Lists</span>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              if (selectedLowLists.length === 0) {
                                setShowLowStockMenu(false);
                                return;
                              }
                              
                              const threshold = parseInt(settings?.low_stock_threshold) || 10;
                              let lowItems = data?.lowStockProducts || [];

                              if (!selectedLowLists.includes('ALL')) {
                                let allSelectedProductIds = new Set();
                                productLists.forEach(l => {
                                  if (selectedLowLists.includes(l._id)) {
                                    (l.products || []).forEach(p => allSelectedProductIds.add(p._id || p));
                                  }
                                });
                                lowItems = lowItems.filter(p => allSelectedProductIds.has(p._id));
                              }

                              if (!lowItems.length && !selectedLowLists.includes('ALL')) {
                                toast('No low stock items found in selected list(s).', { icon: 'ℹ️' });
                                return;
                              } else if (!lowItems.length) {
                                toast('No low stock items found. All products adequately stocked.', { icon: '✓' });
                                return;
                              }

                              const mapped = lowItems.filter(p => p.saved_order_qty !== -1).map(p => {
                                const minStock = (p.custom_low_stock != null && p.custom_low_stock >= 0)
                                  ? p.custom_low_stock : threshold;
                                const neededQty = p.saved_order_qty > 0
                                  ? p.saved_order_qty
                                  : Math.max(1, minStock - p.stock);
                                return {
                                  item_name: p.name,
                                  quantity: String(neededQty),
                                  unit: p.unit || 'unit',
                                  product_id: p._id,
                                  label: 'Goods',
                                  is_new_item: false,
                                };
                              });

                              const customSaved = JSON.parse(localStorage.getItem('mk_custom_low_stock') || '[]');
                              const mappedCustom = customSaved.map(c => ({
                                item_name: c.name,
                                quantity: String(c.orderQty),
                                unit: c.unit || 'unit',
                                product_id: '',
                                label: 'Goods',
                                is_new_item: true,
                              }));

                              const finalCustom = selectedLowLists.includes('ALL') ? mappedCustom : [];

                              setDeliveryForm(f => {
                                const existingItems = f.items.filter(item => item.item_name.trim() !== '' || (item.quantity !== '0' && item.quantity !== ''));
                                const existingIds = new Set(existingItems.filter(i => i.product_id).map(i => i.product_id));
                                const existingNames = new Set(existingItems.filter(i => !i.product_id).map(i => i.item_name.toLowerCase()));

                                const newItems = [...mapped, ...finalCustom].filter(m => {
                                  if (m.product_id && existingIds.has(m.product_id)) return false;
                                  if (!m.product_id && existingNames.has(m.item_name.toLowerCase())) return false;
                                  return true;
                                });

                                return {
                                  ...f,
                                  items: [
                                    ...existingItems,
                                    ...newItems,
                                    { item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' },
                                  ],
                                };
                              });
                              
                              const totalAdded = mapped.length + finalCustom.length;
                              toast.success(`${totalAdded} low stock item${totalAdded !== 1 ? 's' : ''} imported`);
                              setShowLowStockMenu(false);
                              setSelectedLowLists([]);
                            }}
                            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, background: '#0ea5e9', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14,165,233,0.2)' }}
                          >
                            Fetch
                          </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 4 }}>
                          {productLists.map(l => (
                            <label key={l._id} 
                              style={{ 
                                display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', margin: 0,
                                background: selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id) ? '#f0f9ff' : 'transparent',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = (selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)) ? '#e0f2fe' : '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = (selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)) ? '#f0f9ff' : 'transparent'}
                            >
                              <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <input 
                                  type="checkbox"
                                  checked={selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)}
                                  onChange={(e) => {
                                    let newList = [...selectedLowLists];
                                    if (newList.includes('ALL')) {
                                      newList = productLists.map(p => p._id);
                                    }
                                    if (e.target.checked) {
                                      newList.push(l._id);
                                      if (productLists.length > 0 && productLists.every(p => newList.includes(p._id))) {
                                        newList.push('ALL');
                                      }
                                    } else {
                                      newList = newList.filter(id => id !== l._id && id !== 'ALL');
                                    }
                                    setSelectedLowLists(newList);
                                  }}
                                  style={{ accentColor: '#0ea5e9', transform: 'scale(1.35)', margin: 0, cursor: 'pointer' }}
                                />
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 600, color: (selectedLowLists.includes('ALL') || selectedLowLists.includes(l._id)) ? '#0369a1' : '#334155' }}>{l.name}</span>
                            </label>
                          ))}

                          <label 
                            style={{ 
                              display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', margin: 0,
                              background: selectedLowLists.includes('ALL') ? '#f0f9ff' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = selectedLowLists.includes('ALL') ? '#e0f2fe' : '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = selectedLowLists.includes('ALL') ? '#f0f9ff' : 'transparent'}
                          >
                            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              <input 
                                type="checkbox" 
                                checked={selectedLowLists.includes('ALL')}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedLowLists(['ALL', ...productLists.map(p => p._id)]);
                                  else setSelectedLowLists([]);
                                }}
                                style={{ accentColor: '#0ea5e9', transform: 'scale(1.35)', margin: 0, cursor: 'pointer' }}
                              />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: selectedLowLists.includes('ALL') ? '#0369a1' : '#1e293b' }}>All Items</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {deliveryForm.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 2fr) 80px 85px auto', gap: 12, alignItems: 'flex-end', background: 'white', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>

                      <div style={{ position: 'relative' }}>
                        {idx === 0 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                            Item Name
                          </div>
                        )}
                        <input
                          className="form-control"
                          value={item.item_name}
                          placeholder="Type to search..."
                          onChange={e => {
                            const val = e.target.value;
                            setDeliveryForm(f => {
                              const updated = [...f.items];
                              updated[idx] = {
                                ...updated[idx],
                                item_name: val,
                                quantity: (val && updated[idx].quantity === '0') ? '1' : updated[idx].quantity,
                              };
                              return { ...f, items: checkAutoAddRow(updated) };
                            });
                            setProductSuggestIdx(idx);
                            searchProducts(val);
                          }}
                          onBlur={() => setTimeout(() => { setProductSuggestions([]); setProductSuggestIdx(null); }, 200)}
                          style={{ ...(item.is_new_item && item.item_name ? { paddingRight: 40 } : {}), fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                        />
                        {item.is_new_item && item.item_name && (
                          <div style={{ position: 'absolute', bottom: 9, right: 9, fontSize: 9, color: '#92400e', background: '#fffbeb', padding: '2px 6px', borderRadius: 4, fontWeight: 800, pointerEvents: 'none' }}>
                            NEW
                          </div>
                        )}
                        {productSuggestIdx === idx && item.item_name.trim() && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4
                          }}>
                            {productSuggestions.map(p => (
                              <div key={p._id}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                onMouseDown={() => {
                                  setDeliveryForm(f => {
                                    const updated = [...f.items];
                                    updated[idx] = {
                                      ...updated[idx],
                                      item_name: p.name,
                                      quantity: '1',
                                      unit: p.unit || 'unit',
                                      product_id: p._id,
                                      is_new_item: false,
                                    };
                                    return { ...f, items: checkAutoAddRow(updated) };
                                  });
                                  setProductSuggestions([]);
                                  setProductSuggestIdx(null);
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                onMouseLeave={e => e.currentTarget.style.background = ''}
                              >
                                <div>
                                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    Stock: {p.stock} {p.unit} · ₹{p.price}
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 10, color: '#475569', fontWeight: 600 }}>
                                  {p.unit}
                                </span>
                              </div>
                            ))}
                            <div
                              style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff', borderTop: productSuggestions.length > 0 ? '1px solid #bfdbfe' : 'none' }}
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
                              + Use "{item.item_name}" as new product
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Qty</div>}
                        <input className="form-control" type="number" min="0" step="0.01"
                          value={item.quantity}
                          onChange={e => updateDeliveryItem(idx, 'quantity', e.target.value)}
                          placeholder="0"
                          style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div style={{ position: 'relative' }}>
                        {idx === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>}
                        <input
                          className="form-control"
                          value={item.unit || ''}
                          placeholder="bag"
                          onChange={e => {
                            updateDeliveryItem(idx, 'unit', e.target.value);
                            setProductSuggestIdx(`unit_${idx}`);
                          }}
                          onFocus={() => setProductSuggestIdx(`unit_${idx}`)}
                          onBlur={() => setTimeout(() => setProductSuggestIdx(null), 200)}
                          style={{ fontSize: 13, borderRadius: 8, padding: '10px 12px', border: '1px solid #cbd5e1' }}
                        />
                        {productSuggestIdx === `unit_${idx}` && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto', marginTop: 4
                          }}>
                            {allUnits
                              .filter(u => !item.unit || u.toLowerCase().includes((item.unit || '').toLowerCase()))
                              .map(u => (
                                <div key={u}
                                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                                  onMouseDown={() => {
                                    updateDeliveryItem(idx, 'unit', u);
                                    setProductSuggestIdx(null);
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                  onMouseLeave={e => e.currentTarget.style.background = ''}
                                >{u}</div>
                              ))}
                            {item.unit && !allUnits.includes(item.unit.toLowerCase().trim()) && (
                              <div
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: '#0ea5e9', fontWeight: 600, background: '#eff6ff' }}
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

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {idx === 0 && <div style={{ fontSize: 11, height: 16, marginBottom: 6 }}>&nbsp;</div>}
                        {deliveryForm.items.length > 1 && (
                          <button type="button" onClick={() => removeDeliveryItem(idx)} 
                            style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                            title="Remove Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                    </div>
                  ))}
                </div>

                
                   </div>
                ) : (
                  // EMPTY STATE
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                    <Package size={32} style={{ color: '#94a3b8', marginBottom: 12 }} />
                    <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Please select at least one supplier to add items</div>
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
                  <input className="form-control"
                    value={deliveryForm.notes}
                    onChange={e => setDeliveryForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 500, width: '100%', boxSizing: 'border-box' }} />
                </div>

                  </div>
                  <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, flexShrink: 0 }}>
                    <button 
                      onClick={() => { setShowDeliveryForm(false); setEditDeliveryId(null); }}
                      style={{ flex: 1, padding: '12px 24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, color: '#0f172a', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveDelivery} 
                      disabled={deliverySaving}
                      style={{ flex: 2, padding: '12px 24px', background: '#0284c7', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: deliverySaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)', opacity: deliverySaving ? 0.7 : 1, transition: 'all 0.2s' }}
                    >
                      {deliverySaving ? 'Saving...' : editDeliveryId ? 'Update Entry' : <><Check size={18} /> Save Entry</>}
                    </button>
                  </div>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Vehicle', 'Driver/Supplier', 'Expected At', 'Items'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
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
                          pending: 'Pending',
                          on_the_way: 'On the Way',
                          arriving_soon: 'Arriving Soon',
                          delivered: 'Delivered',
                          not_delivered: 'Not Delivered',
                        };
                        const isWalkinOlderThan3Days = d.vehicle_number === 'WALK-IN' && (d.expected_arrival || d.created_at) && (Date.now() - new Date(d.expected_arrival || d.created_at).getTime() > 3 * 24 * 60 * 60 * 1000);
                        return (
                          <tr key={d._id} style={{
                            borderBottom: '1px solid #f3f4f6',
                            background: d.vehicle_number === 'WALK-IN' && d.payment_status !== 'paid'
                              ? 'rgba(245, 158, 11, 0.08)'  // slightly dim yellow for unpaid walk-in
                              : d.status === 'arriving_soon'
                                ? '#fef9ec'
                                : idx % 2 === 0 ? '#fff' : '#fafafa',
                            borderLeft: d.vehicle_number === 'WALK-IN' && d.status !== 'delivered'
                              ? '3px solid #f59e0b' : 'none',
                            cursor: 'pointer'
                            }} onClick={() => {
                              if (d.vehicle_number === 'WALK-IN') {
                                setDetailsDelivery(d);
                              } else {
                                navigate(`/vehicle/${d._id}`);
                              }
                            }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                <Link
                                  to={`/vehicle/${d._id}`}
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontWeight: 'bold', color: 'var(--text)', textDecoration: 'none' }}
                                >
                                  {d.vehicle_number === 'WALK-IN' ? 'Walk-in' : d.vehicle_number}
                                </Link>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <span className={`badge ${statusColors[d.status]}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                                    {statusLabels[d.status]}
                                  </span>
                                  {d.vehicle_number === 'WALK-IN' && d.payment_status !== 'paid' && !isWalkinOlderThan3Days && (
                                    <span className="badge badge-danger" style={{ fontSize: 10, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} /> Unpaid</span>
                                  )}
                                  {d.vehicle_number === 'WALK-IN' && d.payment_status === 'paid' && !isWalkinOlderThan3Days && (
                                    <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={10} /> Paid {d.payment_mode ? ` · ${d.payment_mode}` : ''}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                              {d.vehicle_number === 'WALK-IN' 
                                ? (d.supplier || '—') 
                                : (
                                  <>
                                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>{d.driver_name || '—'}</div>
                                    {d.supplier && <div style={{ fontSize: 11, marginTop: 2 }}>{d.supplier}</div>}
                                  </>
                                )}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                              {d.expected_arrival_ist}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ maxWidth: 180 }}>
                                {d.items.slice(0, 2).map((item, i) => (
                                  <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {item.item_name}
                                  </div>
                                ))}
                                {d.items.length > 2 && (
                                  <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                                    +{d.items.length - 2} more
                                  </div>
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

          </div>
        </div>
      )}

      {/* Settlement Panel */}
      {showStatement && (
        <div className="card" style={{ marginBottom: 20 }} ref={statementPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="card-title">
              <><ClipboardList size={18} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> Settlement</>
              {/* Fix 3 & 4: Show which date/mode is active */}
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                {settlementViewMode === 'all'
                  ? '— Full History'
                  : `— ${new Date(settlementCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
              </span>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>

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
              <Link to="/suppliers" className="btn btn-outline btn-sm"><><Users size={14} style={{ marginRight: 4 }} /> Suppliers</></Link>
            </div>
          </div>

          <div className="card-body">

            {/* Fix 4: Settlement date controls — independent of global calendar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                <Calendar size={13} className="text-muted" />
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
                {settlementViewMode === 'all' ? '▲ Hide Full History' : <><FileText size={14} style={{ marginRight: 4 }} /> Full History</>}
              </button>
            </div>

            {/* Add Entry Modal */}
            {showAddSettlement && (
              <div
                className="cs-modal-overlay"
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10000,
                  animation: 'fadeIn 0.2s ease-out',
                }}
              >
                <div style={{ position: 'absolute', inset: 0 }} onClick={() => setShowAddSettlement(false)} />
                <div
                  ref={addSettlementRef}
                  className="cs-modal card"
                  style={{
                    position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 650, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)', animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', padding: 0
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, background: '#eff6ff', color: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={18} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>New Settlement Entry</h3>
                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>Record a payment going out of the shop</p>
                      </div>
                    </div>
                    <button onClick={() => setShowAddSettlement(false)} style={{ background: 'none', border: '1px solid #e2e8f0', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Type Selector */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Entry Type</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setSettlementForm({ ...settlementForm, type: 'walkin_delivery', received_category: 'not_applicable' })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${settlementForm.type === 'walkin_delivery' ? '#3b82f6' : '#e2e8f0'}`, background: settlementForm.type === 'walkin_delivery' ? '#eff6ff' : 'white', color: settlementForm.type === 'walkin_delivery' ? '#2563eb' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
                          <Truck size={14} /> Walk-in Delivery
                        </button>
                        {isAdmin && <button type="button" onClick={() => setSettlementForm({ ...settlementForm, type: 'paid_to_supplier', received_category: 'not_applicable' })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${settlementForm.type === 'paid_to_supplier' ? '#3b82f6' : '#e2e8f0'}`, background: settlementForm.type === 'paid_to_supplier' ? '#eff6ff' : 'white', color: settlementForm.type === 'paid_to_supplier' ? '#2563eb' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
                          <User size={14} /> Supplier
                        </button>}
                        <button type="button" onClick={() => setSettlementForm({ ...settlementForm, type: 'other_expense', received_category: 'not_applicable' })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${settlementForm.type === 'other_expense' ? '#3b82f6' : '#e2e8f0'}`, background: settlementForm.type === 'other_expense' ? '#eff6ff' : 'white', color: settlementForm.type === 'other_expense' ? '#2563eb' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
                          <FileText size={14} /> Other Expense
                        </button>
                      </div>
                    </div>
                
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{settlementForm.type === 'paid_to_supplier' ? 'Supplier / Company *' : 'Party Name'}</label>
                        <input
                          ref={partyInputRef}
                          className="form-control"
                          style={{ fontSize: 14 }}
                          value={settlementForm.party_name}
                          onChange={e => {
                            setSettlementForm({ ...settlementForm, party_name: e.target.value });
                            setShowPartyList(true);
                          }}
                          onFocus={() => setShowPartyList(true)}
                          onBlur={() => setTimeout(() => setShowPartyList(false), 250)}
                          placeholder="Type or select party name"
                        />
                        {showPartyList && settlementForm.type !== 'other_expense' && (
                          <div
                            onMouseDown={e => e.preventDefault()}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              width: '100%',
                              maxHeight: 250,
                              overflowY: 'auto',
                              background: '#fff',
                              border: '1.5px solid #d1d5db',
                              borderRadius: 8,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                              zIndex: 99999,
                              marginTop: 4
                            }}
                          >
                            {(() => {
                              const q = settlementForm.party_name.toLowerCase().trim();
                              if (settlementForm.type === 'paid_to_supplier') {
                                const list = suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
                                if (list.length === 0) return <div style={{ padding: '10px', color: 'var(--text-muted)', fontSize: 12 }}>{q ? `No supplier found for "${q}"` : 'No suppliers available'}</div>;
                                return list.map((s, idx) => (
                                  <div
                                    key={s._id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setSettlementForm({ ...settlementForm, party_name: s.name });
                                      setShowPartyList(false);
                                    }}
                                    style={{
                                      padding: '8px 12px', cursor: 'pointer',
                                      borderBottom: idx < list.length - 1 ? '1px solid #f3f4f6' : 'none',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      transition: 'background 0.1s',
                                      background: '#fff'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{s.name}</div>
                                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{s.phone || 'No phone'}</div>
                                    </div>
                                    {s.balance > 0.01 && (
                                      <span style={{ fontSize: 9, fontWeight: 700, background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: 6 }}>
                                        Due ₹{s.balance?.toFixed(2)}
                                      </span>
                                    )}
                                    {s.balance < 0 && (
                                      <span style={{ fontSize: 9, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: 6 }}>
                                        Adv ₹{Math.abs(s.balance)?.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ));
                              } else {
                                // Basic array of names
                                const list = settlementData.partyNames.filter(n => n.toLowerCase().includes(q));
                                if (list.length === 0 && !q) return <div style={{ padding: '10px', color: 'var(--text-muted)', fontSize: 12 }}>Type to add a new party</div>;
                                if (list.length === 0) return (
                                  <div
                                    onMouseDown={(e) => { e.preventDefault(); setShowPartyList(false); }}
                                    style={{ padding: '10px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', background: '#fff', fontSize: 12 }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                  >
                                    + Add "{settlementForm.party_name}"
                                  </div>
                                );
                                return list.map((name, idx) => (
                                  <div
                                    key={name}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setSettlementForm({ ...settlementForm, party_name: name });
                                      setShowPartyList(false);
                                    }}
                                    style={{
                                      padding: '8px 12px', cursor: 'pointer',
                                      borderBottom: idx < list.length - 1 ? '1px solid #f3f4f6' : 'none',
                                      fontWeight: 600, fontSize: 12, color: '#111827',
                                      transition: 'background 0.1s',
                                      background: '#fff'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                  >
                                    {name}
                                  </div>
                                ));
                              }
                            })()}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Amount ₹ *</label>
                        <input type="number" step="0.01" min="0"
                          className="form-control"
                          style={{ fontSize: 14, fontWeight: 600 }}
                          value={settlementForm.amount}
                          onChange={e => setSettlementForm({ ...settlementForm, amount: e.target.value })}
                          placeholder="0.00" />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Payment Mode</label>
                        <select className="form-control" value={settlementForm.mode}
                          style={{ fontSize: 14, appearance: 'none', background: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e") no-repeat right 10px center/14px white` }}
                          onChange={e => setSettlementForm({ ...settlementForm, mode: e.target.value })}>
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="others">Others</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Reference (Optional)</label>
                        <input className="form-control" value={settlementForm.reference}
                          style={{ fontSize: 14 }}
                          onChange={e => setSettlementForm({ ...settlementForm, reference: e.target.value })}
                          placeholder="Txn ID / UPI" />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Notes (Optional)</label>
                      <input className="form-control" value={settlementForm.notes}
                        style={{ fontSize: 14 }}
                        onChange={e => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                        placeholder="e.g. Monthly supply payment" />
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: 'white', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" onClick={() => setShowAddSettlement(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleAddSettlement} disabled={settlementSaving} style={{ padding: '9px 20px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: settlementSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: settlementSaving ? 0.7 : 1 }}>
                      {settlementSaving ? <span style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span> : <Check size={14} />}
                      {settlementSaving ? 'Saving...' : 'Save Entry'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                           <Users size={14} className="text-muted" />
                          <span style={{ fontWeight: 600 }}>{p}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <SortDropdown
                  options={[
                    { key: 'admin_first', label: '👑 Admin First' },
                    { key: 'manager_first', label: '👤 Manager First' },
                    { key: 'date_desc', label: '↓ Latest Date' },
                    { key: 'date_asc', label: '↑ Oldest Date' },
                    { key: 'amount_desc', label: '↓ High Amount' },
                    { key: 'amount_asc', label: '↑ Low Amount' },
                  ]}
                  value={settlementSortKey}
                  onChange={v => {
                    setSettlementSortOpen(false);
                    if (v === 'amount_desc') { setSettlementSortRole(''); setSettlementSortAmount('desc'); setSettlementSortDate(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, '', 'desc'); }
                    else if (v === 'amount_asc') { setSettlementSortRole(''); setSettlementSortAmount('asc'); setSettlementSortDate(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, '', 'asc'); }
                    else if (v === 'admin_first') { setSettlementSortRole('admin'); setSettlementSortAmount(''); setSettlementSortDate(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, 'desc', ''); }
                    else if (v === 'manager_first') { setSettlementSortRole('manager'); setSettlementSortAmount(''); setSettlementSortDate(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, 'desc', ''); }
                    else if (v === 'date_asc') { setSettlementSortRole(''); setSettlementSortDate('asc'); setSettlementSortAmount(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, 'asc', ''); }
                    else { setSettlementSortRole(''); setSettlementSortDate('desc'); setSettlementSortAmount(''); loadSettlements(settlementCardDate, settlementViewMode, settlementSearch, 'desc', ''); }
                  }}
                  open={settlementSortOpen}
                  onToggle={() => setSettlementSortOpen(o => !o)}
                />
              </div>
            </div>

            {/* Settlement Breakdown — Popup Modals with Summary Digits */}
            {(() => {
              const totalReceived = settlementData.totalIn || 0;
              const net = totalReceived - (settlementData.totalOut || 0);

              // Separate paid-out and received entries
              const paidOutEntries = (settlementData.settlements || [])
                .filter(s => s.type !== 'other_income');
              const receivedSettlements = (settlementData.settlements || []).filter(s => s.type === 'other_income');

              // Category labels
              const receivedCatLabels = {
                today_invoice: 'Invoice (Sale)',
                due_cleared: 'Due Cleared',
                advance_payment: 'Advance Received',
                others: 'Others',
                not_applicable: 'Others'
              };
              const paidOutTypeLabels = {
                other_expense: 'Expense',
                walkin_delivery: 'Delivery Payment',
                paid_to_supplier: 'Supplier Payment',
                vehicle_expense: 'Vehicle Expense',
                by_invoice: 'Others',
                due_cleared: 'Others',
                advance_received: 'Others',
                received_from_customer: 'Others'
              };
              const modeIcons = {
                'CASH': '💵',
                'UPI': '📱',
                'ONLINE': '🌐',
                'BANK_TRANSFER': '🏦',
                'CHEQUE': '📄',
                'OTHERS': '📋',
                'ADVANCE_CREDIT': '🎫',
                'GOODS_EXCHANGE': '🔄',
                'DISCOUNT': '🏷️'
              };
              const modeDisplayName = {
                'CASH': 'Cash',
                'UPI': 'UPI',
                'ONLINE': 'Online',
                'BANK_TRANSFER': 'Bank Transfer',
                'CHEQUE': 'Cheque',
                'OTHERS': 'Others',
                'ADVANCE_CREDIT': 'Advance Credit',
                'GOODS_EXCHANGE': 'Goods Exchange',
                'DISCOUNT': 'Discount'
              };

              // ── RECEIVED: Group by Manager → Category → Mode (summary totals only) ──
              const groupedReceived = {};
              receivedSettlements.forEach(s => {
                const mgr = s.created_by?.display_name || s.created_by?.username || 'System / Admin';
                if (!groupedReceived[mgr]) groupedReceived[mgr] = { total: 0, byCat: {} };
                groupedReceived[mgr].total += s.amount;
                const cat = s.received_category || 'others';
                const catKey = receivedCatLabels[cat] || 'Others';
                if (!groupedReceived[mgr].byCat[catKey]) groupedReceived[mgr].byCat[catKey] = { total: 0, byMode: {} };
                groupedReceived[mgr].byCat[catKey].total += s.amount;
                const mode = (s.mode || 'cash').toUpperCase();
                if (!groupedReceived[mgr].byCat[catKey].byMode[mode]) groupedReceived[mgr].byCat[catKey].byMode[mode] = 0;
                groupedReceived[mgr].byCat[catKey].byMode[mode] += s.amount;
              });

              // ── PAID OUT: Group by Manager → Type Category → Mode (summary totals only) ──
              const groupedPaidOut = {};
              paidOutEntries.forEach(s => {
                const mgr = s.created_by?.display_name || s.created_by?.username || 'System / Admin';
                if (!groupedPaidOut[mgr]) groupedPaidOut[mgr] = { total: 0, byCat: {} };
                groupedPaidOut[mgr].total += s.amount;
                const catKey = paidOutTypeLabels[s.type] || 'Others';
                if (!groupedPaidOut[mgr].byCat[catKey]) groupedPaidOut[mgr].byCat[catKey] = { total: 0, byMode: {} };
                groupedPaidOut[mgr].byCat[catKey].total += s.amount;
                const mode = (s.mode || 'cash').toUpperCase();
                if (!groupedPaidOut[mgr].byCat[catKey].byMode[mode]) groupedPaidOut[mgr].byCat[catKey].byMode[mode] = 0;
                groupedPaidOut[mgr].byCat[catKey].byMode[mode] += s.amount;
              });

              const receivedGroups = Object.entries(groupedReceived).filter(([_, d]) => d.total > 0).sort((a, b) => b[1].total - a[1].total);
              const paidOutGroups = Object.entries(groupedPaidOut).filter(([_, d]) => d.total > 0).sort((a, b) => b[1].total - a[1].total);

              // Date label for popup header
              const dateLabel = settlementViewMode === 'all'
                ? 'Full History'
                : new Date(settlementCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

              // Shared popup modal styles
              const overlayStyle = {
                position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10001, animation: 'fadeIn 0.2s ease-out', padding: '16px'
              };
              const modalStyle = (accentBg) => ({
                position: 'relative', background: '#fff', borderRadius: 20,
                width: '100%', maxWidth: 580,
                boxShadow: '0 25px 60px -12px rgba(0,0,0,0.3)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: 'calc(100vh - 40px)',
                animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
              });

              // Render a breakdown popup (used for both Received and Paid Out)
              const renderBreakdownPopup = (isReceived, groups, onClose) => {
                const accent = isReceived ? '#16a34a' : '#dc2626';
                const accentLight = isReceived ? '#f0fdf4' : '#fef2f2';
                const accentBorder = isReceived ? '#86efac' : '#fca5a5';
                const accentSuperLight = isReceived ? '#dcfce7' : '#fee2e2';
                const label = isReceived ? 'Received' : 'Paid Out';
                const totalAmt = isReceived ? totalReceived : (settlementData.totalOut || 0);
                const sign = isReceived ? '+' : '−';

                return (
                  <div style={overlayStyle} onClick={onClose}>
                    <div style={{ position: 'absolute', inset: 0 }} />
                    <div style={modalStyle(accentLight)} onClick={e => e.stopPropagation()}>
                      {/* Header */}
                      <div style={{
                        padding: '18px 24px', background: accentLight,
                        borderBottom: `1px solid ${accentBorder}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: accent, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, fontWeight: 700
                          }}>
                            {isReceived ? '↓' : '↑'}
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{label} Breakdown</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{dateLabel}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: accent, fontFamily: 'monospace' }}>{fc(totalAmt)}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>TOTAL</div>
                          </div>
                          <button onClick={onClose} style={{
                            background: '#fff', border: `1px solid ${accentBorder}`,
                            width: 32, height: 32, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#94a3b8', fontSize: 16, fontWeight: 600
                          }}>✕</button>
                        </div>
                      </div>

                      {/* Body — scrollable */}
                      <div style={{
                        padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0,
                        display: 'flex', flexDirection: 'column', gap: 16
                      }}>
                        {groups.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>{isReceived ? '📥' : '📤'}</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>No {label.toLowerCase()} entries for this date</div>
                          </div>
                        ) : groups.map(([managerName, managerData], mIdx) => (
                          <div key={managerName} style={{
                            background: accentSuperLight, borderRadius: 14,
                            border: `1px solid ${accentBorder}`,
                            overflow: 'hidden'
                          }}>
                            {/* Manager header */}
                            <div style={{
                              padding: '12px 16px',
                              background: accentLight,
                              borderBottom: `1px solid ${accentBorder}`,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 30, height: 30, borderRadius: 8,
                                  background: accent, color: '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, fontWeight: 700
                                }}>
                                  {managerName.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>{managerName}</span>
                              </div>
                              <span style={{
                                fontWeight: 800, fontSize: 15, color: accent,
                                fontFamily: 'monospace'
                              }}>{fc(managerData.total)}</span>
                            </div>

                            {/* Categories */}
                            <div style={{ padding: '10px 14px' }}>
                              {Object.entries(managerData.byCat).map(([catName, catData], cIdx) => (
                                <div key={catName} style={{
                                  marginBottom: cIdx < Object.keys(managerData.byCat).length - 1 ? 12 : 0
                                }}>
                                  {/* Category header */}
                                  <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    marginBottom: 6, paddingBottom: 4,
                                    borderBottom: `1px dashed ${accentBorder}`
                                  }}>
                                    <span style={{
                                      fontSize: 11, fontWeight: 700, color: accent,
                                      textTransform: 'uppercase', letterSpacing: '0.5px'
                                    }}>{catName}</span>
                                    <span style={{
                                      fontSize: 12, fontWeight: 700, color: accent,
                                      fontFamily: 'monospace'
                                    }}>{sign}{fc(catData.total)}</span>
                                  </div>

                                  {/* Payment modes — summary digits */}
                                  <div style={{ paddingLeft: 4 }}>
                                    {Object.entries(catData.byMode).map(([mode, amount], modeIdx) => (
                                      <div key={mode} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '5px 8px',
                                        background: modeIdx % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'transparent',
                                        borderRadius: 6, marginBottom: 2
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span style={{ fontSize: 14 }}>{modeIcons[mode] || '💰'}</span>
                                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                                            {modeDisplayName[mode] || mode}
                                          </span>
                                        </div>
                                        <span style={{
                                          fontSize: 13, fontWeight: 700, color: accent,
                                          fontFamily: 'monospace'
                                        }}>{fc(amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
                    {/* Paid Out — clickable, opens popup */}
                    <div
                      style={{
                        background: showPaidOutDetail ? '#dc2626' : '#fef2f2',
                        border: `1.5px solid ${showPaidOutDetail ? '#dc2626' : '#fca5a5'}`,
                        borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        transform: showPaidOutDetail ? 'scale(0.97)' : 'scale(1)'
                      }}
                      onClick={() => { setShowPaidOutDetail(d => !d); setShowReceivedDetail(false); }}
                    >
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: showPaidOutDetail ? 'rgba(255,255,255,0.8)' : 'var(--danger)',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        <span>↑</span> Paid Out
                      </div>
                      <div style={{
                        fontSize: 17, fontWeight: 800,
                        color: showPaidOutDetail ? '#fff' : 'var(--danger)',
                        marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{fc(settlementData.totalOut)}</div>
                    </div>

                    {/* Received — clickable, opens popup */}
                    <div
                      style={{
                        background: showReceivedDetail ? '#16a34a' : '#f0fdf4',
                        border: `1.5px solid ${showReceivedDetail ? '#16a34a' : '#86efac'}`,
                        borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        transform: showReceivedDetail ? 'scale(0.97)' : 'scale(1)'
                      }}
                      onClick={() => { setShowReceivedDetail(d => !d); setShowPaidOutDetail(false); }}
                    >
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: showReceivedDetail ? 'rgba(255,255,255,0.8)' : 'var(--success)',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        <span>↓</span> Received
                      </div>
                      <div style={{
                        fontSize: 17, fontWeight: 800,
                        color: showReceivedDetail ? '#fff' : 'var(--success)',
                        marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{fc(totalReceived)}</div>
                    </div>

                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>Net</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: net >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fc(net)}</div>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entries</div>
                      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{settlementData.settlements.length}</div>
                    </div>
                  </div>

                  {/* Paid Out Popup Modal */}
                  {showPaidOutDetail && renderBreakdownPopup(false, paidOutGroups, () => setShowPaidOutDetail(false))}

                  {/* Received Popup Modal */}
                  {showReceivedDetail && renderBreakdownPopup(true, receivedGroups, () => setShowReceivedDetail(false))}
                </>
              );
            })()}

            {/* Supplier management moved to dedicated Suppliers page — see sidebar */}

            {/* Add Entry Form */}


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
              <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto', display: 'none' }}>
                {/* Full History Table Removed per user request */}
              </div>
            )}
          </div>
        </div>
      )}
      {/* All-time Pending Dues Drill-down — with search + calendar */}
      {showAllDues && (
        <div className="card" style={{ marginBottom: 20 }} ref={duesPanelRef}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>
                <><Clock size={18} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> Pending Dues</>
                <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 11 }}>
                  {data.pendingCustomers?.length || 0}
                </span>
              </div>
              <button className="btn btn-warning btn-sm" style={{ height: 32, padding: '0 12px', display: 'inline-flex', alignItems: 'center', borderRadius: 6 }} onClick={() => setShowWalkinDueForm(w => !w)}>
                {showWalkinDueForm ? '✕' : '+ Walk-in Due'}
              </button>
            </div>
            
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <span className="badge badge-warning" style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontSize: 13, borderRadius: 6 }}>{fc(data.allTimePendingBalance || 0)} total</span>
              
              {/* Date Filter */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-control"
                  value={duesCardDate}
                  max={getTodayIST()}
                  style={{ width: 115, fontSize: 12, padding: '0 8px', height: 32, borderRadius: 6, boxSizing: 'border-box' }}
                  onChange={e => {
                    const d = e.target.value;
                    setDuesCardDate(d);
                    if (d) loadDueDateData(d);
                    else setDueDateInvoices(null);
                  }}
                />
                {duesCardDate && duesCardDate !== getTodayIST() && (
                  <button className="btn btn-outline btn-sm" style={{ height: 32, padding: '0 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center' }} onClick={() => {
                    setDuesCardDate(getTodayIST());
                    loadDueDateData(getTodayIST());
                  }}>Today</button>
                )}
                {duesCardDate && (
                  <button className="btn btn-outline btn-sm" style={{ height: 32, padding: '0 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', fontWeight: 600, color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => {
                    setDuesCardDate('');
                    setDueDateInvoices(null);
                  }}>Show All</button>
                )}
              </div>

            </div>
          </div>
          <div className="card-body">
            {/* Fix 6: Walk-in due form */}
            {showWalkinDueForm && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}><><Plus size={14} style={{ marginRight: 6 }} /> Add Walk-in Due (No Invoice)</></div>
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
                    <label className="form-label">Phone</label>
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
                    {walkinDueSaving ? <><span className="spinner"></span></> : <><Check size={14} style={{ marginRight: 4 }} /> Save Due</>}
                  </button>
                </div>
              </div>
            )}

            {/* Search + Calendar inside dropdown */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Search</div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    placeholder="Customer name, phone, invoice number..."
                    value={duesSearch}
                    onChange={e => setDuesSearch(e.target.value)}
                    style={{ paddingLeft: 32 }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} className="text-muted" />
                  {duesSearch && (
                    <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                      onClick={() => setDuesSearch('')}>✕</button>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
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
                  {duesSearch || duesCardDate ? `No matching dues found.` : 'No pending dues'}
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

              // We no longer need isPaidNow because the backend ONLY returns strictly unpaid dues (balance_due > 0).

              if (!displayDues.length) return (
                <div className="empty-state" style={{ padding: 24 }}>
                  {duesSearch || duesCardDate ? 'No matching dues found.' : 'No pending dues'}
                </div>
              );

              // Group invoices by customer for the daily view to identify multiple bills
              const customerDailyCounts = {};
              displayDues.forEach(d => {
                const key = d.customer_id || d.name;
                if (!customerDailyCounts[key]) customerDailyCounts[key] = [];
                customerDailyCounts[key].push(d);
              });
              // Sort each customer's invoices so we know the order (oldest to newest)
              Object.values(customerDailyCounts).forEach(arr => {
                arr.sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || '', undefined, { numeric: true }));
              });

              return (
                <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {['Invoice', 'Customer', 'Phone', isHistoricalView ? 'Was Due' : 'Balance Due', 'Action'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('Due') ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayDues.map((c, idx) => {
                        const paid = false; // All dues fetched here have balance_due > 0
                        
                        const key = c.customer_id || c.name;
                        const customerInvoices = customerDailyCounts[key] || [];
                        const isMultiple = customerInvoices.length > 1;
                        const billIndex = customerInvoices.findIndex(inv => inv._id === c._id) + 1;

                        return (
                          <tr key={`${c._id}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6', background: paid ? '#f0fdf4' : idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                {c.invoice_number ? (
                                  <Link to={`/invoices/${c.type === 'walkin' ? c._id : c.invoice_id || '#'}`} style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5, textDecoration: 'none' }}>
                                    {c.invoice_number}
                                  </Link>
                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                {c.type === 'walkin'
                                  ? <span className="badge badge-warning" style={{ fontSize: 9, padding: '2px 6px' }}>Walk-in</span>
                                  : <span style={{ fontSize: 9.5, color: 'var(--primary)', fontWeight: 600 }}>Registered</span>}
                              </div>
                              {c.created_by && (
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <User size={10} /> {c.created_by.display_name || c.created_by.username} 
                                  <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>({c.created_by.role?.replace('_', ' ')})</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {c.customer_id ? (
                                  <Link to={`/customers/${c.customer_id}/history`} style={{ fontWeight: 'bold', color: 'var(--text)', textDecoration: 'none' }}>
                                    {c.name}
                                  </Link>
                                ) : (
                                  <strong>{c.name}</strong>
                                )}
                                {isMultiple && (
                                  <span style={{ color: '#d97706', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    (Bill {billIndex}/{customerInvoices.length})
                                  </span>
                                )}
                              </div>
                              {!paid && c.ist_formatted && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                  Since {c.ist_formatted}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {c.phone ? (
                                (!paid && c.balance > 0.01) ? (
                                  <a
                                    href={`https://wa.me/91${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      t(
                                        `Hello ${c.name},\n\nThis is a reminder from *${settings?.business_name || 'our store'}*.\nYour pending due amount is *₹${c.balance && c.balance.toFixed ? c.balance.toFixed(2) : c.balance}*.\n\nPlease clear it at your earliest convenience. 🙏\nThank you!`,
                                        `नमस्ते ${c.name},\n\nयह *${settings?.business_name || 'हमारे स्टोर'}* की ओर से एक रिमाइंडर है।\nआपकी बकाया राशि *₹${c.balance && c.balance.toFixed ? c.balance.toFixed(2) : c.balance}* है।\n\nकृपया जल्द से जल्द भुगतान करें। 🙏\nधन्यवाद!`
                                      )
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
                                    <><MessageSquare size={14} style={{ marginRight: 4, color: '#25d366', display: 'inline-block', verticalAlign: 'middle' }} /> {c.phone}</>
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
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: paid ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                              {fc(c.balance)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {paid ? (
                                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}><span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Paid</span></span>
                              ) : (
                                <button className="btn btn-success btn-sm"
                                  onClick={() => {
                                    let suggestedAmount = c.balance || 0;
                                    let hasMultipleUnpaid = false;
                                    let totalUnpaidBalance = suggestedAmount;
                                    let unpaidInvoices = [];

                                    const targetCustomerId = c.customer_id || c._id;
                                    const trueCustomer = (data.pendingCustomers || []).find(pc => pc._id === targetCustomerId || pc.customer_id === targetCustomerId);
                                    
                                    if (trueCustomer && trueCustomer.unpaid_invoices && trueCustomer.unpaid_invoices.length > 1) {
                                      suggestedAmount = trueCustomer.balance;
                                      hasMultipleUnpaid = true;
                                      totalUnpaidBalance = trueCustomer.balance;
                                      unpaidInvoices = trueCustomer.unpaid_invoices || [];
                                    } else if (typeof isMultiple !== 'undefined' && isMultiple) {
                                      const sum = customerInvoices.reduce((acc, inv) => acc + (inv.balance || 0), 0);
                                      if (sum > suggestedAmount + 0.01) {
                                        suggestedAmount = sum;
                                        hasMultipleUnpaid = true;
                                        totalUnpaidBalance = sum;
                                        unpaidInvoices = customerInvoices.filter(inv => inv.balance > 0.01).map(inv => ({
                                          _id: inv._id || inv.invoice_id,
                                          invoice_number: inv.invoice_number,
                                          balance_due: inv.balance,
                                          date: inv.date,
                                          ist_formatted: inv.ist_formatted,
                                          total: inv.total
                                        }));
                                      }
                                    }

                                    const initialSelectedIds = hasMultipleUnpaid ? unpaidInvoices.map(inv => inv._id) : [(c.invoice_id || c._id)];

                                    setPayModal({
                                      invoice_id: c.invoice_id || (typeof isHistoricalView !== 'undefined' && isHistoricalView ? c._id : (c.type === 'walkin' ? c._id : null)),
                                      customer_id: c.customer_id || (typeof isHistoricalView !== 'undefined' && isHistoricalView ? null : (c.type === 'registered' ? c._id : null)),
                                      name: c.name,
                                      balance: c.balance,
                                      invoice_number: c.invoice_number,
                                      type: c.type,
                                      hasMultipleUnpaid,
                                      totalUnpaidBalance,
                                      unpaidInvoices
                                    });
                                    setPayForm({ amount: suggestedAmount.toFixed(2), mode: 'cash', reference: '', selectedInvoices: initialSelectedIds });
                                  }}
                                ><CreditCard size={14} style={{ marginRight: 4 }} /> Collect</button>
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
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="card-title">
              <><Calendar size={18} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> {todaySalesCardDate === getTodayIST() ? "Today's" : new Date(todaySalesCardDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} Invoices</>
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

            <div className="flex gap-2" style={{ alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
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
                  (inv.customer_phone || '').toLowerCase().includes(q) ||
                  (inv.driver_name || '').toLowerCase().includes(q) ||
                  (inv.vehicle_number || '').toLowerCase().includes(q)
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

              // Auto-suggestions: top 8 matches across invoice fields + suppliers
              const buildSuggestions = (query) => {
                if (!query) return [];
                const seen = new Set();
                const suggestions = [];
                // 1. Search invoice fields
                for (const inv of allInvoices) {
                  if (suggestions.length >= 8) break;
                  const fields = [
                    { type: 'Invoice', value: inv.invoice_number },
                    { type: 'Customer', value: inv.customer_name },
                    { type: 'Phone', value: inv.customer_phone },
                    { type: 'Driver', value: inv.driver_name },
                    { type: 'Vehicle', value: inv.vehicle_number },
                  ];
                  for (const f of fields) {
                    if (f.value && f.value.toLowerCase().includes(query) && !seen.has(f.type + ':' + f.value)) {
                      seen.add(f.type + ':' + f.value);
                      suggestions.push({ label: f.value, type: f.type, inv });
                    }
                  }
                }
                // 2. Search suppliers (name + phone/contact numbers)
                if (suggestions.length < 8 && suppliers && suppliers.length > 0) {
                  for (const sup of suppliers) {
                    if (suggestions.length >= 8) break;
                    const supName = sup.name || '';
                    const supPhone = sup.phone || '';
                    if (supName.toLowerCase().includes(query) && !seen.has('Supplier:' + supName)) {
                      seen.add('Supplier:' + supName);
                      suggestions.push({ label: supName, type: 'Supplier', inv: null, supplierId: sup._id });
                    }
                    if (supPhone && supPhone.includes(query) && !seen.has('Supplier Ph:' + supPhone)) {
                      seen.add('Supplier Ph:' + supPhone);
                      suggestions.push({ label: supPhone, type: 'Supplier Ph', inv: null, supplierId: sup._id, extra: supName });
                    }
                    for (const cn of (sup.contact_numbers || [])) {
                      if (suggestions.length >= 8) break;
                      if (cn.number && cn.number.includes(query) && !seen.has('Supplier Ph:' + cn.number)) {
                        seen.add('Supplier Ph:' + cn.number);
                        suggestions.push({ label: cn.number, type: 'Supplier Ph', inv: null, supplierId: sup._id, extra: supName + (cn.note ? ` (${cn.note})` : '') });
                      }
                    }
                  }
                }
                return suggestions;
              };

              return (
                <>


                  <div style={{ position: 'relative', marginBottom: 16, padding: '0 12px' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.5, marginBottom: 6 }}>SEARCH</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', flex: 1 }}>
                      <Search size={16} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Customer name, phone, invoice number..."
                        value={salesSearch}
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, flex: 1, fontFamily: 'inherit', color: '#334155' }}
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
                      <div style={{ flexShrink: 0 }}>
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
                      </div>
                    </div>

                    {/* Suggestion dropdown */}
                    {salesSearchFocused && salesSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 12, right: 12,
                        background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
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
                                {s.inv ? (s.inv.customer_name !== s.label ? `· ${s.inv.customer_name}` : '') : (s.extra ? `· ${s.extra}` : '')}
                              </span>
                            </div>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                              background: s.type === 'Driver' ? '#dbeafe' : s.type === 'Vehicle' ? '#fef3c7' : s.type === 'Supplier' || s.type === 'Supplier Ph' ? '#f0fdf4' : '#f3f4f6',
                              color: s.type === 'Driver' ? '#1d4ed8' : s.type === 'Vehicle' ? '#b45309' : s.type === 'Supplier' || s.type === 'Supplier Ph' ? '#166534' : 'var(--text-muted)'
                            }}>
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Invoice #</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Customer</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Vehicle</th>
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
                                  {inv.created_by && (
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <User size={10} /> {inv.created_by.display_name || inv.created_by.username} 
                                      <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>({inv.created_by.role?.replace('_', ' ')})</span>
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 500 }}>{highlight(inv.customer_name)}</div>
                                  {inv.customer_phone && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {highlight(inv.customer_phone)}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {(inv.driver_name || inv.vehicle_number) ? (
                                    <>
                                      {inv.driver_name && <div style={{ fontWeight: 500, fontSize: 12.5 }}>{highlight(inv.driver_name)}</div>}
                                      {inv.vehicle_number && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{highlight(inv.vehicle_number)}</div>}
                                    </>
                                  ) : <span style={{ color: '#cbd5e1' }}>—</span>}
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
                                    : <span className="badge badge-success">Paid</span>}
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
              {t("Today's Pending Dues", 'आज का बकाया')}
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
              <div className="empty-state" style={{ padding: 24 }}>No pending dues today</div>
            ) : (
              <div style={{ maxHeight: 350, overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Invoice</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Customer</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Type</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1.5px solid var(--border)' }}>Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                      {data.todayPendingDues.map((c, idx) => (
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
            )}
          </div>
        </div>

        {/* Low Stock — Redesigned, Responsive */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Card Header */}
          <div className="card-header" style={{ flexWrap: 'nowrap', gap: 6, alignItems: 'center', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={14} style={{ color: '#d97706' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="card-title" style={{ margin: 0, lineHeight: 1.2, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('Low Stock Alerts', 'कम स्टॉक')}</div>
                {data.lowStockProducts?.length > 0 && (
                  <div style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: '#b45309', fontSize: 11, fontWeight: 700 }}>
                      {data.lowStockProducts.length} item{data.lowStockProducts.length !== 1 ? 's' : ''} need restock
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0 }}>
              {data.lowStockProducts?.length > 0 && (
                <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11 }} onClick={() => {
                  const threshold = parseInt(settings?.low_stock_threshold) || 10;
                  const source = activeListFilter
                    ? data.lowStockProducts.filter(p => {
                        const lst = productLists.find(l => l._id === activeListFilter);
                        return lst ? lst.products?.some(lp => (lp._id || lp) === p._id) : true;
                      })
                    : data.lowStockProducts;
                  const initialItems = source.map(p => ({
                    ...p,
                    selected: p.saved_order_qty !== -1,
                    orderQty: p.saved_order_qty > 0
                      ? p.saved_order_qty
                      : Math.max(1, ((p.custom_low_stock != null && p.custom_low_stock >= 0 ? p.custom_low_stock : threshold) - p.stock)),
                  }));

                  const customSaved = JSON.parse(localStorage.getItem('mk_custom_low_stock') || '[]');
                  customSaved.forEach(c => {
                    initialItems.push({ _id: `custom-${Date.now()}-${Math.random()}`, name: c.name, stock: 0, unit: c.unit, orderQty: c.orderQty, selected: true });
                  });

                  initialItems.push({ _id: `custom-${Date.now()}`, name: '', stock: 0, unit: 'unit', orderQty: 1, selected: false });
                  setEditableLowStock(initialItems);
                  setShowLowStockEditor(true);
                }}><Edit2 size={12} /> <span style={{ whiteSpace: 'nowrap' }}>Edit & Send</span></button>
              )}
              <Link to="/products" className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>{t('Manage', 'प्रबंधन')}</Link>
            </div>
          </div>

          {/* List filter pills */}
          {productLists.length > 0 && data.lowStockProducts?.length > 0 && (
            <div className="hide-scrollbar" style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', alignItems: 'center' }}>
              <button
                onClick={() => setActiveListFilter(null)}
                style={{ height: 28, flexShrink: 0, padding: '0 14px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', background: activeListFilter === null ? 'var(--primary)' : '#f1f5f9', color: activeListFilter === null ? '#ffffff' : '#64748b' }}
                onMouseEnter={e => { if (activeListFilter !== null) e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { if (activeListFilter !== null) e.currentTarget.style.background = '#f1f5f9'; }}
              >
                All Items
              </button>
              {productLists.map(list => {
                const listProductIds = (list.products || []).map(p => p._id || p);
                const lowInList = data.lowStockProducts.filter(p => listProductIds.includes(p._id)).length;
                if (lowInList === 0) return null;
                const isActive = activeListFilter === list._id;
                return (
                  <button
                    key={list._id}
                    onClick={() => setActiveListFilter(isActive ? null : list._id)}
                    style={{ height: 28, flexShrink: 0, padding: '0 6px 0 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6, background: isActive ? 'var(--primary)' : '#f1f5f9', color: isActive ? '#ffffff' : '#64748b' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e2e8f0'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                  >
                    {list.name}
                    <span style={{ minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'rgba(255,255,255,0.25)' : '#cbd5e1', borderRadius: 9, fontSize: 10, fontWeight: 700, color: isActive ? '#ffffff' : '#475569' }}>{lowInList}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="card-body no-pad">
            {(() => {
              let filteredLowStock = activeListFilter
                ? data.lowStockProducts?.filter(p => {
                    const lst = productLists.find(l => l._id === activeListFilter);
                    return lst ? (lst.products || []).some(lp => (lp._id || lp) === p._id) : true;
                  })
                : (data.lowStockProducts || []);

              if (!activeListFilter) {
                const customSaved = JSON.parse(localStorage.getItem('mk_custom_low_stock') || '[]');
                if (customSaved.length > 0) {
                  filteredLowStock = [
                    ...filteredLowStock,
                    ...customSaved.map((c, i) => ({
                      _id: `custom-grid-${i}`,
                      name: c.name,
                      stock: 0,
                      unit: c.unit,
                      saved_order_qty: c.orderQty,
                      is_custom: true
                    }))
                  ];
                }
              }

              if (!filteredLowStock?.length) return (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ color: '#d1d5db', marginBottom: 8 }}><Package size={36} /></div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                    {activeListFilter ? 'No low stock items in this list' : 'All products adequately stocked'}
                  </div>
                </div>
              );
              return (
                <div style={{ maxHeight: 370, overflowY: 'auto' }}>
                  {filteredLowStock.map((p, idx) => {
                    const toOrder = getOrderQty(p);
                    const isOut = p.stock === 0;
                    return (
                      <div key={p._id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderBottom: idx < filteredLowStock.length - 1 ? '1px solid var(--border)' : 'none',
                        background: idx % 2 === 0 ? 'var(--bg-card, #fff)' : 'var(--bg, #fafafa)',
                        flexWrap: 'wrap', gap: 8,
                        borderLeft: `3px solid ${isOut ? 'var(--danger)' : '#f59e0b'}`,
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, #f0f4ff)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card, #fff)' : 'var(--bg, #fafafa)'}
                      >
                        {/* Product info */}
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.3 }}>{p.name}</div>
                          <span style={{
                            display: 'inline-block', marginTop: 3,
                            fontSize: 11, fontWeight: 600,
                            color: (p.is_custom || p.created_from_order) ? '#d97706' : (isOut ? 'var(--danger)' : 'var(--text-muted)'),
                            whiteSpace: 'nowrap'
                          }}>
                            {p.is_custom ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Package size={11} strokeWidth={2.5} /> New Item</span>
                            ) : p.created_from_order ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Package size={11} strokeWidth={2.5} /> Order from Customer</span>
                            ) : isOut ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><AlertTriangle size={11} strokeWidth={2.5} /> Out of Stock</span>
                            ) : `${p.stock} ${p.unit} left`}
                          </span>
                          {p.last_updated_by && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Edit2 size={9} /> Edited by {p.last_updated_by.display_name || p.last_updated_by.username}
                            </div>
                          )}
                        </div>
                        {/* Quantity display */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', fontSize: 14, background: '#fff', border: '1.5px solid var(--border)', padding: '4px 12px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                            {toOrder}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 22, textAlign: 'left' }}>{p.unit}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Today's Stock Movements */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Package size={18} className="text-primary" /> {t("Today's Stock Movements", 'आज का स्टॉक')}</div>
            <Link to="/stock-movements" className="btn btn-outline btn-sm">{t('All Movements', 'सभी')}</Link>
          </div>
          <div className="card-body no-pad">
            {!data.todayMovements?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No stock movements today</div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 350, overflowY: 'auto' }}>
                <table>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}><tr>
                    <th style={{ width: '45%' }}>Product</th>
                    <th>Type</th>
                    <th className="tr">Qty</th>
                    <th>Reference</th>
                  </tr></thead>
                  <tbody>
                    {data.todayMovements.map(m => (
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
                            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>
                              <><Truck size={14} style={{ marginRight: 4 }} /> {m.vehicle_number}</>
                            </span>
                          ) : m.invoice_id ? (
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
              </div>
            )}
          </div>
        </div>

        {/* Sales last 7 days */}
        <div className="card span-2">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={18} className="text-success" /> {t('Sales — Last 7 Days', 'पिछले 7 दिन')}</div>
            <button className="btn btn-outline btn-sm" onClick={() => setSalesSortDesc(d => !d)}>
              {salesSortDesc ? '↓ Newest First' : '↑ Oldest First'}
            </button>
          </div>
          <div className="card-body no-pad" style={{ maxHeight: 350, overflowY: 'auto' }}>
            {!data.salesByDay?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No sales in last 7 days</div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24, width: '100%' }}>Date</th>
                      <th className="tr" style={{ whiteSpace: 'nowrap' }}>Bills</th>
                      <th className="tr" style={{ paddingRight: 24, whiteSpace: 'nowrap' }}>Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sorted = [...data.salesByDay].sort((a, b) =>
                        salesSortDesc ? b.day.localeCompare(a.day) : a.day.localeCompare(b.day)
                      );
                      return (
                        <>
                          {sorted.map(d => {
                            const isToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
                            const isYesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
                            const isTodayMatch = d.day === isToday;
                            const isYesterdayMatch = d.day === isYesterday;
                            return (
                              <tr key={d.day} style={{ background: isTodayMatch ? '#f0fdf4' : isYesterdayMatch ? '#eff6ff' : '' }}>
                                <td style={{ paddingLeft: 24 }}>
                                  {new Date(d.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                                  {isTodayMatch && <span className="badge badge-success" style={{ marginLeft: 6, fontSize: 10 }}>Today</span>}
                                  {isYesterdayMatch && <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: 10 }}>Yesterday</span>}
                                </td>
                                <td className="tr">{d.count}</td>
                                <td className="tr mono fw-600" style={{ paddingRight: 24 }}>{fc(d.sales)}</td>
                              </tr>
                            );
                          })}
                          {/* Removed Show More button per user request */}
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
          <div className="card-header"><div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={18} className="text-warning" /> {t('Top Selling Products', 'टॉप उत्पाद')}</div></div>
          <div className="card-body no-pad">
            {!data.topProducts?.length ? (
              <div className="empty-state" style={{ padding: 24 }}>No sales data yet</div>
            ) : (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 350, overflowY: 'auto' }}>
                <table style={{ margin: 0 }}>
                  <thead><tr><th>#</th><th>Product</th><th className="tr">Qty Sold</th><th className="tr">Revenue</th></tr></thead>
                  <tbody>
                    {data.topProducts.map((p, i) => (
                      <tr key={i}>
                        <td className="text-muted fw-600">{i + 1}</td>
                        <td><strong>{p.product_name}</strong></td>
                        <td className="tr">{p.total_qty}</td>
                        <td className="tr mono fw-600">{fc(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Edit & Send Modal — Redesigned, Fully Responsive */}
      {showLowStockEditor && (
        <div className="modal-overlay" onClick={() => setShowLowStockEditor(false)} style={{ padding: '12px' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 660,
              height: '80vh', maxHeight: 800, display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3a5c 100%)',
              padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={20} style={{ color: '#fff' }} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Edit Order List</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {editableLowStock.length} item{editableLowStock.length !== 1 ? 's' : ''}
                    </span>
                    <span>Adjust quantities before sending</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowLowStockEditor(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#94a3b8', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >✕</button>
            </div>

            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: '#fff', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder={t('Search items...', 'आइटम खोजें...')} 
                  value={modalSearchQuery}
                  onChange={e => setModalSearchQuery(e.target.value)}
                  style={{ width: '100%', height: 32, paddingLeft: 30, borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <SortDropdown 
                options={[
                  { key: 'all', label: t('All (A-Z)', 'सभी (A-Z)') },
                  { key: 'new', label: t('New Item', 'नया आइटम') },
                  { key: 'order', label: t('Order from Customer', 'ग्राहक द्वारा ऑर्डर') },
                  { key: 'low', label: t('Low Stock', 'कम स्टॉक') }
                ]}
                value={modalSort}
                onChange={val => { setModalSort(modalSort === val ? '' : val); setModalSortOpen(false); }}
                open={modalSortOpen}
                onToggle={() => setModalSortOpen(!modalSortOpen)}
              />
            </div>

            {/* List filters inside modal */}
            {productLists.length > 0 && data.lowStockProducts?.length > 0 && (
            <div className="hide-scrollbar" style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: '#fafbff', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => setActiveListFilter(null)}
                style={{ height: 28, flexShrink: 0, padding: '0 14px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', background: activeListFilter === null ? 'var(--primary)' : '#f1f5f9', color: activeListFilter === null ? '#ffffff' : '#64748b' }}
                onMouseEnter={e => { if (activeListFilter !== null) e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { if (activeListFilter !== null) e.currentTarget.style.background = '#f1f5f9'; }}
              >
                All Items
              </button>
                {productLists.map(list => {
                  const listProductIds = (list.products || []).map(p => p._id || p);
                  const lowInList = data.lowStockProducts.filter(p => listProductIds.includes(p._id)).length;
                  if (lowInList === 0) return null;
                  const isActive = activeListFilter === list._id;
                  return (
                    <button
                      key={list._id}
                      onClick={() => setActiveListFilter(isActive ? null : list._id)}
                      style={{ height: 28, flexShrink: 0, padding: '0 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6, background: isActive ? 'var(--primary)' : '#f1f5f9', color: isActive ? '#ffffff' : '#64748b' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e2e8f0'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                    >
                      {list.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 96px', gap: 12, padding: '8px 16px 6px', background: '#f8fafc', borderBottom: '1.5px solid var(--border)', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                  {/* Header checkbox removed as per request */}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item Name</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', paddingRight: 4 }}>Order Qty</span>
              </div>

              {/* List body — scrollable */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 8px 0' }}>

              {(() => {
                let indices = editableLowStock.map((_, i) => i);
                indices = indices.filter(i => {
                  const p = editableLowStock[i];
                  if (activeListFilter && !p._id?.startsWith('custom-')) {
                    const lst = productLists.find(l => l._id === activeListFilter);
                    const inList = lst ? (lst.products || []).some(lp => (lp._id || lp) === p._id) : true;
                    if (!inList) return false;
                  }
                  if (modalSearchQuery) {
                    const q = modalSearchQuery.toLowerCase();
                    if (!p.name?.toLowerCase().includes(q)) return false;
                  }
                  return true;
                });

                // ALWAYS sort. Groups go to top based on filter, everything else falls back to A-Z
                indices.sort((i, j) => {
                  const a = editableLowStock[i];
                  const b = editableLowStock[j];
                  
                  const aEmpty = a._id?.startsWith('custom-') && (!a.name || a.name.trim() === '');
                  const bEmpty = b._id?.startsWith('custom-') && (!b.name || b.name.trim() === '');
                  if (aEmpty && !bEmpty) return 1;
                  if (!aEmpty && bEmpty) return -1;

                  if (modalSort === 'new') {
                    const aIsCustom = a._id?.startsWith('custom-') && !aEmpty;
                    const bIsCustom = b._id?.startsWith('custom-') && !bEmpty;
                    if (aIsCustom && !bIsCustom) return -1;
                    if (!aIsCustom && bIsCustom) return 1;
                  } else if (modalSort === 'order') {
                    if (a.created_from_order && !b.created_from_order) return -1;
                    if (!a.created_from_order && b.created_from_order) return 1;
                  } else if (modalSort === 'low') {
                    const aIsOOS = a.stock === 0 && !a.created_from_order && !a.is_custom;
                    const bIsOOS = b.stock === 0 && !b.created_from_order && !b.is_custom;
                    const aIsOrder = a.created_from_order;
                    const bIsOrder = b.created_from_order;

                    if (aIsOOS && !bIsOOS) return -1;
                    if (!aIsOOS && bIsOOS) return 1;
                    if (aIsOrder && !bIsOrder) return -1;
                    if (!aIsOrder && bIsOrder) return 1;
                  }

                  // Fallback for everything (and for 'all' / 'az'): Alphabetical Ascending
                  return (a.name || '').localeCompare(b.name || '', 'hi', { numeric: true });
                });

                return indices.map((idx, renderedIndex) => {
                  const p = editableLowStock[idx];
                  return (
                    <div
                      key={p._id || idx}
                      style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 96px', gap: 12, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #f3f4f6', background: renderedIndex % 2 === 0 ? '#fff' : '#fafbff', opacity: p.selected === false ? 0.6 : 1 }}
                    >
                      <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                    <input type="checkbox" checked={p.selected !== false} onChange={e => setEditableLowStock(prev => { const u = [...prev]; u[idx] = { ...u[idx], selected: e.target.checked }; return u; })} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                  </div>
                  {/* Item Info / Autocomplete */}
                  <div style={{ position: 'relative' }}>
                    {p._id?.startsWith('custom-') ? (
                      <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={p.name}
                          onChange={e => {
                            const val = e.target.value;
                            setEditableLowStock(prev => { 
                              const u = [...prev]; 
                              u[idx] = { ...u[idx], name: val }; 
                              if (idx === u.length - 1 && val.trim() !== '') {
                                u[idx].selected = true;
                                u.push({ _id: `custom-${Date.now()}`, name: '', stock: 0, unit: 'unit', orderQty: 1, selected: false });
                              }
                              return u; 
                            });
                          }}
                          placeholder="Item name"
                          style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 13, fontWeight: 600, outline: 'none', background: '#f8fafc', color: 'var(--text)', boxSizing: 'border-box', fontFamily: 'inherit' }}
                          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; setFocusedItemIdx(idx); }}
                          onBlur={e => {
                            e.target.style.borderColor = 'var(--border)';
                            setTimeout(() => setFocusedItemIdx(null), 200);
                          }}
                        />
                      </div>
                        {focusedItemIdx === idx && p.name && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', zIndex: 50, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                            {data.allProducts?.filter(prod => prod.name.toLowerCase().includes(p.name.toLowerCase()) && !editableLowStock.some(ep => ep._id === prod._id)).map(prod => (
                              <div key={prod._id}
                                   onClick={() => {
                                     setEditableLowStock(prev => {
                                        const u = [...prev];
                                        u[idx] = { _id: prod._id, name: prod.name, stock: prod.stock, unit: prod.unit, orderQty: prod.saved_order_qty > 0 ? prod.saved_order_qty : 1 };
                                        if (idx === u.length - 1) {
                                          u[idx].selected = true;
                                          u.push({ _id: `custom-${Date.now()}`, name: '', stock: 0, unit: 'unit', orderQty: 1, selected: false });
                                        }
                                        return u;
                                     });
                                   }}
                                   style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                   onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                   onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                              >
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{prod.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prod.stock} {prod.unit} left</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ paddingLeft: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: (p.is_custom || p.created_from_order) ? '#d97706' : (p.stock === 0 ? 'var(--danger)' : 'var(--text-muted)'), fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>
                          {p.is_custom ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Package size={11} strokeWidth={2.5} /> New Item</span>
                          ) : p.created_from_order ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Package size={11} strokeWidth={2.5} /> {t('Order from Customer', 'ग्राहक द्वारा ऑर्डर')}</span>
                          ) : p.stock === 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><AlertTriangle size={11} strokeWidth={2.5} /> {t('Out of Stock', 'स्टॉक खत्म')}</span>
                          ) : (
                            `${p.stock} ${p.unit} left`
                          )}
                        </div>
                        {p.last_updated_by && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Edit2 size={9} /> Edited by {p.last_updated_by.display_name || p.last_updated_by.username}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: 96, justifySelf: 'end' }}>
                    <button
                      onClick={() => setEditableLowStock(prev => { const u = [...prev]; u[idx] = { ...u[idx], orderQty: Math.max(0, u[idx].orderQty - 1) }; return u; })}
                      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: 'none', cursor: 'pointer', color: '#475569', borderRight: '1px solid var(--border)', transition: 'background 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                    ><Minus size={12} /></button>
                    <input
                      type="number" min="0"
                      value={p.orderQty}
                      onChange={e => setEditableLowStock(prev => { const u = [...prev]; u[idx] = { ...u[idx], orderQty: Math.max(0, parseInt(e.target.value) || 0) }; return u; })}
                      style={{ flex: 1, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 13, background: '#fff', padding: '0 2px', minWidth: 0 }}
                    />
                    <button
                      onClick={() => setEditableLowStock(prev => { const u = [...prev]; u[idx] = { ...u[idx], orderQty: u[idx].orderQty + 1 }; return u; })}
                      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: 'none', cursor: 'pointer', color: '#475569', borderLeft: '1px solid var(--border)', transition: 'background 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                    ><Plus size={12} /></button>
                  </div>
                </div>
                );
              });
              })()}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1.5px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                onClick={() => setShowLowStockEditor(false)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >Cancel</button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Save List */}
                <button
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)' }}
                  onClick={async () => {
                    try {
                      const customToSave = editableLowStock.filter(p => p._id?.startsWith('custom-') && p.name && p.name.trim() !== '' && p.selected !== false).map(p => ({
                        name: p.name.trim(),
                        orderQty: p.orderQty,
                        unit: p.unit || 'unit'
                      }));
                      localStorage.setItem('mk_custom_low_stock', JSON.stringify(customToSave));

                      const updates = editableLowStock.filter(p => p.name && p.name.trim() !== '' && !p._id?.startsWith('custom-')).map(p => ({ _id: p._id, saved_order_qty: p.selected === false ? -1 : p.orderQty }));
                      await productApi.bulkOrderQty(updates);
                      setShowLowStockEditor(false);
                      dashboardApi.get(selectedDate).then(d => {
                        setData(d);
                        setOrderQty({});
                      });
                    } catch (e) { toast.error(e.message || 'Failed to save'); console.error(e); }
                  }}
                ><Save size={13} /> <span>Save</span></button>
                {/* WhatsApp */}
                <button
                  className="btn btn-success btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
                    const validItems = editableLowStock.filter(p => p.selected !== false && p.orderQty > 0 && p.name);
                    const lines = validItems.map(p => `● ${p.name} - ${p.orderQty} ${p.unit || ''}`.trimEnd()).join('\n');
                    const msg = encodeURIComponent(`Demand,\nDated: ${today}\n\n${lines}`);
                    window.open(`https://wa.me/?text=${msg}`, '_blank');
                  }}
                ><Phone size={13} /> <span>WhatsApp</span></button>
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
                {walkinMatch.type === 'customer' ? 'Customer Already Exists' : 'Pending Due Found'}
              </div>
              <button className="modal-close" onClick={() => setShowWalkinMatchModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {walkinMatch.type === 'customer' && (
                <>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{walkinMatch.data.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}><><Phone size={14} style={{ marginRight: 4 }} /> {walkinMatch.data.phone}</></div>
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

      {walkinConfirmModal && (
        <div className="modal-overlay" onClick={() => setWalkinConfirmModal(null)} style={{ zIndex: 99999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
                {walkinConfirmModal.title}
              </div>
              <button className="modal-close" onClick={() => setWalkinConfirmModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 14, lineHeight: '1.5', marginBottom: 20, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                {walkinConfirmModal.message}
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setWalkinConfirmModal(null)}>
                  Cancel
                </button>
                <button className="btn btn-warning" onClick={() => walkinConfirmModal.onConfirm()}>
                  Yes, Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setPayModal(null)} />
          <div className="modal-content" style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, background: '#dcfce3', color: '#16a34a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(22,163,74,0.1)' }}>
                  <Wallet size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Collect Payment</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                    Customer: {payModal.name}
                    {payModal.invoice_number && <span><br />Invoice: {payModal.invoice_number}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => setPayModal(null)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <form id="collectForm" onSubmit={e => { e.preventDefault(); handleRecordPayment(); }}>
                
                {/* SELECT INVOICES TO CLEAR IF NEEDED */}
                {payModal.hasMultipleUnpaid && payModal.unpaidInvoices && payModal.unpaidInvoices.length > 0 ? (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Invoices to Clear:</div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
                      {payModal.unpaidInvoices.map((inv, idx) => {
                        const isSelected = payForm.selectedInvoices && payForm.selectedInvoices.includes(inv._id);
                        return (
                          <div 
                            key={inv._id || idx}
                            onClick={() => {
                              let newSelected = [...(payForm.selectedInvoices || [])];
                              if (isSelected) {
                                newSelected = newSelected.filter(id => id !== inv._id);
                              } else {
                                newSelected.push(inv._id);
                              }
                              
                              const newAmount = payModal.unpaidInvoices
                                .filter(i => newSelected.includes(i._id))
                                .reduce((s, i) => s + (i.balance_due || 0), 0);

                              setPayForm({ ...payForm, selectedInvoices: newSelected, amount: newAmount > 0 ? newAmount.toFixed(2) : '' });
                            }}
                            style={{ 
                              display: 'flex', alignItems: 'center', padding: '12px', borderBottom: idx < payModal.unpaidInvoices.length - 1 ? '1px solid #e2e8f0' : 'none',
                              cursor: 'pointer', background: isSelected ? '#f0fdf4' : '#fff', transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${isSelected ? '#16a34a' : '#cbd5e1'}`, background: isSelected ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, transition: 'all 0.2s' }}>
                              {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}></div>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{inv.invoice_number || 'Walk-in Bill'}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{inv.ist_formatted ? inv.ist_formatted.split(',')[0] : 'Historical'}</div>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>
                              {fc(inv.balance_due)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                     <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Total Due</div>
                     <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: '#dc2626' }}>
                       {fc(payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance)}
                     </div>
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Received ₹ *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#16a34a', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      style={{ width: '100%', padding: '16px 16px 16px 40px', fontSize: 24, fontWeight: 800, border: '2px solid #e2e8f0', borderRadius: 12, outline: 'none', color: '#0f172a', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span>Due: {fc(payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance)}</span>
                     <span style={{ color: '#16a34a', cursor: 'pointer', fontWeight: 700 }} onClick={() => setPayForm({ ...payForm, amount: (payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance).toFixed(2) })}>
                       Full Amount
                     </span>
                  </div>
                  {parseFloat(payForm.amount) > (payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance) && parseFloat(payForm.amount) > 0 && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e3a8a', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ marginTop: 2 }}>ℹ️</div>
                      <div>
                        Extra <strong>{fc(parseFloat(payForm.amount) - (payModal.hasMultipleUnpaid ? payModal.totalUnpaidBalance : payModal.balance))}</strong> will be stored as advance credit for this customer.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {PAYMENT_MODES.map(m => (
                      <div 
                        key={m} 
                        onClick={() => setPayForm({ ...payForm, mode: m })}
                        style={{ 
                          padding: '10px 8px', border: `2px solid ${payForm.mode === m ? '#16a34a' : '#e2e8f0'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontWeight: 600, fontSize: 12, color: payForm.mode === m ? '#16a34a' : '#64748b', background: payForm.mode === m ? '#f0fdf4' : 'white', transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                      >
                        {m.toUpperCase().replace('_', ' ')}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reference / UPI ID <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span></label>
                  <input
                    type="text"
                    value={payForm.reference}
                    onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                    className="form-control"
                    placeholder="Transaction ID or UPI ref"
                    style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 15, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setPayModal(null)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15 }}
                type="button"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="collectForm"
                className="btn btn-primary"
                disabled={paying}
                style={{ flex: 2, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 15, background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {paying ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Wallet size={18} />}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}