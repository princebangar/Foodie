// Repair UTF-8 text that was decoded as Windows-1252 and saved again ("â€¢" -> "•").
// Usage: node mojibake.js <dir> [--apply]
const fs = require('fs'), path = require('path');
const [dir, applyFlag] = process.argv.slice(2);
const apply = applyFlag === '--apply';
const cp1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
const toByte = (ch) => { const c = ch.codePointAt(0); if (c < 0x100) return c; return cp1252[c] ?? null; };
const cont = '\\u0080-\\u00BF\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178';
const re = new RegExp(`[\\u00C2-\\u00F4][${cont}]{1,3}`, 'g');
function fix(s) {
  let n = 0;
  const out = s.replace(re, (m) => {
    const bytes = [...m].map(toByte);
    if (bytes.some((b) => b === null)) return m;
    const lead = bytes[0];
    const need = lead >= 0xF0 ? 4 : lead >= 0xE0 ? 3 : 2;
    if (bytes.length < need) return m;
    const use = bytes.slice(0, need);
    let dec;
    try { dec = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(use)); } catch { return m; }
    n++;
    return dec + m.slice([...m].slice(0, need).join('').length);
  });
  return { out, n };
}
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', 'dist', '.git'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.(jsx?|tsx?|css|html|md)$/.test(e.name)) acc.push(p); } return acc; }
let total = 0;
for (const f of walk(dir, [])) {
  let s = fs.readFileSync(f, 'utf8');
  // run twice for double-encoded text
  let { out, n } = fix(s); const r2 = fix(out); out = r2.out; n += r2.n;
  if (n) { total += n; console.log(n.toString().padStart(4), path.relative(dir, f)); if (apply) fs.writeFileSync(f, out); }
}
console.log('total', total);
