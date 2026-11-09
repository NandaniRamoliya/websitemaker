# SiteForge: AI website maker

Enter brand details (or let it find them online) and get a complete, responsive website you can download as a single HTML file.

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

## Config

`PORT` (default 3000), `GEMINI_MODEL` (comma-separated list tried in order, default `gemini-3.8-flash,gemini-flash-latest,gemini-2.5-flash`), `CLAUDE_MODEL` (default `claude-opus-5-5`), `AI_PROVIDER`.
Behind a corporate proxy, run with `NODE_USE_ENV_PROXY=1` so the importer's `fetch` uses `HTTPS_PROXY`.

## Structure

```
server.js            Express API: /api/import-url, /api/resolve-map, /api/ai/{research,copy,design}
lib/scrape.js        website -> brand data extractor
lib/maps.js          Google Maps link parser -> embed URL
lib/safeFetch.js     fetch with SSRF guard, redirect checks, size and time limits
lib/ai.js            picks the AI provider
lib/gemini.js        Google Gemini (free tier) research, copywriting and design
lib/anthropic.js     Anthropic Claude (paid) research, copywriting and design
lib/prompts.js       prompts shared by both providers
public/generator.js  template engine (brand JSON -> website HTML)
public/app.js        builder UI
```
