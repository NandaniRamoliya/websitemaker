# PinPage (by Indrix): project context

This file is the full context for the project. Claude Code loads it automatically when a session starts in this repo. To continue in any other AI chat, paste this whole file as the first message, followed by what you want next.

## What this is

**PinPage** turns a Google Maps link (or a Google Sheet of leads) into a complete, unique, AI-designed website for a local business. The owner of this repo uses it to build demo websites for businesses that have no website, publish them to a free link, and send that link on WhatsApp as a sales pitch.

- Parent company / brand: **Indrix**. PinPage is its first product. More products will follow under Indrix.
- GitHub: `NandaniRamoliya/websitemaker`, branch `main`. The npm package is still named `siteforge` (the project's first name); the product name everywhere else is PinPage.
- The owner is not a programmer. Explain in plain words, give exact click-by-click steps, and prefer screenshots for anything visual. They run the app on Windows (`D:\websitemaker`, PowerShell).
- Budget is zero for now. Everything must work on free tiers.

## Who it is for and the business plan

1. **Now:** the owner uses it for their own leads (about 100 leads in Surat: jewellers, salons, spas, dental clinics, restaurants; 24 have no website).
2. **Next:** agencies and freelancers use it, each with their own free Gemini key. Paid "credits" (the owner's paid AI key, plus Razorpay) are marked "Coming soon" with a waitlist Google Form.
3. **Later:** business owners self-serve: paste a Maps link, get a site, "go live" on their own domain.

## What is live

- PinPage landing page: https://pinpage-8no.pages.dev/ (Cloudflare Pages project `pinpage`; the plain name was taken, so Cloudflare added `-8no`).
- Verified in Google Search Console with the HTML-tag method. Sitemap submission and "Request indexing" were the next steps given to the owner.
- Waitlist form: https://forms.gle/xryvJ6mhN9v4SrgX9
- Demo sites go to the Cloudflare Pages project `pinpage-demos` at `/<business-slug>/`. None had been published when this file was written.

## How to run

```bash
npm install
npm start        # http://localhost:3000 (editor) and http://localhost:3000/leads.html (leads)
npm test         # 17 tests, all must pass before pushing
```

Settings live in `.env` (never committed; see `.env.example`):

| Setting | Purpose |
|---|---|
| `GEMINI_API_KEY` | Free Google Gemini key (AI Studio). The AI behind copy and design. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Publishing to Cloudflare Pages. Token permission: Account, Cloudflare Pages, Edit. |
| `PINPAGE_WHATSAPP` | Owner's WhatsApp number (digits with 91). Used on the landing page and the demo "Remove" link. |
| `PINPAGE_FOUNDER` | Name shown in the founder popup. Empty shows "the founder of Indrix". |
| `PINPAGE_COMPANY` | Defaults to `Indrix`. |
| `PINPAGE_GOOGLE_VERIFY` | Search Console verification code. Must stay, or verification is lost on the next publish. |
| `PINPAGE_SITE_URL` | Only when a real domain is bought. |
| `PINPAGE_WAITLIST_URL` | Defaults to the form above. |
| `GOOGLE_PLACES_API_KEY` | Optional. Real photos, reviews, hours. Coded but never tested with a real key. |
| `ANTHROPIC_API_KEY` | Optional paid alternative to Gemini (`AI_PROVIDER=anthropic`). Never tested with a real key. |

## How it works

**Leads page (`/leads.html`)**: paste a Google Sheet link (shared "Anyone with the link") or upload a CSV. Columns are recognised automatically (Business Name, Phone Number, Has Website, Website URL, Google Rating, Reviews Count, Full Address, Google Maps URL, and a notes column holding `Locality: … | Specialty: …`). Per lead: **Build**, **New design**, **View**, **Publish**, **Send** (WhatsApp to the lead with an editable Hinglish message template), copy link, and a menu for "own address" (`<business>.pages.dev`) and unpublish. Bulk: Build selected, Publish selected, Export CSV.

**Editor (`/`)**: paste one Maps link and click Build website, or edit a saved demo (`/?site=<slug>`). The left panel is filled automatically; a meter shows what is left; "Find" links help copy facts only the owner or Google know.

**Build pipeline (`lib/autobuild.js`)**:
1. Facts from the sheet row or the Maps URL (name, phone, WhatsApp for mobile numbers only, rating, address, map pin, place ID).
2. Business type detected (`lib/categories.js`): jewellery, spa, clinic, dental, restaurant, salon, makeup, nails, banquet, general. Each has checked free Unsplash photos, default services and several design directions, picked per business so sites differ.
3. AI writes copy (`contentPrompt`), then designs a full single-file site (`autoDesignPrompt`), streamed live.
4. Quality gate: required parts are checked (about, services, why-choose-us, gallery, FAQ, call and WhatsApp links, map, footer, phone menu). One AI repair pass, then anything still missing is added in a neutral style. Such sites are marked `quality: "basic"`.
5. Site doctor (`lib/siteDoctor.js`) is applied to every built, downloaded or opened page.
6. `completeData` (`lib/complete.js`) fills the editor fields (monogram logo, real font, theme, links, SEO).
7. Claims check flags risky text. Saved to `sites/<slug>/index.html` + `data.json`, with a registry in `sites/index.json`.
8. If the AI fails entirely, the quick template (`public/generator.js`) is used.

**Publishing (`lib/publish.js`)**: uses the official `wrangler` CLI. Demos are one shared project, and each deploy is a full snapshot of all published demos. Demo copies are hidden from search (`noindex` meta, `X-Robots-Tag`, `robots.txt`) and carry a small "Free demo website prepared for …" ribbon with a Remove link. The landing page (`product-site/index.html`) is published with canonical URL, `robots.txt`, `sitemap.xml`, `og.png` and schema.org data.

## Files

```
server.js             Express routes: /api/auto, /api/leads/load, /api/sites, /api/publish/*, /api/heal,
                      /api/import-url, /api/resolve-map, /api/ai/*, /product-preview
lib/env.js            loads .env (handles Windows BOM, hints at .env.txt)
lib/autobuild.js      the build pipeline, quality gate, polishHtml, checkClaims
lib/siteDoctor.js     runtime + HTML fixes for every generated site
lib/complete.js       fills editor fields honestly
lib/categories.js     business types, photos, services, design directions
lib/leads.js          sheet/CSV parsing, column mapping, lead → site facts
lib/prompts.js        all AI prompts
lib/gemini.js         Gemini provider (model fallback list, stall watchdog)
lib/anthropic.js      Claude provider (optional)
lib/ai.js             picks the provider
lib/publish.js        Cloudflare Pages publishing, landing-page packaging, JSON-LD
lib/places.js         optional Google Places enrichment
lib/scrape.js, maps.js, safeFetch.js, normalize.js   website import, Maps URL parsing, safe fetch, AI output cleanup
public/               index.html + app.js (editor), leads.html + leads.js, shared.js (preview guard, build screen),
                      generator.js (template engine), styles.css
product-site/         PinPage landing page + og.png
scripts/qa.cjs        clicks every link, menu and FAQ on desktop + phone (needs Playwright)
scripts/heal-sites.mjs   re-applies the site doctor to saved demos
scripts/form-audit.cjs   lists empty editor fields for saved demos
test/                 node:test suites
sites/                generated demos (git-ignored; contains lead data)
```

## Rules the owner cares about (do not break these)

- **Never invent facts.** No made-up reviews, prices, opening hours, founding years, certifications (BIS, ISO), "100%", "best in…", years of experience or customer counts. The only numbers allowed are the exact Google rating and review count.
- **Every click must work** on every generated site, on desktop and phone. Run `scripts/qa.cjs` on new demos after changing prompts or the site doctor.
- **External links open in a new tab.** Clicking inside the editor preview must never load the editor inside itself.
- **Users see friendly progress only.** AI model names, quota messages, file paths and API errors go to the hidden "Technical details" box and the server console, never the main UI.
- **Each demo should look different.** AI design is the default; the template is only a fallback.
- **No icon before the PinPage name.** It is a plain gradient wordmark, "PinPage by Indrix".
- **Secrets never go in git or chat.** `.env` and `sites/` are git-ignored. Do not commit lead phone numbers or the leads sheet link.
- **No bot-protection workarounds.** Scraping Google Maps pages directly was rejected; real photos and reviews come only through the official Places API.
- Commit and push to `main` after each finished change, with tests passing.

## Landing page details

- Light and dark mode: follows the device, toggle in the header, choice remembered (`localStorage` key `indrix.theme`).
- Founder note popup: opens once per visitor after they scroll about halfway (or 20 seconds), never on arrival, because instant pop-ups hurt mobile ranking. A footer link reopens it.
- SEO target: "AI website maker for local businesses" and specific searches (salon, restaurant, clinic, jewellery websites; Google Maps link to website). Ranking first for "website maker" is not realistic; ranking for the name "PinPage" takes weeks and needs links from other sites. A real domain would help most.

## Known limits

- **Gemini free tier** allows only a handful of full designs a day across five Flash models, and Google Search is not included on the free key. When quota runs out, builds come out "basic" or fall back to the template. Quota resets daily.
- The first publish to Cloudflare was confirmed working for the landing page. **Publishing demos, "own address" and unpublish have not been tried with the real token yet.**
- The tool has **no login**. It must only run on the owner's computer. Published links work worldwide without the computer being on; the builder itself does not.
- Photos are stock photos per business type unless the Places key is set.
- One lead row (Sejal Jewellers) has the business name in the "Google Maps URL" cell instead of a link.
- A Gemini key was pasted in chat during development and should be replaced with a new one.

## Not built yet (rough priority)

1. Write the demo link back into the Google Sheet (needs a free Google service account).
2. Background build queue that keeps running after the tab closes and resumes when the AI quota resets.
3. Let other people use the tool: login, per-user data, database, small server. A password lock plus Cloudflare Tunnel was offered as a quick interim way to show it.
4. Paid credits: paid AI key and Razorpay (currently a waitlist).
5. Test and switch on Google Places (real photos, reviews, hours).
6. Before charging money: official Google Maps Embed API, Unsplash API with credits, privacy and data-deletion page, careful WhatsApp sending.
7. A real domain (for example `pinpage.in`) connected to the `pinpage` project, with `PINPAGE_SITE_URL` set.
8. Gujarati and Hindi versions of demos; view tracking per demo; simple editing for the business owner after the sale.
9. Small cleanup: the console prints each AI model switch twice.
