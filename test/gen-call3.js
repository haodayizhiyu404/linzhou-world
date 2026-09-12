const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
const AV = 'https://picsum.photos/seed/shen/300/300';
const ROLL = '<svg width="18" height="18" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 85.333333c102.869333 0 199.509333 36.693333 275.029333 100.437334l93.866667-94.037334a21.333333 21.333333 0 0 1 36.437333 15.061334V384a21.333333 21.333333 0 0 1-21.333333 21.333333h-276.693333a21.333333 21.333333 0 0 1-15.104-36.394666l122.325333-122.496a341.333333 341.333333 0 1 0 118.314667 341.333333h120.832A460.8 460.8 0 1 1 512 85.333333z"/></svg>';

const sbar = `<div class="lzw-sbar"><span class="lzw-clock">21:47</span><span class="lzw-island"></span><span class="lzw-sicons"><span class="lzw-sig"><i></i><i></i><i></i><i></i></span></span></div>`;
const screenBg = `<img class="lzw-callfeed" src="${AV}"><div class="lzw-callshade"></div>`;

function phone(inner, cls, bg) {
  return `<div class="lzw-bezel"><div class="lzw-btn-side lzw-btn-vol1"></div><div class="lzw-btn-side lzw-btn-vol2"></div><div class="lzw-btn-side lzw-btn-act"></div><div class="lzw-btn-side lzw-btn-pow"></div><div class="lzw-screen ${cls || ''}">${bg || ''}${sbar}${inner}<div class="lzw-homebar"></div></div></div>`;
}

// A: 语音通话中（音频，整屏头像模糊背景）
const subsA = Array.from({length:12},(_,i)=>i%2? `<div class="lzw-sub me">第${i}句，我在测试滚动</div>` : `<div class="lzw-sub">第${i}句，你在测试滚动</div>`).join('');
const btnsA = `<div class="lzw-callmid"><button class="lzw-callbtn"><i>&#127908;</i><span>说话</span></button><button class="lzw-callbtn hang"><i>&#9742;</i><span>挂断</span></button></div>`;
const callA = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">03:24</div></div><div class="lzw-callsubs">${subsA}</div>${btnsA}</div>`;

// E: 视频通话中——画面清晰全屏当镜头，右上 PiP 自视窗，画面描述字幕叠在镜头上
const subsE = Array.from({length:6},(_,i)=>i%2? `<div class="lzw-sub me">那明天老时间？</div>` : `<div class="lzw-sub">行，楼下等你。</div>`).join('');
const sceneE = `<div class="lzw-callscene">画面里他刚冲完澡，头发还湿着，<br>顺手抄起手机按了接听。</div>`;
const callE = `<div class="lzw-callbody"><span class="lzw-callroll">${ROLL}</span><div class="lzw-callpip">裴</div><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">01:12</div></div>${sceneE}<div class="lzw-callsubs">${subsE}</div>${btnsA}</div>`;

// B: 说话弹窗（灰黑半透明，无标题行）
const popB = `<div class="lzw-scrim"><div class="lzw-confirm lzw-callpop"><textarea class="lzw-callta" rows="4">我跟陆飞对一下明天要交的东西，可能会晚到十分钟，你先吃。</textarea><div class="lzw-cbtns"><button class="lzw-cbtn no">取消</button><button class="lzw-cbtn yes">发送</button></div></div></div>`;
const callB = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">04:01</div></div><div class="lzw-callsubs">${subsA}</div>${btnsA}${popB}</div>`;

// C: 呼叫中（ringing）
const callC = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">许嘉文</div><div class="lzw-callstatus">正在呼叫…</div></div><div class="lzw-callsubs"></div><div class="lzw-cwait">等待对方接听…</div><div class="lzw-callmid" style="justify-content:center"><button class="lzw-callbtn hang"><i>&#9742;</i><span>取消</span></button></div></div>`;

// D: 通话字幕删除确认（右键/长按触发，深色弹窗，与聊天白弹窗同交互）
const delD = `<div class="lzw-scrim"><div class="lzw-confirm lzw-calldel">删除这条通话对白？<div class="lzw-cbtns"><button class="lzw-cbtn no">取消</button><button class="lzw-cbtn yes">删除</button></div></div></div>`;
const callD = `<div class="lzw-callbody"><div class="lzw-calltop"><div class="lzw-callava"><img src="${AV}"></div><div class="lzw-callname">沈锡元</div><div class="lzw-callstatus">05:40</div></div><div class="lzw-callsubs">${subsA}</div>${btnsA}${delD}</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#333;font-family:system-ui,"Microsoft YaHei",sans-serif;display:flex;gap:24px;padding:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap}</style><style>${css}</style><style>.lzw-bezel{width:320px;height:640px;box-sizing:content-box;flex:none}</style></head><body>${phone(callA, 'lzw-scr-call', screenBg)}${phone(callE, 'lzw-scr-call lzw-scr-video', screenBg)}${phone(callB, 'lzw-scr-call', screenBg)}${phone(callC, 'lzw-scr-call', screenBg)}${phone(callD, 'lzw-scr-call', screenBg)}</body></html>`;
fs.writeFileSync(__dirname + '/sbv-call3.html', html);
console.log('written sbv-call3.html');
