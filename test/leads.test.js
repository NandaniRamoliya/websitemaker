import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, leadsFromRows, leadToBrandData, cleanName } from "../lib/leads.js";
import { detectCategory, pickLook } from "../lib/categories.js";
import { polishHtml } from "../lib/autobuild.js";

const CSV = `Business Name,Phone Number,Has Website,Website URL,Social Profile URL,Google Rating,Reviews Count,Full Address,Google Maps URL
"Glow Salon || Best Salon In Surat | Balayage",9876543210,No,N/A,"Locality: Vesu | Specialty: salon services & price list",4.8,"1,066","G-1, Orbit, Vesu, Surat, Gujarat 395007",https://www.google.com/maps/place/Glow+Salon/data=!3m6!8m2!3d21.15!4d72.79!19sChIJabc123
"𝐒𝐚𝐭𝐲𝐚𝐦 𝐃𝐞𝐧𝐭𝐚𝐥 𝐂𝐚𝐫𝐞",2612555800,Yes,https://x.example,"Specialty: treatment timings",4.9,10,"Adajan, Surat",`;

test("reads a leads sheet and maps columns", () => {
  const { leads, columns } = leadsFromRows(parseCsv(CSV));
  assert.equal(columns.maps, "Google Maps URL");
  assert.equal(leads.length, 2);
  assert.equal(leads[0].name, "Glow Salon");
  assert.equal(leads[0].category, "salon");
  assert.equal(leads[0].locality, "Vesu");
  assert.equal(leads[0].hasWebsite, false);
  assert.equal(leads[1].name, "Satyam Dental Care");
  assert.equal(leads[1].category, "dental");
});

test("turns a lead into website facts", () => {
  const { leads } = leadsFromRows(parseCsv(CSV));
  const d = leadToBrandData(leads[0]);
  assert.equal(d.contact.whatsapp, "+919876543210");
  assert.equal(d.contact.phone, "+91 98765 43210");
  assert.equal(d.meta.placeId, "ChIJabc123");
  assert.match(d.contact.mapEmbed, /output=embed/);
  assert.ok(d.media.hero.startsWith("https://images.unsplash.com/"));
  assert.equal(leadToBrandData(leads[1]).contact.whatsapp, ""); // landline → no WhatsApp
});

test("names, categories and varied looks", () => {
  assert.deepEqual(cleanName("Hair Factory || Best Salon | Balayage Expert"), { name: "Hair Factory", keywords: "Best Salon, Balayage Expert" });
  assert.equal(detectCategory("treatment timings & consultation bookings", "", "Sumukh Dental Clinic"), "dental");
  const looks = new Set(["A Spa", "B Spa", "C Spa", "D Spa", "E Spa"].map((n) => pickLook("spa", n).style));
  assert.ok(looks.size > 1, "different businesses should get different looks");
});

test("polishHtml adds missing WhatsApp + map", () => {
  const { html, fixes } = polishHtml("<html><head></head><body><footer></footer></body></html>", { contact: { whatsapp: "+919876543210", mapEmbed: "https://maps.google.com/maps?q=x&output=embed" } });
  assert.deepEqual(fixes, ["WhatsApp button", "map"]);
  assert.match(html, /wa\.me\/919876543210/);
  assert.match(html, /<iframe[^>]+maps/);
});
