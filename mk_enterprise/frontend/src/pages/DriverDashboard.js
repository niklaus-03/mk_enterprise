import React, { useState } from 'react';

// A beautifully styled driver dashboard and trip timeline
export default function DriverDashboard() {
  const [activeTrip, setActiveTrip] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tripType, setTripType] = useState('local'); // local | long
  const [expenseForm, setExpenseForm] = useState(false);

  // Mock states
  const statuses = [
    { id: 'start', label: 'Start Trip', color: 'var(--primary)' },
    { id: 'reach', label: 'Reached Destination', color: 'var(--info)' },
    { id: 'load', label: 'Loading Done', color: 'var(--warning)' },
    { id: 'return', label: 'Returning', color: 'var(--success)' },
    { id: 'complete', label: 'Trip Completed', color: 'var(--text)' },
  ];

  const handleStatusUpdate = (status) => {
    const entry = {
      id: Date.now(),
      status: status.label,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      locked: true
    };
    setTimeline([...timeline, entry]);
    
    if (status.id === 'complete') {
      setTimeout(() => {
        setActiveTrip(null);
        setTimeline([]);
      }, 3000);
    }
  };

  const addExpense = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = fd.get('amount');
    const category = fd.get('category');
    
    setTimeline([...timeline, {
      id: Date.now(),
      status: `Expense: ₹${amount} (${category})`,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      locked: true,
      isExpense: true
    }]);
    setExpenseForm(false);
  };

  if (!activeTrip) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 0' }}>
        <div style={{ background: 'var(--primary)', color: '#fff', padding: 24, borderRadius: 'var(--radius-lg)', marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Ready for your next trip?</h2>
          <p style={{ opacity: 0.9 }}>Select a trip type to start tracking your journey.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div 
            onClick={() => { setTripType('local'); setActiveTrip(Date.now()); }}
            style={{ 
              background: 'var(--bg-card)', padding: 30, borderRadius: 'var(--radius-lg)', 
              textAlign: 'center', cursor: 'pointer', border: '2px solid var(--border)',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏙️</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Local Trip</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>City limits</div>
          </div>
          
          <div 
            onClick={() => { setTripType('long'); setActiveTrip(Date.now()); }}
            style={{ 
              background: 'var(--bg-card)', padding: 30, borderRadius: 'var(--radius-lg)', 
              textAlign: 'center', cursor: 'pointer', border: '2px solid var(--border)',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛣️</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Long Route</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Multi-day</div>
          </div>
        </div>

        {/* Minimal Calendar View */}
        <div style={{ marginTop: 32, background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Recent Activity</h3>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No recent trips this week.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            {tripType} Route
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>Ongoing Trip</h2>
        </div>
        <button onClick={() => setExpenseForm(true)} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '10px 16px', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}>
          + Expense
        </button>
      </div>

      {expenseForm && (
        <form onSubmit={addExpense} style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 'var(--radius-lg)', marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Add Expense</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Amount (₹)</label>
              <input name="amount" type="number" required style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>Category</label>
              <select name="category" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <option>Fuel</option>
                <option>Toll</option>
                <option>Challan</option>
                <option>Service</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ flex: 1, background: 'var(--primary)', color: '#fff', border: 'none', padding: 12, borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Save</button>
            <button type="button" onClick={() => setExpenseForm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', padding: 12, borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Timeline */}
      <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', marginBottom: 24 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Trip Timeline</h3>
        {timeline.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No events recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {timeline.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.isExpense ? 'var(--danger)' : 'var(--primary)', zIndex: 2 }} />
                  {idx !== timeline.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 4, marginBottom: 4 }} />}
                </div>
                <div style={{ paddingBottom: idx !== timeline.length - 1 ? 16 : 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.status}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {item.date} • {item.time} {item.locked && '🔒 (Locked)'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {statuses.map(s => (
          <button 
            key={s.id}
            onClick={() => handleStatusUpdate(s)}
            style={{ 
              background: s.color, 
              color: s.color === 'var(--text)' || s.color === 'var(--warning)' || s.color === 'var(--info)' ? '#fff' : '#fff',
              border: 'none', 
              padding: '18px 20px', 
              borderRadius: 'var(--radius-lg)', 
              fontSize: 16, 
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              transition: 'transform 0.1s'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
