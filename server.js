import "./lib/env.js"; // must be first: loads .env
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeUrl } from "./lib/scrape.js";
import { resolveMap } from "./lib/maps.js";
import { aiProvider, researchBrand, writeCopy, designSite, friendlyError } from "./lib/ai.js";
import { autoBuild, listSites, rememberLeads, polishHtml, cleanHtml, SITES_DIR } from "./lib/autobuild.js";
import { heal } from "./lib/siteDoctor.js";
import { fetchSheet, parseCsv, leadsFromRows } from "./lib/leads.js";
import { placesEnabled } from "./lib/places.js";
import { publishConfigured, publishConfig, publishDemos, publishOwn, removeOwn, publishProductSite, productPage } from "./lib/publish.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "60mb" }));
app.use(express.static(path.join(here, "public")));
app.use("/sites", express.static(SITES_DIR, { extensions: ["html"] }));

const errMsg = (e) => friendlyError(e);

function sse(res) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => clearInterval(ping));
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

app.get("/api/status", (_req, res) => res.json({ ai: Boolean(aiProvider()), provider: aiProvider(), places: placesEnabled(), publish: publishConfigured() }));

// ---- Automatic builder & leads ----
app.post("/api/auto", async (req, res) => {
  const send = sse(res);
  try {
    const out = await autoBuild(req.body || {}, (ev) => send(ev.type, ev));
    send("done", { slug: out.slug, url: out.url, engine: out.engine, data: out.data, html: out.html });
  } catch (e) { send("error", { error: errMsg(e) }); }
  res.end();
});

app.post("/api/leads/load", async (req, res) => {
  try {
    const rows = req.body.csv ? parseCsv(String(req.body.csv)) : await fetchSheet(String(req.body.url || ""));
    const out = leadsFromRows(rows);
    await rememberLeads(out.leads).catch(() => {});
    res.json({ ...out, sites: await listSites() });
  } catch (e) { res.status(400).json({ error: errMsg(e) }); }
});

app.post("/api/heal", (req, res) => res.json({ html: heal(String(req.body.html || ""), req.body.data || {}) }));

app.get("/api/sites", async (_req, res) => res.json(await listSites()));

// ---- Publishing to the user's free Cloudflare Pages account ----
app.get("/api/publish/status", (_req, res) => {
  const c = publishConfig();
  res.json({ configured: publishConfigured(), demosProject: c.demosProject, siteProject: c.siteProject, hasWhatsapp: Boolean(c.whatsapp), hasWaitlist: Boolean(c.waitlist) });
});
let publishing = Promise.resolve(); // one publish at a time (each deploy is a full snapshot)
function publishRoute(handler) {
  return async (req, res) => {
    const send = sse(res);
    const job = publishing.then(() => handler(req.body || {}, (msg) => send("log", { msg })));
    publishing = job.catch(() => {});
    try { send("done", await job); } catch (e) { send("error", { error: errMsg(e) }); }
    res.end();
  };
}
app.post("/api/publish", publishRoute((b, say) => publishDemos({ add: b.slugs || [] }, say)));
app.post("/api/publish/remove", publishRoute((b, say) => publishDemos({ remove: b.slugs || [] }, say)));
app.post("/api/publish/own", publishRoute((b, say) => publishOwn(b.slug, say)));
app.post("/api/publish/own/remove", publishRoute((b, say) => removeOwn(b.slug, say).then(() => ({}))));
app.post("/api/publish/site", publishRoute((_b, say) => publishProductSite(say)));
app.get("/product-preview", async (_req, res) => { try { res.type("html").send(await productPage()); } catch (e) { res.status(500).send(String(e)); } });

app.post("/api/import-url", async (req, res) => {
  try { res.json(await scrapeUrl(String(req.body.url || "").trim())); }
  catch (e) { res.status(400).json({ error: errMsg(e) }); }
});

app.post("/api/resolve-map", async (req, res) => {
  try { res.json(await resolveMap(req.body.url, req.body.address)); }
  catch (e) { res.status(400).json({ error: errMsg(e) }); }
});

app.post("/api/ai/research", async (req, res) => {
  const send = sse(res);
  try {
    const data = await researchBrand(req.body, (ev) => send("progress", ev));
    send("done", data);
  } catch (e) { send("error", { error: errMsg(e) }); }
  res.end();
});

app.post("/api/ai/copy", async (req, res) => {
  try { res.json(await writeCopy(req.body.data)); }
  catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

app.post("/api/ai/design", async (req, res) => {
  const send = sse(res);
  try {
    let out = "";
    await designSite(req.body.data, req.body.style, (t) => { if (t === null) { out = ""; send("reset", {}); } else { out += t; send("text", t); } });
    send("done", { html: polishHtml(cleanHtml(out), req.body.data || {}).html });
  } catch (e) { send("error", { error: errMsg(e) }); }
  res.end();
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`SiteForge running → http://localhost:${port}`);
  const p = aiProvider();
  console.log(p ? `AI provider: ${p}` : "AI is off – get a FREE key at https://aistudio.google.com/apikey and start with GEMINI_API_KEY=your-key");
});
