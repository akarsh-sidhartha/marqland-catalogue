/**
 * leadScoutRoutes.js
 * ------------------
 * Server-side proxy for all LeadScout data sources.
 * API keys stay server-side — never exposed to the browser.
 *
 * Endpoints:
 *   POST /api/lead-scout/gemini      → Gemini 2.5 Flash + Google Search Grounding (real-time web)
 *   GET  /api/lead-scout/yourstory   → YourStory RSS feed (live Indian startup news, no key needed)
 *   POST /api/lead-scout/apollo      → Apollo.io People Search (real verified contacts)
 *
 * ENV vars required in your .env:
 *   GEMINI_API_KEY=your_gemini_key        ← you already have this
 *   APOLLO_API_KEY=your_apollo_key        ← optional, gracefully skipped if missing
 */

const express = require('express');
const router = express.Router();

// ─── Helper: fetch with timeout ────────────────────────────────────────────────
const fetchWithTimeout = async (url, options = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. GEMINI + GOOGLE SEARCH GROUNDING
//    POST /api/lead-scout/gemini
//    Body: { type: 'founders' | 'inquiries', query: string }
//
//    Uses gemini-2.5-flash with google_search tool enabled.
//    Gemini autonomously searches the live web and returns grounded results.
//    Billed per search query (~$0.035/query on free tier, generous free quota).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/gemini', async (req, res) => {
  const { type = 'founders', query = '' } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Gemini API key not configured',
      hint: 'Add GEMINI_API_KEY to your .env file',
    });
  }

  const prompt = type === 'founders'
    ? `You are a startup intelligence researcher for Marqland, a premium corporate gifting company in India.

Search the web RIGHT NOW for newly registered Indian startups (last 30-60 days). Focus on: ${query || 'Fintech, SaaS, D2C, HealthTech, EdTech, DeepTech startups in Bangalore, Mumbai, Gurgaon, Hyderabad, Pune'}.

Use Google Search to find REAL companies. Look at:
- MCA recent registrations
- YourStory, Inc42, Entrackr, Crunchbase India funding news
- LinkedIn company pages

Return ONLY a valid JSON array with exactly 5 items. Each must have:
{
  "id": number,
  "company": "Real company name found on the web",
  "industry": "Their actual industry",
  "founder": "Real founder name from LinkedIn or news",
  "location": "City, India",
  "stage": "Bootstrapped | Pre-Seed | Seed | Series A",
  "employees": "1-10 | 10-50 | 50-200",
  "registeredAgo": "X days ago | X weeks ago",
  "website": "their actual website URL or null",
  "giftingTrigger": "Why Marqland should reach out to them for corporate gifting",
  "linkedinSearch": "search string to find founder on LinkedIn",
  "newsSource": "URL of the article or source where you found this"
}

Return ONLY the JSON array. No markdown fences, no explanation text.`
    : `You are a corporate gifting intelligence analyst for Marqland, a premium gifting company in India.

Search the web RIGHT NOW for REAL people or companies actively looking for corporate gifting vendors in India. Search: ${query || 'corporate gifting India 2025 bulk hampers onboarding'}

Look at LinkedIn posts, Twitter/X, Reddit India, IndiaMART buyer requests, GroupBuying India communities.

Return ONLY a valid JSON array with exactly 5 items. Each must have:
{
  "id": number,
  "person": "Real person's name (from their LinkedIn/post)",
  "designation": "Their job title",
  "company": "Their company name",
  "companySize": "Startup | Mid-Market | Enterprise",
  "inquiry": "What they're actually looking for — quote or paraphrase their post",
  "occasion": "Diwali | Employee Onboarding | Client Gifting | Festival | Product Launch | Anniversary",
  "budget": "₹500-1000 | ₹1000-2500 | ₹2500-5000 | ₹5000+",
  "quantity": "Approximate quantity needed",
  "urgency": "High | Medium | Low",
  "linkedinSearch": "search string to find this person on LinkedIn",
  "newsSource": "URL of the post or source where you found this"
}

Return ONLY the JSON array. No markdown fences, no explanation text.`;

  try {
    // Gemini REST API with google_search tool (grounding)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],   // ← Search Grounding: Gemini searches the live web
      generationConfig: {
        temperature: 1.0,               // Recommended for grounding
        maxOutputTokens: 2048,
      },
    };

    const response = await fetchWithTimeout(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[LeadScout/gemini] API error:', err);
      return res.status(502).json({ error: 'Gemini API error', detail: err });
    }

    const data = await response.json();

    // Extract text from Gemini response
    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('') || '[]';

    // Extract grounding sources Gemini actually searched
    const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks.map(c => c.web?.uri).filter(Boolean);

    // Strip any markdown fences Gemini might add despite instructions
    const clean = text.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, match => {
      // Extract content from inside the fences
      return match.replace(/```json\n?|```\n?/g, '');
    }).trim();

    // Find the JSON array in the response
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[LeadScout/gemini] No JSON array found in response:', clean.slice(0, 300));
      return res.status(502).json({ error: 'Gemini returned no parseable JSON', raw: clean.slice(0, 300) });
    }

    const leads = JSON.parse(jsonMatch[0]);

    res.json({
      source: 'gemini',
      leads,
      groundingSources: sources,   // URLs Gemini actually visited
    });

  } catch (err) {
    console.error('[LeadScout/gemini]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. YOURSTORY — Live Indian startup news via public RSS
//    GET /api/lead-scout/yourstory?q=fintech&limit=8
//    No API key needed.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/yourstory', async (req, res) => {
  const { q = '', limit = 8 } = req.query;

  const RSS_URLS = {
    default:  'https://yourstory.com/feed',
    startups: 'https://yourstory.com/category/startups/feed',
    funding:  'https://yourstory.com/category/funding/feed',
  };

  const feedUrl = q.toLowerCase().includes('fund')
    ? RSS_URLS.funding
    : q
    ? RSS_URLS.startups
    : RSS_URLS.default;

  try {
    const response = await fetchWithTimeout(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 BizManager-LeadScout/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `YourStory RSS returned ${response.status}` });
    }

    const xml = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < Number(limit)) {
      const block = match[1];

      const get = (tag) => {
        const m = block.match(
          new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`)
        );
        return m ? (m[1] || m[2] || '').trim() : '';
      };

      const title       = get('title');
      const link        = get('link');
      const pubDate     = get('pubDate');
      const description = get('description').replace(/<[^>]+>/g, '').slice(0, 240);
      const author      = get('dc:creator') || get('author') || 'YourStory';
      const category    = get('category');

      // Keyword filter
      if (q) {
        const haystack = (title + description + category).toLowerCase();
        const words = q.toLowerCase().split(/\s+/);
        if (!words.some(w => w.length > 2 && haystack.includes(w))) continue;
      }

      items.push({
        id:          `ys-${items.length + 1}`,
        title,
        link,
        pubDate,
        description,
        author,
        category,
        source:      'YourStory',
      });
    }

    res.json({ source: 'yourstory', items });
  } catch (err) {
    console.error('[LeadScout/yourstory]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. APOLLO.IO — Verified contact + company search
//    POST /api/lead-scout/apollo
//    Body: { type: 'founders' | 'inquiries', query: string, page: number }
//
//    Requires APOLLO_API_KEY in .env
//    Free plan: 50 credits/month | Basic $49/mo (~600 credits)
//    Gracefully returns empty array if key is missing.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/apollo', async (req, res) => {
  const { type = 'founders', query = '', page = 1 } = req.body;

  if (!process.env.APOLLO_API_KEY) {
    return res.status(503).json({
      error: 'Apollo API key not configured',
      hint: 'Add APOLLO_API_KEY=your_key to .env — get a free key at apollo.io',
    });
  }

  const titles = type === 'founders'
    ? ['Founder', 'Co-Founder', 'CEO', 'Managing Director', 'Director']
    : ['HR Manager', 'HR Head', 'People Operations', 'Admin Manager',
       'Procurement Manager', 'Office Manager', 'Chief of Staff', 'Culture Manager'];

  const payload = {
    api_key:                           process.env.APOLLO_API_KEY,
    q_keywords:                        query || (type === 'founders' ? 'startup India' : 'corporate gifting India'),
    person_titles:                     titles,
    person_locations:                  ['India'],
    organization_num_employees_ranges: type === 'founders' ? ['1,200'] : ['10,10000'],
    page,
    per_page: 10,
  };

  try {
    const response = await fetchWithTimeout('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Apollo API error', detail: err });
    }

    const data = await response.json();
    const people = (data.people || []).map((p, i) => {
      const org = p.organization || {};
      const emp = org.estimated_num_employees || 0;

      if (type === 'founders') {
        return {
          id:             `ap-f-${i}`,
          founder:        p.name || 'Unknown',
          designation:    p.title || 'Founder',
          company:        org.name || 'Unknown Company',
          industry:       org.industry || 'Technology',
          location:       p.city ? `${p.city}, India` : 'India',
          employees:      emp ? `${emp} employees` : 'Unknown',
          website:        org.website_url || null,
          linkedin:       p.linkedin_url || null,
          email:          p.email || null,
          source:         'Apollo.io',
          stage:          emp <= 10 ? 'Bootstrapped' : emp <= 50 ? 'Pre-Seed' : 'Seed',
          registeredAgo:  'Recently',
          giftingTrigger: `${org.name || 'This startup'} is early-stage — ideal for branded onboarding kits or founder gifting.`,
          linkedinSearch: `${p.name} ${org.name} India`,
        };
      } else {
        return {
          id:          `ap-i-${i}`,
          person:      p.name || 'Unknown',
          designation: p.title || 'HR Manager',
          company:     org.name || 'Unknown Company',
          companySize: emp > 500 ? 'Enterprise' : emp > 50 ? 'Mid-Market' : 'Startup',
          industry:    org.industry || 'Technology',
          location:    p.city ? `${p.city}, India` : 'India',
          linkedin:    p.linkedin_url || null,
          email:       p.email || null,
          source:      'Apollo.io',
          inquiry:     `${p.title || 'HR'} at ${org.name} — key decision-maker for employee gifts and vendor selection.`,
          occasion:    'Employee Onboarding',
          budget:      emp > 500 ? '₹2500-5000' : '₹1000-2500',
          quantity:    emp ? `~${emp}` : 'Unknown',
          urgency:     'Medium',
          linkedinSearch: `${p.name} ${org.name} India`,
        };
      }
    });

    res.json({ source: 'apollo', type, people, pagination: data.pagination });
  } catch (err) {
    console.error('[LeadScout/apollo]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;