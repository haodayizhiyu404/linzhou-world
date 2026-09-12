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
      var headText = lastMsg.kind === 'text' ? lastMsg.text : '[' + ({ sticker: '表情', voice: '语音', image: '图片', poke: '戳一戳', location: '定位' }[lastMsg.kind] || '消息') + ']';
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

    // 通话轮：机主「说」了 userSays（可为空 = 接续对方上一句），生成对方台词
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
      return text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 8);
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
