// ═══════════════════════════════════════════════════════════
//  worldbook.js —— 世界书读取与解析
//
//  约定（设计文档 §5.1，条目按「备注/标题」识别）：
//    霖州手机::通讯录        → 全部 IF 线联系人/群 JSON
//    霖州手机::表情包        → 表情名→catbox 文件名（JSON 或逐行 名: 文件）
//    霖州手机::人设::周言    → 角色「周言」的生成资料（可多条）
//
//  酒馆助手不同版本函数名有差异，这里做容错适配。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var MARK_ROSTER = '霖州手机::通讯录';
  var MARK_STICKER = '霖州手机::表情包';
  var MARK_STICKER_ALIAS = ['媒体与表情包_StickerData'];   // 卡组既有条目，直接兼容
  var MARK_PROFILE = '霖州手机::人设::';

  // ── 适配层：世界书列表与条目 ──
  async function bookNames() {
    try {
      if (typeof getCharWorldbookNames === 'function') {
        var n = getCharWorldbookNames('current');
        var out = [];
        if (n && n.primary) out.push(n.primary);
        if (n && n.additional) out = out.concat(n.additional);
        if (out.length) return out;
      }
    } catch (e) {}
    try {
      if (typeof getCharLorebooks === 'function') {
        var c = getCharLorebooks({ name: 'current' });
        var out2 = [];
        if (c && c.primary) out2.push(c.primary);
        if (c && c.additional) out2 = out2.concat(c.additional);
        return out2;
      }
    } catch (e) {}
    return [];
  }

  async function entriesOf(book) {
    try {
      if (typeof getWorldbook === 'function') {
        var es = await getWorldbook(book);
        if (es && es.length) return es;
      }
    } catch (e) {}
    try {
      if (typeof getLorebookEntries === 'function') {
        var es2 = await getLorebookEntries(book);
        if (es2 && es2.length) return es2;
      }
    } catch (e) {}
    return [];
  }

  async function allEntries() {
    var names = await bookNames();
    var all = [];
    for (var i = 0; i < names.length; i++) {
      try { all = all.concat(await entriesOf(names[i])); } catch (e) {}
    }
    return all;
  }

  function titleOf(e) {
    // 不同版本字段名有差异：name（旧）/ comment（新）都认
    return String((e && (e.name || e.comment || e.title || e.remark)) || '').trim();
  }
  function contentOf(e) {
    return String((e && (e.content || e.text)) || '');
  }

  // 从文本中抠出第一个 {...} 块并解析
  function extractJson(text) {
    var s = String(text || '');
    var start = s.indexOf('{');
    if (start === -1) return null;
    var depth = 0;
    for (var i = start; i < s.length; i++) {
      var ch = s[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; }
      } }
    }
    return null;
  }

  // ── 表情包解析：JSON 对象，或逐行「名字: 文件名」/「名字=文件名」/「名字 文件名」 ──
  function parseStickers(text) {
    var j = extractJson(text);
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      var out = {};
      for (var k in j) out[String(k).trim()] = String(j[k]).trim();
      return out;
    }
    var map = {};
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*[-*•]?\s*([^:：=\s|【】]+)\s*[:：=|\s]\s*([A-Za-z0-9]+\.(?:jpg|jpeg|png|gif|webp))\s*$/i);
      if (m) map[m[1].trim()] = m[2];
    });
    return map;
  }

  // ── 通讯录区块规范化：把各种写法收成 {contacts:[{name,avatar}],groups:[{name,members,open}]} ──
  function normSection(sec) {
    sec = sec || {};
    var contacts = (sec.contacts || sec.friends || []).map(function (c) {
      if (typeof c === 'string') return { name: c, avatar: '' };
      return { name: String(c.name || '').trim(), avatar: String(c.avatar || c.avatar_file || '').trim() };
    }).filter(function (c) { return c.name; });
    var groups = (sec.groups || []).map(function (g) {
      if (typeof g === 'string') return { name: g, members: [] };
      return {
        name: String(g.name || '').trim(),
        members: (g.members || []).map(String),
        open: !!g.open
      };
    }).filter(function (g) { return g.name; });
    return { contacts: contacts, groups: groups };
  }

  var Worldbook = {
    // 返回 { rosters, stickers, profiles, states }
    // states = { 条目标题: 是否勾选开启 }——世界线主条目定位用（enabled 字段读不到时按"开"记）
    load: async function () {
      var result = { rosters: {}, stickers: {}, profiles: {}, states: {} };
      var names = await bookNames();
      console.log('[霖州引擎] 世界书：' + names.length + ' 本 → ' + names.join(' / '));
      var es = await allEntries();
      var seen = es.slice(0, 25).map(function (e) { return titleOf(e).slice(0, 24); });
      console.log('[霖州引擎] 共扫描 ' + es.length + ' 条，前若干条标题：' + seen.join(' | '));

      // 短标题条目的索引，供「人设兜底」用（条目名=角色名）
      var titleMap = {};
      for (var ti = 0; ti < es.length; ti++) {
        var tt = titleOf(es[ti]);
        if (tt && tt.length <= 15 && !(tt in titleMap)) titleMap[tt] = contentOf(es[ti]);
      }

      for (var i = 0; i < es.length; i++) {
        var t = titleOf(es[i]);
        if (t && !(t in result.states)) result.states[t] = es[i].enabled !== false;
        if (t === MARK_ROSTER) {
          var j = extractJson(contentOf(es[i]));
          if (j && typeof j === 'object') {
            for (var line in j) {
              result.rosters[String(line).trim()] = normSection(j[line]);
            }
          }
        } else if (t === MARK_STICKER || MARK_STICKER_ALIAS.indexOf(t) !== -1) {
          var st = parseStickers(contentOf(es[i]));
          for (var k in st) result.stickers[k] = st[k];
        } else if (t.indexOf(MARK_PROFILE) === 0) {
          var who = t.slice(MARK_PROFILE.length).trim();
          if (who) {
            var prev = result.profiles[who];
            result.profiles[who] = prev ? prev + '\n' + contentOf(es[i]) : contentOf(es[i]);
          }
        }
      }

      // 人设兜底：通讯录里有的人物，若条目名正好是该角色名，直接取其内容当档案
      for (var ln in result.rosters) {
        var cs = result.rosters[ln].contacts || [];
        for (var ci = 0; ci < cs.length; ci++) {
          var cn = cs[ci].name;
          if (!result.profiles[cn] && titleMap[cn]) result.profiles[cn] = titleMap[cn];
        }
      }
      return result;
    },

    imgUrl: function (file) {
      file = String(file || '').trim();
      if (!file) return '';
      if (/^https?:\/\//i.test(file)) return file;
      return (window.LZWorld.IMG_BASE || 'https://files.catbox.moe/') + file;
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Worldbook = Worldbook;
})();
