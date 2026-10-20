// Usage: node graph2.js <frontendRoot>
const fs = require('fs'), path = require('path');
const root = process.argv[2] || process.cwd(), src = path.join(root, 'src');
const alias = [
  ['@food/api/axios', path.join(src, 'services/api/axios.js')],
  ['@food/api/config', path.join(src, 'services/api/config.js')],
  ['@food/api', path.join(src, 'services/api')],
  ['@food', path.join(src, 'modules/Food')],
  ['@delivery', path.join(src, 'modules/DeliveryV2')],
  ['@', src],
];
const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.json', '.css'];
function tryFile(p) {
  for (const e of exts) { const f = p + e; if (fs.existsSync(f) && fs.statSync(f).isFile()) return path.normalize(f); }
  for (const e of exts.slice(1)) { const f = path.join(p, 'index' + e); if (fs.existsSync(f)) return path.normalize(f); }
  return null;
}
function resolve(spec, from) {
  let base = null;
  for (const [a, t] of alias) { if (spec === a || spec.startsWith(a + '/')) { base = t + spec.slice(a.length); break; } }
  if (!base) { if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec); else return null; }
  return tryFile(decodeURIComponent(base.split('?')[0]));
}
const res = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]/g,
  /@import\s+(?:url\()?['"]([^'"]+)['"]/g,
  /new\s+URL\(\s*['"]([^'"]+)['"]/g,
];
const seen = new Set(); const stack = [path.normalize(path.join(src, 'index.jsx'))]; const missing = [];
while (stack.length) {
  const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
  if (!/\.(jsx?|tsx?|mjs|css)$/.test(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  for (const re of res) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(t))) {
      const s = m[1]; if (/^(https?:|data:)/.test(s)) continue;
      const r = resolve(s, f);
      if (r) stack.push(r);
      else if (s.startsWith('.') || s.startsWith('@/') || s.startsWith('@food') || s.startsWith('@delivery')) missing.push(path.relative(root, f) + ' -> ' + s);
    }
  }
}
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else acc.push(path.normalize(p)); } return acc; }
const all = walk(src, []);
const unreached = all.filter((f) => !seen.has(f));
console.log('reachable', seen.size, 'total', all.length, 'unreached', unreached.length);
console.log('\n== UNRESOLVED IMPORTS (in reachable files) ==');
console.log([...new Set(missing)].join('\n'));
console.log('\n== UNREACHED FILES ==');
console.log(unreached.map((f) => path.relative(root, f)).join('\n'));
