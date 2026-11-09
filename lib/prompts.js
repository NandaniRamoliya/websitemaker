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
- Banned claims (they can get the owner in trouble): hallmark/BIS/ISO/NABH or any certification, "100%", "guaranteed", "certified", "best in <city>", "No.1", "award-winning", years of experience, customer counts. Describe the rating as "<rating>★ on Google from <count> reviews" – never "positive"/"happy"/"satisfied" reviews.
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
- CONVERSION (this demo must make the owner say yes on the spot):
  • The business name must be big and proud in the hero (as a heading or eyebrow above the tagline), with the Google rating badge right there.
  • Every service card gets a small "Book this →" link that opens WhatsApp with a prefilled message, e.g. https://wa.me/<digits>?text=Hi%20<Business>%2C%20I%27d%20like%20to%20book%20<Service> (fall back to tel: if there is no WhatsApp).
  • On phones (max-width 760px) show a sticky bottom action bar with three equal buttons: Call (tel:), WhatsApp (wa.me), Directions (contact.mapUrl). Add bottom padding to <body> on phones so it never hides content, and hide the floating WhatsApp bubble on phones (the bar replaces it).
  • Mention the locality naturally in the hero or about text so it feels made for them.
- Links: every external link (wa.me, maps, social) must have target="_blank" rel="noopener"; every in-page link must point to an id that exists; no href="#" placeholders. Interactive elements must be <a> or <button> and every one must work (menu toggle, FAQ accordion, gallery). Close the mobile menu when a menu link is tapped. Use "scroll-margin-top" on sections so headings are not hidden under the sticky header.
- Never write fake quotes, testimonials or customer names. Images: loading="lazy" on everything except the hero.
- FACTS ONLY: the only numbers you may show are the Google rating and the review count, written exactly (e.g. "${m.reviews || "N"} Google reviews" – never "positive"/"happy"/"verified" reviews, never rounded up). Never claim certifications or guarantees (BIS hallmark, ISO, NABH, "100%", "certified", "best in Surat", "No.1"), awards, years of experience, number of customers/branches/staff, prices or offers.
- Icons: use these exact inline SVGs (fill="currentColor", sized 18–24px in buttons):
  WhatsApp: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z"/></svg>
  Phone: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>
  Map pin: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>
- Colours: brand.primaryColor / brand.accentColor. Google Fonts that fit the visual direction. Make the layout genuinely distinctive (not a generic template): interesting section shapes, layered elements, tasteful animations on scroll (IntersectionObserver), hover states.
- Fully responsive (perfect on 390px phones), mobile hamburger menu, accessible contrast, semantic HTML, all internal links as #section anchors.
- Include <title>, meta description, Open Graph tags and schema.org LocalBusiness JSON-LD (name, address, telephone, geo ${m.lat ? `${m.lat},${m.lng}` : ""}, aggregateRating).
- Self-contained: inline CSS + small vanilla JS only.`;
}
