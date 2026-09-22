// ═══════════════════════════════════════════════════════════
//  apps/wechat-chat.js —— 聊天屏：气泡/输入区/+号面板/转账卡/待发区
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodyChat = function (ctx) {
    var W = ctx.W, eng = ctx.eng, userName = ctx.userName;
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
        pre = '<div class="lzw-sysrow">' + C.esc(C.relDay(m.day, curDay) + (m.time ? ' ' + m.time : '')) + '</div>';
        prevDay = m.day;
      }
      return pre + C.chatRowHtml(m, userName, contactMap, disp, i, !!this.peek[key + ':' + i], this.isGroup);
    }, this).join('');
    if (this.failed && this.canRetry()) rows += '<div class="lzw-sysrow">⚠ 对方暂时没有回复（生成失败）<br>点右上角刷新图标，或再点小飞机重试</div>';
    if (this.staged.length) rows += C.stagedHtml(userName);
    return '<div class="lzw-body"><div class="lzw-chatbg" id="lzw-chatbody">' + rows + '</div></div>' +
      '<div class="lzw-bottom">' +
      panelHtml(this.panel) +
      '<div class="lzw-inputbar">' +
      '<button class="lzw-plus" data-act="plus">' + C.ICON_PLUS + '</button>' +
      '<input class="lzw-input" id="lzw-input" placeholder="回车攒一条，小飞机一起发" maxlength="300">' +
      '<button class="lzw-send" data-act="send" title="发送（把攒下的消息一起发出）">' + C.ICON_PLANE + '</button>' +
      '</div></div>';
  };

  function panelHtml(panel) {
    if (!panel) return '<div class="lzw-panel" id="lzw-panel"></div>';
    if (panel === 'sticker') {
      var stickers = window.LZWorld.Engine.stickers();
      var names = Object.keys(stickers);
      var grid = names.length
        ? names.map(function (n) {
            return '<div class="lzw-stickcell" data-stick="' + C.esc(n) + '"><div class="imgw">' +
              '<img src="' + C.esc(window.LZWorld.Worldbook.imgUrl(stickers[n])) + '" loading="lazy"></div></div>';
          }).join('')
        : '<div class="lzw-sysrow">世界书中未找到「霖州手机::表情包」条目</div>';
      return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-stickgrid">' + grid + '</div></div>';
    }
    if (panel === 'transferto') {
      // 群聊转账先选接收方（机主自己除外）
      var Wt = window.LZWorld, engT = Wt.Engine, secT = engT.section() || {};
      var myNameT = engT.userName();
      var gT = null;
      (secT.groups || []).forEach(function (g) { if ('group:' + g.name === UI.chatKey) gT = g; });
      var cells = ((gT && gT.members) || []).filter(function (n) { return n && n !== myNameT; }).map(function (n) {
        var c = engT.findContact(n) || {};
        var avT = c.avatar
          ? '<img class="lzw-ava" src="' + C.esc(Wt.Worldbook.imgUrl(c.avatar)) + '">'
          : '<div class="lzw-ava">' + C.esc(n.slice(0, 1)) + '</div>';
        return '<div class="lzw-conv" data-ttarget="' + C.esc(n) + '">' + avT + '<div class="lzw-conv-main"><div class="lzw-conv-name">' + C.esc(n) + '</div></div></div>';
      }).join('');
      return '<div class="lzw-panel lzw-open lzw-pto" id="lzw-panel"><div class="lzw-ttohd">转账给群里的谁？</div><div class="lzw-ttolist">' +
        (cells || '<div class="lzw-sysrow">群成员名单空空如也</div>') + '</div>' +
        '<div class="lzw-ttofoot"><button class="lzw-modecancel" data-act="modecancel">取消</button></div></div>';
    }
    if (panel === 'transfer') {
      var toWhom = UI.isGroup ? UI.tTarget : UI.chatKey;
      var swapBtn = UI.isGroup ? '<button class="lzw-modecancel" data-cact="tswap">更换</button>' : '';
      return '<div class="lzw-panel lzw-open" id="lzw-panel"><div class="lzw-modeform">' +
        '<div class="lzw-tto-line">转账给 <b>' + C.esc(toWhom || '…') + '</b></div>' +
        '<input class="lzw-modeinput" id="lzw-tamt" maxlength="8" inputmode="decimal" placeholder="金额，1 ~ 99999">' +
        '<input class="lzw-modeinput" id="lzw-tnote" maxlength="30" placeholder="备注（可选），如：奶茶钱">' +
        '<div class="lzw-modebtns"><button class="lzw-modeok" data-tsend="1">确定</button>' + swapBtn +
        '<button class="lzw-modecancel" data-act="modecancel">取消</button></div></div></div>';
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
      '<div class="lzw-act" data-mode="sticker"><div class="lzw-act-ico">' + C.ICO.sticker + '</div><span>表情</span></div>' +
      '<div class="lzw-act" data-mode="image"><div class="lzw-act-ico">' + C.ICO.image + '</div><span>图片</span></div>' +
      '<div class="lzw-act" data-mode="voice"><div class="lzw-act-ico">' + C.ICO.voice + '</div><span>语音</span></div>' +
      (UI.isGroup ? '' : '<div class="lzw-act" data-mode="poke"><div class="lzw-act-ico">' + C.ICO.poke + '</div><span>戳一戳</span></div>') +
      '<div class="lzw-act" data-mode="location"><div class="lzw-act-ico">' + C.ICO.location + '</div><span>定位</span></div>' +
      '<div class="lzw-act" data-mode="transfer"><div class="lzw-act-ico">' + C.ICO.transfer + '</div><span>转账</span></div>' +
      (UI.isGroup ? '' :
        '<div class="lzw-act" data-act="dial" data-dial="audio"><div class="lzw-act-ico">' + C.ICON_CALL + '</div><span>语音通话</span></div>' +
        '<div class="lzw-act" data-act="dial" data-dial="video"><div class="lzw-act-ico">' + C.ICON_VCALL + '</div><span>视频通话</span></div>') +
      '</div></div>';
  }

  // 用 visualViewport 计算位置：F12/移动仿真/页面缩放下依然落在可视区右下角

  Object.assign(UI, {
    openChat: function (key, isGroup) {
      this.chatKey = key;
      this.isGroup = !!isGroup;
      this.screen = 'chat';
      this.panel = null;
      this.staged = [];
      try { window.LZWorld.Store.clearUnread(key); } catch (e) {}
      this.render();
    },

    // ── 朋友圈 ──
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
    // 转账字段多（金额/备注/接收方），不走 stageTyped，但同样先进待发区随小飞机一起发
    stageTransfer: function (amount, note, to) {
      this.staged.push({ kind: 'transfer', amount: amount, note: note, to: to });
      this.panel = null;
      this.tTarget = ''; // 发完就忘，下次群聊转账重新选人，防手滑转错人
      this.render();
      var inp = pdoc().getElementById('lzw-input');
      if (inp) inp.focus();
    },
    // 对对方待收款转账的处置（收下/退还）：攒进发灾区，小飞机发出即翻卡（发出即生效，不等 AI 回复）
    stageTVerdict: function (kind, idx) {
      var W = window.LZWorld, m = null;
      try { m = W.Store.history(this.chatKey)[idx]; } catch (e) {}
      if (!m || m.who === 'user' || m.kind !== 'transfer' || m.state !== 'waiting') { this.render(); return; }
      this.staged.push({ kind: kind, amount: m.amount, note: m.note, from: m.who });
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
        // 没有待发内容时，小飞机充当「重试」：末尾是我方消息且对方没下文（上次失败/回复被删/解析零条），就再生成一次
        var W0 = window.LZWorld;
        var h0 = W0.Store.history(this.chatKey);
        if (!this.busy && h0.length && h0[h0.length - 1].who === 'user') {
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
        if (m.kind === 'transfer') {
          return { who: 'user', kind: 'transfer', amount: m.amount, note: m.note, to: m.to, state: 'waiting', time: W.Status.nowText() };
        }
        if (m.kind === 'taccept' || m.kind === 'tdecline') {
          return { who: 'user', kind: m.kind, amount: m.amount, note: m.note, from: m.from, time: W.Status.nowText() };
        }
        return { who: 'user', kind: m.kind, text: m.text, time: W.Status.nowText() };
      });
      this.staged = [];
      this.failed = false;
      W.Store.push(this.chatKey, msgs, 100);
      // 机主的转账处置（收下/退还）发出即生效：同帧翻掉对应待收款卡（双方的卡同源同一条记录）
      var keyNow = this.chatKey;
      msgs.forEach(function (mm) {
        if (mm.kind === 'taccept' || mm.kind === 'tdecline') {
          try { W.Engine.verdictTransfer(keyNow, mm.kind === 'taccept' ? 'accepted' : 'declined', mm.from, mm.amount, mm.note); } catch (e) {}
        }
      });
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

    // 重试条件：末尾是我方消息（发出后对方没下文——上次生成失败、回复被机主删了、或回复解析成 0 条都算）。
    // 小飞机空发与 ↻ 刷新图标共用此门
    canRetry: function () {
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
      // 重roll 回退本轮转账：旧回复作废了，它「收下」的推断也一并作废，
      // 恢复待收款让新回复重新决定（只回退本轮，旧账不动）
      try { W.Engine.rollbackTransfers(this.chatKey); } catch (e) {}
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
          // 转账处置三连（顺序敏感）：先落 NPC 的 [拒收转账]（显式拒绝最优先），
          // 再落 [接收转账]（显式收下），最后按「对方回了话 = 收了钱」把剩下的待收款批量翻「已收款」，同帧渲染
          try { eng.applyNpcDeclines(key); } catch (e) {}
          try { eng.applyNpcAccepts(key); } catch (e) {}
          try { eng.markTransfersAccepted(key); } catch (e) {}
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
  });


  UI._binders.push(function (ph) {
    ph.querySelectorAll('[data-act="send"]').forEach(function (el) { el.onclick = function () { UI.trySend(); }; });
    ph.querySelectorAll('[data-act="reroll"]').forEach(function (el) { el.onclick = function () { UI.reroll(); }; });
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
        if (mode === 'transfer') { // 群聊先选接收方；私聊直接表单（收款人=对方）
          UI.panel = (UI.isGroup && !UI.tTarget) ? 'transferto' : 'transfer';
          UI.render();
          return;
        }
        UI.panel = mode; // sticker | image | voice | location
        UI.render();
      };
    });
    ph.querySelectorAll('[data-ttarget]').forEach(function (el) {
      el.onclick = function () { UI.tTarget = el.dataset.ttarget; UI.panel = 'transfer'; UI.render(); };
    });
    ph.querySelectorAll('[data-tsend]').forEach(function (el) {
      el.onclick = function () {
        var amtIn = ph.querySelector('#lzw-tamt');
        var raw = amtIn ? amtIn.value.trim().replace(/[¥￥\s元]/g, '') : '';
        var amount = Number(raw);
        if (!raw || isNaN(amount) || amount <= 0 || amount > 99999) {
          try { toastr.error('金额要是 1~99999 的数字', '霖州手机'); } catch (e) {}
          return;
        }
        var noteIn = ph.querySelector('#lzw-tnote');
        var note = noteIn ? noteIn.value.trim().slice(0, 30) : '';
        var to = UI.isGroup ? UI.tTarget : UI.chatKey;
        if (!to) { UI.panel = 'transferto'; UI.render(); return; }
        UI.stageTransfer(Math.round(amount * 100) / 100, note, to);
      };
    });
    ph.querySelectorAll('[data-taccept]').forEach(function (el) {
      el.onclick = function () {
        var row = el.closest('.lzw-chatrow');
        if (!row) return;
        UI.tConfirm = parseInt(row.dataset.del, 10);
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
  });
})();
