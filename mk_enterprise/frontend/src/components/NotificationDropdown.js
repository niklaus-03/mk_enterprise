import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { createPortal } from 'react-dom';
import { Bell, Heart, Package, FileText, AlertTriangle, Clock, CheckCircle2, MoreHorizontal } from 'lucide-react';
import { notificationApi } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import useBackButton from '../hooks/useBackButton';

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSecs = Math.floor((now - date) / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSecs < 60) return `${Math.max(0, diffSecs)}s`;
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${diffWeeks}w`;
}

function groupNotifications(notifs) {
  const groups = { New: [], Today: [], 'This Week': [], Earlier: [] };
  const now = new Date();
  
  notifs.forEach(n => {
    const d = new Date(n.createdAt);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    
    if (!n.is_read) groups.New.push(n);
    else if (diffDays === 0 && d.getDate() === now.getDate()) groups.Today.push(n);
    else if (diffDays < 7) groups['This Week'].push(n);
    else groups.Earlier.push(n);
  });
  
  return Object.entries(groups).filter(([k, v]) => v.length > 0);
}
import { useAuth } from '../context/AuthContext';

export default function NotificationDropdown({ user, className, style, bellSize = 22, iconColor = 'inherit', customButton }) {
  const { socket } = useAuth();
    const { t, settings } = useApp();
  const lang = settings?.language === 'hi';
  
  const translateNotifText = (text) => {
    if (!lang || !text) return text;
    let s = text;
    s = s.replace(/Started SHORT trip:/g, 'SHORT ट्रिप शुरू की:');
    s = s.replace(/Started LONG trip:/g, 'LONG ट्रिप शुरू की:');
    s = s.replace(/Owner:/g, 'मालिक:');
    s = s.replace(/Dispatch Assigned/g, 'डिस्पैच असाइन किया गया');
    s = s.replace(/Supervisor Admin assigned Invoice ([\w-]+) to (.*)/, 'सुपरवाइजर एडमिन ने बिल $1 $2 को असाइन किया');
    s = s.replace(/Vehicle Incoming/g, 'वाहन आ रहा है');
    s = s.replace(/WALK-IN/g, 'वॉक-इन');
    s = s.replace(/Items:/g, 'सामान:');
    s = s.replace(/ETA:/g, 'पहुंचने का समय:');
    s = s.replace(/Payment Made: ₹([\d]+)/, 'भुगतान किया गया: ₹$1');
    s = s.replace(/To (.*) via CASH/, '$1 को नकद द्वारा');
    s = s.replace(/To (.*) via UPI/, '$1 को यूपीआई द्वारा');
    s = s.replace(/To (.*) via ONLINE/, '$1 को ऑनलाइन द्वारा');
    s = s.replace(/Ref: N\/A/g, 'संदर्भ: N/A');
    s = s.replace(/Low Stock/g, 'कम स्टॉक');
    s = s.replace(/Invoice Shared/g, 'बिल साझा किया गया');
    s = s.replace(/Delivery Dispatch/g, 'डिलीवरी डिस्पैच');
    return s;
  };
  
  const tGroup = (name) => {
    if (!lang) return name;
    const map = { 'New': 'नया', 'Today': 'आज', 'This Week': 'इस सप्ताह', 'Earlier': 'पहले' };
    return map[name] || name;
  };

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'
  
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const navigate = useNavigate();

  useBackButton(open, () => setOpen(false));

  const fetchNotifications = async () => {
    try {
      const res = await notificationApi.getAll({ limit: 50 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  useEffect(() => {
    if (socket) {
      const handleNewNotification = () => fetchNotifications();
      socket.on('new_notification', handleNewNotification);
      return () => socket.off('new_notification', handleNewNotification);
    }
  }, [socket]);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const isNearRight = rect.right > window.innerWidth - 350;
      
      if (isNearRight) {
        setDropdownPos({
          top: rect.bottom + 12,
          right: window.innerWidth - rect.right - 10,
          left: 'auto'
        });
      } else {
        setDropdownPos({
          top: rect.bottom + 12,
          left: rect.left - 10,
          right: 'auto'
        });
      }
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && btnRef.current && !btnRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) fetchNotifications(); 
    setOpen(!open);
  };

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { }
  };

  const handleClickNotification = async (notification) => {
    if (!notification.is_read) {
      await handleMarkRead({ stopPropagation: () => {} }, notification._id);
    }
    // Close the dropdown cleanly via history api to pop the modal state
    window.history.back();

    // Small delay to allow popstate to finish before pushing new route
    setTimeout(() => {
      if (notification.entity_type === 'invoice' && notification.entity_id) {
        if (user?.role === 'driver') navigate('/', { state: { dispatchNotif: notification } });
        else navigate(`/invoices/${notification.entity_id}`);
      } else if (notification.entity_type === 'trip' && notification.entity_id) {
        if (user?.role === 'driver') navigate('/', { state: { dispatchNotif: notification } });
        else navigate(`/trip/${notification.entity_id}`);
      } else if (notification.entity_type === 'delivery' && notification.entity_id) {
        navigate(`/vehicle/${notification.entity_id}`);
      } else if (['trip_started', 'trip_completed', 'trip_update'].includes(notification.type) || 
                 (notification.type === 'general' && (notification.title?.includes('FUEL') || notification.title?.includes('TOLL') || notification.title?.includes('CHALLAN') || notification.title?.includes('SERVICE') || notification.title?.includes('FOOD')))) {
        navigate('/vehicle-incoming');
      } else if (notification.type === 'vehicle_incoming') {
        navigate('/vehicle-incoming');
      }
    }, 50);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'driver_dispatch': return { icon: <Package size={16} color="#fff" />, bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' };
      case 'trip_update': return { icon: <Clock size={16} color="#fff" />, bg: 'linear-gradient(135deg, #10b981, #059669)' };
      case 'invoice_shared': return { icon: <FileText size={16} color="#fff" />, bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' };
      case 'system_alert': return { icon: <AlertTriangle size={16} color="#fff" />, bg: 'linear-gradient(135deg, #ef4444, #b91c1c)' };
      default: return { icon: <Bell size={16} color="#fff" />, bg: 'linear-gradient(135deg, #64748b, #475569)' };
    }
  };

  const filteredNotifs = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
  const groupedNotifs = groupNotifications(filteredNotifs);

  // The portal content
  const dropdownContent = open && (
    <div 
      ref={dropdownRef}
      className="notification-dropdown"
      style={{
        position: 'fixed',
        top: Math.min(dropdownPos.top, window.innerHeight - 500),
        left: dropdownPos.left,
        width: 380,
        maxHeight: 'calc(100vh - 100px)',
        background: 'var(--bg-card)',
        borderRadius: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.15)',
        zIndex: 100000, // Absolutely top
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* IG Style Header */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{lang ? 'सूचनाएं' : 'Notifications'}</h2>
        
        {/* Filters / Folders */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button 
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === 'all' ? 'var(--primary)' : 'var(--bg-hover)',
              color: filter === 'all' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('unread')}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === 'unread' ? 'var(--primary)' : 'var(--bg-hover)',
              color: filter === 'unread' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Unread {unreadCount > 0 && <span style={{ color: filter === 'unread' ? '#ffffff' : '#3b82f6' }}>({unreadCount})</span>}
          </button>
        </div>
      </div>

      {/* List Area */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {groupedNotifs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Heart size={40} style={{ opacity: 0.3, marginBottom: 16 }} strokeWidth={1.5} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>{lang ? 'अभी तक कोई सूचना नहीं है।' : 'No notifications yet.'}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{lang ? 'जब कोई ट्रिप अपडेट करता है या बिल साझा करता है, तो वह यहां दिखाई देगा।' : "When someone updates a trip or shares an invoice, it'll show up here."}</div>
          </div>
        ) : (
          groupedNotifs.map(([groupName, items]) => (
            <div key={tGroup(groupName)} style={{ marginBottom: 8 }}>
              <div style={{ padding: '12px 20px 8px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {tGroup(groupName)}
              </div>
              {items.map(n => {
                const { icon, bg } = getIcon(n.type);

                const expenseType = (n.metadata?.expense_type || '').toUpperCase();
                let borderColor = 'transparent';
                if (expenseType === 'CHALLAN') borderColor = '#ef4444'; // Red
                else if (expenseType === 'SERVICE') borderColor = '#f97316'; // Orange

                let roleBg = bg;
                const senderRole = n.metadata?.sender_role;
                if (senderRole === 'driver') roleBg = 'linear-gradient(135deg, #10b981, #059669)'; // Green
                else if (senderRole === 'manager') roleBg = 'linear-gradient(135deg, #8b5cf6, #7c3aed)'; // Purple

                const isPaidOut = n.metadata?.is_paid_out;
                const baseBg = isPaidOut ? 'var(--danger-light)' : 'var(--bg-card)';
                const hoverBg = isPaidOut ? 'var(--danger-light)' : 'var(--bg)';

                return (
                  <div 
                    key={n._id}
                    onClick={() => handleClickNotification(n)}
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: baseBg,
                      borderBottom: '1px solid var(--border)',
                      borderLeft: borderColor !== 'transparent' ? `4px solid ${borderColor}` : (isPaidOut ? '4px solid #ef4444' : '4px solid transparent')
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                    onMouseLeave={e => e.currentTarget.style.background = baseBg}
                  >
                    {/* IG Style Avatar */}
                    <div style={{ 
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: roleBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.1)',
                      border: borderColor !== 'transparent' ? `2px solid ${borderColor}` : 'none'
                    }}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>
                        <span style={{ fontWeight: 700 }}>{n.sender_name || 'System'}</span>
                        {' '}
                        {translateNotifText(n.title)}
                        <span style={{ color: 'var(--text-muted)' }}> {translateNotifText(n.message)}</span>
                        <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 6 }}>{formatTimeAgo(n.createdAt)}</span>
                      </span>
                    </div>

                    {/* Right side interaction indicator */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: 30 }}>
                      {!n.is_read ? (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 0 4px rgba(59,130,246,0.1)' }} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block', ...style }} className={className}>
        {customButton ? (
          <div ref={btnRef} onClick={handleToggle} style={{ width: '100%', cursor: 'pointer' }}>
             {customButton({ open, unreadCount })}
          </div>
        ) : (
          <button
            ref={btnRef}
            onClick={handleToggle}
            style={className ? undefined : {
              background: 'none', border: 'none', cursor: 'pointer', color: iconColor,
              padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', position: 'relative', transition: 'all 0.2s',
              transform: open ? 'scale(0.95)' : 'scale(1)'
            }}
            className={className ? className : undefined}
          >
            <Bell size={bellSize} strokeWidth={open ? 2.5 : 2} color={iconColor !== 'inherit' ? iconColor : undefined} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -1, right: -1,
                background: '#ff3040', color: 'var(--bg-card)', fontSize: 10, fontWeight: 800,
                borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '2px 5px', border: '2px solid var(--sidebar-bg, #0f172a)',
                boxShadow: '0 2px 4px rgba(255,48,64,0.3)',
                lineHeight: 1
              }}>
                {unreadCount > 10 ? '10+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
      {/* Portal attaches dropdown directly to the document body to avoid CSS/z-index/clipping issues completely */}
      {open && createPortal(dropdownContent, document.body)}
    </>
  );
}
