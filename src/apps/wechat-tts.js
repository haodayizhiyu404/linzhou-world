// ═══════════════════════════════════════════════════════════
//  apps/wechat-tts.js —— 音色设置屏：生成源/密钥/逐人音色映射 + 试音
//  配置存世界书条目「霖州手机::音色」（跟世界书走，全聊天通用）；API key 只存本机。
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  Object.assign(UI, {
    // 音色 app：先确保世界书配置读入再渲染（首次打开异步，后续走缓存）
    openTts: function () {
      var self = this;
      this.screen = 'tts';
      this.panel = null;
      this.render();
      if (!this._ttsWarmed) {
        this._ttsWarmed = true;
        try {
          W.Tts.ready().then(function () {
            if (self.screen === 'tts') self.render();
          });
        } catch (e) {}
      }
    },

    bodyTts: function (ctx) {
      var W2 = window.LZWorld;
      var cfg = (W2.Tts && W2.Tts.cfgCache) || { enabled: true, autoCall: true, provider: 'fish', endpoint: '', model: '', defaultVoice: '', voices: {} };
      var eng = W2.Engine;
      var names = [];
      try {
        var sec = eng.section() || {};
        (sec.contacts || []).forEach(function (c) { if (c && c.name) names.push(c.name); });
      } catch (e0) {}
      var meName = '';
      try { meName = eng.userName(); } catch (e0) {}
      var key = W2.Tts ? W2.Tts.apiKey() : '';
      function vrow(nm) {
        var v = (cfg.voices || {})[nm] || '';
        var isMe = nm === meName;
        return '<div class="lzw-setrow"><div class="lzw-setmain"><div class="lzw-setname">' + C.esc(nm) + (isMe ? '（机主）' : '') + '</div>' +
          '<div class="lzw-setrow2"><input class="lzw-settxt" data-tvoice="' + C.esc(nm) + '" value="' + C.esc(v) + '" placeholder="音色ID：fish 填 reference_id，OpenAI 兼容填 voice 名">' +
          '<button class="lzw-setbtn" data-ttest="' + C.esc(nm) + '">试音</button></div></div></div>';
      }
      var srcOpts = [['fish', 'Fish Audio（reference_id 音色）'], ['openai', 'OpenAI 兼容（公益站/OpenAI 系）']];
      var srcSel = srcOpts.map(function (o) {
        return '<option value="' + o[0] + '"' + ((cfg.provider || 'fish') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
      return '<div class="lzw-body"><div class="lzw-setwrap">' +
        '<div class="lzw-setsec">播放</div><div class="lzw-setcard">' +
        '<div class="lzw-setrow"><div class="lzw-setmain"><div class="lzw-setname">语音播放总开关</div></div>' +
        '<input type="checkbox" data-tgl="enabled"' + (cfg.enabled ? ' checked' : '') + '></div>' +
        '<div class="lzw-setrow"><div class="lzw-setmain"><div class="lzw-setname">通话自动连播</div>' +
        '<div class="lzw-setdesc">语音通话中 AI 的台词逐条朗读；挂断/你说话/重说即打断</div></div>' +
        '<input type="checkbox" data-tgl="autoCall"' + (cfg.autoCall ? ' checked' : '') + '></div>' +
        '</div>' +
        '<div class="lzw-setsec">生成源</div><div class="lzw-setcard">' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">提供商</span><div class="lzw-setrow2"><select class="lzw-settxt" data-tprov>' + srcSel + '</select></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">接口地址（仅 OpenAI 兼容，含 https://）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-tcfg="endpoint" value="' + C.esc(cfg.endpoint || '') + '" placeholder="https://api.example.com"></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">模型（可空：fish 走默认，OpenAI 兼容默认 tts-1）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-tcfg="model" value="' + C.esc(cfg.model || '') + '" placeholder="模型名"></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">API 密钥（只存本机浏览器）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-tkey type="password" value="' + C.esc(key) + '" placeholder="sk-..."></div></div>' +
        '</div>' +
        '<div class="lzw-setsec">音色映射（跟世界书走，全聊天通用）</div><div class="lzw-setcard">' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">默认音色（没单独配音色的角色走这个；留空则不发声）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-tcfg="defaultVoice" value="' + C.esc(cfg.defaultVoice || '') + '" placeholder="音色ID，可空"></div></div>' +
        (names.length ? names.map(vrow).join('') : '<div class="lzw-sysrow">未定位到当前世界线</div>') +
        '</div>' +
        '<div class="lzw-setnote">fish 音色：fish.audio 音色库页面复制 reference_id（一串 UUID）。没配音色的角色不发声，其余功能不受影响。</div>' +
        '</div></div>';
    }
  });


  UI._binders.push(function (ph) {
    // 音色 app：开关/来源/密钥/音色映射即时保存（写世界书条目，key 落本机）
    ph.querySelectorAll('[data-tgl]').forEach(function (el) {
      el.onchange = function () { var p2 = {}; p2[el.dataset.tgl] = el.checked; W.Tts.save(p2); };
    });
    ph.querySelectorAll('[data-tprov]').forEach(function (el) {
      el.onchange = function () { W.Tts.save({ provider: el.value }); };
    });
    ph.querySelectorAll('[data-tcfg]').forEach(function (el) {
      el.onchange = function () { var p2 = {}; p2[el.dataset.tcfg] = el.value.trim(); W.Tts.save(p2); };
    });
    ph.querySelectorAll('[data-tkey]').forEach(function (el) {
      el.onchange = function () { W.Tts.setApiKey(el.value.trim()); };
    });
    ph.querySelectorAll('[data-tvoice]').forEach(function (el) {
      el.onchange = function () {
        var v = {}; v[el.dataset.tvoice] = el.value.trim();
        W.Tts.save({ voices: v });
      };
    });
    ph.querySelectorAll('[data-ttest]').forEach(function (el) {
      el.onclick = function () {
        try {
          var nm = el.dataset.ttest;
          var inp = ph.querySelector('[data-tvoice="' + nm + '"]');
          var voice = inp ? inp.value.trim() : '';
          if (!voice) { try { toastr.info('先填音色ID再试音', '📱 霖州引擎'); } catch (e) {} return; }
          W.Tts.play('你好，我是' + nm + '。这句是试音。', voice).catch(function (e) {
            try { toastr.error('试音失败：' + (e && e.message || e), '📱 霖州引擎'); } catch (e2) {}
          });
        } catch (e) {}
      };
    });
  });
})();
