const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
const AV = 'https://picsum.photos/seed/shen/300/300';

const sbar = `<div class="lzw-sbar"><span class="lzw-clock">21:47</span><span class="lzw-island"></span><span class="lzw-sicons"><span class="lzw-sig"><i></i><i></i><i></i><i></i></span></span></div>`;

function phone(inner, cls) {
  return `<div class="lzw-bezel"><div class="lzw-btn-side lzw-btn-vol1"></div><div class="lzw-btn-side lzw-btn-vol2"></div><div class="lzw-btn-side lzw-btn-act"></div><div class="lzw-btn-side lzw-btn-pow"></div><div class="lzw-screen ${cls || ''}">${sbar}${inner}</div></div>`;
}

// A: 通话中（音频，头像模糊背景）
const feedA = `<img class="lzw-callfeed" src="${AV}"><div class="lzw-callshade"></div>`;
const subsA = `<div class="lzw-sub">沈锡元：到了吱一声，我去接你</div><div class="lzw-sub me">李晓：不用，我自己过去</div><div class="lzw-sub">沈锡元：那行，路上小心</div>`;
const callA = `<div class="lzw-callbody">${feedA}<span class="lzw-callroll">&#8635;</span><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">03:24</div></div><div class="lzw-callsubs">${subsA}</div><div class="lzw-callmid"><button class="lzw-callbtn"><i>&#127908;</i><span>说话</span></button><button class="lzw-callbtn hang"><i>&#9742;</i><span>挂断</span></button></div></div>`;

// B: 说话弹窗（深色加宽）
const callB = `<div class="lzw-callbody">${feedA}<div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">04:01</div></div><div class="lzw-callsubs">${subsA}</div><div class="lzw-callmid"><button class="lzw-callbtn"><i>&#127908;</i><span>说话</span></button><button class="lzw-callbtn hang"><i>&#9742;</i><span>挂断</span></button></div><div class="lzw-scrim"><div class="lzw-confirm lzw-callpop">你在通话里说：<textarea class="lzw-callta" rows="4">我跟陆飞对一下明天要交的东西，可能会晚到十分钟，你先吃。</textarea><div class="lzw-cbtns"><button class="lzw-cbtn no">取消</button><button class="lzw-cbtn yes">发送</button></div></div></div></div>`;

// C: 呼叫中（ringing）
const callC = `<div class="lzw-callbody">${feedA}<div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">许嘉文</div><div class="lzw-callstatus">正在呼叫…</div></div><div class="lzw-callsubs"></div><div class="lzw-cwait">等待对方接听…</div><div class="lzw-callmid" style="justify-content:center"><button class="lzw-callbtn hang"><i>&#9742;</i><span>取消</span></button></div></div>`;

// D: 聊天删除确认（修复后的白弹窗，应保持原样）
const chatD = `<div class="lzw-appbar"><span class="lzw-appt">沈锡元</span></div><div class="lzw-body"><div class="lzw-chat">chat msgs</div></div><div class="lzw-scrim"><div class="lzw-confirm">删除这条消息？<div class="lzw-cbtns"><button class="lzw-cbtn no">取消</button><button class="lzw-cbtn yes">删除</button></div></div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#333;font-family:system-ui,"Microsoft YaHei",sans-serif;display:flex;gap:24px;padding:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap}</style><style>${css}</style><style>.lzw-bezel{width:320px;height:640px;box-sizing:content-box;flex:none}</style></head><body>${phone(callA, 'lzw-scr-call')}${phone(callB, 'lzw-scr-call')}${phone(callC, 'lzw-scr-call')}${phone(chatD)}</body></html>`;
fs.writeFileSync(__dirname + '/sbv-call3.html', html);
console.log('written sbv-call3.html');
