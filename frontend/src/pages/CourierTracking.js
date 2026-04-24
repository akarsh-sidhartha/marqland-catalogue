import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import {
  Truck, Plus, Upload, Search, X, RefreshCw, AlertTriangle,
  Clock, Package, Settings, ExternalLink,
  Loader2, Check, Trash2, MapPin, Link2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// ROLE MODEL
//
// courier     = Vendor (picks up parcels, ships via courier partners)
//               - Can: Add Shipment, Import Excel, edit/delete own rows
//               - Cannot: Link orders, see Shipping Partners settings,
//                         see Vendor/Partner filters
//
// admin / sales / accounts / inventory / viewer = Marqland employees
//               - Can: Everything above PLUS link orders to shipments,
//                      manage Shipping Partners, see all filters
//
// THE ORDER-LINKING FLOW:
//   Vendors add shipments without any order link (field hidden from them).
//   Rows appear in Marqland view with an amber "Link Order" button inline.
//   Marqland staff click it, pick an order from a dropdown, done.
//   No separate workflow or screen needed.
// ─────────────────────────────────────────────────────────────────────────────
const MARQLAND_ROLES = ['admin', 'sales', 'accounts', 'inventory', 'viewer'];

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

const isDelayed = (s) => {
  if (!s || ['Delivered', 'Completed', 'Returned'].includes(s.status)) return false;
  return (Date.now() - new Date(s.shippedDate || s.createdAt).getTime()) / 86400000 > 4;
};

const STATUS_COLORS = {
  'Pending': 'bg-slate-100 text-slate-600',
  'Booked': 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  'Out for Delivery': 'bg-orange-100 text-orange-700',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Returned': 'bg-red-100 text-red-700',
  'Exception': 'bg-red-100 text-red-700',
};

const MANUAL_STATUSES = ['Pending', 'Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Exception'];
const COMPLETED_STATUSES = ['Delivered', 'Completed', 'Returned'];

// ── Tiny date input wrapper ───────────────────────────────────────────────────
const DateInput = ({ value, onChange, label, required }) => (
  <div>
    {label && <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>}
    <input type="date" value={value} onChange={e => onChange(e.target.value)} required={required}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-indigo-400 bg-white transition" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING PARTNER MANAGER MODAL
// Visible to Marqland admin only.
//
// Currently only needs two fields:
//   - Name        → passed to trackcourier.io as the `courier` hint for better
//                   auto-detection accuracy (e.g. "Blue Dart" → "blue_dart")
//   - Tracking URL → public URL shown in the table as a "track on partner site"
//                   link next to each AWB number (optional but useful)
//
// API Endpoint + API Key are stored on the model but hidden here until a
// direct integration is actually wired up in shipmentTrackingService.js.
// ─────────────────────────────────────────────────────────────────────────────
const ShippingPartnerModal = ({ onClose, partners, onSaved }) => {
  const [list, setList] = useState(partners);
  const [form, setForm] = useState({ name: '', trackingUrl: '' });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const res = await api.put(`/shipping-partners/${editId}`, form);
        setList(l => l.map(p => p._id === editId ? res.data : p));
      } else {
        const res = await api.post('/shipping-partners', form);
        setList(l => [...l, res.data]);
      }
      setForm({ name: '', trackingUrl: '' });
      setEditId(null);
      onSaved();
    } catch (e) { alert(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this partner?')) return;
    await api.delete(`/shipping-partners/${id}`);
    setList(l => l.filter(p => p._id !== id));
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-indigo-600" />
            <span className="font-black text-sm uppercase">Shipping Partners</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        {/* Context note */}
        <div className="mx-4 mt-4 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-600 font-semibold">
          Tracking is handled via <span className="font-black">trackcourier.io</span>. Just add the partner name and their public tracking URL — no API keys needed here yet.
        </div>

        {/* Existing partners list */}
        <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2">
          {list.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No partners added yet.</p>}
          {list.map(p => (
            <div key={p._id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-800">{p.name}</div>
                {p.trackingUrl
                  ? <a href={p.trackingUrl} target="_blank" rel="noreferrer"
                    className="text-[10px] text-indigo-500 flex items-center gap-0.5 hover:underline truncate">
                    <ExternalLink size={9} /> {p.trackingUrl}
                  </a>
                  : <span className="text-[10px] text-slate-400">No tracking URL</span>
                }
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => { setEditId(p._id); setForm({ name: p.name, trackingUrl: p.trackingUrl || '' }); }}
                  className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition">
                  Edit
                </button>
                <button onClick={() => del(p._id)}
                  className="text-[10px] font-bold px-2 py-1 bg-red-50 rounded-lg text-red-500 hover:bg-red-100 transition">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add / Edit form */}
        <div className="px-4 py-4 border-t border-slate-100 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase">{editId ? 'Edit Partner' : 'Add Partner'}</p>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Partner Name *</label>
              <input value={form.name} onChange={e => sf('name', e.target.value)}
                placeholder="e.g. Blue Dart, DTDC, DP World"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                Public Tracking URL <span className="normal-case font-medium text-slate-400">(optional)</span>
              </label>
              <input value={form.trackingUrl} onChange={e => sf('trackingUrl', e.target.value)}
                placeholder="https://www.bluedart.com/tracking"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
              <p className="text-[10px] text-slate-400 mt-1">Shown as a link next to AWB numbers in the tracking table.</p>
            </div>

            {/* uncomment when you have dedicated APIS from trackng partners ready */}
            {/* <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">API Endpoint</label>
              <input value={form.apiEndpoint} onChange={e => sf('apiEndpoint', e.target.value)}
                placeholder="https://api.partner.com/track"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">API Key</label>
              <input value={form.apiKey} onChange={e => sf('apiKey', e.target.value)}
                type="password" placeholder="API key / token"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div> */}
            
          </div>
          <div className="flex justify-between items-center pt-1">
            {editId && (
              <button onClick={() => { setEditId(null); setForm({ name: '', trackingUrl: '' }); }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel edit</button>
            )}
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="ml-auto px-5 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5">
              {saving && <Loader2 size={11} className="animate-spin" />}
              {editId ? 'Update' : 'Add Partner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD / EDIT SHIPMENT MODAL
//
// showOrderLink prop:
//   true  → Marqland staff — "Linked Order" dropdown is visible
//   false → Vendor — "Linked Order" field is completely hidden;
//           isAdhoc defaults to true and a notice is shown
// ─────────────────────────────────────────────────────────────────────────────
const ShipmentModal = ({ shipment, orders, partners, showOrderLink, onSave, onClose }) => {
  const isEdit = !!shipment?._id;
  const [form, setForm] = useState({
    shippedDate: shipment?.shippedDate ? shipment.shippedDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    recipientName: shipment?.recipientName || '',
    recipientAddress: shipment?.recipientAddress || '',
    city: shipment?.city || '',
    state: shipment?.state || '',
    phone: shipment?.phone || '',
    trackingId: shipment?.trackingId || '',
    shippingPartner: shipment?.shippingPartner || '',
    status: shipment?.status || 'Pending',
    orderId: shipment?.orderId || '',
    isAdhoc: showOrderLink ? (shipment?.isAdhoc ?? false) : true,
    notes: shipment?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.recipientName.trim()) return alert('Recipient name required');
    if (!form.shippedDate) return alert('Date required');
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-indigo-600" />
            <span className="font-black text-sm uppercase">{isEdit ? 'Edit Shipment' : 'Add Shipment'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Vendor notice */}
          {!showOrderLink && (
            <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-bold flex items-center gap-2">
              <AlertTriangle size={13} className="shrink-0" />
              Shipments will be saved unlinked. Marqland staff will assign them to orders.
            </div>
          )}

          {/* Date row — full width for vendors, split with order link for Marqland */}
          <div className={`grid gap-4 ${showOrderLink ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <DateInput label="Shipped Date *" value={form.shippedDate} onChange={v => f('shippedDate', v)} required />
            {showOrderLink && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Linked Order</label>
                <select value={form.orderId}
                  onChange={e => { f('orderId', e.target.value); f('isAdhoc', !e.target.value); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white transition">
                  <option value="">— Ad-hoc (no order) —</option>
                  {orders.map(o => (
                    <option key={o._id} value={o._id}>{o.refNumber || o._id.slice(-6)} — {o.clientName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Name + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recipient Name *</label>
              <input value={form.recipientName} onChange={e => f('recipientName', e.target.value)} placeholder="Full name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="Mobile number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Address</label>
            <textarea value={form.recipientAddress} onChange={e => f('recipientAddress', e.target.value)}
              rows={2} placeholder="Full delivery address"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition resize-none" />
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">City *</label>
              <input value={form.city} onChange={e => f('city', e.target.value)} placeholder="City"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">State</label>
              <input value={form.state} onChange={e => f('state', e.target.value)} placeholder="State"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
          </div>

          {/* Tracking ID + Shipping Partner */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tracking ID</label>
              <input value={form.trackingId} onChange={e => f('trackingId', e.target.value)} placeholder="AWB / Tracking number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 transition" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Shipping Partner</label>
              <select value={form.shippingPartner} onChange={e => f('shippingPartner', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white transition">
                <option value="">— Select Partner —</option>
                {partners.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Status + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
              <select value={form.status} onChange={e => f('status', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white transition">
                {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</label>
              <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional note"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5 shadow-sm">
            {saving && <Loader2 size={11} className="animate-spin" />}
            {isEdit ? 'Update' : 'Save Shipment'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL IMPORT MODAL
//
// showOrderLink = false for vendors:
//   - "Link to Order" dropdown is hidden
//   - Amber notice explains Marqland will link later
//   - All rows saved with isAdhoc: true
//
// showOrderLink = true for Marqland:
//   - Dropdown at top to optionally link entire batch to one order
// ─────────────────────────────────────────────────────────────────────────────
const ExcelImportModal = ({ orders, partners, showOrderLink, onImported, onClose }) => {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [linkedOrderId, setLinkedOrderId] = useState('');
  const fileRef = useRef(null);

  const parseExcel = (file) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Auto-detect header row
        let headerIdx = 0;
        for (let i = 0; i < Math.min(raw.length, 5); i++) {
          if (raw[i].map(c => String(c).toLowerCase()).some(c => c.includes('name') || c.includes('contact'))) {
            headerIdx = i; break;
          }
        }
        const headers = raw[headerIdx].map(h => String(h).trim().toLowerCase());
        const dataRows = raw.slice(headerIdx + 1).filter(r => r.some(c => c !== ''));

        const nameIdx = headers.findIndex(h => h.includes('name'));
        const addrIdx = headers.findIndex(h => h.includes('address'));
        const cityIdx = headers.findIndex(h => h.includes('location') || h.includes('city'));
        const phoneIdx = headers.findIndex(h => h.includes('contact') || h.includes('phone'));

        setRows(dataRows.map(r => ({
          shippedDate: new Date().toISOString().slice(0, 10),
          recipientName: nameIdx >= 0 ? String(r[nameIdx] || '').trim() : '',
          recipientAddress: addrIdx >= 0 ? String(r[addrIdx] || '').trim() : '',
          city: cityIdx >= 0 ? String(r[cityIdx] || '').trim() : '',
          phone: phoneIdx >= 0 ? String(r[phoneIdx] || '').trim() : '',
          state: '', trackingId: '', shippingPartner: '',
          status: 'Pending', notes: '',
          orderId: showOrderLink ? linkedOrderId : '',
          isAdhoc: !showOrderLink || !linkedOrderId,
        })).filter(r => r.recipientName));
      } catch (err) { setError('Could not parse Excel: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateRow = (idx, key, val) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const saveAll = async () => {
    if (!rows.length) return;
    setSaving(true);
    try { await api.post('/shipments/bulk', { shipments: rows }); onImported(); }
    catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-indigo-600" />
            <span className="font-black text-sm uppercase">Import from Excel</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 shrink-0 flex-wrap">
          <label className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase cursor-pointer hover:bg-indigo-700 transition flex items-center gap-1.5">
            <Upload size={12} /> Choose Excel File
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { if (e.target.files[0]) parseExcel(e.target.files[0]); }} />
          </label>
          {rows.length > 0 && <span className="text-xs font-bold text-slate-500">{rows.length} rows loaded</span>}

          {/* Order link selector — Marqland only */}
          {showOrderLink && (
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Link all to Order:</label>
              <select value={linkedOrderId}
                onChange={e => {
                  setLinkedOrderId(e.target.value);
                  setRows(r => r.map(row => ({ ...row, orderId: e.target.value, isAdhoc: !e.target.value })));
                }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white">
                <option value="">— Ad-hoc (no order) —</option>
                {orders.map(o => <option key={o._id} value={o._id}>{o.refNumber || o._id.slice(-6)} — {o.clientName}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Vendor notice */}
        {!showOrderLink && (
          <div className="mx-6 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-bold flex items-center gap-2 shrink-0">
            <AlertTriangle size={13} className="shrink-0" />
            These shipments will be saved without an order link. Marqland staff will assign them to orders after review.
          </div>
        )}

        {error && (
          <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold shrink-0">
            ⚠ {error}
          </div>
        )}

        {rows.length > 0 ? (
          <div className="flex-1 overflow-auto px-4 py-3">
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead>
                <tr>
                  {['Date', 'Name', 'Address', 'City', 'State', 'Phone', 'Tracking ID', 'Partner', 'Status', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="bg-slate-50 rounded-xl">
                    <td className="px-1 py-1"><input type="date" value={r.shippedDate} onChange={e => updateRow(i, 'shippedDate', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-32" /></td>
                    <td className="px-1 py-1"><input value={r.recipientName} onChange={e => updateRow(i, 'recipientName', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-32" /></td>
                    <td className="px-1 py-1"><input value={r.recipientAddress} onChange={e => updateRow(i, 'recipientAddress', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-40" /></td>
                    <td className="px-1 py-1"><input value={r.city} onChange={e => updateRow(i, 'city', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-24" /></td>
                    <td className="px-1 py-1"><input value={r.state} onChange={e => updateRow(i, 'state', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-24" /></td>
                    <td className="px-1 py-1"><input value={r.phone} onChange={e => updateRow(i, 'phone', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-28" /></td>
                    <td className="px-1 py-1"><input value={r.trackingId} onChange={e => updateRow(i, 'trackingId', e.target.value)} placeholder="AWB #" className="border border-slate-200 rounded px-2 py-1 text-xs font-mono outline-none w-28" /></td>
                    <td className="px-1 py-1">
                      <select value={r.shippingPartner} onChange={e => updateRow(i, 'shippingPartner', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white outline-none w-28">
                        <option value="">— Select —</option>
                        {partners.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select value={r.status} onChange={e => updateRow(i, 'status', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white outline-none w-32">
                        {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <button onClick={() => setRows(r => r.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600">
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
            <Upload size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-bold">Upload an Excel file to preview rows</p>
            <p className="text-xs mt-1 text-slate-400">Columns auto-detected: Name, Address, Location/City, Contact/Phone</p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
          <button onClick={onClose} className="text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Cancel</button>
          <button onClick={saveAll} disabled={saving || !rows.length}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5 shadow-sm">
            {saving && <Loader2 size={11} className="animate-spin" />}
            Save {rows.length} Shipment{rows.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINE ORDER ASSIGNER
// Shown in the Order column for Marqland staff when a shipment has no orderId
// and isAdhoc is false (i.e. vendor submitted it without linking).
// Clicking "Link Order" opens a small dropdown to pick an order or mark ad-hoc.
// ─────────────────────────────────────────────────────────────────────────────
const OrderAssigner = ({ shipmentId, orders, onAssigned }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const assign = async (orderId) => {
    setSaving(true);
    try {
      const order = orders.find(o => o._id === orderId);
      await api.put(`/shipments/${shipmentId}`, {
        orderId: orderId || null,
        orderRef: order?.refNumber || '',
        isAdhoc: !orderId,
      });
      onAssigned();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); setOpen(false); }
  };

  if (saving) return <Loader2 size={12} className="animate-spin text-slate-400" />;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100 transition uppercase">
        <Link2 size={9} /> Link Order
      </button>
      {open && (
        <>
          {/* backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-0 top-7 bg-white border border-slate-200 rounded-xl shadow-xl w-64 max-h-56 overflow-y-auto">
            <div className="p-2 border-b border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase px-1">Assign to Order</p>
            </div>
            <button onClick={() => assign('')}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 font-bold border-b border-slate-50">
              — Mark as Ad-hoc
            </button>
            {orders.map(o => (
              <button key={o._id} onClick={() => assign(o._id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-700 transition border-b border-slate-50 last:border-0">
                <span className="font-bold">{o.refNumber || o._id.slice(-6)}</span>
                <span className="text-slate-400 ml-1 text-[10px]">— {o.clientName}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIPMENT TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────
const ShipmentRow = ({ shipment, partners, orders, isMarqland, onEdit, onDelete, onAssigned }) => {
  const delayed = isDelayed(shipment);
  const statusStyle = STATUS_COLORS[shipment.status] || 'bg-slate-100 text-slate-500';
  const partnerObj = partners.find(p => p.name === shipment.shippingPartner);

  // A row needing order assignment = has no orderId, not yet marked ad-hoc,
  // only visible to Marqland
  const needsOrderLink = isMarqland && !shipment.orderId && !shipment.isAdhoc;

  return (
    <tr className={`border-b border-slate-100 last:border-0 transition-colors
      ${delayed
        ? 'bg-orange-50/70 hover:bg-orange-100/60'
        : 'hover:bg-slate-50/60'
      }`}>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap align-top">
        <div>{fmt(shipment.shippedDate)}</div>
        {delayed && (
          <div className="flex items-center gap-0.5 mt-1 text-[9px] font-black text-orange-600 uppercase">
            <AlertTriangle size={9} /> Delayed
          </div>
        )}
      </td>

      {/* Recipient */}
      <td className="px-4 py-3 align-top">
        <div className="font-bold text-sm text-slate-800 leading-tight">{shipment.recipientName}</div>
        {shipment.phone && <div className="text-[10px] text-slate-400 mt-0.5">{shipment.phone}</div>}
      </td>

      {/* Address / City */}
      <td className="px-4 py-3 max-w-[200px] align-top">
        <div className="text-xs text-slate-600 truncate" title={shipment.recipientAddress}>
          {shipment.recipientAddress || '—'}
        </div>
        <div className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
          <MapPin size={9} />
          {[shipment.city, shipment.state].filter(Boolean).join(', ') || '—'}
        </div>
      </td>

      {/* Tracking ID */}
      <td className="px-4 py-3 align-top">
        {shipment.trackingId ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              {shipment.trackingId}
            </span>
            {partnerObj?.trackingUrl && (
              <a href={`${partnerObj.trackingUrl}${shipment.trackingId}`} target="_blank" rel="noreferrer"
                className="p-1 text-slate-400 hover:text-indigo-600 transition" title="Track on partner site">
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Shipping Partner */}
      <td className="px-4 py-3 align-top">
        <span className="text-xs font-bold text-slate-600">{shipment.shippingPartner || '—'}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-top">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${statusStyle}`}>
          {['Delivered', 'Completed'].includes(shipment.status)
            ? <Check size={9} strokeWidth={3} />
            : <Clock size={9} />}
          {shipment.status}
        </span>
        {shipment.lastTrackedAt && (
          <div className="text-[9px] text-slate-400 mt-0.5">Updated {fmt(shipment.lastTrackedAt)}</div>
        )}
      </td>

      {/* Order — Marqland only column */}
      {isMarqland && (
        <td className="px-4 py-3 align-top">
          {shipment.orderId
            ? <span className="text-[10px] text-slate-600 font-bold">{shipment.orderRef || '—'}</span>
            : shipment.isAdhoc
              ? <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Ad-hoc</span>
              : <OrderAssigner shipmentId={shipment._id} orders={orders} onAssigned={onAssigned} />
          }
        </td>
      )}

      {/* Actions */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5 justify-end">
          <button onClick={() => onEdit(shipment)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Edit">
            <Settings size={13} />
          </button>
          <button onClick={() => onDelete(shipment._id)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CourierTracking() {
  const { user } = useAuth();
  const isVendor = user?.role === 'courier';
  const isMarqland = MARQLAND_ROLES.includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('active');
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Shared filters (all roles)
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');

  // Marqland-only filters
  const [filterVendor, setFilterVendor] = useState('');
  const [filterPartner, setFilterPartner] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editShipment, setEditShipment] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [api.get('/shipments'), api.get('/shipping-partners')];
      // Vendors don't need the orders list at all
      if (isMarqland) requests.push(api.get('/orders'));
      const [sRes, pRes, oRes] = await Promise.all(requests);
      setShipments(Array.isArray(sRes.data) ? sRes.data : []);
      setPartners(Array.isArray(pRes.data) ? pRes.data : []);
      if (isMarqland && oRes) setOrders(Array.isArray(oRes.data) ? oRes.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isMarqland]);

  useEffect(() => { load(); }, [load]);

  // ── Refresh tracking statuses via background service ────────────────────────
  const triggerRefresh = async () => {
    setRefreshing(true);
    try { await api.post('/shipments/refresh-status'); await load(); }
    catch (e) { alert('Refresh failed: ' + e.message); }
    finally { setRefreshing(false); }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const saveShipment = async (form) => {
    if (editShipment?._id) {
      await api.put(`/shipments/${editShipment._id}`, form);
    } else {
      await api.post('/shipments', form);
    }
    setShowAddModal(false);
    setEditShipment(null);
    load();
  };

  const deleteShipment = async (id) => {
    if (!window.confirm('Delete this shipment?')) return;
    await api.delete(`/shipments/${id}`);
    load();
  };

  // ── Derived filter option lists ─────────────────────────────────────────────
  const cities = [...new Set(shipments.map(s => s.city).filter(Boolean))].sort();
  const states = [...new Set(shipments.map(s => s.state).filter(Boolean))].sort();
  // vendorName is stamped on the shipment by the backend from the auth token
  const vendors = [...new Set(shipments.map(s => s.vendorName).filter(Boolean))].sort();

  const resetFilters = () => {
    setSearch(''); setFilterCity(''); setFilterState('');
    setFilterVendor(''); setFilterPartner('');
  };
  const hasFilters = search || filterCity || filterState || filterVendor || filterPartner;

  // ── Filter + sort ───────────────────────────────────────────────────────────
  const filtered = shipments.filter(s => {
    if (tab === 'active' && COMPLETED_STATUSES.includes(s.status)) return false;
    if (tab === 'completed' && !COMPLETED_STATUSES.includes(s.status)) return false;
    if (filterCity && s.city?.toLowerCase() !== filterCity.toLowerCase()) return false;
    if (filterState && s.state?.toLowerCase() !== filterState.toLowerCase()) return false;
    if (filterPartner && s.shippingPartner !== filterPartner) return false;
    if (filterVendor && s.vendorName !== filterVendor) return false;
    if (search) {
      const term = search.toLowerCase();
      const blob = [s.recipientName, s.city, s.state, s.trackingId,
      s.shippingPartner, s.phone, s.orderRef, s.vendorName].join(' ').toLowerCase();
      if (!blob.includes(term)) return false;
    }
    return true;
  });

  // Delayed rows always float to the top in the active tab
  const sorted = tab === 'active'
    ? [...filtered].sort((a, b) => Number(isDelayed(b)) - Number(isDelayed(a)))
    : filtered;

  const delayedCount = filtered.filter(isDelayed).length;
  const activeCount = shipments.filter(s => !COMPLETED_STATUSES.includes(s.status)).length;
  const completedCount = shipments.filter(s => COMPLETED_STATUSES.includes(s.status)).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-800 flex items-center gap-2">
            <Truck size={24} className="text-indigo-600" /> Courier Tracking
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-wide">
            {shipments.length} total shipments
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">

          {/* Shipping Partners button — Marqland admin only */}
          {isAdmin && (
            <button onClick={() => setShowPartnerModal(true)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition flex items-center gap-1.5">
              <Settings size={13} /> Shipping Partners
            </button>
          )}

          {/* Refresh — everyone */}
          <button onClick={triggerRefresh} disabled={refreshing}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition flex items-center gap-1.5">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh Status
          </button>

          {/* Import Excel + Add Shipment — vendors AND Marqland */}
          <button onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs uppercase hover:bg-indigo-100 transition flex items-center gap-1.5">
            <Upload size={13} /> Import Excel
          </button>
          <button onClick={() => { setEditShipment(null); setShowAddModal(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm">
            <Plus size={13} /> Add Shipment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">

        {/* Global search — all roles */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, city, tracking ID…"
            className="w-full pl-8 pr-8 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-300 transition" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* City — all roles */}
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-300 bg-white font-bold text-slate-600">
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* State — all roles */}
        <select value={filterState} onChange={e => setFilterState(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-300 bg-white font-bold text-slate-600">
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Vendor + Shipping Partner filters — Marqland only */}
        {isMarqland && (
          <>
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-300 bg-white font-bold text-slate-600">
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>

            <select value={filterPartner} onChange={e => setFilterPartner(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-300 bg-white font-bold text-slate-600">
              <option value="">All Shipping Partners</option>
              {partners.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
            </select>
          </>
        )}

        {/* Reset — shown when any filter is active */}
        {hasFilters && (
          <button onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition px-3 py-2 border border-slate-200 rounded-xl hover:border-red-200 hover:bg-red-50">
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {[
          { key: 'active', label: 'Shipping & Shipped', count: activeCount },
          { key: 'completed', label: 'Shipments Completed', count: completedCount },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${tab === t.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
            {t.label}
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-slate-200 text-slate-500'
              }`}>
              {t.count}
            </span>
          </button>
        ))}

        {tab === 'active' && delayedCount > 0 && (
          <span className="ml-3 flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl uppercase">
            <AlertTriangle size={10} /> {delayedCount} delayed
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-bold">Loading shipments…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Truck size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">
              {hasFilters
                ? 'No shipments match your filters'
                : `No ${tab === 'active' ? 'active' : 'completed'} shipments`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Recipient</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Address / City</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Tracking ID</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Partner</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Status</th>
                  {/* Order column only for Marqland */}
                  {isMarqland && <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Order</th>}
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(s => (
                  <ShipmentRow
                    key={s._id}
                    shipment={s}
                    partners={partners}
                    orders={orders}
                    isMarqland={isMarqland}
                    onEdit={(s) => { setEditShipment(s); setShowAddModal(true); }}
                    onDelete={deleteShipment}
                    onAssigned={load}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {showPartnerModal && (
        <ShippingPartnerModal
          partners={partners}
          onSaved={load}
          onClose={() => setShowPartnerModal(false)}
        />
      )}

      {showAddModal && (
        <ShipmentModal
          shipment={editShipment}
          orders={orders}
          partners={partners}
          showOrderLink={isMarqland}
          onSave={saveShipment}
          onClose={() => { setShowAddModal(false); setEditShipment(null); }}
        />
      )}

      {showImport && (
        <ExcelImportModal
          orders={orders}
          partners={partners}
          showOrderLink={isMarqland}
          onImported={() => { setShowImport(false); load(); }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}