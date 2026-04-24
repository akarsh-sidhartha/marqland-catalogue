import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api';
import ClientPortalEditor from './ClientPortalEditor';
import CreatableSelect from 'react-select/creatable';
import {
  Plus, ArrowRight, CheckCircle, Clock, FileText, Image as ImageIcon,
  Trash2, ChevronRight, ChevronDown, X, FileSpreadsheet, Download,
  AlertTriangle, FolderOpen, Calendar, Hash, Receipt, Table as TableIcon,
  Search, Loader2, Link2, Copy, Send, Package, MapPin, UserPlus,
} from 'lucide-react';

const CC_EMAIL = 'info@marqland.com';

// ─────────────────────────────────────────────────────────────────────────────
// Inline form: CREATE a brand-new client + contact
// Pre-fills companyName and contactName from the order form so user only needs
// to add phone + email, then click save.
// ─────────────────────────────────────────────────────────────────────────────
function ClientCreateInlineForm({ clientName, contactName, onCreated, onSkip }) {
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    companyName: clientName || '',
    contacts: [{ name: contactName || '', phone: '', email: '' }],
  });
  const sc = (i, f, v) => {
    const c = [...form.contacts]; c[i] = { ...c[i], [f]: v };
    setForm(p => ({ ...p, contacts: c }));
  };
  const doSave = async () => {
    if (!form.companyName.trim()) return alert('Company name required');
    setSaving(true);
    try {
      const res = await api.post('/clients', form);
      onCreated(res.data);
    } catch (e) { alert('Failed: ' + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };
  return (
    <div className="px-6 py-5 space-y-4">
      <p className="text-sm text-slate-500">
        Fill in the contact details so we can send the portal link by email.
      </p>
      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Company Name</label>
        <input className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold focus:border-indigo-400 outline-none"
          value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
      </div>
      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Primary Contact</label>
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <input className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white focus:border-indigo-400 outline-none"
            placeholder="Contact name"
            value={form.contacts[0].name} onChange={e => sc(0, 'name', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="border border-slate-200 rounded-lg p-2 text-sm bg-white focus:border-indigo-400 outline-none"
              placeholder="Phone"
              value={form.contacts[0].phone} onChange={e => sc(0, 'phone', e.target.value)} />
            <input className="border border-slate-200 rounded-lg p-2 text-sm bg-white focus:border-indigo-400 outline-none"
              placeholder="Email (for portal link)"
              value={form.contacts[0].email} onChange={e => sc(0, 'email', e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
        <button onClick={onSkip} className="text-slate-400 font-bold text-sm hover:text-slate-600">
          Skip — save without email
        </button>
        <button onClick={doSave} disabled={saving || !form.companyName.trim()}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-2">
          {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />}
          Create Client & Send Email
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline form: ADD a contact to an EXISTING client
// ─────────────────────────────────────────────────────────────────────────────
function ContactAddInlineForm({ clientId, companyName, contactName, onAdded, onSkip }) {
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ name: contactName || '', phone: '', email: '' });

  const doSave = async () => {
    if (!form.name.trim()) return alert('Contact name required');
    setSaving(true);
    try {
      const res = await api.patch(`/clients/${clientId}/add-contact`, form);
      onAdded(res.data);
    } catch (e) { alert('Failed: ' + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };
  return (
    <div className="px-6 py-5 space-y-4">
      <p className="text-sm text-slate-500">
        <strong>{companyName}</strong> is in the database but <strong>"{contactName}"</strong> isn't
        listed as a contact yet. Add their details to send the portal link.
      </p>
      <div className="bg-slate-50 rounded-xl p-3 space-y-2">
        <input className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white focus:border-indigo-400 outline-none"
          placeholder="Contact name"
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <input className="border border-slate-200 rounded-lg p-2 text-sm bg-white focus:border-indigo-400 outline-none"
            placeholder="Phone"
            value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          <input className="border border-slate-200 rounded-lg p-2 text-sm bg-white focus:border-indigo-400 outline-none"
            placeholder="Email (for portal link)"
            value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
        <button onClick={onSkip} className="text-slate-400 font-bold text-sm hover:text-slate-600">
          Skip — save without email
        </button>
        <button onClick={doSave} disabled={saving || !form.name.trim()}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-2">
          {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />}
          Add Contact & Send Email
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKED SHIPMENTS PANEL
// Shown inside the Edit Order modal for product orders only.
// Fetches all shipments linked to this orderId and renders them as a compact
// read-only list. No editing here — full management is in Courier Tracking.
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLORS_OT = {
  'Pending':           'bg-slate-100 text-slate-500',
  'Booked':            'bg-blue-50 text-blue-600',
  'In Transit':        'bg-amber-50 text-amber-700',
  'Out for Delivery':  'bg-orange-50 text-orange-600',
  'Delivered':         'bg-emerald-50 text-emerald-700',
  'Completed':         'bg-emerald-50 text-emerald-700',
  'Returned':          'bg-red-50 text-red-500',
  'Exception':         'bg-red-50 text-red-500',
};

const LinkedShipmentsPanel = ({ orderId }) => {
  const [shipments, setShipments] = React.useState([]);
  const [loading, setLoading]     = React.useState(true);

  React.useEffect(() => {
    if (!orderId) return;
    api.get(`/shipments?orderId=${orderId}`)
      .then(res => setShipments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setShipments([]))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="text-[9px] font-black uppercase text-slate-400">
          Shipments
        </label>
        {shipments.length > 0 && (
          <span className="text-[9px] font-black uppercase text-slate-400">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl text-xs text-slate-400 font-bold">
          <Loader2 size={12} className="animate-spin" /> Loading shipments...
        </div>
      ) : shipments.length === 0 ? (
        <div className="px-4 py-3 bg-slate-50 rounded-xl text-xs text-slate-400 font-bold">
          No shipments linked to this order yet.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Recipient', 'City', 'Tracking ID', 'Partner', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shipments.map((s, i) => (
                <tr key={s._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-2">
                    <div className="text-xs font-bold text-slate-700 leading-tight">{s.recipientName}</div>
                    {s.phone && <div className="text-[10px] text-slate-400">{s.phone}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.city || '—'}</td>
                  <td className="px-3 py-2">
                    {s.trackingId
                      ? <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{s.trackingId}</span>
                      : <span className="text-slate-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.shippingPartner || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${STATUS_COLORS_OT[s.status] || 'bg-slate-100 text-slate-500'}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('inquiry');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [quotePrompt, setQuotePrompt] = useState(null);
  const [completionPrompt, setCompletionPrompt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedContact, setSelectedContact] = useState('');

  // meta is now populated from the /clients API, not just from past orders
  const [meta, setMeta] = useState({ clients: [], clientContacts: {}, clientMap: {} });
  // clientMap: { companyName → { _id, contacts: [{name,phone,email}] } }

  const createEditorRef = useRef(null);
  const editEditorRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '', clientName: '', orderPlacedBy: '',
    description: '', attachments: [], orderType: 'product',
  });
  const [sentLinks, setSentLinks] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [chatOrder, setChatOrder] = useState(null);

  // clientCheckModal has two modes:
  //   mode: 'create' — client not in DB at all
  //   mode: 'add-contact' — client exists but contact is new
  const [clientCheckModal, setClientCheckModal] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchClients();
  }, []);

  // ── Load clients from the /clients API ──────────────────────────────────────
  // This is the source of truth for the dropdowns, not the orders array.
  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      const data = Array.isArray(res.data) ? res.data : [];

      const clientMap = {};
      data.forEach(c => {
        clientMap[c.companyName] = { _id: c._id, contacts: c.contacts || [] };
      });

      const clients = data.map(c => c.companyName).sort();
      const clientContacts = {};
      data.forEach(c => {
        clientContacts[c.companyName] = (c.contacts || []).map(ct => ct.name).filter(Boolean).sort();
      });

      setMeta({ clients, clientContacts, clientMap });
    } catch (err) {
      console.warn('Could not load clients from API:', err.message);
    }
  };

  const filteredOrders = useMemo(() => {
    return (orders || []).filter(order => {
      const matchesTab = order.status === activeTab;
      const matchesClient = !selectedClient || order.clientName === selectedClient;
      const matchesContact = !selectedContact || order.orderPlacedBy === selectedContact;
      const term = searchTerm.toLowerCase();
      const searchFields = [
        order.clientName, order.title, order.refNumber, order._id,
        order.orderPlacedBy, order.invoiceNumber, order.description,
      ].join(' ').toLowerCase();
      const matchesSearch = !searchTerm || searchFields.includes(term);
      return matchesTab && matchesClient && matchesContact && matchesSearch;
    });
  }, [orders, activeTab, searchTerm, selectedClient, selectedContact]);

  const deleteMetaItem = (type, value, parentClient = null) => {
    setMeta(prev => {
      if (type === 'clients') {
        const newContacts = { ...prev.clientContacts };
        const newMap = { ...prev.clientMap };
        delete newContacts[value];
        delete newMap[value];
        return { ...prev, clients: prev.clients.filter(item => item !== value), clientContacts: newContacts, clientMap: newMap };
      } else {
        return {
          ...prev,
          clientContacts: {
            ...prev.clientContacts,
            [parentClient]: prev.clientContacts[parentClient].filter(item => item !== value),
          },
        };
      }
    });
  };

  const fetchOrders = async () => {
    setFetchLoading(true);
    try {
      const res = await api.get('/orders');
      const data = res.data;
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        console.error('Received non-array data:', data);
        setOrders([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
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
    return `${(fyStart).toString().slice(-2)}-${(fyStart + 1).toString().slice(-2)}`;
  };

  const getMonthName = (dateStr) => new Date(dateStr).toLocaleString('default', { month: 'long' });

  const groupedCompleted = useMemo(() => {
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

  const toggleFolder = (path) => setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));

  const handleFileUpload = (e, isEdit = false) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const attachment = { name: file.name, base64: event.target.result, isNew: true };
        if (isEdit) {
          setEditOrder(prev => ({ ...prev, attachments: [...(prev.attachments || []), attachment] }));
        } else {
          setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), attachment] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Helper: send portal email with CC ──────────────────────────────────────
  const sendPortalEmail = async ({ slug, clientEmail, contactName, clientName, orderRef, title, portalUrl }) => {
    await api.post('/portal/send-email', {
      slug, clientEmail, contactName, clientName, orderRef, title, portalUrl,
      cc: CC_EMAIL,  // always CC info@marqland.com
    });
  };

  // ── saveOrder — create inquiry, then handle client/contact DB logic ─────────
  const saveOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    const richDescription = createEditorRef.current ? createEditorRef.current.innerHTML : formData.description;
    const financialYear = getFinancialYear(new Date().toISOString());

    const fyOrders = orders.filter(o => o.refNumber && o.refNumber.startsWith('INQ-' + financialYear));
    let nextNumber = 1;
    if (fyOrders.length > 0) {
      const lastNumbers = fyOrders.map(o => {
        const parts = o.refNumber.split('-');
        return parseInt(parts.pop(), 10);
      }).filter(num => !isNaN(num));
      const maxNum = lastNumbers.length > 0 ? Math.max(...lastNumbers) : 0;
      nextNumber = maxNum + 1;
    }

    const generatedRef = `INQ-${financialYear}-${String(nextNumber).padStart(3, '0')}`;
    const payload = {
      ...formData,
      refNumber: generatedRef,
      description: richDescription,
      status: 'inquiry',
      attachments: formData.attachments,
    };

    try {
      const res = await api.post('/orders', payload);
      if (res.status === 201 || res.status === 200) {
        setIsModalOpen(false);
        setFormData({ title: '', clientName: '', orderPlacedBy: '', description: '', attachments: [], orderType: 'product' });
        fetchOrders();

        // ── Create the portal immediately so we get the real slug ──────────
        // The backend generates slug as "{5-char-token}-{refNumber}" e.g. "uk2al-inq-26-27-002".
        // We MUST create the portal here to learn that slug — computing it on the
        // frontend will always produce the wrong value (missing the token prefix).
        const savedOrder = res.data;
        let portalSlug = generatedRef.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let portalUrl  = `${window.location.origin}/p/${portalSlug}`;
        try {
          const portalRes = await api.post('/portal', {
            orderId:    savedOrder._id,
            type:       payload.orderType || 'product',
            orderRef:   generatedRef,
            clientName: payload.clientName,
            title:      payload.title,
          });
          if (portalRes.data?.slug) {
            portalSlug = portalRes.data.slug;
            portalUrl  = `${window.location.origin}/p/${portalSlug}`;
            console.log('✅ Portal created with slug:', portalSlug);
          }
        } catch (portalCreateErr) {
          // 409 = portal already exists for this order — fetch the existing one
          if (portalCreateErr.response?.status === 409 && portalCreateErr.response.data?.portal?.slug) {
            portalSlug = portalCreateErr.response.data.portal.slug;
            portalUrl  = `${window.location.origin}/p/${portalSlug}`;
            console.log('ℹ️ Portal already existed, slug:', portalSlug);
          } else {
            console.warn('Portal creation failed — slug may be wrong:', portalCreateErr.message);
          }
        }

        try {
          const lookup = await api.get('/clients/lookup', { params: { name: payload.clientName } });

          if (lookup.data.found && lookup.data.client) {
            const existingClient = lookup.data.client;

            // Check if the contact person is already in this client's contacts
            const contactName    = payload.orderPlacedBy?.trim() || '';
            const matchedContact = existingClient.contacts?.find(
              ct => ct.name?.toLowerCase() === contactName.toLowerCase()
            );

            if (matchedContact?.email) {
              // ── Scenario A: Client exists, contact exists with email → send immediately ──
              try {
                await sendPortalEmail({
                  slug: portalSlug, clientEmail: matchedContact.email,
                  contactName: matchedContact.name, clientName: existingClient.companyName,
                  orderRef: generatedRef, title: payload.title, portalUrl,
                });
                console.log('✅ Portal email sent to', matchedContact.email);
              } catch (emailErr) {
                console.warn('Email send failed (non-fatal):', emailErr.message);
              }
            } else if (matchedContact && !matchedContact.email) {
              // ── Scenario B: Contact exists but has no email → show add-contact modal ──
              setClientCheckModal({
                mode:        'add-contact',
                clientId:    existingClient._id,
                companyName: existingClient.companyName,
                contactName: contactName,
                orderRef:    generatedRef,
                title:       payload.title,
                portalSlug,
                portalUrl,
              });
            } else {
              // ── Scenario C: Client exists, but this contact is brand new → add contact ──
              setClientCheckModal({
                mode:        'add-contact',
                clientId:    existingClient._id,
                companyName: existingClient.companyName,
                contactName: contactName,
                orderRef:    generatedRef,
                title:       payload.title,
                portalSlug,
                portalUrl,
              });
            }
          } else {
            // ── Scenario D: Client not in DB at all → create client modal ──
            setClientCheckModal({
              mode:        'create',
              clientName:  payload.clientName,
              contactName: payload.orderPlacedBy?.trim() || '',
              orderRef:    generatedRef,
              title:       payload.title,
              portalSlug,
              portalUrl,
            });
          }
        } catch (lookupErr) {
          console.warn('Client lookup failed:', lookupErr.message);
          setClientCheckModal({
            mode:        'create',
            clientName:  payload.clientName,
            contactName: payload.orderPlacedBy?.trim() || '',
            orderRef:    generatedRef,
            title:       payload.title,
            portalSlug,
            portalUrl:   `${window.location.origin}/p/${portalSlug}`,
          });
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateOrder = async (id, payload, e) => {
    if (e) e.stopPropagation();
    setLoading(true);
    const finalPayload = { ...payload };
    if (editEditorRef.current && id === editOrder?._id) {
      finalPayload.description = editEditorRef.current.innerHTML;
    }
    try {
      await api.patch(`/orders/${id}`, finalPayload);
      setEditOrder(null);
      fetchOrders();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const CustomCreatableSelect = ({ label, options, value, onChange, onDelete, isDisabled }) => (
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
              <button onClick={(e) => { e.stopPropagation(); onDelete(option.value); }} className="hover:text-red-500 p-1">
                <X size={12} />
              </button>
            )}
          </div>
        )}
        styles={{
          control: (base) => ({
            ...base, border: 'none', borderRadius: '0.75rem', padding: '4px',
            backgroundColor: '#f8fafc', fontSize: '14px', fontWeight: 'bold',
          }),
        }}
      />
    </div>
  );

  const downloadFile = (file, e) => {
    e.stopPropagation();
    const url = file.downloadUrl || file['@microsoft.graph.downloadUrl'] || file.webUrl;
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
    <tr onClick={() => setEditOrder(order)}
      className="hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-0">
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
              {order.refNumber
                ? <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded uppercase tracking-wider w-fit">{order.refNumber}</span>
                : <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded w-fit">#{order._id.slice(-6)}</span>
              }
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${order.orderType === 'offsite' ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'}`}
            title={order.orderType === 'offsite' ? 'Offsite / Property' : 'Product Gifting'}>
            {order.orderType === 'offsite' ? <MapPin size={12} /> : <Package size={12} />}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-800 leading-tight">{order.title}</div>
            <div className="flex flex-col mt-0.5">
              <span className="text-[11px] text-slate-500 font-bold">{order.clientName}</span>
              <span className="text-[10px] text-slate-400 font-medium leading-tight">Attn: {order.orderPlacedBy || 'N/A'}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 max-w-xs">
        <div className="text-xs text-slate-500 line-clamp-1 italic pointer-events-none"
          dangerouslySetInnerHTML={{ __html: order.description?.replace(/<img[^>]*>/g, '[Image]') || '...' }} />
      </td>
      <td className="px-6 py-4">
        {order.attachments && order.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {order.attachments.map((file, idx) => (
              <a key={idx} href={file.webUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors">
                <FileText size={12} />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); downloadFile(file, e); }}
                  className="text-indigo-500"><Download size={14} /></button>
              </a>
            ))}
          </div>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {order.status === 'inquiry' && (
            <button disabled={loading} onClick={(e) => { e.stopPropagation(); setQuotePrompt(order); }}
              className={`px-3 py-1.5 rounded-lg font-black text-[10px] transition-colors uppercase ${loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
              {loading ? '...' : 'Start Project'}
            </button>
          )}
          {order.status === 'ongoing' && (
            <button disabled={loading} onClick={(e) => { e.stopPropagation(); setCompletionPrompt(order); }}
              className={`p-2 rounded-lg transition-colors ${loading ? 'text-slate-300 cursor-not-allowed' : 'text-emerald-500 hover:bg-emerald-50'}`} title="Mark complete">
              <CheckCircle size={18} className={loading ? 'animate-pulse' : ''} />
            </button>
          )}
          {(order.status === 'inquiry' || order.status === 'ongoing') && (
            <button onClick={(e) => { e.stopPropagation(); setChatOrder(order); }}
              className="p-2 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Open portal chat">
              <Link2 size={16} />
            </button>
          )}
          {(order.status === 'inquiry' || order.status === 'ongoing') && (() => {
            const slug      = order.refNumber?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const portalUrl = `${window.location.origin}/p/${slug}`;
            const alreadySent = sentLinks[order._id];
            const justCopied  = copiedId === order._id;
            if (alreadySent) {
              return (
                <div className="relative group">
                  <button disabled className="p-2 text-slate-300 cursor-not-allowed rounded-lg" title="Link already sent">
                    <Send size={16} />
                  </button>
                  <div className="absolute right-0 top-8 hidden group-hover:flex flex-col gap-1.5 bg-slate-900 text-white rounded-xl p-3 shadow-xl z-50 min-w-[180px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Link sent</span>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(portalUrl); setCopiedId(order._id); setTimeout(() => setCopiedId(null), 2000); }}
                      className="flex items-center gap-2 text-[11px] font-bold text-indigo-300 hover:text-white transition-colors">
                      {justCopied ? <CheckCircle size={12} /> : <Copy size={12} />}
                      {justCopied ? 'Copied!' : 'Copy link again'}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <button onClick={async (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(portalUrl);
                setSentLinks(prev => ({ ...prev, [order._id]: slug }));
                setCopiedId(order._id);
                setTimeout(() => setCopiedId(null), 2000);
              }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Copy & send client link">
                {justCopied ? <CheckCircle size={16} className="text-emerald-500" /> : <Send size={16} />}
              </button>
            );
          })()}
          {order.status !== 'completed' && (
            <button disabled={loading} onClick={(e) => { e.stopPropagation(); setDeleteId(order._id); }}
              className={`p-2 transition-colors ${loading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500'}`}>
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </td>
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
          <div className="relative flex-1 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search everything..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-100 outline-none"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setSelectedContact(''); }}>
            <option value="">All Clients</option>
            {meta.clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            value={selectedContact} onChange={(e) => setSelectedContact(e.target.value)}>
            <option value="">All Contacts</option>
            {(selectedClient
              ? (meta.clientContacts[selectedClient] || [])
              : Array.from(new Set(Object.values(meta.clientContacts).flat()))
            ).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(searchTerm || selectedClient || selectedContact) && (
            <button onClick={() => { setSearchTerm(''); setSelectedClient(''); setSelectedContact(''); }}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Reset Filters">
              <X size={18} />
            </button>
          )}
        </div>
        <button onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg whitespace-nowrap">
          <Plus size={18} /> NEW INQUIRY
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-200/50 p-1 rounded-2xl w-fit">
        {[
          { id: 'inquiry', label: 'Inquiries', icon: Clock },
          { id: 'ongoing', label: 'Ongoing', icon: ArrowRight },
          { id: 'completed', label: 'Completed Orders', icon: Calendar },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon size={14} />{tab.label}
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
                  {filteredOrders.map(order => <OrderRow key={order._id} order={order} />)}
                  {filteredOrders.length === 0 && (
                    <tr><td colSpan="5" className="py-20 text-center text-slate-400 font-bold text-sm uppercase">
                      No matches found{searchTerm ? ` for "${searchTerm}"` : ''}
                    </td></tr>
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

      {/* ── Edit Order Modal ── */}
      {editOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 w-full rounded-[2.5rem] shadow-2xl p-8 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="text-lg font-black uppercase">Record Details</h2>
              <button disabled={loading} onClick={() => setEditOrder(null)}>
                <X size={20} className={loading ? 'opacity-20' : ''} />
              </button>
            </div>
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-32">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <div className="text-center">
                  <p className="text-sm font-black uppercase text-slate-600 tracking-wider">Updating Record...</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Syncing changes to database</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Project Title</label>
                    <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none"
                      value={editOrder.title || ''} onChange={e => setEditOrder({ ...editOrder, title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Client Name</label>
                    <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none"
                      value={editOrder.clientName || ''} onChange={e => setEditOrder({ ...editOrder, clientName: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">
                      {activeTab === 'ongoing' ? 'Quote Number' : 'Ref Number'}
                    </label>
                    <input readOnly className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none uppercase"
                      value={editOrder.refNumber || ''} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 px-1">Order Placed By</label>
                    <input className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none uppercase"
                      placeholder="N/A" value={editOrder.orderPlacedBy || ''}
                      onChange={e => setEditOrder({ ...editOrder, orderPlacedBy: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Project Notes</label>
                    <div className="flex gap-2 text-slate-300"><ImageIcon size={12} /><TableIcon size={12} /></div>
                  </div>
                  <div ref={editEditorRef} contentEditable onPaste={handlePaste}
                    dangerouslySetInnerHTML={{ __html: editOrder.description || '' }}
                    className="w-full bg-slate-50 p-5 rounded-xl font-bold text-sm outline-none min-h-[500px] border-2 border-transparent focus:border-indigo-100 transition-all overflow-y-auto"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }} />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {editOrder.attachments?.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
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
                {/* ── Linked Shipments — product orders only ── */}
                {editOrder.orderType !== 'offsite' && (
                  <LinkedShipmentsPanel orderId={editOrder._id} />
                )}

                <button disabled={loading} onClick={() => updateOrder(editOrder._id, editOrder)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg disabled:bg-slate-300 transition-all">
                  {loading ? 'Processing...' : 'Update Database'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── New Inquiry Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black uppercase leading-tight">Create New Inquiry</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pasting screenshots & tables supported</p>
              </div>
              <button disabled={loading} onClick={() => setIsModalOpen(false)}
                className={`p-2 rounded-full ${loading ? 'opacity-20' : 'hover:bg-slate-100'}`}>
                <X size={20} />
              </button>
            </div>
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-32">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <div className="text-center">
                  <p className="text-sm font-black uppercase text-slate-600 tracking-wider">Submitting Inquiry...</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Saving to database and syncing files</p>
                </div>
              </div>
            ) : (
              <form onSubmit={saveOrder} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                <input required placeholder="Project Title"
                  className="w-full bg-slate-50 p-4 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-indigo-100 transition-all"
                  value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />

                <div className="grid grid-cols-2 gap-3">
                  {[{ v: 'product', label: '🎁 Product Gifting' }, { v: 'offsite', label: '🏨 Offsite' }].map(({ v, label }) => (
                    <button type="button" key={v} onClick={() => setFormData({ ...formData, orderType: v })}
                      className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${formData.orderType === v ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>

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
                    <div className="flex gap-2 text-slate-400"><ImageIcon size={14} /><TableIcon size={14} /></div>
                  </div>
                  <div ref={createEditorRef} contentEditable onPaste={handlePaste}
                    onInput={(e) => setFormData({ ...formData, description: e.currentTarget.innerHTML })}
                    className="w-full bg-slate-50 p-6 rounded-2xl text-sm outline-none min-h-[250px] border-2 border-transparent focus:border-indigo-100 transition-all shadow-inner custom-scrollbar"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}
                    data-placeholder="Describe project details... Paste images or Excel tables directly here." />
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

      {/* ── Quote prompt ── */}
      {quotePrompt && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Hash size={24} /></div>
              <h3 className="text-lg font-black uppercase">Finalize Quote</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Assign a reference number to move to production</p>
            </div>
            <input autoFocus id="refInput" placeholder="e.g. Q-2024-001"
              className="w-full bg-slate-100 p-4 rounded-xl font-black text-center text-sm outline-none border-2 border-transparent focus:border-indigo-500 transition-all uppercase" />
            <div className="flex gap-2">
              <button onClick={() => setQuotePrompt(null)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase">Cancel</button>
              <button onClick={() => { const val = document.getElementById('refInput').value.trim(); if (val) { updateOrder(quotePrompt._id, { status: 'ongoing', refNumber: val }); setQuotePrompt(null); } }}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-black text-[10px] uppercase">Confirm & Start</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Completion prompt ── */}
      {completionPrompt && (
        <div className="fixed inset-0 z-[100] bg-emerald-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Receipt size={24} /></div>
              <h3 className="text-lg font-black uppercase">Completed Order</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Enter Final Invoice Number</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Before Moving to Completed State</p>
            </div>
            <input autoFocus id="invoiceInput" placeholder="e.g. INV-10293"
              className="w-full bg-slate-100 p-4 rounded-xl font-black text-center text-sm outline-none border-2 border-transparent focus:border-emerald-500 transition-all uppercase" />
            <div className="flex gap-2">
              <button onClick={() => setCompletionPrompt(null)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase">Cancel</button>
              <button onClick={() => { const val = document.getElementById('invoiceInput').value.trim(); if (val) { updateOrder(completionPrompt._id, { status: 'completed', invoiceNumber: val, completedAt: new Date().toISOString() }); setCompletionPrompt(null); } }}
                className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32} /></div>
            <h3 className="text-xl font-black uppercase">Confirm Delete</h3>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[10px]">Cancel</button>
              <button onClick={async () => {
                await api.delete(`/orders/${deleteId}`);
                try { const portalRes = await api.get(`/portal/order/${deleteId}`); if (portalRes.data?.slug) await api.delete(`/portal/${portalRes.data.slug}`); } catch {}
                setDeleteId(null); fetchOrders();
              }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-[10px]">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CLIENT CHECK MODAL
          Three cases handled here, driven by clientCheckModal.mode:
            'create'      → client not in DB at all
            'add-contact' → client exists, but this contact is new
      ══════════════════════════════════════════════════════════════════════ */}
      {clientCheckModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                  {clientCheckModal.mode === 'create' ? '⚠️' : <UserPlus size={16} className="text-amber-600" />}
                </div>
                <div>
                  <div className="font-black text-sm text-slate-800">
                    {clientCheckModal.mode === 'create' ? 'Client Not in Database' : 'New Contact Person'}
                  </div>
                  <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                    {clientCheckModal.mode === 'create'
                      ? `"${clientCheckModal.clientName}" has no client record yet.`
                      : `"${clientCheckModal.contactName}" is not listed under ${clientCheckModal.companyName}.`
                    }
                  </div>
                </div>
              </div>
              <button onClick={() => setClientCheckModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* Body — switches between create-client and add-contact forms */}
            {clientCheckModal.mode === 'create' ? (
              <ClientCreateInlineForm
                clientName={clientCheckModal.clientName}
                contactName={clientCheckModal.contactName}
                onCreated={async (newClient) => {
                  setClientCheckModal(null);
                  await fetchClients(); // refresh dropdown
                  const emailContact = newClient.contacts?.find(ct => ct.email?.includes('@'));
                  if (emailContact?.email) {
                    try {
                      await sendPortalEmail({
                        slug:        clientCheckModal.portalSlug,
                        clientEmail: emailContact.email,
                        contactName: newClient.contacts?.[0]?.name || emailContact.name || '',
                        clientName:  newClient.companyName,
                        orderRef:    clientCheckModal.orderRef,
                        title:       clientCheckModal.title,
                        portalUrl:   clientCheckModal.portalUrl,
                      });
                      alert(`✅ Portal link sent to ${emailContact.email} (CC: ${CC_EMAIL})`);
                    } catch (e) {
                      alert('Client created but email failed: ' + e.message);
                    }
                  } else {
                    alert('Client created. Add an email address to them to send the portal link.');
                  }
                }}
                onSkip={() => setClientCheckModal(null)}
              />
            ) : (
              <ContactAddInlineForm
                clientId={clientCheckModal.clientId}
                companyName={clientCheckModal.companyName}
                contactName={clientCheckModal.contactName}
                onAdded={async (updatedClient) => {
                  setClientCheckModal(null);
                  await fetchClients(); // refresh dropdown with new contact
                  const newContact = updatedClient.contacts?.find(
                    ct => ct.name?.toLowerCase() === clientCheckModal.contactName?.toLowerCase()
                  );
                  if (newContact?.email) {
                    try {
                      await sendPortalEmail({
                        slug:        clientCheckModal.portalSlug,
                        clientEmail: newContact.email,
                        contactName: newContact.name,
                        clientName:  updatedClient.companyName,
                        orderRef:    clientCheckModal.orderRef,
                        title:       clientCheckModal.title,
                        portalUrl:   clientCheckModal.portalUrl,
                      });
                      alert(`✅ Contact added & portal link sent to ${newContact.email} (CC: ${CC_EMAIL})`);
                    } catch (e) {
                      alert('Contact added but email failed: ' + e.message);
                    }
                  } else {
                    alert('Contact added. No email provided — portal link not sent.');
                  }
                }}
                onSkip={() => setClientCheckModal(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Client Portal Editor ── */}
      {chatOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-end"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setChatOrder(null); }}>
          <div className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col" style={{ animation: 'slideIn .25s ease', position: 'relative' }}>
            <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:none}}`}</style>
            <ClientPortalEditor order={chatOrder} onClose={() => setChatOrder(null)} />
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar:empty:before { content: attr(data-placeholder); color: #94a3b8; font-weight: 600; }
        [contentEditable] table { border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #e2e8f0; font-size: 12px; }
        [contentEditable] td, [contentEditable] th { border: 1px solid #e2e8f0; padding: 6px; }
        [contentEditable] th { background: #f8fafc; }
        [contentEditable] img { cursor: default; }
      `}</style>
    </div>
  );
}