// Google Gemini provider – has a FREE tier (key from https://aistudio.google.com/apikey, no card needed).
import { GoogleGenAI, ApiError } from "@google/genai";
import { researchPrompt, copyPrompt, DESIGN_SYSTEM, designPrompt, extractJson } from "./prompts.js";

// Tried in order; a model that doesn't exist (404) for this key is skipped.
const MODELS = (process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-flash-latest,gemini-2.5-flash")
  .split(",").map((s) => s.trim()).filter(Boolean);

let client;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY }));

export function friendlyGeminiError(e) {
  if (!(e instanceof ApiError)) return null;
  if (e.status === 429) return "Gemini free-tier limit reached. Wait a minute (per-minute limit) or until tomorrow (daily limit), then try again.";
  if (e.status === 400 && /api key/i.test(e.message)) return "Invalid Gemini API key – create one at aistudio.google.com/apikey.";
  if (e.status === 401 || e.status === 403) return "Gemini rejected the API key (check it at aistudio.google.com/apikey).";
  return `Gemini error ${e.status}: ${e.message}`;
}

/** Runs fn(model) on the first available model in MODELS. */
async function withModel(fn) {
  let lastErr;
  for (const model of MODELS) {
    try { return await fn(model); }
    catch (e) {
      lastErr = e;
      if (e instanceof ApiError && e.status === 404) continue; // model not available – try the next one
      throw e;
    }
  }
  throw lastErr;
}

async function streamText(model, contents, config, onChunk) {
  const stream = await getClient().models.generateContentStream({ model, contents, config });
  let text = "";
  for await (const chunk of stream) {
    onChunk?.(chunk);
    if (chunk.text) text += chunk.text;
  }
  return text;
}

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
    let text;
    try {
      text = await streamText(model, prompt, { tools: [{ googleSearch: {} }, { urlContext: {} }] }, onChunk);
    } catch (e) {
      // If search grounding isn't allowed on this key/tier, still answer from the model's own knowledge.
      if (!(e instanceof ApiError) || [401, 403, 404, 429].includes(e.status) || /api.?key/i.test(e.message)) throw e;
      onEvent?.({ type: "tool", name: "note", detail: `Google Search unavailable (${e.status}); using the model's own knowledge – double-check facts.` });
      text = await streamText(model, prompt, {});
    }
    const data = extractJson(text);
    if (!data.sources?.length && sources.size) data.sources = [...sources];
    return data;
  });
}

export async function writeCopy(data) {
  return withModel(async (model) => {
    const res = await getClient().models.generateContent({ model, contents: copyPrompt(data) });
    return extractJson(res.text || "");
  });
}

export async function designSite(data, style, onText) {
  return withModel((model) => streamText(model, designPrompt(data, style), { systemInstruction: DESIGN_SYSTEM }, (c) => c.text && onText(c.text)));
}
