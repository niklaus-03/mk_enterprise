import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, Heart, Package, FileText, AlertTriangle, Clock, Truck, ChevronLeft, ArrowLeft } from 'lucide-react';
import { notificationApi, orderApi } from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRegisterRefresh } from '../context/PullToRefreshContext';

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

export default function NotificationsPage() {
  const { user, socket } = useAuth();
  const { settings } = useApp();
  const lang = settings?.language === 'hi';
  const navigate = useNavigate();
  
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

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [orders, setOrders] = useState([]);

  const fetchNotifications = async () => {
    try {
      const [notifRes, orderRes] = await Promise.all([
        notificationApi.getAll({ limit: 100 }),
        orderApi.getAll({ status: 'pending' })
      ]);
      setNotifications(notifRes.notifications || []);
      setUnreadCount(notifRes.unreadCount || 0);
      setOrders(Array.isArray(orderRes) ? orderRes : (orderRes.orders || []));
    } catch (e) {
      console.error('Failed to fetch data', e);
    }
  };

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const refreshPage = useCallback(() => { fetchNotifications(); }, []);
  useRegisterRefresh(refreshPage);

  useEffect(() => {
    if (socket) {
      const handleNewNotification = () => fetchNotifications();
      socket.on('new_notification', handleNewNotification);
      return () => socket.off('new_notification', handleNewNotification);
    }
  }, [socket]);

  const handleMarkRead = async (e, id) => {
    if (e) e.stopPropagation();
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { }
  };

  const handleClickNotification = async (notification) => {
    if (!notification.is_read) {
      await handleMarkRead(null, notification._id);
    }

    if (notification.entity_type === 'invoice' && notification.entity_id) {
      if (user?.role === 'driver') navigate('/', { state: { dispatchNotif: notification } });
      else navigate(`/invoices/${notification.entity_id}`);
    } else if (notification.entity_type === 'trip' && notification.entity_id) {
      if (user?.role === 'driver') navigate('/', { state: { dispatchNotif: notification } });
      else navigate(`/trip/${notification.entity_id}`);
    } else if (notification.entity_type === 'trip_request') {
      navigate('/admin-panel', { state: { activeTab: 'requests' } });
    } else if (notification.entity_type === 'delivery' && notification.entity_id) {
      navigate(`/vehicle/${notification.entity_id}`);
    } else if (notification.type === 'trip_started') {
      navigate('/admin-panel', { state: { activeTab: 'activity', logUserId: notification.sender_id, logUsername: notification.sender_name } });
    } else if (['trip_completed', 'trip_update'].includes(notification.type) || 
               (notification.type === 'general' && (notification.title?.includes('FUEL') || notification.title?.includes('TOLL') || notification.title?.includes('CHALLAN') || notification.title?.includes('SERVICE') || notification.title?.includes('FOOD')))) {
      navigate('/vehicle-incoming');
    } else if (notification.type === 'vehicle_incoming') {
      navigate('/vehicle-incoming');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'trip_started': return { icon: <Truck size={20} color="#fff" />, bg: '#10b981' };
      case 'trip_bypass_request': return { icon: <Truck size={20} color="#fff" />, bg: '#f59e0b' };
      case 'driver_dispatch': return { icon: <Package size={20} color="#fff" />, bg: '#3b82f6' };
      case 'trip_update': return { icon: <Clock size={20} color="#fff" />, bg: '#10b981' };
      case 'invoice_shared': return { icon: <FileText size={20} color="#fff" />, bg: '#8b5cf6' };
      case 'system_alert': return { icon: <AlertTriangle size={20} color="#fff" />, bg: '#ef4444' };
      default: return { icon: <Bell size={20} color="#fff" />, bg: '#64748b' };
    }
  };

  const filteredNotifs = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
  const groupedNotifs = groupNotifications(filteredNotifs);

  return (
    <div style={{ fontFamily: "'-apple-system', BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      
      {/* Standardized header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="page-title d-flex align-items-center gap-2" style={{ margin: 0, marginTop: '4px', fontSize: '1.25rem', fontWeight: 600 }}>
              <Bell size={22} className="text-primary" /> {lang ? 'सूचनाएं' : 'Notifications'}
            </div>
            <div className="page-subtitle" style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 0 16px 0', gap: 8 }}>
        <button 
          onClick={() => setFilter('all')}
          style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: filter === 'all' ? 'var(--text)' : 'var(--bg-card)',
            color: filter === 'all' ? 'var(--bg-card)' : 'var(--text)',
            transition: 'all 0.2s',
            boxShadow: filter === 'all' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          All
        </button>
        <button 
          onClick={() => setFilter('unread')}
          style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: filter === 'unread' ? 'var(--text)' : 'var(--bg-card)',
            color: filter === 'unread' ? 'var(--bg-card)' : 'var(--text)',
            transition: 'all 0.2s',
            boxShadow: filter === 'unread' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          Unread {unreadCount > 0 && <span>({unreadCount})</span>}
        </button>
      </div>

      <div className="card" style={{ paddingBottom: 40, background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {filter === 'all' && orders.length > 0 && (
          <div>
            <div style={{ padding: '16px 16px 8px', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {lang ? `आज के ऑर्डर (${orders.length})` : `Orders Due Today (${orders.length})`}
            </div>
            {orders.map(o => (
              <div 
                key={o._id}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'transparent',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Avatar */}
                <div style={{ 
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Package size={20} color="#fff" />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>
                    <span style={{ fontWeight: 600 }}>{o.customer_name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}ordered {o.items?.[0]?.product_name} x {o.items?.[0]?.qty} {o.items?.[0]?.unit || 'units'}
                      {o.items?.length > 1 && ` and ${o.items.length - 1} more item${o.items.length - 1 > 1 ? 's' : ''}`}
                    </span>
                  </span>
                </div>

                {/* Right side action button */}
                <div style={{ flexShrink: 0 }}>
                  <Link
                    to={`/invoices/new?orderId=${o._id}`}
                    style={{
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      display: 'inline-block',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-light)'}
                  >
                    {lang ? 'बिल बनाएँ' : 'Generate'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        {groupedNotifs.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Heart size={32} color="var(--text)" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 300 }}>{lang ? 'अभी तक कोई सूचना नहीं है' : 'No notifications yet'}</div>
          </div>
        ) : (
          groupedNotifs.map(([groupName, items]) => (
            <div key={tGroup(groupName)}>
              <div style={{ padding: '16px 16px 8px', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                {tGroup(groupName)}
              </div>
              {items.map(n => {
                const { icon, bg } = getIcon(n.type);

                let roleBg = bg;
                const senderRole = n.metadata?.sender_role;
                if (senderRole === 'driver') roleBg = '#10b981';
                else if (senderRole === 'manager') roleBg = '#8b5cf6';

                return (
                  <div 
                    key={n._id}
                    onClick={() => handleClickNotification(n)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      background: 'transparent',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* IG Avatar - simple circle */}
                    <div style={{ 
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      background: roleBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>
                        <span style={{ fontWeight: 600 }}>{n.sender_name || 'System'}</span>
                        {' '}
                        {translateNotifText(n.title)}
                        {n.type === 'trip_started' ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                            {' '}started trip to {n.metadata?.destination}.
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}> {translateNotifText(n.message)}</span>
                        )}
                        <span style={{ color: '#8e8e8e', fontSize: 14, marginLeft: 4 }}>{formatTimeAgo(n.createdAt)}</span>
                      </span>
                    </div>

                    {/* Right side unread dot or action button */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 16 }}>
                      {!n.is_read && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0095f6' }} />
                      )}
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
}
