import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractFromHtml } from "../lib/scrape.js";
import { parseMapUrl, buildEmbedUrl } from "../lib/maps.js";

test("extracts brand data from a business web page", async () => {
  const html = fs.readFileSync(new URL("./fixture.html", import.meta.url), "utf8");
  const { data } = await extractFromHtml(html, "https://lunadental.example/");
  assert.equal(data.brand.name, "Luna Dental");
  assert.equal(data.contact.phone, "+1 512-555-0199");
  assert.equal(data.contact.whatsapp, "15125550199");
  assert.match(data.contact.address, /Congress Ave/);
  assert.match(data.contact.mapEmbed, /output=embed/);
  assert.equal(data.media.gallery.length, 2);
  assert.equal(data.testimonials[0].name, "Sam K.");
  assert.equal(data.faq[0].a, "Yes, most PPO plans.");
  assert.ok(data.social.instagram && data.social.linkedin);
});

test("parses Google Maps links", () => {
  const info = parseMapUrl("https://www.google.com/maps/place/Eiffel+Tower/@48.85,2.29,17z/data=!3d48.8583701!4d2.2944813");
  assert.equal(info.placeName, "Eiffel Tower");
  assert.equal(info.lat, 48.8583701);
  assert.match(buildEmbedUrl(parseMapUrl("12.97, 77.59")), /q=12\.97%2C77\.59/);
  assert.equal(parseMapUrl('<iframe src="https://www.google.com/maps/embed?pb=xyz"></iframe>').embedUrl, "https://www.google.com/maps/embed?pb=xyz");
});
