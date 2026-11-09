// Turn any Google Maps link (short link, place URL, embed code, coordinates) into an embeddable map.
import { resolveRedirects } from "./safeFetch.js";

export function parseMapUrl(input) {
  const out = { lat: null, lng: null, placeName: null, query: null };
  if (!input) return out;
  let s = String(input).trim();

  // Pasted <iframe ...> embed code
  const iframe = s.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframe) s = iframe[1];

  // Plain "lat, lng"
  const plain = s.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (plain) return { ...out, lat: +plain[1], lng: +plain[2] };

  let url;
  try { url = new URL(s); } catch { return { ...out, query: s }; }
  const full = decodeURIComponent(url.href);

  // Precise place pin: !3d<lat>!4d<lng>
  const pin = full.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const at = full.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const ll = url.searchParams.get("ll") || url.searchParams.get("center");
  if (pin) { out.lat = +pin[1]; out.lng = +pin[2]; }
  else if (at) { out.lat = +at[1]; out.lng = +at[2]; }
  else if (ll && /^-?\d+\.\d+,-?\d+\.\d+$/.test(ll)) { [out.lat, out.lng] = ll.split(",").map(Number); }

  const place = url.pathname.match(/\/place\/([^/]+)/);
  if (place) out.placeName = decodeURIComponent(place[1].replace(/\+/g, " "));
  const q = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("daddr");
  if (q) {
    const m = q.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    if (m && out.lat == null) { out.lat = +m[1]; out.lng = +m[2]; } else out.query = q;
  }
  if (url.pathname.includes("/embed") || url.searchParams.get("output") === "embed" || url.searchParams.has("pb")) {
    out.embedUrl = url.href; // already embeddable
  }
  return out;
}

export function buildEmbedUrl(info, fallbackAddress) {
  if (info.embedUrl) return info.embedUrl;
  const q = info.placeName || (info.lat != null ? `${info.lat},${info.lng}` : null) || info.query || fallbackAddress;
  if (!q) return null;
  const center = info.lat != null ? `&ll=${info.lat},${info.lng}` : "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}${center}&z=16&output=embed`;
}

export async function resolveMap(input, address) {
  let s = String(input || "").trim();
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(s)) {
    s = await resolveRedirects(s);
  }
  const info = parseMapUrl(s);
  return { ...info, resolvedUrl: s, embedUrl: buildEmbedUrl(info, address) };
}
