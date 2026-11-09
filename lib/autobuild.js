// One click: Google Maps link (or a lead row) → facts → AI copy → unique AI design → saved demo site.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMap, parseMapUrl } from "./maps.js";
import { leadToBrandData, cleanName } from "./leads.js";
import { detectCategory, pickLook } from "./categories.js";
import { placesEnabled, placeDetails, findPlaceId } from "./places.js";
import { contentPrompt, autoDesignPrompt, repairPrompt, extractJson } from "./prompts.js";
import { aiProvider, generateText, streamHtml, friendlyError } from "./ai.js";
import { heal } from "./siteDoctor.js";
import { completeData } from "./complete.js";
import "../public/generator.js"; // sets globalThis.SiteForge (template fallback)

const here = path.dirname(fileURLToPath(import.meta.url));
export const SITES_DIR = process.env.SITES_DIR || path.join(here, "..", "sites");

export const slugify = (s) => String(s || "site").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "site";

const REGISTRY = () => path.join(SITES_DIR, "index.json");
export async function listSites() {
  try { return JSON.parse(await fs.readFile(REGISTRY(), "utf8")); } catch { return {}; }
}
async function saveRegistryEntry(slug, entry) {
  const reg = await listSites();
  reg[slug] = { ...(reg[slug] || {}), ...entry };
  await fs.mkdir(SITES_DIR, { recursive: true });
  await fs.writeFile(REGISTRY(), JSON.stringify(reg, null, 1));
}

/** Merge real Places data over sheet data (Places is authoritative when present). */
function mergeFacts(base, extra) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = { ...(out[k] || {}), ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x !== "")) };
    else if (Array.isArray(v) ? v.length : v) out[k] = v;
  }
  return out;
}

// Leads from the last loaded sheet, so a pasted Maps link can be matched to its full row.
const LEADS_CACHE = () => path.join(SITES_DIR, "leads-cache.json");
export async function rememberLeads(leads) {
  await fs.mkdir(SITES_DIR, { recursive: true });
  await fs.writeFile(LEADS_CACHE(), JSON.stringify(leads));
}
async function findKnownLead(m) {
  let leads = [];
  try { leads = JSON.parse(await fs.readFile(LEADS_CACHE(), "utf8")); } catch { return null; }
  const norm = (x) => String(x || "").toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g, "");
  return leads.find((l) => {
    const lm = parseMapUrl(l.mapsUrl);
    return (m.placeId && lm.placeId === m.placeId) ||
      (m.lat != null && lm.lat != null && Math.abs(lm.lat - m.lat) < 1e-4 && Math.abs(lm.lng - m.lng) < 1e-4) ||
      (m.placeName && norm(cleanName(l.rawName).name) === norm(cleanName(m.placeName).name));
  }) || null;
}

/** Build base data from a bare Google Maps link (no sheet row). */
async function leadFromMapUrl(mapUrl, hint = {}) {
  const m = await resolveMap(mapUrl);
  const known = await findKnownLead(m);
  if (known) return { ...known, matchedFromSheet: true };
  const raw = hint.name || m.placeName || m.query || "";
  const { name, keywords } = cleanName(raw);
  return {
    id: null, rawName: raw, name, keywords, phone: hint.phone || "", rating: hint.rating || "", reviews: hint.reviews || "",
    address: hint.address || "", mapsUrl: m.resolvedUrl || mapUrl, website: "", hasWebsite: false,
    specialty: hint.category || "", locality: "", category: detectCategory(hint.category, raw),
  };
}

function applyCopy(data, c) {
  const d = structuredClone(data);
  d.brand.tagline = c.tagline || d.brand.tagline || "";
  d.brand.description = c.description || d.brand.description || "";
  d.brand.about = c.about || "";
  if (/^#[0-9a-f]{6}$/i.test(c.primaryColor || "")) d.brand.primaryColor = c.primaryColor;
  if (/^#[0-9a-f]{6}$/i.test(c.accentColor || "")) d.brand.accentColor = c.accentColor;
  if (Array.isArray(c.services) && c.services.length) {
    const imgs = d.media.gallery || [];
    d.services = c.services.filter((s) => s?.title).slice(0, 8).map((s, i) => ({ title: String(s.title), description: String(s.description || ""), price: "", image: imgs[i % Math.max(imgs.length, 1)] || "" }));
  }
  if (Array.isArray(c.highlights)) d.highlights = c.highlights.filter((h) => h?.title).slice(0, 6).map((h) => ({ title: String(h.title), text: String(h.text || "") }));
  if (Array.isArray(c.faq)) d.faq = c.faq.filter((f) => f?.q || f?.question).slice(0, 7).map((f) => ({ q: String(f.q || f.question), a: String(f.a || f.answer || "") }));
  d.cta.headline = c.ctaHeadline || "";
  d.seo = { title: c.seoTitle || `${d.brand.name} – ${d.meta.locality || d.meta.city || ""}`.replace(/ – $/, ""), description: c.seoDescription || d.brand.description, keywords: [c.seoKeywords, d.seo.keywords].filter(Boolean).join(", ") };
  return d;
}

export function cleanHtml(t) {
  let h = String(t || "");
  // Safety net: if output ever contains more than one document, keep the last one.
  const lastDoc = h.search(/<!DOCTYPE html(?![\s\S]*<!DOCTYPE html)/i);
  if (lastDoc > 0) h = h.slice(lastDoc);
  h = h.replace(/^[\s\S]*?(<!DOCTYPE html|<html)/i, "$1").replace(/```\s*$/g, "").trim();
  const end = h.toLowerCase().lastIndexOf("</html>");
  if (end > 0) h = h.slice(0, end + 7);
  return h;
}

/** Required parts of a demo website. Returns the list of what's missing. */
export function qualityGate(html, data = {}) {
  const h = String(html);
  const low = h.toLowerCase();
  const missing = [];
  const hasSection = (re) => re.test(low);
  if ((data.services || []).length && !hasSection(/id=["'][^"']*(service|menu|treatment|therap|collection|offering)/)) missing.push("a services section (cards for every service, each with a “Book this →” WhatsApp link)");
  if ((data.highlights || []).length && !hasSection(/id=["'][^"']*(why|highlight|choose|feature|standard)|why choose/)) missing.push("a “Why choose us” section using the highlights");
  if ((data.media?.gallery || []).length && (h.match(/<img\b/gi) || []).length < 4) missing.push("a photo gallery using media.gallery");
  if ((data.faq || []).length && !hasSection(/id=["'][^"']*faq|frequently asked/)) missing.push("an FAQ accordion with the FAQ items");
  if (data.contact?.phone && !/href=["']tel:/i.test(h)) missing.push("click-to-call phone links (tel:) in the hero/contact section");
  if (data.contact?.whatsapp && !/wa\.me\//i.test(h)) missing.push("WhatsApp buttons (wa.me)");
  if (data.contact?.mapEmbed && !/<iframe[^>]+maps/i.test(h)) missing.push("an embedded Google Map in the contact section");
  if (!/<footer/i.test(h)) missing.push("a footer with name, address, phone, quick links");
  if (!/<button[^>]*(menu|nav|burger|hamburger|toggle)|aria-label=["'][^"']*menu/i.test(h)) missing.push("a hamburger menu button for phones");
  return missing;
}

/** Visible-text claims a business may not be able to back up. Returns short labels. */
export function checkClaims(html, data = {}) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ");
  const rules = [
    [/\b(BIS|hallmark(ed)?|ISO\s?\d*|NABH|NABL|FSSAI)\b/i, "certification claim"],
    [/\b100\s?%/i, "“100%” claim"],
    [/\b(guarantee[d]?|certified)\b/i, "guarantee/certified claim"],
    [/\b(no\.?\s?1|number one|best in [A-Z][a-z]+|#1)\b/i, "“best/No.1” claim"],
    [/\baward[- ]?winning|\bawards?\b/i, "award claim"],
    [/\b\d+\+?\s*(years?|yrs)\b(?! ago)/i, "years-of-experience claim"],
    [/\b(positive|happy|satisfied|verified)\s+(google\s+)?reviews\b/i, "reviews described as positive/verified"],
  ];
  const out = [];
  for (const [re, label] of rules) {
    const m = text.match(re);
    if (m && !out.includes(label)) out.push(`${label} (“${m[0].trim()}”)`);
  }
  // numbers of customers that don't match the review count
  const cust = text.match(/\b(\d[\d,]*)\+?\s*(happy\s+)?(customers|clients|patients|guests)\b/i);
  if (cust) out.push(`customer count (“${cust[0]}”)`);
  return out;
}

/** Quality fixes applied to every generated website (AI or template). */
export function polishHtml(html, data) {
  let h = html;
  const fixes = [];
  // Floating WhatsApp button if the design forgot it.
  const wa = String(data.contact?.whatsapp || "").replace(/\D/g, "");
  if (wa && !/wa\.me\//.test(h)) {
    fixes.push("WhatsApp button");
    h = h.replace(/<\/body>(?![\s\S]*<\/body>)/i, `<a href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp" style="position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;background:#25d366;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:9999"><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z"/></svg></a></body>`);
  }
  // Map section if the design forgot it.
  if (data.contact?.mapEmbed && !/<iframe[^>]+maps/i.test(h)) {
    fixes.push("map");
    h = h.replace(/<footer/i, `<section style="padding:0"><iframe src="${data.contact.mapEmbed.replace(/"/g, "&quot;")}" title="Map" loading="lazy" style="width:100%;height:420px;border:0;display:block"></iframe></section><footer`);
  }
  // Content sections the design forgot (neutral style that inherits the page's fonts/colours).
  const E = (x) => String(x || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const missingNow = qualityGate(h, data);
  const blocks = [];
  const wrap = (id, title, inner) => `<section id="${id}" style="padding:72px 20px"><div style="max-width:1100px;margin:0 auto"><h2 style="text-align:center;margin:0 0 32px">${title}</h2>${inner}</div></section>`;
  if (missingNow.some((m) => m.startsWith("a “Why choose us”"))) {
    fixes.push("why-choose-us");
    blocks.push(wrap("why-us", "Why choose us", `<div style="display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${(data.highlights || []).map((x) => `<div style="padding:24px;border-radius:16px;border:1px solid rgba(127,127,127,.25)"><h3 style="margin:0 0 6px">${E(x.title)}</h3><p style="margin:0;opacity:.8">${E(x.text)}</p></div>`).join("")}</div>`));
  }
  if (missingNow.some((m) => m.startsWith("a photo gallery"))) {
    fixes.push("gallery");
    blocks.push(wrap("gallery", "Gallery", `<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${(data.media?.gallery || []).map((g, i) => `<img src="${E(g)}" alt="${E(data.brand?.name)} photo ${i + 1}" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px">`).join("")}</div>`));
  }
  if (missingNow.some((m) => m.startsWith("an FAQ"))) {
    fixes.push("FAQ");
    blocks.push(wrap("faq", "Frequently asked questions", `<div style="max-width:760px;margin:0 auto">${(data.faq || []).map((f) => `<details style="border-bottom:1px solid rgba(127,127,127,.3);padding:16px 0"><summary style="cursor:pointer;font-weight:600;font-size:1.05rem">${E(f.q)}</summary><p style="margin:10px 0 0;opacity:.85">${E(f.a)}</p></details>`).join("")}</div>`));
  }
  if (blocks.length) {
    const html = blocks.join("");
    const anchor = h.search(/<section[^>]*id=["'][^"']*(contact|location|visit)[^"']*["']/i);
    h = anchor > 0 ? h.slice(0, anchor) + html + h.slice(anchor) : /<footer/i.test(h) ? h.replace(/<footer/i, html + "<footer") : h.replace(/<\/body>(?![\s\S]*<\/body>)/i, html + "</body>");
  }
  // Footer if the design forgot it.
  if (!/<footer/i.test(h)) {
    fixes.push("footer");
    const e = (x) => String(x || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const ids = [...h.matchAll(/<section[^>]*\bid=["']([^"']+)["'][^>]*>[\s\S]{0,600}?<h2[^>]*>([\s\S]*?)<\/h2>/gi)].slice(0, 6)
      .map((m) => [m[1], m[2].replace(/<[^>]+>/g, "").trim().slice(0, 28)]).filter((x) => x[1]);
    const tel = String(data.contact?.phone || "").replace(/[^\d+]/g, "");
    const footer = `<footer style="background:#111318;color:#cfd2da;padding:48px 20px 28px;font:15px/1.6 system-ui,sans-serif"><div style="max-width:1100px;margin:0 auto;display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"><div><strong style="color:#fff;font-size:1.2rem">${e(data.brand?.name)}</strong><p style="margin:.5rem 0 0;opacity:.8">${e(data.brand?.tagline)}</p></div><div><strong style="color:#fff">Visit us</strong><p style="margin:.5rem 0 0;opacity:.8">${e(data.contact?.address)}</p>${tel ? `<p style="margin:.4rem 0 0"><a href="tel:${e(tel)}" style="color:#fff">${e(data.contact.phone)}</a></p>` : ""}</div>${ids.length ? `<div><strong style="color:#fff">Quick links</strong>${ids.map(([id, t]) => `<a href="#${e(id)}" style="display:block;color:#cfd2da;text-decoration:none;padding:4px 0">${e(t)}</a>`).join("")}</div>` : ""}</div><p style="max-width:1100px;margin:28px auto 0;opacity:.55;font-size:13px">© ${new Date().getFullYear()} ${e(data.brand?.name)}. All rights reserved.</p></footer>`;
    h = h.replace(/<\/body>(?![\s\S]*<\/body>)/i, footer + "</body>");
  }
  // Links, menus, scrolling, forms, images, animations – see lib/siteDoctor.js
  h = heal(h, data);
  return { html: h, fixes };
}

const TEMPLATE_THEMES = { jewellery: "elegant", spa: "fresh", clinic: "modern", dental: "modern", restaurant: "bold", salon: "minimal", makeup: "elegant", nails: "fresh", banquet: "elegant", general: "modern" };

/**
 * @param {{ lead?: object, mapUrl?: string, hint?: object, variant?: number, style?: string }} input
 * @param {(ev:{type:string, msg?:string, text?:string}) => void} emit
 */
export async function autoBuild(input, emit = () => {}) {
  const say = (msg) => emit({ type: "log", msg });

  // 1) Facts
  const lead = input.lead || await leadFromMapUrl(input.mapUrl, input.hint);
  if (!lead.name) throw new Error("Couldn't read a business name from that link. Use a Google Maps *place* link (it contains /maps/place/…), or load your leads sheet.");
  if (lead.matchedFromSheet) say("✓ Found this business in your leads sheet – using its phone, address & rating");
  let data = leadToBrandData(lead);
  say(`📍 ${lead.name} – ${data.brand.industry}${lead.rating ? ` · ${lead.rating}★ (${lead.reviews} reviews)` : ""}`);

  if (placesEnabled()) {
    try {
      const placeId = data.meta.placeId || await findPlaceId(`${lead.name} ${lead.address}`.trim());
      if (placeId) {
        const real = await placeDetails(placeId);
        data = mergeFacts(data, real);
        say(`✓ Google Places: ${real.media?.gallery ? (real.media.gallery.length + 1) + " real photos, " : ""}${real.testimonials.length} reviews${real.contact.hours ? ", opening hours" : ""}`);
      }
    } catch (e) { say(`⚠ Google Places skipped: ${e.message}`); }
  } else if (!lead.phone && !lead.address) {
    say("ℹ Only the link was given – load your leads sheet (or set GOOGLE_PLACES_API_KEY) for phone, address & rating.");
  }
  if (data.meta.photosAreStock && !data.meta.realPhotos) say("🖼 Using free stock photos for this business type (swap in their own photos later).");

  const look = pickLook(data.meta.category, lead.name, input.variant || 0);
  if (input.style) look.style = input.style;
  data.meta.look = look;
  say(`🎨 Design direction: ${look.style.split(":")[0]}`);

  const slug = slugify(`${lead.name} ${data.meta.locality || data.meta.city || ""}`);
  let html = "";
  let engine = "template";
  let quality = "template";

  if (aiProvider()) {
    // 2) Copy
    try {
      say("✍ Writing website content…");
      const copy = extractJson(await generateText(contentPrompt(data), { effort: "low", onNote: (m) => say("⏳ " + m) }));
      data = applyCopy(data, copy);
      say(`✓ Content: “${data.brand.tagline}”`);
    } catch (e) { say(`⚠ Copywriting failed (${friendlyError(e)}) – continuing with basic copy.`); }
    emit({ type: "data", data });

    // 3) Design
    try {
      say("✨ Designing a unique website (about 1–2 minutes)…");
      let out = "";
      await streamHtml(autoDesignPrompt(data, look),
        (t) => { out += t; emit({ type: "html", text: t }); },
        () => { if (out) say("↻ Model hiccup – restarting the design"); out = ""; emit({ type: "reset" }); },
        (m) => say("⏳ " + m));
      let cleaned = cleanHtml(out);
      if (!/<\/html>/i.test(cleaned) || cleaned.length < 4000) throw new Error("design came back incomplete");
      // Quality gate: if required parts are missing, one automatic repair pass in the same style.
      let missing = qualityGate(cleaned, data);
      if (missing.length) {
        say(`🩹 Design is missing ${missing.length} part(s) – repairing: ${missing.map((m) => m.split(" (")[0]).join(", ")}`);
        let fixed = "";
        try {
          await streamHtml(repairPrompt(cleaned, missing, data), (t) => { fixed += t; }, () => { fixed = ""; }, (m) => say("⏳ " + m));
          const fixedHtml = cleanHtml(fixed);
          const stillMissing = /<\/html>/i.test(fixedHtml) && fixedHtml.length > cleaned.length * 0.8 ? qualityGate(fixedHtml, data) : null;
          if (stillMissing && stillMissing.length < missing.length) { cleaned = fixedHtml; missing = stillMissing; emit({ type: "reset" }); emit({ type: "html", text: cleaned }); }
        } catch (e) { say(`⚠ Repair failed (${friendlyError(e)})`); }
        say(missing.length ? `⚠ Still missing: ${missing.map((m) => m.split(" (")[0]).join(", ")} – rebuild later (↻ New design) for a fuller design` : "✓ Repaired – all required parts present");
      }
      const polished = polishHtml(cleaned, data);
      const finalMissing = qualityGate(polished.html.replace(/<script data-sf-doctor>[\s\S]*?<\/script>/, ""), data);
      // "basic" = we had to add generic sections or parts are still missing → worth rebuilding later
      quality = finalMissing.length || polished.fixes.some((f) => ["why-choose-us", "gallery", "FAQ", "footer"].includes(f)) ? "basic" : "full";
      html = polished.html;
      if (polished.fixes.length) say(`🔧 Auto-fixed: added ${polished.fixes.join(", ")}`);
      engine = "ai";
      say("✓ AI design complete");
    } catch (e) {
      say(`⚠ AI design failed (${friendlyError(e)}) – using the quick template instead.`);
    }
  } else {
    say("ℹ No AI key – building with the quick template. Add GEMINI_API_KEY (free) for unique AI designs.");
    emit({ type: "data", data });
  }

  if (!html) {
    data.brand.template = TEMPLATE_THEMES[data.meta.category] || "modern";
    html = polishHtml(globalThis.SiteForge.generateSite(data), data).html;
  }

  // Fill every editor field we honestly can (logo, fonts, section titles, links, SEO…)
  data = completeData(data, html);
  if (data.meta.needsOwner.length) say(`📝 Ask the owner for: ${data.meta.needsOwner.join(", ")}`);

  // 4) Claims check – flag anything the owner might not be able to back up.
  const warnings = checkClaims(html, data);
  if (warnings.length) say(`⚠ Please check before showing: ${warnings.join(" · ")}`);

  // 5) Save
  const dir = path.join(SITES_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), html);
  await fs.writeFile(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  await saveRegistryEntry(slug, {
    name: data.brand.name, category: data.meta.category, engine, look: look.style.split(":")[0],
    phone: data.contact.phone, mapsUrl: lead.mapsUrl || data.contact.mapUrl, leadId: lead.id, variant: input.variant || 0, warnings, quality, builtAt: new Date().toISOString(),
  });
  say(`💾 Saved → /sites/${slug}/`);
  return { slug, url: `/sites/${slug}/`, engine, data, html };
}
