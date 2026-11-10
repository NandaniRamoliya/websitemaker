// Publish demo websites (and the PinPage product site) to the user's FREE Cloudflare Pages account.
// Needs CLOUDFLARE_API_TOKEN (permission: Account › Cloudflare Pages › Edit) and CLOUDFLARE_ACCOUNT_ID.
//
//   Demos:        https://<PINPAGE_DEMOS_PROJECT>.pages.dev/<business>/     (default project "pinpage-demos")
//   Own address:  https://<business>.pages.dev/                               (one project per hot lead)
//   Product site: https://<PINPAGE_SITE_PROJECT>.pages.dev/                   (default project "pinpage")
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { SITES_DIR, listSites, slugify } from "./autobuild.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const publishConfig = () => ({
  token: process.env.CLOUDFLARE_API_TOKEN || "",
  account: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  demosProject: process.env.PINPAGE_DEMOS_PROJECT || "pinpage-demos",
  siteProject: process.env.PINPAGE_SITE_PROJECT || "pinpage",
  whatsapp: String(process.env.PINPAGE_WHATSAPP || "").replace(/\D/g, ""),
  email: process.env.PINPAGE_EMAIL || "",
  waitlist: process.env.PINPAGE_WAITLIST_URL || "https://forms.gle/xryvJ6mhN9v4SrgX9",
});
export const publishConfigured = () => { const c = publishConfig(); return Boolean(c.token && c.account); };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------------------------------------------------------------- Cloudflare helpers
async function cfApi(p, init = {}) {
  const { token, account } = publishConfig();
  let res;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${p}`, {
    ...init, signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
    });
  } catch (e) { throw new Error(`Couldn't reach Cloudflare (${e.cause?.code || e.message}). Check your internet connection.`); }
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok && j.success !== false, status: res.status, json: j };
}

function explain(status, json) {
  const msg = json?.errors?.map((e) => e.message).join("; ") || `HTTP ${status}`;
  if (status === 401 || status === 403 || /auth/i.test(msg)) return `Cloudflare rejected the token (${msg}). Check CLOUDFLARE_API_TOKEN has “Account › Cloudflare Pages › Edit” and CLOUDFLARE_ACCOUNT_ID is right.`;
  return `Cloudflare: ${msg}`;
}

/** Runs the official Cloudflare CLI (wrangler) with the token from .env. */
function wrangler(args, onLine) {
  const { token, account } = publishConfig();
  const bin = require.resolve("wrangler/bin/wrangler.js");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, WRANGLER_SEND_METRICS: "false", CI: "true", FORCE_COLOR: "0", NO_COLOR: "1" },
      cwd: os.tmpdir(),
    });
    let out = "";
    const onData = (d) => {
      const s = d.toString().replace(/\x1b\[[0-9;]*m/g, "");
      out += s;
      for (const line of s.split(/\r?\n/)) { const t = line.trim(); if (t && !/Proxy environment variables/i.test(t)) onLine?.(t); }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => resolve({ code, out }));
    child.on("error", (e) => resolve({ code: 1, out: String(e) }));
  });
}

/** Make sure a Pages project exists; returns its *.pages.dev subdomain. */
async function ensureProject(name, say) {
  let r = await cfApi(`/pages/projects/${name}`);
  if (r.ok) return r.json.result.subdomain;
  if (r.status !== 404) throw new Error(explain(r.status, r.json));
  say?.(`Creating Cloudflare Pages project “${name}”…`);
  r = await cfApi(`/pages/projects`, { method: "POST", body: JSON.stringify({ name, production_branch: "main" }) });
  if (!r.ok) throw new Error(explain(r.status, r.json));
  return r.json.result.subdomain; // e.g. "pinpage-demos.pages.dev" (Cloudflare adds a suffix if the name is taken)
}

async function deployDir(dir, project, say) {
  say?.(`Uploading to ${project}…`);
  const { code, out } = await wrangler(["pages", "deploy", dir, "--project-name", project, "--branch", "main", "--commit-dirty=true", "--commit-message", `PinPage publish ${new Date().toISOString()}`], (l) => {
    if (/Uploaded|Deployment complete|Success|✨|error|failed/i.test(l)) say?.(l);
  });
  if (code !== 0) {
    const err = (out.match(/✘ \[ERROR\][^\n]*/) || out.match(/ERROR[^\n]*/) || [out.trim().split("\n").pop()])[0];
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(out)) throw new Error("Couldn't reach Cloudflare. Check your internet connection and try again.");
    throw new Error(/auth|token|10000|9109|403/i.test(out) ? `Cloudflare rejected the token. Check CLOUDFLARE_API_TOKEN (Account › Cloudflare Pages › Edit). Details: ${err}` : `Upload failed: ${err}`);
  }
}

async function stage(name) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `pinpage-${name}-`));
  return dir;
}

// ---------------------------------------------------------------- demo packaging
/** Demo copy of a site: hidden from search engines + small "demo" ribbon with a removal link. */
export function demoVersion(html, data = {}) {
  const c = publishConfig();
  const name = data.brand?.name || "this business";
  let h = String(html);
  const meta = `<meta name="robots" content="noindex, nofollow"><meta name="pinpage-demo" content="1">`;
  h = /<head[^>]*>/i.test(h) ? h.replace(/<head([^>]*)>/i, `<head$1>${meta}`) : meta + h;
  const remove = c.whatsapp
    ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Please remove the demo website for ${name}.`)}`
    : c.email ? `mailto:${c.email}?subject=${encodeURIComponent(`Remove demo: ${name}`)}` : "";
  const ribbon = `<div id="pp-demo" style="position:fixed;left:12px;bottom:12px;z-index:99998;max-width:calc(100% - 100px);display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;border-radius:999px;background:rgba(17,17,24,.88);color:#fff;font:600 12.5px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);backdrop-filter:blur(6px)">`
    + `<span>✨ Free demo website prepared for <b>${esc(name)}</b></span>`
    + (remove ? `<a href="${esc(remove)}" target="_blank" rel="noopener" style="color:#c7d2fe;text-decoration:underline;white-space:nowrap">Remove</a>` : "")
    + `<button type="button" aria-label="Hide" onclick="this.parentNode.remove()" style="border:0;background:rgba(255,255,255,.15);color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;line-height:22px;padding:0">×</button></div>`
    + `<style>@media(max-width:760px){#pp-demo{bottom:84px!important}}</style>`;
  return /<\/body>(?![\s\S]*<\/body>)/i.test(h) ? h.replace(/<\/body>(?![\s\S]*<\/body>)/i, ribbon + "</body>") : h + ribbon;
}

const NOINDEX_FILES = {
  "_headers": "/*\n  X-Robots-Tag: noindex, nofollow\n",
  "robots.txt": "User-agent: *\nDisallow: /\n",
};

function demoHome() {
  const c = publishConfig();
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent("Hi! I'd like a website for my business.")}` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>PinPage demos</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0f1020;color:#fff;text-align:center;padding:24px}a{display:inline-block;margin-top:18px;padding:12px 22px;border-radius:999px;background:#25d366;color:#fff;font-weight:700;text-decoration:none}p{opacity:.75}</style></head>
<body><div><h1>📍 PinPage</h1><p>This address hosts private demo websites prepared for local businesses.</p>${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">Want one for your business? Chat on WhatsApp</a>` : ""}</div></body></html>`;
}

async function readSite(slug) {
  const dir = path.join(SITES_DIR, slug);
  const html = await fs.readFile(path.join(dir, "index.html"), "utf8");
  let data = {};
  try { data = JSON.parse(await fs.readFile(path.join(dir, "data.json"), "utf8")); } catch { /* ignore */ }
  return { html, data };
}

async function updateRegistry(mutator) {
  const reg = await listSites();
  mutator(reg);
  await fs.writeFile(path.join(SITES_DIR, "index.json"), JSON.stringify(reg, null, 1));
  return reg;
}

/** Folder ready for upload: noindex rules, a neutral home page and one folder per demo. */
export async function packageDemos(slugs) {
  const dir = await stage("demos");
  for (const [f, body] of Object.entries(NOINDEX_FILES)) await fs.writeFile(path.join(dir, f), body);
  await fs.writeFile(path.join(dir, "index.html"), demoHome());
  for (const slug of slugs) {
    const { html, data } = await readSite(slug);
    await fs.mkdir(path.join(dir, slug), { recursive: true });
    await fs.writeFile(path.join(dir, slug, "index.html"), demoVersion(html, data));
  }
  return dir;
}

/**
 * (Re)publish the shared demos project. `add` = slugs to publish now, `remove` = slugs to take down.
 * Every deployment is a full snapshot, so all currently published demos are re-uploaded
 * (Cloudflare skips files that haven't changed).
 */
export async function publishDemos({ add = [], remove = [] } = {}, say = () => {}) {
  if (!publishConfigured()) throw new Error("Publishing is off. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to the .env file, then restart.");
  const c = publishConfig();
  const reg = await listSites();
  const live = new Set(Object.keys(reg).filter((s) => reg[s].publishedUrl));
  add.forEach((s) => reg[s] && live.add(s));
  remove.forEach((s) => live.delete(s));

  say(`Packaging ${live.size} demo(s)…`);
  const dir = await packageDemos(live);
  const subdomain = await ensureProject(c.demosProject, say);
  await deployDir(dir, c.demosProject, say);
  await fs.rm(dir, { recursive: true, force: true });

  const now = new Date().toISOString();
  const urls = {};
  await updateRegistry((r) => {
    for (const slug of Object.keys(r)) {
      if (live.has(slug)) {
        if (add.includes(slug) || !r[slug].publishedUrl) { r[slug].publishedAt = now; }
        r[slug].publishedUrl = `https://${subdomain}/${slug}/`;
        urls[slug] = r[slug].publishedUrl;
      } else if (remove.includes(slug)) { delete r[slug].publishedUrl; delete r[slug].publishedAt; }
    }
  });
  say(`✓ Live: https://${subdomain}/`);
  return { subdomain, urls };
}

/** Give one demo its own address: https://<business>.pages.dev/ */
export async function publishOwn(slug, say = () => {}) {
  if (!publishConfigured()) throw new Error("Publishing is off. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to the .env file, then restart.");
  const reg = await listSites();
  if (!reg[slug]) throw new Error("Build this demo first.");
  const project = reg[slug].ownProject || slugify(slug).slice(0, 58).replace(/-+$/, "");
  const { html, data } = await readSite(slug);
  const dir = await stage("own");
  for (const [f, body] of Object.entries(NOINDEX_FILES)) await fs.writeFile(path.join(dir, f), body);
  await fs.writeFile(path.join(dir, "index.html"), demoVersion(html, data));
  const subdomain = await ensureProject(project, say);
  await deployDir(dir, project, say);
  await fs.rm(dir, { recursive: true, force: true });
  const url = `https://${subdomain}/`;
  await updateRegistry((r) => { r[slug].ownProject = project; r[slug].ownUrl = url; r[slug].ownPublishedAt = new Date().toISOString(); });
  say(`✓ Own address: ${url}`);
  return { url };
}

/** Take a demo's own address down (deletes that Cloudflare project). */
export async function removeOwn(slug, say = () => {}) {
  const reg = await listSites();
  const project = reg[slug]?.ownProject;
  if (!project) return;
  const r = await cfApi(`/pages/projects/${project}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(explain(r.status, r.json));
  await updateRegistry((x) => { delete x[slug].ownUrl; delete x[slug].ownProject; delete x[slug].ownPublishedAt; });
  say(`✓ Removed ${project}`);
}

/** The PinPage product / waitlist site. */
export async function publishProductSite(say = () => {}) {
  if (!publishConfigured()) throw new Error("Publishing is off. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to the .env file, then restart.");
  const c = publishConfig();
  const dir = await stage("site");
  await fs.writeFile(path.join(dir, "index.html"), await productPage());
  const subdomain = await ensureProject(c.siteProject, say);
  await deployDir(dir, c.siteProject, say);
  await fs.rm(dir, { recursive: true, force: true });
  say(`✓ PinPage site live: https://${subdomain}/`);
  return { url: `https://${subdomain}/` };
}

/** Landing page with the user's WhatsApp + waitlist link filled in. */
export async function productPage() {
  const c = publishConfig();
  const tpl = await fs.readFile(path.join(here, "..", "product-site", "index.html"), "utf8");
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent("Hi PinPage! I'd like a free demo website for my business.")}` : "#waitlist";
  return tpl
    .replaceAll("{{WAITLIST_URL}}", esc(c.waitlist || "#contact"))
    .replaceAll("{{WHATSAPP_URL}}", esc(wa))
    .replaceAll("{{EMAIL}}", esc(c.email || ""))
    .replaceAll("{{YEAR}}", String(new Date().getFullYear()));
}
