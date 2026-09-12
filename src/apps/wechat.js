// ═══════════════════════════════════════════════════════════
//  apps/wechat.js —— 微信应用（引擎装载的第一个应用）
//  UI 全部为本项目自有设计（仿真手机壳 + 亮色屏）。
//  展示层注入主页面（沙盒内经 parent.document 操作）。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var ID = { phone: 'lzw-phone' };

  function pdoc() { return window.parent.document; }
  function pwin() { return window.parent; }
  // 主屏壁纸（浅色可爱系；换图只改这里）。必须定义在 CSS 数组之前——
  // 数组在脚本加载时立即求值，引用晚于它的变量会得到 undefined。
  var HOME_WALL = 'https://files.catbox.moe/2rg9in.jpg';
  // 预载壁纸：引擎加载时就拉取，避免首次打开手机屏幕空白 1~2 秒
  try { var _wallPre = new Image(); _wallPre.src = HOME_WALL; } catch (e) {}
  function parseDay(s) {
    var m = /(\d+)年(\d+)月(\d+)日/.exec(s || '');
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  }
  function relDay(day, cur) {
    var a = parseDay(day), b = parseDay(cur);
    if (!a) return day || '';
    if (!b) return a.mo + '月' + a.d + '日';
    var diff = (b.y * 372 + b.mo * 31 + b.d) - (a.y * 372 + a.mo * 31 + a.d);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return (a.y !== b.y ? a.y + '年' : '') + a.mo + '月' + a.d + '日';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── 样式（自有设计） ──
  var CSS = [
    // 外壳：机身 + 屏幕
    '#lzw-phone{position:fixed;z-index:99991;display:none;font-family:system-ui,"Microsoft YaHei",sans-serif}',
    '#lzw-phone.lzw-open{display:block}',
    '.lzw-sbar{cursor:grab;touch-action:none}',
    '.lzw-sbar:active{cursor:grabbing}',
    '.lzw-bezel{width:100%;height:100%;background:#0b0d10;border-radius:48px;padding:11px;position:relative;',
    'box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 2px #2b3138;box-sizing:border-box}',
    '.lzw-btn-side{position:absolute;background:#1d2228;border-radius:3px}',
    '.lzw-btn-vol1{left:-3px;top:120px;width:4px;height:44px}',
    '.lzw-btn-vol2{left:-3px;top:176px;width:4px;height:44px}',
    '.lzw-btn-act{left:-3px;top:236px;width:4px;height:64px}',
    '.lzw-btn-pow{right:-3px;top:170px;width:4px;height:88px}',
    '.lzw-screen{width:100%;height:100%;border-radius:37px;overflow:hidden;display:flex;flex-direction:column;',
    'background:#f2f2f5;color:#111;position:relative;user-select:none}',
    // 状态栏（时间 / 灵动岛 / 信号·WiFi·电量）
    '.lzw-sbar{flex:none;height:38px;display:flex;align-items:center;justify-content:space-between;',
    'padding:4px 20px 0;position:relative;color:#111;z-index:3;background:#f7f7f9}',
    '.lzw-clock{font-size:13px;font-weight:600;letter-spacing:.3px;min-width:52px}',
    '.lzw-island{position:absolute;left:50%;top:9px;transform:translateX(-50%);width:72px;height:17px;',
    'background:#0b0d10;border-radius:10px}',
    '.lzw-sicons{display:flex;align-items:center;gap:5px}',
    '.lzw-sig{display:inline-flex;align-items:flex-end;gap:1.5px;height:11px}',
    '.lzw-sig i{display:block;width:3px;background:#111;border-radius:1px}',
    '.lzw-sig i:nth-child(1){height:4px}.lzw-sig i:nth-child(2){height:6px}',
    '.lzw-sig i:nth-child(3){height:8px}.lzw-sig i:nth-child(4){height:10px;opacity:.35}',
    // 应用栏
    '.lzw-appbar{flex:none;min-height:40px;display:flex;align-items:center;gap:6px;padding:2px 10px 8px;',
    'background:rgba(247,247,249,.92);border-bottom:1px solid rgba(0,0,0,.06)}',
    '.lzw-appbar-t{flex:1;text-align:center;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lzw-back{display:inline-flex;align-items:center;color:#111;cursor:pointer;padding:4px;border-radius:8px;margin-left:-4px}',
    '.lzw-back:hover{background:rgba(0,0,0,.05)}',
    '.lzw-appbar-r{width:24px}',
    '.lzw-reroll{display:inline-flex;color:#666;cursor:pointer;padding:5px;border-radius:8px;align-items:center;justify-content:center}',
    '.lzw-reroll:hover{background:rgba(0,0,0,.06)}',
    // 主体
    '.lzw-body{flex:1;min-height:0;overflow-y:auto;position:relative;z-index:1}',
    // 首页（壁纸 + 大时钟 + 应用网格）；壁纸铺整个屏幕，浅色系配深色字
    '.lzw-scr-home{background:url(' + HOME_WALL + ') center/cover no-repeat #f4f6fb}',
    '.lzw-scr-home .lzw-sbar{background:transparent}',
    '.lzw-home-wall{height:100%;padding:20px 16px 26px;display:flex;flex-direction:column;justify-content:space-between;',
    'box-sizing:border-box}',
    // 时钟用与壁纸线稿同系的石板蓝灰；白色光晕保证在任何底色上可读
    '.lzw-hometime{text-align:center;color:#46536f;text-shadow:0 1px 10px rgba(255,255,255,.9);margin-top:52px}',
    '.lzw-hometime .t{font-size:56px;font-weight:700;letter-spacing:1px}',
    '.lzw-hometime .d{font-size:14.5px;font-weight:600;letter-spacing:2.5px;margin-top:5px;opacity:.85}',
    // 应用名在浅色壁纸上用深字
    '.lzw-scr-home .lzw-app>span{color:#46536f;text-shadow:0 1px 4px rgba(255,255,255,.7)}',
    '.lzw-homegrid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 8px}',
    '.lzw-app{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;color:#fff}',
    '.lzw-app-ico{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;',
    'background:rgba(255,255,255,.28);backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.4)}',
    '.lzw-app>span{font-size:11px;text-shadow:0 1px 4px rgba(0,0,0,.45)}',
    // 会话列表
    '.lzw-conv{display:flex;gap:10px;align-items:center;padding:11px 12px;background:#fff;position:relative;',
    'border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer}',
    '.lzw-unread{position:absolute;right:12px;top:50%;transform:translateY(-50%);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#f43530;color:#fff;font-size:11px;line-height:18px;text-align:center;box-sizing:border-box}',
    '.lzw-app-ico .lzw-appdot{position:absolute;top:-5px;right:-7px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#f43530;color:#fff;font-size:10px;box-sizing:border-box;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;line-height:1}',
    '.lzw-conv:hover{background:#f7f7f9}',
    '.lzw-ava{width:34px;height:34px;border-radius:9px;flex:none;object-fit:cover;background:#c9cfd6;',
    'display:flex;align-items:center;justify-content:center;color:#fff;font-size:13.5px;font-weight:600}',
    '.lzw-ava-me{background:#4d7cfe}',
    '.lzw-conv-main{flex:1;min-width:0}',
    '.lzw-conv-name{font-weight:500;font-size:14px}',
    '.lzw-conv-prev{font-size:12px;color:#8a8f99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    // 选线界面：徽标 + 行态
    '.lzw-ltags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}',
    '.lzw-ltag{font-size:10px;line-height:1;padding:3px 6px;border-radius:8px;background:#eef1f5;color:#7a828d;white-space:nowrap}',
    '.lzw-ltag.rec{background:#22c05e;color:#fff}',
    '.lzw-ltag.cur{background:#e8b04b;color:#fff}',
    '.lzw-ltag.bad{background:#f6eaea;color:#c07878}',
    '.lzw-lineava{display:flex;align-items:center;justify-content:center;font-size:18px;background:#eef1f5}',
    '.lzw-linerow{cursor:pointer}',
    '.lzw-linerow:active{background:#f2f4f7}',
    '.lzw-linedis{opacity:.55}',
    // 选线弹窗（独立于手机壳的居中菜单）
    '#lzw-linespop{position:fixed;inset:0;z-index:99992;background:rgba(10,12,16,.5);display:flex;align-items:center;justify-content:center;font-family:system-ui,"Microsoft YaHei",sans-serif}',
    '.lzw-lpop-card{width:300px;max-height:78vh;background:#eef1f5;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45);display:flex;flex-direction:column}',
    '.lzw-lpop-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;background:#fff;border-bottom:1px solid #f0f2f5}',
    '.lzw-lpop-t{font-weight:600;font-size:15px;color:#1f2329}',
    '.lzw-lpop-x{cursor:pointer;font-size:20px;color:#9aa0a8;line-height:1;padding:0 2px}',
    '.lzw-lpop-x:hover{color:#5a6068}',
    '.lzw-lpop-list{overflow-y:auto}',
    '.lzw-lpop-list .lzw-conv{border-bottom:1px solid #eef1f5;background:#fff}',
    '.lzw-lpop-foot{padding:9px 14px;font-size:11px;color:#9aa0a8;text-align:center;line-height:1.6}',
    // 聊天
    '.lzw-chatbg{background:#f2f2f5;min-height:100%;padding:4px 0 10px}',
    '.lzw-chatrow{display:flex;gap:7px;margin:11px 12px;align-items:flex-start}',
    '.lzw-col{display:flex;flex-direction:column;min-width:0;max-width:62%}',
    '.lzw-col .lzw-bub{max-width:100%}',
    '.lzw-sender{font-size:11px;color:#9aa0a8;margin:0 0 3px}',
    '.lzw-chatrow.me{flex-direction:row-reverse}',
    '.lzw-bub{max-width:62%;padding:8px 11px;border-radius:9px;background:#fff;color:#111;line-height:1.45;font-size:13.5px;',
    'word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.05)}',
    '.lzw-chatrow.me .lzw-bub{background:#95ec69}',
    // 通话记录泡：白/绿跟普通气泡走，只多一个听筒朝下的图标（图标比字略小）
    '.lzw-bub.lzw-calllog{display:flex;align-items:center;gap:6px;font-size:12.5px;padding:7px 12px}',
    '.lzw-calllog-ico{display:inline-flex;transform:rotate(135deg);flex:none}', // 听筒朝下 = 已结束/未接通
    '.lzw-calllog-ico svg{width:15px;height:15px}',
    '.lzw-calllog-ico.vc{transform:none}', // 摄像机图标不旋转
    '.lzw-bub.lzw-sys{background:transparent;box-shadow:none;color:#8a8f99;font-size:12px;padding:2px 4px}',
    '.lzw-sticker{max-width:120px;border-radius:8px}',
    '.lzw-voice{display:flex;flex-wrap:wrap;align-items:center;gap:8px;cursor:pointer;min-width:80px}',
    '.lzw-voice.me{flex-direction:row-reverse}',
    '.lzw-voice.me .lzw-voice-play svg{transform:scaleX(-1)}',
    '.lzw-voice-play{display:inline-flex;line-height:0}',
    '.lzw-voice-sec{font-size:12px;color:#333}',
    '.lzw-voicetxt{display:none;flex-basis:100%;margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,.08);font-size:13px;color:#333;line-height:1.5}',
    '.lzw-voice.open .lzw-voicetxt{display:block}',
    '.lzw-imgbox{width:150px;padding:0;border-radius:9px;overflow:hidden}',
    '.lzw-imgph{min-height:110px;background:linear-gradient(150deg,#ccd6e2,#e8eef5);display:flex;align-items:center;justify-content:center;padding:16px 14px}',
    '.lzw-imgph span{font-size:12.5px;line-height:1.55;color:#5a6577;text-align:center;word-break:break-word}',
    '.lzw-locbox{width:160px;padding:0;border-radius:9px;overflow:hidden;background:#fff}',
    '.lzw-chatrow.me .lzw-bub.lzw-locbox,.lzw-chatrow.me .lzw-bub.lzw-imgbox{background:#fff}',
    '.lzw-locmap{height:84px;position:relative;background:linear-gradient(150deg,#dde9d9,#eef4ea)}',
    '.lzw-locmap:before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 42%,rgba(255,255,255,.95) 42% 50%,transparent 50%),linear-gradient(8deg,transparent 62%,rgba(255,255,255,.85) 62% 68%,transparent 68%),linear-gradient(0deg,transparent 80%,rgba(255,255,255,.75) 80% 86%,transparent 86%)}',
    '.lzw-locmap:after{content:"📍";position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:26px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}',
    '.lzw-locbox .cap{font-size:12.5px;font-weight:600;padding:7px 9px}',
    '.lzw-sysrow{text-align:center;font-size:11.5px;color:#9aa0a8;margin:10px 0}',
    '.lzw-recallrow{text-align:center;font-size:12px;color:#9aa0a8;margin:13px 0;line-height:1.7;cursor:pointer}',
    '.lzw-poke{display:inline-block;background:#dcdfe4;color:#333;font-size:11.5px;padding:7px 20px;border-radius:14px;cursor:pointer}',
    '.lzw-pokerow{margin:12px 12px;text-align:center}',
    '#lzw-phone.shake{animation:lzw-shake .5s}',
    '@keyframes lzw-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}',
    '.lzw-recallrow:hover{color:#6a7078}',
    '.lzw-peektg{display:block;font-size:10px;color:#a7abb2;cursor:pointer;margin-bottom:2px}',
    '.lzw-peektg:hover{color:#6a7078}',
    // 删除确认弹窗（右键/长按消息触发）
    '.lzw-scrim{position:absolute;inset:0;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;z-index:50}',
    '.lzw-confirm{background:#fff;border-radius:14px;padding:20px 20px 14px;width:216px;text-align:center;font-size:14px;color:#111;box-shadow:0 8px 30px rgba(0,0,0,.25)}',
    '.lzw-cbtns{display:flex;gap:10px;margin-top:15px}',
    '.lzw-cbtn{flex:1;border:none;border-radius:9px;padding:9px 0;font-size:14px;cursor:pointer}',
    '.lzw-cbtn.no{background:#f2f3f5;color:#333}',
    '.lzw-cbtn.yes{background:#e64b4b;color:#fff}',
    // 输入区（底部整体：面板叠加在输入条上方，不挤压聊天内容）
    '.lzw-bottom{flex:none;position:relative;background:#f7f7f9;border-top:1px solid rgba(0,0,0,.06)}',
    '.lzw-inputbar{display:flex;gap:8px;align-items:center;padding:8px 10px 4px;position:relative;z-index:3}',
    '.lzw-plus{width:23px;height:23px;flex:none;border-radius:50%;border:1.8px solid #454545;background:#fff;',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
    '.lzw-plus svg{display:block}',
    '.lzw-plus:hover{background:#eef0f3}',
    '.lzw-input{flex:1;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;color:#111;',
    'padding:7px 12px;font-size:14px;outline:none;min-width:0}',
    '.lzw-input::placeholder{color:#b9bdc4;font-size:13px;font-weight:300;letter-spacing:.3px}',
    '.lzw-send{flex:none;border:none;background:none;color:#3f66e8;cursor:pointer;padding:4px 2px;',
    'display:flex;align-items:center;justify-content:center}',
    '.lzw-send svg{display:block}',
    // 待发区（回车攒多条，小飞机一起发）
    // 待发消息与历史记录同流显示（不再用虚线框隔开），行尾 × 可单条撤回
    '.lzw-stgrow{position:relative}.lzw-stgrow .lzw-bub{opacity:.96}',
    '.lzw-stgx{position:absolute;top:-7px;right:-7px;width:17px;height:17px;border-radius:50%;',
    'background:#e64b4b;color:#fff;font-size:12px;line-height:17px;text-align:center;',
    'cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)}',
    '.lzw-stgitem{position:relative;flex:1;justify-content:flex-end;display:flex;align-items:flex-start;gap:5px}',
    '.lzw-stgitem .lzw-bub{max-width:none;flex:none}',
    '.lzw-stgcenter{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;margin:11px 12px}',
    '.lzw-stgstick{max-width:64px;border-radius:6px;display:block}',
    // [+] 面板（绝对定位：从输入条上方弹出，盖住聊天区，不引起内容重排）
    '.lzw-panel{position:absolute;left:0;right:0;bottom:100%;z-index:4;background:#f7f7f9;border-top:1px solid rgba(0,0,0,.06);',
    'padding:14px 14px 8px;display:none;max-height:236px;overflow-y:auto;box-shadow:0 -8px 20px rgba(0,0,0,.05)}',
    '.lzw-panel.lzw-open{display:block}',
    '.lzw-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px}',
    '.lzw-act{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;color:#555;font-size:11.5px}',
    '.lzw-act-ico{width:52px;height:52px;border-radius:14px;background:#fff;border:1px solid rgba(0,0,0,.06);',
    'display:flex;align-items:center;justify-content:center;font-size:24px}',
    '.lzw-act:hover .lzw-act-ico{background:#eef0f3}',
    '.lzw-modeform{display:flex;flex-direction:column;gap:8px;padding:2px 2px 8px}',
    '.lzw-modeinput{flex:1;width:100%;box-sizing:border-box;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:10px;color:#111;padding:8px 11px;font-size:13.5px;line-height:1.5;outline:none;resize:none;font-family:inherit}',
    '.lzw-modeinput::placeholder{color:#b9bdc4;font-size:12.5px}',
    '.lzw-modebtns{align-self:stretch;display:flex;justify-content:space-between;gap:8px}',
    '.lzw-modeok{border:none;border-radius:8px;background:#22c05e;color:#fff;font-size:13.5px;line-height:1;padding:9px 20px;cursor:pointer}',
    '.lzw-modecancel{border:1px solid #d5d8dd;border-radius:8px;background:#f7f8fa;color:#444;font-size:13.5px;line-height:1;padding:8px 18px;cursor:pointer}',
    '.lzw-stickgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:10px 4px;max-height:170px;overflow-y:auto;overflow-x:hidden;padding-bottom:6px}',
    '.lzw-stickcell{cursor:pointer;text-align:center}',
    '.lzw-stickcell .imgw{width:56px;height:56px;margin:0 auto;border-radius:8px;overflow:hidden;background:#eceff3}',
    '.lzw-stickcell img{width:100%;height:100%;object-fit:cover;display:block}',
        // 滚动条（统一的细灰条，不用浏览器默认样式）
    // 滚动条：细、淡灰、无箭头、透明轨道（webkit + Firefox 双管）
    '.lzw-screen ::-webkit-scrollbar{width:5px;height:5px}',
    '.lzw-screen ::-webkit-scrollbar-track{background:transparent}',
    '.lzw-screen ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.22);border-radius:2px}',
    '.lzw-screen ::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.32)}',
    // 底部 home 指示条
    '.lzw-homebar{flex:none;height:18px;display:flex;align-items:center;justify-content:center;background:#f7f7f9;position:relative;z-index:3}',
    '.lzw-homebar:after{content:"";display:block;width:110px;height:4px;border-radius:2px;background:rgba(0,0,0,.75)}',
    // ── 通话屏 ──
    '.lzw-dial{display:inline-flex;color:#111;padding:4px;border-radius:8px;cursor:pointer}',
    '.lzw-dial:hover{background:rgba(0,0,0,.06)}',
    '.lzw-callbody{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 16px 12px;background:#101418;color:#fff;position:relative;overflow:hidden}',
    '.lzw-scr-call .lzw-callbody{background:transparent}', // 背景在屏幕层铺，内容区透出来
    '.lzw-callfeed{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(22px);transform:scale(1.18)}',
    '.lzw-callshade{position:absolute;inset:0;background:#101418;opacity:.85;z-index:0}',
    '.lzw-calltop{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;z-index:1;margin-top:44px}',
    '.lzw-callava{width:88px;height:88px;border-radius:50%;overflow:hidden;background:#232a33;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:600;box-shadow:0 4px 18px rgba(0,0,0,.4)}',
    '.lzw-callava img{width:100%;height:100%;object-fit:cover}',
    '.lzw-callname{font-size:19px;font-weight:600;text-shadow:0 1px 6px rgba(0,0,0,.5)}',
    '.lzw-callstatus{font-size:13px;color:#c9d1d9;min-height:18px}',
    // 字幕区：顶部占位条把短内容顶到底部；内容超高时占位条收缩为 0，可向上滚动翻记录。
    // 隐藏滚动条（带不带无所谓，藏了更干净）。
    '.lzw-callsubs{position:relative;z-index:1;flex:1;min-height:0;width:100%;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:6px 4px;scrollbar-width:none}',
    '.lzw-callsubs::-webkit-scrollbar{display:none}',
    '.lzw-callsubs:before{content:"";flex:1;min-height:0}',
    // 仿玻璃气泡：char 靠左、user 靠右，内容靠左不居中。
    // 注意：这里刻意不用 backdrop-filter——Chromium 在焦点变化（点击/alt+tab）时会重绘
    // 背景滤镜层，造成刺眼的白色闪烁（已知 bug），半透明底+高光边已经足够"玻璃"。
    '.lzw-sub{max-width:85%;align-self:flex-start;text-align:left;font-size:13.5px;line-height:1.5;color:#f2f5f8;padding:7px 12px;border-radius:14px;background:rgba(17,21,26,.58);border:1px solid rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}',
    '.lzw-sub.me{align-self:flex-end;background:rgba(64,104,52,.62);border-color:rgba(130,195,110,.32);box-shadow:inset 0 1px 0 rgba(255,255,255,.09)}',
    '.lzw-callmid{position:relative;z-index:1;display:flex;gap:26px;margin-top:2px;align-items:flex-end}',
    '.lzw-callbtn{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:none;color:#e6edf3;font-size:10.5px;cursor:pointer}',
    '.lzw-callbtn i{width:46px;height:46px;border-radius:50%;background:rgba(244,246,249,.95);color:#1a1d21;box-shadow:0 2px 8px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:19px}',
    '.lzw-callbtn.on i{background:rgba(255,255,255,.34)}',
    '.lzw-callbtn.hang i{background:#e5484d;width:54px;height:54px;font-size:22px}',
    '.lzw-callrow{position:relative;z-index:1;display:flex;align-items:center;gap:8px;width:100%;margin-top:4px}',
    '.lzw-callinput{flex:1;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:17px;color:#fff;padding:8px 13px;font-size:13.5px;outline:none}',
    '.lzw-callinput::placeholder{color:rgba(255,255,255,.45)}',
    '.lzw-csend{background:#22c05e;border:none;color:#fff;border-radius:17px;padding:8px 14px;font-size:13px;cursor:pointer;white-space:nowrap}',
    '.lzw-cwait{position:relative;z-index:1;color:#c9d1d9;font-size:13px}',
    '.lzw-scr-call{background:#101418}', // 无头像时兜底，与通话内容区同色
    '.lzw-scr-call .lzw-sbar{background:transparent}',
    '.lzw-scr-call .lzw-homebar{background:transparent}',
    '.lzw-scr-call .lzw-homebar:after{background:rgba(255,255,255,.72)}', // 底部横条反白
    // 通话黑底：只反白时间/信号图标，灵动岛保持纯黑不反白
    '.lzw-scr-call .lzw-sbar .lzw-clock,.lzw-scr-call .lzw-sbar .lzw-sicons{filter:invert(1)}',
    '.lzw-callmid{justify-content:space-between;width:100%;padding:0 42px;align-items:center}',
    '.lzw-callbtn i{width:54px;height:54px;font-size:22px}',
    '.lzw-callbtn.hang i{width:54px;height:54px}',
    '.lzw-callroll{position:absolute;top:10px;right:12px;z-index:5;color:#fff;opacity:.85;cursor:pointer;padding:4px;line-height:0}',
    // 说话弹窗 + 删除确认：灰黑半透明面板，贴合通话暗色场景；输入区聚焦保持暗色不刺眼
    '.lzw-callta{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;caret-color:#fff;padding:9px 11px;font-size:13.5px;line-height:1.55;resize:none;outline:none !important;margin-bottom:2px;font-family:inherit}',
    '.lzw-callta::placeholder{color:rgba(255,255,255,.55) !important}', // 个别前端主题会给 placeholder 上奇色，强制柔和白
    '.lzw-callta:focus,.lzw-callta:focus-visible{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3);outline:none !important;box-shadow:none !important}', // 主题拷进沙盒的 :focus-visible 高亮圈会压过普通 outline:none，必须 !important；边框只微微变亮作聚焦提示
    // 浅色输入框（聊天主输入 + 图片/语音/定位表单）：同款免疫——主题的 :focus-visible 会在
    // 白底元素上画黑圈（闪黑色），压掉后把边框微微加深作聚焦提示
    '.lzw-input:focus,.lzw-input:focus-visible,.lzw-modeinput:focus,.lzw-modeinput:focus-visible{outline:none !important;box-shadow:none !important;border-color:rgba(0,0,0,.22)}',
    '.lzw-callpop{width:266px;background:rgba(28,32,38,.96);color:#e6edf3;padding:14px 14px 12px;text-align:left;font-size:13.5px;box-shadow:0 10px 34px rgba(0,0,0,.5)}',
    '.lzw-callpop .lzw-cbtns{margin-top:10px}',
    '.lzw-callpop .lzw-cbtn.no,.lzw-calldel .lzw-cbtn.no{background:rgba(255,255,255,.12);color:#e6edf3}',
    '.lzw-calldel{width:216px;background:rgba(28,32,38,.97);color:#e6edf3;padding:18px 18px 13px;text-align:center;font-size:14px;box-shadow:0 10px 34px rgba(0,0,0,.5)}',
    // ── 视频通话皮肤：头像图清晰全屏当实时画面（不模糊不压黑），去大头像圈，右上角 PiP 自视窗 ──
    '.lzw-scr-video .lzw-callfeed{filter:none;transform:none}',
    '.lzw-scr-video .lzw-callshade{opacity:.42}',
    '.lzw-scr-video .lzw-calltop{margin-top:22px}',
    '.lzw-scr-video .lzw-callava{display:none}',
    '.lzw-scr-video .lzw-callroll{right:auto;left:12px}', // 右上角让给 PiP
    '.lzw-callpip{position:absolute;top:48px;right:12px;width:62px;height:84px;border-radius:12px;background:rgba(16,20,24,.8);border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;color:#aeb8c2;z-index:4;box-shadow:0 3px 12px rgba(0,0,0,.35);overflow:hidden}',
    '.lzw-callpip img{width:100%;height:100%;object-fit:cover;display:block}',
    // 画面旁白：穿插在气泡流中间（说到哪演到哪），靠左淡字，与台词区分开
    '.lzw-callscene{position:relative;z-index:1;align-self:flex-start;margin:2px 0 2px 4px;max-width:86%;font-size:12px;line-height:1.55;color:rgba(255,255,255,.66);text-align:left;text-shadow:0 1px 4px rgba(0,0,0,.65);padding:2px 0}',
    // ── 发现页底栏 + 朋友圈 ──
    '.lzw-tabbar{flex:none;display:flex;border-top:1px solid rgba(0,0,0,.08);background:#f7f7f9}',
    '.lzw-tab{flex:1;border:none;background:none;padding:6px 0 5px;font-size:10.5px;color:#8a8f99;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;font-family:inherit}',
    '.lzw-tab.on{color:#22c05e}',
    '.lzw-tab svg{width:22px;height:22px}',
    '.lzw-tabdot{position:absolute;top:2px;left:calc(50% + 8px);min-width:15px;height:15px;border-radius:8px;background:#e5484d;color:#fff;font-size:9.5px;line-height:15px;text-align:center;padding:0 4px}',
    '.lzw-disc-row{position:relative;display:flex;align-items:center;gap:11px;padding:12px;background:#fff;cursor:pointer}',
    '.lzw-disc-ico{width:38px;height:38px;flex:none;display:flex;align-items:center;justify-content:center}',
    '.lzw-disc-ico svg{width:30px;height:30px}',
    '.lzw-disc-main{flex:1;min-width:0}',
    '.lzw-disc-name{font-size:14.5px;color:#111}',
    '.lzw-disc-prev{font-size:12px;color:#9aa0a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    '.lzw-disc-chev{flex:none;display:flex}',
    '.lzw-disc-gap{height:9px;background:#f2f3f5;border-top:1px solid rgba(0,0,0,.05)}',
    '.lzw-mfeed{flex:1;min-height:0;overflow-y:auto;background:#fff;padding-bottom:14px}',
    '.lzw-mcover{height:156px;position:relative;background:linear-gradient(160deg,#6f8cba,#a9bedd 55%,#d2dfee);overflow:hidden}',
    '.lzw-mcover img{width:100%;height:100%;object-fit:cover;display:block}',
    '.lzw-mcover-shade{position:absolute;left:0;right:0;bottom:0;height:64px;background:linear-gradient(transparent,rgba(0,0,0,.42))}',
    '.lzw-mme{position:absolute;right:12px;bottom:9px;display:flex;align-items:center;gap:9px}',
    '.lzw-mme .nm{color:#fff;font-size:14px;text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.55)}',
    '.lzw-mme .av{width:48px;height:48px;border-radius:9px;border:2px solid #fff;object-fit:cover;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;font-weight:600;box-sizing:border-box}',
    '.lzw-mpad{height:30px}',
    '.lzw-post{display:flex;gap:9px;padding:13px 12px 11px;border-bottom:1px solid rgba(0,0,0,.05)}',
    '.lzw-post-ava{width:37px;height:37px;border-radius:8px;flex:none;object-fit:cover;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600;cursor:pointer}',
    '.lzw-post-main{flex:1;min-width:0}',
    '.lzw-post-name{font-size:14px;font-weight:600;color:#576b95;cursor:pointer}',
    '.lzw-post-text{font-size:14px;line-height:1.55;color:#111;margin-top:2px;word-break:break-word}',
    '.lzw-post-img{margin-top:5px;background:#f2f3f5;border:1px solid rgba(0,0,0,.04);border-radius:7px;padding:7px 9px;font-size:12px;color:#5a6577;line-height:1.5;word-break:break-word}',
    '.lzw-post-meta{display:flex;align-items:center;margin-top:6px;font-size:12px;color:#999}',
    '.lzw-post-meta .sp{flex:1}',
    '.lzw-post-more{width:27px;height:19px;border:none;border-radius:5px;background:#f0f1f3;color:#576b95;font-size:13px;line-height:1;cursor:pointer;padding:0}',
    '.lzw-post-more:hover{background:#e7e9ec}',
    '.lzw-pmenu{display:flex;background:#4c4c4c;border-radius:7px;overflow:hidden;margin-top:5px;align-self:flex-start;width:max-content}',
    '.lzw-pmenu button{border:none;background:none;color:#fff;font-size:13px;padding:7px 15px;cursor:pointer;white-space:nowrap;font-family:inherit}',
    '.lzw-plike{margin-top:6px;background:#f7f7f7;border-radius:5px;padding:5px 9px;font-size:12.5px;color:#576b95;line-height:1.5;word-break:break-word}',
    '.lzw-pcmts{margin-top:3px;background:#f7f7f7;border-radius:5px;padding:5px 9px;font-size:12.5px;line-height:1.65;word-break:break-word}',
    '.lzw-pcmts .c{color:#111}',
    '.lzw-pcmts .n{color:#576b95;font-weight:600}',
    '.lzw-cmtbar{display:flex;gap:6px;margin-top:6px;align-items:center}',
    '.lzw-cmtbar input{flex:1;min-width:0;border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:6px 11px;font-size:13px;outline:none;background:#fff;color:#111;font-family:inherit}',
    '.lzw-cmtbar button{border:none;background:#22c05e;color:#fff;border-radius:14px;padding:6px 13px;font-size:12.5px;cursor:pointer;white-space:nowrap;font-family:inherit}',
    // 个人主页：封面 + 大头像压边 + 最近至多 5 条
    '.lzw-mpf-cov{height:116px;position:relative;background:linear-gradient(160deg,#8a76a8,#b9a8cf 60%,#e0d6ee);overflow:hidden}',
    '.lzw-mpf-cov img{width:100%;height:100%;object-fit:cover;display:block}',
    '.lzw-mpf-id{display:flex;align-items:flex-end;gap:10px;padding:0 14px;margin-top:-24px;position:relative;z-index:1}',
    '.lzw-mpf-av{width:62px;height:62px;border-radius:11px;border:2.5px solid #fff;object-fit:cover;background:#c9cfd6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:600;box-sizing:border-box}',
    '.lzw-mpf-nm{font-size:16px;font-weight:600;color:#111;padding-bottom:6px}'
  ].join('\n');

  var ICON_VOICE = '<svg width="15" height="15" viewBox="0 0 1024 1024"><path fill="#222222" d="M501.269333 517.610667a277.333333 277.333333 0 0 1-81.664 197.546666l-5.12 4.906667-3.306666 2.858667a42.666667 42.666667 0 0 1-58.325334-61.696l3.029334-3.136 6.954666-6.954667a192.042667 192.042667 0 0 0-7.936-273.002667l-3.050666-3.136a42.666667 42.666667 0 0 1 61.248-59.264l5.12 4.906667a277.333333 277.333333 0 0 1 83.050666 196.970667z m187.648 10.197333A418.090667 418.090667 0 0 1 565.845333 814.933333l-7.68 7.466667-3.306666 2.837333a42.666667 42.666667 0 0 1-58.346667-61.674666l3.029333-3.157334 6.101334-5.952a332.928 332.928 0 0 0 97.962666-228.48l0.085334-8.533333a332.821333 332.821333 0 0 0-105.834667-242.24 42.666667 42.666667 0 0 1 58.197333-62.4 418.133333 418.133333 0 0 1 132.970667 304.32l-0.106667 10.709333zM625.877333 137.877333a42.666667 42.666667 0 0 1 58.176-62.421333l-58.176 62.421333z m250.730667 394.026667a606.208 606.208 0 0 1-48.853333 225.365333l-6.293334 14.165334a606.016 606.016 0 0 1-123.2 176.554666l-11.136 10.816-3.306666 2.837334a42.666667 42.666667 0 0 1-58.346667-61.696l3.029333-3.136 9.557334-9.28a520.661333 520.661333 0 0 0 105.856-151.722667l5.397333-12.16a520.853333 520.853333 0 0 0 41.984-193.6l0.128-13.333333a520.341333 520.341333 0 0 0-38.4-194.261334l-5.141333-12.288a520.533333 520.533333 0 0 0-122.026667-172.288l58.197333-62.421333a605.909333 605.909333 0 0 1 142.016 200.533333l6.016 14.293334a605.653333 605.653333 0 0 1 44.672 226.133333l-0.149333 15.509333zM170.666667 518.442667a64 64 0 1 1 128 0 64 64 0 0 1-128 0z"/></svg>';

  var ICON_REROLL = '<svg width="18" height="18" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 85.333333c102.869333 0 199.509333 36.693333 275.029333 100.437334l93.866667-94.037334a21.333333 21.333333 0 0 1 36.437333 15.061334V384a21.333333 21.333333 0 0 1-21.333333 21.333333h-276.693333a21.333333 21.333333 0 0 1-15.104-36.394666l122.325333-122.496a341.333333 341.333333 0 1 0 118.314667 341.632 42.666667 42.666667 0 1 1 83.2 18.901333A426.794667 426.794667 0 0 1 512 938.666667C276.352 938.666667 85.333333 747.648 85.333333 512S276.352 85.333333 512 85.333333z"/></svg>';

  var ICON_CALL = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l1.5 4-2.2 1.6a13 13 0 0 0 6.1 6.1L16 13.5l4 1.5v4a1.6 1.6 0 0 1-1.8 1.6C10.4 19.9 4.1 13.6 3.4 5.8A1.6 1.6 0 0 1 5 4z"/></svg>';
  var ICON_VCALL = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="12.5" height="12" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/></svg>';
  var ICON_MIC = '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#1a1d21" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7"/></svg>';
  var ICON_HANG = '<svg width="26" height="26" viewBox="0 0 24 24"><path fill="#fff" d="M6.6 3.2c.5-.2 1.1 0 1.4.5l1.8 2.7c.3.5.2 1.1-.2 1.5L8 9.3a12.8 12.8 0 0 0 6.7 6.7l1.4-1.6c.4-.4 1-.5 1.5-.2l2.7 1.8c.5.3.7.9.5 1.4l-.7 2.1c-.2.6-.8 1-1.4.9C9.6 18.9 5.1 14.4 4.6 5.8c0-.6.4-1.2 1-1.4l1-.2z" transform="rotate(135 12 12)"/></svg>';
  var ICON_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_WIFI = '<svg width="15" height="11" viewBox="0 0 16 12" fill="#111"><path d="M8 9.9a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM8 6.2c-1.8 0-3.4.7-4.6 1.9l1.5 1.5a4.5 4.5 0 016.2 0l1.5-1.5A6.5 6.5 0 008 6.2zM8 1.4C4.9 1.4 2.1 2.8.2 5l1.5 1.5A9.2 9.2 0 018 3.8c2.5 0 4.8 1 6.3 2.7L15.8 5A11.4 11.4 0 008 1.4z" transform="scale(0.95)"/></svg>';
  // 电池：iPhone 风格——小圆角细描边、电芯近满内腔、右侧圆帽（依用户参考图，深灰 #2c2c2c）
  var ICON_BATT = '<svg width="21" height="12" viewBox="0 0 26 15" fill="#2c2c2c"><rect x="1" y="1.5" width="20.5" height="12" rx="1.2" fill="none" stroke="#2c2c2c" stroke-width="1.2"/><rect x="2.9" y="3.5" width="12.6" height="8"/><rect x="22.3" y="5.4" width="2.2" height="4.2" rx="1.1"/></svg>';
  var ICON_PLANE = '<svg width="23" height="23" viewBox="0 0 1024 1024" fill="#555"><path d="M972.48 40.64c-17.38666667-8.64-34.77333333-8.64-43.41333333 0L60.16 472.10666667C42.88 472.10666667 34.13333333 489.38666667 34.13333333 506.66666667s8.64 34.56 17.38666667 34.56l208.53333333 129.49333333c17.38666667 8.64 34.77333333 8.64 52.16-8.64l460.48-414.18666667 17.38666667 8.64-417.06666667 439.89333334c-8.64 8.64-8.64 17.28-8.64 25.92v189.86666666c0 17.28 8.64 34.56 26.02666667 43.2 17.38666667 8.64 34.77333333 0 43.41333333-8.64l104.32-103.57333333L746.66666667 981.22666667c8.64 8.64 17.38666667 8.64 26.02666666 8.64h17.38666667c17.38666667-8.64 26.02666667-17.28 26.02666667-34.56l173.76-862.93333334c0-25.92 0-43.09333333-17.38666667-51.73333333z"/></svg>';
  var ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5.4v13.2M5.4 12h13.2" stroke="#454545" stroke-width="3" stroke-linecap="round"/></svg>';
  // 主屏微信图标（绿色圆角块 + 白色对话泡）
  var ICON_POWEROFF = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 6.5a8 8 0 1 0 11.4 0"/></svg>';
  // 底栏两个 tab：对话 / 发现（指南针）
  var ICON_TAB_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.34-4.1-1L3 20l1.1-4.9A8.5 8.5 0 1 1 21 11.5z"/></svg>';
  var ICON_TAB_DISC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/></svg>';
  // 发现页里的朋友圈入口（彩色圆标）
  var ICON_MOMENTS = '<svg viewBox="0 0 1024 1024"><path fill="#fff" d="M512 954.24A442.24 442.24 0 1 0 69.76 512 442.08 442.08 0 0 0 512 954.24z m0-30.88a401.12 401.12 0 0 1-137.12-21.92V621.6l274.24 276.64A356 356 0 0 1 512 923.36z m285.28-119.68a400 400 0 0 1-112 81.28L487.2 687.04l389.44 1.92a359.52 359.52 0 0 1-79.2 114.72z m118.24-289.28a400 400 0 0 1-21.92 136.96H613.76l276.8-273.92a355.04 355.04 0 0 1 25.12 136.96z m-232.8-368a355.68 355.68 0 0 1 114.56 79.04 402.88 402.88 0 0 1 81.44 112L680.96 535.52zM512 653.6A141.6 141.6 0 1 1 653.6 512 141.6 141.6 0 0 1 512 653.6z m0-548.32A400 400 0 0 1 649.12 128v280L375.04 130.4A356.32 356.32 0 0 1 512 105.28z m-285.28 119.84a405.44 405.44 0 0 1 112-81.44l198.4 198.08-389.44-2.08a355.68 355.68 0 0 1 79.04-114.56zM108.64 514.4a400 400 0 0 1 21.92-136.96h279.84L133.6 651.36a357.92 357.92 0 0 1-24.96-136.96z m234.72-21.12l-1.92 389.44a357.12 357.12 0 0 1-114.72-79.04 401.76 401.76 0 0 1-81.28-112z"/><path fill="#FC6B4F" d="M649.12 128A400 400 0 0 0 512 105.28a356.32 356.32 0 0 0-137.12 25.12l274.08 276.8z"/><path fill="#7838F2" d="M797.44 225.12a355.68 355.68 0 0 0-114.56-79.04l-1.92 389.44 197.92-198.08a402.88 402.88 0 0 0-81.44-112.32z"/><path fill="#5698F3" d="M893.76 651.36a400 400 0 0 0 21.92-136.96 355.04 355.04 0 0 0-25.12-136.96l-276.8 273.92z"/><path fill="#20E9F4" d="M685.12 884.96a400 400 0 0 0 112-81.28 359.52 359.52 0 0 0 79.2-114.72l-389.44-1.92z"/><path fill="#00FD60" d="M375.04 901.44A401.12 401.12 0 0 0 512 923.36a356 356 0 0 0 136.96-25.12L375.04 621.6z"/><path fill="#ABFB5B" d="M341.44 882.72l1.92-389.44L145.44 691.2a401.76 401.76 0 0 0 81.28 112 357.12 357.12 0 0 0 114.72 79.52z"/><path fill="#F0E254" d="M130.56 377.44a400 400 0 0 0-21.92 136.96 357.92 357.92 0 0 0 24.96 136.96l276.8-273.92z"/><path fill="#F6B351" d="M339.04 144a405.44 405.44 0 0 0-112 81.44 355.68 355.68 0 0 0-79.04 114.56l389.44 2.08z"/></svg>';
  var ICON_CHEV = '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#c3c7cd" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5L6.5 7l-5 5.5"/></svg>';
  var ICON_CAM = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#454545" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h2.2l1.6-2.4A1.5 1.5 0 0 1 9 5h6a1.5 1.5 0 0 1 1.2.6L17.8 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/></svg>';

  var ICON_WECHAT = '<svg width="30" height="30" viewBox="0 0 1024 1024"><path fill="#fff" d="M669.3 369.4c9.8 0 19.6 0 29.4 1.6C671 245.2 536.9 152 383.2 152 211.6 152 71 269.7 71 416.8c0 85 45.8 156.9 124.2 210.9l-31.1 93.2L273.6 667c39.2 8.2 70.3 16.3 109.5 16.3 9.8 0 19.6 0 31.1-1.6-6.5-21.3-9.8-42.5-9.8-65.4 0.1-135.7 116.2-246.9 264.9-246.9z m-168.4-85c24.5 0 39.2 16.3 39.2 39.2 0 22.9-16.3 39.2-39.2 39.2-24.5 0-47.4-16.4-47.4-39.2 0-24.5 24.6-39.2 47.4-39.2z m-216.3 73.1c-24.7 0-47.8-16.2-47.8-38.8 0-24.3 24.7-38.8 47.8-38.8s39.5 16.2 39.5 38.8c0.1 22.7-16.4 38.8-39.5 38.8z"/><path fill="#fff" d="M953.8 613c0-125.9-124.2-227.2-264.8-227.2-148.8 0-266.5 103-266.5 227.2 0 125.9 117.7 227.2 266.5 227.2 31.1 0 62.1-8.2 93.2-16.3l85 47.4-22.9-78.5c62.1-47.4 109.5-109.5 109.5-179.8z m-351.5-39.2c-14.7 0-31.1-14.7-31.1-31.1 0-14.7 16.3-31.1 31.1-31.1 22.9 0 39.2 16.3 39.2 31.1 0 16.4-14.7 31.1-39.2 31.1z m178-7.6c-14.8 0-31.3-14.6-31.3-30.7 0-14.6 16.5-30.7 31.3-30.7 23.1 0 39.5 16.2 39.5 30.7 0 16.2-16.4 30.7-39.5 30.7z"/></svg>';
  // [+] 菜单图标（自绘线性图标，微信那种简洁风）
  var ICO = {
    sticker: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><circle cx="9" cy="9.8" r="1.1" fill="#555" stroke="none"/><circle cx="15" cy="9.8" r="1.1" fill="#555" stroke="none"/><path d="M8.4 14c1 1.2 2.2 1.8 3.6 1.8s2.6-.6 3.6-1.8"/></svg>',
    image: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="9.8" r="1.6"/><path d="M4.5 17.5l4.6-4.6 3 3 3.6-3.6 4.3 4.2"/></svg>',
    voice: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="10.5" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.6V21M9.2 21h5.6"/></svg>',
    poke: '<svg width="26" height="26" viewBox="0 0 1024 1024" fill="#555"><path d="M654.890667 132.394667l5.290666 2.56 8.021334 4.266666 12.928 7.189334 14.293333 8.170666 26.794667 15.786667 24.170666 14.570667 33.578667 20.672 45.312 28.373333 50.773333 32.32 76.181334 49.194667 31.082666 20.266666 2.922667 2.069334a42.666667 42.666667 0 0 1 16.277333 30.058666l0.149334 3.584v416.682667l-0.106667 4.373333a85.333333 85.333333 0 0 1-72.789333 80.042667l-4.330667 0.533333-312.896 29.802667-4.8 0.384-4.8 0.192a128 128 0 0 1-128.96-108.010667l-0.682667-4.906666-20.16-169.962667-150.933333 0.021333-4.864-0.085333c-69.418667-2.624-124.16-61.226667-126.592-132.864L170.666667 482.666667l0.085333-5.013334 0.256-4.970666c4.757333-69.333333 58.538667-125.312 126.336-127.872l4.864-0.085334H544.426667l-3.2-2.432-3.626667-2.858666c-58.666667-47.786667-59.946667-116.672-29.930667-164.352l2.453334-3.712 3.968-5.525334c29.973333-39.253333 82.773333-59.968 140.8-33.450666z m-60.458667 143.146666l2.837333 2.026667 71.914667 49.578667 24.533333 17.322666 7.936 5.76 5.12 3.925334 2.496 2.154666c27.050667 25.130667 10.858667 71.04-25.962666 73.621334l-3.306667 0.128h-377.813333l-3.072 0.106666c-23.466667 1.813333-43.114667 24.042667-43.114667 52.501334 0 28.48 19.626667 50.709333 43.114667 52.501333l3.093333 0.128h188.864l3.370667 0.128A42.666667 42.666667 0 0 1 532.906667 569.6l0.533333 3.349333 24.597333 207.573334 0.512 3.242666a42.666667 42.666667 0 0 0 42.453334 34.389334l3.456-0.192L917.333333 788.16V394.581333l-60.842666-39.424-62.293334-39.829333-47.146666-29.696-34.88-21.589333-25.024-15.210667-22.442667-13.376-19.882667-11.52-8.96-5.098667-12.266666-6.741333-2.474667-1.258667c-38.634667-18.090667-68.565333 32.96-26.688 64.682667zM230.592 201.749333l27.669333 80.725334-7.296 2.666666a213.482667 213.482667 0 0 0-71.466666 45.568 212.544 212.544 0 0 0-65.322667 153.621334 212.565333 212.565333 0 0 0 66.026667 154.325333 213.269333 213.269333 0 0 0 78.272 47.616l-27.605334 80.746667-8.725333-3.136a298.752 298.752 0 0 1-100.864-63.509334 297.877333 297.877333 0 0 1-92.437333-216.042666c0-82.197333 33.429333-159.146667 91.434666-215.082667a298.624 298.624 0 0 1 110.314667-67.498667z"/></svg>',
    location: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.7" stroke-linejoin="round"><path d="M12 21s6.8-6 6.8-10.6A6.8 6.8 0 0 0 5.2 10.4C5.2 15 12 21 12 21z"/><circle cx="12" cy="10.3" r="2.4"/></svg>'
  };

  // ── 手机内气泡行 ──
  // targetName：会话对象显示名（私聊=联系人，群聊=群名），用户戳一戳时显示「你戳了戳 TA」
  function chatRowHtml(m, userName, contactMap, targetName, idx, peeked, showName) {
    if (m.who === 'sys') return '<div class="lzw-sysrow">' + esc(m.text || '') + '</div>'; // 系统条目：挂断/拒接记录
    var isUser = m.who === 'user';
    var who = isUser ? userName : m.who;
    // 撤回未偷看：只留一行可点击的撤回提示
    if (m.recalled && !peeked) {
      return '<div class="lzw-recallrow" data-peek="' + idx + '" data-del="' + idx + '">' + esc(who) + ' 撤回了一条消息</div>';
    }
    var peektg = m.recalled ? '<span class="lzw-peektg" data-peek="' + idx + '">已撤回 · 点击隐藏</span>' : '';
    var avatar;
    if (isUser) {
      var uav = window.LZWorld.Engine.userAvatar();
      avatar = uav
        ? '<img class="lzw-ava lzw-ava-me" src="' + esc(uav) + '">'
        : '<div class="lzw-ava lzw-ava-me">' + esc(who.slice(0, 1)) + '</div>';
    } else {
      var c = contactMap && contactMap[m.who];
      avatar = (c && c.avatar)
        ? '<img class="lzw-ava" src="' + esc(window.LZWorld.Worldbook.imgUrl(c.avatar)) + '">'
        : '<div class="lzw-ava">' + esc(who.slice(0, 1)) + '</div>';
    }
    var bub;
    if (m.kind === 'sticker') {
      var file = window.LZWorld.Engine.stickers()[m.text];
      bub = file
        ? '<img class="lzw-sticker" src="' + esc(window.LZWorld.Worldbook.imgUrl(file)) + '" title="' + esc(m.text) + '">'
        : '<div class="lzw-bub">[表情:' + esc(m.text) + ']</div>';
    } else if (m.kind === 'poke') {
      bub = richBub(m, isUser, who, targetName, true);
      return '<div class="lzw-pokerow" data-del="' + idx + '">' + bub + '</div>';
    } else if (m.kind === 'calllog') {
      // 通话记录泡：语音=听筒朝下，视频=摄像机（不旋转），图标比字略小
      var vcLog = m.mode === 'video';
      bub = '<div class="lzw-bub lzw-calllog">' + esc(m.text || '') + '<span class="lzw-calllog-ico' + (vcLog ? ' vc' : '') + '">' + (vcLog ? ICON_VCALL : ICON_CALL) + '</span></div>';
    } else if (m.kind === 'voice' || m.kind === 'image' || m.kind === 'location') {
      bub = richBub(m, isUser, who, targetName, false);
    } else {
      bub = '<div class="lzw-bub">' + esc(m.text) + '</div>';
    }
    // 撤回标签注入气泡开口处（sticker 为裸 img，单独包一层）
    if (peektg) {
      if (bub.indexOf('<div class="lzw-bub') === 0) {
        var gt = bub.indexOf('>');
        bub = bub.slice(0, gt + 1) + peektg + bub.slice(gt + 1);
      } else {
        bub = '<div class="lzw-bub" style="padding:6px">' + peektg + bub + '</div>';
      }
    }
    if (showName && !isUser && m.who) bub = '<div class="lzw-col"><div class="lzw-sender">' + esc(m.who) + '</div>' + bub + '</div>';
    return '<div class="lzw-chatrow' + (isUser ? ' me' : '') + '" data-del="' + idx + '">' + avatar + bub + '</div>';
  }

  // 富消息气泡：voice/image/location/poke 的真实渲染（chatRowHtml 与待发预览共用）
  function richBub(m, isUser, who, targetName, pokeIt) {
    if (m.kind === 'poke') {
      return '<div class="lzw-poke"' + (pokeIt ? ' data-poke="1"' : '') + '>' + (isUser ? '你戳了戳 ' + esc(targetName || '对方') : esc(who) + ' 戳了戳你') + '</div>';
    }
    if (m.kind === 'voice') {
      var vsec = Math.max(2, Math.min(40, Math.round(m.text.length * 0.35)));
      return '<div class="lzw-bub lzw-voice' + (isUser ? ' me' : '') + '" data-voice="1" title="点击转文字查看内容"><span class="lzw-voice-play">' + ICON_VOICE + '</span><span class="lzw-voice-sec">' + vsec + '&#8243;</span><div class="lzw-voicetxt">' + esc(m.text) + '</div></div>';
    }
    if (m.kind === 'image') {
      return '<div class="lzw-bub lzw-imgbox"><div class="lzw-imgph"><span>' + esc(m.text) + '</span></div></div>';
    }
    if (m.kind === 'location') {
      return '<div class="lzw-bub lzw-locbox"><div class="lzw-locmap"></div><div class="cap">&#128205; ' + esc(m.text) + '</div></div>';
    }
    return '<div class="lzw-bub">' + esc(m.text) + '</div>';
  }

  // ── 待发区气泡（攒好的消息，小飞机一键全发） ──
  function stagedHtml(userName) {
    var W = window.LZWorld;
    var uav = W.Engine.userAvatar();
    var av = uav
        ? '<img class="lzw-ava lzw-ava-me" src="' + esc(uav) + '">'
        : '<div class="lzw-ava lzw-ava-me">' + esc(userName.slice(0, 1)) + '</div>';
    return UI.staged.map(function (m, i) {
      var stgx = '<span class="lzw-stgx" data-sdel="' + i + '" title="删掉这条">×</span>';
      if (m.kind === 'poke') {
        return '<div class="lzw-stgrow lzw-stgcenter">' + richBub(m, true, userName, '', false) + stgx + '</div>';
      }
      if (m.kind === 'sticker') {
        var file = W.Engine.stickers()[m.text];
        var inner = file
          ? '<img class="lzw-stgstick" src="' + esc(W.Worldbook.imgUrl(file)) + '" title="' + esc(m.text) + '">'
          : esc(m.text);
        return '<div class="lzw-chatrow me lzw-stgrow">' + av + '<div class="lzw-bub">' + inner + stgx + '</div></div>';
      }
      if (m.kind === 'text') {
        return '<div class="lzw-chatrow me lzw-stgrow">' + av + '<div class="lzw-bub">' + esc(m.text) + stgx + '</div></div>';
      }
      // image / voice / location：直接渲染成真实气泡，发送前后视觉一致
      return '<div class="lzw-chatrow me lzw-stgrow">' + av + '<div class="lzw-stgitem">' + richBub(m, true, userName, '', false) + stgx + '</div></div>';
    }).join('');
  }

  var UI = {
    screen: 'home',      // home | list | moments | mprofile | chat
    tab: 'chats',        // list 页底栏：chats | discover
    mProfile: null,      // mprofile 页看的对象名
    mMenu: -1,           // 展开「赞/评论」小菜单的动态下标
    mCmt: -1,            // 展开评论输入框的动态下标
    panel: null,         // null | 'actions' | 'sticker' | 'image' | 'voice' | 'location'
    chatKey: null,
    isGroup: false,
    busy: false,
    lineBusy: false,       // 选线写入世界书进行中，防连点
    staged: [],          // 待发消息 [{kind,text}]，回车攒入，小飞机一起发
    failed: false,        // 上次生成失败（消息已发出但对方没回成）→ 小飞机/↻ 变为重试
    peek: {},             // 撤回偷看集合：chatKey:index → true
    confirmDel: -1,       // 待确认删除的消息下标（-1=无）
    _placed: false,

    injectStyle: function () {
      var doc = pdoc();
      if (!doc.getElementById('lzw-style')) {
        var st = doc.createElement('style');
        st.id = 'lzw-style';
        st.textContent = CSS;
        doc.head.appendChild(st);
      }
    },

    inject: function () {
      var doc = pdoc();
      this.injectStyle();
      if (!doc.getElementById(ID.phone)) {
        var ph = doc.createElement('div');
        ph.id = ID.phone;
        doc.body.appendChild(ph);
      }
      if (!this._placed) {
        this._placed = true;
        var vv = pwin().visualViewport;
        var target = vv || pwin();
        try {
          target.addEventListener('resize', placePhone);
          if (vv) vv.addEventListener('scroll', placePhone);
        } catch (e) {}
      }
    },

    remove: function () {
      var p = pdoc().getElementById(ID.phone);
      if (p) p.remove();
    },

    toggle: function () {
      var ph = pdoc().getElementById(ID.phone);
      if (!ph) return;
      ph.classList.toggle('lzw-open');
      if (ph.classList.contains('lzw-open')) {
        placePhone();
        this.screen = 'home';
        this.panel = null;
        this.staged = [];
        this.render();
      }
    },

    openChat: function (key, isGroup) {
      this.chatKey = key;
      this.isGroup = !!isGroup;
      this.screen = 'chat';
      this.panel = null;
      this.staged = [];
      try { window.LZWorld.Store.clearUnread(key); } catch (e) {}
      this.render();
    },

    // ── 朋友圈 ──
    openMoments: function () {
      var W = window.LZWorld;
      this.tab = 'discover';
      this.screen = 'moments';
      this.mMenu = -1;
      this.mCmt = -1;
      try { W.Store.clearUnread(W.Engine.momentsKey); } catch (e) {}
      this.render();
      this.momentsEnsureFresh();
    },
    // 每个故事日首次进入生成 3~4 条动态；生成完若还在朋友圈页就刷新
    // 已生成 / 状态栏日期缺失都不静默跳过：前者由引擎 filledDay 判重，后者兜底生成一次并提示
    momentsEnsureFresh: function () {
      if (this.mBusy) return;
      var eng = window.LZWorld.Engine;
      var stamp = null;
      try { stamp = window.LZWorld.Status.snapshot(null); } catch (e) {}
      if (!(stamp && stamp.dateText)) {
        console.warn('[霖州引擎] 朋友圈：最近 6 层未解析到 <status> 里的 <环境> 日期，按无日期兜底生成一次');
        try { toastr.warning('未解析到状态栏日期，朋友圈已按无日期生成；检查最近楼层的状态栏 <环境> 块', '霖州手机', { timeOut: 6000 }); } catch (e) {}
      }
      this.mBusy = true;
      this.render();
      var self = this;
      eng.momentsEnsure().then(function (got) {
        if (got) try { toastr.info('📱 朋友们更新了朋友圈', '霖州手机', { timeOut: 3000 }); } catch (e) {}
      }).catch(function (e) {
        console.warn('[霖州引擎] 朋友圈填充失败', e);
        try { toastr.error('朋友圈加载失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.mBusy = false;
        if (self.screen === 'moments') self.render();
      });
    },
    // 赞：纯本地往返
    momentsLike: function (idx) {
      try { window.LZWorld.Engine.momentsLike(idx); } catch (e) {}
      this.mMenu = -1;
      this.render();
    },
    // 评论：先落库，接话生成完若还在朋友圈页就刷新（不在场时红点由引擎挂）
    momentsSendComment: function (idx, text) {
      var eng = window.LZWorld.Engine;
      this.mCmt = -1;
      this.mBusy = true;
      this.render();
      var self = this;
      eng.momentsComment(idx, text).catch(function (e) {
        console.warn('[霖州引擎] 朋友圈评论失败', e);
        try { toastr.error('评论发送失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.mBusy = false;
        if (self.screen === 'moments' || self.screen === 'mprofile') self.render();
      });
    },

    // 选线弹窗：居中菜单，独立于手机壳——古代线没有手机也要能由此换回现代线
    showLines: function () {
      this.injectStyle();
      var pop = pdoc().getElementById('lzw-linespop');
      if (!pop) {
        pop = pdoc().createElement('div');
        pop.id = 'lzw-linespop';
        pop.onclick = function (e) { if (e.target === pop) UI.closeLines(); }; // 点遮罩关闭
        pdoc().body.appendChild(pop);
      }
      this.renderLinesPop();
    },

    closeLines: function () {
      var pop = pdoc().getElementById('lzw-linespop');
      if (pop) pop.remove();
    },

    renderLinesPop: function () {
      var pop = pdoc().getElementById('lzw-linespop');
      if (!pop) return;
      pop.innerHTML =
        '<div class="lzw-lpop-card">' +
        '<div class="lzw-lpop-head"><span class="lzw-lpop-t">世界线</span><span class="lzw-lpop-x" data-lpx title="关闭">×</span></div>' +
        '<div class="lzw-lpop-list">' + linesRowsHtml() + '</div>' +
        '<div class="lzw-lpop-foot">点一条线 = 代劳开关世界书条目<br>并记入本聊天记录（手动开关从此不认）</div>' +
        '</div>';
      pop.querySelector('[data-lpx]').onclick = function () { UI.closeLines(); };
      pop.querySelectorAll('.lzw-linerow').forEach(function (el) {
        el.onclick = function () { UI.switchLine(el.dataset.line); };
      });
    },

    // 玩家在选线弹窗拍板：写世界书条目 + 更新记录，两边一起动（唯一合法的换线动作）。
    // 弹窗留在原地刷新徽标，不碰手机——手机开不开由玩家自己决定。
    switchLine: async function (line) {
      if (this.lineBusy) return;
      var W = window.LZWorld;
      var eng = W.Engine;
      if (!eng.entryKnown(line)) {
        try { toastr.warning('世界书里找不到【' + line + '】条目，无法切换', '📱 霖州引擎'); } catch (e) {}
        return;
      }
      this.lineBusy = true;
      try {
        await W.Worldbook.setEntriesEnabled(eng.lineOps(line));
        W.Store.setLine(line);
        eng.noteLineEntries(line);
        eng.locateLine(); // 记录与快照已一致，只归位内部状态，不会二次写条目，也不会打开手机
        try {
          toastr.info(eng.section() ? ('已切换到【' + line + '】') : ('已切换到【' + line + '】（该世界线没有手机）'), '📱 霖州引擎');
        } catch (e) {}
        this.renderLinesPop();
      } catch (e) {
        console.warn('[霖州引擎] 切换世界线失败', e);
        try { toastr.error('切换世界线失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
      } finally { this.lineBusy = false; }
    },

    render: function () {
      var ph = pdoc().getElementById(ID.phone);
      if (!ph) return;
      var W = window.LZWorld;
      var eng = W.Engine;
      var userName = eng.userName();
      var snap = W.Status.snapshot(null);
      var clock = snap.time ? snap.time : '--:--';
      var dateShort = snap.dateText ? snap.dateText.replace(/^(\d{4})年/, '') : '';

      var sbar =
        '<div class="lzw-sbar"><span class="lzw-clock">' + esc(clock) + '</span>' +
        '<span class="lzw-island"></span>' +
        '<span class="lzw-sicons"><span class="lzw-sig"><i></i><i></i><i></i><i></i></span>' +
        ICON_WIFI +
        ICON_BATT + '</span></div>';

      var callBg = '';
      if (this.call) {
        try {
          var cc = eng.findContact(this.call.name) || {};
          var cimg = cc.avatar ? esc(W.Worldbook.imgUrl(cc.avatar)) : '';
          callBg = (cimg ? '<img class="lzw-callfeed" src="' + cimg + '">' : '') + '<div class="lzw-callshade"></div>';
        } catch (e) { callBg = '<div class="lzw-callshade"></div>'; }
      }

      var body;
      if (this.call) {
        body = callHtml(this.call, userName);
      } else if (this.screen === 'home') {
        var totalUn = 0;
        try {
          W.Store.historyKeys().forEach(function (k) { totalUn += W.Store.meta(k).unread || 0; });
        } catch (e0) {}
        body =
          '<div class="lzw-body"><div class="lzw-home-wall">' +
          '<div class="lzw-hometime"><div class="t">' + esc(clock) + '</div><div class="d">' + esc(dateShort || '霖州') + '</div></div>' +
          '<div class="lzw-homegrid">' +
          '<div class="lzw-app" data-app="wechat"><div class="lzw-app-ico" style="background:#22c05e;border:none;position:relative">' + ICON_WECHAT +
          (totalUn ? '<span class="lzw-appdot">' + (totalUn > 99 ? '99+' : totalUn) + '</span>' : '') + '</div><span>微信</span></div>' +
          '<div class="lzw-app" style="opacity:.55"><div class="lzw-app-ico">🧩</div><span>敬请期待</span></div>' +
          '<div class="lzw-app" data-app="close" title="收起手机"><div class="lzw-app-ico" style="background:#e5484d;border:none;color:#fff">' + ICON_POWEROFF + '</div><span>关闭</span></div>' +
          '</div></div></div>';

      } else if (this.screen === 'list') {
        var sec = eng.section();
        var rowsHtml = '';
        if (this.tab === 'discover') {
          // 发现页：朋友圈入口（红点 = 机主不在场时新产生的接话评论数）
          var mUn = 0;
          try { mUn = W.Store.meta(eng.momentsKey).unread || 0; } catch (e0) {}
          var mfeed = eng.momentsFeed();
          var lastP = mfeed.length ? mfeed[mfeed.length - 1] : null;
          rowsHtml =
            '<div class="lzw-disc-row" data-mom="1"><div class="lzw-disc-ico">' + ICON_MOMENTS + '</div>' +
            '<div class="lzw-disc-main"><div class="lzw-disc-name">朋友圈</div>' +
            '<div class="lzw-disc-prev">' + esc(lastP ? lastP.who + '：' + String(lastP.text).slice(0, 18) : '朋友们的生活动态') + '</div></div>' +
            (mUn ? '<span class="lzw-unread">' + (mUn > 99 ? '99+' : mUn) + '</span>' : '') +
            '<span class="lzw-disc-chev">' + ICON_CHEV + '</span></div>';
        } else if (sec) {
          var convs = [];
          var kindCn = { sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' };
          (sec.contacts || []).forEach(function (c) { convs.push({ key: c.name, name: c.name, avatar: c.avatar, group: false }); });
          (sec.groups || []).forEach(function (g) { convs.push({ key: 'group:' + g.name, name: g.name, avatar: g.avatar || '', group: true }); });
          rowsHtml = convs.map(function (cv) {
            var h = W.Store.history(cv.key);
            var last = h.length ? h[h.length - 1] : null;
            var prev = last
              ? (last.kind === 'text' ? last.text
                : last.kind === 'calllog' ? '[' + (last.mode === 'video' ? '视频通话' : '语音通话') + ']'
                : '[' + (kindCn[last.kind] || last.kind) + ']')
              : '（暂无消息）';
            var av = cv.avatar
              ? '<img class="lzw-ava" src="' + esc(W.Worldbook.imgUrl(cv.avatar)) + '">'
              : (cv.group ? '<div class="lzw-ava">👥</div>' : '<div class="lzw-ava">' + esc(cv.name.slice(0, 1)) + '</div>');
            return '<div class="lzw-conv" data-key="' + esc(cv.key) + '" data-group="' + (cv.group ? 1 : 0) + '">' +
              av + '<div class="lzw-conv-main"><div class="lzw-conv-name">' + esc(cv.name) + '</div>' +
              '<div class="lzw-conv-prev">' + esc(prev) + '</div></div>' +
              (function () { var un = W.Store.meta(cv.key).unread || 0; return un ? '<span class="lzw-unread">' + (un > 99 ? '99+' : un) + '</span>' : ''; })() +
              '</div>';
          }).join('') || '<div class="lzw-sysrow">本世界线暂无联系人</div>';
        } else {
          rowsHtml = '<div class="lzw-sysrow">未定位到当前世界线<br>进行一次主对话生成后自动归位</div>';
        }
        // 底栏：微信 | 发现（发现挂朋友圈未读红点；微信挂会话总红点）
        var totalUn2 = 0;
        try {
          W.Store.historyKeys().forEach(function (k) { totalUn2 += W.Store.meta(k).unread || 0; });
        } catch (e0) {}
        var mUn2 = 0;
        try { mUn2 = W.Store.meta(eng.momentsKey).unread || 0; } catch (e0) {}
        body = '<div class="lzw-body">' + rowsHtml + '</div>' +
          '<div class="lzw-tabbar">' +
          '<button class="lzw-tab' + (this.tab === 'chats' ? ' on' : '') + '" data-tab="chats">' + ICON_TAB_CHAT + '<span>微信</span>' + (totalUn2 ? '<span class="lzw-tabdot">' + (totalUn2 > 99 ? '99+' : totalUn2) + '</span>' : '') + '</button>' +
          '<button class="lzw-tab' + (this.tab === 'discover' ? ' on' : '') + '" data-tab="discover">' + ICON_TAB_DISC + '<span>发现</span>' + (mUn2 ? '<span class="lzw-tabdot">' + (mUn2 > 99 ? '99+' : mUn2) + '</span>' : '') + '</button>' +
          '</div>';

      } else if (this.screen === 'moments') {
        var secM = eng.section() || {};
        var coverF = (secM.moments && secM.moments.cover) || '';
        var coverU = coverF ? W.Worldbook.imgUrl(coverF) : '';
        var uav = '';
        try { uav = eng.userAvatar(); } catch (e0) {}
        var mfeed2 = eng.momentsFeed();
        var postsHtml = '';
        for (var mi = mfeed2.length - 1; mi >= 0; mi--) postsHtml += momentsPostHtml(mfeed2[mi], mi, userName, eng, W, true);
        body = '<div class="lzw-mfeed">' +
          '<div class="lzw-mcover">' + (coverU ? '<img src="' + esc(coverU) + '" alt="">' : '') +
          '<div class="lzw-mcover-shade"></div>' +
          '<div class="lzw-mme"><span class="nm">' + esc(userName) + '</span>' +
          (uav ? '<img class="av" src="' + esc(uav) + '" alt="">' : '<div class="av">' + esc(userName.slice(0, 1)) + '</div>') + '</div></div>' +
          '<div class="lzw-mpad"></div>' +
          (postsHtml || '<div class="lzw-sysrow" style="margin-top:44px">朋友们还没发动态<br>稍等片刻，或退出重进刷新</div>') +
          (this.mBusy ? '<div class="lzw-sysrow">朋友们正在更新…</div>' : '') +
          '</div>';

      } else if (this.screen === 'mprofile') {
        var pn = this.mProfile || '';
        var pc = eng.findContact(pn) || {};
        var covF2 = pc.cover || ((eng.section() || {}).moments || {}).cover || '';
        var covU2 = covF2 ? W.Worldbook.imgUrl(covF2) : '';
        var his = eng.momentsFeed().filter(function (e) { return e.who === pn; }).slice(-5);
        var hisHtml = '';
        for (var hi2 = his.length - 1; hi2 >= 0; hi2--) hisHtml += momentsPostHtml(his[hi2], eng.momentsFeed().indexOf(his[hi2]), userName, eng, W, false);
        body = '<div class="lzw-mfeed">' +
          '<div class="lzw-mpf-cov">' + (covU2 ? '<img src="' + esc(covU2) + '" alt="">' : '') + '</div>' +
          '<div class="lzw-mpf-id">' +
          (pc.avatar ? '<img class="lzw-mpf-av" src="' + esc(W.Worldbook.imgUrl(pc.avatar)) + '" alt="">' : '<div class="lzw-mpf-av">' + esc(pn.slice(0, 1)) + '</div>') +
          '<span class="lzw-mpf-nm">' + esc(pn) + '</span></div>' +
          '<div class="lzw-mpad"></div>' +
          (hisHtml || '<div class="lzw-sysrow" style="margin-top:36px">TA 还没有动态</div>') +
          '</div>';

      } else { // chat
        var key = this.chatKey || '';
        var g = this.isGroup;
        var disp = g ? key.replace(/^group:/, '') : key;
        var hist = W.Store.history(key);
        var contactMap = {};
        var secNow = eng.section();
        if (g) {
          var grp = secNow ? (secNow.groups || []).filter(function (x) { return 'group:' + x.name === key; })[0] : null;
          if (grp) grp.members.forEach(function (n) { contactMap[n] = eng.findContact(n) || { name: n, avatar: '' }; });
        } else {
          contactMap[disp] = eng.findContact(disp) || { name: disp, avatar: '' };
        }
        var curDay = '';
        try { curDay = W.Status.snapshot(null).dateText; } catch (e2) {}
        var prevDay = null;
        var rows = hist.map(function (m, i) {
          var pre = '';
          if (m.day && m.day !== prevDay) {
            pre = '<div class="lzw-sysrow">' + esc(relDay(m.day, curDay) + (m.time ? ' ' + m.time : '')) + '</div>';
            prevDay = m.day;
          }
          return pre + chatRowHtml(m, userName, contactMap, disp, i, !!this.peek[key + ':' + i], this.isGroup);
        }, this).join('');
        if (this.canRetry()) rows += '<div class="lzw-sysrow">⚠ 对方暂时没有回复（生成失败）<br>点右上角刷新图标，或再点小飞机重试</div>';
        if (this.staged.length) rows += stagedHtml(userName);
        body = '<div class="lzw-body"><div class="lzw-chatbg" id="lzw-chatbody">' + rows + '</div></div>' +
          '<div class="lzw-bottom">' +
          panelHtml(this.panel) +
          '<div class="lzw-inputbar">' +
          '<button class="lzw-plus" data-act="plus">' + ICON_PLUS + '</button>' +
          '<input class="lzw-input" id="lzw-input" placeholder="回车攒一条，小飞机一起发" maxlength="300">' +
          '<button class="lzw-send" data-act="send" title="发送（把攒下的消息一起发出）">' + ICON_PLANE + '</button>' +
          '</div></div>';
      }

      var prevScroll = -1, prevNearBottom = true;
      var oldBody = ph.querySelector('#lzw-chatbody');
      if (oldBody) {
        var opn = oldBody.parentNode;
        prevScroll = opn.scrollTop;
        prevNearBottom = (opn.scrollHeight - opn.clientHeight - opn.scrollTop) < 60;
      }
      var prevSubs = -1;
      var oldSubs = ph.querySelector('.lzw-callsubs');
      if (oldSubs) prevSubs = oldSubs.scrollTop;

      ph.innerHTML =
        '<div class="lzw-bezel"><span class="lzw-btn-side lzw-btn-vol1"></span><span class="lzw-btn-side lzw-btn-vol2"></span>' +
        '<span class="lzw-btn-side lzw-btn-act"></span><span class="lzw-btn-side lzw-btn-pow"></span>' +
        '<div class="lzw-screen' + (this.screen === 'home' ? ' lzw-scr-home' : '') + (this.call ? ' lzw-scr-call' : '') + (this.call && this.call.mode === 'video' ? ' lzw-scr-video' : '') + '">' + callBg + sbar + appbarHtml(this.screen, disp, this.canReroll() ? 'reroll' : (this.canRetry() ? 'retry' : '')) + body + '<div class="lzw-homebar"></div>' +
        (this.confirmDel >= 0 ? '<div class="lzw-scrim"><div class="lzw-confirm">删除这条消息？<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="cancel">取消</button><button class="lzw-cbtn yes" data-cact="del">删除</button></div></div></div>' : '') +
        '</div></div>';

      this.bind(ph);
      if (this.screen === 'chat') {
        var cb = ph.querySelector('#lzw-chatbody');
        if (cb) {
          var pn = cb.parentNode;
          pn.scrollTop = prevNearBottom ? pn.scrollHeight : Math.max(0, Math.min(prevScroll, pn.scrollHeight));
        }
        var inp = ph.querySelector('#lzw-input');
        if (inp) inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); UI.sendText(); }
          // 空输入框按 Backspace 不弹删待发消息——删错别字按多了会误删；要删待发请点其右上角 ×
        });
      }
      // 朋友圈评论输入：回车即发
      var cmtIn = ph.querySelector('#lzw-cmtin');
      if (cmtIn) cmtIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var t = cmtIn.value.trim();
          if (t) UI.momentsSendComment(UI.mCmt, t);
        }
      });
      // 通话字幕区：首次渲染滚到底（看最新），重渲染尽量保住原滚动位置
      if (this.call) {
        var cs = ph.querySelector('.lzw-callsubs');
        if (cs) cs.scrollTop = (prevSubs < 0) ? cs.scrollHeight : Math.min(prevSubs, cs.scrollHeight);
      }
      // 通话：每秒刷时长；通话输入框回车即发
      if (this._ct) { clearInterval(this._ct); this._ct = null; }
      if (this.call && this.call.phase === 'active') {
        this._ct = setInterval(function () {
          var c = UI.call;
          var el = pdoc().getElementById('lzw-callstatus');
          if (!c || !el) return;
          el.textContent = fmtDur(Math.max(0, Math.round((Date.now() - c.startAt) / 1000)));
        }, 1000);
      }
    },

    bind: function (ph) {
      ph.querySelectorAll('[data-app="wechat"]').forEach(function (el) {
        el.onclick = function () { UI.screen = 'list'; UI.render(); };
      });
      // 主屏「关闭」app：收起手机。保险——小屏上弹窗可能盖住酒馆页的 QR 开关，
      // 万一被挡死，手机上永远有第二条路可以关掉自己
      ph.querySelectorAll('[data-app="close"]').forEach(function (el) {
        el.onclick = function () { UI.toggle(); };
      });
      ph.querySelectorAll('.lzw-back').forEach(function (el) {
        el.onclick = function () {
          UI.screen = el.dataset.act === 'home' ? 'home' : el.dataset.act === 'moments' ? 'moments' : 'list';
          UI.panel = null;
          UI.render();
        };
      });
      // 微信底栏 tab：微信 | 发现
      ph.querySelectorAll('[data-tab]').forEach(function (el) {
        el.onclick = function () { UI.tab = el.dataset.tab; UI.render(); };
      });
      // 发现页：朋友圈入口
      ph.querySelectorAll('[data-mom]').forEach(function (el) {
        el.onclick = function () { UI.openMoments(); };
      });
      // 朋友圈：相机占位、头像/名字进主页、⋯菜单、赞、评论、发送
      ph.querySelectorAll('[data-mcam]').forEach(function (el) {
        el.onclick = function () { try { toastr.info('发动态功能后续开放', '霖州手机'); } catch (e) {} };
      });
      ph.querySelectorAll('[data-mpf]').forEach(function (el) {
        el.onclick = function (ev) {
          ev.stopPropagation();
          UI.mProfile = el.dataset.mpf;
          UI.mMenu = -1;
          UI.mCmt = -1;
          UI.screen = 'mprofile';
          UI.render();
        };
      });
      ph.querySelectorAll('[data-mmenu]').forEach(function (el) {
        el.onclick = function (ev) {
          ev.stopPropagation();
          var i = parseInt(el.dataset.mmenu, 10);
          UI.mMenu = UI.mMenu === i ? -1 : i;
          UI.mCmt = -1;
          UI.render();
        };
      });
      ph.querySelectorAll('[data-mlike]').forEach(function (el) {
        el.onclick = function () { UI.momentsLike(parseInt(el.dataset.mlike, 10)); };
      });
      ph.querySelectorAll('[data-mcmt]').forEach(function (el) {
        el.onclick = function () {
          UI.mMenu = -1;
          UI.mCmt = parseInt(el.dataset.mcmt, 10);
          UI.render();
          var ci = ph.querySelector('#lzw-cmtin');
          if (ci) ci.focus();
        };
      });
      ph.querySelectorAll('[data-msend]').forEach(function (el) {
        el.onclick = function () {
          var ci = ph.querySelector('#lzw-cmtin');
          var t = ci ? ci.value.trim() : '';
          if (!t) return;
          UI.momentsSendComment(parseInt(el.dataset.msend, 10), t);
        };
      });
      ph.querySelectorAll('.lzw-conv:not(.lzw-linerow)').forEach(function (el) {
        el.onclick = function () { UI.openChat(el.dataset.key, el.dataset.group === '1'); };
      });
      ph.querySelectorAll('[data-act="send"]').forEach(function (el) { el.onclick = function () { UI.trySend(); }; });
      ph.querySelectorAll('[data-act="reroll"]').forEach(function (el) { el.onclick = function () { UI.reroll(); }; });
      // 待发区：点红 ✕ 删一条
      // 右键（PC）或长按 550ms（触屏）→ 弹确认窗，防止误删。
      // 聊天记录行走 data-del，通话字幕走 data-cdel，同一套交互。
      ph.oncontextmenu = function (e) {
        var t = e.target && e.target.closest ? e.target : null;
        var sub = t ? t.closest('[data-cdel]') : null;
        if (sub) {
          e.preventDefault();
          UI.callDel = parseInt(sub.getAttribute('data-cdel'), 10);
          UI.render();
          return;
        }
        var row = t ? t.closest('[data-del]') : null;
        if (!row) return;
        e.preventDefault();
        UI.confirmDel = parseInt(row.getAttribute('data-del'), 10);
        UI.render();
      };
      var lpTimer = null;
      ph.ontouchstart = function (e) {
        var t = e.target && e.target.closest ? e.target : null;
        var sub = t ? t.closest('[data-cdel]') : null;
        var row = t ? t.closest('[data-del]') : null;
        var hit = sub || row;
        lpTimer = hit ? setTimeout(function () {
          if (sub) UI.callDel = parseInt(sub.getAttribute('data-cdel'), 10);
          else UI.confirmDel = parseInt(row.getAttribute('data-del'), 10);
          UI.render();
        }, 550) : null;
      };
      ph.ontouchend = function () { clearTimeout(lpTimer); };
      ph.ontouchmove = function () { clearTimeout(lpTimer); };
      ph.querySelectorAll('[data-voice]').forEach(function (el) {
        el.onclick = function () { el.classList.toggle('open'); };
      });
      ph.querySelectorAll('[data-poke]').forEach(function (el) {
        el.onclick = function () {
          ph.classList.remove('shake');
          void ph.offsetWidth; // 重启动画
          ph.classList.add('shake');
          // 动画结束务必卸类：class 留着的话，下次开屏（display 切换）会重放抖动
          setTimeout(function () { ph.classList.remove('shake'); }, 550);
        };
      });
      // 顶部拖动挪位置
      ph.querySelectorAll('.lzw-sbar').forEach(function (hd) {
        hd.addEventListener('pointerdown', function (ev) {
          if (ev.button !== undefined && ev.button !== 0) return;
          var sx = ev.clientX, sy = ev.clientY;
          var stL = parseFloat(ph.style.left) || 0, stT = parseFloat(ph.style.top) || 0;
          var moved = false;
          var mv = function (e2) {
            var dx = e2.clientX - sx, dy = e2.clientY - sy;
            if (!moved && dx * dx + dy * dy < 16) return;
            moved = true;
            try { hd.setPointerCapture(ev.pointerId); } catch (e) {}
            var vw2 = pwin().innerWidth, vh2 = pwin().innerHeight;
            var L = Math.max(4, Math.min(stL + dx, vw2 - ph.offsetWidth - 4));
            var T = Math.max(4, Math.min(stT + dy, vh2 - ph.offsetHeight - 4));
            ph.style.left = L + 'px';
            ph.style.top = T + 'px';
            savedPos = { left: L, top: T };
          };
          var up = function () {
            hd.removeEventListener('pointermove', mv);
            hd.removeEventListener('pointerup', up);
            hd.removeEventListener('pointercancel', up);
            if (moved) {
              var kill = function (ce) { ce.stopPropagation(); ce.preventDefault(); pdoc().removeEventListener('click', kill, true); };
              pdoc().addEventListener('click', kill, true);
            }
          };
          hd.addEventListener('pointermove', mv);
          hd.addEventListener('pointerup', up);
          hd.addEventListener('pointercancel', up);
        });
      });
      ph.querySelectorAll('[data-peek]').forEach(function (el) {
        el.onclick = function () {
          UI.togglePeek(parseInt(el.getAttribute('data-peek'), 10));
        };
      });
      ph.querySelectorAll('[data-sdel]').forEach(function (el) {
        el.onclick = function (ev) {
          ev.stopPropagation();
          UI.staged.splice(parseInt(el.dataset.sdel, 10), 1);
          UI.render();
          var i2 = ph.querySelector('#lzw-input'); if (i2) i2.focus();
        };
      });
      ph.querySelectorAll('[data-act="plus"]').forEach(function (el) {
        el.onclick = function () {
          UI.panel = UI.panel ? null : 'actions';
          UI.render();
          var inp = ph.querySelector('#lzw-input');
          if (inp && UI.panel) inp.focus();
        };
      });
      // [+] 面板内的动作
      ph.querySelectorAll('[data-mode]').forEach(function (el) {
        el.onclick = function () {
          var mode = el.dataset.mode;
          if (mode === 'poke') { UI.stageTyped('poke', ''); return; } // 戳一戳也先攒着，随小飞机一起发
          UI.panel = mode; // sticker | image | voice | location
          UI.render();
        };
      });
      ph.querySelectorAll('[data-stick]').forEach(function (el) {
        el.onclick = function () { UI.stageTyped('sticker', el.dataset.stick); }; // 表情也攒着
      });
      ph.querySelectorAll('[data-act="modecancel"]').forEach(function (el) {
        el.onclick = function () { UI.panel = null; UI.render(); };
      });
      ph.querySelectorAll('[data-modesend]').forEach(function (el) {
        el.onclick = function () {
          var kind = el.dataset.modesend;
          var inp = ph.querySelector('#lzw-modeinput');
          var t = inp ? inp.value.trim() : '';
          if (!t) return;
          UI.stageTyped(kind, t);
        };
      });
      // 通话：拨打入口 + 通话屏按钮组
      ph.querySelectorAll('[data-act="dial"]').forEach(function (el) {
        el.onclick = function () { UI.dial(el.dataset.dial); };
      });
      // [data-cact] 统一分发：聊天删除确认（cancel/del）+ 通话屏按钮组
      ph.querySelectorAll('[data-cact]').forEach(function (el) {
        el.onclick = function () {
          var a = el.dataset.cact;
          if (a === 'cancel') { UI.confirmDel = -1; UI.render(); }
          else if (a === 'del') { UI.removeAt(UI.confirmDel); UI.confirmDel = -1; UI.render(); }
          else if (a === 'hangup') UI.hangup(false);
          else if (a === 'cancelcall') UI.hangup(true);
          else if (a === 'callreroll') UI.callReroll();
          else if (a === 'micpop') { UI.callPop = true; UI.render(); }
          else if (a === 'popok') {
            var ta = ph.querySelector('#lzw-calltext');
            var t = ta ? ta.value.trim() : '';
            UI.callPop = false;
            UI.render();
            if (t) UI.callSend(t);
          }
          else if (a === 'popcancel') { UI.callPop = false; UI.render(); }
          else if (a === 'delok') {
            if (UI.callDel != null) { try { window.LZWorld.Store.removeAt(window.LZWorld.Engine.callKey(UI.call.name), UI.callDel); } catch (e) {} }
            UI.callDel = null; UI.render();
          }
          else if (a === 'delno') { UI.callDel = null; UI.render(); }
        };
      });
      // 通话字幕删除：由上方 contextmenu / 长按统一处理（data-cdel 仅作下标载体）
    },

    // 回车：攒一条进待发区（[+] 二级模式的输入除外，那仍是即发）
    sendText: function () {
      var inp = pdoc().getElementById('lzw-input') || pdoc().getElementById('lzw-modeinput');
      if (!inp) return;
      var t = inp.value.trim();
      if (this.panel === 'image' || this.panel === 'voice' || this.panel === 'location') {
        if (t) this.sendTyped(this.panel, t);
        return;
      }
      inp.value = '';
      this.stageText(t);
    },

    stageText: function (t) {
      if (!t) return;
      this.staged.push({ kind: 'text', text: t });
      this.render();
      var inp = pdoc().getElementById('lzw-input');
      if (inp) inp.focus();
    },

    // 所有类型的消息都先攒进待发区，小飞机一起发
    stageTyped: function (kind, text) {
      this.staged.push({ kind: kind, text: text });
      this.panel = null;
      this.render();
      var inp = pdoc().getElementById('lzw-input');
      if (inp) inp.focus();
    },

    // 小飞机：输入框有字先攒上，然后把待发区一次性全发（AI 只生成一次、只写一楼）
    trySend: function () {
      if (this.panel === 'image' || this.panel === 'voice' || this.panel === 'location') { this.sendText(); return; }
      var inp = pdoc().getElementById('lzw-input');
      var t = inp ? inp.value.trim() : '';
      if (t) { inp.value = ''; this.staged.push({ kind: 'text', text: t }); }
      if (!this.staged.length) {
        // 没有待发内容时，小飞机充当「重试」：上次生成失败且对方还没回，就再生成一次
        var W0 = window.LZWorld;
        var h0 = W0.Store.history(this.chatKey);
        if (this.failed && !this.busy && h0.length && h0[h0.length - 1].who === 'user') {
          this.failed = false;
          this.generate(W0.Engine.userName());
        }
        return;
      }
      this.sendBatch();
    },

    sendBatch: function () {
      if (!this.staged.length || this.busy) return;
      var W = window.LZWorld;
      var msgs = this.staged.map(function (m) {
        return { who: 'user', kind: m.kind, text: m.text, time: W.Status.nowText() };
      });
      this.staged = [];
      this.failed = false;
      W.Store.push(this.chatKey, msgs, 100);
      this.render();
      this.generate(W.Engine.userName());
    },

    sendTyped: function (kind, text) {
      var W = window.LZWorld;
      var userName = W.Engine.userName();
      var msg = { who: 'user', kind: kind, text: text, time: W.Status.nowText() };
      this.failed = false;
      W.Store.push(this.chatKey, [msg], 100);
      this.panel = null;
      this.render();
      this.generate(userName);
    },

    // 重roll 条件：当前会话最后一条是对方消息。
    // 注意不查 busy——生成结束渲染时 busy 尚未复位，查了就会导致按钮迟到一轮
    canReroll: function () {
      var h = window.LZWorld.Store.history(this.chatKey);
      return !!(h.length && h[h.length - 1].who !== 'user');
    },

    removeAt: function (idx) {
      if (this.busy) return;
      if (window.LZWorld.Store.removeAt(this.chatKey, idx)) this.render();
    },

    togglePeek: function (idx) {
      var k = this.chatKey + ':' + idx;
      this.peek[k] = !this.peek[k];
      this.render();
    },

    // 重试条件：上次生成失败，且末尾是我方消息（发出后对方没回成）
    canRetry: function () {
      if (!this.failed) return false;
      var h = window.LZWorld.Store.history(this.chatKey);
      return !!(h.length && h[h.length - 1].who === 'user');
    },

    // ↻ 双模式：末尾是对方消息 → 弹出重roll；末尾是我方消息且上次失败 → 直接重试
    reroll: async function () {
      var W = window.LZWorld;
      if (this.busy) return;
      if (this.canRetry()) {
        this.failed = false;
        try { toastr.info('重试中……', '📱 霖州引擎'); } catch (e) {}
        this.render();
        await this.generate(W.Engine.userName());
        return;
      }
      if (!this.canReroll()) return;
      var h = W.Store.history(this.chatKey);
      var n = 0;
      for (var i = h.length - 1; i >= 0 && h[i].who !== 'user' && n < 12; i--) n++;
      var popped = W.Store.popLast(this.chatKey, n);
      if (!popped.length) { this.render(); return; }
      try { toastr.info('重roll中……', '📱 霖州引擎'); } catch (e) {}
      this.render();
      await this.generate(W.Engine.userName());
    },

    // 独立生成 → 存历史（正文不写楼层，手机记录自包含）
    generate: async function (userName) {
      if (this.busy) return;
      this.busy = true;
      var W = window.LZWorld;
      var eng = W.Engine;
      // 生成是异步的，期间用户可能已切到别的会话——key 必须先抓快照，
      // 否则回复会落进当前打开的会话（角色串聊）
      var key = this.chatKey;
      var grp = this.isGroup;
      try {
        var result = await withTimeout(eng.generateFor(key, grp), 90000);
        this.failed = false;
        if (result && result.msgs && result.msgs.length) {
          W.Store.push(key, result.msgs, 100);
          // 生成是异步的：发出后生成了回复、人已经切去别的会话/主页 → 记未读红点
          if (this.screen !== 'chat' || this.chatKey !== key) W.Store.bumpUnread(key, result.msgs.length);
          // 正在看别的会话时不刷它的屏；列表/主页则刷新让预览跟上
          if (this.screen !== 'chat' || this.chatKey === key) this.render();
        }
      } catch (e) {
        // API 故障有两类：直接报错、或永远挂起（由 withTimeout 兜底）。两种都要能重试。
        this.failed = true;
        console.warn('[霖州引擎] 生成失败', e);
        try { toastr.error('手机消息生成失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
        if (this.screen === 'chat') this.render();
      } finally {
        this.busy = false;
      }
    },

    // ── 语音/视频通话 ──
    // 拨打：呼叫页等一次「邀请生成」——AI 以 [拒绝] 开头 = 拒接（理由落聊天记录，
    // 回聊天页）；否则开场白进 transcript 直接接通。通话中锁屏，仅挂断可退。
    dial: async function (mode) {
      if (this.busy || this.call) return;
      if (this.isGroup || !this.chatKey) return;
      var W = window.LZWorld, eng = W.Engine;
      var name = this.chatKey;
      this.panel = null;
      this.callMute = false; this.callSpkr = false;
      this.call = { name: name, mode: mode, phase: 'ringing', startAt: Date.now(), busy: false, by: 'user' };
      this.render();
      try {
        var text = await withTimeout(eng.callInvite(name, mode), 90000);
        text = String(text || '').trim();
        if (!text) throw new Error('对方没有响应，请稍后再拨');
        if (!this.call || this.call.name !== name) return; // 等待中被取消
        if (/^\[拒绝\]/.test(text)) {
          var reason = text.replace(/^\[拒绝\]\s*/, '').trim();
          var kindCn1 = mode === 'video' ? '视频通话' : '语音通话';
          var back = [];
          if (reason) back.push({ who: name, kind: 'text', text: reason });
          // 通话记录灰泡由发起方生成：被拒 = 「对方已拒绝」+ 听筒朝下图标
          back.push({ who: 'user', kind: 'calllog', mode: mode, text: '对方已拒绝' });
          W.Store.push(name, back, 100);
          try { W.Store.setMeta(name, { headline: kindCn1 + ' · 未接', atMainCount: eng.mainCount() }); } catch (e) {}
          this.call = null; this.render();
          return;
        }
        // 接听：剥掉 [接听] 标记（兼容笨 AI 的「接听：」写法），正文按保序流进通话记录
        // （视频 = [画面] 行与台词行交织；splitCallOutput 兼容旧式 --- 块）
        text = text.replace(/^\[接听\]\s*/, '').replace(/^接听[：:]\s*/, '').trim();
        var entries = [];
        if (mode === 'video') {
          eng.splitCallOutput(text).slice(0, 12).forEach(function (en) {
            entries.push({ who: name, kind: en.kind === 'scene' ? 'scene' : 'text', text: en.text });
          });
        } else {
          text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 8)
            .forEach(function (l) { entries.push({ who: name, kind: 'text', text: l }); });
        }
        if (entries.length) W.Store.push(eng.callKey(name), entries, 200);
        this.call.phase = 'active';
        this.call.startAt = Date.now();
        this.render();
      } catch (e) {
        this.call = null; this.render();
        try { toastr.error('拨打失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
      }
    },

    // 通话轮：机主说了一段（可换行，拆成多条）→ 对方回台词（多行）
    callSend: async function (text) {
      var W = window.LZWorld, eng = W.Engine;
      var call = this.call;
      if (!call || call.phase !== 'active' || call.busy) return;
      var lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 10);
      if (!lines.length) return;
      var key = eng.callKey(call.name);
      W.Store.push(key, lines.map(function (l) { return { who: 'user', kind: 'text', text: l }; }), 200);
      call.busy = true;
      this.render();
      try {
        var ret = await withTimeout(eng.callTurn(call.name, call.mode, text), 90000);
        var entries = [];
        (ret.entries || []).forEach(function (en) {
          entries.push({ who: call.name, kind: en.kind === 'scene' ? 'scene' : 'text', text: en.text });
        });
        if (entries.length) W.Store.push(key, entries, 200);
      } catch (e) {
        try { toastr.error('对方信号不好，再试一次', '📱 霖州引擎'); } catch (e2) {}
      }
      if (this.call === call) { call.busy = false; this.render(); }
    },

    // 重说：弹掉对方最近一段台词，原地重生（带着机主最后一句的语境）
    callReroll: async function () {
      var W = window.LZWorld, eng = W.Engine;
      var call = this.call;
      if (!call || call.phase !== 'active' || call.busy) return;
      var key = eng.callKey(call.name);
      var h = W.Store.history(key);
      var n = 0;
      for (var i = h.length - 1; i >= 0 && h[i].who !== 'user' && h[i].who !== 'sys' && n < 10; i--) n++;
      if (!n) return;
      W.Store.popLast(key, n);
      call.busy = true;
      this.render();
      try {
        var ret = await withTimeout(eng.callTurn(call.name, call.mode, ''), 90000);
        var entries = [];
        (ret.entries || []).forEach(function (en) {
          entries.push({ who: call.name, kind: en.kind === 'scene' ? 'scene' : 'text', text: en.text });
        });
        if (entries.length) W.Store.push(key, entries, 200);
      } catch (e) {
        try { toastr.error('重说失败，再试一次', '📱 霖州引擎'); } catch (e2) {}
      }
      if (this.call === call) { call.busy = false; this.render(); }
    },

    // 挂断：transcript 末尾写时长；私聊里由发起方留一条通话记录灰泡（微信真实样式：
    // 正常结束 = 通话时长 + 听筒朝下；取消 = 已取消），回聊天页。
    hangup: function (cancelled) {
      var call = this.call; if (!call) return;
      var W = window.LZWorld, eng = W.Engine;
      this.call = null;
      if (this._ct) { clearInterval(this._ct); this._ct = null; }
      var who = call.by === 'user' ? 'user' : call.name;
      var kindCn2 = call.mode === 'video' ? '视频通话' : '语音通话';
      if (call.phase === 'active') {
        var sec = Math.max(1, Math.round((Date.now() - call.startAt) / 1000));
        var dur = fmtDur(sec);
        W.Store.push(eng.callKey(call.name), [{ who: 'sys', kind: 'sys', text: '通话结束 · ' + dur }], 200);
        W.Store.push(call.name, [{ who: who, kind: 'calllog', mode: call.mode, text: '通话时长 ' + dur }], 100);
        try { W.Store.setMeta(call.name, { headline: kindCn2 + ' ' + dur, atMainCount: eng.mainCount() }); } catch (e) {}
      } else if (cancelled) {
        W.Store.push(call.name, [{ who: who, kind: 'calllog', mode: call.mode, text: '已取消' }], 100);
      }
      this.screen = 'chat';
      this.chatKey = call.name;
      this.isGroup = false;
      this.render();
    }
  };

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
    var mm = (m < 10 ? '0' : '') + m, s2 = (ss < 10 ? '0' : '') + ss;
    return h ? (h + ':' + mm + ':' + s2) : (mm + ':' + s2);
  }

  // 通话屏：背景（模糊头像+厚遮罩）由 render() 铺在整个屏幕上，这里只排内容。
  // 字幕双人对白都上；底部一左一右：麦克风（点开多行输入弹窗）/ 挂断（电话倒扣）。右上角重说。
  // 右键/长按字幕 = 弹确认窗删除该条通话对白（与聊天记录同一套交互）。
  function callHtml(call, userName) {
    var W = window.LZWorld;
    var eng = W.Engine;
    var av;
    try {
      var c = eng.findContact(call.name) || { name: call.name, avatar: '' };
      var imgUrl = c.avatar ? esc(W.Worldbook.imgUrl(c.avatar)) : '';
      av = imgUrl ? '<img src="' + imgUrl + '">' : esc(call.name.slice(0, 1));
    } catch (e) { av = esc(call.name.slice(0, 1)); }
    var hist = W.Store.history(eng.callKey(call.name));
    // PiP 自视窗：优先 persona 头像（同聊天页"我"的气泡头像来源），没有则退名首字
    var pip = '';
    if (call.mode === 'video' && call.phase === 'active') {
      var uav = '';
      try { uav = eng.userAvatar(); } catch (e) {}
      pip = '<div class="lzw-callpip">' + (uav ? '<img src="' + esc(uav) + '" alt="">' : esc(userName.slice(0, 1))) + '</div>';
    }
    // 视频的画面条目穿插在气泡流中间：说第一句时吃薯片、说第二句时抬头看镜头……
    var subs = hist.map(function (m, i) {
      if (m.who === 'sys') return '';
      if (m.kind === 'scene') return '<div class="lzw-callscene" data-cdel="' + i + '">' + esc(m.text || '').replace(/\n/g, '<br>') + '</div>';
      var isMe = m.who === 'user';
      return '<div class="lzw-sub' + (isMe ? ' me' : '') + '" data-cdel="' + i + '">' + esc(m.text || '') + '</div>';
    }).join('');
    var status = call.phase === 'ringing'
      ? '正在呼叫…'
      : (call.busy ? '对方说话中…' : fmtDur(Math.max(0, Math.round((Date.now() - call.startAt) / 1000))));
    var roll = (call.phase === 'active' && !call.busy)
      ? '<span class="lzw-callroll" data-cact="callreroll" title="重说对方上一段">' + ICON_REROLL + '</span>'
      : '';
    var btns;
    if (call.phase === 'ringing') {
      btns = '<div class="lzw-callmid" style="justify-content:center"><button class="lzw-callbtn hang" data-cact="cancelcall"><i>' + ICON_HANG + '</i><span>取消</span></button></div>';
    } else {
      btns = '<div class="lzw-callmid">' +
        '<button class="lzw-callbtn" data-cact="micpop"><i>' + ICON_MIC + '</i><span>说话</span></button>' +
        '<button class="lzw-callbtn hang" data-cact="hangup"><i>' + ICON_HANG + '</i><span>挂断</span></button>' +
        '</div>';
    }
    var conf = (UI.callDel != null)
      ? '<div class="lzw-scrim"><div class="lzw-confirm lzw-calldel">删除这条通话对白？<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="delno">取消</button><button class="lzw-cbtn yes" data-cact="delok">删除</button></div></div></div>'
      : '';
    var pop = UI.callPop
      ? '<div class="lzw-scrim"><div class="lzw-confirm lzw-callpop"><textarea class="lzw-callta" id="lzw-calltext" rows="4" maxlength="500" placeholder="想说什么…（可换行）"></textarea>' +
        '<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="popcancel">取消</button><button class="lzw-cbtn yes" data-cact="popok">发送</button></div></div></div>'
      : '';
    return '<div class="lzw-callbody">' + roll + pip +
      '<div class="lzw-calltop"><div class="lzw-callava">' + av + '</div>' +
      '<div class="lzw-callname">' + esc(call.name) + '</div>' +
      '<div class="lzw-callstatus" id="lzw-callstatus">' + esc(status) + '</div></div>' +
      '<div class="lzw-callsubs">' + subs + '</div>' +
      (call.phase === 'ringing' ? '<div class="lzw-cwait">等待对方接听…</div>' : '') +
      conf + btns + '</div>' + pop;
  }

  // 生成超时保护：API 故障时 generateRaw 可能永远不返回，不兜底会让小飞机永远失灵
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (resolve, reject) {
        setTimeout(function () { reject(new Error('生成超时（' + Math.round(ms / 1000) + '秒无响应），请重试')); }, ms);
      })
    ]);
  }

  // 选线列表：五条线，标出「此聊天」的记录线与开关实况——
  // 记录和开关不一致时（带错线进聊天/中途手动翻过）两种徽标同时出现，一眼可见
  function linesRowsHtml() {
    var W = window.LZWorld;
    var eng = W.Engine;
    var saved = W.Store.line();
    var states = eng.entryStates();
    var cur = eng.line();
    var norm = function (s) { return String(s || '').replace(/[【】\s]/g, ''); };
    return eng.LINES.map(function (ln) {
      var st = null;
      for (var k in states) {
        if (norm(k) === norm(ln)) { st = states[k]; break; }
      }
      var ros = eng.roster(ln);
      var hasPhone = !!(ros && ((ros.contacts || []).length || (ros.groups || []).length));
      var tags = '';
      if (saved === ln) tags += '<span class="lzw-ltag rec">此聊天</span>';
      else if (cur === ln) tags += '<span class="lzw-ltag cur">当前</span>';
      if (st === null) tags += '<span class="lzw-ltag bad">条目未找到</span>';
      else tags += '<span class="lzw-ltag">' + (st ? '开关·开' : '开关·关') + '</span>';
      if (!hasPhone) tags += '<span class="lzw-ltag bad">无手机</span>';
      return '<div class="lzw-conv lzw-linerow' + (st === null ? ' lzw-linedis' : '') + '" data-line="' + esc(ln) + '">' +
        '<div class="lzw-ava lzw-lineava">' + (hasPhone ? '📱' : '🏮') + '</div>' +
        '<div class="lzw-conv-main"><div class="lzw-conv-name">' + esc(ln) + '</div>' +
        '<div class="lzw-ltags">' + tags + '</div></div></div>';
    }).join('');
  }

  function appbarHtml(screen, disp, act) {
    if (UI.call) return ''; // 通话界面：无顶栏（名字在通话屏里）
    if (screen === 'home') return ''; // 真手机主屏没有标题栏
    if (screen === 'list') return '<div class="lzw-appbar"><span class="lzw-back" data-act="home">' + ICON_BACK + '</span><span class="lzw-appbar-t">微信</span><span class="lzw-appbar-r"></span></div>';
    if (screen === 'moments') return '<div class="lzw-appbar"><span class="lzw-back" data-act="list">' + ICON_BACK + '</span><span class="lzw-appbar-t">朋友圈</span><span class="lzw-appbar-r"><span class="lzw-reroll" data-mcam="1" title="相机">' + ICON_CAM + '</span></span></div>';
    if (screen === 'mprofile') return '<div class="lzw-appbar"><span class="lzw-back" data-act="moments">' + ICON_BACK + '</span><span class="lzw-appbar-t"></span><span class="lzw-appbar-r"></span></div>';
    return '<div class="lzw-appbar"><span class="lzw-back" data-act="list">' + ICON_BACK + '</span><span class="lzw-appbar-t">' + esc(disp || '') + '</span><span class="lzw-appbar-r">' +
      (act ? '<span class="lzw-reroll" data-act="reroll" title="' + (act === 'retry' ? '上一条消息发送失败，点击重新获取回复' : '重新生成对方的上一条回复') + '">' + ICON_REROLL + '</span>' : '') +
      '</span></div>';
  }

  // 朋友圈动态卡片：头像(可进主页) + 文字 + 文字配图 + 时间 + ⋯菜单(赞/评论) + 赞列表 + 平铺评论
  // idx = 动态在 Store 里的下标（点赞/评论按下标回写）
  function momentsPostHtml(e, idx, userName, eng, W, nameLink) {
    var c = {};
    try { c = eng.findContact(e.who) || {}; } catch (e0) {}
    var mpfAttr = ' data-mpf="' + esc(e.who) + '"';
    var av = c.avatar
      ? '<img class="lzw-post-ava" src="' + esc(W.Worldbook.imgUrl(c.avatar)) + '"' + mpfAttr + ' alt="">'
      : '<div class="lzw-post-ava"' + mpfAttr + '>' + esc(e.who.slice(0, 1)) + '</div>';
    var menu = UI.mMenu === idx
      ? '<div class="lzw-pmenu"><button data-mlike="' + idx + '">👍 赞</button><button data-mcmt="' + idx + '">💬 评论</button></div>'
      : '';
    var cmtbar = UI.mCmt === idx
      ? '<div class="lzw-cmtbar"><input id="lzw-cmtin" maxlength="60" placeholder="说点什么…"><button data-msend="' + idx + '">发送</button></div>'
      : '';
    var likeRow = (e.likes && e.likes.length)
      ? '<div class="lzw-plike">❤ ' + e.likes.map(esc).join('、') + '</div>'
      : '';
    var cmtRows = (e.comments || []).map(function (cm) {
      return '<div><span class="n">' + esc(cm.who) + '</span>' +
        (cm.replyTo ? ' 回复 <span class="n">' + esc(cm.replyTo) + '</span>' : '') +
        '：<span class="c">' + esc(cm.text) + '</span></div>';
    }).join('');
    var cmtBlock = cmtRows ? '<div class="lzw-pcmts">' + cmtRows + '</div>' : '';
    return '<div class="lzw-post">' + av +
      '<div class="lzw-post-main">' +
      '<div class="lzw-post-name"' + (nameLink ? mpfAttr : '') + '>' + esc(e.who) + '</div>' +
      '<div class="lzw-post-text">' + esc(e.text) + '</div>' +
      (e.img ? '<div class="lzw-post-img">🖼 ' + esc(e.img) + '</div>' : '') +
      '<div class="lzw-post-meta"><span>' + esc(e.label || '') + '</span><span class="sp"></span>' +
      '<button class="lzw-post-more" data-mmenu="' + idx + '">⋯</button></div>' +
      menu + likeRow + cmtBlock + cmtbar +
      '</div></div>';
  }

  // [+] 面板内容
  function panelHtml(panel) {
    if (!panel) return '<div class="lzw-panel" id="lzw-panel"></div>';
    if (panel === 'sticker') {
      var stickers = window.LZWorld.Engine.stickers();
      var names = Object.keys(stickers);
      var grid = names.length
        ? names.map(function (n) {
            return '<div class="lzw-stickcell" data-stick="' + esc(n) + '"><div class="imgw">' +
              '<img src="' + esc(window.LZWorld.Worldbook.imgUrl(stickers[n])) + '" loading="lazy"></div></div>';
          }).join('')
        : '<div class="lzw-sysrow">世界书中未找到「霖州手机::表情包」条目</div>';
      return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-stickgrid">' + grid + '</div></div>';
    }
    if (panel === 'image' || panel === 'voice' || panel === 'location') {
      var hint = panel === 'image' ? '描述这张图片的画面，如：一张拍糊的试卷' : panel === 'voice' ? '这句语音说了什么，如：到了吱一声' : '地点名称，如：霖州一中北门';
      return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-modeform">' +
        '<textarea class="lzw-modeinput" id="lzw-modeinput" rows="2" maxlength="200" placeholder="' + hint + '"></textarea>' +
        '<div class="lzw-modebtns"><button class="lzw-modeok" data-modesend="' + panel + '">确定</button>' +
        '<button class="lzw-modecancel" data-act="modecancel">取消</button></div></div></div>';
    }
    // actions（戳一戳只能私聊用：群里没有指定对象）
    return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-actions">' +
      '<div class="lzw-act" data-mode="sticker"><div class="lzw-act-ico">' + ICO.sticker + '</div><span>表情</span></div>' +
      '<div class="lzw-act" data-mode="image"><div class="lzw-act-ico">' + ICO.image + '</div><span>图片</span></div>' +
      '<div class="lzw-act" data-mode="voice"><div class="lzw-act-ico">' + ICO.voice + '</div><span>语音</span></div>' +
      (UI.isGroup ? '' : '<div class="lzw-act" data-mode="poke"><div class="lzw-act-ico">' + ICO.poke + '</div><span>戳一戳</span></div>') +
      '<div class="lzw-act" data-mode="location"><div class="lzw-act-ico">' + ICO.location + '</div><span>定位</span></div>' +
      (UI.isGroup ? '' :
        '<div class="lzw-act" data-act="dial" data-dial="audio"><div class="lzw-act-ico">' + ICON_CALL + '</div><span>语音通话</span></div>' +
        '<div class="lzw-act" data-act="dial" data-dial="video"><div class="lzw-act-ico">' + ICON_VCALL + '</div><span>视频通话</span></div>') +
      '</div></div>';
  }

  // 用 visualViewport 计算位置：F12/移动仿真/页面缩放下依然落在可视区右下角
  var savedPos = null; // 拖动过的位置，关闭再唤起仍记得（刷新重置）

  function placePhone() {
    var ph = pdoc().getElementById(ID.phone);
    if (!ph || !ph.classList.contains('lzw-open')) return;
    var vp = pwin().visualViewport;
    var vw = vp ? vp.width : pwin().innerWidth;
    var vh = vp ? vp.height : pwin().innerHeight;
    var w = Math.max(280, Math.min(348, vw - 16));
    var h = Math.max(420, Math.min(680, vh - 20));
    ph.style.width = w + 'px';
    ph.style.height = h + 'px';
    var left = savedPos ? savedPos.left : (vp ? vp.offsetLeft : 0) + vw - w - 8;
    var top = savedPos ? savedPos.top : (vp ? vp.offsetTop : 0) + vh - h - 8;
    ph.style.left = Math.max(4, Math.min(left, vw - w - 4)) + 'px';
    ph.style.top = Math.max(4, Math.min(top, vh - h - 4)) + 'px';
    ph.style.right = 'auto';
    ph.style.bottom = 'auto';
  }

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Apps = window.LZWorld.Apps || {};
  window.LZWorld.Apps.wechat = UI;
})();
