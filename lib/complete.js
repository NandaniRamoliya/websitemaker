// Fill every editor field that can be filled honestly (never invents facts).
import { CATEGORIES } from "./categories.js";

const SECTION_TITLES = {
  jewellery: "Our Collections", spa: "Our Therapies", clinic: "Our Treatments", dental: "Our Treatments",
  restaurant: "Menu Highlights", salon: "Our Services", makeup: "Makeup Services", nails: "Nail Services",
  banquet: "Events We Host", general: "Our Services",
};
const TEMPLATE_THEMES = { jewellery: "elegant", spa: "fresh", clinic: "modern", dental: "modern", restaurant: "bold", salon: "minimal", makeup: "elegant", nails: "fresh", banquet: "elegant", general: "modern" };
const ICON_FONTS = /icon|symbol|awesome|material/i;

/** First Google Font family used by a page (its heading font, usually). */
export function fontFromHtml(html) {
  const href = String(html || "").match(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/i)?.[1];
  if (!href) return "";
  const fams = [...href.replace(/&amp;/g, "&").matchAll(/family=([^:&]+)/g)].map((m) => decodeURIComponent(m[1].replace(/\+/g, " ")).trim());
  return fams.find((f) => !ICON_FONTS.test(f)) || "";
}

const initials = (name) => {
  const words = String(name).normalize("NFKC").replace(/[^A-Za-z0-9 &]/g, " ").split(/\s+/).filter((w) => w && !/^(the|and|&|of|pvt|ltd|llp)$/i.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** A clean monogram logo (SVG data URL) in the brand colours. */
export function monogramLogo(name, primary = "#4f46e5", accent = "#06b6d4", serif = false) {
  const txt = initials(name);
  const font = serif ? "Georgia, 'Times New Roman', serif" : "'Helvetica Neue', Arial, sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(primary)}"/><stop offset="1" stop-color="${esc(accent)}"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g)"/><text x="60" y="60" dy=".35em" text-anchor="middle" font-family="${font}" font-size="${txt.length > 1 ? 50 : 62}" font-weight="700" fill="#fff" letter-spacing="1">${esc(txt)}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

/**
 * @param {object} data   brand data (from leadToBrandData + AI copy)
 * @param {string} html   the generated page (to read the fonts it really uses)
 */
export function completeData(data, html = "") {
  const d = structuredClone(data);
  d.brand ||= {}; d.contact ||= {}; d.media ||= {}; d.social ||= {}; d.cta ||= {}; d.seo ||= {}; d.labels ||= {}; d.meta ||= {};
  const key = d.meta.category || "general";
  const cat = CATEGORIES[key] || CATEGORIES.general;
  const place = [d.meta.locality, d.meta.city].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");

  // Design
  if (!d.brand.template || d.brand.template === "modern" && key !== "general") d.brand.template = TEMPLATE_THEMES[key] || "modern";
  const font = fontFromHtml(html);
  if (font) d.brand.font = font;
  else if (!d.brand.font || d.brand.font === "theme") d.brand.font = /serif|luxury|heritage|editorial|elegant|bridal|royal/i.test(d.meta.look?.style || "") ? "Playfair Display" : "Poppins";
  d.lang ||= "en";
  if (!/^#[0-9a-f]{6}$/i.test(d.brand.primaryColor || "")) d.brand.primaryColor = "";
  if (!/^#[0-9a-f]{6}$/i.test(d.brand.accentColor || "")) d.brand.accentColor = "";

  // Brand
  if (!d.brand.industry || / · [a-z]/.test(d.brand.industry)) d.brand.industry = place ? `${cat.label} · ${place}` : cat.label;
  if (!d.brand.logo) d.brand.logo = monogramLogo(d.brand.name || "?", d.brand.primaryColor || "#4f46e5", d.brand.accentColor || d.brand.primaryColor || "#06b6d4", /Playfair|Cormorant|Lora|Merriweather|serif/i.test(d.brand.font));
  if (!d.brand.description && d.brand.about) d.brand.description = d.brand.about.split(/(?<=\.)\s/)[0];
  if (!d.brand.tagline && d.brand.name) d.brand.tagline = place ? `${cat.label} in ${place}` : d.brand.name;

  // Sections
  d.labels.services ||= SECTION_TITLES[key] || "Our Services";
  const imgs = [d.media.hero, ...(d.media.gallery || [])].filter(Boolean);
  (d.services || []).forEach((s, i) => { if (!s.image && imgs.length) s.image = imgs[(i + 1) % imgs.length]; });
  d.highlights ||= [];

  // Contact & links
  if (d.contact.mapUrl) d.social.google ||= d.contact.mapUrl;
  if (!d.cta.text) d.cta.text = d.contact.whatsapp ? "Chat on WhatsApp" : "Call now";
  if (!d.cta.link) d.cta.link = d.contact.whatsapp ? `https://wa.me/${d.contact.whatsapp.replace(/\D/g, "")}` : d.contact.phone ? `tel:${d.contact.phone.replace(/[^\d+]/g, "")}` : "#contact";
  if (!d.cta.headline && d.brand.name) d.cta.headline = `Visit ${d.brand.name}${d.meta.locality ? " in " + d.meta.locality : ""}`;

  // SEO
  d.seo.title ||= `${d.brand.name}${place ? " – " + cat.label + " in " + place : ""}`;
  d.seo.description ||= d.brand.description || "";
  if (!d.seo.keywords) d.seo.keywords = [d.brand.name, cat.label, d.meta.locality, d.meta.city].filter(Boolean).join(", ");

  // What still needs the owner (shown in the editor as "to do")
  d.meta.needsOwner = [
    !d.contact.hours && "opening hours",
    !d.contact.email && "email",
    !d.contact.priceRange && "price range",
    !d.brand.founded && "founded year",
    !(d.social.instagram || d.social.facebook) && "Instagram / Facebook",
    !(d.testimonials || []).length && "2–3 real Google reviews",
    d.meta.photosAreStock && !d.meta.realPhotos && "their own photos",
  ].filter(Boolean);
  return d;
}
