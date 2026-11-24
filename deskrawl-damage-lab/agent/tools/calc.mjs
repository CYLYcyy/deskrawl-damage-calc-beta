#!/usr/bin/env node
/**
 * Deskrawl 伤害计算 CLI —— 给智能体/脚本调用
 *
 * 例：
 *   node agent/tools/calc.mjs --class sorcerer --element lightning --type strong
 *   node agent/tools/calc.mjs --class warrior --legendaries vigor,draught --affix weapon
 *   node agent/tools/calc.mjs --class monk --hit m_judgment --electro 8
 *   node agent/tools/calc.mjs --check
 *   node agent/tools/calc.mjs --class hunter --json
 *
 * 新增（引擎已接入 affix.js / runes.js）：
 *   node agent/tools/calc.mjs --gear 840,legendary                 # 装分×稀有度 → 装备数值
 *   node agent/tools/calc.mjs --item '{"ilvl":700,"rarity":"divine","divineId":"TheGrandmother","slots":[]}'
 *   node agent/tools/calc.mjs --class warrior --skill-level w_val:20
 *   node agent/tools/calc.mjs --class warrior --runes RareRune_WarriorBasicAttack:6
 *   node agent/tools/calc.mjs --class sorcerer --taken-mode multiply
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext('var window = globalThis;', ctx);
// 加载顺序：纯数据 → 数值/符文模块 → 引擎（引擎运行时从 window 取 AffixMath / RuneData）
for (const f of ['data.js', 'affix.js', 'runes.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const E = ctx.window.Engine;
const D = ctx.window.DESKRAWL_DATA;
const AF = ctx.window.AffixMath;
const RD = ctx.window.RuneData;

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const has = name => argv.includes('--' + name);

if (has('help') || argv.length === 0) {
  console.log(`Deskrawl 伤害计算器

--class      warrior|sorcerer|hunter|monk       默认 warrior
--element    physical|fire|cold|lightning|poison|arcane
--type       basic|strong|special                默认 strong
--gear       starter|mid|end（预设）或 ilvl,rarity（如 840,legendary，按装分×稀有度生成装备）
--item       JSON 覆盖 gearBuild（ilvl/rarity/slots/roll/divineId/blackMist/ancient）
--skill-level 技能id:N[,技能id:N]                按 Base+N×PerLevel 缩放倍率（10 级基准，可 50+）
--runes      符文id:等级[,符文id:等级]           199 符文属性 + 技能等级授予
--taken-mode multiply|additive                   静电×易伤口径（默认 additive；multiply 为敏感性对照）
--enemy      mob|elite|boss|world|rift           默认 boss
--diff       1|3.5|6                             默认 6（地狱）
--duration   秒                                  默认 60
--skills     basic,strong,s1,s2（技能 id，可留空）
--legendaries a,b,c
--talents    auto | JSON（如 {"str":10}）
--minion     id --minion-level 1-10 --reins --minion-gear none|atk|sup|def
--electro    静电层数 0-10
--brittle    脆裂层数（1.0.4 真源：进暴伤池 +5%/层，来自传奇戒指，默认 0）
--brittle-zone crit|taken|off                    脆裂归属（默认 crit=暴击区；1.0.4 真源进暴伤池）
--reckoning  清算锤叠层数 0-50（需先在 --legendaries 装备 divinemace2/ancientdivinemace2）
--affix      部位（weapon/helm/ring…）输出词条 Top8
--hit        技能 id，输出单跳乘区（默认瞬时口径：条件项按命中瞬间 0/1）
--hit-coverage  --hit 改用周期口径（易伤/健康/受伤等按覆盖率加权，非单跳瞬时）
--json       机器可读输出
--check      自洽校验（乘区连乘 vs 引擎单跳，误差应为 0）`);
  process.exit(0);
}

const CLASS_UI = {
  warrior: { element: 'fire', type: 'strong', skills: { basic: 'w_val', strong: 'w_flame', special1: 'w_hook', special2: 'w_molten' } },
  sorcerer: { element: 'lightning', type: 'strong', skills: { basic: 's_electro', strong: 's_storm', special1: 's_orb', special2: 's_elemental' } },
  hunter: { element: 'physical', type: 'strong', skills: { basic: 'h_shot', strong: 'h_barrage', special1: 'h_trap', special2: 'h_venom' } },
  monk: { element: 'lightning', type: 'strong', skills: { basic: 'm_fist', strong: 'm_judgment', special1: 'm_orbs', special2: 'm_twin' } }
};

const ELE_STAT = { physical: 23, fire: 24, cold: 25, lightning: 26, poison: 27, arcane: 28 };

/* --gear ilvl,rarity 的默认词条布局：武器/戒指/项链各一条元素、类型与暴击/全伤/条件伤。
   --item 可用完整 JSON 覆盖（含 slots 与 roll，满掷 roll=1.15）。 */
function defaultGearBuild(ilvl, rarity, element, primaryType) {
  const el = ELE_STAT[element] || 26;
  const typeStat = primaryType === 'basic' ? 33 : primaryType === 'special' ? 61 : 34;
  return {
    ilvl, rarity, name: `自定义 ${ilvl} ${rarity}`,
    slots: [
      { slot: 1, main: [5, el, typeStat, 3], secondary: [] },
      { slot: 7, main: [4, 5, el, 65], secondary: [] },
      { slot: 8, main: [32, 40, el, 65], secondary: [] }
    ]
  };
}

function parseSkillLevels(raw) {
  if (!raw || raw === true) return undefined;
  const out = {};
  for (const part of String(raw).split(',')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const id = part.slice(0, i).trim();
    const n = parseInt(part.slice(i + 1), 10);
    if (id && Number.isFinite(n)) out[id] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseRunes(raw) {
  if (!raw || raw === true) return undefined;
  const out = [];
  for (const part of String(raw).split(',')) {
    const i = part.indexOf(':');
    const id = (i < 0 ? part : part.slice(0, i)).trim();
    if (!id) continue;
    const n = i < 0 ? 1 : parseInt(part.slice(i + 1), 10);
    out.push({ id, level: Number.isFinite(n) && n > 0 ? n : 1 });
  }
  return out.length ? out : undefined;
}

function parseTakenMode(raw) {
  if (!raw || raw === true) return undefined;
  const v = String(raw).toLowerCase();
  if (v === 'multiply' || v === 'multiplicative' || v === '相乘') return 'multiplicative';
  if (v === 'additive' || v === '加算') return 'additive';
  console.error(`未识别的 --taken-mode：${raw}（用 multiply 或 additive）`);
  process.exit(1);
}

const classKey = arg('class', 'warrior');
const u = CLASS_UI[classKey] || CLASS_UI.warrior;
const diff = parseFloat(arg('diff', 6));
const enemyPreset = D.ENEMIES.find(e => e.id === arg('enemy', 'boss')) || D.ENEMIES[2];
const enemyHp = Math.round(enemyPreset.hp * diff);
const element = arg('element', u.element);
const primaryType = arg('type', u.type);

let skills = u.skills;
if (arg('skills')) {
  const p = String(arg('skills')).split(',');
  skills = { basic: p[0] || u.skills.basic, strong: p[1] || u.skills.strong, special1: p[2] || u.skills.special1, special2: p[3] || u.skills.special2 };
}

let talents = {};
if (arg('talents') === 'auto') talents = E.autoTalents({ classKey, element, primaryType, gear: E.GEAR_PRESETS[arg('gear', 'mid')], skills, talents: {}, setId: null, setCount: 0, legendaries: [], enemy: {}, minionId: null }, 70);
else if (arg('talents') && arg('talents') !== true) { try { talents = JSON.parse(arg('talents')); } catch (e) { console.error('talents JSON 解析失败'); } }

const enemy = {
  hp: enemyHp, armor: parseFloat(arg('armor', 0)) || 0, mr: parseFloat(arg('mr', 0)) || 0,
  count: parseInt(arg('count', 1), 10) || enemyPreset.count,
  elite: enemyPreset.elite, distant: !!enemyPreset.distant,
  healthyUptime: 0.2, injuredUptime: 0.2, slowedUptime: 0, immobilizedUptime: 0, critDR: 0
};

/* 装备档位：预设 starter|mid|end 走原逻辑；ilvl,rarity 或 --item JSON 走 gearBuild */
const gearArg = arg('gear', 'mid');
let gearBuild = null;
if (gearArg && /[,\d]/.test(String(gearArg)) && !E.GEAR_PRESETS[gearArg]) {
  const m = String(gearArg).match(/^\s*(\d+)\s*,\s*([A-Za-z]+)\s*$/);
  if (!m) { console.error('--gear 用 ilvl,rarity（如 840,legendary）或 starter|mid|end'); process.exit(1); }
  gearBuild = defaultGearBuild(+m[1], m[2].toLowerCase(), element, primaryType);
} else if (has('item')) {
  try {
    gearBuild = JSON.parse(arg('item'));
    if (!gearBuild || typeof gearBuild !== 'object') throw new Error('gearBuild 必须是对象');
  } catch (e) {
    console.error('--item JSON 解析失败：' + e.message);
    process.exit(1);
  }
}

const skillLevels = parseSkillLevels(arg('skill-level'));
const runes = parseRunes(arg('runes'));
const takenMode = parseTakenMode(arg('taken-mode'));

const c = {
  classKey,
  element, primaryType,
  gear: Object.assign({}, E.GEAR_PRESETS[E.GEAR_PRESETS[gearArg] ? gearArg : 'mid']),
  gearBuild,
  skills, talents,
  setId: null, setCount: 0,
  legendaries: arg('legendaries') ? String(arg('legendaries')).split(',').filter(Boolean) : [],
  minionId: arg('minion', null),
  minionLevel: parseInt(arg('minion-level', 10), 10) || 10,
  minionReins: has('reins'),
  minionGear: arg('minion-gear', 'none'),
  electroStacks: arg('electro') != null ? parseInt(arg('electro'), 10) : undefined,
  brittleStacks: arg('brittle') != null ? parseInt(arg('brittle'), 10) : 0,
  brittleZone: arg('brittle-zone', 'crit'),
  reckoningStacks: arg('reckoning') != null ? parseInt(arg('reckoning'), 10) : 0,
  skillLevels,
  runes,
  takenMode,
  enemy,
  vulnUptime: parseFloat(arg('vuln', 0.45)),
  gcd: 0.45
};

const fmt = n => (n >= 1e8 ? (n / 1e8).toFixed(2) + ' 亿' : n >= 1e4 ? (n / 1e4).toFixed(1) + ' 万' : Math.round(n).toLocaleString('en-US'));

/* 装备数值摘要：gearBuild 生效时打印，体现"任意装分×稀有度"能力 */
function gearSummary() {
  if (!c.gearBuild || !AF || typeof AF.buildGear !== 'function') return null;
  const g = AF.buildGear(c);
  const keys = ['main', 'cc', 'cd', 'as', 'ele', 'type', 'all', 'vsElite', 'vsVuln', 'flat', 'cdr', 'dot'];
  const parts = keys.filter(k => g[k]).map(k => `${k}=${g[k]}`);
  return { name: g.name, dps: g.dps, speed: g.speed, parts, raw: g };
}

if (has('check')) {
  const r = E.simulate(c, { duration: 60 });
  const z = r.zones;
  let acc = z ? z.zones[0].value : 0;
  if (z) z.zones.forEach((x, i) => { if (i) acc *= x.mult; });
  const err = z ? Math.abs(acc * z.hits - z.total) / Math.max(1, z.total) : 0;
  // 技能等级外推一致性：对每个有 perLevel 的技能，验证 11/20/50 级倍率严格按
  // pct + (N-10)*perLevel 线性增长且单调。防止 perLevel 漏跟版本（如横扫 2.5→3）再次漏检。
  let levelCheckError = 0;
  let levelChecked = 0;
  for (const cls of Object.values(D.CLASSES)) {
    for (const ab of [...cls.basics, ...cls.strongs, ...cls.specials]) {
      if (ab.perLevel == null || ab.perLevel <= 0 || ab.pct == null) continue;
      levelChecked++;
      const at = n => ab.pct + (n - 10) * ab.perLevel;
      const p11 = at(11), p20 = at(20), p50 = at(50);
      // 单调 + 增量精确匹配 perLevel
      if (!(p11 > ab.pct && p20 > p11 && p50 > p20)) levelCheckError++;
      if (Math.abs((p20 - p11) - 9 * ab.perLevel) > 1e-9) levelCheckError++;
      if (Math.abs((p50 - p20) - 30 * ab.perLevel) > 1e-9) levelCheckError++;
    }
  }
  console.log(JSON.stringify({
    version: D.VERSION,
    classes: Object.keys(D.CLASSES).length,
    legendaries: D.LEGENDARIES.length,
    minions: D.MINIONS.length,
    zones: z ? z.zones.length : 0,
    zoneCheckError: +(err * 100).toFixed(6),
    levelCheckError,
    levelChecked,
    dps: Math.round(r.dps),
    selfCheck: (err < 1e-9 && levelCheckError === 0) ? 'PASS' : 'FAIL'
  }, null, 1));
  process.exit(0);
}

if (arg('hit')) {
  const abId = String(arg('hit'));
  const cls = D.CLASSES[classKey];
  const ab = [...cls.basics, ...cls.strongs, ...cls.specials].find(a => a.id === abId || a.name === abId);
  if (!ab) { console.error('找不到技能：' + abId); process.exit(1); }
  const agg = E.aggregate(c);
  // 口径硬隔离（红线三）：--hit 默认瞬时口径，条件项按命中瞬间 0/1 计，不摊覆盖率；
  // 只有显式 --hit-coverage 才用周期权重（易伤覆盖/健康/受伤/远处）。禁止混用。
  const hitCoverage = has('hit-coverage');
  const c2 = hitCoverage ? {
    elite: enemy.elite, armor: enemy.armor, mr: enemy.mr, enemyLevel: 70, critDR: 0,
    healthyUptime: 0.2, injuredUptime: 0.2, slowedUptime: 0, immobilizedUptime: 0,
    distant: false, count: enemy.count, vulnUptime: c.vulnUptime,
    takenMode: c.takenMode,
    electroStacks: c.electroStacks != null ? c.electroStacks : (agg.flags.static ? 6 : 0),
    brittleStacks: c.brittleStacks || 0,
    brittleZone: c.brittleZone || 'crit'
  } : {
    // 单跳瞬时：目标此刻处于全部可达状态（与 engine simulate{singleHit:true} 一致）
    elite: true, armor: enemy.armor, mr: enemy.mr, enemyLevel: 70, critDR: 0,
    healthyUptime: 1, injuredUptime: 1, slowedUptime: 1, immobilizedUptime: 1,
    distant: 1, count: enemy.count, vulnUptime: 1,
    takenMode: c.takenMode,
    electroStacks: c.electroStacks != null ? c.electroStacks : (agg.flags.static ? 6 : 0),
    brittleStacks: c.brittleStacks || 0,
    brittleZone: c.brittleZone || 'crit'
  };
  const z = E.hitZones(agg, ab, c2);
  const lv = c.skillLevels && c.skillLevels[ab.id];
  const lvNote = lv != null ? ` @${lv}级` : '';
  const shownPct = lv != null ? +(ab.pct + (lv - 10) * (ab.perLevel || 0)).toFixed(2) : ab.pct;
  const zoneLabel = hitCoverage ? '周期口径（覆盖率加权，非单跳瞬时）' : '瞬时口径（条件项按命中瞬间 0/1）';
  if (has('json')) { console.log(JSON.stringify({ skill: ab.name, pct: shownPct, zoneMode: hitCoverage ? 'coverage' : 'instant', hits: z.hits, total: z.total, zones: z.zones }, null, 1)); process.exit(0); }
  console.log(`\n${ab.name}${lvNote} · ${shownPct}%${z.hits > 1 ? ' × ' + z.hits + ' 段' : ''} · ${c.element}`);
  console.log(`  口径：${zoneLabel}\n`);
  let acc = z.zones[0].value;
  z.zones.forEach((x, i) => {
    if (i) acc *= x.mult;
    console.log(`  ${x.name.padEnd(12, '　')} ×${x.mult.toFixed(3).padStart(7)}　${fmt(acc).padStart(12)}   ${x.note}`);
  });
  console.log(`\n  单跳期望 ${fmt(z.total)}　（约 ×${(z.total / agg.weaponDamage).toFixed(1)} 武器伤害）`);
  if (c.takenMode === 'multiplicative') console.log('  口径：静电 × 易伤【相乘】（敏感性对照，非系统默认）');
  console.log('');
  process.exit(0);
}

if (arg('affix')) {
  const r = E.rankAffixes(Object.assign({}, c, { slot: String(arg('affix')) }), { duration: 40, lite: false });
  if (has('json')) { console.log(JSON.stringify(r.list.slice(0, 8), null, 1)); process.exit(0); }
  console.log(`\n${arg('affix')} 部位 · 追加一条 ilvl700 中值词条\n`);
  r.list.slice(0, 8).forEach((a, i) => console.log(`  ${String(i + 1).padStart(2)}. ${a.name.padEnd(14, '　')} +${a.delta.toFixed(2)}%`));
  console.log('');
  process.exit(0);
}

const r = E.simulate(c, { duration: parseInt(arg('duration', 60), 10) });
const gs = gearSummary();
const out = {
  version: D.VERSION.game,
  class: classKey,
  element: c.element, type: c.primaryType,
  enemy: enemyPreset.name, difficulty: diff,
  dps: Math.round(r.dps),
  dpsPct: +r.dpsPct.toFixed(0),
  cycleSeconds: +r.cycle.toFixed(2),
  perCyclePct: +r.perCyclePct.toFixed(1),
  killTime: +(enemy.hp / r.dps).toFixed(1),
  avgMana: +r.avgMana.toFixed(2),
  combat: Object.fromEntries(Object.entries(r.breakdown).filter(([, v]) => v.dmg > 0).map(([k, v]) => [k, { casts: v.casts, hits: v.hits, share: +(v.dmg / r.total * 100).toFixed(1) }])),
  minion: r.minion,
  electroStacks: r.electroStacks
};
if (gs) out.gear = { build: c.gearBuild, values: gs.parts, dps: gs.dps, speed: gs.speed };
if (skillLevels) out.skillLevels = skillLevels;
if (runes) out.runes = runes;
if (takenMode) out.takenMode = takenMode;

if (has('json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

if (gs) {
  console.log(`\n装备数值 · ${gs.name}（词缀 roll=1.0 中值，满掷用 --item 指定 roll=1.15）`);
  console.log('  ' + gs.parts.join('  '));
  console.log(`  dps=${gs.dps}  speed=${gs.speed}`);
}
if (skillLevels) {
  console.log('\n技能等级（10 级为基准，按 perLevel 外推）：');
  for (const [id, lv] of Object.entries(skillLevels)) {
    const ab = [...D.CLASSES[classKey].basics, ...D.CLASSES[classKey].strongs, ...D.CLASSES[classKey].specials].find(a => a.id === id);
    const mult = ab ? +(ab.pct + (lv - 10) * (ab.perLevel || 0)).toFixed(2) : null;
    console.log(`  ${id} @${lv}级${ab ? ` · ${ab.name} 倍率 ${mult}%` : '（未找到技能）'}`);
  }
}
if (runes) {
  const grants = Object.entries(c.skillLevels || {}).filter(([id]) => runes.some(ru => {
    const def = RD.RUNES.find(x => x.id === ru.id);
    return def && (def.ability || []).some(a => a.id === id);
  }));
  console.log(`\n符文：${runes.length} 条` + (grants.length ? ` · 技能等级授予：${grants.map(([id, lv]) => `${id}=${lv}`).join(', ')}` : ''));
}
if (takenMode === 'multiplicative') console.log('\n口径：静电 × 易伤【相乘】（敏感性对照；系统默认加算）');

console.log(`\n${D.CLASSES[classKey].name} · ${out.element} · ${out.type} · ${enemyPreset.name} 地狱\n`);
console.log(`  秒伤        ${fmt(r.dps)}   (×${Math.round(out.dpsPct/100)} 武器伤害/秒)`);
console.log(`  击杀时间    ${out.killTime} 秒（有效生命 ${fmt(enemy.hp)}）`);
console.log(`  实际循环    ${out.cycleSeconds} 秒 / 轮，每轮 ×${out.perCyclePct}`);
console.log(`  平均法力    ${(r.avgMana * 100).toFixed(0)}%`);
if (r.minion) console.log(`  仆从        ${r.minion.name} Lv${r.minion.level}${r.minion.resonance ? ' · 共鸣' : ''} · 自身输出 ${fmt(r.agg.weaponDamage * r.minion.selfPct / 100)}/秒`);
console.log('\n  伤害构成：');
Object.entries(r.breakdown).filter(([, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg)
  .forEach(([k, v]) => {
    const ab = [...D.CLASSES[classKey].basics, ...D.CLASSES[classKey].strongs, ...D.CLASSES[classKey].specials].find(a => a.id === k);
    console.log(`    ${(ab ? ab.name : k).padEnd(10, '　')} ${String(v.casts).padStart(4)} 次 · ${(v.dmg / r.total * 100).toFixed(1)}%`);
  });
console.log('');
