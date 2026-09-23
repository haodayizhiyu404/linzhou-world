const fs = require('fs');
const variants = [
  ['v1', '::-webkit-scrollbar{width:5px}'],
  ['v2', '::-webkit-scrollbar{width:6px}'],
  ['v3', '::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}'],
  ['v4', '::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.1);border-radius:3px}'],
  ['v5', '::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.26)}'],
  ['v6', '::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}'],
];
variants.forEach(v => {
  const rows = Array.from({ length: 40 }, (_, i) => '<div class="lzw-chatrow"><div class="lzw-ava">周</div><div class="lzw-bub">第' + i + '条</div></div>').join('');
  const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>" +
    "body{background:#fff;margin:0;padding:0}" +
    ".lzw-chatrow{display:flex;gap:7px;margin:11px 12px}" +
    ".lzw-ava{width:34px;height:34px;border-radius:9px;flex:none;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13.5px}" +
    ".lzw-bub{max-width:62%;padding:8px 11px;border-radius:9px;background:#eee;color:#111;line-height:1.45;font-size:13.5px}" +
    v[1] + "</style></head><body>" +
    "<div style='width:280px;height:520px;background:#f7f7f9;overflow:hidden;margin:0'>" +
    "<div class='lzw-chatbg' style='height:100%;overflow-y:auto'>" + rows + "</div></div>" +
    "</body></html>";
  fs.writeFileSync(__dirname + '/sbv-' + v[0] + '.html', html);
});
console.log('written 6 files');
