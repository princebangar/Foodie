// Detect binary files damaged by LF -> CRLF conversion (every 0x0A preceded by 0x0D).
// Usage: node crlfscan.js <root>
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const bin = /\.(png|jpe?g|webp|gif|ico|avif|mp3|mp4|wav|ogg|woff2?|ttf|otf|eot|pdf|zip)$/i;
function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc); else if (bin.test(e.name)) acc.push(p);
  }
  return acc;
}
let bad = 0, ok = 0;
for (const f of walk(root, [])) {
  const b = fs.readFileSync(f);
  let crlf = 0, bare = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === 0x0a) { if (i > 0 && b[i - 1] === 0x0d) crlf++; else bare++; }
  const damaged = bare === 0 && crlf > 0;
  if (damaged) { bad++; console.log('DAMAGED', path.relative(root, f), 'crlf=' + crlf); } else ok++;
}
console.log('damaged', bad, 'ok', ok);
