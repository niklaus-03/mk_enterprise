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
        minute: '2-digit'
      }).toLowerCase());
    };
    updateTime();
    const iv = setInterval(updateTime, 1000);
    return () => clearInterval(iv);
  }, []);

  const isToday = globalDate === getTodayIST();
  
  // Format YYYY-MM-DD to DD-MMM-YYYY
  const formatMonthDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  if (!liveTimeIST) return null;

  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '4px 8px',
      position: 'relative'
    }} className="topnav-datetime-container">
      
      {/* Time Display (Top) */}
      <div style={{ 
        fontSize: 16, 
        fontWeight: 700, 
        fontFamily: 'monospace', 
        letterSpacing: '0.5px', 
        color: 'var(--text)',
        lineHeight: 1.2
      }} className="topnav-time-text">
        {liveTimeIST.split(' ')[0]} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{liveTimeIST.split(' ')[1]}</span>
      </div>
      
      {/* Date Display (Bottom) */}
      <div style={{ 
        fontSize: 14, 
        fontWeight: 700, 
        color: isToday ? 'var(--text-muted)' : '#d97706',
        lineHeight: 1.2,
        marginTop: 2
      }} className="topnav-date-text">
        {formatMonthDate(globalDate)}
      </div>

      {/* Invisible Date Picker Overlay */}
      <input
        type="date"
        value={globalDate}
        max={getTodayIST()}
        onChange={e => { if (e.target.value) setGlobalDate(e.target.value); }}
        onClick={e => { try { e.target.showPicker(); } catch(err) {} }}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          width: '100%',
          height: '100%'
        }}
        title="Change Date"
      />
    </div>
  );
}

export default TopNavDateTime;
