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
    'padding:4px 20px 0;position:relative;color:#111;z-index:3}',
    '.lzw-clock{font-size:13px;font-weight:600;letter-spacing:.3px;min-width:52px}',
    '.lzw-island{position:absolute;left:50%;top:9px;transform:translateX(-50%);width:72px;height:17px;',
    'background:#0b0d10;border-radius:10px}',
    '.lzw-sicons{display:flex;align-items:center;gap:5px}',
    '.lzw-sig{display:inline-flex;align-items:flex-end;gap:1.5px;height:11px}',
    '.lzw-sig i{display:block;width:3px;background:#111;border-radius:1px}',
    '.lzw-sig i:nth-child(1){height:4px}.lzw-sig i:nth-child(2){height:6px}',
    '.lzw-sig i:nth-child(3){height:8px}.lzw-sig i:nth-child(4){height:10px;opacity:.35}',
    '.lzw-batt{display:inline-flex;align-items:center;gap:1px}',
    '.lzw-batt-in{display:block;width:20px;height:10px;border:1.5px solid #111;border-radius:3px;padding:1px;box-sizing:border-box}',
    '.lzw-batt-fill{display:block;height:100%;width:72%;background:#111;border-radius:1px}',
    '.lzw-batt-cap{display:block;width:2px;height:4px;background:#111;border-radius:0 2px 2px 0;opacity:.6}',
    // 应用栏
    '.lzw-appbar{flex:none;min-height:40px;display:flex;align-items:center;gap:6px;padding:2px 10px 8px;',
    'background:rgba(247,247,249,.92);border-bottom:1px solid rgba(0,0,0,.06)}',
    '.lzw-appbar-t{flex:1;text-align:center;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lzw-back{display:inline-flex;align-items:center;color:#111;cursor:pointer;padding:4px;border-radius:8px;margin-left:-4px}',
    '.lzw-back:hover{background:rgba(0,0,0,.05)}',
    '.lzw-appbar-r{width:24px}',
    '.lzw-reroll{display:inline-flex;width:22px;height:22px;border-radius:50%;border:1.5px solid #878e98;color:#555;',
    'font-size:14px;align-items:center;justify-content:center;cursor:pointer;background:#fff}',
    // 主体
    '.lzw-body{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;position:relative;z-index:1}',
    // 首页（壁纸 + 大时钟 + 应用网格）；壁纸铺整个屏幕，浅色系配深色字
    '.lzw-scr-home{background:url(' + HOME_WALL + ') center/cover no-repeat #f4f6fb}',
    '.lzw-home-wall{height:100%;padding:20px 16px 26px;display:flex;flex-direction:column;justify-content:space-between;',
    'box-sizing:border-box}',
    // 时钟用与壁纸线稿同系的石板蓝灰；白色光晕保证在任何底色上可读
    '.lzw-hometime{text-align:center;color:#46536f;text-shadow:0 1px 10px rgba(255,255,255,.9);margin-top:52px}',
    '.lzw-hometime .t{font-size:56px;font-weight:700;letter-spacing:1px}',
    '.lzw-hometime .d{font-size:14.5px;font-weight:600;letter-spacing:2.5px;margin-top:5px;opacity:.85}',
    // 应用名在浅色壁纸上用深字
    '.lzw-scr-home .lzw-app span{color:#46536f;text-shadow:0 1px 4px rgba(255,255,255,.7)}',
    '.lzw-homegrid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 8px}',
    '.lzw-app{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;color:#fff}',
    '.lzw-app-ico{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;',
    'background:rgba(255,255,255,.28);backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.4)}',
    '.lzw-app span{font-size:11px;text-shadow:0 1px 4px rgba(0,0,0,.45)}',
    // 会话列表
    '.lzw-conv{display:flex;gap:10px;align-items:center;padding:11px 12px;background:#fff;',
    'border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer}',
    '.lzw-conv:hover{background:#f7f7f9}',
    '.lzw-ava{width:42px;height:42px;border-radius:10px;flex:none;object-fit:cover;background:#c9cfd6;',
    'display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:600}',
    '.lzw-ava-me{background:#4d7cfe}',
    '.lzw-conv-main{flex:1;min-width:0}',
    '.lzw-conv-name{font-weight:500;font-size:14.5px}',
    '.lzw-conv-prev{font-size:12.5px;color:#8a8f99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    // 聊天
    '.lzw-chatbg{background:#f2f2f5;min-height:100%;padding:4px 0 10px}',
    '.lzw-chatrow{display:flex;gap:8px;margin:12px 10px;align-items:flex-start}',
    '.lzw-chatrow.me{flex-direction:row-reverse}',
    '.lzw-bub{max-width:68%;padding:9px 12px;border-radius:12px;background:#fff;color:#111;line-height:1.5;',
    'word-break:break-word;font-size:14.5px;box-shadow:0 1px 2px rgba(0,0,0,.05)}',
    '.lzw-chatrow.me .lzw-bub{background:#95ec69}',
    '.lzw-bub.lzw-sys{background:transparent;box-shadow:none;color:#8a8f99;font-size:12px;padding:2px 4px}',
    '.lzw-sticker{max-width:120px;border-radius:8px}',
    '.lzw-voice-ico{color:#111;margin-right:6px;opacity:.6}',
    '.lzw-imgbox{width:150px;border-radius:10px;overflow:hidden}',
    '.lzw-imgph{height:90px;background:linear-gradient(140deg,#b9c6d2,#dfe7ee);display:flex;align-items:center;justify-content:center;font-size:30px}',
    '.lzw-imgbox .cap{font-size:12px;padding:6px 8px;color:#333}',
    '.lzw-locbox{width:170px;border-radius:10px;overflow:hidden;background:#fff}',
    '.lzw-locmap{height:64px;background:linear-gradient(140deg,#a8d5a2,#e8f3e4);position:relative}',
    '.lzw-locmap:after{content:"📍";position:absolute;left:50%;top:50%;transform:translate(-50%,-60%);font-size:22px}',
    '.lzw-locbox .cap{font-size:13px;font-weight:600;padding:6px 8px}',
    '.lzw-sysrow{text-align:center;font-size:12px;color:#9aa0a8;margin:10px 0}',
    '.lzw-recallrow{text-align:center;font-size:12px;color:#9aa0a8;margin:10px 0;cursor:pointer}',
    '.lzw-recallrow:hover{color:#6a7078}',
    '.lzw-peektg{display:block;font-size:10px;color:#a7abb2;cursor:pointer;margin-bottom:2px}',
    '.lzw-peektg:hover{color:#6a7078}',
    '.lzw-msgdel{flex:none;align-self:flex-start;font-size:12px;color:#c3c7cd;cursor:pointer;padding:3px 5px;opacity:0;transition:opacity .15s}',
    '.lzw-chatrow:hover .lzw-msgdel{opacity:1}',
    // 输入区（底部整体：面板叠加在输入条上方，不挤压聊天内容）
    '.lzw-bottom{flex:none;position:relative;background:#f7f7f9;border-top:1px solid rgba(0,0,0,.06)}',
    '.lzw-inputbar{display:flex;gap:8px;align-items:center;padding:8px 10px 4px;position:relative;z-index:3}',
    '.lzw-plus{width:23px;height:23px;flex:none;border-radius:50%;border:1.8px solid #454545;background:#fff;',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
    '.lzw-plus svg{display:block}',
    '.lzw-plus:hover{background:#eef0f3}',
    '.lzw-input{flex:1;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:17px;color:#111;',
    'padding:8px 13px;font-size:14.5px;outline:none;min-width:0}',
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
    '.lzw-modeform{display:flex;gap:8px;align-items:center;padding-bottom:8px}',
    '.lzw-modeform .hint{flex:none;font-size:12.5px;color:#777}',
    '.lzw-stickgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:10px 4px;max-height:170px;overflow-y:auto;overflow-x:hidden;padding-bottom:6px}',
    '.lzw-stickcell{cursor:pointer;text-align:center}',
    '.lzw-stickcell .imgw{width:56px;height:56px;margin:0 auto;border-radius:8px;overflow:hidden;background:#eceff3}',
    '.lzw-stickcell img{width:100%;height:100%;object-fit:cover;display:block}',
        // 滚动条（统一的细灰条，不用浏览器默认样式）
    // 滚动条：细、淡灰、无箭头、透明轨道（webkit + Firefox 双管）
    '.lzw-screen ::-webkit-scrollbar{width:5px;height:5px}',
    '.lzw-screen ::-webkit-scrollbar-button{display:none;width:0;height:0}',
    '.lzw-screen ::-webkit-scrollbar-track{background:transparent}',
    '.lzw-screen ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}',
    '.lzw-screen ::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.26)}',
    '.lzw-screen *{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}',
    // 底部 home 指示条
    '.lzw-homebar{flex:none;height:18px;display:flex;align-items:center;justify-content:center;background:#f7f7f9;position:relative;z-index:3}',
    '.lzw-homebar:after{content:"";display:block;width:110px;height:4px;border-radius:2px;background:rgba(0,0,0,.75)}'
  ].join('\n');

  var ICON_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_WIFI = '<svg width="15" height="11" viewBox="0 0 16 12" fill="#111"><path d="M8 9.9a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM8 6.2c-1.8 0-3.4.7-4.6 1.9l1.5 1.5a4.5 4.5 0 016.2 0l1.5-1.5A6.5 6.5 0 008 6.2zM8 1.4C4.9 1.4 2.1 2.8.2 5l1.5 1.5A9.2 9.2 0 018 3.8c2.5 0 4.8 1 6.3 2.7L15.8 5A11.4 11.4 0 008 1.4z" transform="scale(0.95)"/></svg>';
  var ICON_PLANE = '<svg width="23" height="23" viewBox="0 0 1024 1024" fill="#555"><path d="M972.48 40.64c-17.38666667-8.64-34.77333333-8.64-43.41333333 0L60.16 472.10666667C42.88 472.10666667 34.13333333 489.38666667 34.13333333 506.66666667s8.64 34.56 17.38666667 34.56l208.53333333 129.49333333c17.38666667 8.64 34.77333333 8.64 52.16-8.64l460.48-414.18666667 17.38666667 8.64-417.06666667 439.89333334c-8.64 8.64-8.64 17.28-8.64 25.92v189.86666666c0 17.28 8.64 34.56 26.02666667 43.2 17.38666667 8.64 34.77333333 0 43.41333333-8.64l104.32-103.57333333L746.66666667 981.22666667c8.64 8.64 17.38666667 8.64 26.02666666 8.64h17.38666667c17.38666667-8.64 26.02666667-17.28 26.02666667-34.56l173.76-862.93333334c0-25.92 0-43.09333333-17.38666667-51.73333333z"/></svg>';
  var ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5.4v13.2M5.4 12h13.2" stroke="#454545" stroke-width="3" stroke-linecap="round"/></svg>';
  // 主屏微信图标（绿色圆角块 + 白色对话泡）
  var ICON_WECHAT = '<svg width="30" height="30" viewBox="0 0 24 24"><path fill="#fff" transform="translate(12 12) scale(1.16) translate(-12 -12)" d="M8.7 4C4.9 4 2 6.6 2 9.8c0 1.8 1 3.4 2.5 4.5l-.6 2 2.2-1.2c.8.2 1.6.4 2.5.4h.4A5.6 5.6 0 0 1 9 13.6c0-3 2.8-5.4 6.2-5.4h.4C15 5.4 12.2 4 8.7 4zM6.5 8.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm4.9 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z"/><path fill="#fff" transform="translate(12 12) scale(1.16) translate(-12 -12)" d="M22 13.6c0-2.7-2.5-4.9-5.6-4.9s-5.6 2.2-5.6 4.9 2.5 4.9 5.6 4.9c.7 0 1.3-.1 1.9-.3l1.8 1-.5-1.7c1.4-.9 2.4-2.3 2.4-3.9zm-7.5-1.5a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6zm4 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z"/></svg>';
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
  function chatRowHtml(m, userName, contactMap, targetName, idx, peeked) {
    var isUser = m.who === 'user';
    var who = isUser ? userName : m.who;
    // 撤回未偷看：只留一行可点击的撤回提示
    if (m.recalled && !peeked) {
      return '<div class="lzw-recallrow" data-peek="' + idx + '">' + esc(who) + ' 撤回了一条消息 · 偷看</div>';
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
      bub = '<div class="lzw-bub lzw-sys">' + (isUser ? '你戳了戳 ' + esc(targetName || '对方') : esc(who) + ' 戳了戳你') + '</div>';
      return '<div style="text-align:center">' + bub + '</div>';
    } else if (m.kind === 'voice') {
      bub = '<div class="lzw-bub"><span class="lzw-voice-ico">▶</span>' + esc(m.text) + '</div>';
    } else if (m.kind === 'image') {
      bub = '<div class="lzw-bub lzw-imgbox"><div class="lzw-imgph">🖼</div><div class="cap">' + esc(m.text) + '</div></div>';
    } else if (m.kind === 'location') {
      bub = '<div class="lzw-bub lzw-locbox"><div class="lzw-locmap"></div><div class="cap">📍 ' + esc(m.text) + '</div></div>';
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
    return '<div class="lzw-chatrow' + (isUser ? ' me' : '') + '">' + avatar + bub +
      '<span class="lzw-msgdel" data-del="' + idx + '" title="删除这条">×</span></div>';
  }

  // ── 待发区气泡（攒好的消息，小飞机一键全发） ──
  function stagedHtml(userName) {
    var W = window.LZWorld;
    var kindLabel = { image: '图片', voice: '语音', location: '定位' };
    return UI.staged.map(function (m, i) {
      var inner, sys = false;
      if (m.kind === 'sticker') {
        var file = W.Engine.stickers()[m.text];
        inner = file
          ? '<img class="lzw-stgstick" src="' + esc(W.Worldbook.imgUrl(file)) + '" title="' + esc(m.text) + '">'
          : esc(m.text);
      } else if (m.kind === 'poke') {
        inner = '戳一戳';
        sys = true;
      } else if (m.kind !== 'text') {
        inner = '[' + (kindLabel[m.kind] || m.kind) + '] ' + esc(m.text);
      } else {
        inner = esc(m.text);
      }
      var uav = W.Engine.userAvatar();
      var av = uav
        ? '<img class="lzw-ava lzw-ava-me" src="' + esc(uav) + '">'
        : '<div class="lzw-ava lzw-ava-me">' + esc(userName.slice(0, 1)) + '</div>';
      return '<div class="lzw-chatrow me lzw-stgrow">' + av +
        '<div class="lzw-bub' + (sys ? ' lzw-sys' : '') + '">' + inner +
        '<span class="lzw-stgx" data-sdel="' + i + '" title="删掉这条">×</span></div></div>';
    }).join('');
  }

  var UI = {
    screen: 'home',      // home | list | chat
    panel: null,         // null | 'actions' | 'sticker' | 'image' | 'voice' | 'location'
    chatKey: null,
    isGroup: false,
    busy: false,
    staged: [],          // 待发消息 [{kind,text}]，回车攒入，小飞机一起发
    failed: false,        // 上次生成失败（消息已发出但对方没回成）→ 小飞机/↻ 变为重试
    peek: {},             // 撤回偷看集合：chatKey:index → true
    _placed: false,

    inject: function () {
      var doc = pdoc();
      if (!doc.getElementById('lzw-style')) {
        var st = doc.createElement('style');
        st.id = 'lzw-style';
        st.textContent = CSS;
        doc.head.appendChild(st);
      }
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
      this.render();
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
        '<span class="lzw-batt"><span class="lzw-batt-in"><span class="lzw-batt-fill"></span></span><span class="lzw-batt-cap"></span></span></span></div>';

      var body;
      if (this.screen === 'home') {
        body =
          '<div class="lzw-body"><div class="lzw-home-wall">' +
          '<div class="lzw-hometime"><div class="t">' + esc(clock) + '</div><div class="d">' + esc(dateShort || '霖州') + '</div></div>' +
          '<div class="lzw-homegrid">' +
          '<div class="lzw-app" data-app="wechat"><div class="lzw-app-ico" style="background:#22c05e;border:none">' + ICON_WECHAT + '</div><span>微信</span></div>' +
          '<div class="lzw-app" style="opacity:.55"><div class="lzw-app-ico">🧩</div><span>敬请期待</span></div>' +
          '</div></div></div>';

      } else if (this.screen === 'list') {
        var sec = eng.section();
        var rowsHtml = '';
        if (sec) {
          var convs = [];
          var kindCn = { sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' };
          (sec.contacts || []).forEach(function (c) { convs.push({ key: c.name, name: c.name, avatar: c.avatar, group: false }); });
          (sec.groups || []).forEach(function (g) { convs.push({ key: 'group:' + g.name, name: g.name, avatar: '', group: true }); });
          rowsHtml = convs.map(function (cv) {
            var h = W.Store.history(cv.key);
            var last = h.length ? h[h.length - 1] : null;
            var prev = last ? (last.kind === 'text' ? last.text : '[' + (kindCn[last.kind] || last.kind) + ']') : '（暂无消息）';
            var av = cv.group
              ? '<div class="lzw-ava">👥</div>'
              : (cv.avatar ? '<img class="lzw-ava" src="' + esc(W.Worldbook.imgUrl(cv.avatar)) + '">' : '<div class="lzw-ava">' + esc(cv.name.slice(0, 1)) + '</div>');
            return '<div class="lzw-conv" data-key="' + esc(cv.key) + '" data-group="' + (cv.group ? 1 : 0) + '">' +
              av + '<div class="lzw-conv-main"><div class="lzw-conv-name">' + esc(cv.name) + '</div>' +
              '<div class="lzw-conv-prev">' + esc(prev) + '</div></div></div>';
          }).join('') || '<div class="lzw-sysrow">本世界线暂无联系人</div>';
        } else {
          rowsHtml = '<div class="lzw-sysrow">未定位到当前世界线<br>进行一次主对话生成后自动归位</div>';
        }
        body = '<div class="lzw-body">' + rowsHtml + '</div>';

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
        var rows = hist.map(function (m, i) {
          return chatRowHtml(m, userName, contactMap, disp, i, !!this.peek[key + ':' + i]);
        }, this).join('');
        if (this.canRetry()) rows += '<div class="lzw-sysrow">⚠ 对方暂时没有回复（生成失败）<br>点右上角 ↻ 或再点小飞机重试</div>';
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

      ph.innerHTML =
        '<div class="lzw-bezel"><span class="lzw-btn-side lzw-btn-vol1"></span><span class="lzw-btn-side lzw-btn-vol2"></span>' +
        '<span class="lzw-btn-side lzw-btn-act"></span><span class="lzw-btn-side lzw-btn-pow"></span>' +
        '<div class="lzw-screen' + (this.screen === 'home' ? ' lzw-scr-home' : '') + '">' + sbar + appbarHtml(this.screen, disp, this.canReroll() ? 'reroll' : (this.canRetry() ? 'retry' : '')) + body + '<div class="lzw-homebar"></div>' +
        '</div></div>';

      this.bind(ph);
      if (this.screen === 'chat') {
        var cb = ph.querySelector('#lzw-chatbody');
        if (cb) cb.parentNode.scrollTop = cb.parentNode.scrollHeight;
        var inp = ph.querySelector('#lzw-input');
        if (inp) inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); UI.sendText(); }
          else if (e.key === 'Backspace' && !inp.value && UI.staged.length) {
            e.preventDefault(); UI.staged.pop(); UI.render();
            var i2 = ph.querySelector('#lzw-input'); if (i2) i2.focus();
          }
        });
      }
    },

    bind: function (ph) {
      ph.querySelectorAll('[data-app="wechat"]').forEach(function (el) {
        el.onclick = function () { UI.screen = 'list'; UI.render(); };
      });
      ph.querySelectorAll('.lzw-back').forEach(function (el) {
        el.onclick = function () {
          UI.screen = el.dataset.act === 'home' ? 'home' : 'list';
          UI.panel = null;
          UI.render();
        };
      });
      ph.querySelectorAll('.lzw-conv').forEach(function (el) {
        el.onclick = function () { UI.openChat(el.dataset.key, el.dataset.group === '1'); };
      });
      ph.querySelectorAll('[data-act="send"]').forEach(function (el) { el.onclick = function () { UI.trySend(); }; });
      ph.querySelectorAll('[data-act="reroll"]').forEach(function (el) { el.onclick = function () { UI.reroll(); }; });
      // 待发区：点红 ✕ 删一条
      ph.querySelectorAll('[data-del]').forEach(function (el) {
        el.onclick = function (ev) {
          ev.stopPropagation();
          UI.removeAt(parseInt(el.getAttribute('data-del'), 10));
        };
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
      ph.querySelectorAll('[data-modesend]').forEach(function (el) {
        el.onclick = function () {
          var kind = el.dataset.modesend;
          var inp = ph.querySelector('#lzw-modeinput');
          var t = inp ? inp.value.trim() : '';
          if (!t) return;
          UI.stageTyped(kind, t);
        };
      });
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
      try {
        var result = await withTimeout(eng.generateFor(this.chatKey, this.isGroup), 90000);
        this.failed = false;
        if (result && result.msgs && result.msgs.length) {
          W.Store.push(this.chatKey, result.msgs, 100);
          if (this.screen === 'chat' && this.chatKey === result.key) this.render();
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
    }
  };

  // 生成超时保护：API 故障时 generateRaw 可能永远不返回，不兜底会让小飞机永远失灵
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (resolve, reject) {
        setTimeout(function () { reject(new Error('生成超时（' + Math.round(ms / 1000) + '秒无响应），请重试')); }, ms);
      })
    ]);
  }

  function appbarHtml(screen, disp, act) {
    if (screen === 'home') return ''; // 真手机主屏没有标题栏
    if (screen === 'list') return '<div class="lzw-appbar"><span class="lzw-back" data-act="home">' + ICON_BACK + '</span><span class="lzw-appbar-t">微信</span><span class="lzw-appbar-r"></span></div>';
    return '<div class="lzw-appbar"><span class="lzw-back" data-act="list">' + ICON_BACK + '</span><span class="lzw-appbar-t">' + esc(disp || '') + '</span><span class="lzw-appbar-r">' +
      (act === 'reroll' ? '<span class="lzw-reroll" data-act="reroll" title="重新生成对方的上一条回复">↻</span>'
        : act === 'retry' ? '<span class="lzw-reroll" data-act="reroll" title="上一条消息发送失败，点击重新获取回复">↻</span>'
        : '') +
      '</span></div>';
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
      var hint = panel === 'image' ? '图片：描述画面' : panel === 'voice' ? '语音：要说的话' : '定位：地点名';
      return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-modeform">' +
        '<span class="hint">' + hint + '</span>' +
        '<input class="lzw-input" id="lzw-modeinput" maxlength="200">' +
        '<button class="lzw-send" data-modesend="' + panel + '">发送</button></div></div>';
    }
    // actions
    return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-actions">' +
      '<div class="lzw-act" data-mode="sticker"><div class="lzw-act-ico">' + ICO.sticker + '</div><span>表情</span></div>' +
      '<div class="lzw-act" data-mode="image"><div class="lzw-act-ico">' + ICO.image + '</div><span>图片</span></div>' +
      '<div class="lzw-act" data-mode="voice"><div class="lzw-act-ico">' + ICO.voice + '</div><span>语音</span></div>' +
      '<div class="lzw-act" data-mode="poke"><div class="lzw-act-ico">' + ICO.poke + '</div><span>戳一戳</span></div>' +
      '<div class="lzw-act" data-mode="location"><div class="lzw-act-ico">' + ICO.location + '</div><span>定位</span></div>' +
      '</div></div>';
  }

  // 用 visualViewport 计算位置：F12/移动仿真/页面缩放下依然落在可视区右下角
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
    var left = (vp ? vp.offsetLeft : 0) + vw - w - 8;
    var top = (vp ? vp.offsetTop : 0) + vh - h - 8;
    ph.style.left = Math.max(4, left) + 'px';
    ph.style.top = Math.max(4, top) + 'px';
    ph.style.right = 'auto';
    ph.style.bottom = 'auto';
  }

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Apps = window.LZWorld.Apps || {};
  window.LZWorld.Apps.wechat = UI;
})();
