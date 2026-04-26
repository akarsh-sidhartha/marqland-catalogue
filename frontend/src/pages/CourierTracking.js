import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import {
  Truck, Plus, Upload, Search, X, RefreshCw, AlertTriangle,
  Clock, Package, Settings, ExternalLink, CalendarDays,
  Loader2, Check, Trash2, MapPin, Link2, UserCheck, Eye, FileText,
} from 'lucide-react';
import { LocationSelects, COUNTRIES } from '../utils/indiaLocations';

// ─────────────────────────────────────────────────────────────────────────────
// ROLE MODEL
//
// courier = Vendor
//   ✓ Add / import their own shipments (fills AWB, partner, status)
//   ✗ Cannot see other vendors' rows, link orders, or manage partners
//
// Marqland employees (admin / sales / accounts / inventory / viewer)
//   ✓ "Add Shipment" = lightweight dispatch entry:
//       recipient details + assign to a courier vendor.
//       Vendor fills AWB + tracking once they collect the parcel.
//   ✓ "Import Excel" = bulk dispatch, same lightweight fields + assign vendor.
//   ✓ Multi-select rows → bulk "Link Order" action.
//   ✓ Inline single-row order link still works too.
//   ✓ Full edit always available.
// ─────────────────────────────────────────────────────────────────────────────
const MARQLAND_ROLES = ['admin', 'sales', 'accounts', 'inventory', 'viewer'];

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

const MANUAL_STATUSES = ['Pending', 'Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Exception'];
const COMPLETED_STATUSES = ['Delivered', 'Completed', 'Returned'];

const isDelayed = (s) => {
  if (!s || COMPLETED_STATUSES.includes(s.status)) return false;
  return (Date.now() - new Date(s.shippedDate || s.createdAt).getTime()) / 86400000 > 4;
};

const STATUS_COLORS = {
  'Pending':          'bg-slate-100 text-slate-600',
  'Booked':           'bg-blue-100 text-blue-700',
  'In Transit':       'bg-amber-100 text-amber-700',
  'Out for Delivery': 'bg-orange-100 text-orange-700',
  'Delivered':        'bg-emerald-100 text-emerald-700',
  'Completed':        'bg-emerald-100 text-emerald-700',
  'Returned':         'bg-red-100 text-red-700',
  'Exception':        'bg-red-100 text-red-700',
};

const Label = ({ children }) => (
  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{children}</label>
);
const Field = ({ label, children }) => <div><Label>{label}</Label>{children}</div>;
const inputCls  = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition bg-white";
const selectCls = `${inputCls} cursor-pointer`;

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING PARTNER MANAGER MODAL
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
      setForm({ name: '', trackingUrl: '' }); setEditId(null); onSaved();
    } catch (e) { alert(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this partner?')) return;
    await api.delete(`/shipping-partners/${id}`);
    setList(l => l.filter(p => p._id !== id)); onSaved();
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
        <div className="mx-4 mt-4 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-600 font-semibold">
          Tracking via <span className="font-black">trackcourier.io</span>. Add partner name and their public tracking URL.
        </div>
        <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2">
          {list.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No partners yet.</p>}
          {list.map(p => (
            <div key={p._id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{p.name}</div>
                {p.trackingUrl
                  ? <a href={p.trackingUrl} target="_blank" rel="noreferrer"
                      className="text-[10px] text-indigo-500 flex items-center gap-0.5 hover:underline truncate">
                      <ExternalLink size={9} />{p.trackingUrl}
                    </a>
                  : <span className="text-[10px] text-slate-400">No tracking URL</span>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { setEditId(p._id); setForm({ name: p.name, trackingUrl: p.trackingUrl || '' }); }}
                  className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition">Edit</button>
                <button onClick={() => del(p._id)}
                  className="text-[10px] font-bold px-2 py-1 bg-red-50 rounded-lg text-red-500 hover:bg-red-100 transition"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 border-t border-slate-100 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase">{editId ? 'Edit' : 'Add'} Partner</p>
          <Field label="Name *">
            <input value={form.name} onChange={e => sf('name', e.target.value)} placeholder="e.g. Blue Dart, DTDC" className={inputCls} />
          </Field>
          <Field label="Public Tracking URL (optional)">
            <input value={form.trackingUrl} onChange={e => sf('trackingUrl', e.target.value)} placeholder="https://..." className={inputCls} />
          </Field>
          <div className="flex justify-between items-center pt-1">
            {editId && <button onClick={() => { setEditId(null); setForm({ name: '', trackingUrl: '' }); }} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>}
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="ml-auto px-5 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5">
              {saving && <Loader2 size={11} className="animate-spin" />}{editId ? 'Update' : 'Add Partner'}
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
// Marqland view:
//   Top section  = Dispatch info (date, recipient, address, assign vendor, link order)
//   Bottom section = Courier details (AWB, partner, status) — labelled "vendor fills these"
//
// Courier vendor view:
//   Full form — they fill AWB, partner, status. No vendor assign, no order link.
// ─────────────────────────────────────────────────────────────────────────────
const ShipmentModal = ({ shipment, orders, partners, vendors, showOrderLink, onSave, onClose }) => {
  const isEdit = !!shipment?._id;
  const [form, setForm] = useState({
    shippedDate:        shipment?.shippedDate ? shipment.shippedDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    recipientName:      shipment?.recipientName    || '',
    recipientAddress:   shipment?.recipientAddress || '',
    country:            shipment?.country          || 'India',
    city:               shipment?.city             || '',
    state:              shipment?.state            || '',
    phone:              shipment?.phone            || '',
    trackingId:         shipment?.trackingId       || '',
    shippingPartner:    shipment?.shippingPartner  || '',
    status:             shipment?.status           || 'Pending',
    orderId:            shipment?.orderId          || '',
    isAdhoc:            showOrderLink ? (shipment?.isAdhoc ?? false) : true,
    notes:              shipment?.notes            || '',
    assignedVendorId:   shipment?.vendorId         || '',
    assignedVendorName: shipment?.vendorName       || '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.recipientName.trim()) return alert('Recipient name required');
    if (!form.shippedDate) return alert('Date required');
    setSaving(true);
    try {
      await onSave({
        ...form,
        orderId:    form.orderId            || null,
        vendorId:   form.assignedVendorId   || null,
        vendorName: form.assignedVendorName || '',
      });
    } finally { setSaving(false); }
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

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Marqland context banner */}
          {showOrderLink && !isEdit && (
            <div className="px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 font-semibold leading-relaxed">
              <span className="font-black">Dispatching a parcel?</span> Fill recipient details and assign to a courier vendor.
              The vendor will add AWB and tracking info once they collect the parcel.
            </div>
          )}

          {/* Date + Order */}
          <div className={`grid gap-4 ${showOrderLink ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <Field label="Shipped Date *">
              <input type="date" value={form.shippedDate} onChange={e => f('shippedDate', e.target.value)} required className={inputCls} />
            </Field>
            {showOrderLink && (
              <Field label="Linked Order (optional)">
                <select value={form.orderId}
                  onChange={e => { f('orderId', e.target.value); f('isAdhoc', !e.target.value); }}
                  className={selectCls}>
                  <option value="">— Ad-hoc / assign later —</option>
                  {orders.map(o => (
                    <option key={o._id} value={o._id}>{o.refNumber || o._id.slice(-6)} — {o.clientName}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Recipient Name *">
              <input value={form.recipientName} onChange={e => f('recipientName', e.target.value)} placeholder="Full name" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="Mobile number" className={inputCls} />
            </Field>
          </div>

          <Field label="Delivery Address">
            <textarea value={form.recipientAddress} onChange={e => f('recipientAddress', e.target.value)}
              rows={2} placeholder="Full delivery address"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition resize-none" />
          </Field>

          <LocationSelects
            country={form.country}  onCountryChange={v => f('country', v)}
            state={form.state}      onStateChange={v => f('state', v)}
            city={form.city}        onCityChange={v => f('city', v)}
            showCountry={true}
          />

          {/* Assign courier vendor — Marqland only */}
          {showOrderLink && vendors.length > 0 && (
            <Field label="Assign to Courier Vendor">
              <select
                value={form.assignedVendorId}
                onChange={e => {
                  const v = vendors.find(v => v._id === e.target.value);
                  f('assignedVendorId',   e.target.value);
                  f('assignedVendorName', v?.name || v?.email || '');
                }}
                className={selectCls}>
                <option value="">— Unassigned (to be determined) —</option>
                {vendors.map(v => (
                  <option key={v._id} value={v._id}>{v.name || v.email}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Assigned vendor will see this shipment and fill AWB + tracking details.
              </p>
            </Field>
          )}

          {/* Courier details */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">
              {showOrderLink ? 'Courier Details — vendor fills these after collection' : 'Courier Details'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tracking ID / AWB">
                <input value={form.trackingId} onChange={e => f('trackingId', e.target.value)}
                  placeholder="AWB / Tracking number" className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Shipping Partner">
                <select value={form.shippingPartner} onChange={e => f('shippingPartner', e.target.value)} className={selectCls}>
                  <option value="">— Select Partner —</option>
                  {partners.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Status">
                <select value={form.status} onChange={e => f('status', e.target.value)} className={selectCls}>
                  {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional note" className={inputCls} />
              </Field>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">Cancel</button>
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
// ─────────────────────────────────────────────────────────────────────────────
const ExcelImportModal = ({ orders, partners, vendors, showOrderLink, onImported, onClose }) => {
  const [rows, setRows]                   = useState([]);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [linkedOrderId, setLinkedOrderId] = useState('');
  const [assignedVendorId, setAssignedVendorId] = useState('');
  const fileRef = useRef(null);

  const parseExcel = (file) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        let headerIdx = 0;
        for (let i = 0; i < Math.min(raw.length, 5); i++) {
          if (raw[i].map(c => String(c).toLowerCase()).some(c => c.includes('name') || c.includes('contact'))) {
            headerIdx = i; break;
          }
        }
        const headers  = raw[headerIdx].map(h => String(h).trim().toLowerCase());
        const dataRows = raw.slice(headerIdx + 1).filter(r => r.some(c => c !== ''));
        const idx = (kw) => headers.findIndex(h => kw.some(k => h.includes(k)));
        const nameIdx  = idx(['name']);
        const addrIdx  = idx(['address']);
        const cityIdx  = idx(['location', 'city']);
        const stateIdx = idx(['state']);
        const phoneIdx = idx(['contact', 'phone']);
        const vendor   = vendors.find(v => v._id === assignedVendorId);

        setRows(dataRows.map(r => ({
          shippedDate:      new Date().toISOString().slice(0, 10),
          recipientName:    nameIdx  >= 0 ? String(r[nameIdx]  || '').trim() : '',
          recipientAddress: addrIdx  >= 0 ? String(r[addrIdx]  || '').trim() : '',
          city:             cityIdx  >= 0 ? String(r[cityIdx]  || '').trim() : '',
          state:            stateIdx >= 0 ? String(r[stateIdx] || '').trim() : '',
          country:          'India',
          phone:            phoneIdx >= 0 ? String(r[phoneIdx] || '').trim() : '',
          trackingId: '', shippingPartner: '', status: 'Pending', notes: '',
          orderId:    linkedOrderId    || null,
          isAdhoc:    !linkedOrderId,
          vendorId:   assignedVendorId || null,
          vendorName: vendor ? (vendor.name || vendor.email) : '',
        })).filter(r => r.recipientName));
      } catch (err) { setError('Could not parse Excel: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateRow = (idx, key, val) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const applyVendorToAll = (vid) => {
    const vendor = vendors.find(v => v._id === vid);
    setAssignedVendorId(vid);
    setRows(r => r.map(row => ({
      ...row, vendorId: vid || null,
      vendorName: vendor ? (vendor.name || vendor.email) : '',
    })));
  };

  const saveAll = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      await api.post('/shipments/bulk', { shipments: rows.map(r => ({ ...r, orderId: r.orderId || null })) });
      onImported();
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-indigo-600" />
            <span className="font-black text-sm uppercase">Import Shipments from Excel</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-4 shrink-0 flex-wrap bg-slate-50/50">
          <label className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase cursor-pointer hover:bg-indigo-700 transition flex items-center gap-1.5">
            <Upload size={12} /> Choose File
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { if (e.target.files[0]) parseExcel(e.target.files[0]); }} />
          </label>
          {rows.length > 0 && <span className="text-xs font-bold text-slate-500">{rows.length} rows loaded</span>}

          {showOrderLink && vendors.length > 0 && (
            <div className="flex items-center gap-2">
              <UserCheck size={13} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Assign all to:</span>
              <select value={assignedVendorId} onChange={e => applyVendorToAll(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white min-w-[160px]">
                <option value="">— Vendor unassigned —</option>
                {vendors.map(v => <option key={v._id} value={v._id}>{v.name || v.email}</option>)}
              </select>
            </div>
          )}

          {showOrderLink && (
            <div className="flex items-center gap-2">
              <Link2 size={13} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Link all to:</span>
              <select value={linkedOrderId}
                onChange={e => {
                  setLinkedOrderId(e.target.value);
                  setRows(r => r.map(row => ({ ...row, orderId: e.target.value || null, isAdhoc: !e.target.value })));
                }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white min-w-[200px]">
                <option value="">— Ad-hoc (assign later) —</option>
                {orders.map(o => <option key={o._id} value={o._id}>{o.refNumber || o._id.slice(-6)} — {o.clientName}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold shrink-0">⚠ {error}</div>
        )}

        {rows.length > 0 ? (
          <div className="flex-1 overflow-auto px-4 py-3">
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead>
                <tr>
                  {(showOrderLink
                    ? ['Date', 'Recipient', 'Address', 'Country', 'City', 'State', 'Phone', 'Vendor', 'AWB', 'Partner', 'Status', '']
                    : ['Date', 'Recipient', 'Address', 'Country', 'City', 'State', 'Phone', 'AWB', 'Partner', 'Status', '']
                  ).map(h => (
                    <th key={h} className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="bg-slate-50">
                    <td className="px-1 py-1"><input type="date" value={r.shippedDate} onChange={e => updateRow(i, 'shippedDate', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-32" /></td>
                    <td className="px-1 py-1"><input value={r.recipientName} onChange={e => updateRow(i, 'recipientName', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-32" /></td>
                    <td className="px-1 py-1"><input value={r.recipientAddress} onChange={e => updateRow(i, 'recipientAddress', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-36" /></td>
                    <td className="px-1 py-1">
                      <select value={r.country} onChange={e => updateRow(i, 'country', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white outline-none w-24">
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1"><input value={r.city} onChange={e => updateRow(i, 'city', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-24" /></td>
                    <td className="px-1 py-1"><input value={r.state} onChange={e => updateRow(i, 'state', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-24" /></td>
                    <td className="px-1 py-1"><input value={r.phone} onChange={e => updateRow(i, 'phone', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs outline-none w-28" /></td>
                    {showOrderLink && (
                      <td className="px-1 py-1">
                        <select value={r.vendorId || ''} onChange={e => {
                          const v = vendors.find(v => v._id === e.target.value);
                          updateRow(i, 'vendorId',   e.target.value || null);
                          updateRow(i, 'vendorName', v ? (v.name || v.email) : '');
                        }} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white outline-none w-32">
                          <option value="">— unassigned —</option>
                          {vendors.map(v => <option key={v._id} value={v._id}>{v.name || v.email}</option>)}
                        </select>
                      </td>
                    )}
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
                      <button onClick={() => setRows(r => r.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600"><X size={12} /></button>
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
            <p className="text-xs mt-1">Columns auto-detected: Name, Address, Location/City, State, Contact/Phone</p>
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
// BULK ORDER LINK MODAL — apply one order to all selected rows
// ─────────────────────────────────────────────────────────────────────────────
const BulkOrderLinkModal = ({ selectedIds, orders, onDone, onClose }) => {
  const [orderId, setOrderId] = useState('');
  const [saving, setSaving]   = useState(false);

  const apply = async () => {
    setSaving(true);
    try {
      const order = orders.find(o => o._id === orderId);
      await Promise.all(selectedIds.map(id =>
        api.put(`/shipments/${id}`, {
          orderId:  orderId || null,
          orderRef: order?.refNumber || '',
          isAdhoc:  !orderId,
        })
      ));
      onDone();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-indigo-600" />
            <span className="font-black text-sm uppercase">Link Order</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={15} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-xs text-slate-500">
            Linking <span className="font-black text-slate-700">{selectedIds.length}</span> selected shipment{selectedIds.length !== 1 ? 's' : ''} to an order.
          </p>
          <Field label="Select Order">
            <select value={orderId} onChange={e => setOrderId(e.target.value)} className={selectCls}>
              <option value="">— Mark as Ad-hoc (no order) —</option>
              {orders.map(o => (
                <option key={o._id} value={o._id}>{o.refNumber || o._id.slice(-6)} — {o.clientName}</option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="text-slate-400 font-bold text-xs uppercase hover:text-slate-600 px-3 py-2">Cancel</button>
            <button onClick={apply} disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5">
              {saving && <Loader2 size={11} className="animate-spin" />}
              Apply to {selectedIds.length} row{selectedIds.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINE SINGLE-ROW ORDER ASSIGNER
// ─────────────────────────────────────────────────────────────────────────────
const OrderAssigner = ({ shipmentId, orders, onAssigned }) => {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  const assign = async (orderId) => {
    setSaving(true);
    try {
      const order = orders.find(o => o._id === orderId);
      await api.put(`/shipments/${shipmentId}`, {
        orderId:  orderId || null,
        orderRef: order?.refNumber || '',
        isAdhoc:  !orderId,
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
// SHIPMENT ROW
// ─────────────────────────────────────────────────────────────────────────────
const ShipmentRow = ({ shipment, partners, orders, isMarqland, selected, onSelect, onEdit, onDelete, onAssigned }) => {
  const delayed     = isDelayed(shipment);
  const statusStyle = STATUS_COLORS[shipment.status] || 'bg-slate-100 text-slate-500';
  const partnerObj  = partners.find(p => p.name === shipment.shippingPartner);
  const [showNotes, setShowNotes] = useState(false);
  const hasNotes = !!shipment.notes?.trim();

  return (
    <tr className={`border-b border-slate-100 last:border-0 transition-colors
      ${selected ? 'bg-indigo-50' : delayed ? 'bg-orange-50/70 hover:bg-orange-100/60' : 'hover:bg-slate-50/60'}`}>

      {isMarqland && (
        <td className="pl-4 pr-2 py-3 align-middle">
          <input type="checkbox" checked={selected} onChange={onSelect}
            className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer" />
        </td>
      )}

      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap align-top">
        <div>{fmt(shipment.shippedDate)}</div>
        {delayed && (
          <div className="flex items-center gap-0.5 mt-1 text-[9px] font-black text-orange-600 uppercase">
            <AlertTriangle size={9} /> Delayed
          </div>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <div className="font-bold text-sm text-slate-800 leading-tight">{shipment.recipientName}</div>
        {shipment.phone && <div className="text-[10px] text-slate-400 mt-0.5">{shipment.phone}</div>}
        {isMarqland && shipment.vendorName && (
          <div className="text-[9px] font-bold text-indigo-500 mt-0.5 flex items-center gap-0.5">
            <UserCheck size={9} /> {shipment.vendorName}
          </div>
        )}
      </td>

      <td className="px-4 py-3 max-w-[180px] align-top">
        <div className="text-xs text-slate-600 truncate" title={shipment.recipientAddress}>
          {shipment.recipientAddress || '—'}
        </div>
        <div className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
          <MapPin size={9} />
          {[shipment.city, shipment.state].filter(Boolean).join(', ') || '—'}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <span className="text-xs font-medium text-slate-600">{shipment.country || '—'}</span>
      </td>

      <td className="px-4 py-3 align-top">
        {shipment.trackingId ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              {shipment.trackingId}
            </span>
            {partnerObj?.trackingUrl && (
              <a href={`${partnerObj.trackingUrl}${shipment.trackingId}`} target="_blank" rel="noreferrer"
                className="p-1 text-slate-400 hover:text-indigo-600 transition"><ExternalLink size={11} /></a>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 italic">
            {isMarqland ? 'Pending from vendor' : '—'}
          </span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <span className="text-xs font-bold text-slate-600">{shipment.shippingPartner || '—'}</span>
      </td>

      <td className="px-4 py-3 align-top">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${statusStyle}`}>
          {['Delivered', 'Completed'].includes(shipment.status) ? <Check size={9} strokeWidth={3} /> : <Clock size={9} />}
          {shipment.status}
        </span>
        {shipment.lastTrackedAt && (
          <div className="text-[9px] text-slate-400 mt-0.5">Updated {fmt(shipment.lastTrackedAt)}</div>
        )}
      </td>

      {isMarqland && (
        <td className="px-4 py-3 align-top">
          {shipment.orderId
            ? <span className="text-[10px] text-slate-700 font-bold">{shipment.orderRef || '—'}</span>
            : shipment.isAdhoc
              ? <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Ad-hoc</span>
              : <OrderAssigner shipmentId={shipment._id} orders={orders} onAssigned={onAssigned} />
          }
        </td>
      )}

      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5 justify-end">
          {/* Notes overlay trigger — always shown; dimmed when no notes */}
          <div className="relative">
            <button
              onClick={() => setShowNotes(v => !v)}
              title={hasNotes ? 'View notes' : 'No notes'}
              className={`p-1.5 rounded-lg transition ${
                hasNotes
                  ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                  : 'text-slate-300 cursor-default'
              }`}>
              <Eye size={13} />
            </button>

            {/* Notes popover */}
            {showNotes && hasNotes && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotes(false)} />
                <div className="absolute z-50 right-0 bottom-8 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase">
                      <FileText size={10} /> Notes
                    </div>
                    <button onClick={() => setShowNotes(false)} className="text-slate-300 hover:text-slate-500">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{shipment.notes}</p>
                  </div>
                  {/* Shipment mini-summary */}
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60">
                    <p className="text-[10px] text-slate-400 font-bold truncate">{shipment.recipientName}</p>
                    <p className="text-[9px] text-slate-400">{fmt(shipment.shippedDate)} · {shipment.status}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={() => onEdit(shipment)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Settings size={13} /></button>
          <button onClick={() => onDelete(shipment._id)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={13} /></button>
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
  const isMarqland = MARQLAND_ROLES.includes(user?.role);
  const isAdmin    = user?.role === 'admin';

  const [tab, setTab]               = useState('active');
  const [shipments, setShipments]   = useState([]);
  const [orders, setOrders]         = useState([]);
  const [partners, setPartners]     = useState([]);
  const [couriers, setCouriers]     = useState([]); // courier-role users for vendor assignment
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch]                 = useState('');
  const [filterCountry, setFilterCountry]   = useState('');
  const [filterCity, setFilterCity]         = useState('');
  const [filterState, setFilterState]       = useState('');
  const [filterVendor, setFilterVendor]     = useState('');
  const [filterPartner, setFilterPartner]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  // Multi-select
  const [selected, setSelected]       = useState(new Set());
  const [showBulkLink, setShowBulkLink] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal]         = useState(false);
  const [editShipment, setEditShipment]         = useState(null);
  const [showImport, setShowImport]             = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [api.get('/shipments'), api.get('/shipping-partners')];
      if (isMarqland) {
        reqs.push(api.get('/orders'));
        reqs.push(api.get('/auth/users'));
      }
      const [sRes, pRes, oRes, uRes] = await Promise.all(reqs);
      setShipments(Array.isArray(sRes.data) ? sRes.data : []);
      setPartners(Array.isArray(pRes.data)  ? pRes.data  : []);
      if (isMarqland && oRes) setOrders(Array.isArray(oRes.data) ? oRes.data : []);
      if (isMarqland && uRes) {
        const all = Array.isArray(uRes.data) ? uRes.data : [];
        setCouriers(all.filter(u => u.role === 'courier'));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isMarqland]);

  useEffect(() => { load(); }, [load]);

  const triggerRefresh = async () => {
    setRefreshing(true);
    try { await api.post('/shipments/refresh-status'); await load(); }
    catch (e) { alert('Refresh failed: ' + e.message); }
    finally { setRefreshing(false); }
  };

  const saveShipment = async (form) => {
    if (editShipment?._id) await api.put(`/shipments/${editShipment._id}`, form);
    else                   await api.post('/shipments', form);
    setShowAddModal(false); setEditShipment(null); load();
  };

  const deleteShipment = async (id) => {
    if (!window.confirm('Delete this shipment?')) return;
    await api.delete(`/shipments/${id}`); load();
  };

  // Filter options derived from actual data
  const countries = [...new Set(shipments.map(s => s.country).filter(Boolean))].sort();
  const cities    = [...new Set(shipments.map(s => s.city).filter(Boolean))].sort();
  const states    = [...new Set(shipments.map(s => s.state).filter(Boolean))].sort();
  const vendors   = [...new Set(shipments.map(s => s.vendorName).filter(Boolean))].sort();

  const resetFilters = () => {
    setSearch(''); setFilterCountry(''); setFilterCity(''); setFilterState('');
    setFilterVendor(''); setFilterPartner(''); setFilterDateFrom(''); setFilterDateTo('');
  };
  const hasFilters = search || filterCountry || filterCity || filterState || filterVendor || filterPartner || filterDateFrom || filterDateTo;

  const filtered = shipments.filter(s => {
    if (tab === 'active'    && COMPLETED_STATUSES.includes(s.status))  return false;
    if (tab === 'completed' && !COMPLETED_STATUSES.includes(s.status)) return false;
    if (filterCountry && s.country !== filterCountry) return false;
    if (filterCity    && s.city?.toLowerCase()  !== filterCity.toLowerCase())  return false;
    if (filterState   && s.state?.toLowerCase() !== filterState.toLowerCase()) return false;
    if (filterPartner && s.shippingPartner !== filterPartner) return false;
    if (filterVendor  && s.vendorName      !== filterVendor)  return false;
    if (filterDateFrom) { if (new Date(s.shippedDate || s.createdAt) < new Date(filterDateFrom)) return false; }
    if (filterDateTo)   { if (new Date(s.shippedDate || s.createdAt) > new Date(filterDateTo + 'T23:59:59')) return false; }
    if (search) {
      const term = search.toLowerCase();
      const blob = [s.recipientName, s.city, s.state, s.country, s.trackingId,
        s.shippingPartner, s.phone, s.orderRef, s.vendorName].join(' ').toLowerCase();
      if (!blob.includes(term)) return false;
    }
    return true;
  });

  const sorted = tab === 'active'
    ? [...filtered].sort((a, b) => Number(isDelayed(b)) - Number(isDelayed(a)))
    : filtered;

  const delayedCount   = filtered.filter(isDelayed).length;
  const activeCount    = shipments.filter(s => !COMPLETED_STATUSES.includes(s.status)).length;
  const completedCount = shipments.filter(s =>  COMPLETED_STATUSES.includes(s.status)).length;

  // Selection
  const allFilteredIds = sorted.map(s => s._id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const selectedCount  = [...selected].filter(id => allFilteredIds.includes(id)).length;
  const toggleRow      = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll      = () => setSelected(allSelected ? new Set() : new Set(allFilteredIds));
  const clearSelect    = () => setSelected(new Set());

  return (
    <div className="p-6 max-w-[1500px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-800 flex items-center gap-2">
            <Truck size={24} className="text-indigo-600" /> Courier Tracking
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-wide">{shipments.length} total shipments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => setShowPartnerModal(true)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition flex items-center gap-1.5">
              <Settings size={13} /> Shipping Partners
            </button>
          )}
          <button onClick={triggerRefresh} disabled={refreshing}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition flex items-center gap-1.5">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
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

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Compact search */}
        <div className="relative w-44">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-300 transition" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={10} />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
          <CalendarDays size={11} className="text-slate-400 shrink-0" />
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            className="text-xs outline-none bg-transparent text-slate-600 w-28" />
          <span className="text-slate-300 text-xs">—</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            className="text-xs outline-none bg-transparent text-slate-600 w-28" />
        </div>

        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300 bg-white text-slate-600">
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterState} onChange={e => setFilterState(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300 bg-white text-slate-600">
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300 bg-white text-slate-600">
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {isMarqland && (
          <>
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300 bg-white text-slate-600">
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filterPartner} onChange={e => setFilterPartner(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300 bg-white text-slate-600">
              <option value="">All Partners</option>
              {partners.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
            </select>
          </>
        )}

        {hasFilters && (
          <button onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition px-2.5 py-1.5 border border-slate-200 rounded-lg hover:border-red-200 hover:bg-red-50">
            <X size={10} /> Reset
          </button>
        )}
      </div>

      {/* Tabs + bulk action */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: 'active',    label: 'Shipping & Shipped', count: activeCount    },
          { key: 'completed', label: 'Completed',          count: completedCount },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); clearSelect(); }}
            className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${
              tab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {t.label}
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}

        {tab === 'active' && delayedCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl uppercase">
            <AlertTriangle size={10} /> {delayedCount} delayed
          </span>
        )}

        {/* Bulk action — slides in when rows are ticked */}
        {isMarqland && selectedCount > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-sm">
            <span className="text-xs font-black">{selectedCount} selected</span>
            <button onClick={() => setShowBulkLink(true)}
              className="flex items-center gap-1 text-xs font-black bg-white text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-50 transition">
              <Link2 size={11} /> Link Order
            </button>
            <button onClick={clearSelect} className="p-1 text-indigo-200 hover:text-white"><X size={13} /></button>
          </div>
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
              {hasFilters ? 'No shipments match your filters' : `No ${tab === 'active' ? 'active' : 'completed'} shipments`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {isMarqland && (
                    <th className="pl-4 pr-2 py-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer" />
                    </th>
                  )}
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Recipient</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Address / City</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Country</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Tracking ID</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Partner</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-left">Status</th>
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
                    selected={selected.has(s._id)}
                    onSelect={() => toggleRow(s._id)}
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

      {/* Modals */}
      {showPartnerModal && (
        <ShippingPartnerModal partners={partners} onSaved={load} onClose={() => setShowPartnerModal(false)} />
      )}
      {showAddModal && (
        <ShipmentModal
          shipment={editShipment} orders={orders} partners={partners} vendors={couriers}
          showOrderLink={isMarqland} onSave={saveShipment}
          onClose={() => { setShowAddModal(false); setEditShipment(null); }}
        />
      )}
      {showImport && (
        <ExcelImportModal
          orders={orders} partners={partners} vendors={couriers} showOrderLink={isMarqland}
          onImported={() => { setShowImport(false); load(); }}
          onClose={() => setShowImport(false)}
        />
      )}
      {showBulkLink && (
        <BulkOrderLinkModal
          selectedIds={[...selected].filter(id => allFilteredIds.includes(id))}
          orders={orders}
          onDone={() => { setShowBulkLink(false); clearSelect(); load(); }}
          onClose={() => setShowBulkLink(false)}
        />
      )}
    </div>
  );
}