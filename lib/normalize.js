// Coerce AI output into the exact shape the builder form expects (models vary in field names/types).
const toStr = (v) => (v == null ? "" : Array.isArray(v) ? v.map(toStr).filter(Boolean).join(", ") : typeof v === "object" ? (v.url || v.name || v.text || "") : String(v));
const pick = (o, ...keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== "") return o[k]; return ""; };
const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const strs = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(toStr).filter((u) => /^https?:\/\//.test(u));

export function normalizeBrandData(d = {}) {
  const b = d.brand || {}, c = d.contact || {}, m = d.media || {}, s = d.social || {};
  const obj = (src, keys) => Object.fromEntries(keys.map((k) => [k, toStr(src[k])]));
  const out = {
    brand: obj(b, ["name", "tagline", "industry", "description", "about", "founded", "logo", "primaryColor", "accentColor"]),
    contact: obj(c, ["phone", "whatsapp", "email", "address", "mapUrl", "priceRange"]),
    media: { hero: toStr(m.hero), gallery: strs(m.gallery), video: toStr(m.video) },
    services: list(d.services || d.products || d.menu).map((x) => ({
      title: toStr(pick(x, "title", "name")), description: toStr(pick(x, "description", "desc", "details")),
      price: toStr(x.price), image: toStr(pick(x, "image", "photo", "img")),
    })),
    stats: list(d.stats).map((x) => ({ value: toStr(pick(x, "value", "number")), label: toStr(pick(x, "label", "title", "name")) })),
    testimonials: list(d.testimonials || d.reviews).map((x) => ({
      name: toStr(pick(x, "name", "author")), role: toStr(pick(x, "role", "source")),
      text: toStr(pick(x, "text", "review", "quote", "body")), rating: toStr(pick(x, "rating", "stars") || "5"),
    })),
    team: list(d.team).map((x) => ({ name: toStr(x.name), role: toStr(pick(x, "role", "title")), photo: toStr(pick(x, "photo", "image")), bio: toStr(x.bio) })),
    faq: list(d.faq || d.faqs).map((x) => ({ q: toStr(pick(x, "q", "question")), a: toStr(pick(x, "a", "answer")) })),
    social: obj(s, ["instagram", "facebook", "twitter", "linkedin", "youtube", "tiktok", "pinterest", "website"]),
    cta: obj(d.cta || {}, ["text", "link"]),
    seo: obj(d.seo || {}, ["title", "description", "keywords"]),
  };
  // hours may come as a list or object ({Monday: "9-5"})
  const h = c.hours ?? c.openingHours;
  out.contact.hours = Array.isArray(h) ? h.map(toStr).join("\n") : h && typeof h === "object" ? Object.entries(h).map(([k, v]) => `${k}: ${toStr(v)}`).join("\n") : toStr(h);
  if (!out.social.twitter && s.x) out.social.twitter = toStr(s.x);
  if (Array.isArray(d.sources)) out.sources = d.sources.map(toStr).filter(Boolean);
  return out;
}
