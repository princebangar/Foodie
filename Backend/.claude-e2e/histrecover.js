// Recover CRLF-damaged binaries from the git history of another clone of the same base project.
// A historic blob is accepted only if normalising its CR/LF bytes to CRLF (plus the trailing CRLF the
// damaging tool appended) reproduces the damaged file byte-for-byte (proof that it is the exact original of the same file).
// Usage: node histrecover.js <damagedFrontendRoot> <otherRepoRoot> <outDir>
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [damagedRoot, repo, outDir] = process.argv.slice(2);
const bin = /\.(png|jpe?g|webp|gif|ico|mp3|mp4|wav)$/i;
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'dist'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (bin.test(e.name)) acc.push(p); } return acc; }
function damaged(b) { let crlf = 0, bare = 0; for (let i = 0; i < b.length; i++) if (b[i] === 10) { if (i > 0 && b[i - 1] === 13) crlf++; else bare++; } return bare === 0 && crlf > 0; }
function toCrlf(b) { const out = Buffer.alloc(b.length * 2); let j = 0; for (let i = 0; i < b.length; i++) { if (b[i] === 13) { out[j++] = 13; out[j++] = 10; if (b[i + 1] === 10) i++; } else if (b[i] === 10) { out[j++] = 13; out[j++] = 10; } else out[j++] = b[i]; } return out.slice(0, j); }
const git = (args, opts = {}) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 1 << 30, ...opts });

// Index every blob in the other repo's history by file name (lower-case).
const byName = new Map();
const revs = git(['rev-list', '--all', '--objects']).toString().split('\n');
for (const line of revs) {
  const sp = line.indexOf(' '); if (sp < 0) continue;
  const sha = line.slice(0, sp), p = line.slice(sp + 1); if (!bin.test(p)) continue;
  const k = path.basename(p).toLowerCase(); if (!byName.has(k)) byName.set(k, new Set()); byName.get(k).add(sha);
}
let ok = 0, miss = 0;
for (const f of walk(damagedRoot, [])) {
  const b = fs.readFileSync(f); if (!damaged(b)) continue;
  const rel = path.relative(damagedRoot, f);
  let hit = null;
  for (const sha of byName.get(path.basename(f).toLowerCase()) || []) {
    const blob = git(['cat-file', 'blob', sha]);
    if (damaged(blob)) continue;
    const conv = toCrlf(blob); if (conv.equals(b) || Buffer.concat([conv, Buffer.from([13, 10])]).equals(b)) { hit = { sha, blob }; break; }
  }
  if (hit) { ok++; console.log('RECOVERED ' + rel + '  (blob ' + hit.sha.slice(0, 10) + ', ' + b.length + ' -> ' + hit.blob.length + ' bytes)'); const o = path.join(outDir, rel); fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, hit.blob); }
  else { miss++; console.log('NOT FOUND ' + rel); }
}
console.log('recovered', ok, 'not found', miss);
