// ═══════════════════════════════════════════════════════════
//  apps/wechat-callhist.js —— 通话记录回看：分节列表 + 只读 transcript（零生成）
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  // 通话记录列表：视频/语音各一节，按时间倒序；点行进只读 transcript（无任何生成）
  UI.bodyCallhist = function (ctx) {
    var W2 = window.LZWorld, eng = W2.Engine;
    var hn = this.histName || '';
    var hSess = [];
    try { hSess = eng.callSessions(hn); } catch (e0) {}
    var hCurDay = '';
    try { hCurDay = W2.Status.snapshot(null).dateText; } catch (e0) {}
    var histRows = function (mode) {
      return hSess.map(function (s, idx) { return { s: s, idx: idx }; })
        .filter(function (x) { return x.s.mode === mode; })
        .map(function (x) {
          var when = (x.s.day ? C.relDay(x.s.day, hCurDay) : '') + (x.s.time ? ' ' + x.s.time : '');
          var meta = (mode === 'video' ? '视频通话' : '语音通话') + ' · ' +
            (x.s.dur || (x.s.interrupted ? '中断' : '已接通')) + ' · ' + x.s.count + '条';
          return '<div class="lzw-chistrow" data-chv="' + x.idx + '">' +
            '<span class="lzw-chist-ico">' + (mode === 'video' ? C.ICON_VCALL : C.ICON_CALL) + '</span>' +
            '<span class="lzw-chist-main"><b>' + C.esc(when || '时间未知') + '</b><i>' + C.esc(meta) + '</i></span>' +
            '<span class="lzw-cdetcv">' + C.ICON_CHEV + '</span></div>';
        }).join('');
    };
    var vRows = histRows('video'), aRows = histRows('audio');
    return '<div class="lzw-body">' +
      (vRows ? "<div class='lzw-sechead'>视频通话</div>" + vRows : '') +
      (aRows ? "<div class='lzw-sechead'>语音通话</div>" + aRows : '') +
      ((!vRows && !aRows) ? '<div class="lzw-sysrow">还没有通话记录</div>' : '') +
      '</div>';
  };

  // 只读 transcript：整屏复刻通话氛围（暗底/头像顶栏/气泡/画面行与通话屏同款），零生成零请求
  UI.bodyCallview = function (ctx) {
    var W2 = window.LZWorld, eng = W2.Engine;
    var vn = this.histName || '';
    var vSess = [];
    try { vSess = eng.callSessions(vn); } catch (e0) {}
    var sv = vSess[this.histIdx] || null;
    if (!sv) return '<div class="lzw-body"><div class="lzw-sysrow">记录不存在</div></div>';
    var seg = W2.Store.history(eng.callKey(vn)).slice(sv.start, sv.end)
      .filter(function (m) { return m.who !== 'sys'; });
    var vav = '';
    try {
      var vc = eng.findContact(vn) || {};
      vav = vc.avatar ? '<img src="' + C.esc(W2.Worldbook.imgUrl(vc.avatar)) + '">' : C.esc(vn.slice(0, 1));
    } catch (e0) { vav = C.esc(vn.slice(0, 1)); }
    var vStatus = (sv.mode === 'video' ? '视频通话' : '语音通话') + (sv.dur ? ' · ' + sv.dur : '') +
      (sv.interrupted ? ' · 中断' : '');
    var bub = seg.map(function (m) {
      if (m.kind === 'scene') return '<div class="lzw-callscene">' + C.esc(m.text || '').replace(/\n/g, '<br>') + '</div>';
      return '<div class="lzw-sub' + (m.who === 'user' ? ' me' : '') + '">' + C.esc(m.text || '') + '</div>';
    }).join('');
    // 与通话界面同构：音频=头像即身份；视频=头像化作背景大图，保留名字
    return '<div class="lzw-callbody">' +
      '<div class="lzw-calltop">' +
      (sv.mode === 'video'
        ? '<div class="lzw-callname">' + C.esc(vn) + '</div>'
        : '<div class="lzw-callava">' + vav + '</div>') +
      '<div class="lzw-callstatus">' + C.esc(vStatus) + '</div></div>' +
      '<div class="lzw-callsubs">' + bub + '</div></div>';
  };


  UI._binders.push(function (ph) {
    // 详细资料页：通话记录入口 → 列表 → 只读 transcript
    ph.querySelectorAll('[data-chist]').forEach(function (el) {
      el.onclick = function () {
        UI.histName = el.dataset.chist;
        UI.screen = 'callhist';
        UI.panel = null;
        UI.render();
      };
    });
    ph.querySelectorAll('[data-chv]').forEach(function (el) {
      el.onclick = function () {
        UI.histIdx = parseInt(el.dataset.chv, 10) || 0;
        UI.screen = 'callview';
        UI.panel = null;
        UI.render();
      };
    });
  });
})();
