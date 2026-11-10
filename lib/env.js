// Load settings from ./.env (if present) before any other module reads process.env.
// Real environment variables win over the file. Import this first.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(dir, ".env");
export const envInfo = { file, found: false, keys: [], hint: "" };
if (fs.existsSync(file)) {
  envInfo.found = true;
  // strip a UTF-8 BOM (Windows Notepad adds one) so the first line still works
  for (const raw of fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, "");
    if (val) envInfo.keys.push(m[1]);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
else if (fs.existsSync(file + ".txt")) envInfo.hint = "Found “.env.txt” – rename it to “.env” (Notepad added .txt).";
else envInfo.hint = "No .env file found next to server.js – copy .env.example to .env and fill it in.";
