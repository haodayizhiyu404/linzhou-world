const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
// 只保留滚动条相关规则
const sbRules = css.split('\n').filter(l => l.indexOf('scrollbar') !== -1).join('\n');
const inner =
  '<div class="lzw-screen" style="width:300px;height:500px;background:#f7f7f9;overflow:hidden">' +
  '<div class="lzw-chatbg" style="height:100%;overflow-y:auto">' +
  Array.from({ length: 40 }, (_, i) => '<div class="lzw-chatrow"><div class="lzw-ava">周</div><div class="lzw-bub">第' + i + '条测试消息</div></div>').join('') +
  '</div></div>';
const mk = (rules) => "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>" +
  "body{background:#fff;display:flex;gap:40px;padding:20px;margin:0}" +
  ".lzw-chatrow{display:flex;gap:7px;margin:11px 12px}" +
  ".lzw-ava{width:34px;height:34px;border-radius:9px;flex:none;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13.5px}" +
  ".lzw-bub{max-width:62%;padding:8px 11px;border-radius:9px;background:#fff;color:#111;line-height:1.45;font-size:13.5px;word-break:break-word}" +
  rules + "</style></head><body>" + inner + inner + "</body></html>";
// 左：旧插件式（不碰 button）；右：当前全套（含 button 显式隐藏）
const oldRules = "::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.1);border-radius:3px}";
fs.writeFileSync(__dirname + '/sb-ab.html', mk(oldRules) + '<!--SPLIT-->' + '');
fs.writeFileSync(__dirname + '/sb-ab-old.html', mk(oldRules));
fs.writeFileSync(__dirname + '/sb-ab-new.html', mk(sbRules));
console.log('written; new rules =', sbRules.length, 'chars');
