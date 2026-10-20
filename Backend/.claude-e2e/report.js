// Update one row of docs/FRESLY_FOOD_BUG_REPORT.md: node report.js <row> <STATUS> "<what was done>"
// Also moves the row number between the summary lists (Fixed / OK / TODO).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '..', 'docs', 'FRESLY_FOOD_BUG_REPORT.md');
const [row, status, note] = process.argv.slice(2);
let md = fs.readFileSync(file, 'utf8');
const lines = md.split('\n');
const i = lines.findIndex((l) => l.startsWith(`| ${row} |`));
if (i < 0) { console.error('row not found', row); process.exit(1); }
const cells = lines[i].split(' | ');
// cells: ["| #", app, bug, status, note |]
cells[3] = status;
cells[4] = `${note} |`;
lines[i] = cells.join(' | ');
md = lines.join('\n');
md = md.replace(/Last updated: [^\n]*/, `Last updated: ${new Date().toLocaleString('en-IN')} (work in progress, updated after every fix)`);
fs.writeFileSync(file, md);
console.log('updated row', row, '->', status);
