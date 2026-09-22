// ═══════════════════════════════════════════════════════════
//  apps/wechat-home.js —— 桌面屏：壁纸/大时钟/app 网格/角标
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodyHome = function (ctx) {
    var W = ctx.W, eng = ctx.eng, clock = ctx.clock, dateShort = ctx.dateShort;
    var totalUn = 0;
    try {
      // 桌面图标是 app 级角标：会话未读 + 朋友圈动态未读（朋友对机主动态的赞/评论）都上角标，
      // 与发现 tab 红点是同一份计数（Store.meta(momentsKey).unread）
      // 存量兜底：历史遗留的幽灵会话键（错收件人）不过白名单，永不上桌面角标
      var allowK = eng.phoneAllow ? eng.phoneAllow() : null;
      W.Store.historyKeys().forEach(function (k) {
        if (allowK && !allowK[k] && k !== eng.momentsKey) return;
        totalUn += W.Store.meta(k).unread || 0;
      });
    } catch (e0) {}
    // 论坛 app 角标：当前线所有论坛的（总条目 - 已读标记）之和
    var funTotal = 0;
    try {
      var fline0 = W.Store.line() || '';
      W.Store.forumNames(fline0).forEach(function (fn0) {
        var fm0 = W.Store.forumGet(fline0, fn0);
        var seen0 = 0;
        try { seen0 = (W.Store.meta('forum:' + fline0 + ':' + fn0) || {}).seen || 0; } catch (e1) {}
        var tot0 = 0;
        ((fm0 && fm0.posts) || []).forEach(function (p0) { tot0 += 1 + (p0.replies || []).length; });
        funTotal += Math.max(0, tot0 - seen0);
      });
    } catch (e0) {}
    body =
      '<div class="lzw-body"><div class="lzw-home-wall">' +
      '<div class="lzw-hometime"><div class="t">' + C.esc(clock) + '</div><div class="d">' + C.esc(dateShort || '霖州') + '</div></div>' +
      '<div class="lzw-homegrid">' +
      '<div class="lzw-app" data-app="wechat"><div class="lzw-app-ico" style="background:#22c05e;border:none;position:relative">' + C.ICON_WECHAT +
      (totalUn ? '<span class="lzw-appdot">' + (totalUn > 99 ? '99+' : totalUn) + '</span>' : '') + '</div><span>微信</span></div>' +
      '<div class="lzw-app" data-app="memo"><div class="lzw-app-ico" style="background:#e2a600;border:none;color:#fff">' + C.ICON_MEMO + '</div><span>备忘录</span></div>' +
      '<div class="lzw-app" data-app="forum"><div class="lzw-app-ico" style="background:#e8912d;border:none;color:#fff;position:relative">' + C.ICON_FORUM + (funTotal ? '<span class="lzw-appdot">' + (funTotal > 99 ? '99+' : funTotal) + '</span>' : '') + '</div><span>论坛</span></div>' +
      '<div class="lzw-app" data-app="settings"><div class="lzw-app-ico" style="background:#8e97a8;border:none;color:#fff">' + C.ICON_GEAR + '</div><span>设置</span></div>' +
      '<div class="lzw-app" data-app="close" title="收起手机"><div class="lzw-app-ico" style="background:#e5484d;border:none;color:#fff">' + C.ICON_POWEROFF + '</div><span>关闭</span></div>' +
      '</div></div></div>';
  };


  UI._binders.push(function (ph) {
    ph.querySelectorAll('[data-app="wechat"]').forEach(function (el) {
      el.onclick = function () { UI.screen = 'list'; UI.render(); };
    });
    // 主屏「关闭」app：收起手机。保险——小屏上弹窗可能盖住酒馆页的 QR 开关，
    // 万一被挡死，手机上永远有第二条路可以关掉自己
    ph.querySelectorAll('[data-app="close"]').forEach(function (el) {
      el.onclick = function () { UI.toggle(); };
    });
    // 设置 app：模式单选 / 数值与文本即时保存 / 拉取模型与预设列表 / 点选回填
    ph.querySelectorAll('[data-app="settings"]').forEach(function (el) {
      el.onclick = function () { UI.screen = 'settings'; UI._setpick = null; UI.render(); };
    });
    // 备忘录 app：进列表（选人 chips + 存档 + 写一篇）
    ph.querySelectorAll('[data-app="memo"]').forEach(function (el) {
      el.onclick = function () { UI.openMemo(); };
    });
  });
})();
