// Prompts shared by every AI provider.

export const DATA_SHAPE = `{
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

export function researchPrompt(input) {
  const known = JSON.stringify(input.known || {}, null, 1).slice(0, 20000);
  return `Research this business/brand on the internet so we can build its website.

Brand / business name: ${input.name || "(unknown)"}
Location / city: ${input.location || "(unknown)"}
Website or Google Maps link (if any): ${input.url || "(none)"}
Extra hints from the user: ${input.hints || "(none)"}

What we already know (do not contradict it unless clearly wrong):
${known}

Search the web (and read the official website if you find it) to find: official website, Google Maps / Google Business listing details (address, phone, hours, rating, review snippets), social profiles, services/products/menu with prices, founding year, team, FAQs, and real image URLs (logo, hero/storefront, product/gallery photos – direct image file URLs from the official site or socials only, never invent URLs).

Then reply with ONLY one JSON object in a \`\`\`json fenced block, using exactly this shape (leave unknown strings empty, omit unknown list items, never fabricate phone numbers, addresses, prices or reviews – but you may write marketing copy for tagline/description/about/service descriptions/FAQ based on what you found):
${DATA_SHAPE}

Also add a top-level "sources" array of the URLs you used.`;
}

export function copyPrompt(data) {
  return `You are a senior brand copywriter. Here is a business's website data as JSON:
${JSON.stringify(data).slice(0, 40000)}

Fill in ONLY the empty copy fields: brand.tagline, brand.description, brand.about, each service's description, cta.text, seo.title, seo.description, seo.keywords, and add 4–6 helpful FAQ items if faq is empty. Improve nothing that is already filled. Never invent facts like phone numbers, addresses, prices, awards, reviews or years. Reply with ONLY the complete updated JSON in a \`\`\`json block, same shape as the input. FAQ items must be {"q": "", "a": ""} and seo.keywords a comma-separated string.`;
}

export const DESIGN_SYSTEM = "You are a world-class web designer and front-end engineer. You build stunning, conversion-focused, fully responsive single-file websites (HTML + embedded CSS + small vanilla JS).";

export function designPrompt(data, style) {
  return `Design and build a complete, production-quality one-page website for this brand.

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
- Keep it self-contained (no external JS frameworks).`;
}

export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(candidate); }
  catch { throw new Error("The AI reply was not valid JSON – please try again."); }
}

/** Website copy for a local business from verified facts only. */
export function contentPrompt(data) {
  const facts = JSON.stringify({ ...data, media: undefined }, null, 1);
  return `You write website copy for small local businesses in India. Write warm, specific, professional English (simple words; a light local touch is fine).

VERIFIED FACTS (from the business's Google Maps listing):
${facts}

Return ONLY one JSON object in a \`\`\`json block with exactly these keys:
{
  "tagline": "hero headline, max 8 words, specific to this business type and area",
  "description": "1–2 sentence hero sub-text",
  "about": "2 short paragraphs separated by a blank line",
  "services": [{ "title": "", "description": "one sentence" }],
  "highlights": [{ "title": "", "text": "short reason to choose them" }],
  "faq": [{ "q": "", "a": "" }],
  "ctaHeadline": "",
  "seoTitle": "", "seoDescription": "", "seoKeywords": "comma-separated",
  "primaryColor": "#hex", "accentColor": "#hex"
}

Rules:
- Keep the given service titles (you may refine wording or add 1–2 that obviously fit the business type); write one benefit-led sentence each. NO prices.
- 4 highlights (e.g. rating, location convenience, hygiene/expertise, easy booking) – only claims supported by the facts or that are generic and safe.
- 5 FAQ items customers of this business type actually ask (booking, location/area, how to contact on WhatsApp/phone, what to expect). Answers must not invent prices, timings, years, staff names, awards or offers – say "Call or WhatsApp us" when unsure.
- Never invent reviews, founding years, certifications, staff names, or numbers that are not in the facts.
- Colours must suit this design direction: ${data.meta?.look?.style || "modern"}.`;
}

/** Full custom design brief for the automatic builder. */
export function autoDesignPrompt(data, look) {
  const m = data.meta || {};
  return `Design and build a stunning, complete, production-quality one-page website for this local business. It will be shown to the owner as a demo of their future website, so it must look premium, unique and clearly made for THEM.

BUSINESS DATA (JSON):
${JSON.stringify({ ...data, meta: { ...m, look: undefined } }, null, 1)}

VISUAL DIRECTION: ${look.style}
HERO LAYOUT: ${look.layout}

Requirements:
- Output ONLY the HTML document, starting with <!DOCTYPE html>. No markdown fences, no commentary.
- Use the business name exactly as given. Use all copy provided (tagline, description, about, services, highlights, FAQ). Do NOT invent prices, reviews, years, staff names or awards.
- Sections: sticky header (name as a stylish wordmark, nav, CTA) → hero → trust band (Google rating ${m.rating || ""}★ from ${m.reviews || ""} reviews, linking to contact.mapUrl) → about → services (cards) → highlights/why choose us → gallery (use media.gallery images) → ${data.testimonials?.length ? "testimonials (real Google reviews, keep attribution) →" : ""} FAQ (accordion) → location & contact (address, phone as tel: link, WhatsApp button, embedded Google Map iframe using contact.mapEmbed with width 100% and height ~420px, plus a 'Get directions' button linking to contact.mapUrl${m.reviewUrl ? `, and a 'Rate us on Google' link to ${m.reviewUrl}` : ""}) → footer.
- Use media.hero and media.gallery image URLs exactly as given (they are real, working URLs). Use object-fit: cover; add descriptive alt text.
- Primary CTA: cta.text → cta.link. Floating WhatsApp button if contact.whatsapp is set (https://wa.me/ + digits only). Click-to-call on mobile.
- Colours: brand.primaryColor / brand.accentColor. Google Fonts that fit the visual direction. Make the layout genuinely distinctive (not a generic template): interesting section shapes, layered elements, tasteful animations on scroll (IntersectionObserver), hover states.
- Fully responsive (perfect on 390px phones), mobile hamburger menu, accessible contrast, semantic HTML, all internal links as #section anchors.
- Include <title>, meta description, Open Graph tags and schema.org LocalBusiness JSON-LD (name, address, telephone, geo ${m.lat ? `${m.lat},${m.lng}` : ""}, aggregateRating).
- Self-contained: inline CSS + small vanilla JS only.`;
}
