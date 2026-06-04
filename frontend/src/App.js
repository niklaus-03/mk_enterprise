import React from 'react';
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { hi } from './utils/helpers';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import NewInvoice from './pages/NewInvoice';
import EditInvoice from './pages/EditInvoice';
import InvoiceView from './pages/InvoiceView';
import Invoices from './pages/Invoices';
import StockMovements from './pages/StockMovements';
import VehicleIncoming from './pages/VehicleIncoming';
import VehicleDetail from './pages/VehicleDetail';
import TripView from './pages/TripView';
import Suppliers from './pages/Suppliers';
import SupplierPaymentHistory from './pages/SupplierPaymentHistory';
import CustomerPaymentHistory from './pages/CustomerPaymentHistory';
import Settings from './pages/Settings';
import './App.css';
import Orders from './pages/Orders';
import NewOrder from './pages/NewOrder';
import AdminPanel from './pages/AdminPanel';
import WalkInDelivery from './pages/WalkInDelivery';
import DailyReport from './pages/DailyReport';
import DriverDashboard from './pages/DriverDashboard';
import NotificationDropdown from './components/NotificationDropdown';
import MobileGlobalSearch from './components/MobileGlobalSearch';
import { ThemeProvider } from './context/ThemeContext';
import { Calendar, User, BarChart3, FileText, ClipboardList, Package, Users, Truck, UserCheck, Building2, ArrowLeftRight, Shield, Settings as SettingsIcon, Lock, Maximize2, LogOut, Bell, List, Moon, Search } from 'lucide-react';
import { tripApi } from './utils/api';

// ── Protected Route wrapper ────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 12px' }}></div>
        <div style={{ color: '#6b7280' }}>Loading mk_enterprise_site...</div>
      </div>
    </div>
  );
  
  if (isAuthenticated && user?.is_on_hold) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', background: '#1e293b', padding: '40px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <Shield size={64} color="#f59e0b" style={{ margin: '0 auto 24px' }} />
          <h1 style={{ color: '#fff', margin: '0 0 16px', fontSize: 24, fontWeight: 800 }}>Account On Hold</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: 16 }}>Your account is currently suspended.</p>
          <p style={{ color: '#f8fafc', margin: '16px 0 0', fontSize: 18, fontWeight: 700 }}>Contact admin</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── Supervisor-Only Route wrapper ──────────────────────────────────────────────
function SupervisorRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

// ── Vehicle Access Route wrapper ──────────────────────────────────────────────
function VehicleRoute({ children }) {
  const { isAdmin, user } = useAuth();
  const hasAccess = isAdmin || user?.can_edit_products;
  return hasAccess ? children : <Navigate to="/" replace />;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, onLock }) {
  const { logout, admin, isAdmin, user } = useAuth();
  const { settings } = useApp();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const lang = settings.language === 'hi';

  const isTempManager = user?.role === 'temp_manager';
  const isWalkinManager = user?.role === 'walkin_manager';

  const navItems = isTempManager ? [
    { to: '/', label: lang ? hi.dashboard : 'Dashboard', icon: <BarChart3 size={16} />, exact: true },
    { to: '/invoices/new', label: lang ? hi.newBill : 'New Bill', icon: <FileText size={16} />, highlight: true },
    { to: '/invoices', label: lang ? hi.invoices : 'Invoice History', icon: <ClipboardList size={16} />, exact: true },
    { to: '/products', label: lang ? hi.products : 'Products', icon: <Package size={16} /> },
    { to: '/customers', label: lang ? hi.customers : 'Customers', icon: <Users size={16} /> },
    { to: '/settings', label: lang ? hi.settings : 'Settings', icon: <SettingsIcon size={16} /> },
  ] : [
    { to: '/', label: lang ? hi.dashboard : 'Dashboard', icon: <BarChart3 size={16} />, exact: true },
    { to: '/invoices/new', label: lang ? hi.newBill : 'New Bill', icon: <FileText size={16} />, highlight: true },
    { to: '/invoices', label: lang ? hi.invoices : 'Invoice History', icon: <ClipboardList size={16} />, exact: true },
    { to: '/products', label: lang ? hi.products : 'Products', icon: <Package size={16} /> },
    { to: '/customers', label: lang ? hi.customers : 'Customers', icon: <Users size={16} /> },
    ...(isWalkinManager ? [] : [{ to: '/suppliers', label: lang ? 'आपूर्तिकर्ता' : 'Suppliers', icon: <Building2 size={16} /> }]),
    ...(!isWalkinManager ? [{ to: '/walkin-delivery', label: lang ? 'वॉक-इन डिलीवरी' : 'Walk-in Delivery', icon: <UserCheck size={16} /> }] : []),
    { to: '/daily-report', label: lang ? 'दैनिक रिपोर्ट' : 'Daily Report', icon: <Moon size={16} /> },
    ...(isAdmin ? [
      { to: '/vehicle-incoming', label: lang ? 'वाहन' : 'Vehicles', icon: <Truck size={16} /> },
      { to: '/stock-movements', label: lang ? hi.stockMovements : 'Stock Movements', icon: <ArrowLeftRight size={16} /> },
      { to: '/admin', label: lang ? 'एडमिन पैनल' : 'Admin Panel', icon: <Shield size={16} /> },
    ] : []),
    { to: '/settings', label: lang ? hi.settings : 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <>
      {/* Mobile overlay — clicking outside closes sidebar */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 998,
          }}
        />
      )}

      {/* Logout Confirmation Modal (Premium Design) */}
      {showLogoutConfirm && (
        <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(15, 23, 42, 0.75)' }}>
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

      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand" style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', background: '#F8F9FA',
                boxShadow: '0 2px 8px rgba(197,160,89,0.3)',
                border: '1.5px solid #C5A059'
              }}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }} fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="60" cy="60" r="48" stroke="#C5A059" strokeWidth="3.5" />
                  <circle cx="60" cy="60" r="41" stroke="#C5A059" strokeWidth="1" />
                  
                  <ellipse cx="60" cy="60" rx="17" ry="41" stroke="#C5A059" strokeWidth="1" />
                  <path d="M19 60 H101" stroke="#C5A059" strokeWidth="1" />
                  <path d="M60 19 V101" stroke="#C5A059" strokeWidth="1" />
                  
                  <circle cx="60" cy="60" r="26" fill="#F8F9FA" />
                  <circle cx="60" cy="60" r="26" stroke="#C5A059" strokeWidth="2" />
                  <text x="60" y="75" fontFamily="Georgia, 'Times New Roman', serif" fontSize="42" fontWeight="bold" textAnchor="middle" fill="#0B132B" letterSpacing="-2">MK</text>
                </svg>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div className="brand-text" style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Mehta Traders
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {settings.business_name || 'Business Management'}
                </div>
              </div>
            </div>

            {/* Laptop/Desktop Golden Notification Bell - Hidden on Mobile */}
            {user && (
              <div className="hide-on-mobile">
                <NotificationDropdown 
                  user={user} 
                  style={{ marginLeft: '8px', flexShrink: 0 }} 
                  iconColor="#C5A059" 
                  bellSize={18} 
                  dropdownAlign="left"
                />
              </div>
            )}
          </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${item.highlight ? 'new-bill' : ''} ${item.hideOnMobile ? 'hide-on-mobile' : ''}`
              }
            >
              <span className="nav-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {/* Manual lock button */}
          {onLock && (
            <button
              onClick={() => { onLock(); onClose && onClose(); }}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: 600,
                padding: '7px 12px', cursor: 'pointer', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
            >
              <Lock size={14} /> <span>{lang ? 'स्क्रीन लॉक करें' : 'Lock Screen'}</span>
            </button>
          )}
          {/* Fullscreen toggle button */}
          <button
            onClick={() => {
              if (isCurrentlyFullscreen()) exitFullscreen();
              else requestFullscreen();
            }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
              color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600,
              padding: '6px 12px', cursor: 'pointer', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <Maximize2 size={14} /> <span>{isCurrentlyFullscreen() ? (lang ? 'पूर्ण स्क्रीन से बाहर' : 'Exit Fullscreen') : (lang ? 'पूर्ण स्क्रीन' : 'Fullscreen')}</span>
          </button>
          <div className="sidebar-user">
            <div className="sidebar-username" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              {isAdmin ? <Shield size={14} style={{ color: '#facc15' }} /> : <User size={14} />} {admin?.display_name || admin?.username || 'User'}
              <span style={{ fontSize: 9, background: isAdmin ? 'rgba(250,204,21,0.25)' : 'rgba(99,102,241,0.25)', color: isAdmin ? '#facc15' : '#818cf8', padding: '1px 6px', borderRadius: 6, marginLeft: 6, fontWeight: 700 }}>
                {isAdmin ? 'ADMIN' : 'MANAGER'}
              </span>
            </div>
            <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)} title="Logout" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <LogOut size={13} /> {lang ? hi.logout : 'Logout'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── App Layout ─────────────────────────────────────────────────────────────────
import { Outlet } from "react-router-dom";



// ── Fullscreen helpers ─────────────────────────────────────────────────────
function requestFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      const p = el.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      const p = el.webkitRequestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else if (el.mozRequestFullScreen) {
      const p = el.mozRequestFullScreen();
      if (p && p.catch) p.catch(() => {});
    } else if (el.msRequestFullscreen) {
      const p = el.msRequestFullscreen();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* User denied or not supported */ }
}

function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      const p = document.exitFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else if (document.webkitExitFullscreen) {
      const p = document.webkitExitFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else if (document.mozCancelFullScreen) {
      const p = document.mozCancelFullScreen();
      if (p && p.catch) p.catch(() => {});
    } else if (document.msExitFullscreen) {
      const p = document.msExitFullscreen();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { }
}

function isCurrentlyFullscreen() {
  return !!(document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement);
}

function AppLayout() {
  const { isAdmin, user } = useAuth();
  const isTempManager = user?.role === 'temp_manager';
  const isWalkinManager = user?.role === 'walkin_manager';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const idleTimer = React.useRef(null);
  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  // Track fullscreen state changes (user pressed Esc etc.)
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(isCurrentlyFullscreen());
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('mozfullscreenchange', onFSChange);
    document.addEventListener('MSFullscreenChange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      document.removeEventListener('mozfullscreenchange', onFSChange);
      document.removeEventListener('MSFullscreenChange', onFSChange);
    };
  }, []);

  // On first click anywhere in the app → enter fullscreen (requires user gesture)
  useEffect(() => {
    const handleFirstClick = () => {
      if (!isCurrentlyFullscreen()) {
        requestFullscreen();
      }
      // Only need to do this once per session
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);
    return () => document.removeEventListener('click', handleFirstClick);
  }, []);

  // Reset idle timer on any user activity
  const resetIdleTimer = React.useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setIsLocked(true);
    }, IDLE_TIMEOUT);
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => document.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => document.removeEventListener(e, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer]);

  // Swipe-to-open: track touch start X position
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
      // Swipe right from left edge (within 40px) → open
      if (touchStartX < 40 && dx > 60 && dy < 60) setSidebarOpen(true);
      // Swipe left while open → close
      if (sidebarOpen && dx < -60 && dy < 60) setSidebarOpen(false);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [sidebarOpen]);

  // Lock body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 768) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const isOpen = sidebarOpen;

  return (
    <>
      {/* ── Fullscreen Lock Overlay ── */}
      {isLocked && (
        <div className="fullscreen-overlay">
          <div className="fullscreen-box">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h2>Screen Locked</h2>
            <p>Your session was locked due to inactivity.<br />Click below to continue.</p>
            <button onClick={() => {
              setIsLocked(false);
              resetIdleTimer();
              // Re-enter fullscreen after unlock (user gesture here)
              if (!isCurrentlyFullscreen()) {
                requestFullscreen();
              }
            }}>
              🔓 Unlock &amp; Continue
            </button>
          </div>
        </div>
      )}

      <Sidebar open={isOpen} onClose={() => setSidebarOpen(false)} onLock={() => setIsLocked(true)} />

      <div className="app-main">
        {/* Mobile topbar — Premium Centered Instagram-Style Layout */}
        <div className={`mobile-topbar ${isFullscreen ? 'is-fullscreen' : ''}`}>
          <button
            className={`hamburger-btn${isOpen ? ' is-open' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
            style={{ justifySelf: 'start' }}
          >
            <span className="ham-line" style={isOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}}></span>
            <span className="ham-line ham-line-mid" style={isOpen ? { opacity: 0, width: 0 } : {}}></span>
            <span className="ham-line" style={isOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}}></span>
          </button>
          
          <span className="mobile-brand">
            MK Enterprise
          </span>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifySelf: 'end' }}>
              <MobileGlobalSearch />
              <NotificationDropdown 
                user={user} 
                iconColor="#0f172a" 
                bellSize={21} 
              />
            </div>
          ) : (
            <div style={{ width: 33, justifySelf: 'end' }} />
          )}
        </div>

        {/* Facebook Style Top Nav — Manager only, mobile only */}
        {!isAdmin && !isTempManager && (
          <div className={`fb-top-nav ${isFullscreen ? 'is-fullscreen' : ''}`}>
            <NavLink to="/" end className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <BarChart3 size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            <NavLink to="/invoices/new" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <FileText size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            <NavLink to="/products" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <Package size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            <NavLink to="/customers" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <Users size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            {!isWalkinManager && (
              <NavLink to="/walkin-delivery" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
                {({isActive}) => <UserCheck size={24} strokeWidth={isActive ? 2.5 : 2} />}
              </NavLink>
            )}
            <NavLink to="/settings" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <SettingsIcon size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
          </div>
        )}

        {isTempManager && (
          <div className={`fb-top-nav ${isFullscreen ? 'is-fullscreen' : ''}`}>
            <NavLink to="/" end className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <BarChart3 size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            <NavLink to="/customers" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <Users size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            <NavLink to="/invoices/new" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <FileText size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
            <NavLink to="/settings" className={({isActive}) => `fb-top-nav-item ${isActive ? 'active' : ''}`}>
              {({isActive}) => <SettingsIcon size={24} strokeWidth={isActive ? 2.5 : 2} />}
            </NavLink>
          </div>
        )}

        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </>
  );
}

// ── Driver Layout ──────────────────────────────────────────────────────────────
function DriverLayout() {
  const { logout, user } = useAuth();
  const [hasActiveTrip, setHasActiveTrip] = useState(false);

  useEffect(() => {
    const checkActiveTrip = async () => {
      try {
        const res = await tripApi.getAll({ status: 'active', limit: 1 });
        setHasActiveTrip(res.trips && res.trips.length > 0);
      } catch (_) {}
    };
    checkActiveTrip();
    const interval = setInterval(checkActiveTrip, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'var(--sidebar-bg)', padding: '16px 20px', color: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left', overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={16} className="text-light" /> {user?.display_name || user?.username}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={13} style={{ opacity: 0.8 }} /> {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasActiveTrip ? '#10b981' : '#6b7280', display: 'inline-block' }}></span>
          <span style={{ fontSize: 11, fontWeight: 700, color: hasActiveTrip ? '#10b981' : '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {hasActiveTrip ? 'On Trip' : 'Online'}
          </span>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}

// ── Inner app (needs AuthContext) ──────────────────────────────────────────────
function InnerApp() {
  const { isDriver } = useAuth();

  if (isDriver) {
    return (
      <Routes>
        <Route path="/" element={<ProtectedRoute><DriverLayout /></ProtectedRoute>}>
          <Route index element={<DriverDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppProvider>
            <AppLayout />
          </AppProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id/history" element={<CustomerPaymentHistory />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<NewInvoice />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="invoices/:id/edit" element={<EditInvoice />} />
        <Route path="/stock-movements" element={<StockMovements />} />
        <Route path="/vehicle-incoming" element={<VehicleRoute><VehicleIncoming /></VehicleRoute>} />
        <Route path="/walkin-delivery" element={<WalkInDelivery />} />
        <Route path="/vehicle/:id" element={<VehicleRoute><VehicleDetail /></VehicleRoute>} />
        <Route path="/trip/:id" element={<TripView />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id/history" element={<SupplierPaymentHistory />} />
        <Route path="/daily-report" element={<DailyReport />} />
        <Route path="settings" element={<Settings />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<NewOrder />} />
        <Route path="admin" element={<SupervisorRoute><AdminPanel /></SupervisorRoute>} />
      </Route>


      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster 
            position="top-right" 
            containerStyle={{ zIndex: 99999 }}
            toastOptions={{ 
              duration: 3500, 
              style: { 
                fontSize: 13.5,
                background: 'var(--text)',
                color: 'var(--bg)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                padding: '12px 16px',
                fontWeight: 500,
                letterSpacing: '-0.2px'
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: 'var(--bg-card)' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: 'var(--bg-card)' },
              }
            }} 
          />
          <InnerApp />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
