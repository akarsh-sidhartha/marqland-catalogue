import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Search, X, RefreshCw, Trash2, Edit3 } from 'lucide-react';

const SavedCatalogues = () => {
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getBaseUrl = () => {
    const { hostname } = window.location;
    // If we are on localhost, use localhost. 
    // Otherwise, use the IP address currently in the browser's address bar.
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
      ? 'localhost' 
      : hostname;
    return `http://${host}:5000/api`;
  };

  const API_URL_PRODUCT_CATALOGUES = `${getBaseUrl()}/catalogues`;

  /* const getApiUrl = () => {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:5000/api/catalogues`;
  }; 

  const API_BASE_URL = getApiUrl();
*/
  const fetchCatalogues = useCallback(async (retries = 3, delay = 1000) => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(API_URL_PRODUCT_CATALOGUES);
      setCatalogues(res.data || []);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchCatalogues(retries - 1, delay * 2), delay);
      } else {
        setError(`Connection Failed: Server not reachable at ${API_URL_PRODUCT_CATALOGUES}`);
      }
    } finally {
      setLoading(false);
    }
  }, [API_URL_PRODUCT_CATALOGUES]);

  useEffect(() => {
    fetchCatalogues();
  }, [fetchCatalogues]);

  const handleOpen = (cat) => {
    try {
      localStorage.setItem('current_catalogue_items', JSON.stringify(cat.items));
      localStorage.setItem('current_catalogue_id', cat._id);
      localStorage.setItem('current_catalogue_name', cat.name);
      localStorage.setItem('current_catalogue_subtitle', cat.subtitle || '');
      localStorage.removeItem('catalogue_selection');
      window.open('/builder', '_blank');
    } catch (e) {
      alert("Error: Please allow pop-ups for this site.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this saved state?")) {
      try {
        await axios.delete(`${API_URL_PRODUCT_CATALOGUES}/${id}`);
        fetchCatalogues();
      } catch (err) {
        alert("Delete failed. Check server connection.");
      }
    }
  };

  const filteredCatalogues = useMemo(() => {
    if (!searchTerm.trim()) return catalogues;
    const term = searchTerm.toLowerCase();
    return catalogues.filter(cat => 
      cat.name?.toLowerCase().includes(term) || 
      cat.subtitle?.toLowerCase().includes(term)
    );
  }, [catalogues, searchTerm]);

  if (loading && catalogues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Accessing Database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <div className="bg-red-50 border border-red-100 rounded-3xl p-8">
          <h2 className="text-xl font-black text-gray-800 uppercase mb-2">Server Not Found</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button onClick={() => fetchCatalogues()} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100">Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* CONSOLIDATED HEADER CONTROL */}
      <div className="bg-white p-2.5 rounded-[1.5rem] shadow-sm border border-gray-100 mb-10 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Title Section */}
        <div className="px-4 py-1 border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0">
          <h1 className="text-lg font-black text-gray-900 uppercase tracking-tighter leading-none py-1">Saved Catalogues</h1>
        </div>
        
        {/* Search Bar with Internal Reset */}
        <div className="relative flex-grow group">
          <input 
            type="text" 
            placeholder="Search catalogues..."
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-transparent bg-gray-50 group-hover:bg-gray-100 focus:bg-white focus:border-indigo-100 outline-none text-sm font-medium transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={3} />
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <button 
          onClick={() => fetchCatalogues()} 
          className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-indigo-600 hover:border-indigo-100 rounded-xl transition-all shadow-sm flex-shrink-0 flex items-center justify-center group"
          title="Refresh List"
        >
          <RefreshCw size={18} className={`${loading ? 'animate-spin text-indigo-500' : 'group-active:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>

      {filteredCatalogues.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] p-20 text-center">
          <h3 className="text-lg font-black text-gray-400 uppercase tracking-tight">
            {searchTerm ? "No matches found" : "Archive is Empty"}
          </h3>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-4 text-indigo-600 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 mx-auto hover:bg-indigo-50 px-4 py-2 rounded-lg transition-all"
            >
              <X size={12} strokeWidth={3} />
              Reset Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatalogues.map(cat => (
            <div key={cat._id} className="group bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:border-indigo-200 transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h3 className="font-black text-gray-900 uppercase text-xl leading-tight group-hover:text-indigo-600 transition-colors truncate pr-2">
                    {cat.name}
                  </h3>
                  {cat.subtitle && <p className="text-[10px] text-gray-400 italic mt-1 line-clamp-1">{cat.subtitle}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter">
                      {cat.items?.length || 0} Products
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                      {new Date(cat.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(cat._id)} className="bg-gray-50 text-gray-300 hover:bg-red-50 hover:text-red-500 p-3 rounded-2xl transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
              <button 
                onClick={() => handleOpen(cat)} 
                className="w-full bg-indigo-600 hover:bg-black text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
              >
                <Edit3 size={14} />
                Edit Catalogue
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedCatalogues;