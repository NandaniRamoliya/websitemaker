// Re-apply the site doctor (and fill missing editor fields) for every saved demo in ./sites. Safe to run repeatedly.
// Usage: node scripts/heal-sites.mjs
import fs from "node:fs";
import path from "node:path";
import { heal } from "../lib/siteDoctor.js";
import { completeData } from "../lib/complete.js";
import { SITES_DIR } from "../lib/autobuild.js";

for (const dir of fs.existsSync(SITES_DIR) ? fs.readdirSync(SITES_DIR) : []) {
  const file = path.join(SITES_DIR, dir, "index.html");
  if (!fs.existsSync(file)) continue;
  const dataFile = path.join(SITES_DIR, dir, "data.json");
  const data = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, "utf8")) : {};
  const html = heal(fs.readFileSync(file, "utf8"), data);
  fs.writeFileSync(file, html);
  if (data.brand) fs.writeFileSync(dataFile, JSON.stringify(completeData(data, html), null, 1)); // fill editor fields

  console.log("healed", dir);
}
