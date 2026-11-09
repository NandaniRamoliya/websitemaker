// Fetch helper with basic SSRF protection, timeout and size cap.
import dns from "node:dns/promises";
import net from "node:net";

const PRIVATE_V4 = [
  [/^10\./], [/^127\./], [/^0\./], [/^169\.254\./], [/^192\.168\./],
  [/^172\.(1[6-9]|2\d|3[01])\./], [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./],
];

function isPrivate(ip) {
  if (net.isIPv4(ip)) return PRIVATE_V4.some(([re]) => re.test(ip));
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") ||
    (v.startsWith("::ffff:") && isPrivate(v.slice(7)));
}

export async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http(s) URLs are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Host not allowed");
  let addrs;
  try {
    addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  } catch (e) {
    // Behind an HTTP(S) proxy the proxy resolves DNS; local lookup may legitimately fail.
    if (process.env.HTTPS_PROXY || process.env.https_proxy) return url;
    throw e;
  }
  if (addrs.some((a) => isPrivate(a.address))) throw new Error("Host not allowed");
  return url;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 SiteForge/1.0";

/** Follows redirects manually so every hop is checked. Returns { url, status, text }. */
export async function safeFetch(raw, { maxBytes = 3_000_000, timeoutMs = 15000, maxRedirects = 6 } = {}) {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); break; }
        chunks.push(value);
      }
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return { url: current, status: res.status, text };
  }
  throw new Error("Too many redirects");
}

/** Only resolves redirects (no body) – used for short links like maps.app.goo.gl. */
export async function resolveRedirects(raw, maxRedirects = 8) {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "user-agent": UA } });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { current = new URL(loc, current).toString(); continue; }
    return current;
  }
  return current;
}
