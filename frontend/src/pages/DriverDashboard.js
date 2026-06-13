import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { tripApi, notificationApi, invoiceApi } from '../utils/api';
import { Car, Truck, History, Settings, Bell, Wallet, MapPin, RefreshCw, CheckCircle, FileText, Play, LogOut, Plus, Package, ArrowLeft, Landmark, Clock, Calendar, Shield, Info, Map, ChevronRight, Download } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useRegisterRefresh } from '../context/PullToRefreshContext';


const GOODS_TYPES = [
  'Fruits-Vegetables', 'Goods', 'Paint', 'Tile', 'Cement',
  'Hardware Sariya', 'Beverages', 'Booking', 'Others'
];

export default function DriverDashboard() {
  const { t } = useApp();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [view, setView] = useState('home'); // home, short, long, history, settings, active_trip
  const [activeTrip, setActiveTrip] = useState(null);
  const [trips, setTrips] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Trip form
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cargoEntries, setCargoEntries] = useState([{ owner_name: '', owner_phone: '', goods_types: [], description: '', weight: '' }]);
  const [searchQuery, setSearchQuery] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState({});
  const [activeDispatchId, setActiveDispatchId] = useState(null);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState(null);

  // Expense form
  const [expType, setExpType] = useState('fuel');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');

  // Expanded history trip
  const [expandedTrip, setExpandedTrip] = useState(null);

  // Inline Form States (Replacing raw prompt/confirm dialogs)
  const [showNextLegForm, setShowNextLegForm] = useState(false);
  const [nextOrigin, setNextOrigin] = useState('');
  const [nextDest, setNextDest] = useState('');
  const [showEndTripConfirm, setShowEndTripConfirm] = useState(false);
  const [parsedAmountToCollect, setParsedAmountToCollect] = useState(0);

  const handleDownloadPDF = async (trip) => {
    let finalPrice = trip.amount_to_collect ? '₹' + trip.amount_to_collect.toLocaleString('en-IN') : 'N/A';
    let address = '—';
    let invCustomerName = '';
    let invCustomerPhone = '';
    
    if (trip.invoice_id) {
       const invId = trip.invoice_id._id || trip.invoice_id;
       try {
         const res = await invoiceApi.get(invId);
         const invData = res.data || res;
         if (invData) {
           finalPrice = '₹' + (invData.balance_due || invData.total || 0).toLocaleString('en-IN');
           address = invData.customer_address || '—';
           invCustomerName = invData.customer_name || '';
           invCustomerPhone = invData.customer_phone || '';
         }
       } catch (err) {
         console.error("Could not fetch invoice details for PDF", err);
       }
    }

    // Sum amount to collect from cargo if not set at trip level
    const totalCargoAmount = trip.legs?.reduce((sum, leg) => sum + leg.cargo?.reduce((s, c) => s + (parseFloat(c.amount_to_collect) || 0), 0), 0) || 0;
    if (!trip.amount_to_collect && totalCargoAmount > 0) {
      finalPrice = '₹' + totalCargoAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    let rowsHtml = '';
    let lastDispName = null;

    trip.legs?.forEach(leg => {
      leg.cargo?.forEach(c => {
        const items = (c.items && c.items.length > 0) 
            ? c.items 
            : [{ name: c.goods_types?.join(', ') || 'Goods', quantity: '-', weight: c.weight }];
        
        items.forEach((item) => {
          const dispName = invCustomerName || c.owner_name || 'N/A';
          const dispPhone = invCustomerPhone || c.owner_phone || '';
          const showConsignor = dispName !== lastDispName;
          
          rowsHtml += `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                ${showConsignor ? `<strong>${dispName}</strong><br><small>${dispPhone}</small>` : ''}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.weight || c.weight || 0).toFixed(2).replace(/\.00$/, '')} kg</td>
            </tr>
          `;
          lastDispName = dispName;
        });
      });
    });

    const routeFrom = trip.legs?.[0]?.origin || 'Unknown';
    const routeTo = trip.legs?.[trip.legs?.length - 1]?.destination || 'Unknown';
    let totalW = trip.legs?.reduce((sum, leg) => sum + leg.cargo?.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0), 0) || 0;
    totalW = Number(totalW).toFixed(2).replace(/\.00$/, '');
    
    if (address === '—') {
      address = routeTo;
    }

    const htmlContent = `
      <html>
        <head>
          <title>${trip.transport_invoice_number || 'Transport-Invoice'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            h2 { margin: 0; font-size: 26px; font-weight: bold; text-transform: uppercase; }
            .invoice-no { font-size: 18px; color: #1d4ed8; font-weight: bold; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
            th { padding: 10px; border-bottom: 2px solid #d1d5db; text-align: left; background: #f3f4f6; font-weight: bold; }
            .summary { margin-top: 30px; font-size: 15px; display: flex; flex-direction: column; align-items: flex-end; }
            .signatures { margin-top: 80px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sig-line { border-top: 1px solid #000; padding-top: 10px; width: 200px; text-align: center; font-weight: bold; }
            @media print {
              body { padding: 20px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              .header { page-break-inside: avoid; }
              .details { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>MK TRANSPORTATION</h2>
            </div>
            <div style="text-align: right;">
              <div class="invoice-no">${trip.transport_invoice_number || 'Transport-Invoice'}</div>
              <p style="margin: 5px 0 0 0;">Date: ${new Date(trip.started_at || Date.now()).toLocaleDateString('en-IN')}</p>
            </div>
          </div>
          <div class="details">
            <div>
              <p style="margin: 0 0 5px 0;"><strong>Deliver To (Address):</strong> ${address}</p>
              <p style="margin: 0 0 5px 0;"><strong>Route:</strong> ${routeFrom} &rarr; ${routeTo}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0 0 5px 0;"><strong>Vehicle No:</strong> ${(trip.vehicle_number || '').toUpperCase()}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Consignor / Owner</th>
                <th>Item Name</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="summary">
            <p style="margin: 0 0 10px 0;"><strong>Total Weight:</strong> ${totalW} kg</p>
            <p style="margin: 0; font-size: 18px; color: #059669;"><strong>Amount to Collect:</strong> ${finalPrice}</p>
          </div>
          <div class="signatures">
            <div class="sig-line">Driver Signature</div>
            <div class="sig-line">Receiver Signature</div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();
    
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
  };

  const loadActiveTrip = useCallback(async () => {
    try {
      const res = await tripApi.getAll({ status: 'active', limit: 1 });
      if (res.trips && res.trips.length > 0) {
        setActiveTrip(res.trips[0]);
        setView('active_trip');
      } else {
        setActiveTrip(null);
      }
    } catch (_) {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tripApi.getAll({ status: 'completed', limit: 30 });
      setTrips(res.trips || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.getAll({ unread_only: 'true', limit: 10 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (_) {}
  }, []);

  useEffect(() => { 
    loadActiveTrip(); 
    loadNotifications(); 
    
    // Poll for notifications and active trip updates every 5 seconds for real-time feel
    const interval = setInterval(() => {
      loadNotifications();
      loadActiveTrip();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadActiveTrip, loadNotifications]);

  const handleRefresh = useCallback(async () => {
    if (view === 'history') await loadHistory();
    else {
      await loadActiveTrip();
      await loadNotifications();
    }
  }, [view, loadHistory, loadActiveTrip, loadNotifications]);
  useRegisterRefresh(handleRefresh);


  useEffect(() => {
    if (location.state?.dispatchNotif && view === 'home' && !activeTrip) {
      const notif = location.state.dispatchNotif;
      setActiveDispatchId(notif._id);
      setLinkedInvoiceId(notif.entity_id);
      // Extract data from: "Items: aata x1, parle x1. Collect ₹1000 from Mayank. Destination: Mumbai. Total Weight: 0 kg."
      const msg = notif.message || '';
      
      let itemsList = [];
      const itemsMatch = msg.match(/Items: (.*?)\./);
      if (itemsMatch) {
        itemsList = itemsMatch[1].split(', ').map(i => i.trim());
      }
      
      const nameMatch = msg.match(/from ([^.]+)/);
      const destMatch = msg.match(/Destination:\s*(.*?)(?=\s*Total Weight:|$)/);
      const weightMatch = msg.match(/Weight: (\d+)/);
      const amountMatch = msg.match(/Collect ₹(\d+(?:\.\d+)?)/);

      const amountToCol = amountMatch ? parseFloat(amountMatch[1]) : 0;
      setParsedAmountToCollect(amountToCol);

      const meta = notif.metadata || {};
      const phone = meta.customer_phone || '';
      
      let newCargo = [];
      if (notif.type === 'driver_dispatch' && meta.invoices) {
        // Sort alphabetically by customer name (supports Hindi and English)
        const sortedInvoices = [...meta.invoices].sort((a, b) => 
          (a.customer_name || '').localeCompare(b.customer_name || '')
        );

        newCargo = sortedInvoices.map(inv => ({
          invoice_id: inv.invoice_id,
          amount_to_collect: inv.amount_to_collect,
          owner_name: inv.customer_name || '',
          owner_phone: inv.customer_phone || '',
          goods_types: [],
          description: 'Batch Delivery',
          weight: inv.total_weight || 0,
          items: (inv.items || []).map(item => ({
            name: item.goods_type.split(' x')[0],
            quantity: parseInt(item.goods_type.split(' x')[1]) || 1,
            weight: item.weight || 0
          }))
        }));
      } else if (meta.items && meta.items.length > 0) {
        const totalW = meta.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
        newCargo = [{
          invoice_id: notif.entity_id,
          amount_to_collect: amountToCol,
          owner_name: meta.customer_name || nameMatch?.[1]?.trim() || '',
          owner_phone: phone,
          goods_types: [],
          description: '',
          weight: totalW,
          items: meta.items.map(item => ({
            name: item.goods_type.split(' x')[0],
            quantity: parseInt(item.goods_type.split(' x')[1]) || 1,
            weight: item.weight || 0
          }))
        }];
      } else {
        newCargo = [{
          invoice_id: notif.entity_id,
          amount_to_collect: amountToCol,
          owner_name: nameMatch ? nameMatch[1].trim() : '',
          owner_phone: phone,
          goods_types: [],
          description: '',
          weight: weightMatch ? weightMatch[1].trim() : '',
          items: itemsList.map(itemStr => ({
            name: itemStr,
            quantity: 1,
            weight: 0
          }))
        }];
      }

      if (notif.type === 'driver_dispatch' && meta.invoices && meta.invoices.length > 0) {
        // Set destination from the first invoice that has a valid destination
        const invoiceWithDest = meta.invoices.slice().reverse().find(inv => inv.destination && inv.destination.trim() !== '');
        setDestination(invoiceWithDest ? invoiceWithDest.destination : 'Local');
        setOrigin('MK Enterprise Ganai Gangoli');
        // Sum total amount to collect
        const totalAmount = meta.invoices.reduce((sum, inv) => sum + (inv.amount_to_collect || 0), 0);
        setParsedAmountToCollect(totalAmount);
      } else {
        setOrigin('MK Enterprise Ganai Gangoli');
        setDestination(destMatch ? destMatch[1].trim() : (meta.destination || ''));
      }

      setCargoEntries(newCargo);
      
      setView('short'); // Default to short trip when auto-filling
      
      // Clear state to prevent loop
      window.history.replaceState({}, document.title);
    }
  }, [location.state, view, activeTrip]);

  const startTrip = async (type) => {
    if (!origin.trim() || !destination.trim()) return toast.error('Origin and destination are required');
    try {
      const payload = { type, origin, destination, cargo: cargoEntries.filter(c => c.owner_name), amount_to_collect: parsedAmountToCollect };
      if (linkedInvoiceId) payload.invoice_id = linkedInvoiceId;
      
      const res = await tripApi.create(payload);
      toast.success('Trip started! 🚛');
      setActiveTrip(res.trip);
      setView('active_trip');
      setOrigin(''); setDestination('');
      setLinkedInvoiceId(null);
      setParsedAmountToCollect(0);
      setCargoEntries([{ owner_name: '', owner_phone: '', goods_types: [], description: '', weight: '' }]);
      
      // If trip was started from a dispatch notification, mark it as read NOW
      if (activeDispatchId) {
        try {
          await notificationApi.markRead(activeDispatchId);
          setActiveDispatchId(null);
          loadNotifications();
        } catch (e) {}
      }
    } catch (err) { toast.error(err.message); }
  };

  const addExpense = async () => {
    if (!expAmount || parseFloat(expAmount) <= 0) return toast.error('Enter valid amount');
    try {
      const res = await tripApi.addExpense(activeTrip._id, { expense_type: expType, expense_amount: parseFloat(expAmount), expense_note: expNote });
      setActiveTrip(res.trip);
      toast.success(`₹${expAmount} ${expType} logged`);
      setExpAmount(''); setExpNote('');
    } catch (err) { toast.error(err.message); }
  };

  const markReached = async () => {
    try {
      const activeLeg = activeTrip.legs?.find(l => l.status === 'active');
      const res = await tripApi.markReached(activeTrip._id, { location: activeLeg?.destination || '' });
      setActiveTrip(res.trip);
      toast.success('Destination reached! 📍');
    } catch (err) { toast.error(err.message); }
  };

  const markCargoDelivered = async (cargoIndex) => {
    try {
      const res = await tripApi.markCargoDelivered(activeTrip._id, cargoIndex);
      setActiveTrip(res.trip);
      toast.success('Cargo marked as delivered! ✅');
    } catch (err) { toast.error(err.message); }
  };

  const endTrip = async () => {
    try {
      const res = await tripApi.endTrip(activeTrip._id);
      setActiveTrip(null);
      setView('home');
      setShowEndTripConfirm(false);
      toast.success('Trip completed! ✅');
    } catch (err) { toast.error(err.message); }
  };

  // Styles
  const cardBtn = (bg, icon, label, subLabel1, subLabel2, glowColor, hoverFill) => (
    <button
      onClick={() => {
        if (label === 'Short Trip') { setView('short'); setDestination(''); }
        else if (label === 'Long Trip') { setView('long'); setOrigin(''); setDestination('Haldwani'); }
        else if (label === 'History') { setView('history'); loadHistory(); }
        else if (label === 'Settings') setView('settings');
      }}
      className="feature-card"
      style={{
        background: bg,
        '--glow-color': glowColor,
        '--hover-fill': hoverFill,
      }}
    >
      {/* Top Icon Circle */}
      <div className="feature-card-icon">
        {icon}
      </div>

      {/* Title & Meta Details */}
      <div style={{ marginTop: 'auto', zIndex: 2, pointerEvents: 'none', width: '100%' }}>
        <h3 className="feature-card-title">
          {label}
        </h3>
        <div className="feature-card-meta" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.18)', paddingTop: '10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><MapPin size={11} style={{ marginRight: '4px' }} /> {subLabel1}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Clock size={11} style={{ marginRight: '4px' }} /> {subLabel2}</span>
        </div>
      </div>
    </button>
  );

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', outline: 'none' };
  const btnPrimary = { background: 'var(--sidebar-bg)', border: 'none', color: '#ffffff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const btnDanger = { background: '#dc2626', border: 'none', color: '#ffffff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const btnOutline = { background: 'var(--bg)', border: '1.5px solid #e5e7eb', color: '#374151', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

  // ── TRIP FORM (shared for short/long) ──
  const renderTripForm = (type) => (
    <div className="row g-4 mt-1 text-start">
      {/* LEFT COLUMN - Trip Details */}
      <div className="col-md-7 col-lg-8">
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-outline btn-sm py-1 px-2 fw-bold d-inline-flex align-items-center gap-1" onClick={() => setView('home')}><ArrowLeft size={14} /> Back</button>
              <h4 className="mb-0 fw-bold text-dark" style={{ fontSize: '18px' }}>{type === 'short' ? <span className="d-flex align-items-center gap-2"><Car size={18} className="text-primary" /> New Short Trip</span> : <span className="d-flex align-items-center gap-2"><Truck size={18} className="text-primary" /> New Long Trip</span>}</h4>
            </div>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-sm-6">
                <label className="form-label text-secondary fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>Origin</label>
                <input className="form-control" placeholder="e.g. Pune" value={origin} onChange={e => setOrigin(e.target.value)} />
              </div>
              <div className="col-sm-6">
                <label className="form-label text-secondary fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>Destination</label>
                <input className="form-control" placeholder="e.g. Mumbai" value={destination} onChange={e => setDestination(e.target.value)} />
              </div>
            </div>

            <hr className="my-4" />

            <h5 className="mb-3 fw-bold text-dark d-flex align-items-center gap-2"><Package size={18} className="text-secondary" /> Cargo Consignment Owners</h5>
            {cargoEntries.map((c, i) => (
              <div key={i} className="bg-light rounded p-3 mb-3 border">
                <div className="row g-3 mb-3">
                  <div className="col-sm-6">
                    <label className="form-label text-secondary fw-bold" style={{ fontSize: '10px' }}>Owner Name (Consignor)</label>
                    <input className="form-control" placeholder={t('Name', 'नाम')} value={c.owner_name} onChange={e => { const n = [...cargoEntries]; n[i].owner_name = e.target.value; setCargoEntries(n); }} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary fw-bold" style={{ fontSize: '10px' }}>Owner Phone</label>
                    <input className="form-control" placeholder="Phone Number" value={c.owner_phone} onChange={e=> { const n = [...cargoEntries]; n[i].owner_phone = e.target.value; setCargoEntries(n); }} />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label text-secondary fw-bold mb-2 text-start d-block" style={{ fontSize: '11px' }}>Itemized Cargo (LR Table)</label>
                  <table className="table table-bordered table-sm mb-2" style={{ fontSize: '13px' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Particulars (Item)</th>
                        <th width="80">{t('Qty', 'मात्रा')}</th>
                        <th width="100">Weight (kg)</th>
                        <th width="40"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(c.items || []).map((item, itemIdx) => (
                        <tr key={itemIdx}>
                          <td className="p-0"><input className="form-control form-control-sm border-0" placeholder="e.g. Wheat" value={item.name} onChange={e => { const n = [...cargoEntries]; n[i].items[itemIdx].name = e.target.value; setCargoEntries(n); }} /></td>
                          <td className="p-0"><input type="number" className="form-control form-control-sm border-0" placeholder="0" value={item.quantity} onChange={e => { const n = [...cargoEntries]; n[i].items[itemIdx].quantity = e.target.value; setCargoEntries(n); }} /></td>
                          <td className="p-0"><input type="number" className="form-control form-control-sm border-0" placeholder="0" value={item.weight} onChange={e => { const n = [...cargoEntries]; n[i].items[itemIdx].weight = e.target.value; n[i].weight = n[i].items.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0); setCargoEntries(n); }} /></td>
                          <td className="p-0 text-center align-middle">
                            <button type="button" className="btn btn-link text-danger p-0" onClick={() => { const n = [...cargoEntries]; n[i].items = n[i].items.filter((_, idx) => idx !== itemIdx); n[i].weight = n[i].items.reduce((s, it) => s + (parseFloat(it.weight) || 0), 0); setCargoEntries(n); }}>×</button>
                          </td>
                        </tr>
                      ))}
                      {(c.items || []).length === 0 && (
                        <tr><td colSpan="4" className="text-center text-muted" style={{ fontSize: '12px', fontStyle: 'italic', padding: '8px' }}>No items added</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" className="text-end fw-bold align-middle" style={{ fontSize: '12px' }}>Total Weight:</td>
                        <td colSpan="2" className="fw-bold align-middle bg-light p-0">
                          <input type="number" className="form-control form-control-sm border-0 bg-transparent fw-bold text-dark px-2" placeholder="0" value={c.weight} onChange={e => { const n = [...cargoEntries]; n[i].weight = e.target.value; setCargoEntries(n); }} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <button type="button" className="btn btn-sm btn-outline-secondary py-1" style={{ fontSize: '11px' }} onClick={() => { const n = [...cargoEntries]; if (!n[i].items) n[i].items = []; n[i].items.push({ name: '', quantity: 1, weight: 0 }); setCargoEntries(n); }}>+ Add Item Row</button>
                </div>
              </div>
            ))}
             <button
              type="button"
              onClick={() => setCargoEntries([...cargoEntries, { owner_name: '', owner_phone: '', goods_types: [], items: [{ name: '', quantity: 1, weight: 0 }], description: '', weight: '' }])}
              className="add-row-btn mb-3 d-inline-flex align-items-center justify-content-center gap-1"
            >
              <Plus size={14} /> Add Another Consignment Owner
            </button>
            <button
              type="button"
              onClick={() => startTrip(type)}
              className="action-glow-btn action-glow-btn-success d-inline-flex align-items-center justify-content-center gap-2"
            >
              <Play size={14} /> Start Trip
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Quick Trip Guidelines Sidebar */}
      <div className="col-md-5 col-lg-4 text-start">
        <h4 className="text-secondary fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '16px' }}><Info size={16} className="text-secondary" /> Trip Guidelines</h4>
        <ul className="list-group mb-3 shadow-sm">
          <li className="list-group-item py-3">
            <h6 className="fw-bold my-0 text-dark d-flex align-items-center gap-2"><Car size={16} className="text-primary" /> Short Trip</h6>
            <small className="text-muted">Designed for local dispatches. Allows continuous tracking and quick expense logging.</small>
          </li>
          <li className="list-group-item py-3">
            <h6 className="fw-bold my-0 text-dark d-flex align-items-center gap-2"><Truck size={16} className="text-primary" /> Long Trip</h6>
            <small className="text-muted">Designed for interstate operations. Supports multi-leg dispatches and detailed highway expense items.</small>
          </li>
          <li className="list-group-item bg-light text-center py-3">
            <span className="text-muted" style={{ fontSize: '12px' }}>Make sure to fill consignment owner info before starting the trip.</span>
          </li>
        </ul>
      </div>
    </div>
  );

  // ── ACTIVE TRIP VIEW ──
  const renderActiveTrip = () => {
    if (!activeTrip) return null;
    const activeLeg = activeTrip.legs?.find(l => l.status === 'active');
    const allCompleted = activeTrip.legs?.every(l => l.status === 'completed');

    return (
      <div className="row g-4 mt-1 text-start">
        {/* LEFT COLUMN - Active Logger Form */}
        <div className="col-md-7 col-lg-8">
          <div className="card shadow-sm mb-4 border-success">
            <div className="card-header bg-success text-white py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="badge bg-white text-success fw-bold text-uppercase" style={{ fontSize: '10px' }}>Active {activeTrip.type} Trip</span>
                  <h4 className="mb-0 fw-bold mt-1 text-white">
                    {activeLeg ? `${activeLeg.origin} → ${activeLeg.destination}` : 'All Legs Completed'}
                  </h4>
                </div>
                <Truck size={28} className="text-white" />
              </div>
            </div>
            <div className="card-body">
              {/* Cargo List Display (Transport Invoice Format) */}
              {activeLeg?.cargo?.length > 0 && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                      <Package size={18} className="text-secondary" /> Active Cargo Loaded (Bilty)
                    </h5>
                    <button 
                      onClick={() => handleDownloadPDF(activeTrip)}
                      className="btn btn-sm btn-outline-primary fw-bold d-flex align-items-center gap-1"
                    >
                      <Download size={14} /> Download PDF
                    </button>
                  </div>
                  <div className="mb-4">
                    {activeLeg.cargo.map((c, idx) => (
                      <div key={idx} className="bg-light rounded p-3 mb-3 border shadow-sm">
                        <div className="mb-2 pb-2 border-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Consignor / Owner</span>
                            <div className="fw-bold text-dark mt-1" style={{ fontSize: '15px' }}>
                              {c.owner_name} {c.owner_phone && <span className="text-muted fw-normal" style={{fontSize: '13px'}}>({c.owner_phone})</span>}
                            </div>
                          </div>
                          {c.status === 'delivered' ? (
                            <span className="badge bg-success" style={{ fontSize: '11px', padding: '6px 10px' }}><CheckCircle size={12} className="me-1" /> Delivered</span>
                          ) : (
                            <button 
                              className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1"
                              onClick={() => markCargoDelivered(idx)}
                              style={{ fontSize: '11px' }}
                            >
                              <CheckCircle size={14} /> Mark Delivered
                            </button>
                          )}
                        </div>
                        
                        <table className="table table-sm table-borderless mt-2 mb-0" style={{ fontSize: '13px' }}>
                          <thead className="table-light border-bottom">
                            <tr>
                              <th className="fw-bold text-secondary">Particulars</th>
                              <th className="fw-bold text-secondary text-center" width="80">{t('Qty', 'मात्रा')}</th>
                              <th className="fw-bold text-secondary text-end" width="100">Weight (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.items && c.items.length > 0 ? (
                              c.items.map((item, itemIdx) => (
                                <tr key={itemIdx} className="border-bottom border-light">
                                  <td className="align-middle fw-medium text-dark py-2">{item.name}</td>
                                  <td className="align-middle text-center py-2">{item.quantity}</td>
                                  <td className="align-middle text-end py-2">{item.weight} kg</td>
                                </tr>
                              ))
                            ) : (
                              (c.goods_types || []).map((g, gi) => (
                                <tr key={gi} className="border-bottom border-light">
                                  <td className="align-middle fw-medium text-dark py-2">{g}</td>
                                  <td className="align-middle text-center py-2">-</td>
                                  <td className="align-middle text-end py-2">-</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="2" className="text-end fw-bold pt-3" style={{ fontSize: '13px', color: '#1e40af' }}>Total Weight:</td>
                              <td className="text-end fw-bold pt-3" style={{ fontSize: '14px', color: '#1e40af' }}>{c.weight || 0} kg</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}
                  </div>
                  <hr className="my-4" />
                </>
              )}

              {/* Expense Logging Form */}
              <h5 className="mb-3 fw-bold text-dark d-flex align-items-center gap-2"><Wallet size={18} className="text-success" /> Log Highway Expense</h5>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {['fuel', 'toll', 'challan', 'service', 'food', 'other'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setExpType(t)}
                    className={`tag-button ${expType === t ? 'active' : ''}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div className="row g-3 mb-3">
                <div className="col-sm-4">
                  <label className="form-label text-secondary fw-bold" style={{ fontSize: '11px' }}>Amount ₹</label>
                  <input className="form-control" type="number" placeholder="₹ Amount" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
                </div>
                <div className="col-sm-8">
                  <label className="form-label text-secondary fw-bold" style={{ fontSize: '11px' }}>Note / Remarks</label>
                  <input className="form-control" placeholder="e.g. Fuel purchase at HP pump" value={expNote} onChange={e => setExpNote(e.target.value)} />
                </div>
              </div>

              <button
                type="button"
                onClick={addExpense}
                className="action-glow-btn action-glow-btn-success mb-4 d-inline-flex align-items-center justify-content-center"
              >
                <Plus size={14} className="me-2" /> Add Expense Log
              </button>

              <hr className="my-4" />

              {/* Action Buttons */}
              <div className="row g-2">
                {activeLeg && (
                  <div className="col-sm-6">
                    <button
                      type="button"
                      onClick={markReached}
                      className="action-glow-btn action-glow-btn-warning d-inline-flex align-items-center justify-content-center"
                    >
                      <MapPin size={14} className="me-2" /> Reached Destination
                    </button>
                  </div>
                )}
                {allCompleted && !showNextLegForm && (
                  <div className="col-sm-6">
                    <button
                      type="button"
                      onClick={() => {
                        setNextOrigin(activeLeg?.destination || '');
                        setNextDest(activeTrip.type === 'long' ? 'Ganai' : '');
                        setShowNextLegForm(true);
                      }}
                      className="action-glow-btn action-glow-btn-primary d-inline-flex align-items-center justify-content-center"
                    >
                      <RefreshCw size={14} className="me-2" /> Start Next Leg
                    </button>
                  </div>
                )}
                {!showEndTripConfirm && (
                  <div className="col-sm-6">
                    <button
                      type="button"
                      onClick={() => setShowEndTripConfirm(true)}
                      className="action-glow-btn action-glow-btn-danger d-inline-flex align-items-center justify-content-center"
                    >
                      <CheckCircle size={14} className="me-2" /> End & Complete Trip
                    </button>
                  </div>
                )}
              </div>

              {/* Next Leg Form */}
              {showNextLegForm && (
                <div className="card border-primary bg-light p-3 mt-4">
                  <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-2"><RefreshCw size={14} /> Next Trip Leg Details</h6>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" style={{ fontSize: '11px' }}>From Origin</label>
                      <input className="form-control form-control-sm" placeholder="Origin" value={nextOrigin} onChange={e => setNextOrigin(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label" style={{ fontSize: '11px' }}>To Destination</label>
                      <input className="form-control form-control-sm" placeholder="Destination" value={nextDest} onChange={e => setNextDest(e.target.value)} />
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="button" onClick={() => {
                      if (!nextOrigin.trim() || !nextDest.trim()) return toast.error('Next Origin and Destination are required');
                      tripApi.addNextLeg(activeTrip._id, { origin: nextOrigin, destination: nextDest, cargo: [] })
                        .then(res => {
                          setActiveTrip(res.trip);
                          setShowNextLegForm(false);
                          setNextOrigin('');
                          setNextDest('');
                          toast.success('Next leg started! 🚛');
                        })
                        .catch(err => toast.error(err.message));
                    }} className="btn btn-primary btn-sm px-3 fw-bold">Start Leg</button>
                    <button type="button" onClick={() => setShowNextLegForm(false)} className="btn btn-outline btn-sm px-3 fw-bold">{t('Cancel', 'रद्द करें')}</button>
                  </div>
                </div>
              )}
              {showEndTripConfirm && (
                <div className="card border-danger bg-light p-3 mt-4">
                  <h6 className="fw-bold text-danger mb-1 d-flex align-items-center gap-2"><CheckCircle size={14} /> Confirm Ending Trip?</h6>
                  <p className="text-muted mb-3" style={{ fontSize: '12px' }}>This will close the active log and submit all details to management permanently.</p>
                  <div className="d-flex gap-2">
                    <button type="button" onClick={endTrip} className="btn btn-danger btn-sm px-3 fw-bold">Yes, End Trip</button>
                    <button type="button" onClick={() => setShowEndTripConfirm(false)} className="btn btn-outline btn-sm px-3 fw-bold">{t('Cancel', 'रद्द करें')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Active Trip Summary Sidebar */}
        <div className="col-md-5 col-lg-4">
          <h4 className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-primary fw-bold d-flex align-items-center gap-2" style={{ fontSize: '18px' }}><Landmark size={18} className="text-primary" /> Trip Status</span>
          </h4>

          <ul className="list-group mb-4 shadow-sm">
            <li className="list-group-item d-flex justify-content-between lh-sm py-3">
              <div>
                <h6 className="my-0 fw-bold text-dark">Total Expenses</h6>
                <small className="text-muted">Sum of all logged highway items</small>
              </div>
              <strong className="text-danger font-monospace h5 mb-0">₹{(activeTrip.total_expenses || 0).toLocaleString('en-IN')}</strong>
            </li>
            <li className="list-group-item d-flex justify-content-between lh-sm py-3">
              <div>
                <h6 className="my-0">Vehicle</h6>
                <small className="text-muted">Registered registration no.</small>
              </div>
              <span className="font-monospace fw-bold">{(activeTrip.vehicle_number || user?.username || '—').toUpperCase()}</span>
            </li>
          </ul>

          <h5 className="fw-bold text-secondary mb-3 d-flex align-items-center gap-2" style={{ fontSize: '14px', letterSpacing: '0.5px' }}><Clock size={15} /> Live Trip Timeline</h5>
          <div className="list-group shadow-sm" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {(activeTrip.timeline || []).map((t, i) => {
              const renderTimelineIcon = (type) => {
                switch(type) {
                  case 'trip_start': return <Play size={18} className="text-success" />;
                  case 'expense': return <Wallet size={18} className="text-danger" />;
                  case 'reached_destination': return <MapPin size={18} className="text-warning" />;
                  case 'returning': return <RefreshCw size={18} className="text-primary" />;
                  case 'trip_end': return <CheckCircle size={18} className="text-success" />;
                  default: return <FileText size={18} className="text-secondary" />;
                }
              };
              return (
                <div key={i} className="list-group-item list-group-item-action d-flex gap-3 py-3 align-items-center">
                  <div style={{ background: 'var(--bg)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                    {renderTimelineIcon(t.type)}
                  </div>
                  <div className="d-flex gap-2 w-100 justify-content-between">
                    <div>
                      <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '13px' }}>
                        {t.type === 'expense' ? `${t.expense_type.toUpperCase()}: ₹${t.expense_amount}` : t.note || t.type}
                      </h6>
                      {t.expense_note && <p className="mb-0 text-muted" style={{ fontSize: '12px' }}>{t.expense_note}</p>}
                      <small className="text-muted" style={{ fontSize: '11px' }}>{new Date(t.timestamp || t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── HISTORY VIEW ──
  const renderHistory = () => {
    const groupTripsByDate = () => {
      const groups = {};
      trips.forEach(trip => {
        const dateStr = new Date(trip.started_at).toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        groups[dateStr].push(trip);
      });
      return groups;
    };

    return (
      <div>
        <button onClick={() => setView('home')} className="action-glow-btn action-glow-btn-success mb-4 text-start d-inline-flex align-items-center justify-content-center gap-1" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}><ArrowLeft size={14} /> Back to Home</button>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: '#059669', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><History size={20} /> Completed Trip History</h2>
        {loading ? <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading...</div> :
        trips.length === 0 ? <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>No completed trips yet.</div> :
        Object.entries(groupTripsByDate()).map(([dateLabel, dateTrips]) => (
          <div key={dateLabel} className="mb-4 text-start">
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px', paddingLeft: '8px', borderLeft: '3px solid #059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={12} /> {dateLabel}
            </div>
            {dateTrips.map(trip => (
              <div key={trip._id} className="premium-white-card premium-white-card-clickable mb-3" style={{ borderLeft: '4px solid #10b981' }}
                onClick={() => setExpandedTrip(expandedTrip === trip._id ? null : trip._id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {trip.type === 'short' ? <Car size={16} className="text-secondary" /> : <Truck size={16} className="text-secondary" />}
                      <span>{trip.legs?.[0]?.origin} → {trip.legs?.[trip.legs.length - 1]?.destination}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, textAlign: 'left' }}>
                      Started: {new Date(trip.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — Ended: {trip.completed_at ? new Date(trip.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                    </div>
                    <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2, textAlign: 'left', fontWeight: 'bold' }}>
                      Vehicle: {(trip.vehicle_number || '—').toUpperCase()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>₹{(trip.total_expenses || 0).toLocaleString('en-IN')}</div>
                    {expandedTrip === trip._id && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownloadPDF(trip); }}
                        className="btn btn-sm btn-outline-primary mt-2"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        <Download size={12} className="me-1" /> PDF
                      </button>
                    )}
                  </div>
                </div>
                {expandedTrip === trip._id && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                    {(trip.timeline || []).map((t, i) => {
                      const renderHistoryIcon = (type) => {
                        switch(type) {
                          case 'trip_start': return <Play size={12} className="text-success align-middle d-inline-block" />;
                          case 'expense': return <Wallet size={12} className="text-danger align-middle d-inline-block" />;
                          case 'reached_destination': return <MapPin size={12} className="text-warning align-middle d-inline-block" />;
                          case 'returning': return <RefreshCw size={12} className="text-primary align-middle d-inline-block" />;
                          case 'trip_end': return <CheckCircle size={12} className="text-success align-middle d-inline-block" />;
                          default: return <FileText size={12} className="text-secondary align-middle d-inline-block" />;
                        }
                      };
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12 }}>
                          {renderHistoryIcon(t.type)}
                          <span style={{ fontWeight: 600 }}>{t.type === 'expense' ? `${t.expense_type}: ₹${t.expense_amount}` : t.note || t.type}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const containerWidth = (view === 'home' && !activeTrip) ? 500 : 1000;

  const refreshDriver = useCallback(() => {
    return Promise.all([loadActiveTrip(), loadNotifications()]);
  }, [loadActiveTrip, loadNotifications]);
  useRegisterRefresh(refreshDriver);

  return (
    <div style={{ maxWidth: containerWidth, margin: '0 auto' }}>
      {/* Logout Confirmation Modal (Premium Design) */}
      {showLogoutConfirm && (
        <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(15, 23, 42, 0.60)', backdropFilter: 'blur(6px)' }}>
          <div className="modal premium-confirm-modal">
            <div className="premium-icon-container" style={{ color: '#ef4444' }}>
              <LogOut size={32} strokeWidth={2.5} />
            </div>
            
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, color: 'var(--sidebar-bg)', letterSpacing: '-0.5px' }}>
              Confirm Logout
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 0, lineHeight: 1.6, padding: '0 10px' }}>
              Are you sure you want to sign out? You'll need to login again to access your dashboard.
            </p>
            
            <div className="premium-btn-group">
              <button onClick={() => logout()} className="btn-premium-danger">
                Yes, Log Me Out
              </button>
              <button onClick={() => setShowLogoutConfirm(false)} className="btn-premium-secondary">
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Live Dispatched Invoice Data Banners */}
      {view === 'home' && !activeTrip && notifications.filter(n => n.type === 'driver_dispatch' && !n.is_read).map(dispatchNotif => (
        <div key={dispatchNotif._id} style={{ 
          background: 'var(--sidebar-bg)', 
          border: '1.5px solid #bfdbfe', 
          borderRadius: 14, 
          padding: '16px', 
          marginBottom: 18, 
          textAlign: 'left',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(37,99,235,0.1)', filter: 'blur(20px)' }} />
          
          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
            <div style={{ background: '#3b82f6', color: '#ffffff', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={16} className="animate-bounce" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  NEW DISPATCH RECEIVED {dispatchNotif.sender_name && dispatchNotif.sender_name !== 'System' ? `(Assigned by ${dispatchNotif.sender_name})` : ''}
                </span>
                <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>{new Date(dispatchNotif.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <h5 style={{ fontSize: 14.5, fontWeight: 700, color: '#1e3a8a', margin: '4px 0 2px' }}>
                {dispatchNotif.title}
              </h5>
              <p style={{ fontSize: 12.5, color: '#1e40af', marginBottom: 12, lineHeight: 1.4 }}>
                {dispatchNotif.message}
              </p>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={async () => {
                    // Extract info from message for prefilling
                    const msg = dispatchNotif.message || '';
                    let customerName = '';
                    if (msg.includes('Collect ₹')) {
                      const afterFrom = msg.split(' from ')[1];
                      if (afterFrom) customerName = afterFrom.split('.')[0];
                    }
                    
                    const meta = dispatchNotif.metadata || {};
                    const phone = meta.customer_phone || '';
                    let dest = meta.destination || (msg.match(/Destination:\s*(.*?)(?=\s*Total Weight:|$)/) ? msg.match(/Destination:\s*(.*?)(?=\s*Total Weight:|$)/)[1].trim() : '');
                    if (dispatchNotif.type === 'driver_dispatch' && meta.invoices && meta.invoices.length > 0) {
                      const invoiceWithDest = meta.invoices.slice().reverse().find(inv => inv.destination && inv.destination.trim() !== '');
                      dest = invoiceWithDest ? invoiceWithDest.destination : (dest || 'Local');
                    }
                    const cName = meta.customer_name || customerName || 'Dispatched Customer';

                    let newCargo = [];
                    if (dispatchNotif.type === 'driver_dispatch' && meta.invoices) {
                      const sortedInvoices = [...meta.invoices].sort((a, b) => 
                        (a.customer_name || '').localeCompare(b.customer_name || '')
                      );
                      newCargo = sortedInvoices.map(inv => ({
                        invoice_id: inv.invoice_id,
                        amount_to_collect: inv.amount_to_collect,
                        owner_name: inv.customer_name || '',
                        owner_phone: inv.customer_phone || '',
                        goods_types: [],
                        description: 'Batch Delivery',
                        weight: inv.total_weight || 0,
                        items: (inv.items || []).map(item => ({
                          name: item.goods_type.split(' x')[0],
                          quantity: parseInt(item.goods_type.split(' x')[1]) || 1,
                          weight: item.weight || 0
                        }))
                      }));
                    } else if (meta.items && meta.items.length > 0) {
                      const totalW = meta.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
                      newCargo = [{
                        owner_name: cName,
                        owner_phone: phone,
                        goods_types: [], // Legacy array, keeping empty
                        description: 'Auto-filled from dispatch',
                        weight: totalW,
                        items: meta.items.map(item => ({
                          name: item.goods_type.split(' x')[0],
                          quantity: parseInt(item.goods_type.split(' x')[1]) || 1,
                          weight: item.weight || 0
                        }))
                      }];
                    } else {
                      let itemsList = [];
                      const itemsMatch = msg.match(/Items: (.*?)\./);
                      if (itemsMatch) {
                        itemsList = itemsMatch[1].split(', ').map(i => i.trim());
                      }
                      const totalWeight = meta.total_weight || '';
                      
                      newCargo = [{
                        owner_name: cName, 
                        owner_phone: phone, 
                        goods_types: [], 
                        description: 'Auto-filled from dispatch',
                        weight: totalWeight,
                        items: itemsList.map(itemStr => ({
                          name: itemStr,
                          quantity: 1,
                          weight: 0
                        }))
                      }];
                    }
                    
                    setOrigin('MK Enterprise Ganai Gangoli');
                    setDestination(dest);
                    setCargoEntries(newCargo);
                    setActiveDispatchId(dispatchNotif._id);
                    setLinkedInvoiceId(dispatchNotif.entity_id);
                    
                    const amountMatch = msg.match(/Collect ₹(\d+(?:\.\d+)?)/);
                    const amountToCol = amountMatch ? parseFloat(amountMatch[1]) : 0;
                    setParsedAmountToCollect(amountToCol);
                    
                    setView('short');
                    
                    toast.success("Loaded dispatch data! Ready to start trip.");
                  }}
                  style={{
                    background: '#1d4ed8',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: '0 2px 6px rgba(29, 78, 216, 0.2)'
                  }}
                >
                  <Play size={12} fill="#fff" /> Accept &amp; Start Trip
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await notificationApi.markRead(dispatchNotif._id);
                      loadNotifications();
                      toast.success("Dispatch acknowledged and dismissed.");
                    } catch (e) {}
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #3b82f6',
                    color: '#1d4ed8',
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* HOME VIEW */}
      {view === 'home' && !activeTrip && (
        <div className="driver-card-grid">
          {cardBtn('linear-gradient(135deg,#2563eb,#1e3a8a)', <Car size={26} className="text-white" />, 'Short Trip', 'Local Dispatch', 'Quick Log', 'rgba(37, 99, 235, 0.45)', 'radial-gradient(circle at center, rgba(30, 64, 175, 0.4) 0%, rgba(0,0,0,0) 80%)')}
          {cardBtn('linear-gradient(135deg,#7c3aed,#4c1d95)', <Truck size={26} className="text-white" />, 'Long Trip', 'Interstate Route', 'Multi-leg', 'rgba(124, 58, 237, 0.45)', 'radial-gradient(circle at center, rgba(109, 40, 217, 0.4) 0%, rgba(0,0,0,0) 80%)')}
          {cardBtn('linear-gradient(135deg,#059669,#064e3b)', <History size={26} className="text-white" />, 'History', 'Trip Ledger', 'All Logs', 'rgba(5, 150, 105, 0.45)', 'radial-gradient(circle at center, rgba(4, 120, 87, 0.4) 0%, rgba(0,0,0,0) 80%)')}
          {cardBtn('linear-gradient(135deg,#4b5563,#1f2937)', <Settings size={26} className="text-white" />, 'Settings', 'Profile Settings', 'System', 'rgba(75, 85, 99, 0.45)', 'radial-gradient(circle at center, rgba(55, 65, 81, 0.4) 0%, rgba(0,0,0,0) 80%)')}
        </div>
      )}

      {/* ACTIVE TRIP */}
      {(view === 'active_trip' || (view === 'home' && activeTrip)) && renderActiveTrip()}

      {/* SHORT/LONG TRIP FORMS */}
      {view === 'short' && renderTripForm('short')}
      {view === 'long' && renderTripForm('long')}

      {/* HISTORY */}
      {view === 'history' && renderHistory()}

      {/* SETTINGS (simple) */}
      {view === 'settings' && (
        <div>
          <button onClick={() => setView('home')} className="action-glow-btn mb-4 text-start d-inline-flex align-items-center justify-content-center gap-1" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', background: 'var(--sidebar-bg)', boxShadow: '0 4px 14px rgba(75, 85, 99, 0.25)' }}><ArrowLeft size={14} /> Back to Home</button>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: '#4b5563', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20} /> System Settings</h2>
          <div className="premium-white-card text-start" style={{ borderLeft: '4px solid #4b5563' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Driver: {user?.display_name || user?.username}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Vehicle: {(user?.username || '').toUpperCase()}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Role: Driver</div>
            
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="action-glow-btn action-glow-btn-danger d-inline-flex align-items-center justify-content-center"
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              <LogOut size={14} className="me-2" /> Logout from App
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
