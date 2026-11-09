// Opens saved demos in the editor and lists which left-panel fields are still empty.
// Usage: node scripts/form-audit.cjs <slug> [more slugs]   (needs Playwright; server on :3000)
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  for (const slug of process.argv.slice(2)) {
    await page.goto(`http://localhost:3000/?site=${encodeURIComponent(slug)}`);
    await page.waitForTimeout(2500);
    // open every section so all inputs exist
    await page.$$eval("#form details", (ds) => ds.forEach((d) => (d.open = true)));
    const report = await page.$$eval("#form details.sec", (secs) => secs.map((sec) => {
      const title = sec.querySelector("summary").childNodes[0].textContent.trim();
      const fields = [...sec.querySelectorAll(".field")].map((f) => {
        const label = f.querySelector(".lbl")?.textContent.trim() || "";
        const thumbs = f.querySelectorAll(".thumb, .gal .g");
        const hasImg = [...thumbs].some((t) => t.style.backgroundImage);
        const inputs = [...f.querySelectorAll("input:not([type=file]):not([type=color]),textarea,select")];
        const filled = hasImg || inputs.some((i) => (i.type === "checkbox" ? i.checked : String(i.value || "").trim() !== ""));
        return { label, filled };
      });
      const items = sec.querySelectorAll(".item").length;
      return { title, empty: fields.filter((f) => !f.filled).map((f) => f.label), total: fields.length, items };
    }));
    console.log(`\n■ ${slug}`);
    let emptyCount = 0, total = 0;
    for (const r of report) {
      emptyCount += r.empty.length; total += r.total;
      const list = r.items !== undefined && r.total === 0 ? `${r.items} items` : r.empty.length ? `EMPTY: ${r.empty.join(", ")}` : "all filled";
      console.log(`  ${r.title.padEnd(34)} ${r.total ? `${r.total - r.empty.length}/${r.total} filled` : ""}${r.items ? ` · ${r.items} list items` : ""}  ${r.empty.length ? "✗ " + r.empty.join(", ") : "✓"}`);
    }
    console.log(`  → ${total - emptyCount}/${total} fields filled`);
  }
  await browser.close();
})();
