// Google Gemini provider – has a FREE tier (key from https://aistudio.google.com/apikey, no card needed).
import { GoogleGenAI, ApiError } from "@google/genai";
import { researchPrompt, copyPrompt, DESIGN_SYSTEM, designPrompt, extractJson } from "./prompts.js";

// Tried in order; a model that doesn't exist (404) for this key is skipped.
const MODELS = (process.env.GEMINI_MODEL || "gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash,gemini-3.7-flash,gemini-3.1-flash-lite")
  .split(",").map((s) => s.trim()).filter(Boolean);

let client;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY }));

export function friendlyGeminiError(e) {
  if (/abort|timeout/i.test(e?.name || "")) return "Gemini took too long to answer (its free models may be busy) – try again in a few minutes.";
  if (!(e instanceof ApiError)) return null;
  if (e.status === 429) return "Gemini free-tier limit reached. Wait a minute (per-minute limit) or until tomorrow (daily limit), then try again.";
  if (e.status === 400 && /api key/i.test(e.message)) return "Invalid Gemini API key – create one at aistudio.google.com/apikey.";
  if ([500, 503, 504].includes(e.status)) return "Gemini's free models are overloaded right now – try again in a few minutes.";
  if (e.status === 401 || e.status === 403) return "Gemini rejected the API key (check it at aistudio.google.com/apikey).";
  return `Gemini error ${e.status}: ${e.message}`;
}

/** Runs fn(model) on the first available model in MODELS. */
const limitedUntil = new Map(); // model -> timestamp until which we don't bother asking it
const LIMIT_SKIP_MS = 10 * 60_000;
async function withModel(fn, onNote) {
  // 404 = model not on this key, 429 = that model's free quota used up (quotas are per model),
  // 500/503 = model overloaded. In all those cases retry briefly, then move on to the next model.
  let lastErr;
  const now = Date.now();
  // Skip models that recently said "limit reached" (unless that would leave nothing to try).
  const usable = MODELS.filter((m) => !(limitedUntil.get(m) > now));
  const list = usable.length ? usable : MODELS;
  for (const model of list) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await fn(model); }
      catch (e) {
        lastErr = e;
        const timedOut = /abort|timeout/i.test(e?.name || "") || /aborted|timed? ?out/i.test(e?.message || "");
        const s = e instanceof ApiError ? e.status : timedOut ? 504 : 0;
        if (e instanceof StallError) break; // don't wait on the same slow model twice
        if (s === 500 || s === 503 || s === 504) { if (attempt === 0) { await new Promise((r) => setTimeout(r, 2500)); continue; } break; }
        if (s === 429) { limitedUntil.set(model, Date.now() + LIMIT_SKIP_MS); break; }
        if (s === 404) { limitedUntil.set(model, Date.now() + 24 * 3600_000); break; }
        throw e;
      }
    }
    const why = lastErr?.status === 429 ? "free limit reached" : lastErr?.status === 404 ? "not available" : "busy";
    console.warn(`[gemini] ${model} unavailable (${lastErr?.status || lastErr?.name}); trying next model`);
    if (model !== list[list.length - 1]) onNote?.(`Gemini ${model.replace("gemini-", "")} ${why} – trying another free model…`);
  }
  throw lastErr;
}

// A busy free model can accept a request and then say nothing for minutes. Give up on it if the first
// words don't arrive within FIRST_MS, or if it stalls for STALL_MS mid-answer, and move on to the next model.
const FIRST_MS = Number(process.env.GEMINI_FIRST_TOKEN_MS) || 45000;
const STALL_MS = 60000;
class StallError extends Error { constructor(msg) { super(msg); this.name = "TimeoutError"; } }

async function streamText(model, contents, config, onChunk, timeout = 240000) {
  const ctrl = new AbortController();
  let timer, stalled = "";
  const arm = (ms, why) => { clearTimeout(timer); timer = setTimeout(() => { stalled = why; ctrl.abort(); }, ms); };
  arm(FIRST_MS, `${model} didn't start answering within ${FIRST_MS / 1000}s`);
  try {
    const stream = await getClient().models.generateContentStream({ model, contents, config: { ...config, abortSignal: ctrl.signal, httpOptions: { timeout } } });
    let text = "";
    for await (const chunk of stream) {
      arm(STALL_MS, `${model} stalled`);
      onChunk?.(chunk);
      if (chunk.text) text += chunk.text;
    }
    return text;
  } catch (e) {
    if (stalled) throw new StallError(stalled);
    throw e;
  } finally { clearTimeout(timer); }
}

const MODES = [
  { name: "search", label: "Google Search", tools: [{ googleSearch: {} }, { urlContext: {} }], extra: "" },
  { name: "url", label: "Web page reading", tools: [{ urlContext: {} }], extra: "\n\n(Web search is unavailable. Read the official website / listing URLs you know or were given, plus your own knowledge.)",
    note: "Free key: Google Search isn't included, so the AI read web pages it knows + its own knowledge. Double-check phone numbers, hours and addresses." },
  { name: "none", label: "Web access", tools: null, extra: "\n\n(No web access. Use only facts you are confident about; leave the rest empty.)",
    note: "Answered from the AI's own knowledge (no web access) – double-check every fact." },
];
// After Search is refused, skip it for an hour so we don't waste free requests on it.
const searchForcedOff = /^(1|true)$/i.test(process.env.GEMINI_NO_SEARCH || "");
let searchOffUntil = 0;

export async function researchBrand(input, onEvent) {
  const prompt = researchPrompt(input);
  return withModel(async (model) => {
    const seen = new Set();
    const sources = new Set();
    const onChunk = (chunk) => {
      const gm = chunk.candidates?.[0]?.groundingMetadata;
      for (const q of gm?.webSearchQueries || []) {
        if (!seen.has(q)) { seen.add(q); onEvent?.({ type: "tool", name: "web_search", detail: q }); }
      }
      for (const c of gm?.groundingChunks || []) if (c.web?.title) sources.add(c.web.title);
    };
    // Google Search grounding is often not included in the free tier (quota 0 → 429),
    // so step down: Search + page reading → page reading only → model knowledge only.
    const modes = searchForcedOff || Date.now() < searchOffUntil ? MODES.slice(1) : MODES;
    let text, usedMode;
    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i];
      try {
        text = await streamText(model, prompt + mode.extra, mode.tools ? { tools: mode.tools } : {}, onChunk, 180000);
        if (mode.note) onEvent?.({ type: "tool", name: "note", detail: mode.note });
        usedMode = mode.name;
        break;
      } catch (e) {
        const last = i === modes.length - 1;
        const toolProblem = e instanceof ApiError && (e.status === 400 || (e.status === 429 && mode.tools));
        if (last || !toolProblem || /api.?key/i.test(e.message)) throw e;
        if (mode.name === "search") searchOffUntil = Date.now() + 3600_000;
        onEvent?.({ type: "tool", name: "note", detail: `${mode.label} not available on this key (${e.status}) – falling back.` });
      }
    }
    const data = extractJson(text);
    // Without live search the model can't quote real reviews – never publish invented ones.
    if (usedMode !== "search" && data.testimonials?.length) {
      data.testimonials = [];
      onEvent?.({ type: "tool", name: "note", detail: "Reviews skipped (couldn't verify them without Google Search) – add real ones from Google Maps by hand." });
    }
    if (!data.sources?.length && sources.size) data.sources = [...sources];
    return data;
  });
}

export async function writeCopy(data) {
  return withModel(async (model) => {
    const res = await getClient().models.generateContent({
      model, contents: copyPrompt(data),
      config: { thinkingConfig: { thinkingLevel: "LOW" }, httpOptions: { timeout: 90000 } },
    });
    return extractJson(res.text || "");
  });
}

export async function designSite(data, style, onText) {
  return withModel((model) => { onText(null); return streamText(model, designPrompt(data, style), { systemInstruction: DESIGN_SYSTEM }, (c) => c.text && onText(c.text), 300000); });
}

/** Generic: prompt → text (used by the automatic builder). */
export async function generateText(prompt, { effort = "low", timeout = 90000, onNote } = {}) {
  return withModel(async (model) => {
    const res = await getClient().models.generateContent({
      model, contents: prompt,
      config: { thinkingConfig: { thinkingLevel: effort === "low" ? "LOW" : "MEDIUM" }, httpOptions: { timeout } },
    });
    return res.text || "";
  }, onNote);
}

/** Generic: stream a full HTML document. */
export async function streamHtml(prompt, onText, onReset, onNote) {
  // Each attempt (retry / next model) starts from scratch, so partial output must be discarded.
  return withModel((model) => { onReset?.(); return streamText(model, prompt, { systemInstruction: DESIGN_SYSTEM }, (c) => c.text && onText(c.text), 300000); }, onNote);
}
