import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getBaseUrl } from '../baseurl';
import { Download, Plus, Search, ChevronDown, ChevronRight, Edit2, Trash2, MapPin, Tag, Mail, Phone, Building2 } from 'lucide-react';

const VendorList = () => {
  const [vendors, setVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  // Filter States
  const [filterCategory, setFilterCategory] = useState('');
  const [filterState, setFilterState] = useState('');

  // Scanning States
  const [cardImages, setCardImages] = useState({ front: null, back: null });
  const [isScanning, setIsScanning] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    state: '',
    category: '',
    suppliedProducts: '',
    contacts: [{ name: '', phone: '', email: '' }]
  });

  useEffect(() => { fetchVendors(); }, []);
  const API_URL_VENDORS = `${getBaseUrl()}/vendors`;

  const fetchVendors = async () => {
    try {
      const res = await axios.get(API_URL_VENDORS);
      setVendors(res.data);
    } catch (err) { console.error("Fetch error:", err); }
  };

  // Dynamic list of states for filters and modal dropdown
  const uniqueStates = useMemo(() => {
    const states = vendors.map(v => v.state).filter(Boolean);
    return [...new Set(states)].sort();
  }, [vendors]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterCategory('');
    setFilterState('');
  };

  const processVendors = () => {
    let result = vendors.filter(v => {
      const s = searchTerm.toLowerCase();
      const contactMatch = v.contacts?.some(c => c.name?.toLowerCase().includes(s));
      const matchesSearch = (
        v.companyName?.toLowerCase().includes(s) ||
        v.suppliedProducts?.toLowerCase().includes(s) ||
        contactMatch
      );
      const matchesCategory = filterCategory === '' || v.category === filterCategory;
      const matchesState = filterState === '' || v.state === filterState;

      return matchesSearch && matchesCategory && matchesState;
    });

    result.sort((a, b) => {
      const nameA = a.companyName?.toLowerCase() || '';
      const nameB = b.companyName?.toLowerCase() || '';
      if (sortOrder === 'asc') return nameA < nameB ? -1 : 1;
      return nameA > nameB ? -1 : 1;
    });
    return result;
  };

  const handleSave = async () => {
    try {
      if (isEditing) {
        await axios.put(`${API_URL_VENDORS}/${currentId}`, formData);
      } else {
        await axios.post(API_URL_VENDORS, formData);
      }
      setShowModal(false);
      resetForm();
      fetchVendors();
    } catch (err) { alert("Error saving vendor."); }
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${name}?`)) {
      try {
        await axios.delete(`${API_URL_VENDORS}/${id}`);
        fetchVendors();
      } catch (err) { alert("Delete failed"); }
    }
  };

  const handleEdit = (v, e) => {
    e.stopPropagation();
    setIsEditing(true);
    setCurrentId(v._id);
    setFormData({
      companyName: v.companyName,
      state: v.state || '',
      category: v.category || '',
      suppliedProducts: v.suppliedProducts || '',
      contacts: v.contacts && v.contacts.length > 0 ? [...v.contacts] : [{ name: '', phone: '', email: '' }]
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ companyName: '', state: '', category: '', suppliedProducts: '', contacts: [{ name: '', phone: '', email: '' }] });
    setCardImages({ front: null, back: null });
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleCardCapture = (side, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCardImages(prev => ({ ...prev, [side]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const exportToExcel = () => {
    const headers = ["Vendor Name", "State", "Category", "Products", "Contact Name", "Phone", "Email"];
    const rows = filteredVendors.flatMap(v =>
      v.contacts.map(c => [v.companyName, v.state, v.category, v.suppliedProducts, c.name, c.phone, c.email])
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.map(val => `"${val || ''}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Vendor_List_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredVendors = useMemo(() => {
    return vendors
      .filter(v => {
        const matchesSearch = v.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (v.suppliedProducts && v.suppliedProducts.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCat = filterCategory ? v.category === filterCategory : true;
        const matchesState = filterState ? v.state === filterState : true;
        return matchesSearch && matchesCat && matchesState;
      })
      .sort((a, b) => {
        if (sortOrder === 'asc') return a.companyName.localeCompare(b.companyName);
        return b.companyName.localeCompare(a.companyName);
      });
  }, [vendors, searchTerm, filterCategory, filterState, sortOrder]);

  const handleScanCard = async () => {
    setIsScanning(true);
    try {
      const imagesToScan = [cardImages.front];
      if (cardImages.back) imagesToScan.push(cardImages.back);
      const res = await axios.post(`${getBaseUrl()}/invoices/process`, {
        image: cardImages.front,
        secondImage: cardImages.back,
        isBusinessCard: true,
        mimeType: "image/jpeg"
      });
      const data = res.data;
      setFormData(prev => ({
        ...prev,
        companyName: data.company_name || data.vendor_name || prev.companyName,
        contacts: [{ name: data.name || '', phone: data.phone || '', email: data.email || '' }]
      }));
    } catch (err) { alert("AI extraction failed."); } finally { setIsScanning(false); }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen font-sans">

      {/* HEADER: Combined Search, Filters, and Add Button */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight lg:border-r lg:pr-4 border-gray-200 shrink-0">
            Vendors
          </h1>

          <div className="flex flex-col md:flex-row w-full gap-3 items-center">
            <div className="relative flex-grow w-full">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>

            <select
              className="w-full md:w-40 border p-2 rounded-lg text-xs font-bold bg-white"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Gifting">Gifting</option>
              <option value="Travel">Travel</option>
            </select>

            <select
              className="w-full md:w-40 border p-2 rounded-lg text-xs font-bold bg-white"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
            >
              <option value="">All States</option>
              {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button onClick={handleResetFilters} className="text-red-500 text-[10px] font-black uppercase px-2">
              Reset
            </button>

            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="w-full md:w-auto bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shrink-0"
            >
              + Add Vendor
            </button>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 shadow-sm"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-gray-50 border-b uppercase text-[10px] font-black text-gray-500">
            <tr>
              <th className="p-3 w-10"></th>
              <th className="p-3">Company / Info</th>
              <th className="p-3">Products</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {processVendors().map(v => (
              <React.Fragment key={v._id}>
                <tr
                  onClick={() => setExpandedRows(prev => prev.includes(v._id) ? prev.filter(id => id !== v._id) : [...prev, v._id])}
                  className="cursor-pointer border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="p-3 text-center text-gray-400 text-xs">
                    {expandedRows.includes(v._id) ? '▼' : '▶'}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-gray-800 text-sm uppercase">{v.companyName}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">{v.category || 'N/A'}</span>
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black uppercase">{v.state}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-gray-500 truncate max-w-xs">{v.suppliedProducts || '---'}</td>
                  <td className="p-3 text-right">
                    <button onClick={(e) => handleEdit(v, e)} className="text-indigo-600 font-bold text-xs mr-3 hover:underline">EDIT</button>
                    {/* RESTORED DELETE BUTTON */}
                    <button onClick={(e) => handleDelete(v._id, v.companyName, e)} className="text-red-500 font-bold text-xs hover:underline">DELETE</button>
                  </td>
                </tr>
                {expandedRows.includes(v._id) && (
                  <tr className="bg-gray-50/50">
                    <td colSpan="4" className="p-6 border-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Products</h4>
                          <p className="text-sm text-gray-700 bg-white p-3 rounded border italic">{v.suppliedProducts || 'N/A'}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Contacts</h4>
                          {/* FIXED CONTACT DISPLAY */}
                          {v.contacts && v.contacts.length > 0 ? (
                            v.contacts.map((c, i) => (
                              <div key={i} className="mb-2 p-2 bg-white rounded border text-sm shadow-sm">
                                <div className="font-bold text-indigo-600">{c.name || 'No Name'}</div>
                                <div className="text-gray-600 text-xs">📞 {c.phone || 'N/A'}</div>
                                <div className="text-gray-500 text-xs italic">✉️ {c.email || 'N/A'}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400">No contacts listed.</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800 uppercase">{isEditing ? 'Update Vendor' : 'New Vendor'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-2xl">✕</button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* MOBILE SCANNER */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-[11px] font-black text-indigo-700 uppercase">AI Card Scanner</h3>
                    {isScanning && <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['front', 'back'].map((side) => (
                      <label key={side} className="relative flex flex-col items-center justify-center h-28 bg-white rounded-xl border-2 border-gray-100 cursor-pointer active:scale-[0.98] transition-all">
                        {cardImages[side] ? (
                          <img src={cardImages[side]} className="h-full w-full object-cover rounded-xl" alt={side} />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xl">📷</span>
                            <p className="text-[10px] font-black text-gray-400 uppercase">Scan {side}</p>
                          </div>
                        )}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCardCapture(side, e)} />
                      </label>
                    ))}
                  </div>
                  {cardImages.front && (
                    <button onClick={handleScanCard} disabled={isScanning} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase">
                      {isScanning ? 'Extracting...' : '✨ Auto-Fill Fields'}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Company Name</label>
                  <input className="w-full border-2 p-3 rounded-lg font-bold" value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Category</label>
                  <select className="w-full border-2 p-3 rounded-lg font-bold bg-white" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="">Select Category</option>
                    <option value="Gifting">Gifting</option>
                    <option value="Travel">Travel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">State / Region</label>
                <input
                  list="state-list"
                  className="w-full border-2 p-3 rounded-lg font-bold outline-none focus:border-indigo-500"
                  placeholder="Select or enter state..."
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                />
                <datalist id="state-list">
                  {uniqueStates.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Products Supplied</label>
                <textarea className="w-full border-2 p-3 rounded-lg h-20" value={formData.suppliedProducts} onChange={e => setFormData({ ...formData, suppliedProducts: e.target.value })} />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center mb-4 text-[10px] font-black text-gray-400 uppercase">
                  <span>Contacts</span>
                  <button onClick={() => setFormData({ ...formData, contacts: [...formData.contacts, { name: '', phone: '', email: '' }] })} className="text-indigo-600">+ Add New</button>
                </div>
                {formData.contacts.map((c, i) => (
                  <div key={i} className="space-y-2 mb-4 bg-white p-3 rounded-lg border shadow-sm">
                    <input placeholder="Name" className="w-full border-b text-sm p-1 font-semibold" value={c.name} onChange={e => {
                      const nc = [...formData.contacts]; nc[i].name = e.target.value; setFormData({ ...formData, contacts: nc });
                    }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Phone" className="border-b text-sm p-1" value={c.phone} onChange={e => {
                        const nc = [...formData.contacts]; nc[i].phone = e.target.value; setFormData({ ...formData, contacts: nc });
                      }} />
                      <input placeholder="Email" className="border-b text-sm p-1" value={c.email} onChange={e => {
                        const nc = [...formData.contacts]; nc[i].email = e.target.value; setFormData({ ...formData, contacts: nc });
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t flex flex-col md:flex-row justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-gray-400 uppercase text-xs">Cancel</button>
              <button onClick={handleSave} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black uppercase text-xs">Save Vendor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorList;