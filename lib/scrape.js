// Extract brand info from any public web page (existing website, listing page, etc.).
import * as cheerio from "cheerio";
import { safeFetch } from "./safeFetch.js";
import { resolveMap } from "./maps.js";

const SOCIAL = {
  instagram: /instagram\.com\/(?!p\/|reel\/|explore)[^/?#]+/i,
  facebook: /facebook\.com\/(?!sharer|share|dialog|plugins|tr\?)[^?#]+/i,
  twitter: /(twitter|x)\.com\/(?!intent|share|home)[^/?#]+/i,
  linkedin: /linkedin\.com\/(company|in|school)\/[^?#]+/i,
  youtube: /youtube\.com\/(@|c\/|channel\/|user\/)[^?#]+/i,
  tiktok: /tiktok\.com\/@[^?#]+/i,
  pinterest: /pinterest\.[a-z.]+\/[^/?#]+/i,
};

const BUSINESS_TYPES = /LocalBusiness|Organization|Restaurant|Store|Hotel|Corporation|Cafe|Bakery|Salon|Clinic|Dentist|Physician|Gym|Hospital|School|Bar|Shop|Agency|Service|Brand|Lodging|Resort|SportsClub|AutoDealer|RealEstate|Attorney|LegalService|Spa|Florist|Plumber|Electrician|Contractor/i;

function flattenLd(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) { node.forEach((n) => flattenLd(n, out)); return out; }
  if (typeof node === "object") {
    out.push(node);
    if (node["@graph"]) flattenLd(node["@graph"], out);
  }
  return out;
}

const typeOf = (n) => [].concat(n["@type"] || []).join(" ");
const str = (v) => (v == null ? "" : typeof v === "string" ? v : v.name || v["@id"] || v.url || "");

function addressToString(a) {
  if (!a) return "";
  if (typeof a === "string") return a;
  if (Array.isArray(a)) return addressToString(a[0]);
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, str(a.addressCountry)]
    .filter(Boolean).join(", ");
}

function hoursFromLd(n) {
  const lines = [];
  if (n.openingHours) lines.push(...[].concat(n.openingHours));
  for (const spec of [].concat(n.openingHoursSpecification || [])) {
    const days = [].concat(spec.dayOfWeek || []).map((d) => String(d).split("/").pop().slice(0, 3)).join(", ");
    if (days) lines.push(`${days}: ${spec.opens || "?"} – ${spec.closes || "?"}`);
  }
  return lines.join("\n");
}

const clean = (t) => (t || "").replace(/\s+/g, " ").trim();

export async function scrapeUrl(rawUrl) {
  // Google Maps links have no scrapeable content – parse the URL instead.
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\./i.test(rawUrl)) {
    const m = await resolveMap(rawUrl);
    return {
      source: "google-maps",
      data: {
        brand: m.placeName ? { name: m.placeName } : {},
        contact: { mapUrl: rawUrl, mapEmbed: m.embedUrl || "" },
      },
      notes: ["Google Maps link parsed: location pinned. Use “AI Research” to pull reviews, hours and photos for this place."],
    };
  }

  const { url, text, status } = await safeFetch(rawUrl);
  if (status >= 400) throw new Error(`Site returned HTTP ${status}`);
  return extractFromHtml(text, url);
}

/** Pure HTML -> brand data extraction (exported for testing). */
export async function extractFromHtml(text, url) {
  const $ = cheerio.load(text);
  const abs = (u) => { try { return u ? new URL(u.trim(), url).toString() : ""; } catch { return ""; } };
  const meta = (k) => $(`meta[property="${k}"]`).attr("content") || $(`meta[name="${k}"]`).attr("content") || "";

  // ---------- JSON-LD ----------
  const ld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { flattenLd(JSON.parse($(el).contents().text()), ld); } catch { /* ignore bad JSON */ }
  });
  const biz = ld.find((n) => BUSINESS_TYPES.test(typeOf(n)) && (n.address || n.telephone)) ||
    ld.find((n) => BUSINESS_TYPES.test(typeOf(n))) || {};

  // ---------- Brand ----------
  const title = clean($("title").first().text());
  const name = clean(str(biz.name) || meta("og:site_name") || meta("application-name") || title.split(/\s[|\-–—:]\s/)[0]);
  const description = clean(meta("description") || meta("og:description") || str(biz.description));
  let logo = abs(str(biz.logo) || str(biz.image?.[0]) || "");
  if (!logo) {
    const logoImg = $("img").filter((_, el) => /logo/i.test(`${$(el).attr("src")} ${$(el).attr("alt")} ${$(el).attr("class")} ${$(el).attr("id")}`)).first();
    logo = abs(logoImg.attr("src") || logoImg.attr("data-src"));
  }
  if (!logo) logo = abs($('link[rel="apple-touch-icon"]').attr("href") || $('link[rel~="icon"]').last().attr("href"));

  // About text: first substantial paragraph(s)
  const paras = $("main p, article p, section p, p").map((_, el) => clean($(el).text())).get()
    .filter((t) => t.length > 80 && !/cookie|javascript|©|copyright|privacy/i.test(t));
  const about = [...new Set(paras)].slice(0, 3).join("\n\n");

  // ---------- Images ----------
  const imgSet = new Set();
  const ogImage = abs(meta("og:image") || meta("twitter:image"));
  if (ogImage) imgSet.add(ogImage);
  for (const im of [].concat(biz.image || [])) { const u = abs(str(im)); if (u) imgSet.add(u); }
  $("img, source").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset") || $el.attr("data-srcset");
    const fromSet = srcset ? srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).pop() : "";
    const src = abs($el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("src") || fromSet);
    if (!src || src.startsWith("data:")) return;
    const w = parseInt($el.attr("width") || "0", 10);
    if (w && w < 120) return;
    if (/\.svg|sprite|icon|logo|pixel|tracking|spacer|avatar|gravatar|emoji|badge|1x1/i.test(src)) return;
    imgSet.add(src);
  });
  $("[style*='background']").each((_, el) => {
    const m = ($(el).attr("style") || "").match(/url\(["']?([^"')]+)["']?\)/);
    if (m && !/\.svg/i.test(m[1])) imgSet.add(abs(m[1]));
  });
  const images = [...imgSet].filter(Boolean).slice(0, 18);

  // ---------- Contact ----------
  const emails = new Set();
  const phones = new Set();
  $('a[href^="mailto:"]').each((_, el) => emails.add($(el).attr("href").slice(7).split("?")[0]));
  $('a[href^="tel:"]').each((_, el) => phones.add(decodeURIComponent($(el).attr("href").slice(4)).trim()));
  const bodyText = $("body").text();
  (bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .filter((e) => !/\.(png|jpg|jpeg|gif|webp|svg)$|example\.|sentry|wixpress/i.test(e))
    .slice(0, 3).forEach((e) => emails.add(e));
  if (biz.telephone) phones.add(String(biz.telephone));
  if (biz.email) emails.add(String(biz.email).replace(/^mailto:/, ""));

  let whatsapp = "";
  $('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp://"]').each((_, el) => {
    const m = ($(el).attr("href") || "").match(/(?:wa\.me\/|phone=)(\+?\d+)/);
    if (m && !whatsapp) whatsapp = m[1];
  });

  // ---------- Social ----------
  const social = {};
  const links = $("a[href]").map((_, el) => $(el).attr("href")).get().concat([].concat(biz.sameAs || []));
  for (const href of links) {
    for (const [k, re] of Object.entries(SOCIAL)) {
      if (!social[k] && re.test(href)) social[k] = abs(href);
    }
  }

  // ---------- Map ----------
  let mapUrl = "";
  let mapEmbed = "";
  const mapFrame = $('iframe[src*="google.com/maps"], iframe[data-src*="google.com/maps"]').first();
  if (mapFrame.length) mapUrl = mapEmbed = abs(mapFrame.attr("src") || mapFrame.attr("data-src"));
  if (!mapUrl) {
    const mapLink = $('a[href*="google.com/maps"], a[href*="maps.app.goo.gl"], a[href*="goo.gl/maps"]').first().attr("href");
    if (mapLink) mapUrl = mapLink;
  }
  if (!mapUrl && biz.geo?.latitude) mapUrl = `${biz.geo.latitude},${biz.geo.longitude}`;
  if (mapUrl && !mapEmbed) {
    try { mapEmbed = (await resolveMap(mapUrl, addressToString(biz.address))).embedUrl || ""; } catch { /* ignore */ }
  }

  // ---------- Reviews / FAQ / video ----------
  const testimonials = [].concat(biz.review || []).slice(0, 6).map((r) => ({
    name: str(r.author) || "Customer",
    role: "",
    text: clean(r.reviewBody || r.description || ""),
    rating: String(r.reviewRating?.ratingValue || "5"),
  })).filter((t) => t.text);

  const faqNode = ld.find((n) => /FAQPage/.test(typeOf(n)));
  const faq = [].concat(faqNode?.mainEntity || []).slice(0, 10).map((q) => ({
    q: clean(q.name), a: clean(cheerio.load(str(q.acceptedAnswer?.text || q.acceptedAnswer) || "").text()),
  })).filter((f) => f.q);

  const yt = $('iframe[src*="youtube.com/embed"], iframe[src*="player.vimeo.com"]').first().attr("src") ||
    $('a[href*="youtube.com/watch"], a[href*="youtu.be/"]').first().attr("href") || "";

  const stats = [];
  if (biz.aggregateRating?.ratingValue) {
    stats.push({ value: `${biz.aggregateRating.ratingValue}★`, label: `${biz.aggregateRating.reviewCount || biz.aggregateRating.ratingCount || ""} reviews`.trim() });
  }
  if (biz.foundingDate) stats.push({ value: String(biz.foundingDate).slice(0, 4), label: "Founded" });

  const data = {
    brand: {
      name, tagline: title && title !== name ? clean(title.replace(name, "").replace(/^[\s|\-–—:]+/, "")) : "",
      industry: typeOf(biz).replace(/\b(LocalBusiness|Organization)\b/g, "").trim(),
      description, about, logo,
      primaryColor: /^#[0-9a-f]{3,8}$/i.test(meta("theme-color")) ? meta("theme-color") : "",
      founded: biz.foundingDate ? String(biz.foundingDate).slice(0, 4) : "",
    },
    contact: {
      phone: [...phones][0] || "", whatsapp, email: [...emails][0] || "",
      address: addressToString(biz.address), mapUrl, mapEmbed, hours: hoursFromLd(biz),
      priceRange: biz.priceRange || "",
    },
    media: { hero: ogImage || images[0] || "", gallery: images.filter((i) => i !== ogImage).slice(0, 12), video: abs(yt) },
    social: { ...social, website: url },
    testimonials, faq, stats,
    seo: { title, description, keywords: meta("keywords") },
  };
  return { source: "website", finalUrl: url, data, notes: [] };
}
