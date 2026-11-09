# SiteForge: AI website maker

Enter brand details (or let it find them online) and get a complete, responsive website you can download as a single HTML file.

## Run

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # open http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, everything works except the three AI buttons.

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
- **AI research**: give a name and city. Claude uses web search and web fetch to find the address, hours, ratings, reviews, services, socials and real image URLs, then fills the form. Sources are listed in the log.
- **Write copy**: fills empty taglines, about text, service blurbs, FAQ and SEO without inventing facts.

## Output

- **Template engine** (instant, no AI needed): live preview with desktop, tablet and mobile views. The generated site includes SEO and Open Graph tags, LocalBusiness JSON-LD, a Google Map embed, a gallery lightbox, a mobile menu and scroll animations.
- **AI Designer**: Claude streams a one-off custom design from the same data, with an optional style direction.
- **Download website**: a single self-contained `.html` file you can upload to Netlify, Vercel, GitHub Pages, cPanel or any other host.
- **Save/Load project**: saves and loads all your inputs as JSON. Work also autosaves in the browser.

## Config

`PORT` (default 3000) and `SITEFORGE_MODEL` (default `claude-opus-5-5`).
Behind a corporate proxy, run with `NODE_USE_ENV_PROXY=1` so the importer's `fetch` uses `HTTPS_PROXY`.

## Structure

```
server.js            Express API: /api/import-url, /api/resolve-map, /api/ai/{research,copy,design}
lib/scrape.js        website -> brand data extractor
lib/maps.js          Google Maps link parser -> embed URL
lib/safeFetch.js     fetch with SSRF guard, redirect checks, size and time limits
lib/ai.js            Claude research, copywriting and design
public/generator.js  template engine (brand JSON -> website HTML)
public/app.js        builder UI
```
