import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { initNotifications, requestNotifPermission, pushNotif, subscribeToPortalPush } from '../utils/portalNotifications';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — "The Digital Concierge" (DESIGN.md)
//
// Surfaces:   #0a1422 base | #17202f container | #2c3545 elevated
// Accent:     #e6c273 → #c5a357  (Champagne Gold gradient)
// On-primary: #3f2e00
// Typography: "Noto Serif" for display/headlines | "Manrope" for body
// Rules:      No 1px borders for sections — use tonal shifts + negative space
//             Ghost borders: rgba(white, 0.15) only when containment is needed
//             Shadows: blur 40px, rgba(0,0,0,0.4)
//             Roundedness: xl = 12px
// ─────────────────────────────────────────────────────────────────────────────

const DS = {
  base:    '#0a1422',
  cont:    '#17202f',
  contHi:  '#1f2d40',
  contTop: '#2c3545',
  bright:  '#374155',
  gold:    '#c5a357',
  goldHi:  '#e6c273',
  onGold:  '#3f2e00',
  outline: 'rgba(255,255,255,0.15)',
  muted:   'rgba(255,255,255,0.35)',
  text:    '#f0e8d6',
  sub:     'rgba(240,232,214,0.55)',
};

const GOLD_GRAD = `linear-gradient(45deg, ${DS.goldHi}, ${DS.gold})`;
const GLASS_BG  = 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)';

// ── Helpers ───────────────────────────────────────────────────────────────────
const toINR = v => `₹${Number(v||0).toLocaleString('en-IN')}`;
const fmtSz = b => b>1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
const fmtT  = d => new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});

// ── Inline feather-weight icons ───────────────────────────────────────────────
const Ic = {
  send:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  attach: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  ext:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  pin:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  star:   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  file:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  close:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  share:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  zoom:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>,
  heart:  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  heartO: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  play:   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
};

// ── Lightbox ──────────────────────────────────────────────────────────────────
const Lightbox = ({ src, alt, onClose }) => {
  useEffect(()=>{
    const fn = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',fn);
    return ()=>window.removeEventListener('keydown',fn);
  },[onClose]);
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(5,8,16,0.96)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24,backdropFilter:'blur(24px)'}}>
      <button onClick={onClose} style={{position:'fixed',top:20,right:20,background:GLASS_BG,border:'1px solid rgba(255,255,255,0.12)',borderRadius:'50%',width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:DS.muted,zIndex:10000,backdropFilter:'blur(12px)'}}>
        {Ic.close}
      </button>
      <img src={src} alt={alt} onClick={e=>e.stopPropagation()}
        style={{maxWidth:'90vw',maxHeight:'86vh',borderRadius:16,objectFit:'contain',boxShadow:'0 40px 80px rgba(0,0,0,0.4)'}}/>
    </div>
  );
};

// ── Attachment chip ────────────────────────────────────────────────────────────
const AttachChip = ({ att, isTeam }) => {
  const handleDownload = async (e) => {
    e.preventDefault();
    try {
      // Fetch the file as a blob so download works cross-origin
      const res = await fetch(att.url);
      if (!res.ok) throw new Error('File not found');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: open in new tab
      window.open(att.url, '_blank');
    }
  };
  return (
    <a href={att.url} target="_blank" rel="noreferrer"
      onClick={handleDownload}
      style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 11px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,textDecoration:'none',marginTop:5,cursor:'pointer'}}>
      <span style={{color:DS.gold}}>{Ic.file}</span>
      <span style={{fontSize:11,fontWeight:600,color:DS.muted,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{att.name}</span>
      {att.size>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}>{fmtSz(att.size)}</span>}
      <span style={{color:'rgba(255,255,255,0.3)'}}>{Ic.dl}</span>
    </a>
  );
};

// ── Pending file strip ─────────────────────────────────────────────────────────
const FileStrip = ({ files, onRemove }) => {
  if(!files.length) return null;
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px 18px 0'}}>
      {files.map((f,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,background:DS.contHi,border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'4px 10px'}}>
          <span style={{color:DS.gold,display:'flex'}}>{Ic.file}</span>
          <span style={{fontSize:11,color:DS.muted,maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
          <button onClick={()=>onRemove(i)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',padding:0,display:'flex',marginLeft:2}}>{Ic.close}</button>
        </div>
      ))}
    </div>
  );
};

// ── Refined Glass Card ─────────────────────────────────────────────────────────
// Follows DESIGN.md "Glass & Gradient Rule": semi-transparent surface-variant + backdrop-blur
const GlassCard = ({ children, style={}, delay=0, onHover }) => {
  const ref = useRef(null);
  return (
    <div ref={ref} style={{
      background: GLASS_BG,
      border: `1px solid ${DS.outline}`,
      borderRadius: 12,                    // xl per DESIGN.md
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.28s cubic-bezier(.34,1.56,.64,1), box-shadow 0.28s ease, border-color 0.28s ease',
      animation: `obsidianFadeIn .5s ease ${delay}s both`,
      ...style,
    }}
      onMouseEnter={e=>{
        e.currentTarget.style.transform='translateY(-4px)';
        e.currentTarget.style.boxShadow='0 24px 48px rgba(0,0,0,0.4)';
        e.currentTarget.style.borderColor='rgba(197,163,87,0.35)';
        onHover?.('enter');
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.transform='none';
        e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.32)';
        e.currentTarget.style.borderColor=DS.outline;
        onHover?.('leave');
      }}>
      {/* Shimmer line — signature texture from DESIGN.md */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(230,194,115,0.18) 50%,transparent)',pointerEvents:'none'}}/>
      {children}
    </div>
  );
};

// ── Price Box — uses tonal layering per DESIGN.md ─────────────────────────────
const PBox = ({ label, value, sub, amber }) => (
  <div style={{
    background: amber ? 'rgba(197,163,87,0.08)' : DS.contTop,
    border: `1px solid ${amber ? 'rgba(197,163,87,0.2)' : 'rgba(255,255,255,0.06)'}`,
    borderRadius: 10, padding: '10px 14px', textAlign: 'center',
  }}>
    <div style={{fontSize:9,color:amber?DS.gold:'rgba(255,255,255,0.4)',fontWeight:700,fontFamily:'Manrope,sans-serif',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>{label}</div>
    <div style={{fontSize:16,fontWeight:700,color:amber?DS.goldHi:DS.text,fontFamily:'Manrope,sans-serif'}}>{toINR(value)}</div>
    {sub&&<div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:1}}>{sub}</div>}
  </div>
);

// ── YouTube Embed ─────────────────────────────────────────────────────────────
// Extracts video ID from various YouTube URL formats and renders an embed
const getYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const YouTubeEmbed = ({ url, title }) => {
  const [show, setShow] = React.useState(false);
  const videoId = getYouTubeId(url);
  if (!videoId) return null;
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <div style={{borderRadius:10,overflow:'hidden',background:DS.base,border:`1px solid rgba(255,255,255,0.08)`,marginTop:12}}>
      {!show ? (
        <div style={{position:'relative',cursor:'pointer',aspectRatio:'16/9'}} onClick={()=>setShow(true)}>
          <img src={thumb} alt={title||'Video'} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
          <div style={{position:'absolute',inset:0,background:'rgba(5,10,20,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:54,height:54,background:'rgba(197,163,87,0.92)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 32px rgba(197,163,87,0.4)',transition:'transform .2s'}}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <span style={{color:DS.onGold,marginLeft:3}}>{Ic.play}</span>
            </div>
          </div>
          <div style={{position:'absolute',bottom:10,left:12,fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)',fontFamily:'Manrope,sans-serif',textShadow:'0 1px 4px rgba(0,0,0,0.7)',maxWidth:'70%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title||'Watch Video'}</div>
        </div>
      ) : (
        <div style={{aspectRatio:'16/9'}}>
          <iframe
            width="100%" height="100%"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title||'Video'}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{display:'block'}}
          />
        </div>
      )}
    </div>
  );
};

// ── Product Image Carousel ────────────────────────────────────────────────────
// Shows additionalImages as swipeable dots-nav carousel below primary image.
// Only rendered when there are ≥1 additional images.
const ProductCarousel = ({ images, primaryUrl, productName, onZoom }) => {
  const all = [primaryUrl, ...images].filter(Boolean);
  const [idx, setIdx] = React.useState(0);
  if (all.length <= 1) return null;

  const prev = (e) => { e.stopPropagation(); setIdx(i => (i - 1 + all.length) % all.length); };
  const next = (e) => { e.stopPropagation(); setIdx(i => (i + 1) % all.length); };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
      {/* Main image */}
      <div
        onClick={() => onZoom({ src: all[idx], alt: productName })}
        style={{ cursor: 'zoom-in', position: 'relative' }}
      >
        <img
          src={all[idx]}
          alt={`${productName} — image ${idx + 1}`}
          style={{
            width: '100%', display: 'block', objectFit: 'cover',
            maxHeight: 280, minHeight: 180,
            transition: 'opacity 0.25s ease',
          }}
        />
        {/* Gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(0deg,rgba(10,20,34,0.9),transparent)', pointerEvents: 'none' }} />
      </div>

      {/* Prev / Next arrows */}
      <button onClick={prev} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(10,20,34,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: DS.muted, zIndex: 4, backdropFilter: 'blur(6px)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button onClick={next} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(10,20,34,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: DS.muted, zIndex: 4, backdropFilter: 'blur(6px)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      {/* Counter badge */}
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(10,20,34,0.7)', color: 'rgba(255,255,255,0.55)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, backdropFilter: 'blur(4px)', fontFamily: 'Manrope,sans-serif', zIndex: 3 }}>
        {idx + 1} / {all.length}
      </div>

      {/* Dot indicators */}
      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 4 }}>
        {all.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            style={{
              width: i === idx ? 18 : 6, height: 6, borderRadius: 3, border: 'none',
              background: i === idx ? DS.gold : 'rgba(255,255,255,0.3)',
              cursor: 'pointer', padding: 0,
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Thumbnail strip — bottom of card, visible when many images */}
      {all.length > 3 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: 'rgba(10,20,34,0.85)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {all.map((src, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: 38, height: 38, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${i === idx ? DS.gold : 'transparent'}`,
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
            >
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Property Attachment Chip (client-facing, in offsite cards) ─────────────────
const PropAttachChip = ({ att }) => {
  const handleClick = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(att.url);
      if (!res.ok) throw new Error('Not found');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = att.name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(att.url, '_blank'); }
  };
  return (
    <a href={att.url} target="_blank" rel="noreferrer" onClick={handleClick}
      style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',background:'rgba(197,163,87,0.07)',border:'1px solid rgba(197,163,87,0.2)',borderRadius:8,textDecoration:'none',cursor:'pointer',transition:'background .15s'}}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(197,163,87,0.13)'}
      onMouseLeave={e=>e.currentTarget.style.background='rgba(197,163,87,0.07)'}>
      <span style={{color:DS.gold}}>{Ic.file}</span>
      <span style={{fontSize:11,fontWeight:600,color:DS.text,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{att.name}</span>
      {att.size>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}>{fmtSz(att.size)}</span>}
      <span style={{color:'rgba(255,255,255,0.35)'}}>{Ic.dl}</span>
    </a>
  );
};

// ── Smart Description — AI-structured property details ───────────────────────
const SECTION_ICONS = {
  travel:'🚗', highlights:'✨', amenities:'🏊', food:'🍽️',
  rooms:'🛏️', policies:'📋', activities:'🎯', info:'ℹ️',
};

const SmartDescription = ({ text, itemId }) => {
  const [state, setState]     = React.useState('idle');
  const [sections, setSections] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);
  const cacheKey = `sd_${itemId}`;

  React.useEffect(() => {
    if (!text || text.length < 80) return;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { setSections(JSON.parse(cached)); setState('done'); } catch {}
      return;
    }
    parse();
  }, []);

  const parse = async () => {
    setState('loading');
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content:
`You are a hospitality content formatter. Parse this property description into structured sections. Return ONLY valid JSON, no markdown, no explanation.

Property description:
"""
${text}
"""

Return this exact JSON shape (only include sections that have relevant content, max 5 sections):
{"sections":[{"type":"travel","title":"Getting There","points":["..."]},{"type":"highlights","title":"Highlights","points":["..."]},{"type":"amenities","title":"Amenities","points":["..."]},{"type":"food","title":"Food & Drinks","points":["..."]},{"type":"rooms","title":"Rooms","points":["..."]},{"type":"activities","title":"Activities","points":["..."]},{"type":"policies","title":"Policies","points":["..."]},{"type":"info","title":"Good to Know","points":["..."]}]}

Rules: Each point max 12 words. Distance/travel info → "travel". Never duplicate across sections. 2-5 points per section.` }],
        }),
      });
      const data = await response.json();
      const raw  = (data.content||[]).map(b=>b.text||'').join('');
      const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
      if (parsed.sections?.length > 0) {
        setSections(parsed.sections);
        setState('done');
        sessionStorage.setItem(cacheKey, JSON.stringify(parsed.sections));
      } else { setState('error'); }
    } catch { setState('error'); }
  };

  if (!text) return null;

  // Very short — plain text
  if (text.length < 80) {
    return <p style={{fontSize:12,color:DS.sub,lineHeight:1.65,fontFamily:'Manrope,sans-serif'}}>{text}</p>;
  }

  // Loading shimmer
  if (state==='loading') return (
    <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:6}}>
      {[75,55,85,60].map((w,i)=>(
        <div key={i} style={{height:9,borderRadius:5,background:'rgba(255,255,255,0.07)',width:`${w}%`,animation:'pulse 1.5s ease infinite',animationDelay:`${i*0.15}s`}}/>
      ))}
    </div>
  );

  // Fallback — plain text with expand/collapse
  if (state==='error'||state==='idle') {
    const lines = text.split('\n').filter(Boolean);
    return (
      <div>
        <p style={{fontSize:12,color:DS.sub,lineHeight:1.75,fontFamily:'Manrope,sans-serif',whiteSpace:'pre-line'}}>
          {(expanded||lines.length<=3) ? text : lines.slice(0,3).join('\n')+'…'}
        </p>
        {lines.length>3&&(
          <button onClick={()=>setExpanded(e=>!e)}
            style={{marginTop:5,fontSize:11,color:DS.gold,fontWeight:700,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'Manrope,sans-serif'}}>
            {expanded?'▲ Show less':'▼ Show more'}
          </button>
        )}
      </div>
    );
  }

  // Structured AI sections
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:6}}>
      {sections.map((sec,si)=>(
        <div key={si} style={{borderRadius:8,padding:'9px 12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{fontSize:9,fontWeight:800,color:DS.gold,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6,fontFamily:'Manrope,sans-serif',display:'flex',alignItems:'center',gap:5}}>
            <span>{SECTION_ICONS[sec.type]||'ℹ️'}</span>{sec.title}
          </div>
          {(sec.points||[]).map((pt,pi)=>(
            <div key={pi} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:DS.sub,lineHeight:1.55,marginBottom:3,fontFamily:'Manrope,sans-serif'}}>
              <span style={{color:DS.gold,flexShrink:0,fontSize:10,marginTop:2}}>›</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const Toast = ({ toasts }) => (
  <div style={{position:'fixed',bottom:28,right:28,zIndex:9998,display:'flex',flexDirection:'column',gap:10,pointerEvents:'none'}}>
    {toasts.map(t => (
      <div key={t.id} style={{
        display:'flex',alignItems:'flex-start',gap:12,
        background:DS.contHi,
        border:`1px solid rgba(197,163,87,0.3)`,
        borderRadius:12, padding:'14px 18px',
        boxShadow:'0 16px 40px rgba(0,0,0,0.4)',
        animation:'toastSlide .35s cubic-bezier(.34,1.56,.64,1)',
        minWidth:260,maxWidth:340,pointerEvents:'all',
        backdropFilter:'blur(20px)',
      }}>
        <div style={{width:32,height:32,background:'rgba(197,163,87,0.12)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15}}>{t.icon||'💬'}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,fontWeight:700,color:DS.gold,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'Manrope,sans-serif'}}>{t.title}</div>
          <div style={{fontSize:13,color:DS.text,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'Manrope,sans-serif'}}>{t.body}</div>
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
// ── Mobile breakpoint hook ────────────────────────────────────────────────────
const useMobile = () => {
  const [mob, setMob] = React.useState(() => window.innerWidth <= 480);
  React.useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 480);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mob;
};

const ClientPortalView = () => {
  const { slug }            = useParams();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [tab, setTab]       = useState('catalogue');
  const [msg, setMsg]       = useState('');
  const [files, setFiles]   = useState([]);
  const [sending, setSending] = useState(false);
  const [clientName, setClientName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [wishlisted, setWishlisted] = useState(new Set());
  const [shipments, setShipments]   = useState([]);
  const [shipmentsLoaded, setShipmentsLoaded] = useState(false);
  const [toasts, setToasts] = useState([]);
  const chatEnd         = useRef(null);
  const fileRef         = useRef(null);
  const prevMsgCount    = useRef(0);
  const pollTimer       = useRef(null);
  const isMobile        = useMobile();

  const showToast = (title, body, icon) => {
    const id = Date.now();
    setToasts(p => [...p, { id, title, body, icon }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };

  const toggleWish = id => setWishlisted(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  useEffect(()=>{
    initNotifications(); // register SW, no permission prompt yet
    load();
    fetch(`/api/portal/public/${slug}/view`,{method:'POST'}).catch(()=>{});
    pollTimer.current = setInterval(()=>load(true), 12000);
    return ()=>clearInterval(pollTimer.current);
  },[slug]);

  useEffect(()=>{ if(tab==='chat') chatEnd.current?.scrollIntoView({behavior:'smooth'}); },[portal?.messages,tab]);

  // Fetch shipments when shipments tab is first opened
  useEffect(()=>{
    if(tab!=='shipments'||shipmentsLoaded||!portal?.orderId) return;
    fetch(`/api/portal/public/${slug}/shipments`)
      .then(r=>r.ok?r.json():[])
      .then(data=>{ setShipments(Array.isArray(data)?data:[]); setShipmentsLoaded(true); })
      .catch(()=>setShipmentsLoaded(true));
  },[tab,shipmentsLoaded,portal,slug]);

  const load = async (silent=false) => {
    try{
      const res = await fetch(`/api/portal/public/${slug}`);
      if(!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      if(silent && prevMsgCount.current>0){
        const teamMsgs=(data.messages||[]).filter(m=>m.sender==='team');
        if(teamMsgs.length>prevMsgCount.current){
          const newest=teamMsgs[teamMsgs.length-1];
          const preview=newest.text?newest.text.slice(0,55)+(newest.text.length>55?'…':''):newest.attachments?.length?`📎 ${newest.attachments[0].name}`:'New message';
          showToast('Marqland Team',preview,'💬');
          pushNotif('Marqland Studios — New Message', preview, 'portal-team-msg');
        }
        prevMsgCount.current=(data.messages||[]).filter(m=>m.sender==='team').length;
      } else {
        prevMsgCount.current=(data.messages||[]).filter(m=>m.sender==='team').length;
      }
      setPortal(data);
      const name=data.orderPlacedBy||data.clientName||'';
      setClientName(name); if(name) setNameSet(true);
    }catch(e){ if(!silent) setError(e.message||'Link invalid or expired.'); }
    finally  { if(!silent) setLoading(false); }
  };

  const send = async () => {
    if((!msg.trim()&&files.length===0)||sending) return;
    // Ask for permission on first send — highest grant rate on user gesture
    const perm = await requestNotifPermission();
    if (perm === 'granted') subscribeToPortalPush(fetch); // register for server-side push
    const sender=clientName?.trim()||portal?.orderPlacedBy||portal?.clientName||'Client';
    setSending(true);
    try{
      const fd=new FormData();
      fd.append('text',msg.trim()); fd.append('senderName',sender);
      files.forEach(f=>fd.append('files',f));
      const r=await fetch(`/api/portal/public/${slug}/message`,{method:'POST',body:fd});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.message||'Send failed'); }
      setMsg(''); setFiles([]);
      showToast('Delivered','Your message has been sent to the team.','✓');
      await load();
    }catch(e){ alert('Could not send: '+e.message); }
    finally{ setSending(false); }
  };

  // ── Global CSS injected once ──────────────────────────────────────────────
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Manrope:wght@400;500;600;700;800&display=swap');
    @keyframes obsidianFadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes toastSlide{from{opacity:0;transform:translateX(20px) scale(0.95)}to{opacity:1;transform:none}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    *{box-sizing:border-box;margin:0}
    ::-webkit-scrollbar{width:3px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(197,163,87,0.35);border-radius:10px}
    .desc-scroll::-webkit-scrollbar{width:4px}
    .desc-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,0.04)}
    .desc-scroll::-webkit-scrollbar-thumb{background:rgba(197,163,87,0.5);border-radius:10px}
    .desc-scroll{scrollbar-width:thin;scrollbar-color:rgba(197,163,87,0.5) rgba(255,255,255,0.04)}
    textarea{resize:none}
    .img-hover:hover{transform:scale(1.04)!important}
    .ghost-btn:hover{background:rgba(255,255,255,0.06)!important}
  `;

  // ── Loading ───────────────────────────────────────────────────────────────
  if(loading) return (
    <div style={{minHeight:'100vh',background:DS.base,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Manrope,sans-serif'}}>
      <style>{globalStyles}</style>
      <div style={{textAlign:'center'}}>
        <div style={{width:38,height:38,border:`2px solid ${DS.contTop}`,borderTopColor:DS.gold,borderRadius:'50%',animation:'spin .9s linear infinite',margin:'0 auto 16px'}}/>
        <div style={{fontSize:12,color:DS.sub,letterSpacing:'0.12em',textTransform:'uppercase'}}>Loading your portal</div>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if(error) return (
    <div style={{minHeight:'100vh',background:DS.base,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Manrope,sans-serif',padding:24}}>
      <style>{globalStyles}</style>
      <div style={{textAlign:'center',maxWidth:400}}>
        <div style={{fontSize:48,marginBottom:20}}>⛓</div>
        <h1 style={{fontFamily:'Noto Serif,serif',color:DS.text,fontSize:22,fontWeight:700,marginBottom:10}}>Link unavailable</h1>
        <p style={{color:DS.sub,fontSize:14,lineHeight:1.7}}>{error}</p>
      </div>
    </div>
  );

  // ── Completed ─────────────────────────────────────────────────────────────
  if(portal.status==='completed') return (
    <div style={{minHeight:'100vh',background:DS.base,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Manrope,sans-serif',padding:24}}>
      <style>{globalStyles}</style>
      <div style={{textAlign:'center',maxWidth:520}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(197,163,87,0.08)',border:'1px solid rgba(197,163,87,0.2)',borderRadius:8,padding:'7px 16px',marginBottom:40}}>
          <div style={{width:20,height:20,background:GOLD_GRAD,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',color:DS.onGold,fontWeight:900,fontSize:10}}>M</div>
          <span style={{color:DS.gold,fontWeight:700,fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:'Manrope,sans-serif'}}>Marqland Studios</span>
        </div>
        <div style={{fontSize:64,marginBottom:24}}>🎉</div>
        <h1 style={{fontFamily:'Noto Serif,serif',color:DS.text,fontWeight:700,fontSize:30,marginBottom:14,lineHeight:1.2}}>Thank you, {portal.clientName}!</h1>
        <p style={{color:DS.sub,fontSize:15,lineHeight:1.8,marginBottom:40}}>It was our pleasure working with you. We hope the experience exceeded expectations.</p>
        {portal.reviewLink&&<a href={portal.reviewLink} target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',gap:10,background:GOLD_GRAD,color:DS.onGold,padding:'14px 30px',borderRadius:10,textDecoration:'none',fontWeight:700,fontSize:14,fontFamily:'Manrope,sans-serif'}}>
          {Ic.star} Share your experience
        </a>}
        <p style={{color:'rgba(255,255,255,0.2)',fontSize:11,marginTop:44,fontFamily:'Manrope,sans-serif',letterSpacing:'0.06em'}}>REF · {portal.orderRef}</p>
      </div>
    </div>
  );

  const items   = portal.type==='product' ? portal.productItems : portal.offsiteItems;
  const newMsgs = portal.messages?.filter(m=>m.sender==='team').length||0;

  return (
    <div style={{minHeight:'100vh',background:DS.base,fontFamily:'Manrope,sans-serif',color:DS.text}}>
      <style>{globalStyles}</style>

      {lightbox&&<Lightbox src={lightbox.src} alt={lightbox.alt} onClose={()=>setLightbox(null)}/>}
      <Toast toasts={toasts}/>

      {/* ── Navigation Rail — Refined Glassmorphism ── */}
      <nav style={{
        position:'sticky',top:0,zIndex:50,
        background:'rgba(10,20,34,0.82)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderBottom:`1px solid rgba(255,255,255,0.06)`,
        padding: isMobile ? '0 16px' : '0 32px',
      }}>
        <div style={{maxWidth:1160,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:isMobile?52:60}}>
          {/* Brand mark */}
          <div style={{display:'flex',alignItems:'center',gap:11}}>
            <div style={{width:28,height:28,background:GOLD_GRAD,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:DS.onGold,fontWeight:900,fontSize:11,letterSpacing:'-0.02em',flexShrink:0}}>M</div>
            <span style={{fontFamily:'Noto Serif,serif',color:DS.text,fontWeight:700,fontSize:14,letterSpacing:'0.04em'}}>Marqland Studios</span>
          </div>

          {/* Status + ref */}
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            {/* Status Pillar — DESIGN.md "Featured Component" */}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:2,height:20,background:GOLD_GRAD,borderRadius:2}}/>
              <span style={{fontSize:11,fontWeight:700,color:DS.gold,letterSpacing:'0.06em',textTransform:'uppercase',fontFamily:'Manrope,sans-serif'}}>
                {portal.status==='active'?'Active':'Completed'}
              </span>
            </div>
            {!isMobile&&<span style={{color:'rgba(255,255,255,0.2)',fontSize:12,fontFamily:'monospace',letterSpacing:'0.04em'}}>{portal.orderRef}</span>}
            <button onClick={()=>navigator.clipboard.writeText(window.location.href)}
              className="ghost-btn"
              style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'6px 9px',cursor:'pointer',color:DS.sub,display:'flex',alignItems:'center',transition:'background .15s'}}
              title="Copy link">{Ic.share}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Tab Bar — tonal shift from nav ── */}
      <div style={{background:DS.cont,borderBottom:`1px solid rgba(255,255,255,0.05)`,padding:isMobile?'0 12px':'0 32px'}}>
        <div style={{maxWidth:1160,margin:'0 auto',display:'flex',gap:4}}>
          {[
            {k:'catalogue',l:'Catalogue Options', b:items.length},
            ...(portal.type==='product' ? [{k:'selected', l:'Selected Items', b:wishlisted.size||null}] : []),
            ...(portal.type==='product' && !isMobile ? [{k:'shipments',l:'Shipment Tracking', b:null}] : []),
            {k:'chat',     l:'Message Board',     b:newMsgs||null},
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{
                padding: isMobile ? '12px 8px' : '16px 22px',
                background:'none',border:'none',
                borderBottom: tab===t.k ? `2px solid ${DS.gold}` : '2px solid transparent',
                color: tab===t.k ? DS.gold : DS.sub,
                fontSize: isMobile ? 11 : 13,
                fontWeight:600,cursor:'pointer',
                display:'flex',alignItems:'center',gap:isMobile?4:8,
                flex: isMobile ? 1 : 'none',
                justifyContent: isMobile ? 'center' : 'flex-start',
                transition:'color .15s, border-color .15s',
                fontFamily:'Manrope,sans-serif',
                letterSpacing:'0.01em',
                whiteSpace:'nowrap',
              }}>
              {t.l}
              {t.b!=null&&<span style={{
                background: tab===t.k ? 'rgba(197,163,87,0.18)' : 'rgba(255,255,255,0.05)',
                color: tab===t.k ? DS.gold : DS.sub,
                fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:20,
                letterSpacing:'0.04em',
              }}>{t.b}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero — catalogue tab only ── */}
      {tab==='catalogue'&&(
        <div style={{background:`linear-gradient(180deg, rgba(197,163,87,0.05) 0%, transparent 100%)`,padding:isMobile?'24px 16px 16px':'40px 32px 24px',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
          <div style={{maxWidth:1160,margin:'0 auto'}}>
            {/* Label chip */}
            <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(197,163,87,0.08)',border:'1px solid rgba(197,163,87,0.2)',borderRadius:6,padding:'4px 12px',marginBottom:14}}>
              <span style={{fontSize:9,color:DS.gold,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Manrope,sans-serif'}}>
                {portal.type==='product'?'Product Gifting':'Exclusive Offsite'} · {portal.orderRef}
              </span>
            </div>
            {/* Headline — Noto Serif display */}
            <h1 style={{fontFamily:'Noto Serif,serif',fontSize:isMobile?20:28,fontWeight:700,color:DS.text,marginBottom:10,letterSpacing:'-0.02em',lineHeight:1.2}}>
              {portal.title||`Curated for ${portal.clientName}`}
            </h1>
            {portal.teamNote&&<p style={{color:DS.sub,fontSize:14,lineHeight:1.75,maxWidth:580,fontFamily:'Manrope,sans-serif'}}>{portal.teamNote}</p>}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{maxWidth:1160,margin:'0 auto',padding:isMobile?'16px 12px 80px':'32px 32px 80px'}}>

        {/* CATALOGUE */}
        {tab==='catalogue'&&(
          items.length===0
            ? <EmptyState icon="📋" title="Options being curated" sub="The Marqland team will update this shortly."/>
            : portal.type==='product'
              ? <ProductBento items={items} onZoom={setLightbox} wishlisted={wishlisted} onToggleWish={toggleWish}/>
              : <OffsiteCards items={items} onZoom={setLightbox}/>
        )}

        {/* SELECTED ITEMS */}
        {tab==='selected'&&(()=>{
          const allItems = portal.type==='product' ? portal.productItems : portal.offsiteItems;
          const sel = allItems.filter(i => wishlisted.has(String(i._id)));
          if(!sel.length) return (
            <EmptyState icon="🤍" title="No items shortlisted yet"
              sub="Tap ♡ on any product in Catalogue Options to add it here.">
              <button onClick={()=>setTab('catalogue')} style={{marginTop:24,background:GOLD_GRAD,color:DS.onGold,border:'none',borderRadius:10,padding:'11px 28px',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'Manrope,sans-serif',letterSpacing:'0.02em'}}>
                Browse Catalogue
              </button>
            </EmptyState>
          );
          return (
            <div>
              {/* Summary bar — Status Pillar style */}
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:32,padding:'16px 20px',background:DS.cont,borderRadius:12}}>
                <div style={{width:2,height:24,background:GOLD_GRAD,borderRadius:2,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:DS.gold,fontFamily:'Noto Serif,serif'}}>
                    {sel.length} item{sel.length!==1?'s':''} shortlisted
                  </div>
                  <div style={{fontSize:12,color:DS.sub,marginTop:2}}>Mention these in the message board to share your preferences.</div>
                </div>
              </div>
              {/* Selected items — 3-col bento grid with image + description + price */}
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:14}}>
                {sel.map((item,idx)=>(
                  <GlassCard key={item._id} delay={idx*0.04} style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
                    {/* Image */}
                    <div style={{position:'relative',height:200,flexShrink:0,overflow:'hidden',borderRadius:'12px 12px 0 0',cursor:item.imageUrl?'zoom-in':'default'}}
                      onClick={()=>{ if(item.imageUrl) setLightbox({src:item.imageUrl,alt:item.name}); }}>
                      {item.imageUrl
                        ?<img src={item.imageUrl} alt={item.name} className="img-hover" style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .4s ease'}}/>
                        :<div style={{width:'100%',height:'100%',background:DS.contHi,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',fontSize:11}}>No image</div>
                      }
                      <div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(10,20,34,0.82) 0%,transparent 48%)',pointerEvents:'none'}}/>
                      {/* Badges */}
                      <div style={{position:'absolute',bottom:10,left:10,display:'flex',gap:5,flexWrap:'wrap'}}>
                        {item.category&&<span style={{background:'rgba(197,163,87,0.88)',color:DS.onGold,fontSize:8,fontWeight:800,padding:'3px 7px',borderRadius:4,backdropFilter:'blur(4px)',textTransform:'uppercase',letterSpacing:'0.06em',fontFamily:'Manrope,sans-serif'}}>{item.category}</span>}
                        {item.subCategory&&<span style={{background:'rgba(255,255,255,0.14)',color:'rgba(255,255,255,0.85)',fontSize:8,fontWeight:700,padding:'3px 7px',borderRadius:4,backdropFilter:'blur(4px)',textTransform:'uppercase',fontFamily:'Manrope,sans-serif'}}>{item.subCategory}</span>}
                      </div>
                      {/* Remove heart */}
                      <button onClick={e=>{e.stopPropagation();toggleWish(String(item._id));}}
                        style={{position:'absolute',top:10,right:10,background:'rgba(220,53,69,0.82)',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',backdropFilter:'blur(6px)'}}>
                        {Ic.heart}
                      </button>
                    </div>
                    {/* Info — same layout as catalogue bento card */}
                    <div style={{padding:'14px 16px 16px',background:DS.cont,flex:1,display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
                        <div style={{fontSize:14,fontWeight:700,color:DS.text,lineHeight:1.2,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'Manrope,sans-serif'}}>{item.name}</div>
                        <div style={{fontSize:15,fontWeight:700,color:DS.goldHi,fontFamily:'Noto Serif,serif',flexShrink:0}}>{toINR(item.price)}</div>
                      </div>
                      {item.description&&(
                        <p style={{fontSize:12,color:DS.sub,lineHeight:1.6,margin:0,fontFamily:'Manrope,sans-serif',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.description}</p>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          );
        })()}

        {/* SHIPMENTS TAB — product portals only */}
        {tab==='shipments'&&(()=>{
          const STATUS_CHIP = {
            'Pending':           {bg:'rgba(100,116,139,0.15)', color:'rgba(148,163,184,1)'},
            'Booked':            {bg:'rgba(59,130,246,0.12)',  color:'#93c5fd'},
            'In Transit':        {bg:'rgba(245,158,11,0.12)',  color:'#fcd34d'},
            'Out for Delivery':  {bg:'rgba(249,115,22,0.12)',  color:'#fdba74'},
            'Delivered':         {bg:'rgba(16,185,129,0.12)',  color:'#6ee7b7'},
            'Completed':         {bg:'rgba(16,185,129,0.12)',  color:'#6ee7b7'},
            'Returned':          {bg:'rgba(239,68,68,0.12)',   color:'#fca5a5'},
            'Exception':         {bg:'rgba(239,68,68,0.12)',   color:'#fca5a5'},
          };
          if(!shipmentsLoaded) return (
            <div style={{textAlign:'center',padding:'64px 0'}}>
              <div style={{width:32,height:32,border:`2px solid ${DS.contTop}`,borderTopColor:DS.gold,borderRadius:'50%',animation:'spin .9s linear infinite',margin:'0 auto 16px'}}/>
              <div style={{fontSize:12,color:DS.sub,fontFamily:'Manrope,sans-serif'}}>Loading shipments…</div>
            </div>
          );
          if(shipments.length===0) return (
            <div style={{textAlign:'center',padding:'64px 0',color:DS.sub}}>
              <div style={{fontSize:40,marginBottom:14}}>📦</div>
              <div style={{fontFamily:'Noto Serif,serif',fontSize:18,fontWeight:700,color:DS.text,marginBottom:8}}>No shipments yet</div>
              <div style={{fontSize:13,fontFamily:'Manrope,sans-serif',lineHeight:1.7}}>Shipment details will appear here once your parcels are dispatched.</div>
            </div>
          );
          return (
            <div>
              {/* Summary strip */}
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:28,padding:'16px 20px',background:DS.cont,borderRadius:12,border:`1px solid rgba(255,255,255,0.05)`}}>
                <div style={{width:2,height:24,background:GOLD_GRAD,borderRadius:2,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:DS.gold,fontFamily:'Noto Serif,serif'}}>
                    {shipments.length} shipment{shipments.length!==1?'s':''}
                  </div>
                  <div style={{fontSize:12,color:DS.sub,marginTop:2,fontFamily:'Manrope,sans-serif'}}>
                    {shipments.filter(s=>s.status==='Delivered'||s.status==='Completed').length} delivered
                    {' · '}
                    {shipments.filter(s=>['In Transit','Out for Delivery','Booked'].includes(s.status)).length} in transit
                  </div>
                </div>
              </div>

              {/* Shipment cards */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {shipments.map((s,idx)=>{
                  const chip = STATUS_CHIP[s.status] || STATUS_CHIP['Pending'];
                  const isDelivered = s.status==='Delivered'||s.status==='Completed';
                  return (
                    <GlassCard key={s._id||idx} delay={idx*0.04}
                      style={{padding:isMobile?'16px 18px':'20px 24px',display:'flex',alignItems:isMobile?'flex-start':'center',gap:16,flexDirection:isMobile?'column':'row'}}>

                      {/* Status indicator dot */}
                      <div style={{width:10,height:10,borderRadius:'50%',background:chip.color,boxShadow:`0 0 8px ${chip.color}`,flexShrink:0,marginTop:isMobile?4:0}}/>

                      {/* Recipient */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:15,color:DS.text,fontFamily:'Manrope,sans-serif',marginBottom:2}}>{s.recipientName}</div>
                        <div style={{fontSize:12,color:DS.sub,fontFamily:'Manrope,sans-serif',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          {s.city&&<span>📍 {s.city}{s.state?`, ${s.state}`:''}</span>}
                          {s.phone&&<span>· {s.phone}</span>}
                        </div>
                      </div>

                      {/* Tracking ID + partner */}
                      <div style={{textAlign:isMobile?'left':'center',flexShrink:0}}>
                        {s.trackingId?(
                          <div style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:DS.goldHi,background:'rgba(197,163,87,0.08)',padding:'4px 10px',borderRadius:7,marginBottom:4,display:'inline-block'}}>
                            {s.trackingId}
                          </div>
                        ):(
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginBottom:4,fontFamily:'Manrope,sans-serif'}}>Tracking pending</div>
                        )}
                        {s.shippingPartner&&(
                          <div style={{fontSize:11,color:DS.sub,fontFamily:'Manrope,sans-serif'}}>{s.shippingPartner}</div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div style={{flexShrink:0}}>
                        <span style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.08em',padding:'5px 12px',borderRadius:20,background:chip.bg,color:chip.color,fontFamily:'Manrope,sans-serif'}}>
                          {isDelivered?'✓ ':''}{s.status}
                        </span>
                        {s.lastTrackedAt&&(
                          <div style={{fontSize:9,color:'rgba(255,255,255,0.2)',marginTop:4,textAlign:'center',fontFamily:'Manrope,sans-serif'}}>
                            Updated {new Date(s.lastTrackedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* MESSAGE BOARD */}
        {tab==='chat'&&(
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'220px 1fr',gap:isMobile?12:24,alignItems:'start'}}>

            {/* Left sidebar — hidden on mobile */}
            <div style={{display: isMobile ? 'none' : 'flex',flexDirection:'column',gap:16}}>
              {/* Project info */}
              <div style={{background:DS.cont,borderRadius:12,padding:20}}>
                <div style={{fontSize:9,fontWeight:800,color:DS.sub,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12,fontFamily:'Manrope,sans-serif'}}>Current Project</div>
                <div style={{fontFamily:'Noto Serif,serif',fontWeight:700,fontSize:15,color:DS.text,lineHeight:1.3,marginBottom:4}}>{portal.title||portal.orderRef}</div>
                <div style={{fontSize:12,color:DS.sub,marginBottom:16,fontFamily:'Manrope,sans-serif'}}>{portal.clientName}</div>
                {/* Nav items */}
                {[{l:'Message Board',k:'chat',icon:'💬'},{l:'Catalogue Options',k:'catalogue',icon:'🗂'}].map(it=>(
                  <button key={it.k} onClick={()=>setTab(it.k)}
                    style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:tab===it.k?'rgba(197,163,87,0.1)':'transparent',border:'none',borderRadius:8,cursor:'pointer',color:tab===it.k?DS.gold:DS.sub,fontSize:12,fontWeight:600,textAlign:'left',width:'100%',marginBottom:3,fontFamily:'Manrope,sans-serif',transition:'background .15s'}}>
                    <span>{it.icon}</span>{it.l}
                  </button>
                ))}
              </div>

              {/* Concierge card — metallic gradient CTA per DESIGN.md */}
              <div style={{background:`linear-gradient(135deg, rgba(197,163,87,0.1) 0%, rgba(230,194,115,0.05) 100%)`,border:'1px solid rgba(197,163,87,0.18)',borderRadius:12,padding:18}}>
                <div style={{fontSize:9,fontWeight:800,color:DS.gold,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12,fontFamily:'Manrope,sans-serif'}}>Your Concierge</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,background:GOLD_GRAD,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:DS.onGold,fontWeight:900,fontSize:14,flexShrink:0}}>M</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:DS.text,fontFamily:'Manrope,sans-serif'}}>Marqland Team</div>
                    <div style={{fontSize:11,color:'#4ade80',marginTop:1,fontFamily:'Manrope,sans-serif'}}>● Online · &lt;1 hour response</div>
                  </div>
                </div>
              </div>

              {/* Quick reference items */}
              {items.length>0&&(
                <div>
                  <div style={{fontSize:9,fontWeight:800,color:DS.sub,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:10,fontFamily:'Manrope,sans-serif'}}>Quick Reference</div>
                  {items.slice(0,3).map((it,i)=>(
                    <div key={i} onClick={()=>setTab('catalogue')}
                      style={{display:'flex',alignItems:'center',gap:9,background:DS.cont,borderRadius:10,padding:'8px 10px',marginBottom:6,cursor:'pointer'}}>
                      <div style={{width:32,height:32,borderRadius:7,background:DS.contHi,overflow:'hidden',flexShrink:0}}>
                        {it.imageUrl&&<img src={it.imageUrl} alt={it.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:DS.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:'Manrope,sans-serif'}}>{it.name}</div>
                        <div style={{fontSize:10,color:DS.sub,fontFamily:'Manrope,sans-serif'}}>{portal.type==='product'?toINR(it.price):it.location||'—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat window — elevated surface */}
            <div style={{background:DS.cont,borderRadius:12,display:'flex',flexDirection:'column',minHeight:isMobile?'calc(100vh - 200px)':580}}>
              {/* Chat header */}
              <div style={{padding:'16px 20px',borderBottom:`1px solid rgba(255,255,255,0.05)`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:36,height:36,background:'rgba(197,163,87,0.12)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🏢</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:DS.text,fontFamily:'Manrope,sans-serif'}}>Marqland Team</div>
                  <div style={{fontSize:11,color:'#4ade80',fontFamily:'Manrope,sans-serif'}}>● Typically responds in under an hour</div>
                </div>
              </div>

              {/* Name input if not set */}
              {!nameSet&&(
                <div style={{padding:'10px 18px',background:DS.contHi,borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input value={clientName} onChange={e=>setClientName(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&clientName.trim())setNameSet(true);}}
                      placeholder="Your name so we know who's messaging"
                      style={{flex:1,background:DS.contTop,border:'1px solid rgba(197,163,87,0.2)',borderRadius:8,padding:'8px 13px',color:DS.text,fontSize:13,outline:'none',fontFamily:'Manrope,sans-serif'}}/>
                    <button onClick={()=>{if(clientName.trim())setNameSet(true);}} disabled={!clientName.trim()}
                      style={{background:GOLD_GRAD,border:'none',borderRadius:8,padding:'8px 16px',color:DS.onGold,fontSize:12,fontWeight:700,cursor:'pointer',opacity:clientName.trim()?1:0.4,fontFamily:'Manrope,sans-serif'}}>
                      Set
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{flex:1,overflowY:'auto',padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
                {portal.messages.length===0&&(
                  <div style={{textAlign:'center',padding:'48px 0',color:DS.sub}}>
                    <div style={{fontSize:32,marginBottom:12}}>💬</div>
                    <p style={{fontSize:13,fontFamily:'Manrope,sans-serif'}}>No messages yet. Ask us anything!</p>
                  </div>
                )}
                {portal.messages.map(m=>{
                  const isT=m.sender==='team';
                  return(
                    <div key={m._id} style={{display:'flex',justifyContent:isT?'flex-start':'flex-end',gap:8}}>
                      {isT&&<div style={{width:28,height:28,background:GOLD_GRAD,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:DS.onGold,fontSize:11,fontWeight:800,flexShrink:0,alignSelf:'flex-end',marginBottom:2}}>M</div>}
                      <div style={{maxWidth:'72%'}}>
                        <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.3)',marginBottom:4,textAlign:isT?'left':'right',fontFamily:'Manrope,sans-serif',letterSpacing:'0.02em'}}>{m.senderName} · {fmtT(m.createdAt)}</div>
                        <div style={{
                          background: isT ? DS.contTop : GOLD_GRAD,
                          borderRadius: isT ? '4px 14px 14px 14px' : '14px 14px 4px 14px',
                          padding:'11px 15px',
                        }}>
                          {m.text&&<div style={{fontSize:14,lineHeight:1.65,color: isT ? DS.text : DS.onGold,fontFamily:'Manrope,sans-serif'}}>{m.text}</div>}
                          {(m.attachments||[]).map((a,i)=><AttachChip key={i} att={a} isTeam={isT}/>)}
                        </div>
                      </div>
                      {!isT&&<div style={{width:28,height:28,background:DS.contTop,border:'1px solid rgba(197,163,87,0.2)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:DS.gold,flexShrink:0,alignSelf:'flex-end',marginBottom:2}}>
                        {(clientName||'C').slice(0,2).toUpperCase()}
                      </div>}
                    </div>
                  );
                })}
                <div ref={chatEnd}/>
              </div>

              {/* File strip */}
              <FileStrip files={files} onRemove={i=>setFiles(files.filter((_,idx)=>idx!==i))}/>

              {/* Input — surface-container-lowest per DESIGN.md layering */}
              <div style={{padding:'14px 18px',borderTop:`1px solid rgba(255,255,255,0.05)`}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                  <div style={{flex:1,background:DS.contTop,borderRadius:12,padding:'10px 14px',border:`1px solid rgba(197,163,87,0.15)`}}>
                    <textarea value={msg} onChange={e=>setMsg(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                      placeholder="Message the team… (Enter to send)"
                      rows={2}
                      style={{background:'none',border:'none',outline:'none',color:DS.text,fontSize:14,fontFamily:'Manrope,sans-serif',lineHeight:1.55,width:'100%'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,paddingTop:6,borderTop:`1px solid rgba(255,255,255,0.05)`}}>
                      <button type="button" onClick={()=>fileRef.current?.click()}
                        style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',padding:2,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,fontFamily:'Manrope,sans-serif',transition:'color .15s'}}
                        onMouseEnter={e=>e.currentTarget.style.color=DS.gold}
                        onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
                        {Ic.attach} <span>Attach</span>
                      </button>
                      <span style={{fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:'Manrope,sans-serif'}}>Max 5 files · 10MB each</span>
{/* input moved outside — see root-level input below */}
                    </div>
                  </div>
                  {/* Send — Primary button: metallic gradient CTA per DESIGN.md */}
                  <button onClick={send} disabled={sending||(!msg.trim()&&files.length===0)}
                    style={{
                      width:44,height:44,
                      background: (sending||(!msg.trim()&&files.length===0)) ? DS.contTop : GOLD_GRAD,
                      border:'none',borderRadius:10,cursor:'pointer',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      color: (sending||(!msg.trim()&&files.length===0)) ? 'rgba(255,255,255,0.25)' : DS.onGold,
                      transition:'all .2s',flexShrink:0,
                    }}>
                    {sending
                      ? <div style={{width:15,height:15,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'rgba(255,255,255,0.7)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
                      : Ic.send
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File input at root — avoids display:none breaking programmatic .click() */}
      {/* Root-level file input — opacity:0 keeps it invisible but events still fire */}
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{position:'fixed',top:-200,left:-200,width:1,height:1,opacity:0}}
        onChange={e=>{
          const picked=Array.from(e.target.files||[]);
          if(picked.length>0) setFiles(prev=>[...prev,...picked].slice(0,5));
          e.target.value='';
        }}
      />

      {/* ── Footer — tonal shift ── */}
      <div style={{background:DS.cont,borderTop:`1px solid rgba(255,255,255,0.04)`,padding:isMobile?'16px':'20px 32px',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:9,marginBottom:5}}>
          <div style={{width:16,height:16,background:GOLD_GRAD,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:DS.onGold,fontWeight:900,fontSize:9}}>M</div>
          <span style={{color:DS.sub,fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:'Manrope,sans-serif'}}>Marqland Studios</span>
        </div>
        <p style={{color:'rgba(255,255,255,0.18)',fontSize:10,fontFamily:'Manrope,sans-serif'}}>This is a private proposal. Please do not share this link.</p>
      </div>
    </div>
  );
};

// ── Empty State helper ─────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, sub, children }) => (
  <div style={{textAlign:'center',padding:'80px 0'}}>
    <div style={{fontSize:48,marginBottom:18}}>{icon}</div>
    <h3 style={{fontFamily:'Noto Serif,serif',fontSize:18,fontWeight:700,color:'rgba(240,232,214,0.7)',marginBottom:8}}>{title}</h3>
    <p style={{fontSize:13,color:'rgba(255,255,255,0.3)',fontFamily:'Manrope,sans-serif'}}>{sub}</p>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// BENTO GRID — Product catalogue
// DESIGN.md: dense grid with xl (12px) radii, tonal surface cards, no dividers
// ─────────────────────────────────────────────────────────────────────────────
const ProductBento = ({ items, onZoom, wishlisted=new Set(), onToggleWish=()=>{} }) => {
  const [activeCategory, setActiveCategory] = React.useState(null);
  const [activeSubCat,   setActiveSubCat]   = React.useState(null);
  const [imgSpans,  setImgSpans]  = React.useState({});
  const [hoveredId, setHoveredId] = React.useState(null);
  const isMobile = useMobile();

  const handleImgLoad = (id, e) => {
    const {naturalWidth:w, naturalHeight:h} = e.target;
    const r = w/h;
    setImgSpans(prev=>({...prev,[id]: r>=1.6?'wide': r<=0.68?'tall':'square'}));
  };

  const categories = [...new Set(items.map(i=>i.category).filter(Boolean))];
  const subCats = activeCategory
    ? [...new Set(items.filter(i=>i.category===activeCategory).map(i=>i.subCategory).filter(Boolean))]
    : [];

  const filtered = items.filter(i=>{
    const cOk = !activeCategory || i.category===activeCategory;
    const sOk = !activeSubCat   || i.subCategory===activeSubCat;
    return cOk&&sOk;
  });

  const groupMap = new Map();
  filtered.forEach(item=>{ const c=item.category||'Other'; if(!groupMap.has(c)) groupMap.set(c,[]); groupMap.get(c).push(item); });
  const groups = Array.from(groupMap.entries()).map(([cat,its])=>({cat,items:its}));

  // Chip styles — secondary button style from DESIGN.md (ghost border)
  const chip = active => ({
    padding:'5px 16px', borderRadius:20, border:'none', cursor:'pointer',
    fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
    fontFamily:'Manrope,sans-serif', transition:'all .18s',
    background: active ? GOLD_GRAD : 'transparent',
    color:      active ? DS.onGold  : DS.sub,
    boxShadow:  active ? '0 4px 16px rgba(197,163,87,0.35)' : 'none',
    outline:    active ? 'none' : `1px solid rgba(255,255,255,0.12)`,
  });
  const subChip = active => ({
    ...chip(active), padding:'4px 12px', fontSize:10,
    background: active ? 'rgba(197,163,87,0.15)' : 'transparent',
    color:      active ? DS.gold : DS.sub,
    outline:    `1px solid ${active?'rgba(197,163,87,0.4)':'rgba(255,255,255,0.08)'}`,
  });

  return (
    <div>
      {/* Filter bar — surface-container tonal panel */}
      <div style={{marginBottom:isMobile?16:32,padding:isMobile?'14px 16px':'18px 22px',background:DS.cont,borderRadius:12}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
          <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.12em',marginRight:6,fontFamily:'Manrope,sans-serif'}}>Category</span>
          {categories.map(cat=>(
            <button key={cat} style={chip(activeCategory===cat)}
              onClick={()=>{ if(activeCategory===cat){setActiveCategory(null);setActiveSubCat(null);}else{setActiveCategory(cat);setActiveSubCat(null);} }}>
              {cat}
            </button>
          ))}
        </div>
        {activeCategory&&subCats.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12,paddingTop:12,borderTop:`1px solid rgba(255,255,255,0.05)`,alignItems:'center'}}>
            <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.12em',marginRight:6,fontFamily:'Manrope,sans-serif'}}>Type</span>
            {subCats.map(sc=>(
              <button key={sc} style={subChip(activeSubCat===sc)} onClick={()=>setActiveSubCat(activeSubCat===sc?null:sc)}>{sc}</button>
            ))}
          </div>
        )}
        <div style={{marginTop:10,fontSize:12,color:DS.sub,fontFamily:'Manrope,sans-serif'}}>
          <span style={{fontWeight:700,color:DS.gold}}>{filtered.length}</span>
          {' '}option{filtered.length!==1?'s':''} curated for you
          {activeCategory&&<span style={{color:'rgba(255,255,255,0.25)'}}> in <span style={{color:DS.gold}}>{activeCategory}</span>{activeSubCat?` › ${activeSubCat}`:''}</span>}
        </div>
      </div>

      {/* Category groups */}
      {groups.map((group,gi)=>(
        <div key={group.cat} style={{marginBottom:56}}>
          {/* Category header — Status Pillar style */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:isMobile?14:22}}>
            <div style={{width:2,height:20,background:GOLD_GRAD,borderRadius:2,flexShrink:0}}/>
            <span style={{fontSize:10,fontWeight:800,color:DS.gold,textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:'Manrope,sans-serif'}}>{group.cat}</span>
            <div style={{flex:1,height:1,background:`linear-gradient(90deg, rgba(197,163,87,0.2), transparent)`}}/>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.2)',fontWeight:600,fontFamily:'Manrope,sans-serif'}}>{group.items.length} item{group.items.length!==1?'s':''}</span>
          </div>

          {/* Sub-groups */}
          {(()=>{
            const subMap=new Map();
            group.items.forEach(item=>{ const s=item.subCategory||''; if(!subMap.has(s)) subMap.set(s,[]); subMap.get(s).push(item); });
            const subGroups=Array.from(subMap.entries());
            return subGroups.map(([sub,subItems])=>(
              <div key={sub||'main'} style={{marginBottom:28}}>
                {sub&&subGroups.length>1&&(
                  <div style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,paddingLeft:4,fontFamily:'Manrope,sans-serif'}}>— {sub}</div>
                )}
                {/* BENTO GRID
                     Layout:  3 columns. No fixed row height — cards size to content.
                     Wide images (ratio ≥ 1.6): span 2 cols. Others: 1 col.
                     Every card = image (fills to natural ratio) + info panel below.
                     Info panel: name + price on one line, then full description.
                     Heart always top-left. No category/subcat badges on image. */}
                <div style={{
                  display:'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)',
                  gap: isMobile ? 10 : 16,
                }}>
                  {subItems.map((item,idx)=>{
                    const span  = imgSpans[item._id] || 'square';
                    const loved = wishlisted.has(String(item._id));
                    return (
                      <GlassCard key={item._id} delay={(gi*0.08)+(idx*0.04)} style={{
                        gridColumn: (span==='wide' || isMobile) ? 'span 2' : 'span 1',
                        display:'flex', flexDirection:'column',
                        overflow:'hidden',
                      }}>
                        {/*
                          Single onMouseLeave on the whole card — overlay only closes
                          when the mouse leaves the card entirely, so scrolling inside
                          the overlay never dismisses it.
                        */}
                        <div
                          style={{display:'flex',flexDirection:'column',flex:1,position:'relative'}}
                          onMouseLeave={()=>setHoveredId(null)}
                        >

                          {/* ── Image area (carousel or single) ── */}
                          <div style={{position:'relative',flexShrink:0,overflow:'hidden'}}>

                            {/* Carousel or single image */}
                            {(item.additionalImages || []).length > 0 ? (
                              <ProductCarousel
                                images={item.additionalImages}
                                primaryUrl={item.imageUrl}
                                productName={item.name}
                                onZoom={onZoom}
                              />
                            ) : (
                              <div
                                style={{position:'relative',overflow:'hidden',borderRadius:'12px 12px 0 0',cursor:item.imageUrl?'zoom-in':'default'}}
                                onClick={()=>{ if(item.imageUrl) onZoom({src:item.imageUrl,alt:item.name}); }}
                              >
                                {item.imageUrl
                                  ? <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      style={{width:'100%',display:'block',objectFit:'cover',maxHeight:isMobile?200:(span==='wide'?320:280),minHeight:isMobile?140:180}}
                                      onLoad={e=>handleImgLoad(item._id,e)}
                                    />
                                  : <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',background:DS.contHi,color:'rgba(255,255,255,0.15)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>No image</div>
                                }
                                {/* Zoom hint */}
                                {item.imageUrl&&(
                                  <div style={{position:'absolute',top:10,right:10,background:'rgba(10,20,34,0.6)',color:'rgba(255,255,255,0.45)',borderRadius:6,padding:'4px 7px',display:'flex',alignItems:'center',gap:3,fontSize:9,backdropFilter:'blur(4px)',pointerEvents:'none'}}>
                                    {Ic.zoom}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Heart — always top-left over image/carousel */}
                            <button
                              onClick={e=>{e.stopPropagation();onToggleWish(String(item._id));}}
                              title={loved?'Remove from shortlist':'Add to shortlist'}
                              style={{
                                position:'absolute',top:10,left:10,zIndex:10,
                                background:loved?'rgba(220,53,69,0.9)':'rgba(10,20,34,0.6)',
                                border:`1px solid ${loved?'rgba(220,53,69,0.5)':'rgba(255,255,255,0.2)'}`,
                                borderRadius:8,width:32,height:32,
                                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                                color:loved?'#fff':'rgba(255,255,255,0.6)',
                                backdropFilter:'blur(8px)',transition:'all .2s',
                              }}>
                              {loved?Ic.heart:Ic.heartO}
                            </button>

                            {/* Description overlay — absolutely positioned over the image.
                                Slides up when hoveredId matches. Stays open while mouse
                                is anywhere inside the card (onMouseLeave is on the card). */}
                            {item.description&&(
                              <div
                                onClick={e=>e.stopPropagation()}
                                style={{
                                  position:'absolute',bottom:0,left:0,right:0,
                                  maxHeight:'75%',
                                  background:'rgba(10,20,34,0.95)',
                                  backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',
                                  overflowY: hoveredId===item._id ? 'auto' : 'hidden',
                                  transform: hoveredId===item._id ? 'translateY(0)' : 'translateY(100%)',
                                  transition:'transform .32s cubic-bezier(.4,0,.2,1)',
                                  pointerEvents: hoveredId===item._id ? 'auto' : 'none',
                                  cursor:'default',
                                  borderTop:'1px solid rgba(197,163,87,0.2)',
                                  zIndex:8,
                                }}
                                className="desc-scroll"
                              >
                                <div style={{position:'sticky',top:0,left:0,right:0,height:2,background:GOLD_GRAD,flexShrink:0}}/>
                                <div style={{padding:'12px 14px 16px'}}>
                                  <p style={{fontSize:12.5,color:'rgba(240,232,214,0.92)',lineHeight:1.7,margin:0,fontFamily:'Manrope,sans-serif',fontWeight:400,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{item.description}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── Info panel ── */}
                          <div style={{padding:isMobile?'10px 12px 12px':'14px 16px 16px',background:DS.cont,flex:1,display:'flex',flexDirection:'column',gap:8}}>

                            {/* Row 1: Name + Price */}
                            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
                              <div style={{fontSize:isMobile?12:14,fontWeight:700,color:DS.text,lineHeight:1.2,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'Manrope,sans-serif'}}>
                                {item.name}
                              </div>
                              <div style={{fontSize:isMobile?13:15,fontWeight:700,color:DS.goldHi,fontFamily:'Noto Serif,serif',flexShrink:0}}>
                                {toINR(item.price)}
                              </div>
                            </div>

                            {/* Row 2: Description — 3 lines, hover to open overlay over image */}
                            {item.description&&(
                              <p
                                onMouseEnter={()=>setHoveredId(item._id)}
                                style={{
                                  fontSize:12,lineHeight:1.6,margin:0,
                                  fontFamily:'Manrope,sans-serif',
                                  display:'-webkit-box',
                                  WebkitLineClamp:3,
                                  WebkitBoxOrient:'vertical',
                                  overflow:'hidden',
                                  cursor:'default',
                                  color: hoveredId===item._id ? DS.gold : DS.sub,
                                  transition:'color .15s',
                                }}
                              >{item.description}</p>
                            )}

                            {/* ── Video embed (YouTube or direct link) ── */}
                            {item.videoUrl && getYouTubeId(item.videoUrl) && (
                              <div style={{marginTop:4}}>
                                <div style={{fontSize:9,fontWeight:800,color:DS.sub,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6,fontFamily:'Manrope,sans-serif'}}>🎬 Product Video</div>
                                <YouTubeEmbed url={item.videoUrl} title={item.name}/>
                              </div>
                            )}
                            {item.videoUrl && !getYouTubeId(item.videoUrl) && (
                              <a
                                href={item.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display:'inline-flex',alignItems:'center',gap:6,marginTop:4,
                                  padding:'7px 12px',borderRadius:8,textDecoration:'none',
                                  background:'rgba(197,163,87,0.07)',border:'1px solid rgba(197,163,87,0.18)',
                                  fontSize:11,fontWeight:700,color:DS.gold,fontFamily:'Manrope,sans-serif',
                                }}
                              >
                                {Ic.play} Watch Brand Video
                              </a>
                            )}
                          </div>

                        </div>{/* end card onMouseLeave wrapper */}
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      ))}

      {filtered.length===0&&<EmptyState icon="🔍" title="No items found" sub="Try selecting a different category"/>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OFFSITE CARDS — property options
// Night Stay : side-by-side image + info, fixed 260px height, prices inside
// Day Outing : same layout but info panel height is natural (no clamp),
//              full description shown, packages expand in full-width section below
// ─────────────────────────────────────────────────────────────────────────────
const OffsiteCards = ({ items, onZoom }) => {
  const isMobile = useMobile();
  const [typeFilter, setTypeFilter] = React.useState('all');

  const hasDay   = items.some(i => i.type !== 'Night Stay');
  const hasNight = items.some(i => i.type === 'Night Stay');
  const hasBoth  = hasDay && hasNight;

  const visible = typeFilter === 'all' ? items
    : typeFilter === 'day'   ? items.filter(i => i.type !== 'Night Stay')
    : items.filter(i => i.type === 'Night Stay');

  return (
  <div>
    {/* Type filter — only shown when both types are present */}
    {hasBoth&&(
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20,padding:'12px 16px',background:DS.cont,borderRadius:12,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:800,color:DS.sub,textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:'Manrope,sans-serif',marginRight:4}}>Filter</span>
        {[
          {k:'all',   l:`All (${items.length})`},
          {k:'day',   l:`☀️ Day Outing (${items.filter(i=>i.type!=='Night Stay').length})`},
          {k:'night', l:`🌙 Night Stay (${items.filter(i=>i.type==='Night Stay').length})`},
        ].map(opt=>(
          <button key={opt.k} onClick={()=>setTypeFilter(opt.k)}
            style={{
              padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',
              fontSize:11,fontWeight:700,fontFamily:'Manrope,sans-serif',transition:'all .18s',
              background: typeFilter===opt.k ? GOLD_GRAD : 'transparent',
              color:      typeFilter===opt.k ? DS.onGold  : DS.sub,
              boxShadow:  typeFilter===opt.k ? '0 4px 16px rgba(197,163,87,0.3)' : 'none',
              outline:    typeFilter===opt.k ? 'none' : '1px solid rgba(255,255,255,0.12)',
            }}>
            {opt.l}
          </button>
        ))}
      </div>
    )}
    <p style={{fontSize:12,color:DS.sub,marginBottom:20,fontWeight:600,fontFamily:'Manrope,sans-serif'}}>{visible.length} propert{visible.length!==1?'ies':'y'} selected for you</p>
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {visible.map((item,idx)=>{
        const isDayOut   = item.type !== 'Night Stay';
        const hasPackages = isDayOut && item.dayPackages?.length > 0;
        return (
        <GlassCard key={item._id} delay={idx*0.08} style={{borderRadius:12}}>
          {/* Top section: image (fixed 260px) + info side by side */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'280px 1fr',minHeight:isMobile?'auto':260,borderRadius:'12px 12px 0 0',overflow:'hidden'}}>
            {/* Image */}
            <div style={{position:'relative',height:isMobile?220:260,cursor:item.imageUrl?'zoom-in':'default',overflow:'hidden',flexShrink:0}}
              onClick={()=>{ if(item.imageUrl) onZoom({src:item.imageUrl,alt:item.name}); }}>
              {item.imageUrl
                ?<img src={item.imageUrl} alt={item.name} className="img-hover" style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .5s ease'}}/>
                :<div style={{width:'100%',height:'100%',background:DS.contHi,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',fontSize:12}}>No image</div>
              }
              <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(0,0,0,0.3) 0%,transparent 55%)',pointerEvents:'none'}}/>
              <div style={{position:'absolute',top:14,left:14,background:'rgba(10,20,34,0.75)',color:'rgba(255,255,255,0.5)',fontSize:9,fontWeight:800,padding:'4px 10px',borderRadius:6,backdropFilter:'blur(6px)',fontFamily:'Manrope,sans-serif',letterSpacing:'0.06em'}}>Option {idx+1}</div>
              <div style={{position:'absolute',bottom:14,left:14,background:isDayOut?'rgba(180,83,9,0.82)':'rgba(29,78,216,0.82)',color:'#fff',fontSize:9,fontWeight:700,padding:'4px 10px',borderRadius:6,backdropFilter:'blur(4px)',fontFamily:'Manrope,sans-serif'}}>
                {isDayOut?'☀️ Day Outing':'🌙 Night Stay'}
              </div>
            </div>
            {/* Info panel */}
            <div style={{padding:isMobile?'16px 18px':'22px 26px',display:'flex',flexDirection:'column',justifyContent:'space-between',background:DS.contHi,overflow:'hidden'}}>
              <div>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                  <div>
                    <h3 style={{fontFamily:'Noto Serif,serif',fontSize:isMobile?17:20,fontWeight:700,color:DS.text,marginBottom:5,lineHeight:1.2}}>{item.name}</h3>
                    <div style={{display:'flex',alignItems:'center',gap:5,color:DS.sub,fontSize:13,fontFamily:'Manrope,sans-serif'}}>
                      <span style={{color:DS.gold}}>{Ic.pin}</span>{item.location||'Location TBD'}
                    </div>
                  </div>
                  {item.website&&(
                    <a href={item.website.startsWith('http')?item.website:`https://${item.website}`} target="_blank" rel="noreferrer"
                      style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:DS.gold,fontWeight:600,textDecoration:'none',background:'rgba(197,163,87,0.08)',padding:'6px 12px',borderRadius:8,whiteSpace:'nowrap',border:'1px solid rgba(197,163,87,0.2)',flexShrink:0,fontFamily:'Manrope,sans-serif'}}>
                      {Ic.ext} Visit
                    </a>
                  )}
                </div>
                {/* Details — AI-structured via SmartDescription */}
                {item.details&&(
                  <SmartDescription text={item.details} itemId={String(item._id||idx)}/>
                )}
              </div>
              {/* Night Stay prices */}
              {!isDayOut&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
                  {item.singlePrice>0&&<PBox label="Single" value={item.singlePrice} sub="per night"/>}
                  {item.doublePrice>0&&<PBox label="Double" value={item.doublePrice} sub="per night"/>}
                  {item.triplePrice>0&&<PBox label="Triple" value={item.triplePrice} sub="per night"/>}
                  {item.quadPrice>0&&<PBox label="Quad" value={item.quadPrice} sub="per night"/>}
                  {item.djCost>0&&<PBox label="DJ" value={item.djCost} amber/>}
                  {item.licenseFeeDJ>0&&<PBox label="DJ Licence" value={item.licenseFeeDJ} amber/>}
                  {item.cocktailSnacks>0&&<PBox label="Cocktails" value={item.cocktailSnacks} amber/>}
                  {item.banquetHall>0&&<PBox label="Banquet" value={item.banquetHall} amber/>}
                  {(item.adhocAddons||[]).filter(a=>a.sellingPrice>0).map((a,ai)=>(
                    <PBox key={ai} label={a.name} value={a.sellingPrice} amber/>
                  ))}
                </div>
              )}
              {/* Day Outing: show flat price only if no packages */}
              {isDayOut&&!hasPackages&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
                  {item.packagePrice>0&&<PBox label="Day package" value={item.packagePrice} sub="per person"/>}
                  {item.djCost>0&&<PBox label="DJ" value={item.djCost} amber/>}
                  {item.licenseFeeDJ>0&&<PBox label="DJ Licence" value={item.licenseFeeDJ} amber/>}
                  {item.cocktailSnacks>0&&<PBox label="Cocktails" value={item.cocktailSnacks} amber/>}
                  {item.banquetHall>0&&<PBox label="Banquet" value={item.banquetHall} amber/>}
                  {(item.adhocAddons||[]).filter(a=>a.sellingPrice>0).map((a,ai)=>(
                    <PBox key={ai} label={a.name} value={a.sellingPrice} amber/>
                  ))}
                </div>
              )}
              {/* Day Outing with packages: show add-ons only (packages shown below) */}
              {isDayOut&&hasPackages&&(item.djCost>0||item.licenseFeeDJ>0||item.cocktailSnacks>0||item.banquetHall>0||(item.adhocAddons||[]).length>0)&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
                  {item.djCost>0&&<PBox label="DJ" value={item.djCost} amber/>}
                  {item.licenseFeeDJ>0&&<PBox label="DJ Licence" value={item.licenseFeeDJ} amber/>}
                  {item.cocktailSnacks>0&&<PBox label="Cocktails" value={item.cocktailSnacks} amber/>}
                  {item.banquetHall>0&&<PBox label="Banquet" value={item.banquetHall} amber/>}
                  {(item.adhocAddons||[]).filter(a=>a.sellingPrice>0).map((a,ai)=>(
                    <PBox key={ai} label={a.name} value={a.sellingPrice} amber/>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Day Packages — full-width section below, expands freely ── */}
          {hasPackages&&(
            <div style={{padding:'20px 24px 24px',background:DS.cont,borderTop:`1px solid rgba(255,255,255,0.05)`}}>
              <div style={{fontSize:9,fontWeight:800,color:'#f59e0b',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14,fontFamily:'Manrope,sans-serif'}}>
                ☀️ Day Packages — {item.dayPackages.length} option{item.dayPackages.length!==1?'s':''}
              </div>
              <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?200:260}px,1fr))`,gap:12}}>
                {item.dayPackages.map((pkg,pi)=>(
                  <div key={pi} style={{background:DS.contTop,border:'1px solid rgba(245,158,11,0.18)',borderRadius:12,padding:'16px 18px',display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                      <div style={{fontWeight:700,fontSize:14,color:DS.text,lineHeight:1.2,flex:1,fontFamily:'Manrope,sans-serif'}}>{pkg.name||`Package ${pi+1}`}</div>
                      {pkg.sellingPrice>0&&(
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:18,fontWeight:700,color:'#fbbf24',fontFamily:'Noto Serif,serif',lineHeight:1}}>₹{Number(pkg.sellingPrice).toLocaleString('en-IN')}</div>
                          <div style={{fontSize:9,color:'#f59e0b',fontWeight:600,marginTop:3,fontFamily:'Manrope,sans-serif'}}>per person</div>
                        </div>
                      )}
                    </div>
                    {pkg.activities&&(
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {pkg.activities.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).map((line,li)=>(
                          <div key={li} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:DS.sub,lineHeight:1.5,fontFamily:'Manrope,sans-serif'}}>
                            <span style={{color:'#f59e0b',flexShrink:0,fontSize:11,marginTop:1}}>✓</span>
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {item.note&&(
                <div style={{marginTop:14,background:'rgba(197,163,87,0.06)',border:'1px solid rgba(197,163,87,0.14)',borderRadius:8,padding:'10px 14px',fontSize:12,color:DS.gold,fontStyle:'italic',fontFamily:'Manrope,sans-serif'}}>
                  💡 {item.note}
                </div>
              )}
            </div>
          )}

          {/* Night Stay note */}
          {!isDayOut&&item.note&&(
            <div style={{padding:'0 24px 18px',background:DS.cont}}>
              <div style={{background:'rgba(197,163,87,0.06)',border:'1px solid rgba(197,163,87,0.14)',borderRadius:8,padding:'10px 14px',fontSize:12,color:DS.gold,fontStyle:'italic',fontFamily:'Manrope,sans-serif'}}>💡 {item.note}</div>
            </div>
          )}

          {/* YouTube video embed */}
          {item.youtubeUrl&&getYouTubeId(item.youtubeUrl)&&(
            <div style={{padding:'0 24px 20px',background:DS.cont}}>
              <div style={{fontSize:9,fontWeight:800,color:DS.sub,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,fontFamily:'Manrope,sans-serif'}}>🎬 Property Video</div>
              <YouTubeEmbed url={item.youtubeUrl} title={item.name}/>
            </div>
          )}

          {/* Property attachments */}
          {(item.attachments||[]).length>0&&(
            <div style={{padding:'0 24px 20px',background:DS.cont}}>
              <div style={{fontSize:9,fontWeight:800,color:DS.sub,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,fontFamily:'Manrope,sans-serif'}}>📎 Documents & Files</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {item.attachments.map((att,ai)=><PropAttachChip key={ai} att={att}/>)}
              </div>
            </div>
          )}
        </GlassCard>
        );
      })}
    </div>
  </div>
  );
};

export default ClientPortalView;