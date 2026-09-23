const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
const icons = fs.readFileSync(__dirname + '//../src/apps/wechat.js', 'utf8');
const grab = (name) => icons.match(new RegExp("var " + name + " = '([^']*)'"))[1];
const back = grab('ICON_BACK'), wifi = grab('ICON_WIFI'), batt = icons.match(/var ICON_BATT = '([^']*)'/)[1];

// 背景放一台半透明的手机示意弹窗浮在页面上层
const sbar =
  "<div class='lzw-sbar'><span class='lzw-clock'>15:47</span><span class='lzw-island'></span>" +
  "<span class='lzw-sicons'><span class='lzw-sig'><i></i><i></i><i></i><i></i></span>" + wifi + batt + "</span></div>";
const phone =
  "<div class='phone' style='opacity:.35'><div class='lzw-screen lzw-scr-home'>" + sbar +
  "<div class='lzw-body'><div class='lzw-home-wall'>" +
  "<div class='lzw-hometime'><div class='t'>15:47</div><div class='d'>9月12日 星期六</div></div>" +
  "<div class='lzw-homegrid'><div class='lzw-app'><div class='lzw-app-ico' style='background:#22c05e;border:none'>微信</div><span>微信</span></div></div>" +
  "</div></div><div class='lzw-homebar'></div></div></div>";

const tg = (cls, t) => "<span class='lzw-ltag " + cls + "'>" + t + "</span>";
const row = (name, tags, ico, dis) =>
  "<div class='lzw-conv lzw-linerow" + (dis ? ' lzw-linedis' : '') + "'>" +
  "<div class='lzw-ava lzw-lineava'>" + ico + "</div>" +
  "<div class='lzw-conv-main'><div class='lzw-conv-name'>" + name + "</div>" +
  "<div class='lzw-ltags'>" + tags + "</div></div></div>";

const rowsA =
  row('成人时代-破镜重圆', tg('', '开关·关'), '📱') +
  row('成人时代-同路而行', tg('', '开关·关'), '📱') +
  row('高中时代', tg('rec', '此聊天') + tg('', '开关·开'), '📱') +
  row('大学时代', tg('cur', '当前') + tg('', '开关·开'), '📱') +
  row('古代架空-华胥之梦', tg('', '开关·关') + tg('bad', '无手机'), '🏮');
const rowsB =
  row('成人时代-破镜重圆', tg('', '开关·关'), '📱') +
  row('成人时代-同路而行', tg('', '开关·关'), '📱') +
  row('高中时代', tg('', '开关·关'), '📱') +
  row('大学时代', tg('', '开关·关'), '📱') +
  row('古代架空-华胥之梦', tg('bad', '条目未找到') + tg('bad', '无手机'), '🏮', true);

const pop = (rows) =>
  "<div id='lzw-linespop' style='position:absolute;inset:0;display:flex;align-items:center;justify-content:center'>" +
  "<div class='lzw-lpop-card'>" +
  "<div class='lzw-lpop-head'><span class='lzw-lpop-t'>世界线</span><span class='lzw-lpop-x'>×</span></div>" +
  "<div class='lzw-lpop-list'>" + rows + "</div>" +
  "<div class='lzw-lpop-foot'>点一条线 = 代劳开关世界书条目<br>并记入本聊天记录（手动开关从此不认）</div>" +
  "</div></div>";

const stage = (rows) =>
  "<div style='position:relative;width:360px;height:640px;background:#3a3f45;border-radius:12px;overflow:hidden'>" +
  "<div style='position:absolute;left:20px;top:0'>" + phone + "</div>" + pop(rows) + "</div>";

const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>" +
  "body{background:#22252a;display:flex;gap:24px;padding:20px;font-family:system-ui,margin:0}" +
  ".phone{width:320px;height:640px;background:#0b0d10;border-radius:48px;padding:11px;box-sizing:border-box}" +
  css + "</style></head><body>" + stage(rowsA) + stage(rowsB) + "</body></html>";
fs.writeFileSync(__dirname + '/_lines-preview.html', html);
console.log('written');
