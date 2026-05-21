import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Heart, Package, FileText, AlertTriangle, Clock, CheckCircle2, MoreHorizontal } from 'lucide-react';
import { notificationApi } from '../utils/api';
import { useNavigate } from 'react-router-dom';

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

export default function NotificationDropdown({ user, className, style, bellSize = 22, iconColor = 'inherit' }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'
  
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const navigate = useNavigate();

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
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Position relative to viewport, expanding to the right
      setDropdownPos({
        top: rect.bottom + 12,
        left: rect.left - 10
      });
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
    setOpen(false);

    // Direct entity routing (new notifications with entity_type set)
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
      // Fallback for old trip-related notifications without entity_id
      navigate('/vehicle-incoming');
    } else if (notification.type === 'vehicle_incoming') {
      navigate('/vehicle-incoming');
    }
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
      style={{
        position: 'fixed',
        top: Math.min(dropdownPos.top, window.innerHeight - 500),
        left: dropdownPos.left,
        width: 380,
        maxHeight: 'calc(100vh - 100px)',
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.15)',
        zIndex: 100000, // Absolutely top
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #ef4444', // Remove if don't want red border, setting subtle gray
        borderColor: 'rgba(0,0,0,0.08)',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* IG Style Header */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Notifications</h2>
        
        {/* Filters / Folders */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button 
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === 'all' ? '#0f172a' : '#f1f5f9',
              color: filter === 'all' ? '#fff' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('unread')}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === 'unread' ? '#0f172a' : '#f1f5f9',
              color: filter === 'unread' ? '#fff' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            Unread {unreadCount > 0 && <span style={{ color: filter === 'unread' ? '#fff' : '#3b82f6' }}>({unreadCount})</span>}
          </button>
        </div>
      </div>

      {/* List Area */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {groupedNotifs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Heart size={40} style={{ opacity: 0.3, marginBottom: 16 }} strokeWidth={1.5} />
            <div style={{ fontSize: 15, fontWeight: 500, color: '#64748b' }}>No notifications yet.</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>When someone updates a trip or shares an invoice, it'll show up here.</div>
          </div>
        ) : (
          groupedNotifs.map(([groupName, items]) => (
            <div key={groupName} style={{ marginBottom: 8 }}>
              <div style={{ padding: '12px 20px 8px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                {groupName}
              </div>
              {items.map(n => {
                const { icon, bg } = getIcon(n.type);
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
                      background: '#fff'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    {/* IG Style Avatar */}
                    <div style={{ 
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.1)'
                    }}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                      <span style={{ fontSize: 14, color: '#0f172a' }}>
                        <span style={{ fontWeight: 700 }}>{n.sender_name || 'System'}</span>
                        {' '}
                        {n.title.includes('—') ? n.title.split('—')[0] : n.title}
                        <span style={{ color: '#64748b' }}> {n.message}</span>
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
        <button
          ref={btnRef}
          onClick={handleToggle}
          style={className ? undefined : {
            background: 'none', border: 'none', cursor: 'pointer', color: iconColor,
            padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', position: 'relative', transition: 'all 0.2s',
            transform: open ? 'scale(0.95)' : 'scale(1)'
          }}
          className={className ? "notification-btn" : undefined}
        >
          <Bell size={bellSize} strokeWidth={open ? 2.5 : 2} color={iconColor !== 'inherit' ? iconColor : undefined} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -1, right: -1,
              background: '#ff3040', color: '#fff', fontSize: 10, fontWeight: 800,
              borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '2px 5px', border: '2px solid var(--sidebar-bg, #0f172a)',
              boxShadow: '0 2px 4px rgba(255,48,64,0.3)',
              lineHeight: 1
            }}>
              {unreadCount > 10 ? '10+' : unreadCount}
            </span>
          )}
        </button>
      </div>
      {/* Portal attaches dropdown directly to the document body to avoid CSS/z-index/clipping issues completely */}
      {open && createPortal(dropdownContent, document.body)}
    </>
  );
}
