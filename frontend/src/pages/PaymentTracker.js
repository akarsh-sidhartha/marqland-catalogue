import React, { useState, useEffect, useCallback, useRef } from "react";
import { getBaseUrl } from "../baseurl";
import {
  Trash2, ArrowRight, Link2, FolderOpen, Folder, ChevronDown, ChevronRight,
  Download, Archive, Search, X, Eye, FileText, Image as ImageIcon,
  CheckCircle, AlertCircle, AlertTriangle, MapPin, CreditCard,
  FileUp, Plus, ClipboardList
} from "lucide-react";

const API  = `${getBaseUrl()}/payment-tracker`;
const VAPI = `${getBaseUrl()}/vendors`;

// ─── Load JSZip + FileSaver ───────────────────────────────────────────────────
const loadScript = (src) => new Promise((res) => {
  if (document.querySelector(`script[src="${src}"]`)) { res(true); return; }
  const s = document.createElement("script"); s.src = src; s.onload = () => res(true); s.onerror = () => res(false);
  document.head.appendChild(s);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = (n = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtN    = (n = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const getFinancialDetails = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return { month: "Unknown", fy: "Unknown" };
  const y = d.getFullYear();
  // Short FY format: Apr-Mar year  e.g. 2025-26
  const sh = (n) => String(n).slice(-2).padStart(2, "0");
  const fy = d.getMonth() < 3 ? `${y - 1}-${sh(y)}` : `${y}-${sh(y + 1)}`;
  return { month: d.toLocaleString("default", { month: "long" }), fy };
};
// Normalise AI-returned FY to short format: "2025-2026" → "2025-26"
const normalizeFY = (fy) => {
  if (!fy || fy === "Unknown" || fy === "Other") return fy;
  return fy.replace(/^(\d{4})-(\d{2,4})$/, (_, y, s) => `${y}-${String(s).slice(-2).padStart(2,"0")}`);
};

const compressImage = (b64) => new Promise((res) => {
  const img = new Image(); img.src = b64;
  img.onload = () => {
    const c = document.createElement("canvas"); let w = img.width, h = img.height, M = 1600;
    if (w > h ? w > M : h > M) { if (w > h) { h = h * M / w; w = M; } else { w = w * M / h; h = M; } }
    c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
    res(c.toDataURL("image/jpeg", 0.85));
  };
  img.onerror = () => res(b64);
});

const STATUS_META = {
  pending:    { label: "Pending",    color: "#f59e0b", bg: "#fef3c7" },
  partial:    { label: "Partial",    color: "#3b82f6", bg: "#dbeafe" },
  fully_paid: { label: "Fully Paid", color: "#10b981", bg: "#d1fae5" },
  invoiced:   { label: "Invoiced",   color: "#8b5cf6", bg: "#ede9fe" },
  cancelled:  { label: "Cancelled",  color: "#6b7280", bg: "#f3f4f6" },
  paid:       { label: "Paid",       color: "#10b981", bg: "#d1fae5" },
  overdue:    { label: "Overdue",    color: "#ef4444", bg: "#fee2e2" },
  recorded:   { label: "Recorded",   color: "#f59e0b", bg: "#fef3c7" },
  advance:    { label: "Advance",    color: "#8b5cf6", bg: "#ede9fe" },
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Badge({ status }) {
  const m = STATUS_META[status] || { label: status, color: "#6b7280", bg: "#f3f4f6" };
  return <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{m.label}</span>;
}
function ProgressBar({ paid, total, height = 6 }) {
  const pct   = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const color = pct === 100 ? "#10b981" : pct > 0 ? "#3b82f6" : "#e5e7eb";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height, borderRadius: 99, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, color: "#6b7280", minWidth: 34 }}>{Math.round(pct)}%</span>
    </div>
  );
}

const IS   = { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", color: "#0f172a", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" };
const IShi = (hi) => ({ ...IS, border: hi ? "1.5px solid #3b82f6" : IS.border, background: hi ? "#eff6ff" : "#fff" });

function Modal({ title, onClose, children, wide, extraWide }) {
  useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: extraWide ? 1100 : wide ? 800 : 640, maxHeight: "94vh", overflowY: "auto", boxShadow: "0 30px 70px rgba(0,0,0,0.24)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 26px", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display:"flex",alignItems:"center" }}><X size={18}/></button>
        </div>
        <div style={{ padding: 26 }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
        {hint && <span style={{ fontWeight: 400, textTransform: "none", color: "#94a3b8", marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}
function ErrBox({ msg }) { return msg ? <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{msg}</div> : null; }
function AutoFillBanner({ count }) { return count ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "9px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 9, fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>🔵 {count} field{count > 1 ? "s" : ""} auto-filled — verify before saving.</div> : null; }
function ScanBanner({ result, msg }) {
  if (!result) return null;
  const map = { success: { bg: "#f0fdf4", b: "#86efac", c: "#15803d", i: "✓" }, partial: { bg: "#fffbeb", b: "#fde68a", c: "#92400e", i: "⚠" }, error: { bg: "#fef2f2", b: "#fca5a5", c: "#dc2626", i: "✕" } };
  const s = map[result];
  return <div style={{ marginTop: 8, padding: "9px 14px", borderRadius: 8, background: s.bg, border: `1px solid ${s.b}`, color: s.c, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span>{s.i}</span>{msg}</div>;
}

// ─── Searchable Vendor Dropdown ─────────────────────────────────────────────
// Opens immediately on first keystroke; selected vendor + GST shown in input
function VendorSelect({ vendors, value, onChange, highlighted, placeholder = "Search & select vendor…", showReset = false }) {
  const [q, setQ]       = useState("");
  const [open, setOpen] = useState(false);
  const ref             = useRef();
  const inputRef        = useRef();
  const selected        = vendors.find((v) => v._id === value);
  // Show full list when no query; filter as user types
  const filtered        = vendors.filter((v) => !q || v.companyName?.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleQ = (e) => { setQ(e.target.value); setOpen(true); };
  const select  = (v) => { onChange(v._id); setOpen(false); setQ(""); };
  const clear   = (e) => { e.stopPropagation(); onChange(""); setQ(""); inputRef.current?.focus(); setOpen(true); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Always-visible search input — typing instantly filters */}
      <div style={{ ...IShi(highlighted), display: "flex", alignItems: "center", gap: 6, padding: "0 10px" }}>
        <Search size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={selected && !q ? selected.companyName : q}
          onChange={handleQ}
          onFocus={() => { setOpen(true); if (selected) setQ(""); }}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", outline: "none", padding: "9px 0", fontSize: 14, background: "transparent", color: "#0f172a", fontFamily: "inherit" }}
        />
        {value && <span onClick={clear} style={{ cursor: "pointer", color: "#94a3b8", display:"flex",alignItems:"center", flexShrink:0 }}><X size={13}/></span>}
        {!value && <span style={{ color: "#94a3b8", fontSize: 11, flexShrink:0 }}>{open ? "▲" : "▼"}</span>}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #3b82f6", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.15)", zIndex: 500, overflow: "hidden" }}>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {q && filtered.length === 0 && <div style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13 }}>No vendors match "{q}"</div>}
            {filtered.map((v) => (
              <div key={v._id} onClick={() => select(v)}
                style={{ padding: "10px 14px", cursor: "pointer", background: v._id === value ? "#eff6ff" : "#fff", borderBottom: "1px solid #f1f5f9" }}
                onMouseEnter={(e) => { if (v._id !== value) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { if (v._id !== value) e.currentTarget.style.background = v._id === value ? "#eff6ff" : "#fff"; }}>
                <div style={{ fontWeight: v._id === value ? 700 : 500, fontSize: 14, color: v._id === value ? "#1d4ed8" : "#0f172a" }}>{v.companyName}</div>
                {v.gstNumber && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 1 }}>GST: {v.gstNumber}</div>}
              </div>
            ))}
            {!q && <div onClick={() => { onChange(""); setOpen(false); }} style={{ padding: "9px 14px", cursor: "pointer", color: "#94a3b8", fontSize: 12, borderTop: "1px solid #f1f5f9" }}>Clear selection</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ label, hint, accept, onFile, preview, onClear, scanning, children }) {
  const [drag, setDrag] = useState(false);
  const ref             = useRef();
  const handle          = (f) => f && onFile(f);

  useEffect(() => {
    const h = (e) => { const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/") || i.type === "application/pdf"); if (item) handle(item.getAsFile()); };
    window.addEventListener("paste", h); return () => window.removeEventListener("paste", h);
  }, []);

  return (
    <div style={{ marginBottom: 20 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}{hint && <span style={{ fontWeight: 400, textTransform: "none", color: "#94a3b8", marginLeft: 6 }}>{hint}</span>}</label>}
      {!preview ? (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
          onClick={() => ref.current?.click()}
          style={{ border: `2px dashed ${drag ? "#3b82f6" : "#cbd5e1"}`, borderRadius: 12, padding: "28px 20px", textAlign: "center", background: drag ? "#eff6ff" : "#f8fafc", cursor: "pointer", transition: "all 0.2s" }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>📎</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 3 }}>Drop file, paste (Ctrl+V) or click to browse</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{accept}</div>
          <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => handle(e.target.files[0])} />
        </div>
      ) : (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1.5px solid #e2e8f0", background: "#f8fafc" }}>
          {preview === "pdf" ? (
            <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32 }}>📄</span>
              <div><div style={{ fontWeight: 700, fontSize: 14 }}>PDF uploaded</div><div style={{ fontSize: 12, color: "#94a3b8" }}>Ready to extract</div></div>
            </div>
          ) : <img src={preview} alt="upload" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />}
          {scanning && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Reading document…</span>
            </div>
          )}
          <button onClick={onClear} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14}/></button>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Gemini quota check — runs once per session, result cached ───────────────
let _geminiAvailable = null;   // null = not yet checked
async function checkGeminiQuota() {
  if (_geminiAvailable !== null) return _geminiAvailable;
  try {
    const res = await fetch(`${API}/gemini-status`);
    const d   = await res.json();
    _geminiAvailable = d.available !== false;
  } catch {
    _geminiAvailable = true;   // if the check itself fails, attempt the scan anyway
  }
  return _geminiAvailable;
}

// ─── AI Extraction via Gemini (server-side proxy) ─────────────────────────────
async function extractViaGemini(file) {
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const optimized  = file.type.startsWith("image/") ? await compressImage(b64) : b64;
  const base64data = optimized.includes(",") ? optimized : b64;
  const res = await fetch(`${API}/invoices/process`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64data, mimeType: file.type }),
  });
  if (!res.ok) throw new Error("Gemini extraction failed");
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD PI MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function UploadPIModal({ vendors, onSave, onClose }) {
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanRes, setScanRes]   = useState(null); const [scanMsg, setScanMsg] = useState("");
  const [af, setAF]             = useState({});
  const [saving, setSaving]     = useState(false); const [err, setErr] = useState("");
  const [fileBase64, setFileBase64] = useState(null);
  const [fileMime, setFileMime]     = useState(null);
  const [dupInfo, setDupInfo]       = useState(null);
  const [form, setForm] = useState({ piNumber: "", vendor: "", piDate: new Date().toISOString().split("T")[0], dueDate: "", totalAmount: "", currency: "INR", bankDetails: "", notes: "", items: [] });
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setAF((a) => { const n = { ...a }; delete n[k]; return n; }); };

  const handleFile = async (f) => {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    setFileBase64(b64); setFileMime(f.type);
    setPreview(f.type === "application/pdf" ? "pdf" : b64);
    const quotaOk = await checkGeminiQuota();
    if (!quotaOk) {
      setScanRes("error");
      setScanMsg("AI scan quota reached for today — fill in the fields manually.");
      return;
    }
    setScanning(true); setScanRes(null);
    try {
      const ex = await extractViaGemini(f);
      const filled = {};
      if (ex.invoice_number)  filled.piNumber    = ex.invoice_number;
      if (ex.date)            filled.piDate      = ex.date;
      if (ex.total_amount)    filled.totalAmount = String(ex.total_amount);
      if (ex.vendor_name) { const m = vendors.find((v) => v.companyName?.toLowerCase().includes(ex.vendor_name.toLowerCase()) || ex.vendor_name.toLowerCase().includes(v.companyName?.toLowerCase())); if (m) filled.vendor = m._id; }
      const c = Object.keys(filled).length;
      setForm((f) => ({ ...f, ...filled })); setAF(Object.fromEntries(Object.keys(filled).map((k) => [k, true])));
      setScanRes(c >= 2 ? "success" : c > 0 ? "partial" : "error");
      setScanMsg(c >= 2 ? `${c} fields extracted.` : c > 0 ? `${c} field found.` : "Nothing extracted — fill manually.");
    } catch (e) { setScanRes("error"); setScanMsg("Extraction failed: " + e.message); }
    setScanning(false);
  };

  async function submit() {
    setErr("");
    if (!form.vendor) { setErr("Select a vendor."); return; }
    if (!form.piNumber) { setErr("PI Number required."); return; }
    if (!form.totalAmount) { setErr("Total Amount required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, totalAmount: parseFloat(form.totalAmount), attachment: fileBase64 || undefined, attachmentMime: fileMime || undefined };
      if (!payload.dueDate) delete payload.dueDate;
      const res = await fetch(`${API}/pi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const resData = await res.json();
      if (res.status === 409 && resData.duplicate) {
        setDupInfo({ piNumber: resData.piNumber });
        setSaving(false); return;
      }
      if (!res.ok) throw new Error(resData.error);
      onSave(resData);
    } catch (e) { setErr(e.message); } setSaving(false);
  }

  return (
    <Modal title="Upload Proforma Invoice (PI)" onClose={onClose} wide>
      {dupInfo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"32px 36px", maxWidth:420, width:"100%", textAlign:"center", boxShadow:"0 25px 60px rgba(0,0,0,0.22)" }}>
            <div style={{ width:60, height:60, borderRadius:16, background:"#fef3c7", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <AlertTriangle size={30} color="#f59e0b" />
            </div>
            <h3 style={{ margin:"0 0 8px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Duplicate PI</h3>
            <p style={{ margin:"0 0 6px", fontSize:14, color:"#475569", lineHeight:1.6 }}>
              PI number <b style={{ color:"#0f172a" }}>{dupInfo.piNumber}</b> already exists in the system.
            </p>
            <p style={{ margin:"0 0 24px", fontSize:13, color:"#94a3b8" }}>
              Check the Proforma Invoices tab — it may already be saved. If this is a revised PI, change the number before saving.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setDupInfo(null)} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", color:"#475569", fontWeight:700, fontSize:14, cursor:"pointer" }}>Change PI Number</button>
              <button onClick={onClose} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"none", background:"#6366f1", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
      <UploadZone label="PI Document" hint="— PDF, image or Ctrl+V" accept=".pdf,image/*" onFile={handleFile} preview={preview} onClear={() => { setPreview(null); setScanRes(null); setFileBase64(null); setFileMime(null); }} scanning={scanning}><ScanBanner result={scanRes} msg={scanMsg} /></UploadZone>
      <AutoFillBanner count={Object.keys(af).length} /><ErrBox msg={err} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="PI Number" required><input style={IShi(af.piNumber)} value={form.piNumber} onChange={(e) => set("piNumber", e.target.value)} placeholder="e.g. PI-2024-001" /></Field>
        <Field label="Vendor" required hint={af.vendor ? "✓ matched" : ""}>
          <VendorSelect vendors={vendors} value={form.vendor} onChange={(v) => set("vendor", v)} highlighted={af.vendor} />
          {!af.vendor && scanRes && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>⚠ Not matched — select manually</div>}
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="PI Date" required><input type="date" style={IShi(af.piDate)} value={form.piDate} onChange={(e) => set("piDate", e.target.value)} /></Field>
        <Field label="Due Date"><input type="date" style={IShi(af.dueDate)} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Total Amount" required><input type="number" style={IShi(af.totalAmount)} value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} placeholder="0.00" /></Field>
        <Field label="Currency"><input style={IShi(af.currency)} value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
      </div>
      <Field label="Bank / Payment Details"><textarea style={{ ...IShi(af.bankDetails), resize: "vertical", minHeight: 56 }} value={form.bankDetails} onChange={(e) => set("bankDetails", e.target.value)} placeholder="Bank name, account, IFSC, UPI ID…" /></Field>
      <Field label="Notes"><textarea style={{ ...IShi(af.notes), resize: "vertical", minHeight: 48 }} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancel</button>
        {(() => {
          const missing = [];
          if (!fileBase64)       missing.push("document");
          if (!form.piNumber)    missing.push("PI number");
          if (!form.vendor)      missing.push("vendor");
          if (!form.totalAmount) missing.push("total amount");
          const disabled = saving || scanning || missing.length > 0;
          return (
            <div style={{ display:"flex", alignItems:"center", gap:12, justifyContent:"flex-end" }}>
              {missing.length > 0 && !saving && <span style={{ fontSize:12, color:"#94a3b8" }}>Still needed: {missing.join(", ")}</span>}
              <button onClick={submit} disabled={disabled}
                style={{ padding:"10px 24px", borderRadius:8, border:"none", background: disabled ? "#e2e8f0" : "#6366f1", color: disabled ? "#94a3b8" : "#fff", fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", fontSize:14 }}>
                {saving ? "Saving…" : "Save PI"}
              </button>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD VENDOR INVOICE MODAL — vendor dropdown with GST auto-fill + save-back
// ═══════════════════════════════════════════════════════════════════════════════
function UploadInvoiceModal({ vendors, proformaInvoices, linkedPiId, onSave, onClose, refreshVendors }) {
  const [preview, setPreview]     = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [scanRes, setScanRes]     = useState(null); const [scanMsg, setScanMsg] = useState("");
  const [af, setAF]               = useState({});
  const [saving, setSaving]       = useState(false); const [err, setErr] = useState("");
  const [gstSaved, setGstSaved]   = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [fileBase64, setFileBase64] = useState(null);
  const [fileMime, setFileMime]     = useState(null);
  const [dupInfo, setDupInfo]       = useState(null);   // { invoice_number, vendor_name }

  const [form, setForm] = useState({
    vendor_name: "", vendor_gst: "", invoice_number: "",
    date: new Date().toISOString().split("T")[0],
    total_amount: "", cgst: "0", sgst: "0", igst: "0",
    financialYear: "", month: "", notes: "", linkedPi: linkedPiId || "",
  });
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setAF((a) => { const n = { ...a }; delete n[k]; return n; }); };

  // When a vendor is selected from the dropdown, auto-fill name + GST from vendor record
  const handleVendorSelect = async (vendorId) => {
    setSelectedVendorId(vendorId);
    if (!vendorId) { set("vendor_name", ""); set("vendor_gst", ""); setGstSaved(false); return; }
    const vendor = vendors.find((v) => v._id === vendorId);
    if (vendor) {
      set("vendor_name", vendor.companyName || "");
      if (vendor.gstNumber) { set("vendor_gst", vendor.gstNumber); setGstSaved(true); }
      else { set("vendor_gst", ""); setGstSaved(false); }
    }
  };

  // Pre-fill vendor_name from linked PI
  useEffect(() => {
    if (linkedPiId) { const pi = proformaInvoices.find((p) => p._id === linkedPiId); if (pi?.vendor?.companyName) set("vendor_name", pi.vendor.companyName); }
  }, [linkedPiId]);

  const handleFile = async (f) => {
    const fileB64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    setFileBase64(fileB64);
    setFileMime(f.type);
    setPreview(f.type === "application/pdf" ? "pdf" : fileB64);
    const quotaOk2 = await checkGeminiQuota();
    if (!quotaOk2) {
      setScanRes("error");
      setScanMsg("AI scan quota reached for today — fill in the fields manually.");
      return;
    }
    setScanning(true); setScanRes(null);
    try {
      const ex = await extractViaGemini(f);
      const filled = {};
      ["vendor_name","vendor_gst","invoice_number","date","financialYear","month"].forEach((k) => { if (ex[k]) filled[k] = ex[k]; });
      ["total_amount","cgst","sgst","igst"].forEach((k) => { if (ex[k] != null) filled[k] = String(ex[k]); });

      // Try to match extracted vendor_name to vendor list for GST lookup
      if (ex.vendor_name && !ex.vendor_gst) {
        const match = vendors.find((v) => v.companyName?.toLowerCase().includes(ex.vendor_name.toLowerCase()) || ex.vendor_name.toLowerCase().includes(v.companyName?.toLowerCase()));
        if (match) { setSelectedVendorId(match._id); if (match.gstNumber) { filled.vendor_gst = match.gstNumber; setGstSaved(true); } }
      }

      const c = Object.keys(filled).length;
      setForm((f) => ({ ...f, ...filled })); setAF(Object.fromEntries(Object.keys(filled).map((k) => [k, true])));
      setScanRes(c >= 4 ? "success" : c > 0 ? "partial" : "error");
      setScanMsg(c >= 4 ? `${c} fields extracted.` : c > 0 ? `${c} fields found.` : "Nothing extracted.");
    } catch (e) { setScanRes("error"); setScanMsg("Extraction failed: " + e.message); }
    setScanning(false);
  };

  // Save GST number back to vendor record for future use
  const saveGstToVendor = async () => {
    if (!selectedVendorId || !form.vendor_gst) return;
    try {
      await fetch(`${API}/vendor-gst/${selectedVendorId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gstNumber: form.vendor_gst }) });
      setGstSaved(true);
      // Refresh vendors list in parent so next time this vendor shows its GST
      refreshVendors && refreshVendors();
    } catch {}
  };

  async function submit() {
    setErr("");
    if (!form.invoice_number) { setErr("Invoice number required."); return; }
    if (!form.total_amount)   { setErr("Total amount required."); return; }
    // Save GST if entered manually and vendor selected
    if (selectedVendorId && form.vendor_gst && !gstSaved) await saveGstToVendor();
    setSaving(true);
    try {
      const { month, fy } = getFinancialDetails(form.date);
      const payload = { ...form, total_amount: parseFloat(form.total_amount), cgst: parseFloat(form.cgst)||0, sgst: parseFloat(form.sgst)||0, igst: parseFloat(form.igst)||0, image: fileBase64 || undefined, mimeType: fileMime || "image/jpeg", receivedVia: "manual_upload", financialYear: form.financialYear || fy, month: form.month || month, notes: form.notes || "Uploaded via Payment Tracker" };
      const res = await fetch(`${API}/invoices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const resData = await res.json();
      if (res.status === 409 && resData.duplicate) {
        setDupInfo({ invoice_number: resData.invoice_number, vendor_name: resData.vendor_name });
        setSaving(false); return;
      }
      if (!res.ok) throw new Error(resData.error || resData.message || "Save failed");
      if (form.linkedPi) await fetch(`${API}/pi/${form.linkedPi}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "invoiced" }) }).catch(() => {});
      onSave(resData);
    } catch (e) { setErr(e.message); } setSaving(false);
  }

  return (
    <Modal title="Upload Vendor Invoice" onClose={onClose} wide>
      {/* Duplicate Invoice Popup */}
      {dupInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 36px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 25px 60px rgba(0,0,0,0.22)" }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <AlertTriangle size={30} color="#f59e0b" />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Duplicate Invoice</h3>
            <p style={{ margin: "0 0 6px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              Invoice <b style={{ color: "#0f172a" }}>#{dupInfo.invoice_number}</b> from <b style={{ color: "#0f172a" }}>{dupInfo.vendor_name}</b> already exists in your vault.
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8" }}>
              This invoice has been uploaded before. No duplicate was saved.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDupInfo(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Check Again
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <UploadZone label="Invoice Document" hint="— PDF, image or Ctrl+V (Gemini AI reads it)" accept=".pdf,image/*" onFile={handleFile} preview={preview} onClear={() => { setPreview(null); setScanRes(null); setFileBase64(null); setFileMime(null); }} scanning={scanning}><ScanBanner result={scanRes} msg={scanMsg} /></UploadZone>
      <AutoFillBanner count={Object.keys(af).length} /><ErrBox msg={err} />

      <Field label="Link to Proforma Invoice" hint="optional">
        <select style={IS} value={form.linkedPi} onChange={(e) => set("linkedPi", e.target.value)}>
          <option value="">— Not linked to any PI —</option>
          {proformaInvoices.filter((p) => p.status !== "cancelled").map((pi) => <option key={pi._id} value={pi._id}>{pi.piNumber} · {pi.vendor?.companyName} · {fmt(pi.totalAmount)}</option>)}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Vendor" required hint="GST auto-fills · type name if not in list">
          <VendorSelect vendors={vendors} value={selectedVendorId} onChange={handleVendorSelect} highlighted={!!af.vendor_name} placeholder="Search & select vendor…" />
          {!selectedVendorId && (
            <input style={{ ...IS, marginTop: 6, fontSize: 13, background: af.vendor_name ? "#eff6ff" : "#fff", border: af.vendor_name ? "1.5px solid #3b82f6" : "1.5px solid #e2e8f0" }} value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} placeholder="Or type vendor name manually…" />
          )}
        </Field>
        <Field label="Vendor GSTIN" hint={gstSaved ? "✓ saved to vendor" : selectedVendorId && !form.vendor_gst ? "Enter to save for next time" : ""}>
          <div style={{ position: "relative" }}>
            <input style={IShi(af.vendor_gst)} value={form.vendor_gst} onChange={(e) => { set("vendor_gst", e.target.value); setGstSaved(false); }} placeholder="15-char GSTIN" maxLength={15} />
            {selectedVendorId && form.vendor_gst && !gstSaved && (
              <button onClick={saveGstToVendor} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save to Vendor</button>
            )}
          </div>
          {gstSaved && <div style={{ fontSize: 11, color: "#10b981", marginTop: 3 }}>✓ GST registered for this vendor</div>}
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Invoice Number" required><input style={IShi(af.invoice_number)} value={form.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} /></Field>
        <Field label="Invoice Date" required><input type="date" style={IShi(af.date)} value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
      </div>
      {(() => {
        const gst     = form.vendor_gst?.trim() || "";
        const isIntra = gst.length >= 2 && gst.startsWith("29");
        const isInter = gst.length >= 2 && !isIntra;
        const dim     = { opacity: 0.35, pointerEvents: "none", userSelect: "none" };
        return (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"0 12px" }}>
            <Field label="Total Amount" required>
              <input type="number" style={IShi(af.total_amount)} value={form.total_amount} onChange={(e) => set("total_amount", e.target.value)} placeholder="0" />
            </Field>
            <Field label="CGST" hint={isInter ? "N/A – inter-state" : ""}>
              <div style={isInter ? dim : {}}>
                <input type="number" style={IShi(af.cgst)} value={isInter ? "0" : form.cgst}
                  onChange={(e) => { if (!isInter) set("cgst", e.target.value); }} placeholder="0" disabled={isInter} />
              </div>
            </Field>
            <Field label="SGST" hint={isInter ? "N/A – inter-state" : ""}>
              <div style={isInter ? dim : {}}>
                <input type="number" style={IShi(af.sgst)} value={isInter ? "0" : form.sgst}
                  onChange={(e) => { if (!isInter) set("sgst", e.target.value); }} placeholder="0" disabled={isInter} />
              </div>
            </Field>
            <Field label="IGST" hint={isIntra ? "N/A – intra-state" : ""}>
              <div style={isIntra ? dim : {}}>
                <input type="number" style={IShi(af.igst)} value={isIntra ? "0" : form.igst}
                  onChange={(e) => { if (!isIntra) set("igst", e.target.value); }} placeholder="0" disabled={isIntra} />
              </div>
            </Field>
          </div>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Financial Year"><input style={IShi(af.financialYear)} value={form.financialYear} onChange={(e) => set("financialYear", e.target.value)} placeholder="e.g. 2024-25" /></Field>
        <Field label="Month"><input style={IShi(af.month)} value={form.month} onChange={(e) => set("month", e.target.value)} placeholder="e.g. March" /></Field>
      </div>
      <Field label="Notes"><textarea style={{ ...IS, resize: "vertical", minHeight: 48 }} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancel</button>
        {(() => {
          const gst      = form.vendor_gst?.trim() || "";
          const isIntra  = gst.length >= 2 && gst.startsWith("29");
          const isInter  = gst.length >= 2 && !isIntra;
          const cgst     = parseFloat(form.cgst) || 0;
          const sgst     = parseFloat(form.sgst) || 0;
          const igst     = parseFloat(form.igst) || 0;
          const taxOk    = isIntra ? (cgst > 0 && sgst > 0)
                         : isInter ? (igst > 0)
                         : (cgst > 0 && sgst > 0) || igst > 0;
          const vendorOk = !!(selectedVendorId || form.vendor_name?.trim());
          const missing  = [];
          if (!form.invoice_number)   missing.push("invoice number");
          if (!vendorOk)              missing.push("vendor name");
          if (!form.vendor_gst?.trim()) missing.push("GSTIN");
          if (!form.total_amount)     missing.push("total amount");
          if (!taxOk) missing.push(isInter ? "IGST" : "CGST & SGST");
          const disabled = saving || scanning || missing.length > 0;
          return (
            <div style={{ display:"flex", alignItems:"center", gap:12, justifyContent:"flex-end" }}>
              {missing.length > 0 && !saving && <span style={{ fontSize:12, color:"#94a3b8" }}>Still needed: {missing.join(", ")}</span>}
              <button onClick={submit} disabled={disabled}
                style={{ padding:"10px 24px", borderRadius:8, border:"none", background: disabled ? "#e2e8f0" : "#0891b2", color: disabled ? "#94a3b8" : "#fff", fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", fontSize:14 }}>
                {saving ? "Saving…" : "Save Invoice"}
              </button>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORD PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function RecordPaymentModal({ vendors, proformaInvoices, vendorInvoices, payments, onSave, onClose }) {
  const [preview, setPreview]     = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [scanRes, setScanRes]     = useState(null); const [scanMsg, setScanMsg] = useState("");
  const [af, setAF]               = useState({});
  const [saving, setSaving]       = useState(false); const [err, setErr] = useState("");
  const [fileBase64, setFileBase64] = useState(null);
  const [fileMime, setFileMime]     = useState(null);
  const [form, setForm] = useState({ vendor: "", paymentDate: new Date().toISOString().split("T")[0], amount: "", currency: "INR", paymentMode: "neft", bankRef: "", remarks: "", mappedTo: "advance", proformaInvoice: "", vendorInvoice: "" });
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setAF((a) => { const n = { ...a }; delete n[k]; return n; }); };

  const filteredPIs = proformaInvoices.filter((pi) => !form.vendor || pi.vendor?._id === form.vendor);
  const selectedPI  = proformaInvoices.find((p) => p._id === form.proformaInvoice);
  const [piSearch, setPiSearch]   = useState("");
  const [invSearch, setInvSearch] = useState("");

  // Compute amount already paid per invoice from payments array
  const paidByInvoice = (payments || []).reduce((acc, p) => {
    if (p.mappedTo === "vendor_invoice" && p.vendorInvoice) {
      const id = String(p.vendorInvoice?._id || p.vendorInvoice);
      acc[id] = (acc[id] || 0) + p.amount;
    }
    return acc;
  }, {});

  // Invoices with outstanding balance only
  const invoicesWithDue = vendorInvoices.filter((vi) => {
    const paid = paidByInvoice[String(vi._id)] || 0;
    return vi.total_amount - paid > 0;
  });

  const handleFile = async (f) => {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    setFileBase64(b64); setFileMime(f.type);
    setPreview(b64);
    const quotaOk3 = await checkGeminiQuota();
    if (!quotaOk3) {
      setScanRes("error");
      setScanMsg("AI scan quota reached for today — fill in the fields manually.");
      return;
    }
    setScanning(true); setScanRes(null);
    try {
      const ex = await extractViaGemini(f);
      const filled = {};
      if (ex.total_amount) filled.amount       = String(ex.total_amount);
      if (ex.date)         filled.paymentDate  = ex.date;
      if (ex.vendor_name) { const m = vendors.find((v) => v.companyName?.toLowerCase().includes(ex.vendor_name.toLowerCase()) || ex.vendor_name.toLowerCase().includes(v.companyName?.toLowerCase())); if (m) filled.vendor = m._id; }
      const c = Object.keys(filled).length;
      setForm((f) => ({ ...f, ...filled })); setAF(Object.fromEntries(Object.keys(filled).map((k) => [k, true])));
      setScanRes(c >= 2 ? "success" : c > 0 ? "partial" : "error");
      setScanMsg(c >= 2 ? `${c} fields extracted.` : c > 0 ? `${c} field found.` : "Nothing extracted.");
    } catch (e) { setScanRes("error"); setScanMsg("Scan failed: " + e.message); }
    setScanning(false);
  };

  async function submit() {
    setErr("");
    if (!form.amount || !form.paymentDate) { setErr("Amount and date required."); return; }
    if (form.mappedTo === "proforma_invoice" && !form.proformaInvoice) { setErr("Select a PI."); return; }
    if (form.mappedTo === "vendor_invoice"   && !form.vendorInvoice)   { setErr("Select an Invoice."); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount), screenshot: fileBase64 || undefined, screenshotMime: fileMime || undefined };
      if (payload.mappedTo !== "proforma_invoice") delete payload.proformaInvoice;
      if (payload.mappedTo !== "vendor_invoice")   delete payload.vendorInvoice;
      if (!payload.vendor) delete payload.vendor;
      const res = await fetch(`${API}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      onSave(await res.json());
    } catch (e) { setErr(e.message); } setSaving(false);
  }

  return (
    <Modal title="Record Payment" onClose={onClose} wide>
      <UploadZone label="Payment Screenshot" hint="— paste Ctrl+V or drag" accept="image/*" onFile={handleFile} preview={preview} onClear={() => { setPreview(null); setScanRes(null); setFileBase64(null); setFileMime(null); }} scanning={scanning}><ScanBanner result={scanRes} msg={scanMsg} /></UploadZone>
      <AutoFillBanner count={Object.keys(af).length} /><ErrBox msg={err} />
      <Field label="Vendor" hint="auto-detected or select"><VendorSelect vendors={vendors} value={form.vendor} onChange={(v) => set("vendor", v)} highlighted={af.vendor} placeholder="Unknown / select later" /></Field>
      <Field label="Map Payment Against" required>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[["advance","💰 Advance","Map later"],["proforma_invoice","📋 Against PI","PI exists"],["vendor_invoice","🧾 Against Invoice","Final invoice received"]].map(([val, lbl, sub]) => (
            <button key={val} onClick={() => set("mappedTo", val)} style={{ padding: "10px 8px", borderRadius: 10, border: `2px solid ${form.mappedTo === val ? "#3b82f6" : "#e2e8f0"}`, background: form.mappedTo === val ? "#eff6ff" : "#fff", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: form.mappedTo === val ? "#1d4ed8" : "#475569" }}>{lbl}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
            </button>
          ))}
        </div>
      </Field>
      {form.mappedTo === "proforma_invoice" && (() => {
        const openPIs = filteredPIs.filter((p) => p.status !== "cancelled" && p.amountDue > 0);
        const searchedPIs = piSearch
          ? openPIs.filter((pi) =>
              pi.piNumber?.toLowerCase().includes(piSearch.toLowerCase()) ||
              pi.vendor?.companyName?.toLowerCase().includes(piSearch.toLowerCase())
            )
          : openPIs;
        return (
          <Field label="Proforma Invoice" required>
            {/* Search input */}
            <div style={{ position: "relative", marginBottom: 6 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={piSearch}
                onChange={(e) => { setPiSearch(e.target.value); set("proformaInvoice", ""); }}
                placeholder="Search by PI number or vendor…"
                style={{ ...IS, paddingLeft: 32, fontSize: 13 }}
              />
              {piSearch && <button onClick={() => setPiSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"flex", alignItems:"center" }}><X size={13}/></button>}
            </div>
            {/* Scrollable results */}
            <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
              {searchedPIs.length === 0 && (
                <div style={{ padding: "14px 12px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                  {piSearch ? `No PIs match "${piSearch}"` : "No open PIs with outstanding balance"}
                </div>
              )}
              {searchedPIs.map((pi) => (
                <div key={pi._id}
                  onClick={() => { set("proformaInvoice", pi._id); setPiSearch(""); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                    background: form.proformaInvoice === pi._id ? "#eff6ff" : "#fff",
                    borderLeft: form.proformaInvoice === pi._id ? "3px solid #3b82f6" : "3px solid transparent" }}
                  onMouseEnter={(e) => { if (form.proformaInvoice !== pi._id) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (form.proformaInvoice !== pi._id) e.currentTarget.style.background = "#fff"; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: form.proformaInvoice === pi._id ? "#1d4ed8" : "#0f172a" }}>{pi.piNumber}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{pi.vendor?.companyName}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>Due: {fmt(pi.amountDue)}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>of {fmt(pi.totalAmount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Selected PI summary */}
            {selectedPI && (
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[["Total",fmt(selectedPI.totalAmount),"#0f172a"],["Paid",fmt(selectedPI.amountPaid),"#10b981"],["Due",fmt(selectedPI.amountDue),"#ef4444"]].map(([l,v,c]) => (
                  <div key={l} style={{ padding: "7px 10px", background: "#f8fafc", borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </Field>
        );
      })()}
      {form.mappedTo === "vendor_invoice" && (() => {
        const searchedInvs = invSearch
          ? invoicesWithDue.filter((vi) =>
              vi.invoice_number?.toLowerCase().includes(invSearch.toLowerCase()) ||
              vi.vendor_name?.toLowerCase().includes(invSearch.toLowerCase())
            )
          : invoicesWithDue;
        const selectedInv = invoicesWithDue.find((vi) => vi._id === form.vendorInvoice);
        return (
          <Field label="Vendor Invoice" required hint="showing invoices with outstanding balance only">
            {/* Search input */}
            <div style={{ position: "relative", marginBottom: 6 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={invSearch}
                onChange={(e) => { setInvSearch(e.target.value); set("vendorInvoice", ""); }}
                placeholder="Search by invoice number or vendor…"
                style={{ ...IS, paddingLeft: 32, fontSize: 13 }}
              />
              {invSearch && <button onClick={() => setInvSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"flex", alignItems:"center" }}><X size={13}/></button>}
            </div>
            {/* Scrollable results */}
            <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
              {invoicesWithDue.length === 0 && (
                <div style={{ padding: "14px 12px", color: "#10b981", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
                  ✓ All invoices are fully paid
                </div>
              )}
              {invoicesWithDue.length > 0 && searchedInvs.length === 0 && (
                <div style={{ padding: "14px 12px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                  No invoices match "{invSearch}"
                </div>
              )}
              {searchedInvs.map((vi) => {
                const paid = paidByInvoice[String(vi._id)] || 0;
                const due  = vi.total_amount - paid;
                return (
                  <div key={vi._id}
                    onClick={() => { set("vendorInvoice", vi._id); setInvSearch(""); }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                      background: form.vendorInvoice === vi._id ? "#eff6ff" : "#fff",
                      borderLeft: form.vendorInvoice === vi._id ? "3px solid #0891b2" : "3px solid transparent" }}
                    onMouseEnter={(e) => { if (form.vendorInvoice !== vi._id) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (form.vendorInvoice !== vi._id) e.currentTarget.style.background = "#fff"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: form.vendorInvoice === vi._id ? "#0891b2" : "#0f172a" }}>{vi.invoice_number}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{vi.vendor_name}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>Due: {fmt(due)}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>of {fmt(vi.total_amount)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Selected invoice summary */}
            {selectedInv && (
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  ["Total", fmt(selectedInv.total_amount), "#0f172a"],
                  ["Paid",  fmt(paidByInvoice[String(selectedInv._id)] || 0), "#10b981"],
                  ["Due",   fmt(selectedInv.total_amount - (paidByInvoice[String(selectedInv._id)] || 0)), "#ef4444"],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ padding: "7px 10px", background: "#f8fafc", borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </Field>
        );
      })()}
      {form.mappedTo === "advance" && <div style={{ padding: "12px 16px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#92400e" }}>💡 Saved as <b>advance</b> — map to PI or Invoice later.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Amount" required><input type="number" style={IShi(af.amount)} value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></Field>
        <Field label="Payment Date" required><input type="date" style={IShi(af.paymentDate)} value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Payment Mode"><select style={IShi(af.paymentMode)} value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>{["neft","rtgs","imps","upi","cheque","cash","other"].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></Field>
        <Field label="Bank Ref / UTR"><input style={IShi(af.bankRef)} value={form.bankRef} onChange={(e) => set("bankRef", e.target.value)} placeholder="UTR / UPI ref" /></Field>
      </div>
      <Field label="Remarks"><textarea style={{ ...IShi(af.remarks), resize: "vertical", minHeight: 48 }} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: saving ? "#94a3b8" : "#1d4ed8", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>{saving ? "Saving…" : form.mappedTo === "advance" ? "Save as Advance" : "Record Payment"}</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP ADVANCE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function MapAdvanceModal({ payment, proformaInvoices, vendorInvoices, onSave, onClose }) {
  const [mt, setMt]         = useState("proforma_invoice");
  const [piId, setPiId]     = useState(""); const [viId, setViId] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const vendorPIs = proformaInvoices.filter((pi) => (!payment.vendor || pi.vendor?._id === payment.vendor?._id) && pi.amountDue > 0 && pi.status !== "cancelled");
  const selectedPI = proformaInvoices.find((p) => p._id === piId);

  async function submit() {
    setErr("");
    if (mt === "proforma_invoice" && !piId) { setErr("Select a PI."); return; }
    if (mt === "vendor_invoice"   && !viId) { setErr("Select an Invoice."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/payments/${payment._id}/map`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mappedTo: mt, proformaInvoice: piId || undefined, vendorInvoice: viId || undefined }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      onSave(await res.json());
    } catch (e) { setErr(e.message); } setSaving(false);
  }

  return (
    <Modal title="Map Advance Payment" onClose={onClose}>
      <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 12, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[["Ref",payment.paymentRef,"#1d4ed8"],["Amount",fmt(payment.amount),"#10b981"],["Vendor",payment.vendor?.companyName||"—","#0f172a"],["Date",fmtDate(payment.paymentDate),"#475569"],["Mode",payment.paymentMode?.toUpperCase(),"#475569"]].map(([l,v,c]) => <div key={l}><div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div></div>)}
      </div>
      <ErrBox msg={err} />
      <Field label="Map To"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{[["proforma_invoice","📋 Proforma Invoice (PI)"],["vendor_invoice","🧾 Vendor Invoice"]].map(([val, lbl]) => <button key={val} onClick={() => setMt(val)} style={{ padding: "12px 8px", borderRadius: 10, border: `2px solid ${mt === val ? "#3b82f6" : "#e2e8f0"}`, background: mt === val ? "#eff6ff" : "#fff", fontWeight: 700, fontSize: 13, color: mt === val ? "#1d4ed8" : "#475569", cursor: "pointer" }}>{lbl}</button>)}</div></Field>
      {mt === "proforma_invoice" && (
        <Field label="Select PI">
          {vendorPIs.length === 0 ? <div style={{ padding: "12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#92400e" }}>No open PIs. Upload a PI first.</div>
            : <select style={IS} value={piId} onChange={(e) => setPiId(e.target.value)}><option value="">Select PI</option>{vendorPIs.map((pi) => <option key={pi._id} value={pi._id}>{pi.piNumber} · {pi.vendor?.companyName} · Due: {fmt(pi.amountDue)}</option>)}</select>}
          {selectedPI && payment.amount > selectedPI.amountDue && <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠ Payment ({fmt(payment.amount)}) exceeds PI balance ({fmt(selectedPI.amountDue)})</div>}
        </Field>
      )}
      {mt === "vendor_invoice" && (
        <Field label="Select Invoice">
          {vendorInvoices.length === 0 ? <div style={{ padding: "12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#92400e" }}>No invoices found.</div>
            : <select style={IS} value={viId} onChange={(e) => setViId(e.target.value)}><option value="">Select Invoice</option>{vendorInvoices.map((vi) => <option key={vi._id} value={vi._id}>{vi.invoice_number} · {vi.vendor_name} · {fmt(vi.total_amount)}</option>)}</select>}
        </Field>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: saving ? "#94a3b8" : "#10b981", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>{saving ? "Mapping…" : "Confirm Mapping"}</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PI FLOW MODAL (visual backtrack: PI → Payments → Invoice)
// ═══════════════════════════════════════════════════════════════════════════════
function PIFlowModal({ pi: piProp, payments, invoices, onMapPayment, onUploadInvoice, onClose, onRefresh }) {
  const [pi, setPi]       = React.useState(piProp);
  const [linkingId, setLinkingId] = React.useState(null);
  const [linkErr, setLinkErr]     = React.useState("");

  React.useEffect(() => { setPi(piProp); }, [piProp]);

  const piId = String(pi._id);

  // Payments mapped to this PI — robust string comparison for ObjectId vs string
  const piPayments = payments.filter((p) => {
    const pPiId = String(p.proformaInvoice?._id || p.proformaInvoice || "");
    return p.mappedTo === "proforma_invoice" && pPiId === piId;
  });

  // Find linked invoice using robust string comparison
  const linkedInvoice = pi.finalInvoice
    ? invoices.find((inv) => {
        const fiId = String(pi.finalInvoice?._id || pi.finalInvoice);
        return fiId === String(inv._id);
      }) || null
    : null;

  // Unlinked invoices from same vendor that could be linked (for suggestion)
  const suggestedInvoices = !linkedInvoice ? invoices.filter((inv) =>
    inv.vendor_name && pi.vendor?.companyName &&
    (inv.vendor_name.toLowerCase().includes(pi.vendor.companyName.toLowerCase()) ||
     pi.vendor.companyName.toLowerCase().includes(inv.vendor_name.toLowerCase())) &&
    Math.abs(inv.total_amount - pi.totalAmount) < pi.totalAmount * 0.5   // within 50% of PI amount
  ) : [];

  const advances = payments.filter((p) => p.mappedTo === "advance" && (!p.vendor || p.vendor?._id === pi.vendor?._id || String(p.vendor) === String(pi.vendor?._id)));

  return (
    <Modal title={`Payment Flow — ${pi.piNumber}`} onClose={onClose} extraWide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr 40px 1fr", alignItems: "flex-start", marginBottom: 28 }}>
        {/* PI */}
        <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 16, padding: "20px 22px", color: "#fff" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>📋 Proforma Invoice</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{fmt(pi.totalAmount)}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>{pi.piNumber} · {pi.vendor?.companyName}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}><Badge status={pi.status} />{pi.dueDate && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>Due {fmtDate(pi.dueDate)}</span>}</div>
          {pi.bankDetails && <div style={{ fontSize: 11, opacity: 0.75, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 8, marginTop: 6 }}>{pi.bankDetails}</div>}
          {pi.attachment && (
            <a href={pi.attachment} download={`PI_${pi.piNumber}`}
              style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:8, background:"rgba(255,255,255,0.15)", color:"#fff", borderRadius:7, padding:"5px 10px", fontSize:11, fontWeight:700, textDecoration:"none" }}>
              <Download size={12}/> PI Document
            </a>
          )}
        </div>
        <div style={{ textAlign: "center", paddingTop: 30, fontSize: 22, color: "#94a3b8" }}>→</div>
        {/* Payments */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 10 }}>💳 Payments ({piPayments.length})</div>
          {piPayments.length === 0 ? <div style={{ padding: "16px", background: "#f8fafc", borderRadius: 12, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No payments yet</div>
          : piPayments.map((pay, i) => (
            <div key={pay._id||i} style={{ padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#15803d" }}>{fmt(pay.amount)}</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{pay.paymentRef}</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(pay.paymentDate)} · {pay.paymentMode?.toUpperCase()}</div>
              {pay.bankRef && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>Ref: {pay.bankRef}</div>}
              {pay.screenshot && (
                <a href={pay.screenshot} download={`Payment_${pay.paymentRef}`}
                  style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:4, background:"#f0fdf4", color:"#15803d", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, textDecoration:"none" }}>
                  <Eye size={10}/> Screenshot
                </a>
              )}
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
              <span style={{ color: "#10b981" }}>Paid: {fmt(pi.amountPaid)}</span>
              <span style={{ color: "#ef4444" }}>Due: {fmt(pi.amountDue)}</span>
            </div>
            <ProgressBar paid={pi.amountPaid} total={pi.totalAmount} height={8} />
          </div>
          {advances.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 6 }}>⚠ Unlinked advances</div>
              {advances.map((pay) => (
                <div key={pay._id} style={{ padding: "9px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(pay.amount)}</div><div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(pay.paymentDate)} · {pay.paymentRef}</div></div>
                  <button onClick={() => onMapPayment(pay)} style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Map</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", paddingTop: 30, fontSize: 22, color: "#94a3b8" }}>→</div>
        {/* Invoice */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 10 }}>🧾 Vendor Invoice</div>
          {linkedInvoice ? (
            <div style={{ background: "linear-gradient(135deg,#0891b2,#0e7490)", borderRadius: 16, padding: "20px 22px", color: "#fff" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>✓ Received</div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{fmt(linkedInvoice.total_amount)}</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>{linkedInvoice.invoice_number}</div>
              <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10 }}>{fmtDate(linkedInvoice.date)}</div>
              {(linkedInvoice.cgst||linkedInvoice.sgst||linkedInvoice.igst) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 8 }}>
                  {[["CGST",linkedInvoice.cgst],["SGST",linkedInvoice.sgst],["IGST",linkedInvoice.igst]].map(([l,v]) => <div key={l} style={{ textAlign: "center" }}><div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{fmt(v)}</div></div>)}
                </div>
              )}
            </div>
          ) : (
            <div>
              {linkErr && <div style={{ padding:"8px 12px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, color:"#dc2626", fontSize:12, fontWeight:600, marginBottom:10 }}>{linkErr}</div>}
              {/* Suggested invoices to link */}
              {suggestedInvoices.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", marginBottom: 8, display:"flex", alignItems:"center", gap:6 }}>
                    <Link2 size={12}/> Invoice already in vault — link it?
                  </div>
                  {suggestedInvoices.map((inv) => (
                    <div key={inv._id} style={{ padding: "12px 14px", background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 12, marginBottom: 8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{inv.invoice_number}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{inv.vendor_name} · {fmtDate(inv.date)}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#0891b2", marginTop: 2 }}>{fmt(inv.total_amount)}</div>
                        </div>
                        <button
                          disabled={linkingId === inv._id}
                          onClick={async () => {
                            setLinkingId(inv._id); setLinkErr("");
                            try {
                              const res = await fetch(`${API}/payments/link-to-invoice`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ piId: pi._id, invoiceId: inv._id }),
                              });
                              const d = await res.json();
                              if (!res.ok) throw new Error(d.error || "Link failed");
                              onClose();
                              onRefresh && onRefresh();
                            } catch(e) { setLinkErr(e.message); setLinkingId(null); }
                          }}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:"none", background: linkingId === inv._id ? "#94a3b8" : "#0891b2", color:"#fff", fontWeight:700, fontSize:12, cursor: linkingId === inv._id ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
                          {linkingId === inv._id ? <><span style={{width:10,height:10,border:"2px solid #fff3",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block",animation:"spin .6s linear infinite"}}/> Linking…</> : <><Link2 size={12}/> Link This</>}
                        </button>
                      </div>
                      {Math.abs(inv.total_amount - pi.totalAmount) > 10 && (
                        <div style={{ fontSize: 11, color: "#0369a1", background: "#bae6fd", borderRadius: 6, padding: "3px 8px", display:"inline-block" }}>
                          ⚠ Amount differs from PI ({fmt(pi.totalAmount)})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: "20px 16px", background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 16, textAlign: "center" }}>
                <FileText size={28} color="#94a3b8" style={{ margin:"0 auto 8px", display:"block" }}/>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                  {suggestedInvoices.length > 0 ? "Or upload a new invoice" : "No invoice received yet"}
                </div>
                <button onClick={() => onUploadInvoice(pi._id)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding: "8px 14px", borderRadius: 9, border: "none", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  <FileUp size={13}/> Upload Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Payment timeline */}
      {piPayments.length > 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 14 }}>Payment Timeline</div>
          {piPayments.map((pay, i) => {
            const pct = pi.totalAmount > 0 ? (pay.amount / pi.totalAmount) * 100 : 0;
            return (
              <div key={pay._id||i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(pay.paymentDate)}</div>
                <div style={{ height: 10, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: i % 2 === 0 ? "#10b981" : "#3b82f6", borderRadius: 99 }} /></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textAlign: "right" }}>{fmt(pay.amount)}</div>
              </div>
            );
          })}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px", alignItems: "center", gap: 12, marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>TOTAL</div>
            <div style={{ height: 10, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}><div style={{ width: `${pi.totalAmount > 0 ? (pi.amountPaid / pi.totalAmount) * 100 : 0}%`, height: "100%", background: pi.amountDue === 0 ? "#10b981" : "#6366f1", borderRadius: 99 }} /></div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6366f1", textAlign: "right" }}>{fmt(pi.amountPaid)} / {fmt(pi.totalAmount)}</div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE VIEWER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function InvoiceViewerModal({ invoice, onClose }) {
  return (
    <Modal title={`Invoice — ${invoice.invoice_number}`} onClose={onClose} extraWide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[["Vendor",invoice.vendor_name||"—"],["GSTIN",invoice.vendor_gst||"N/A"],["Invoice #",invoice.invoice_number],["Date",fmtDate(invoice.date)],["FY",invoice.financialYear||"—"],["Month",invoice.month||"—"],["Source",invoice.receivedVia||"—"]].map(([l,v]) => (
              <div key={l} style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "16px 20px", background: "#eff6ff", borderRadius: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Tax Breakdown</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[["Total",fmt(invoice.total_amount),"#1d4ed8"],["CGST",fmt(invoice.cgst),"#475569"],["SGST",fmt(invoice.sgst),"#475569"],["IGST",fmt(invoice.igst),"#475569"]].map(([l,v,c]) => (
                <div key={l} style={{ textAlign: "center", padding: "10px 6px", background: "#fff", borderRadius: 10, border: "1px solid #dbeafe" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {invoice.notes && <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 13, color: "#92400e", marginBottom: 14 }}>📝 {invoice.notes}</div>}
          {invoice.image && <a href={invoice.image} download={`Invoice_${invoice.invoice_number}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "#0891b2", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>⬇ Download</a>}
        </div>
        <div style={{ background: "#f1f5f9", borderRadius: 16, overflow: "hidden", minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {invoice.image ? (invoice.mimeType === "application/pdf" ? <iframe src={invoice.image} style={{ width: "100%", height: 500, border: "none" }} title="PDF" /> : <div style={{ overflowY: "auto", maxHeight: 600 }}><img src={invoice.image} style={{ width: "100%" }} alt="Invoice" /></div>)
          : <div style={{ textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: 40, marginBottom: 8 }}>📄</div><div style={{ fontSize: 13, fontWeight: 600 }}>No document image</div></div>}
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE VAULT TAB — full hierarchy view with payment backtrack
// ═══════════════════════════════════════════════════════════════════════════════
function InvoiceVaultTab({ invoices, payments, proformaInvoices, vendors, onDelete, onViewInvoice, onUpload }) {
  const [search, setSearch]           = useState("");
  const [filterVendorName, setFVN]    = useState("");
  const [expandedFY, setExpandedFY]   = useState(null);
  const [expandedMo, setExpandedMo]   = useState(null);
  const [expandedInv, setExpandedInv] = useState(null);
  const [zipLoading, setZipLoading]   = useState(false);
  const [docList, setDocList]         = useState(null);

  // ── Vendor name filter search
  const [vq, setVq]     = useState("");
  const [vOpen, setVOpen] = useState(false);
  const vRef = useRef();
  useEffect(() => {
    const h = (e) => { if (vRef.current && !vRef.current.contains(e.target)) setVOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const vendorNames = [...new Set(invoices.map((i) => i.vendor_name).filter(Boolean))].sort();
  const filteredVNames = vendorNames.filter((n) => !vq || n.toLowerCase().includes(vq.toLowerCase()));

  const filteredInvoices = invoices.filter((inv) => {
    const s = search.toLowerCase();
    const textMatch = !s || inv.vendor_name?.toLowerCase().includes(s) || inv.invoice_number?.toLowerCase().includes(s);
    const vendorMatch = !filterVendorName || inv.vendor_name === filterVendorName;
    return textMatch && vendorMatch;
  });

  const hierarchy = filteredInvoices.reduce((acc, inv) => {
    const fy = normalizeFY(inv.financialYear || "Other"); const mo = inv.month || "Other";
    if (!acc[fy]) acc[fy] = {}; if (!acc[fy][mo]) acc[fy][mo] = [];
    acc[fy][mo].push(inv); return acc;
  }, {});

  const getTotals = (items) => items.reduce((s, i) => ({ total: s.total + (Number(i.total_amount)||0), cgst: s.cgst + (Number(i.cgst)||0), sgst: s.sgst + (Number(i.sgst)||0), igst: s.igst + (Number(i.igst)||0) }), { total: 0, cgst: 0, sgst: 0, igst: 0 });

  const exportCSV = (label, items) => {
    const hdr = ["Date","Vendor Name","GSTIN","Invoice Number","CGST","SGST","IGST","Total Amount"];
    const rows = items.map((inv) => [inv.date, `"${(inv.vendor_name||"").replace(/"/g,'""')}"`, inv.vendor_gst, inv.invoice_number, inv.cgst||0, inv.sgst||0, inv.igst||0, inv.total_amount||0]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([[hdr,...rows].map((r) => r.join(",")).join("\n")], { type: "text/csv" })); a.download = `Invoices_${label}.csv`; a.click();
  };

  const downloadZip = async (label, items, isYearly = false) => {
    const J = window.JSZip; const S = window.saveAs;
    if (!J || !S) { alert("Zip libraries loading..."); return; }
    setZipLoading(true);
    const zip = new J(); const root = zip.folder(label);
    try {
      for (const inv of items) {
        if (!inv.image) continue;
        const mime = inv.mimeType || (inv.image?.startsWith("data:application/pdf") ? "application/pdf" : "image/jpeg");
        const ext  = mime === "application/pdf" ? "pdf" : "jpg";
        const name = (inv.invoice_number || "UNKNOWN").replace(/[^a-z0-9_\-]/gi, "_");
        let folder = root;
        if (isYearly) { const d = new Date(inv.date); const mo = !isNaN(d.getTime()) ? d.toLocaleString("default", { month: "long" }) : "Unknown"; folder = root.folder(mo); }
        if (inv.image.startsWith("data:")) folder.file(`${name}.${ext}`, inv.image.split(",")[1], { base64: true });
        else { try { folder.file(`${name}.${ext}`, await fetch(inv.image).then((r) => r.blob())); } catch {} }
      }
      const blob = await zip.generateAsync({ type: "blob" }); S(blob, `${label.replace(/\s/g,"_")}.zip`);
    } catch { alert("Zip failed."); } finally { setZipLoading(false); }
  };

  // Build payment hierarchy for an invoice: Invoice → PI (if exists) → payments
  const getInvoicePayments = (inv) => {
    const invId = String(inv._id);

    // Payments directly mapped to this vault invoice (vendorInvoice field)
    const direct = payments.filter((p) =>
      p.mappedTo === "vendor_invoice" && (
        String(p.vendorInvoice?._id) === invId ||
        String(p.vendorInvoice)      === invId
      )
    );

    // Find linked PI via finalInvoice reference — search ALL proformaInvoices
    const matchedPI = proformaInvoices.find((pi) =>
      String(pi.finalInvoice?._id) === invId ||
      String(pi.finalInvoice)      === invId
    );

    // Payments against the linked PI (mappedTo proforma_invoice)
    const piId = matchedPI ? String(matchedPI._id) : null;
    const piPayments = piId
      ? payments.filter((p) => {
          const pPiId = String(p.proformaInvoice?._id || p.proformaInvoice || "");
          return p.mappedTo === "proforma_invoice" && pPiId === piId;
        })
      : [];

    return { direct, matchedPI, piPayments };
  };

  const grandT = getTotals(filteredInvoices);

  if (invoices.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 14 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Invoice Vault is empty</div>
      <div style={{ color: "#94a3b8", marginBottom: 20, fontSize: 13 }}>Upload invoices, or they appear automatically from WhatsApp & Outlook.</div>
      <button onClick={onUpload} style={{ background: "#0891b2", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🧾 Upload First Invoice</button>
    </div>
  );

  return (
    <div>
      {zipLoading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "30px 40px", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 700, fontSize: 13, color: "#475569", textTransform: "uppercase" }}>Preparing Zip…</div>
          </div>
        </div>
      )}

      {/* Doc list modal */}
      {docList && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 800, fontSize: 15 }}>{docList.title}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{docList.items.length} docs</div></div>
              <button onClick={() => setDocList(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display:"flex",alignItems:"center" }}><X size={18}/></button>
            </div>
            <div style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {docList.items.map((inv) => (
                <div key={inv._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{inv.vendor_name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>INV: {inv.invoice_number} · {fmt(inv.total_amount)}</div></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { onViewInvoice(inv); setDocList(null); }} style={{ display:"flex",alignItems:"center",gap:5,padding: "6px 12px", borderRadius: 7, border: "none", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 11, cursor: "pointer" }}><Eye size={12}/> View</button>
                    {inv.image && <a href={inv.image} download={`Invoice_${inv.invoice_number}`} style={{ padding: "6px 12px", borderRadius: 7, background: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>⬇</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grand totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        {[["Total Invoiced",fmt(grandT.total),"#1d4ed8"],["Total CGST",fmt(grandT.cgst),"#475569"],["Total SGST",fmt(grandT.sgst),"#475569"],["Total IGST",fmt(grandT.igst),"#475569"]].map(([l,v,c]) => (
          <div key={l} style={{ padding: "14px 16px", background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Search bar + Vendor filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", display:"flex" }}><Search size={15}/></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor or invoice #…" style={{ ...IS, paddingLeft: 36, paddingRight: search ? 36 : 12 }} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"flex", alignItems:"center", padding:2 }}><X size={14}/></button>}
        </div>

        {/* Vendor name filter with search + reset */}
        <div ref={vRef} style={{ position: "relative", width: 220 }}>
          <div onClick={() => setVOpen((o) => !o)} style={{ ...IS, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", color: filterVendorName ? "#0f172a" : "#94a3b8" }}>
            <span style={{ fontSize: 13 }}>{filterVendorName || "Filter by Vendor"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {filterVendorName && <span onClick={(e) => { e.stopPropagation(); setFVN(""); setVq(""); }} style={{ color: "#94a3b8", cursor: "pointer", display:"flex",alignItems:"center" }} title="Reset"><X size={14}/></span>}
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{vOpen ? "▲" : "▼"}</span>
            </div>
          </div>
          {vOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.12)", zIndex: 500, overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                <input autoFocus placeholder="Search vendor…" value={vq} onChange={(e) => setVq(e.target.value)} style={{ ...IS, padding: "6px 10px", fontSize: 13 }} />
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                <div onClick={() => { setFVN(""); setVOpen(false); setVq(""); }} style={{ padding: "9px 14px", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>All Vendors</div>
                {filteredVNames.map((name) => (
                  <div key={name} onClick={() => { setFVN(name); setVOpen(false); setVq(""); }}
                    style={{ padding: "9px 14px", cursor: "pointer", background: name === filterVendorName ? "#eff6ff" : "#fff", color: name === filterVendorName ? "#1d4ed8" : "#0f172a", fontWeight: name === filterVendorName ? 700 : 400, fontSize: 13, borderBottom: "1px solid #f8fafc" }}
                    onMouseEnter={(e) => { if (name !== filterVendorName) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (name !== filterVendorName) e.currentTarget.style.background = "#fff"; }}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(search || filterVendorName) && (
          <button onClick={() => { setSearch(""); setFVN(""); setVq(""); }} style={{ display:"flex",alignItems:"center",gap:5,padding: "9px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><X size={13}/> Clear All</button>
        )}
      </div>

      {/* FY/Month hierarchy */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(hierarchy).sort().reverse().map(([fy, months]) => {
          const allFYItems = Object.values(months).flat();
          const fyT = getTotals(allFYItems);
          return (
            <div key={fy} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#f8fafc", cursor: "pointer" }} onClick={() => setExpandedFY(expandedFY === fy ? null : fy)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display:"flex", alignItems:"center" }}>{expandedFY === fy ? <FolderOpen size={18} color="#6366f1" /> : <Folder size={18} color="#6366f1" />}</span>
                  <div><div style={{ fontWeight: 800, fontSize: 14 }}>FY {fy}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{allFYItems.length} invoices</div></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,80px)", gap: 8, textAlign: "right" }}>
                    {[["CGST",fyT.cgst],["SGST",fyT.sgst],["IGST",fyT.igst],["Total",fyT.total]].map(([l,v]) => <div key={l}><div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 12, fontWeight: 700, color: l==="Total"?"#6366f1":"#0f172a" }}>₹{fmtN(v)}</div></div>)}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); setDocList({ title: `FY ${fy} Vault`, items: allFYItems.filter((i) => i.image) }); }} style={{ display:"flex",alignItems:"center",gap:5,padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Link2 size={12}/> Links</button>
                    <button onClick={(e) => { e.stopPropagation(); downloadZip(`FY_${fy}`, allFYItems, true); }} style={{ display:"flex",alignItems:"center",gap:5,padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Archive size={12}/> Zip</button>
                    <button onClick={(e) => { e.stopPropagation(); exportCSV(`FY_${fy}`, allFYItems); }} style={{ display:"flex",alignItems:"center",gap:5,padding: "5px 12px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Download size={12}/> Excel</button>
                  </div>
                </div>
              </div>

              {expandedFY === fy && (
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(months).map(([month, items]) => {
                    const moKey = `${fy}-${month}`; const moT = getTotals(items);
                    return (
                      <div key={month} style={{ border: "1px solid #f1f5f9", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", background: "#fafafa", cursor: "pointer" }} onClick={() => setExpandedMo(expandedMo === moKey ? null : moKey)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display:"flex",alignItems:"center",color: "#94a3b8" }}>{expandedMo === moKey ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{month}</span>
                            <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>{items.length}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,80px)", gap: 8, textAlign: "right" }}>
                              {[["CGST",moT.cgst],["SGST",moT.sgst],["IGST",moT.igst],["Total",moT.total]].map(([l,v]) => <div key={l}><div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 11, fontWeight: 700, color: l==="Total"?"#0891b2":"#0f172a" }}>₹{fmtN(v)}</div></div>)}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={(e) => { e.stopPropagation(); downloadZip(`${month}_${fy}`, items); }} style={{ display:"flex",alignItems:"center",gap:3,padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}><Archive size={11}/></button>
                              <button onClick={(e) => { e.stopPropagation(); exportCSV(`${month}_${fy}`, items); }} style={{ display:"flex",alignItems:"center",gap:3,padding: "4px 8px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}><Download size={11}/></button>
                            </div>
                          </div>
                        </div>

                        {expandedMo === moKey && (
                          <div style={{ padding: "10px 14px" }}>
                            {items.map((inv) => {
                              const invKey = `${moKey}-${inv._id}`;
                              const { direct, matchedPI, piPayments } = getInvoicePayments(inv);
                              const hasPayments = direct.length > 0 || piPayments.length > 0 || !!matchedPI;
                              return (
                                <div key={inv._id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                                  {/* Invoice row */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }}
                                    onClick={() => setExpandedInv(expandedInv === invKey ? null : invKey)}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ fontSize: 18 }}>{inv.mimeType === "application/pdf" ? "📄" : "🖼"}</span>
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: 13 }}>{inv.vendor_name}</div>
                                        <div style={{ fontSize: 11, color: "#94a3b8" }}>INV: {inv.invoice_number} · {fmtDate(inv.date)}</div>
                                        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:3 }}>
                                          {matchedPI && <span style={{ fontSize: 10, fontWeight: 700, background: "#ede9fe", color: "#6d28d9", borderRadius: 20, padding: "1px 7px" }}>PI: {matchedPI.piNumber}</span>}
                                          {(direct.length + piPayments.length) > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "#d1fae5", color: "#065f46", borderRadius: 20, padding: "1px 7px" }}>{direct.length + piPayments.length} payment{direct.length + piPayments.length > 1 ? "s" : ""}</span>}
                                          {inv.receivedVia && inv.receivedVia !== "manual_upload" && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: inv.receivedVia==="whatsapp"?"#dcfce7":"#dbeafe", color: inv.receivedVia==="whatsapp"?"#15803d":"#1d4ed8", borderRadius: 20, padding: "1px 6px" }}>{inv.receivedVia}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "#6366f1" }}>{fmt(inv.total_amount)}</div>
                                        {hasPayments && <div style={{ fontSize: 11, color: "#10b981" }}>✓ {direct.length + piPayments.length} payment{(direct.length + piPayments.length) > 1 ? "s" : ""} tracked</div>}
                                      </div>
                                      <button onClick={(e) => { e.stopPropagation(); onViewInvoice(inv); }} style={{ display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30, borderRadius: 7, border: "none", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer" }}><Eye size={13}/></button>
                                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete?")) onDelete(inv._id); }} style={{ display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30, borderRadius: 7, border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer" }}><Trash2 size={13}/></button>
                                      <span style={{ display:"flex",alignItems:"center",color: "#94a3b8" }}>{expandedInv === invKey ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</span>
                                    </div>
                                  </div>

                                  {/* Payment backtrack hierarchy */}
                                  {expandedInv === invKey && (
                                    <div style={{ background: "#f8fafc", borderTop: "1px solid #f1f5f9", padding: "14px 18px" }}>
                                      {/* Invoice → PI → Payments hierarchy */}

                                      {/* Level 1: Invoice node */}
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#0891b2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                          <FileText size={14} color="#fff" />
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                          Invoice {inv.invoice_number}
                                          <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>{fmt(inv.total_amount)}</span>
                                        </div>
                                      </div>

                                      {/* Level 2: Linked PI (if exists) */}
                                      {matchedPI && (
                                        <div style={{ marginLeft: 14, borderLeft: "2px solid #e2e8f0", paddingLeft: 18, marginBottom: 8 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <div style={{ width: 24, height: 24, borderRadius: 7, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                              <ClipboardList size={12} color="#fff" />
                                            </div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1" }}>
                                              PI: {matchedPI.piNumber}
                                              <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>
                                                Total: {fmt(matchedPI.totalAmount)} · Paid: {fmt(matchedPI.amountPaid)}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Level 3: Payments against PI */}
                                          {piPayments.length > 0 && (
                                            <div style={{ marginLeft: 14, borderLeft: "2px solid #e2e8f0", paddingLeft: 14 }}>
                                              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Payments via PI ({piPayments.length})</div>
                                              {piPayments.map((p, i) => (
                                                <div key={p._id||i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#ede9fe", borderRadius: 8, marginBottom: 4 }}>
                                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <CreditCard size={12} style={{ color: "#6366f1", flexShrink: 0 }} />
                                                    <div>
                                                      <div style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>{fmt(p.amount)}</div>
                                                      <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(p.paymentDate)} · {p.paymentMode?.toUpperCase()}{p.bankRef ? ` · ${p.bankRef}` : ""}</div>
                                                    </div>
                                                  </div>
                                                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{p.paymentRef}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {piPayments.length === 0 && <div style={{ marginLeft: 14, fontSize: 11, color: "#94a3b8", paddingBottom: 4 }}>No payments recorded against this PI yet</div>}
                                        </div>
                                      )}

                                      {/* Direct payments against invoice */}
                                      {direct.length > 0 && (
                                        <div style={{ marginLeft: 14, borderLeft: "2px solid #e2e8f0", paddingLeft: 18, marginBottom: 8 }}>
                                          <div style={{ fontSize: 11, color: "#0891b2", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Direct Invoice Payments ({direct.length})</div>
                                          {direct.map((p, i) => (
                                            <div key={p._id||i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#e0f2fe", borderRadius: 8, marginBottom: 4 }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <CreditCard size={12} style={{ color: "#0891b2", flexShrink: 0 }} />
                                                <div>
                                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1" }}>{fmt(p.amount)}</div>
                                                  <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(p.paymentDate)} · {p.paymentMode?.toUpperCase()}{p.bankRef ? ` · ${p.bankRef}` : ""}</div>
                                                </div>
                                              </div>
                                              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{p.paymentRef}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* No payments at all */}
                                      {direct.length === 0 && !matchedPI && (
                                        <div style={{ marginLeft: 14, fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>No payments linked to this invoice yet.</div>
                                      )}

                                      {/* Summary footer */}
                                      {(direct.length > 0 || piPayments.length > 0) && (
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                                          <div style={{ fontSize: 12, color: "#475569" }}>
                                            Total paid: <b style={{ color: "#10b981" }}>{fmt([...direct, ...piPayments].reduce((s, p) => s + p.amount, 0))}</b>
                                            <span style={{ color: "#94a3b8", marginLeft: 6 }}>/ Invoice: <b style={{ color: "#0891b2" }}>{fmt(inv.total_amount)}</b></span>
                                          </div>
                                          <div style={{ width: 120 }}>
                                            <ProgressBar paid={[...direct, ...piPayments].reduce((s, p) => s + p.amount, 0)} total={inv.total_amount} height={6} />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE INVOICE UPLOAD PAGE
// Shown on mobile devices — only upload invoice, camera capture, manual entry
// ═══════════════════════════════════════════════════════════════════════════════
function MobileInvoicePage({ vendors, proformaInvoices, onSaved }) {
  const [step, setStep]           = useState("home"); // "home" | "upload" | "camera" | "manual"
  const [preview, setPreview]     = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [scanRes, setScanRes]     = useState(null);
  const [scanMsg, setScanMsg]     = useState("");
  const [af, setAF]               = useState({});
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [gstSaved, setGstSaved]   = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [fileBase64, setFileBase64] = useState(null);
  const [fileMime, setFileMime]     = useState(null);
  const [dupInfo, setDupInfo]       = useState(null);
  const [done, setDone]             = useState(null); // saved invoice
  const videoRef = useRef(); const canvasRef = useRef(); const fileRef = useRef();
  const [camActive, setCamActive] = useState(false);

  const [form, setForm] = useState({
    vendor_name: "", vendor_gst: "", invoice_number: "",
    date: new Date().toISOString().split("T")[0],
    total_amount: "", cgst: "0", sgst: "0", igst: "0",
    financialYear: "", month: "", notes: "", linkedPi: "",
  });
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setAF((a) => { const n = { ...a }; delete n[k]; return n; }); };

  const handleVendorSelect = (vendorId) => {
    setSelectedVendorId(vendorId);
    if (!vendorId) { set("vendor_name", ""); set("vendor_gst", ""); setGstSaved(false); return; }
    const v = vendors.find((v) => v._id === vendorId);
    if (v) { set("vendor_name", v.companyName || ""); if (v.gstNumber) { set("vendor_gst", v.gstNumber); setGstSaved(true); } else { set("vendor_gst", ""); setGstSaved(false); } }
  };

  const processFile = async (f) => {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    setFileBase64(b64); setFileMime(f.type);
    setPreview(f.type === "application/pdf" ? "pdf" : b64);
    setScanning(true); setScanRes(null); setStep("upload");
    try {
      const ex = await extractViaGemini(f);
      const filled = {};
      ["vendor_name","vendor_gst","invoice_number","date","financialYear","month"].forEach((k) => { if (ex[k]) filled[k] = ex[k]; });
      ["total_amount","cgst","sgst","igst"].forEach((k) => { if (ex[k] != null) filled[k] = String(ex[k]); });
      if (ex.vendor_name) {
        const m = vendors.find((v) => v.companyName?.toLowerCase().includes(ex.vendor_name.toLowerCase()) || ex.vendor_name.toLowerCase().includes(v.companyName?.toLowerCase()));
        if (m) { setSelectedVendorId(m._id); if (m.gstNumber) { filled.vendor_gst = m.gstNumber; setGstSaved(true); } }
      }
      const c = Object.keys(filled).length;
      setForm((f) => ({ ...f, ...filled })); setAF(Object.fromEntries(Object.keys(filled).map((k) => [k, true])));
      setScanRes(c >= 3 ? "success" : c > 0 ? "partial" : "error");
      setScanMsg(c >= 3 ? `${c} fields extracted — verify below` : c > 0 ? `${c} fields found — fill the rest` : "Couldn't read — fill manually");
    } catch (e) { setScanRes("error"); setScanMsg("Scan failed: " + e.message); }
    setScanning(false);
  };

  const startCamera = async () => {
    setStep("camera"); setCamActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setErr("Camera access denied"); setStep("home"); }
  };
  const stopCamera = () => { videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop()); setCamActive(false); };
  const capturePhoto = async () => {
    const v = videoRef.current; const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    stopCamera();
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
    await processFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  };

  const saveGstToVendor = async () => {
    if (!selectedVendorId || !form.vendor_gst) return;
    try { await fetch(`${API}/vendor-gst/${selectedVendorId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gstNumber: form.vendor_gst }) }); setGstSaved(true); } catch {}
  };

  const submit = async () => {
    setErr(""); if (!form.invoice_number) { setErr("Invoice number required"); return; } if (!form.total_amount) { setErr("Total amount required"); return; }
    if (selectedVendorId && form.vendor_gst && !gstSaved) await saveGstToVendor();
    setSaving(true);
    try {
      const { month, fy } = getFinancialDetails(form.date);
      const payload = { ...form, total_amount: parseFloat(form.total_amount), cgst: parseFloat(form.cgst)||0, sgst: parseFloat(form.sgst)||0, igst: parseFloat(form.igst)||0, image: fileBase64 || undefined, mimeType: fileMime || "image/jpeg", receivedVia: "manual_upload", financialYear: form.financialYear || fy, month: form.month || month };
      const res = await fetch(`${API}/invoices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.status === 409 && d.duplicate) { setDupInfo({ invoice_number: d.invoice_number, vendor_name: d.vendor_name }); setSaving(false); return; }
      if (!res.ok) throw new Error(d.error || "Save failed");
      setDone(d); onSaved && onSaved();
    } catch (e) { setErr(e.message); } setSaving(false);
  };

  const reset = () => { setStep("home"); setPreview(null); setFileBase64(null); setFileMime(null); setScanRes(null); setDone(null); setDupInfo(null); setErr(""); setAF({}); setSelectedVendorId(""); setGstSaved(false); setForm({ vendor_name:"",vendor_gst:"",invoice_number:"",date:new Date().toISOString().split("T")[0],total_amount:"",cgst:"0",sgst:"0",igst:"0",financialYear:"",month:"",notes:"",linkedPi:"" }); };

  const M = { padding: "0 16px", fontFamily: "'DM Sans',-apple-system,sans-serif" };
  const Btn = ({ children, onClick, color="#0891b2", disabled, outline }) => (
    <button onClick={onClick} disabled={disabled} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"15px 20px",borderRadius:14,border:outline?`2px solid ${color}`:"none",background:disabled?"#94a3b8":outline?"#fff":color,color:disabled?"#fff":outline?color:"#fff",fontWeight:700,fontSize:16,cursor:disabled?"not-allowed":"pointer",marginBottom:12,boxShadow:outline?"none":"0 4px 14px rgba(0,0,0,0.15)" }}>{children}</button>
  );

  // ── Done state ──────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ minHeight:"100dvh", background:"#f0fdf4", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, textAlign:"center" }}>
      <div style={{ width:72,height:72,borderRadius:20,background:"#10b981",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:"0 8px 24px #10b98140" }}><CheckCircle size={40} color="#fff"/></div>
      <h2 style={{ margin:"0 0 8px",fontSize:22,fontWeight:900,color:"#0f172a" }}>Invoice Saved!</h2>
      <div style={{ fontSize:14,color:"#475569",marginBottom:6 }}>{done.vendor_name}</div>
      <div style={{ fontSize:20,fontWeight:800,color:"#10b981",marginBottom:4 }}>{fmt(done.total_amount)}</div>
      <div style={{ fontSize:13,color:"#64748b",marginBottom:32 }}>INV: {done.invoice_number} · {done.month} {done.financialYear}</div>
      <button onClick={reset} style={{ background:"#0891b2",color:"#fff",border:"none",borderRadius:12,padding:"14px 32px",fontWeight:700,fontSize:16,cursor:"pointer",boxShadow:"0 4px 14px #0891b240" }}>Upload Another</button>
    </div>
  );

  // ── Camera view ─────────────────────────────────────────────────────────────
  if (step === "camera") return (
    <div style={{ position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column",zIndex:9999 }}>
      <canvas ref={canvasRef} style={{ display:"none" }} />
      <div style={{ padding:"16px 20px",display:"flex",alignItems:"center",gap:12 }}>
        <button onClick={() => { stopCamera(); setStep("home"); }} style={{ background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",fontSize:14,fontWeight:700,cursor:"pointer" }}>← Back</button>
        <span style={{ color:"#fff",fontWeight:700,fontSize:15,flex:1,textAlign:"center" }}>Scan Invoice</span>
      </div>
      <video ref={videoRef} autoPlay playsInline style={{ flex:1,objectFit:"cover",width:"100%" }} />
      <div style={{ padding:24,display:"flex",justifyContent:"center",background:"rgba(0,0,0,0.5)" }}>
        <button onClick={capturePhoto} style={{ width:72,height:72,borderRadius:"50%",background:"#fff",border:"4px solid rgba(255,255,255,0.4)",cursor:"pointer",boxShadow:"0 0 0 8px rgba(255,255,255,0.15)" }} />
      </div>
    </div>
  );

  // ── Home screen ─────────────────────────────────────────────────────────────
  if (step === "home") return (
    <div style={{ minHeight:"100dvh", background:"#f8fafc", fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
      <div style={{ background:"#0891b2",padding:"32px 20px 28px",textAlign:"center",color:"#fff" }}>
        <div style={{ width:56,height:56,borderRadius:16,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px" }}><FileUp size={28} color="#fff"/></div>
        <h1 style={{ margin:0,fontSize:22,fontWeight:900 }}>Upload Invoice</h1>
        <p style={{ margin:"6px 0 0",fontSize:13,opacity:0.85 }}>Capture, upload or type invoice details</p>
      </div>
      <div style={{ padding:"28px 20px" }}>
        <Btn onClick={startCamera} color="#0f172a"><span style={{ fontSize:22 }}>📷</span> Take a Photo</Btn>
        <Btn onClick={() => fileRef.current?.click()} color="#6366f1"><FileUp size={20}/> Upload PDF / Image</Btn>
        <Btn onClick={() => setStep("upload")} color="#0891b2" outline><Plus size={20}/> Enter Manually</Btn>
        <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} />
      </div>
      {err && <div style={{ margin:"0 20px",padding:"12px 16px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,color:"#dc2626",fontSize:13,fontWeight:600 }}>{err}</div>}
    </div>
  );

  // ── Form (upload result + manual entry) ─────────────────────────────────────
  const IS2 = { width:"100%",padding:"12px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff" };
  const ISh2 = (hi) => ({ ...IS2, border: hi ? "1.5px solid #3b82f6" : IS2.border, background: hi ? "#eff6ff" : "#fff" });
  const Lbl = ({ children, req }) => <div style={{ fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.4,marginBottom:5 }}>{children}{req && <span style={{ color:"#ef4444" }}> *</span>}</div>;

  return (
    <div style={{ minHeight:"100dvh", background:"#f8fafc", fontFamily:"'DM Sans',-apple-system,sans-serif", paddingBottom:100 }}>
      {/* Header */}
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={reset} style={{ background:"none",border:"none",cursor:"pointer",color:"#475569",display:"flex",alignItems:"center",padding:4 }}><ChevronRight size={20} style={{ transform:"rotate(180deg)" }}/></button>
        <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:16 }}>Invoice Details</div><div style={{ fontSize:11,color:"#94a3b8" }}>Verify and save</div></div>
        {scanning && <div style={{ fontSize:12,color:"#0891b2",fontWeight:600,display:"flex",alignItems:"center",gap:5 }}><div style={{ width:14,height:14,border:"2px solid #e0f2fe",borderTop:"2px solid #0891b2",borderRadius:"50%",animation:"spin .7s linear infinite" }}/> Reading…</div>}
      </div>

      {/* Preview thumbnail */}
      {preview && preview !== "pdf" && (
        <div style={{ margin:"12px 16px",borderRadius:12,overflow:"hidden",height:140,position:"relative" }}>
          <img src={preview} alt="Invoice" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.4),transparent)" }}/>
          {scanRes && <div style={{ position:"absolute",bottom:10,left:12,fontSize:12,fontWeight:700,color:"#fff" }}>{scanRes === "success" ? "✓ "+scanMsg : scanRes === "partial" ? "⚠ "+scanMsg : "✕ "+scanMsg}</div>}
        </div>
      )}
      {preview === "pdf" && (
        <div style={{ margin:"12px 16px",padding:"14px 16px",background:"#eff6ff",borderRadius:12,display:"flex",alignItems:"center",gap:10 }}>
          <FileText size={24} color="#3b82f6"/><div><div style={{ fontWeight:700,color:"#1d4ed8" }}>PDF uploaded</div>{scanRes && <div style={{ fontSize:12,color:"#475569" }}>{scanMsg}</div>}</div>
        </div>
      )}

      {dupInfo && (
        <div style={{ margin:"0 16px 12px",padding:"16px",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:12,textAlign:"center" }}>
          <AlertTriangle size={24} color="#f59e0b" style={{ display:"block",margin:"0 auto 8px" }}/>
          <div style={{ fontWeight:800,fontSize:15,marginBottom:4 }}>Duplicate Invoice</div>
          <div style={{ fontSize:13,color:"#475569" }}>#{dupInfo.invoice_number} from {dupInfo.vendor_name} already in vault.</div>
          <button onClick={() => setDupInfo(null)} style={{ marginTop:10,background:"#f59e0b",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontWeight:700,fontSize:13,cursor:"pointer" }}>OK</button>
        </div>
      )}

      <div style={{ padding:"8px 16px 16px" }}>
        {err && <div style={{ padding:"10px 14px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,color:"#dc2626",fontSize:13,fontWeight:600,marginBottom:12 }}>{err}</div>}
        {Object.keys(af).length > 0 && <div style={{ padding:"9px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,fontSize:13,color:"#1d4ed8",fontWeight:600,marginBottom:12 }}>🔵 {Object.keys(af).length} fields auto-filled — verify before saving</div>}

        {/* Vendor */}
        <div style={{ marginBottom:16 }}>
          <Lbl req>Vendor</Lbl>
          <VendorSelect vendors={vendors} value={selectedVendorId} onChange={handleVendorSelect} highlighted={!!af.vendor_name} placeholder="Type vendor name…"/>
          {!selectedVendorId && <input style={{ ...IS2,marginTop:6,fontSize:13 }} value={form.vendor_name} onChange={(e) => set("vendor_name",e.target.value)} placeholder="Or type manually…"/>}
        </div>

        {/* GST */}
        <div style={{ marginBottom:16 }}>
          <Lbl>{`Vendor GSTIN ${gstSaved ? "✓ saved" : selectedVendorId && !form.vendor_gst ? "(enter to save)" : ""}`}</Lbl>
          <div style={{ position:"relative" }}>
            <input style={ISh2(af.vendor_gst)} value={form.vendor_gst} onChange={(e) => { set("vendor_gst",e.target.value); setGstSaved(false); }} placeholder="15-char GSTIN" maxLength={15}/>
            {selectedVendorId && form.vendor_gst && !gstSaved && (
              <button onClick={saveGstToVendor} style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"#10b981",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}>Save</button>
            )}
          </div>
        </div>

        {/* Invoice # + Date */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:16 }}>
          <div><Lbl req>Invoice #</Lbl><input style={ISh2(af.invoice_number)} value={form.invoice_number} onChange={(e) => set("invoice_number",e.target.value)}/></div>
          <div><Lbl req>Date</Lbl><input type="date" style={ISh2(af.date)} value={form.date} onChange={(e) => set("date",e.target.value)}/></div>
        </div>

        {/* Amounts */}
        <div style={{ marginBottom:16 }}>
          <Lbl req>Total Amount (₹)</Lbl>
          <input type="number" style={ISh2(af.total_amount)} value={form.total_amount} onChange={(e) => set("total_amount",e.target.value)} placeholder="0" inputMode="decimal"/>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 10px",marginBottom:16 }}>
          {["cgst","sgst","igst"].map((k) => <div key={k}><Lbl>{k.toUpperCase()}</Lbl><input type="number" style={ISh2(af[k])} value={form[k]} onChange={(e) => set(k,e.target.value)} placeholder="0" inputMode="decimal"/></div>)}
        </div>

        <div style={{ marginBottom:16 }}>
          <Lbl>Notes</Lbl>
          <textarea style={{ ...IS2,resize:"vertical",minHeight:60 }} value={form.notes} onChange={(e) => set("notes",e.target.value)} placeholder="Optional"/>
        </div>
      </div>

      {/* Sticky save bar */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,padding:"12px 16px",background:"#fff",borderTop:"1px solid #e2e8f0",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)" }}>
        <button onClick={submit} disabled={saving || scanning} style={{ width:"100%",padding:"15px",borderRadius:14,border:"none",background:saving||scanning?"#94a3b8":"#0891b2",color:"#fff",fontWeight:800,fontSize:16,cursor:saving||scanning?"not-allowed":"pointer",boxShadow:"0 4px 14px #0891b240" }}>
          {saving ? "Saving…" : scanning ? "Reading document…" : "Save Invoice"}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════════════════════
export default function PaymentTracker() {
  // ── Mobile detection: show stripped-down invoice-only page on phones ─────────
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

  const [tab, setTab]               = useState("pi");
  const [data, setData]             = useState({ pi: [], payments: [], invoices: [] });
  const [vendors, setVendors]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [linkedPiId, setLinkedPiId] = useState(null);
  const [pendingPiFlowId, setPendingPiFlowId] = useState(null); // re-open PI flow after invoice upload
  const [filterVendor, setFilterVendor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(); if (filterVendor) params.set("vendorId", filterVendor);
      const qs = params.toString() ? "?" + params.toString() : "";
      const [piR, payR, invR] = await Promise.all([fetch(`${API}/pi${qs}`), fetch(`${API}/payments${qs}`), fetch(`${API}/invoices`)]);
      const [piD, payD, invD] = await Promise.all([piR.json(), payR.json(), invR.json()]);
      setData({ pi: piD.data || [], payments: payD.data || [], invoices: Array.isArray(invD) ? invD : (invD.data || []) });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterVendor]);

  const loadVendors = useCallback(() => {
    fetch(VAPI).then((r) => r.json()).then((d) => setVendors(Array.isArray(d) ? d : (d.data || []))).catch(() => {});
  }, []);
  useEffect(() => { loadVendors(); }, [loadVendors]);

  // ── On mobile — render only the invoice upload page ──────────────────────
  if (isMobile) {
    return <MobileInvoicePage vendors={vendors} proformaInvoices={data.pi} onSaved={() => load()} />;
  }
  useEffect(() => { load(); }, [load]);

  // Re-open PI flow modal after invoice upload + data reload
  useEffect(() => {
    if (pendingPiFlowId && !modal && data.pi.length > 0) {
      const freshPi = data.pi.find((p) => p._id === pendingPiFlowId);
      if (freshPi) { setSelected(freshPi); setModal("pi_flow"); }
      setPendingPiFlowId(null);
    }
  }, [data.pi, pendingPiFlowId, modal]);

  // PI tab: hide only PIs that are invoiced AND fully settled (amountDue=0)
  // Keep invoiced PIs that still have outstanding payments pending
  const filteredPIs = data.pi.filter((p) => {
    if (filterStatus) return p.status === filterStatus;
    if (p.status === "invoiced" && p.amountDue <= 0) return false;
    return true;
  });
  // Payments tab: only show advance (unmapped) payments.
  // Once mapped to a PI or Invoice they are visible under that record instead.
  const filteredPayments = data.payments.filter((p) => {
    const isAdvance = p.mappedTo === "advance";
    if (!filterStatus) return isAdvance;
    if (filterStatus === "advance") return isAdvance;
    return isAdvance && p.status === filterStatus;
  });
  const advanceCount     = data.payments.filter((p) => p.mappedTo === "advance").length;

  const statCards = [
    { label: "Total PI Value",      value: fmt(data.pi.reduce((s, p) => s + p.totalAmount, 0)),                                           sub: `${data.pi.length} PIs`,                  color: "#6366f1" },
    { label: "Total Paid",          value: fmt(data.payments.filter((p) => p.mappedTo !== "advance").reduce((s, p) => s + p.amount, 0)),  sub: `${data.payments.length} payments · ${advanceCount} unmapped`, color: "#10b981" },
    { label: "Outstanding",         value: fmt(data.pi.reduce((s, p) => s + p.amountDue, 0)),                                             sub: "Across all PIs",                         color: "#f59e0b" },
    { label: "Invoice Vault",       value: String(data.invoices.length),                                                                   sub: `${advanceCount} advances unmapped`,      color: advanceCount > 0 ? "#ef4444" : "#0891b2" },
  ];

  const activePICount = data.pi.filter((p) => !(p.status === "invoiced" && p.amountDue <= 0)).length;
  const tabs = [
    { key: "pi",       label: "📋 Proforma Invoices", count: activePICount, total: data.pi.length },
    { key: "payments", label: "💳 Payments",           count: advanceCount, alert: advanceCount },
    { key: "invoices", label: "🧾 Invoice Vault",      count: data.invoices.length },
  ];

  const statusOptions = tab === "pi"
    ? ["pending","partial","fully_paid","invoiced","cancelled"]
    : ["recorded","verified","reconciled","advance"];

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 3000, padding: "12px 20px", borderRadius: 12, background: toast.type==="success"?"#ecfdf5":"#fef2f2", border: `1px solid ${toast.type==="success"?"#6ee7b7":"#fca5a5"}`, color: toast.type==="success"?"#065f46":"#dc2626", fontWeight: 600, fontSize: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8 }}>
          {toast.type==="success"?"✓":"✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Payment Tracker</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>Upload PIs · Record payments · Invoice Vault · Map advances · Export monthly</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setModal("upload_pi")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#6366f1", border: "2px solid #6366f1", borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}><ClipboardList size={15} /> Upload PI</button>
          <button onClick={() => { setLinkedPiId(null); setModal("upload_invoice"); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#0891b2", border: "2px solid #0891b2", borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}><FileUp size={15} /> Upload Invoice</button>
          <button onClick={() => setModal("pay")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px #1d4ed840" }}><Plus size={16} /> Record Payment</button>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
          {statCards.map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${c.color}` }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters — PI and Payments tabs only */}
        {tab !== "invoices" && (
          <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "center" }}>
            <div style={{ width: 230 }}><VendorSelect vendors={vendors} value={filterVendor} onChange={setFilterVendor} placeholder="All Vendors" showReset /></div>
            <select style={{ ...IS, width: 170 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {statusOptions.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
            </select>
            {(filterVendor || filterStatus) && <button onClick={() => { setFilterVendor(""); setFilterStatus(""); }} style={{ display:"flex", alignItems:"center", gap:5, background: "none", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#64748b", cursor: "pointer", fontWeight: 600 }}><X size={14} /> Clear</button>}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4, marginBottom: 20, width: "fit-content" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setFilterStatus(""); }}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: tab===t.key?"#fff":"none", color: tab===t.key?"#1d4ed8":"#64748b", fontWeight: tab===t.key?700:500, cursor: "pointer", fontSize: 13, boxShadow: tab===t.key?"0 2px 8px rgba(0,0,0,0.08)":"none", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}>
              {t.label}
              <span style={{ background: tab===t.key?"#eff6ff":"#e2e8f0", color: tab===t.key?"#1d4ed8":"#94a3b8", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{t.count}</span>
              {t.alert > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{t.alert}</span>}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading…</div> : (
          <>
            {/* ── PI TAB ── */}
            {tab === "pi" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredPIs.length === 0 && !filterStatus && (
                  <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff", borderRadius: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>No Proforma Invoices yet</div>
                    <button onClick={() => setModal("upload_pi")} style={{ display:"flex",alignItems:"center",gap:7,background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14, margin:"0 auto" }}><FileUp size={16}/> Upload your first PI</button>
                  </div>
                )}
                {filteredPIs.length === 0 && filterStatus && (
                  <div style={{ textAlign:"center", padding:40, color:"#94a3b8", background:"#fff", borderRadius:14, fontSize:13 }}>No PIs with status "{STATUS_META[filterStatus]?.label || filterStatus}".</div>
                )}
                {filteredPIs.map((pi) => (
                  <div key={pi._id}
                    style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s", position: "relative" }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}>
                    {/* Clickable main area */}
                    <div onClick={() => { setSelected(pi); setModal("pi_flow"); }} style={{ cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <span style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{pi.piNumber}</span>
                            <Badge status={pi.status} />
                            {pi.finalInvoice && <span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 20, padding: "1px 8px", fontWeight: 700, display:"inline-flex", alignItems:"center", gap:4 }}><CheckCircle size={10}/> Invoice in Vault</span>}
                            {pi.status === "invoiced" && pi.amountDue <= 0 && <span style={{ fontSize: 11, background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd", borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>In Vault</span>}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b" }}>
                            <b>{pi.vendor?.companyName||"—"}</b>
                            <span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span>PI: {fmtDate(pi.piDate)}
                            {pi.dueDate && <><span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span>Due: {fmtDate(pi.dueDate)}</>}
                            <span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span>
                            <span style={{ color: "#6366f1", fontSize: 12 }}>Click to view full flow →</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{fmt(pi.totalAmount)}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{(pi.payments||[]).length} payment(s)</div>
                          </div>
                          {/* Delete button — stops propagation so it doesn't open the flow modal */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm(`Delete PI ${pi.piNumber}? This will also delete ${(pi.payments||[]).length} linked payment(s).`)) return;
                              await fetch(`${API}/pi/${pi._id}`, { method: "DELETE" });
                              showToast("PI deleted"); load();
                            }}
                            style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34, borderRadius:8, border:"1px solid #fecaca", background:"#fef2f2", color:"#ef4444", cursor:"pointer", flexShrink:0, marginTop:2 }}
                            title="Delete PI">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {[["Paid",fmt(pi.amountPaid),"#10b981"],["Due",fmt(pi.amountDue),pi.amountDue>0?"#ef4444":"#10b981"],["Invoice",pi.finalInvoice?.invoice_number||pi.finalInvoice?.invoiceNumber||"Pending","#6366f1"]].map(([lbl,val,col]) => (
                          <div key={lbl} style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
                            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", fontWeight: 700 }}>{lbl}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: col }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <ProgressBar paid={pi.amountPaid} total={pi.totalAmount} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PAYMENTS TAB ── */}
            {tab === "payments" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredPayments.length === 0 && (
                  <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff", borderRadius: 14 }}>
                    <CheckCircle size={36} color="#10b981" style={{ margin:"0 auto 12px", display:"block" }} />
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#10b981" }}>All caught up!</div>
                    <div style={{ fontSize: 13 }}>No unmapped advance payments.</div>
                    <div style={{ fontSize: 12, color:"#94a3b8", marginTop:6 }}>
                      Payments against PIs are visible inside each PI · payments against invoices are visible in the Invoice Vault.
                    </div>
                  </div>
                )}
                {filteredPayments.map((pay) => (
                  <div key={pay._id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderLeft: `3px solid ${pay.mappedTo === "advance" ? "#f59e0b" : pay.mappedTo === "proforma_invoice" ? "#6366f1" : "#0891b2"}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#1d4ed8" }}>{pay.paymentRef}</span>
                        <Badge status={pay.mappedTo === "advance" ? "advance" : pay.status} />
                        <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "2px 8px", fontWeight: 700, color: "#475569" }}>{pay.paymentMode?.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        <b style={{ color: "#0f172a" }}>{fmt(pay.amount)}</b>
                        <span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span>
                        {pay.vendor?.companyName || <span style={{ color: "#f59e0b" }}>Vendor unknown</span>}
                        <span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span>
                        {fmtDate(pay.paymentDate)}
                        {pay.bankRef && <><span style={{ margin: "0 8px", color: "#cbd5e1" }}>·</span><span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{pay.bankRef}</span></>}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 12 }}>
                        {pay.mappedTo === "proforma_invoice" && pay.proformaInvoice && (
                          <span style={{ color: "#6366f1", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ClipboardList size={12} /> PI: {pay.proformaInvoice.piNumber}
                          </span>
                        )}
                        {pay.mappedTo === "vendor_invoice" && pay.vendorInvoice && (
                          <span style={{ color: "#0891b2", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FileText size={12} /> Invoice: {pay.vendorInvoice.invoice_number}
                          </span>
                        )}
                        {pay.mappedTo === "advance" && (
                          <span style={{ color: "#f59e0b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <AlertTriangle size={12} /> Advance — not mapped yet
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => { setSelected(pay); setModal("map_advance"); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <MapPin size={13} /> Map Now
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm(`Delete payment ${pay.paymentRef} of ${fmt(pay.amount)}? This will reverse any balance updates.`)) return;
                        await fetch(`${API}/payments/${pay._id}`, { method: "DELETE" });
                        showToast("Payment deleted"); load();
                      }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", cursor: "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── INVOICE VAULT TAB ── */}
            {tab === "invoices" && (
              <InvoiceVaultTab
                invoices={data.invoices}
                payments={data.payments}
                proformaInvoices={data.pi}
                vendors={vendors}
                onDelete={async (id) => { await fetch(`${API}/invoices/${id}`, { method: "DELETE" }); load(); showToast("Invoice deleted"); }}
                onViewInvoice={(inv) => { setSelected(inv); setModal("invoice_view"); }}
                onUpload={() => { setLinkedPiId(null); setModal("upload_invoice"); }}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal === "upload_pi"      && <UploadPIModal vendors={vendors} onSave={() => { setModal(null); showToast("PI saved!"); load(); }} onClose={() => setModal(null)} />}
      {modal === "upload_invoice" && (
        <UploadInvoiceModal
          vendors={vendors}
          proformaInvoices={data.pi}
          linkedPiId={linkedPiId}
          refreshVendors={loadVendors}
          onSave={() => {
            setModal(null); setLinkedPiId(null);
            showToast("Invoice saved!");
            load();
            // pendingPiFlowId stays set — useEffect will re-open PI flow once data reloads
          }}
          onClose={() => { setModal(null); setLinkedPiId(null); setPendingPiFlowId(null); }}
        />
      )}
      {modal === "pay"            && <RecordPaymentModal vendors={vendors} proformaInvoices={data.pi} vendorInvoices={data.invoices} payments={data.payments} onSave={() => { setModal(null); showToast("Payment recorded!"); load(); }} onClose={() => setModal(null)} />}
      {modal === "pi_flow" && selected && (
        <PIFlowModal
          pi={data.pi.find((p) => p._id === selected._id) || selected}
          payments={data.payments}
          invoices={data.invoices}
          onMapPayment={(pay) => { setSelected(pay); setModal("map_advance"); }}
          onUploadInvoice={(piId) => { setLinkedPiId(piId); setPendingPiFlowId(piId); setModal("upload_invoice"); }}
          onRefresh={() => load()}
          onClose={() => { setModal(null); setSelected(null); setPendingPiFlowId(null); }}
        />
      )}
      {modal === "map_advance" && selected && <MapAdvanceModal payment={selected} proformaInvoices={data.pi} vendorInvoices={data.invoices} onSave={() => { setModal(null); setSelected(null); showToast("Payment mapped!"); load(); }} onClose={() => { setModal(null); setSelected(null); }} />}
      {modal === "invoice_view" && selected && <InvoiceViewerModal invoice={selected} onClose={() => { setModal(null); setSelected(null); }} />}
    </div>
  );
}