// Picks the AI provider: Google Gemini (free tier) or Anthropic Claude (paid).
// AI_PROVIDER=gemini|anthropic forces one; otherwise whichever key is set (Gemini first).
import * as gemini from "./gemini.js";
import * as anthropic from "./anthropic.js";

const hasGemini = () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
const hasAnthropic = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export function aiProvider() {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (hasGemini()) return "gemini";
  if (hasAnthropic()) return "anthropic";
  return null;
}

const impl = () => {
  const p = aiProvider();
  if (!p) throw new Error("No AI key set. Get a free Gemini key at aistudio.google.com/apikey and start with GEMINI_API_KEY=…");
  return p === "gemini" ? gemini : anthropic;
};

export const researchBrand = (input, onEvent) => impl().researchBrand(input, onEvent);
export const writeCopy = (data) => impl().writeCopy(data);
export const designSite = (data, style, onText) => impl().designSite(data, style, onText);
export const friendlyError = (e) => gemini.friendlyGeminiError(e) || anthropic.friendlyClaudeError(e) || e?.message || String(e);
