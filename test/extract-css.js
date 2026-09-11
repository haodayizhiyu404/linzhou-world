const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/apps/wechat.js', 'utf8');
const m = src.match(/var CSS = \[([\s\S]*?)\];/);
if (!m) { console.error('CSS block not found'); process.exit(1); }
const rules = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\'/g, "'"));
fs.writeFileSync(__dirname + '/_css.txt', rules.join('\n'));
console.log('extracted', rules.length, 'rules');
