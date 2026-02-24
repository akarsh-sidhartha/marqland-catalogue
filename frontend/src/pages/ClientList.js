import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Plus, Search, ChevronDown, ChevronRight, Edit2, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import { getBaseUrl } from '../baseurl'; // Import the central function

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  // Sorting State
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  const [formData, setFormData] = useState({
    companyName: '',
    contacts: [{ name: '', phone: '', email: '' }]
  });

  useEffect(() => { fetchClients(); }, []);

  /*
  const getBaseUrl = () => {
    const { hostname } = window.location;
    // If we are on localhost, use localhost. 
    // Otherwise, use the IP address currently in the browser's address bar.
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') 
      ? 'localhost' 
      : hostname;
    return `http://${host}:5000/api`;
  };
*/
  const API_URL_CLIENTS = `${getBaseUrl()}/clients`;

  /* const getApiUrlForClients = () => {
    const hostname = window.location.hostname;
    // If running in a cloud/preview environment, we might need a relative path or specific proxy
    // For local development, it defaults to localhost:5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:5000/api/clients`;
    }
    // Fallback for custom local network IPs or production
    return `http://${hostname}:5000/api/clients`;
  }; */

  const fetchClients = async () => {
    try {
      //const res = await axios.get('http://localhost:5000/api/clients');
      const res = await axios.get(API_URL_CLIENTS);
      setClients(res.data);
    } catch (err) {
      console.error("Error fetching clients", err);
    }
  };

  // --- Search & Sort Logic ---
  const processClients = () => {
    // 1. Filter
    let result = clients.filter(c => {
      const searchStr = searchTerm.toLowerCase();
      const contactMatch = c.contacts?.some(contact =>
        contact.name?.toLowerCase().includes(searchStr)
      );
      return c.companyName?.toLowerCase().includes(searchStr) || contactMatch;
    });

    // 2. Sort
    result.sort((a, b) => {
      const nameA = a.companyName.toLowerCase();
      const nameB = b.companyName.toLowerCase();
      if (sortOrder === 'asc') return nameA < nameB ? -1 : 1;
      return nameA > nameB ? -1 : 1;
    });

    return result;
  };

  const filteredClients = processClients();

  const toggleSort = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const toggleRow = (id) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleContactChange = (index, field, value) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[index][field] = value;
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const handleAddContactRow = () => {
    setFormData({ ...formData, contacts: [...formData.contacts, { name: '', phone: '', email: '' }] });
  };

  const handleRemoveContactRow = (index) => {
    const updatedContacts = formData.contacts.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      contacts: updatedContacts.length > 0 ? updatedContacts : [{ name: '', phone: '', email: '' }]
    });
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete client "${name}"?`)) {
      try {
        //await axios.delete(`http://localhost:5000/api/clients/${id}`);
        await axios.delete(API_URL_CLIENTS + `${id}`);
        fetchClients();
      } catch (err) {
        alert("Failed to delete client.");
      }
    }
  };

  const handleEdit = (client, e) => {
    e.stopPropagation();
    setIsEditing(true);
    setCurrentId(client._id);
    setFormData({
      companyName: client.companyName,
      contacts: client.contacts.length > 0 ? client.contacts : [{ name: '', phone: '', email: '' }]
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (isEditing) {
        //await axios.put(`http://localhost:5000/api/clients/${currentId}`, formData);
        await axios.put(API_URL_CLIENTS + `/${currentId}`, formData);
      } else {
        //await axios.post('http://localhost:5000/api/clients', formData);
        await axios.post(API_URL_CLIENTS, formData);
      }
      setShowModal(false);
      resetForm();
      fetchClients();
    } catch (err) {
      alert("Error saving client.");
    }
  };


  // Export to Excel (CSV format)
  const exportToExcel = () => {
    const headers = ["Company Name", "Contact Person", "Phone", "Email"];
    const rows = filteredClientsforExcel.flatMap(client =>
      client.contacts.map(contact => [
        client.companyName,
        contact.name,
        contact.phone,
        contact.email
      ])
    );

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers, ...rows].map(e => e.map(val => `"${val || ''}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Client_List_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredClientsforExcel = clients
    .filter(c => c.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'asc') return a.companyName.localeCompare(b.companyName);
      return b.companyName.localeCompare(a.companyName);
    });

  const resetForm = () => {
    setFormData({ companyName: '', contacts: [{ name: '', phone: '', email: '' }] });
    setIsEditing(false);
    setCurrentId(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="flex flex-row items-center justify-between gap-6 mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-xl font-black text-gray-800 tracking-tight uppercase whitespace-nowrap border-r pr-6 border-gray-200">
          Client Management
        </h1>

        {/* Search Bar with Clear Button */}
        <div className="flex-grow max-w-2xl relative group">
          <span className="absolute left-3 top-3 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search by company or contact name..."
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full w-6 h-6 flex items-center justify-center transition"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition whitespace-nowrap flex-shrink-0"
        >
          + Add Client
        </button>

        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 transition-all shadow-sm"
        >
          <Download size={16} />
          Export
        </button>

      </div>

      {/* TABLE */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100 border-b border-gray-200 uppercase text-[11px] font-black text-gray-500">
            <tr>
              <th className="p-3 w-10"></th>
              <th
                className="p-3 cursor-pointer hover:text-indigo-600 transition flex items-center gap-1"
                onClick={toggleSort}
              >
                Client Company {sortOrder === 'asc' ? '↑' : '↓'}
              </th>
              <th className="p-3">Primary Contact</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(c => {
              const isExpanded = expandedRows.includes(c._id);
              return (
                <React.Fragment key={c._id}>
                  <tr
                    onClick={() => toggleRow(c._id)}
                    className={`cursor-pointer border-b transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}`}
                  >
                    <td className="p-3 text-center text-[10px] text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="p-3 font-bold text-gray-700 uppercase text-sm">{c.companyName}</td>
                    <td className="p-3 text-sm text-gray-500">
                      {c.contacts[0]?.name || '---'}
                      {c.contacts.length > 1 && <span className="ml-2 text-[10px] bg-gray-200 px-1.5 py-0.5 rounded-full">+{c.contacts.length - 1} more</span>}
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={(e) => handleEdit(c, e)} className="text-indigo-600 font-bold text-[11px] hover:underline mr-4 uppercase">Edit</button>
                      <button onClick={(e) => handleDelete(c._id, c.companyName, e)} className="text-red-500 font-bold text-[11px] hover:underline uppercase">Delete</button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50/50">
                      <td colSpan="4" className="p-6 border-b shadow-inner">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Full Contact Directory</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {c.contacts.map((contact, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1">
                                <p className="font-bold text-gray-800 text-sm">{contact.name}</p>
                                <p className="text-xs text-gray-500 mt-1">📞 {contact.phone || 'N/A'}</p>
                                <p className="text-xs text-gray-500 truncate">✉️ {contact.email || 'N/A'}</p>
                              </div>
                            ))}
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

      {/* MODAL POPUP (Same as before) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">
                {isEditing ? 'Update Client' : 'New Client Registration'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900 text-2xl">✕</button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase">Company Name</label>
                <input
                  className="w-full border-2 border-gray-100 p-3 rounded-lg focus:border-indigo-500 outline-none font-bold"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-indigo-600 text-[11px] uppercase tracking-widest">Points of Contact</h3>
                  <button onClick={handleAddContactRow} className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full text-[10px] font-bold hover:bg-indigo-100">+ ADD PERSON</button>
                </div>

                <div className="space-y-3">
                  {formData.contacts.map((contact, index) => (
                    <div key={index} className="flex gap-3 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="grid grid-cols-3 gap-3 flex-grow">
                        <input placeholder="Name" className="border p-2 rounded-md text-xs bg-white" value={contact.name} onChange={e => handleContactChange(index, 'name', e.target.value)} />
                        <input placeholder="Phone" className="border p-2 rounded-md text-xs bg-white" value={contact.phone} onChange={e => handleContactChange(index, 'phone', e.target.value)} />
                        <input placeholder="Email" className="border p-2 rounded-md text-xs bg-white" value={contact.email} onChange={e => handleContactChange(index, 'email', e.target.value)} />
                      </div>
                      <button onClick={() => handleRemoveContactRow(index)} className="text-red-400 hover:text-red-600 font-bold px-2 text-xl">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 border-t mt-8 pt-6">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400 font-bold">Cancel</button>
              <button
                onClick={handleSave}
                className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold shadow-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;