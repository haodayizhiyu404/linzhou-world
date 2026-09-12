// ═══════════════════════════════════════════════════════════
//  霖州往事 · 数字世界引擎（构建产物，勿手改）
//  源码见 src/ · 构建：node build/build.js
//  构建时间：2026-09-12T15:38:41.288Z
// ═══════════════════════════════════════════════════════════
var __LZW_BUILD__ = '2026-09-12 15:38';
try { console.log('[霖州引擎] 构建 ' + __LZW_BUILD__ + ' · 启动'); } catch (e) {}

// ── src/store.js ──
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
      var h = (r.history || {})[chatKey] || [];
      var stampDay = null, stampTime = null;
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        if (m && m.kind !== 'recall' && (m.day == null || !m.time)) {
          if (stampDay === null) { try { stampDay = window.LZWorld.Status.nowDay() || ''; } catch (e) { stampDay = ''; } }
          if (stampTime === null) { try { stampTime = window.LZWorld.Status.nowText() || ''; } catch (e) { stampTime = ''; } }
          m = Object.assign({}, m, { day: m.day == null ? stampDay : m.day, time: m.time || stampTime });
          msgs[i] = m;
        }
        if (m && m.kind === 'recall') {
          // 撤回标记本身不落库：给该发言人最近一条消息打撤回标
          for (var j = h.length - 1; j >= 0; j--) {
            if (h[j].who === m.who) { h[j] = Object.assign({}, h[j], { recalled: true }); break; }
          }
          continue;
        }
        h.push(m);
      }
      if (cap && h.length > cap) h = h.slice(-cap);
      r.history = r.history || {};
      r.history[chatKey] = h;
      writeRoot(r);
      return h;
    },

    // 按下标删除单条（玩家删除自己的话/清掉异常消息用）
    removeAt: function (chatKey, index) {
      var r = readRoot();
      var h = (r.history || {})[chatKey];
      if (!h || index < 0 || index >= h.length) return false;
      h.splice(index, 1);
      r.history[chatKey] = h;
      // 删空会话时连元信息一起清，免得变量里留下永不使用的残留
      if (!h.length && r.meta) delete r.meta[chatKey];
      writeRoot(r);
      return true;
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

    // 主动消息捕捉查重表：已处理过 <!--phone--> 块的正文消息 id。
    // 只查即时事件、不做历史补扫（避免扫全楼层），id 表封顶 200。
    procIds: function () {
      var r = readRoot();
      return Array.isArray(r.procIds) ? r.procIds : [];
    },
    markProcId: function (id) {
      var r = readRoot();
      var list = (Array.isArray(r.procIds) ? r.procIds : []).concat([String(id)]);
      r.procIds = list.slice(-200);
      writeRoot(r);
    },

    // 未读计数：消息落入时累加，打开会话即清零（「打开即已读」标准判定）。
    // 计数挂在会话元信息里，随聊天变量走。
    bumpUnread: function (chatKey, n) {
      var r = readRoot();
      r.meta = r.meta || {};
      var m = r.meta[chatKey] || {};
      m.unread = (m.unread || 0) + (n || 1);
      r.meta[chatKey] = m;
      writeRoot(r);
    },
    clearUnread: function (chatKey) {
      var r = readRoot();
      var m = ((r.meta || {})[chatKey]);
      if (m && m.unread) { m.unread = 0; writeRoot(r); }
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


// ── src/status.js ──
// ═══════════════════════════════════════════════════════════
//  status.js —— 楼层状态栏解析
//  每层楼固定携带 <status> 块。本模块只读，不改。
//
//  解析规则（设计文档 §5.4）：
//    · <环境> 行：游戏内时间与【user 所在】地点 —— 时间可用，地点不可当作 NPC 位置
//    · <角色名> 小块：该角色的 着装/姿态/位置 —— 只取 位置+姿态，【绝不取心声】
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var envRe = /<环境>\s*([\s\S]*?)<\/环境>/i;
  var charBlockRe = /<([^\s<>\/][^<>]*)>\s*([\s\S]*?)<\/\1>/g;

  function parseStatusBlock(text) {
    if (!text) return null;
    // 先剥外层 <status> 壳，角色小块在壳内逐一匹配
    var sm = String(text).match(/<status>\s*([\s\S]*?)<\/status>/i);
    var scope = sm ? sm[1] : String(text);
    var m = scope.match(envRe);
    if (!m) return null;

    // 环境行示例：2034年8月26日 星期五|22:49|天禧城3幢901室|阴
    var envParts = String(m[1]).split('|').map(function (s) { return s.trim(); });
    var result = {
      dateText: envParts[0] || '',      // 2034年8月26日 星期五
      time: '',                          // 22:49
      userPlace: envParts[2] || '',      // user 所在地点（不可用于 NPC）
      characters: {},                    // 角色小块：{ 位置, 姿态, 着装, 关系 }
      overview: ''                       // <关系总览> 整块原文
    };
    var tm = (envParts[1] || '').match(/(\d{1,2}:\d{2})/);
    if (tm) result.time = tm[1];

    // 角色小块：<沈锡元> 着装：… 姿态：… 位置：… 关系：… 心声：… </沈锡元>
    var block;
    charBlockRe.lastIndex = 0;
    while ((block = charBlockRe.exec(scope)) !== null) {
      var name = block[1].trim();
      if (name === '环境' || name === 'status') continue;
      var body = block[2];
      if (name === '关系总览') { result.overview = body.trim(); continue; }
      var grab = function (label) {
        var r = body.match(new RegExp(label + '\\s*[:：]\\s*([^\\n]+)'));
        return r ? r[1].trim() : '';
      };
      result.characters[name] = {
        outfit: grab('着装'),
        posture: grab('姿态'),
        place: grab('位置'),
        relation: grab('关系')
        // 心声刻意不解析
      };
    }
    return result;
  }

  var Status = {
    // 从最近一条带状态栏的楼层解析（一般就是最新楼）
    parseLatest: function () {
      try {
        var msgs = getChatMessages('0-{{lastMessageId}}');
        if (!msgs || !msgs.length) return null;
        for (var i = msgs.length - 1; i >= 0 && i >= msgs.length - 6; i--) {
          var p = parseStatusBlock(msgs[i] && msgs[i].message);
          if (p) return p;
        }
      } catch (e) { console.warn('[霖州引擎] 状态栏解析失败', e); }
      return null;
    },

    // 供楼层记录头部使用的时间文本
    nowText: function () {
      var p = this.parseLatest();
      return (p && p.time) || '';
    },

    // 供消息落库打日期标用（'2034年8月26日 星期五'）
    nowDay: function () {
      var p = this.parseLatest();
      return (p && p.dateText) || '';
    },

    // 供生成装配使用：时间 + user地点 + 目标角色情境块（含关系）
    snapshot: function (npcName) {
      var p = this.parseLatest();
      if (!p) return { time: '', userPlace: '', npc: null, overview: '' };
      var npc = null;
      if (npcName && p.characters[npcName]) {
        npc = p.characters[npcName];
        npc.name = npcName;
      }
      return {
        time: p.time,
        dateText: p.dateText,
        userPlace: p.userPlace,
        npc: npc,
        overview: p.overview
      };
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Status = Status;
  window.LZWorld._parseStatusBlock = parseStatusBlock; // 供调试/测试
})();


// ── src/worldbook.js ──
// ═══════════════════════════════════════════════════════════
//  worldbook.js —— 世界书读取与解析
//
//  约定（设计文档 §5.1，条目按「备注/标题」识别）：
//    霖州手机::通讯录          → 全部 IF 线联系人/群 JSON
//    霖州手机::表情包          → 表情名→catbox 文件名（JSON 或逐行 名: 文件）
//    霖州手机::人设::周言      → 角色「周言」的生成资料（可多条，自动拼接）
//    NPC（高中线-核心人员）    → 线专属 NPC 档案：内容里 [NPC·名字] 块只在该线生效（重写式）
//    主角人设（大学线）        → 线演化层：内容里 [MAIN·名字·演化后] 块叠加到该人基础人设后
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

  // 多人条目拆分：内容里的 [NPC·名字] 块 → {名字: 块内容}（直到下一个块头或文末）
  function parseNpcBlocks(text) {
    return parseTaggedBlocks(text, 'NPC');
  }
  // [MAIN·名字·演化后] 块（时代演化档案用）；块名尾缀「·演化后」剥掉
  function parseMainBlocks(text) {
    var raw = parseTaggedBlocks(text, 'MAIN');
    var out = {};
    for (var k in raw) out[k.replace(/·演化后$/, '').trim()] = raw[k];
    return out;
  }
  // 通用块拆分：tag = NPC | MAIN
  // 块体边界取「后一个块头」与「下一个顶格 # 标题」的先到者——
  // 时代线条目常用 # I. 核心配角 / # II. 其他NPC 这类章节把不同批次的块隔开，
  // 只看块头会把章节标题（以及下一章的块）吞进前一块的档案体。
  function parseTaggedBlocks(text, tag) {
    var src = String(text || '');
    var out = {};
    var re = new RegExp('\\[' + tag + '·([^\\]\\n]+)\\]', 'g');
    var m, marks = [];
    while ((m = re.exec(src))) {
      marks.push({ name: m[1].trim(), start: m.index, headEnd: re.lastIndex });
    }
    var topRe = /^#{1,6}\s+/m;
    for (var i = 0; i < marks.length; i++) {
      var start = marks[i].headEnd;
      var end = (i + 1 < marks.length) ? marks[i + 1].start : src.length;
      var hm = topRe.exec(src.slice(start, end));
      if (hm) end = start + hm.index;
      var body = src.slice(start, end).trim();
      if (marks[i].name && body) {
        out[marks[i].name] = out[marks[i].name] ? out[marks[i].name] + '\n' + body : body;
      }
    }
    return out;
  }

  // 条目名的线作用域识别：NPC（高中线-核心人员）/ NPC（大学线）/ 主角人设（大学线）
  // 括号里的内容即「线作用域」，由 engine 映射到具体世界线；不匹配返回 null（归全局池）
  function scopeOfTitle(t) {
    var m = /^(?:NPC|主角人设)（(.+)）$/.exec(String(t || '').replace(/[【】]/g, ''));
    return m ? m[1] : null;
  }

  // ── 通讯录区块规范化：把各种写法收成 {contacts:[{name,avatar}],groups:[{name,members,open,avatar,style,crowd}]} ──
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
        members: (g.members || []).map(String).filter(function (n) { return n.trim() && !/^\{\{user\}\}$/i.test(n.trim()); }),
        open: !!g.open,
        avatar: String(g.avatar || '').trim(),
        style: g.style ? String(g.style) : '',
        crowd: g.crowd || ''
      };
    }).filter(function (g) { return g.name; });
    return { contacts: contacts, groups: groups };
  }

  var Worldbook = {
    // 返回 { rosters, stickers, profiles, states }
    // states = { 条目标题: 是否勾选开启 }——世界线主条目定位用（enabled 字段读不到时按"开"记）
    load: async function () {      var result = { rosters: {}, stickers: {}, profiles: {}, states: {} };
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

      // 多人条目索引：内容里 [NPC·名字] 块拆出来，供「人设兜底」用。
      // 名字带线作用域的条目（NPC（高中线-核心人员）/NPC（大学线）/主角人设（大学线））
      // 不进全局池——各自归各线，免得两条线共用同一个人的同一版档案（静默串线）。
      var npcBlocks = {};
      var npcLineRaw = [];    // [{scope, blocks:{名字:文本}}]　线专属 NPC 档案，engine 映射线名
      var evolLineRaw = [];   // [{scope, blocks:{名字:文本}}]　[MAIN·名字·演化后] 时代演化层
      for (var bi = 0; bi < es.length; bi++) {
        var scope = scopeOfTitle(titleOf(es[bi]));
        if (scope) {
          if (/^NPC/.test(titleOf(es[bi]).replace(/[【】]/g, ''))) {
            npcLineRaw.push({ scope: scope, blocks: parseNpcBlocks(contentOf(es[bi])) });
          } else {
            evolLineRaw.push({ scope: scope, blocks: parseMainBlocks(contentOf(es[bi])) });
          }
          continue;
        }
        var nb = parseNpcBlocks(contentOf(es[bi]));
        for (var bn in nb) {
          if (!(bn in npcBlocks)) npcBlocks[bn] = nb[bn];
        }
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

      // 人设兜底：通讯录/群成员里有档案的人，按 条目名=角色名 > [NPC·名字]块 的顺序补
      for (var ln in result.rosters) {
        var sec = result.rosters[ln];
        var cs = (sec.contacts || []).map(function (c) { return c.name; });
        (sec.groups || []).forEach(function (g) { cs = cs.concat(g.members || []); });
        for (var ci = 0; ci < cs.length; ci++) {
          var cn = cs[ci];
          if (!result.profiles[cn]) result.profiles[cn] = titleMap[cn] || npcBlocks[cn] || '';
        }
      }

      // 头像/表情预热：世界书一装载就拉进浏览器缓存，
      // 避免再次打开手机时 <img> 重新请求出现空白闪帧（壁纸同款思路，见 wechat.js 模块头）
      try {
        var preSeen = {};
        var preList = [];
        var preAdd = function (file) {
          var u = Worldbook.imgUrl(file);
          if (u && !preSeen[u]) { preSeen[u] = 1; preList.push(u); }
        };
        for (var rn in result.rosters) {
          var rsec = result.rosters[rn];
          (rsec.contacts || []).forEach(function (c) { if (c.avatar) preAdd(c.avatar); });
          (rsec.groups || []).forEach(function (g) { if (g.avatar) preAdd(g.avatar); });
        }
        for (var sk in result.stickers) preAdd(result.stickers[sk]);
        for (var pi = 0; pi < preList.length; pi++) { var pim = new Image(); pim.src = preList[pi]; }
      } catch (e) {}
      result.npcLineRaw = npcLineRaw;
      result.evolLineRaw = evolLineRaw;
      return result;
    },

    // 重读全部条目的勾选状态（玩家在世界书界面手动开关条目后，加载时的快照已过时）
    readStates: async function () {
      var es = await allEntries();
      var states = {};
      for (var i = 0; i < es.length; i++) {
        var t = titleOf(es[i]);
        if (t && !(t in states)) states[t] = es[i].enabled !== false;
      }
      return states;
    },

    // 按条目标题批量开关条目（世界线归位/选线界面用）。
    // ops = [{match: '高中时代', enable: true}]，按去掉【】与空白后的标题匹配；
    // 只改匹配到的条目，其余原样保留，整本结构不动。
    // 新接口 updateWorldbookWith（回调式，天然防误伤）优先，老接口 getWorldbook+replaceWorldbook 兜底。
    setEntriesEnabled: async function (ops) {
      var names = await bookNames();
      if (!names.length) throw new Error('未找到角色卡世界书');
      var norm = function (s) { return String(s || '').replace(/[【】\s]/g, ''); };
      var want = {};
      ops.forEach(function (o) { want[norm(o.match)] = !!o.enable; });
      var render = { render: 'immediate' };   // 翻完立即重估注入，不等界面防抖
      var flip = function (entries) {
        for (var j = 0; j < entries.length; j++) {
          var t = norm(titleOf(entries[j]));
          if (t in want) {
            entries[j].enabled = want[t];        // 酒馆助手封装字段
            entries[j].disable = !want[t];       // ST 原生字段，双保险
          }
        }
        return entries;
      };
      if (typeof updateWorldbookWith === 'function') {
        for (var i = 0; i < names.length; i++) {
          try { await updateWorldbookWith(names[i], flip, render); } catch (e) {}
        }
        return;
      }
      if (typeof getWorldbook === 'function' && typeof replaceWorldbook === 'function') {
        for (var k = 0; k < names.length; k++) {
          try {
            var es = await getWorldbook(names[k]);
            if (!es || !es.length) continue;
            var hit = false;
            for (var m = 0; m < es.length; m++) {
              if (norm(titleOf(es[m])) in want) { hit = true; break; }
            }
            if (hit) await replaceWorldbook(names[k], flip(es), render);
          } catch (e) {}
        }
      }
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


// ── src/prompt.js ──
// ═══════════════════════════════════════════════════════════
//  prompt.js —— 数字世界引擎 · 提示词装配
//
//  框架：AI 不是"扮演角色"，而是数字生活应用的模拟引擎。
//  引擎不认角色，只认「应用 + 人 + 资料」——
//  微信私聊/群聊/未来的论坛，都只是不同的资料与输出要求。
//
//  ⚠ 提示词不走酒馆宏替换（generateRaw 独立生成），
//    {{user}} 必须在装配时换成 persona 真名，见 me()。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var PLOT_FLOORS = 8;     // 主线带几楼
  var PLOT_CAP = 900;      // 每楼正文上限（验尸结论：低于此 ≈ 失明）
  var HIST_PRIVATE = 50;   // 私聊带回几条（短聊天内容很少，50 条也才角色卡资料的零头）
  var HIST_GROUP = 50;     // 群聊带回几条

  // ── persona 真名。generateRaw 不做宏替换，{{user}} 会原文进提示词，
  //    所以这里自己解析（与 engine.js userName() 同一套回退）。──
  function me() {
    try {
      var W = window.LZWorld;
      if (W && W.Engine && W.Engine.userName) {
        var n = W.Engine.userName();
        if (n && n !== '我') return n;
      }
    } catch (e) {}
    try {
      var st = window.parent.SillyTavern;
      var ctx = st && st.getContext && st.getContext();
      if (ctx && ctx.name1) return String(ctx.name1);
    } catch (e) {}
    return '我';
  }

  // ── 主线近况：最近 N 楼，去 HTML/代码块/思考块，每楼截断 ──
  function mainContext() {
    try {
      var msgs = getChatMessages('0-{{lastMessageId}}');
      if (!msgs || !msgs.length) return '';
      return msgs.slice(-PLOT_FLOORS).map(function (m) {
        var t = String((m && m.message) || '')
          // 状态栏是机器可读的元数据（时间/着装/心声等），已由「当前情境」按需引用，
          // 这里整段剔除——只剥标签会留下无主的「着装：…」碎片，严重干扰模型
          .replace(/<status>[\s\S]*?<\/status>/gi, '')
          // 旧版写进主楼层的手机记录块一并剔除（手机历史在「聊天记录」节单独给出）
          .replace(/\[📱[\s\S]*?\/\📱\]\s*/g, '')
          // 思维链：think 与 cot 两种标签都剥（后者见于部分前端/预设的推理输出）
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .replace(/<cot>[\s\S]*?<\/cot>/gi, '')
          // 预设的结构化输出块：summary 摘要 / choice(s) 分支选项，只剥标签会留碎片，整段剔除
          .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
          .replace(/<choices?>[\s\S]*?<\/choices?>/gi, '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        // 截断尽量落在行边界，避免半句话/半个词糊在切口上
        if (t.length > PLOT_CAP) {
          var cut = t.lastIndexOf('\n', PLOT_CAP);
          if (cut < PLOT_CAP * 0.5) cut = t.lastIndexOf('。', PLOT_CAP);
          if (cut < PLOT_CAP * 0.5) cut = PLOT_CAP;
          t = t.substring(0, cut) + '……（此楼后续从略）';
        }
        return (m.role === 'user' ? me() : '旁白') + '：' + t;
      }).filter(function (l) { return l.length > 4; }).join('\n');
    } catch (e) { return ''; }
  }
  // ── 单条消息 → 契约语法文本（与「消息类型」说明完全一致，AI 不用猜） ──
  function msgBody(m) {
    switch (m.kind) {
      case 'sticker':  return '[表情:' + m.text + ']';
      case 'voice':    return '[语音:' + m.text + ']';
      case 'image':    return '[图片:' + m.text + ']';
      case 'poke':     return '[戳一戳]';
      case 'calllog':  return '[' + (m.mode === 'video' ? '视频通话' : '语音通话') + ']';
      case 'location': return '[定位:' + m.text + ']';
      default:         return String(m.text || '');
    }
  }

  // ── 应用内聊天记录文本（发言人用真名，不再出现 {{user}}） ──
  // 消息带 day（状态栏日期文本）时，跨天插入 [昨天 22:10] 这类时间标
  function parseDay(s) {
    var m = /(\d+)年(\d+)月(\d+)日/.exec(s || '');
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  }
  function dayNum(p) { return p.y * 372 + p.mo * 31 + p.d; }
  function relDay(day, cur) {
    var a = parseDay(day), b = parseDay(cur);
    if (!a) return day;
    if (!b) return a.mo + '月' + a.d + '日';
    var diff = dayNum(b) - dayNum(a);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return (a.y !== b.y ? a.y + '年' : '') + a.mo + '月' + a.d + '日';
  }
  function histText(hist, n, withNames, curDay) {
    var out = [];
    var prevDay = null;
    hist.slice(-n).forEach(function (m) {
      if (m.day && m.day !== prevDay) {
        out.push('[' + relDay(m.day, curDay) + (m.time ? ' ' + m.time : '') + ']');
        prevDay = m.day;
      }
      var body = msgBody(m);
      if (m.recalled) body += '（此条已撤回）';
      if (!withNames) { out.push(body); return; }
      var who = m.who === 'user' ? me() : m.who;
      out.push(who + '：' + body);
    });
    return out.join('\n');
  }

  // ── 消息类型语法说明（输出要求的一部分） ──
  function typeSyntax(stickerNames) {
    var stickerLine = (stickerNames && stickerNames.length)
      ? '- [表情:名字]  只可选用图库现有名字，严禁编造：' + stickerNames.join('、')
      : '- [表情:名字]  图库为空，本次请勿发送表情';
    return [
      '消息类型（按需单独成行，不用则不写）：',
      stickerLine,
      '- [语音:要说的话]',
      '- [图片:画面描述]',
      '- [戳一戳]',
      '- [定位:地点名]',
      '- [撤回]  单独成行：撤回自己刚发的上一条消息（打错字、冲动后悔时用，罕用）'
    ].join('\n');
  }

  // ── 一致性规则（防开天眼） ──
  function consistencyRules(entityDesc) {
    return [
      '## 一致性规则',
      '- ' + entityDesc + '只知道两类事：①本人亲眼所见、亲耳所闻的；②对方在微信里明确告诉本人的。',
      '- 以下一律不知：主线中没有本人出场的段落、其他私聊、其他群聊、对方此刻在哪里/在干什么/穿着什么、任何人的内心想法。',
      '- 想谈本人不在场的事，只能用「听说……」「你今天怎么样」这类不确定的说法开口，不得讲出细节。',
      '- 宁可少说，不可全知。说漏即出戏。'
    ].join('\n');
  }

  function situationBlock(snapshot) {
    var lines = [];
    if (snapshot && snapshot.time) {
      var when = snapshot.dateText ? snapshot.dateText + ' ' + snapshot.time : snapshot.time;
      lines.push('当前时间：' + when);
    }
    if (snapshot && snapshot.userPlace) {
      lines.push(me() + '此刻在：' + snapshot.userPlace + '（仅作参考，不代表你的位置）');
    }
    if (snapshot && snapshot.npc) {
      var bits = [];
      if (snapshot.npc.place) bits.push('位置：' + snapshot.npc.place);
      if (snapshot.npc.posture) bits.push('姿态：' + snapshot.npc.posture);
      if (bits.length) lines.push('你（' + (snapshot.npc.name || '本人') + '）此刻：' + bits.join('，'));
      // 关系项：卡面状态栏固定维护（如「克制内敛的青梅竹马，尚未告白」）。
      // 它是防情感越界出戏的主锚点，必须显式给出并划定表达上限。
      if (snapshot.npc.relation) {
        lines.push('你与' + me() + '的关系：' + snapshot.npc.relation + '——一切情感表达不得越过这个阶段');
      }
    }
    if (snapshot && snapshot.overview) {
      lines.push('人物关系总览：' + snapshot.overview);
    }
    return lines.join('\n');
  }

  var Prompt = {

    // ── 私聊 ──
    // tail = 本轮最新一批用户消息：不混在系统块里，作为最后的 user 轮单独给出
    // userInfo = 机主资料（persona 描述 + 当前线演化层），所有会话统一带上
    // crossGroups = 对方在的群当天记录尾巴（群→私聊跨会话上下文；对方在场，与防开天眼自洽）
    private: function (contact, hist, snapshot, stickerNames, tail, digest, userInfo, crossGroups) {
      var myName = me();
      var tailLines = (tail && tail.length) ? histText(tail, 8, false) : '';
      var p = [
        '# 数字世界 · 回应生成',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成应用「微信」里，来自「' + contact.name + '」的新消息。',
        '',
        contact.profile ? '## 人物档案 · ' + contact.name + '\n' + contact.profile : '## 人物档案 · ' + contact.name + '\n（暂无档案，依据对话上下文自然演绎）',
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n（微信这头的人，与「' + contact.name + '」对话的主角）\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        '## 聊天记录 · 与' + myName + '的微信对话',
        '（优先承接这里的话题与语气；' + myName + '本轮发来的最新消息在末尾单独给出）',
        digest ? '（更早的记录已折叠为提要，供接续话题与承诺用：' + digest + '）' : '',
        histText(hist, HIST_PRIVATE, true, snapshot && snapshot.dateText),
        '',
        (crossGroups && crossGroups.length)
          ? '## 相关群聊近况（下列记录中对方本人均在场，可自由承接其中的话题、情绪与玩笑）\n' + crossGroups.map(function (g) {
              return '群「' + g.name + '」今日的记录：\n' + histText(g.hist, 20, true, snapshot && snapshot.dateText);
            }).join('\n\n')
          : '',
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        '## 输出要求',
        '- 只输出「' + contact.name + '」发来的新消息，1~5 条，按情绪与话题自然增减，必要时可超出（如情绪激动）',
        '- 每条独立成行，只写消息内容；不要前缀、时间戳、动作描写、括号心理',
        '- 每条不超过 35 字，像真人打字，不重复对方刚说过的话',
        '- 「' + contact.name + '」的情感与态度必须符合上方「关系」所述阶段，遵循人设和关系进度双重约束，输出最符合的人物聊天反馈信息',
        typeSyntax(stickerNames),
        '- 直接输出消息本身，不要以「好的」「收到」这类寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          {
            role: 'user',
            content: tailLines
              ? '（' + myName + '刚在微信里发来以下消息。请严格按上方输出要求，只输出「' + contact.name + '」的新消息本身。）\n' + tailLines
              : '（现在轮到「' + contact.name + '」回复' + myName + '。请严格按上方输出要求，只输出消息本身。）'
          }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 通话邀请：机主拨打了语音/视频通话，AI 决定接/拒 ──
    // 约定：两种反应都带标识便于解析剔除——拒绝 → 第一行以 [拒绝] 开头，可附一句简短说明；
    // 接听 → 以 [接听] 开头，其后接接通后的开场（台词与画面交织）。
    // 视频通话的可见状态用 [画面] 行写，插在动作发生的对应位置（可穿插多行，不只开头）。
    // 呼叫页等待期间的一次生成。
    callInvite: function (contact, hist, snapshot, userInfo, mode, crossGroups) {
      var myName = me();
      var kind = mode === 'video' ? '视频通话' : '语音通话';
      var outReq = mode === 'video' ? [
        '## 输出要求（严格遵守，二选一）',
        '- 接听：第一行以 [接听] 开头；其后是接通后的开场——台词与画面交织，每行要么是「' + contact.name + '」的口语台词，要么是以 [画面] 开头的一行可见状态（在哪、姿势、表情、衣着、手上动作；只写看得见的东西，就写在该动作发生的对应位置，可穿插多行：一边说一边做的事要插在对应台词旁边）',
        '- 拒绝：第一行以 [拒绝] 开头，其后可附一句简短说明（如「在忙，晚点回」），也可不附',
        '- [接听]/[拒绝]/[画面] 是程序解析用的标记，只输出标记本身，不要给标记加引号或其他说明',
        '- 台词口语化：短句、停顿感、可有语气词；不要引号、动作描写、心理括号、时间戳（动作只写进 [画面] 行）',
        '- 决定须符合上方「关系」阶段与当前情境（深夜/工作时间/在群里刚聊过等）'
      ].join('\n') : [
        '## 输出要求（严格遵守，二选一）',
        '- 接听：第一行以 [接听] 开头，其后接 1~3 行口语台词，像真人打电话的开场',
        '- 拒绝：第一行以 [拒绝] 开头，其后可附一句简短说明（如「在忙，晚点回」），也可不附',
        '- [接听]/[拒绝] 是程序解析用的标记，只输出标记本身，不要给标记加引号或其他说明',
        '- 不得输出引号、动作描写、心理括号、时间戳',
        '- 决定须符合上方「关系」阶段与当前情境（深夜/工作时间/在群里刚聊过等）'
      ].join('\n');
      var p = [
        '# 数字世界 · ' + kind + '邀请',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：机主「' + myName + '」给「' + contact.name + '」发起了' + kind + '，生成对方的反应。',
        '',
        contact.profile ? '## 人物档案 · ' + contact.name + '\n' + contact.profile : '',
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        (crossGroups && crossGroups.length)
          ? '## 相关群聊近况（下列记录中对方本人均在场）\n' + crossGroups.map(function (g) {
              return '群「' + g.name + '」今日的记录：\n' + histText(g.hist, 20, true, snapshot && snapshot.dateText);
            }).join('\n\n')
          : '',
        '',
        '## 聊天记录 · 与' + myName + '的微信对话（通话前的最近消息，供接续话题与语气）',
        histText(hist || [], 20, true, snapshot && snapshot.dateText),
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        outReq
      ].filter(function (s2) { return s2 !== ''; }).join('\n');
      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: '（' + myName + '的' + kind + '正在呼叫' + contact.name + '。请按输出要求生成对方的反应。）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 通话轮：通话进行中，机主说了一句（或要求接续），生成对方台词 ──
    // transcript = 「名字：…/机主：…」台词行；userSays = 机主本轮说的话（可空）
    callTurn: function (contact, transcript, hist, snapshot, userInfo, mode, crossGroups, userSays) {
      var myName = me();
      var kind = mode === 'video' ? '视频通话' : '语音通话';
      var outReq = mode === 'video' ? [
        '## 输出要求',
        '- 输出 = 「' + contact.name + '」的台词与画面交织流：每行要么是台词，要么是以 [画面] 开头的一行可见状态（在哪、姿势、表情、衣着、手上的动作；只写看得见的东西）',
        '- [画面] 行穿插在台词中间、写在该动作发生的时刻——他一边说一边做的事（吃了片薯片、抬头看镜头、擦了把汗）就插在对应台词旁边，不要全堆在开头或结尾',
        '- 台词行数随情境自然决定（聊得热络可以多说，无事可说就少），口语化：短句、停顿感、可有语气词，不要书面腔',
        '- 每行独立，不要引号、动作描写、心理括号、时间戳（动作只写进 [画面] 行）',
        '- 情感与态度符合上方「关系」阶段；吵架、撒娇、汇报都按当前关系该有度',
        '- 不要复述机主刚说的话'
      ].join('\n') : [
        '## 输出要求',
        '- 只输出「' + contact.name + '」的台词，1~5 行，按情绪与话题自然增减（激动时可更多）',
        '- 口语化，像真人打电话：短句、停顿感、可有语气词；不要书面腔',
        '- 每行独立，不要引号、动作描写、心理括号、时间戳',
        '- 情感与态度符合上方「关系」阶段；吵架、撒娇、汇报都按当前关系该有度',
        '- 不要复述机主刚说的话'
      ].join('\n');
      var p = [
        '# 数字世界 · ' + kind + (mode === 'video' ? ' · 画面与台词' : '') + '进行中',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成' + kind + '中「' + contact.name + '」接下来的' + (mode === 'video' ? '画面与台词。' : '台词。'),
        '',
        contact.profile ? '## 人物档案 · ' + contact.name + '\n' + contact.profile : '',
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        (crossGroups && crossGroups.length)
          ? '## 相关群聊近况（下列记录中对方本人均在场，可自然提及）\n' + crossGroups.map(function (g) {
              return '群「' + g.name + '」今日的记录：\n' + histText(g.hist, 20, true, snapshot && snapshot.dateText);
            }).join('\n\n')
          : '',
        '',
        '## 近期私聊记录（通话之外的消息，供接续话题）',
        histText(hist || [], 10, true, snapshot && snapshot.dateText),
        '',
        '## 通话记录（' + kind + ' · 双方已说的话' + (mode === 'video' ? '与画面' : '') + '）',
        transcript || '（刚接通）',
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        outReq
      ].filter(function (s2) { return s2 !== ''; }).join('\n');
      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: userSays
              ? '（' + myName + '在' + kind + '里说：「' + userSays + '」。请生成「' + contact.name + '」的台词。）'
              : '（' + kind + '沉默了几秒。请生成「' + contact.name + '」接下来的台词。）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 群聊 ──
    // userInfo = 机主资料，与私聊同一份
    // crossPriv = {成员名: 当天私聊尾巴}（私聊→群跨会话上下文；挂到该成员档案下，※ 仅本人知晓）
    group: function (group, members, hist, snapshot, stickerNames, tail, digest, userInfo, crossPriv) {
      var myName = me();
      var tailLines2 = (tail && tail.length) ? histText(tail, 8, true) : '';
      var nameList = members.map(function (m) { return m.name; });
      var crowdTxt = Array.isArray(group.crowd) ? group.crowd.join('\n') : (group.crowd || '');
      var voices = members.map(function (m) {
        var brief = m.profile ? String(m.profile).trim() : '（无档案）';
        var priv = crossPriv && crossPriv[m.name];
        if (priv && priv.length) {
          brief += '\n※ 仅 ' + m.name + ' 本人知晓：机主今日与 ' + m.name + ' 的私聊——\n'
            + histText(priv, 15, true, snapshot && snapshot.dateText);
        }
        return '- ' + m.name + '：\n' + brief;
      });

      var p = [
        '# 数字世界 · 回应生成',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成应用「微信」的群「' + group.name + '」里新来的消息。',
        '',
        '## 群成员',
        (nameList.length ? nameList.join('、') + '、' + myName : myName) + (group.open ? '，以及若干未具名的其他成员（可让其冒泡，用真实昵称）' : ''),
        crowdTxt ? '其余成员设定：\n' + crowdTxt : '',
        group.style ? '群氛围：' + group.style : '',
        '',
        '## 成员档案',
        voices.join('\n'),
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n（群里的人，群的实际使用者）\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        '## 聊天记录 · 群「' + group.name + '」',
        '（优先承接这里的话题与语气；' + myName + '本轮发来的最新消息在末尾单独给出）',
        digest ? '（更早的记录已折叠为提要，供接续话题与承诺用：' + digest + '）' : '',
        histText(hist, HIST_GROUP, true, snapshot && snapshot.dateText),
        '',
        consistencyRules('每名成员各自')
          + '\n- 输出多行时，每行开头必须是「成员名：」，由各自独立判断自己是否知情。'
          + ((crossPriv && Object.keys(crossPriv).length)
              ? '\n- 成员档案内「※ 仅本人知晓」的私聊内容，其他成员引用一字即出戏；仅该成员本人可自然提及（包括调侃、阴阳怪气、翻旧账）。'
              : ''),
        '',
        '## 输出要求',
        '- 输出 3~8 条群消息，每条一行，格式严格为「成员名：消息」',
        '- 谁接得上这句谁说，不必人人开口；可以互相接梗、拆台',
        '- 每条不超过 35 字，口语',
        typeSyntax(stickerNames),
        '- 直接输出消息，不要以寒暄开头',
        // 群夹带私聊：成员借群里的话题顺势私聊机主的通道（引擎侧已配捕捉路由）。
        // 引导写保守——仅充分理由时用，防每轮都发。
        '- 若某成员有充分理由借机主在群里的话单独私聊机主（如回应机主的需求、私下提醒、单独吐槽群里的的事），可在全部群消息之后追加一个注释块，格式：<!--phone 换行 「成员名：私聊内容」 换行 -->；一条充分理由至多一位成员；没有理由就不要输出该块'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          {
            role: 'user',
            content: tailLines2
              ? '（' + myName + '刚在群「' + group.name + '」里发来以下消息。请严格按上方输出要求，只输出成员们的新消息本身。）\n' + tailLines2
              : '（现在轮到群「' + group.name + '」里的成员们继续聊天。请严格按上方输出要求，只输出群消息本身。）'
          }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Prompt = Prompt;
})();


// ── src/floor.js ──
// ═══════════════════════════════════════════════════════════
//  floor.js —— 楼层记录写入 + 主聊天界面气泡渲染
//
//  楼层记录格式（设计文档 §5.5，双方通用语法）：
//    [📱与周言的私聊 22:49]
//    persona名：在吗
//    周言：[表情:偷看]
//    [/📱]
//
//  写入：独立 system 楼层（整层楼只含此块），主 AI 可裸读。
//  渲染：整块替换为微信样式气泡（操作主页面 DOM，沙盒内经 parent.$）。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var RECORD_RE = /^\s*\[📱([\s\S]*?)\]\s*([\s\S]*?)\s*\[\/📱\]\s*$/;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── 消息 → 楼层行 ──
  function msgToLine(m, userName) {
    if (m.who === 'sys') return String(m.text || ''); // 系统条目（通话时长等）不带人名前缀
    var who = m.who === 'user' ? userName : m.who;
    var body;
    switch (m.kind) {
      case 'sticker': body = '[表情:' + m.text + ']'; break;
      case 'voice':   body = '[语音:' + m.text + ']'; break;
      case 'image':   body = '[图片:' + m.text + ']'; break;
      case 'poke':    body = '[戳一戳]'; break;
      // 通话记录灰泡在楼层存档里就是一行类型标（与列表页预览一致）
      case 'calllog': body = '[' + (m.mode === 'video' ? '视频通话' : '语音通话') + ']'; break;
      case 'location':body = '[定位:' + m.text + ']'; break;
      // 视频通话的画面条目（跨行压成一行，带标记便于模型区分可见状态与台词）
      case 'scene':   body = '（画面：' + String(m.text || '').replace(/\n+/g, '　') + '）'; break;
      default:        body = String(m.text || '');
    }
    return who + '：' + body;
  }

  // ── 生成记录块文本 ──
  function formatRecord(title, msgs, timeText, userName) {
    var head = '[📱' + title + (timeText ? ' ' + timeText : '') + ']';
    var lines = msgs.map(function (m) { return msgToLine(m, userName); });
    return head + '\n' + lines.join('\n') + '\n[/📱]';
  }

  // ── 把记录块渲染成气泡 HTML ──
  function renderRecordHtml(title, bodyText) {
    var W = window.LZWorld;
    var userName = W.Engine ? W.Engine.userName() : '我';
    var stickers = (W.Engine && W.Engine.stickers()) || {};
    var lines = bodyText.split('\n').filter(function (l) { return l.trim(); });
    var rows = [];

    lines.forEach(function (line) {
      var m = line.match(/^([^：:]+)[：:]([\s\S]*)$/);
      if (!m) return;
      var who = m[1].trim();
      var content = m[2].trim();
      // 旧记录里 persona 名可能是当时的取值（如"我"），两种都认作用户
      var isUser = who === userName || who === '我';
      var avatar;
      if (isUser) {
        var uav = W.Engine && W.Engine.userAvatar();
        avatar = uav
          ? '<img class="lzw-ava lzw-ava-me" src="' + esc(uav) + '" alt="">'
          : '<div class="lzw-ava lzw-ava-me">' + esc(who.slice(0, 1)) + '</div>';
      } else {
        var c = W.Engine && W.Engine.findContact(who);
        avatar = c && c.avatar
          ? '<img class="lzw-ava" src="' + esc(W.Worldbook.imgUrl(c.avatar)) + '" alt="">'
          : '<div class="lzw-ava">' + esc(who.slice(0, 1)) + '</div>';
      }

      var bub;
      // 戳一戳单独成行：整行居中灰字，不带头像气泡
      if (content === '[戳一戳]') {
        rows.push('<div class="lzw-pokerow">' + (isUser ? '你戳了戳对方' : esc(who) + '戳了戳你') + '</div>');
        return;
      }
      // 通话记录：灰字一行，不带头像气泡
      if (content === '[语音通话]' || content === '[视频通话]') {
        rows.push('<div class="lzw-pokerow">' + esc(content) + '</div>');
        return;
      }
      var typed = content.match(/^\[(表情|语音|图片|戳一戳|定位)(?::|\||｜)([\s\S]*)\]$/);
      if (typed) {
        var kind = typed[1], arg = (typed[2] || '').trim();
        if (kind === '表情') {
          var file = stickers[arg];
          bub = file
            ? '<img class="lzw-sticker" src="' + esc(W.Worldbook.imgUrl(file)) + '" alt="' + esc(arg) + '" title="' + esc(arg) + '">'
            : '<div class="lzw-bub">[表情:' + esc(arg) + ']</div>';
        } else if (kind === '戳一戳') {
          bub = '<div class="lzw-bub lzw-sys">' + (isUser ? '你戳了戳对方' : esc(who) + '戳了戳你') + '</div>';
        } else if (kind === '语音') {
          bub = '<div class="lzw-bub lzw-voice"><span class="lzw-voice-ico">▶</span>' + esc(arg) + '</div>';
        } else if (kind === '图片') {
          bub = '<div class="lzw-bub lzw-img"><div class="lzw-img-ph">🖼</div><div class="lzw-img-cap">' + esc(arg) + '</div></div>';
        } else {
          bub = '<div class="lzw-bub lzw-sys">📍 ' + esc(arg) + '</div>';
        }
      } else {
        bub = '<div class="lzw-bub">' + esc(content) + '</div>';
      }

      // 头像列（头像+名字），气泡另起一列；me 行用 row-reverse 整体靠右
      rows.push(
        '<div class="lzw-row' + (isUser ? ' lzw-row-me' : '') + '">' +
        '<div><div class="lzw-ava-wrap">' + avatar + '</div><div class="lzw-who">' + esc(who) + '</div></div>' +
        bub +
        '</div>'
      );
    });

    return '<div class="lzw-record">' +
      '<div class="lzw-record-head">📱 ' + esc(title) + '</div>' +
      rows.join('') +
      '</div>';
  }

  // ── 主页面 DOM 操作（原生，不依赖 jQuery） ──
  function pdoc() { return window.parent.document; }

  // 楼层气泡样式（注进主页面；与手机内的类名同前缀，但只作用在 #chat 里）
  var FLOOR_CSS = [
    '#chat .lzw-record{padding:4px 0}',
    '#chat .lzw-record-head{text-align:center;font-size:12px;color:#8a8f99;margin:2px 0 8px}',
    '#chat .lzw-row{display:flex;gap:8px;margin:12px 0;align-items:flex-start}',
    '#chat .lzw-row.lzw-row-me{flex-direction:row-reverse}',
    '#chat .lzw-ava{width:36px;height:36px;border-radius:9px;flex:none;object-fit:cover;background:#c9cfd6;',
    'display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600}',
    '#chat .lzw-ava-me{background:#4d7cfe}',
    '#chat .lzw-who{width:36px;text-align:center;font-size:10px;color:#9aa0a8;margin-top:2px;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#chat .lzw-row>div{min-width:0}',
    '#chat .lzw-bub{max-width:65%;padding:8px 12px;border-radius:12px;background:#fff;color:#111;line-height:1.5;',
    'word-break:break-word;border:1px solid rgba(0,0,0,.06)}',
    '#chat .lzw-row-me .lzw-bub{background:#95ec69;border-color:transparent}',
    '#chat .lzw-bub.lzw-sys{background:transparent;border:none;color:#8a8f99;font-size:12px;padding:2px 4px;max-width:none}',
    '#chat .lzw-sticker{max-width:110px;border-radius:8px}',
    '#chat .lzw-voice-ico{color:#111;margin-right:6px;opacity:.6}',
    '#chat .lzw-img-ph{font-size:22px;text-align:center;padding:8px 0 4px}',
    '#chat .lzw-img-cap{font-size:12px;opacity:.75}',
    '#chat .lzw-pokerow{text-align:center;font-size:12px;color:#8a8f99;margin:10px 0}'
  ].join('\n');
  function ensureStyle() {
    try {
      var doc = pdoc();
      if (!doc.getElementById('lzw-floor-style')) {
        var st = doc.createElement('style');
        st.id = 'lzw-floor-style';
        st.textContent = FLOOR_CSS;
        doc.head.appendChild(st);
      }
    } catch (e) {}
  }

  // 替换某一个楼层的文本为气泡（整块匹配才动，混合内容不碰）
  function renderMesText(el) {
    var raw = el.textContent || '';
    var m = raw.match(RECORD_RE);
    if (!m) return false;
    ensureStyle();
    el.innerHTML = renderRecordHtml(m[1].trim(), m[2]);
    return true;
  }

  var Floor = {
    formatRecord: formatRecord,
    msgToLine: msgToLine,
    RECORD_RE: RECORD_RE,

    // 插入一条记录楼层并渲染。title 如「与周言的私聊」「高三（2）班 群聊」
    insertRecord: async function (title, msgs, timeText) {
      ensureStyle();
      var W = window.LZWorld;
      var userName = W.Engine.userName();
      var block = formatRecord(title, msgs, timeText, userName);

      var before = 0;
      try { before = getChatMessages('0-{{lastMessageId}}').length; } catch (e) {}

      await createChatMessages([{
        role: 'system',
        is_hidden: false,
        message: block
      }], { insert_before: 'end', refresh: 'affected' });

      var mesid = before; // 新楼层 id = 插入前长度
      try {
        var el = pdoc().querySelector('#chat > .mes[mesid="' + mesid + '"] .mes_text');
        if (el) renderMesText(el);
      } catch (e) { console.warn('[霖州引擎] 楼层渲染失败', e); }
      if (W.Store) W.Store.markRendered(mesid);
      return mesid;
    },

    // 全量扫描主聊天界面，把所有记录块渲染成气泡（幂等）
    renderAll: function () {
      try {
        var els = pdoc().querySelectorAll('#chat .mes .mes_text');
        for (var i = 0; i < els.length; i++) renderMesText(els[i]);
      } catch (e) { console.warn('[霖州引擎] 全量渲染失败', e); }
    },

    // NPC 原始输出 → 类型化消息数组（群聊行首带名字）
    parseNpcLines: function (rawText, defaultWho) {
      var out = [];
      String(rawText || '').split('\n').forEach(function (line) {
        line = line.trim();
        if (!line) return;
        var who = defaultWho, body = line;
        if (defaultWho === null) { // 群聊：行首必须是「名字：」
          var gm = line.match(/^([^：:]{1,12})[：:]([\s\S]+)$/);
          if (!gm) return;
          who = gm[1].trim(); body = gm[2].trim();
        }
        if (/^\[撤回\]$/.test(body)) { out.push({ who: who, kind: 'recall', text: '', time: '' }); return; }
        if (/^\[戳一戳\]$/.test(body)) { out.push({ who: who, kind: 'poke', text: '', time: '' }); return; }
        var typed = body.match(/^\[(表情|语音|图片|定位)(?::|\||｜)([\s\S]*)\]$/);
        if (typed) {
          var kindMap = { '表情': 'sticker', '语音': 'voice', '图片': 'image', '戳一戳': 'poke', '定位': 'location' };
          var kind = kindMap[typed[1]];
          var arg = (typed[2] || '').trim();
          if (kind === 'poke') { out.push({ who: who, kind: kind, text: '', time: '' }); return; }
          if (!arg) return;
          if (kind === 'sticker') {
            var real = window.LZWorld.Engine.resolveSticker(arg);
            if (!real) { out.push({ who: who, kind: 'text', text: '[表情:' + arg + ']', time: '' }); return; }
            arg = real;
          }
          out.push({ who: who, kind: kind, text: arg, time: '' });
          return;
        }
        // 普通文字行；寒暄废话与纯括号旁白丢弃
        if (/^(好的[，。！]?|收到|明白了|当然)/.test(body) && body.length < 8) return;
        if (/^[（(][^）)]{1,28}[）)]$/.test(body)) return;
        if (body.length > 120) body = body.slice(0, 120);
        out.push({ who: who, kind: 'text', text: body, time: '' });
      });
      return out.slice(0, 12);
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Floor = Floor;
})();


// ── src/apps/wechat.js ──
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
    // 通话记录灰泡：两边都灰（对齐真实微信），须压过 me 的绿底
    '.lzw-bub.lzw-calllog{display:flex;align-items:center;gap:7px;background:#dcdfe4;color:#333;font-size:12.5px;padding:7px 12px}',
    '.lzw-chatrow.me .lzw-bub.lzw-calllog{background:#dcdfe4;color:#333}',
    '.lzw-calllog-ico{display:inline-flex;transform:rotate(135deg);flex:none}', // 听筒朝下 = 已结束/未接通
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
    '.lzw-callscene{position:relative;z-index:1;align-self:flex-start;margin:2px 0 2px 4px;max-width:86%;font-size:12px;line-height:1.55;color:rgba(255,255,255,.66);text-align:left;text-shadow:0 1px 4px rgba(0,0,0,.65);padding:2px 0}'
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
      // 通话记录灰泡：谁发起的归谁一侧，听筒朝下图标 + 时长/拒绝/取消文案
      bub = '<div class="lzw-bub lzw-calllog"><span class="lzw-calllog-ico">' + ICON_CALL + '</span>' + esc(m.text || '') + '</div>';
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
      var vsec = Math.max(2, Math.min(40, Math.round(m.text.length * 0.7)));
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
    screen: 'home',      // home | list | chat
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
          '</div></div></div>';

      } else if (this.screen === 'list') {
        var sec = eng.section();
        var rowsHtml = '';
        if (sec) {
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
      ph.querySelectorAll('.lzw-back').forEach(function (el) {
        el.onclick = function () {
          UI.screen = el.dataset.act === 'home' ? 'home' : 'list';
          UI.panel = null;
          UI.render();
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
    return '<div class="lzw-appbar"><span class="lzw-back" data-act="list">' + ICON_BACK + '</span><span class="lzw-appbar-t">' + esc(disp || '') + '</span><span class="lzw-appbar-r">' +
      (act ? '<span class="lzw-reroll" data-act="reroll" title="' + (act === 'retry' ? '上一条消息发送失败，点击重新获取回复' : '重新生成对方的上一条回复') + '">' + ICON_REROLL + '</span>' : '') +
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


// ── src/engine.js ──
// ═══════════════════════════════════════════════════════════
//  engine.js —— 数字世界引擎 · 核心装配
//  职责：读世界书 → 定位世界线 → 装载应用 → 独立生成 → 写楼层
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var IMG_BASE = 'https://files.catbox.moe/';

  // 注入块的日期相对标签（与手机界面/提示词同一套口径）
  function parseDayE(s) {
    var m = /(\d+)年(\d+)月(\d+)日/.exec(s || '');
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  }
  function dayRelE(day, cur) {
    var a = parseDayE(day), b = parseDayE(cur);
    if (!a) return day || '';
    if (!b) return a.mo + '月' + a.d + '日';
    var diff = (b.y * 372 + b.mo * 31 + b.d) - (a.y * 372 + a.mo * 31 + a.d);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return (a.y !== b.y ? a.y + '年' : '') + a.mo + '月' + a.d + '日';
  }
  function dayDiffE(a, b) {
    var pa = parseDayE(a), pb = parseDayE(b);
    if (!pa || !pb) return null;
    return (pb.y * 372 + pb.mo * 31 + pb.d) - (pa.y * 372 + pa.mo * 31 + pa.d);
  }

  // 五个主条目名（与卡组世界书一致；长的优先匹配；古代线放最后，多重误开时现代线优先）
  var LINES = ['成人时代-破镜重圆', '成人时代-同路而行', '高中时代', '大学时代', '古代架空-华胥之梦'];

  // 跨会话上下文携带条数（群→私聊 / 私聊→群，均限当天）
  var CROSS_GROUP_TAIL = 20;
  var CROSS_PRIVATE_TAIL = 15;

  // djb2 字符串哈希（主动消息防重键的一部分）
  function hashStr(s) {
    var h = 5381;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // 表情包同义词兜底（模型爱编名字；可继续扩充）
  var STICKER_SYN = {
    '探头': '偷看', '偷偷看': '偷看', '哭': '蛙蛙哭泣', '哭泣': '蛙蛙哭泣',
    '问号': '猫咪问号', '笑': '【可爱】大笑', '哈哈': '【可爱】大笑',
    '害羞': '有一丁点害羞', '晚安': '睡了拜拜', '道歉': '【可爱】道歉',
    '抱抱': '老公抱抱', '摸鱼': '摆烂'
  };

  var state = {
    rosters: {},
    stickers: {},
    profiles: {},
    npcLine: {},       // {线: {名字: 档案文本}}　线专属 NPC 档案（重写，只读它）
    evolLine: {},      // {线: {名字: 演化文本}}　[MAIN·名字·演化后]，叠加在基础人设后
    userEvol: {},      // {线: 文本}　[MAIN·{{user}}·演化后]，用户段的线增量
    entryStates: {},   // {条目标题: 是否勾选开启}
    line: null,        // 当前世界线（主条目名）
    lineSource: null,  // 这条线是怎么定出来的（日志用）
    ready: false
  };

  function on(ev, cb) {
    try {
      if (typeof eventOn === 'function') { eventOn(ev, cb); return; }
    } catch (e) {}
    try { eventSource.on(ev, cb); } catch (e) {}
  }

  var Engine = {
    IMG_BASE: IMG_BASE,

    section: function () {
      return (state.line && this.roster(state.line)) || null;
    },
    stickers: function () { return state.stickers; },
    profiles: function () { return state.profiles; },
    line: function () { return state.line; },
    LINES: LINES.slice(0),
    entryStates: function () { return state.entryStates; },
    // 按线名取通讯录：先精确，再忽略【】与空白比对（JSON key 和条目名略有差异也能对上）
    roster: function (line) {
      if (!line) return null;
      if (state.rosters[line]) return state.rosters[line];
      var want = String(line).replace(/[【】\s]/g, '');
      for (var k in state.rosters) {
        if (k.replace(/[【】\s]/g, '') === want) return state.rosters[k];
      }
      return null;
    },

    // 目标线对应的条目开关操作表：开目标、关其余四条
    lineOps: function (target) {
      return LINES.map(function (l) { return { match: l, enable: l === target }; });
    },

    // 世界书里是否存在某条线的条目（选线界面禁用缺失项用）
    entryKnown: function (line) {
      var want = line.replace(/[【】\s]/g, '');
      var states = state.entryStates;
      for (var k in states) {
        if (k.replace(/[【】\s]/g, '') === want) return true;
      }
      return false;
    },

    // ── 人物档案取用（线感知 + 宏替换）──
    // 世界书原文里的 {{user}} 一律换成 persona 真名——generateRaw 不做宏替换，
    // 原文直发会让 NPC 对着「{{user}}」三个字聊天。
    deref: function (t) {
      var n = this.userName();
      return String(t || '').replace(/\{\{\s*user\s*\}\}/gi, n);
    },

    // 酒馆 persona 描述，两条路：
    // ① 酒馆助手沙盒自带 getPersona('current')（新版才有，旧版 undefined——升级后自动生效）
    // ② 父页 ctx.powerUserSettings.persona_description——ST 核心字段，即当前绑定 persona 的正文
    //    （power_user 是 ES 模块内部变量，window.parent 拿不到，必须走 getContext 的暴露字段）
    // 每次生成现读——换 persona 立刻跟上，不用刷新。
    userPersona: function () {
      var desc = '';
      var src = '';
      try {
        if (typeof getPersona === 'function') {
          var p = getPersona('current');
          if (p && p.description) { desc = String(p.description); src = 'getPersona'; }
        }
      } catch (e) {}
      try {
        if (!desc) {
          var st = window.parent.SillyTavern;
          var ctx = st && st.getContext && st.getContext();
          if (ctx && ctx.powerUserSettings && ctx.powerUserSettings.persona_description) {
            desc = String(ctx.powerUserSettings.persona_description); src = 'powerUserSettings';
          }
        }
      } catch (e) {}
      if (!this._personaLogged) {
        this._personaLogged = true;
        console.log('[霖州引擎] persona 诊断：来源=' + (src || '无') + '，长度=' + desc.length +
          (typeof getPersona === 'function' ? '' : '，getPersona 不存在（酒馆助手版本较旧）'));
      }
      return desc;
    },

    // 取某人在当前线的档案：线NPC库有 → 只读它（各线重写的独立档案）；
    // 否则 基础人设 + 当前线演化层（叠加，不替换）。
    profileFor: function (name) {
      var line = state.line;
      if (line && state.npcLine[line] && state.npcLine[line][name]) {
        return this.deref(state.npcLine[line][name]);
      }
      var base = state.profiles[name] || '';
      if (line && state.evolLine[line] && state.evolLine[line][name]) {
        var evo = state.evolLine[line][name];
        base = base
          ? base + '\n\n当前时间线【' + line + '】的最新人设演化如下（叠加于上方基础人设，不替换）：\n' + evo
          : evo;
      }
      return this.deref(base);
    },

    // ── 跨会话上下文（当天时效）──
    // 群→私聊：对方在的群当天有动静 → 带群记录尾巴（对方在场，与防开天眼规则自洽）
    crossGroups: function (name, dateText) {
      if (!dateText) return [];
      var sec = this.section();
      if (!sec) return [];
      var W = window.LZWorld, out = [];
      (sec.groups || []).forEach(function (g) {
        if ((g.members || []).indexOf(name) === -1) return;
        var h = W.Store.history('group:' + g.name);
        if (!h.length || h[h.length - 1].day !== dateText) return;
        out.push({ name: g.name, hist: h.slice(-CROSS_GROUP_TAIL) });
      });
      return out;
    },
    // 私聊→群：成员与机主当天的私聊 → 挂到该成员档案下（※ 仅本人知晓，规则侧封死其他人的引用）
    crossPrivates: function (members, dateText) {
      if (!dateText) return {};
      var W = window.LZWorld, out = {};
      (members || []).forEach(function (n) {
        var h = W.Store.history(n);
        if (!h.length || h[h.length - 1].day !== dateText) return;
        out[n] = h.slice(-CROSS_PRIVATE_TAIL);
      });
      return out;
    },

    // 机主资料段：persona 描述 + 当前线的 [MAIN·{{user}}·演化后]，每次生成接进提示词末尾区。
    // 两段都在时中间加衔接句，标明演化层叠加于基础资料之上。
    userBlock: function () {
      var persona = this.userPersona();
      var evo = (state.line && state.userEvol[state.line]) ? state.userEvol[state.line] : '';
      var out;
      if (persona && evo) {
        out = persona + '\n\n当前时间线【' + state.line + '】的最新演化如下（叠加于上方机主资料，不替换）：\n' + evo;
      } else {
        out = persona || evo;
      }
      return this.deref(out);
    },

    userName: function () {
      // 沙盒里没有 name1，走主页面 SillyTavern.getContext() 拿 persona 名
      try {
        var st = window.parent.SillyTavern;
        var ctx = st && st.getContext && st.getContext();
        if (ctx && ctx.name1) return String(ctx.name1);
      } catch (e) {}
      try { if (typeof name1 !== 'undefined' && name1) return String(name1); } catch (e) {}
      try {
        var v = getVariables({ type: 'chat' }) || {};
        if (v.name || v.user) return String(v.name || v.user);
      } catch (e) {}
      return '我';
    },

    // 酒馆 persona 头像：只读用户设置面板里当前 persona 的高亮头像块，与聊天楼层无关。
    userAvatar: function () {
      try {
        var pimg = window.parent.document.querySelector('#user_avatar_block .avatar-container.selected .avatar img');
        if (pimg && pimg.src) return pimg.src;
        console.log('[霖州引擎] 头像：persona 面板未找到当前头像');
      } catch (e) { console.warn('[霖州引擎] 头像读取失败：' + (e && e.message)); }
      return '';
    },

    findContact: function (name) {
      var sec = this.section();
      if (!sec) return null;
      for (var i = 0; i < sec.contacts.length; i++) {
        if (sec.contacts[i].name === name) return sec.contacts[i];
      }
      return null;
    },

    resolveSticker: function (name) {
      name = String(name || '').trim().replace(/^[【\[]+|[】\]]+$/g, '');
      if (state.stickers[name]) return name;
      if (STICKER_SYN[name] && state.stickers[STICKER_SYN[name]]) return STICKER_SYN[name];
      var keys = Object.keys(state.stickers);
      for (var i = 0; i < keys.length; i++) {
        var bare = keys[i].replace(/【.*?】/g, '');
        if (bare === name) return keys[i];
      }
      if (name.length >= 2) {
        for (var j = 0; j < keys.length; j++) {
          var b2 = keys[j].replace(/【.*?】/g, '');
          if (keys[j].indexOf(name) !== -1 || b2.indexOf(name) !== -1) return keys[j];
        }
      }
      return null;
    },

    // ── 世界书装载 ──
    load: async function () {
      var data = await window.LZWorld.Worldbook.load();
      state.rosters = data.rosters;
      state.stickers = data.stickers;
      state.profiles = data.profiles;
      state.entryStates = data.states || {};
      // 线作用域档案归线：NPC（…）/ 主角人设（…）里的块按括号里的线名分派，
      // 各线各读各的，根治「同一个人两条线共用一版档案」的串线
      state.npcLine = {}; state.evolLine = {}; state.userEvol = {};
      var raws = [{ list: data.npcLineRaw, into: 'npc' }, { list: data.evolLineRaw, into: 'evol' }];
      for (var ri = 0; ri < raws.length; ri++) {
        for (var rj = 0; rj < (raws[ri].list || []).length; rj++) {
          var line = this.lineOfScope(raws[ri].list[rj].scope);
          if (!line) {
            console.warn('[霖州引擎] 条目作用域「' + raws[ri].list[rj].scope + '」认不出属于哪条线，该条目不生效');
            continue;
          }
          var blocks = raws[ri].list[rj].blocks || {};
          for (var bn in blocks) {
            if (bn === '{{user}}' || bn === 'user') {
              if (raws[ri].into === 'evol') {
                state.userEvol[line] = state.userEvol[line] ? state.userEvol[line] + '\n' + blocks[bn] : blocks[bn];
              }
              continue; // NPC 条目里的 user 块不作档案
            }
            var bucket = raws[ri].into === 'npc' ? state.npcLine : state.evolLine;
            bucket[line] = bucket[line] || {};
            if (!(bn in bucket[line])) bucket[line][bn] = blocks[bn];
          }
        }
      }
      state.ready = true;
      console.log('[霖州引擎] 世界书装载完成：世界线 ' + Object.keys(state.rosters).join(' / ') +
        '｜表情包 ' + Object.keys(state.stickers).length + '｜人设 ' + Object.keys(state.profiles).join('、') +
        '｜线NPC库 ' + Object.keys(state.npcLine).join('、') +
        '｜演化层 ' + Object.keys(state.evolLine).map(function (l) { return l + '(' + Object.keys(state.evolLine[l]).join('/') + ')'; }).join('、'));
    },

    // 「高中线-核心人员」「大学线」「成人线-破镜重圆」这类作用域 → LINES 线名。
    // 取 '-' 前的字头（去掉线/时代尾缀）匹配 LINES 前缀；
    // 命中多条时（成人两条）再用 '-' 后的尾巴收窄；尾巴只是条目内分类（核心/编外）时无影响。
    lineOfScope: function (scope) {
      var s = String(scope || '').replace(/[【】\s]/g, '');
      var tail = '';
      var di = s.indexOf('-');
      if (di !== -1) { tail = s.slice(di + 1); s = s.slice(0, di); }
      s = s.replace(/(?:时代|线)$/, '');
      if (!s) return null;
      var hits = [];
      for (var i = 0; i < LINES.length; i++) {
        var ln = LINES[i].replace(/[【】\s]/g, '');
        if (ln.indexOf(s) === 0) hits.push(LINES[i]);
      }
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) {
        var tailed = hits.filter(function (h) {
          return !tail || h.replace(/[【】\s]/g, '').indexOf(tail) !== -1;
        });
        if (tailed.length) {
          if (tailed.length > 1) console.warn('[霖州引擎] 作用域「' + scope + '」同时命中 ' + tailed.join('、') + '，取第一条');
          return tailed[0];
        }
        console.warn('[霖州引擎] 作用域「' + scope + '」同时命中 ' + hits.join('、') + '，取第一条');
        return hits[0];
      }
      return null;
    },

    // 注意 entryStates 是加载时的快照，玩家随后手动开关条目必须先调 refreshStates()。
    refreshStates: async function () {
      try { state.entryStates = await window.LZWorld.Worldbook.readStates(); } catch (e) {}
    },

    // ── 世界线定位 ──
    // 铁律：聊天记录里存的线是老大，世界书开关只是它的执行层。
    //   有记录 → 开关与记录不一致（含读不出）就写世界书归位（比对过才动手，一致就不碰）；
    //   无记录 → 读开关、写入记录（只写聊天变量，绝不碰世界书条目——记录永远不会提前关掉正在用的条目）；
    //   record=true 才落记录（打开手机时）；启动/切聊天只定显示不落记录——开场白选线等卡内
    //   代码可能在这之后才翻开关，记录要等生成回复后（激活广播）或打开手机时再写。
    // 注意 entryStates 是加载时的快照，动手前必须先调 refreshStates()。
    locateLine: function (record) {
      var W = window.LZWorld;
      var saved = W.Store.line();
      var savedOk = saved && LINES.indexOf(saved) !== -1;
      var switchHit = this.lineBySwitch();

      if (savedOk) {
        if (!(switchHit.known && switchHit.line === saved)) this.reconcileLine(saved, switchHit);
        this.applyLine(saved, '聊天记录');
        return;
      }
      if (switchHit.known && switchHit.line) {
        if (record) W.Store.setLine(switchHit.line);
        this.applyLine(switchHit.line, '主条目开关');
        return;
      }
      // 开关读不出（全关/多开/条目缺失）且无记录：不猜不记，仅临时兜底显示
      for (var lj = 0; lj < LINES.length; lj++) {
        var sec0 = this.roster(LINES[lj]);
        if (sec0 && (sec0.contacts.length || sec0.groups.length)) {
          this.applyLine(LINES[lj], '兜底（开关读不出且无记录，未写入记录）');
          return;
        }
      }
      this.applyLine(null, '无可用世界线');
    },

    // 世界书开关归位到记录中的线（异步写条目；调用前已比对，一致不会走到这）。
    // 写入只影响下一次注入评估——正在进行的生成，注入在开头就定好了，改不动也不该改。
    reconcileLine: function (target, switchHit) {
      if (this._reconciling) return; // 写入是异步的，防重入
      this._reconciling = true;
      var self = this;
      var why = switchHit.known
        ? ('开关当前在【' + (switchHit.line || '全部关闭') + '】')
        : ('开关读不出：' + (switchHit.note || '条目缺失'));
      window.LZWorld.Worldbook.setEntriesEnabled(this.lineOps(target)).then(function () {
        self.noteLineEntries(target);
        console.log('[霖州引擎] 世界书已按聊天记录归位到【' + target + '】（' + why + '）');
        try { toastr.info('已按该聊天记录切换到【' + target + '】（世界书条目已代劳开关）', '📱 霖州引擎'); } catch (e) {}
      }, function (e) {
        console.warn('[霖州引擎] 世界书归位写入失败', e);
        try { toastr.warning('世界书归位失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
      }).then(function () { self._reconciling = false; },
              function () { self._reconciling = false; });
    },

    // 写完条目后把内存里的开关快照同步成目标状态：省一次重读，也防连续误判重复写
    noteLineEntries: function (target) {
      for (var i = 0; i < LINES.length; i++) {
        var want = LINES[i].replace(/[【】\s]/g, '');
        for (var k in state.entryStates) {
          if (k.replace(/[【】\s]/g, '') === want) state.entryStates[k] = (LINES[i] === target);
        }
      }
    },

    // 读五个主条目的勾选状态。返回 {known, line, note}：
    // known=true 表示读到了明确结论（恰好一条开）；
    // known=false 表示读不出（条目缺失 / 多条同时开 / 全部关闭——古代线是真条目，全关不等于古代）。
    lineBySwitch: function () {
      var titles = Object.keys(state.entryStates);
      if (!titles.length) return { known: false, note: '开关字段读不到' };
      var opened = [];
      for (var li = 0; li < LINES.length; li++) {
        var want = LINES[li].replace(/[【】\s]/g, '');
        for (var i = 0; i < titles.length; i++) {
          if (titles[i].replace(/[【】\s]/g, '') === want) {
            if (state.entryStates[titles[i]]) opened.push(LINES[li]);
            break;
          }
        }
      }
      if (opened.length === 1) return { known: true, line: opened[0], note: '主条目开关' };
      console.warn('[霖州引擎] 主条目开关读到 ' + opened.length + ' 条线同时开着（' + (opened.join('、') || '全部关闭') +
        '），视为读不出，改按聊天记录记录归位');
      return { known: false, note: opened.length === 0 ? '主条目全部关闭' : opened.length + ' 条同时开' };
    },

    applyLine: function (line, source) {
      if (state.line === line && state.lineSource === source) return;
      state.line = line;
      state.lineSource = source;
      if (line) console.log('[霖州引擎] 世界线定位：' + line + '（依据：' + source + '）');
      else console.log('[霖州引擎] 世界线定位：无手机世界线（依据：' + source + '）');
      this.syncMount();
    },

    // 世界书激活广播（每次主对话生成后触发）：只在聊天记录还没有记录时写入记录——
    // 有记录的聊天广播说了不算（防止中途手动翻开关被当成换线意图），
    // 归位只发生在进聊天/开手机时。记录写入只碰聊天变量，不碰条目。
    setLineByEntries: function (entries) {
      if (!entries || !entries.length) return;
      var W = window.LZWorld;
      var saved = W.Store.line();
      if (saved && LINES.indexOf(saved) !== -1) return;
      for (var li = 0; li < LINES.length; li++) {
        for (var i = 0; i < entries.length; i++) {
          var title = String((entries[i] && (entries[i].name || entries[i].comment || entries[i].title)) || '');
          if (title.indexOf(LINES[li]) !== -1) {
            W.Store.setLine(LINES[li]);
            this.applyLine(LINES[li], '世界书激活广播');
            return;
          }
        }
      }
    },

    // 有本线通讯录 → 挂手机；没有（古代线）→ 收起
    syncMount: function () {
      var has = !!this.section();
      var UI = window.LZWorld.Apps.wechat;
      if (has) { UI.inject(); UI.render(); }
      else UI.remove();
    },

    // ── 聊天压缩：某会话未折叠的条数超阈值时，把窗口外的旧消息折成提要 ──
    // 提要留在 Store 里，手机提示词用它接续话题；正文注入用 headline 一行近况。
    COMPRESS_AT: 60,      // 未折叠超过 60 条触发（窗口 50 + 10 条缓冲）
    DIGEST_KEEP: 50,      // 提示词直接携带的最近条数

    compress: async function (chatKey) {
      var W = window.LZWorld;
      var hist = W.Store.history(chatKey);
      var meta = W.Store.meta(chatKey);
      var digested = meta.digested || 0;
      if (hist.length - digested <= this.COMPRESS_AT) return meta.digest || '';
      var fold = hist.slice(digested, hist.length - this.DIGEST_KEEP);
      if (!fold.length) return meta.digest || '';
      var lines = fold.map(function (m) {
        return W.Floor.msgToLine(m, this.userName());
      }, this);
      var raw = await generateRaw({
        ordered_prompts: [
          { role: 'system', content: '把以下微信聊天记录折叠成不超过150字的中文提要。保留：约定/计划、冲突与误会、关系进展、未了的情绪；丢弃：寒暄、重复内容。只输出提要本身。' },
          { role: 'user', content: lines.join('\n') }
        ],
        should_silence: true,
        max_chat_history: 0
      });
      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      text = text.trim();
      if (!text) return meta.digest || '';
      var digest = (meta.digest ? meta.digest + '；' : '') + text;
      W.Store.setMeta(chatKey, { digest: digest, digested: digested + fold.length });
      console.log('[霖州引擎] 聊天记录折叠：' + chatKey + ' 折叠 ' + fold.length + ' 条，累计提要 ' + (digested + fold.length) + ' 条');
      return digest;
    },

    // ── 主线楼数（注入判定「多久前聊过」用） ──
    mainCount: function () {
      try { return getChatMessages('0-{{lastMessageId}}').length; } catch (e) { return 0; }
    },

    // ── 正文生成前的手机动态注入：每个入选会话带最近 10 轮完整对话 ──
    INJECT_RECENT_FLOORS: 8,    // 最近 N 楼内聊过 → 带
    INJECT_MENTION_FLOORS: 4,   // 名字出现在最近 N 楼 → 带（哪怕聊得早）
    INJECT_MAX_CHATS: 3,        // 最多带几个会话（按最近活跃优先）
    INJECT_ROUNDS: 20,          // 每会话带最近几条（约 10 轮 user+对方）

    injectDigest: function () {
      try {
        var W = window.LZWorld;
        var sec = this.section();
        if (!sec) return;
        var root = W.Store;
        var myName = this.userName();
        var now = this.mainCount();
        var recentText = '';
        try {
          recentText = getChatMessages('0-{{lastMessageId}}')
            .slice(-this.INJECT_MENTION_FLOORS)
            .map(function (m) { return String((m && m.message) || ''); }).join('\n');
        } catch (e) {}
        var blocks = [];
        var keys = root.historyKeys();
        var cands = [];
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var hist0 = root.history(key);
          if (!hist0.length) continue;
          var meta0 = root.meta(key);
          var isGrp0 = key.indexOf('group:') === 0;
          var nm = isGrp0 ? key.slice(6) : key;
          var hit = false;
          if (meta0.atMainCount != null && now - meta0.atMainCount <= this.INJECT_RECENT_FLOORS) hit = true;
          if (!hit && recentText.indexOf(nm) !== -1) hit = true;
          if (hit) cands.push({ key: key, name: nm, isGrp: isGrp0, meta: meta0 });
        }
        // 最近活跃的会话优先（同活跃楼数按名字稳定排序，保证可预期）
        cands.sort(function (a, b) {
          var d = (b.meta.atMainCount || 0) - (a.meta.atMainCount || 0);
          return d !== 0 ? d : (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0));
        });
        var curDay = ''; try { curDay = W.Status.nowDay(); } catch (e0) {}
        for (var ci = 0; ci < cands.length && blocks.length < this.INJECT_MAX_CHATS; ci++) {
          var hist = root.history(cands[ci].key);
          var meta = cands[ci].meta;
          var name = cands[ci].name;
          var ago = meta.atMainCount != null ? Math.max(0, now - meta.atMainCount) : null;
          var slice = hist.slice(-this.INJECT_ROUNDS);
          var firstDay = null;
          for (var fi = 0; fi < slice.length; fi++) { if (slice[fi].day) { firstDay = slice[fi].day; break; } }
          // 头部时间标：优先按消息自身的故事日期算时间差；旧记录没有 day 才退回楼层差
          var when = '';
          var dd = firstDay ? dayDiffE(firstDay, curDay) : null;
          if (dd != null) when = dd === 0 ? '（今天）' : dd === 1 ? '（昨天）' : (dd <= 31 ? '（' + dd + '天前）' : '（' + dayRelE(firstDay, curDay) + '）');
          else if (ago != null) when = '（' + ago + ' 楼前）';
          var prevDay = null;
          var lines = [];
          slice.forEach(function (m) {
            if (m.day && m.day !== prevDay) {
              lines.push('〔' + dayRelE(m.day, curDay) + (m.time ? ' ' + m.time : '') + '〕');
              prevDay = m.day;
            }
            lines.push((m.who === 'user' ? myName : m.who) + '：' + W.Floor.msgToLine(m, myName).replace(/^[^：]*：/, ''));
          });
          blocks.push('「' + name + '」' + (cands[ci].isGrp ? '（群聊，仅群成员知情）' : '（私聊，仅对话双方知情）') + when + '：\n' + lines.join('\n'));
        }
        if (!blocks.length) return;
        injectPrompts([{
          id: 'lzw-phone-digest',
          position: 'in_chat',
          depth: 1,   // 历史正文内部、最后一楼之上——物理上位于所有 D0 规则上方
          role: 'system',
          content: '【手机近况 · 微信】' + myName + '近期在手机上聊过天（仅作背景，正文不必专门提及。角色可自然引用自己参与过的聊天——私聊只限对话双方、群聊只限群成员知情；不得说出自己不在场的私聊内容）：\n' + blocks.join('\n')
        }], { once: true });
      } catch (e) { console.warn('[霖州引擎] 手机动态注入失败', e); }
    },

    // ── 主动消息捕捉：正文末位 <!--phone ... --> 注释块 ──
    // 卡契约：主 AI 按世界书规则条目在正文末尾输出。ST 渲染时清洗 HTML 注释 → 正文
    // 天然不可见，原始文本完好。此处抠出后经 Floor.parseNpcLines（群模式，每行
    // 「名字：内容」，契约语法 [语音:…]/[图片:…] 照常可用）写入各联系人聊天记录。
    // 已处理消息 id 落聊天变量防重——重进聊天文件不会二次触发。
    // 只挂即时生成事件、不做历史补扫（避免扫全楼层）。
    capturePhoneBlock: function (msg) {
      return this.capturePhoneText(String((msg && msg.message) || ''));
    },
    // 从任意文本里抠 <!--phone--> 主动块并按人路由进私聊（带未读/近况元信息）。
    // 正文末位捕捉与手机群聊生成夹带私聊，两条管道共用此函数。
    capturePhoneText: function (text) {
      var W = window.LZWorld;
      var re = /<!--\s*phone\s*([\s\S]*?)-->/gi;
      var m, body = '';
      while ((m = re.exec(String(text || '')))) body += (body ? '\n' : '') + m[1];
      if (!body.trim()) return [];
      var parsed;
      try { parsed = W.Floor.parseNpcLines(body, null); } catch (e) { return []; }
      if (!parsed.length) return [];
      var byWho = {};
      parsed.forEach(function (p) { (byWho[p.who] = byWho[p.who] || []).push(p); });
      var names = Object.keys(byWho);
      var UI = W.Apps && W.Apps.wechat;
      names.forEach(function (n) {
        W.Store.push(n, byWho[n], 100);
        // 未读：正开着该对话框看 = 已读；否则累加红点（打开即清零，见 wechat.openChat）
        var viewing = UI && UI.screen === 'chat' && UI.chatKey === n;
        if (!viewing) W.Store.bumpUnread(n, byWho[n].length);
        var arr = byWho[n];
        var last = arr[arr.length - 1];
        var headText = last.kind === 'text' ? last.text
          : last.kind === 'calllog' ? '[' + (last.mode === 'video' ? '视频通话' : '语音通话') + ']'
          : '[' + ({ sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' }[last.kind] || '消息') + ']';
        W.Store.setMeta(n, { headline: String(headText).slice(0, 40), atMainCount: Engine.mainCount() });
      });
      return names;
    },
    // 扫最近的 assistant 消息（默认 5 条，仅即时事件后调用），抓未处理键里的注释块。
    // 防重键 = 楼层id + swipe序号 + 块内容哈希：重 roll 同层新 swipe 会换新键正常
    // 再捕捉；同层同 swipe 重复扫描才跳过。
    // 注意：酒馆助手的 getChatMessages 必须带范围参数（裸调会 throw），
    // 返回对象的楼层号是 message_id（不是 id）。
    sweepPhoneBlocks: function (backlog) {
      var msgs;
      try { msgs = getChatMessages('0-{{lastMessageId}}'); } catch (e) {
        console.warn('[霖州引擎] 主动消息扫描：getChatMessages 失败', e);
        return;
      }
      if (!msgs || !msgs.length) return;
      msgs = msgs.slice(-(backlog || 5));
      var W = window.LZWorld;
      var seen = W.Store.procIds();
      for (var i = 0; i < msgs.length; i++) {
        var mm = msgs[i];
        if (!mm || mm.role !== 'assistant') continue;
        var mid = mm.message_id != null ? mm.message_id : (mm.id != null ? mm.id : ('idx' + i));
        var swipe = mm.swipe_id != null ? mm.swipe_id : 0;
        var blockM = /<!--\s*phone\s*([\s\S]*?)-->/i.exec(String(mm.message || ''));
        var key = mid + ':' + swipe + ':' + (blockM ? hashStr(blockM[1]) : '-');
        if (seen.indexOf(key) !== -1) continue;
        var names = [];
        if (blockM) {
          try { names = this.capturePhoneBlock(mm); } catch (e) {
            console.warn('[霖州引擎] 主动消息捕捉失败', e);
          }
        }
        W.Store.markProcId(key);
        seen.push(key);
        if (names.length) {
          console.log('[霖州引擎] 主动消息：' + names.join('、') + '（楼层 ' + mid + ' swipe ' + swipe + '）');
          try { toastr.info('📱 ' + names.join('、') + ' 发来了新消息', '霖州手机', { timeOut: 4000 }); } catch (e) {}
          try { W.Floor.renderAll(); } catch (e) {}
          try { var UI = W.Apps.wechat; if (UI && UI.screen) UI.render(); } catch (e) {}
        }
      }
    },

    // ── 独立生成 ──
    generateFor: async function (chatKey, isGroup) {
      var W = window.LZWorld;
      var sec = this.section();
      if (!sec) throw new Error('当前世界线无通讯录');

      var digest = await this.compress(chatKey);
      var stickerNames = Object.keys(state.stickers).slice(0, 120);
      var userInfo = this.userBlock();
      var raw, title, parseGroup = false;

      if (!isGroup) {
        var c = this.findContact(chatKey);
        if (!c) throw new Error('联系人不在本线通讯录：' + chatKey);
        var profile = this.profileFor(c.name);
        var snap = W.Status.snapshot(c.name);
        var hist = W.Store.history(chatKey);
        // 最新一批连续的用户消息摘出来作为最终 user 轮次，其余留在系统块的应用内记录里
        var tail = [];
        for (var hi = hist.length - 1; hi >= 0 && hist[hi].who === 'user'; hi--) tail.unshift(hist[hi]);
        var rest = hist.slice(0, hist.length - tail.length);
        var req = W.Prompt.private({ name: c.name, profile: profile }, rest, snap, stickerNames, tail, digest, userInfo,
          this.crossGroups(c.name, snap && snap.dateText));
        raw = await generateRaw(req);
        title = '与' + c.name + '的私聊';
      } else {
        var gname = chatKey.replace(/^group:/, '');
        var g = null;
        for (var i = 0; i < sec.groups.length; i++) if (sec.groups[i].name === gname) g = sec.groups[i];
        if (!g) throw new Error('群不在本线通讯录：' + gname);
        var members = (g.members || []).map(function (n) {
          return { name: n, profile: this.profileFor(n) };
        }, this);
        var snap2 = W.Status.snapshot(null);
        var hist2 = W.Store.history(chatKey);
        var tail2 = [];
        for (var hj = hist2.length - 1; hj >= 0 && hist2[hj].who === 'user'; hj--) tail2.unshift(hist2[hj]);
        var rest2 = hist2.slice(0, hist2.length - tail2.length);
        var req2 = W.Prompt.group({ name: g.name, open: g.open, style: g.style, crowd: g.crowd }, members, rest2, snap2, stickerNames, tail2, digest, userInfo,
          this.crossPrivates(g.members, snap2 && snap2.dateText));
        raw = await generateRaw(req2);
        title = g.name + ' 群聊';
        parseGroup = true;
      }

      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      // 群聊生成可夹带 <!--phone--> 私聊主动块（成员借群里的话题顺势私聊机主）：
      // 路由进各私聊 + 红点 + toast，然后从回复里剥掉，免得被群解析器吃进记录
      if (parseGroup && /<!--\s*phone/i.test(text)) {
        var sideNames = [];
        try { sideNames = this.capturePhoneText(text); } catch (e) { console.warn('[霖州引擎] 群聊夹带私聊捕捉失败', e); }
        if (sideNames.length) {
          try { toastr.info('📱 ' + sideNames.join('、') + ' 借机私聊了你', '霖州手机', { timeOut: 4000 }); } catch (e) {}
          try { W.Floor.renderAll(); } catch (e) {}
          try { var UI0 = W.Apps && W.Apps.wechat; if (UI0 && UI0.screen && !UI0.call) UI0.render(); } catch (e) {}
        }
        text = text.replace(/<!--\s*phone\s*([\s\S]*?)-->/gi, '');
      }
      var msgs = W.Floor.parseNpcLines(text, parseGroup ? null : chatKey);
      if (!msgs.length) throw new Error('生成结果为空');
      // 一行近况（正文注入用）：取最后一条消息的核心内容
      var lastMsg = msgs[msgs.length - 1];
      var headText = lastMsg.kind === 'text' ? lastMsg.text
        : lastMsg.kind === 'calllog' ? '[' + (lastMsg.mode === 'video' ? '视频通话' : '语音通话') + ']'
        : '[' + ({ sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' }[lastMsg.kind] || '消息') + ']';
      W.Store.setMeta(chatKey, { headline: String(headText).slice(0, 40), atMainCount: this.mainCount() });
      return { key: chatKey, title: title, msgs: msgs };
    },



    // ── 语音/视频通话 ──
    // transcript 存 Store key「call:名字」，与聊天记录平级的一级历史：
    // 挂断时把时长写进私聊系统条目，跨场景/摘要/红点管道全部现成可用。
    // 拨打流程：呼叫页（等 AI）→ AI 以 [拒绝] 开头 = 拒接回聊天页；否则开场白
    // 进 transcript 直接接通。通话轮 = 「机主说一句 → 对方回台词」循环。
    callKey: function (name) { return 'call:' + name; },

    // 拨打邀请：AI 决定接/拒
    callInvite: async function (name, mode) {
      var W = window.LZWorld;
      var c = this.findContact(name);
      if (!c) throw new Error('联系人不在本线通讯录：' + name);
      var profile = this.profileFor(name);
      var snap = W.Status.snapshot(name);
      var userInfo = this.userBlock();
      var req = W.Prompt.callInvite({ name: c.name, profile: profile }, W.Store.history(name).slice(-30), snap, userInfo, mode,
        this.crossGroups(c.name, snap && snap.dateText));
      var raw = await generateRaw(req);
      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      return text.trim();
    },

    // 通话输出拆分（保序，视频用）：逐行扫描，[画面] 行是画面条目，其余是台词，
    // 按出现顺序交织返回——说到哪演到哪，画面不堆在开头。
    // 兼容旧格式：[画面] 行后未写完的续行一直收到单独一行的 --- 为止。
    splitCallOutput: function (text) {
      var entries = [];
      var sceneBuf = null;
      String(text || '').split('\n').forEach(function (raw) {
        var ln = raw.trim();
        if (!ln) return;
        if (/^-{3,}\s*$/.test(ln)) { // 分隔线：旧格式的画面块到此闭合落档
          if (sceneBuf) { entries.push({ kind: 'scene', text: sceneBuf }); sceneBuf = null; }
          return;
        }
        var m = ln.match(/^\[画面\]\s*(.*)$/);
        if (m) {
          if (m[1]) { entries.push({ kind: 'scene', text: m[1] }); sceneBuf = null; }
          else sceneBuf = ''; // 空标记行：后续续行进画面块，直到 --- 或下一行 [画面]
          return;
        }
        if (sceneBuf != null) { sceneBuf = sceneBuf ? sceneBuf + '\n' + ln : ln; return; }
        entries.push({ kind: 'line', text: ln });
      });
      if (sceneBuf) entries.push({ kind: 'scene', text: sceneBuf });
      return entries;
    },

    callTurn: async function (name, mode, userSays) {
      var W = window.LZWorld;
      var c = this.findContact(name);
      if (!c) throw new Error('联系人不在本线通讯录：' + name);
      var profile = this.profileFor(name);
      var snap = W.Status.snapshot(name);
      var userInfo = this.userBlock();
      var hist = W.Store.history(this.callKey(name));
      var tail = [];
      for (var i = Math.max(0, hist.length - 30); i < hist.length; i++) {
        var m = hist[i];
        if (m.who === 'sys') continue;
        tail.push(m);
      }
      // 机主本轮说的话已由 user 角色消息单独携带——transcript 里去掉尾部连续的机主条目，
      // 避免同一句在提示词里出现两次（userSays 为空 = 重说轮，机主的话是上下文，必须保留）
      if (userSays) while (tail.length && tail[tail.length - 1].who === 'user') tail.pop();
      var lines = tail.map(function (m2) { return W.Floor.msgToLine(m2, this.userName()); }, this);
      var req = W.Prompt.callTurn({ name: c.name, profile: profile }, lines.join('\n'), W.Store.history(name).slice(-20), snap, userInfo, mode,
        this.crossGroups(c.name, snap && snap.dateText), userSays || '');
      var raw = await generateRaw(req);
      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      // 剥注释块防污染（极端情况：AI 在通话里输出主动块）
      text = text.replace(/<!--" + BS + "s*phone" + BS + "s*([" + BS + "s" + BS + "S]*?)-->/gi, '');
      // 视频通话拆成保序条目流：[画面] 行与台词行按出现顺序交织（音频永远无画面）
      var entries = [];
      if (mode === 'video') {
        this.splitCallOutput(text).slice(0, 16).forEach(function (en) { entries.push(en); });
      } else {
        text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 12)
          .forEach(function (l) { entries.push({ kind: 'line', text: l }); });
      }
      return { entries: entries };
    },

    // ── 快捷回复按钮自装 ──
    // 父页面全局暴露 quickReplyApi（酒馆自带QR扩展）。装一个「📱 手机」按钮到
    // 自建的「霖州手机」按钮集并全局显示；已存在则跳过，可重复执行。
    installQr: function () {
      var SET = '霖州手机';
      try {
        var api = window.parent.quickReplyApi;
        if (!api || typeof api.createSet !== 'function') {
          console.log('[霖州引擎] 父页未暴露快捷回复API，跳过按钮自装（可手动建QR按钮，命令：/event-emit event="lzw-phone-toggle"）');
          return;
        }
        if (api.listSets().indexOf(SET) === -1) {
          api.createSet(SET, {});
          console.log('[霖州引擎] 快捷回复：已创建按钮集「' + SET + '」');
        }
        if (api.listQuickReplies(SET).indexOf('📱 手机') === -1) {
          api.createQuickReply(SET, '📱 手机', {
            message: '/event-emit event="lzw-phone-toggle"',
            title: '霖州·数字世界（再点一次关闭）'
          });
          console.log('[霖州引擎] 快捷回复：已安装「📱 手机」按钮');
        }
        if (api.listQuickReplies(SET).indexOf('🧭 世界线') === -1) {
          api.createQuickReply(SET, '🧭 世界线', {
            message: '/event-emit event="lzw-line-switch"',
            title: '切换 IF 世界线（五条线选一，代劳开关世界书并记入本聊天）'
          });
          console.log('[霖州引擎] 快捷回复：已安装「🧭 世界线」按钮');
        }
        if (api.listGlobalSets().indexOf(SET) === -1) {
          api.addGlobalSet(SET, true);
          console.log('[霖州引擎] 快捷回复：按钮集「' + SET + '」已设为全局显示');
        }
      } catch (e) {
        console.warn('[霖州引擎] 快捷回复自装失败（不影响手机本体，可手动建按钮，命令：/event-emit event="lzw-phone-toggle"）', e);
      }
    },

    // ── 启动 ──
    init: async function () {
      var W = window.LZWorld;
      W.IMG_BASE = IMG_BASE;

      await this.load();

      this.locateLine();
      this.installQr();
      try { W.Floor.renderAll(); } catch (e) {}

      // 快捷回复入口：QR 按钮命令 /event-emit event="lzw-phone-toggle"
      try {
        on('lzw-phone-toggle', async function () {
          // 开场白选线等卡内代码可能刚切过世界线开关（页面加载后发生），
          // 重开手机时重新归位；开关状态是加载时的快照，须先重读
          await Engine.refreshStates();
          Engine.locateLine(true); // 开手机也是记录时机：无记录则按当前开关写入
          var ui = W.Apps.wechat;
          if (!Engine.section()) {
            try { toastr.info('当前世界线没有手机（古代线或未定位）', '📱 霖州引擎'); } catch (e) {}
            return;
          }
          ui.inject();
          ui.toggle();
        });
      } catch (e) {}

      // 选线入口：QR 按钮命令 /event-emit event="lzw-line-switch" → 手机选线界面
      try {
        on('lzw-line-switch', async function () {
          await Engine.refreshStates(); // 列表要显示真实开关状态（手动翻过也能一眼看出）
          W.Apps.wechat.showLines();
        });
      } catch (e) {}

      // 世界书激活广播 → 世界线定位（每次主对话生成后触发）
      try {
        on(tavern_events.WORLD_INFO_ACTIVATED, function (entries) {
          Engine.setLineByEntries(entries);
        });
      } catch (e) {}

      // 正文生成前：注入手机动态（一行近况/会话，绝不带原始记录）
      try {
        on(tavern_events.GENERATION_AFTER_COMMANDS, function () {
          Engine.injectDigest();
        });
      } catch (e) {}

      // 正文生成完成 → 捕捉末位 <!--phone--> 主动消息注释块（只扫最后几楼，id 查重防重）
      try {
        var genDone = (typeof tavern_events !== 'undefined' && tavern_events.GENERATION_ENDED) || 'generation_ended';
        on(genDone, function () { Engine.sweepPhoneBlocks(5); });
      } catch (e) {}

      // 切聊天 → 重载（聊天变量随卡切换，需重新渲染）
      var reinitTimer = null;
      try {
        on(tavern_events.CHAT_CHANGED, function () {
          clearTimeout(reinitTimer);
          reinitTimer = setTimeout(async function () {
            await Engine.refreshStates();
            Engine.locateLine(); // 切聊天只定显示不落记录（开场白可能在这之后才选线）
            Engine.syncMount();
            try { W.Floor.renderAll(); } catch (e) {}
            var UI = W.Apps.wechat;
            if (UI.screen) { UI.screen = 'home'; UI.render(); }
          }, 400);
        });
      } catch (e) {}

      console.log('[霖州引擎] 初始化完成');
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Engine = Engine;

  // 启动
  Engine.init().catch(function (e) {
    console.warn('[霖州引擎] 初始化失败', e);
    try { toastr.error('引擎初始化失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
  });
})();

