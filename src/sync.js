// ═══════════════════════════════════════════════════════════
//  sync.js —— 设定自动同步（世界书托管条目）
//
//  仓库 content/manifest.json 是「设定清单」。引擎启动后异步拉取，【差异驱动】：
//  清单值 ≠ 本地值才动笔，全无差异则完全静默——不看清单版本号
//  （版本号只是诊断记录：用户删改了条目无需等新版本，下次打开即复原）。
//    · 世界书：已存在条目更新 内容/触发键/策略/顺序；【enabled 不动】——开关是运行时状态，归用户与引擎
//    · 删除传播：母本删掉的条目（上次清单快照有、这次没有）用户端同步删除——
//      快照存在本地「霖州手机::版本」条目里（{v, titles}），用户自建条目不在快照中，永不误删
//    · 标题含「::」的条目（音色/版本/通讯录等用户与运行时数据）一律拒收，清单误带也不收
//  主权哲学「作者赢」：设定以作者发布为准；用户空间（自建条目/::条目/其他插件数据）永不触碰。
//  用户出口：设置屏「设定自动更新」可关；「立刻检查更新」手动兜底，关闭状态下也能强制对齐。
//  minPlugin 是格式门槛：清单要求比本插件新 → 整体拒收，等插件追上
//  （防 CDN 缓存按文件分别过期造成的「旧插件+新清单」错配；二期卡字段同步上线即靠它守门）。
//  全程失败静默：拉不到/读不懂/写不进都只记日志，绝不影响本地既有内容。
//
//  二期（已上线）：角色卡字段同步——白名单只三组：开场白组（first_mes+alternate_greetings
//  整组比对整组换）/ 作者名 / 版本号。描述、性格、场景等「基础框架」不托管（老卡不会动）；
//  卡面正则不托管（20+ 条旧体系遗物，不再变动；要加那天往 CARD_GROUPS 补一组即可）。
//  卡字段与世界书同受 minPlugin 门槛保护：清单要求比本插件新 → 两段整体拒收。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var GH = 'haodayizhiyu404/linzhou-world';
  var MFILE = 'content/manifest.json';
  var MARK_VERSION = '霖州手机::版本';   // 本地同步快照落这条（{v, titles}；:: 前缀天然免托管）
  var MIRRORS = ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'testingcf.jsdelivr.net', 'gcore.jsdelivr.net'];
  var log = function (m) { try { console.log('[霖州引擎·同步] ' + m); } catch (e) {} };

  function timedFetch(url, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // a ≤ b？三段数字比较（'1.10.0' > '1.9.0'，字符串比大小会翻车）
  function semverLTE(a, b) {
    var pa = String(a || '0').split('.'), pb = String(b || '0').split('.');
    for (var i = 0; i < 3; i++) {
      var x = parseInt(pa[i], 10) || 0, y = parseInt(pb[i], 10) || 0;
      if (x !== y) return x < y;
    }
    return true;
  }

  // 与装载器同套：GitHub API 解析 main 最新提交号（绕 jsDelivr 的 @main 缓存），失败退分支名
  async function resolveRef() {
    try {
      var r = await timedFetch('https://api.github.com/repos/' + GH + '/commits/main', 5000);
      if (r.ok) {
        var sha = String(((await r.json()) || {}).sha || '').trim();
        if (/^[0-9a-f]{7,40}$/.test(sha)) return sha;
      }
    } catch (e) {}
    return 'main';
  }

  async function fetchManifest() {
    var ref = await resolveRef();
    var urls = ['https://raw.githubusercontent.com/' + GH + '/' + ref + '/' + MFILE];
    MIRRORS.forEach(function (h) { urls.push('https://' + h + '/gh/' + GH + '@' + ref + '/' + MFILE); });
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await timedFetch(urls[i], 8000);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var j = await r.json();
        if (!j || typeof j.version !== 'number' || !Array.isArray(j.entries)) throw new Error('清单格式不对');
        return j;
      } catch (e) { log('源' + (i + 1) + ' 失败：' + (e && e.message || e)); }
    }
    return null;
  }

  // 本地版本条目：{v, titles}。兼容纯整数旧格式（titles 空 = 无快照，首轮不做删除）
  function parseVersionEntry(content) {
    var s = String(content || '').trim();
    try {
      var j = JSON.parse(s);
      if (j && typeof j === 'object') {
        return { v: parseInt(j.v, 10) || 0, titles: Array.isArray(j.titles) ? j.titles : [] };
      }
    } catch (e) {}
    return { v: parseInt(s, 10) || 0, titles: [] };
  }

  // 应用清单（拉取之外的全部逻辑，测试直调这里）。差异驱动：逐条目比对，有差异才写。
  // 返回 {applied, updated, created, deleted, from, to} 或 {applied:false, reason}。
  async function apply(mf) {
    var W = window.LZWorld;
    if (!semverLTE(mf.minPlugin || '0.0.0', W.VERSION)) {
      return { applied: false, reason: '清单要求插件≥' + mf.minPlugin + '（当前 ' + W.VERSION + '），跳过' };
    }

    // :: 条目是用户/运行时数据，清单误带也一律拒收（双保险，导出工具那头也拦）
    var clean = mf.entries.filter(function (e) { return e && e.title && String(e.title).indexOf('::') === -1; });
    var newTitles = clean.map(function (e) { return e.title; });

    // 删除传播：上次快照有、这次清单没有 → 用户端同步删除（先读快照再动笔，失败下轮重试幂等）
    var prev = { v: 0, titles: [] };
    try {
      var cur = await W.Worldbook.getEntry(MARK_VERSION);
      if (cur) prev = parseVersionEntry(cur.content);
    } catch (e) {}
    var newNorm = {};
    var nz = function (s2) { return String(s2 || '').replace(/[【】\s]/g, ''); };
    newTitles.forEach(function (t) { newNorm[nz(t)] = true; });
    var del = prev.titles.filter(function (t) { return String(t).indexOf('::') === -1 && !newNorm[nz(t)]; });
    var deleted = 0;
    if (del.length) {
      try {
        var dr = await W.Worldbook.deleteManaged(del);
        deleted = dr.deleted;
        if (dr.failed.length) log('部分条目删除失败：' + dr.failed.join('、') + '（下次打开重试）');
      } catch (e) { log('删除传播异常：' + (e && e.message || e)); }
    }

    var res = await W.Worldbook.upsertManaged(clean);
    if (res.failed.length) {
      return { applied: false, reason: '部分条目写入失败：' + res.failed.join('、') + '（下次打开重试）' };
    }

    // 版本条目 = 清单快照（版本号 + 托管标题清单），供下轮删除传播比对
    await W.Worldbook.upsertManaged([{
      title: MARK_VERSION, content: JSON.stringify({ v: mf.version, titles: newTitles }), enabled: false
    }]);
    return { applied: (res.updated + res.created + deleted) > 0, updated: res.updated, created: res.created, deleted: deleted, from: prev.v, to: mf.version };
  }

  // ─────────────────────────────────────────────
  // 二期：角色卡字段同步（白名单：开场白组 first_mes+alternate_greetings / 作者名 / 版本号）
  //
  // 【纪律】只写白名单字段；其他插件挂在 data.extensions 下的数据永不触碰。
  // 主权与世界书统一为「作者赢」：清单值 ≠ 本地值就照清单覆盖。
  // 开场白整组处理（first_mes + alternate_greetings 一起比对一起换）：
  //   作者增/删/改开场白都只是「新数组≠旧数组」，一次覆盖全部到位。
  // ─────────────────────────────────────────────
  var CARD_GROUPS = [
    { key: 'greetings', label: '开场白', fields: ['first_mes', 'alternate_greetings'] },
    { key: 'creator', label: '作者名' },
    { key: 'character_version', label: '版本号' }
  ];

  // 确定性哈希：键排序的稳定串化 + djb2。字符串统一 \r\n→\n（ST 读写可能归一化换行，
  // 不归一化会出现「永远有差异」的假象）。
  function stableStringify(v) {
    if (typeof v === 'string') return JSON.stringify(v.replace(/\r\n/g, '\n'));
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    var keys = Object.keys(v).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + stableStringify(v[k]); }).join(',') + '}';
  }
  function stableHash(v) {
    var s = stableStringify(v), h = 5381;
    for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  // 清单里这组的远端值（没带这组返回 undefined = 不管）
  function groupRemote(card, g) {
    var f = card.fields || {};
    if (g.fields) {
      if (f.first_mes === undefined && f.alternate_greetings === undefined) return undefined;
      return { first_mes: f.first_mes, alternate_greetings: f.alternate_greetings };
    }
    return f[g.key];
  }

  // 纯函数（测试直调）：比对清单卡字段 vs 本地值，有差异即进计划（作者赢，无基线概念）。
  // getField(key) 取本地当前值。返回 {planned:[{key,label,value}], unchanged}。
  function planCardUpdates(card, getField) {
    var planned = [], unchanged = 0;
    CARD_GROUPS.forEach(function (g) {
      var remote = groupRemote(card, g);
      if (remote === undefined) return;
      if (stableHash(getField(g.key)) === stableHash(remote)) { unchanged++; return; }
      planned.push({ key: g.key, label: g.label, value: remote });
    });
    return { planned: planned, unchanged: unchanged };
  }

  // 卡上下文：沙盒原生注入优先，父页 getContext 兜底（与 engine.openingCtx 同套）
  function cardCtx() {
    try { if (typeof SillyTavern !== 'undefined' && SillyTavern && SillyTavern.characters) return SillyTavern; } catch (e) {}
    try {
      var st = window.parent && window.parent.SillyTavern;
      var c = st && st.getContext && st.getContext();
      if (c && c.characters) return c;
    } catch (e) {}
    return null;
  }

  // 本地取值适配器：v2 卡字段可能在顶层也可能在 data 镜像下，两处都读（data 优先）
  function cardFieldGetter(ch) {
    var d = ch.data || {};
    return function (key) {
      if (key === 'greetings') {
        return {
          first_mes: d.first_mes !== undefined ? d.first_mes : ch.first_mes,
          alternate_greetings: d.alternate_greetings !== undefined ? d.alternate_greetings : ch.alternate_greetings
        };
      }
      return d[key] !== undefined ? d[key] : ch[key];
    };
  }

  // 组装 merge-attributes 请求体：顶层+data 镜像都写（ST 两个位置都读），
  // data 只带白名单字段——deepMerge 递归合对象，extensions 里其他插件的键不受影响。
  function buildCardUpdate(avatar, planned) {
    var up = { avatar: avatar, data: {} };
    planned.forEach(function (p) {
      if (p.key === 'greetings') {
        var v = p.value;
        if (v.first_mes !== undefined) { up.first_mes = v.first_mes; up.data.first_mes = v.first_mes; }
        if (v.alternate_greetings !== undefined) { up.alternate_greetings = v.alternate_greetings; up.data.alternate_greetings = v.alternate_greetings; }
      } else {
        up[p.key] = p.value; up.data[p.key] = p.value;
      }
    });
    return up;
  }

  // 写成功后让酒馆重读盘并广播（对齐 ST 自己的编辑流程：/edit 后 getOneCharacter 整只替换
  // + CHARACTER_EDITED 事件。不这么做，内存/磁盘虽对，但角色列表等监听者不知道卡变了）。
  // 重读失败则退化为手补内存对象。
  async function reloadCardFromDisk(ctx, ch, planned) {
    var done = false;
    try {
      var r = await postJson('/api/characters/get', { avatar_url: ch.avatar });
      if (r && r.ok) {
        var fresh = await r.json();
        var arr = ctx.characters;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] && arr[i].avatar === ch.avatar) { arr[i] = fresh; done = true; break; }
        }
      }
    } catch (e) {}
    if (!done) refreshCardMemory(ch, planned);
    try {
      var p = window.parent;
      var es = (typeof eventSource !== 'undefined') ? eventSource : (p && p.eventSource);
      var et = (typeof event_types !== 'undefined') ? event_types : (p && p.event_types);
      if (es && et && et.CHARACTER_EDITED) es.emit(et.CHARACTER_EDITED, { detail: { id: ctx.characterId != null ? ctx.characterId : ctx.this_chid } });
    } catch (e) {}
    // 面板刷新：角色编辑器是「打开时快照」，CHARACTER_EDITED 只有 PromptManager 在听，
    // 开着的面板不会自己重填。重选当前角色（switchMenu:false 不弹菜单、不切聊天），
    // 走 ST 自己的 select_selected_character 从新数据重填全部字段（版本号同理）。
    try {
      var stx = (typeof SillyTavern !== 'undefined' && SillyTavern && SillyTavern.getContext) ? SillyTavern.getContext()
        : (p && p.SillyTavern && p.SillyTavern.getContext && p.SillyTavern.getContext());
      var cid = ctx.characterId != null ? ctx.characterId : ctx.this_chid;
      if (stx && stx.selectCharacterById && cid != null) stx.selectCharacterById(String(cid), { switchMenu: false });
    } catch (e) {}
  }

  // 兜底：重读盘失败时手补内存里的卡对象
  function refreshCardMemory(ch, planned) {
    var d = ch.data = ch.data || {};
    planned.forEach(function (p) {
      if (p.key === 'greetings') {
        if (p.value.first_mes !== undefined) { ch.first_mes = p.value.first_mes; d.first_mes = p.value.first_mes; }
        if (p.value.alternate_greetings !== undefined) { ch.alternate_greetings = p.value.alternate_greetings; d.alternate_greetings = p.value.alternate_greetings; }
      } else { ch[p.key] = p.value; d[p.key] = p.value; }
    });
  }

  var csrfToken = null;
  async function postJson(url, body, ms) {
    if (!csrfToken) {
      try {
        var r0 = await timedFetch('/csrf-token', 5000);
        if (r0.ok) csrfToken = (await r0.json()).token;
      } catch (e) {}
    }
    var headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 15000) : null;
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // 卡同步主流程：差异驱动（不看清单版本号——版本号归世界书），失败静默。
  async function applyCard(mf) {
    var card = mf && mf.card;
    if (!card || typeof card !== 'object') return { applied: false, reason: '清单无卡字段' };

    var ctx = cardCtx();
    var ch = ctx && ctx.characters && ctx.characters[ctx.characterId != null ? ctx.characterId : ctx.this_chid];
    if (!ch || !ch.avatar) return { applied: false, reason: '未打开角色卡' };

    var plan = planCardUpdates(card, cardFieldGetter(ch));
    var labels = plan.planned.map(function (p) { return p.label; });

    if (!plan.planned.length) return { applied: false, reason: '卡字段无差异' };

    // 静默直写（作者赢，与世界书同待遇）；toast 由 run() 统一发，这里只记日志
    try {
      var up = buildCardUpdate(ch.avatar, plan.planned);
      var r = await postJson('/api/characters/merge-attributes', up);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await reloadCardFromDisk(ctx, ch, plan.planned);
      log('角色卡已更新：' + labels.join('、'));
      return { applied: true, labels: labels };
    } catch (e) {
      log('卡字段写入失败：' + (e && e.message || e) + '（本地内容不变，下次打开重试）');
      return { applied: false, reason: '写入失败' };
    }
  }

  var SYNC_KEY = 'lzw-sync';   // 'off' = 用户关了自动更新；缺省/其他 = 开
  var Sync = {
    semverLTE: semverLTE,
    apply: apply,
    parseVersionEntry: parseVersionEntry,
    // 二期卡同步（planCardUpdates/stableHash/buildCardUpdate 是纯函数，测试直调）
    planCardUpdates: planCardUpdates,
    stableHash: stableHash,
    buildCardUpdate: buildCardUpdate,
    applyCard: applyCard,
    // 自动更新总开关（默认开；设置屏「设定自动更新」写入）
    syncEnabled: function () {
      try { return localStorage.getItem(SYNC_KEY) !== 'off'; } catch (e) { return true; }
    },
    setSyncEnabled: function (on) {
      try { if (on === false) localStorage.setItem(SYNC_KEY, 'off'); else localStorage.removeItem(SYNC_KEY); } catch (e) {}
    },
    // manual=true：设置屏「立刻检查更新」——强制跑一轮且必有反馈；关闭状态下也可用（兜底恢复通道）
    run: async function (manual) {
      try {
        if (!Sync.syncEnabled() && !manual) { log('自动更新已关，跳过'); return; }
        var mf = await fetchManifest();
        if (!mf) {
          log('清单拉取失败，跳过（本地内容不变）');
          if (manual) { try { toastr.warning('检查更新失败：网络异常，稍后再试', '📱 霖州引擎'); } catch (e) {} }
          return;
        }
        // minPlugin 门槛不过 = 清单格式可能比本插件新（比如带了二期卡字段），不能碰
        if (!semverLTE(mf.minPlugin || '0.0.0', window.LZWorld.VERSION)) {
          log('清单要求插件≥' + mf.minPlugin + '（当前 ' + window.LZWorld.VERSION + '），等插件追上');
          if (manual) { try { toastr.warning('清单要求更新版本的插件，请先更新插件', '📱 霖州引擎'); } catch (e) {} }
          return;
        }
        var r = await apply(mf);
        if (r.reason) log(r.reason);
        var cr = null;
        if (mf.card) {
          try { cr = await applyCard(mf); } catch (e) { log('卡同步异常：' + (e && e.message || e)); }
        }
        // 统一报告：两端差异驱动，任何一处有实际变化 → 一条常驻 toast 说完，点一下即关（不自动消失）；
        // 全无变化 → 自动模式完全静默；手动模式报「已是最新」给用户一个交代
        var parts = [];
        if (r.applied) {
          var wb = [];
          if (r.updated) wb.push('更新' + r.updated + '条');
          if (r.created) wb.push('新增' + r.created + '条');
          if (r.deleted) wb.push('清理' + r.deleted + '条');
          parts.push('世界书' + wb.join('·'));
          log('清单 v' + r.from + ' → v' + r.to);
        }
        if (cr && cr.applied) parts.push('角色卡：' + cr.labels.join('、'));
        if (parts.length) {
          var msg = '设定已同步：' + parts.join('；');
          log(msg);
          try { toastr.success(msg, '📱 霖州引擎', { timeOut: 0, extendedTimeOut: 0, closeButton: false, tapToDismiss: true }); } catch (e) {}
        } else {
          log('无差异，无需更新');
          if (manual) { try { toastr.info('已是最新，无需更新', '📱 霖州引擎'); } catch (e) {} }
        }
      } catch (e) {
        log('同步异常：' + (e && e.message || e));
        if (manual) { try { toastr.warning('检查更新失败，稍后再试', '📱 霖州引擎'); } catch (e2) {} }
      }
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Sync = Sync;
})();
