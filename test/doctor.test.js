import test from "node:test";
import assert from "node:assert/strict";
import { heal, staticFixes } from "../lib/siteDoctor.js";
import { checkClaims } from "../lib/autobuild.js";

test("external links open in a new tab; empty links go to the top", () => {
  const h = staticFixes('<body><a href="https://wa.me/91">W</a><a href="https://x.com" target="_self">X</a><a href="#" class="logo">L</a><a href="">E</a><a href="#about">A</a></body>');
  assert.match(h, /href="https:\/\/wa\.me\/91" target="_blank" rel="noopener"/);
  assert.match(h, /href="https:\/\/x\.com" target="_blank"/);
  assert.equal((h.match(/href="#top" data-sf-top/g) || []).length, 2);
  assert.match(h, /href="#about"/);
  assert.match(h, /id="top"/);
});

test("heal is idempotent and its script parses", () => {
  const once = heal("<html><head></head><body><p>x</p></body></html>", { contact: { whatsapp: "+91 98765 43210" }, brand: { name: "A" } });
  const twice = heal(once, { contact: { whatsapp: "+91 98765 43210" }, brand: { name: "A" } });
  assert.equal((twice.match(/<script data-sf-doctor>/g) || []).length, 1);
  assert.equal((twice.match(/id="top"/g) || []).length, 1);
  const js = twice.match(/<script data-sf-doctor>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(js));
  assert.match(js, /"wa":"919876543210"/);
});

test("claims check flags risky marketing claims", () => {
  const w = checkClaims("<p>100% BIS Hallmarked gold. 830 happy customers. Best in Surat! 15+ years. Verified Google reviews.</p>");
  for (const label of ["certification", "100%", "best/No.1", "years-of-experience", "positive/verified", "customer count"]) {
    assert.ok(w.some((x) => x.includes(label)), `missing ${label}: ${w.join(" | ")}`);
  }
  assert.deepEqual(checkClaims("<p>Rated 4.9★ on Google from 830 reviews. Visit us in Adajan.</p>"), []);
});
