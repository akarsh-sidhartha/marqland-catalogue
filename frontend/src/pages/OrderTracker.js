import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBaseUrl } from '../baseurl'; // Import the central function
import CreatableSelect from 'react-select/creatable';
import {
  Plus,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  FolderOpen,
  Calendar,
  Hash,
  Receipt,
  Table as TableIcon,
  Search, // Added for the search icon
  Loader2 // Added for the loading buffer
} from 'lucide-react';

const API_BASE_URL = `${getBaseUrl()}/orders`;

export default function App() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('inquiry');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true); // Data fetch loading buffer
  const [expandedFolders, setExpandedFolders] = useState({});
  const [quotePrompt, setQuotePrompt] = useState(null);
  const [completionPrompt, setCompletionPrompt] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // Added search state
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedContact, setSelectedContact] = useState('');

  const [meta, setMeta] = useState({ clients: [], clientContacts: {} });

  // Refs for Rich Text Editors
  const createEditorRef = useRef(null);
  const editEditorRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    orderPlacedBy: '',
    description: '',
    attachments: []
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter(order => {
      const matchesTab = order.status === activeTab;

      // 1. Dropdown Filters
      const matchesClient = !selectedClient || order.clientName === selectedClient;
      const matchesContact = !selectedContact || order.orderPlacedBy === selectedContact;

      // 2. Deep Search across all fields
      const term = searchTerm.toLowerCase();
      const searchFields = [
        order.clientName,
        order.title,
        order.refNumber,
        order._id,
        order.orderPlacedBy,
        order.invoiceNumber,
        order.description // Includes searching inside HTML notes
      ].join(' ').toLowerCase();

      const matchesSearch = !searchTerm || searchFields.includes(term);

      return matchesTab && matchesClient && matchesContact && matchesSearch;
    });
  }, [orders, activeTab, searchTerm, selectedClient, selectedContact]);

  // Function to "delete" from dropdown (filters current view)
  const deleteMetaItem = (type, value, parentClient = null) => {
    setMeta(prev => {
      if (type === 'clients') {
        const newContacts = { ...prev.clientContacts };
        delete newContacts[value];
        return {
          clients: prev.clients.filter(item => item !== value),
          clientContacts: newContacts
        };
      } else {
        // Deleting a specific contact under a client
        return {
          ...prev,
          clientContacts: {
            ...prev.clientContacts,
            [parentClient]: prev.clientContacts[parentClient].filter(item => item !== value)
          }
        };
      }
    });
  };

  const fetchOrders = async () => {
    setFetchLoading(true);
    try {
      const res = await fetch(API_BASE_URL);
      const data = await res.json();

      if (Array.isArray(data)) {
        // 1. Calculate meta data directly from the FRESH 'data' array, not 'orders' state
        const clients = [...new Set(data.map(o => o.clientName).filter(Boolean))].sort();

        // 2. Create the contact mapping
        const mapping = data.reduce((acc, order) => {
          if (order.clientName && order.orderPlacedBy) {
            if (!acc[order.clientName]) acc[order.clientName] = new Set();
            acc[order.clientName].add(order.orderPlacedBy);
          }
          return acc;
        }, {});

        // 3. Convert Sets to sorted Arrays
        const formattedMapping = {};
        for (const client in mapping) {
          formattedMapping[client] = [...mapping[client]].sort();
        }

        // 4. Update both states
        setMeta({ clients, clientContacts: formattedMapping });
        setOrders(data);
      } else {
        console.error("Received non-array data:", data);
        setOrders([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setOrders([]);
    } finally {
      setFetchLoading(false);
    }
  };

  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = `<img src="${event.target.result}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`;
          document.execCommand('insertHTML', false, img);
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const getFinancialYear = (dateStr) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth();
    const fyStart = month >= 3 ? year : year - 1;
    //return `FY ${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
    return `${(fyStart).toString().slice(-2)}-${(fyStart + 1).toString().slice(-2)}`;
  };

  const getMonthName = (dateStr) => {
    return new Date(dateStr).toLocaleString('default', { month: 'long' });
  };

  const groupedCompleted = useMemo(() => {
    // Apply search filter even to completed orders if searching
    const completed = orders.filter(o => {
      const isCompleted = o.status === 'completed';
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        o.clientName?.toLowerCase().includes(term) ||
        o.title?.toLowerCase().includes(term) ||
        o.invoiceNumber?.toLowerCase().includes(term);
      return isCompleted && matchesSearch;
    });

    const hierarchy = {};
    completed.forEach(order => {
      const date = order.completedAt || order.updatedAt || new Date().toISOString();
      const fy = getFinancialYear(date);
      const month = getMonthName(date);
      if (!hierarchy[fy]) hierarchy[fy] = {};
      if (!hierarchy[fy][month]) hierarchy[fy][month] = [];
      hierarchy[fy][month].push(order);
    });
    return hierarchy;
  }, [orders, searchTerm]);

  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };
  const handleFileUpload = (e, isEdit = false) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (isEdit) {
          setEditOrder(prev => ({
            ...prev,
            attachments: [
              ...(prev.attachments || []),
              {
                name: file.name,
                base64: event.target.result, // This sends the file data to the backend
                isNew: true
              }
            ]
          }));
        }
        else {
          setFormData(prev => ({
            ...prev,
            attachments: [
              ...(prev.attachments || []),
              {
                name: file.name,
                base64: event.target.result, // This sends the file data to the backend
                isNew: true
              }
            ]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const saveOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    const richDescription = createEditorRef.current ? createEditorRef.current.innerHTML : formData.description;
    const financialYear = getFinancialYear(new Date().toISOString());

    // Find all orders that belong to the current calculated FY
    const fyOrders = orders.filter(o =>
      //o.refNumber && o.refNumber.startsWith(financialYear)
      o.refNumber && o.refNumber.startsWith("INQ-" + financialYear)
    );

    let nextNumber = 1;
    if (fyOrders.length > 0) {
      const lastNumbers = fyOrders.map(o => {
        const parts = o.refNumber.split('-');

        // Grab the very last element of the array
        const lastPart = parts.pop();

        return parseInt(lastPart, 10);
      }).filter(num => !isNaN(num));

      // Find the highest and increment
      const maxNum = lastNumbers.length > 0 ? Math.max(...lastNumbers) : 0;
      nextNumber = maxNum + 1;
    }

    // Format: YY-YY/00X
    const generatedRef = `INQ-${financialYear}-${String(nextNumber).padStart(3, '0')}`;

    // 3. Construct the Payload
    const payload = {
      ...formData, // Contains clientName and orderPlacedBy from the selects
      refNumber: generatedRef,
      description: richDescription,
      status: 'inquiry',
      attachments: formData.attachments
      // Ensure attachments are cleaned of local base64 data to save DB space if needed
      //attachments: formData.attachments.map(a => ({ ...a, base64: null })) // earlier workign code.
    };

    try {
      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
        //body: JSON.stringify({ ...formData, refNumber: generatedRef, description: richDescription, status: 'inquiry' })
      });
      if (res.ok) {
        setIsModalOpen(false);
        // Reset form to original state
        setFormData({
          title: '',
          clientName: '',
          orderPlacedBy: '',
          description: '',
          attachments: []
        });

        /* this is the workign code for mongo DB directly. 
        setFormData({ title: '', clientName: '', refNumber: '', orderPlacedBy: '', description: '', attachments: [] });
        */
        fetchOrders();
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateOrder = async (id, payload, e) => {
    if (e) e.stopPropagation();
    // Start the loading buffer
    setLoading(true);
    const finalPayload = { ...payload };
    if (editEditorRef.current && id === editOrder?._id) {
      finalPayload.description = editEditorRef.current.innerHTML;
    }

    try {
      await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      });
      setEditOrder(null);
      fetchOrders();
    } catch (err) { console.error(err); } finally {
      // Stop the loading buffer
      setLoading(false);
    }
  };

  const CustomCreatableSelect = ({ label, options, value, onChange, onDelete, isDisabled }) => {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase px-1">{label}</label>
        <CreatableSelect
          isClearable
          isDisabled={isDisabled}
          options={options}
          value={value}
          onChange={onChange}
          formatOptionLabel={(option, { context }) => (
            <div className="flex justify-between items-center">
              <span>{option.label}</span>
              {context === 'menu' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(option.value);
                  }}
                  className="hover:text-red-500 p-1"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          styles={{
            control: (base) => ({
              ...base,
              border: 'none',
              borderRadius: '0.75rem',
              padding: '4px',
              backgroundColor: '#f8fafc', // slate-50
              fontSize: '14px',
              fontWeight: 'bold',
            }),
          }}
        />
      </div>
    );
  };

  const downloadFile = (file, e) => {
    e.stopPropagation();
    // Use the direct download URL if available, otherwise fallback to webUrl
    const url = file.downloadUrl || file["@microsoft.graph.downloadUrl"] || file.webUrl;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (type) => {
    if (type.includes('image')) return <ImageIcon size={14} className="text-blue-500" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet size={14} className="text-emerald-500" />;
    return <FileText size={14} className="text-slate-400" />;
  };

  const OrderRow = ({ order }) => (
    <tr
      onClick={() => setEditOrder(order)}
      className="hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
    >
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          {order.status === 'completed' ? (
            order.invoiceNumber && (
              <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-1 rounded uppercase tracking-wider w-fit flex items-center gap-1">
                <Receipt size={10} /> {order.invoiceNumber}
              </span>
            )
          ) : (
            <>
              {order.refNumber ? (
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded uppercase tracking-wider w-fit">{order.refNumber}</span>
              ) : (
                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded w-fit">#{order._id.slice(-6)}</span>
              )}
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="font-bold text-sm text-slate-800">{order.title}</div>
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-500 font-bold">{order.clientName}</span>
          <span className="text-[10px] text-slate-400 font-medium leading-tight">Attn: {order.orderPlacedBy || 'N/A'}</span>
        </div>
      </td>
      <td className="px-6 py-4 max-w-xs">
        <div
          className="text-xs text-slate-500 line-clamp-1 italic pointer-events-none"
          dangerouslySetInnerHTML={{ __html: order.description?.replace(/<img[^>]*>/g, '[Image]') || '...' }}
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-1.5">
          {order.attachments && order.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {order.attachments.map((file, idx) => (
                <a
                  key={idx}
                  href={file.webUrl} // The URL returned by Microsoft Graph
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                >
                  <FileText size={12} />
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <button onClick={(e) => {
                    // FIX 2: Prevent row click (popup)
                    e.stopPropagation();
                    // FIX 3: Prevent the <a> tag from opening a new tab
                    e.preventDefault();
                    downloadFile(file, e)
                  }} className="text-indigo-500"><Download size={14} /></button>
                </a>
              ))}
            </div>
          )}

          {/* {order.attachments?.map((file, idx) => (
            <button 
              key={idx} 
              onClick={(e) => downloadFile(file, e)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md hover:border-indigo-400 transition-colors group/btn"
            >
              {getFileIcon(file.fileType)}
              <span className="text-[9px] font-bold text-slate-600 truncate max-w-[60px]">{file.fileName}</span>
              <Download size={10} className="text-slate-300 group-hover/btn:text-indigo-500" />
            </button>
          ))} */}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {order.status === 'inquiry' && (
            <button
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); setQuotePrompt(order); }}
              className={`px-3 py-1.5 rounded-lg font-black text-[10px] transition-colors uppercase ${loading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
            >
              {loading ? '...' : 'Start Project'}
            </button>
          )}

          {order.status === 'ongoing' && (
            <button
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); setCompletionPrompt(order); }}
              className={`p-2 rounded-lg transition-colors ${loading ? 'text-slate-300 cursor-not-allowed' : 'text-emerald-500 hover:bg-emerald-50'
                }`}
            >
              <CheckCircle size={18} className={loading ? 'animate-pulse' : ''} />
            </button>
          )}

          {order.status !== 'completed' && (
            <button
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); setDeleteId(order._id); }}
              className={`p-2 transition-colors ${loading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500'
                }`}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </td>
      {/*
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {order.status === 'inquiry' && (
            <button
              onClick={(e) => { e.stopPropagation(); setQuotePrompt(order); }}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[10px] hover:bg-indigo-100 transition-colors uppercase"
            >
              Start Project
            </button>
          )}
          {order.status === 'ongoing' && (
            <button
              onClick={(e) => { e.stopPropagation(); setCompletionPrompt(order); }}
              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <CheckCircle size={18} />
            </button>
          )}
          {order.status !== 'completed' && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteId(order._id); }}
              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </td>
      */}
    </tr>
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Order Management</h1>
          <p className="text-slate-500 text-sm font-bold">Update Order Status Over Here</p>
        </div>

        <div className="flex flex-1 items-center gap-2 max-w-4xl">
          {/* Global Search */}
          <div className="relative flex-1 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search everything..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-100 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Client Filter */}
          <select
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setSelectedContact(''); // Reset contact when client changes
            }}
          >
            <option value="">All Clients</option>
            {meta.clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Contact Filter */}
          <select
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            value={selectedContact}
            onChange={(e) => setSelectedContact(e.target.value)}
          >
            <option value="">All Contacts</option>
            {/* Show only contacts belonging to the selected client, or all unique contacts if no client selected */}
            {(selectedClient
              ? (meta.clientContacts[selectedClient] || [])
              : Array.from(new Set(Object.values(meta.clientContacts).flat()))
            ).map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Reset Button */}
          {(searchTerm || selectedClient || selectedContact) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedClient('');
                setSelectedContact('');
              }}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Reset Filters"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg whitespace-nowrap"
        >
          <Plus size={18} /> NEW INQUIRY
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-200/50 p-1 rounded-2xl w-fit">
        {[
          { id: 'inquiry', label: 'Inquiries', icon: Clock },
          { id: 'ongoing', label: 'Ongoing', icon: ArrowRight },
          { id: 'completed', label: 'Completed Orders', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === tab.id
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        {fetchLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Fetching Orders...</p>
          </div>
        ) : (
          <>
            {activeTab !== 'completed' ? (
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr className="text-[10px] font-black uppercase text-slate-400">
                    <th className="px-6 py-4">Identifiers</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Files</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <OrderRow key={order._id} order={order} />
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-20 text-center text-slate-400 font-bold text-sm uppercase">
                        No matches found for "{searchTerm}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="p-4 space-y-4">
                {Object.entries(groupedCompleted).length === 0 && (
                  <div className="py-20 text-center text-slate-400 font-bold text-sm uppercase">No completed records found</div>
                )}
                {Object.entries(groupedCompleted).map(([fy, months]) => (
                  <div key={fy} className="space-y-2">
                    <button onClick={() => toggleFolder(fy)} className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                      <FolderOpen size={18} className="text-indigo-500" />
                      <span className="font-black text-sm uppercase">{fy}</span>
                      {expandedFolders[fy] ? <ChevronDown size={16} className="ml-auto opacity-40" /> : <ChevronRight size={16} className="ml-auto opacity-40" />}
                    </button>
                    {expandedFolders[fy] && (
                      <div className="ml-6 space-y-2">
                        {Object.entries(months).map(([month, items]) => (
                          <div key={month} className="space-y-1">
                            <button onClick={() => toggleFolder(`${fy}-${month}`)} className="w-full flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                              <Calendar size={14} className="text-slate-400" />
                              <span className="font-bold text-xs uppercase text-slate-600">{month} ({items.length})</span>
                            </button>
                            {expandedFolders[`${fy}-${month}`] && (
                              <div className="overflow-hidden border border-slate-100 rounded-xl mb-4 bg-slate-50/30">
                                <table className="w-full text-left">
                                  <tbody>{items.map(order => <OrderRow key={order._id} order={order} />)}</tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {editOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 bg-white w-full rounded-[2.5rem] shadow-2xl p-8 space-y-6 overflow-y-auto custom-scrollbar">

            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="text-lg font-black uppercase">Record Details</h2>
              <button disabled={loading} onClick={() => setEditOrder(null)}>
                <X size={20} className={loading ? 'opacity-20' : ''} />
              </button>
            </div>

            {loading ? (
              /* LOADING BUFFER FOR EDIT */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-32">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <div className="text-center">
                  <p className="text-sm font-black uppercase text-slate-600 tracking-wider">Updating Record...</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Syncing changes to database</p>
                </div>
              </div>
            ) : (
              /* EDIT FORM CONTENT */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Project Title</label>
                    <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none" value={editOrder.title || ''} onChange={e => setEditOrder({ ...editOrder, title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Client Name</label>
                    <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none" value={editOrder.clientName || ''} onChange={e => setEditOrder({ ...editOrder, clientName: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">
                      {activeTab === 'ongoing' ? 'Quote Number' : 'Ref Number'}
                    </label>
                    <input readOnly className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none uppercase" value={(editOrder.refNumber) || ''} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Order Placed By</label>
                    <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none uppercase" placeholder="N/A" value={editOrder.orderPlacedBy || ''} onChange={e => setEditOrder({ ...editOrder, orderPlacedBy: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Project Notes</label>
                    <div className="flex gap-2 text-slate-300">
                      <ImageIcon size={12} title="Screenshots supported" />
                      <TableIcon size={12} title="Tables supported" />
                    </div>
                  </div>
                  <div
                    ref={editEditorRef}
                    contentEditable
                    onPaste={handlePaste}
                    dangerouslySetInnerHTML={{ __html: editOrder.description || '' }}
                    className="w-full bg-slate-50 p-5 rounded-xl font-bold text-sm outline-none min-h-[500px] border-2 border-transparent focus:border-indigo-100 transition-all overflow-y-auto"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {editOrder.attachments?.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                      >
                        <FileText size={12} />
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <button onClick={(e) => downloadFile(file, e)} className="text-indigo-500"><Download size={14} /></button>
                        <button onClick={() => setEditOrder({ ...editOrder, attachments: editOrder.attachments.filter((_, i) => i !== idx) })} className="text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                    <label className="cursor-pointer bg-indigo-50 text-indigo-500 p-2 rounded-lg flex items-center justify-center w-10 h-10">
                      <Plus size={16} />
                      <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                    </label>
                  </div>
                </div>
                <button
                  disabled={loading}
                  onClick={() => updateOrder(editOrder._id, editOrder)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg disabled:bg-slate-300 transition-all"
                >
                  {loading ? "Processing..." : "Update Database"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/*
      {
        editOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 bg-white w-full  rounded-[2.5rem] shadow-2xl p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h2 className="text-lg font-black uppercase">Record Details</h2>
                <button onClick={() => setEditOrder(null)}><X size={20} /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 px-1">Project Title</label>
                  <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none" value={editOrder.title || ''} onChange={e => setEditOrder({ ...editOrder, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 px-1">Client Name</label>
                  <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none" value={editOrder.clientName || ''} onChange={e => setEditOrder({ ...editOrder, clientName: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 px-1">
                    {activeTab === 'ongoing' ? 'Quote Number' : 'Ref Number'}
                  </label>
                  <input readOnly className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none uppercase" value={(editOrder.refNumber) || ''} onChange={e => setEditOrder({ ...editOrder, refNumber: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 px-1">Order Placed By</label>
                  <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none uppercase" placeholder="N/A" value={editOrder.orderPlacedBy || ''} onChange={e => setEditOrder({ ...editOrder, orderPlacedBy: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Project Notes</label>
                  <div className="flex gap-2 text-slate-300">
                    <ImageIcon size={12} title="Screenshots supported" />
                    <TableIcon size={12} title="Tables supported" />
                  </div>
                </div>
                <div
                  ref={editEditorRef}
                  contentEditable
                  onPaste={handlePaste}
                  dangerouslySetInnerHTML={{ __html: editOrder.description || '' }}
                  className="w-full bg-slate-50 p-5 rounded-xl font-bold text-sm outline-none min-h-[500px] border-2 border-transparent focus:border-indigo-100 transition-all overflow-y-auto"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-400">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {editOrder.attachments && editOrder.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {editOrder.attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.webUrl} // The URL returned by Microsoft Graph
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                        >
                          <FileText size={12} />
                          <span className="truncate max-w-[100px]">{file.name}</span>
                          <button onClick={(e) => downloadFile(file, e)} className="text-indigo-500"><Download size={14} /></button>
                          <button onClick={() => setEditOrder({ ...editOrder, attachments: editOrder.attachments.filter((_, i) => i !== idx) })} className="text-red-400"><X size={14} /></button>
                        </a>
                      ))}
                    </div>
                  )}
                  <label className="cursor-pointer bg-indigo-50 text-indigo-500 p-2 rounded-lg flex items-center justify-center w-10 h-10">
                    <Plus size={16} />
                    <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                  </label>
                </div>
              </div>

              <button onClick={() => { updateOrder(editOrder._id, editOrder); setEditOrder(null); }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs">Update Database</button>
            </div>
          </div>
        )
      }
*/}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black uppercase leading-tight">Create New Inquiry</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pasting screenshots & tables supported</p>
              </div>
              {/* Disable close button during loading to prevent state mismatch */}
              <button
                disabled={loading}
                onClick={() => setIsModalOpen(false)}
                className={`p-2 rounded-full ${loading ? 'opacity-20' : 'hover:bg-slate-100'}`}
              >
                <X size={20} />
              </button>
            </div>

            {loading ? (
              /* LOADING BUFFER: Shows while saveOrder is processing */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-32">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <div className="text-center">
                  <p className="text-sm font-black uppercase text-slate-600 tracking-wider">Submitting Inquiry...</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Saving to database and syncing files</p>
                </div>
              </div>
            ) : (
              /* FORM: Hidden when loading is true */
              <form onSubmit={saveOrder} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                <input required placeholder="Project Title" className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-indigo-100 transition-all" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <CustomCreatableSelect
                    label="Client Company"
                    options={meta.clients.map(c => ({ label: c, value: c }))}
                    value={formData.clientName ? { label: formData.clientName, value: formData.clientName } : null}
                    onChange={(v) => setFormData({ ...formData, clientName: v?.value || '', orderPlacedBy: '' })}
                    onDelete={(val) => deleteMetaItem('clients', val)}
                  />
                  <CustomCreatableSelect
                    label="Contact Person"
                    isDisabled={!formData.clientName}
                    options={(meta.clientContacts[formData.clientName] || []).map(c => ({ label: c, value: c }))}
                    value={formData.orderPlacedBy ? { label: formData.orderPlacedBy, value: formData.orderPlacedBy } : null}
                    onChange={(v) => setFormData({ ...formData, orderPlacedBy: v?.value || '' })}
                    onDelete={(val) => deleteMetaItem('contacts', val, formData.clientName)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requirements</label>
                    <div className="flex gap-2 text-slate-400">
                      <ImageIcon size={14} />
                      <TableIcon size={14} />
                    </div>
                  </div>
                  <div
                    ref={createEditorRef}
                    contentEditable
                    onPaste={handlePaste}
                    onInput={(e) => setFormData({ ...formData, description: e.currentTarget.innerHTML })}
                    className="w-full bg-slate-50 p-6 rounded-2xl text-sm outline-none min-h-[250px] border-2 border-transparent focus:border-indigo-100 transition-all shadow-inner custom-scrollbar"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}
                    data-placeholder="Describe project details... Paste images or Excel tables directly here."
                  />
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                  <label className="cursor-pointer bg-white text-slate-600 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 border border-slate-200 shadow-sm">
                    <Plus size={14} /> Attach Files
                    <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, false)} />
                  </label>
                  <div className="text-[10px] font-bold text-slate-400">{formData.attachments.length} files attached</div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-100">
                  Submit Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {
        quotePrompt && (
          <div className="fixed inset-0 z-[100] bg-indigo-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Hash size={24} /></div>
                <h3 className="text-lg font-black uppercase">Finalize Quote</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Assign a reference number to move to production</p>
              </div>
              <input
                autoFocus
                id="refInput"
                placeholder="e.g. Q-2024-001"
                className="w-full bg-slate-100 p-4 rounded-xl font-black text-center text-sm outline-none border-2 border-transparent focus:border-indigo-500 transition-all uppercase"
              />
              <div className="flex gap-2">
                <button onClick={() => setQuotePrompt(null)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase">Cancel</button>
                <button
                  onClick={() => {
                    const val = document.getElementById('refInput').value.trim();
                    if (val) {
                      updateOrder(quotePrompt._id, { status: 'ongoing', refNumber: val });
                      setQuotePrompt(null);
                    }
                  }}
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-black text-[10px] uppercase"
                >
                  Confirm & Start
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        completionPrompt && (
          <div className="fixed inset-0 z-[100] bg-emerald-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Receipt size={24} /></div>
                <h3 className="text-lg font-black uppercase">Completed Order</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Enter Final Invoice Number</p>
                <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Before Moving to Completed State</p>
              </div>
              <input
                autoFocus
                id="invoiceInput"
                placeholder="e.g. INV-10293"
                className="w-full bg-slate-100 p-4 rounded-xl font-black text-center text-sm outline-none border-2 border-transparent focus:border-emerald-500 transition-all uppercase"
              />
              <div className="flex gap-2">
                <button onClick={() => setCompletionPrompt(null)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase">Cancel</button>
                <button
                  onClick={() => {
                    const val = document.getElementById('invoiceInput').value.trim();
                    if (val) {
                      updateOrder(completionPrompt._id, {
                        status: 'completed',
                        invoiceNumber: val,
                        completedAt: new Date().toISOString()
                      });
                      setCompletionPrompt(null);
                    }
                  }}
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        deleteId && (
          <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black uppercase">Confirm Delete</h3>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[10px]">Cancel</button>
                <button onClick={async () => { await fetch(`${API_BASE_URL}/${deleteId}`, { method: 'DELETE' }); setDeleteId(null); fetchOrders(); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-[10px]">Delete</button>
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          font-weight: 600;
        }
        [contentEditable] table { border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #e2e8f0; font-size: 12px; }
        [contentEditable] td, [contentEditable] th { border: 1px solid #e2e8f0; padding: 6px; }
        [contentEditable] th { background: #f8fafc; }
        [contentEditable] img { cursor: default; }
      `}</style>
    </div >
  );
}