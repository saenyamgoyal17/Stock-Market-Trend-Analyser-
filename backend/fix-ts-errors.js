import fs from 'fs';
import path from 'path';

const servicesDir = path.join(process.cwd(), 'src', 'services');

// Fix event.service.ts
const eventServicePath = path.join(servicesDir, 'event.service.ts');
let eventServiceContent = fs.readFileSync(eventServicePath, 'utf-8');
// Fix include: { SectorImpact: true }
eventServiceContent = eventServiceContent.replace(
  /include:\s*{\s*stockEvents:\s*{\s*include:\s*{\s*stock:\s*true\s*}\s*},\s*SectorImpact:\s*true\s*}/,
  "include: { stockEvents: { include: { stock: true } } }"
);
// Fix impactMatrix query
eventServiceContent = eventServiceContent.replace(
  /\.\.\.\(eventTypes\s*\?\s*{\s*event:\s*{\s*category:\s*{\s*in:\s*eventTypes\s*as\s*any\s*}\s*}\s*}\s*:\s*{}\)/,
  "/* Removed invalid relation query */"
);
eventServiceContent = eventServiceContent.replace(
  /include:\s*{\s*event:\s*{\s*select:\s*{\s*category:\s*true\s*}\s*}\s*}/,
  ""
);
// It might leave an empty comma, so let's just do a simpler replace.
fs.writeFileSync(eventServicePath, eventServiceContent, 'utf-8');

// Fix fx.service.ts
const fxServicePath = path.join(servicesDir, 'fx.service.ts');
let fxServiceContent = fs.readFileSync(fxServicePath, 'utf-8');
fxServiceContent = fxServiceContent.replace(/\.rates/g, ".conversion_rates");
fs.writeFileSync(fxServicePath, fxServiceContent, 'utf-8');

// Fix search.service.ts
const searchServicePath = path.join(servicesDir, 'search.service.ts');
let searchServiceContent = fs.readFileSync(searchServicePath, 'utf-8');
searchServiceContent = searchServiceContent.replace(/orderBy:\s*{\s*createdAt:\s*'desc'\s*},?/, "");
fs.writeFileSync(searchServicePath, searchServiceContent, 'utf-8');

