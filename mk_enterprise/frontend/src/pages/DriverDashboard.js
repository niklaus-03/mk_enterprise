import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { tripApi, notificationApi } from '../utils/api';
import { Car, Truck, History, Settings, Bell, Wallet, MapPin, RefreshCw, CheckCircle, FileText, Play, LogOut, Plus, Package, ArrowLeft, Landmark, Clock, Calendar, Shield, Info, Map, ChevronRight } from 'lucide-react';


const GOODS_TYPES = [
  'Fruits-Vegetables', 'Goods', 'Paint', 'Tile', 'Cement',
  'Hardware Sariya', 'Beverages', 'Booking', 'Others'
];

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('home'); // home, short, long, history, settings, active_trip
  const [activeTrip, setActiveTrip] = useState(null);
  const [trips, setTrips] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Trip form
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cargoEntries, setCargoEntries] = useState([{ owner_name: '', owner_phone: '', goods_types: [], description: '' }]);
  const [searchQuery, setSearchQuery] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState({});

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

  useEffect(() => { loadActiveTrip(); loadNotifications(); }, [loadActiveTrip, loadNotifications]);

  const startTrip = async (type) => {
    if (!origin.trim() || !destination.trim()) return toast.error('Origin and destination are required');
    try {
      const res = await tripApi.create({ type, origin, destination, cargo: cargoEntries.filter(c => c.owner_name) });
      toast.success('Trip started! 🚛');
      setActiveTrip(res.trip);
      setView('active_trip');
      setOrigin(''); setDestination('');
      setCargoEntries([{ owner_name: '', owner_phone: '', goods_types: [], description: '' }]);
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
  const btnPrimary = { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const btnDanger = { background: '#dc2626', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const btnOutline = { background: '#f8fafc', border: '1.5px solid #e5e7eb', color: '#374151', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

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
                    <label className="form-label text-secondary fw-bold" style={{ fontSize: '10px' }}>Owner Name</label>
                    <input className="form-control" placeholder="Name" value={c.owner_name} onChange={e => { const n = [...cargoEntries]; n[i].owner_name = e.target.value; setCargoEntries(n); }} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label text-secondary fw-bold" style={{ fontSize: '10px' }}>Owner Phone</label>
                    <input className="form-control" placeholder="Phone Number" value={c.owner_phone} onChange={e => { const n = [...cargoEntries]; n[i].owner_phone = e.target.value; setCargoEntries(n); }} />
                  </div>
                </div>

                <label className="form-label text-secondary fw-bold mb-2 text-start d-block" style={{ fontSize: '11px' }}>Type of Goods (select or type below)</label>
                
                {/* Selected Goods Tags */}
                <div className="d-flex flex-wrap gap-2 mb-2 text-start">
                  {(c.goods_types || []).length === 0 && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No goods selected yet</span>
                  )}
                  {(c.goods_types || []).map(g => (
                    <span key={g} className="badge d-inline-flex align-items-center gap-2 py-1.5 px-3" style={{ borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' }}>
                      <Package size={11} /> {g}
                      <span onClick={() => {
                        const n = [...cargoEntries];
                        n[i].goods_types = n[i].goods_types.filter(t => t !== g);
                        setCargoEntries(n);
                      }} style={{ cursor: 'pointer', fontWeight: 800, fontSize: '13px', marginLeft: '4px', opacity: 0.8 }} title="Remove">×</span>
                    </span>
                  ))}
                </div>

                {/* Combobox Search Select */}
                <div className="position-relative mb-5">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type to filter or enter custom goods..."
                    value={searchQuery[i] || ''}
                    style={{ borderRadius: '10px', fontSize: '13px', padding: '10px 14px', border: '1px solid #cbd5e1' }}
                    onFocus={() => setDropdownOpen({ ...dropdownOpen, [i]: true })}
                    onBlur={() => {
                      setTimeout(() => setDropdownOpen({ ...dropdownOpen, [i]: false }), 200);
                    }}
                    onChange={e => {
                      setSearchQuery({ ...searchQuery, [i]: e.target.value });
                      setDropdownOpen({ ...dropdownOpen, [i]: true });
                    }}
                  />
                  
                  {/* Dropdown Options List */}
                  {dropdownOpen[i] && (
                    <div className="premium-dropdown-card text-start mt-1">
                      <div className="list-group list-group-flush">
                        {GOODS_TYPES.filter(g => g.toLowerCase().includes((searchQuery[i] || '').toLowerCase()))
                          .map(g => {
                            const isSelected = (c.goods_types || []).includes(g);
                            return (
                              <button
                                key={g}
                                type="button"
                                className={`premium-dropdown-item ${isSelected ? 'active-item' : ''}`}
                                onMouseDown={() => {
                                  const n = [...cargoEntries];
                                  const types = n[i].goods_types || [];
                                  n[i].goods_types = types.includes(g) ? types.filter(t => t !== g) : [...types, g];
                                  setCargoEntries(n);
                                  setSearchQuery({ ...searchQuery, [i]: '' });
                                }}
                              >
                                <span>{g}</span>
                                {isSelected && <span style={{ fontSize: '11px', fontWeight: 600 }}>✓ Selected</span>}
                              </button>
                            );
                          })}
                        
                        {searchQuery[i] && searchQuery[i].trim() !== '' && !GOODS_TYPES.map(x => x.toLowerCase()).includes(searchQuery[i].trim().toLowerCase()) && (
                          <button
                            type="button"
                            className="premium-dropdown-item premium-dropdown-add-custom"
                            onMouseDown={() => {
                              const n = [...cargoEntries];
                              const customGoods = searchQuery[i].trim();
                              if (customGoods) {
                                const types = n[i].goods_types || [];
                                if (!types.includes(customGoods)) {
                                  n[i].goods_types = [...types, customGoods];
                                  setCargoEntries(n);
                                }
                              }
                              setSearchQuery({ ...searchQuery, [i]: '' });
                            }}
                          >
                            <span>➕ Add Custom: <strong>"{searchQuery[i].trim()}"</strong></span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
             <button
              type="button"
              onClick={() => setCargoEntries([...cargoEntries, { owner_name: '', owner_phone: '', goods_types: [], description: '' }])}
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
                    <button type="button" onClick={() => setShowNextLegForm(false)} className="btn btn-outline btn-sm px-3 fw-bold">Cancel</button>
                  </div>
                </div>
              )}
              {showEndTripConfirm && (
                <div className="card border-danger bg-light p-3 mt-4">
                  <h6 className="fw-bold text-danger mb-1 d-flex align-items-center gap-2"><CheckCircle size={14} /> Confirm Ending Trip?</h6>
                  <p className="text-muted mb-3" style={{ fontSize: '12px' }}>This will close the active log and submit all details to management permanently.</p>
                  <div className="d-flex gap-2">
                    <button type="button" onClick={endTrip} className="btn btn-danger btn-sm px-3 fw-bold">Yes, End Trip</button>
                    <button type="button" onClick={() => setShowEndTripConfirm(false)} className="btn btn-outline btn-sm px-3 fw-bold">Cancel</button>
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
              <span className="font-monospace fw-bold">{activeTrip.vehicle_number || user?.username || '—'}</span>
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
                  <div style={{ background: '#f8fafc', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
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
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px', paddingLeft: '8px', borderLeft: '3px solid #059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>₹{(trip.total_expenses || 0).toLocaleString('en-IN')}</div>
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

  return (
    <div style={{ maxWidth: containerWidth, margin: '0 auto' }}>
      {/* Logout Confirmation Modal (Premium Design) */}
      {showLogoutConfirm && (
        <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(15, 23, 42, 0.75)' }}>
          <div className="modal premium-confirm-modal">
            <div className="premium-icon-container" style={{ color: '#ef4444' }}>
              <LogOut size={32} strokeWidth={2.5} />
            </div>
            
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, color: '#0f172a', letterSpacing: '-0.5px' }}>
              Confirm Logout
            </h3>
            <p style={{ fontSize: 14.5, color: '#64748b', marginBottom: 0, lineHeight: 1.6, padding: '0 10px' }}>
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

      {/* Active Live Dispatched Invoice Data Banner */}
      {view === 'home' && !activeTrip && (
        <div style={{ 
          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', 
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
            <div style={{ background: '#3b82f6', color: '#fff', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={16} className="animate-bounce" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>New Dispatch Received</span>
                <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Just Now</span>
              </div>
              <h5 style={{ fontSize: 14.5, fontWeight: 700, color: '#1e3a8a', margin: '4px 0 2px' }}>
                Invoice ADM-INV-00094 Assigned
              </h5>
              <p style={{ fontSize: 12.5, color: '#1e40af', marginBottom: 12, lineHeight: 1.4 }}>
                <strong>Customer:</strong> Mayank Kumar (Pune)<br />
                <strong>Pending Balance:</strong> ₹12,199.38 • <strong>Items:</strong> Computer, Cooking Oil, Cement, aata
              </p>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => {
                    setOrigin('Ganai');
                    setDestination('Pune');
                    setCargoEntries([{ owner_name: 'Mayank Kumar', owner_phone: '7417897159', goods_types: ['Computer', 'Cement'], description: '' }]);
                    setView('short');
                    toast.success("Loaded dispatch data! Ready to start trip.");
                  }}
                  style={{
                    background: '#1d4ed8',
                    color: '#fff',
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
                  onClick={() => toast.success("Dispatch acknowledged.")}
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
      )}

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
          <button onClick={() => setView('home')} className="action-glow-btn mb-4 text-start d-inline-flex align-items-center justify-content-center gap-1" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #4b5563, #1f2937)', boxShadow: '0 4px 14px rgba(75, 85, 99, 0.25)' }}><ArrowLeft size={14} /> Back to Home</button>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: '#4b5563', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20} /> System Settings</h2>
          <div className="premium-white-card text-start" style={{ borderLeft: '4px solid #4b5563' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Driver: {user?.display_name || user?.username}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Vehicle: {user?.username}</div>
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
