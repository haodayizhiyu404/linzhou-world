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
for (const f of ['src/store.js', 'src/status.js', 'src/worldbook.js', 'src/prompt.js', 'src/floor.js', 'src/engine.js']) {
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
LW.Store.removeAt('撤回测试', 0);
eq('删空后元信息清除', LW.Store.meta('撤回测试').headline === undefined && Object.keys(LW.Store.meta('撤回测试')).length === 0, true);
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
  { role: 'assistant', message: '<cot>Step.1：输入解析与意图拆解</cot>真正的回复。' },
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
eq('cot思维链剥离', sysPrompt.indexOf('Step.1') !== -1, false);
eq('cot剥离后正文保留', sysPrompt.indexOf('真正的回复') !== -1, true);
eq('静默生成', req.should_silence, true);
eq('不占用主历史', req.max_chat_history, 0);
eq('无user宏残留·系统块', sysPrompt.indexOf('{{user}}'), -1);
eq('无user宏残留·user轮', req.ordered_prompts[1].content.indexOf('{{user}}'), -1);
const greq = LW.Prompt.group({ name: '高三（2）班', open: true }, [{ name: '林溪', profile: '闺蜜' }], [], null);
eq('群提示词含成员', greq.ordered_prompts[0].content.indexOf('林溪') !== -1, true);
eq('群档案全量不截断', greq.ordered_prompts[0].content.indexOf('- 林溪：\n闺蜜') !== -1, true);
const greqLong = LW.Prompt.group({ name: '长档案群', open: false },
  [{ name: '林溪', profile: 'x'.repeat(900) }], [], null);
eq('群档案超500字保留', greqLong.ordered_prompts[0].content.indexOf('x'.repeat(900)) !== -1, true);
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
LW.Store.push('stampT2', [{ who: '周言', kind: 'text', text: 'y', time: '' }], 100);
eq('NPC消息自动补时钟', LW.Store.history('stampT2')[0].time, '22:49');
eq('NPC消息自动补日期', LW.Store.history('stampT2')[0].day, '2034年8月26日 星期五');

// ── 8. 世界书通讯录：群字段透传 ──
console.log('[世界书]');
ctx.getCharLorebooks = () => ({ primary: '测试书' });
ctx.getWorldbook = async () => [
  { comment: '霖州手机::通讯录', enabled: true, content: JSON.stringify({
    'IF线': {
      contacts: [{ name: '周言', avatar: 'a.png' }, { name: '张裕民', avatar: 'z.png' }],
      groups: [{
        name: '霖附吃瓜二手交易市场', open: true, avatar: 'g.png',
        style: '节奏快', crowd: '超百人，多为陌生人',
        members: ['周言', '{{user}}', '陆飞', '外校生']
      }]
    }
  }) },
  { comment: '周言', enabled: true, content: '周言的单人条目内容（短标题兜底）' },
  { comment: 'NPC（高中线-核心人员）', enabled: true, content: '[NPC·陆飞]\n性别: 男。\n身份: 篮球队（高中版）。\n\n[NPC·张裕民]\n性别: 男。\n身份: 班主任。' },
  { comment: 'NPC（大学线）', enabled: true, content: '[NPC·陆飞]\n性别: 男。\n身份: 运动康复专业（大学版），与{{user}}同住一栋公寓。' },
  { comment: '主角人设（大学线）', enabled: true, content: '[MAIN·周言·演化后]\n- 法学院学生，戴金丝边眼镜。\n\n[MAIN·{{user}}·演化后]\n- 新闻与传播学院学生，住校内宿舍。\n\n## III. 时代锚点事件\n- 第一次送别。\n\n# IV. 叙事指导\n- 这段不该进手机提示词。' },
  { comment: '世界设定杂项', enabled: true, content: '[NPC·外校生]\n性别: 女。\n身份: 来打友谊赛的。' },
  { comment: 'NPC（成人-破镜重圆）', enabled: true, content: '# I. 核心配角独立档案\n林溪、陆飞从高中时代起，与周言、沈锡元、{{user}}成为好友，关系密切，共同构筑了一个五人的核心小团体。\n\n[NPC·林溪]\n性别: 女。\n身份: 设计师（破镜重圆线）。\n\n[NPC·陆飞]\n性别: 男。\n身份: 运动康复师（破镜重圆线）。\n\n# II. 其他NPC档案\n\n[NPC·许嘉文]\n性别: 男。\n身份: 双面人（破镜重圆线）。' },
  { comment: '主角人设（成人-同路而行）', enabled: true, content: '# II. 角色演化档案\n\n[MAIN·周言·演化后]\n- 已婚设定（同路线）。\n\n[MAIN·{{user}}·演化后]\n- 与周言同居（同路线）。' },
  { comment: '霖州手机::人设::林溪', enabled: true, content: '林溪的手机专用档案' }
];
(async () => {
  const wb = await LW.Worldbook.load();
  const g0 = (wb.rosters['IF线'].groups || [])[0] || {};
  eq('群avatar透传', g0.avatar, 'g.png');
  eq('群style透传', g0.style, '节奏快');
  eq('群crowd透传', g0.crowd, '超百人，多为陌生人');
  eq('群open透传', g0.open, true);
  eq('群members透传', JSON.stringify(g0.members), '["周言","陆飞","外校生"]');
  eq('群members滤掉user宏', g0.members.indexOf('{{user}}') === -1, true);
  eq('联系人avatar透传', (wb.rosters['IF线'].contacts || [])[0].avatar, 'a.png');
  eq('短标题条目兜底档案', wb.profiles['周言'], '周言的单人条目内容（短标题兜底）');
  eq('人设条目优先于块', wb.profiles['林溪'], '林溪的手机专用档案');
  // 线作用域条目：只进线库，不再进全局池（防两条线共用一版档案）
  const rawNpcGz = (wb.npcLineRaw.filter(r => r.scope === '高中线-核心人员')[0] || { blocks: {} }).blocks;
  const rawNpcDx = (wb.npcLineRaw.filter(r => r.scope === '大学线')[0] || { blocks: {} }).blocks;
  eq('线NPC库raw·高中陆飞', (rawNpcGz['陆飞'] || '').indexOf('高中版') !== -1, true);
  eq('线NPC库raw·不串块', (rawNpcGz['陆飞'] || '').indexOf('班主任') === -1, true);
  eq('线NPC库raw·大学陆飞', (rawNpcDx['陆飞'] || '').indexOf('大学版') !== -1, true);
  eq('作用域条目不进全局池', wb.profiles['陆飞'], '');
  eq('未作用域条目全局池仍生效', (wb.profiles['外校生'] || '').indexOf('友谊赛') !== -1, true);
  const rawEvol = (wb.evolLineRaw.filter(r => r.scope === '大学线')[0] || { blocks: {} }).blocks;
  eq('演化块·剥演化后缀', (rawEvol['周言'] || '').indexOf('法学院') !== -1, true);
  eq('演化块·user块单列', (rawEvol['{{user}}'] || '').indexOf('新闻与传播学院') !== -1, true);
  eq('末块不吞后续章节', (rawEvol['{{user}}'] || '').indexOf('叙事指导') === -1
    && (rawEvol['{{user}}'] || '').indexOf('时代锚点事件') === -1, true);

  // ── 8.5 引擎线作用域：拼装、串线隔离、user 宏替换 ──
  console.log('[引擎·线档案]');
  LW.Apps = { wechat: { inject() {}, render() {}, remove() {} } };
  LW.Engine.userName = () => '陈默';
  ctx.getPersona = undefined;   // 模拟旧版酒馆助手：无 getPersona，走父页 powerUserSettings
  ctx.window.parent = { SillyTavern: { getContext: () => ({
    name1: '陈默',
    powerUserSettings: { persona_description: 'persona描述：陈默，住天禧城3幢901。' },
  }) } };
  await LW.Engine.load();
  eq('作用域→线名·高中', LW.Engine.lineOfScope('高中线-核心人员'), '高中时代');
  eq('作用域→线名·大学', LW.Engine.lineOfScope('大学线'), '大学时代');
  eq('作用域→线名·成人带尾', LW.Engine.lineOfScope('成人线-破镜重圆'), '成人时代-破镜重圆');
  eq('作用域→线名·成人省略线字', LW.Engine.lineOfScope('成人-破镜重圆'), '成人时代-破镜重圆');
  eq('作用域→线名·成人同路', LW.Engine.lineOfScope('成人-同路而行'), '成人时代-同路而行');
  eq('作用域→线名·古代', LW.Engine.lineOfScope('古代线'), '古代架空-华胥之梦');
  eq('作用域→线名·认不出', LW.Engine.lineOfScope('未来线'), null);
  LW.Engine.applyLine('成人时代-破镜重圆', '测试');
  eq('破镜重圆线林溪读线档案', LW.Engine.profileFor('林溪').indexOf('设计师（破镜重圆线）') !== -1, true);
  eq('破镜重圆线林溪不读基础档', LW.Engine.profileFor('林溪').indexOf('手机专用档案') === -1, true);
  eq('破镜重圆线陆飞不吞章节头', LW.Engine.profileFor('陆飞').indexOf('其他NPC档案') === -1, true);
  LW.Engine.applyLine('成人时代-同路而行', '测试');
  eq('同路而行线user演化', LW.Engine.userBlock().indexOf('与周言同居（同路线）') !== -1, true);
  eq('同路而行线主角演化叠加', LW.Engine.profileFor('周言').indexOf('已婚设定（同路线）') !== -1, true);
  LW.Engine.applyLine('高中时代', '测试');
  eq('高中线陆飞读高中版', LW.Engine.profileFor('陆飞').indexOf('高中版') !== -1, true);
  LW.Engine.applyLine('大学时代', '测试');
  eq('大学线陆飞读大学版·串线隔离', LW.Engine.profileFor('陆飞').indexOf('高中版') === -1 && LW.Engine.profileFor('陆飞').indexOf('大学版') !== -1, true);
  eq('大学线user宏替换', LW.Engine.profileFor('陆飞').indexOf('{{user}}') === -1 && LW.Engine.profileFor('陆飞').indexOf('陈默') !== -1, true);
  const zy = LW.Engine.profileFor('周言');
  eq('基础人设+演化层叠加', zy.indexOf('短标题兜底') !== -1 && zy.indexOf('法学院') !== -1, true);
  eq('演化层衔接句', zy.indexOf('最新人设演化如下') !== -1 && zy.indexOf('【大学时代】') !== -1, true);
  eq('用户段·persona描述', LW.Engine.userBlock().indexOf('天禧城3幢901') !== -1, true);
  eq('用户段·衔接句', LW.Engine.userBlock().indexOf('叠加于上方机主资料') !== -1, true);
  eq('用户段·线user演化', LW.Engine.userBlock().indexOf('新闻与传播学院') !== -1, true);
  eq('用户段·user宏替换', LW.Engine.userBlock().indexOf('{{user}}') === -1, true);

  // ── 8.6 跨会话上下文：群→私聊 / 私聊→群，当天门控 ──
  console.log('[跨会话上下文]');
  LW.Store.push('group:霖附吃瓜二手交易市场', [
    { who: 'user', kind: 'text', text: '群里水的消息', day: '2034年8月26日 星期五', time: '23:00' },
    { who: '周言', kind: 'text', text: '哈哈+1', day: '2034年8月26日 星期五', time: '23:01' },
  ], 100);
  LW.Store.push('陆飞', [
    { who: 'user', kind: 'text', text: '晚安，睡了', day: '2034年8月26日 星期五', time: '23:30' },
  ], 100);
  LW.Engine.applyLine('IF线', '测试');
  const cg = LW.Engine.crossGroups('陆飞', '2034年8月26日 星期五');
  eq('跨群·命中群数', cg.length, 1);
  eq('跨群·群名', cg[0].name, '霖附吃瓜二手交易市场');
  eq('跨群·尾巴条数', cg[0].hist.length, 2);
  eq('跨群·非成员不命中', LW.Engine.crossGroups('张裕民', '2034年8月26日 星期五').length, 0);
  eq('跨群·跨天不携带', LW.Engine.crossGroups('陆飞', '2034年8月27日 星期六').length, 0);
  const cp = LW.Engine.crossPrivates(['陆飞', '周言'], '2034年8月26日 星期五');
  eq('跨私聊·命中', (cp['陆飞'] || []).length, 1);
  eq('跨私聊·无记录成员跳过', '周言' in cp, false);
  eq('跨私聊·跨天不携带', Object.keys(LW.Engine.crossPrivates(['陆飞'], '2034年8月27日 星期六')).length, 0);
  const reqX = LW.Prompt.private({ name: '陆飞', profile: '大学版档案' }, [], { dateText: '2034年8月26日 星期五' }, [], null, null, null, cg);
  eq('私聊提示词·带群近况节', reqX.ordered_prompts[0].content.indexOf('相关群聊近况') !== -1, true);
  eq('私聊提示词·群内容进入', reqX.ordered_prompts[0].content.indexOf('哈哈+1') !== -1, true);
  const gtxtX = LW.Prompt.group({ name: '霖附吃瓜二手交易市场', open: false }, [{ name: '陆飞', profile: '大学版档案' }], [], { dateText: '2034年8月26日 星期五' }, [], null, null, null, cp).ordered_prompts[0].content;
  eq('群提示词·scoped情报', gtxtX.indexOf('※ 仅 陆飞 本人知晓') !== -1, true);
  eq('群提示词·私聊内容进入', gtxtX.indexOf('晚安，睡了') !== -1, true);
  eq('群提示词·防泄漏规则', gtxtX.indexOf('引用一字即出戏') !== -1, true);
  LW.Engine.applyLine(null, '收尾');
  console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
