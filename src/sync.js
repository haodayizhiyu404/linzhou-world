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

  var SYNC_KEY = 'lzw-sync';   // 'off' = 用户关了自动更新；缺省/其他 = 开
  var Sync = {
    semverLTE: semverLTE,
    apply: apply,
    parseVersionEntry: parseVersionEntry,
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
        // 任何一处有实际变化 → 一条常驻 toast 说完（点按即关）；无变化：自动静默，手动报「已是最新」
        if (r.applied) {
          var parts = [];
          if (r.updated) parts.push('更新' + r.updated + '条');
          if (r.created) parts.push('新增' + r.created + '条');
          if (r.deleted) parts.push('清理' + r.deleted + '条');
          var msg = '设定已同步：' + parts.join('·');
          log(msg + '（清单 v' + r.from + ' → v' + r.to + '）');
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
