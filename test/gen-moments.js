// 朋友圈三屏预览：发现页（红点）/ 朋友圈 feed（菜单+赞+评论+输入框）/ 周言个人主页
const fs = require('fs');
const css = fs.readFileSync(__dirname + '/_css.txt', 'utf8');
const AV = n => `https://picsum.photos/seed/${n}/200/200`;
const TAB_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.34-4.1-1L3 20l1.1-4.9A8.5 8.5 0 1 1 21 11.5z"/></svg>';
const TAB_DISC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/></svg>';
const MOM = '<svg viewBox="0 0 1024 1024"><path fill="#fff" d="M512 954.24A442.24 442.24 0 1 0 69.76 512 442.08 442.08 0 0 0 512 954.24z m0-30.88a401.12 401.12 0 0 1-137.12-21.92V621.6l274.24 276.64A356 356 0 0 1 512 923.36z m285.28-119.68a400 400 0 0 1-112 81.28L487.2 687.04l389.44 1.92a359.52 359.52 0 0 1-79.2 114.72z m118.24-289.28a400 400 0 0 1-21.92 136.96H613.76l276.8-273.92a355.04 355.04 0 0 1 25.12 136.96z m-232.8-368a355.68 355.68 0 0 1 114.56 79.04 402.88 402.88 0 0 1 81.44 112L680.96 535.52zM512 653.6A141.6 141.6 0 1 1 653.6 512 141.6 141.6 0 0 1 512 653.6z m0-548.32A400 400 0 0 1 649.12 128v280L375.04 130.4A356.32 356.32 0 0 1 512 105.28z m-285.28 119.84a405.44 405.44 0 0 1 112-81.44l198.4 198.08-389.44-2.08a355.68 355.68 0 0 1 79.04-114.56zM108.64 514.4a400 400 0 0 1 21.92-136.96h279.84L133.6 651.36a357.92 357.92 0 0 1-24.96-136.96z m234.72-21.12l-1.92 389.44a357.12 357.12 0 0 1-114.72-79.04 401.76 401.76 0 0 1-81.28-112z"/><path fill="#FC6B4F" d="M649.12 128A400 400 0 0 0 512 105.28a356.32 356.32 0 0 0-137.12 25.12l274.08 276.8z"/><path fill="#7838F2" d="M797.44 225.12a355.68 355.68 0 0 0-114.56-79.04l-1.92 389.44 197.92-198.08a402.88 402.88 0 0 0-81.44-112.32z"/><path fill="#5698F3" d="M893.76 651.36a400 400 0 0 0 21.92-136.96 355.04 355.04 0 0 0-25.12-136.96l-276.8 273.92z"/><path fill="#20E9F4" d="M685.12 884.96a400 400 0 0 0 112-81.28 359.52 359.52 0 0 0 79.2-114.72l-389.44-1.92z"/><path fill="#00FD60" d="M375.04 901.44A401.12 401.12 0 0 0 512 923.36a356 356 0 0 0 136.96-25.12L375.04 621.6z"/><path fill="#ABFB5B" d="M341.44 882.72l1.92-389.44L145.44 691.2a401.76 401.76 0 0 0 81.28 112 357.12 357.12 0 0 0 114.72 79.52z"/><path fill="#F0E254" d="M130.56 377.44a400 400 0 0 0-21.92 136.96 357.92 357.92 0 0 0 24.96 136.96l276.8-273.92z"/><path fill="#F6B351" d="M339.04 144a405.44 405.44 0 0 0-112 81.44 355.68 355.68 0 0 0-79.04 114.56l389.44 2.08z"/></svg>';
const CHEV = '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#c3c7cd" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5L6.5 7l-5 5.5"/></svg>';
const CAM = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#454545" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h2.2l1.6-2.4A1.5 1.5 0 0 1 9 5h6a1.5 1.5 0 0 1 1.2.6L17.8 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/></svg>';

const sbar = '<div class="lzw-sbar"><span class="lzw-clock">21:47</span><span class="lzw-island"></span><span class="lzw-sicons"><span class="lzw-sig"><i></i><i></i><i></i><i></i></span></span></div>';
const appbar = t => `<div class="lzw-appbar"><span class="lzw-back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></span><span class="lzw-appbar-t">${t}</span><span class="lzw-appbar-r"></span></div>`;
function phone(inner) {
  return `<div class="lzw-bezel"><div class="lzw-btn-side lzw-btn-vol1"></div><div class="lzw-btn-side lzw-btn-vol2"></div><div class="lzw-btn-side lzw-btn-act"></div><div class="lzw-btn-side lzw-btn-pow"></div><div class="lzw-screen">${sbar}${inner}<div class="lzw-homebar"></div></div></div>`;
}

// 发现页（tab 栏 + 朋友圈红点）
const discover = appbar('微信') + `<div class="lzw-body">
  <div class="lzw-disc-row"><div class="lzw-disc-ico">${MOM}</div><div class="lzw-disc-main"><div class="lzw-disc-name">朋友圈</div><div class="lzw-disc-prev">周言：月考成绩出了，还活着</div></div><span class="lzw-unread">2</span><span class="lzw-disc-chev">${CHEV}</span></div>
</div><div class="lzw-tabbar">
  <button class="lzw-tab">${TAB_CHAT}<span>微信</span></button>
  <button class="lzw-tab on">${TAB_DISC}<span>发现</span><span class="lzw-tabdot">2</span></button>
</div>`;

function post(ava, name, text, img, label, menu, like, cmts, cmtbar) {
  return `<div class="lzw-post">${ava}<div class="lzw-post-main">
    <div class="lzw-post-name">${name}</div>
    <div class="lzw-post-text">${text}</div>
    ${img ? `<div class="lzw-post-img">🖼 ${img}</div>` : ''}
    <div class="lzw-post-meta"><span>${label}</span><span class="sp"></span><button class="lzw-post-more">⋯</button></div>
    ${menu ? '<div class="lzw-pmenu"><button>👍 赞</button><button>💬 评论</button></div>' : ''}
    ${like ? `<div class="lzw-plike">❤ ${like}</div>` : ''}
    ${cmts ? `<div class="lzw-pcmts">${cmts}</div>` : ''}
    ${cmtbar ? '<div class="lzw-cmtbar"><input placeholder="说点什么…"><button>发送</button></div>' : ''}
  </div></div>`;
}
const ava = n => `<img class="lzw-post-ava" src="${AV(n)}">`;

// 朋友圈 feed：封面 + 两条动态（第一条展开菜单+赞+评论+输入框，第二条带图）
const feed = `<div class="lzw-appbar"><span class="lzw-back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></span><span class="lzw-appbar-t">朋友圈</span><span class="lzw-appbar-r"><span class="lzw-reroll">${CAM}</span></span></div>
<div class="lzw-mfeed">
  <div class="lzw-mcover"><div class="lzw-mcover-shade"></div><div class="lzw-mme"><span class="nm">裴知意</span><div class="av">裴</div></div></div>
  <div class="lzw-mpad"></div>
  ${post(ava('zhou'), '周言', '月考成绩出了，还活着。年级第七，比某人高了整整两名🙂', '', '2小时前', true, '林溪、陆飞', '<div><span class="n">林溪</span>：<span class="c">年级第七你要不要这么平静</span></div><div><span class="n">陆飞</span>：<span class="c">请客！</span></div><div><span class="n">周言</span> 回复 <span class="n">陆飞</span>：<span class="c">你就惦记这口</span></div>', true)}
  ${post(ava('lin'), '林溪', '晚自习后的糖水铺就是快乐老家', '一碗双皮奶加红豆，老板娘多给了一勺', '昨天 21:14', false, '', '', false)}
  ${post(ava('lu'), '陆飞', '求一个数学大题的解法，在线等，挺急的', '', '2天前 22:40', false, '', '', false)}
</div>`;

// 周言个人主页：封面 + 大头像 + 最近至多 5 条
const prof = `<div class="lzw-appbar"><span class="lzw-back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></span><span class="lzw-appbar-t"></span><span class="lzw-appbar-r"></span></div>
<div class="lzw-mfeed">
  <div class="lzw-mpf-cov"><img src="https://picsum.photos/seed/zycover/400/200"></div>
  <div class="lzw-mpf-id"><img class="lzw-mpf-av" src="${AV('zhou')}"><span class="lzw-mpf-nm">周言</span></div>
  <div class="lzw-mpad"></div>
  ${post(ava('zhou'), '周言', '月考成绩出了，还活着。年级第七，比某人高了整整两名🙂', '', '2小时前', false, '林溪、陆飞', '', false)}
  ${post(ava('zhou'), '周言', '球馆的灯修好了，周末可以打全场', '空荡的室内球场，灯光明亮', '3天前 20:02', false, '', '', false)}
</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#333;font-family:system-ui,"Microsoft YaHei",sans-serif;display:flex;gap:24px;padding:24px;justify-content:center;align-items:flex-start;flex-wrap:wrap}</style><style>${css}</style><style>.lzw-bezel{width:320px;height:640px;box-sizing:content-box;flex:none}</style></head><body>${phone(discover)}${phone(feed)}${phone(prof)}</body></html>`;
fs.writeFileSync(__dirname + '/sbv-moments.html', html);
// 单屏放大版：封面区特写检查用
const zoom = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#333;margin:0;font-family:system-ui,"Microsoft YaHei",sans-serif}</style><style>${css}</style><style>.lzw-bezel{width:400px;height:800px;box-sizing:content-box;zoom:1.6;margin:20px auto}</style></head><body>${phone(feed)}</body></html>`;
fs.writeFileSync(__dirname + '/sbv-moments-zoom.html', zoom);
console.log('written sbv-moments.html + sbv-moments-zoom.html');
