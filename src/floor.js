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
    var who = m.who === 'user' ? userName : m.who;
    var body;
    switch (m.kind) {
      case 'sticker': body = '[表情:' + m.text + ']'; break;
      case 'voice':   body = '[语音:' + m.text + ']'; break;
      case 'image':   body = '[图片:' + m.text + ']'; break;
      case 'poke':    body = '[戳一戳]'; break;
      case 'location':body = '[定位:' + m.text + ']'; break;
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
      var isUser = who === userName;
      var avatar = '';
      if (isUser) {
        avatar = '<div class="lzw-ava lzw-ava-me">' + esc(who.slice(0, 1)) + '</div>';
      } else {
        var c = W.Engine && W.Engine.findContact(who);
        avatar = c && c.avatar
          ? '<img class="lzw-ava" src="' + esc(W.Worldbook.imgUrl(c.avatar)) + '" alt="">'
          : '<div class="lzw-ava">' + esc(who.slice(0, 1)) + '</div>';
      }

      var bub;
      var typed = content.match(/^\[(表情|语音|图片|戳一戳|定位)(?::|\||｜)([\s\S]*)\]$/);
      if (typed) {
        var kind = typed[1], arg = (typed[2] || '').trim();
        if (kind === '表情') {
          var file = stickers[arg];
          bub = file
            ? '<img class="lzw-sticker" src="' + esc(W.Worldbook.imgUrl(file)) + '" alt="' + esc(arg) + '" title="' + esc(arg) + '">'
            : '<div class="lzw-bub">[表情:' + esc(arg) + ']</div>';
        } else if (kind === '戳一戳') {
          bub = '<div class="lzw-bub lzw-sys">戳了戳' + (isUser ? '对方' : esc(who)) + '</div>';
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

      rows.push(
        '<div class="lzw-row' + (isUser ? ' lzw-row-me' : '') + '">' +
        (isUser ? bub + avatar : avatar + bub) +
        '<div class="lzw-who">' + esc(who) + '</div></div>'
      );
    });

    return '<div class="lzw-record">' +
      '<div class="lzw-record-head">📱 ' + esc(title) + '</div>' +
      rows.join('') +
      '</div>';
  }

  // ── 主页面 DOM 操作 ──
  function pdoc() { return window.parent.document; }
  function p$() { return window.parent.$; }

  // 替换某一个楼层的文本为气泡（整块匹配才动，混合内容不碰）
  function renderMesText($mesText) {
    var raw = $mesText.text() || '';
    var m = raw.match(RECORD_RE);
    if (!m) return false;
    $mesText.html(renderRecordHtml(m[1].trim(), m[2]));
    return true;
  }

  var Floor = {
    formatRecord: formatRecord,
    msgToLine: msgToLine,
    RECORD_RE: RECORD_RE,

    // 插入一条记录楼层并渲染。title 如「与周言的私聊」「高三（2）班 群聊」
    insertRecord: async function (title, msgs, timeText) {
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
        var $mt = p$(pdoc()).find('#chat > .mes[mesid="' + mesid + '"] .mes_text').last();
        if ($mt.length) renderMesText($mt);
      } catch (e) { console.warn('[霖州引擎] 楼层渲染失败', e); }
      if (W.Store) W.Store.markRendered(mesid);
      return mesid;
    },

    // 全量扫描主聊天界面，把所有记录块渲染成气泡（幂等）
    renderAll: function () {
      try {
        p$(pdoc()).find('#chat .mes .mes_text').each(function () {
          renderMesText(p$(this));
        });
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
