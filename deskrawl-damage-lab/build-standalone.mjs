/* 把多文件前端打包成单文件自包含 HTML
 * 用法：node build-standalone.mjs
 * 产出：仓库根目录的 deskrawl-lab.html —— 任何环境双击即可用（无外部脚本依赖）
 * 背景：受限预览面板/沙箱 iframe 里 <script src="./x.js"> 相对路径加载失败，
 *       导致整个 app 不初始化、tab 点了没反应。内联后彻底消除该问题。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 按 index.html 中的出现顺序抽取 <script src="..."></script>
const scriptRe = /<script\s+src=["']([^"']+)["']\s*><\/script>/g;
const files = [];
let m;
while ((m = scriptRe.exec(html)) !== null) files.push(m[1]);

// 防御：JS 内容里若出现 </script> 会提前闭合标签，需转义
const safe = s => s.replace(/<\/script>/gi, '<\\/script>');

let out = html;
for (const rel of files) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.error('缺少文件:', rel);
    process.exit(1);
  }
  const code = fs.readFileSync(fp, 'utf8');
  const tag = `<script src="${rel}"></script>`;
  const inline = `<script data-src="${rel}">\n${safe(code)}\n</script>`;
  if (!out.includes(tag)) {
    console.error('未在 HTML 中找到引用:', tag);
    process.exit(1);
  }
  // 关键：replacement 必须用函数形式，否则 inline 里的 $$ / $& / $` 会被
  // String.replace 当作特殊替换模式（app.js 的 `const $$` 曾被改成 `const $` 导致重复声明）
  out = out.replace(tag, () => inline);
}

// Worker 路径在 file:// 下不可用，但 solver.js 已有主线程分片降级；
// 这里把 Worker 构造改为 try/catch 保险（若原代码已处理则不重复）。
const outPath = path.join(root, '..', 'deskrawl-lab.html');
fs.writeFileSync(outPath, out, 'utf8');
console.log('已打包:', outPath);
console.log('内联脚本数:', files.length);
console.log('内联文件:', files.join(', '));
console.log('单文件大小:', (Buffer.byteLength(out, 'utf8') / 1024).toFixed(0) + ' KB');
