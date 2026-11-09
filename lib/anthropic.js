// Anthropic Claude provider (paid API): research (web search + fetch) and bespoke website design.
import Anthropic from "@anthropic-ai/sdk";
import { researchPrompt, copyPrompt, DESIGN_SYSTEM, designPrompt, extractJson } from "./prompts.js";

const MODEL = process.env.CLAUDE_MODEL || process.env.SITEFORGE_MODEL || "claude-opus-5-5";
let client;
const getClient = () => (client ??= new Anthropic());

export function friendlyClaudeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return "Invalid or missing Anthropic API key.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API – try again in a minute.";
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status}: ${e.message}`;
  return null;
}

// Server-side fallback when a safety classifier declines (see Anthropic docs: refusals & fallback).
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

/** Runs a server-tool conversation, resuming pause_turn, and returns the final text. */
async function runWithServerTools(params, onEvent) {
  const messages = [...params.messages];
  let text = "";
  for (let turn = 0; turn < 6; turn++) {
    const stream = getClient().beta.messages.stream({ ...FALLBACK, ...params, messages });
    stream.on("streamEvent", (ev) => {
      if (ev.type === "content_block_start") {
        const b = ev.content_block;
        if (b.type === "server_tool_use") onEvent?.({ type: "tool", name: b.name });
      }
    });
    const msg = await stream.finalMessage();
    for (const b of msg.content) {
      if (b.type === "server_tool_use" && b.input) {
        onEvent?.({ type: "tool", name: b.name, detail: b.input.query || b.input.url || "" });
      }
      if (b.type === "text") text += b.text;
    }
    if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  return text;
}

export async function researchBrand(input, onEvent) {
  const prompt = researchPrompt(input);
  const text = await runWithServerTools({
    model: MODEL,
    max_tokens: 32000,
    output_config: { effort: "medium" },
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 8 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
    ],
    messages: [{ role: "user", content: prompt }],
  }, onEvent);
  return extractJson(text);
}

/** Fill empty marketing copy (taglines, about, service blurbs, FAQ, SEO) without inventing facts. */
export async function writeCopy(data) {
  const stream = getClient().beta.messages.stream({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low" },
    messages: [{
      role: "user",
      content: copyPrompt(data),
    }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
  return extractJson(msg.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

/** Streams a complete bespoke single-file website. */
export async function designSite(data, style, onText) {
  const stream = getClient().beta.messages.stream({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 64000,
    output_config: { effort: "medium" },
    system: DESIGN_SYSTEM,
    messages: [{
      role: "user",
      content: designPrompt(data, style),
    }],
  });
  stream.on("text", (t) => onText(t));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
  return msg;
}
