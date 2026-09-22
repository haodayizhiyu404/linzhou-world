// ═══════════════════════════════════════════════════════════
//  apps/wechat-list.js —— 列表屏：会话（微信tab）/通讯录/发现tab + 联系人详细资料
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodyList = function (ctx) {
    var W = ctx.W, eng = ctx.eng;
    var sec = eng.section();
    var rowsHtml = '';
    if (this.tab === 'discover') {
      // 发现页：朋友圈入口（红点 = 机主不在场时新产生的接话评论数），无缩略行
      var mUn = 0;
      try { mUn = W.Store.meta(eng.momentsKey).unread || 0; } catch (e0) {}
      rowsHtml =
        '<div class="lzw-disc-row" data-mom="1"><div class="lzw-disc-ico">' + C.ICON_MOMENTS + '</div>' +
        '<div class="lzw-disc-main"><div class="lzw-disc-name">朋友圈</div></div>' +
        (mUn ? '<span class="lzw-unread">' + (mUn > 99 ? '99+' : mUn) + '</span>' : '') +
        '<span class="lzw-disc-chev">' + C.ICON_CHEV + '</span></div>';
    } else if (this.tab === 'contacts') {
      // 通讯录：群聊分组（点直接进群）+ 联系人平铺（点进详细资料）
      if (sec) {
        var gRows = (sec.groups || []).map(function (g) {
          var gav = g.avatar
            ? '<img class="lzw-ava" src="' + C.esc(W.Worldbook.imgUrl(g.avatar)) + '">'
            : '<div class="lzw-ava">👥</div>';
          return '<div class="lzw-conv" data-key="group:' + C.esc(g.name) + '" data-group="1">' + gav +
            '<div class="lzw-conv-main"><div class="lzw-conv-name">' + C.esc(g.name) + '</div></div></div>';
        }).join('');
        var pRows = (sec.contacts || []).map(function (c) {
          var cav = c.avatar
            ? '<img class="lzw-ava" src="' + C.esc(W.Worldbook.imgUrl(c.avatar)) + '">'
            : '<div class="lzw-ava">' + C.esc(c.name.slice(0, 1)) + '</div>';
          return '<div class="lzw-conv" data-cdet="' + C.esc(c.name) + '">' + cav +
            '<div class="lzw-conv-main"><div class="lzw-conv-name">' + C.esc(c.name) + '</div></div></div>';
        }).join('');
        rowsHtml =
          (gRows ? '<div class="lzw-sechead">群聊</div>' + gRows : '') +
          (pRows ? '<div class="lzw-sechead">联系人</div>' + pRows : '') ||
          '<div class="lzw-sysrow">本世界线暂无联系人</div>';
      } else {
        rowsHtml = '<div class="lzw-sysrow">未定位到当前世界线<br>进行一次主对话生成后自动归位</div>';
      }
    } else if (sec) {
      var convs = [];
      var kindCn = { sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' };
      (sec.contacts || []).forEach(function (c) { convs.push({ key: c.name, name: c.name, avatar: c.avatar, group: false }); });
      (sec.groups || []).forEach(function (g) { convs.push({ key: 'group:' + g.name, name: g.name, avatar: g.avatar || '', group: true }); });
      // 只留有消息的会话；按最后一条消息的时间倒序（真微信：最近说话的排最上面）
      var dayNum = function (s) {
        var m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(s || '');
        return m ? (+m[1]) * 372 + (+m[2]) * 31 + (+m[3]) : -1;
      };
      convs = convs.filter(function (cv) { return W.Store.history(cv.key).length > 0; });
      convs.sort(function (a, b) {
        var ha = W.Store.history(a.key), hb = W.Store.history(b.key);
        var la = ha[ha.length - 1], lb = hb[hb.length - 1];
        var da = dayNum(la && la.day), db = dayNum(lb && lb.day);
        if (da !== db) return db - da;
        var ta = (la && la.time) || '', tb = (lb && lb.time) || '';
        return ta === tb ? 0 : (ta > tb ? -1 : 1);
      });
      rowsHtml = convs.map(function (cv) {
        var h = W.Store.history(cv.key);
        var last = h[h.length - 1];
        var prev = last
          ? (last.kind === 'text' ? last.text
            : last.kind === 'calllog' ? '[' + (last.mode === 'video' ? '视频通话' : '语音通话') + ']'
            : '[' + (kindCn[last.kind] || last.kind) + ']')
          : '';
        var av = cv.avatar
          ? '<img class="lzw-ava" src="' + C.esc(W.Worldbook.imgUrl(cv.avatar)) + '">'
          : (cv.group ? '<div class="lzw-ava">👥</div>' : '<div class="lzw-ava">' + C.esc(cv.name.slice(0, 1)) + '</div>');
        return '<div class="lzw-conv" data-key="' + C.esc(cv.key) + '" data-group="' + (cv.group ? 1 : 0) + '">' +
          av + '<div class="lzw-conv-main"><div class="lzw-conv-name">' + C.esc(cv.name) + '</div>' +
          '<div class="lzw-conv-prev">' + C.esc(prev) + '</div></div>' +
          (function () { var un = W.Store.meta(cv.key).unread || 0; return un ? '<span class="lzw-unread">' + (un > 99 ? '99+' : un) + '</span>' : ''; })() +
          '</div>';
      }).join('') || '<div class="lzw-sysrow">暂无会话<br>去通讯录找人聊聊吧</div>';
      // 陌生人：有私聊记录但不在本线通讯录（吃瓜群群友私聊机主/旧线残留）。
      // 灰底首字头像（无头像资源），可整段删除。call: 是通话字幕键、
      // momentsKey 是朋友圈，都不属于会话；群聊走 roster 渲染，不在此列。
      var cSet = {};
      (sec.contacts || []).forEach(function (c) { cSet[c.name] = 1; });
      var strs = W.Store.historyKeys().filter(function (k) {
        if (k.indexOf('group:') === 0 || k.indexOf('call:') === 0 || k.indexOf('memo:') === 0 || k === eng.momentsKey) return false;
        if (cSet[k]) return false;
        return W.Store.history(k).length > 0;
      });
      if (strs.length) {
        strs.sort(function (a, b) {
          var ha = W.Store.history(a), hb = W.Store.history(b);
          var la = ha[ha.length - 1], lb = hb[hb.length - 1];
          var da2 = dayNum(la && la.day), db2 = dayNum(lb && lb.day);
          if (da2 !== db2) return db2 - da2;
          var ta2 = (la && la.time) || '', tb2 = (lb && lb.time) || '';
          return ta2 === tb2 ? 0 : (ta2 > tb2 ? -1 : 1);
        });
        rowsHtml += '<div class="lzw-sechead">陌生人</div>' + strs.map(function (k) {
          var hs = W.Store.history(k);
          var lasts = hs[hs.length - 1];
          var prevs = lasts
            ? (lasts.kind === 'text' ? lasts.text
              : lasts.kind === 'calllog' ? '[' + (lasts.mode === 'video' ? '视频通话' : '语音通话') + ']'
              : '[' + (kindCn[lasts.kind] || lasts.kind) + ']')
            : '';
          var uns = W.Store.meta(k).unread || 0;
          return '<div class="lzw-conv lzw-sconv" data-key="' + C.esc(k) + '" data-group="0">' +
            '<div class="lzw-ava">' + C.esc(k.slice(0, 1)) + '</div>' +
            '<div class="lzw-conv-main"><div class="lzw-conv-name">' + C.esc(k) + '</div>' +
            '<div class="lzw-conv-prev">' + C.esc(prevs) + '</div></div>' +
            (uns ? '<span class="lzw-unread">' + (uns > 99 ? '99+' : uns) + '</span>' : '') +
            '<span class="lzw-setdel" data-sdel="' + C.esc(k) + '" title="删除会话">✕</span></div>';
        }).join('');
      }
    } else {
      rowsHtml = '<div class="lzw-sysrow">未定位到当前世界线<br>进行一次主对话生成后自动归位</div>';
    }
    // 底栏：微信 | 通讯录 | 发现（发现挂朋友圈未读红点；微信挂会话总红点）
    var totalUn2 = 0;
    try {
      // 只算会话未读；朋友圈的未读挂发现 tab（mUn2），别混进微信 tab
      // 存量兜底：幽灵会话键不过白名单，微信 tab 红点只数真会话
      var allowK2 = eng.phoneAllow ? eng.phoneAllow() : null;
      W.Store.historyKeys().forEach(function (k) {
        if (k === eng.momentsKey) return;
        if (allowK2 && !allowK2[k]) return;
        totalUn2 += W.Store.meta(k).unread || 0;
      });
    } catch (e0) {}
    var mUn2 = 0;
    try { mUn2 = W.Store.meta(eng.momentsKey).unread || 0; } catch (e0) {}
    body = '<div class="lzw-body">' + rowsHtml + '</div>' +
      '<div class="lzw-tabbar">' +
      '<button class="lzw-tab' + (this.tab === 'chats' ? ' on' : '') + '" data-tab="chats">' + C.ICON_TAB_CHAT + '<span>微信</span>' + (totalUn2 ? '<span class="lzw-tabdot">' + (totalUn2 > 99 ? '99+' : totalUn2) + '</span>' : '') + '</button>' +
      '<button class="lzw-tab' + (this.tab === 'contacts' ? ' on' : '') + '" data-tab="contacts">' + C.ICON_TAB_CONT + '<span>通讯录</span></button>' +
      '<button class="lzw-tab' + (this.tab === 'discover' ? ' on' : '') + '" data-tab="discover">' + C.ICON_TAB_DISC + '<span>发现</span>' + (mUn2 ? '<span class="lzw-tabdot">' + (mUn2 > 99 ? '99+' : mUn2) + '</span>' : '') + '</button>' +
      '</div>';
  };

  // 联系人详细资料：头像姓名 + 朋友圈入口（带最新动态预览）+ 发消息/通话
  UI.bodyCdetail = function (ctx) {
    var W = ctx.W, eng = ctx.eng;
    var dn = this.cdetName || '';
    var dc = eng.findContact(dn) || {};
    var dLast = '';
    try {
      var dfeed = eng.momentsFeed();
      for (var di = dfeed.length - 1; di >= 0; di--) {
        if (dfeed[di].who === dn) { dLast = String(dfeed[di].text || '').slice(0, 18); break; }
      }
    } catch (e0) {}
    var dav = dc.avatar
      ? '<img class="lzw-cava" src="' + C.esc(W.Worldbook.imgUrl(dc.avatar)) + '">'
      : '<div class="lzw-cava">' + C.esc(dn.slice(0, 1)) + '</div>';
    body = '<div class="lzw-body">' +
      '<div class="lzw-cdetcard">' + dav + '<div class="lzw-cdetnm">' + C.esc(dn) + '</div></div>' +
      '<div class="lzw-cdetrow" data-mpf="' + C.esc(dn) + '" data-mfrom="cdetail">' +
      '<span class="l">朋友圈</span>' +
      '<span class="lzw-cdetpv">' + C.esc(dLast || '还没发动态') + '</span>' +
      '<span class="lzw-cdetcv">' + C.ICON_CHEV + '</span></div>' +
      '<div class="lzw-cdetmsg" data-cmsg="' + C.esc(dn) + '">发消息</div>' +
      '<div class="lzw-cdetcalls">' +
      '<div class="lzw-cdetcall" data-ccall="' + C.esc(dn) + ':audio">' + C.ICON_CALL + '<span>语音通话</span></div>' +
      '<div class="lzw-cdetcall" data-ccall="' + C.esc(dn) + ':video">' + C.ICON_VCALL + '<span>视频通话</span></div>' +
      '</div></div>';
  };


  UI._binders.push(function (ph) {
    // 微信底栏 tab：微信 | 发现
    ph.querySelectorAll('[data-tab]').forEach(function (el) {
      el.onclick = function () { UI.tab = el.dataset.tab; UI.render(); };
    });
    // 发现页：朋友圈入口
    ph.querySelectorAll('[data-mom]').forEach(function (el) {
      el.onclick = function () { UI.openMoments(); };
    });
    // 通讯录：联系人行 → 详细资料；详细资料页：发消息 / 语音·视频通话
    ph.querySelectorAll('[data-cdet]').forEach(function (el) {
      el.onclick = function () {
        UI.cdetName = el.dataset.cdet;
        UI.screen = 'cdetail';
        UI.panel = null;
        UI.render();
      };
    });
    ph.querySelectorAll('[data-cmsg]').forEach(function (el) {
      el.onclick = function () { UI.openChat(el.dataset.cmsg, false); };
    });
    ph.querySelectorAll('[data-ccall]').forEach(function (el) {
      el.onclick = function () {
        var p = el.dataset.ccall.split(':');
        if (p.length !== 2) return;
        UI.chatKey = p[0];
        UI.isGroup = false;
        UI.panel = null;
        UI.dial(p[1]);
      };
    });
    // 论坛行（.lzw-frow）也是 .lzw-conv，必须排除——否则点击进空白聊天页
    ph.querySelectorAll('.lzw-conv:not(.lzw-linerow):not([data-cdet]):not(.lzw-frow)').forEach(function (el) {
      el.onclick = function () { UI.openChat(el.dataset.key, el.dataset.group === '1'); };
    });
    // 陌生人会话 ✕：删整段记录（确认弹窗在壳上，sdelok/sdelno 统一处置）
    ph.querySelectorAll('[data-sdel]').forEach(function (el) {
      el.onclick = function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        UI.sConfirmDel = el.dataset.sdel;
        UI.render();
      };
    });
  });
})();
