// ═══════════════════════════════════════════════════════════
//  apps/wechat-settings.js —— 设置屏：四模式/数值/自定义API/预设管理
//  由 wechat.js（壳）经 window.LZWorld.Apps.wechat / WechatCore 挂接
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window.LZWorld, UI = W.Apps.wechat, C = W.WechatCore;


  UI.bodySettings = function (ctx) { return settingsHtml(); };

  var SET_NRANGES = { plotFloors: [1, 20], plotCap: [100, 2000], histPriv: [10, 100], histGroup: [10, 100], crossMax: [1, 6], crossLines: [5, 50], injRecent: [1, 30], injMention: [1, 20], injMax: [1, 6], injRounds: [10, 100] };
  function settingsHtml() {
    var W = window.LZWorld;
    var cfg = W.Store.cfg();
    var api = {};
    try { api = W.Store.settings().api || {}; } catch (e) {}
    var mode = (api.mode === 'model' || api.mode === 'custom') ? api.mode : 'follow';
    var modes = [
      ['follow', '跟随正文', '手机与正文用同一条 API 线'],
      ['model', '只换模型', '正文同源，手机单独指定模型'],
      ['custom', '自定义 API', '完全独立：选格式、填地址、填密钥；谷歌反代=反代地址+反代密码']
    ];
    var rows = modes.map(function (m) {
      return '<div class="lzw-setrow' + (mode === m[0] ? ' on' : '') + '" data-amode="' + m[0] + '">' +
        '<div class="lzw-setmain"><div class="lzw-setname">' + m[1] + '</div><div class="lzw-setdesc">' + m[2] + '</div></div>' +
        '<span class="lzw-setck">' + C.ICON_TOK + '</span></div>';
    }).join('');
    var detail = '';
    if (mode === 'model') {
      detail = '<div class="lzw-setcol"><span class="lzw-setlbl">模型名</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-atext="model" value="' + C.esc(api.model || '') + '" placeholder="如 gemini-3.1-flash"></div></div>';
    } else if (mode === 'custom') {
      var key = '';
      try { key = localStorage.getItem('lzworld_phone_apikey') || ''; } catch (e) {}
      var srcOpts = [['openai', 'OpenAI 格式（第三方中转）'], ['makersuite', 'Google AI Studio（配反代地址）']];
      var srcSel = srcOpts.map(function (o) {
        return '<option value="' + o[0] + '"' + ((api.source || 'openai') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
      detail =
        '<div class="lzw-setcol"><span class="lzw-setlbl">API 源（决定请求格式）</span><div class="lzw-setrow2">' +
        '<select class="lzw-settxt" data-atext="source">' + srcSel + '</select></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">API 地址（OpenAI 中转 或 谷歌反代）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-atext="apiurl" value="' + C.esc(api.apiurl || '') + '" placeholder="https://…"></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">密钥 / 反代密码（仅本机保存）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-akey="1" value="' + C.esc(key) + '" placeholder="sk-…"></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">模型（先填地址与密钥）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-atext="cmodel" value="' + C.esc(api.cmodel || '') + '" placeholder="模型名">' +
        '<button class="lzw-setbtn" data-afetch="models">拉取模型</button></div></div>' +
        '<div class="lzw-setcol"><span class="lzw-setlbl">预设名（把上面整套存下来）</span><div class="lzw-setrow2">' +
        '<input class="lzw-settxt" data-apname="1" placeholder="如：谷歌反代">' +
        '<button class="lzw-setbtn" data-afetch="savepreset">保存预设</button></div></div>';
      var saved = api.presets || {};
      var savedRows = Object.keys(saved).map(function (nm) {
        var p = saved[nm] || {};
        var srcName = p.source === 'makersuite' ? '谷歌反代' : 'OpenAI';
        return '<div class="lzw-setrow" data-aapply="' + C.esc(nm) + '">' +
          '<div class="lzw-setmain"><div class="lzw-setname">' + C.esc(nm) + '</div>' +
          '<div class="lzw-setdesc">' + srcName + (p.apiurl ? ' · ' + C.esc(p.apiurl) : '') + (p.cmodel ? ' · ' + C.esc(p.cmodel) : '') + '</div></div>' +
          '<span class="lzw-setdel" data-apdel="' + C.esc(nm) + '">✕</span></div>';
      }).join('');
      if (savedRows) {
        detail += '<div class="lzw-setcol"><span class="lzw-setlbl">已存预设（点按即套用；点 ✕ 需确认后删除，密钥随预设各存一份在本机）</span></div>' + savedRows;
      }
    }
    var pick = '';
    if (UI._setpick && UI._setpick.items.length) {
      pick = '<div class="lzw-setpick">' + UI._setpick.items.map(function (it) {
        return '<span data-pick="' + C.esc(it) + '">' + C.esc(it) + '</span>';
      }).join('') + '</div>';
    }
    function numrow(key, name) {
      var r = SET_NRANGES[key];
      return '<div class="lzw-setrow"><div class="lzw-setmain"><div class="lzw-setname">' + name + '</div>' +
        '<div class="lzw-setdesc">' + r[0] + ' ~ ' + r[1] + '</div></div>' +
        '<input class="lzw-setnum" data-num="' + key + '" data-min="' + r[0] + '" data-max="' + r[1] + '" value="' + cfg[key] + '" inputmode="numeric"></div>';
    }
    var numsMain = numrow('plotFloors', '带几楼正文') + numrow('plotCap', '每楼最多带多少字');
    var numsHist = numrow('histPriv', '私聊记录带几条') + numrow('histGroup', '群聊记录带几条');
    var numsCross = numrow('crossMax', '顺带带几个相关会话') + numrow('crossLines', '每个相关会话带几条');
    var numsInj = numrow('injRecent', '聊过几楼内就注入') + numrow('injMention', '点名几楼内就注入') +
      numrow('injMax', '一次最多注入几个会话') + numrow('injRounds', '每会话注入最近几条');
    return '<div class="lzw-body"><div class="lzw-setwrap">' +
      '<div class="lzw-setsec">生成 API</div><div class="lzw-setcard">' + rows + detail + '</div>' + pick +
      '<div class="lzw-setsec">手机生成 · 主线正文</div><div class="lzw-setcard">' + numsMain + '</div>' +
      '<div class="lzw-setsec">手机生成 · 聊天记录</div><div class="lzw-setcard">' + numsHist + '</div>' +
      '<div class="lzw-setsec">手机生成 · 跨会话</div><div class="lzw-setcard">' + numsCross + '</div>' +
      '<div class="lzw-setsec">正文生成 · 手机注入（正文 AI 对手机的知情度）</div><div class="lzw-setcard">' + numsInj + '</div>' +
      '<div class="lzw-setnote">跨会话：生成私聊时，顺带带对方今天在的群的记录；生成群时，顺带带成员今天与机主的私聊，让对方接得上别处的梗。</div>' +
      '<div class="lzw-setnote">数值改动立即生效；API 改动作用于之后的每次手机生成。携带量与 API 配置（含自定义预设，密钥除外）随聊天变量保存（明文、随卡走）；密钥按预设名各存一份，只留在本机浏览器。</div>' +
      '</div></div>';
  }



  UI._binders.push(function (ph) {
    if (UI.screen === 'settings') {
      var saveApi = function (patch) {
        var api0 = {};
        try { api0 = window.LZWorld.Store.settings().api || {}; } catch (e) {}
        for (var k in patch) api0[k] = patch[k];
        window.LZWorld.Store.setSettings({ api: api0 });
      };
      ph.querySelectorAll('[data-amode]').forEach(function (el) {
        el.onclick = function () {
          saveApi({ mode: el.dataset.amode });
          UI._setpick = null;
          UI.render();
        };
      });
      ph.querySelectorAll('[data-num]').forEach(function (el) {
        el.onchange = function () {
          var lo = +el.dataset.min, hi = +el.dataset.max;
          var v = Math.round(Number(el.value));
          if (!isFinite(v)) v = window.LZWorld.Store.DEFAULTS[el.dataset.num];
          el.value = Math.min(hi, Math.max(lo, v));
          var patch = {}; patch[el.dataset.num] = +el.value;
          window.LZWorld.Store.setSettings(patch);
        };
      });
      ph.querySelectorAll('[data-atext]').forEach(function (el) {
        el.onchange = function () { var patch = {}; patch[el.dataset.atext] = el.value; saveApi(patch); };
      });
      ph.querySelectorAll('[data-akey]').forEach(function (el) {
        el.onchange = function () {
          try { localStorage.setItem('lzworld_phone_apikey', el.value); } catch (e) {}
        };
      });
      ph.querySelectorAll('[data-afetch]').forEach(function (el) {
        el.onclick = async function () {
          try {
            if (el.dataset.afetch === 'savepreset') {
              var nmEl = ph.querySelector('[data-apname]');
              var nm = ((nmEl && nmEl.value) || '').trim();
              if (!nm) {
                UI._setpick = { field: null, items: ['（先输入预设名再保存）'] };
              } else {
                var read = function (sel) { var x = ph.querySelector(sel); return x ? x.value.trim() : ''; };
                var preset = { source: read('[data-atext="source"]') || 'openai', apiurl: read('[data-atext="apiurl"]'), cmodel: read('[data-atext="cmodel"]') };
                var api1 = {};
                try { api1 = window.LZWorld.Store.settings().api || {}; } catch (e) {}
                var presets0 = api1.presets || {};
                presets0[nm] = preset;
                saveApi({ presets: presets0, source: preset.source, apiurl: preset.apiurl, cmodel: preset.cmodel });
                var kyEl = ph.querySelector('[data-akey]');
                try { localStorage.setItem('lzworld_phone_apikey::' + nm, kyEl ? kyEl.value : ''); } catch (e) {}
                UI._setpick = null;
              }
            } else {
              var api2 = {};
              try { api2 = window.LZWorld.Store.settings().api || {}; } catch (e) {}
              var key1 = '';
              try { key1 = localStorage.getItem('lzworld_phone_apikey') || ''; } catch (e) {}
              var list = await getModelList({ apiurl: api2.apiurl || '', key: key1 });
              UI._setpick = { field: api2.mode === 'custom' ? 'cmodel' : 'model', items: list || [] };
            }
          } catch (e) {
            UI._setpick = { field: null, items: ['（操作失败：' + String(e && e.message || e) + '）'] };
          }
          UI.render();
        };
      });
      ph.querySelectorAll('[data-pick]').forEach(function (el) {
        el.onclick = function () {
          var patch = {};
          patch[(UI._setpick && UI._setpick.field) || 'model'] = el.dataset.pick;
          saveApi(patch);
          UI._setpick = null;
          UI.render();
        };
      });
      ph.querySelectorAll('[data-aapply]').forEach(function (el) {
        el.onclick = function () {
          var nm = el.dataset.aapply;
          var p = {};
          try { p = ((window.LZWorld.Store.settings().api || {}).presets || {})[nm] || {}; } catch (e) {}
          saveApi({ source: p.source || 'openai', apiurl: p.apiurl || '', cmodel: p.cmodel || '' });
          var ky = '';
          try { ky = localStorage.getItem('lzworld_phone_apikey::' + nm) || ''; } catch (e) {}
          try { localStorage.setItem('lzworld_phone_apikey', ky); } catch (e) {}
          UI.render();
        };
      });
      ph.querySelectorAll('[data-apdel]').forEach(function (el) {
        el.onclick = function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          UI.pConfirmDel = el.dataset.apdel;
          UI.render();
        };
      });
    }
  });
})();
