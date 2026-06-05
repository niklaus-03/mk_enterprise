import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

function TopNavDateTime() {
  const { globalDate, setGlobalDate } = useApp();
  
  const getTodayIST = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 330);
    return d.toISOString().split('T')[0];
  };

  const [liveTimeIST, setLiveTimeIST] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 330);
      setLiveTimeIST(d.toLocaleTimeString('en-IN', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).toLowerCase());
    };
    updateTime();
    const iv = setInterval(updateTime, 1000);
    return () => clearInterval(iv);
  }, []);

  const isToday = globalDate === getTodayIST();

  if (!liveTimeIST) return null;

  return (
    <div style={{
      display: 'flex', 
      alignItems: 'center', 
      gap: 16,
      background: 'var(--bg-hover)',
      border: '1px solid var(--border)',
      borderRadius: 12, 
      padding: '6px 14px',
      marginLeft: 16
    }} className="hide-on-mobile">
      
      {/* Time Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} style={{ color: 'var(--primary)' }} />
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px', color: 'var(--text)' }}>
          {liveTimeIST.split(' ')[0]} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{liveTimeIST.split(' ')[1]}</span>
        </div>
      </div>
      
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      
      {/* Date Picker Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', position: 'relative' }}>
        <Calendar size={16} style={{ color: isToday ? 'var(--text-muted)' : '#f59e0b' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: -2 }}>
            {isToday ? 'Today' : 'Archive'}
          </div>
          <input
            type="date"
            value={globalDate}
            max={getTodayIST()}
            onChange={e => { if (e.target.value) setGlobalDate(e.target.value); }}
            style={{
              border: 'none', 
              outline: 'none', 
              fontSize: 12, 
              fontWeight: 700,
              fontFamily: 'inherit', 
              background: 'transparent',
              cursor: 'pointer', 
              color: isToday ? 'var(--text)' : '#d97706', 
              width: 100,
              padding: 0
            }}
          />
        </div>
      </div>

    </div>
  );
}

export default TopNavDateTime;
