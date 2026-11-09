# SiteForge: AI website maker

Turn a Google Maps link, or a whole sheet of leads, into complete, unique, AI-designed websites you can show to businesses as demos. You can also fill in brand details by hand and download any site as a single HTML file.

## Leads → demo websites (main workflow)

1. Open **http://localhost:3000/leads.html** (or click **📋 Leads**).
2. Paste your Google Sheet link and click **Load leads**. The sheet must be shared as *Anyone with the link → Viewer*. You can also upload a CSV.
3. Columns are recognised automatically: Business Name, Phone, Google Rating, Reviews Count, Full Address, Google Maps URL, Has Website, Website URL, and Locality/Specialty notes.
4. Click **⚡ Build** on a lead, or tick several and click **Build selected**. Each site is built automatically:
   - facts from the sheet: name, phone, WhatsApp (mobile numbers only), rating, address, an exact map pin from the Maps URL, and a "Rate us on Google" link
   - AI-written copy: headline, about, services, why-choose-us, FAQ, SEO. It never invents prices, reviews or years.
   - a **unique AI design**: each business type has several visual directions and hero layouts, picked per business, so neighbouring leads look different. **↻ New design** gives the same lead a fresh look.
   - free stock photos matched to the business type (jewellery, spa, clinic, dental, restaurant, salon, makeup, nails, banquet)
   - conversion features: business name and Google rating in the hero, a "Book this →" WhatsApp link on every service (with a ready-made message), and a sticky **Call · WhatsApp · Directions** bar on phones
   - the **site doctor** (`lib/siteDoctor.js`), applied to every page you build, download or open:
     - WhatsApp, Maps and social links open in a new tab and never replace the website
     - empty `#` links go to the top, and links to a missing section go to the closest match
     - section headings stay below the sticky header
     - the phone menu closes after you tap a link
     - forms send the enquiry to the owner's WhatsApp
     - small links get comfortable tap areas on phones
     - broken images are hidden
     - scroll animations can't leave content invisible
   - a WhatsApp button and map are added if the design missed them
   - **claims check**: the build log and the Leads page flag anything the owner might not be able to back up, such as certifications, "100%", "best in…", years of experience or customer counts. The AI is instructed not to write these, and the check catches anything that slips through.
5. Sites are saved to `sites/<name>/index.html` and served at `/sites/<name>/`. Use **View**, **Edit** (opens the editor), **Download**, or **Export CSV** to get every lead with its demo link.

On the main page you can also paste a single **Google Maps link** and click **⚡ Build website**. If that business is in your loaded sheet, its phone, address and rating are used automatically.

### The left panel is filled in for you

After a build (or when you click **Edit** on a demo), every field that can be filled honestly is already filled:
- name, tagline, description, about, a generated **monogram logo** in the brand colours
- theme, colours, and the **font the AI design actually uses**
- phone, WhatsApp, address, Google map, Google Business link, website and social links found in your sheet
- photos, services (with descriptions and images), **why choose us**, highlights, FAQ, call to action, SEO

A **completeness meter** shows what's left. Facts only the owner or Google know (opening hours, email, price range, founded year, Instagram/Facebook, real reviews) are never invented. Each has a **🔎 Find** / **Open Google listing** link so you can copy the real value in seconds, and the build log lists them as "Ask the owner for: …". With `GOOGLE_PLACES_API_KEY` set, hours, price range, real reviews, real photos and the website are filled automatically.

Optional: set `GOOGLE_PLACES_API_KEY` (Google Places API (New), the official API) to add each business's **real photos, Google reviews and opening hours**. Google requires a billing account for it, but includes a monthly free usage allowance.

## Run (free)

1. Get a **free** Gemini API key (no credit card): https://aistudio.google.com/apikey
2. Start the app:

```bash
npm install
GEMINI_API_KEY=your-key npm start          # open http://localhost:3000
```

Windows PowerShell: `$env:GEMINI_API_KEY="your-key"; npm start`

Without any key, everything works except the three AI buttons.

### AI providers

| Provider | Cost | Env var |
|---|---|---|
| Google Gemini (default) | Free tier, rate-limited (a limited number of requests per minute and per day) | `GEMINI_API_KEY` |
| Anthropic Claude | Paid, pay as you go | `ANTHROPIC_API_KEY` |

If both keys are set, Gemini is used; set `AI_PROVIDER=anthropic` to force Claude.
**Free-key note:** Google Search grounding is usually *not* included in Gemini's free tier. AI research then automatically falls back to reading web pages + the model's own knowledge (the log tells you), and skips reviews so nothing invented gets published. Double-check phone numbers, hours and addresses. For exact details, also paste the business's website or Maps link into **Import**.

If you hit the free limit you'll see a "limit reached" message: wait a minute, or until the next day for the daily limit.

## Inputs

| Section | Fields |
|---|---|
| Brand | name, tagline, industry, description, about/story, founded year, logo (URL or upload) |
| Design | theme (modern / elegant / bold / minimal / fresh), primary + accent colors, font, language |
| Contact & location | phone, WhatsApp (adds a floating chat button), email (enables a contact form), address, **Google Maps** (share link, place URL, `<iframe>` code, or `lat, lng`), opening hours, price range |
| Media | hero image, gallery (multi-upload or URLs), YouTube/Vimeo video |
| Lists | services/products/menu (with price + image), highlights/stats, reviews, team, FAQ |
| Links | Instagram, Facebook, X, LinkedIn, YouTube, TikTok, Pinterest, website |
| CTA & SEO | button text/link, banner headline, meta title/description/keywords |
| Sections | show or hide any section |

## Auto-fill from the internet

- **Import a link**: paste an existing website or a Google Maps link. The server reads the page's meta tags, schema.org JSON-LD, images, `tel:`/`mailto:`/WhatsApp links, social profiles, embedded maps, reviews and FAQ. Imported data only fills empty fields; it never overwrites what you typed.
- **AI research**: give a name and city. The AI uses Google Search (Gemini) or web search (Claude) to find the address, hours, ratings, reviews, services, socials and real image URLs, then fills the form. Sources are listed in the log.
- **Write copy**: fills empty taglines, about text, service blurbs, FAQ and SEO without inventing facts.

## Output

- **Template engine** (instant, no AI needed): live preview with desktop, tablet and mobile views. The generated site includes SEO and Open Graph tags, LocalBusiness JSON-LD, a Google Map embed, a gallery lightbox, a mobile menu and scroll animations.
- **AI Designer**: the AI streams a one-off custom design from the same data, with an optional style direction.
- **Download website**: a single self-contained `.html` file you can upload to Netlify, Vercel, GitHub Pages, cPanel or any other host.
- **Save/Load project**: saves and loads all your inputs as JSON. Work also autosaves in the browser.

## Quality checks

```bash
npm i -D playwright && npx playwright install chromium   # one time
npm run qa -- http://localhost:3000/sites/<name>/          # clicks every link, menu, FAQ, form on desktop + phone
npm run heal                                              # re-apply the site doctor to all saved demos
```

## Config

`PORT` (default 3000), `SITES_DIR` (where demos are saved, default `./sites`), `GOOGLE_PLACES_API_KEY` (optional), `GEMINI_MODEL` (comma-separated list tried in order, default `gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash,gemini-3.7-flash,gemini-3.1-flash-lite`), `CLAUDE_MODEL` (default `claude-opus-5-5`), `AI_PROVIDER`.
Behind a corporate proxy, run with `NODE_USE_ENV_PROXY=1` so the importer's `fetch` uses `HTTPS_PROXY`.

## Structure

```
server.js            Express API: /api/auto, /api/leads/load, /api/sites, /api/import-url, /api/resolve-map, /api/ai/*
lib/scrape.js        website -> brand data extractor
lib/maps.js          Google Maps link parser -> embed URL
lib/safeFetch.js     fetch with SSRF guard, redirect checks, size and time limits
lib/ai.js            picks the AI provider
lib/gemini.js        Google Gemini (free tier) research, copywriting and design
lib/anthropic.js     Anthropic Claude (paid) research, copywriting and design
lib/prompts.js       prompts shared by both providers
lib/normalize.js     cleans AI output into the form's exact shape
lib/leads.js         Google Sheet / CSV leads → website facts
lib/categories.js    per-business-type photos, services and design directions
lib/autobuild.js     one-click pipeline: facts → AI copy → AI design → quality fixes → saved site
lib/places.js        optional Google Places API (New) enrichment
public/leads.html    leads dashboard (bulk demo builder)
public/shared.js     shared UI helpers (incl. the preview link guard)
public/generator.js  template engine (brand JSON -> website HTML)
public/app.js        builder UI
```
