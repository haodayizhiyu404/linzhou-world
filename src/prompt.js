// ═══════════════════════════════════════════════════════════
//  prompt.js —— 数字世界引擎 · 提示词装配（v0，待实测迭代）
//
//  框架：AI 不是"扮演角色"，而是数字生活世界的模拟引擎。
//  引擎不认角色，只认「应用 + 实体 + 资料」——
//  微信私聊/群聊/未来的论坛，都只是不同的资料与输出契约。
//
//  ⚠ 本文件的措辞为 v0 初稿，用户已确认需后续打磨。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var PLOT_FLOORS = 8;     // 主线带几楼
  var PLOT_CAP = 900;      // 每楼正文上限（验尸结论：低于此 ≈ 失明）
  var HIST_PRIVATE = 14;   // 私聊带回几条
  var HIST_GROUP = 18;     // 群聊带回几条

  // ── 主线近貌：最近 N 楼，去 HTML/代码块/思考块，每楼截断 ──
  function mainContext() {
    try {
      var msgs = getChatMessages('0-{{lastMessageId}}');
      if (!msgs || !msgs.length) return '';
      return msgs.slice(-PLOT_FLOORS).map(function (m) {
        var t = String((m && m.message) || '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        if (t.length > PLOT_CAP) t = t.substring(0, PLOT_CAP) + '…';
        return (m.role === 'user' ? '{{user}}' : '旁白') + '：' + t;
      }).filter(function (l) { return l.length > 4; }).join('\n');
    } catch (e) { return ''; }
  }

  // ── 应用内记录文本 ──
  function histText(hist, n) {
    return hist.slice(-n).map(function (m) {
      var who = m.who === 'user' ? '{{user}}' : m.who;
      var body = m.kind === 'text' ? m.text : '[' + m.kind + ':' + m.text + ']';
      return who + '：' + body;
    }).join('\n');
  }

  // ── 消息类型语法说明（输出契约的一部分） ──
  function typeSyntax(stickerNames) {
    var stickerLine = (stickerNames && stickerNames.length)
      ? '[表情:名字]  只可选用图库现有名字，严禁编造：' + stickerNames.join('、')
      : '[表情:名字]  图库为空，本次请勿发送表情';
    return [
      '消息类型（按需单独成行，不用则不写）：',
      stickerLine,
      '[语音:要说的话]',
      '[图片:画面描述]',
      '[戳一戳]',
      '[定位:地点名]'
    ].join('\n');
  }

  // ── 一致性铁律（防开天眼） ──
  function consistencyRules(entityDesc) {
    return [
      '【一致性铁律】',
      '- ' + entityDesc + '只知道两类事：①本人在场亲眼所见、亲耳所闻；②对方在本应用内明确告诉它的。',
      '- 下列内容一律不知：主线中没有本人出场的段落、其他私聊、其他群聊、对方此刻在哪里/在干什么/穿着什么、任何人的心声。',
      '- 想谈主线里的事但本人不在场？只能用"听说/你今天怎么样"这类不确定方式开口，不得说出细节。',
      '- 宁可少说，不可全知。违反即出戏。'
    ].join('\n');
  }

  function situationBlock(snapshot) {
    var lines = [];
    if (snapshot && snapshot.time) {
      var when = snapshot.dateText ? snapshot.dateText + ' ' + snapshot.time : snapshot.time;
      lines.push('当前时间：' + when);
    }
    if (snapshot && snapshot.userPlace) {
      lines.push('（对方此刻在：' + snapshot.userPlace + '——仅作参考，不代表你的位置）');
    }
    if (snapshot && snapshot.npc) {
      var bits = [];
      if (snapshot.npc.place) bits.push('位置：' + snapshot.npc.place);
      if (snapshot.npc.posture) bits.push('姿态：' + snapshot.npc.posture);
      if (bits.length) lines.push('你（实体）此刻：' + bits.join('，'));
    }
    return lines.join('\n');
  }

  var Prompt = {

    // ── 私聊 ──
    private: function (contact, hist, snapshot, stickerNames) {
      var p = [
        '【数字世界 · 回应生成】',
        '你是数字生活世界的模拟引擎。本次任务：生成应用「微信」中，来自「' + contact.name + '」的新消息。',
        '',
        contact.profile ? '【实体资料】\n' + contact.profile : '【实体资料】（暂无档案，依据对话上下文自然演绎）',
        '',
        situationBlock(snapshot) ? '【情境】\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '【主线近貌】（仅作背景，上面的铁律优先）\n' + mainContext() : '',
        '',
        '【应用内记录 · 与{{user}}的微信聊天】（最贴近当前，优先承接这里的话题与语气）',
        histText(hist, HIST_PRIVATE),
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        '【输出契约】',
        '- 只输出「' + contact.name + '」发出的新消息，1~4 条，按情绪与话题自然增减',
        '- 每条独立成行，只写消息内容；无前缀、无时间戳、无动作旁白、无括号心理',
        '- 每条不超过 35 字，像真人打字，不复述对方的话',
        typeSyntax(stickerNames),
        '- 直接输出消息本身，严禁以"好的""收到"等寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: '（现在轮到「' + contact.name + '」回复{{user}}在微信里发来的消息。严格按上方输出契约，只输出消息本身。）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 群聊 ──
    group: function (group, members, hist, snapshot, stickerNames) {
      var nameList = members.map(function (m) { return m.name; });
      var voices = members.map(function (m) {
        var brief = m.profile ? String(m.profile).replace(/\s+/g, ' ').slice(0, 500) : '（无档案）';
        return '· ' + m.name + '：' + brief;
      });

      var p = [
        '【数字世界 · 回应生成】',
        '你是数字生活世界的模拟引擎。本次任务：生成应用「微信」的群「' + group.name + '」中发来的新消息。',
        '',
        '【群成员】' + nameList.join('、') + '、{{user}}' + (group.open ? '，以及若干未列名的路人（可让其冒泡，用真实昵称）' : ''),
        '',
        '【成员资料】',
        voices.join('\n'),
        '',
        situationBlock(snapshot) ? '【情境】\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '【主线近貌】（仅作背景，铁律优先）\n' + mainContext() : '',
        '',
        '【应用内记录 · 群「' + group.name + '」】（最贴近当前，优先承接这里的话题与语气）',
        histText(hist, HIST_GROUP),
        '',
        consistencyRules('每个群成员各自') + '\n- 输出多行时，每行开头必须是「成员名：」，各自独立判断是否知情。',
        '',
        '【输出契约】',
        '- 输出 3~8 条群消息，每条一行，格式严格为「成员名：消息」',
        '- 谁会接这句谁说，不必人人开口；可互相接梗拆台',
        '- 每条不超过 35 字，口语',
        typeSyntax(stickerNames),
        '- 直接输出消息，严禁寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: '（现在轮到群「' + group.name + '」里的成员们继续聊天。严格按上方输出契约，只输出群消息本身。）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Prompt = Prompt;
})();
