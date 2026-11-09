// SiteForge template engine: brand data JSON -> complete standalone website HTML.
(function (global) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl2p = (s) => String(s || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const has = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "");
  const filled = (list, key) => (list || []).filter((x) => x && has(x[key]));

  const THEMES = {
    modern: { bg: "#ffffff", surface: "#f5f7fb", text: "#0f172a", muted: "#5b6478", radius: "18px", head: "Plus Jakarta Sans", body: "Inter", primary: "#4f46e5", accent: "#06b6d4", dark: false },
    elegant: { bg: "#faf7f2", surface: "#f1ebe1", text: "#2b2622", muted: "#7a6f66", radius: "4px", head: "Playfair Display", body: "Lato", primary: "#8b5e3c", accent: "#c9a96e", dark: false },
    bold: { bg: "#0b0b12", surface: "#161622", text: "#f4f4fb", muted: "#a3a3bd", radius: "24px", head: "Space Grotesk", body: "Space Grotesk", primary: "#a855f7", accent: "#f43f5e", dark: true },
    minimal: { bg: "#ffffff", surface: "#f4f4f4", text: "#111111", muted: "#666666", radius: "0px", head: "DM Sans", body: "DM Sans", primary: "#111111", accent: "#ff5a1f", dark: false },
    fresh: { bg: "#f6fbf7", surface: "#e7f3ea", text: "#13261b", muted: "#557060", radius: "28px", head: "Outfit", body: "Nunito", primary: "#16a34a", accent: "#f59e0b", dark: false },
  };

  function mapEmbedFrom(contact) {
    if (has(contact.mapEmbed)) return contact.mapEmbed;
    let s = String(contact.mapUrl || "").trim();
    const iframe = s.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframe) return iframe[1];
    if (/\/maps\/embed|output=embed/.test(s)) return s;
    let q = "";
    const place = s.match(/\/place\/([^/]+)/);
    const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const plain = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (place) q = decodeURIComponent(place[1].replace(/\+/g, " "));
    else if (at) q = `${at[1]},${at[2]}`;
    else if (plain) q = `${plain[1]},${plain[2]}`;
    if (!q) q = contact.address || "";
    return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed` : "";
  }

  function videoEmbed(url) {
    if (!has(url)) return "";
    const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return url;
  }

  const ICONS = {
    instagram: '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm5.5-3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
    facebook: '<path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.7-.6z"/>',
    twitter: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>',
    linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z"/>',
    youtube: '<path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/>',
    tiktok: '<path d="M16.6 3c.4 2.3 1.9 3.8 4.4 4v3.2a8 8 0 0 1-4.3-1.3v6.4A6.3 6.3 0 1 1 10.4 9v3.3a3 3 0 1 0 2.9 3V3h3.3z"/>',
    pinterest: '<path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.5 2.1-4.5 4.4 0 .9.3 1.8.8 2.3l.1.3-.3 1.1c0 .2-.2.2-.4.1-1.3-.6-2-2.4-2-3.9 0-3.2 2.3-6.1 6.7-6.1 3.5 0 6.2 2.5 6.2 5.8 0 3.5-2.2 6.3-5.2 6.3-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.9 2-1.3 2.7A10 10 0 1 0 12 2z"/>',
    website: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3zm.8 2h3a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6C8 5.5 7.5 6.7 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zM16.3 14a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4z"/>',
    whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z"/>',
  };
  const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ICONS.website}</svg>`;

  function generateSite(raw, opts = {}) {
    const d = JSON.parse(JSON.stringify(raw || {}));
    const b = d.brand || {}, c = d.contact || {}, m = d.media || {}, s = d.social || {}, seo = d.seo || {}, cta = d.cta || {};
    const t = { ...THEMES[b.template] || THEMES.modern };
    const primary = b.primaryColor || t.primary;
    const accent = b.accentColor || t.accent;
    const headFont = b.font && b.font !== "theme" ? b.font : t.head;
    const bodyFont = b.font && b.font !== "theme" ? b.font : t.body;
    const name = b.name || "Your Brand";
    const services = filled(d.services, "title");
    const stats = filled(d.stats, "value");
    const reviews = filled(d.testimonials, "text");
    const team = filled(d.team, "name");
    const faq = filled(d.faq, "q");
    const gallery = (m.gallery || []).filter(has);
    const mapSrc = mapEmbedFrom(c);
    const video = videoEmbed(m.video);
    const waNum = String(c.whatsapp || "").replace(/[^\d]/g, "");
    const telHref = String(c.phone || "").replace(/[^\d+]/g, "");
    const ctaText = cta.text || (has(c.phone) ? "Get in touch" : "Contact us");
    const ctaLink = cta.link || "#contact";
    const socials = Object.entries(s).filter(([, v]) => has(v));

    const nav = [
      has(b.about) && ["about", "About"],
      services.length && ["services", d.labels?.services || "Services"],
      gallery.length && ["gallery", "Gallery"],
      team.length && ["team", "Team"],
      reviews.length && ["reviews", "Reviews"],
      faq.length && ["faq", "FAQ"],
      ["contact", "Contact"],
    ].filter(Boolean);

    const fonts = [...new Set([headFont, bodyFont])].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`).join("&");

    const jsonLd = {
      "@context": "https://schema.org", "@type": "LocalBusiness", name,
      description: b.description || undefined, image: m.hero && !m.hero.startsWith("data:") ? m.hero : undefined,
      logo: b.logo && !b.logo.startsWith("data:") ? b.logo : undefined,
      telephone: c.phone || undefined, email: c.email || undefined, address: c.address || undefined,
      priceRange: c.priceRange || undefined, openingHours: c.hours ? c.hours.split("\n").filter(Boolean) : undefined,
      sameAs: socials.map(([, v]) => v).filter((v) => /^https?:/.test(v)),
    };

    const stars = (n) => { const k = Math.max(0, Math.min(5, Math.round(+n || 5))); return "★".repeat(k) + "☆".repeat(5 - k); };

    const sec = {
      hero: `
<section class="hero ${m.hero ? "has-img" : ""}" id="home">
  ${m.hero ? `<div class="hero-bg" style="background-image:url('${esc(m.hero)}')"></div>` : ""}
  <div class="wrap hero-inner reveal">
    ${has(b.industry) ? `<span class="eyebrow">${esc(b.industry)}</span>` : ""}
    <h1>${esc(b.tagline || name)}</h1>
    ${has(b.description) ? `<p class="lead">${esc(b.description)}</p>` : ""}
    <div class="hero-actions">
      <a class="btn" href="${esc(ctaLink)}">${esc(ctaText)}</a>
      ${services.length ? `<a class="btn ghost" href="#services">Explore ${esc((d.labels?.services || "services").toLowerCase())}</a>` : has(c.phone) ? `<a class="btn ghost" href="tel:${esc(telHref)}">Call ${esc(c.phone)}</a>` : ""}
    </div>
  </div>
</section>`,
      stats: stats.length ? `
<section class="stats"><div class="wrap stats-grid">
  ${stats.map((x) => `<div class="stat reveal"><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join("")}
</div></section>` : "",
      about: has(b.about) ? `
<section id="about"><div class="wrap about ${gallery[0] || m.hero ? "two" : ""}">
  <div class="reveal">
    <span class="eyebrow">About ${esc(name)}</span>
    <h2>${has(b.founded) ? `Since ${esc(b.founded)}` : "Our story"}</h2>
    <div class="prose">${nl2p(b.about)}</div>
  </div>
  ${gallery[0] || m.hero ? `<img class="about-img reveal" src="${esc(gallery[0] || m.hero)}" alt="${esc(name)}" loading="lazy">` : ""}
</div></section>` : "",
      services: services.length ? `
<section id="services" class="alt"><div class="wrap">
  <div class="sec-head reveal"><span class="eyebrow">What we offer</span><h2>${esc(d.labels?.services || "Our services")}</h2></div>
  <div class="cards">
    ${services.map((x) => `<article class="card reveal">
      ${has(x.image) ? `<img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy">` : ""}
      <div class="card-body"><div class="card-top"><h3>${esc(x.title)}</h3>${has(x.price) ? `<span class="price">${esc(x.price)}</span>` : ""}</div>
      ${has(x.description) ? `<p>${esc(x.description)}</p>` : ""}</div>
    </article>`).join("")}
  </div>
</div></section>` : "",
      gallery: gallery.length ? `
<section id="gallery"><div class="wrap">
  <div class="sec-head reveal"><span class="eyebrow">Gallery</span><h2>A look inside</h2></div>
  <div class="gallery">${gallery.map((g, i) => `<button class="g-item reveal" data-i="${i}" aria-label="Open image ${i + 1}"><img src="${esc(g)}" alt="${esc(name)} photo ${i + 1}" loading="lazy"></button>`).join("")}</div>
</div>
<div class="lightbox" id="lb" hidden><button class="lb-close" aria-label="Close">×</button><img alt=""></div></section>` : "",
      video: video ? `
<section class="alt"><div class="wrap narrow reveal"><div class="video"><iframe src="${esc(video)}" title="${esc(name)} video" allowfullscreen loading="lazy"></iframe></div></div></section>` : "",
      team: team.length ? `
<section id="team"><div class="wrap">
  <div class="sec-head reveal"><span class="eyebrow">The people</span><h2>Meet the team</h2></div>
  <div class="team">${team.map((x) => `<div class="member reveal">
    ${has(x.photo) ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy">` : `<div class="avatar">${esc(x.name.trim()[0] || "?")}</div>`}
    <h3>${esc(x.name)}</h3><span>${esc(x.role)}</span>${has(x.bio) ? `<p>${esc(x.bio)}</p>` : ""}
  </div>`).join("")}</div>
</div></section>` : "",
      reviews: reviews.length ? `
<section id="reviews" class="alt"><div class="wrap">
  <div class="sec-head reveal"><span class="eyebrow">Testimonials</span><h2>What people say</h2></div>
  <div class="reviews">${reviews.map((x) => `<figure class="review reveal">
    <div class="stars">${stars(x.rating)}</div><blockquote>“${esc(x.text)}”</blockquote>
    <figcaption><strong>${esc(x.name || "Customer")}</strong>${has(x.role) ? ` · ${esc(x.role)}` : ""}</figcaption>
  </figure>`).join("")}</div>
</div></section>` : "",
      faq: faq.length ? `
<section id="faq"><div class="wrap narrow">
  <div class="sec-head reveal"><span class="eyebrow">FAQ</span><h2>Questions, answered</h2></div>
  ${faq.map((x) => `<details class="reveal"><summary>${esc(x.q)}</summary><div>${nl2p(x.a)}</div></details>`).join("")}
</div></section>` : "",
      cta: `
<section class="cta-band"><div class="wrap reveal"><h2>${esc(cta.headline || `Ready to experience ${name}?`)}</h2>
<a class="btn light" href="${esc(ctaLink)}">${esc(ctaText)}</a></div></section>`,
      contact: `
<section id="contact"><div class="wrap">
  <div class="sec-head reveal"><span class="eyebrow">Contact</span><h2>Visit or reach out</h2></div>
  <div class="contact-grid">
    <div class="contact-info reveal">
      ${has(c.address) ? `<div class="ci"><h4>Address</h4><p>${esc(c.address)}</p></div>` : ""}
      ${has(c.phone) ? `<div class="ci"><h4>Phone</h4><p><a href="tel:${esc(telHref)}">${esc(c.phone)}</a></p></div>` : ""}
      ${has(c.email) ? `<div class="ci"><h4>Email</h4><p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p></div>` : ""}
      ${has(c.hours) ? `<div class="ci"><h4>Opening hours</h4><p>${esc(c.hours).replace(/\n/g, "<br>")}</p></div>` : ""}
      ${socials.length ? `<div class="socials">${socials.map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${esc(k)}">${icon(k)}</a>`).join("")}</div>` : ""}
      ${has(c.email) ? `<form class="cform" data-to="${esc(c.email)}">
        <input name="name" placeholder="Your name" required><input name="email" type="email" placeholder="Your email" required>
        <textarea name="msg" rows="4" placeholder="How can we help?" required></textarea><button class="btn" type="submit">Send message</button>
      </form>` : ""}
    </div>
    ${mapSrc ? `<div class="map reveal"><iframe src="${esc(mapSrc)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map of ${esc(name)}"></iframe>
      ${has(c.mapUrl) && /^https?:/.test(c.mapUrl) ? `<a class="map-link" href="${esc(c.mapUrl)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>` : ""}</div>` : ""}
  </div>
</div></section>`,
    };

    const order = d.sectionOrder || ["hero", "stats", "about", "services", "gallery", "video", "team", "reviews", "faq", "cta", "contact"];
    const hidden = new Set(d.hiddenSections || []);
    const body = order.filter((k) => !hidden.has(k)).map((k) => sec[k] || "").join("\n");

    const css = `
:root{--primary:${primary};--accent:${accent};--bg:${t.bg};--surface:${t.surface};--text:${t.text};--muted:${t.muted};--radius:${t.radius};--head:'${headFont}',system-ui,sans-serif;--body:'${bodyFont}',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
body{font-family:var(--body);background:var(--bg);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
h1,h2,h3,h4{font-family:var(--head);line-height:1.15;letter-spacing:-.01em}
.wrap{width:min(1160px,100% - 40px);margin-inline:auto}.narrow{max-width:820px}
section{padding:96px 0}section.alt{background:var(--surface)}
.eyebrow{display:inline-block;font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px}
h2{font-size:clamp(1.9rem,3.6vw,2.8rem);margin-bottom:18px}
.sec-head{text-align:center;max-width:680px;margin:0 auto 52px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:calc(var(--radius) + 40px);background:var(--primary);color:#fff;font-weight:700;text-decoration:none;border:2px solid var(--primary);cursor:pointer;font:inherit;font-weight:700;transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px -10px var(--primary)}
.btn.ghost{background:transparent;color:inherit;border-color:currentColor}.btn.light{background:#fff;color:var(--primary);border-color:#fff}
header{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid color-mix(in srgb,var(--text) 8%,transparent)}
.nav{display:flex;align-items:center;justify-content:space-between;height:72px;gap:20px}
.logo{display:flex;align-items:center;gap:10px;font-family:var(--head);font-weight:800;font-size:1.25rem;text-decoration:none}
.logo img{height:42px;width:auto;border-radius:6px}
.menu{display:flex;gap:28px;list-style:none;align-items:center}.menu a{text-decoration:none;font-weight:600;font-size:.95rem;opacity:.8}.menu a:hover{opacity:1;color:var(--primary)}
.menu .btn{padding:10px 20px;opacity:1;color:#fff}
.burger{display:none;background:none;border:0;color:inherit;font-size:1.8rem;cursor:pointer}
.hero{position:relative;padding:150px 0 130px;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 14%,var(--bg)),var(--bg) 60%,color-mix(in srgb,var(--accent) 14%,var(--bg)))}
.hero.has-img{color:#fff;min-height:88vh;display:flex;align-items:center}
.hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.05)}
.hero.has-img::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(0,0,0,.78),rgba(0,0,0,.35) 70%,rgba(0,0,0,.2))}
.hero-inner{position:relative;z-index:1;max-width:820px}.hero.has-img .eyebrow{color:#fff;opacity:.85}
.hero h1{font-size:clamp(2.5rem,6.4vw,4.6rem);margin-bottom:22px;font-weight:800}
.lead{font-size:clamp(1.05rem,1.6vw,1.25rem);opacity:.88;max-width:640px;margin-bottom:34px}
.hero-actions{display:flex;flex-wrap:wrap;gap:14px}
.stats{padding:0;margin-top:-52px;position:relative;z-index:2}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;background:var(--bg);padding:28px;border-radius:var(--radius);box-shadow:0 20px 60px -25px rgba(0,0,0,.35)}
.stat{text-align:center}.stat strong{display:block;font-family:var(--head);font-size:2.2rem;color:var(--primary)}.stat span{color:var(--muted);font-size:.92rem}
.about.two{display:grid;grid-template-columns:1.1fr 1fr;gap:64px;align-items:center}
.about-img{border-radius:var(--radius);aspect-ratio:4/5;object-fit:cover;width:100%;box-shadow:0 30px 60px -30px rgba(0,0,0,.45)}
.prose p{color:var(--muted);margin-bottom:16px;font-size:1.06rem}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px}
.card{background:var(--bg);border-radius:var(--radius);overflow:hidden;border:1px solid color-mix(in srgb,var(--text) 8%,transparent);transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-6px);box-shadow:0 24px 50px -24px rgba(0,0,0,.35)}
.card img{width:100%;aspect-ratio:16/10;object-fit:cover}.card-body{padding:24px}
.card-top{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:8px}.card h3{font-size:1.2rem}
.price{font-weight:800;color:var(--primary);white-space:nowrap}.card p{color:var(--muted);font-size:.97rem}
.gallery{columns:3 260px;column-gap:16px}
.g-item{display:block;width:100%;margin-bottom:16px;border:0;padding:0;background:none;cursor:zoom-in;border-radius:var(--radius);overflow:hidden;break-inside:avoid}
.g-item img{width:100%;transition:transform .5s}.g-item:hover img{transform:scale(1.05)}
.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:100;padding:30px}
.lightbox[hidden]{display:none}.lightbox img{max-height:90vh;border-radius:8px}.lb-close{position:absolute;top:16px;right:24px;font-size:2.5rem;color:#fff;background:none;border:0;cursor:pointer}
.video{position:relative;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden}.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.team{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:28px;text-align:center}
.member img,.avatar{width:150px;height:150px;border-radius:50%;object-fit:cover;margin:0 auto 16px}
.avatar{display:grid;place-items:center;background:var(--primary);color:#fff;font-size:3rem;font-family:var(--head)}
.member span{color:var(--primary);font-weight:600;font-size:.92rem}.member p{color:var(--muted);font-size:.92rem;margin-top:8px}
.reviews{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.review{background:var(--bg);padding:30px;border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--text) 8%,transparent)}
.stars{color:#f5b301;letter-spacing:2px;margin-bottom:12px}.review blockquote{font-size:1.04rem;margin-bottom:16px}.review figcaption{color:var(--muted);font-size:.92rem}
details{border-bottom:1px solid color-mix(in srgb,var(--text) 12%,transparent);padding:20px 0}
summary{cursor:pointer;font-weight:700;font-size:1.08rem;list-style:none;display:flex;justify-content:space-between;gap:16px}
summary::after{content:"+";color:var(--primary);font-size:1.5rem;line-height:1}details[open] summary::after{content:"–"}
details div{color:var(--muted);padding-top:12px}
.cta-band{background:linear-gradient(120deg,var(--primary),var(--accent));color:#fff;text-align:center;padding:80px 0}
.cta-band h2{margin-bottom:28px}
.contact-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:48px;align-items:start}
.ci{margin-bottom:22px}.ci h4{font-size:.8rem;text-transform:uppercase;letter-spacing:.12em;color:var(--primary);margin-bottom:4px}.ci a{text-decoration:none}
.socials{display:flex;gap:10px;margin:8px 0 26px;flex-wrap:wrap}
.socials a{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:var(--surface);transition:background .2s,color .2s}.socials a:hover{background:var(--primary);color:#fff}
.cform{display:grid;gap:12px}
.cform input,.cform textarea{font:inherit;padding:14px 16px;border-radius:calc(var(--radius) / 2 + 4px);border:1px solid color-mix(in srgb,var(--text) 18%,transparent);background:var(--bg);color:var(--text)}
.map{border-radius:var(--radius);overflow:hidden;min-height:420px;position:relative;box-shadow:0 20px 50px -30px rgba(0,0,0,.4)}
.map iframe{width:100%;height:440px;border:0;display:block}.map-link{position:absolute;bottom:14px;left:14px;background:var(--bg);padding:8px 14px;border-radius:30px;font-weight:600;font-size:.88rem;text-decoration:none}
footer{background:${t.dark ? "#050508" : "#0f1115"};color:#cfd2da;padding:56px 0 30px}
.foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px;align-items:center}.foot .logo{color:#fff}
.foot small{display:block;margin-top:30px;opacity:.6;text-align:center;width:100%}
.wa{position:fixed;right:22px;bottom:22px;width:60px;height:60px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:60}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .8s ease,transform .8s ease}.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
@media (max-width:860px){section{padding:70px 0}.about.two,.contact-grid{grid-template-columns:1fr;gap:36px}
.burger{display:block}.menu{position:fixed;inset:72px 0 auto 0;flex-direction:column;background:var(--bg);padding:24px;gap:18px;transform:translateY(-130%);transition:transform .3s;box-shadow:0 20px 40px rgba(0,0,0,.15)}
.menu.open{transform:none}.hero{padding:110px 0 100px}}`;

    const js = `
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const menu=document.querySelector('.menu');document.querySelector('.burger')?.addEventListener('click',()=>menu.classList.toggle('open'));
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.classList.remove('open')));
const lb=document.getElementById('lb');if(lb){const im=lb.querySelector('img');document.querySelectorAll('.g-item').forEach(b=>b.addEventListener('click',()=>{im.src=b.querySelector('img').src;lb.hidden=false}));lb.addEventListener('click',e=>{if(e.target!==im)lb.hidden=true})}
document.querySelector('.cform')?.addEventListener('submit',e=>{e.preventDefault();const f=e.target;location.href='mailto:'+f.dataset.to+'?subject='+encodeURIComponent('Enquiry from '+f.name.value)+'&body='+encodeURIComponent(f.msg.value+'\\n\\n'+f.name.value+' <'+f.email.value+'>')});`;

    return `<!DOCTYPE html>
<html lang="${esc(d.lang || "en")}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(seo.title || `${name}${b.tagline ? " – " + b.tagline : ""}`)}</title>
<meta name="description" content="${esc(seo.description || b.description || "")}">
${has(seo.keywords) ? `<meta name="keywords" content="${esc(seo.keywords)}">` : ""}
<meta property="og:title" content="${esc(seo.title || name)}"><meta property="og:description" content="${esc(seo.description || b.description || "")}">
${m.hero && !m.hero.startsWith("data:") ? `<meta property="og:image" content="${esc(m.hero)}">` : ""}
<meta name="theme-color" content="${esc(primary)}">
${b.logo ? `<link rel="icon" href="${esc(b.logo)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
<style>${css}</style>
</head>
<body>
<header><div class="wrap nav">
  <a class="logo" href="#home">${b.logo ? `<img src="${esc(b.logo)}" alt="${esc(name)} logo">` : ""}<span>${esc(name)}</span></a>
  <button class="burger" aria-label="Menu">☰</button>
  <ul class="menu">${nav.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join("")}<li><a class="btn" href="${esc(ctaLink)}">${esc(ctaText)}</a></li></ul>
</div></header>
<main>${body}</main>
<footer><div class="wrap foot">
  <a class="logo" href="#home">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ""}<span>${esc(name)}</span></a>
  ${socials.length ? `<div class="socials">${socials.map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${esc(k)}">${icon(k)}</a>`).join("")}</div>` : ""}
  <small>© ${new Date().getFullYear()} ${esc(name)}. All rights reserved.</small>
</div></footer>
${waNum ? `<a class="wa" href="https://wa.me/${waNum}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${icon("whatsapp", 30)}</a>` : ""}
<script>${js}</script>
</body></html>`;
  }

  global.SiteForge = { generateSite, THEMES, mapEmbedFrom };
})(typeof window !== "undefined" ? window : globalThis);
