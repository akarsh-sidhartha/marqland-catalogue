import React, { useState, useEffect } from 'react';
import api from '../api';
import { FileText, Search, Trash2, Calendar, Loader2, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

const App = () => {
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCatalogues = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/offsitecatalogues');
      // Handle both response shapes from backend
      if (Array.isArray(response.data?.data)) {
        setCatalogues(response.data.data);
      } else if (Array.isArray(response.data?.catalogues)) {
        setCatalogues(response.data.catalogues);
      } else if (Array.isArray(response.data)) {
        setCatalogues(response.data);
      } else {
        setCatalogues([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      if (err.code === 'ERR_NETWORK') {
        setError("Cannot connect to server. Please ensure the backend is running.");
      } else if (err.code === 'ECONNABORTED') {
        setError("Connection timed out. The server took too long to respond.");
      } else {
        setError("Failed to load catalogues: " + (err.response?.data?.message || err.message));
      }
      setCatalogues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalogues(); }, []);

  const deleteCatalogue = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this catalogue?")) return;
    try {
      await api.delete(`/offsitecatalogues/${id}`); // ← fixed: was using string replace hack
      setCatalogues(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete. Please try again.");
    }
  };

  const handleEdit = (cat) => {
    const mappedCat = { ...cat, name: cat.title || cat.name || "Untitled Proposal" };
    localStorage.setItem('edit_offsite_catalogue', JSON.stringify(mappedCat));
    window.open('/offsite-builder', '_blank');
  };

  const filtered = (Array.isArray(catalogues) ? catalogues : []).filter(cat => {
    const nameStr     = (cat.name || cat.title || "").toLowerCase();
    const subtitleStr = (cat.subtitle || "").toLowerCase();
    const searchStr   = searchTerm.toLowerCase();
    return nameStr.includes(searchStr) || subtitleStr.includes(searchStr);
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 bg-[#f8fafc]">
      <Loader2 className="animate-spin mb-4" size={32} />
      <p className="text-sm font-medium tracking-widest uppercase">Syncing your proposals...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-red-500 bg-[#f8fafc] p-6 text-center">
      <div className="bg-red-50 p-4 rounded-full mb-4"><AlertCircle size={48} /></div>
      <h3 className="text-xl font-bold mb-2 text-slate-900">Connection Failed</h3>
      <p className="text-slate-500 mb-8 max-w-md text-sm leading-relaxed">{error}</p>
      <button onClick={fetchCatalogues}
        className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
        <RefreshCw size={16} /> Try Reconnecting
      </button>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans bg-[#f8fafc] min-h-screen text-slate-900">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offsite Catalogues</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and edit your saved property proposals.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={fetchCatalogues} disabled={loading}
            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 rounded-2xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Catalogues">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search proposals..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 ring-indigo-500/20 outline-none transition-all shadow-sm"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <FileText size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">
            {searchTerm ? "No matches found" : "No Saved Proposals"}
          </h3>
          <p className="text-slate-400 max-w-xs mx-auto mt-2 text-sm leading-relaxed">
            {searchTerm ? "Try a different search term." : "Create a proposal from the Property List to see it here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((cat) => (
            <div key={cat._id} onClick={() => handleEdit(cat)}
              className="group bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden flex flex-col">
              <div className="p-7 flex-1">
                <h3 className="text-xl font-bold leading-snug group-hover:text-indigo-600 transition-colors">
                  {cat.title || cat.name || "Untitled Proposal"}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 mb-4">
                  {cat.description || 'General Proposal'}
                </p>
                <div className="flex items-center gap-4 mt-6">
                  <div className="flex -space-x-2 overflow-hidden">
                    {cat.items?.slice(0, 3).map((item, i) => (
                      <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-slate-400">P</div>
                        )}
                      </div>
                    ))}
                    {cat.items?.length > 3 && (
                      <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-800 flex items-center justify-center text-[8px] font-bold text-white">
                        +{cat.items.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {cat.items?.length || 0} Properties
                  </span>
                </div>
              </div>
              <div className="px-7 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar size={12} />
                  <span className="text-[10px] font-bold">
                    {new Date(cat.updatedAt || cat.timestamp || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                  Edit <ChevronRight size={12} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => deleteCatalogue(cat._id, e)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;