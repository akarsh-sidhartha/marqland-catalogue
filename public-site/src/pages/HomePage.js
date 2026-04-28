import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
  Link2,
  Mail,
  X,
  ChevronLeft,
  ShoppingBag,
  Palette,
  CheckCircle,
  Truck,
  ArrowUpRight,
  Check,
  Quote,
  Menu,
} from 'lucide-react';

const InstagramIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const API_BASE   = process.env.REACT_APP_API_BASE   || '';
const IMAGE_BASE = process.env.REACT_APP_IMAGE_BASE || '';

// Bento span class per card index
const getBentoClass = (index) => {
  const p = [
    'ms-bento-2c2r', // 0: big feature card
    '',              // 1: 1x1
    '',              // 2: 1x1
    'ms-bento-2r',   // 3: tall
    'ms-bento-2c',   // 4: wide
    '',              // 5: 1x1
    '',              // 6: 1x1
  ];
  return p[index % p.length];
};

const useInView = (threshold = 0.12) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
};

const FadeIn = ({ children, delay = 0, className = '', style = {} }) => {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(22px)',
      transition: `opacity 0.75s ease ${delay}s, transform 0.75s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  );
};

const FontLoader = () => {
  useEffect(() => {
    if (document.querySelector('#ms-gf')) return;
    const l = document.createElement('link');
    l.id = 'ms-gf';
    l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap';
    l.rel = 'stylesheet';
    document.head.appendChild(l);
  }, []);
  return null;
};

// ── Testimonials Page ─────────────────────────────────────────────────────────
const TestimonialsPage = ({ data, onBack, onInquiry }) => {
  const cols = [[], [], []];
  (data.testimonials || []).forEach((t, i) => cols[i % 3].push({ ...t, _i: i }));

  return (
    <div style={{ paddingTop: 68 }}>
      {/* Hero strip */}
      <div className="grain" style={{ background: 'var(--navy)', padding: '72px 48px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', right: '5%', width: 400, height: 400, border: '1px solid rgba(184,151,90,0.05)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: '-25%', right: '2%', width: 560, height: 560, border: '1px solid rgba(184,151,90,0.03)', borderRadius: '50%' }} />
        </div>
        <div style={{ maxWidth: 1600, margin: '0 auto', position: 'relative', zIndex: 3 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'Jost, sans-serif', marginBottom: 28, padding: 0, transition: 'color 0.3s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>
            <ArrowLeft size={12} /> Back to Home
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div className="lbl" style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>Client Voices</div>
              <h1 className="sf" style={{ fontSize: 'clamp(40px,6vw,80px)', color: 'white', fontWeight: 300, lineHeight: 1.05 }}>
                Kind <em style={{ color: '#b8975a' }}>Words.</em>
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
              <div className="divider" />
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, fontWeight: 300, maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
                What our clients say about working with Marqland Studios.
              </p>
            </div>
          </div>
          {/* count pill */}
          {data.testimonials?.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <span className="pill">{data.testimonials.length} {data.testimonials.length === 1 ? 'Review' : 'Reviews'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Masonry grid */}
      <div className="sp" style={{ maxWidth: 1600, margin: '0 auto' }}>
        {data.testimonials?.length > 0 ? (
          <div className="t-masonry">
            {/* Build columns manually for true masonry — each item breaks naturally */}
            {data.testimonials.map((t, i) => (
              <FadeIn key={i} delay={Math.min(i * 0.05, 0.4)} className="t-masonry-item">
                <div className="t-card">
                  <Quote size={22} color="rgba(184,151,90,0.18)" strokeWidth={1} style={{ marginBottom: 16 }} />
                  <p className="sf" style={{ fontSize: 16, color: '#2a2a2a', fontStyle: 'italic', fontWeight: 300, lineHeight: 1.8, marginBottom: 24 }}>
                    "{t.feedback || t.text || t.content || ''}"
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingTop: 18, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 36, height: 36, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: 11, fontFamily: 'Jost, sans-serif', fontWeight: 400 }}>{(t.author || 'C')[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text)' }}>{t.author || 'Client'}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.role || t.company || ''}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <p style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>No testimonials yet</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <section className="grain sp" style={{ background: 'var(--navy)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 3 }}>
          <FadeIn>
            <span className="pill" style={{ marginBottom: 26, display: 'inline-block' }}>Start a Conversation</span>
            <h2 className="sf" style={{ fontSize: 'clamp(32px,5vw,60px)', color: 'white', fontWeight: 300, lineHeight: 1.1, marginBottom: 4 }}>
              The rumor mill was right —
            </h2>
            <h2 className="sf" style={{ fontSize: 'clamp(32px,5vw,60px)', color: '#b8975a', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.1, marginBottom: 22 }}>
              welcome.
            </h2>
            <p className="sf" style={{ color: 'rgba(255,255,255,0.26)', fontStyle: 'italic', fontSize: 15, marginBottom: 40, lineHeight: 1.75 }}>
              Drop your details. We'll orchestrate the rest.
            </p>
            <button onClick={onInquiry} className="btn-gold">Get in Touch <ArrowUpRight size={13} /></button>
          </FadeIn>
        </div>
      </section>
    </div>
  );
};

const HomePage = () => {
  const [data, setData]           = useState({ categories: [], testimonials: [] });
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [form, setForm]           = useState({ name: '', company: '', email: '', phone: '', hearAbout: '' });
  const [lb, setLb]               = useState({ open: false, index: 0, images: [] });
  const [pageView, setPageView]   = useState('home'); // 'home' | 'testimonials'

  useEffect(() => {
    axios.get(`${API_BASE}/api/public-site/store`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    if (id === 'testimonials') {
      setSelectedCat(null); setSelectedSub(null);
      setPageView('testimonials');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // switching back to home from testimonials page
    if (pageView === 'testimonials') {
      setPageView('home');
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 130);
      return;
    }
    if (selectedCat) {
      setSelectedCat(null); setSelectedSub(null);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 130);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // One press always = back to catalogue.
  // When a sub was AUTO-selected (because there are no generic images),
  // there is nothing to show at sub=null, so skip straight to catalogue.
  const handleBack = () => {
    if (selectedSub) {
      const hasGeneric = (selectedCat?.images || []).filter(i => !i.isCover).length > 0;
      if (hasGeneric) {
        setSelectedSub(null);          // category has an "All" tab — go there
      } else {
        setSelectedSub(null);
        setSelectedCat(null);          // no generic images — skip to catalogue
      }
    } else {
      setSelectedCat(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectCat = (cat) => {
    setSelectedCat(cat);
    const nonCover = (cat.images || []).filter(i => !i.isCover);
    setSelectedSub(nonCover.length === 0 && cat.subcategories?.length > 0 ? cat.subcategories[0] : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getImgs = () => {
    if (!selectedCat) return [];
    if (selectedSub && selectedSub.id !== 'generic') return selectedSub.images || [];
    return (selectedCat.images || []).filter(i => !i.isCover);
  };
  const imgs = getImgs();

  const openLb  = (i) => { setLb({ open: true, index: i, images: imgs }); document.body.style.overflow = 'hidden'; };
  const closeLb = ()  => { setLb({ open: false, index: 0, images: [] }); document.body.style.overflow = ''; };
  const nextLb  = (e) => { e.stopPropagation(); setLb(p => ({ ...p, index: (p.index + 1) % p.images.length })); };
  const prevLb  = (e) => { e.stopPropagation(); setLb(p => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length })); };

  const submitForm = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/public-site/inquiry`, form);
      setForm({ name: '', company: '', email: '', phone: '', hearAbout: '' });
      setShowModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2200);
    } catch (err) { console.error(err); }
  };

  const hasGeneric = (selectedCat?.images || []).filter(i => !i.isCover).length > 0;

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0e1520; --gold: #b8975a; --gold2: #d4b06a;
      --offwhite: #faf8f5; --text: #1a1a1a; --muted: #888;
    }
    .ms { font-family: 'Jost', sans-serif; background: var(--offwhite); color: var(--text); -webkit-font-smoothing: antialiased; }
    .sf { font-family: 'Cormorant Garamond', Georgia, serif; }

    /* grain */
    .grain { position: relative; }
    .grain::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2; border-radius: inherit;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      background-size: 200px;
    }

    /* nav */
    .nav {
      position: fixed; top: 0; width: 100%; z-index: 100; height: 68px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 48px;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      transition: background 0.5s, border-color 0.5s;
    }
    .nav-logo { background: none; border: none; cursor: pointer; color: white; font-size: 20px; font-weight: 300; letter-spacing: 0.05em; font-family: 'Cormorant Garamond', Georgia, serif; }
    .nav-links { display: flex; align-items: center; gap: 36px; }
    .nav-link { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 10px; font-weight: 400; letter-spacing: 0.2em; text-transform: uppercase; font-family: 'Jost', sans-serif; transition: color 0.3s; }
    .nav-link:hover { color: white; }
    .hamburger { display: none; background: none; border: none; cursor: pointer; flex-direction: column; gap: 5px; padding: 4px; }
    .hamburger span { display: block; width: 22px; height: 1px; background: white; }
    .mob-menu { display: none; position: fixed; inset: 0; top: 68px; background: rgba(10,15,24,0.97); z-index: 99; flex-direction: column; align-items: center; justify-content: center; gap: 30px; }
    .mob-menu.open { display: flex; }
    .mob-link { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.6); font-size: 13px; font-family: 'Jost', sans-serif; font-weight: 300; letter-spacing: 0.2em; text-transform: uppercase; }

    /* buttons */
    .btn-gold { display: inline-flex; align-items: center; gap: 10px; background: var(--gold); color: var(--navy); padding: 16px 40px; border: none; cursor: pointer; font-family: 'Jost', sans-serif; font-size: 10px; font-weight: 500; letter-spacing: 0.25em; text-transform: uppercase; transition: background 0.3s, transform 0.3s; }
    .btn-gold:hover { background: var(--gold2); transform: translateY(-1px); }
    .btn-outline { display: inline-flex; align-items: center; gap: 10px; background: transparent; color: white; padding: 15px 40px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; font-family: 'Jost', sans-serif; font-size: 10px; font-weight: 500; letter-spacing: 0.25em; text-transform: uppercase; transition: border-color 0.3s, background 0.3s; }
    .btn-outline:hover { border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.05); }

    /* labels */
    .lbl { font-size: 9px; font-weight: 400; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); }
    .pill { display: inline-block; padding: 5px 18px; border: 1px solid rgba(184,151,90,0.4); font-size: 9px; font-weight: 400; letter-spacing: 0.25em; text-transform: uppercase; color: var(--gold); }
    .divider { width: 40px; height: 1px; background: var(--gold); }

    /* sub tabs */
    .sub-btn { padding: 7px 20px; cursor: pointer; font-family: 'Jost', sans-serif; font-size: 9px; font-weight: 400; letter-spacing: 0.2em; text-transform: uppercase; border: 1px solid; transition: all 0.3s; }
    .sub-on  { background: var(--navy); color: white; border-color: var(--navy); }
    .sub-off { background: transparent; color: var(--muted); border-color: rgba(0,0,0,0.12); }
    .sub-off:hover { border-color: var(--navy); color: var(--navy); }

    /* category bento cards */
    .cat-card { overflow: hidden; cursor: pointer; position: relative; border-radius: 4px; height: 100%; transition: transform 0.6s cubic-bezier(0.16,1,0.3,1); }
    .cat-card:hover { transform: scale(1.01); }
    .cat-card > img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 1.2s cubic-bezier(0.16,1,0.3,1); }
    .cat-card:hover > img { transform: scale(1.07); }
    .cat-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(8,12,18,0.88) 0%, rgba(8,12,18,0.08) 55%, transparent 100%); }
    .cat-lbl { position: absolute; bottom: 0; left: 0; right: 0; padding: 28px 26px; z-index: 3; }

    /* bento grid */
    .bento { display: grid; grid-template-columns: repeat(3,1fr); grid-auto-rows: 340px; gap: 12px; }
    .ms-bento-2c   { grid-column: span 2; }
    .ms-bento-2r   { grid-row:    span 2; }
    .ms-bento-2c2r { grid-column: span 2; grid-row: span 2; }

    /* masonry (product images) */
    .masonry { columns: 4; column-gap: 10px; }
    .masonry-item { break-inside: avoid; margin-bottom: 10px; overflow: hidden; cursor: zoom-in; background: #ece9e4; }
    .masonry-item img { width: 100%; height: auto; display: block; transition: transform 0.7s cubic-bezier(0.16,1,0.3,1); }
    .masonry-item:hover img { transform: scale(1.04); }

    /* process */
    .proc-card { border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; padding: 40px; height: 100%; transition: border-color 0.4s, background 0.4s; }
    .proc-card:hover { border-color: rgba(184,151,90,0.28); background: rgba(184,151,90,0.04); }

    /* testimonials */
    .testi { border: 1px solid rgba(0,0,0,0.07); border-radius: 4px; padding: 44px; background: white; display: flex; flex-direction: column; height: 100%; transition: transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s; }
    .testi:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.07); }

    /* form */
    .fi { width: 100%; padding: 13px 0; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.14); color: white; font-family: 'Jost', sans-serif; font-size: 13px; font-weight: 300; letter-spacing: 0.07em; outline: none; transition: border-color 0.3s; }
    .fi::placeholder { color: rgba(255,255,255,0.28); }
    .fi:focus { border-bottom-color: var(--gold); }

    /* hero animations */
    @keyframes up { from { opacity:0; transform:translateY(26px); } to { opacity:1; transform:translateY(0); } }
    .h1{animation:up 0.9s ease 0.3s both;} .h2{animation:up 0.9s ease 0.5s both;}
    .h3{animation:up 0.9s ease 0.7s both;} .h4{animation:up 0.9s ease 0.9s both;}
    .h5{animation:up 0.9s ease 1.1s both;}

    /* marquee */
    @keyframes mq { from{transform:translateX(0);} to{transform:translateX(-50%);} }
    .mq-track { display:flex; animation:mq 30s linear infinite; white-space:nowrap; }

    /* footer */
    .fl { display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.45); text-decoration:none; transition:background 0.3s,color 0.3s,border-color 0.3s; }
    .fl:hover { background:var(--gold); color:var(--navy); border-color:var(--gold); }
    .fnb { display:block; background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.38); font-size:13px; font-family:'Jost',sans-serif; font-weight:300; margin-bottom:11px; padding:0; transition:color 0.3s; text-align:left; }
    .fnb:hover { color:white; }

    /* section pads */
    .sp  { padding: 96px 48px; }
    .sps { padding: 64px 48px; }

    /* ═════════ RESPONSIVE ═════════ */
    @media (max-width: 1100px) { .masonry { columns: 3; } }
    @media (max-width: 900px) {
      .bento { grid-template-columns: repeat(2,1fr); grid-auto-rows: 260px; }
      .ms-bento-2c { grid-column: span 1; }
      .ms-bento-2c2r { grid-column: span 2; grid-row: span 1; }
      .masonry { columns: 2; }
      .sp  { padding: 64px 28px; }
      .sps { padding: 48px 28px; }
      .cat-hdr-desc { display: none; }
    }
    /* ── Testimonial masonry ── */
    .t-masonry { columns: 3; column-gap: 16px; }
    .t-masonry-item { break-inside: avoid; margin-bottom: 16px; }
    .t-card {
      background: white; border: 1px solid rgba(0,0,0,0.06);
      padding: 32px; cursor: default;
      transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s;
    }
    .t-card:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(0,0,0,0.07); }
    @media (max-width: 1024px) { .t-masonry { columns: 2; } }
    @media (max-width: 640px)  { .t-masonry { columns: 1; } }

    /* ── Success toast ── */
    @keyframes toastIn  { from { opacity:0; transform:translateY(24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes toastOut { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(-16px) scale(0.96); } }
    .toast-wrap {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .toast-card {
      background: var(--navy); border: 1px solid rgba(184,151,90,0.35);
      padding: 44px 52px; text-align: center;
      animation: toastIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
      max-width: 420px; width: 90%;
    }
    .toast-card.leaving { animation: toastOut 0.35s ease forwards; }

    @media (max-width: 640px) {
      .nav { padding: 0 20px; }
      .nav-links { display: none; }
      .hamburger { display: flex; }
      .bento { grid-template-columns: 1fr; grid-auto-rows: 240px; }
      .ms-bento-2c   { grid-column: span 1; }
      .ms-bento-2r   { grid-row:    span 1; }
      .ms-bento-2c2r { grid-column: span 1; grid-row: span 1; }
      .masonry { columns: 1; }
      .sp  { padding: 48px 18px; }
      .sps { padding: 36px 18px; }
      .btn-gold, .btn-outline { padding: 14px 26px; }
      .proc-card { padding: 26px; }
      .testi { padding: 26px; }
      .hero-btns { flex-direction: column; align-items: center; }
      .detail-head { padding: 90px 18px 0 !important; }
      .detail-body { padding: 14px 18px 56px !important; }
    }
  `;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0e1520', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <span className="sf" style={{ color: '#b8975a', fontSize: 13, letterSpacing: '0.35em', opacity: 0.5 }}>LOADING</span>
      </div>
    );
  }

  return (
    <div className="ms" style={{ minHeight: '100vh' }}>
      <style>{CSS}</style>
      <FontLoader />

      {/* Lightbox */}
      {lb.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(5,8,14,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeLb}>
          <button onClick={closeLb} style={{ position: 'absolute', top: 26, right: 26, background: 'none', border: 'none', color: 'rgba(255,255,255,0.32)', cursor: 'pointer' }}><X size={24} /></button>
          <button onClick={prevLb}  style={{ position: 'absolute', left: 12, padding: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', cursor: 'pointer' }}><ChevronLeft size={42} strokeWidth={1} /></button>
          <div style={{ maxWidth: '86vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={`${IMAGE_BASE}${lb.images[lb.index]?.url}`} alt="" style={{ maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain' }} />
            <p style={{ marginTop: 18, color: 'rgba(255,255,255,0.18)', fontSize: 10, letterSpacing: '0.3em', fontFamily: 'Jost, sans-serif' }}>{lb.index + 1} / {lb.images.length}</p>
          </div>
          <button onClick={nextLb}  style={{ position: 'absolute', right: 12, padding: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', cursor: 'pointer' }}><ChevronRight size={42} strokeWidth={1} /></button>
        </div>
      )}

      {/* Inquiry Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: 'rgba(6,10,18,0.75)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--navy)', width: '100%', maxWidth: 496, padding: '50px 44px', position: 'relative' }}>
            <button onClick={() => { setShowModal(false); setShowSuccess(false); }} style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: 'rgba(255,255,255,0.28)', cursor: 'pointer' }}><X size={18} /></button>
              <span className="pill" style={{ marginBottom: 26, display: 'inline-block' }}>Inquiry</span>
                <h2 className="sf" style={{ fontSize: 38, color: 'white', fontWeight: 300, lineHeight: 1.1, marginBottom: 8 }}>Let's create<br /><em>something remarkable.</em></h2>
                <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, letterSpacing: '0.05em', marginBottom: 36 }}>Our team responds within 24 hours.</p>
                <form onSubmit={submitForm} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input className="fi" type="text"  required placeholder="Your Name"    value={form.name}    onChange={e => setForm({ ...form, name:    e.target.value })} />
                  <input className="fi" type="text"  required placeholder="Company"      value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                  <input className="fi" type="email" required placeholder="Email"        value={form.email}   onChange={e => setForm({ ...form, email:   e.target.value })} />
                  <input className="fi" type="tel"   required placeholder="Phone"        value={form.phone}   onChange={e => setForm({ ...form, phone:   e.target.value })} />
                  <textarea className="fi" rows={3} placeholder="How did you hear about us?" value={form.hearAbout} onChange={e => setForm({ ...form, hearAbout: e.target.value })} style={{ resize: 'none', lineHeight: 1.6 }} />
                  <button type="submit" className="btn-gold" style={{ marginTop: 10, justifyContent: 'center' }}>Send Inquiry <ArrowUpRight size={13} /></button>
                </form>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="nav" style={{ background: scrolled ? 'rgba(14,21,32,0.94)' : 'rgba(14,21,32,0.52)', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent' }}>
        <button className="nav-logo sf" onClick={() => { setSelectedCat(null); setSelectedSub(null); setPageView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Marqland Studios</button>
        <div className="nav-links">
          {[['Catalogue','catalogue'],['Process','process'],['Testimonials','testimonials']].map(([l,id]) => (
            <button key={id} className="nav-link" onClick={() => scrollTo(id)}>{l}</button>
          ))}
          <button className="btn-gold" style={{ padding: '10px 22px' }} onClick={() => setShowModal(true)}>Get in Touch</button>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(o => !o)}><span /><span /><span /></button>
      </nav>

      {/* Mobile menu */}
      <div className={`mob-menu ${menuOpen ? 'open' : ''}`}>
        {[['Catalogue','catalogue'],['Process','process'],['Testimonials','testimonials']].map(([l,id]) => (
          <button key={id} className="mob-link" onClick={() => scrollTo(id)}>{l}</button>
        ))}
        <button className="btn-gold" style={{ marginTop: 8 }} onClick={() => { setShowModal(true); setMenuOpen(false); }}>Get in Touch</button>
      </div>

      <main>
        {pageView === 'testimonials' ? (
          <TestimonialsPage
            data={data}
            onBack={() => { setPageView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onInquiry={() => setShowModal(true)}
          />
        ) : !selectedCat ? (
          <>
            {/* Hero */}
            <section className="grain" style={{ minHeight: '100vh', background: 'linear-gradient(155deg,#0c1220 0%,#111a28 60%,#0e1824 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '18%', right: '6%',  width: 380, height: 380, border: '1px solid rgba(184,151,90,0.05)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: '15%', right: '3%',  width: 500, height: 500, border: '1px solid rgba(184,151,90,0.03)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom:'12%', left: '4%', width: 220, height: 220, border: '1px solid rgba(255,255,255,0.025)', borderRadius: '50%' }} />
              </div>
              <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', maxWidth: 860 }}>
                <div className="h1" style={{ marginBottom: 26 }}><span className="pill">Premium Corporate Gifting</span></div>
                <h1 className="h2 sf" style={{ fontSize: 'clamp(46px,8vw,90px)', color: 'white', fontWeight: 300, lineHeight: 1.05, marginBottom: 0 }}>Gifts That</h1>
                <h1 className="h3 sf" style={{ fontSize: 'clamp(46px,8vw,90px)', color: '#b8975a', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.05, marginBottom: 22 }}>Speak Volumes.</h1>
                <p className="h4 sf" style={{ color: 'rgba(255,255,255,0.34)', fontSize: 'clamp(14px,2vw,18px)', fontStyle: 'italic', fontWeight: 300, maxWidth: 520, margin: '0 auto 44px', lineHeight: 1.75 }}>
                  From onboarding kits to grand celebrations — bespoke gifting experiences that elevate your brand.
                </p>
                <div className="h5 hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => scrollTo('catalogue')} className="btn-gold">Explore Catalogue <ChevronRight size={13} /></button>
                  <button onClick={() => setShowModal(true)} className="btn-outline">Get in Touch</button>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 1, height: 42, background: 'linear-gradient(to bottom, rgba(184,151,90,0.45), transparent)' }} />
                <span style={{ color: 'rgba(255,255,255,0.16)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: 'Jost, sans-serif' }}>Scroll</span>
              </div>
            </section>

            {/* Marquee */}
            <div style={{ background: '#b8975a', padding: '12px 0', overflow: 'hidden' }}>
              <div className="mq-track">
                {Array(8).fill(['Bespoke Gifting','·','Corporate Kits','·','Brand Experiences','·','Event Curation','·']).flat().map((w,i) => (
                  <span key={i} style={{ color: 'rgba(14,21,32,0.62)', fontSize: 10, fontWeight: 400, letterSpacing: '0.25em', textTransform: 'uppercase', marginRight: 26, fontFamily: 'Jost, sans-serif' }}>{w}</span>
                ))}
              </div>
            </div>

            {/* Catalogue bento */}
            <section id="catalogue" className="sp" style={{ maxWidth: 1600, margin: '0 auto' }}>
              <FadeIn>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 44, flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div className="lbl" style={{ marginBottom: 10 }}>Our Collections</div>
                    <h2 className="sf" style={{ fontSize: 'clamp(30px,4vw,50px)', fontWeight: 300, lineHeight: 1.1 }}>Curated for<br /><em>Every Occasion</em></h2>
                  </div>
                  <div className="cat-hdr-desc" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="divider" />
                    <p style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 300, maxWidth: 250, lineHeight: 1.6, margin: 0 }}>Each collection reflects your brand's character.</p>
                  </div>
                </div>
              </FadeIn>
              <div className="bento">
                {data.categories.map((cat, idx) => {
                  const cover = cat.images?.find(i => i.isCover) || cat.images?.[0];
                  return (
                    <FadeIn key={cat.id} delay={idx * 0.06} className={getBentoClass(idx)} style={{ height: '100%' }}>
                      <div className="cat-card" onClick={() => selectCat(cat)}>
                        {cover
                          ? <img src={`${IMAGE_BASE}${cover.url}`} alt={cat.name} />
                          : <div style={{ width: '100%', height: '100%', background: '#1a2332', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}><ImageIcon size={34} strokeWidth={1} /></div>
                        }
                        <div className="cat-overlay" />
                        <div className="cat-lbl">
                          <p className="lbl" style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>Collection</p>
                          <h3 className="sf" style={{ fontSize: 22, color: 'white', fontWeight: 300, margin: '0 0 8px', lineHeight: 1.2 }}>{cat.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#b8975a' }}>
                            <span style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'Jost, sans-serif' }}>Explore</span>
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>
                    </FadeIn>
                  );
                })}
              </div>
            </section>

            {/* Process */}
            <section id="process" className="grain sp" style={{ background: 'var(--navy)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ maxWidth: 1600, margin: '0 auto', position: 'relative', zIndex: 3 }}>
                <FadeIn>
                  <div style={{ textAlign: 'center', marginBottom: 60 }}>
                    <div className="lbl" style={{ color: 'rgba(255,255,255,0.26)', marginBottom: 10 }}>Our Process</div>
                    <h2 className="sf" style={{ fontSize: 'clamp(30px,4vw,50px)', color: 'white', fontWeight: 300, lineHeight: 1.1, marginBottom: 12 }}>Seamless from <em style={{ color: '#b8975a' }}>Start to Finish</em></h2>
                    <p className="sf" style={{ color: 'rgba(255,255,255,0.26)', fontStyle: 'italic', fontSize: 15, maxWidth: 360, margin: '0 auto' }}>Four elegant steps to bring your vision to life.</p>
                  </div>
                </FadeIn>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                  {[
                    { Icon: ShoppingBag, title: 'Select Product', step: '01', desc: 'Choose from our curated, season-updated collections.' },
                    { Icon: Palette,     title: 'Request Mockup', step: '02', desc: 'We visualize your branding directly on the product.' },
                    { Icon: CheckCircle, title: 'Approve Design', step: '03', desc: 'Finalize specifications and production details.' },
                    { Icon: Truck,       title: 'Swift Delivery', step: '04', desc: 'Timely, careful logistics delivered nationwide.' },
                  ].map((s, i) => (
                    <FadeIn key={s.step} delay={i * 0.1}>
                      <div className="proc-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
                          <div style={{ width: 44, height: 44, border: '1px solid rgba(184,151,90,0.17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.Icon size={17} color="rgba(184,151,90,0.62)" strokeWidth={1.5} /></div>
                          <span className="sf" style={{ fontSize: 40, color: 'rgba(255,255,255,0.04)', fontWeight: 300, lineHeight: 1 }}>{s.step}</span>
                        </div>
                        <h3 className="sf" style={{ fontSize: 19, color: 'white', fontWeight: 300, marginBottom: 9 }}>{s.title}</h3>
                        <p style={{ color: 'rgba(255,255,255,0.24)', fontSize: 12, letterSpacing: '0.04em', lineHeight: 1.7, fontWeight: 300 }}>{s.desc}</p>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="grain sp" style={{ background: 'var(--navy)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 3 }}>
                <FadeIn>
                  <span className="pill" style={{ marginBottom: 26, display: 'inline-block' }}>Start a Conversation</span>
                  <h2 className="sf" style={{ fontSize: 'clamp(32px,5vw,60px)', color: 'white', fontWeight: 300, lineHeight: 1.1, marginBottom: 4 }}>The rumor mill was right —</h2>
                  <h2 className="sf" style={{ fontSize: 'clamp(32px,5vw,60px)', color: '#b8975a', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.1, marginBottom: 22 }}>welcome.</h2>
                  <p className="sf" style={{ color: 'rgba(255,255,255,0.26)', fontStyle: 'italic', fontSize: 15, marginBottom: 40, lineHeight: 1.75 }}>Drop your details. We'll orchestrate the rest.</p>
                  <button onClick={() => setShowModal(true)} className="btn-gold">Get in Touch <ArrowUpRight size={13} /></button>
                </FadeIn>
              </div>
            </section>
          </>
        ) : (
          /* Category detail */
          <div>
            <div className="detail-head" style={{ padding: '100px 48px 0', maxWidth: 1600, margin: '0 auto' }}>
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'Jost, sans-serif', marginBottom: 22, padding: 0, transition: 'color 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
              >
                <ArrowLeft size={12} /> Back to Catalogue
              </button>
              <div className="lbl" style={{ marginBottom: 8 }}>{selectedCat.name}</div>
              <h2 className="sf" style={{ fontSize: 'clamp(34px,5vw,64px)', fontWeight: 300, lineHeight: 1.05, margin: '0 0 24px' }}>
                <em>{selectedSub?.name || selectedCat.name}</em>
              </h2>

              {selectedCat.subcategories?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                  {hasGeneric && (
                    <button className={`sub-btn ${!selectedSub ? 'sub-on' : 'sub-off'}`} onClick={() => setSelectedSub(null)}>All</button>
                  )}
                  {selectedCat.subcategories.map(sub => (
                    <button key={sub.id} className={`sub-btn ${selectedSub?.id === sub.id ? 'sub-on' : 'sub-off'}`} onClick={() => setSelectedSub(sub)}>
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Masonry grid — respects each image's natural aspect ratio */}
            <div className="detail-body" style={{ padding: '14px 48px 72px', maxWidth: 1600, margin: '0 auto' }}>
              <div className="masonry">
                {imgs.map((img, idx) => (
                  <div key={img.id} className="masonry-item" onClick={() => openLb(idx)}>
                    <img src={`${IMAGE_BASE}${img.url}`} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
              {imgs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '72px 0', color: 'var(--muted)' }}>
                  <p style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>No images in this collection yet</p>
                </div>
              )}
            </div>
          </div>
        ) /* end pageView ternary */}
      </main>

      {/* ── Success toast — auto-closes after 2.2s ── */}
      {showSuccess && (
        <div className="toast-wrap">
          <div className="toast-card">
            <div style={{ fontSize: 32, marginBottom: 16 }}>✦</div>
            <h2 className="sf" style={{ fontSize: 32, color: 'white', fontWeight: 300, lineHeight: 1.1, marginBottom: 10 }}>
              Consider it <em style={{ color: '#b8975a' }}>done.</em>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, letterSpacing: '0.06em', lineHeight: 1.7 }}>
              Your inquiry landed safely.<br />We'll be in touch before you finish your next meeting.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ background: '#0c1320', padding: '68px 48px 36px' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 36, marginBottom: 52, paddingBottom: 44, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <h3 className="sf" style={{ fontSize: 24, color: 'white', fontWeight: 300, margin: '0 0 12px' }}>Marqland Studios.</h3>
              <p style={{ color: 'rgba(255,255,255,0.26)', fontSize: 13, lineHeight: 1.75, maxWidth: 260, margin: '0 0 20px', fontWeight: 300 }}>Premium brand experiences through curated gifting and bespoke event orchestration.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="fl"><InstagramIcon size={14} /></a>
                <a href="mailto:hello@marqland.com" className="fl"><Mail size={14} /></a>
                <a href="https://marqland.com"    target="_blank" rel="noreferrer" className="fl"><Link2 size={14} /></a>
              </div>
            </div>
            <div>
              <p className="lbl" style={{ color: 'rgba(255,255,255,0.2)', marginBottom: 16 }}>Navigation</p>
              {['Catalogue','Process','Testimonials'].map(l => (
                <button key={l} className="fnb" onClick={() => {
                  if (l === 'Testimonials') { setPageView('testimonials'); window.scrollTo({ top:0, behavior:'smooth' }); }
                  else scrollTo(l.toLowerCase());
                }}>{l}</button>
              ))}
            </div>
            <div>
              <p className="lbl" style={{ color: 'rgba(255,255,255,0.2)', marginBottom: 16 }}>Contact</p>
              <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, fontWeight: 300, lineHeight: 1.8, margin: '0 0 18px' }}>hello@marqland.com<br />Mumbai, India</p>
              <button onClick={() => setShowModal(true)} className="btn-gold" style={{ padding: '10px 24px' }}>Send Inquiry</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'Jost, sans-serif', margin: 0 }}>© {new Date().getFullYear()} Marqland Studios</p>
            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10, letterSpacing: '0.2em',  textTransform: 'uppercase', fontFamily: 'Jost, sans-serif', margin: 0 }}>Bespoke Orchestration</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;