import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Search, X, Plus, ChevronDown, ChevronRight, MapPin, 
  Trash2, Edit3, Phone, Mail, User, Building, Globe, Image as ImageIcon,
  RotateCcw, Save, PlusCircle, MinusCircle, Percent, TrendingUp,
  Link as LinkIcon, Filter, ExternalLink, Info, CheckCircle2, Circle, Briefcase,
  Music, Utensils, Home, FileText
} from 'lucide-react';

const PropertyManager = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());
  
    // State for the "Add to Existing" feature
    const [showCatalogueModal, setShowCatalogueModal] = useState(false);
    const [savedCatalogues, setSavedCatalogues] = useState([]);
    const [isUpdatingCatalogue, setIsUpdatingCatalogue] = useState(false);

  // Selection State
  const [selectedProperties, setSelectedProperties] = useState(new Set());
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // UI States
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

    /**
   * API ENDPOINT CONFIGURATION
   * Dynamically detects the host IP to ensure other laptops in the 
   * office network can communicate with the backend server.
   */
  const getBaseUrl = () => {
    const { hostname } = window.location;
    // If we are on localhost, use localhost. 
    // Otherwise, use the IP address currently in the browser's address bar.
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
      ? 'localhost' 
      : hostname;
    return `http://${host}:5000/api`;
  };

  const API_URL_PROPERTIES = `${getBaseUrl()}/properties`;
  const API_URL_OFFSITE = `${getBaseUrl()}/offsitecatalogues`;

    // Determine the API Base URL based on the current environment
    //getApiUrlForProperties and getApiUrlForOffsiteCatalogue to be deleted.
  /* const getApiUrlForProperties = () => {
    const hostname = window.location.hostname;
    // If running in a cloud/preview environment, we might need a relative path or specific proxy
    // For local development, it defaults to localhost:5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:5000/api/properties`;
    }
    // Fallback for custom local network IPs or production
    return `http://${hostname}:5000/api/properties`;
  };

  const getApiUrlForOffsiteCatalogue = () => {
    // If running in a cloud/preview environment, we might need a relative path or specific proxy
    // For local development, it defaults to localhost:5000
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:5000/api/offsitecatalogues`;
    }
    // Fallback for custom local network IPs or production
    return `http://${hostname}:5000/api/offsitecatalogues`;
  }
*/
  // This is the working API, you can switch back to this API. 
  //const API_BASE_URL = window.location.hostname === 'localhost' ? `http://localhost:5000/api/properties` : `/api/properties`;

  const calculateSelling = (purchase, margin) => {
    const p = parseFloat(purchase) || 0;
    const m = parseFloat(margin) || 0;
    return Math.round(p * (1 + m / 100));
  };

  const initialFormState = {
    propertyName: '',
    state: '',
    place: '',
    website: '',
    imageUrl: '',
    type: 'Night Stay',
    totalInventory: '',
    purchasePriceDouble: '',
    marginDouble: 15,
    purchasePriceTriple: '',
    marginTriple: 15,
    cocktailSnacks: '',
    djCost: '',
    banquetHall: '',
    licenseFeeDJ: '',
    details: '',
    contacts: [{ name: '', phone: '', email: '' }]
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      //const res = await axios.get(API_BASE_URL);
      const res = await axios.get(API_URL_PROPERTIES);
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const mappedData = data.map(p => ({
        ...p,
        purchasePriceDouble: p.purchasePriceDouble || Math.round(p.doublePrice / 1.15) || 0,
        marginDouble: p.marginDouble || 15,
        purchasePriceTriple: p.purchasePriceTriple || Math.round(p.triplePrice / 1.15) || 0,
        marginTriple: p.marginTriple || 15
      }));
      setProperties(mappedData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  const resetFilters = () => {
    setSearchTerm('');
    setStateFilter('');
    setCategoryFilter('All');
    setMinPrice('');
    setMaxPrice('');
  };

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const toggleSelection = (id, e) => {
    e.stopPropagation();
    const newSelection = new Set(selectedProperties);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedProperties(newSelection);
  };

  const selectAllFiltered = () => {
    const allIds = filteredProperties.map(p => p._id);
    setSelectedProperties(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedProperties(new Set());
  };

  const handleAddToCatalogue = () => {
    const selectedData = properties.filter(p => selectedProperties.has(p._id)).map(p => {
      // Base data common to both types
      const commonData = {
        propertyName: p.propertyName,
        state: p.state,
        place: p.place,
        website: p.website,
        image: p.imageUrl,
        details: p.details,
        type: p.type // Useful for the builder to know the category
      };

      if (p.type === 'Night Stay') {
        return {
          ...commonData,
          // Calculate selling prices on the fly to ensure accuracy
          doublePrice: calculateSelling(p.purchasePriceDouble, p.marginDouble),
          triplePrice: calculateSelling(p.purchasePriceTriple, p.marginTriple),
          djCost: Number(p.djCost) || 0,
          licenseFeeDJ: Number(p.licenseFeeDJ) || 0,
          cocktailSnacks: Number(p.cocktailSnacks) || 0,
          banquetHall: Number(p.banquetHall) || 0
        };
      } else {
        // Day Outing Mapping
        return {
          ...commonData,
          // For Day Outing, 'package price' usually maps to the doublePrice field
          packagePrice: calculateSelling(p.purchasePriceDouble, p.marginDouble)
        };
      }
    });

    localStorage.setItem('offsite_selection', JSON.stringify(selectedData));
    window.open('/offsite-builder', '_blank');
  };
  
    const openAddToExistingModal = async () => {
    setShowCatalogueModal(true);
    //const baseUrl = `http://${hostname}:5000/api/offsitecatalogues`;
    try {
      // below 2 lines are working code. 
      //const hostname = window.location.hostname || 'localhost';
      //const res = await axios.get(`http://${hostname}:5000/api/offsitecatalogues`);
      const res = await axios.get(API_URL_OFFSITE);

      console.log(" openAddToExistingModal res = ",res);
      setSavedCatalogues(Array.isArray(res.data.data) ? res.data.data : []);
      console.log("savedCatalogues value = ",savedCatalogues);
    } catch (err) {
      console.error("Failed to fetch catalogues", err);
      setSavedCatalogues([]);
    } 
  };

    const appendToCatalogue = async (targetCat) => {
    if (!targetCat || isUpdatingCatalogue) return;
    setIsUpdatingCatalogue(true);
    try {
      
      
      // akarsh changes
       const selectedData = properties.filter(p => selectedProperties.has(p._id)).map(p => {
      // Base data common to both types
      const commonData = {
        propertyName: p.propertyName,
        state: p.state,
        place: p.place,
        website: p.website,
        image: p.imageUrl,
        details: p.details,
        type: p.type // Useful for the builder to know the category
      };

      if (p.type === 'Night Stay') {
        return {
          ...commonData,
          // Calculate selling prices on the fly to ensure accuracy
          doublePrice: calculateSelling(p.purchasePriceDouble, p.marginDouble),
          triplePrice: calculateSelling(p.purchasePriceTriple, p.marginTriple),
          djCost: Number(p.djCost) || 0,
          licenseFeeDJ: Number(p.licenseFeeDJ) || 0,
          cocktailSnacks: Number(p.cocktailSnacks) || 0,
          banquetHall: Number(p.banquetHall) || 0
        };
      } else {
        // Day Outing Mapping
        return {
          ...commonData,
          // For Day Outing, 'package price' usually maps to the doublePrice field
          packagePrice: calculateSelling(p.purchasePriceDouble, p.marginDouble)
        };
      }
    });
    console.log(" inside appendToCatalogue and selectedData values are = ",selectedData)
      // akarsh changes end 
      const updatedPayload = {
         id: targetCat._id,
         name: targetCat.name,
         subtitle: targetCat.subtitle,
         items: [...(targetCat.items || []), ...selectedData]
      };
      // below 2 lines are working APIS. 
      //const hostname = window.location.hostname || 'localhost';
      //await axios.post(`http://${hostname}:5000/api/offsitecatalogues`, updatedPayload);
      await axios.post(API_URL_OFFSITE,updatedPayload);
      setSavedCatalogues([]);
      setShowCatalogueModal(false);
    } catch (err) {
      console.error("Error updating catalogue: ", err);
    } finally {
      setIsUpdatingCatalogue(false);
    }
  };

    const handleSave = async () => {
    // Calculate final selling prices before saving
    const sellingDouble = calculateSelling(formData.purchasePriceDouble, formData.marginDouble);
    const sellingTriple = calculateSelling(formData.purchasePriceTriple, formData.marginTriple);

    // Ensure we send numbers to the backend, even if inputs were strings
    const payload = {
      ...formData,
      doublePrice: sellingDouble,
      triplePrice: formData.type === 'Night Stay' ? sellingTriple : 0,
      // Explicitly ensuring these are numbers
      cocktailSnacks: Number(formData.cocktailSnacks) || 0,
      djCost: Number(formData.djCost) || 0,
      banquetHall: Number(formData.banquetHall) || 0,
      licenseFeeDJ: Number(formData.licenseFeeDJ) || 0,
      purchasePriceDouble: Number(formData.purchasePriceDouble) || 0,
      purchasePriceTriple: Number(formData.purchasePriceTriple) || 0,
      marginDouble: Number(formData.marginDouble) || 0,
      marginTriple: Number(formData.marginTriple) || 0,
      totalInventory: Number(formData.totalInventory) || 0
    };

    try {
      if (isEditing) {
        //await axios.put(`${API_BASE_URL}/${currentId}`, payload);
        await axios.put(API_URL_PROPERTIES+`/${currentId}`, payload);
      } else {
        //await axios.post(API_BASE_URL, payload);
        await axios.post(API_URL_PROPERTIES, payload);
      }
      setShowModal(false);
      fetchProperties(); // Refresh list
    } catch (err) {
      console.error("Failed to save property:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      //await axios.delete(`${API_BASE_URL}/${deleteId}`);
      await axios.delete(API_URL_PROPERTIES+`/${deleteId}`);
      setProperties(properties.filter(p => p._id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error("Delete failed");
    }
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [...formData.contacts, { name: '', phone: '', email: '' }]
    });
  };

  const removeContact = (index) => {
    const newContacts = [...formData.contacts];
    newContacts.splice(index, 1);
    setFormData({ ...formData, contacts: newContacts });
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...formData.contacts];
    newContacts[index][field] = value;
    setFormData({ ...formData, contacts: newContacts });
  };

  const uniqueStates = useMemo(() => {
    const states = properties.map(p => p.state).filter(Boolean);
    return [...new Set(states)].sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const sellingP = calculateSelling(p.purchasePriceDouble, p.marginDouble);
      const matchesSearch = (p.propertyName || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = !stateFilter || p.state === stateFilter;
      const matchesCategory = categoryFilter === 'All' || p.type === categoryFilter;
      const matchesMin = !minPrice || sellingP >= parseFloat(minPrice);
      const matchesMax = !maxPrice || sellingP <= parseFloat(maxPrice);
      return matchesSearch && matchesState && matchesCategory && matchesMin && matchesMax;
    });
  }, [properties, searchTerm, stateFilter, categoryFilter, minPrice, maxPrice]);

  return (
    <div className="p-6 bg-[#F8FAFC] min-h-screen font-sans text-slate-900 pb-32">
      
      {/* Header & Main Search */}
      <div className="max-w-7xl mx-auto mb-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
             <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 outline-none focus:ring-4 ring-indigo-50 transition-all font-bold shadow-sm" 
               placeholder="Search properties by name..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
          <button onClick={() => { setIsEditing(false); setFormData(initialFormState); setShowModal(true); }} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100">
           <Plus size={20} /> Add Property
         </button>
      </div>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-400 px-2 border-r pr-4">
          <Filter size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
        </div>

        <select 
          className="bg-slate-50 px-4 py-2 rounded-xl outline-none font-bold text-[11px] uppercase border border-slate-100"
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
        >
          <option value="">All States</option>
          {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select 
          className="bg-slate-50 px-4 py-2 rounded-xl outline-none font-bold text-[11px] uppercase border border-slate-100"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option>All Categories</option>
          <option>Night Stay</option>
          <option>Day Outing</option>
        </select>

        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase">Min ₹</span>
          <input type="number" className="w-20 bg-transparent outline-none text-xs font-bold" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase">Max ₹</span>
          <input type="number" className="w-20 bg-transparent outline-none text-xs font-bold" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        </div>

        <button onClick={resetFilters} className="ml-auto flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest transition-colors">
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* Results Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
              <th className="p-6 w-12 text-center">
                <button 
                  onClick={selectedProperties.size > 0 ? deselectAll : selectAllFiltered}
                  className="hover:text-indigo-600 transition-colors"
                >
                    {selectedProperties.size > 0 ? <CheckCircle2 size={20} className="text-indigo-600 mx-auto" /> : <Circle size={20} className="mx-auto" />}
                </button>
              </th>
              <th className="p-6">Property</th>
              <th className="p-6">Type</th>
              <th className="p-6">Purchase (Base)</th>
              <th className="p-6">Margin %</th>
              <th className="p-6 text-indigo-600">Selling Price</th>
              <th className="p-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map(p => {
              const isNight = p.type === 'Night Stay';
              const isExpanded = expandedRows.has(p._id);
              const isSelected = selectedProperties.has(p._id);
              return (
                <React.Fragment key={p._id}>
                  <tr 
                    className={`group border-b border-slate-50 hover:bg-indigo-50/20 transition-all cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''} ${isSelected ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-200' : ''}`}
                    onClick={() => toggleRow(p._id)}
                  >
                    <td className="p-6 text-center" onClick={(e) => toggleSelection(p._id, e)}>
                       {isSelected ? 
                        <CheckCircle2 size={22} className="text-indigo-600 mx-auto animate-in zoom-in-50 duration-200" /> : 
                        <div className="w-5 h-5 rounded-full border-2 border-slate-200 mx-auto group-hover:border-indigo-300 transition-colors" />
                       }
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                          {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="w-full h-full p-3 text-slate-300"/>}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 uppercase text-sm flex items-center gap-2">
                            {p.propertyName}
                            {p.website && <a href={p.website} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-indigo-500"><ExternalLink size={12}/></a>}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">{p.place}, {p.state}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${isNight ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="space-y-1 text-xs font-black text-slate-500">
                        <div className="flex gap-2">
                          <span className="text-[9px] text-slate-300 w-4">{isNight ? 'D' : 'P'}</span>
                          <span>₹{p.purchasePriceDouble}</span>
                        </div>
                        {isNight && (
                          <div className="flex gap-2">
                            <span className="text-[9px] text-slate-300 w-4">T</span>
                            <span>₹{p.purchasePriceTriple}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="space-y-2 text-[11px] font-black text-slate-700">
                        <div className="bg-slate-100 w-fit px-2 py-1 rounded-lg">{p.marginDouble}%</div>
                        {isNight && <div className="bg-slate-100 w-fit px-2 py-1 rounded-lg">{p.marginTriple}%</div>}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="space-y-2">
                        <div className="text-sm font-black text-indigo-600">₹{calculateSelling(p.purchasePriceDouble, p.marginDouble)}</div>
                        {isNight && <div className="text-sm font-black text-indigo-600">₹{calculateSelling(p.purchasePriceTriple, p.marginTriple)}</div>}
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setCurrentId(p._id); setFormData({...p}); setIsEditing(true); setShowModal(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                          <Edit3 size={18}/>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(p._id); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr className="bg-indigo-50/30 border-b border-slate-100">
                      <td colSpan="7" className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest flex items-center gap-2"><Info size={14}/> General Info</h4>
                            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-2">
                              {isNight && <p className="text-xs font-bold text-slate-500 uppercase">Inventory: <span className="text-slate-900">{p.totalInventory || 'N/A'}</span></p>}
                              <p className="text-xs font-medium text-slate-600">{p.details || 'No additional details provided for this property.'}</p>
                            </div>
                            
                            {isNight && (
                               <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-2">
                                  <h5 className="text-[9px] font-black uppercase text-slate-400 mb-2">Event Add-ons</h5>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
                                     <div className="flex items-center gap-1"><Utensils size={10}/> Snacks: ₹{p.cocktailSnacks || 0}</div>
                                     <div className="flex items-center gap-1"><Music size={10}/> DJ: ₹{p.djCost || 0}</div>
                                     <div className="flex items-center gap-1"><Home size={10}/> Hall: ₹{p.banquetHall || 0}</div>
                                     <div className="flex items-center gap-1"><FileText size={10}/> License: ₹{p.licenseFeeDJ || 0}</div>
                                  </div>
                               </div>
                            )}
                          </div>
                          <div className="md:col-span-2 space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest flex items-center gap-2"><User size={14}/> Contact Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {p.contacts && p.contacts.map((c, i) => (
                                <div key={i} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                  <div className="font-black text-xs uppercase text-slate-900 mb-2">{c.name || 'Unnamed Contact'}</div>
                                  <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>
                                    <span className="flex items-center gap-1"><Mail size={12}/> {c.email}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Selection Bar */}
      {selectedProperties.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[70]">
          <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between border border-slate-700 animate-in slide-in-from-bottom-10">
            <div className="flex items-center gap-4 pl-4">
              <div className="bg-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center font-black">
                {selectedProperties.size}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest">Properties Selected</p>
                <button 
                  onClick={deselectAll}
                  className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-tighter"
                >
                  Deselect all
                </button>
              </div>
            </div>
            <button 
              onClick={openAddToExistingModal} className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-lg"
            >
              <Briefcase size={18} />
              Add to Existing
            </button>
            <button 
              onClick={handleAddToCatalogue} className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-lg"
            >
              <Briefcase size={18} />
              Add to Catalogue
            </button>
          </div>
        </div>
      )}

      {/* ADD TO EXISTING MODAL */}
      {showCatalogueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-modal-up">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Select Catalogue</h2>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Appending {selectedProperties.size} items</p>
              </div>
              <button onClick={() => setShowCatalogueModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
              {!savedCatalogues || savedCatalogues.length === 0 ? (
                <div className="text-center py-10"><p className="text-gray-400 text-sm italic">No saved catalogues found.</p></div>
              ) : (
                savedCatalogues.map(cat => (
                  <button key={cat._id} disabled={isUpdatingCatalogue} onClick={() => appendToCatalogue(cat)} className="w-full text-left p-5 rounded-3xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all flex justify-between items-center group disabled:opacity-50">
                    <div>
                      <h4 className="font-black text-gray-800 uppercase group-hover:text-indigo-600 transition-colors">{cat.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{(cat.items || []).length} current items</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><Plus size={18} /></div>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 bg-gray-50"><button onClick={() => setShowCatalogueModal(false)} className="w-full py-4 text-xs font-black uppercase text-gray-400 tracking-widest">Cancel</button></div>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-5xl w-full shadow-2xl my-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                   {isEditing ? <Edit3 size={24}/> : <Plus size={24}/>}
                 </div>
                 <h2 className="text-2xl font-black uppercase tracking-tight">{isEditing ? 'Edit Property' : 'Add New Property'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Left Column: General Info & Event Add-ons */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Property Identity</label>
                      <input placeholder="Hotel Name / Resort Name" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm" value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">State</label>
                      <input placeholder="e.g. Goa" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Place / City</label>
                      <input placeholder="e.g. Vagator" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Category</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                      <option>Night Stay</option>
                      <option>Day Outing</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[10px] font-black uppercase mb-2 block tracking-widest ${formData.type === 'Night Stay' ? 'text-slate-400' : 'text-slate-200'}`}>Inventory</label>
                    <input 
                        type="number" 
                        disabled={formData.type !== 'Night Stay'}
                        placeholder={formData.type === 'Night Stay' ? "Total Rooms/Pax" : "Disabled for Day Outing"}
                        className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                        value={formData.totalInventory} 
                        onChange={e => setFormData({...formData, totalInventory: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Event Fields (Only for Night Stay) */}
                <div className={`p-6 rounded-[2rem] border transition-all ${formData.type === 'Night Stay' ? 'bg-amber-50/30 border-amber-100 opacity-100' : 'bg-slate-50 border-slate-100 opacity-40 grayscale'}`}>
                    <label className="text-[10px] font-black uppercase text-amber-600 mb-4 block tracking-widest">Event Support (Night Stay Only)</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Cocktail Snacks (2+2)</label>
                            <input 
                                type="number" 
                                disabled={formData.type !== 'Night Stay'}
                                className="w-full p-3 bg-white rounded-xl border border-amber-100 outline-none font-bold text-sm" 
                                value={formData.cocktailSnacks} 
                                onChange={e => setFormData({...formData, cocktailSnacks: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">DJ Cost</label>
                            <input 
                                type="number" 
                                disabled={formData.type !== 'Night Stay'}
                                className="w-full p-3 bg-white rounded-xl border border-amber-100 outline-none font-bold text-sm" 
                                value={formData.djCost} 
                                onChange={e => setFormData({...formData, djCost: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Banquet Hall</label>
                            <input 
                                type="number" 
                                disabled={formData.type !== 'Night Stay'}
                                className="w-full p-3 bg-white rounded-xl border border-amber-100 outline-none font-bold text-sm" 
                                value={formData.banquetHall} 
                                onChange={e => setFormData({...formData, banquetHall: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">DJ License Fee</label>
                            <input 
                                type="number" 
                                disabled={formData.type !== 'Night Stay'}
                                className="w-full p-3 bg-white rounded-xl border border-amber-100 outline-none font-bold text-sm" 
                                value={formData.licenseFeeDJ} 
                                onChange={e => setFormData({...formData, licenseFeeDJ: e.target.value})} 
                            />
                        </div>
                    </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">About / Details</label>
                  <textarea rows="3" placeholder="Additional info for clients..." className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm resize-none" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
                </div>
              </div>

              {/* Right Column: Pricing, Media & Contacts */}
              <div className="space-y-6">
                <div>
                   <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block tracking-widest">Pricing Strategy</label>
                   <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 space-y-4">
                      {/* Pricing Row 1 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">
                            {formData.type === 'Night Stay' ? 'Double Purchase (₹)' : 'Day Package (₹)'}
                          </label>
                          <input type="number" className="w-full p-3 bg-white rounded-xl border border-indigo-100 outline-none font-bold text-sm" value={formData.purchasePriceDouble} onChange={e => setFormData({...formData, purchasePriceDouble: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Margin (%)</label>
                          <input type="number" className="w-full p-3 bg-white rounded-xl border border-indigo-100 outline-none font-bold text-sm" value={formData.marginDouble} onChange={e => setFormData({...formData, marginDouble: e.target.value})} />
                        </div>
                      </div>
                      
                      {/* Pricing Row 2 (Only if Night Stay) */}
                      {formData.type === 'Night Stay' && (
                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Triple Purchase (₹)</label>
                            <input type="number" className="w-full p-3 bg-white rounded-xl border border-indigo-100 outline-none font-bold text-sm" value={formData.purchasePriceTriple} onChange={e => setFormData({...formData, purchasePriceTriple: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Triple Margin (%)</label>
                            <input type="number" className="w-full p-3 bg-white rounded-xl border border-indigo-100 outline-none font-bold text-sm" value={formData.marginTriple} onChange={e => setFormData({...formData, marginTriple: e.target.value})} />
                          </div>
                        </div>
                      )}
                   </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Media Links</label>
                  <div className="space-y-3">
                    <input placeholder="Website URL" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
                    <input placeholder="Direct Image URL" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-indigo-50 font-bold text-sm" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
                  </div>
                </div>

                <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contacts</label>
                     <button onClick={addContact} className="text-[9px] font-black uppercase bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-1"><PlusCircle size={12}/> Add</button>
                   </div>
                   <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {formData.contacts.map((contact, index) => (
                        <div key={index} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group">
                          {formData.contacts.length > 1 && (
                            <button onClick={() => removeContact(index)} className="absolute -top-2 -right-2 bg-white text-red-500 shadow-sm border border-red-50 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><MinusCircle size={14}/></button>
                          )}
                          <div className="space-y-3">
                            <input placeholder="Contact Name" className="w-full p-2 bg-transparent border-b border-slate-200 outline-none font-bold text-xs" value={contact.name} onChange={e => handleContactChange(index, 'name', e.target.value)} />
                            <div className="grid grid-cols-2 gap-2">
                               <input placeholder="Phone" className="w-full p-2 bg-transparent border-b border-slate-200 outline-none font-bold text-[10px]" value={contact.phone} onChange={e => handleContactChange(index, 'phone', e.target.value)} />
                               <input placeholder="Email" className="w-full p-2 bg-transparent border-b border-slate-200 outline-none font-bold text-[10px]" value={contact.email} onChange={e => handleContactChange(index, 'email', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex gap-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600">Discard Changes</button>
              <button onClick={handleSave} className="flex-2 bg-slate-900 text-white px-16 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-2">
                 <Save size={18}/>
                 {isEditing ? 'Update Property' : 'Deploy Property'}
              </button>
            </div>
          </div>
        </div>
      )}_

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-lg font-black uppercase text-slate-800 mb-2">Delete Property?</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">This action cannot be undone. All data for this property will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyManager;