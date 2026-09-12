// smoke.js —— 数据层离线冒烟测试（node test/smoke.js）
// 只测纯逻辑：状态栏解析 / 记录块往返 / NPC输出解析 / 提示词装配
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const __vars = {};
const ctx = {
  window: {},
  console,
  getChatMessages: () => global.__msgs || [],
  getVariables: () => __vars,
  replaceVariables: (v) => { const snap = JSON.parse(JSON.stringify(v)); for (const k of Object.keys(__vars)) delete __vars[k]; Object.assign(__vars, snap); },
};
vm.createContext(ctx);
for (const f of ['src/store.js', 'src/status.js', 'src/worldbook.js', 'src/prompt.js', 'src/floor.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const LW = ctx.window.LZWorld;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n    got  ' + g + '\n    want ' + w); }
}

// ── 1. 状态栏解析 ──
console.log('[状态栏]');
const statusText = `<status>

<环境>
2034年8月26日 星期五|22:49|天禧城3幢901室|阴
</环境>

<沈锡元>
着装：黑色圆领薄棉T
姿态：靠在车边单手夹烟
位置：霖州城南门外
关系：克制内敛的青梅竹马，尚未告白
心声：“到了也不放个屁。”
</沈锡元>

</status>`;
const p = LW._parseStatusBlock(statusText);
eq('时间', p.time, '22:49');
eq('日期文本', p.dateText, '2034年8月26日 星期五');
eq('user地点', p.userPlace, '天禧城3幢901室');
eq('NPC位置', p.characters['沈锡元'].place, '霖州城南门外');
eq('NPC姿态', p.characters['沈锡元'].posture, '靠在车边单手夹烟');
eq('NPC关系', p.characters['沈锡元'].relation, '克制内敛的青梅竹马，尚未告白');
eq('心声不外泄', '心声' in p.characters['沈锡元'], false);
eq('无状态栏返回null', LW._parseStatusBlock('普通正文'), null);

// ── 1.5 存储：popLast / meta / historyKeys ──
console.log('[存储]');
LW.Store.push('周言', [{ who: 'user', text: 'a' }, { who: '周言', text: 'b' }, { who: '周言', text: 'c' }], 100);
const popped = LW.Store.popLast('周言', 2);
eq('弹出条数', popped.length, 2);
eq('弹出内容', popped[0].text, 'b');
eq('剩余条数', LW.Store.history('周言').length, 1);
LW.Store.setMeta('周言', { headline: '睡了没', atMainCount: 5 });
eq('元信息读回', LW.Store.meta('周言').headline, '睡了没');
eq('会话key列表', LW.Store.historyKeys(), ['周言']);
LW.Store.push('撤回测试', [{ who: 'user', kind: 'text', text: 'hi' }, { who: '周言', kind: 'text', text: '在的' }], 100);
LW.Store.push('撤回测试', [{ who: '周言', kind: 'recall', text: '' }], 100);
const rh = LW.Store.history('撤回测试');
eq('撤回不打断条数', rh.length, 2);
eq('撤回标落到上一条', rh[1].recalled, true);
eq('定点删除', LW.Store.removeAt('撤回测试', 0), true);
eq('删除后条数', LW.Store.history('撤回测试').length, 1);
LW.Store.wipeHistory();

// ── 2. 记录块往返 ──
console.log('[记录块]');
LW.Engine = LW.Engine || {};
LW.Engine.userName = () => '陈默';
LW.Engine.stickers = () => ({ '偷看': 's9v34y.jpeg' });
LW.Engine.resolveSticker = (n) => (n === '探头' ? '偷看' : (LW.Engine.stickers()[n] ? n : null));
const msgs = [
  { who: 'user', kind: 'text', text: '在吗', time: '22:49' },
  { who: '周言', kind: 'text', text: '刚写完卷子', time: '' },
  { who: '周言', kind: 'sticker', text: '偷看', time: '' },
  { who: '周言', kind: 'poke', text: '', time: '' },
];
const block = LW.Floor.formatRecord('与周言的私聊', msgs, '22:49', '陈默');
const m = block.match(LW.Floor.RECORD_RE);
eq('块可被正则整体匹配', !!m, true);
eq('块头', m[1].trim(), '与周言的私聊 22:49');
eq(' sticker行', /周言：\[表情:偷看\]/.test(m[2]), true);
eq('poke行无冒号参数', /周言：\[戳一戳\]/.test(m[2]), true);

// ── 3. NPC 原始输出解析 ──
console.log('[NPC输出解析]');
const npcRaw = '在的\n[表情:探头]\n[语音|明天老地方]\n[戳一戳]\n[撤回]\n（思考了一下）';
const parsed = LW.Floor.parseNpcLines(npcRaw, '周言');
eq('解析条数', parsed.length, 5);
eq('文字行', parsed[0], { who: '周言', kind: 'text', text: '在的', time: '' });
eq('表情同义词解析为白名单名', parsed[1], { who: '周言', kind: 'sticker', text: '偷看', time: '' });
eq('语音行', parsed[2], { who: '周言', kind: 'voice', text: '明天老地方', time: '' });
eq('戳一戳行', parsed[3], { who: '周言', kind: 'poke', text: '', time: '' });
eq('撤回行解析', parsed[4].kind, 'recall');
eq('括号旁白被丢弃', parsed.some(x => x.text.indexOf('思考') !== -1), false);
const grpParsed = LW.Floor.parseNpcLines('林溪：啊啊啊\n陆飞：[图片|一张试卷]\n路人甲：围观', null);
eq('群聊发件人', grpParsed.map(x => x.who), ['林溪', '陆飞', '路人甲']);
eq('群聊图片类型', grpParsed[1].kind, 'image');

// ── 4. 提示词装配 ──
console.log('[提示词]');
global.__msgs = [
  { role: 'user', message: '周言把卷子递了过来。<span class="x">注</span>' },
  { role: 'assistant', message: '<status><环境>2034年8月26日 星期五|22:49|教室|阴</环境></status>他笑了笑。' },
];
const req = LW.Prompt.private({ name: '周言', profile: '档案：班长。' }, msgs, { time: '22:49', dateText: '2034年8月26日 星期五', userPlace: '教室', npc: { place: '图书馆', posture: '坐着' } });
const sysPrompt = req.ordered_prompts[0].content;
eq('框架头部', sysPrompt.indexOf('数字世界') !== -1, true);
eq('包含档案', sysPrompt.indexOf('班长') !== -1, true);
eq('包含时间', sysPrompt.indexOf('22:49') !== -1, true);
eq('包含NPC情境', sysPrompt.indexOf('图书馆') !== -1, true);
eq('HTML被剥离', sysPrompt.indexOf('class="x"') !== -1, false);
eq('status标签剥离', sysPrompt.indexOf('<环境>') !== -1, false);
eq('状态栏内容不进主线近况', sysPrompt.indexOf('阴') !== -1, false);
eq('正文保留', sysPrompt.indexOf('他笑了笑') !== -1, true);
eq('静默生成', req.should_silence, true);
eq('不占用主历史', req.max_chat_history, 0);
eq('无user宏残留·系统块', sysPrompt.indexOf('{{user}}'), -1);
eq('无user宏残留·user轮', req.ordered_prompts[1].content.indexOf('{{user}}'), -1);
const greq = LW.Prompt.group({ name: '高三（2）班', open: true }, [{ name: '林溪', profile: '闺蜜' }], [], null);
eq('群提示词含成员', greq.ordered_prompts[0].content.indexOf('林溪') !== -1, true);
eq('开放群提示', greq.ordered_prompts[0].content.indexOf('未具名的其他成员') !== -1, true);
eq('群无user宏残留', greq.ordered_prompts[0].content.indexOf('{{user}}'), -1);

const reqR = LW.Prompt.private({ name: '周言', profile: '' }, [{ who: '周言', kind: 'text', text: '在的', recalled: true }], null, null, null, null);
eq('撤回标注进记录', reqR.ordered_prompts[0].content.indexOf('（此条已撤回）') !== -1, true);
const reqN = LW.Prompt.private({ name: '周言', profile: '' }, [
  { who: 'user', kind: 'text', text: '早', day: '2034年8月25日 星期四', time: '22:00' },
  { who: '周言', kind: 'text', text: '嗯', day: '2034年8月26日 星期五', time: '08:00' },
], { time: '22:49', dateText: '2034年8月26日 星期五', userPlace: '', npc: null }, null, null, null);
const spN = reqN.ordered_prompts[0].content;
eq('私聊记录带对方名', spN.indexOf('周言：嗯') !== -1, true);
eq('私聊记录带user名', spN.indexOf('陈默：早') !== -1, true);
eq('跨天时间标·昨天', spN.indexOf('[昨天 22:00]') !== -1, true);
eq('跨天时间标·今天', spN.indexOf('[今天 08:00]') !== -1, true);
const greq2 = LW.Prompt.group({ name: '高三（2）班', open: false, style: '有班主任在，发言收敛' }, [{ name: '林溪', profile: '闺蜜' }], [], null);
eq('群氛围字段', greq2.ordered_prompts[0].content.indexOf('有班主任在，发言收敛') !== -1, true);
const greq3 = LW.Prompt.group({ name: '霖附吃瓜二手交易市场', open: true, crowd: '类型：校园公共群，超百人。\n风格：信息量大、节奏快。\n特殊规则：可同时存在多个话题，成员不一定会直接回应。' }, [], [], null);
const gtxt3 = greq3.ordered_prompts[0].content;
eq('群crowd逐字进提示词', gtxt3.indexOf('其余成员设定：\n类型：校园公共群，超百人。') !== -1, true);
eq('群crowd多行保留', gtxt3.indexOf('特殊规则：可同时存在多个话题') !== -1, true);
LW.Store.push('stampT', [{ who: 'user', kind: 'text', text: 'x', time: '22:00' }], 100);
eq('落库自动补日期', LW.Store.history('stampT')[0].day, '2034年8月26日 星期五');

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
