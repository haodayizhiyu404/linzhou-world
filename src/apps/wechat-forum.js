// ═══════════════════════════════════════════════════════════
//  apps/wechat-forum.js —— 论坛屏：论坛列表/版面/帖子/盖楼重roll
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodyForum = function (ctx) { return forumListHtml(); };
  UI.bodyFboard = function (ctx) { return forumBoardHtml(this.forumName); };
  UI.bodyFthread = function (ctx) { return forumThreadHtml(this.forumName, this.fThread); };

  // ── 论坛辅助 ──
  function forumLineKey() {
    try { return window.LZWorld.Store.line() || ''; } catch (e) { return ''; }
  }
  function forumTotal(f) {
    var n = 0;
    ((f && f.posts) || []).forEach(function (p) { n += 1 + (p.replies || []).length; });
    return n;
  }
  function forumUnread(name) {
    var line = forumLineKey();
    var f = window.LZWorld.Store.forumGet(line, name);
    if (!f) return 0;
    var seen = 0;
    try { seen = (window.LZWorld.Store.meta('forum:' + line + ':' + name) || {}).seen || 0; } catch (e) {}
    return Math.max(0, forumTotal(f) - seen);
  }
  function shortTime(t) {
    var m = /(\d{4})年(\d{1,2})月(\d{1,2})日\s*([\d:]{4,5})/.exec(String(t || ''));
    if (!m) return String(t || '').slice(0, 12);
    return m[2] + '-' + m[3] + ' ' + m[4];
  }
  function fmtCreated(ms) {
    var d = new Date(ms);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  var DICE_A = ['霖州', '霖州城南', '霖州城西', '老城区', '大学城', '天禧城'];
  var DICE_B = ['生活', '灌水', '花草', '宠物', '吃喝玩乐', '恋爱交友', '二手闲置', '八卦', '学习', '职场', '游戏', '影音', '树洞'];
  var DICE_C = ['墙', '吧', '论坛', '小组', '社区', '圈', '板'];
  function diceName() {
    var p = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
    return p(DICE_A) + p(DICE_B) + p(DICE_C);
  }
  // 选线弹窗定位：按可视视口（visualViewport）矩形落位，小屏/移动端/缩放下
  // 始终跟着玩家实际可见的区域走；flex 负责把卡片居中其中
  function forumListHtml() {
    var line = forumLineKey();
    var names = [];
    try { names = window.LZWorld.Store.forumNames(line); } catch (e) {}
    var rows = names.map(function (n) {
      var f = window.LZWorld.Store.forumGet(line, n) || { posts: [] };
      var un = forumUnread(n);
      return "<div class='lzw-conv lzw-frow' data-fopen='" + C.esc(n) + "'>" +
        "<div class='lzw-fico'>论</div>" +
        "<div class='lzw-conv-main'><div class='lzw-conv-name'>" + C.esc(n) + (un ? "<span class='lzw-appdot lzw-fdot'>" + (un > 99 ? '99+' : un) + "</span>" : '') + "</div>" +
        "<div class='lzw-conv-prev'>" + (f.posts || []).length + ' 帖 · 创建于 ' + fmtCreated(f.createdAt || Date.now()) + "</div></div>" +
        "<span class='lzw-setdel' data-fdel='" + C.esc(n) + "' title='删除论坛'>✕</span></div>";
    }).join('');
    return '<div class="lzw-body">' +
      '<div class="lzw-fnew"><input class="lzw-fin" data-fnew maxlength="16" placeholder="输入论坛名，进入即创建">' +
      '<button class="lzw-fgo" data-fgo>进入</button><button class="lzw-fdice" data-fdice title="随机取名">🎲</button></div>' +
      (rows ? rows : "<div class='lzw-fempty'>还没有论坛<br>输入名字创建，或点 🎲 随机来一个</div>") +
      '</div>';
  }
  function forumBoardHtml(name) {
    var f = window.LZWorld.Store.forumGet(forumLineKey(), name);
    if (!f || !(f.posts || []).length) {
      return '<div class="lzw-body"><div class="lzw-fempty">' +
        (UI.fBusy ? '论坛加载中…' : '这里还没有帖子<br><button class="lzw-fretry" data-fretry="' + C.esc(name) + '">生成一版</button>') +
        '</div></div>';
    }
    var rows = f.posts.map(function (p, i) {
      return "<div class='lzw-conv lzw-frow' data-fthr='" + i + "'>" +
        "<div class='lzw-conv-main'><div class='lzw-ftitle'>" + C.esc(p.title) +
        (p.carried ? "<span class='lzw-fcarried'>考古</span>" : '') + "</div>" +
        "<div class='lzw-fsub'>" + C.esc(p.author) + ' · ' + (p.time ? C.esc(shortTime(p.time)) : '很久以前') +
        ' · ' + (p.replies || []).length + ' 回复</div></div></div>';
    }).join('');
    return '<div class="lzw-body">' + rows + '</div>';
  }
  function forumThreadHtml(name, idx) {
    var f = window.LZWorld.Store.forumGet(forumLineKey(), name);
    var p = f && (f.posts || [])[idx];
    if (!p) return '<div class="lzw-body"><div class="lzw-fempty">帖子不存在</div></div>';
    var reps = (p.replies || []).map(function (r) {
      return "<div class='lzw-frep'><span class='lzw-frep-a'>" + C.esc(r.author) + "</span>：" + C.esc(r.text) + "</div>";
    }).join('');
    return '<div class="lzw-body">' +
      "<div class='lzw-fmain'><div class='lzw-ftitle lzw-fmain-t'>" + C.esc(p.title) + "</div>" +
      "<div class='lzw-fsub'>" + C.esc(p.author) + ' · ' + (p.time ? C.esc(p.time) : '很久以前') + "</div>" +
      "<div class='lzw-fmain-b'>" + C.esc(p.text) + "</div></div>" +
      (reps ? "<div class='lzw-freps'>" + reps + "</div>" : '') +
      '</div>';
  }

  UI.forumLineKey = forumLineKey;

  Object.assign(UI, {
    openForum: function (name) {
      var W = window.LZWorld;
      name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      if (!name) { try { toastr.info('先输入论坛名', '霖州手机'); } catch (e) {} return; }
      var line = forumLineKey();
      // 同名已存在（含空白差异）→ 直接打开；新名字 → 先建空壳（列表留住它），进入后生成内容
      var stripped = name.replace(/\s+/g, '');
      for (var fn2 in ((W.Store.forumAll() || {})[line] || {})) {
        if (String(fn2).replace(/\s+/g, '') === stripped) { name = fn2; break; }
      }
      if (!W.Store.forumGet(line, name)) W.Store.forumPut(line, name, { posts: [] });
      this.forumName = name;
      this.fThread = -1;
      this.screen = 'fboard';
      this.render();
      var self = this;
      this.fBusy = true;
      W.Engine.forumEnsure(line, name).then(function (got) {
        if (got) try { toastr.info('「' + name + '」已生成一版帖子', '霖州手机', { timeOut: 3000 }); } catch (e) {}
      }).catch(function (e) {
        console.warn('[霖州引擎] 论坛生成失败', e);
        try { toastr.error('论坛生成失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.fBusy = false;
        self.markForumSeen();
        if (self.screen === 'fboard' || self.screen === 'fthread') self.render();
      });
    },
    // 打开即已读：把「已看到条目数」记进 meta，回列表后未读清零
    markForumSeen: function () {
      var line = forumLineKey();
      var f = window.LZWorld.Store.forumGet(line, this.forumName);
      if (!f) return;
      try { window.LZWorld.Store.setMeta('forum:' + line + ':' + this.forumName, { seen: forumTotal(f) }); } catch (e) {}
    },
    // 重roll 这一版：新帖全部作废重生成，考古旧帖（别的线带过来的）保留
    rerollForum: function () {
      var W = window.LZWorld;
      var name = this.forumName;
      if (!name || this.fBusy) return;
      var self = this, line = forumLineKey();
      this.fBusy = true;
      this.render();
      W.Engine.forumReroll(line, name).then(function () {
        try { toastr.info('已重新生成一版帖子', '霖州手机', { timeOut: 2000 }); } catch (e) {}
      }).catch(function (e) {
        console.warn('[霖州引擎] 论坛重roll失败', e);
        try { toastr.error('重roll失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.fBusy = false;
        self.markForumSeen();
        if (self.screen === 'fboard' || self.screen === 'fthread') self.render();
      });
    },

  });


  UI._binders.push(function (ph) {
    // 论坛：入口 / 输入回车或点进入 / 骰子随机取名 / ✕删除 / 进版 / 进帖 / 空版重试
    ph.querySelectorAll('[data-app="forum"]').forEach(function (el) {
      el.onclick = function () { UI.screen = 'forum'; UI.render(); };
    });
    ph.querySelectorAll('[data-fgo]').forEach(function (el) {
      el.onclick = function () {
        var inp = ph.querySelector('[data-fnew]');
        UI.openForum(inp ? inp.value : '');
      };
    });
    ph.querySelectorAll('[data-fnew]').forEach(function (el) {
      el.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); UI.openForum(el.value); } };
    });
    ph.querySelectorAll('[data-fdice]').forEach(function (el) {
      el.onclick = function () {
        var inp = ph.querySelector('[data-fnew]');
        if (inp) { inp.value = diceName(); inp.focus(); }
      };
    });
    ph.querySelectorAll('[data-fdel]').forEach(function (el) {
      el.onclick = function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        UI.fConfirmDel = el.dataset.fdel;
        UI.render();
      };
    });
    ph.querySelectorAll('[data-fopen]').forEach(function (el) {
      el.onclick = function () { UI.openForum(el.dataset.fopen); };
    });
    ph.querySelectorAll('[data-fthr]').forEach(function (el) {
      el.onclick = function () { UI.fThread = +el.dataset.fthr; UI.screen = 'fthread'; UI.render(); };
    });
    ph.querySelectorAll('[data-fretry]').forEach(function (el) {
      el.onclick = function () { UI.openForum(el.dataset.fretry); };
    });
    ph.querySelectorAll('[data-fact="freroll"]').forEach(function (el) {
      el.onclick = function () { UI.rerollForum(); };
    });
  });
})();
