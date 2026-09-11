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

    // 酒馆 persona 头像：多路读取，全部失败才退回字母块。
    // ① 聊天里最近一条用户消息的头像图（酒馆渲染好的）；② 用户设置面板当前 persona 的高亮块。
    userAvatar: function () {
      var doc = null;
      try { doc = window.parent.document; }
      catch (e) { console.warn('[霖州引擎] 头像：父页 DOM 不可达：' + (e && e.message)); return ''; }
      try {
        var imgs = doc.querySelectorAll('#chat .mes[is_user="true"] .avatar img');
        for (var i = imgs.length - 1; i >= 0; i--) {
          if (imgs[i].src) return imgs[i].src;
        }
        console.log('[霖州引擎] 头像：聊天里还没有用户消息（' + imgs.length + ' 条），改读 persona 面板');
      } catch (e) { console.warn('[霖州引擎] 头像：聊天内查找失败：' + (e && e.message)); }
      try {
        var pimg = doc.querySelector('#user_avatar_block .avatar-container.selected .avatar img');
        if (pimg && pimg.src) return pimg.src;
      } catch (e) {}
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

    // ── 独立生成 ──
    generateFor: async function (chatKey, isGroup) {
      var W = window.LZWorld;
      var sec = this.section();
      if (!sec) throw new Error('当前世界线无通讯录');

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
        var req = W.Prompt.private({ name: c.name, profile: profile }, rest, snap, stickerNames, tail);
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
        var req2 = W.Prompt.group({ name: g.name, open: g.open }, members, rest2, snap2, stickerNames, tail2);
        raw = await generateRaw(req2);
        title = g.name + ' 群聊';
        parseGroup = true;
      }

      var text = (typeof raw === 'string') ? raw : String((raw && (raw.text || raw.message)) || '');
      var msgs = W.Floor.parseNpcLines(text, parseGroup ? null : chatKey);
      if (!msgs.length) throw new Error('生成结果为空');
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
