import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { tripApi, notificationApi } from '../utils/api';

const GOODS_TYPES = [
  'Fruits-Vegetables', 'Goods', 'Paint', 'Tile', 'Cement',
  'Hardware Sariya', 'Beverages', 'Booking', 'Others'
];

export default function DriverDashboard() {
  const { user } = useAuth();
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
  const cardBtn = (bg, icon, label) => (
    <button onClick={() => {
      if (label === 'Short Trip') { setView('short'); setDestination(''); }
      else if (label === 'Long Trip') { setView('long'); setOrigin(''); setDestination('Haldwani'); }
      else if (label === 'History') { setView('history'); loadHistory(); }
      else if (label === 'Settings') setView('settings');
    }} style={{
      background: bg, border: 'none', borderRadius: 16, padding: '28px 20px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transition: 'transform 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <span style={{ fontSize: 36 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{label}</span>
    </button>
  );

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', outline: 'none' };
  const btnPrimary = { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const btnDanger = { background: '#dc2626', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' };
  const btnOutline = { background: '#f8fafc', border: '1.5px solid #e5e7eb', color: '#374151', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

  // ── TRIP FORM (shared for short/long) ──
  const renderTripForm = (type) => (
    <div>
      <button onClick={() => setView('home')} style={{ ...btnOutline, marginBottom: 16 }}>← Back</button>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{type === 'short' ? '🚗 Short Trip' : '🚛 Long Trip'}</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Origin</label>
        <input style={inputStyle} placeholder="e.g. Pune" value={origin} onChange={e => setOrigin(e.target.value)} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Destination</label>
        <input style={inputStyle} placeholder="e.g. Mumbai" value={destination} onChange={e => setDestination(e.target.value)} />
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>📦 Cargo</h3>
      {cargoEntries.map((c, i) => (
        <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid #e5e7eb' }}>
          <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Owner Name" value={c.owner_name} onChange={e => { const n = [...cargoEntries]; n[i].owner_name = e.target.value; setCargoEntries(n); }} />
          <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Owner Phone" value={c.owner_phone} onChange={e => { const n = [...cargoEntries]; n[i].owner_phone = e.target.value; setCargoEntries(n); }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Type of Goods (select multiple)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GOODS_TYPES.map(g => (
              <button key={g} onClick={() => {
                const n = [...cargoEntries];
                const types = n[i].goods_types || [];
                n[i].goods_types = types.includes(g) ? types.filter(t => t !== g) : [...types, g];
                setCargoEntries(n);
              }} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: (c.goods_types || []).includes(g) ? '#2563eb' : '#f3f4f6',
                color: (c.goods_types || []).includes(g) ? '#fff' : '#374151',
                border: 'none',
              }}>{g}</button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setCargoEntries([...cargoEntries, { owner_name: '', owner_phone: '', goods_types: [], description: '' }])} style={{ ...btnOutline, marginBottom: 16, width: '100%' }}>+ Add Another Owner</button>
      <button onClick={() => startTrip(type)} style={btnPrimary}>🚀 Start Trip</button>
    </div>
  );

  // ── ACTIVE TRIP VIEW ──
  const renderActiveTrip = () => {
    if (!activeTrip) return null;
    const activeLeg = activeTrip.legs?.find(l => l.status === 'active');
    const allCompleted = activeTrip.legs?.every(l => l.status === 'completed');

    return (
      <div>
        <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 14, padding: '20px', color: '#fff', marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>ACTIVE {activeTrip.type.toUpperCase()} TRIP</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {activeLeg ? `${activeLeg.origin} → ${activeLeg.destination}` : 'All legs completed'}
          </div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: 0.8 }}>
            Total Expenses: ₹{(activeTrip.total_expenses || 0).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Expense Entry */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>💰 Log Expense</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {['fuel', 'toll', 'challan', 'service', 'food', 'other'].map(t => (
              <button key={t} onClick={() => setExpType(t)} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: expType === t ? '#2563eb' : '#f3f4f6', color: expType === t ? '#fff' : '#374151',
              }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="₹ Amount" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
            <input style={{ ...inputStyle, flex: 1.5 }} placeholder="Note (optional)" value={expNote} onChange={e => setExpNote(e.target.value)} />
          </div>
          <button onClick={addExpense} style={{ ...btnPrimary, marginTop: 8, background: '#059669' }}>+ Add Expense</button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {activeLeg && (
            <button onClick={markReached} style={{ ...btnPrimary, flex: 1, background: '#f59e0b', minWidth: 140 }}>📍 Reached Destination</button>
          )}
          {allCompleted && !showNextLegForm && (
            <button onClick={() => {
              setNextOrigin(activeLeg?.destination || '');
              setNextDest(activeTrip.type === 'long' ? 'Ganai' : '');
              setShowNextLegForm(true);
            }} style={{ ...btnPrimary, flex: 1, background: '#7c3aed', minWidth: 140 }}>🔄 Next Leg</button>
          )}
          {!showEndTripConfirm && (
            <button onClick={() => setShowEndTripConfirm(true)} style={{ ...btnDanger, flex: 1, minWidth: 140 }}>🏁 End Trip</button>
          )}
        </div>

        {/* Inline Next Leg Form */}
        {showNextLegForm && (
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginTop: 12, border: '1.5px solid #7c3aed', boxShadow: '0 4px 12px rgba(124,58,237,0.08)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9', marginBottom: 10 }}>🔄 Add Next Leg Details</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 2 }}>From</label>
                <input style={inputStyle} placeholder="Origin" value={nextOrigin} onChange={e => setNextOrigin(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 2 }}>To</label>
                <input style={inputStyle} placeholder="Destination" value={nextDest} onChange={e => setNextDest(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
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
              }} style={{ ...btnPrimary, background: '#7c3aed', flex: 1.5 }}>Start Next Leg</button>
              <button onClick={() => setShowNextLegForm(false)} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Inline End Trip Confirmation Card */}
        {showEndTripConfirm && (
          <div style={{ background: '#fef2f2', borderRadius: 12, padding: 16, marginTop: 12, border: '1.5px solid #ef4444', boxShadow: '0 4px 12px rgba(239,68,68,0.08)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>🏁 End This Trip?</h4>
            <p style={{ fontSize: 11.5, color: '#7f1d1d', margin: '0 0 12px 0' }}>This will finalize the entire trip log and record all logged expenses permanently.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={endTrip} style={{ ...btnPrimary, background: '#dc2626', flex: 1.5 }}>Yes, End Trip</button>
              <button onClick={() => setShowEndTripConfirm(false)} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📜 Trip Timeline</h3>
          {(activeTrip.timeline || []).map((t, i) => {
            const icons = { trip_start: '🟢', expense: '💰', reached_destination: '📍', returning: '🔄', trip_end: '🏁', note: '📝' };
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                <span>{icons[t.type] || '📝'}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {t.type === 'expense' ? `${t.expense_type}: ₹${t.expense_amount}` : t.note || t.type}
                  </div>
                  {t.expense_note && <div style={{ color: '#6b7280', fontSize: 12 }}>{t.expense_note}</div>}
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(t.timestamp || t.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── HISTORY VIEW ──
  const renderHistory = () => (
    <div>
      <button onClick={() => setView('home')} style={{ ...btnOutline, marginBottom: 16 }}>← Back</button>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>📜 Trip History</h2>
      {loading ? <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading...</div> :
      trips.length === 0 ? <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>No completed trips yet.</div> :
      trips.map(trip => (
        <div key={trip._id} style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid #e5e7eb', cursor: 'pointer' }}
          onClick={() => setExpandedTrip(expandedTrip === trip._id ? null : trip._id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{trip.type === 'short' ? '🚗' : '🚛'} {trip.legs?.[0]?.origin} → {trip.legs?.[trip.legs.length - 1]?.destination}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {new Date(trip.started_at).toLocaleDateString('en-IN')} — {trip.completed_at ? new Date(trip.completed_at).toLocaleDateString('en-IN') : 'Ongoing'}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>₹{(trip.total_expenses || 0).toLocaleString('en-IN')}</div>
          </div>
          {expandedTrip === trip._id && (
            <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
              {(trip.timeline || []).map((t, i) => {
                const icons = { trip_start: '🟢', expense: '💰', reached_destination: '📍', returning: '🔄', trip_end: '🏁' };
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12 }}>
                    <span>{icons[t.type] || '📝'}</span>
                    <span style={{ fontWeight: 600 }}>{t.type === 'expense' ? `${t.expense_type}: ₹${t.expense_amount}` : t.note || t.type}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {/* Notification Bar */}
      {unreadCount > 0 && view === 'home' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔔</span>
          <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>{unreadCount} new dispatch notification{unreadCount > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* HOME VIEW */}
      {view === 'home' && !activeTrip && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Welcome, {user?.display_name || user?.username} 👋</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Select a trip type to begin</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {cardBtn('linear-gradient(135deg,#2563eb,#1d4ed8)', '🚗', 'Short Trip')}
            {cardBtn('linear-gradient(135deg,#7c3aed,#6d28d9)', '🚛', 'Long Trip')}
            {cardBtn('linear-gradient(135deg,#059669,#047857)', '📜', 'History')}
            {cardBtn('linear-gradient(135deg,#6b7280,#4b5563)', '⚙️', 'Settings')}
          </div>
        </>
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
          <button onClick={() => setView('home')} style={{ ...btnOutline, marginBottom: 16 }}>← Back</button>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>⚙️ Settings</h2>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Driver: {user?.display_name || user?.username}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Vehicle: {user?.username}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Role: Driver</div>
          </div>
        </div>
      )}
    </div>
  );
}
