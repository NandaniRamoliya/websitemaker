// Leads: read a Google Sheet / CSV, recognise columns, turn each lead into website data.
import { safeFetch } from "./safeFetch.js";
import { parseMapUrl, buildEmbedUrl } from "./maps.js";
import { detectCategory, CATEGORIES, categoryPhotos } from "./categories.js";

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim())) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** Accepts any Google Sheets link (shared "Anyone with the link can view") and returns its rows. */
export async function fetchSheet(url) {
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) throw new Error("That doesn't look like a Google Sheets link.");
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;
  const { text, status } = await safeFetch(csvUrl, { maxBytes: 20_000_000, timeoutMs: 30000 });
  if (status >= 400 || /^\s*<!DOCTYPE html/i.test(text)) {
    throw new Error("Couldn't read the sheet. In Google Sheets click Share → General access → “Anyone with the link” (Viewer), then try again.");
  }
  return parseCsv(text);
}

// Column name candidates (lower-case, compared without spaces/punctuation).
const COLS = {
  name: ["businessname", "name", "business", "title", "company", "placename"],
  phone: ["phonenumber", "phone", "mobile", "contact", "contactnumber", "whatsapp"],
  website: ["websiteurl", "website", "site", "url"],
  hasWebsite: ["haswebsite"],
  rating: ["googlerating", "rating", "stars"],
  reviews: ["reviewscount", "reviews", "reviewcount", "userratingstotal", "totalreviews"],
  address: ["fulladdress", "address", "formattedaddress", "location"],
  maps: ["googlemapsurl", "mapsurl", "mapurl", "googlemaps", "maps", "placeurl", "link"],
  category: ["category", "type", "businesstype", "industry", "niche", "specialty"],
  profile: ["socialprofileurl", "notes", "description", "details"],
  classification: ["leadclassification"],
  status: ["outreachstatus", "status"],
};
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapColumns(headers) {
  const n = headers.map(norm);
  const out = {};
  for (const [key, cands] of Object.entries(COLS)) {
    const idx = cands.map((c) => n.indexOf(c)).find((i) => i >= 0);
    if (idx != null) out[key] = headers[idx];
  }
  return out;
}

/** "Hair Factory Unisex Salon || Best Salon In surat | Balayage Expert" → name + SEO keywords */
export function cleanName(raw) {
  const parts = String(raw || "").normalize("NFKC").split(/\s*(?:\|\||\||–|—|:)\s*/).map((s) => s.trim()).filter(Boolean);
  const name = (parts[0] || "").replace(/\s+-\s+(surat|ahmedabad|mumbai|vadodara|rajkot|pune|delhi)$/i, "").trim();
  const pretty = name === name.toUpperCase() && name.length > 4 ? name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : name;
  return { name: pretty || String(raw || "").trim(), keywords: parts.slice(1).join(", ") };
}

function waNumber(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return "91" + d; // Indian mobile
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  return ""; // landlines / toll-free can't use WhatsApp
}
function prettyPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  if (/^1800\d+$/.test(d)) return d.replace(/^(1800)(\d{3})(\d+)$/, "$1 $2 $3");
  if (/^0?\d{10,11}$/.test(d)) return `+91 ${d.replace(/^0/, "")}`;
  return phone || "";
}

export function rowToLead(row, cols, index) {
  const g = (k) => (cols[k] ? row[cols[k]] || "" : "");
  const profile = g("profile");
  const specialty = profile.match(/Specialty:\s*([^|]+)/i)?.[1]?.trim() || g("category");
  const locality = profile.match(/Locality:\s*([^|]+)/i)?.[1]?.trim() || "";
  const website = g("website");
  const hasWebsiteRaw = g("hasWebsite");
  const hasWebsite = hasWebsiteRaw ? /^y/i.test(hasWebsiteRaw) : /^https?:/.test(website);
  const { name, keywords } = cleanName(g("name"));
  return {
    id: index,
    rawName: g("name"), name, keywords,
    phone: g("phone"), rating: g("rating"), reviews: g("reviews"),
    address: g("address"), mapsUrl: /^https?:/.test(g("maps")) ? g("maps") : "",
    website: /^https?:/.test(website) ? website : "", hasWebsite,
    specialty, locality, status: g("status"),
    category: detectCategory(specialty, g("category"), g("name")),
  };
}

export function leadsFromRows(rows) {
  if (!rows.length) return { leads: [], columns: {} };
  const columns = mapColumns(Object.keys(rows[0]));
  if (!columns.name) throw new Error("Couldn't find a business-name column (e.g. “Business Name”).");
  return { columns, leads: rows.map((r, i) => rowToLead(r, columns, i)).filter((l) => l.name) };
}

/** Build the base website data (facts only – AI adds the copy later). */
export function leadToBrandData(lead) {
  const map = parseMapUrl(lead.mapsUrl || lead.address);
  const city = (lead.address.match(/,\s*([A-Za-z ]+),\s*(Gujarat|Maharashtra|Rajasthan|Karnataka|Delhi|[A-Z][a-z]+)\s*\d{0,6}\s*$/) || [])[1]?.trim() || "";
  const cat = CATEGORIES[lead.category] || CATEGORIES.general;
  const photos = categoryPhotos(lead.category, lead.name, 7);
  const wa = waNumber(lead.phone);
  const stats = [];
  if (lead.rating) stats.push({ value: `${lead.rating}★`, label: "Google rating" });
  if (lead.reviews) stats.push({ value: Number(lead.reviews).toLocaleString("en-IN") + "+", label: "Google reviews" });
  if (lead.locality || city) stats.push({ value: lead.locality || city, label: city && lead.locality ? city : "Location" });
  return {
    brand: { name: lead.name, industry: lead.specialty ? `${cat.label} · ${lead.specialty}` : cat.label, template: "modern", font: "theme" },
    contact: {
      phone: prettyPhone(lead.phone), whatsapp: wa ? "+" + wa : "",
      address: lead.address, mapUrl: lead.mapsUrl,
      mapEmbed: buildEmbedUrl({ ...map, placeName: map.placeName ? `${map.placeName} ${lead.address}`.slice(0, 200) : null }, lead.address) || "",
    },
    media: { hero: photos[0] || "", gallery: photos.slice(1), video: "" },
    services: cat.services.map((t) => ({ title: t, description: "", price: "", image: "" })),
    stats,
    testimonials: [], team: [], faq: [],
    social: { website: "" },
    cta: { text: wa ? "Chat on WhatsApp" : "Call now", link: wa ? `https://wa.me/${wa}` : `tel:${String(lead.phone).replace(/[^\d+]/g, "")}` },
    seo: { keywords: [lead.keywords, lead.specialty, lead.locality, city].filter(Boolean).join(", ") },
    meta: {
      category: lead.category, city, locality: lead.locality, rating: lead.rating, reviews: lead.reviews,
      placeId: map.placeId || "", lat: map.lat, lng: map.lng,
      reviewUrl: map.placeId ? `https://search.google.com/local/writereview?placeid=${map.placeId}` : "",
      photosAreStock: Boolean(photos.length),
    },
    labels: {},
    hiddenSections: [],
  };
}
