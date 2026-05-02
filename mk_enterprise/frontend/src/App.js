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
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import './App.css';
import Orders from './pages/Orders';
import NewOrder from './pages/NewOrder';
import AdminPanel from './pages/AdminPanel';
import WalkInDelivery from './pages/WalkInDelivery';
import DriverDashboard from './pages/DriverDashboard';

// ── Protected Route wrapper ────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 12px' }}></div>
        <div style={{ color: '#6b7280' }}>Loading mk_enterprise_site...</div>
      </div>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── Supervisor-Only Route wrapper ──────────────────────────────────────────────
function SupervisorRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, onLock }) {
  const { logout, admin, isAdmin } = useAuth();
  const { settings } = useApp();
  const lang = settings.language === 'hi';

  const navItems = [
    { to: '/', label: lang ? hi.dashboard : 'Dashboard', icon: '📊', exact: true },
    { to: '/invoices/new', label: lang ? hi.newBill : 'New Bill', icon: '🧾', highlight: true },
    { to: '/invoices', label: lang ? hi.invoices : 'Invoice History', icon: '📋' },
    { to: '/products', label: lang ? hi.products : 'Products', icon: '📦' },
    { to: '/customers', label: lang ? hi.customers : 'Customers', icon: '👥' },
    ...(isAdmin ? [{ to: '/vehicle-incoming', label: 'Vehicles', icon: '🚛' }] : []),
    ...(!isAdmin ? [{ to: '/walkin-delivery', label: 'Walk-in Delivery', icon: '🚶' }] : []),
    { to: '/suppliers', label: 'Suppliers', icon: '🏭' },
    { to: '/stock-movements', label: lang ? hi.stockMovements : 'Stock Movements', icon: '🔄' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin Panel', icon: '👑' }] : []),
    { to: '/settings', label: lang ? hi.settings : 'Settings', icon: '⚙️' },
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
            backdropFilter: 'blur(1px)',
          }}
        />
      )}

      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '16px 16px 12px' }}>
          {/* Profile image */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
            }}>
              {/* Replace src with real image path when available */}
              <img
                src="/logo192.png"
                alt="profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerText = '🏪'; }}
              />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div className="brand-text" style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Mehta Traders
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>
                {settings.business_name || 'Business Management'}
              </div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${item.highlight ? 'new-bill' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
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
              🔒 <span>Lock Screen</span>
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
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            ⛶ <span>{isCurrentlyFullscreen() ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
          <div className="sidebar-user">
            <div className="sidebar-username">
              {isAdmin ? '👑' : '👤'} {admin?.display_name || admin?.username || 'User'}
              <span style={{ fontSize: 9, background: isAdmin ? 'rgba(250,204,21,0.25)' : 'rgba(99,102,241,0.25)', color: isAdmin ? '#facc15' : '#818cf8', padding: '1px 6px', borderRadius: 6, marginLeft: 6, fontWeight: 700 }}>
                {isAdmin ? 'ADMIN' : 'MANAGER'}
              </span>
            </div>
            <button className="logout-btn" onClick={() => { logout(); onClose && onClose(); }} title="Logout">
              {lang ? hi.logout : 'Logout'}
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
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } catch (e) { /* User denied or not supported */ }
}

function exitFullscreen() {
  try {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } catch (e) { }
}

function isCurrentlyFullscreen() {
  return !!(document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement);
}

function AppLayout() {
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
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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

      {/* Overlay — click outside closes sidebar on mobile */}
      {isOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 998,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.22s ease',
          }}
        />
      )}

      <div className="app-main">
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button
            className={`hamburger-btn${isOpen ? ' is-open' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span className="ham-line" style={isOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}}></span>
            <span className="ham-line ham-line-mid" style={isOpen ? { opacity: 0, width: 0 } : {}}></span>
            <span className="ham-line" style={isOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}}></span>
          </button>
          <span className="mobile-brand">🏪 MK Enterprise</span>
        </div>

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
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: 'var(--sidebar-bg)', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>🏪 MK Driver</div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Logout</button>
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
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<NewInvoice />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="invoices/:id/edit" element={<EditInvoice />} />
        <Route path="/stock-movements" element={<StockMovements />} />
        <Route path="/vehicle-incoming" element={<VehicleIncoming />} />
        <Route path="/walkin-delivery" element={<WalkInDelivery />} />
        <Route path="/vehicle/:id" element={<VehicleDetail />} />
        <Route path="/suppliers" element={<Suppliers />} />
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
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: 13.5 } }} />
        <InnerApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
