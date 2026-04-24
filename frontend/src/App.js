import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  Gift,
  Package,
  Users,
  Building,
  Bookmark,
  Compass,
  Map,
  HardDrive,
  LayoutGrid,
  LetterTextIcon,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Shield,
  Activity,
  TrendingUp,
  Truck 
} from 'lucide-react';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';
import PublicAdminPoral from './pages/public-site/AdminView';
import ChangePassword from './pages/ChangePassword';

import ProductList from './pages/ProductList';
import VendorList from './pages/VendorList';
import ClientList from './pages/ClientList';
import SavedCatalogues from './pages/SavedCatalogues';
import CatalogueBuilder from './components/CatalogueBuilder';
import OffsiteBuilder from './components/OffsiteBuilder';
import PropertyList from './pages/PropertyList';
import OffsiteCatalogues from './pages/OffsiteCatalogues';
import MarqlandLetterHead from './pages/MarqlandLetterHead';
//import InvoiceTracking from './pages/Invoice';
//import InvoiceScanMobileVersionPage from './pages/InvoiceScanMobileVersion';
import OrderTracker from './pages/OrderTracker';
import SamplesProvided from './pages/SamplesProvided';
import SourcingHub from './pages/SourcingHub';
import PaymentTracker from './pages/PaymentTracker';
import ClientPortalView from './pages/ClientPortalView';
import ActivityLogView from './pages/ActivityLogView';
import TrendingProducts from './pages/TrendingProducts';
import CourierTracking from './pages/CourierTracking';

// ── Route keys matching ALL_ROUTES in UserManagement ─────────────────────────
// Maps each path to its route key so ProtectedRoute can check allowedRoutes.
const PATH_TO_ROUTE_KEY = {
  '/':                   'Order Tracker',
  '/sourcinghub':        'Sourcing Hub',
  '/products':           'Products',
  '/samplesprovided':    'Samples Provided',
  '/savedcatalogues':    'Saved Catalogues',
  '/paymenttracker':     'Payment Tracker',
  '/vendors':            'Vendors',
  '/clients':            'Clients',
  '/MarqlandLetterHead': 'Letter Head',
  '/properties':         'Property List',
  '/saved-offsites':     'Saved Offsites',
  '/admin/users':        'User Management',
  '/admin/logs':         'Activity Logs',
  '/trending-products':  'Trending Products',
  '/courier-tracking':   'Courier Tracking',
  // ⚠ Add new routes here AND in ALL_ROUTES in UserManagement.js
};

// Role-based defaults (mirrors ROLE_DEFAULTS in UserManagement)
const ROLE_DEFAULTS = {
  admin:     Object.values(PATH_TO_ROUTE_KEY),
  accounts:  ['Order Tracker','Payment Tracker','Vendors','Clients','Invoice Tracking'],
  sales:     ['Order Tracker','Sourcing Hub','Products','Saved Catalogues','Clients','Property List','Saved Offsites'],
  inventory: ['Products','Samples Provided','Saved Catalogues','Sourcing Hub','Property List','Saved Offsites'],
  courier: ['Courier Tracking'],
  viewer:    ['Order Tracker'],
};

// Get effective allowed routes for user — custom list wins over role default
const getUserRoutes = (user) =>
  user?.allowedRoutes?.length ? user.allowedRoutes : (ROLE_DEFAULTS[user?.role] || []);

// ── Protected route wrapper ───────────────────────────────────────────────────
const ProtectedRoute = ({ children, routeKey }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  // Admins always pass
  if (user.role === 'admin') return children;
  // Determine route key from prop or from current path
  const key = routeKey || PATH_TO_ROUTE_KEY[location.pathname];
  if (key && !getUserRoutes(user).includes(key)) {
    // Redirect to home silently instead of showing Access Denied
    return <Navigate to="/" replace />;
  }
  return children;
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState({
    gifting: true, offsites: true, documentation: true, orders: true,
  });

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  if (location.pathname === '/scaninvoice' || (isMobile && location.pathname.startsWith('/paymenttracker'))) {
    return null;
  }

  const isActive = (path) => location.pathname === path;

  const toggleSection = (section) => {
    if (isCollapsed) { setIsCollapsed(false); setOpenSections(prev => ({ ...prev, [section]: true })); return; }
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const NavLink = ({ to, icon: Icon, label, routeKey }) => {
    // Hide link if user doesn't have access
    const key = routeKey || PATH_TO_ROUTE_KEY[to];
    if (user?.role !== 'admin' && key && !getUserRoutes(user).includes(key)) return null;
    return (
      <Link
        to={to}
        title={isCollapsed ? label : ''}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${isActive(to) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
      >
        <Icon size={18} className="shrink-0" />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const SectionBtn = ({ sectionKey, icon: Icon, label, accent = 'indigo' }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className={`w-full px-4 py-2 mb-1 flex items-center justify-between group focus:outline-none hover:bg-slate-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <span className={`text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-${accent}-600`}>
        <Icon size={12} className={`text-${accent}-400 shrink-0`} />
        {!isCollapsed && label}
      </span>
      {!isCollapsed && (openSections[sectionKey] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
    </button>
  );

  const roleColors = {
    admin: 'bg-indigo-100 text-indigo-700',
    accounts: 'bg-green-100 text-green-700',
    sales: 'bg-yellow-100 text-yellow-700',
    inventory: 'bg-blue-100 text-blue-700',
    courier: 'bg-purple-100 text-purple-700',
    viewer: 'bg-gray-100 text-gray-600',
  };

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen shrink-0 transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className={`p-6 border-b border-gray-50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <LayoutGrid className="text-white" size={20} />
          </div>
          {!isCollapsed && <span className="font-black text-lg tracking-tighter uppercase truncate">Marqland</span>}
        </div>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-grow p-4 space-y-8 overflow-y-auto no-scrollbar">
        <nav>
          <SectionBtn sectionKey="orders" icon={Package} label="Management" />
          {(openSections.orders || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/" icon={Package} label="Order Tracker" />
              <NavLink to="/courier-tracking" icon={Truck} label="Courier Tracking" />
              <NavLink to="/sourcinghub" icon={Package} label="Sourcing Hub" />
            </div>
          )}
        </nav>

        <nav>
          <SectionBtn sectionKey="gifting" icon={Gift} label="Gifting" />
          {(openSections.gifting || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/products" icon={Package} label="Products" />
              <NavLink to="/samplesprovided" icon={Package} label="Samples Provided" />
              <NavLink to="/savedcatalogues" icon={Bookmark} label="Saved Catalogues" />
              <NavLink to="/trending-products" icon={TrendingUp} label="Trending Products" />
            </div>
          )}
        </nav>

        <nav>
          <SectionBtn sectionKey="documentation" icon={FileText} label="Documentation" />
          {(openSections.documentation || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/paymenttracker" icon={Bookmark} label="Invoice & Payment Tracker" />
              <NavLink to="/vendors" icon={Users} label="Vendors" />
              <NavLink to="/clients" icon={Building} label="Clients" />
              <NavLink to="/MarqlandLetterHead" icon={LetterTextIcon} label="Letter Head" />
            </div>
          )}
        </nav>

        <nav>
          <SectionBtn sectionKey="offsites" icon={Compass} label="Offsites" accent="orange" />
          {(openSections.offsites || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/properties" icon={Map} label="Property List" />
              <NavLink to="/saved-offsites" icon={HardDrive} label="Saved Offsites" />
            </div>
          )}
        </nav>

        {/* Admin section */}
        {user?.role === 'admin' && (
          <nav>
            <SectionBtn sectionKey="admin" icon={Shield} label="Admin" />
            <div className="flex flex-col gap-1">
              <NavLink to="/admin/users" icon={Shield} label="User Management" />
              <NavLink to="/admin/logs" icon={Activity} label="Activity Logs" />
              <NavLink to="/public-site-admin" icon={Shield} label="Public Admin Management" />
            </div>
          </nav>
        )}

        {/* Change password — all users */}
        <nav>
          <div className="flex flex-col gap-1">
            <NavLink to="/change-password" icon={Shield} label="Change Password" />
          </div>
        </nav>
      </div>

      {/* User + logout footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
              {(user?.name || user?.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-gray-800 truncate">{user?.name}</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColors[user?.role] || roleColors.viewer}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}
      {isCollapsed && (
        <div className="p-3 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
};

const AppShell = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  // ── Invite token intercept ────────────────────────────────────────────────────
  const _hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?'))
    : '';
  const urlToken = new URLSearchParams(window.location.search).get('token')
    || new URLSearchParams(_hashQuery).get('token');
  if (urlToken) return <LoginPage />;

  // ── Public routes — accessible without login ──────────────────────────────────
  // /p/:slug  = client portal view (sent to clients via email)
  // /respond/:id = vendor response (sourcing hub)
  const publicPaths = ['/p/', '/respond/'];
  if (publicPaths.some(p => window.location.pathname.startsWith(p))) {
    return (
      <Routes>
        <Route path="/p/:slug" element={<ClientPortalView />} />
        <Route path="/respond/:id" element={<SourcingHub />} />
      </Routes>
    );
  }

  // ── Not logged in → show login page ──────────────────────────────────────────
  if (!user) return <LoginPage />;

  // ── Logged in → full app ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-grow overflow-y-auto h-screen">
        <Routes>
          {/* Management */}
          <Route path="/" element={<ProtectedRoute routeKey="Order Tracker"><OrderTracker /></ProtectedRoute>} />
          <Route path="/courier-tracking" element={<ProtectedRoute routeKey="Courier Tracking"><CourierTracking /></ProtectedRoute>} />
          <Route path="/sourcinghub" element={<ProtectedRoute routeKey="Sourcing Hub"><SourcingHub /></ProtectedRoute>} />

          {/* Gifting */}
          <Route path="/products" element={<ProtectedRoute routeKey="Products"><ProductList /></ProtectedRoute>} />
          <Route path="/samplesprovided" element={<ProtectedRoute routeKey="Samples Provided"><SamplesProvided /></ProtectedRoute>} />
          <Route path="/savedcatalogues" element={<ProtectedRoute routeKey="Saved Catalogues"><SavedCatalogues /></ProtectedRoute>} />
          <Route path="/builder" element={<ProtectedRoute routeKey="Saved Catalogues"><CatalogueBuilder /></ProtectedRoute>} />
          <Route path="/trending-products" element={<ProtectedRoute routeKey="Trending Products"><TrendingProducts /></ProtectedRoute>} />

          {/* Documentation */}
          <Route path="/paymenttracker" element={<ProtectedRoute routeKey="Payment Tracker"><PaymentTracker /></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute routeKey="Vendors"><VendorList /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute routeKey="Clients"><ClientList /></ProtectedRoute>} />
          <Route path="/MarqlandLetterHead" element={<ProtectedRoute routeKey="Letter Head"><MarqlandLetterHead /></ProtectedRoute>} />

          {/* Offsites */}
          <Route path="/properties" element={<ProtectedRoute routeKey="Property List"><PropertyList /></ProtectedRoute>} />
          <Route path="/saved-offsites" element={<ProtectedRoute routeKey="Saved Offsites"><OffsiteCatalogues /></ProtectedRoute>} />
          <Route path="/offsite-builder" element={<ProtectedRoute routeKey="Saved Offsites"><OffsiteBuilder /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin/users" element={<ProtectedRoute routeKey="User Management"><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute routeKey="User Management"><ActivityLogView /></ProtectedRoute>} />
          <Route path="/public-site-admin" element={<ProtectedRoute routeKey="User Management"><PublicAdminPoral /></ProtectedRoute>} />

          {/* All users */}
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Public routes also accessible when logged in */}
          <Route path="/p/:slug" element={<ClientPortalView />} />
          <Route path="/respond/:id" element={<SourcingHub />} />
        </Routes>
      </main>
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}

export default App;