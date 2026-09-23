const fs = require('fs');
// 每个变体一列，滚动条规则逐渐加回，找出画三角的元凶
const variants = [
  ['v1-width5', '::-webkit-scrollbar{width:5px}'],
  ['v2-width6', '::-webkit-scrollbar{width:6px}'],
  ['v3-w6-track', '::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}'],
  ['v4-w6-thumb', '::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.1);border-radius:3px}'],
  ['v5-w5-full', '::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.26)}'],
  ['v6-w5-nohover', '::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}'],
];
const mkCol = (name, rules) =>
  '<div class="wrap"><div class="tag">' + name + '</div><div class="lzw-screen" style="width:280px;height:460px;background:#f7f7f9;overflow:hidden">' +
  '<div class="lzw-chatbg" style="height:100%;overflow-y:auto">' +
  Array.from({ length: 40 }, (_, i) => '<div class="lzw-chatrow"><div class="lzw-ava">周</div><div class="lzw-bub">第' + i + '条测试消息</div></div>').join('') +
  '</div></div></div>';
const cols = variants.map(v => mkCol(v[0], v[1])).join('');
const styles = variants.map(v => '.t-' + v[0] + ' ' + v[1]).join('\n');
// 每个变体包一层 class，规则限定作用域
const scoped = variants.map(v =>
  '<style>.s-' + v[0] + ' ' + v[1].replace(/}\s*::/g, '}\n.s-' + v[0] + ' ::') + '</style>'
).join('\n');
const cols2 = variants.map(v =>
  '<div class="s-' + v[0] + '"><div class="tag">' + v[0] + '</div>' +
  '<div style="width:280px;height:460px;background:#f7f7f9;overflow:hidden">' +
  '<div class="lzw-chatbg" style="height:100%;overflow-y:auto">' +
  Array.from({ length: 40 }, (_, i) => '<div class="lzw-chatrow"><div class="lzw-ava">周</div><div class="lzw-bub">第' + i + '条</div></div>').join('') +
  '</div></div></div>'
).join('');
const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
  "<style>body{background:#fff;display:flex;gap:30px;padding:16px;margin:0;font-family:monospace}" +
  ".tag{font-size:13px;margin-bottom:4px;color:#c00}" +
  ".lzw-chatrow{display:flex;gap:7px;margin:11px 12px}" +
  ".lzw-ava{width:34px;height:34px;border-radius:9px;flex:none;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13.5px}" +
  ".lzw-bub{max-width:62%;padding:8px 11px;border-radius:9px;background:#eee;color:#111;line-height:1.45;font-size:13.5px}</style>" +
  scoped + "</head><body>" + cols2 + "</body></html>";
fs.writeFileSync(__dirname + '/sb-bisect.html', html);
console.log('written');
