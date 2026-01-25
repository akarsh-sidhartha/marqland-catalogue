import React from 'react';
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
  LetterTextIcon
} from 'lucide-react';
import ProductList from './pages/ProductList';
import VendorList from './pages/VendorList';
import ClientList from './pages/ClientList';
import SavedCatalogues from './pages/SavedCatalogues';
import CatalogueBuilder from './components/CatalogueBuilder';
import OffsiteBuilder from './components/OffsiteBuilder';
import PropertyList from './pages/PropertyList';
import OffsiteCatalogues from './pages/OffsiteCatalogues'
import MarqlandLetterHead from './pages/MarqlandLetterHead'


/**
 * Sidebar Component to handle Navigation layout
 */
const Sidebar = () => {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;

  const NavLink = ({ to, icon: Icon, label }) => (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
        isActive(to)
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
          : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-gray-50 flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <LayoutGrid className="text-white" size={20} />
        </div>
        <span className="font-black text-lg tracking-tighter uppercase">Marqland Studios</span>
      </div>

      <div className="flex-grow p-4 space-y-8 overflow-y-auto no-scrollbar">
        {/* GIFTING NAV BAR */}
        <nav>
          <div className="px-4 mb-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Gift size={12} className="text-indigo-400" /> Gifting
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <NavLink to="/" icon={Package} label="Products" />
            <NavLink to="/vendors" icon={Users} label="Vendors" />
            <NavLink to="/clients" icon={Building} label="Clients" />
            <NavLink to="/savedcatalogues" icon={Bookmark} label="Saved Catalogues" />
          </div>
        </nav>

        {/* OFFSITES NAV BAR */}
        <nav>
          <div className="px-4 mb-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Compass size={12} className="text-orange-400" /> Offsites
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <NavLink to="/Properties" icon={Map} label="PropertyList" />
            <NavLink to="/saved-offsites" icon={HardDrive} label="Saved Offsites" />
          </div>
        </nav>
        <nav>
          <div className="px-4 mb-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Gift size={12} className="text-indigo-400" /> Documentation
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <NavLink to="/MarqlandLetterHead" icon={LetterTextIcon} label="Marqland Letter Head" />
          </div>
        </nav>  
      </div>
    </aside>
  );
};

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 font-sans">
        {/* Persistent Side Navigation */}
        <Sidebar />

        {/* Page Content */}
        <main className="flex-grow overflow-y-auto h-screen">
          <Routes>
            {/* Gifting Routes */}
            <Route path="/" element={<ProductList />} />
            <Route path="/vendors" element={<VendorList />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/builder" element={<CatalogueBuilder />} />
            <Route path="/savedcatalogues" element={<SavedCatalogues />} />
            
            {/* Offsite Routes */}
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/saved-offsites" element={<OffsiteCatalogues />} />
            <Route path="/offsite-builder" element={<OffsiteBuilder />} />

            <Route path="/MarqlandLetterHead" element={<MarqlandLetterHead />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;