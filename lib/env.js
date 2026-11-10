// Load settings from ./.env (if present) before any other module reads process.env.
// Real environment variables win over the file. Import this first.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (fs.existsSync(file)) {
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
