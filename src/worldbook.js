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
  var MARK_NSFW = '霖州手机::NSFW';
  var MARK_VOICE = '霖州手机::音色';   // 音色配置（JSON：开关/厂商/地址/模型/defaultVoice/voices映射）——跟世界书走，卡作者可预置默认   // 卡的亲密文风指引：口味层由卡维护，引擎只负责注入提示词

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
      return { name: String(c.name || '').trim(), avatar: String(c.avatar || c.avatar_file || '').trim(), cover: String(c.cover || '').trim() };
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
    return {
      contacts: contacts, groups: groups,
      moments: { cover: String((sec.moments || {}).cover || '').trim() }
    };
  }

  var Worldbook = {
    // 返回 { rosters, stickers, profiles, states }
    // states = { 条目标题: 是否勾选开启 }——世界线主条目定位用（enabled 字段读不到时按"开"记）
    load: async function () {      var result = { rosters: {}, stickers: {}, profiles: {}, states: {}, nsfwRaw: '', ttsCfg: null };
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
        } else if (t === MARK_NSFW) {
          result.nsfwRaw = result.nsfwRaw ? result.nsfwRaw + '\n\n' + contentOf(es[i]) : contentOf(es[i]);
        } else if (t === MARK_VOICE) {
          try {
            var _tj = JSON.parse(contentOf(es[i]));
            if (_tj && typeof _tj === 'object') result.ttsCfg = _tj;
          } catch (e) {}
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
          (rsec.contacts || []).forEach(function (c) {
            if (c.avatar) preAdd(c.avatar);
            if (c.cover) preAdd(c.cover);
          });
          (rsec.groups || []).forEach(function (g) { if (g.avatar) preAdd(g.avatar); });
          if (rsec.moments && rsec.moments.cover) preAdd(rsec.moments.cover);
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

    // 音色配置写回：把指定标题条目的内容改为 JSON 字符串。与 setEntriesEnabled 同套双 API：
    // updateWorldbookWith（回调式原地改）优先，getWorldbook+replaceWorldbook 兜底。
    setEntryJson: async function (title, obj) {
      var names = await bookNames();
      if (!names.length) throw new Error('未找到角色卡世界书');
      var norm2 = function (s2) { return String(s2 || '').replace(/[【】\s]/g, ''); };
      var want = norm2(title);
      var body = JSON.stringify(obj);
      var render = { render: 'immediate' };
      var touch = function (entries) {
        for (var j = 0; j < entries.length; j++) {
          if (norm2(titleOf(entries[j])) === want) {
            entries[j].content = body;   // 只改内容；启用状态由用户自管（读取不依赖勾选）
            entries[j].text = body;
            break;
          }
        }
        return entries;
      };
      if (typeof updateWorldbookWith === 'function') {
        for (var i = 0; i < names.length; i++) {
          try { await updateWorldbookWith(names[i], touch, render); } catch (e) {}
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
              if (norm2(titleOf(es[m])) === want) { hit = true; break; }
            }
            if (hit) await replaceWorldbook(names[k], touch(es), render);
          } catch (e) {}
        }
      }
    },

    // 按标题读单条（同步系统读版本快照用；跨书只认第一处命中）
    getEntry: async function (title) {
      var names = await bookNames();
      var norm = function (s2) { return String(s2 || '').replace(/[【】\s]/g, ''); };
      var want = norm(title);
      for (var i = 0; i < names.length; i++) {
        var es = await entriesOf(names[i]);
        for (var j = 0; j < es.length; j++) {
          if (norm(titleOf(es[j])) === want) return es[j];
        }
      }
      return null;
    },

    // 托管条目 upsert（设定同步用）：已存在 → 更新 内容/触发键/策略/顺序/位置（enabled 不动，
    // 开关归用户）；没有 → 主书新建。无差异的书整本不动笔；按书分批写，幂等，重试安全。
    //
    // 【字段纪律】酒馆助手条目结构（权威源：JS-Slash-Runner dist/@types.txt 的 WorldbookEntry）：
    //   标题=name；启用=enabled；触发=strategy{type,keys,keys_secondary{logic,keys}}；
    //   顺序=position.order（嵌套！顶层没有 order）；位置=position.type（枚举字符串，非数字）。
    upsertManaged: (function () {
      // ST 数字 position → 助手 position.type（照抄助手 dist 的转换表）
      var POS_TYPE = { 0: 'before_character_definition', 1: 'after_character_definition', 5: 'before_example_messages', 6: 'after_example_messages', 2: 'before_author_note', 3: 'after_author_note', 4: 'at_depth', 7: 'outlet' };
      var ROLE_TYPE = { 0: 'system', 1: 'user', 2: 'assistant' };

      // 清单条目 → 助手 PartialDeep<WorldbookEntry>（创建用；缺的字段酒馆补默认值）
      function toTh(s2) {
        return {
          name: s2.title,
          enabled: s2.enabled !== false,
          strategy: {
            type: s2.constant ? 'constant' : 'selective',
            keys: (s2.keys || []).slice(),
            keys_secondary: { logic: 'and_any', keys: (s2.keysSecondary || []).slice() },
            scan_depth: 'same_as_global'
          },
          position: {
            type: POS_TYPE[s2.position] || 'before_character_definition',
            role: ROLE_TYPE[s2.role] || 'system',
            depth: typeof s2.depth === 'number' ? s2.depth : 4,
            order: typeof s2.order === 'number' ? s2.order : 100
          },
          content: String(s2.content || ''),
          probability: 100
        };
      }

      // 原地更新已有条目：内容/触发键/策略/顺序/位置/深度/身份；enabled、uid 不动
      function touchEntry(en, src) {
        if (src.content !== undefined) en.content = String(src.content);
        en.strategy = en.strategy || {};
        if (src.keys) en.strategy.keys = src.keys.slice();
        if (src.keysSecondary) {
          en.strategy.keys_secondary = en.strategy.keys_secondary || { logic: 'and_any', keys: [] };
          en.strategy.keys_secondary.keys = src.keysSecondary.slice();
        }
        if (src.constant !== undefined && en.strategy.type !== 'vectorized') {
          en.strategy.type = src.constant ? 'constant' : 'selective';   // 向量化🔗条目的策略类型不动
        }
        en.position = en.position || {};
        if (src.order !== undefined) en.position.order = src.order;
        if (src.position !== undefined && POS_TYPE[src.position]) en.position.type = POS_TYPE[src.position];
        if (src.depth !== undefined) en.position.depth = src.depth;
        if (src.role !== undefined && ROLE_TYPE[src.role]) en.position.role = ROLE_TYPE[src.role];
      }

      // 差异预检：touchEntry 会动的字段里有任何一个真不一样才算「有差异」（只比 src 提供的字段）。
      // 差异驱动同步每次启动都跑到这里，无差异必须整本书不动笔——不能每次刷新都重写一遍书。
      function diffEntry(en, src) {
        if (src.content !== undefined && String(src.content) !== String(en.content == null ? '' : en.content)) return true;
        var st = en.strategy || {};
        if (src.keys && JSON.stringify(src.keys) !== JSON.stringify(st.keys || [])) return true;
        if (src.keysSecondary && JSON.stringify(src.keysSecondary) !== JSON.stringify((st.keys_secondary || {}).keys || [])) return true;
        if (src.constant !== undefined && st.type !== 'vectorized' && st.type !== (src.constant ? 'constant' : 'selective')) return true;
        var po = en.position || {};
        if (src.order !== undefined && po.order !== src.order) return true;
        if (src.position !== undefined && POS_TYPE[src.position] && po.type !== POS_TYPE[src.position]) return true;
        if (src.depth !== undefined && po.depth !== src.depth) return true;
        if (src.role !== undefined && ROLE_TYPE[src.role] && po.role !== ROLE_TYPE[src.role]) return true;
        return false;
      }

      return async function (list) {
        var names = await bookNames();
        if (!names.length) throw new Error('未找到角色卡世界书');
        var norm = function (s) { return String(s || '').replace(/[【】\s]/g, ''); };
        var render = { render: 'immediate' };
        var res = { updated: 0, created: 0, failed: [] };
        var todo = {};
        list.forEach(function (e) { if (e && e.title) todo[norm(e.title)] = e; });

        // 1) 定位：标题 → 所在书序号（跨书只认第一处命中）
        var loc = {};
        var booksCache = [];
        for (var i = 0; i < names.length; i++) {
          var es0 = await entriesOf(names[i]);
          booksCache.push(es0);
          for (var j0 = 0; j0 < es0.length; j0++) {
            var t0 = norm(titleOf(es0[j0]));
            if (todo[t0] && loc[t0] === undefined) loc[t0] = i;
          }
        }
        // 2) 分派：已有 → 所在书更新；没有 → 主书（第一本）新建
        var updWants = {};   // 书序号 → {normTitle: true}
        var creates = [];
        for (var k in todo) {
          if (loc[k] !== undefined) {
            (updWants[loc[k]] = updWants[loc[k]] || {})[k] = true;
          } else {
            creates.push(todo[k]);
          }
        }

        // 3) 更新：按书分批（回调式原地改优先，整本替换兜底）；预检无差异的书整本跳过
        for (var bi in updWants) {
          var want = updWants[bi];
          var changed = {};
          var cached = booksCache[+bi] || [];
          for (var cj = 0; cj < cached.length; cj++) {
            var cn = norm(titleOf(cached[cj]));
            if (want[cn] && diffEntry(cached[cj], todo[cn])) changed[cn] = true;
          }
          if (!Object.keys(changed).length) continue;
          var bag = { updated: 0 };
          var mkTouch = function (w, bg) {
            return function (entries) {
              for (var j = 0; j < entries.length; j++) {
                var src = todo[norm(titleOf(entries[j]))];
                if (src && w[norm(titleOf(entries[j]))]) { touchEntry(entries[j], src); bg.updated++; }
              }
              return entries;
            };
          };
          try {
            if (typeof updateWorldbookWith === 'function') {
              await updateWorldbookWith(names[+bi], mkTouch(changed, bag), render);
            } else if (typeof getWorldbook === 'function' && typeof replaceWorldbook === 'function') {
              await replaceWorldbook(names[+bi], mkTouch(changed, bag)(cached), render);
            } else {
              throw new Error('无世界书写入 API');
            }
            res.updated += bag.updated;
          } catch (e) {
            res.failed = res.failed.concat(Object.keys(changed).map(function (n2) { return todo[n2].title; }));
          }
        }

        // 4) 新建：专用创建 API 优先（缺省字段由酒馆补默认），否则往主书推半成品
        if (creates.length) {
          try {
            if (typeof createWorldbookEntries === 'function') {
              await createWorldbookEntries(names[0], creates.map(toTh), render);
            } else if (typeof updateWorldbookWith === 'function') {
              await updateWorldbookWith(names[0], function (entries) {
                creates.forEach(function (s2) { entries.push(toTh(s2)); });
                return entries;
              }, render);
            } else if (typeof getWorldbook === 'function' && typeof replaceWorldbook === 'function') {
              var es = booksCache[0] || [];
              creates.forEach(function (s2) { es.push(toTh(s2)); });
              await replaceWorldbook(names[0], es, render);
            } else {
              throw new Error('无世界书写入 API');
            }
            res.created += creates.length;
          } catch (e) {
            res.failed = res.failed.concat(creates.map(function (c) { return c.title; }));
          }
        }
        return res;
      };
    })(),

    // 托管条目删除（设定同步·删除传播用）：按标题逐书过滤，只删命中的；
    // :: 前缀条目双保险拒删（同步层已拦，这里再拦一次）；哪本失败记哪本，其余照删。
    deleteManaged: async function (titles) {
      var res = { deleted: 0, failed: [] };
      if (!titles || !titles.length) return res;
      var names = await bookNames();
      var norm = function (s2) { return String(s2 || '').replace(/[【】\s]/g, ''); };
      var kill = {};
      titles.forEach(function (t) {
        if (String(t).indexOf('::') === -1) kill[norm(t)] = true;
      });
      var render = { render: 'immediate' };
      for (var i = 0; i < names.length; i++) {
        try {
          var es = await entriesOf(names[i]);
          var doomed = es.filter(function (e) { return !!kill[norm(titleOf(e))]; });
          if (!doomed.length) continue;
          if (typeof updateWorldbookWith === 'function') {
            await updateWorldbookWith(names[i], function (entries) {
              return entries.filter(function (e) { return !kill[norm(titleOf(e))]; });
            }, render);
          } else if (typeof getWorldbook === 'function' && typeof replaceWorldbook === 'function') {
            await replaceWorldbook(names[i], es.filter(function (e) { return !kill[norm(titleOf(e))]; }), render);
          } else {
            throw new Error('无世界书写入 API');
          }
          res.deleted += doomed.length;
        } catch (e) {
          res.failed = res.failed.concat(titles);
        }
      }
      return res;
    },

    // 双源（jsdelivr 主源 / catbox 兜底）都失败的图：渲染不再发请求，给灰块 SVG
    // （与陌生人头像同款 #c9cfd6，视觉无差）。名单会话级，刷新页面即重置重试。
    DEAD_IMG: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="9" fill="#c9cfd6"/></svg>'),

    imgUrl: function (file) {
      file = String(file || '').trim();
      if (!file) return '';
      if (/^https?:\/\//i.test(file)) return file;
      var wl = window.LZWorld || {};
      if (wl.DEAD_IMGS && wl.DEAD_IMGS[file]) return Worldbook.DEAD_IMG;
      return (wl.IMG_BASE || 'https://cdn.jsdelivr.net/gh/haodayizhiyu404/linzhou-world@main/img/') + file;
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Worldbook = Worldbook;
})();
