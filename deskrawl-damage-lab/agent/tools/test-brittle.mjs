/* 脆裂机制回归测试
 * 用法：node agent/tools/test-brittle.mjs
 * 验证：层数0逐位不变、3种归属的差异、单跳乘区表显示、--check 基准
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));   // agent/tools
const calc = path.join(toolsDir, 'calc.mjs');

function dps(args) {
  const out = execFileSync('node', [calc, '--class', 'warrior', '--json', ...args], { encoding: 'utf8' });
  return JSON.parse(out).dps;
}
function zones(args) {
  const out = execFileSync('node', [calc, '--class', 'warrior', '--hit', 'w_val', '--json', ...args], { encoding: 'utf8' });
  return JSON.parse(out).zones;
}

const base = dps([]);
const off = dps(['--brittle', '10', '--brittle-zone', 'off']);
const crit = dps(['--brittle', '10', '--brittle-zone', 'crit']);
const taken = dps(['--brittle', '10', '--brittle-zone', 'taken']);

let ok = true;
const eq = (a, b) => Math.abs(a - b) < 1e-6;
console.log('基准 DPS:', base);
console.log('10层 off :', off, eq(off, base) ? '✓ 逐位不变' : '✗ 应等于基准');
console.log('10层 crit:', crit, crit > base ? '✓ 提升' : '✗ 应提升');
console.log('10层 taken:', taken, taken > crit ? '✓ 大于crit(全伤害放大)' : '✗ 应大于crit');
if (!eq(off, base) || crit <= base || taken <= crit) ok = false;

const z = zones(['--brittle', '10', '--brittle-zone', 'crit']);
const critZone = (z || []).find(x => x.id === 'crit');
const hasBrittle = !!(critZone && /脆裂/.test(critZone.note));
console.log('单跳乘区表显示脆裂:', hasBrittle ? '✓ ' + critZone.note : '✗ 缺失');
if (!hasBrittle) ok = false;

const checkOut = execFileSync('node', [calc, '--check'], { encoding: 'utf8' });
const chk = JSON.parse(checkOut);
console.log('自检:', chk.selfCheck, chk.dps, chk.selfCheck === 'PASS' ? '✓' : '✗');
if (chk.selfCheck !== 'PASS') ok = false;

console.log(ok ? '\n全部通过 ✓' : '\n存在失败 ✗');
process.exit(ok ? 0 : 1);
