// QA for generated demo sites: clicks every link/button on desktop + phone and reports problems.
// Usage: node scripts/qa.cjs http://localhost:3000/sites/<slug>/ [more urls]
// Needs Playwright:  npm i -D playwright && npx playwright install chromium
const { chromium } = require("playwright");

async function audit(page, url, width) {
  const issues = [];
  const errors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  const label = width < 600 ? "phone" : "desktop";

  // 1) link audit
  const links = await page.$$eval("a", (as) => as.map((a) => ({ href: a.getAttribute("href"), text: (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40), target: a.target })));
  for (const l of links) {
    if (l.href == null || l.href === "" || l.href === "#") issues.push(`dead link "${l.text}" (href=${JSON.stringify(l.href)})`);
    else if (l.href.startsWith("#") && !(await page.$(`[id="${decodeURIComponent(l.href.slice(1))}"]`))) issues.push(`anchor "${l.text}" → ${l.href} has no target`);
    else if (/^https?:\/\//.test(l.href) && l.target !== "_blank") issues.push(`external link "${l.text}" opens in same tab (${l.href.slice(0, 40)})`);
    else if (!/^(#|https?:|tel:|mailto:|sms:|javascript:)/.test(l.href)) issues.push(`relative link "${l.text}" → ${l.href}`);
  }

  // 2) click every visible in-page anchor: must scroll to the target, not navigate away, not hide it under the header
  const anchorHandles = await page.$$('a[href^="#"]:not([href="#"])');
  let clicked = 0;
  for (const h of anchorHandles) {
    if (!(await h.isVisible())) continue;
    // skip links parked off-screen (e.g. inside a closed slide-in phone menu)
    const offscreen = await h.evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.left >= innerWidth || r.right <= 0) return true;
      // hidden on purpose: inside a fixed panel moved off-screen, or clipped away (clip-path / zero size)
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.position === "fixed" && (r.bottom <= 0 || r.top >= innerHeight)) return true;
        if (/circle\(0|inset\(100%|polygon\(0px 0px, 0px 0px/.test(cs.clipPath)) return true;
      }
      return false;
    });
    if (offscreen) continue;
    const href = await h.getAttribute("href");
    const target = await page.$(`[id="${decodeURIComponent(href.slice(1))}"]`);
    if (!target) continue;
    const ok = await h.click({ timeout: 4000 }).then(() => true).catch((e) => {
      const m = String(e.message);
      const why = (m.match(/<[^>]+>(?: from <[^>]+> subtree)? intercepts pointer events/) || m.match(/element is not (stable|visible|enabled)/) || [""])[0];
      issues.push(`scroll: ${href} link not clickable${why ? " – " + why.slice(0, 140) : ""}`); return false;
    });
    if (!ok) continue;
    // wait until the page has stopped scrolling (smooth scroll can take a while)
    await page.evaluate(() => new Promise((r) => { let last = -1, still = 0; const t0 = Date.now(); const tick = () => { if (scrollY === last) still++; else still = 0; last = scrollY; if (still >= 6 || Date.now() - t0 > 5000) r(); else setTimeout(tick, 80); }; setTimeout(tick, 120); }));
    clicked++;
    if (page.url().split("#")[0] !== url.split("#")[0]) { issues.push(`clicking ${href} navigated away to ${page.url()}`); await page.goto(url); continue; }
    const box = await target.boundingBox();
    const atBottom = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
    if (box && !atBottom && (box.y > 450 || box.y + box.height < 0)) issues.push(`scroll: ${href} didn't scroll to its section (y=${Math.round(box.y)})`);
    else if (box && href !== "#top") {
      const covered = await page.evaluate((y) => { const el = document.elementFromPoint(innerWidth / 2, Math.max(2, y + 8)); return !!(el && el.closest("header")); }, box.y);
      if (covered) issues.push(`scroll: ${href} section top hidden under the sticky header`);
    }
  }

  // 3) phone checks
  if (width < 600) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const toggles = await page.$$('header button, nav button, [aria-label*="menu" i], [class*="hamburger" i], [class*="burger" i], [class*="menu-toggle" i], [class*="menu-btn" i]');
    let toggle = null;
    for (const t of toggles) if (await t.isVisible()) { toggle = t; break; }
    if (!toggle) issues.push("no visible mobile menu button");
    else {
      await toggle.click().catch(() => issues.push("mobile menu button not clickable"));
      await page.waitForTimeout(800);
      let navLink = null;
      for (const a of await page.$$('a[href^="#"]:not([href="#"])')) {
        if (!(await a.isVisible())) continue;
        const r = await a.boundingBox();
        if (r && r.y > 40 && r.y < 900) { navLink = a; break; }
      }
      if (!navLink) issues.push("mobile menu opens but shows no links");
      else {
        await navLink.click().catch(() => issues.push("mobile menu link not clickable"));
        await page.waitForTimeout(1000);
        // menu should be closed now: the tapped link should no longer be visible in the viewport overlay
        const stillOpen = await navLink.evaluate((el) => {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          const covering = el.closest("[class*=open],[class*=active],[class*=show],[class*=visible]");
          return r.width > 0 && r.top >= 0 && r.top < innerHeight && cs.visibility !== "hidden" && !!covering;
        }).catch(() => false);
        if (stillOpen) issues.push("mobile menu stays open after tapping a link");
      }
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) issues.push("page scrolls sideways on phone");
    const tap = await page.$$eval("a,button", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 30 && (e.innerText || "").trim().length > 3 && getComputedStyle(e).display !== "inline"; }).length);
    if (tap > 6) issues.push(`${tap} small tap targets (<30px tall)`);
  }

  // 4) FAQ
  await page.evaluate(() => window.scrollTo(0, 0));
  let faqTriggers = [];
  for (const sel of ['details > summary', '[class*="faq-q" i]', '[class*="faq" i] [class*="question" i]', '[class*="accordion" i] button', '[class*="faq" i] button', '[class*="faq" i] [class*="header" i]', '#faq [onclick]', '[class*="faq-item" i]']) {
    faqTriggers = await page.$$(sel);
    if (faqTriggers.length) break;
  }
  let faqTested = false;
  for (const t of faqTriggers) {
    if (!(await t.isVisible())) continue;
    faqTested = true;
    await t.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
    const before = await page.evaluate(() => document.body.scrollHeight);
    await t.click().catch(() => issues.push("FAQ question not clickable"));
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => document.body.scrollHeight);
    if (after === before) issues.push("FAQ question doesn't open or close"); // first item may start open, so a click can close it
    break;
  }
  if (!faqTested && (await page.$("#faq"))) issues.push("FAQ section has no clickable questions");

  // 5) broken images
  // scroll down at a quick human pace
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); } });
  await page.waitForTimeout(1500);
  const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src")).map((i) => i.getAttribute("src").slice(0, 70)));
  broken.forEach((b) => issues.push("broken image " + b));

  // 6) content still invisible after scrolling (animation never fired)
  const invisible = await page.$$eval("h1,h2,h3,p,img", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); let n = e, o = 1; while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; } return r.width > 0 && o < 0.05 && !e.closest("nav,[class*=menu],[class*=lightbox],[class*=modal],[aria-hidden=true]"); }).length);
  if (invisible > 2) issues.push(`${invisible} headings/paragraphs/images stay invisible`);

  // 7) forms
  const forms = await page.$$eval("form", (fs) => fs.map((f) => f.getAttribute("action") || "(none)"));

  if (errors.length) issues.push(...errors.map((e) => "JS error: " + e));
  return { label, clicked, forms, issues: [...new Set(issues)] };
}

(async () => {
  const urls = process.argv.slice(2);
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const page = await browser.newPage();
  let total = 0;
  for (const url of urls) {
    for (const w of [1300, 390]) {
      const r = await audit(page, url, w);
      total += r.issues.length;
      console.log(`\n■ ${url.replace(/^https?:\/\/[^/]+/, "")} [${r.label}] – ${r.clicked} section links clicked, forms: ${JSON.stringify(r.forms)}`);
      console.log(r.issues.length ? r.issues.map((i) => "  ✗ " + i).join("\n") : "  ✓ no issues");
    }
  }
  await browser.close();
  process.exitCode = total ? 1 : 0;
})();
