// ═══════════════════════════════════════════════════════════
//  apps/wechat-memo.js —— 备忘录屏：选人 chips / 存档列表 / 阅读页
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
//  存档挂 Store key「memo:名字」：条目 = {date:'YYYY-MM-DD', title, content, day, time}
//  选人 chips + 存档列表 + 写一篇/重roll/删除（确认弹窗走 data-mact，不占壳的 cact 表）
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;

  // ── 列表屏：选人 chips + 存档（新→旧）+ 底部「写一篇」+ 确认弹窗 ──
  UI.bodyMemo = function (ctx) {
    var W = ctx.W, eng = ctx.eng;
    var sec = eng.section() || {};
    var chips = (sec.contacts || []).map(function (c) {
      return '<button class="lzw-memo-chip' + (c.name === this.memoNpc ? ' on' : '') + '" data-mnpc="' + C.esc(c.name) + '">' + C.esc(c.name) + '</button>';
    }, this).join('');
    var ents = this.memoNpc ? eng.memoEntries(this.memoNpc) : [];
    var rows = '';
    for (var i = ents.length - 1; i >= 0; i--) {
      var e = ents[i];
      rows +=
        '<div class="lzw-memo-row" data-mopen="' + i + '">' +
        '<div class="lzw-memo-rowmain"><div class="lzw-memo-rowt">' + C.esc(e.title || '（无标题）') + '</div>' +
        '<div class="lzw-memo-rows">' + C.esc(String(e.content).replace(/\s+/g, ' ').slice(0, 42)) + '</div></div>' +
        '<span class="lzw-memo-rowdate">' + C.esc(e.date) + '</span>' +
        '<div class="lzw-memo-rowops">' +
        '<button class="lzw-memo-op" data-mreroll="' + i + '" title="删掉这篇，重新生成一篇">' + C.ICON_REROLL + '</button>' +
        '<button class="lzw-memo-op" data-mdel="' + i + '" title="删除这篇">' + C.ICON_TRASH + '</button>' +
        '</div></div>';
    }
    return '<div class="lzw-body" style="display:flex;flex-direction:column;overflow:hidden">' +
      '<div class="lzw-memo-chips">' + (chips || '<span class="lzw-sysrow">本世界线暂无联系人</span>') + '</div>' +
      '<div class="lzw-memo-list">' +
      (rows || '<div class="lzw-sysrow" style="margin-top:40px">还没有备忘录<br>点下方「写一篇」，偷看 TA 的一天</div>') +
      (this.memoBusy ? '<div class="lzw-sysrow">正在生成…</div>' : '') +
      '</div>' +
      '<div class="lzw-memo-foot"><button class="lzw-memo-write" data-mwrite="1"' + (this.memoBusy ? ' disabled' : '') + '>写一篇</button></div>' +
      (this.memoConfirm >= 0 || this.memoConfirmR >= 0
        ? '<div class="lzw-scrim"><div class="lzw-confirm">' + (this.memoConfirm >= 0 ? '删掉这篇备忘录？' : '删掉这篇，重新生成一篇？') +
          '<div class="lzw-cbtns"><button class="lzw-cbtn no" data-mact="mdelno">取消</button><button class="lzw-cbtn yes" data-mact="' + (this.memoConfirm >= 0 ? 'mdelok' : 'mrerollok') + '">' + (this.memoConfirm >= 0 ? '删除' : '重roll') + '</button></div></div></div>'
        : '') +
      '</div>';
  };

  // ── 阅读屏：整页白纸、无卡片——日期/标题/正文同落一页，靠排版分层（iOS 备忘录式）──
  UI.bodyMread = function (ctx) {
    var W = ctx.W, eng = ctx.eng;
    var ents = this.memoNpc ? eng.memoEntries(this.memoNpc) : [];
    var e = ents[this.memoRead];
    var paras = e ? String(e.content).split('\n').filter(function (l) { return l.trim(); })
      .map(function (l) { return '<p>' + C.esc(l.trim()) + '</p>'; }).join('') : '';
    return '<div class="lzw-memo-read">' +
      (e
        ? '<div class="lzw-memo-readh">' + C.esc(e.date) + (e.day ? ' · 记于' + C.esc(String(e.day).replace(/^\d{4}年/, '')) : '') + '</div>' +
          (e.title ? '<div class="lzw-memo-readt">' + C.esc(e.title) + '</div>' : '') +
          '<div class="lzw-memo-readc">' + paras + '</div>'
        : '<div class="lzw-sysrow" style="margin-top:40px">这篇备忘录不存在了</div>') +
      '</div>';
  };

  Object.assign(UI, {
    openMemo: function (npc) {
      if (npc) this.memoNpc = npc;
      if (!this.memoNpc) {
        var sec0 = W.Engine.section();
        if (sec0 && sec0.contacts && sec0.contacts.length) this.memoNpc = sec0.contacts[0].name;
      }
      this.memoConfirm = -1;
      this.memoConfirmR = -1;
      this.memoRead = -1;
      this.screen = 'memo';
      this.render();
    },
    // 手动「写一篇」：无当日判重——同日想写几篇写几篇，日期由 usedDates 排除、撞车并列不覆盖
    memoWriteOne: function () {
      if (this.memoBusy || !this.memoNpc) return;
      this.memoBusy = true;
      this.render();
      var self = this;
      W.Engine.memoWrite(this.memoNpc).catch(function (e) {
        console.warn('[霖州引擎] 备忘录生成失败', e);
        try { toastr.error('备忘录生成失败：' + (e && e.message || e), '霖州手机'); } catch (e2) {}
      }).finally(function () {
        self.memoBusy = false;
        if (self.screen === 'memo') self.render();
      });
    },
    // 重roll：先弹确认（误触防删），确认后删指定旧篇再生成（AI 选题自然避开其余日期）
    memoReroll: function (idx) {
      if (this.memoBusy || !this.memoNpc) return;
      this.memoConfirmR = idx;
      this.render();
    }
  });

  UI._binders.push(function (ph) {
    ph.querySelectorAll('[data-mnpc]').forEach(function (el) {
      el.onclick = function () { UI.openMemo(el.dataset.mnpc); };
    });
    ph.querySelectorAll('[data-mwrite]').forEach(function (el) {
      el.onclick = function () { UI.memoWriteOne(); };
    });
    ph.querySelectorAll('[data-mopen]').forEach(function (el) {
      el.onclick = function () {
        UI.memoRead = parseInt(el.dataset.mopen, 10);
        UI.memoConfirm = -1;
        UI.memoConfirmR = -1;
        UI.screen = 'mread';
        UI.render();
      };
    });
    // 行内操作拦冒泡，免得点「重roll/删除」顺手把条目打开
    ph.querySelectorAll('[data-mreroll]').forEach(function (el) {
      el.onclick = function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); UI.memoReroll(parseInt(el.dataset.mreroll, 10)); };
    });
    ph.querySelectorAll('[data-mdel]').forEach(function (el) {
      el.onclick = function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); UI.memoConfirm = parseInt(el.dataset.mdel, 10); UI.render(); };
    });
    // 备忘录确认弹窗三件套（data-mact 独立分发，壳的 data-cact 表不掺和）
    ph.querySelectorAll('[data-mact]').forEach(function (el) {
      el.onclick = function () {
        var a = el.dataset.mact;
        if (a === 'mdelno') { UI.memoConfirm = -1; UI.memoConfirmR = -1; UI.render(); }
        else if (a === 'mdelok') {
          var dx = UI.memoConfirm; UI.memoConfirm = -1;
          try { W.Engine.memoDeleteAt(UI.memoNpc, dx); } catch (e) {}
          UI.render();
        } else if (a === 'mrerollok') {
          var rx = UI.memoConfirmR; UI.memoConfirmR = -1;
          try { W.Engine.memoDeleteAt(UI.memoNpc, rx); } catch (e) {}
          UI.memoWriteOne();
        }
      };
    });
  });
})();
