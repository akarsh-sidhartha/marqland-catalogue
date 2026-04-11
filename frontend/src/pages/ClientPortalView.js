import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

// ── Inline icons ───────────────────────────────────────────────────────────────
const Ic = {
  send:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  attach: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  ext:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  pin:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  star:   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  file:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  close:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  share:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  zoom:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>,
};

const toINR  = v => `₹${Number(v||0).toLocaleString('en-IN')}`;
const fmtSz  = b => b>1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
const fmtT   = d => new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});

// ── Lightbox — fix 6 ───────────────────────────────────────────────────────────
const Lightbox = ({ src, alt, onClose }) => {
  useEffect(()=>{
    const fn = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',fn);
    return ()=>window.removeEventListener('keydown',fn);
  },[onClose]);
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.93)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:24,backdropFilter:'blur(10px)'}}>
      <button onClick={onClose} style={{position:'fixed',top:18,right:18,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'50%',width:42,height:42,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',zIndex:10000}}>
        {Ic.close}
      </button>
      <img src={src} alt={alt} onClick={e=>e.stopPropagation()}
        style={{maxWidth:'90vw',maxHeight:'85vh',borderRadius:12,objectFit:'contain',boxShadow:'0 40px 80px rgba(0,0,0,0.7)'}}/>
    </div>
  );
};

// ── Attachment download chip ───────────────────────────────────────────────────
const AttachChip = ({ att, isTeam }) => (
  <a href={att.url} target="_blank" rel="noreferrer" download={att.name}
    style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',background:isTeam?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)',borderRadius:8,textDecoration:'none',marginTop:4}}>
    <span style={{color:isTeam?'#e2e8f0':'#475569'}}>{Ic.file}</span>
    <span style={{fontSize:12,fontWeight:600,color:isTeam?'#e2e8f0':'#475569',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{att.name}</span>
    {att.size>0&&<span style={{fontSize:10,color:'#94a3b8'}}>{fmtSz(att.size)}</span>}
    <span style={{color:isTeam?'#94a3b8':'#64748b'}}>{Ic.dl}</span>
  </a>
);

// ── Pending file strip ─────────────────────────────────────────────────────────
const FileStrip = ({ files, onRemove }) => {
  if(!files.length) return null;
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px 16px 0'}}>
      {files.map((f,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:5,background:'#1e293b',border:'1px solid #334155',borderRadius:8,padding:'4px 8px'}}>
          <span style={{color:'#94a3b8'}}>{Ic.file}</span>
          <span style={{fontSize:11,color:'#94a3b8',maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
          <button onClick={()=>onRemove(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:0,display:'flex',marginLeft:2}}>{Ic.close}</button>
        </div>
      ))}
    </div>
  );
};

// ── 3D Glassmorphism card — fix 7 ─────────────────────────────────────────────
const GlassCard = ({ children, style={}, delay=0 }) => (
  <div style={{
    background:'linear-gradient(135deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.02) 60%,rgba(255,255,255,0.05) 100%)',
    border:'1px solid rgba(255,255,255,0.13)',
    borderRadius:20,
    backdropFilter:'blur(20px)',
    WebkitBackdropFilter:'blur(20px)',
    boxShadow:'0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)',
    position:'relative',
    overflow:'hidden',
    transition:'transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease, border-color 0.3s ease',
    animation:`fadeIn .45s ease ${delay}s both`,
    ...style,
  }}
    onMouseEnter={e=>{
      e.currentTarget.style.transform='translateY(-6px) scale(1.015)';
      e.currentTarget.style.boxShadow='0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 0 1px rgba(249,115,22,0.15)';
      e.currentTarget.style.borderColor='rgba(249,115,22,0.4)';
    }}
    onMouseLeave={e=>{
      e.currentTarget.style.transform='none';
      e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)';
      e.currentTarget.style.borderColor='rgba(255,255,255,0.13)';
    }}>
    {/* Top shimmer line */}
    <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.18) 50%,transparent 100%)',pointerEvents:'none'}}/>
    {/* Corner depth accent */}
    <div style={{position:'absolute',top:0,right:0,width:60,height:60,background:'radial-gradient(circle at top right,rgba(255,255,255,0.06),transparent 70%)',pointerEvents:'none'}}/>
    {children}
  </div>
);

// ── Price box ─────────────────────────────────────────────────────────────────
const PBox = ({ label, value, sub, amber }) => (
  <div style={{
    background:amber?'rgba(251,191,36,0.07)':'rgba(255,255,255,0.05)',
    border:`1px solid ${amber?'rgba(251,191,36,0.18)':'rgba(255,255,255,0.1)'}`,
    borderRadius:10,padding:'10px 14px',textAlign:'center',
    backdropFilter:'blur(8px)',
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)',
  }}>
    <div style={{fontSize:9,color:amber?'#f59e0b':'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{label}</div>
    <div style={{fontSize:17,fontWeight:800,color:amber?'#fbbf24':'#f1f5f9'}}>{toINR(value)}</div>
    {sub&&<div style={{fontSize:9,color:'#475569',marginTop:1}}>{sub}</div>}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const ClientPortalView = () => {
  const { slug }              = useParams();
  const [portal, setPortal]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('catalogue');
  const [msg, setMsg]         = useState('');
  const [files, setFiles]     = useState([]);
  const [sending, setSending] = useState(false);
  const [clientName, setClientName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const chatEnd = useRef(null);
  const fileRef = useRef(null);

  useEffect(()=>{ load(); fetch(`/api/portal/public/${slug}/view`,{method:'POST'}).catch(()=>{}); },[slug]);
  useEffect(()=>{ if(tab==='chat') chatEnd.current?.scrollIntoView({behavior:'smooth'}); },[portal?.messages,tab]);

  const load = async () => {
    try{
      const res  = await fetch(`/api/portal/public/${slug}`);
      if(!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setPortal(data);
      // Fix 4: use orderPlacedBy (contact person) as chat sender name
      const name = data.orderPlacedBy || data.clientName || '';
      setClientName(name);
      if(name) setNameSet(true);
    }catch(e){ setError(e.message||'Link invalid or expired.'); }
    finally   { setLoading(false); }
  };

  const send = async () => {
    if((!msg.trim()&&files.length===0)||sending) return;
    setSending(true);
    try{
      const fd = new FormData();
      fd.append('text', msg.trim());
      fd.append('senderName', clientName||'Client');
      files.forEach(f=>fd.append('files',f));
      const r = await fetch(`/api/portal/public/${slug}/message`,{method:'POST',body:fd});
      if(!r.ok) throw new Error();
      setMsg(''); setFiles([]);
      await load();
    }finally{ setSending(false); }
  };

  if(loading) return (
    <div style={{minHeight:'100vh',background:'#0a0f1e',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',color:'#64748b',fontFamily:'system-ui'}}>
        <div style={{width:36,height:36,border:'3px solid #1e293b',borderTopColor:'#f97316',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 14px'}}/>
        <p style={{fontSize:13}}>Loading your portal...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(error) return (
    <div style={{minHeight:'100vh',background:'#0a0f1e',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui',padding:24}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>🔗</div>
        <h1 style={{color:'#f1f5f9',fontSize:20,marginBottom:8,fontWeight:800}}>Link not found</h1>
        <p style={{color:'#64748b',fontSize:14}}>{error}</p>
      </div>
    </div>
  );

  if(portal.status==='completed') return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0f1e,#0f172a 60%,#1a0a2e)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui",padding:24}}>
      <div style={{textAlign:'center',maxWidth:520}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.25)',borderRadius:10,padding:'8px 16px',marginBottom:36}}>
          <div style={{width:22,height:22,background:'#f97316',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:11}}>M</div>
          <span style={{color:'#f1f5f9',fontWeight:700,fontSize:13,letterSpacing:'0.05em',textTransform:'uppercase'}}>Marqland Studios</span>
        </div>
        <div style={{fontSize:72,marginBottom:20}}>🎉</div>
        <h1 style={{color:'#f1f5f9',fontWeight:800,fontSize:28,marginBottom:12,lineHeight:1.2}}>Thank you, {portal.clientName}!</h1>
        <p style={{color:'#64748b',fontSize:16,lineHeight:1.8,marginBottom:40}}>It was our pleasure working with you. We hope the experience exceeded expectations.</p>
        {portal.reviewLink&&<a href={portal.reviewLink} target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',gap:10,background:'#f97316',color:'#fff',padding:'14px 28px',borderRadius:12,textDecoration:'none',fontWeight:700,fontSize:15}}>
          {Ic.star} Share your experience
        </a>}
        <p style={{color:'#334155',fontSize:11,marginTop:40}}>Order {portal.orderRef}</p>
      </div>
    </div>
  );

  const items   = portal.type==='product' ? portal.productItems : portal.offsiteItems;
  const newMsgs = portal.messages?.filter(m=>m.sender==='team').length||0;

  return (
    <div style={{minHeight:'100vh',background:'#0a0f1e',fontFamily:"'DM Sans',system-ui,sans-serif",color:'#f1f5f9'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0f172a}::-webkit-scrollbar-thumb{background:#334155;border-radius:10px}
        textarea{resize:none}
        .img-zoom:hover{transform:scale(1.05)!important}
      `}</style>

      {lightbox&&<Lightbox src={lightbox.src} alt={lightbox.alt} onClose={()=>setLightbox(null)}/>}

      {/* NAV — fix 2: removed OBSIDIAN */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(10,15,30,0.88)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 24px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:26,height:26,background:'#f97316',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:11}}>M</div>
            <span style={{color:'#f97316',fontWeight:800,fontSize:13,letterSpacing:'0.02em'}}>MARQLAND STUDIOS</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <span style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.25)',color:'#4ade80',fontSize:10,fontWeight:700,padding:'4px 10px',borderRadius:20,letterSpacing:'0.06em',textTransform:'uppercase'}}>
              ● {portal.status==='active'?'Active':portal.status}
            </span>
            <span style={{color:'#475569',fontSize:12,fontFamily:'monospace'}}>ID: {portal.orderRef}</span>
            <button onClick={()=>navigator.clipboard.writeText(window.location.href)}
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'6px 8px',cursor:'pointer',color:'#64748b',display:'flex',alignItems:'center'}}
              title="Copy link">{Ic.share}</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:'rgba(10,15,30,0.6)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 24px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex'}}>
          {[{k:'catalogue',l:'Catalogue Options',b:items.length},{k:'chat',l:'Message Board',b:newMsgs||null}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{padding:'14px 20px',background:'none',border:'none',borderBottom:tab===t.k?'2px solid #f97316':'2px solid transparent',color:tab===t.k?'#f97316':'#64748b',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all .15s'}}>
              {t.l}
              {t.b?<span style={{background:tab===t.k?'rgba(249,115,22,0.2)':'rgba(255,255,255,0.06)',color:tab===t.k?'#f97316':'#64748b',fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:10}}>{t.b}</span>:null}
            </button>
          ))}
        </div>
      </div>

      {/* HERO */}
      {tab==='catalogue'&&(
        <div style={{background:'linear-gradient(180deg,rgba(249,115,22,0.06) 0%,transparent 100%)',padding:'32px 24px 20px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
          <div style={{maxWidth:1100,margin:'0 auto'}}>
            <div style={{display:'inline-block',background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:6,padding:'3px 10px',fontSize:10,color:'#f97316',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>
              {portal.type==='product'?'🎁 Product Gifting':'🏨 Exclusive Offsite'} · {portal.orderRef}
            </div>
            <h1 style={{fontSize:24,fontWeight:800,color:'#f1f5f9',margin:'0 0 8px',letterSpacing:'-0.02em',lineHeight:1.2}}>
              {portal.title||`Curated options for ${portal.clientName}`}
            </h1>
            {portal.teamNote&&<p style={{color:'#64748b',fontSize:14,lineHeight:1.7,maxWidth:600,margin:0}}>{portal.teamNote}</p>}
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 24px 60px'}}>

        {/* CATALOGUE */}
        {tab==='catalogue'&&(
          items.length===0
          ? <div style={{textAlign:'center',padding:'80px 0',color:'#334155'}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <p style={{fontSize:15,fontWeight:600,color:'#475569'}}>Options are being curated</p>
              <p style={{fontSize:13,marginTop:6,color:'#334155'}}>The Marqland team will update this shortly.</p>
            </div>
          : portal.type==='product'
            ? <ProductBento items={items} onZoom={setLightbox}/>
            : <OffsiteCards items={items} onZoom={setLightbox}/>
        )}

        {/* CHAT */}
        {tab==='chat'&&(
          <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:20,alignItems:'start'}}>

            {/* Sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:18}}>
                <div style={{fontSize:9,fontWeight:800,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Current Project</div>
                <div style={{fontWeight:800,fontSize:15,color:'#f1f5f9',lineHeight:1.3,marginBottom:4}}>{portal.title||portal.orderRef}</div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>{portal.clientName}</div>
                {['Message Board','Catalogue Options'].map(it=>(
                  <button key={it} onClick={()=>{if(it==='Catalogue Options')setTab('catalogue');}}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:it==='Message Board'?'rgba(249,115,22,0.1)':'none',border:'none',borderRadius:9,cursor:'pointer',color:it==='Message Board'?'#f97316':'#64748b',fontSize:13,fontWeight:600,textAlign:'left',width:'100%',marginBottom:2}}>
                    <span>{it==='Message Board'?'💬':'🗂'}</span>{it}
                  </button>
                ))}
              </div>
              <div style={{background:'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06))',border:'1px solid rgba(249,115,22,0.2)',borderRadius:14,padding:18}}>
                <div style={{fontSize:9,fontWeight:800,color:'#f97316',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Your Marqland Contact</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,background:'rgba(249,115,22,0.2)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>M</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:'#f1f5f9'}}>Marqland Team</div>
                    <div style={{fontSize:11,color:'#64748b'}}>Response · under 1 hour</div>
                  </div>
                </div>
              </div>
              {items.length>0&&(
                <div>
                  <div style={{fontSize:9,fontWeight:800,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Quick Reference</div>
                  {items.slice(0,3).map((it,i)=>(
                    <div key={i} onClick={()=>setTab('catalogue')}
                      style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:10,padding:'8px 10px',marginBottom:6,cursor:'pointer'}}>
                      <div style={{width:30,height:30,borderRadius:7,background:'#1e293b',overflow:'hidden',flexShrink:0}}>
                        {it.imageUrl&&<img src={it.imageUrl} alt={it.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}</div>
                        <div style={{fontSize:10,color:'#475569'}}>{portal.type==='product'?toINR(it.price):it.location||'—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat window */}
            <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,display:'flex',flexDirection:'column',minHeight:560}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:34,height:34,background:'rgba(249,115,22,0.15)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>🏢</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:'#f1f5f9'}}>Chatting with: Marqland Team</div>
                  <div style={{fontSize:11,color:'#4ade80'}}>● Online · Response time under 1 hour</div>
                </div>
              </div>

              {!nameSet&&(
                <div style={{padding:'10px 18px',background:'rgba(59,130,246,0.05)',borderBottom:'1px solid rgba(59,130,246,0.1)'}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input value={clientName} onChange={e=>setClientName(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&clientName.trim())setNameSet(true);}}
                      placeholder="Your name so we know who's messaging"
                      style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'7px 12px',color:'#f1f5f9',fontSize:13,outline:'none'}}/>
                    <button onClick={()=>{if(clientName.trim())setNameSet(true);}} disabled={!clientName.trim()}
                      style={{background:'#3b82f6',border:'none',borderRadius:8,padding:'7px 13px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',opacity:clientName.trim()?1:0.4}}>
                      Set
                    </button>
                  </div>
                </div>
              )}

              <div style={{flex:1,overflowY:'auto',padding:'16px 18px',display:'flex',flexDirection:'column',gap:14}}>
                {portal.messages.length===0&&(
                  <div style={{textAlign:'center',padding:'40px 0',color:'#334155'}}>
                    <div style={{fontSize:32,marginBottom:10}}>💬</div>
                    <p style={{fontSize:13}}>No messages yet. Ask us anything!</p>
                  </div>
                )}
                {portal.messages.map(m=>{
                  const isT=m.sender==='team';
                  return(
                    <div key={m._id} style={{display:'flex',justifyContent:isT?'flex-start':'flex-end'}}>
                      {isT&&<div style={{width:26,height:26,background:'rgba(249,115,22,0.2)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,marginRight:8,flexShrink:0,alignSelf:'flex-end',marginBottom:2}}>M</div>}
                      <div style={{maxWidth:'72%'}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#475569',marginBottom:3,textAlign:isT?'left':'right'}}>{m.senderName} · {fmtT(m.createdAt)}</div>
                        <div style={{background:isT?'rgba(255,255,255,0.06)':'#f97316',border:isT?'1px solid rgba(255,255,255,0.08)':'none',borderRadius:isT?'4px 14px 14px 14px':'14px 14px 4px 14px',padding:'10px 14px'}}>
                          {m.text&&<div style={{fontSize:14,lineHeight:1.6,color:isT?'#e2e8f0':'#fff'}}>{m.text}</div>}
                          {(m.attachments||[]).map((a,i)=><AttachChip key={i} att={a} isTeam={isT}/>)}
                        </div>
                      </div>
                      {!isT&&<div style={{width:26,height:26,background:'rgba(249,115,22,0.3)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#f97316',marginLeft:8,flexShrink:0,alignSelf:'flex-end',marginBottom:2}}>
                        {(clientName||'C').slice(0,2).toUpperCase()}
                      </div>}
                    </div>
                  );
                })}
                <div ref={chatEnd}/>
              </div>

              {/* Fix 5: no attach in catalogue, only in chat. Fix 3: attach is wired */}
              <FileStrip files={files} onRemove={i=>setFiles(files.filter((_,idx)=>idx!==i))}/>

              <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                  <div style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'10px 14px'}}>
                    <textarea value={msg} onChange={e=>setMsg(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                      placeholder="Type your message... (Enter to send)"
                      rows={2}
                      style={{background:'none',border:'none',outline:'none',color:'#f1f5f9',fontSize:14,fontFamily:'inherit',lineHeight:1.5,width:'100%'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5,paddingTop:5,borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                      <button onClick={()=>fileRef.current?.click()}
                        style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:2,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,transition:'color .15s'}}
                        onMouseEnter={e=>e.currentTarget.style.color='#f97316'}
                        onMouseLeave={e=>e.currentTarget.style.color='#64748b'}
                        title="Attach files">
                        {Ic.attach} <span>Attach file</span>
                      </button>
                      <span style={{fontSize:10,color:'#334155'}}>Max 5 files · 10MB each</span>
                      <input ref={fileRef} type="file" multiple
                        onChange={e=>{setFiles(p=>[...p,...Array.from(e.target.files||[])].slice(0,5));e.target.value='';}}
                        style={{display:'none'}}/>
                    </div>
                  </div>
                  <button onClick={send} disabled={sending||(!msg.trim()&&files.length===0)}
                    style={{width:44,height:44,background:'#f97316',border:'none',borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',opacity:(sending||(!msg.trim()&&files.length===0))?0.4:1,transition:'opacity .2s',flexShrink:0}}>
                    {sending?<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>:Ic.send}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{borderTop:'1px solid rgba(255,255,255,0.04)',padding:'18px 24px',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:5}}>
          <div style={{width:16,height:16,background:'#f97316',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:9}}>M</div>
          <span style={{color:'#334155',fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase'}}>Marqland Studios</span>
        </div>
        <p style={{color:'#1e293b',fontSize:10}}>This is a private proposal. Please do not share this link.</p>
      </div>
    </div>
  );
};

// ── Single product card with orientation-aware Bento sizing ──────────────────
const BentoCard = ({ item, idx, onZoom, span }) => (
  <GlassCard delay={idx*0.05} style={{
    gridColumn: span==='wide' ? 'span 2' : 'span 1',
    gridRow:    span==='tall' ? 'span 2' : 'span 1',
  }}>
    {/* Image — natural aspect ratio via padding trick */}
    <div style={{
      position:'relative',
      paddingBottom: span==='wide' ? '42%' : span==='tall' ? '120%' : '75%',
      background:'#0a0f1e',
      overflow:'hidden',
      borderRadius:'20px 20px 0 0',
      cursor:item.imageUrl?'zoom-in':'default',
    }}
      onClick={()=>{ if(item.imageUrl) onZoom({src:item.imageUrl,alt:item.name}); }}>
      {item.imageUrl
        ? <img src={item.imageUrl} alt={item.name} className="img-zoom"
            style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',transition:'transform .45s ease'}}/>
        : <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#1e293b',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>No image</div>
      }
      {/* bottom gradient for text legibility */}
      <div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(0,0,0,0.65) 0%,transparent 55%)',pointerEvents:'none'}}/>
      {/* category/sub badge bottom-left over image */}
      <div style={{position:'absolute',bottom:10,left:10,display:'flex',gap:5,flexWrap:'wrap'}}>
        {item.category&&<span style={{background:'rgba(249,115,22,0.85)',color:'#fff',fontSize:9,fontWeight:800,padding:'3px 8px',borderRadius:5,backdropFilter:'blur(4px)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{item.category}</span>}
        {item.subCategory&&<span style={{background:'rgba(255,255,255,0.15)',color:'#e2e8f0',fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:5,backdropFilter:'blur(4px)',textTransform:'uppercase',letterSpacing:'0.04em'}}>{item.subCategory}</span>}
      </div>
      {item.imageUrl&&<div style={{position:'absolute',top:10,right:10,background:'rgba(0,0,0,0.5)',color:'#94a3b8',borderRadius:6,padding:'3px 6px',display:'flex',alignItems:'center',gap:3,fontSize:9,backdropFilter:'blur(4px)'}}>{Ic.zoom}</div>}
    </div>
    <div style={{padding:'14px 16px 18px'}}>
      <h3 style={{fontSize:15,fontWeight:800,color:'#f1f5f9',marginBottom:5,lineHeight:1.3}}>{item.name}</h3>
      {item.description&&<p style={{fontSize:11,color:'#64748b',lineHeight:1.6,marginBottom:12,display:'-webkit-box',WebkitLineClamp:span==='wide'?3:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.description}</p>}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        <div>
          <div style={{fontSize:8,color:'#475569',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>Price per unit</div>
          <div style={{fontSize:20,fontWeight:800,color:'#f97316',lineHeight:1}}>{toINR(item.price)}</div>
        </div>
      </div>
    </div>
  </GlassCard>
);

// ── Product Bento — grouped by category, filter bar, orientation-aware grid ───
const ProductBento = ({ items, onZoom }) => {
  // null = show all categories; string = spotlight one category
  const [activeCategory, setActiveCategory] = React.useState(null);
  const [activeSubCat,   setActiveSubCat]   = React.useState(null);
  const [imgSpans, setImgSpans] = React.useState({});

  const handleImgLoad = (id, e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    const ratio = w / h;
    setImgSpans(prev => ({ ...prev, [id]: ratio >= 1.6 ? 'wide' : ratio <= 0.7 ? 'tall' : 'square' }));
  };

  // Only categories that actually have items
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  // Subcategories within the selected category only
  const subCatsInActive = activeCategory
    ? [...new Set(items.filter(i => i.category === activeCategory).map(i => i.subCategory).filter(Boolean))]
    : [];

  // Items after filter
  const filtered = items.filter(i => {
    const catOk = !activeCategory || i.category === activeCategory;
    const subOk = !activeSubCat   || i.subCategory === activeSubCat;
    return catOk && subOk;
  });

  // Build ordered groups — preserving category order from items array
  const groupMap = new Map();
  filtered.forEach(item => {
    const cat = item.category || 'Other';
    if (!groupMap.has(cat)) groupMap.set(cat, []);
    groupMap.get(cat).push(item);
  });
  const groups = Array.from(groupMap.entries()).map(([cat, its]) => ({ cat, items: its }));

  const chipBase = {
    padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    transition: 'all .18s',
  };
  const chip = (active) => ({
    ...chipBase,
    background: active ? '#f97316'              : 'rgba(255,255,255,0.06)',
    color:      active ? '#fff'                 : '#64748b',
    boxShadow:  active ? '0 4px 14px rgba(249,115,22,0.4)' : 'none',
  });
  const subChip = (active) => ({
    ...chipBase,
    padding: '4px 12px', fontSize: 10,
    background: active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
    color:      active ? '#f97316'               : '#475569',
    border:     active ? '1px solid rgba(249,115,22,0.45)' : '1px solid rgba(255,255,255,0.08)',
  });

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{marginBottom:28,padding:'16px 20px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,backdropFilter:'blur(12px)'}}>
        {/* Category chips — no "All"; clicking active one deselects (shows all) */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
          <span style={{fontSize:9,fontWeight:800,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginRight:4}}>Category</span>
          {categories.map(cat => (
            <button key={cat} style={chip(activeCategory===cat)}
              onClick={() => {
                if (activeCategory === cat) { setActiveCategory(null); setActiveSubCat(null); }
                else { setActiveCategory(cat); setActiveSubCat(null); }
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Subcategory chips — only when a category is active AND it has subcats */}
        {activeCategory && subCatsInActive.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',alignItems:'center'}}>
            <span style={{fontSize:9,fontWeight:800,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginRight:4}}>Type</span>
            {subCatsInActive.map(sc => (
              <button key={sc} style={subChip(activeSubCat===sc)}
                onClick={() => setActiveSubCat(activeSubCat===sc ? null : sc)}>
                {sc}
              </button>
            ))}
          </div>
        )}

        <div style={{marginTop:10,fontSize:11,color:'#475569'}}>
          <span style={{fontWeight:700,color:'#f97316'}}>{filtered.length}</span>
          {' '}option{filtered.length!==1?'s':''} curated for you
          {activeCategory && <span style={{color:'#334155'}}> in <span style={{color:'#f97316'}}>{activeCategory}</span>{activeSubCat ? ` › ${activeSubCat}` : ''}</span>}
        </div>
      </div>

      {/* ── Category groups — always shown, never collapsed ── */}
      {groups.map((group, gi) => (
        <div key={group.cat} style={{marginBottom:48}}>
          {/* Category section header */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
            <div style={{
              fontSize:10, fontWeight:800, color:'#f97316',
              textTransform:'uppercase', letterSpacing:'0.12em', whiteSpace:'nowrap',
              padding:'5px 14px', background:'rgba(249,115,22,0.1)',
              border:'1px solid rgba(249,115,22,0.25)', borderRadius:20,
            }}>
              {group.cat}
            </div>
            <div style={{flex:1,height:1,background:'linear-gradient(90deg,rgba(249,115,22,0.25),transparent)'}}/>
            <div style={{fontSize:10,color:'#334155',fontWeight:600,flexShrink:0}}>
              {group.items.length} item{group.items.length!==1?'s':''}
            </div>
          </div>

          {/* Sub-group by subcategory within each category section */}
          {(() => {
            const subMap = new Map();
            group.items.forEach(item => {
              const sub = item.subCategory || '';
              if (!subMap.has(sub)) subMap.set(sub, []);
              subMap.get(sub).push(item);
            });
            const subGroups = Array.from(subMap.entries());
            return subGroups.map(([sub, subItems]) => (
              <div key={sub||'main'} style={{marginBottom:24}}>
                {/* Subcategory label — only if there is one and if there are multiple subgroups */}
                {sub && subGroups.length > 1 && (
                  <div style={{fontSize:9,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12,paddingLeft:2}}>
                    — {sub}
                  </div>
                )}
                {/* Bento grid */}
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(4,1fr)',
                  gridAutoRows:'220px',
                  gap:14,
                  gridAutoFlow:'dense',
                }}>
                  {subItems.map((item, idx) => {
                    const span = imgSpans[item._id] || 'square';
                    return (
                      <GlassCard key={item._id} delay={(gi*0.1)+(idx*0.04)} style={{
                        gridColumn: span==='wide' ? 'span 2' : 'span 1',
                        gridRow:    span==='tall' ? 'span 2' : 'span 1',
                        display:'flex', flexDirection:'column',
                      }}>
                        {/* Image */}
                        <div style={{
                          flex:1, position:'relative', overflow:'hidden',
                          borderRadius:'20px 20px 0 0',
                          cursor:item.imageUrl?'zoom-in':'default',
                          minHeight:0,
                        }}
                          onClick={()=>{ if(item.imageUrl) onZoom({src:item.imageUrl,alt:item.name}); }}>
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} className="img-zoom"
                                style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0,transition:'transform .45s ease'}}
                                onLoad={e=>handleImgLoad(item._id, e)}/>
                            : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#1e293b',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',position:'absolute',inset:0}}>No image</div>
                          }
                          <div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(0,0,0,0.72) 0%,transparent 52%)',pointerEvents:'none'}}/>
                          {/* Category + sub badges */}
                          <div style={{position:'absolute',bottom:10,left:10,display:'flex',gap:5,flexWrap:'wrap'}}>
                            {item.category&&<span style={{background:'rgba(249,115,22,0.9)',color:'#fff',fontSize:8,fontWeight:800,padding:'3px 7px',borderRadius:4,backdropFilter:'blur(4px)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{item.category}</span>}
                            {item.subCategory&&<span style={{background:'rgba(255,255,255,0.2)',color:'#f1f5f9',fontSize:8,fontWeight:700,padding:'3px 7px',borderRadius:4,backdropFilter:'blur(4px)',textTransform:'uppercase',letterSpacing:'0.04em'}}>{item.subCategory}</span>}
                          </div>
                          {item.imageUrl&&<div style={{position:'absolute',top:9,right:9,background:'rgba(0,0,0,0.5)',color:'#94a3b8',borderRadius:6,padding:'3px 6px',display:'flex',alignItems:'center',gap:3,fontSize:9,backdropFilter:'blur(4px)'}}>{Ic.zoom}</div>}
                        </div>
                        {/* Info */}
                        <div style={{padding:'11px 13px 13px',flexShrink:0}}>
                          <div style={{fontSize:13,fontWeight:800,color:'#f1f5f9',marginBottom:2,lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                          {item.description && span!=='square' && (
                            <p style={{fontSize:10,color:'#64748b',lineHeight:1.5,marginBottom:6,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.description}</p>
                          )}
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:7,borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                            <div style={{fontSize:16,fontWeight:800,color:'#f97316'}}>{toINR(item.price)}</div>
                            <div style={{fontSize:8,color:'#475569',fontWeight:700,textTransform:'uppercase'}}>per unit</div>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      ))}

      {filtered.length===0&&(
        <div style={{textAlign:'center',padding:'60px 0',color:'#334155'}}>
          <div style={{fontSize:32,marginBottom:10}}>🔍</div>
          <p style={{fontSize:14,fontWeight:600,color:'#475569'}}>No items found</p>
          <p style={{fontSize:12,color:'#334155',marginTop:6}}>Try selecting a different category</p>
        </div>
      )}
    </div>
  );
};


// ── Offsite Cards — 3D Glass, fix 5, fix 6, fix 7 ─────────────────────────────
const OffsiteCards = ({ items, onZoom }) => (
  <div>
    <p style={{fontSize:12,color:'#475569',marginBottom:20,fontWeight:600}}>{items.length} propert{items.length!==1?'ies':'y'} selected for you</p>
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      {items.map((item,idx)=>(
        <GlassCard key={item._id} delay={idx*0.1} style={{borderRadius:22}}>
          {/* Top section: fixed-height image + info — image never stretches */}
          <div style={{display:'grid',gridTemplateColumns:'300px 1fr',height:260,borderRadius:'22px 22px 0 0',overflow:'hidden'}}>
            {/* Image — locked to 260px height */}
            <div style={{position:'relative',height:260,cursor:item.imageUrl?'zoom-in':'default',overflow:'hidden'}}
              onClick={()=>{ if(item.imageUrl) onZoom({src:item.imageUrl,alt:item.name}); }}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="img-zoom"
                    style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .5s ease'}}/>
                : <div style={{width:'100%',height:'100%',background:'#0f172a',display:'flex',alignItems:'center',justifyContent:'center',color:'#1e293b',fontSize:12}}>No image</div>
              }
              <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(0,0,0,0.25) 0%,transparent 60%)',pointerEvents:'none'}}/>
              <div style={{position:'absolute',top:14,left:14,background:'rgba(10,15,30,0.72)',color:'#94a3b8',fontSize:9,fontWeight:800,padding:'4px 10px',borderRadius:6,backdropFilter:'blur(6px)'}}>Option {idx+1}</div>
              <div style={{position:'absolute',bottom:14,left:14,background:item.type==='Night Stay'?'rgba(29,78,216,0.85)':'rgba(180,83,9,0.85)',color:'#fff',fontSize:9,fontWeight:700,padding:'4px 10px',borderRadius:6,backdropFilter:'blur(4px)'}}>
                {item.type==='Night Stay'?'🌙 Night Stay':'☀️ Day Outing'}
              </div>
              {item.imageUrl&&<div style={{position:'absolute',bottom:14,right:14,background:'rgba(0,0,0,0.55)',color:'#94a3b8',borderRadius:6,padding:'4px 7px',display:'flex',alignItems:'center',gap:3,fontSize:10,backdropFilter:'blur(4px)'}}>{Ic.zoom} Expand</div>}
            </div>
            {/* Property info — fits inside the 260px row */}
            <div style={{padding:'22px 26px',display:'flex',flexDirection:'column',justifyContent:'space-between',overflow:'hidden'}}>
              <div>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                  <div>
                    <h3 style={{fontSize:20,fontWeight:800,color:'#f1f5f9',marginBottom:4,lineHeight:1.2}}>{item.name}</h3>
                    <div style={{display:'flex',alignItems:'center',gap:5,color:'#64748b',fontSize:13}}>
                      <span style={{color:'#f97316'}}>{Ic.pin}</span>{item.location||'Location TBD'}
                    </div>
                  </div>
                  {item.website&&(
                    <a href={item.website.startsWith('http')?item.website:`https://${item.website}`} target="_blank" rel="noreferrer"
                      style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#f97316',fontWeight:600,textDecoration:'none',background:'rgba(249,115,22,0.1)',padding:'6px 12px',borderRadius:8,whiteSpace:'nowrap',border:'1px solid rgba(249,115,22,0.2)',flexShrink:0}}>
                      {Ic.ext} Visit
                    </a>
                  )}
                </div>
                {item.details&&<p style={{fontSize:12,color:'#64748b',lineHeight:1.6,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.details}</p>}
              </div>
              {/* Night Stay: prices inside the top row */}
              {item.type==='Night Stay'&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
                  {item.singlePrice>0&&<PBox label="Single" value={item.singlePrice} sub="per night"/>}
                  {item.doublePrice>0&&<PBox label="Double" value={item.doublePrice} sub="per night"/>}
                  {item.triplePrice>0&&<PBox label="Triple" value={item.triplePrice} sub="per night"/>}
                  {item.djCost>0&&<PBox label="DJ" value={item.djCost} amber/>}
                  {item.cocktailSnacks>0&&<PBox label="Cocktails" value={item.cocktailSnacks} amber/>}
                  {item.banquetHall>0&&<PBox label="Banquet" value={item.banquetHall} amber/>}
                </div>
              )}
              {/* Day Outing: add-ons in top row, packages expand below */}
              {item.type!=='Night Stay'&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
                  {(!item.dayPackages||item.dayPackages.length===0)&&item.packagePrice>0&&<PBox label="Day package" value={item.packagePrice} sub="per person"/>}
                  {item.djCost>0&&<PBox label="DJ" value={item.djCost} amber/>}
                  {item.cocktailSnacks>0&&<PBox label="Cocktails" value={item.cocktailSnacks} amber/>}
                </div>
              )}
            </div>
          </div>

          {/* Day Packages — full-width section below the fixed image row */}
          {item.type!=='Night Stay'&&item.dayPackages&&item.dayPackages.length>0&&(
            <div style={{padding:'20px 24px 24px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{fontSize:10,fontWeight:800,color:'#f59e0b',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>
                ☀️ Day Packages — {item.dayPackages.length} option{item.dayPackages.length!==1?'s':''}
              </div>
              {/* Responsive grid: 1 col on narrow, 2 cols when wide enough, always consistent */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {item.dayPackages.map((pkg,pi)=>(
                  <div key={pi} style={{
                    background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,191,36,0.03))',
                    border:'1px solid rgba(251,191,36,0.2)',
                    borderRadius:14,
                    padding:'14px 16px',
                    display:'flex',
                    flexDirection:'column',
                    gap:10,
                  }}>
                    {/* Name + price on top */}
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                      <div style={{fontWeight:800,fontSize:14,color:'#f1f5f9',lineHeight:1.2,flex:1}}>
                        {pkg.name||`Package ${pi+1}`}
                      </div>
                      {pkg.sellingPrice>0&&(
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:19,fontWeight:800,color:'#fbbf24',lineHeight:1}}>
                            ₹{Number(pkg.sellingPrice).toLocaleString('en-IN')}
                          </div>
                          <div style={{fontSize:9,color:'#f59e0b',fontWeight:600,marginTop:2}}>per person</div>
                        </div>
                      )}
                    </div>
                    {/* Activities — split by newline or comma */}
                    {pkg.activities&&(
                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                        {pkg.activities
                          .split(/[\n,]+/)
                          .map(s=>s.trim())
                          .filter(Boolean)
                          .map((line,li)=>(
                            <div key={li} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:'#94a3b8',lineHeight:1.4}}>
                              <span style={{color:'#f59e0b',flexShrink:0,fontSize:11,marginTop:1}}>✓</span>
                              <span>{line}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {item.note&&<div style={{marginTop:14,background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.15)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#fb923c',fontStyle:'italic'}}>💡 {item.note}</div>}
            </div>
          )}
          {/* Night stay note */}
          {item.type==='Night Stay'&&item.note&&(
            <div style={{padding:'0 24px 18px'}}>
              <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.15)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#fb923c',fontStyle:'italic'}}>💡 {item.note}</div>
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  </div>
);

export default ClientPortalView;