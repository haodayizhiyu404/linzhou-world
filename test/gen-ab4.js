const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
const sbRules = css.split('\n').filter(l => l.indexOf('scrollbar') !== -1).join('\n');
console.log('rules:\n' + sbRules);
const rows = Array.from({ length: 40 }, (_, i) => '<div class="lzw-chatrow"><div class="lzw-ava">周</div><div class="lzw-bub">第' + i + '条</div></div>').join('');
const mk = (extra, scoped) => "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>" +
  "body{background:#fff;margin:0;padding:0}" +
  ".lzw-chatrow{display:flex;gap:7px;margin:11px 12px}" +
  ".lzw-ava{width:34px;height:34px;border-radius:9px;flex:none;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13.5px}" +
  ".lzw-bub{max-width:62%;padding:8px 11px;border-radius:9px;background:#eee;color:#111;line-height:1.45;font-size:13.5px}" +
  extra + "</style></head><body>" +
  "<div class='" + (scoped ? "lzw-screen" : "") + "' style='width:280px;height:520px;background:#f7f7f9;overflow:hidden;margin:0'>" +
  "<div class='lzw-chatbg' style='height:100%;overflow-y:auto'>" + rows + "</div></div>" +
  "</body></html>";
fs.writeFileSync(__dirname + '/sbv-scoped.html', mk(sbRules, true));
fs.writeFileSync(__dirname + '/sbv-unscoped.html', mk(sbRules.replace(/\.lzw-screen /g, ''), false));
console.log('written scoped + unscoped');
