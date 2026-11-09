// Claude-powered research (web search + fetch) and bespoke website design.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.SITEFORGE_MODEL || "claude-opus-5-5";
let client;
const getClient = () => (client ??= new Anthropic());

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

// Server-side fallback when a safety classifier declines (see Anthropic docs: refusals & fallback).
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

const DATA_SHAPE = `{
  "brand": { "name": "", "tagline": "", "industry": "", "description": "", "about": "", "founded": "", "logo": "<image URL>", "primaryColor": "#hex", "accentColor": "#hex" },
  "contact": { "phone": "", "whatsapp": "", "email": "", "address": "", "mapUrl": "<Google Maps URL>", "hours": "Mon–Fri: 9:00 – 18:00\\nSat: 10:00 – 14:00", "priceRange": "" },
  "media": { "hero": "<image URL>", "gallery": ["<image URL>"], "video": "<YouTube URL>" },
  "services": [{ "title": "", "description": "", "price": "", "image": "" }],
  "stats": [{ "value": "", "label": "" }],
  "testimonials": [{ "name": "", "role": "", "text": "", "rating": "5" }],
  "team": [{ "name": "", "role": "", "photo": "", "bio": "" }],
  "faq": [{ "q": "", "a": "" }],
  "social": { "instagram": "", "facebook": "", "twitter": "", "linkedin": "", "youtube": "", "tiktok": "", "website": "" },
  "cta": { "text": "", "link": "" },
  "seo": { "title": "", "description": "", "keywords": "" }
}`;

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

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
  const known = JSON.stringify(input.known || {}, null, 1).slice(0, 20000);
  const prompt = `Research this business/brand on the internet so we can build its website.

Brand / business name: ${input.name || "(unknown)"}
Location / city: ${input.location || "(unknown)"}
Website or Google Maps link (if any): ${input.url || "(none)"}
Extra hints from the user: ${input.hints || "(none)"}

What we already know (do not contradict it unless clearly wrong):
${known}

Use web search and web fetch to find: official website, Google Maps / Google Business listing details (address, phone, hours, rating, review snippets), social profiles, services/products/menu with prices, founding year, team, FAQs, and real image URLs (logo, hero/storefront, product/gallery photos – direct image file URLs from the official site or socials only, never invent URLs).

Then reply with ONLY one JSON object in a \`\`\`json fenced block, using exactly this shape (leave unknown strings empty, omit unknown list items, never fabricate phone numbers, addresses, prices or reviews – but you may write marketing copy for tagline/description/about/service descriptions/FAQ based on what you found):
${DATA_SHAPE}

Also add a top-level "sources" array of the URLs you used.`;

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
      content: `You are a senior brand copywriter. Here is a business's website data as JSON:\n${JSON.stringify(data).slice(0, 40000)}\n\nFill in ONLY the empty copy fields: brand.tagline, brand.description, brand.about, each service's description, cta.text, seo.title, seo.description, seo.keywords, and add 4–6 helpful FAQ items if faq is empty. Improve nothing that is already filled. Never invent facts like phone numbers, addresses, prices, awards, reviews or years. Reply with ONLY the complete updated JSON in a \`\`\`json block, same shape as the input.`,
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
    system: `You are a world-class web designer and front-end engineer. You build stunning, conversion-focused, fully responsive single-file websites (HTML + embedded CSS + small vanilla JS). Latency-sensitive; begin your visible answer immediately.`,
    messages: [{
      role: "user",
      content: `Design and build a complete, production-quality one-page website for this brand.

BRAND DATA (JSON):
${JSON.stringify(data, null, 1)}

DESIGN DIRECTION: ${style || "Choose the best direction for this brand and industry."}

Requirements:
- Output ONLY the HTML document, starting with <!DOCTYPE html>. No markdown fences, no commentary.
- Use every provided piece of real data (logo, images, services, prices, reviews, hours, socials, FAQ, stats). Do not invent phone numbers, addresses, prices or reviews.
- Image values like "__IMG_3__" are placeholders for uploaded images – use them verbatim as src/url() values.
- If contact.mapEmbed is set, embed it in an <iframe> in the contact/location section (width 100%, loading="lazy", no border).
- Sticky header with logo + nav + CTA, a memorable hero, then only the sections that have data, plus a contact section and footer with social links.
- Brand colors from brand.primaryColor / accentColor if given; tasteful Google Fonts; modern layout, subtle scroll animations, mobile menu, accessible contrast, semantic HTML.
- Add SEO meta tags, Open Graph tags and schema.org LocalBusiness/Organization JSON-LD.
- A floating WhatsApp button if contact.whatsapp is set. Phone/email as tel:/mailto: links.
- Keep it self-contained (no external JS frameworks).`,
    }],
  });
  stream.on("text", (t) => onText(t));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
  return msg;
}
