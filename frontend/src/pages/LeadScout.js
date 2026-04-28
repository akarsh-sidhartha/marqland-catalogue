import React, { useState, useCallback } from 'react';
import {
  Target, Building2, Users, Search, Sparkles, Loader2,
  RefreshCw, AlertCircle, Zap, MessageSquare, Globe,
  MapPin, Calendar, ExternalLink, Linkedin, Newspaper,
  BrainCircuit, Database, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Source badge config ────────────────────────────────────────────────────
const SOURCE_META = {
  'Gemini AI':   { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: BrainCircuit },
  'YourStory':   { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Newspaper },
  'Apollo.io':   { color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Database },
};

// ─── API helpers (call our own backend — keys stay server-side) ────────────
const api = {
  claude: (type, query) =>
    fetch('/api/lead-scout/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, query }),
    }).then(r => r.json()),

  yourstory: (query) =>
    fetch(`/api/lead-scout/yourstory?q=${encodeURIComponent(query)}&limit=8`)
      .then(r => r.json()),

  apollo: (type, query, page = 1) =>
    fetch('/api/lead-scout/apollo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, query, page }),
    }).then(r => r.json()),
};

// ─── Badges ─────────────────────────────────────────────────────────────────
const SourceBadge = ({ source }) => {
  const meta = SOURCE_META[source] || SOURCE_META['Gemini AI'];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
      <Icon size={9} />
      {source}
    </span>
  );
};

const UrgencyBadge = ({ level }) => {
  const map = {
    High:   'bg-red-50 text-red-600 border-red-200',
    Medium: 'bg-amber-50 text-amber-600 border-amber-200',
    Low:    'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[level] || map.Low}`}>
      {level}
    </span>
  );
};

const StageBadge = ({ stage }) => {
  const map = {
    'Bootstrapped': 'bg-slate-100 text-slate-600',
    'Pre-Seed':     'bg-violet-50 text-violet-600',
    'Seed':         'bg-blue-50 text-blue-600',
    'Series A':     'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[stage] || 'bg-slate-100 text-slate-500'}`}>
      {stage}
    </span>
  );
};

// ─── Founder Card ─────────────────────────────────────────────────────────────
const FounderCard = ({ lead }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden group">
    <div className="h-0.5 bg-gradient-to-r from-indigo-400 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />

    <div className="p-5 flex-1">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
            {(lead.company || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-sm leading-tight truncate">{lead.company}</h3>
            <p className="text-[11px] text-slate-400 font-medium truncate">{lead.industry}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StageBadge stage={lead.stage} />
          <SourceBadge source={lead.source || 'Gemini AI'} />
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {lead.founder && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Users size={11} className="text-indigo-400 shrink-0" />
            <span className="font-semibold truncate">{lead.founder}</span>
            {lead.designation && <span className="text-slate-400 truncate">· {lead.designation}</span>}
          </div>
        )}
        {lead.location && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin size={11} className="text-slate-400 shrink-0" />
            <span>{lead.location}</span>
          </div>
        )}
        {(lead.registeredAgo || lead.employees) && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={11} className="text-slate-400 shrink-0" />
            <span>
              {lead.registeredAgo && `Registered ${lead.registeredAgo}`}
              {lead.registeredAgo && lead.employees && ' · '}
              {lead.employees}
            </span>
          </div>
        )}
      </div>

      {/* YourStory article format */}
      {lead.description && (
        <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-3">{lead.description}</p>
      )}

      {/* Claude gifting trigger */}
      {lead.giftingTrigger && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <div className="flex items-start gap-1.5">
            <Zap size={11} className="text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-700 font-medium leading-relaxed">{lead.giftingTrigger}</p>
          </div>
        </div>
      )}
    </div>

    {/* Footer actions */}
    <div className="px-4 pb-4 flex items-center gap-2">
      {lead.linkedin && (
        <a
          href={lead.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
        >
          <Linkedin size={12} /> LinkedIn
        </a>
      )}
      {!lead.linkedin && lead.linkedinSearch && (
        <a
          href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.linkedinSearch)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
        >
          <Linkedin size={12} /> Search
        </a>
      )}
      {lead.website && (
        <a
          href={lead.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
        >
          <Globe size={12} /> Website
        </a>
      )}
      {lead.link && (
        <a
          href={lead.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-100 transition-colors"
        >
          <ExternalLink size={12} /> Read Article
        </a>
      )}
    </div>
  </div>
);

// ─── Inquiry Card ─────────────────────────────────────────────────────────────
const InquiryCard = ({ lead }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden group">
    <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />

    <div className="p-5 flex-1">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
            {(lead.person || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-sm leading-tight truncate">{lead.person}</h3>
            <p className="text-[11px] text-slate-400 font-medium truncate">{lead.designation} · {lead.company}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <UrgencyBadge level={lead.urgency} />
          <SourceBadge source={lead.source || 'Gemini AI'} />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
        <div className="flex items-start gap-1.5">
          <MessageSquare size={11} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 italic leading-relaxed">"{lead.inquiry}"</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {lead.occasion && (
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Occasion</p>
            <p className="text-xs font-bold text-slate-700">{lead.occasion}</p>
          </div>
        )}
        {lead.budget && (
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Budget</p>
            <p className="text-xs font-bold text-slate-700">{lead.budget}/unit</p>
          </div>
        )}
        {lead.quantity && (
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Quantity</p>
            <p className="text-xs font-bold text-slate-700">{lead.quantity}</p>
          </div>
        )}
        {lead.companySize && (
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Company</p>
            <p className="text-xs font-bold text-slate-700">{lead.companySize}</p>
          </div>
        )}
      </div>
    </div>

    <div className="px-4 pb-4 flex items-center gap-2">
      {lead.linkedin && (
        <a
          href={lead.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
        >
          <Linkedin size={12} /> LinkedIn
        </a>
      )}
      {!lead.linkedin && lead.linkedinSearch && (
        <a
          href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.linkedinSearch)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
        >
          <Linkedin size={12} /> Search
        </a>
      )}
      {lead.email && (
        <span className="text-[10px] text-slate-400 font-mono px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
          {lead.email}
        </span>
      )}
    </div>
  </div>
);

// ─── YourStory News Card (founder mode only) ───────────────────────────────
const NewsCard = ({ item }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden group">
    <div className="h-0.5 bg-gradient-to-r from-orange-400 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="p-5 flex-1">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center shrink-0 shadow-sm">
          <Newspaper size={16} className="text-white" />
        </div>
        <SourceBadge source="YourStory" />
      </div>
      <h3 className="font-black text-slate-900 text-sm leading-snug mb-2 line-clamp-2">{item.title}</h3>
      {item.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-3">{item.description}</p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        {item.author && <span>{item.author}</span>}
        {item.pubDate && (
          <>
            <span>·</span>
            <span>{new Date(item.pubDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </>
        )}
        {item.category && (
          <>
            <span>·</span>
            <span className="text-orange-600 font-bold">{item.category}</span>
          </>
        )}
      </div>
    </div>
    <div className="px-4 pb-4">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-100 transition-colors w-fit"
      >
        <ExternalLink size={12} /> Read on YourStory
      </a>
    </div>
  </div>
);

// ─── Skeleton Card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
    <div className="flex gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-3/4" />
        <div className="h-2 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
    <div className="space-y-2 mb-4">
      <div className="h-2 bg-slate-100 rounded w-full" />
      <div className="h-2 bg-slate-100 rounded w-5/6" />
    </div>
    <div className="h-14 bg-slate-50 rounded-xl" />
  </div>
);

// ─── Section with collapse ────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, count, color, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 mb-4 group w-full text-left"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={14} className="text-white" />
        </div>
        <span className="text-sm font-black text-slate-800">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
        )}
        <span className="ml-auto text-slate-400">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const LeadScout = () => {
  const [activeTab, setActiveTab]   = useState('founders');
  const [loading, setLoading]       = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError]           = useState(null);

  // Separate buckets per source
  const [claudeLeads,    setClaudeLeads]    = useState([]);
  const [yourstoryItems, setYourstoryItems] = useState([]);
  const [apolloLeads,    setApolloLeads]    = useState([]);

  // Per-source loading/error states
  const [srcStatus, setSrcStatus] = useState({ claude: 'idle', yourstory: 'idle', apollo: 'idle' });

  const totalFound = claudeLeads.length + yourstoryItems.length + apolloLeads.length;

  const setStatus = (src, status) => setSrcStatus(prev => ({ ...prev, [src]: status }));

  const performScout = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    setError(null);
    setClaudeLeads([]);
    setYourstoryItems([]);
    setApolloLeads([]);
    setSrcStatus({ claude: 'loading', yourstory: 'loading', apollo: 'loading' });

    const q = searchQuery.trim();

    // ── Fire all 3 sources in parallel ──────────────────────────────────────
    const [claudeResult, yourstoryResult, apolloResult] = await Promise.allSettled([
      api.claude(activeTab, q),
      // YourStory only makes sense for founders (startup news)
      activeTab === 'founders' ? api.yourstory(q || 'startup India') : Promise.resolve({ items: [] }),
      api.apollo(activeTab, q),
    ]);

    // ── Process Claude ───────────────────────────────────────────────────────
    if (claudeResult.status === 'fulfilled' && !claudeResult.value.error) {
      const leads = (claudeResult.value.leads || []).map(l => ({ ...l, source: 'Gemini AI' }));
      setClaudeLeads(leads);
      setStatus('claude', 'done');
    } else {
      console.warn('[Claude]', claudeResult.reason || claudeResult.value?.error);
      setStatus('claude', 'error');
    }

    // ── Process YourStory ────────────────────────────────────────────────────
    if (yourstoryResult.status === 'fulfilled' && !yourstoryResult.value.error) {
      setYourstoryItems(yourstoryResult.value.items || []);
      setStatus('yourstory', 'done');
    } else {
      console.warn('[YourStory]', yourstoryResult.reason || yourstoryResult.value?.error);
      setStatus('yourstory', activeTab === 'founders' ? 'error' : 'skipped');
    }

    // ── Process Apollo ────────────────────────────────────────────────────────
    if (apolloResult.status === 'fulfilled' && !apolloResult.value.error) {
      const people = (apolloResult.value.people || []).map(p => ({ ...p, source: 'Apollo.io' }));
      setApolloLeads(people);
      setStatus('apollo', 'done');
    } else {
      // Apollo key missing is non-fatal — just skip silently
      const msg = apolloResult.value?.error || apolloResult.reason?.message || '';
      console.warn('[Apollo]', msg);
      setStatus('apollo', msg.includes('not configured') ? 'unconfigured' : 'error');
    }

    setLoading(false);
  }, [activeTab, searchQuery]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setHasSearched(false);
    setError(null);
    setClaudeLeads([]);
    setYourstoryItems([]);
    setApolloLeads([]);
    setSrcStatus({ claude: 'idle', yourstory: 'idle', apollo: 'idle' });
  };

  // ── Source status pills ────────────────────────────────────────────────────
  const StatusPill = ({ src, label }) => {
    const s = srcStatus[src];
    const styles = {
      idle:         'bg-slate-100 text-slate-400',
      loading:      'bg-blue-50 text-blue-500 animate-pulse',
      done:         'bg-emerald-50 text-emerald-600',
      error:        'bg-red-50 text-red-500',
      skipped:      'bg-slate-100 text-slate-400',
      unconfigured: 'bg-amber-50 text-amber-600',
    };
    const labels = {
      idle:         label,
      loading:      `${label} …`,
      done:         `${label} ✓`,
      error:        `${label} failed`,
      skipped:      `${label} N/A`,
      unconfigured: `${label} (no key)`,
    };
    return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${styles[s] || styles.idle}`}>
        {labels[s] || label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Target size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Lead Scout</h1>
              <p className="text-xs text-slate-400 font-medium">Gemini AI · YourStory · Apollo.io</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => switchTab('founders')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'founders' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building2 size={12} /> New Founders
            </button>
            <button
              onClick={() => switchTab('inquiries')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'inquiries' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquare size={12} /> Gifting Inquiries
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">

        {/* ── Stats Strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Gemini AI',    value: claudeLeads.length,    icon: BrainCircuit, color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: 'YourStory',    value: yourstoryItems.length,  icon: Newspaper,    color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Apollo.io',    value: apolloLeads.length,     icon: Database,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'Total Leads',  value: totalFound,             icon: Target,       color: 'text-slate-700',  bg: 'bg-slate-100' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={`${stat.bg} w-9 h-9 rounded-xl flex items-center justify-center shrink-0`}>
                <stat.icon size={16} className={stat.color} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search Controls ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'founders'
                  ? 'Sector or city (e.g. SaaS Bangalore, Fintech Mumbai)…'
                  : 'Gifting context (e.g. Diwali hampers, employee onboarding)…'
              }
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && performScout()}
            />
          </div>
          <button
            onClick={performScout}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-60 ${
              activeTab === 'founders'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200'
            }`}
          >
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> Scouting…</>
              : <><Sparkles size={13} /> Scout for Leads</>
            }
          </button>
          {hasSearched && !loading && (
            <button
              onClick={performScout}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              title="Re-run scout"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* ── Source status bar ─────────────────────────────────────────────── */}
        {hasSearched && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sources:</span>
            <StatusPill src="claude" label="Gemini AI" />
            {activeTab === 'founders' && <StatusPill src="yourstory" label="YourStory" />}
            <StatusPill src="apollo" label="Apollo.io" />
            {totalFound > 0 && !loading && (
              <span className="ml-auto text-[10px] text-slate-400 font-medium">
                {totalFound} total leads · AI-generated & real data · verify before outreach
              </span>
            )}
          </div>
        )}

        {/* ── Pre-search tips ───────────────────────────────────────────────── */}
        {!hasSearched && (
          <div className={`rounded-2xl border p-5 mb-6 ${activeTab === 'founders' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'founders' ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                <Zap size={14} className={activeTab === 'founders' ? 'text-indigo-600' : 'text-amber-600'} />
              </div>
              <div className="flex-1">
                <p className={`text-xs font-black mb-1 ${activeTab === 'founders' ? 'text-indigo-900' : 'text-amber-900'}`}>
                  {activeTab === 'founders' ? 'Founder Scouting — 3 sources' : 'Gifting Inquiry Scouting — 2 sources'}
                </p>
                <p className={`text-xs leading-relaxed mb-3 ${activeTab === 'founders' ? 'text-indigo-700' : 'text-amber-800'}`}>
                  {activeTab === 'founders'
                    ? 'Gemini AI generates targeted startup profiles · YourStory pulls live news articles · Apollo.io finds real founder contacts with emails & LinkedIn.'
                    : 'Gemini AI surfaces intent signals · Apollo.io finds HR/Admin/Procurement contacts at Indian companies — your ideal gifting buyers.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(activeTab === 'founders'
                    ? ['Fintech Bangalore', 'SaaS Mumbai', 'D2C Delhi', 'HealthTech Hyderabad', 'Seed stage startup']
                    : ['Diwali gifting', 'Employee onboarding kits', 'Client hampers', 'Bulk corporate gifting', 'Premium accessories']
                  ).map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSearchQuery(tag)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                        activeTab === 'founders'
                          ? 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                          : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
            <button onClick={performScout} className="ml-auto text-xs font-bold text-red-600 hover:underline">Retry</button>
          </div>
        )}

        {/* ── Loading skeletons ─────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Results: grouped by source ─────────────────────────────────────── */}
        {!loading && hasSearched && (
          <>
            {/* Gemini AI results */}
            {claudeLeads.length > 0 && (
              <Section
                title="Gemini AI Intelligence"
                icon={BrainCircuit}
                count={claudeLeads.length}
                color="bg-violet-500"
              >
                {claudeLeads.map(lead =>
                  activeTab === 'founders'
                    ? <FounderCard key={lead.id} lead={lead} />
                    : <InquiryCard key={lead.id} lead={lead} />
                )}
              </Section>
            )}

            {/* YourStory news (founders only) */}
            {yourstoryItems.length > 0 && activeTab === 'founders' && (
              <Section
                title="YourStory — Live Startup News"
                icon={Newspaper}
                count={yourstoryItems.length}
                color="bg-orange-500"
              >
                {yourstoryItems.map(item => <NewsCard key={item.id} item={item} />)}
              </Section>
            )}

            {/* Apollo.io contacts */}
            {apolloLeads.length > 0 && (
              <Section
                title="Apollo.io — Verified Contacts"
                icon={Database}
                count={apolloLeads.length}
                color="bg-blue-500"
              >
                {apolloLeads.map(lead =>
                  activeTab === 'founders'
                    ? <FounderCard key={lead.id} lead={lead} />
                    : <InquiryCard key={lead.id} lead={lead} />
                )}
              </Section>
            )}

            {/* Empty state */}
            {totalFound === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">No results returned</p>
                <p className="text-xs text-slate-400 mt-1">Try broadening your query, or check API keys in .env</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LeadScout;