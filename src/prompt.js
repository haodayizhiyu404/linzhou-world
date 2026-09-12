// ═══════════════════════════════════════════════════════════
//  prompt.js —— 数字世界引擎 · 提示词装配
//
//  框架：AI 不是"扮演角色"，而是数字生活应用的模拟引擎。
//  引擎不认角色，只认「应用 + 人 + 资料」——
//  微信私聊/群聊/未来的论坛，都只是不同的资料与输出要求。
//
//  ⚠ 提示词不走酒馆宏替换（generateRaw 独立生成），
//    {{user}} 必须在装配时换成 persona 真名，见 me()。
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var PLOT_FLOORS = 8;     // 主线带几楼
  var PLOT_CAP = 900;      // 每楼正文上限（验尸结论：低于此 ≈ 失明）
  var HIST_PRIVATE = 50;   // 私聊带回几条（短聊天内容很少，50 条也才角色卡资料的零头）
  var HIST_GROUP = 50;     // 群聊带回几条

  // ── persona 真名。generateRaw 不做宏替换，{{user}} 会原文进提示词，
  //    所以这里自己解析（与 engine.js userName() 同一套回退）。──
  function me() {
    try {
      var W = window.LZWorld;
      if (W && W.Engine && W.Engine.userName) {
        var n = W.Engine.userName();
        if (n && n !== '我') return n;
      }
    } catch (e) {}
    try {
      var st = window.parent.SillyTavern;
      var ctx = st && st.getContext && st.getContext();
      if (ctx && ctx.name1) return String(ctx.name1);
    } catch (e) {}
    return '我';
  }

  // ── 主线近况：最近 N 楼，去 HTML/代码块/思考块，每楼截断 ──
  function mainContext() {
    try {
      var msgs = getChatMessages('0-{{lastMessageId}}');
      if (!msgs || !msgs.length) return '';
      return msgs.slice(-PLOT_FLOORS).map(function (m) {
        var t = String((m && m.message) || '')
          // 状态栏是机器可读的元数据（时间/着装/心声等），已由「当前情境」按需引用，
          // 这里整段剔除——只剥标签会留下无主的「着装：…」碎片，严重干扰模型
          .replace(/<status>[\s\S]*?<\/status>/gi, '')
          // 旧版写进主楼层的手机记录块一并剔除（手机历史在「聊天记录」节单独给出）
          .replace(/\[📱[\s\S]*?\/\📱\]\s*/g, '')
          // 思维链：think 与 cot 两种标签都剥（后者见于部分前端/预设的推理输出）
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .replace(/<cot>[\s\S]*?<\/cot>/gi, '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        // 截断尽量落在行边界，避免半句话/半个词糊在切口上
        if (t.length > PLOT_CAP) {
          var cut = t.lastIndexOf('\n', PLOT_CAP);
          if (cut < PLOT_CAP * 0.5) cut = t.lastIndexOf('。', PLOT_CAP);
          if (cut < PLOT_CAP * 0.5) cut = PLOT_CAP;
          t = t.substring(0, cut) + '……（此楼后续从略）';
        }
        return (m.role === 'user' ? me() : '旁白') + '：' + t;
      }).filter(function (l) { return l.length > 4; }).join('\n');
    } catch (e) { return ''; }
  }
  // ── 单条消息 → 契约语法文本（与「消息类型」说明完全一致，AI 不用猜） ──
  function msgBody(m) {
    switch (m.kind) {
      case 'sticker':  return '[表情:' + m.text + ']';
      case 'voice':    return '[语音:' + m.text + ']';
      case 'image':    return '[图片:' + m.text + ']';
      case 'poke':     return '[戳一戳]';
      case 'location': return '[定位:' + m.text + ']';
      default:         return String(m.text || '');
    }
  }

  // ── 应用内聊天记录文本（发言人用真名，不再出现 {{user}}） ──
  // 消息带 day（状态栏日期文本）时，跨天插入 [昨天 22:10] 这类时间标
  function parseDay(s) {
    var m = /(\d+)年(\d+)月(\d+)日/.exec(s || '');
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  }
  function dayNum(p) { return p.y * 372 + p.mo * 31 + p.d; }
  function relDay(day, cur) {
    var a = parseDay(day), b = parseDay(cur);
    if (!a) return day;
    if (!b) return a.mo + '月' + a.d + '日';
    var diff = dayNum(b) - dayNum(a);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return (a.y !== b.y ? a.y + '年' : '') + a.mo + '月' + a.d + '日';
  }
  function histText(hist, n, withNames, curDay) {
    var out = [];
    var prevDay = null;
    hist.slice(-n).forEach(function (m) {
      if (m.day && m.day !== prevDay) {
        out.push('[' + relDay(m.day, curDay) + (m.time ? ' ' + m.time : '') + ']');
        prevDay = m.day;
      }
      var body = msgBody(m);
      if (m.recalled) body += '（此条已撤回）';
      if (!withNames) { out.push(body); return; }
      var who = m.who === 'user' ? me() : m.who;
      out.push(who + '：' + body);
    });
    return out.join('\n');
  }

  // ── 消息类型语法说明（输出要求的一部分） ──
  function typeSyntax(stickerNames) {
    var stickerLine = (stickerNames && stickerNames.length)
      ? '- [表情:名字]  只可选用图库现有名字，严禁编造：' + stickerNames.join('、')
      : '- [表情:名字]  图库为空，本次请勿发送表情';
    return [
      '消息类型（按需单独成行，不用则不写）：',
      stickerLine,
      '- [语音:要说的话]',
      '- [图片:画面描述]',
      '- [戳一戳]',
      '- [定位:地点名]',
      '- [撤回]  单独成行：撤回自己刚发的上一条消息（打错字、冲动后悔时用，罕用）'
    ].join('\n');
  }

  // ── 一致性规则（防开天眼） ──
  function consistencyRules(entityDesc) {
    return [
      '## 一致性规则',
      '- ' + entityDesc + '只知道两类事：①本人亲眼所见、亲耳所闻的；②对方在微信里明确告诉本人的。',
      '- 以下一律不知：主线中没有本人出场的段落、其他私聊、其他群聊、对方此刻在哪里/在干什么/穿着什么、任何人的内心想法。',
      '- 想谈本人不在场的事，只能用「听说……」「你今天怎么样」这类不确定的说法开口，不得讲出细节。',
      '- 宁可少说，不可全知。说漏即出戏。'
    ].join('\n');
  }

  function situationBlock(snapshot) {
    var lines = [];
    if (snapshot && snapshot.time) {
      var when = snapshot.dateText ? snapshot.dateText + ' ' + snapshot.time : snapshot.time;
      lines.push('当前时间：' + when);
    }
    if (snapshot && snapshot.userPlace) {
      lines.push(me() + '此刻在：' + snapshot.userPlace + '（仅作参考，不代表你的位置）');
    }
    if (snapshot && snapshot.npc) {
      var bits = [];
      if (snapshot.npc.place) bits.push('位置：' + snapshot.npc.place);
      if (snapshot.npc.posture) bits.push('姿态：' + snapshot.npc.posture);
      if (bits.length) lines.push('你（' + (snapshot.npc.name || '本人') + '）此刻：' + bits.join('，'));
      // 关系项：卡面状态栏固定维护（如「克制内敛的青梅竹马，尚未告白」）。
      // 它是防情感越界出戏的主锚点，必须显式给出并划定表达上限。
      if (snapshot.npc.relation) {
        lines.push('你与' + me() + '的关系：' + snapshot.npc.relation + '——一切情感表达不得越过这个阶段');
      }
    }
    if (snapshot && snapshot.overview) {
      lines.push('人物关系总览：' + snapshot.overview);
    }
    return lines.join('\n');
  }

  var Prompt = {

    // ── 私聊 ──
    // tail = 本轮最新一批用户消息：不混在系统块里，作为最后的 user 轮单独给出
    // userInfo = 机主资料（persona 描述 + 当前线演化层），所有会话统一带上
    // crossGroups = 对方在的群当天记录尾巴（群→私聊跨会话上下文；对方在场，与防开天眼自洽）
    private: function (contact, hist, snapshot, stickerNames, tail, digest, userInfo, crossGroups) {
      var myName = me();
      var tailLines = (tail && tail.length) ? histText(tail, 8, false) : '';
      var p = [
        '# 数字世界 · 回应生成',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成应用「微信」里，来自「' + contact.name + '」的新消息。',
        '',
        contact.profile ? '## 人物档案 · ' + contact.name + '\n' + contact.profile : '## 人物档案 · ' + contact.name + '\n（暂无档案，依据对话上下文自然演绎）',
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n（微信这头的人，与「' + contact.name + '」对话的主角）\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        '## 聊天记录 · 与' + myName + '的微信对话',
        '（优先承接这里的话题与语气；' + myName + '本轮发来的最新消息在末尾单独给出）',
        digest ? '（更早的记录已折叠为提要，供接续话题与承诺用：' + digest + '）' : '',
        histText(hist, HIST_PRIVATE, true, snapshot && snapshot.dateText),
        '',
        (crossGroups && crossGroups.length)
          ? '## 相关群聊近况（下列记录中对方本人均在场，可自由承接其中的话题、情绪与玩笑）\n' + crossGroups.map(function (g) {
              return '群「' + g.name + '」今日的记录：\n' + histText(g.hist, 20, true, snapshot && snapshot.dateText);
            }).join('\n\n')
          : '',
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        '## 输出要求',
        '- 只输出「' + contact.name + '」发来的新消息，1~5 条，按情绪与话题自然增减，必要时可超出（如情绪激动）',
        '- 每条独立成行，只写消息内容；不要前缀、时间戳、动作描写、括号心理',
        '- 每条不超过 35 字，像真人打字，不重复对方刚说过的话',
        '- 「' + contact.name + '」的情感与态度必须符合上方「关系」所述阶段，遵循人设和关系进度双重约束，输出最符合的人物聊天反馈信息',
        typeSyntax(stickerNames),
        '- 直接输出消息本身，不要以「好的」「收到」这类寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          {
            role: 'user',
            content: tailLines
              ? '（' + myName + '刚在微信里发来以下消息。请严格按上方输出要求，只输出「' + contact.name + '」的新消息本身。）\n' + tailLines
              : '（现在轮到「' + contact.name + '」回复' + myName + '。请严格按上方输出要求，只输出消息本身。）'
          }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 通话邀请：机主拨打了语音/视频通话，AI 决定接/拒 ──
    // 约定：拒绝 → 第一行以 [拒绝] 开头，可附一句简短说明；接听 → 直接输出接通后的
    // 第一句话（口语台词，不要引号/动作/括号）。呼叫页等待期间的一次生成。
    callInvite: function (contact, snapshot, userInfo, mode, crossGroups) {
      var myName = me();
      var kind = mode === 'video' ? '视频通话' : '语音通话';
      var p = [
        '# 数字世界 · ' + kind + '邀请',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：机主「' + myName + '」给「' + contact.name + '」发起了' + kind + '，生成对方的反应。',
        '',
        contact.profile ? '## 人物档案 · ' + contact.name + '\n' + contact.profile : '',
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        (crossGroups && crossGroups.length)
          ? '## 相关群聊近况（下列记录中对方本人均在场）\n' + crossGroups.map(function (g) {
              return '群「' + g.name + '」今日的记录：\n' + histText(g.hist, 20, true, snapshot && snapshot.dateText);
            }).join('\n\n')
          : '',
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        '## 输出要求（严格遵守，二选一）',
        '- 接听：直接输出接通后的第一句话，1~3 行口语台词，像真人打电话的开场',
        '- 拒绝：第一行以 [拒绝] 开头，其后可附一句简短说明（如「在忙，晚点回」），也可不附',
        '- 不得输出引号、动作描写、心理括号、时间戳',
        '- 决定须符合上方「关系」阶段与当前情境（深夜/工作时间/在群里刚聊过等）'
      ].filter(function (s2) { return s2 !== ''; }).join('\n');
      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: '（' + myName + '的' + kind + '正在呼叫' + contact.name + '。请按输出要求生成对方的反应。）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 通话轮：通话进行中，机主说了一句（或要求接续），生成对方台词 ──
    // transcript = 「名字：…/机主：…」台词行；userSays = 机主本轮说的话（可空）
    callTurn: function (contact, transcript, snapshot, userInfo, mode, crossGroups, userSays) {
      var myName = me();
      var kind = mode === 'video' ? '视频通话' : '语音通话';
      var p = [
        '# 数字世界 · ' + kind + '进行中的台词',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成' + kind + '中「' + contact.name + '」接下来的台词。',
        '',
        contact.profile ? '## 人物档案 · ' + contact.name + '\n' + contact.profile : '',
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        (crossGroups && crossGroups.length)
          ? '## 相关群聊近况（下列记录中对方本人均在场，可自然提及）\n' + crossGroups.map(function (g) {
              return '群「' + g.name + '」今日的记录：\n' + histText(g.hist, 20, true, snapshot && snapshot.dateText);
            }).join('\n\n')
          : '',
        '',
        '## 通话记录（' + kind + ' · 双方已说的话）',
        transcript || '（刚接通）',
        '',
        consistencyRules('「' + contact.name + '」'),
        '',
        '## 输出要求',
        '- 只输出「' + contact.name + '」的台词，1~5 行，按情绪与话题自然增减（激动时可更多）',
        '- 口语化，像真人打电话：短句、停顿感、可有语气词；不要书面腔',
        '- 每行独立，不要引号、动作描写、心理括号、时间戳',
        '- 情感与态度符合上方「关系」阶段；吵架、撒娇、汇报都按当前关系该有度',
        '- 不要复述机主刚说的话'
      ].filter(function (s2) { return s2 !== ''; }).join('\n');
      return {
        ordered_prompts: [
          { role: 'system', content: p },
          { role: 'user', content: userSays
              ? '（' + myName + '在' + kind + '里说：「' + userSays + '」。请生成「' + contact.name + '」的台词。）'
              : '（' + kind + '沉默了几秒。请生成「' + contact.name + '」接下来的台词。）' }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    },

    // ── 群聊 ──
    // userInfo = 机主资料，与私聊同一份
    // crossPriv = {成员名: 当天私聊尾巴}（私聊→群跨会话上下文；挂到该成员档案下，※ 仅本人知晓）
    group: function (group, members, hist, snapshot, stickerNames, tail, digest, userInfo, crossPriv) {
      var myName = me();
      var tailLines2 = (tail && tail.length) ? histText(tail, 8, true) : '';
      var nameList = members.map(function (m) { return m.name; });
      var crowdTxt = Array.isArray(group.crowd) ? group.crowd.join('\n') : (group.crowd || '');
      var voices = members.map(function (m) {
        var brief = m.profile ? String(m.profile).trim() : '（无档案）';
        var priv = crossPriv && crossPriv[m.name];
        if (priv && priv.length) {
          brief += '\n※ 仅 ' + m.name + ' 本人知晓：机主今日与 ' + m.name + ' 的私聊——\n'
            + histText(priv, 15, true, snapshot && snapshot.dateText);
        }
        return '- ' + m.name + '：\n' + brief;
      });

      var p = [
        '# 数字世界 · 回应生成',
        '',
        '你是一款数字生活应用的模拟引擎。本次任务：生成应用「微信」的群「' + group.name + '」里新来的消息。',
        '',
        '## 群成员',
        (nameList.length ? nameList.join('、') + '、' + myName : myName) + (group.open ? '，以及若干未具名的其他成员（可让其冒泡，用真实昵称）' : ''),
        crowdTxt ? '其余成员设定：\n' + crowdTxt : '',
        group.style ? '群氛围：' + group.style : '',
        '',
        '## 成员档案',
        voices.join('\n'),
        '',
        userInfo ? '## 机主资料 · ' + myName + '\n（群里的人，群的实际使用者）\n' + userInfo : '',
        '',
        situationBlock(snapshot) ? '## 当前情境\n' + situationBlock(snapshot) : '',
        '',
        mainContext() ? '## 主线近况（只作背景，下方规则优先）\n' + mainContext() : '',
        '',
        '## 聊天记录 · 群「' + group.name + '」',
        '（优先承接这里的话题与语气；' + myName + '本轮发来的最新消息在末尾单独给出）',
        digest ? '（更早的记录已折叠为提要，供接续话题与承诺用：' + digest + '）' : '',
        histText(hist, HIST_GROUP, true, snapshot && snapshot.dateText),
        '',
        consistencyRules('每名成员各自')
          + '\n- 输出多行时，每行开头必须是「成员名：」，由各自独立判断自己是否知情。'
          + ((crossPriv && Object.keys(crossPriv).length)
              ? '\n- 成员档案内「※ 仅本人知晓」的私聊内容，其他成员引用一字即出戏；仅该成员本人可自然提及（包括调侃、阴阳怪气、翻旧账）。'
              : ''),
        '',
        '## 输出要求',
        '- 输出 3~8 条群消息，每条一行，格式严格为「成员名：消息」',
        '- 谁接得上这句谁说，不必人人开口；可以互相接梗、拆台',
        '- 每条不超过 35 字，口语',
        typeSyntax(stickerNames),
        '- 直接输出消息，不要以寒暄开头'
      ].filter(function (s) { return s !== ''; }).join('\n');

      return {
        ordered_prompts: [
          { role: 'system', content: p },
          {
            role: 'user',
            content: tailLines2
              ? '（' + myName + '刚在群「' + group.name + '」里发来以下消息。请严格按上方输出要求，只输出成员们的新消息本身。）\n' + tailLines2
              : '（现在轮到群「' + group.name + '」里的成员们继续聊天。请严格按上方输出要求，只输出群消息本身。）'
          }
        ],
        should_silence: true,
        max_chat_history: 0
      };
    }
  };

  window.LZWorld = window.LZWorld || {};
  window.LZWorld.Prompt = Prompt;
})();
