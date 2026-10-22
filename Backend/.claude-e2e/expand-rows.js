// One-off: split grouped TODO rows of the report into one row per bug (descriptions from foodrows.txt).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '..', 'docs', 'FOODIE_FOOD_BUG_REPORT.md');
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => {
  const [n, app, mod, bug] = l.split(' | ');
  return { n: Number(n), app: app.trim(), bug: `${mod.trim()}: ${bug.trim()}`.replace(/\|/g, '/').slice(0, 110) };
});
const byN = new Map(rows.map((r) => [r.n, r]));
const groups = {
  '39–42': [39, 40, 41, 42], '47–49': [47, 48, 49], '51, 52': [51, 52], '65–72': [65, 66, 67, 68, 69, 70, 71, 72],
  '73–77, 79, 80': [73, 74, 75, 76, 77, 79, 80], '81, 82': [81, 82], '90, 91': [90, 91], '96–98': [96, 97, 98], '100–107': [100, 101, 102, 103, 104, 105, 106, 107],
};
let md = fs.readFileSync(file, 'utf8');
for (const [key, nums] of Object.entries(groups)) {
  const re = new RegExp(`^\\| ${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\|[^\\n]*$`, 'm');
  const m = md.match(re);
  if (!m) { console.log('group not found', key); continue; }
  const note = m[0].split(' | ')[4].replace(/ \|$/, '');
  const lines = nums.map((n) => `| ${n} | ${byN.get(n)?.app || ''} | ${byN.get(n)?.bug || ''} | TODO | ${note} |`);
  md = md.replace(m[0], lines.join('\n'));
  console.log('expanded', key);
}
fs.writeFileSync(file, md);
