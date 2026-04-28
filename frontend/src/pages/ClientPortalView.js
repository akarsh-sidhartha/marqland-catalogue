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
  base:    '#faf8f5',
  cont:    '#ffffff',
  contHi:  '#f2efe9',
  contTop: '#e8e4dd',
  bright:  '#d4cfc6',
  gold:    '#b8975a',
  goldHi:  '#d4b06a',
  onGold:  '#0e1520',
  outline: 'rgba(0,0,0,0.08)',
  muted:   'rgba(0,0,0,0.35)',
  text:    '#1a1a1a',
  sub:     'rgba(26,26,26,0.55)',
  navy:    '#0e1520',
};

const GOLD_GRAD = 'linear-gradient(135deg, #d4b06a, #b8975a)';
const GLASS_BG  = '#ffffff';

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

// ── Lightbox — supports single image OR gallery navigation ───────────────────
// Call with: setLightbox({ src, alt })              → single image
// Call with: setLightbox({ src, alt, all, idx })    → gallery with prev/next
const Lightbox = ({ src, alt, all, startIdx, onClose }) => {
  const gallery = all && all.length > 1 ? all : null;
  const [cur, setCur] = React.useState(startIdx || 0);
  const imgs   = gallery || [src];
  const curSrc = gallery ? imgs[cur] : src;

  const prev = (e) => { e.stopPropagation(); setCur(i => (i - 1 + imgs.length) % imgs.length); };
  const next = (e) => { e.stopPropagation(); setCur(i => (i + 1) % imgs.length); };

  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft'  && gallery) setCur(i => (i - 1 + imgs.length) % imgs.length);
      if (e.key === 'ArrowRight' && gallery) setCur(i => (i + 1) % imgs.length);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose, gallery]);

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(5,8,16,0.96)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24,backdropFilter:'blur(24px)'}}>
      {/* Close */}
      <button onClick={onClose} style={{position:'fixed',top:26,right:26,background:'none',border:'none',width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,0.32)',zIndex:10000}}>
        {Ic.close}
      </button>

      {/* Prev arrow */}
      {gallery && (
        <button onClick={prev} style={{position:'fixed',left:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',padding:16,cursor:'pointer',color:'rgba(255,255,255,0.22)',zIndex:10000}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}

      {/* Image */}
      <img src={curSrc} alt={alt} onClick={e=>e.stopPropagation()}
        style={{maxWidth:'82vw',maxHeight:'86vh',borderRadius:16,objectFit:'contain',boxShadow:'0 40px 80px rgba(0,0,0,0.4)',transition:'opacity 0.2s ease'}}/>

      {/* Next arrow */}
      {gallery && (
        <button onClick={next} style={{position:'fixed',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',padding:16,cursor:'pointer',color:'rgba(255,255,255,0.22)',zIndex:10000}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}

      {/* Counter */}
      {gallery && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'rgba(10,20,34,0.8)',color:'rgba(255,255,255,0.5)',borderRadius:20,padding:'5px 16px',fontSize:12,fontWeight:700,backdropFilter:'blur(8px)',fontFamily:"'Jost',sans-serif",zIndex:10000}}>
          {cur + 1} / {imgs.length}
        </div>
      )}

      {/* Thumbnail strip */}
      {gallery && imgs.length > 1 && (
        <div onClick={e=>e.stopPropagation()} style={{position:'fixed',bottom:60,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6,padding:'6px 10px',background:'rgba(10,20,34,0.8)',borderRadius:10,backdropFilter:'blur(8px)',zIndex:10000,maxWidth:'80vw',overflowX:'auto'}}>
          {imgs.map((src,i) => (
            <div key={i} onClick={()=>setCur(i)} style={{width:44,height:44,borderRadius:6,overflow:'hidden',flexShrink:0,border:`2px solid ${i===cur?'#b8975a':'transparent'}`,cursor:'pointer',transition:'border-color .2s'}}>
              <img src={src} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
            </div>
          ))}
        </div>
      )}
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
      <span style={{color:'#b8975a'}}>{Ic.file}</span>
      <span style={{fontSize:11,fontWeight:600,color:'#888',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{att.name}</span>
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
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,background:'#f3f0ec',border:'1px solid rgba(0,0,0,0.07)',borderRadius:4,padding:'4px 10px'}}>
          <span style={{color:'#b8975a',display:'flex'}}>{Ic.file}</span>
          <span style={{fontSize:11,color:'#888',maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
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
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 4,
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease',
      animation: `obsidianFadeIn .5s ease ${delay}s both`,
      ...style,
    }}
      onMouseEnter={e=>{
        e.currentTarget.style.transform='translateY(-3px)';
        e.currentTarget.style.boxShadow='0 20px 60px rgba(0,0,0,0.09)';
        onHover?.('enter');
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.transform='none';
        e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.05)';
        onHover?.('leave');
      }}>
      {children}
    </div>
  );
};

// ── Price Box — uses tonal layering per DESIGN.md ─────────────────────────────
const PBox = ({ label, value, sub, amber }) => (
  <div style={{
    background: amber ? 'rgba(184,151,90,0.08)' : '#ffffff',
    border: `1px solid ${amber ? 'rgba(184,151,90,0.2)' : 'rgba(255,255,255,0.06)'}`,
    borderRadius: 10, padding: '10px 14px', textAlign: 'center',
  }}>
    <div style={{fontSize:9,color:amber?'#b8975a':'rgba(255,255,255,0.4)',fontWeight:700,fontFamily:"'Jost',sans-serif",textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>{label}</div>
    <div style={{fontSize:16,fontWeight:700,color:amber?'#d4b06a':'#1a1a1a',fontFamily:"'Jost',sans-serif"}}>{toINR(value)}</div>
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
    <div style={{borderRadius:10,overflow:'hidden',background:'#faf8f5',border:`1px solid rgba(255,255,255,0.08)`,marginTop:12}}>
      {!show ? (
        <div style={{position:'relative',cursor:'pointer',aspectRatio:'16/9'}} onClick={()=>setShow(true)}>
          <img src={thumb} alt={title||'Video'} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
          <div style={{position:'absolute',inset:0,background:'rgba(5,10,20,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:54,height:54,background:'rgba(184,151,90,0.92)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 32px rgba(184,151,90,0.4)',transition:'transform .2s'}}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <span style={{color:'#0e1520',marginLeft:3}}>{Ic.play}</span>
            </div>
          </div>
          <div style={{position:'absolute',bottom:10,left:12,fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)',fontFamily:"'Jost',sans-serif",textShadow:'0 1px 4px rgba(0,0,0,0.7)',maxWidth:'70%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title||'Watch Video'}</div>
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
        onClick={() => onZoom({ src: all[idx], alt: productName, all, startIdx: idx })}
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
      <button onClick={prev} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1a1a1a', zIndex: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button onClick={next} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1a1a1a', zIndex: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      {/* Counter badge */}
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.92)', color: 'rgba(26,26,26,0.55)', borderRadius: 2, padding: '3px 8px', fontSize: 9, fontWeight: 400, fontFamily: "'Jost',sans-serif", letterSpacing:'0.12em', zIndex: 3 }}>
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
              background: i === idx ? '#b8975a' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer', padding: 0,
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Thumbnail strip — bottom of card, visible when many images */}
      {all.length > 3 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: '#fff', borderTop:'1px solid rgba(0,0,0,0.07)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {all.map((src, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: 38, height: 38, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${i === idx ? '#b8975a' : 'transparent'}`,
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
      style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',background:'rgba(184,151,90,0.07)',border:'1px solid rgba(184,151,90,0.2)',borderRadius:8,textDecoration:'none',cursor:'pointer',transition:'background .15s'}}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(184,151,90,0.13)'}
      onMouseLeave={e=>e.currentTarget.style.background='rgba(184,151,90,0.07)'}>
      <span style={{color:'#b8975a'}}>{Ic.file}</span>
      <span style={{fontSize:11,fontWeight:600,color:'#1a1a1a',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{att.name}</span>
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
    return <p style={{fontSize:12,color:'#888888',lineHeight:1.65,fontFamily:"'Jost',sans-serif"}}>{text}</p>;
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
        <p style={{fontSize:12,color:'#888888',lineHeight:1.75,fontFamily:"'Jost',sans-serif",whiteSpace:'pre-line'}}>
          {(expanded||lines.length<=3) ? text : lines.slice(0,3).join('\n')+'…'}
        </p>
        {lines.length>3&&(
          <button onClick={()=>setExpanded(e=>!e)}
            style={{marginTop:5,fontSize:11,color:'#b8975a',fontWeight:700,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:"'Jost',sans-serif"}}>
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
          <div style={{fontSize:9,fontWeight:800,color:'#b8975a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6,fontFamily:"'Jost',sans-serif",display:'flex',alignItems:'center',gap:5}}>
            <span>{SECTION_ICONS[sec.type]||'ℹ️'}</span>{sec.title}
          </div>
          {(sec.points||[]).map((pt,pi)=>(
            <div key={pi} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:'#888888',lineHeight:1.55,marginBottom:3,fontFamily:"'Jost',sans-serif"}}>
              <span style={{color:'#b8975a',flexShrink:0,fontSize:10,marginTop:2}}>›</span>
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
        background:'#f3f0ec',
        border:`1px solid rgba(184,151,90,0.3)`,
        borderRadius:12, padding:'14px 18px',
        boxShadow:'0 16px 40px rgba(0,0,0,0.4)',
        animation:'toastSlide .35s cubic-bezier(.34,1.56,.64,1)',
        minWidth:260,maxWidth:340,pointerEvents:'all',
        backdropFilter:'blur(20px)',
      }}>
        <div style={{width:32,height:32,background:'rgba(184,151,90,0.12)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15}}>{t.icon||'💬'}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,fontWeight:700,color:'#b8975a',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:"'Jost',sans-serif"}}>{t.title}</div>
          <div style={{fontSize:13,color:'#1a1a1a',lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Jost',sans-serif"}}>{t.body}</div>
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

// ── Empty State helper ────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, sub, children }) => (
  <div style={{textAlign:'center',padding:'80px 0'}}>
    <div style={{fontSize:48,marginBottom:18}}>{icon}</div>
    <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:22,fontWeight:300,color:'#1a1a1a',marginBottom:10,lineHeight:1.2}}>{title}</h3>
    <p style={{fontSize:13,color:'#888',fontFamily:"'Jost',sans-serif",fontWeight:300,letterSpacing:'0.06em'}}>{sub}</p>
    {children}
  </div>
);

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
  const [shipFilter, setShipFilter]  = useState('all');
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

  const toggleWish = id => {
    setWishlisted(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      // Persist to DB so shortlist survives page refresh
      const ids = Array.from(s);
      fetch(`/api/portal/public/${slug}/shortlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(() => {}); // fire and forget — don't block UI
      return s;
    });
  };

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
      // Restore shortlist from DB on first load (not on silent polls).
      // Always sync — even an empty array should clear a stale local state.
      if (!silent) {
        setWishlisted(new Set(data.shortlistedIds || []));
      }
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
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
    @keyframes obsidianFadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes toastSlide{from{opacity:0;transform:translateX(20px) scale(0.95)}to{opacity:1;transform:none}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    *{box-sizing:border-box;margin:0}
    body{background:#faf8f5}
    ::-webkit-scrollbar{width:3px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(184,151,90,0.35);border-radius:10px}
    .desc-scroll::-webkit-scrollbar{width:4px}
    .desc-scroll::-webkit-scrollbar-track{background:rgba(0,0,0,0.04)}
    .desc-scroll::-webkit-scrollbar-thumb{background:rgba(184,151,90,0.5);border-radius:10px}
    .desc-scroll{scrollbar-width:thin;scrollbar-color:rgba(184,151,90,0.5) rgba(0,0,0,0.04)}
    textarea{resize:none}
    .img-hover:hover{transform:scale(1.04)!important}
    .ghost-btn:hover{background:rgba(0,0,0,0.04)!important}
    .ms-pill{display:inline-block;padding:5px 18px;border:1px solid rgba(184,151,90,0.4);font-size:9px;font-weight:400;letter-spacing:0.25em;text-transform:uppercase;color:#b8975a;font-family:'Jost',sans-serif}
    .ms-lbl{font-size:9px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;color:rgba(26,26,26,0.4);font-family:'Jost',sans-serif}
    .cp-card{background:#fff;border:1px solid rgba(0,0,0,0.07);overflow:hidden;transition:transform 0.5s cubic-bezier(0.16,1,0.3,1),box-shadow 0.5s,border-color 0.3s}
    .cp-card:hover{transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,0.08);border-color:rgba(184,151,90,0.25)}
    .cp-btn-gold{display:inline-flex;align-items:center;gap:8px;background:#b8975a;color:#0e1520;padding:13px 32px;border:none;cursor:pointer;font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:0.25em;text-transform:uppercase;transition:background 0.3s,transform 0.2s;text-decoration:none}
    .cp-btn-gold:hover{background:#d4b06a;transform:translateY(-1px)}
    .cp-pill{display:inline-block;padding:4px 16px;border:1px solid rgba(184,151,90,0.45);font-size:9px;font-weight:400;letter-spacing:0.28em;text-transform:uppercase;color:#b8975a;font-family:'Jost',sans-serif}
    .cp-divider{width:36px;height:1px;background:#b8975a;display:inline-block;flex-shrink:0}
    .cp-wish-btn{transition:transform 0.2s,background 0.2s}
    .cp-wish-btn:hover{transform:scale(1.1)}
    .ms-grain{position:relative}
    .ms-grain::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");background-size:200px}
    .ms-card{overflow:hidden;cursor:pointer;position:relative;transition:transform 0.6s cubic-bezier(0.16,1,0.3,1);border:1px solid rgba(0,0,0,0.07)}
    .ms-card:hover{transform:translateY(-3px);box-shadow:0 20px 60px rgba(0,0,0,0.09)}
    .ms-tab-active{border-bottom:2px solid #b8975a !important;color:#b8975a !important}
    .ms-tab-idle{border-bottom:2px solid transparent !important;color:rgba(26,26,26,0.45)}
    .ms-tab-idle:hover{color:#1a1a1a}
  `;

  // ── Loading ───────────────────────────────────────────────────────────────
  if(loading) return (
    <div style={{minHeight:'100vh',background:'#0e1520',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Jost',sans-serif"}}>
      <style>{globalStyles}</style>
      <div style={{textAlign:'center'}}>
        <div style={{width:36,height:36,border:'2px solid rgba(255,255,255,0.1)',borderTopColor:'#b8975a',borderRadius:'50%',animation:'spin .9s linear infinite',margin:'0 auto 20px'}}/>
        <span className="cp-lbl" style={{color:'#b8975a',letterSpacing:'0.35em',opacity:0.6}}>LOADING</span>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if(error) return (
    <div style={{minHeight:'100vh',background:'#faf8f5',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Jost',sans-serif",padding:24}}>
      <style>{globalStyles}</style>
      <div style={{textAlign:'center',maxWidth:400}}>
        <div style={{fontSize:48,marginBottom:20}}>⛓</div>
        <h1 className="cp-sf" style={{fontSize:32,fontWeight:300,color:'#1a1a1a',marginBottom:12,lineHeight:1.1}}>Link unavailable</h1>
        <p style={{color:'#888888',fontSize:14,lineHeight:1.7}}>{error}</p>
      </div>
    </div>
  );

  // ── Completed ─────────────────────────────────────────────────────────────
  if(portal.status==='completed') return (
    <div style={{minHeight:'100vh',background:'#faf8f5',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Jost',sans-serif",padding:24}}>
      <style>{globalStyles}</style>
      <div style={{textAlign:'center',maxWidth:520}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(184,151,90,0.08)',border:'1px solid rgba(184,151,90,0.2)',borderRadius:8,padding:'7px 16px',marginBottom:40}}>
          <div style={{width:20,height:20,background:GOLD_GRAD,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',color:'#0e1520',fontWeight:900,fontSize:10}}>M</div>
          <span style={{color:'#b8975a',fontWeight:700,fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'Jost',sans-serif"}}>Marqland Studios</span>
        </div>
        <div style={{fontSize:64,marginBottom:24}}>🎉</div>
        <h1 className="cp-sf" style={{fontSize:'clamp(28px,5vw,52px)',fontWeight:300,color:'#1a1a1a',marginBottom:16,lineHeight:1.05}}>Thank you, <em style={{color:'#b8975a'}}>{portal.clientName}.</em></h1>
        <p style={{color:'#888888',fontSize:15,lineHeight:1.8,marginBottom:40}}>It was our pleasure working with you. We hope the experience exceeded expectations.</p>
        {portal.reviewLink&&<a href={portal.reviewLink} target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',gap:10,background:GOLD_GRAD,color:'#0e1520',padding:'14px 30px',borderRadius:10,textDecoration:'none',fontWeight:700,fontSize:14,fontFamily:"'Jost',sans-serif"}}>
          {Ic.star} Share your experience
        </a>}
        <p style={{color:'rgba(255,255,255,0.2)',fontSize:11,marginTop:44,fontFamily:"'Jost',sans-serif",letterSpacing:'0.06em'}}>REF · {portal.orderRef}</p>
      </div>
    </div>
  );

  const items   = portal.type==='product' ? portal.productItems : portal.offsiteItems;
  const newMsgs = portal.messages?.filter(m=>m.sender==='team').length||0;

  return (
    <div style={{minHeight:'100vh',background:'#faf8f5',fontFamily:"'Jost',sans-serif",color:'#1a1a1a'}}>
      <style>{globalStyles}</style>

      {lightbox&&<Lightbox src={lightbox.src} alt={lightbox.alt} all={lightbox.all} startIdx={lightbox.startIdx} onClose={()=>setLightbox(null)}/>}
      <Toast toasts={toasts}/>

      {/* ── Nav — HomePage navy bar ── */}
      <nav className="ms-grain" style={{
        position:'sticky',top:0,zIndex:50,
        background:'rgba(14,21,32,0.96)',
        backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,0.05)',
        padding: isMobile ? '0 20px' : '0 48px',
        height:68,display:'flex',alignItems:'center',
      }}>
        <div style={{width:'100%',maxWidth:1400,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span className="cp-sf" style={{color:'white',fontSize:20,fontWeight:300,letterSpacing:'0.05em'}}>
            Marqland Studios
          </span>
          <div style={{display:'flex',alignItems:'center',gap:isMobile?10:20}}>
            <span className="ms-pill">{portal.status==='active'?'Active':'Completed'}</span>
            {!isMobile&&<span style={{color:'rgba(255,255,255,0.2)',fontSize:10,fontFamily:"'Jost',sans-serif",letterSpacing:'0.2em',textTransform:'uppercase'}}>{portal.orderRef}</span>}
            <button onClick={()=>navigator.clipboard.writeText(window.location.href)}
              className="ghost-btn"
              style={{background:'transparent',border:'1px solid rgba(255,255,255,0.14)',padding:'8px 10px',cursor:'pointer',color:'rgba(255,255,255,0.4)',display:'flex',alignItems:'center',transition:'background .15s'}}
              title="Copy link">{Ic.share}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Tab Bar — HomePage .sub-btn style ── */}
      <div style={{background:'#fff',borderBottom:'1px solid rgba(0,0,0,0.07)',padding:isMobile?'0 16px':'0 48px'}}>
        <div style={{maxWidth:1400,margin:'0 auto',display:'flex',gap:0,overflowX:'auto'}}>
          {[
            {k:'catalogue',  l:'Catalogue Options', b:items.length},
            ...(portal.type==='product' ? [{k:'selected', l:'Selected Items', b:wishlisted.size||null}] : []),
            ...(!isMobile ? [{k:'calculator', l:'Cost Calculator', b:null}] : []),
            ...(portal.type==='product' && !isMobile ? [{k:'shipments', l:'Shipment Tracking', b:null}] : []),
            {k:'chat',       l:'Message Board',     b:newMsgs||null},
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              className={tab===t.k?'ms-tab-active':'ms-tab-idle'}
              style={{
                padding: isMobile ? '14px 8px' : '18px 24px',
                background:'none',border:'none',
                fontSize: isMobile ? 10 : 10,
                fontWeight:400,cursor:'pointer',
                display:'flex',alignItems:'center',gap:isMobile?4:8,
                flex: isMobile ? 1 : 'none',
                justifyContent: isMobile ? 'center' : 'flex-start',
                transition:'color .2s',
                fontFamily:"'Jost',sans-serif",
                letterSpacing:'0.18em',
                textTransform:'uppercase',
                whiteSpace:'nowrap',
              }}>
              {t.l}
              {t.b!=null&&<span style={{
                background: tab===t.k ? 'rgba(184,151,90,0.12)' : 'rgba(0,0,0,0.06)',
                color: tab===t.k ? '#b8975a' : 'rgba(26,26,26,0.35)',
                fontSize:9,fontWeight:500,padding:'2px 8px',
                letterSpacing:'0.1em',fontFamily:"'Jost',sans-serif",
              }}>{t.b}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero — navy grain like HomePage ── */}
      {tab==='catalogue'&&(
        <div className="ms-grain" style={{background:'linear-gradient(155deg,#0c1220 0%,#111a28 60%,#0e1824 100%)',padding:isMobile?'40px 20px 32px':'64px 48px 52px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:'-20%',right:'5%',width:400,height:400,border:'1px solid rgba(184,151,90,0.05)',borderRadius:'50%',pointerEvents:'none'}}/>
          <div style={{position:'absolute',top:'-25%',right:'2%',width:560,height:560,border:'1px solid rgba(184,151,90,0.03)',borderRadius:'50%',pointerEvents:'none'}}/>
          <div style={{maxWidth:1400,margin:'0 auto',position:'relative',zIndex:3}}>
            <span className="ms-pill" style={{marginBottom:22,display:'inline-block'}}>
              {portal.type==='product'?'Product Gifting':'Exclusive Offsite'} · {portal.orderRef}
            </span>
            <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:isMobile?'clamp(32px,8vw,48px)':'clamp(40px,6vw,72px)',fontWeight:300,color:'white',lineHeight:1.05,marginBottom:6}}>
              {portal.title
                ? <>{portal.title} </>
                : <>Curated for{' '}<em style={{color:'#b8975a'}}>{portal.clientName}.</em></>
              }
            </h1>
            {portal.teamNote&&(
              <p style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontStyle:'italic',color:'rgba(255,255,255,0.34)',fontSize:isMobile?14:17,lineHeight:1.75,maxWidth:520,marginTop:14}}>
                {portal.teamNote}
              </p>
            )}
            <div style={{marginTop:32,display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:1,background:'#b8975a'}}/>
              <span style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.25em',textTransform:'uppercase'}}>
                {items.length} item{items.length!==1?'s':''} curated for you
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{maxWidth:1400,margin:'0 auto',padding:isMobile?'24px 16px 80px':'48px 48px 80px'}}>

        {/* CATALOGUE */}
        {tab==='catalogue'&&(
          items.length===0
            ? <EmptyState icon="📋" title="Options being curated" sub="The Marqland team will update this shortly."/>
            : portal.type==='product'
              ? <ProductBento items={items} onZoom={setLightbox} wishlisted={wishlisted} onToggleWish={toggleWish}/>
              : <OffsiteCards items={items} onZoom={setLightbox}/>
        )}

        {/* COST CALCULATOR — desktop only */}
        {tab==='calculator'&&!isMobile&&(
          <div>
            {/* Calculator hero */}
            <div className="ms-grain" style={{background:'linear-gradient(155deg,#0c1220 0%,#111a28 60%,#0e1824 100%)',padding:'52px 0 44px',marginBottom:40,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:'-20%',right:'4%',width:350,height:350,border:'1px solid rgba(184,151,90,0.05)',borderRadius:'50%',pointerEvents:'none'}}/>
              <div style={{maxWidth:1400,margin:'0 auto',padding:'0 48px',position:'relative',zIndex:3}}>
                <span className="ms-pill" style={{marginBottom:18,display:'inline-block'}}>Cost Calculator</span>
                <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:'clamp(32px,5vw,56px)',fontWeight:300,color:'white',lineHeight:1.05,marginBottom:10}}>
                  Estimate your <em style={{color:'#b8975a'}}>investment.</em>
                </h1>
                <p style={{fontFamily:"'Jost',sans-serif",fontSize:13,color:'rgba(255,255,255,0.32)',fontWeight:300,maxWidth:480,lineHeight:1.75}}>
                  {portal.type==='product'
                    ? 'Set quantities against each product to see an indicative order value. Final invoice will include GST, branding, and shipping.'
                    : 'Enter your guest count and room split to compare property costs side by side. Toggle add-ons to fine-tune your estimate.'}
                </p>
              </div>
            </div>
            <CostCalculator portal={portal} wishlisted={wishlisted}/>
          </div>
        )}

        {/* SELECTED ITEMS */}
        {tab==='selected'&&(()=>{
          const allItems = portal.type==='product' ? portal.productItems : portal.offsiteItems;
          const sel = allItems.filter(i => wishlisted.has(String(i._id)));
          if(!sel.length) return (
            <EmptyState icon="🤍" title="No items shortlisted yet"
              sub="Tap ♡ on any product in Catalogue Options to add it here.">
              <button onClick={()=>setTab('catalogue')} style={{marginTop:24,background:'#b8975a',color:'#0e1520',border:'none',padding:'14px 36px',fontWeight:500,fontSize:10,cursor:'pointer',fontFamily:"'Jost',sans-serif",letterSpacing:'0.25em',textTransform:'uppercase'}}>
                Browse Catalogue
              </button>
            </EmptyState>
          );
          return (
            <div>
              {/* Summary bar */}
              <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:32,padding:'20px 24px',background:'#fff',border:'1px solid rgba(0,0,0,0.07)'}}>
                <div style={{width:1,height:28,background:'#b8975a',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:18,fontWeight:300,color:'#1a1a1a',fontFamily:"'Cormorant Garamond',Georgia,serif",fontStyle:'italic'}}>
                    {sel.length} item{sel.length!==1?'s':''} shortlisted
                  </div>
                  <div style={{fontSize:10,color:'rgba(26,26,26,0.4)',marginTop:3,fontFamily:"'Jost',sans-serif",letterSpacing:'0.1em',textTransform:'uppercase'}}>Mention these in the message board to share your preferences.</div>
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
                        :<div style={{width:'100%',height:'100%',background:'#f3f0ec',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',fontSize:11}}>No image</div>
                      }
                      <div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(10,20,34,0.82) 0%,transparent 48%)',pointerEvents:'none'}}/>
                      {/* Badges */}
                      <div style={{position:'absolute',bottom:10,left:10,display:'flex',gap:5,flexWrap:'wrap'}}>
                        {item.category&&<span style={{background:'rgba(184,151,90,0.88)',color:'#0e1520',fontSize:8,fontWeight:800,padding:'3px 7px',borderRadius:4,backdropFilter:'blur(4px)',textTransform:'uppercase',letterSpacing:'0.06em',fontFamily:"'Jost',sans-serif"}}>{item.category}</span>}
                        {item.subCategory&&<span style={{background:'rgba(255,255,255,0.14)',color:'rgba(255,255,255,0.85)',fontSize:8,fontWeight:700,padding:'3px 7px',borderRadius:4,backdropFilter:'blur(4px)',textTransform:'uppercase',fontFamily:"'Jost',sans-serif"}}>{item.subCategory}</span>}
                      </div>
                      {/* Remove heart */}
                      <button onClick={e=>{e.stopPropagation();toggleWish(String(item._id));}}
                        style={{position:'absolute',top:10,right:10,background:'rgba(220,53,69,0.82)',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',backdropFilter:'blur(6px)'}}>
                        {Ic.heart}
                      </button>
                    </div>
                    {/* Info — same layout as catalogue bento card */}
                    <div style={{padding:'14px 16px 16px',background:'#ffffff',flex:1,display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
                        <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a',lineHeight:1.2,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Jost',sans-serif"}}>{item.name}</div>
                        <div style={{fontSize:15,fontWeight:700,color:'#d4b06a',fontFamily:"'Cormorant Garamond',Georgia,serif",flexShrink:0}}>{toINR(item.price)}</div>
                      </div>
                      {item.description&&(
                        <p style={{fontSize:12,color:'#888888',lineHeight:1.6,margin:0,fontFamily:"'Jost',sans-serif",display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.description}</p>
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
              <div style={{width:32,height:32,border:'1px solid rgba(184,151,90,0.3)',borderTopColor:'#b8975a',borderRadius:'50%',animation:'spin .9s linear infinite',margin:'0 auto 16px'}}/>
              <div style={{fontSize:12,color:'#888888',fontFamily:"'Jost',sans-serif"}}>Loading shipments…</div>
            </div>
          );
          if(shipments.length===0) return (
            <div style={{textAlign:'center',padding:'64px 0',color:'#888'}}>
              <div style={{fontSize:40,marginBottom:14}}>📦</div>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:18,fontWeight:700,color:'#1a1a1a',marginBottom:8}}>No shipments yet</div>
              <div style={{fontSize:13,fontFamily:"'Jost',sans-serif",lineHeight:1.7}}>Shipment details will appear here once your parcels are dispatched.</div>
            </div>
          );
          const STATUSES = ['Booked','In Transit','Out for Delivery','Delivered','Returned','Exception'];
          const filtered = shipFilter==='all' ? shipments : shipments.filter(s=>s.status===shipFilter);
          const downloadExcel = () => {
              const headers = ['Recipient','City','State','Phone','Tracking ID','Partner','Status','Updated'];
              const rows = shipments.map(s => [
                s.recipientName||'',s.city||'',s.state||'',s.phone||'',
                s.trackingId||'',s.shippingPartner||'',s.status||'',
                s.lastTrackedAt ? new Date(s.lastTrackedAt).toLocaleDateString('en-IN') : '',
              ]);
              const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
              const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a');
              a.href=url; a.download=`shipments-${portal.orderRef||'export'}.csv`;
              document.body.appendChild(a); a.click();
              document.body.removeChild(a); URL.revokeObjectURL(url);
            };
          return (
            <div>
              {/* Summary strip + download */}
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,padding:'20px 24px',background:'#fff',border:'1px solid rgba(0,0,0,0.07)',flexWrap:'wrap'}}>
                <div style={{width:1,height:24,background:'#b8975a',flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:300,color:'#1a1a1a',fontFamily:"'Cormorant Garamond',Georgia,serif",fontStyle:'italic'}}>
                    {shipments.length} shipment{shipments.length!==1?'s':''}
                  </div>
                  <div style={{fontSize:12,color:'#888888',marginTop:2,fontFamily:"'Jost',sans-serif"}}>
                    {shipments.filter(s=>s.status==='Delivered'||s.status==='Completed').length} delivered
                    {' · '}
                    {shipments.filter(s=>['In Transit','Out for Delivery','Booked'].includes(s.status)).length} in transit
                  </div>
                </div>
                {/* Download button */}
                <button onClick={downloadExcel} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(184,151,90,0.08)',border:'1px solid rgba(184,151,90,0.2)',borderRadius:8,cursor:'pointer',color:'#b8975a',fontSize:11,fontWeight:700,fontFamily:"'Jost',sans-serif",whiteSpace:'nowrap'}}>
                  {Ic.dl} Download Excel
                </button>
              </div>

              {/* Status filter chips */}
              <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
                {['all',...STATUSES].map(st=>{
                  const count = st==='all' ? shipments.length : shipments.filter(s=>s.status===st).length;
                  if(st!=='all'&&count===0) return null;
                  return (
                    <button key={st} onClick={()=>setShipFilter(st)}
                      style={{padding:'5px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:"'Jost',sans-serif",transition:'all .15s',
                        background: shipFilter===st ? '#0e1520' : 'transparent',
                        color:      shipFilter===st ? '#0e1520' : '#888',
                        boxShadow:  shipFilter===st ? '0 4px 12px rgba(184,151,90,0.25)' : 'none',
                      }}>
                      {st==='all'?`All (${count})`:STATUS_CHIP[st]?`${st} (${count})`:st}
                    </button>
                  );
                })}
              </div>

              {/* Shipment cards */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {filtered.length===0&&<div style={{textAlign:'center',padding:'32px 0',color:'#888888',fontSize:13,fontFamily:"'Jost',sans-serif"}}>No shipments with status "{shipFilter}"</div>}
                {filtered.map((s,idx)=>{
                  const chip = STATUS_CHIP[s.status] || STATUS_CHIP['Pending'];
                  const isDelivered = s.status==='Delivered'||s.status==='Completed';
                  return (
                    <GlassCard key={s._id||idx} delay={idx*0.04}
                      style={{padding:isMobile?'16px 18px':'20px 24px',display:'flex',alignItems:isMobile?'flex-start':'center',gap:16,flexDirection:isMobile?'column':'row'}}>

                      {/* Status indicator dot */}
                      <div style={{width:10,height:10,borderRadius:'50%',background:chip.color,boxShadow:`0 0 8px ${chip.color}`,flexShrink:0,marginTop:isMobile?4:0}}/>

                      {/* Recipient */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:15,color:'#1a1a1a',fontFamily:"'Jost',sans-serif",marginBottom:2}}>{s.recipientName}</div>
                        <div style={{fontSize:12,color:'#888888',fontFamily:"'Jost',sans-serif",display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          {s.city&&<span>📍 {s.city}{s.state?`, ${s.state}`:''}</span>}
                          {s.phone&&<span>· {s.phone}</span>}
                        </div>
                      </div>

                      {/* Tracking ID + partner */}
                      <div style={{textAlign:isMobile?'left':'center',flexShrink:0}}>
                        {s.trackingId?(
                          <div style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:'#d4b06a',background:'rgba(184,151,90,0.08)',padding:'4px 10px',borderRadius:7,marginBottom:4,display:'inline-block'}}>
                            {s.trackingId}
                          </div>
                        ):(
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginBottom:4,fontFamily:"'Jost',sans-serif"}}>Tracking pending</div>
                        )}
                        {s.shippingPartner&&(
                          <div style={{fontSize:11,color:'#888888',fontFamily:"'Jost',sans-serif"}}>{s.shippingPartner}</div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div style={{flexShrink:0}}>
                        <span style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.08em',padding:'5px 12px',borderRadius:20,background:chip.bg,color:chip.color,fontFamily:"'Jost',sans-serif"}}>
                          {isDelivered?'✓ ':''}{s.status}
                        </span>
                        {s.lastTrackedAt&&(
                          <div style={{fontSize:9,color:'rgba(255,255,255,0.2)',marginTop:4,textAlign:'center',fontFamily:"'Jost',sans-serif"}}>
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
              <div style={{background:'#ffffff',borderRadius:12,padding:20}}>
                <div style={{fontSize:9,fontWeight:800,color:'#888888',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12,fontFamily:"'Jost',sans-serif"}}>Current Project</div>
                <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:700,fontSize:15,color:'#1a1a1a',lineHeight:1.3,marginBottom:4}}>{portal.title||portal.orderRef}</div>
                <div style={{fontSize:12,color:'#888888',marginBottom:16,fontFamily:"'Jost',sans-serif"}}>{portal.clientName}</div>
                {/* Nav items */}
                {[{l:'Message Board',k:'chat',icon:'💬'},{l:'Catalogue Options',k:'catalogue',icon:'🗂'}].map(it=>(
                  <button key={it.k} onClick={()=>setTab(it.k)}
                    style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:tab===it.k?'rgba(184,151,90,0.1)':'transparent',border:'none',borderRadius:8,cursor:'pointer',color:tab===it.k?'#b8975a':'#888',fontSize:12,fontWeight:600,textAlign:'left',width:'100%',marginBottom:3,fontFamily:"'Jost',sans-serif",transition:'background .15s'}}>
                    <span>{it.icon}</span>{it.l}
                  </button>
                ))}
              </div>

              {/* Concierge card — metallic gradient CTA per DESIGN.md */}
              <div style={{background:`linear-gradient(135deg, rgba(184,151,90,0.1) 0%, rgba(230,194,115,0.05) 100%)`,border:'1px solid rgba(184,151,90,0.18)',borderRadius:12,padding:18}}>
                <div style={{fontSize:9,fontWeight:800,color:'#b8975a',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12,fontFamily:"'Jost',sans-serif"}}>Your Concierge</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,background:GOLD_GRAD,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#0e1520',fontWeight:900,fontSize:14,flexShrink:0}}>M</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:'#1a1a1a',fontFamily:"'Jost',sans-serif"}}>Marqland Team</div>
                    <div style={{fontSize:11,color:'#4ade80',marginTop:1,fontFamily:"'Jost',sans-serif"}}>● Online · &lt;1 hour response</div>
                  </div>
                </div>
              </div>

              {/* Quick reference items */}
              {items.length>0&&(
                <div>
                  <div style={{fontSize:9,fontWeight:800,color:'#888888',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:10,fontFamily:"'Jost',sans-serif"}}>Quick Reference</div>
                  {items.slice(0,3).map((it,i)=>(
                    <div key={i} onClick={()=>setTab('catalogue')}
                      style={{display:'flex',alignItems:'center',gap:9,background:'#ffffff',borderRadius:10,padding:'8px 10px',marginBottom:6,cursor:'pointer'}}>
                      <div style={{width:32,height:32,borderRadius:7,background:'#f3f0ec',overflow:'hidden',flexShrink:0}}>
                        {it.imageUrl&&<img src={it.imageUrl} alt={it.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:'#1a1a1a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:"'Jost',sans-serif"}}>{it.name}</div>
                        <div style={{fontSize:10,color:'#888888',fontFamily:"'Jost',sans-serif"}}>{portal.type==='product'?toINR(it.price):it.location||'—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat window — elevated surface */}
            <div style={{background:'#ffffff',borderRadius:12,display:'flex',flexDirection:'column',minHeight:isMobile?'calc(100vh - 200px)':580}}>
              {/* Chat header */}
              <div style={{padding:'16px 20px',borderBottom:`1px solid rgba(255,255,255,0.05)`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:36,height:36,background:'rgba(184,151,90,0.12)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🏢</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',fontFamily:"'Jost',sans-serif"}}>Marqland Team</div>
                  <div style={{fontSize:11,color:'#4ade80',fontFamily:"'Jost',sans-serif"}}>● Typically responds in under an hour</div>
                </div>
              </div>

              {/* Name input if not set */}
              {!nameSet&&(
                <div style={{padding:'10px 18px',background:'#f3f0ec',borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input value={clientName} onChange={e=>setClientName(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&clientName.trim())setNameSet(true);}}
                      placeholder="Your name so we know who's messaging"
                      style={{flex:1,background:'#ffffff',border:'1px solid rgba(184,151,90,0.2)',borderRadius:8,padding:'8px 13px',color:'#1a1a1a',fontSize:13,outline:'none',fontFamily:"'Jost',sans-serif"}}/>
                    <button onClick={()=>{if(clientName.trim())setNameSet(true);}} disabled={!clientName.trim()}
                      style={{background:GOLD_GRAD,border:'none',borderRadius:8,padding:'8px 16px',color:'#0e1520',fontSize:12,fontWeight:700,cursor:'pointer',opacity:clientName.trim()?1:0.4,fontFamily:"'Jost',sans-serif"}}>
                      Set
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{flex:1,overflowY:'auto',padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
                {portal.messages.length===0&&(
                  <div style={{textAlign:'center',padding:'48px 0',color:'#888'}}>
                    <div style={{fontSize:32,marginBottom:12}}>💬</div>
                    <p style={{fontSize:13,fontFamily:"'Jost',sans-serif"}}>No messages yet. Ask us anything!</p>
                  </div>
                )}
                {portal.messages.map(m=>{
                  const isT=m.sender==='team';
                  return(
                    <div key={m._id} style={{display:'flex',justifyContent:isT?'flex-start':'flex-end',gap:8}}>
                      {isT&&<div style={{width:28,height:28,background:GOLD_GRAD,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#0e1520',fontSize:11,fontWeight:800,flexShrink:0,alignSelf:'flex-end',marginBottom:2}}>M</div>}
                      <div style={{maxWidth:'72%'}}>
                        <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.3)',marginBottom:4,textAlign:isT?'left':'right',fontFamily:"'Jost',sans-serif",letterSpacing:'0.02em'}}>{m.senderName} · {fmtT(m.createdAt)}</div>
                        <div style={{
                          background: isT ? '#f0ede8' : 'linear-gradient(45deg,#d4b06a,#b8975a)',
                          borderRadius: isT ? '4px 14px 14px 14px' : '14px 14px 4px 14px',
                          padding:'11px 15px',
                        }}>
                          {m.text&&<div style={{fontSize:14,lineHeight:1.65,color: isT ? '#1a1a1a' : '#0e1520',fontFamily:"'Jost',sans-serif"}}>{m.text}</div>}
                          {(m.attachments||[]).map((a,i)=><AttachChip key={i} att={a} isTeam={isT}/>)}
                        </div>
                      </div>
                      {!isT&&<div style={{width:28,height:28,background:'#ffffff',border:'1px solid rgba(184,151,90,0.2)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#b8975a',flexShrink:0,alignSelf:'flex-end',marginBottom:2}}>
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
              <div style={{padding:'14px 18px',borderTop:'1px solid rgba(0,0,0,0.06)'}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                  <div style={{flex:1,background:'#ffffff',borderRadius:12,padding:'10px 14px',border:`1px solid rgba(184,151,90,0.15)`}}>
                    <textarea value={msg} onChange={e=>setMsg(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                      placeholder="Message the team… (Enter to send)"
                      rows={2}
                      style={{background:'none',border:'none',outline:'none',color:'#1a1a1a',fontSize:14,fontFamily:"'Jost',sans-serif",lineHeight:1.55,width:'100%'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,paddingTop:6,borderTop:'1px solid rgba(0,0,0,0.06)'}}>
                      <button type="button" onClick={()=>fileRef.current?.click()}
                        style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',padding:2,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,fontFamily:"'Jost',sans-serif",transition:'color .15s'}}
                        onMouseEnter={e=>e.currentTarget.style.color='#b8975a'}
                        onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
                        {Ic.attach} <span>Attach</span>
                      </button>
                      <span style={{fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:"'Jost',sans-serif"}}>Max 5 files · 10MB each</span>
{/* input moved outside — see root-level input below */}
                    </div>
                  </div>
                  {/* Send — Primary button: metallic gradient CTA per DESIGN.md */}
                  <button onClick={send} disabled={sending||(!msg.trim()&&files.length===0)}
                    style={{
                      width:44,height:44,
                      background: (sending||(!msg.trim()&&files.length===0)) ? '#ffffff' : GOLD_GRAD,
                      border:'none',borderRadius:10,cursor:'pointer',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      color: (sending||(!msg.trim()&&files.length===0)) ? 'rgba(255,255,255,0.25)' : '#0e1520',
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
      <div style={{background:'#ffffff',borderTop:`1px solid rgba(255,255,255,0.04)`,padding:isMobile?'16px':'20px 32px',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:9,marginBottom:5}}>
          <div style={{width:16,height:16,background:GOLD_GRAD,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#0e1520',fontWeight:900,fontSize:9}}>M</div>
          <span style={{color:'#888888',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:"'Jost',sans-serif"}}>Marqland Studios</span>
        </div>
        <p style={{color:'rgba(255,255,255,0.18)',fontSize:10,fontFamily:"'Jost',sans-serif"}}>This is a private proposal. Please do not share this link.</p>
      </div>
    </div>
  );
};



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
    fontFamily:"'Jost',sans-serif", transition:'all .18s',
    background: active ? GOLD_GRAD : 'transparent',
    color:      active ? '#0e1520' : '#888',
    boxShadow:  active ? '0 4px 16px rgba(184,151,90,0.35)' : 'none',
    outline:    active ? 'none' : `1px solid rgba(255,255,255,0.12)`,
  });
  const subChip = active => ({
    ...chip(active), padding:'4px 12px', fontSize:10,
    background: active ? 'rgba(184,151,90,0.15)' : 'transparent',
    color:      active ? '#b8975a' : '#888888',
    outline:    `1px solid ${active?'rgba(184,151,90,0.4)':'rgba(255,255,255,0.08)'}`,
  });

  return (
    <div>
      {/* Filter bar — surface-container tonal panel */}
      <div style={{marginBottom:isMobile?16:32,padding:isMobile?'14px 16px':'18px 22px',background:'#ffffff',borderRadius:12}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
          <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.12em',marginRight:6,fontFamily:"'Jost',sans-serif"}}>Category</span>
          {categories.map(cat=>(
            <button key={cat} style={chip(activeCategory===cat)}
              onClick={()=>{ if(activeCategory===cat){setActiveCategory(null);setActiveSubCat(null);}else{setActiveCategory(cat);setActiveSubCat(null);} }}>
              {cat}
            </button>
          ))}
        </div>
        {activeCategory&&subCats.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12,paddingTop:12,borderTop:'1px solid rgba(0,0,0,0.06)',alignItems:'center'}}>
            <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.12em',marginRight:6,fontFamily:"'Jost',sans-serif"}}>Type</span>
            {subCats.map(sc=>(
              <button key={sc} style={subChip(activeSubCat===sc)} onClick={()=>setActiveSubCat(activeSubCat===sc?null:sc)}>{sc}</button>
            ))}
          </div>
        )}
        <div style={{marginTop:10,fontSize:12,color:'#888888',fontFamily:"'Jost',sans-serif"}}>
          <span style={{fontWeight:700,color:'#b8975a'}}>{filtered.length}</span>
          {' '}option{filtered.length!==1?'s':''} curated for you
          {activeCategory&&<span style={{color:'rgba(255,255,255,0.25)'}}> in <span style={{color:'#b8975a'}}>{activeCategory}</span>{activeSubCat?` › ${activeSubCat}`:''}</span>}
        </div>
      </div>

      {/* Category groups */}
      {groups.map((group,gi)=>(
        <div key={group.cat} style={{marginBottom:56}}>
          {/* Category header — Status Pillar style */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:isMobile?14:22}}>
            <div style={{width:2,height:20,background:GOLD_GRAD,borderRadius:2,flexShrink:0}}/>
            <span style={{fontSize:10,fontWeight:800,color:'#b8975a',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'Jost',sans-serif"}}>{group.cat}</span>
            <div style={{flex:1,height:1,background:`linear-gradient(90deg, rgba(184,151,90,0.2), transparent)`}}/>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.2)',fontWeight:600,fontFamily:"'Jost',sans-serif"}}>{group.items.length} item{group.items.length!==1?'s':''}</span>
          </div>

          {/* Sub-groups */}
          {(()=>{
            const subMap=new Map();
            group.items.forEach(item=>{ const s=item.subCategory||''; if(!subMap.has(s)) subMap.set(s,[]); subMap.get(s).push(item); });
            const subGroups=Array.from(subMap.entries());
            return subGroups.map(([sub,subItems])=>(
              <div key={sub||'main'} style={{marginBottom:28}}>
                {sub&&subGroups.length>1&&(
                  <div style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,paddingLeft:4,fontFamily:"'Jost',sans-serif"}}>— {sub}</div>
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
                          style={{display:'flex',flexDirection:'column',position:'relative'}}
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
                                  : <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',background:'#f3f0ec',color:'rgba(255,255,255,0.15)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>No image</div>
                                }
                                {/* Zoom hint */}
                                {item.imageUrl&&(
                                  <div style={{position:'absolute',top:10,right:10,background:'rgba(10,20,34,0.6)',color:'rgba(255,255,255,0.45)',borderRadius:6,padding:'4px 7px',display:'flex',alignItems:'center',gap:3,fontSize:9,backdropFilter:'blur(4px)',pointerEvents:'none'}}>
                                    {Ic.zoom}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Heart */}
                            <button
                              onClick={e=>{e.stopPropagation();onToggleWish(String(item._id));}}
                              title={loved?'Remove from shortlist':'Add to shortlist'}
                              style={{
                                position:'absolute',top:10,left:10,zIndex:10,
                                background:loved?'rgba(220,53,69,0.88)':'rgba(255,255,255,0.92)',
                                border:`1px solid ${loved?'rgba(220,53,69,0.3)':'rgba(0,0,0,0.1)'}`,
                                borderRadius:2,width:32,height:32,
                                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                                color:loved?'#fff':'rgba(26,26,26,0.5)',
                                backdropFilter:'blur(4px)',transition:'all .2s',
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
                                  borderTop:'1px solid rgba(184,151,90,0.2)',
                                  zIndex:8,
                                }}
                                className="desc-scroll"
                              >
                                <div style={{position:'sticky',top:0,left:0,right:0,height:2,background:GOLD_GRAD,flexShrink:0}}/>
                                <div style={{padding:'12px 14px 16px'}}>
                                  <p style={{fontSize:12.5,color:'rgba(240,232,214,0.92)',lineHeight:1.7,margin:0,fontFamily:"'Jost',sans-serif",fontWeight:400,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{item.description}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── Info panel ── */}
                          <div style={{padding:isMobile?'12px 14px 14px':'16px 18px 18px',background:'#fff',display:'flex',flexDirection:'column',gap:8}}>

                            {/* Row 1: Name + Price */}
                            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
                              <div style={{fontSize:isMobile?11:12,fontWeight:400,color:'#1a1a1a',lineHeight:1.2,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'Jost',sans-serif",letterSpacing:'0.04em'}}>
                                {item.name}
                              </div>
                              <div style={{fontSize:isMobile?13:14,fontWeight:300,color:'#b8975a',fontFamily:"'Cormorant Garamond',Georgia,serif",flexShrink:0,fontStyle:'italic'}}>
                                {toINR(item.price)}
                              </div>
                            </div>

                            {/* Row 2: Description — 3 lines, hover to open overlay */}
                            {item.description&&(
                              <p
                                onMouseEnter={()=>setHoveredId(item._id)}
                                style={{
                                  fontSize:11,lineHeight:1.65,margin:0,
                                  fontFamily:"'Jost',sans-serif",fontWeight:300,
                                  display:'-webkit-box',
                                  WebkitLineClamp:3,WebkitBoxOrient:'vertical',
                                  overflow:'hidden',cursor:'default',letterSpacing:'0.02em',
                                  color: hoveredId===item._id ? '#b8975a' : 'rgba(26,26,26,0.5)',
                                  transition:'color .15s',
                                }}
                              >{item.description}</p>
                            )}

                            {/* ── Video embed (YouTube or direct link) ── */}
                            {item.videoUrl && getYouTubeId(item.videoUrl) && (
                              <div style={{marginTop:4}}>
                                <div style={{fontSize:9,fontWeight:800,color:'#888888',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6,fontFamily:"'Jost',sans-serif"}}>🎬 Product Video</div>
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
                                  background:'rgba(184,151,90,0.07)',border:'1px solid rgba(184,151,90,0.18)',
                                  fontSize:11,fontWeight:700,color:'#b8975a',fontFamily:"'Jost',sans-serif",
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
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20,padding:'12px 16px',background:'#ffffff',borderRadius:12,flexWrap:'wrap'}}>
        <span style={{fontSize:9,fontWeight:800,color:'#888888',textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:"'Jost',sans-serif",marginRight:4}}>Filter</span>
        {[
          {k:'all',   l:`All (${items.length})`},
          {k:'day',   l:`☀️ Day Outing (${items.filter(i=>i.type!=='Night Stay').length})`},
          {k:'night', l:`🌙 Night Stay (${items.filter(i=>i.type==='Night Stay').length})`},
        ].map(opt=>(
          <button key={opt.k} onClick={()=>setTypeFilter(opt.k)}
            style={{
              padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',
              fontSize:11,fontWeight:700,fontFamily:"'Jost',sans-serif",transition:'all .18s',
              background: typeFilter===opt.k ? GOLD_GRAD : 'transparent',
              color:      typeFilter===opt.k ? '#0e1520' : '#888',
              boxShadow:  typeFilter===opt.k ? '0 4px 16px rgba(184,151,90,0.3)' : 'none',
              outline:    typeFilter===opt.k ? 'none' : '1px solid rgba(255,255,255,0.12)',
            }}>
            {opt.l}
          </button>
        ))}
      </div>
    )}
    <p style={{fontSize:12,color:'#888888',marginBottom:20,fontWeight:600,fontFamily:"'Jost',sans-serif"}}>{visible.length} propert{visible.length!==1?'ies':'y'} selected for you</p>
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
                :<div style={{width:'100%',height:'100%',background:'#f3f0ec',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',fontSize:12}}>No image</div>
              }
              <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(0,0,0,0.3) 0%,transparent 55%)',pointerEvents:'none'}}/>
              <div style={{position:'absolute',top:14,left:14,background:'rgba(10,20,34,0.75)',color:'rgba(255,255,255,0.5)',fontSize:9,fontWeight:800,padding:'4px 10px',borderRadius:6,backdropFilter:'blur(6px)',fontFamily:"'Jost',sans-serif",letterSpacing:'0.06em'}}>Option {idx+1}</div>
              <div style={{position:'absolute',bottom:14,left:14,background:isDayOut?'rgba(180,83,9,0.82)':'rgba(29,78,216,0.82)',color:'#fff',fontSize:9,fontWeight:700,padding:'4px 10px',borderRadius:6,backdropFilter:'blur(4px)',fontFamily:"'Jost',sans-serif"}}>
                {isDayOut?'☀️ Day Outing':'🌙 Night Stay'}
              </div>
            </div>
            {/* Info panel */}
            <div style={{padding:isMobile?'16px 18px':'22px 26px',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#f3f0ec',overflow:'hidden'}}>
              <div>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                  <div>
                    <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:isMobile?17:20,fontWeight:700,color:'#1a1a1a',marginBottom:5,lineHeight:1.2}}>{item.name}</h3>
                    <div style={{display:'flex',alignItems:'center',gap:5,color:'#888888',fontSize:13,fontFamily:"'Jost',sans-serif"}}>
                      <span style={{color:'#b8975a'}}>{Ic.pin}</span>{item.location||'Location TBD'}
                    </div>
                  </div>
                  {item.website&&(
                    <a href={item.website.startsWith('http')?item.website:`https://${item.website}`} target="_blank" rel="noreferrer"
                      style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#b8975a',fontWeight:600,textDecoration:'none',background:'rgba(184,151,90,0.08)',padding:'6px 12px',borderRadius:8,whiteSpace:'nowrap',border:'1px solid rgba(184,151,90,0.2)',flexShrink:0,fontFamily:"'Jost',sans-serif"}}>
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
            <div style={{padding:'20px 24px 24px',background:'#ffffff',borderTop:'1px solid rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:9,fontWeight:800,color:'#f59e0b',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14,fontFamily:"'Jost',sans-serif"}}>
                ☀️ Day Packages — {item.dayPackages.length} option{item.dayPackages.length!==1?'s':''}
              </div>
              <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?200:260}px,1fr))`,gap:12}}>
                {item.dayPackages.map((pkg,pi)=>(
                  <div key={pi} style={{background:'#ffffff',border:'1px solid rgba(245,158,11,0.18)',borderRadius:12,padding:'16px 18px',display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                      <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',lineHeight:1.2,flex:1,fontFamily:"'Jost',sans-serif"}}>{pkg.name||`Package ${pi+1}`}</div>
                      {pkg.sellingPrice>0&&(
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:18,fontWeight:700,color:'#fbbf24',fontFamily:"'Cormorant Garamond',Georgia,serif",lineHeight:1}}>₹{Number(pkg.sellingPrice).toLocaleString('en-IN')}</div>
                          <div style={{fontSize:9,color:'#f59e0b',fontWeight:600,marginTop:3,fontFamily:"'Jost',sans-serif"}}>per person</div>
                        </div>
                      )}
                    </div>
                    {pkg.activities&&(
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {pkg.activities.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).map((line,li)=>(
                          <div key={li} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:'#888888',lineHeight:1.5,fontFamily:"'Jost',sans-serif"}}>
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
                <div style={{marginTop:14,background:'rgba(184,151,90,0.06)',border:'1px solid rgba(184,151,90,0.14)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#b8975a',fontStyle:'italic',fontFamily:"'Jost',sans-serif"}}>
                  💡 {item.note}
                </div>
              )}
            </div>
          )}

          {/* Night Stay note */}
          {!isDayOut&&item.note&&(
            <div style={{padding:'0 24px 18px',background:'#ffffff'}}>
              <div style={{background:'rgba(184,151,90,0.06)',border:'1px solid rgba(184,151,90,0.14)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#b8975a',fontStyle:'italic',fontFamily:"'Jost',sans-serif"}}>💡 {item.note}</div>
            </div>
          )}

          {/* Property attachments */}
          {(item.attachments||[]).length>0&&(
            <div style={{padding:'0 24px 20px',background:'#ffffff'}}>
              <div style={{fontSize:9,fontWeight:800,color:'#888888',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,fontFamily:"'Jost',sans-serif"}}>📎 Documents & Files</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {item.attachments.map((att,ai)=><PropAttachChip key={ai} att={att}/>)}
              </div>
            </div>
          )}
          
          {/* YouTube video embed */}
          {item.youtubeUrl&&getYouTubeId(item.youtubeUrl)&&(
            <div style={{padding:'0 24px 20px',background:'#ffffff'}}>
              <div style={{fontSize:9,fontWeight:800,color:'#888888',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,fontFamily:"'Jost',sans-serif"}}>🎬 Property Video</div>
              <YouTubeEmbed url={item.youtubeUrl} title={item.name}/>
            </div>
          )}
        </GlassCard>
        );
      })}
    </div>
  </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// UNIFIED COST CALCULATOR
// One component for both portal types. Desktop/tablet only.
// ═════════════════════════════════════════════════════════════════════════════
const CostCalculator = ({ portal, wishlisted=new Set() }) => {
  const INR  = v => `₹${Number(v||0).toLocaleString('en-IN')}`;
  const isProduct = portal.type === 'product';
  const productItems = portal.productItems || [];
  // Only shortlisted products appear in the calculator
  const shortlisted = productItems.filter(i => wishlisted.has(String(i._id)));
  const offsiteItems = portal.offsiteItems || [];

  // ── Shared helpers ──────────────────────────────────────────────────────────
  const inputSt = {
    padding: '5px 7px', border: '1px solid rgba(0,0,0,0.12)',
    fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#1a1a1a',
    textAlign: 'center', outline: 'none', background: '#fff', transition: 'border-color .15s',
  };

  // ── PRODUCT STATE ───────────────────────────────────────────────────────────
  const [qty,      setQty]      = React.useState({});
  const setQ = (id, val) => {
    const n = Math.max(0, Math.min(99999, Number(val) || 0));
    setQty(prev => ({ ...prev, [id]: n }));
  };

  const pLines     = productItems.map(i => ({ ...i, q: qty[i._id]||0, line:(qty[i._id]||0)*(i.price||0) }));
  const pTotal     = pLines.reduce((s,l) => s+l.line, 0);
  const pTotalQty  = pLines.reduce((s,l) => s+l.q,    0);
  const pActive    = pLines.filter(l => l.q > 0);

  // ── OFFSITE STATE ───────────────────────────────────────────────────────────
  const initProp = item => ({
    nights: 1, single:0, double:0, triple:0, quad:0,
    pax: 0,
    pkgId: item.dayPackages?.length > 0 ? 0 : null,
    addons: {},
  });

  const [calcs,      setCalcs]      = React.useState(() => { const m={}; offsiteItems.forEach(i=>{ m[i._id]=initProp(i); }); return m; });
  const [propOpen,   setPropOpen]   = React.useState(() => { const m={}; offsiteItems.forEach((i,idx)=>{ m[i._id]=idx===0; }); return m; });
  const [typeFilter, setTypeFilter] = React.useState('all');

  const hasDay   = offsiteItems.some(i => i.type !== 'Night Stay');
  const hasNight = offsiteItems.some(i => i.type === 'Night Stay');

  const visibleItems = typeFilter==='all' ? offsiteItems
    : typeFilter==='day'   ? offsiteItems.filter(i=>i.type!=='Night Stay')
    : offsiteItems.filter(i=>i.type==='Night Stay');

  const upd = (id, field, val) => setCalcs(p => ({ ...p, [id]: { ...p[id], [field]: val } }));
  const toggleAddon = (id, key) => setCalcs(p => ({ ...p, [id]: { ...p[id], addons: { ...p[id].addons, [key]: !p[id].addons[key] } } }));

  const addonList = item => {
    const l = [];
    if (item.djCost>0)         l.push({ key:'dj',       label:'DJ',           value:item.djCost,         perPerson: !!item.djCostPerPerson });
    if (item.licenseFeeDJ>0)   l.push({ key:'djlic',    label:'DJ Licence',   value:item.licenseFeeDJ,   perPerson: !!item.licenseFeeDJPerPerson });
    if (item.cocktailSnacks>0) l.push({ key:'cocktail', label:'Cocktails & Snacks', value:item.cocktailSnacks, perPerson: item.cocktailSnacksPerPerson !== false }); // default true
    if (item.banquetHall>0)    l.push({ key:'banquet',  label:'Banquet Hall', value:item.banquetHall,    perPerson: !!item.banquetHallPerPerson });
    (item.adhocAddons||[]).filter(a=>a.sellingPrice>0).forEach((a,i)=>l.push({ key:`adhoc_${i}`, label:a.name, value:a.sellingPrice, perPerson: !!a.perPerson }));
    return l;
  };

  const calcTotal = item => {
    const c = calcs[item._id] || initProp(item);
    const isDayOut = item.type !== 'Night Stay';
    let base = 0;
    if (isDayOut) {
      if (item.dayPackages?.length>0 && c.pkgId!==null) base = (item.dayPackages[c.pkgId]?.sellingPrice||0)*(c.pax||0);
      else base = (item.packagePrice||0)*(c.pax||0);
    } else {
      const n = Math.max(1,c.nights||1);
      base = (item.singlePrice||0)*(c.single||0)*n + (item.doublePrice||0)*(c.double||0)*n
           + (item.triplePrice||0)*(c.triple||0)*n + (item.quadPrice||0)*(c.quad||0)*n;
    }
    // Guest headcount for per-person addon multiplication
    const guests = isDayOut
      ? (c.pax||0)
      : (c.single||0)*1 + (c.double||0)*2 + (c.triple||0)*3 + (c.quad||0)*4;
    const addonCost = addonList(item).reduce((s,a) => {
      if (!c.addons[a.key]) return s;
      return s + (a.perPerson ? a.value * Math.max(1, guests) : a.value);
    }, 0);
    return base + addonCost;
  };

  const oTotals  = offsiteItems.map(i => ({ _id:i._id, name:i.name, type:i.type, total:calcTotal(i) }));
  const oMaxTotal = Math.max(...oTotals.map(t=>t.total), 1);
  const oAnyNonZero = oTotals.some(t=>t.total>0);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ════ PRODUCT CALCULATOR ════ */}
      {isProduct && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:28, alignItems:'start' }}>

          {/* Left: shortlisted products only */}
          <div>
            {/* Empty state — no shortlisted items yet */}
            {shortlisted.length === 0 ? (
              <div style={{ padding:'60px 0', textAlign:'center' }}>
                <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:28, fontWeight:300, color:'#1a1a1a', lineHeight:1.3, marginBottom:14 }}>
                  Curate your selection to generate<br/>a <em style={{color:'#b8975a'}}>tailored cost summary.</em>
                </div>
                <p style={{ fontFamily:"'Jost',sans-serif", fontSize:11, color:'#aaa', letterSpacing:'0.1em', lineHeight:1.7, maxWidth:340, margin:'0 auto 28px' }}>
                  Shortlist products from the Catalogue tab using the ♡ button — they will appear here for you to add quantities.
                </p>
                <button onClick={()=>{}} style={{ padding:'10px 24px', border:'1px solid rgba(184,151,90,0.35)', background:'transparent', cursor:'pointer', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:'#b8975a' }}>
                  ← Go to Catalogue
                </button>
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div style={{ display:'grid', gridTemplateColumns:'56px 1fr 120px 80px 110px', gap:0, padding:'8px 16px', background:'#f7f5f1', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                  {[['','left'],['Product','left'],['Unit Price','center'],['Qty','center'],['Amount','right']].map(([h,align])=>(
                    <span key={h} style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.2em', textTransform:'uppercase', textAlign:align }}>{h}</span>
                  ))}
                </div>

                {/* Product rows — shortlisted only, one row per product */}
                {shortlisted.map((item, idx) => {
                  const q = qty[item._id]||0;
                  const line = q*(item.price||0);
                  const active = q>0;
                  return (
                    <div key={item._id} style={{
                      display:'grid', gridTemplateColumns:'56px 1fr 120px 80px 110px', gap:0,
                      alignItems:'center',
                      background: active ? 'rgba(184,151,90,0.04)' : idx%2===0 ? '#fff' : '#faf8f5',
                      borderLeft: active ? '3px solid #b8975a' : '3px solid transparent',
                      borderBottom: '1px solid rgba(0,0,0,0.05)',
                      transition: 'background .15s, border-color .15s',
                      minHeight: 64,
                    }}>
                      {/* Product image — fixed 56×64 */}
                      <div style={{ width:56, height:64, flexShrink:0, overflow:'hidden', background:'#f3f0ec' }}>
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#ddd' }}>□</div>
                        }
                      </div>
                      {/* Name + subcat */}
                      <div style={{ padding:'0 14px' }}>
                        <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:15, color:'#1a1a1a', lineHeight:1.2 }}>{item.name}</div>
                        {item.subCategory && <div style={{ fontFamily:"'Jost',sans-serif", fontSize:10, color:'#aaa', marginTop:2, letterSpacing:'0.08em' }}>{item.subCategory}</div>}
                        {item.category && <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#ccc', marginTop:1, letterSpacing:'0.06em', textTransform:'uppercase' }}>{item.category}</div>}
                      </div>
                      {/* Unit price */}
                      <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:15, color:'#888', textAlign:'center', padding:'0 8px' }}>{INR(item.price)}</div>
                      {/* Qty input */}
                      <div style={{ display:'flex', justifyContent:'center', padding:'0 6px' }}>
                        <input type="number" min="0" max="99999" value={q||''} placeholder="0"
                          onChange={e=>setQ(item._id,e.target.value)}
                          onFocus={e=>e.target.style.borderColor='#b8975a'}
                          onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
                          style={{...inputSt, width:64, textAlign:'center'}}/>
                      </div>
                      {/* Line total */}
                      <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:15, color:active?'#b8975a':'#ddd', textAlign:'right', padding:'0 16px 0 0', fontStyle:active?'normal':'italic' }}>
                        {active ? INR(line) : '—'}
                      </div>
                    </div>
                  );
                })}

                {/* Reset */}
                {pTotalQty>0 && (
                  <button onClick={()=>setQty({})}
                    style={{ marginTop:12, background:'none', border:'1px solid rgba(0,0,0,0.1)', padding:'7px 18px', cursor:'pointer', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', color:'#aaa', transition:'color .2s, border-color .2s' }}
                    onMouseEnter={e=>{e.currentTarget.style.color='#1a1a1a'; e.currentTarget.style.borderColor='rgba(0,0,0,0.3)';}}
                    onMouseLeave={e=>{e.currentTarget.style.color='#aaa'; e.currentTarget.style.borderColor='rgba(0,0,0,0.1)';}}>
                    Reset quantities
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: sticky summary */}
          <div style={{ position:'sticky', top:88 }}>
            <div style={{ background:'#0e1520', padding:'26px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'-40%', right:'-30%', width:200, height:200, border:'1px solid rgba(184,151,90,0.06)', borderRadius:'50%', pointerEvents:'none' }}/>
              <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.28em', textTransform:'uppercase', marginBottom:20 }}>Cost Summary</div>
              {pActive.length===0 ? (
                <div style={{ padding:'20px 0', textAlign:'center' }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:300, color:'rgba(255,255,255,0.18)', fontStyle:'italic' }}>Enter quantities</div>
                  <div style={{ fontFamily:"'Jost',sans-serif", fontSize:10, color:'rgba(255,255,255,0.12)', marginTop:8, letterSpacing:'0.1em' }}>to see order value</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {pActive.map(l=>(
                    <div key={l._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:12, color:'rgba(255,255,255,0.65)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.name}</div>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:10, color:'rgba(255,255,255,0.22)', marginTop:2 }}>{INR(l.price)} × {l.q.toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:14, color:'#d4b06a', flexShrink:0 }}>{INR(l.line)}</div>
                    </div>
                  ))}
                  <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid rgba(184,151,90,0.2)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                      <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'rgba(255,255,255,0.35)', letterSpacing:'0.2em', textTransform:'uppercase' }}>Total · {pTotalQty.toLocaleString('en-IN')} units</span>
                      <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:28, fontWeight:300, color:'#d4b06a', lineHeight:1 }}>{INR(pTotal)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop:16, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'rgba(255,255,255,0.22)', lineHeight:1.7, letterSpacing:'0.04em' }}>
                      * Indicative estimate. Final invoice includes GST, branding / customisation, and shipping.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ OFFSITE CALCULATOR ════ */}
      {!isProduct && (
        <div>
          {/* Type filter — only if both types present */}
          {hasDay && hasNight && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, padding:'12px 18px', background:'#fff', border:'1px solid rgba(0,0,0,0.07)', flexWrap:'wrap' }}>
              <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.22em', textTransform:'uppercase', marginRight:4, flexShrink:0 }}>Show</span>
              {[
                {k:'all',   l:`All (${offsiteItems.length})`},
                {k:'day',   l:`☀️ Day Outing (${offsiteItems.filter(i=>i.type!=='Night Stay').length})`},
                {k:'night', l:`🌙 Night Stay (${offsiteItems.filter(i=>i.type==='Night Stay').length})`},
              ].map(opt=>(
                <button key={opt.k} onClick={()=>setTypeFilter(opt.k)}
                  style={{ padding:'6px 18px', border:'none', cursor:'pointer', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'0.18em', textTransform:'uppercase', transition:'all .18s',
                    background: typeFilter===opt.k?'#b8975a':'transparent',
                    color:      typeFilter===opt.k?'#0e1520':'#888',
                    outline:    typeFilter===opt.k?'none':'1px solid rgba(0,0,0,0.12)',
                  }}>
                  {opt.l}
                </button>
              ))}
            </div>
          )}

          {/* Comparison bar — shown once any total is non-zero */}
          {visibleItems.length>1 && oAnyNonZero && (
            <div style={{ marginBottom:28, padding:'22px 26px', background:'#0e1520', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'-30%', right:'-10%', width:200, height:200, border:'1px solid rgba(184,151,90,0.04)', borderRadius:'50%', pointerEvents:'none' }}/>
              <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.28em', textTransform:'uppercase', marginBottom:16 }}>Property Comparison</div>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {visibleItems.map((item,i)=>{
                  const t = oTotals.find(x=>x._id===item._id) || {total:0};
                  return (
                    <div key={item._id} style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:150, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:13, color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{item.name}</div>
                      <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.06)', position:'relative', overflow:'hidden' }}>
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${t.total>0?Math.round(t.total/oMaxTotal*100):0}%`, background:'linear-gradient(90deg,#b8975a,#d4b06a)', transition:'width .5s cubic-bezier(.4,0,.2,1)' }}/>
                      </div>
                      <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:16, color:t.total>0?'#d4b06a':'rgba(255,255,255,0.18)', width:100, textAlign:'right', flexShrink:0 }}>
                        {t.total>0 ? INR(t.total) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-property rows */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {visibleItems.map((item,idx)=>{
              const isDayOut = item.type !== 'Night Stay';
              const c = calcs[item._id] || initProp(item);
              const total = calcTotal(item);
              const addons = addonList(item);
              const hasPackages = isDayOut && item.dayPackages?.length>0;
              const open = !!propOpen[item._id];

              return (
                <div key={item._id} style={{ border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden' }}>

                  {/* ── Collapsible header row ── */}
                  <button onClick={()=>setPropOpen(p=>({...p,[item._id]:!p[item._id]}))}
                    style={{ display:'flex', alignItems:'center', width:'100%', padding:'16px 22px', background: open?'#0e1520':'#fff', border:'none', cursor:'pointer', gap:14, transition:'background .2s' }}>
                    <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:open?'rgba(255,255,255,0.3)':'#ccc', letterSpacing:'0.18em', flexShrink:0 }}>Option {idx+1}</span>
                    <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:300, color:open?'white':'#1a1a1a', margin:0, lineHeight:1, flex:1, textAlign:'left' }}>{item.name}</h3>
                    <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:isDayOut?'#f59e0b':'#60a5fa', letterSpacing:'0.12em', textTransform:'uppercase', flexShrink:0 }}>
                      {isDayOut?'☀️ Day':'🌙 Night'}
                    </span>
                    {total>0 && (
                      <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:300, color:'#d4b06a', flexShrink:0, lineHeight:1 }}>{INR(total)}</span>
                    )}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={open?'rgba(255,255,255,0.4)':'#ccc'} strokeWidth="2"
                      style={{ transform:open?'rotate(0)':'rotate(-90deg)', transition:'transform .2s', flexShrink:0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {/* ── Expanded body ── */}
                  {open && (
                    <div style={{ padding:'22px 22px 18px', background:'#fff', display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                      {isDayOut ? (
                        <>
                          {/* Day Outing left: pax + package */}
                          <div>
                            <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:14 }}>Guests</div>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <button onClick={()=>upd(item._id,'pax',Math.max(0,(c.pax||0)-1))}
                                style={{ width:32, height:32, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', cursor:'pointer', fontSize:18, color:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                              <input type="number" min="0" value={c.pax||''} placeholder="0"
                                onChange={e=>upd(item._id,'pax',Math.max(0,Number(e.target.value)||0))}
                                onFocus={e=>e.target.style.borderColor='#b8975a'}
                                onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
                                style={{...inputSt, width:80}}/>
                              <button onClick={()=>upd(item._id,'pax',(c.pax||0)+1)}
                                style={{ width:32, height:32, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', cursor:'pointer', fontSize:18, color:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                              <span style={{ fontFamily:"'Jost',sans-serif", fontSize:11, color:'#888' }}>guests</span>
                            </div>
                            {hasPackages && (
                              <div style={{ marginTop:18 }}>
                                <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:10 }}>Package</div>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {item.dayPackages.map((pkg,pi)=>(
                                    <label key={pi} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', border:`1px solid ${c.pkgId===pi?'#b8975a':'rgba(0,0,0,0.08)'}`, cursor:'pointer', background:c.pkgId===pi?'rgba(184,151,90,0.04)':'#fff', transition:'all .15s' }}>
                                      <input type="radio" name={`pkg-${item._id}`} checked={c.pkgId===pi} onChange={()=>upd(item._id,'pkgId',pi)} style={{accentColor:'#b8975a'}}/>
                                      <div style={{ flex:1, fontFamily:"'Jost',sans-serif", fontSize:13, color:'#1a1a1a' }}>{pkg.name||`Package ${pi+1}`}</div>
                                      <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:15, color:'#b8975a', flexShrink:0 }}>{INR(pkg.sellingPrice)}<span style={{ fontSize:10, color:'#aaa', fontFamily:"'Jost',sans-serif" }}>/person</span></div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            {!hasPackages&&item.packagePrice>0&&(
                              <div style={{ marginTop:14, padding:'10px 14px', background:'#faf8f5', border:'1px solid rgba(0,0,0,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontFamily:"'Jost',sans-serif", fontSize:12, color:'#888' }}>Day Package rate</span>
                                <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:16, color:'#b8975a' }}>{INR(item.packagePrice)}<span style={{ fontSize:10, color:'#aaa', fontFamily:"'Jost',sans-serif" }}>/person</span></span>
                              </div>
                            )}
                          </div>
                          {/* Day Outing right: add-ons */}
                          {addons.length>0 && (
                            <div>
                              <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:14 }}>Add-ons</div>
                              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                {addons.map(a=>{
                                  const guests = c.pax||0;
                                  const effectiveVal = a.perPerson ? a.value * Math.max(1,guests) : a.value;
                                  const showMultiplied = a.perPerson && guests > 0 && c.addons[a.key];
                                  return (
                                    <label key={a.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', border:`1px solid ${c.addons[a.key]?'#b8975a':'rgba(0,0,0,0.08)'}`, cursor:'pointer', background:c.addons[a.key]?'rgba(184,151,90,0.04)':'#fff', transition:'all .15s' }}>
                                      <input type="checkbox" checked={!!c.addons[a.key]} onChange={()=>toggleAddon(item._id,a.key)} style={{accentColor:'#b8975a',width:15,height:15}}/>
                                      <span style={{ flex:1, fontFamily:"'Jost',sans-serif", fontSize:13, color:'#1a1a1a' }}>{a.label}</span>
                                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                                        {a.perPerson && (
                                          <span style={{ fontFamily:"'Jost',sans-serif", fontSize:8, color:'#b8975a', letterSpacing:'0.14em', textTransform:'uppercase', background:'rgba(184,151,90,0.1)', padding:'1px 6px' }}>per person</span>
                                        )}
                                        <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:15, color:'#b8975a' }}>
                                          {showMultiplied ? INR(effectiveVal) : INR(a.value)}
                                        </span>
                                        {showMultiplied && (
                                          <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa' }}>{INR(a.value)} × {guests}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                              {addons.some(a=>c.addons[a.key])&&(
                                <div style={{marginTop:10,padding:'8px 14px',background:'#faf8f5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                  <span style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:'#aaa',letterSpacing:'0.15em',textTransform:'uppercase'}}>Add-ons subtotal</span>
                                  <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:16,color:'#b8975a'}}>{INR(addons.filter(a=>c.addons[a.key]).reduce((s,a)=>{
                                    const guests=c.pax||0;
                                    return s+(a.perPerson?a.value*Math.max(1,guests):a.value);
                                  },0))}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Night Stay left: occupancy table + nights */}
                          <div>
                            <div style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:14 }}>Occupancy</div>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                              <thead>
                                <tr>
                                  {['Type','Price / Night','Rooms','Guests'].map((h,hi)=>(
                                    <th key={h} style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.18em', textTransform:'uppercase', textAlign:hi===0||hi===2?'left':'center', paddingBottom:10, fontWeight:400 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  {key:'single',label:'Single',price:item.singlePrice,guests:1},
                                  {key:'double',label:'Double',price:item.doublePrice,guests:2},
                                  {key:'triple',label:'Triple',price:item.triplePrice,guests:3},
                                  {key:'quad',  label:'Quad',  price:item.quadPrice,  guests:4},
                                ].filter(r=>r.price>0).map(r=>(
                                  <tr key={r.key} style={{borderTop:'1px solid rgba(0,0,0,0.05)'}}>
                                    <td style={{padding:'9px 0',fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:15,color:'#1a1a1a'}}>{r.label}</td>
                                    <td style={{padding:'9px 0',fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:14,color:'#888',textAlign:'center'}}>{INR(r.price)}</td>
                                    <td style={{padding:'9px 8px',textAlign:'left'}}>
                                      <input type="number" min="0" value={c[r.key]||''} placeholder="0"
                                        onChange={e=>upd(item._id,r.key,Math.max(0,Number(e.target.value)||0))}
                                        onFocus={e=>e.target.style.borderColor='#b8975a'}
                                        onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
                                        style={{...inputSt,width:64}}/>
                                    </td>
                                    <td style={{padding:'9px 0',fontFamily:"'Jost',sans-serif",fontSize:12,color:'#aaa',textAlign:'center'}}>
                                      {((c[r.key]||0)*r.guests)>0?`${(c[r.key]||0)*r.guests} guests`:'—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {/* Nights stepper */}
                            <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10, paddingTop:12, borderTop:'1px solid rgba(0,0,0,0.06)' }}>
                              <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa', letterSpacing:'0.22em', textTransform:'uppercase', flex:1 }}>Nights</span>
                              <button onClick={()=>upd(item._id,'nights',Math.max(1,(c.nights||1)-1))} style={{width:28,height:28,border:'1px solid rgba(0,0,0,0.12)',background:'#fff',cursor:'pointer',fontSize:16,color:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                              <input type="number" min="1" value={c.nights||1}
                                onChange={e=>upd(item._id,'nights',Math.max(1,Number(e.target.value)||1))}
                                onFocus={e=>e.target.style.borderColor='#b8975a'}
                                onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
                                style={{...inputSt,width:56}}/>
                              <button onClick={()=>upd(item._id,'nights',(c.nights||1)+1)} style={{width:28,height:28,border:'1px solid rgba(0,0,0,0.12)',background:'#fff',cursor:'pointer',fontSize:16,color:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                              <span style={{fontFamily:"'Jost',sans-serif",fontSize:11,color:'#888'}}>night{(c.nights||1)!==1?'s':''}</span>
                            </div>
                            {/* Guest summary tiles */}
                            {(()=>{
                              const tG=(c.single||0)*1+(c.double||0)*2+(c.triple||0)*3+(c.quad||0)*4;
                              const tR=(c.single||0)+(c.double||0)+(c.triple||0)+(c.quad||0);
                              if(tG===0) return null;
                              return (
                                <div style={{marginTop:12,padding:'8px 12px',background:'rgba(184,151,90,0.05)',border:'1px solid rgba(184,151,90,0.15)',display:'flex',gap:20}}>
                                  {[{v:tG,l:'Guests'},{v:tR,l:'Rooms'},{v:c.nights||1,l:`Night${(c.nights||1)!==1?'s':''}`}].map(({v,l})=>(
                                    <div key={l} style={{textAlign:'center'}}>
                                      <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:22,fontWeight:300,color:'#b8975a',lineHeight:1}}>{v}</div>
                                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:'#aaa',letterSpacing:'0.15em',marginTop:3}}>{l}</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          {/* Night Stay right: add-ons */}
                          {addons.length>0 && (
                            <div>
                              <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:'#aaa',letterSpacing:'0.22em',textTransform:'uppercase',marginBottom:14}}>Add-ons</div>
                              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                {addons.map(a=>{
                                  const guests=(c.single||0)*1+(c.double||0)*2+(c.triple||0)*3+(c.quad||0)*4;
                                  const effectiveVal = a.perPerson ? a.value * Math.max(1,guests) : a.value;
                                  const showMultiplied = a.perPerson && guests > 0 && c.addons[a.key];
                                  return (
                                    <label key={a.key} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',border:`1px solid ${c.addons[a.key]?'#b8975a':'rgba(0,0,0,0.08)'}`,cursor:'pointer',background:c.addons[a.key]?'rgba(184,151,90,0.04)':'#fff',transition:'all .15s'}}>
                                      <input type="checkbox" checked={!!c.addons[a.key]} onChange={()=>toggleAddon(item._id,a.key)} style={{accentColor:'#b8975a',width:15,height:15}}/>
                                      <span style={{flex:1,fontFamily:"'Jost',sans-serif",fontSize:13,color:'#1a1a1a'}}>{a.label}</span>
                                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                                        {a.perPerson && (
                                          <span style={{ fontFamily:"'Jost',sans-serif", fontSize:8, color:'#b8975a', letterSpacing:'0.14em', textTransform:'uppercase', background:'rgba(184,151,90,0.1)', padding:'1px 6px' }}>per person</span>
                                        )}
                                        <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:15,color:'#b8975a'}}>
                                          {showMultiplied ? INR(effectiveVal) : INR(a.value)}
                                        </span>
                                        {showMultiplied && (
                                          <span style={{ fontFamily:"'Jost',sans-serif", fontSize:9, color:'#aaa' }}>{INR(a.value)} × {guests}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                              {addons.some(a=>c.addons[a.key])&&(
                                <div style={{marginTop:10,padding:'8px 14px',background:'#faf8f5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                  <span style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:'#aaa',letterSpacing:'0.15em',textTransform:'uppercase'}}>Add-ons subtotal</span>
                                  <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:16,color:'#b8975a'}}>{INR(addons.filter(a=>c.addons[a.key]).reduce((s,a)=>{
                                    const guests=(c.single||0)*1+(c.double||0)*2+(c.triple||0)*3+(c.quad||0)*4;
                                    return s+(a.perPerson?a.value*Math.max(1,guests):a.value);
                                  },0))}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Total footer — shown when expanded or has a total */}
                  {(open || total>0) && total>0 && (
                    <div style={{padding:'12px 22px',background:'#faf8f5',borderTop:'1px solid rgba(0,0,0,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:'#aaa',letterSpacing:'0.18em',textTransform:'uppercase'}}>* Excl. GST, branding &amp; transport</div>
                      <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                        <span style={{fontFamily:"'Jost',sans-serif",fontSize:9,color:'#aaa',letterSpacing:'0.15em',textTransform:'uppercase'}}>Estimated Total</span>
                        <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:26,fontWeight:300,color:'#b8975a',lineHeight:1}}>{INR(total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global disclaimer */}
          <div style={{marginTop:24,padding:'14px 18px',border:'1px solid rgba(0,0,0,0.07)',background:'#fff'}}>
            <div style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:'#aaa',lineHeight:1.75,letterSpacing:'0.04em'}}>
              These figures are indicative estimates. Final invoice will include applicable GST, branding / decoration, and logistics charges. Please confirm your preferences with the team via the message board.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ClientPortalView;