// ═══════════════════════════════════════════════════════════
//  floor.js —— 楼层记录写入 + 主聊天界面气泡渲染
//
//  楼层记录格式（设计文档 §5.5，双方通用语法）：
//    [📱与周言的私聊 22:49]
//    persona名：在吗
//    周言：[表情:偷看]
//    [/📱]
//
//  写入：独立 system 楼层（整层楼只含此块），主 AI 可裸读。
//  渲染：整块替换为微信样式气泡（操作主页面 DOM，沙盒内经 parent.$）。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var RECORD_RE = /^\s*\[📱([\s\S]*?)\]\s*([\s\S]*?)\s*\[\/📱\]\s*$/;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── 消息 → 楼层行 ──
  function msgToLine(m, userName) {
    if (m.who === 'sys') return String(m.text || ''); // 系统条目（通话时长等）不带人名前缀
    var who = m.who === 'user' ? userName : m.who;
    var body;
    switch (m.kind) {
      case 'sticker': body = '[表情:' + m.text + ']'; break;
      case 'voice':   body = '[语音:' + m.text + ']'; break;
      case 'image':   body = '[图片:' + m.text + ']'; break;
      case 'poke':    body = '[戳一戳]'; break;
      case 'location':body = '[定位:' + m.text + ']'; break;
      // 视频通话的画面条目（跨行压成一行，带标记便于模型区分可见状态与台词）
      case 'scene':   body = '（画面：' + String(m.text || '').replace(/\n+/g, '　') + '）'; break;
      default:        body = String(m.text || '');
    }
    return who + '：' + body;
  }

  // ── 生成记录块文本 ──
  function formatRecord(title, msgs, timeText, userName) {
    var head = '[📱' + title + (timeText ? ' ' + timeText : '') + ']';
    var lines = msgs.map(function (m) { return msgToLine(m, userName); });
    return head + '\n' + lines.join('\n') + '\n[/📱]';
  }

  // ── 把记录块渲染成气泡 HTML ──
  function renderRecordHtml(title, bodyText) {
    var W = window.LZWorld;
    var userName = W.Engine ? W.Engine.userName() : '我';
    var stickers = (W.Engine && W.Engine.stickers()) || {};
    var lines = bodyText.split('\n').filter(function (l) { return l.trim(); });
    var rows = [];

    lines.forEach(function (line) {
      var m = line.match(/^([^：:]+)[：:]([\s\S]*)$/);
      if (!m) return;
      var who = m[1].trim();
      var content = m[2].trim();
      // 旧记录里 persona 名可能是当时的取值（如"我"），两种都认作用户
      var isUser = who === userName || who === '我';
      var avatar;
      if (isUser) {
        var uav = W.Engine && W.Engine.userAvatar();
        avatar = uav
          ? '<img class="lzw-ava lzw-ava-me" src="' + esc(uav) + '" alt="">'
          : '<div class="lzw-ava lzw-ava-me">' + esc(who.slice(0, 1)) + '</div>';
      } else {
        var c = W.Engine && W.Engine.findContact(who);
        avatar = c && c.avatar
          ? '<img class="lzw-ava" src="' + esc(W.Worldbook.imgUrl(c.avatar)) + '" alt="">'
          : '<div class="lzw-ava">' + esc(who.slice(0, 1)) + '</div>';
      }

      var bub;
      // 戳一戳单独成行：整行居中灰字，不带头像气泡
      if (content === '[戳一戳]') {
        rows.push('<div class="lzw-pokerow">' + (isUser ? '你戳了戳对方' : esc(who) + '戳了戳你') + '</div>');
        return;
      }
      var typed = content.match(/^\[(表情|语音|图片|戳一戳|定位)(?::|\||｜)([\s\S]*)\]$/);
      if (typed) {
        var kind = typed[1], arg = (typed[2] || '').trim();
        if (kind === '表情') {
          var file = stickers[arg];
          bub = file
            ? '<img class="lzw-sticker" src="' + esc(W.Worldbook.imgUrl(file)) + '" alt="' + esc(arg) + '" title="' + esc(arg) + '">'
            : '<div class="lzw-bub">[表情:' + esc(arg) + ']</div>';
        } else if (kind === '戳一戳') {
          bub = '<div class="lzw-bub lzw-sys">' + (isUser ? '你戳了戳对方' : esc(who) + '戳了戳你') + '</div>';
        } else if (kind === '语音') {
          bub = '<div class="lzw-bub lzw-voice"><span class="lzw-voice-ico">▶</span>' + esc(arg) + '</div>';
        } else if (kind === '图片') {
          bub = '<div class="lzw-bub lzw-img"><div class="lzw-img-ph">🖼</div><div class="lzw-img-cap">' + esc(arg) + '</div></div>';
        } else {
          bub = '<div class="lzw-bub lzw-sys">📍 ' + esc(arg) + '</div>';
        }
      } else {
        bub = '<div class="lzw-bub">' + esc(content) + '</div>';
      }

      // 头像列（头像+名字），气泡另起一列；me 行用 row-reverse 整体靠右
      rows.push(
        '<div class="lzw-row' + (isUser ? ' lzw-row-me' : '') + '">' +
        '<div><div class="lzw-ava-wrap">' + avatar + '</div><div class="lzw-who">' + esc(who) + '</div></div>' +
        bub +
        '</div>'
      );
    });

    return '<div class="lzw-record">' +
      '<div class="lzw-record-head">📱 ' + esc(title) + '</div>' +
      rows.join('') +
      '</div>';
  }

  // ── 主页面 DOM 操作（原生，不依赖 jQuery） ──
  function pdoc() { return window.parent.document; }

  // 楼层气泡样式（注进主页面；与手机内的类名同前缀，但只作用在 #chat 里）
  var FLOOR_CSS = [
    '#chat .lzw-record{padding:4px 0}',
    '#chat .lzw-record-head{text-align:center;font-size:12px;color:#8a8f99;margin:2px 0 8px}',
    '#chat .lzw-row{display:flex;gap:8px;margin:12px 0;align-items:flex-start}',
    '#chat .lzw-row.lzw-row-me{flex-direction:row-reverse}',
    '#chat .lzw-ava{width:36px;height:36px;border-radius:9px;flex:none;object-fit:cover;background:#c9cfd6;',
    'display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600}',
    '#chat .lzw-ava-me{background:#4d7cfe}',
    '#chat .lzw-who{width:36px;text-align:center;font-size:10px;color:#9aa0a8;margin-top:2px;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#chat .lzw-row>div{min-width:0}',
    '#chat .lzw-bub{max-width:65%;padding:8px 12px;border-radius:12px;background:#fff;color:#111;line-height:1.5;',
    'word-break:break-word;border:1px solid rgba(0,0,0,.06)}',
    '#chat .lzw-row-me .lzw-bub{background:#95ec69;border-color:transparent}',
    '#chat .lzw-bub.lzw-sys{background:transparent;border:none;color:#8a8f99;font-size:12px;padding:2px 4px;max-width:none}',
    '#chat .lzw-sticker{max-width:110px;border-radius:8px}',
    '#chat .lzw-voice-ico{color:#111;margin-right:6px;opacity:.6}',
    '#chat .lzw-img-ph{font-size:22px;text-align:center;padding:8px 0 4px}',
    '#chat .lzw-img-cap{font-size:12px;opacity:.75}',
    '#chat .lzw-pokerow{text-align:center;font-size:12px;color:#8a8f99;margin:10px 0}'
  ].join('\n');
  function ensureStyle() {
    try {
      var doc = pdoc();
      if (!doc.getElementById('lzw-floor-style')) {
        var st = doc.createElement('style');
        st.id = 'lzw-floor-style';
        st.textContent = FLOOR_CSS;
        doc.head.appendChild(st);
      }
    } catch (e) {}
  }

  // 替换某一个楼层的文本为气泡（整块匹配才动，混合内容不碰）
  function renderMesText(el) {
    var raw = el.textContent || '';
    var m = raw.match(RECORD_RE);
    if (!m) return false;
    ensureStyle();
    el.innerHTML = renderRecordHtml(m[1].trim(), m[2]);
    return true;
  }

  var Floor = {
    formatRecord: formatRecord,
    msgToLine: msgToLine,
    RECORD_RE: RECORD_RE,

    // 插入一条记录楼层并渲染。title 如「与周言的私聊」「高三（2）班 群聊」
    insertRecord: async function (title, msgs, timeText) {
      ensureStyle();
      var W = window.LZWorld;
      var userName = W.Engine.userName();
      var block = formatRecord(title, msgs, timeText, userName);

      var before = 0;
      try { before = getChatMessages('0-{{lastMessageId}}').length; } catch (e) {}

      await createChatMessages([{
        role: 'system',
        is_hidden: false,
        message: block
      }], { insert_before: 'end', refresh: 'affected' });

      var mesid = before; // 新楼层 id = 插入前长度
      try {
        var el = pdoc().querySelector('#chat > .mes[mesid="' + mesid + '"] .mes_text');
        if (el) renderMesText(el);
      } catch (e) { console.warn('[霖州引擎] 楼层渲染失败', e); }
      if (W.Store) W.Store.markRendered(mesid);
      return mesid;
    },

    // 全量扫描主聊天界面，把所有记录块渲染成气泡（幂等）
    renderAll: function () {
      try {
        var els = pdoc().querySelectorAll('#chat .mes .mes_text');
        for (var i = 0; i < els.length; i++) renderMesText(els[i]);
      } catch (e) { console.warn('[霖州引擎] 全量渲染失败', e); }
    },

    // NPC 原始输出 → 类型化消息数组（群聊行首带名字）
    parseNpcLines: function (rawText, defaultWho) {
      var out = [];
      String(rawText || '').split('\n').forEach(function (line) {
        line = line.trim();
        if (!line) return;
        var who = defaultWho, body = line;
        if (defaultWho === null) { // 群聊：行首必须是「名字：」
          var gm = line.match(/^([^：:]{1,12})[：:]([\s\S]+)$/);
          if (!gm) return;
          who = gm[1].trim(); body = gm[2].trim();
        }
        if (/^\[撤回\]$/.test(body)) { out.push({ who: who, kind: 'recall', text: '', time: '' }); return; }
        if (/^\[戳一戳\]$/.test(body)) { out.push({ who: who, kind: 'poke', text: '', time: '' }); return; }
        var typed = body.match(/^\[(表情|语音|图片|定位)(?::|\||｜)([\s\S]*)\]$/);
        if (typed) {
          var kindMap = { '表情': 'sticker', '语音': 'voice', '图片': 'image', '戳一戳': 'poke', '定位': 'location' };
          var kind = kindMap[typed[1]];
          var arg = (typed[2] || '').trim();
          if (kind === 'poke') { out.push({ who: who, kind: kind, text: '', time: '' }); return; }
          if (!arg) return;
          if (kind === 'sticker') {
            var real = window.LZWorld.Engine.resolveSticker(arg);
            if (!real) { out.push({ who: who, kind: 'text', text: '[表情:' + arg + ']', time: '' }); return; }
            arg = real;
          }
          out.push({ who: who, kind: kind, text: arg, time: '' });
          return;
        }
        // 普通文字行；寒暄废话与纯括号旁白丢弃
        if (/^(好的[，。！]?|收到|明白了|当然)/.test(body) && body.length < 8) return;
        if (/^[（(][^）)]{1,28}[）)]$/.test(body)) return;
        if (body.length > 120) body = body.slice(0, 120);
        out.push({ who: who, kind: 'text', text: body, time: '' });
      });
      return out.slice(0, 12);
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Floor = Floor;
})();
