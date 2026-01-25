import React, { useState, useEffect } from 'react';
import axios from 'axios';

const VendorList = () => {
  const [vendors, setVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  const [formData, setFormData] = useState({
    companyName: '',
    state: '',
    suppliedProducts: '',
    contacts: [{ name: '', phone: '', email: '' }]
  });

  useEffect(() => { fetchVendors(); }, []);

  const getBaseUrl = () => {
    const { hostname } = window.location;
    // If we are on localhost, use localhost. 
    // Otherwise, use the IP address currently in the browser's address bar.
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
      ? 'localhost' 
      : hostname;
    return `http://${host}:5000/api`;
  };

  const API_URL_VENDORS = `${getBaseUrl()}/vendors`;

  /* const getApiUrlForVendors = () => {
    const hostname = window.location.hostname;
    // If running in a cloud/preview environment, we might need a relative path or specific proxy
    // For local development, it defaults to localhost:5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:5000/api/vendors`;
    }
    // Fallback for custom local network IPs or production
    return `http://${hostname}:5000/api/vendors`;
  }; */

  const fetchVendors = async () => {
    try {
      //const res = await axios.get('http://localhost:5000/api/vendors');
      const res = await axios.get(API_URL_VENDORS);
      setVendors(res.data);
    } catch (err) { console.error("Fetch error:", err); }
  };

  const processVendors = () => {
    let result = vendors.filter(v => {
      const s = searchTerm.toLowerCase();
      const contactMatch = v.contacts?.some(c => c.name?.toLowerCase().includes(s));
      return (
        v.companyName?.toLowerCase().includes(s) ||
        v.state?.toLowerCase().includes(s) ||
        v.suppliedProducts?.toLowerCase().includes(s) ||
        contactMatch
      );
    });

    result.sort((a, b) => {
      const nameA = a.companyName?.toLowerCase() || '';
      const nameB = b.companyName?.toLowerCase() || '';
      if (sortOrder === 'asc') return nameA < nameB ? -1 : 1;
      return nameA > nameB ? -1 : 1;
    });

    return result;
  };

  const filteredVendors = processVendors();

  const toggleSort = () => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));

  // --- Contact Management Logic ---
  const handleContactChange = (index, field, value) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[index][field] = value;
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const addContactRow = () => {
    setFormData({
      ...formData,
      contacts: [...formData.contacts, { name: '', phone: '', email: '' }]
    });
  };

  const removeContactRow = (index) => {
    if (formData.contacts.length > 1) {
      const updatedContacts = formData.contacts.filter((_, i) => i !== index);
      setFormData({ ...formData, contacts: updatedContacts });
    }
  };

  const handleSave = async () => {
    try {
      if (isEditing) {
        //await axios.put(`http://localhost:5000/api/vendors/${currentId}`, formData);
        await axios.put(API_URL_VENDORS+`/${currentId}`,formData);
      } else {
        //await axios.post('http://localhost:5000/api/vendors', formData);
        await axios.post(API_URL_VENDORS,formData);
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
        //await axios.delete(`http://localhost:5000/api/vendors/${id}`);
        await axios.delete(API_URL_VENDORS+`${id}`);
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
      suppliedProducts: v.suppliedProducts || '',
      contacts: v.contacts && v.contacts.length > 0 ? [...v.contacts] : [{ name: '', phone: '', email: '' }]
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ companyName: '', state: '', suppliedProducts: '', contacts: [{ name: '', phone: '', email: '' }] });
    setIsEditing(false);
    setCurrentId(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      {/* HEADER */}
      <div className="flex flex-row items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight whitespace-nowrap border-r pr-4 border-gray-200">
          Vendor Directory
        </h1>
        
        <div className="flex-grow max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Search vendor, products, or contact name..."
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3 top-3 text-gray-400">🔍</span>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold">✕</button>
          )}
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition"
        >
          + Add Vendor
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b uppercase text-[10px] font-black text-gray-500">
            <tr>
              <th className="p-3 w-10"></th>
              <th className="p-3 cursor-pointer hover:text-indigo-600 transition" onClick={toggleSort}>
                Company / State {sortOrder === 'asc' ? '↑' : '↓'}
              </th>
              <th className="p-3">Supplied Products</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.map(v => (
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
                    <div className="text-[10px] text-indigo-500 font-black tracking-widest uppercase">{v.state}</div>
                  </td>
                  <td className="p-3 text-sm text-gray-500 truncate max-w-xs">{v.suppliedProducts || '---'}</td>
                  <td className="p-3 text-right">
                    <button onClick={(e) => handleEdit(v, e)} className="text-indigo-600 font-bold text-xs mr-3 hover:underline">EDIT</button>
                    <button onClick={(e) => handleDelete(v._id, v.companyName, e)} className="text-red-500 font-bold text-xs hover:underline">DELETE</button>
                  </td>
                </tr>
                {expandedRows.includes(v._id) && (
                  <tr className="bg-gray-50/50">
                    <td colSpan="4" className="p-6 border-b shadow-inner">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Detailed Products</h4>
                          <p className="text-sm text-gray-700 bg-white p-3 rounded border italic whitespace-pre-wrap">{v.suppliedProducts || 'N/A'}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Contacts</h4>
                          {v.contacts.map((c, i) => (
                            <div key={i} className="mb-2 p-2 bg-white rounded border text-sm shadow-sm">
                              <span className="font-bold text-indigo-600">{c.name}</span> | <span className="text-gray-600">{c.phone}</span> | <span className="text-gray-500 italic">{c.email}</span>
                            </div>
                          ))}
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

      {/* MODAL POPUP */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">
                {isEditing ? 'Update Vendor Details' : 'Register New Vendor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            <div className="p-8 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Company Name</label>
                  <input 
                    className="w-full border-2 p-3 rounded-lg focus:border-indigo-500 outline-none font-bold text-gray-700 transition" 
                    value={formData.companyName} 
                    onChange={e => setFormData({...formData, companyName: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">State / Region</label>
                  <input 
                    className="w-full border-2 p-3 rounded-lg focus:border-indigo-500 outline-none font-bold text-gray-700 transition" 
                    value={formData.state} 
                    onChange={e => setFormData({...formData, state: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Products & Services Supplied</label>
                <textarea 
                  className="w-full border-2 p-3 rounded-lg h-24 focus:border-indigo-500 outline-none text-gray-700 transition" 
                  value={formData.suppliedProducts} 
                  onChange={e => setFormData({...formData, suppliedProducts: e.target.value})} 
                />
              </div>

              {/* CONTACTS SECTION - Client style */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">Point of Contacts</h3>
                  <button 
                    onClick={addContactRow}
                    className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black border border-indigo-100 hover:bg-indigo-100 transition"
                  >
                    + ADD CONTACT
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.contacts.map((contact, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end bg-white p-4 rounded-lg border border-gray-100 shadow-sm relative group">
                      <div className="col-span-4">
                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Full Name</label>
                        <input 
                          placeholder="Contact Person"
                          className="w-full border-b-2 p-1 focus:border-indigo-500 outline-none text-sm font-semibold"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Phone</label>
                        <input 
                          placeholder="Mobile No."
                          className="w-full border-b-2 p-1 focus:border-indigo-500 outline-none text-sm font-semibold"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Email Address</label>
                        <input 
                          placeholder="email@company.com"
                          className="w-full border-b-2 p-1 focus:border-indigo-500 outline-none text-sm font-semibold"
                          value={contact.email}
                          onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button 
                          onClick={() => removeContactRow(index)}
                          className={`text-red-300 hover:text-red-500 transition-colors ${formData.contacts.length === 1 ? 'invisible' : 'visible'}`}
                          title="Remove Contact"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-6 py-2.5 font-bold text-gray-400 hover:text-gray-600 transition uppercase text-xs tracking-widest"
              >
                Discard
              </button>
              <button 
                onClick={handleSave} 
                className="bg-indigo-600 text-white px-10 py-2.5 rounded-xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition uppercase text-xs tracking-widest"
              >
                {isEditing ? 'Update Vendor' : 'Save Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorList;