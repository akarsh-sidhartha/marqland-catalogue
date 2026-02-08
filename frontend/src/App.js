import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
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
  AlbumIcon,
  Camera,
  Share2,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

import ProductList from './pages/ProductList';
import VendorList from './pages/VendorList';
import ClientList from './pages/ClientList';
import SavedCatalogues from './pages/SavedCatalogues';
import CatalogueBuilder from './components/CatalogueBuilder';
import OffsiteBuilder from './components/OffsiteBuilder';
import PropertyList from './pages/PropertyList';
import OffsiteCatalogues from './pages/OffsiteCatalogues';
import MarqlandLetterHead from './pages/MarqlandLetterHead';
import InvoiceTracking from './pages/Invoice';
import InvoiceScanMobileVersionPage from './pages/InvoiceScanMobileVersion';
import OrderTracker from './pages/OrderTracker';


/**
 * SIDEBAR COMPONENT
 */
const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState({
    gifting: true,
    offsites: true,
    documentation: true,
    orders: true
  });

  if (location.pathname === '/scaninvoice') {
    return null;
  }

  const isActive = (path) => location.pathname === path;

  const toggleSection = (section) => {
    // If collapsed, expand first before opening a section
    if (isCollapsed) {
      setIsCollapsed(false);
      setOpenSections(prev => ({ ...prev, [section]: true }));
      return;
    }
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const NavLink = ({ to, icon: Icon, label }) => (
    <Link
      to={to}
      title={isCollapsed ? label : ""}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
        isActive(to)
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
          : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
      } ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <Icon size={18} className="shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen shrink-0 transition-all duration-300 ease-in-out`}>
      <div className={`p-6 border-b border-gray-50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <LayoutGrid className="text-white" size={20} />
          </div>
          {!isCollapsed && <span className="font-black text-lg tracking-tighter uppercase truncate">Marqland</span>}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="flex-grow p-4 space-y-8 overflow-y-auto no-scrollbar">
        {/* Orders Section */}
        <nav>
          <button 
            onClick={() => toggleSection('orders')}
            className={`w-full px-4 py-2 mb-1 flex items-center justify-between group focus:outline-none hover:bg-slate-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-600">
              <Package size={12} className="text-indigo-400 shrink-0" /> 
              {!isCollapsed && "Management"}
            </span>
            {!isCollapsed && (openSections.orders ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
          </button>
          {(openSections.orders || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/" icon={Package} label="Order Tracker" />
            </div>
          )}
        </nav>

        {/* Gifting Section */}
        <nav>
          <button 
            onClick={() => toggleSection('gifting')}
            className={`w-full px-4 py-2 mb-1 flex items-center justify-between group focus:outline-none hover:bg-slate-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-600">
              <Gift size={12} className="text-indigo-400 shrink-0" /> 
              {!isCollapsed && "Gifting"}
            </span>
            {!isCollapsed && (openSections.gifting ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
          </button>
          {(openSections.gifting || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/products" icon={Package} label="Products" />
              <NavLink to="/vendors" icon={Users} label="Vendors" />
              <NavLink to="/clients" icon={Building} label="Clients" />
              <NavLink to="/savedcatalogues" icon={Bookmark} label="Saved Catalogues" />
            </div>
          )}
        </nav>

        {/* Offsites Section */}
        <nav>
          <button 
            onClick={() => toggleSection('offsites')}
            className={`w-full px-4 py-2 mb-1 flex items-center justify-between group focus:outline-none hover:bg-slate-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-orange-600">
              <Compass size={12} className="text-orange-400 shrink-0" /> 
              {!isCollapsed && "Offsites"}
            </span>
            {!isCollapsed && (openSections.offsites ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
          </button>
          {(openSections.offsites || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/properties" icon={Map} label="PropertyList" />
              <NavLink to="/saved-offsites" icon={HardDrive} label="Saved Offsites" />
            </div>
          )}
        </nav>
        
        {/* Documentation Section */}
        <nav>
          <button 
            onClick={() => toggleSection('documentation')}
            className={`w-full px-4 py-2 mb-1 flex items-center justify-between group focus:outline-none hover:bg-slate-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-600">
              <FileText size={12} className="text-indigo-400 shrink-0" /> 
              {!isCollapsed && "Documentation"}
            </span>
            {!isCollapsed && (openSections.documentation ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
          </button>
          {(openSections.documentation || isCollapsed) && (
            <div className="flex flex-col gap-1">
              <NavLink to="/MarqlandLetterHead" icon={LetterTextIcon} label="Marqland Letter Head" />
              <NavLink to="/InvoiceTracking" icon={AlbumIcon} label="Invoice Tracking" />
              <NavLink to="/scaninvoice" icon={Camera} label="Mobile Scanner" />
            </div>
          )}
        </nav>   
      </div>
    </aside>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="flex min-h-screen bg-gray-50 font-sans">
        <Sidebar />
        <main className="flex-grow overflow-y-auto h-screen">
          <Routes>
            <Route path="/" element={<OrderTracker/>}/>
            <Route path="/products" element={<ProductList />} />
            <Route path="/vendors" element={<VendorList />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/builder" element={<CatalogueBuilder />} />
            <Route path="/savedcatalogues" element={<SavedCatalogues />} />
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/saved-offsites" element={<OffsiteCatalogues />} />
            <Route path="/offsite-builder" element={<OffsiteBuilder />} />
            <Route path="/MarqlandLetterHead" element={<MarqlandLetterHead />} />
            <Route path="/InvoiceTracking" element={<InvoiceTracking />} />
            <Route path="/scaninvoice" element={<InvoiceScanMobileVersionPage/>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;