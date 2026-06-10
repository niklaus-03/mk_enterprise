import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationApi } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotificationDropdown({ className, style, bellSize = 22, iconColor = 'inherit' }) {
  const { user, socket } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await notificationApi.getAll({ limit: 1 });
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  useEffect(() => {
    if (socket) {
      const handleNewNotification = () => fetchNotifications();
      socket.on('new_notification', handleNewNotification);
      return () => socket.off('new_notification', handleNewNotification);
    }
  }, [socket]);

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }} className={className}>
      <button
        onClick={() => navigate('/notifications')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: iconColor,
          padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative', transition: 'all 0.2s'
        }}
      >
        <Bell size={bellSize} strokeWidth={2} color={iconColor !== 'inherit' ? iconColor : undefined} />
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
    </div>
  );
}
