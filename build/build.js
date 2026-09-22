// build.js —— 把 src/ 按序拼成 dist/engine.js（无第三方依赖，node 直接跑）
// 用法：node build/build.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORDER = [
  'src/store.js',
  'src/status.js',
  'src/worldbook.js',
  'src/prompt.js',
  'src/floor.js',
  'src/apps/wechat.js',
  'src/apps/wechat-home.js',
  'src/apps/wechat-list.js',
  'src/apps/wechat-chat.js',
  'src/apps/wechat-moments.js',
  'src/apps/wechat-forum.js',
  'src/apps/wechat-call.js',
  'src/apps/wechat-settings.js',
  'src/apps/wechat-memo.js',
  'src/engine.js',
];

const banner =
  '// ═══════════════════════════════════════════════════════════\n' +
  '//  霖州往事 · 数字世界引擎（构建产物，勿手改）\n' +
  '//  源码见 src/ · 构建：node build/build.js\n' +
  `//  构建时间：${new Date().toISOString()}\n` +
  '// ═══════════════════════════════════════════════════════════\n' +
  `var __LZW_BUILD__ = '${new Date().toISOString().slice(0, 16).replace('T', ' ')}';\n` +
  `try { console.log('[霖州引擎] 构建 ' + __LZW_BUILD__ + ' · 启动'); } catch (e) {}\n`;

let out = banner;
for (const f of ORDER) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error('缺文件：' + f); process.exit(1); }
  out += '\n// ── ' + f + ' ──\n' + fs.readFileSync(p, 'utf8') + '\n';
}

const distDir = path.join(ROOT, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'engine.js'), out, 'utf8');
console.log('OK → dist/engine.js（' + out.length + ' chars）');

// 构建后清除 jsDelivr 缓存（尽力而为，失败不阻塞）
const GH_USER = 'haodayizhiyu404';
const GH_REPO = 'linzhou-world';
fetch(`https://purge.jsdelivr.net/gh/${GH_USER}/${GH_REPO}@main/dist/engine.js`)
  .then(r => r.json())
  .then(j => console.log('CDN 缓存清除：' + ((j && j.status) || '未知')))
  .catch(() => console.log('CDN 缓存清除请求失败（不影响构建）'));
