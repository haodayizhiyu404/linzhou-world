// ═══════════════════════════════════════════════════════════
//  apps/wechat-call.js —— 通话屏：拨打/字幕/重roll/挂断
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  Object.assign(UI, {
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
      // 「通话开始」边界在拨号即打（不是接通才打）：响铃期界面/切段就已属于新会话，
      // 不会把上一通的记录显示在新通话的呼叫页；拒接/取消留下 0 条目的空边界，切段自动跳过。
      // mode 一并落进标记：视频通话若全程无 [画面] 行，靠 scene 嗅探会误判成语音，标记优先。
      W.Store.push(eng.callKey(name), [{ who: 'sys', kind: 'sys', text: '—— 通话开始 ——', mode: mode }], 200);
      this.render();
      try {
        var text = await C.withTimeout(eng.callInvite(name, mode), 300000);
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
        var ret = await C.withTimeout(eng.callTurn(call.name, call.mode, text), 300000);
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
      // 弹栈不设条数上限——视频一轮最多 16 条，旧上限 10 会把旧回复的前几条留在
      // transcript 里喂给重生请求（旁白泄漏）；遇机主消息/「通话开始」边界即停。
      for (var i = h.length - 1; i >= 0 && h[i].who !== 'user' && h[i].who !== 'sys'; i--) n++;
      if (!n) return;
      W.Store.popLast(key, n);
      call.busy = true;
      this.render();
      try {
        var ret = await C.withTimeout(eng.callTurn(call.name, call.mode, ''), 300000);
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
        // 静默生成通话纪要（不阻塞挂断；失败或未完成时，各注入处兜底带原文）
        try { eng.summarizeCall(call.name); } catch (e) {}
      } else if (cancelled) {
        W.Store.push(call.name, [{ who: who, kind: 'calllog', mode: call.mode, text: '已取消' }], 100);
      }
      this.screen = 'chat';
      this.chatKey = call.name;
      this.isGroup = false;
      this.render();
    }
  });

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
    var mm = (m < 10 ? '0' : '') + m, s2 = (ss < 10 ? '0' : '') + ss;
    return h ? (h + ':' + mm + ':' + s2) : (mm + ':' + s2);
  }

  // 通话屏：背景（模糊头像+厚遮罩）由 render() 铺在整个屏幕上，这里只排内容。
  // 字幕双人对白都上；底部一左一右：麦克风（点开多行输入弹窗）/ 挂断（电话倒扣）。右上角重说。
  // 右键/长按字幕 = 弹确认窗删除该条通话对白（与聊天记录同一套交互）。
  C.fmtDur = fmtDur;
  function callHtml(call, userName) {
    var W = window.LZWorld;
    var eng = W.Engine;
    var av;
    try {
      var c = eng.findContact(call.name) || { name: call.name, avatar: '' };
      var imgUrl = c.avatar ? C.esc(W.Worldbook.imgUrl(c.avatar)) : '';
      av = imgUrl ? '<img src="' + imgUrl + '">' : C.esc(call.name.slice(0, 1));
    } catch (e) { av = C.esc(call.name.slice(0, 1)); }
    var raw = W.Store.history(eng.callKey(call.name));
    // 只渲染本会话（最近一个「通话开始」边界之后）；data-cdel 用全量下标，删除才能对上位
    var base = eng.callSessionStart(raw);
    var hist = raw.slice(base);
    // PiP 自视窗：优先 persona 头像（同聊天页"我"的气泡头像来源），没有则退名首字
    var pip = '';
    if (call.mode === 'video' && call.phase === 'active') {
      var uav = '';
      try { uav = eng.userAvatar(); } catch (e) {}
      pip = '<div class="lzw-callpip">' + (uav ? '<img src="' + C.esc(uav) + '" alt="">' : C.esc(userName.slice(0, 1))) + '</div>';
    }
    // 视频的画面条目穿插在气泡流中间：说第一句时吃薯片、说第二句时抬头看镜头……
    var subs = hist.map(function (m, i) {
      if (m.who === 'sys') return '';
      if (m.kind === 'scene') return '<div class="lzw-callscene" data-cdel="' + (base + i) + '">' + C.esc(m.text || '').replace(/\n/g, '<br>') + '</div>';
      var isMe = m.who === 'user';
      return '<div class="lzw-sub' + (isMe ? ' me' : '') + '" data-cdel="' + (base + i) + '">' + C.esc(m.text || '') + '</div>';
    }).join('');
    var status = call.phase === 'ringing'
      ? '正在呼叫…'
      : (call.busy ? '对方说话中…' : fmtDur(Math.max(0, Math.round((Date.now() - call.startAt) / 1000))));
    var roll = (call.phase === 'active' && !call.busy)
      ? '<span class="lzw-callroll" data-cact="callreroll" title="重说对方上一段">' + C.ICON_REROLL + '</span>'
      : '';
    // 最小化：收起手机外壳，通话状态原样保留（等 API 回复时可以翻主线/调设置）；
    // 重新打开手机（QR 按钮）即回到本通话界面
    var min = '<button class="lzw-callmin" data-cact="callmin" title="收起手机，通话继续">' + C.ICON_MIN + '</button>';
    var btns;
    if (call.phase === 'ringing') {
      btns = '<div class="lzw-callmid" style="justify-content:center"><button class="lzw-callbtn hang" data-cact="cancelcall"><i>' + C.ICON_HANG + '</i><span>取消</span></button></div>';
    } else {
      btns = '<div class="lzw-callmid">' +
        '<button class="lzw-callbtn" data-cact="micpop"><i>' + C.ICON_MIC + '</i><span>说话</span></button>' +
        '<button class="lzw-callbtn hang" data-cact="hangup"><i>' + C.ICON_HANG + '</i><span>挂断</span></button>' +
        '</div>';
    }
    var conf = (UI.callDel != null)
      ? '<div class="lzw-scrim"><div class="lzw-confirm lzw-calldel">删除这条通话对白？<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="delno">取消</button><button class="lzw-cbtn yes" data-cact="delok">删除</button></div></div></div>'
      : '';
    var pop = UI.callPop
      ? '<div class="lzw-scrim"><div class="lzw-confirm lzw-callpop"><textarea class="lzw-callta" id="lzw-calltext" rows="4" maxlength="500" placeholder="想说什么…（可换行）"></textarea>' +
        '<div class="lzw-cbtns"><button class="lzw-cbtn no" data-cact="popcancel">取消</button><button class="lzw-cbtn yes" data-cact="popok">发送</button></div></div></div>'
      : '';
    return '<div class="lzw-callbody">' + roll + min + pip +
      '<div class="lzw-calltop"><div class="lzw-callava">' + av + '</div>' +
      '<div class="lzw-callname">' + C.esc(call.name) + '</div>' +
      '<div class="lzw-callstatus" id="lzw-callstatus">' + C.esc(status) + '</div></div>' +
      '<div class="lzw-callsubs">' + subs + '</div>' +
      (call.phase === 'ringing' ? '<div class="lzw-cwait">等待对方接听…</div>' : '') +
      conf + btns + '</div>' + pop;
  }

  // 生成超时保护：API 故障时 generateRaw 可能永远不返回，不兜底会让小飞机永远失灵
  C.callHtml = callHtml;


  UI._binders.push(function (ph) {
    // 通话：拨打入口 + 通话屏按钮组
    ph.querySelectorAll('[data-act="dial"]').forEach(function (el) {
      el.onclick = function () { UI.dial(el.dataset.dial); };
    });
  });
})();
