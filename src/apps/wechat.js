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
