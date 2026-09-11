// ═══════════════════════════════════════════════════════════
//  store.js —— 聊天级存储（随卡走，不污染 localStorage）
//  数据挂在聊天变量 lzworld_phone 下：
//    history:  { 会话key: [ {who, kind, text, time} ] }
//    line:     最近一次定位到的世界线
//    rendered: 已渲染成气泡的楼层 mesid（避免重复处理）
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var KEY = 'lzworld_phone';

  function readRoot() {
    try {
      var v = getVariables({ type: 'chat' });
      var root = v && v[KEY];
      if (root && typeof root === 'object') return root;
    } catch (e) {}
    return {};
  }

  function writeRoot(root) {
    try {
      var v = getVariables({ type: 'chat' }) || {};
      v[KEY] = root;
      replaceVariables(v, { type: 'chat' });
    } catch (e) { console.warn('[霖州引擎] 存储写入失败', e); }
  }

  var Store = {
    KEY: KEY,

    // 有记录的会话 key 列表
    historyKeys: function () {
      var r = readRoot();
      return Object.keys(r.history || {});
    },

    history: function (chatKey) {
      var r = readRoot();
      var h = (r.history || {})[chatKey];
      return Array.isArray(h) ? h : [];
    },

    push: function (chatKey, msgs, cap) {
      var r = readRoot();
      r.history = r.history || {};
      var h = r.history[chatKey] || [];
      h = h.concat(msgs);
      if (cap && h.length > cap) h = h.slice(-cap);
      r.history[chatKey] = h;
      writeRoot(r);
      return h;
    },

    // 从末尾弹出 n 条（重roll用）
    popLast: function (chatKey, n) {
      var r = readRoot();
      var h = (r.history || {})[chatKey];
      if (!h || !h.length) return [];
      var popped = h.splice(Math.max(0, h.length - n), n);
      writeRoot(r);
      return popped;
    },

    // 会话元信息：headline（一句话近况）、atMainCount（最近活跃时的主线楼数）、
    // digested（已折进提要的条数）、digest（前文提要）
    meta: function (chatKey) {
      var r = readRoot();
      return ((r.meta || {})[chatKey]) || {};
    },

    setMeta: function (chatKey, patch) {
      var r = readRoot();
      r.meta = r.meta || {};
      var m = r.meta[chatKey] || {};
      for (var k in patch) m[k] = patch[k];
      r.meta[chatKey] = m;
      writeRoot(r);
    },

    // 只改最后一条（比如补时间）
    amendLast: function (chatKey, patch) {
      var r = readRoot();
      var h = (r.history || {})[chatKey];
      if (!h || !h.length) return;
      var last = h[h.length - 1];
      for (var k in patch) last[k] = patch[k];
      writeRoot(r);
    },

    line: function () {
      return readRoot().line || null;
    },

    setLine: function (name) {
      if (!name || name === this.line()) return;
      var r = readRoot();
      r.line = name;
      writeRoot(r);
    },

    markRendered: function (mesid) {
      var r = readRoot();
      r.rendered = r.rendered || [];
      if (r.rendered.indexOf(mesid) === -1) {
        r.rendered.push(mesid);
        if (r.rendered.length > 400) r.rendered = r.rendered.slice(-400);
        writeRoot(r);
      }
    },

    isRendered: function (mesid) {
      var r = readRoot();
      return r.rendered && r.rendered.indexOf(mesid) !== -1;
    },

    wipeHistory: function () {
      var r = readRoot();
      r.history = {};
      writeRoot(r);
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Store = Store;
})();
