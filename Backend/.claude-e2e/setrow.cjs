// usage: node setrow.cjs <row> "<status>" "<note>"
const fs=require('fs');const p='C:/Users/Prince/Prince Bangar/Coding/Foodie/docs/FOODIE_FOOD_BUG_REPORT.md';
const raw=fs.readFileSync(p,'utf8');const crlf=raw.includes('\r\n');const lines=raw.replace(/\r\n/g,'\n').split('\n');
const [row,status,note]=process.argv.slice(2);
const i=lines.findIndex(l=>l.startsWith(`| ${row} |`));if(i<0)throw new Error('row not found '+row);
const c=lines[i].split(' | ');// ['| n','App','Bug','Status','Note |']
const head=c.slice(0,3).join(' | ');
lines[i]=`${head} | ${status} | ${note} |`;
fs.writeFileSync(p,(crlf?lines.join('\r\n'):lines.join('\n')));
