// ═══════════════════════════════════════════════════════════
//  霖州往事 · 数字世界引擎（构建产物，勿手改）
//  源码见 src/ · 构建：node build/build.js
//  构建时间：2026-09-11T14:30:25.481Z
// ═══════════════════════════════════════════════════════════
var __LZW_BUILD__ = '2026-09-11 14:30';
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
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
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
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
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
      case 'location': return '[定位:' + m.text + ']';
      default:         return String(m.text || '');
    }
  }

  // ── 应用内聊天记录文本（发言人用真名，不再出现 {{user}}） ──
  function histText(hist, n, withNames) {
    return hist.slice(-n).map(function (m) {
      var body = msgBody(m);
      if (m.recalled) body += '（此条已撤回）';
      if (!withNames) return body;
      var who = m.who === 'user' ? me() : m.who;
      return who + '：' + body;
    }).join('\n');
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
    private: function (contact, hist, snapshot, stickerNames, tail, digest) {
      var myName = me();
      var tailLines = (tail && tail.length) ? histText(tail, 8, false) : '';
      var p = [
        '# 数字世界 · 回应生成',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成应用「微信」里，来自「' + contact.name + '」的新消息。',
        '',
        contact.profile ? '## 人物档案\n' + contact.profile : '## 人物档案\n（暂无档案，依据对话上下文自然演绎）',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        '## 聊天记录 · 与' + myName + '的微信对话',
        '（优先承接这里的话题与语气；' + myName + '本轮发来的最新消息在末尾单独给出）',
        digest ? '（更早的记录已折叠为提要，供接续话题与承诺用：' + digest + '）' : '',
        histText(hist, HIST_PRIVATE, false),
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

    // ── 群聊 ──
    group: function (group, members, hist, snapshot, stickerNames, tail, digest) {
      var myName = me();
      var tailLines2 = (tail && tail.length) ? histText(tail, 8, true) : '';
      var nameList = members.map(function (m) { return m.name; });
      var voices = members.map(function (m) {
        var brief = m.profile ? String(m.profile).replace(/\s+/g, ' ').slice(0, 500) : '（无档案）';
        return '- ' + m.name + '：' + brief;
      });

      var p = [
        '# 数字世界 · 回应生成',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成应用「微信」的群「' + group.name + '」里新来的消息。',
        '',
        '## 群成员',
        nameList.join('、') + '、' + myName + (group.open ? '，以及若干未具名的路人（可让其冒泡，用真实昵称）' : ''),
        '',
        '## 成员档案',
        voices.join('\n'),
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        '## 聊天记录 · 群「' + group.name + '」',
        '（优先承接这里的话题与语气；' + myName + '本轮发来的最新消息在末尾单独给出）',
        digest ? '（更早的记录已折叠为提要，供接续话题与承诺用：' + digest + '）' : '',
        histText(hist, HIST_GROUP, true),
        '',
        consistencyRules('每名成员各自') + '\n- 输出多行时，每行开头必须是「成员名：」，由各自独立判断自己是否知情。',
        '',
        '## 输出要求',
        '- 输出 3~8 条群消息，每条一行，格式严格为「成员名：消息」',
        '- 谁接得上这句谁说，不必人人开口；可以互相接梗、拆台',
        '- 每条不超过 35 字，口语',
        typeSyntax(stickerNames),
        '- 直接输出消息，不要以寒暄开头'
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
    var who = m.who === 'user' ? userName : m.who;
    var body;
    switch (m.kind) {
      case 'sticker': body = '[表情:' + m.text + ']'; break;
      case 'voice':   body = '[语音:' + m.text + ']'; break;
      case 'image':   body = '[图片:' + m.text + ']'; break;
      case 'poke':    body = '[戳一戳]'; break;
      case 'location':body = '[定位:' + m.text + ']'; break;
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
    'padding:4px 20px 0;position:relative;color:#111;z-index:3;background:#f7f7f9}',
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
    '.lzw-appbar-t{flex:1;text-align:center;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lzw-back{display:inline-flex;align-items:center;color:#111;cursor:pointer;padding:4px;border-radius:8px;margin-left:-4px}',
    '.lzw-back:hover{background:rgba(0,0,0,.05)}',
    '.lzw-appbar-r{width:24px}',
    '.lzw-reroll{display:inline-flex;color:#666;cursor:pointer;padding:5px;border-radius:8px;align-items:center;justify-content:center}',
    '.lzw-reroll:hover{background:rgba(0,0,0,.06)}',
    // 主体
    '.lzw-body{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;position:relative;z-index:1}',
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
    '.lzw-ava{width:34px;height:34px;border-radius:9px;flex:none;object-fit:cover;background:#c9cfd6;',
    'display:flex;align-items:center;justify-content:center;color:#fff;font-size:13.5px;font-weight:600}',
    '.lzw-ava-me{background:#4d7cfe}',
    '.lzw-conv-main{flex:1;min-width:0}',
    '.lzw-conv-name{font-weight:500;font-size:14px}',
    '.lzw-conv-prev{font-size:12px;color:#8a8f99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    // 聊天
    '.lzw-chatbg{background:#f2f2f5;min-height:100%;padding:4px 0 10px}',
    '.lzw-chatrow{display:flex;gap:7px;margin:11px 12px;align-items:flex-start}',
    '.lzw-chatrow.me{flex-direction:row-reverse}',
    '.lzw-bub{max-width:62%;padding:8px 11px;border-radius:9px;background:#fff;color:#111;line-height:1.45;font-size:13.5px;',
    'word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.05)}',
    '.lzw-chatrow.me .lzw-bub{background:#95ec69}',
    '.lzw-bub.lzw-sys{background:transparent;box-shadow:none;color:#8a8f99;font-size:12px;padding:2px 4px}',
    '.lzw-sticker{max-width:120px;border-radius:8px}',
    '.lzw-voice{display:flex;flex-wrap:wrap;align-items:center;gap:6px;cursor:pointer}',
    '.lzw-voice-ico{color:#111;opacity:.65;font-size:12px}',
    '.lzw-voice-bar{display:inline-flex;align-items:flex-end;gap:2px;height:13px}',
    '.lzw-voice-bar i{display:block;width:3px;background:#111;opacity:.6;border-radius:1px}',
    '.lzw-voice-bar i:nth-child(1){height:5px}.lzw-voice-bar i:nth-child(2){height:9px}.lzw-voice-bar i:nth-child(3){height:13px}',
    '.lzw-voice-s{font-size:10px;color:#a7abb2}',
    '.lzw-voicetxt{display:none;flex-basis:100%;margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,.08);font-size:13px;color:#333;line-height:1.5}',
    '.lzw-voice.open .lzw-voicetxt{display:block}',
    '.lzw-imgbox{width:140px;padding:0;border-radius:9px;overflow:hidden;position:relative}',
    '.lzw-imgph{height:140px;background:linear-gradient(140deg,#b9c6d2,#dfe7ee);display:flex;align-items:center;justify-content:center;font-size:28px}',
    '.lzw-imgbox .cap{position:absolute;left:0;right:0;bottom:0;font-size:11.5px;line-height:1.4;padding:14px 8px 6px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.55))}',
    '.lzw-locbox{width:160px;padding:0;border-radius:9px;overflow:hidden;background:#fff}',
    '.lzw-chatrow.me .lzw-bub.lzw-locbox,.lzw-chatrow.me .lzw-bub.lzw-imgbox{background:#fff}',
    '.lzw-locmap{height:80px;position:relative;background:linear-gradient(140deg,#b7d9b0,#e8f3e4)}',
    '.lzw-locmap:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 13px,rgba(255,255,255,.55) 13px 14px),repeating-linear-gradient(90deg,transparent 0 13px,rgba(255,255,255,.55) 13px 14px)}',
    '.lzw-locmap:after{content:"📍";position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:26px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}',
    '.lzw-locbox .cap{font-size:12.5px;font-weight:600;padding:7px 9px}',
    '.lzw-sysrow{text-align:center;font-size:11.5px;color:#9aa0a8;margin:10px 0}',
    '.lzw-recallrow{text-align:center;font-size:12px;color:#9aa0a8;margin:13px 0;line-height:1.7;cursor:pointer}',
    '.lzw-poke{display:inline-block;background:#dcdfe4;color:#333;font-size:12.5px;padding:7px 16px;border-radius:16px;cursor:pointer}',
    '.lzw-poke.shake{animation:lzw-shake .5s}',
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
    '.lzw-modeok{align-self:flex-end;border:none;border-radius:8px;background:#22c05e;color:#fff;font-size:13.5px;padding:7px 20px;cursor:pointer}',
    '.lzw-stickgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:10px 4px;max-height:170px;overflow-y:auto;overflow-x:hidden;padding-bottom:6px}',
    '.lzw-stickcell{cursor:pointer;text-align:center}',
    '.lzw-stickcell .imgw{width:56px;height:56px;margin:0 auto;border-radius:8px;overflow:hidden;background:#eceff3}',
    '.lzw-stickcell img{width:100%;height:100%;object-fit:cover;display:block}',
        // 滚动条（统一的细灰条，不用浏览器默认样式）
    // 滚动条：细、淡灰、无箭头、透明轨道（webkit + Firefox 双管）
    '.lzw-screen ::-webkit-scrollbar{width:5px;height:5px}',
    '.lzw-screen ::-webkit-scrollbar-button{display:none;width:0;height:0;background:transparent;border:none;-webkit-appearance:none}',
    '.lzw-screen ::-webkit-scrollbar-corner{background:transparent}',
    '.lzw-screen ::-webkit-scrollbar-track{background:transparent}',
    '.lzw-screen ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}',
    '.lzw-screen ::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.26)}',
    '.lzw-screen *{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}',
    // 底部 home 指示条
    '.lzw-homebar{flex:none;height:18px;display:flex;align-items:center;justify-content:center;background:#f7f7f9;position:relative;z-index:3}',
    '.lzw-homebar:after{content:"";display:block;width:110px;height:4px;border-radius:2px;background:rgba(0,0,0,.75)}'
  ].join('\n');

  var ICON_REROLL = '<svg width="18" height="18" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 85.333333c102.869333 0 199.509333 36.693333 275.029333 100.437334l93.866667-94.037334a21.333333 21.333333 0 0 1 36.437333 15.061334V384a21.333333 21.333333 0 0 1-21.333333 21.333333h-276.693333a21.333333 21.333333 0 0 1-15.104-36.394666l122.325333-122.496a341.333333 341.333333 0 1 0 118.314667 341.632 42.666667 42.666667 0 1 1 83.2 18.901333A426.794667 426.794667 0 0 1 512 938.666667C276.352 938.666667 85.333333 747.648 85.333333 512S276.352 85.333333 512 85.333333z"/></svg>';

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
      bub = '<div class="lzw-poke" data-poke="1">' + (isUser ? '你戳了戳 ' + esc(targetName || '对方') : esc(who) + ' 戳了戳你') + '</div>';
      return '<div style="text-align:center" data-del="' + idx + '">' + bub + '</div>';
    } else if (m.kind === 'voice') {
      bub = '<div class="lzw-bub lzw-voice" data-voice="1"><span class="lzw-voice-ico">▶</span><span class="lzw-voice-bar"><i></i><i></i><i></i></span><span class="lzw-voice-s">转文字</span><div class="lzw-voicetxt">' + esc(m.text) + '</div></div>';
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
    return '<div class="lzw-chatrow' + (isUser ? ' me' : '') + '" data-del="' + idx + '">' + avatar + bub + '</div>';
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
    confirmDel: -1,       // 待确认删除的消息下标（-1=无）
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
        (this.confirmDel >= 0 ? '<div class="lzw-scrim"><div class="lzw-confirm">删除这条消息？<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="cancel">取消</button><button class="lzw-cbtn yes" data-cact="del">删除</button></div></div></div>' : '') +
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
      // 右键（PC）或长按 550ms（触屏）消息 → 弹确认窗，防止误删
      ph.oncontextmenu = function (e) {
        var row = e.target && e.target.closest ? e.target.closest('[data-del]') : null;
        if (!row) return;
        e.preventDefault();
        UI.confirmDel = parseInt(row.getAttribute('data-del'), 10);
        UI.render();
      };
      var lpTimer = null;
      ph.ontouchstart = function (e) {
        var row = e.target && e.target.closest ? e.target.closest('[data-del]') : null;
        lpTimer = row ? setTimeout(function () {
          UI.confirmDel = parseInt(row.getAttribute('data-del'), 10);
          UI.render();
        }, 550) : null;
      };
      ph.ontouchend = function () { clearTimeout(lpTimer); };
      ph.ontouchmove = function () { clearTimeout(lpTimer); };
      ph.querySelectorAll('[data-cact]').forEach(function (el) {
        el.onclick = function () {
          if (el.getAttribute('data-cact') === 'del') UI.removeAt(UI.confirmDel);
          UI.confirmDel = -1;
          UI.render();
        };
      });
      ph.querySelectorAll('[data-voice]').forEach(function (el) {
        el.onclick = function () { el.classList.toggle('open'); };
      });
      ph.querySelectorAll('[data-poke]').forEach(function (el) {
        el.onclick = function () {
          el.classList.remove('shake');
          void el.offsetWidth; // 重启动画
          el.classList.add('shake');
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
        '<button class="lzw-modeok" data-modesend="' + panel + '">确定</button></div></div>';
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


// ── src/engine.js ──
// ═══════════════════════════════════════════════════════════
//  engine.js —— 数字世界引擎 · 核心装配
//  职责：读世界书 → 定位世界线 → 装载应用 → 独立生成 → 写楼层
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var IMG_BASE = 'https://files.catbox.moe/';

  // 四个主条目名（与卡组世界书一致；长的优先匹配）
  var LINES = ['成人时代-破镜重圆', '成人时代-同路而行', '高中时代', '大学时代'];

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
      return (state.line && state.rosters[state.line]) || null;
    },
    stickers: function () { return state.stickers; },
    profiles: function () { return state.profiles; },
    line: function () { return state.line; },

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
      state.ready = true;
      console.log('[霖州引擎] 世界书装载完成：世界线 ' + Object.keys(state.rosters).join(' / ') +
        '｜表情包 ' + Object.keys(state.stickers).length + '｜人设 ' + Object.keys(state.profiles).join('、'));
    },

    // ── 世界线定位 ──
    // 优先读主条目自身的勾选状态（玩家选线时卡内代码会开关对应主条目，读这个最准，不用猜）。
    // mode='chat'：切聊天时聊天记录里存的线优先（每条聊天记自己的线）。
    locateLine: function (mode) {
      var W = window.LZWorld;

      var switchHit = this.lineBySwitch();
      if (mode === 'chat') {
        var saved = W.Store.line();
        if (saved && state.rosters[saved]) { this.applyLine(saved, '聊天记录'); return; }
        if (switchHit.known) { this.applyLine(switchHit.line, switchHit.note); return; }
      } else {
        if (switchHit.known) { this.applyLine(switchHit.line, switchHit.note); return; }
        var saved2 = W.Store.line();
        if (saved2 && state.rosters[saved2]) { this.applyLine(saved2, '聊天记录'); return; }
      }

      // 兜底：第一条有内容的世界线（只有开关读不到且无记录时才会走到这）
      for (var lj = 0; lj < LINES.length; lj++) {
        var sec0 = state.rosters[LINES[lj]];
        if (sec0 && (sec0.contacts.length || sec0.groups.length)) {
          this.applyLine(LINES[lj], '兜底（世界书开关读不到且无记录时的临时猜测）');
          return;
        }
      }
      this.applyLine(null, '无可用世界线');
    },

    // 读四条主条目的勾选状态。返回 {known, line, note}：
    // known=true 表示读到了明确结论（一条开 / 全开关联动都关=古代线）；
    // known=false 表示读不出（条目缺失 / 多条同时开 / 开关字段不存在）。
    lineBySwitch: function () {
      var titles = Object.keys(state.entryStates);
      if (!titles.length) return { known: false };
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
      if (opened.length === 0) return { known: true, line: null, note: '主条目全部关闭（古代线）' };
      console.warn('[霖州引擎] 主条目开关读到 ' + opened.length + ' 条线同时开着（' + opened.join('、') +
        '），视为读不出，改用其他方式定位');
      return { known: false };
    },

    applyLine: function (line, source) {
      if (state.line === line && state.lineSource === source) return;
      state.line = line;
      state.lineSource = source;
      if (line) {
        window.LZWorld.Store.setLine(line);
        console.log('[霖州引擎] 世界线定位：' + line + '（依据：' + source + '）');
      } else {
        console.log('[霖州引擎] 世界线定位：无手机世界线（依据：' + source + '）');
      }
      this.syncMount();
    },

    // ── 世界线定位 ──
    setLineByEntries: function (entries) {
      if (!entries || !entries.length) return;
      if (state.lineSource === '主条目开关') return; // 开关定位最准，广播不再纠正
      for (var li = 0; li < LINES.length; li++) {
        for (var i = 0; i < entries.length; i++) {
          var title = String((entries[i] && (entries[i].name || entries[i].comment || entries[i].title)) || '');
          if (title.indexOf(LINES[li]) !== -1) {
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

    // ── 正文生成前的手机动态注入：每个入选会话带最近 5 轮完整对话 ──
    INJECT_RECENT_FLOORS: 12,   // 最近 N 楼内聊过 → 带
    INJECT_MENTION_FLOORS: 4,   // 名字出现在最近 N 楼 → 带（哪怕聊得早）
    INJECT_MAX_CHATS: 3,        // 最多带几个会话
    INJECT_ROUNDS: 10,          // 每会话带最近几条（5 轮 user+对方）

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
        for (var i = 0; i < keys.length && blocks.length < this.INJECT_MAX_CHATS; i++) {
          var key = keys[i];
          var hist = root.history(key);
          if (!hist.length) continue;
          var meta = root.meta(key);
          var name = key.indexOf('group:') === 0 ? key.slice(6) + '（群）' : key;
          var hit = false;
          if (meta.atMainCount != null && now - meta.atMainCount <= this.INJECT_RECENT_FLOORS) hit = true;
          if (!hit && recentText.indexOf(name.replace(/（群）$/, '')) !== -1) hit = true;
          if (!hit) continue;
          var ago = meta.atMainCount != null ? Math.max(0, now - meta.atMainCount) : null;
          var lines = hist.slice(-this.INJECT_ROUNDS).map(function (m) {
            return (m.who === 'user' ? myName : m.who) + '：' + W.Floor.msgToLine(m, myName).replace(/^[^：]*：/, '');
          });
          blocks.push('「' + name + '」' + (ago != null ? '（' + ago + ' 楼前）' : '') + '：\n' + lines.join('\n'));
        }
        if (!blocks.length) return;
        injectPrompts([{
          id: 'lzw-phone-digest',
          position: 'in_chat',
          depth: 4,
          role: 'system',
          content: '【手机近况 · 微信】' + myName + '近期在手机上聊过天（仅作背景，正文不必提到；角色当面不得说出只有微信里才知道的细节，除非对方当时就在这些聊天里）：\n' + blocks.join('\n')
        }], { once: true });
      } catch (e) { console.warn('[霖州引擎] 手机动态注入失败', e); }
    },

    // ── 独立生成 ──
    generateFor: async function (chatKey, isGroup) {
      var W = window.LZWorld;
      var sec = this.section();
      if (!sec) throw new Error('当前世界线无通讯录');

      var digest = await this.compress(chatKey);
      var stickerNames = Object.keys(state.stickers).slice(0, 120);
      var raw, title, parseGroup = false;

      if (!isGroup) {
        var c = this.findContact(chatKey);
        if (!c) throw new Error('联系人不在本线通讯录：' + chatKey);
        var profile = state.profiles[c.name] || '';
        var snap = W.Status.snapshot(c.name);
        var hist = W.Store.history(chatKey);
        // 最新一批连续的用户消息摘出来作为最终 user 轮次，其余留在系统块的应用内记录里
        var tail = [];
        for (var hi = hist.length - 1; hi >= 0 && hist[hi].who === 'user'; hi--) tail.unshift(hist[hi]);
        var rest = hist.slice(0, hist.length - tail.length);
        var req = W.Prompt.private({ name: c.name, profile: profile }, rest, snap, stickerNames, tail, digest);
        raw = await generateRaw(req);
        title = '与' + c.name + '的私聊';
      } else {
        var gname = chatKey.replace(/^group:/, '');
        var g = null;
        for (var i = 0; i < sec.groups.length; i++) if (sec.groups[i].name === gname) g = sec.groups[i];
        if (!g) throw new Error('群不在本线通讯录：' + gname);
        var members = (g.members || []).map(function (n) {
          return { name: n, profile: state.profiles[n] || '' };
        });
        var snap2 = W.Status.snapshot(null);
        var hist2 = W.Store.history(chatKey);
        var tail2 = [];
        for (var hj = hist2.length - 1; hj >= 0 && hist2[hj].who === 'user'; hj--) tail2.unshift(hist2[hj]);
        var rest2 = hist2.slice(0, hist2.length - tail2.length);
        var req2 = W.Prompt.group({ name: g.name, open: g.open }, members, rest2, snap2, stickerNames, tail2, digest);
        raw = await generateRaw(req2);
        title = g.name + ' 群聊';
        parseGroup = true;
      }

      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      var msgs = W.Floor.parseNpcLines(text, parseGroup ? null : chatKey);
      if (!msgs.length) throw new Error('生成结果为空');
      // 一行近况（正文注入用）：取最后一条消息的核心内容
      var lastMsg = msgs[msgs.length - 1];
      var headText = lastMsg.kind === 'text' ? lastMsg.text : '[' + ({ sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' }[lastMsg.kind] || '消息') + ']';
      W.Store.setMeta(chatKey, { headline: String(headText).slice(0, 40), atMainCount: this.mainCount() });
      return { key: chatKey, title: title, msgs: msgs };
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
        on('lzw-phone-toggle', function () {
          var ui = W.Apps.wechat;
          if (!Engine.section()) {
            try { toastr.info('当前世界线没有手机（古代线或未定位）', '📱 霖州引擎'); } catch (e) {}
            return;
          }
          ui.inject();
          ui.toggle();
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

      // 切聊天 → 重载（聊天变量随卡切换，需重新渲染）
      var reinitTimer = null;
      try {
        on(tavern_events.CHAT_CHANGED, function () {
          clearTimeout(reinitTimer);
          reinitTimer = setTimeout(async function () {
            Engine.locateLine('chat');
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

