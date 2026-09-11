// ═══════════════════════════════════════════════════════════
//  霖州往事 · 数字世界引擎（构建产物，勿手改）
//  源码见 src/ · 构建：node build/build.js
//  构建时间：2026-09-11T03:02:17.121Z
// ═══════════════════════════════════════════════════════════

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
      characters: {}                     // 角色小块：{ 位置, 姿态, 着装 }
    };
    var tm = (envParts[1] || '').match(/(\d{1,2}:\d{2})/);
    if (tm) result.time = tm[1];

    // 角色小块：<沈锡元> 着装：… 姿态：… 位置：… 心声：… </沈锡元>
    var block;
    charBlockRe.lastIndex = 0;
    while ((block = charBlockRe.exec(scope)) !== null) {
      var name = block[1].trim();
      if (name === '环境' || name === 'status' || name === '关系总览') continue;
      var body = block[2];
      var grab = function (label) {
        var r = body.match(new RegExp(label + '\\s*[:：]\\s*([^\\n]+)'));
        return r ? r[1].trim() : '';
      };
      result.characters[name] = {
        outfit: grab('着装'),
        posture: grab('姿态'),
        place: grab('位置')
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

    // 供生成装配使用：时间 + user地点 + 目标角色情境块
    snapshot: function (npcName) {
      var p = this.parseLatest();
      if (!p) return { time: '', userPlace: '', npc: null };
      return {
        time: p.time,
        dateText: p.dateText,
        userPlace: p.userPlace,
        npc: (npcName && p.characters[npcName]) || null
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
    // 返回 { rosters: {线名: 规范区块}, stickers: {名: 文件}, profiles: {角色名: 资料文本} }
    load: async function () {
      var result = { rosters: {}, stickers: {}, profiles: {} };
      var names = await bookNames();
      console.log('[霖州引擎] 世界书：' + names.length + ' 本 → ' + names.join(' / '));
      var es = await allEntries();
      var seen = es.slice(0, 25).map(function (e) { return titleOf(e).slice(0, 24); });
      console.log('[霖州引擎] 共扫描 ' + es.length + ' 条，前若干条标题：' + seen.join(' | '));
      for (var i = 0; i < es.length; i++) {
        var t = titleOf(es[i]);
        if (t === MARK_ROSTER) {
          var j = extractJson(contentOf(es[i]));
          if (j && typeof j === 'object') {
            for (var line in j) {
              result.rosters[String(line).trim()] = normSection(j[line]);
            }
          }
        } else if (t === MARK_STICKER) {
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
//  prompt.js —— 数字世界引擎 · 提示词装配（v0，待实测迭代）
//
//  框架：AI 不是"扮演角色"，而是数字生活世界的模拟引擎。
//  引擎不认角色，只认「应用 + 实体 + 资料」——
//  微信私聊/群聊/未来的论坛，都只是不同的资料与输出契约。
//
//  ⚠ 本文件的措辞为 v0 初稿，用户已确认需后续打磨。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var PLOT_FLOORS = 8;     // 主线带几楼
  var PLOT_CAP = 900;      // 每楼正文上限（验尸结论：低于此 ≈ 失明）
  var HIST_PRIVATE = 14;   // 私聊带回几条
  var HIST_GROUP = 18;     // 群聊带回几条

  // ── 主线近貌：最近 N 楼，去 HTML/代码块/思考块，每楼截断 ──
  function mainContext() {
    try {
      var msgs = getChatMessages('0-{{lastMessageId}}');
      if (!msgs || !msgs.length) return '';
      return msgs.slice(-PLOT_FLOORS).map(function (m) {
        var t = String((m && m.message) || '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        if (t.length > PLOT_CAP) t = t.substring(0, PLOT_CAP) + '…';
        return (m.role === 'user' ? '{{user}}' : '旁白') + '：' + t;
      }).filter(function (l) { return l.length > 4; }).join('\n');
    } catch (e) { return ''; }
  }

  // ── 应用内记录文本 ──
  function histText(hist, n) {
    return hist.slice(-n).map(function (m) {
      var who = m.who === 'user' ? '{{user}}' : m.who;
      var body = m.kind === 'text' ? m.text : '[' + m.kind + ':' + m.text + ']';
      return who + '：' + body;
    }).join('\n');
  }

  // ── 消息类型语法说明（输出契约的一部分） ──
  function typeSyntax() {
    return [
      '消息类型（按需单独成行，不用则不写）：',
      '[表情:名字]  只可选用列出的表情包名',
      '[语音:要说的话]',
      '[图片:画面描述]',
      '[戳一戳]',
      '[定位:地点名]'
    ].join('\n');
  }

  // ── 一致性铁律（防开天眼） ──
  function consistencyRules(entityDesc) {
    return [
      '【一致性铁律】',
      '- ' + entityDesc + '只知道两类事：①本人在场亲眼所见、亲耳所闻；②对方在本应用内明确告诉它的。',
      '- 下列内容一律不知：主线中没有本人出场的段落、其他私聊、其他群聊、对方此刻在哪里/在干什么/穿着什么、任何人的心声。',
      '- 想谈主线里的事但本人不在场？只能用"听说/你今天怎么样"这类不确定方式开口，不得说出细节。',
      '- 宁可少说，不可全知。违反即出戏。'
    ].join('\n');
  }

  function situationBlock(snapshot) {
    var lines = [];
    if (snapshot && snapshot.time) {
      var when = snapshot.dateText ? snapshot.dateText + ' ' + snapshot.time : snapshot.time;
      lines.push('当前时间：' + when);
    }
    if (snapshot && snapshot.userPlace) {
      lines.push('（对方此刻在：' + snapshot.userPlace + '——仅作参考，不代表你的位置）');
    }
    if (snapshot && snapshot.npc) {
      var bits = [];
      if (snapshot.npc.place) bits.push('位置：' + snapshot.npc.place);
      if (snapshot.npc.posture) bits.push('姿态：' + snapshot.npc.posture);
      if (bits.length) lines.push('你（实体）此刻：' + bits.join('，'));
    }
    return lines.join('\n');
  }

  var Prompt = {

    // ── 私聊 ──
    private: function (contact, hist, snapshot) {
      var p = [
        '【数字世界 · 回应生成】',
        '你是数字生活世界的模拟引擎。本次任务：生成应用「微信」中，来自「' + contact.name + '」的新消息。',
        '',
        contact.profile ? '【实体资料】\n' + contact.profile : '【实体资料】（暂无档案，依据对话上下文自然演绎）',
        '',
        situationBlock(snapshot) ? '【情境】\n' + situationBlock(snapshot) : '',
        '',
        '【应用内记录 · 与{{user}}的微信聊天】',
        histText(hist, HIST_PRIVATE),
        '',
        mainContext() ? '【主线近貌】（仅作背景，上面的铁律优先）\n' + mainContext() : '',
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        '【输出契约】',
        '- 只输出「' + contact.name + '」发出的新消息，1~4 条，按情绪与话题自然增减',
        '- 每条独立成行，只写消息内容；无前缀、无时间戳、无动作旁白、无括号心理',
        '- 每条不超过 35 字，像真人打字，不复述对方的话',
        typeSyntax(),
        '- 直接输出消息本身，严禁以"好的""收到"等寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: '（生成消息）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 群聊 ──
    group: function (group, members, hist, snapshot) {
      var nameList = members.map(function (m) { return m.name; });
      var voices = members.map(function (m) {
        var brief = m.profile ? String(m.profile).replace(/\s+/g, ' ').slice(0, 500) : '（无档案）';
        return '· ' + m.name + '：' + brief;
      });

      var p = [
        '【数字世界 · 回应生成】',
        '你是数字生活世界的模拟引擎。本次任务：生成应用「微信」的群「' + group.name + '」中发来的新消息。',
        '',
        '【群成员】' + nameList.join('、') + '、{{user}}' + (group.open ? '，以及若干未列名的路人（可让其冒泡，用真实昵称）' : ''),
        '',
        '【成员资料】',
        voices.join('\n'),
        '',
        situationBlock(snapshot) ? '【情境】\n' + situationBlock(snapshot) : '',
        '',
        '【应用内记录 · 群「' + group.name + '」】',
        histText(hist, HIST_GROUP),
        '',
        mainContext() ? '【主线近貌】（仅作背景，铁律优先）\n' + mainContext() : '',
        '',
        consistencyRules('每个群成员各自') + '\n- 输出多行时，每行开头必须是「成员名：」，各自独立判断是否知情。',
        '',
        '【输出契约】',
        '- 输出 3~8 条群消息，每条一行，格式严格为「成员名：消息」',
        '- 谁会接这句谁说，不必人人开口；可互相接梗拆台',
        '- 每条不超过 35 字，口语',
        typeSyntax(),
        '- 直接输出消息，严禁寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: '（生成群消息）' }
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
      var isUser = who === userName;
      var avatar = '';
      if (isUser) {
        avatar = '<div class="lzw-ava lzw-ava-me">' + esc(who.slice(0, 1)) + '</div>';
      } else {
        var c = W.Engine && W.Engine.findContact(who);
        avatar = c && c.avatar
          ? '<img class="lzw-ava" src="' + esc(W.Worldbook.imgUrl(c.avatar)) + '" alt="">'
          : '<div class="lzw-ava">' + esc(who.slice(0, 1)) + '</div>';
      }

      var bub;
      var typed = content.match(/^\[(表情|语音|图片|戳一戳|定位)(?::|\||｜)([\s\S]*)\]$/);
      if (typed) {
        var kind = typed[1], arg = (typed[2] || '').trim();
        if (kind === '表情') {
          var file = stickers[arg];
          bub = file
            ? '<img class="lzw-sticker" src="' + esc(W.Worldbook.imgUrl(file)) + '" alt="' + esc(arg) + '" title="' + esc(arg) + '">'
            : '<div class="lzw-bub">[表情:' + esc(arg) + ']</div>';
        } else if (kind === '戳一戳') {
          bub = '<div class="lzw-bub lzw-sys">戳了戳' + (isUser ? '对方' : esc(who)) + '</div>';
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

      rows.push(
        '<div class="lzw-row' + (isUser ? ' lzw-row-me' : '') + '">' +
        (isUser ? bub + avatar : avatar + bub) +
        '<div class="lzw-who">' + esc(who) + '</div></div>'
      );
    });

    return '<div class="lzw-record">' +
      '<div class="lzw-record-head">📱 ' + esc(title) + '</div>' +
      rows.join('') +
      '</div>';
  }

  // ── 主页面 DOM 操作（原生，不依赖 jQuery） ──
  function pdoc() { return window.parent.document; }

  // 替换某一个楼层的文本为气泡（整块匹配才动，混合内容不碰）
  function renderMesText(el) {
    var raw = el.textContent || '';
    var m = raw.match(RECORD_RE);
    if (!m) return false;
    el.innerHTML = renderRecordHtml(m[1].trim(), m[2]);
    return true;
  }

  var Floor = {
    formatRecord: formatRecord,
    msgToLine: msgToLine,
    RECORD_RE: RECORD_RE,

    // 插入一条记录楼层并渲染。title 如「与周言的私聊」「高三（2）班 群聊」
    insertRecord: async function (title, msgs, timeText) {
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
//  UI 全部为本项目自有设计（深色现代壳 + 玉绿点缀）。
//  展示层注入主页面（沙盒内经 parent.document 操作）。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var ID = { ball: 'lzw-ball', phone: 'lzw-phone' };

  function pdoc() { return window.parent.document; }
  function p$() { return window.parent.$; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── 样式（自有设计） ──
  var CSS = [
    '#lzw-ball{position:fixed;right:18px;bottom:18px;z-index:99990;width:52px;height:52px;border-radius:50%;',
    'background:linear-gradient(150deg,#2f6f5e,#173f35);color:#eaf7f0;border:1px solid rgba(255,255,255,.25);',
    'box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;',
    'font-size:24px;user-select:none;transition:transform .15s}',
    '#lzw-ball:hover{transform:scale(1.08)}',
    '#lzw-phone{position:fixed;z-index:99991;width:340px;height:640px;max-height:82vh;background:#101418;color:#e8ecef;',
    'border-radius:28px;border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 70px rgba(0,0,0,.6);',
    'display:none;flex-direction:column;overflow:hidden;font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:14px}',
    '#lzw-phone.lzw-open{display:flex}',
    '.lzw-sbar{flex:none;display:flex;justify-content:space-between;align-items:center;padding:10px 18px 6px;',
    'font-size:12px;color:#9fb0ba;background:#171d23}',
    '.lzw-title{flex:none;padding:6px 14px 10px;font-size:15px;font-weight:600;background:#171d23;',
    'display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '.lzw-back{cursor:pointer;color:#7fd6b2;font-size:13px;padding:2px 6px;border-radius:6px}',
    '.lzw-back:hover{background:rgba(127,214,178,.12)}',
    '.lzw-body{flex:1;overflow-y:auto;padding:10px;scrollbar-width:thin}',
    '.lzw-home{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px 14px}',
    '.lzw-app{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;color:#c9d4da}',
    '.lzw-app:hover{color:#fff}',
    '.lzw-app-ico{width:54px;height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;',
    'background:linear-gradient(150deg,#2b8a6e,#14523f);box-shadow:0 4px 12px rgba(0,0,0,.35)}',
    '.lzw-conv{display:flex;gap:10px;align-items:center;padding:10px 8px;border-radius:10px;cursor:pointer}',
    '.lzw-conv:hover{background:rgba(255,255,255,.05)}',
    '.lzw-ava{width:38px;height:38px;border-radius:9px;flex:none;object-fit:cover;background:#2a343c;',
    'display:flex;align-items:center;justify-content:center;color:#bcd0c6;font-size:15px}',
    '.lzw-ava-me{background:#2f6f5e;color:#eaf7f0}',
    '.lzw-conv-main{flex:1;min-width:0}',
    '.lzw-conv-name{font-weight:600;color:#eef3f6}',
    '.lzw-conv-prev{font-size:12px;color:#8b99a3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lzw-chatrow{display:flex;gap:8px;margin:10px 4px;align-items:flex-end}',
    '.lzw-chatrow.me{flex-direction:row-reverse}',
    '.lzw-bub{max-width:72%;padding:9px 12px;border-radius:12px;background:#232b33;color:#e8ecef;line-height:1.5;word-break:break-word}',
    '.lzw-chatrow.me .lzw-bub{background:#2f6f5e;color:#f0fbf5}',
    '.lzw-bub.lzw-sys{background:transparent;color:#8b99a3;font-size:12px;padding:2px 4px}',
    '.lzw-sticker{max-width:110px;border-radius:8px}',
    '.lzw-voice-ico{color:#7fd6b2;margin-right:6px}',
    '.lzw-img-ph{font-size:22px;text-align:center;padding:8px 0 4px}',
    '.lzw-img-cap{font-size:12px;opacity:.75}',
    '.lzw-inputbar{flex:none;display:flex;gap:8px;padding:10px;background:#171d23;border-top:1px solid rgba(255,255,255,.07)}',
    '.lzw-input{flex:1;background:#0d1114;border:1px solid rgba(255,255,255,.1);border-radius:16px;color:#e8ecef;',
    'padding:8px 14px;font-size:14px;outline:none}',
    '.lzw-ibtn{background:#232b33;border:1px solid rgba(255,255,255,.1);color:#c9d4da;border-radius:14px;',
    'padding:0 14px;cursor:pointer;font-size:13px;white-space:nowrap}',
    '.lzw-ibtn:hover{background:#2c3640}',
    '.lzw-stickpanel{flex:none;display:none;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;max-height:180px;overflow-y:auto;',
    'background:#171d23;border-top:1px solid rgba(255,255,255,.07);scrollbar-width:thin}',
    '.lzw-stickpanel.lzw-open{display:grid}',
    '.lzw-stickcell{position:relative;cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:1;background:#0d1114}',
    '.lzw-stickcell img{width:100%;height:100%;object-fit:cover}',
    '.lzw-stickcell span{position:absolute;left:0;right:0;bottom:0;font-size:10px;text-align:center;',
    'background:rgba(0,0,0,.55);color:#fff;padding:1px 0;white-space:nowrap;overflow:hidden}',
    '.lzw-sysrow{text-align:center;font-size:12px;color:#7a8891;margin:8px 0}'
  ].join('\n');

  // ── 手机内气泡行 ──
  function chatRowHtml(m, userName, contactMap) {
    var isUser = m.who === 'user';
    var who = isUser ? userName : m.who;
    var avatar;
    if (isUser) {
      avatar = '<div class="lzw-ava lzw-ava-me">' + esc(who.slice(0, 1)) + '</div>';
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
      bub = '<div class="lzw-bub lzw-sys">戳了戳' + (isUser ? '对方' : esc(who)) + '</div>';
    } else if (m.kind === 'voice') {
      bub = '<div class="lzw-bub"><span class="lzw-voice-ico">▶</span>' + esc(m.text) + '</div>';
    } else if (m.kind === 'image') {
      bub = '<div class="lzw-bub"><div class="lzw-img-ph">🖼</div><div class="lzw-img-cap">' + esc(m.text) + '</div></div>';
    } else if (m.kind === 'location') {
      bub = '<div class="lzw-bub lzw-sys">📍 ' + esc(m.text) + '</div>';
    } else {
      bub = '<div class="lzw-bub">' + esc(m.text) + '</div>';
    }
    return '<div class="lzw-chatrow' + (isUser ? ' me' : '') + '">' + (isUser ? bub + avatar : avatar + bub) + '</div>';
  }

  var UI = {
    screen: 'home',      // home | list | chat
    chatKey: null,       // 联系人名 或 'group:群名'
    isGroup: false,
    busy: false,

    inject: function () {
      var doc = pdoc();
      if (!doc.getElementById('lzw-style')) {
        var st = doc.createElement('style');
        st.id = 'lzw-style';
        st.textContent = CSS;
        doc.head.appendChild(st);
      }
      if (!doc.getElementById(ID.ball)) {
        var ball = doc.createElement('div');
        ball.id = ID.ball;
        ball.textContent = '📱';
        ball.title = '霖州 · 数字世界';
        ball.addEventListener('pointerdown', dragStart);
        ball.addEventListener('click', function (ev) {
          if (ball.dataset.dragged) { ev.stopPropagation(); return; } // 拖拽后不触发点击
          UI.toggle();
        });
        doc.body.appendChild(ball);
      }
      if (!doc.getElementById(ID.phone)) {
        var ph = doc.createElement('div');
        ph.id = ID.phone;
        doc.body.appendChild(ph);
      }
    },

    remove: function () {
      var doc = pdoc();
      var b = doc.getElementById(ID.ball); if (b) b.remove();
      var p = doc.getElementById(ID.phone); if (p) p.remove();
    },

    toggle: function () {
      var ph = pdoc().getElementById(ID.phone);
      if (!ph) return;
      ph.classList.toggle('lzw-open');
      if (ph.classList.contains('lzw-open')) { UI.screen = 'home'; UI.render(); }
    },

    openChat: function (key, isGroup) {
      this.chatKey = key;
      this.isGroup = !!isGroup;
      this.screen = 'chat';
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
      var date = snap.dateText ? snap.dateText.split(' ')[0] : '';

      var bar = '<div class="lzw-sbar"><span>' + esc(clock) + '</span><span>' + esc(date) + '</span><span>📶 🔋</span></div>';
      var title, body;

      if (this.screen === 'home') {
        title = '<div class="lzw-title">霖州 · 数字世界</div>';
        body = '<div class="lzw-body"><div class="lzw-home">' +
          '<div class="lzw-app" data-app="wechat"><div class="lzw-app-ico">💬</div><span>微信</span></div>' +
          '<div class="lzw-app" style="opacity:.35"><div class="lzw-app-ico" style="background:#2a343c">🧩</div><span>敬请期待</span></div>' +
          '</div></div>';

      } else if (this.screen === 'list') {
        title = '<div class="lzw-title"><span class="lzw-back" data-act="home">‹ 返回</span><span>微信</span></div>';
        var sec = eng.section();
        var rowsHtml = '';
        if (sec) {
          var convs = [];
          (sec.contacts || []).forEach(function (c) { convs.push({ key: c.name, name: c.name, avatar: c.avatar, group: false }); });
          (sec.groups || []).forEach(function (g) { convs.push({ key: 'group:' + g.name, name: g.name, avatar: '', group: true }); });
          rowsHtml = convs.map(function (cv) {
            var h = W.Store.history(cv.key);
            var last = h.length ? h[h.length - 1] : null;
            var prev = last ? ((last.who === 'user' ? userName : last.who) + '：' +
              (last.kind === 'text' ? last.text : '[' + last.kind + ']')) : '（暂无消息）';
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
        title = '<div class="lzw-title"><span class="lzw-back" data-act="list">‹ 返回</span><span>' + esc(disp) + '</span></div>';
        var hist = W.Store.history(key);
        var contactMap = {};
        var secNow = eng.section();
        if (g) {
          var grp = secNow ? (secNow.groups || []).filter(function (x) { return 'group:' + x.name === key; })[0] : null;
          if (grp) grp.members.forEach(function (n) { contactMap[n] = eng.findContact(n) || { name: n, avatar: '' }; });
        } else {
          contactMap[disp] = eng.findContact(disp) || { name: disp, avatar: '' };
        }
        var rows = hist.map(function (m) { return chatRowHtml(m, userName, contactMap); }).join('');
        body = '<div class="lzw-body" id="lzw-chatbody">' + rows + '</div>' +
          '<div class="lzw-stickpanel" id="lzw-stickpanel">' + stickerGrid() + '</div>' +
          '<div class="lzw-inputbar">' +
          '<input class="lzw-input" id="lzw-input" placeholder="发消息…" maxlength="300">' +
          '<button class="lzw-ibtn" data-act="stick">表情</button>' +
          '<button class="lzw-ibtn" data-act="poke">戳一戳</button>' +
          '<button class="lzw-ibtn" data-act="send">发送</button>' +
          '</div>';
      }

      ph.innerHTML = bar + title + body;
      this.bind(ph);
      if (this.screen === 'chat') {
        var cb = ph.querySelector('#lzw-chatbody');
        if (cb) cb.scrollTop = cb.scrollHeight;
        var inp = ph.querySelector('#lzw-input');
        if (inp) inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); UI.sendText(); }
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
          UI.render();
        };
      });
      ph.querySelectorAll('.lzw-conv').forEach(function (el) {
        el.onclick = function () { UI.openChat(el.dataset.key, el.dataset.group === '1'); };
      });
      ph.querySelectorAll('[data-act="send"]').forEach(function (el) { el.onclick = function () { UI.sendText(); }; });
      ph.querySelectorAll('[data-act="stick"]').forEach(function (el) {
        el.onclick = function () {
          var sp = ph.querySelector('#lzw-stickpanel');
          if (sp) sp.classList.toggle('lzw-open');
        };
      });
      ph.querySelectorAll('[data-act="poke"]').forEach(function (el) { el.onclick = function () { UI.sendTyped('poke', ''); }; });
      ph.querySelectorAll('.lzw-stickcell').forEach(function (el) {
        el.onclick = function () { UI.sendTyped('sticker', el.dataset.name); };
      });
    },

    sendText: function () {
      var inp = pdoc().getElementById('lzw-input');
      if (!inp) return;
      var t = inp.value.trim();
      if (!t) return;
      inp.value = '';
      this.sendTyped('text', t);
    },

    sendTyped: function (kind, text) {
      var W = window.LZWorld;
      var userName = W.Engine.userName();
      var msg = { who: 'user', kind: kind, text: text, time: W.Status.nowText() };
      W.Store.push(this.chatKey, [msg], 100);
      this.render();
      this.generate(userName);
    },

    // 独立生成 → 存历史 + 写楼层
    generate: async function (userName) {
      if (this.busy) return;
      this.busy = true;
      var W = window.LZWorld;
      var eng = W.Engine;
      try {
        var result = await eng.generateFor(this.chatKey, this.isGroup);
        if (result && result.msgs && result.msgs.length) {
          W.Store.push(this.chatKey, result.msgs, 100);
          if (this.screen === 'chat' && this.chatKey === result.key) this.render();
          await W.Floor.insertRecord(result.title, result.msgs, W.Status.nowText());
        }
      } catch (e) {
        console.warn('[霖州引擎] 生成失败', e);
        try { toastr.error('手机消息生成失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
      } finally {
        this.busy = false;
      }
    }
  };

  function stickerGrid() {
    var stickers = window.LZWorld.Engine.stickers();
    var names = Object.keys(stickers);
    if (!names.length) return '<div class="lzw-sysrow">世界书中未找到「霖州手机::表情包」条目</div>';
    return names.map(function (n) {
      return '<div class="lzw-stickcell" data-name="' + esc(n) + '">' +
        '<img src="' + esc(window.LZWorld.Worldbook.imgUrl(stickers[n])) + '" loading="lazy">' +
        '<span>' + esc(n) + '</span></div>';
    }).join('');
  }

  // ── 悬浮球拖拽 ──
  var drag = null;
  function dragStart(e) {
    var ball = pdoc().getElementById(ID.ball);
    if (!ball) return;
    drag = { x: e.clientX - ball.offsetLeft, y: e.clientY - ball.offsetTop, moved: false };
    window.parent.addEventListener('pointermove', dragMove);
    window.parent.addEventListener('pointerup', dragEnd);
  }
  function dragMove(e) {
    if (!drag) return;
    var ball = pdoc().getElementById(ID.ball);
    if (!ball) return;
    drag.moved = true;
    ball.style.left = Math.max(0, e.clientX - drag.x) + 'px';
    ball.style.top = Math.max(0, e.clientY - drag.y) + 'px';
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
  }
  function dragEnd() {
    window.parent.removeEventListener('pointermove', dragMove);
    window.parent.removeEventListener('pointerup', dragEnd);
    var wasDrag = drag && drag.moved;
    drag = null;
    if (wasDrag) {
      var ball = pdoc().getElementById(ID.ball);
      if (ball) ball.dataset.dragged = '1';
      setTimeout(function () {
        var b2 = pdoc().getElementById(ID.ball);
        if (b2) delete b2.dataset.dragged;
      }, 200);
    }
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
    line: null,        // 当前世界线（主条目名）
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
      try { if (typeof name1 !== 'undefined' && name1) return String(name1); } catch (e) {}
      try {
        var v = getVariables({ type: 'chat' }) || {};
        if (v.name || v.user) return String(v.name || v.user);
      } catch (e) {}
      return '我';
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
      state.ready = true;
      console.log('[霖州引擎] 世界书装载完成：世界线 ' + Object.keys(state.rosters).join(' / ') +
        '｜表情包 ' + Object.keys(state.stickers).length + '｜人设 ' + Object.keys(state.profiles).join('、'));
    },

    // ── 世界线定位 ──
    setLineByEntries: function (entries) {
      if (!entries || !entries.length) return;
      for (var li = 0; li < LINES.length; li++) {
        for (var i = 0; i < entries.length; i++) {
          var title = String((entries[i] && (entries[i].name || entries[i].comment || entries[i].title)) || '');
          if (title.indexOf(LINES[li]) !== -1) {
            if (state.line !== LINES[li]) {
              state.line = LINES[li];
              window.LZWorld.Store.setLine(LINES[li]);
              console.log('[霖州引擎] 世界线定位：' + LINES[li]);
              this.syncMount();
            }
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

    // ── 独立生成 ──
    generateFor: async function (chatKey, isGroup) {
      var W = window.LZWorld;
      var sec = this.section();
      if (!sec) throw new Error('当前世界线无通讯录');

      var raw, title, parseGroup = false;

      if (!isGroup) {
        var c = this.findContact(chatKey);
        if (!c) throw new Error('联系人不在本线通讯录：' + chatKey);
        var profile = state.profiles[c.name] || '';
        var snap = W.Status.snapshot(c.name);
        var hist = W.Store.history(chatKey);
        var req = W.Prompt.private({ name: c.name, profile: profile }, hist, snap);
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
        var req2 = W.Prompt.group({ name: g.name, open: g.open }, members, hist2, snap2);
        raw = await generateRaw(req2);
        title = g.name + ' 群聊';
        parseGroup = true;
      }

      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      var msgs = W.Floor.parseNpcLines(text, parseGroup ? null : chatKey);
      if (!msgs.length) throw new Error('生成结果为空');
      return { key: chatKey, title: title, msgs: msgs };
    },

    // ── 启动 ──
    init: async function () {
      var W = window.LZWorld;
      W.IMG_BASE = IMG_BASE;

      await this.load();

      // 先沿用上次记录的世界线（聊天变量），有新广播再纠正
      var saved = W.Store.line();
      if (saved && state.rosters[saved]) state.line = saved;

      this.syncMount();
      try { W.Floor.renderAll(); } catch (e) {}

      // 世界书激活广播 → 世界线定位（每次主对话生成后触发）
      try {
        on(tavern_events.WORLD_INFO_ACTIVATED, function (entries) {
          Engine.setLineByEntries(entries);
        });
      } catch (e) {}

      // 切聊天 → 重载（聊天变量随卡切换，需重新渲染）
      var reinitTimer = null;
      try {
        on(tavern_events.CHAT_CHANGED, function () {
          clearTimeout(reinitTimer);
          reinitTimer = setTimeout(async function () {
            state.line = W.Store.line();
            Engine.syncMount();
            try { W.Floor.renderAll(); } catch (e) {}
            var UI = W.Apps.wechat;
            if (UI.screen) { UI.screen = 'home'; UI.render(); }
          }, 400);
        });
      } catch (e) {}

      console.log('[霖州引擎] 初始化完成 · v0.2');
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

