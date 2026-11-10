import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// isolated sites folder for this test
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pinpage-test-"));
process.env.SITES_DIR = tmp;
process.env.PINPAGE_WHATSAPP = "+91 98765 43210";
process.env.PINPAGE_WAITLIST_URL = "https://forms.gle/example";
const { demoVersion, packageDemos, productPage, publishConfigured, wranglerBin } = await import("../lib/publish.js");
import { execFileSync } from "node:child_process";

test("demo copy is hidden from search and carries a ribbon with a Remove link", () => {
  const h = demoVersion("<html><head><title>x</title></head><body><p>hi</p></body></html>", { brand: { name: "Glow Salon" } });
  assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(h, /Free demo website prepared for <b>Glow Salon<\/b>/);
  assert.match(h, /wa\.me\/919876543210\?text=Please%20remove%20the%20demo%20website%20for%20Glow%20Salon/);
  assert.ok(h.indexOf('id="pp-demo"') < h.indexOf("</body>"));
});

test("upload folder has noindex rules, a home page and one folder per demo", async () => {
  fs.mkdirSync(path.join(tmp, "glow-salon"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "glow-salon", "index.html"), "<html><head></head><body>site</body></html>");
  fs.writeFileSync(path.join(tmp, "glow-salon", "data.json"), JSON.stringify({ brand: { name: "Glow Salon" } }));
  const dir = await packageDemos(["glow-salon"]);
  assert.match(fs.readFileSync(path.join(dir, "_headers"), "utf8"), /X-Robots-Tag: noindex/);
  assert.match(fs.readFileSync(path.join(dir, "robots.txt"), "utf8"), /Disallow: \//);
  assert.match(fs.readFileSync(path.join(dir, "index.html"), "utf8"), /PinPage/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "index.html"), "utf8"), /Glow Salon/, "home page must not list businesses");
  assert.match(fs.readFileSync(path.join(dir, "glow-salon", "index.html"), "utf8"), /prepared for <b>Glow Salon/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("product page gets the waitlist + WhatsApp links filled in", async () => {
  const h = await productPage();
  assert.doesNotMatch(h, /\{\{[A-Z_]+\}\}/);
  assert.match(h, /href="https:\/\/forms\.gle\/example"/);
  assert.match(h, /wa\.me\/919876543210/);
  assert.match(h, /by Indrix/);
  assert.match(h, /Hi, I&#39;m the founder of Indrix/);
  assert.doesNotMatch(h, /📍<\/i>/, "no icon before the name");
  assert.match(h, /id="themeBtn"/);
});

test("publishing stays off without a Cloudflare token", () => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  assert.equal(publishConfigured(), false);
});

test("the Cloudflare CLI can be found and started", () => {
  const bin = wranglerBin();
  assert.ok(fs.existsSync(bin), bin);
  const out = execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  assert.match(out, /\d+\.\d+\.\d+/);
});
