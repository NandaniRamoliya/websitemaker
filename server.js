import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeUrl } from "./lib/scrape.js";
import { resolveMap } from "./lib/maps.js";
import { aiProvider, researchBrand, writeCopy, designSite, friendlyError } from "./lib/ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "60mb" }));
app.use(express.static(path.join(here, "public")));

const errMsg = (e) => friendlyError(e);

function sse(res) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => clearInterval(ping));
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

app.get("/api/status", (_req, res) => res.json({ ai: Boolean(aiProvider()), provider: aiProvider() }));

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
    await designSite(req.body.data, req.body.style, (t) => send("text", t));
    send("done", {});
  } catch (e) { send("error", { error: errMsg(e) }); }
  res.end();
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`SiteForge running → http://localhost:${port}`);
  const p = aiProvider();
  console.log(p ? `AI provider: ${p}` : "AI is off – get a FREE key at https://aistudio.google.com/apikey and start with GEMINI_API_KEY=your-key");
});
