// ═══════════════════════════════════════════════════════════
//  apps/wechat-forum.js —— 论坛屏：列表/收藏/版面/帖子（两阶段懒加载）
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
//  契约见 engine.js 论坛块：目录 [帖:网名:标题:预览:赞:评]；帖子 正文+[热评]+[回复]+[评论]
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodyForum = function (ctx) { return forumListHtml(); };
  UI.bodyFav = function (ctx) { return forumFavHtml(); };
  UI.bodyFboard = function (ctx) { return forumBoardHtml(this.forumName); };
  UI.bodyFthread = function (ctx) { return forumThreadHtml(this.forumName, this.fThreadId); };

  // ── 论坛辅助 ──
  function forumLineKey() {
    try { return window.LZWorld.Store.line() || ''; } catch (e) { return ''; }
  }
  // 兼容旧数据：新版帖 {body,hot,latest,generated}，旧版内联帖 {text,replies:[]}
  function postId(p) { return p.id || (p.author + '|' + p.title); }
  function postBody(p) { return p.body || p.text || ''; }
  function postHot(p) { return p.hot || []; }
  function postLatest(p) { return p.latest || p.replies || []; }
  function postReady(p) { return !!(p.generated || p.text); }
  function forumTotal(f) {
    var n = 0;
    ((f && f.posts) || []).forEach(function (p) {
      n += 1 + postLatest(p).length;
      postHot(p).forEach(function (h) { n += 1 + (h.nest || []).length; });
    });
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

  // ── 论坛小图标：线性描边风，与壳 ICO 一致 ──
  function fLike(color, size) {
    return "<svg width='" + size + "' height='" + size + "' viewBox='0 0 24 24' fill='none' stroke='" + color + "' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><path d='M6.6 19.4v-8.8'/><path d='M6.6 10.6 11.9 4.4a1.5 1.5 0 0 1 2.6 1.1V9h4a2 2 0 0 1 2 2.5l-1.2 6.2a2 2 0 0 1-2 1.7H6.6'/><path d='M4 11h2.6v8.4H4a1 1 0 0 1-1-1v-6.4a1 1 0 0 1 1-1z'/></svg>";
  }
  function fCmt(color, size) {
    return "<svg width='" + size + "' height='" + size + "' viewBox='0 0 24 24' fill='none' stroke='" + color + "' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><path d='M20.6 11.7a8.4 8.4 0 0 1-8.4 8.4H7.2L3.4 22.5V11.7a8.4 8.4 0 0 1 8.4-8.4h.4a8.4 8.4 0 0 1 8.4 8.4z'/></svg>";
  }
  function fStar(filled, size, color) {
    var p = 'M12 3.8l2.5 5.2 5.7.8-4.1 4 .9 5.7-5-2.7-5 2.7.9-5.7-4.1-4 5.7-.8z';
    return filled
      ? "<svg width='" + size + "' height='" + size + "' viewBox='0 0 24 24' fill='" + (color || '#e8912d') + "'><path d='" + p + "'/></svg>"
      : "<svg width='" + size + "' height='" + size + "' viewBox='0 0 24 24' fill='none' stroke='" + (color || '#b6bac2') + "' stroke-width='2' stroke-linejoin='round'><path d='" + p + "'/></svg>";
  }

  function forumListHtml() {
    var line = forumLineKey();
    var names = [];
    try { names = window.LZWorld.Store.forumNames(line); } catch (e) {}
    var favN = 0;
    try { favN = W.Engine.forumFavorites(line).length; } catch (e) {}
    var favRow = "<div class='lzw-conv lzw-frow" + (favN ? '' : ' lzw-fdim') + "' data-favopen>" +
      "<div class='lzw-fico lzw-fico-star'>★</div>" +
      "<div class='lzw-conv-main'><div class='lzw-conv-name'>我的收藏</div>" +
      "<div class='lzw-conv-prev'>" + (favN ? favN + ' 条钉住的帖子' : '帖子页右上角 ☆ 钉住') + "</div></div></div>";
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
      favRow + (rows || '') +
      (rows ? '' : (favN ? '' : "<div class='lzw-fempty'>还没有论坛<br>输入名字创建，或点 🎲 随机来一个</div>")) +
      '</div>';
  }

  function forumFavHtml() {
    var line = forumLineKey();
    var favs = [];
    try { favs = W.Engine.forumFavorites(line); } catch (e) {}
    if (!favs.length) {
      return '<div class="lzw-body"><div class="lzw-fempty">还没有收藏的帖子<br>进帖子点右上角 ☆ 钉住</div></div>';
    }
    var rows = favs.map(function (fv) {
      var p = fv.post;
      return "<div class='lzw-conv lzw-frow' data-favthr='" + C.esc(fv.forum) + '|' + C.esc(postId(p)) + "'>" +
        "<div class='lzw-conv-main'><div class='lzw-ftitle'>" + C.esc(p.title) + "</div>" +
        "<div class='lzw-fsub'>" + C.esc(fv.forum) + ' · <span class="lzw-fauthor">' + C.esc(p.author) + '</span> · ' + (p.time ? C.esc(shortTime(p.time)) : '很久以前') + "</div></div></div>";
    }).join('');
    return '<div class="lzw-body">' + rows + '</div>';
  }

  function forumBoardHtml(name) {
    var f = window.LZWorld.Store.forumGet(forumLineKey(), name);
    if (!f || !(f.posts || []).length) {
      return '<div class="lzw-body"><div class="lzw-fempty">' +
        (UI.fBusy ? '论坛加载中…' : '这里还没有帖子<br><button class="lzw-fretry" data-fretry="' + C.esc(name) + '">生成一版</button>') +
        '</div></div>';
    }
    var rows = (f.posts || []).map(function (p) {
      var badges = (p.fav ? "<span class='lzw-fstar'>" + fStar(true, 12) + "</span>" : '') + (p.carried ? "<span class='lzw-fcarried'>考古</span>" : '');
      return "<div class='lzw-conv lzw-frow' data-fthr='" + C.esc(postId(p)) + "'>" +
        "<div class='lzw-conv-main'>" +
        "<div class='lzw-fmeta'><span class='lzw-fauthor'>" + C.esc(p.author) + "</span><span class='lzw-ftime'>" + (p.time ? C.esc(shortTime(p.time)) : '很久以前') + "</span></div>" +
        "<div class='lzw-ftitle'>" + C.esc(p.title) + badges + "</div>" +
        "<div class='lzw-fprev'>" + C.esc(p.preview || String(p.text || '').slice(0, 40)) + "</div>" +
        "<div class='lzw-fstat'><span>" + fLike('#8a8f99', 12) + W.Engine.forumHeat(p.likes) + "</span><span>" + fCmt('#8a8f99', 12) + W.Engine.forumHeat(p.cmts != null ? p.cmts : postLatest(p).length) + "</span></div>" +
        "</div></div>";
    }).join('');
    return '<div class="lzw-body">' + rows + '</div>';
  }

  function forumThreadHtml(name, id) {
    var found = W.Engine.forumFindPost(forumLineKey(), name, id);
    var p = found.post;
    if (!p) return '<div class="lzw-body"><div class="lzw-fempty">帖子不存在</div></div>';
    var head = "<div class='lzw-fmain'>" +
      "<div class='lzw-fmeta'><span class='lzw-fauthor'>" + C.esc(p.author) + "</span><span class='lzw-ftime'>" + (p.time ? C.esc(p.time) : '很久以前') + "</span></div>" +
      "<div class='lzw-ftitle lzw-fmain-t'>" + C.esc(p.title) + "</div>" +
      "<div class='lzw-fstat'><span>" + fLike('#8a8f99', 12) + W.Engine.forumHeat(p.likes) + "</span><span>" + fCmt('#8a8f99', 12) + W.Engine.forumHeat(p.cmts != null ? p.cmts : postLatest(p).length) + "</span></div>" +
      "</div>";
    if (!postReady(p)) {
      return '<div class="lzw-body">' + head +
        "<div class='lzw-fempty'>" + (UI.fTBusy ? '生成中…' : "正文尚未生成<br><button class='lzw-fretry' data-fgen>生成正文与评论</button>") + "</div></div>";
    }
    var hot = postHot(p).map(function (h) {
      var nest = (h.nest || []).map(function (r) {
        return "<div class='lzw-fnest'><span class='lzw-frep-a'>" + C.esc(r.author) + "</span> 回复 <span class='lzw-frep-a'>" + C.esc(r.to) + "</span>：" + C.esc(r.text) + "</div>";
      }).join('');
      return "<div class='lzw-fhot'><span class='lzw-fhot-badge'>热评 " + fLike('#e8912d', 10) + " " + W.Engine.forumHeat(h.likes) + "</span>" +
        "<div class='lzw-frep'><span class='lzw-frep-a'>" + C.esc(h.author) + "</span>：" + C.esc(h.text) + "</div>" + nest + "</div>";
    }).join('');
    var latest = postLatest(p).map(function (r) {
      return "<div class='lzw-frep'><span class='lzw-frep-a'>" + C.esc(r.author) + "</span>：" + C.esc(r.text) + "</div>";
    }).join('');
    return '<div class="lzw-body">' + head +
      "<div class='lzw-fmain-b'>" + C.esc(postBody(p)).replace(/\n/g, '<br>') + "</div>" +
      (hot ? "<div class='lzw-fsec'>热门评论</div><div class='lzw-freps'>" + hot + "</div>" : '') +
      (latest ? "<div class='lzw-fsec'>最新评论</div><div class='lzw-freps'>" + latest + "</div>" : '') +
      (hot || latest ? '' : "<div class='lzw-fempty'>还没有评论</div>") +
      '</div>';
  }

  UI.forumLineKey = forumLineKey;
  // appbar 收藏星（壳渲染 appbar 时调用；实心=已收藏）
  UI.ffavIcon = function () { return fStar(!!(UI.forumFavNow && UI.forumFavNow()), 19); };

  Object.assign(UI, {
    openForum: function (name) {
      var W = window.LZWorld;
      name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
      if (!name) { try { toastr.info('先输入论坛名', '霖州手机'); } catch (e) {} return; }
      var line = forumLineKey();
      // 同名已存在（含空白差异）→ 直接打开；新名字 → 先建空壳（列表留住它），内容等手动【生成一版】
      var stripped = name.replace(/\s+/g, '');
      for (var fn2 in ((W.Store.forumAll() || {})[line] || {})) {
        if (String(fn2).replace(/\s+/g, '') === stripped) { name = fn2; break; }
      }
      if (!W.Store.forumGet(line, name)) W.Store.forumPut(line, name, { posts: [] });
      this.forumName = name;
      this.fThreadId = '';
      this.screen = 'fboard';
      this.render();
    },
    // 【生成一版】（手动，空论坛才有按钮）：含跨时代考古
    genForum: function (name) {
      var W = window.LZWorld;
      if (this.fBusy) return;
      var self = this, line = forumLineKey();
      this.fBusy = true;
      this.render();
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
    // 换一版：新帖全部作废重生成；收藏帖与考古旧帖豁免沉底
    rerollForum: function () {
      var W = window.LZWorld;
      var name = this.forumName;
      if (!name || this.fBusy) return;
      var self = this, line = forumLineKey();
      this.fBusy = true;
      this.render();
      W.Engine.forumReroll(line, name).then(function () {
        try { toastr.info('已换一版（收藏的帖子保留在底部）', '霖州手机', { timeOut: 2000 }); } catch (e) {}
      }).catch(function (e) {
        console.warn('[霖州引擎] 论坛换版失败', e);
        try { toastr.error('换版失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.fBusy = false;
        self.markForumSeen();
        if (self.screen === 'fboard' || self.screen === 'fthread') self.render();
      });
    },
    // 点进未生成的帖子 → 手动生成正文+评论（只生成一次）
    genThread: function () {
      var W = window.LZWorld;
      if (this.fTBusy) return;
      var self = this, line = forumLineKey(), name = this.forumName, id = this.fThreadId;
      this.fTBusy = true;
      this.render();
      W.Engine.forumThreadGenerate(line, name, id).then(function () {
        try { toastr.info('帖子已生成', '霖州手机', { timeOut: 1500 }); } catch (e) {}
      }).catch(function (e) {
        console.warn('[霖州引擎] 帖子生成失败', e);
        try { toastr.error('帖子生成失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.fTBusy = false;
        self.markForumSeen();
        if (self.screen === 'fthread') self.render();
      });
    },
    // 帖子页 ☆/★：收藏钉住（换一版豁免）；appbar 用它显示当前状态
    forumFavNow: function () {
      var found = W.Engine.forumFindPost(forumLineKey(), this.forumName, this.fThreadId);
      return !!(found.post && found.post.fav);
    },
    toggleForumFav: function () {
      var now = W.Engine.forumFavToggle(forumLineKey(), this.forumName, this.fThreadId);
      try { toastr.info(now ? '已钉住，换一版也不会丢' : '已取消收藏', '霖州手机', { timeOut: 1500 }); } catch (e) {}
      if (this.screen === 'fthread') this.render();
    },

  });


  UI._binders.push(function (ph) {
    // 论坛：入口 / 输入回车或点进入 / 骰子随机取名 / ✕删除 / 进版 / 进帖 / 空版生成一版 / 换一版 / 收藏
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
      el.onclick = function () { UI.fThreadId = el.dataset.fthr; UI.screen = 'fthread'; UI.render(); };
    });
    ph.querySelectorAll('[data-fretry]').forEach(function (el) {
      el.onclick = function () { UI.genForum(el.dataset.fretry); };
    });
    ph.querySelectorAll('[data-fgen]').forEach(function (el) {
      el.onclick = function () { UI.genThread(); };
    });
    ph.querySelectorAll('[data-fact="freroll"]').forEach(function (el) {
      el.onclick = function () { UI.rerollForum(); };
    });
    ph.querySelectorAll('[data-fact="ffav"]').forEach(function (el) {
      el.onclick = function () { UI.toggleForumFav(); };
    });
    ph.querySelectorAll('[data-favopen]').forEach(function (el) {
      el.onclick = function () { UI.screen = 'fav'; UI.render(); };
    });
    ph.querySelectorAll('[data-favthr]').forEach(function (el) {
      el.onclick = function () {
        var parts = String(el.dataset.favthr || '').split('|');
        // id = 作者|标题，论坛名在更前段：按最后一个 '|' 前切开论坛名不可靠——存的是 论坛|作者|标题
        var title = parts.pop(), author = parts.pop(), forum = parts.join('|');
        UI.forumName = forum;
        UI.fThreadId = author + '|' + title;
        UI.screen = 'fthread';
        UI.render();
      };
    });
  });
})();
