const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
const AV = 'https://picsum.photos/seed/shen/300/300';

const sbar = `<div class="lzw-sbar"><span class="lzw-clock">21:47</span><span class="lzw-island"></span><span class="lzw-sicons"><span class="lzw-sig"><i></i><i></i><i></i><i></i></span></span></div>`;
const screenBg = `<img class="lzw-callfeed" src="${AV}"><div class="lzw-callshade"></div>`;

function phone(inner, cls, bg) {
  return `<div class="lzw-bezel"><div class="lzw-btn-side lzw-btn-vol1"></div><div class="lzw-btn-side lzw-btn-vol2"></div><div class="lzw-btn-side lzw-btn-act"></div><div class="lzw-btn-side lzw-btn-pow"></div><div class="lzw-screen ${cls || ''}">${bg || ''}${sbar}${inner}<div class="lzw-homebar"></div></div></div>`;
}

// A: 通话中（音频，整屏头像模糊背景）
const subsA = `<div class="lzw-sub">沈锡元：到了吱一声，我去接你</div><div class="lzw-sub me">李晓：不用，我自己过去</div><div class="lzw-sub">沈锡元：那行，路上小心</div>`;
const btnsA = `<div class="lzw-callmid"><button class="lzw-callbtn"><i>&#127908;</i><span>说话</span></button><button class="lzw-callbtn hang"><i>&#9742;</i><span>挂断</span></button></div>`;
const callA = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">03:24</div></div><div class="lzw-callsubs">${subsA}</div>${btnsA}</div>`;

// B: 说话弹窗（灰黑半透明，无标题行）
const popB = `<div class="lzw-scrim"><div class="lzw-confirm lzw-callpop"><textarea class="lzw-callta" rows="4">我跟陆飞对一下明天要交的东西，可能会晚到十分钟，你先吃。</textarea><div class="lzw-cbtns"><button class="lzw-cbtn no">取消</button><button class="lzw-cbtn yes">发送</button></div></div></div>`;
const callB = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">04:01</div></div><div class="lzw-callsubs">${subsA}</div>${btnsA}${popB}</div>`;

// C: 呼叫中（ringing）
const callC = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">许嘉文</div><div class="lzw-callstatus">正在呼叫…</div></div><div class="lzw-callsubs"></div><div class="lzw-cwait">等待对方接听…</div><div class="lzw-callmid" style="justify-content:center"><button class="lzw-callbtn hang"><i>&#9742;</i><span>取消</span></button></div></div>`;

// D: 通话字幕删除确认（右键/长按触发，深色弹窗，与聊天白弹窗同交互）
const delD = `<div class="lzw-scrim"><div class="lzw-confirm lzw-calldel">删除这条通话对白？<div class="lzw-cbtns"><button class="lzw-cbtn no">取消</button><button class="lzw-cbtn yes">删除</button></div></div></div>`;
const callD = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">05:40</div></div><div class="lzw-callsubs">${subsA}</div>${btnsA}${delD}</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#333;font-family:system-ui,"Microsoft YaHei",sans-serif;display:flex;gap:24px;padding:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap}</style><style>${css}</style><style>.lzw-bezel{width:320px;height:640px;box-sizing:content-box;flex:none}</style></head><body>${phone(callA, 'lzw-scr-call', screenBg)}${phone(callB, 'lzw-scr-call', screenBg)}${phone(callC, 'lzw-scr-call', screenBg)}${phone(callD, 'lzw-scr-call', screenBg)}</body></html>`;
fs.writeFileSync(__dirname + '/sbv-call3.html', html);
console.log('written sbv-call3.html');
