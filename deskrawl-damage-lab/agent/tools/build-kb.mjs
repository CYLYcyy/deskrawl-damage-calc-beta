/**
 * 从 data.js 生成知识库（Markdown + kb.json）
 * 用法：node agent/tools/build-kb.mjs
 * 版本更迭时先改 data.js，再跑这个脚本，知识库与网页问答自动同步。
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
vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
const D = ctx.window.DESKRAWL_DATA;

const outDir = path.join(root, 'agent/knowledge');
fs.mkdirSync(outDir, { recursive: true });

const ELE = { physical: '物理', fire: '火焰', cold: '冰霜', lightning: '闪电', poison: '毒素', arcane: '奥术' };
const TYPE = { basic: '基础攻击', strong: '强力攻击', special: '特殊技能' };

function w(name, body) {
  fs.writeFileSync(path.join(outDir, name), body.trim() + '\n', 'utf8');
  return name;
}

const files = [];

/* ---------------- 01 伤害模型 ---------------- */
{
  const M = D.MECHANICS;
  const body = `# 伤害模型与乘区

> 数据版本 ${D.VERSION.game}（${D.VERSION.gameDate}），知识库生成于 ${D.VERSION.dataDate}

## 主公式（逐步乘算）

\`\`\`
攻击伤害 = trunc( (技能固定伤BaseDamage + 技能倍率 × (武器伤害(stat20) + 平伤(Damage=3)))
                × (1 + 主属性/100) )
最终伤害 = 攻击伤害
     × (1 + 元素伤% + 全伤%)          ← 加算，同一乘区
     × (1 + 暴率 × 暴伤 × (1 - 目标暴伤减免))
     × (1 + Σ条件伤%)                  ← vs 精英/健康/减速… 内部加算
     × (1 + 类型伤%)                   ← 普通/强力/特殊
     × (1 + 技能专属加成%)
     × (1 + 易伤30% + 静电10%/层[仅闪电]) ← 目标"受到伤害增加"通道
     × (1 − R/(R + 50×等级))           ← 护甲或魔抗
\`\`\`

- **武器伤害取 stat20（白字）**，是直接进公式的伤害基项；武器 DPS 是显示派生量，攻速只影响出手频率、**不进单跳**。
- **技能固定伤 BaseDamage**：真源 \`DamageEffect.BaseDamage\` 字段（不乘技能倍率、吃主属性及后续全部乘区）。反编译实证玩家四职业 49/49 段全为 0，官方工具链也置 0 防止与白字双计，故引擎取 0、数值无影响（口径保真）。切勿把白字塞进这里。

乘区顺序：${M.zones.order.join(' → ')}

## 十个乘区，哪些不能混

| 乘区 | 内部关系 | 典型来源 | 常见误区 |
| --- | --- | --- | --- |
| 技能倍率 | 独立 | 技能自带百分比（pct） | 把"每级 +3%"当成乘算 |
| 主属性 | 独立 | 力量/敏捷/智力 | 与元素伤混算 |
| **元素 + 全伤** | **加算** | 火焰伤害、Bonus All Damage | 以为全伤是独立乘区 |
| 暴击期望 | 独立 | 暴率、暴伤、技能条件暴伤 | 用暴伤当期望，忘记乘暴率 |
| 条件伤 vs | 内部加算 | 对精英、对易伤、对健康 | 与"易伤 30%"混为一谈 |
| 类型伤 | 独立 | 基础/强力/特殊攻击伤害 | 三条类型伤互相加算（错） |
| 技能专属 | 独立 | 只加某个技能 | 当成全局加成 |
| **目标受伤** | 内部加算 | 易伤 30%、静电、脆裂 | 与"对易伤目标 +X%"重复计算 |
| 减伤 | 独立 | 护甲 / 魔抗 | 物理与元素用同一条曲线 |
| 随机浮动（仅声明，引擎未采样） | — | 直伤（声明） | 当前引擎未实现该乘区；DoT 无浮动 |

## 关于"全伤害是不是独立乘区"

wikily 的逐步表写得很明确：元素那一步是 \`× (1 + 该元素伤害 + Bonus All Damage)\`，**同一个乘区内部加算**。
所以 100% 火焰 + 100% 全伤 = ×3.0，而不是 ×4.0。

## 关于易伤

易伤（Vulnerable）是**目标受到伤害 +30%**，属于"目标受伤"通道，不是攻击者的条件伤乘区。
"对易伤目标 +X%"是另一回事：它在条件伤乘区里，只有目标处于易伤时才生效，按覆盖率折算。

两者可以同时吃：目标挂上易伤后，你既拿到 ×1.3，又拿到自己的"对易伤 +X%"。

## 关于静电（法师 30 点天赋）

静电充能（Static Charge）让闪电技能 100% 施加 Electrostatic：**目标受到的闪电伤害提高，最多 10 层**，只对闪电生效。
引擎把易伤与静电放同一个括号加算：\`× (1 + 0.30×易伤覆盖 + 0.10×静电层数)\`。层数可用 \`--electro\` 手动指定。

**系数已由 1.0.4 真源实锤**（2026-11-25 对齐）：\`StaticElectricity\` 是 \`DamageAmplificationBehavior\`，\`AmplificationPercent.Base=0.10\` → **每层 10%**；\`FilterByDamageType=true\`、\`AffectedDamageType=3(Lightning)\` → 只加闪电。旧 5%/6.6% 均为推断值，已弃用。

**结构仍未决**：静电（放大受伤 Behavior）与易伤（×1.3 VulnerableBehavior）是两种不同机制，真源无合并证据。默认加算，\`--taken-mode multiply\` 作敏感性对照——回答时说明口径，不武断断言。详见 \`/workspace/deskrawl-真源裁决-1.0.4.md\`。

## 上限

- 暴击率上限 ${M.caps.cc}%
- 冷却缩减上限 ${M.caps.cdr}%（真源 1.0.2b 实证 85→80，已确认）
- 减伤上限 ${M.caps.dr}%
- 直伤随机浮动 ${M.spread.min}–${M.spread.max}（仅数据声明，当前引擎未采样），DoT 不吃浮动、也不吃类型伤

## 持续时间伤害（DoT）

DoT 每跳按"武器伤害 × 每跳百分比 ÷ 持续时间"结算，乘主属性、元素+全伤、持续伤害加成、条件伤、受伤通道与减伤。
它**不吃**攻击类型伤（基础/强力/特殊），也**不吃** ±10% 浮动。
`;
  files.push(w('01-damage-model.md', body));
}

/* ---------------- 02 状态效果 ---------------- */
{
  const S = D.MECHANICS.status;
  const rows = Object.entries(S).map(([k, v]) => {
    const nums = Object.entries(v).filter(([x]) => x !== 'note').map(([x, y]) => `${x}=${y}`).join('，');
    return `| ${k} | ${nums} | ${v.note || ''} |`;
  }).join('\n');
  const body = `# 状态效果

| 状态 | 数值 | 说明 |
| --- | --- | --- |
${rows}

## 归类

- **受伤增加**：易伤 30%（真源 ×1.3 实证）、静电 10%/层（1.0.4 真源实锤，仅闪电）、脆裂（进暴伤池）。默认三者相关项按加算；静电×易伤结构无合并证据，\`--taken-mode multiply\` 作敏感性对照。
- **脆裂落地（1.0.4 真源已裁决）**：脆裂状态本身无伤害行为（\`Brittle\` Behaviors=[]）；增伤来自传奇戒指 \`LegendaryRing8CritDamage\` 的 \`ConditionalCritDamage\`（暴伤 += 0.05×层数，进暴伤池 \`1+cc×(cd+0.05×层数)\`）。引擎已按此口径，\`brittleZone\` 默认 \`crit\`（并入暴伤）/ \`taken\` / \`off\`，层数 0 时无影响。
- **减益**：减速（攻速 -25%、移速 -35%）、麻木之寒（目标造成伤害 -30%）
- **持续伤害**：流血（每秒物理）、中毒（每 2 秒毒）、燃烧（每 0.5 秒火）
- **控制**：冻结、定身、眩晕、短眩晕

## 易伤来源

战士英勇打击（20% 概率）、夺命钩（100%）、重击天赋（强力暴击施加）、猎人照明弹、法师奥术暴露（每 4 次强攻）、武僧破绽 5 层。
覆盖率是易伤类构筑的第一变量：45% 覆盖 = ×1.135，80% 覆盖 = ×1.24。
`;
  files.push(w('02-status-effects.md', body));
}

/* ---------------- 03 职业与技能 ---------------- */
{
  let body = `# 四职业技能（10/10 级数值）

技能倍率是"武器伤害的百分比"。多段技能（hits）已注明段数，引导技能按 持续时间/间隔 结算。
`;
  for (const key of ['warrior', 'sorcerer', 'hunter', 'monk']) {
    const c = D.CLASSES[key];
    body += `\n## ${c.name}（${c.en}）· 主属性 ${c.statName}\n\n${c.tagline}\n\n`;
    for (const [label, list] of [['基础攻击', c.basics], ['强力攻击', c.strongs], ['特殊技能', c.specials]]) {
      body += `### ${label}\n\n| 技能 | 元素 | 倍率 | 法力 | 冷却 | 说明 |\n| --- | --- | --- | --- | --- | --- |\n`;
      for (const a of list) {
        const hits = a.hits ? ` ×${a.hits} 段` : a.channel ? ` 引导${a.channel.dur}s/${a.channel.interval}s` : '';
        body += `| ${a.name} | ${ELE[a.ele] || '—'} | ${a.pct ? a.pct + '%' + hits : '—'} | ${a.mana || 0} | ${a.cd || '—'} | ${(a.text || '').replace(/\|/g, '/')} |\n`;
      }
    }
    if (c.sets) {
      body += `\n### 符文套装\n\n`;
      // 旧值黑名单：防止已弃用套装值从 data.js 回流到生成知识库（P0-3 回归防线）
      // 按「套装名 → 该套装专属弃用值」精确匹配，避免误伤其他套装的合法同名数值
      // （如冰封弹幕对减速 +65% 是正确值，只有地狱契约对燃烧 +65% 才是弃用值）
      const DEPRECATED_BY_SET = {
        '风暴召唤者': [/75%\s*[×x]\s*3/],
        '地狱契约': [/\+65%/]
      };
      for (const s of c.sets) {
        const bad = (DEPRECATED_BY_SET[s.name] || []).find(re => re.test(s.text));
        if (bad) {
          console.error(`[KB-黑名单] 套装「${s.name}」含已弃用值，命中 ${bad}：${s.text}`);
          process.exit(1);
        }
        body += `- **${s.name}**：${s.text}\n`;
      }
    }
  }
  files.push(w('03-classes.md', body));
}

/* ---------------- 04 天赋 ---------------- */
{
  let body = `# 天赋树

门槛：0 / 5 / 10 / 15 / 20 / 30 / 40 / 50 / 60 点。10、30、60 三行是"三选一"（专精行互斥）。
70 级共 70 点。
`;
  for (const key of ['warrior', 'sorcerer', 'hunter', 'monk']) {
    const c = D.CLASSES[key];
    body += `\n## ${c.name}\n`;
    for (const row of c.talents) {
      const cap = [10, 30, 60].includes(row.at) ? '（三选一）' : '';
      body += `\n### ${row.at} 点${cap}\n\n| 天赋 | 上限 | 效果 |\n| --- | --- | --- |\n`;
      for (const t of row.items) body += `| ${t.name} | ${t.max} | ${t.text} |\n`;
    }
  }
  body += `\n## 点法原则\n\n1. 先用主属性/攻速点开门槛，不要在一行里平摊。\n2. 三选一看构筑：走持续伤害选触发型，走直伤选倍率型。\n3. 同一乘区堆太多会稀释——主属性已经 7× 时，再点主属性的边际收益不如补类型伤。\n4. 用工具里的"自动规划"当基线，再按手感微调。\n`;
  files.push(w('04-talents.md', body));
}

/* ---------------- 05 传奇装备 ---------------- */
{
  let body = `# 传奇装备（全 64 件）

12 个部位：武器 / 头盔 / 肩甲 / 胸甲 / 手套 / 腰带 / 护腿 / 靴子 / 项链 / 戒指×2 / 披风。
**披风是纯外观**：没有基础属性、没有词条、没有被动。

每件传奇固定 4 主 1 副词条，外加下面的固定被动。职业限定表示只有该职业能穿/掉落。
`;
  const bySlot = {};
  for (const L of D.LEGENDARIES) (bySlot[L.slot] = bySlot[L.slot] || []).push(L);
  const order = ['武器', '头盔', '肩甲', '胸甲', '手套', '腰带', '护腿', '靴子', '项链', '戒指', '披风'];
  for (const slot of order) {
    const list = bySlot[slot] || [];
    body += `\n## ${slot}（${list.length}）\n\n| 名称 | 等级 | 职业 | 被动 | 数值口径 |\n| --- | --- | --- | --- | --- |\n`;
    for (const L of list) {
      const cls = L.cls ? L.cls.map(k => D.CLASSES[k].name).join('/') : '通用';
      const conf = { official: '官方数值', modeled: '按覆盖率折算', none: '无被动' }[L.conf] || '';
      body += `| ${L.name} | ${L.lvl > 1 ? 'Lv' + L.lvl : '—'} | ${cls} | ${L.text.replace(/\|/g, '/')} | ${conf} |\n`;
    }
  }
  body += `\n## 判断一件传奇值不值\n\n1. 它进的是哪个乘区？同类乘区已经很高时，它的实际收益会被稀释。\n2. 条件是否在你的对敌模型里成立？（对精英、对易伤、站定、单目标）\n3. 覆盖率是多少？"击杀后 3 秒"在 Boss 战里几乎等于没有。\n4. 有没有替代品占同一部位？（同部位只能 1 件，戒指 2 件）\n`;
  files.push(w('05-legendaries.md', body));
}

/* ---------------- 06 仆从 ---------------- */
{
  const M = D.MECHANICS.minion;
  let body = `# 仆从

只有**召唤中的那一只**生效。被动随技能等级成长，缰绳强化对每个被动/主动技能都生效。

## 等级与解锁

| 等级 | 解锁 |
| --- | --- |
| 1–4 | 只有被动 |
| ${M.gearStar} | 仆从装备槽 |

- 技能等级上限 ${M.levelMax}，需要同副本堆叠（5 级、10 级各要一个同款缰绳）。
- 传奇缰绳强化：同稀有度缰绳，48 小时，**自身技能 +${M.reinsBonus} 级**，可超过上限；缰绳的 +${M.reinsBonus} 对每个被动/主动技能都生效。
- 自身技能输出按 \`${M.selfBasePct}% + ${M.selfPerLevelPct}%/级\` 估算，不吃你的天赋与装备乘区，所以单列。

## 全部仆从

| 仆从 | 稀有度 | 被动 | 车厢容量 |
| --- | --- | --- | --- |
`;
  for (const m of D.MINIONS) {
    const b = [];
    if (m.bonus && m.bonus.vs) for (const [k, v] of Object.entries(m.bonus.vs)) b.push(`对${{ healthy: '健康', injured: '受伤', slowed: '减速', immobilized: '定身', elite: '精英', bleeding: '流血', poisoned: '中毒', burning: '燃烧', distant: '远处', vulnerable: '易伤' }[k] || k} +${v}%`);
    if (m.bonus && m.bonus.dmg) for (const [k, v] of Object.entries(m.bonus.dmg)) b.push(`${ELE[k] || { all: '全伤害', basic: '基础', strong: '强力', special: '特殊', dot: '持续' }[k] || k} +${v}%`);
    if (m.bonus && m.bonus.stat) for (const [k, v] of Object.entries(m.bonus.stat)) b.push(`${{ cc: '暴击率', cd: '暴伤', as: '攻速', cdr: '冷却', manaMax: '最大法力' }[k] || k} +${v}`);
    if (m.bonus && m.bonus.statPct) for (const [k, v] of Object.entries(m.bonus.statPct)) b.push(`${{ str: '力量', dex: '敏捷', int: '智力' }[k] || k} +${v}%`);
    if (m.bonus && m.bonus.def) b.push('防御向');
    if (m.bonus && m.bonus.mana) b.push('法力消耗 -10%');
    body += `| ${m.name} | ${m.rarity} | ${b.join('，') || '—'} | ${m.cap} |\n`;
  }
  body += `\n## 怎么选\n\n- 缺伤害：优先能进"你还没堆满的乘区"的那只（走闪电就冰霜猎犬/白骨收割者）。\n- 打 Boss：烬牙（对精英 +30%）、绯红谷领主（对易伤 +30%）。\n- 生存吃紧：古龙/树精/狼人这类防御向，或冰霜猎犬的护盾。\n- 车厢容量影响离线收益，长期挂机不要只看伤害。\n`;
  files.push(w('06-minions.md', body));
}

/* ---------------- 07 词条 ---------------- */
{
  let body = `# 词条与配装

传奇装备：4 主 1 副。词缀掷骰 = (1+稀有度加成) × 物品等级 × 每级基础值 × (0.85–1.15)，传奇 +60%。
下表是 ilvl 700 传奇**中值**（roll = 1.0），满掷需 ×1.15。

`;
  for (const [g, label] of [['stat', '属性'], ['dmg', '伤害'], ['util', '功能']]) {
    body += `## ${label}\n\n| 词条 | ilvl700 值 | 可出部位 | 限定 |\n| --- | --- | --- | --- |\n`;
    for (const [k, a] of Object.entries(D.AFFIXES[g])) {
      const slots = a.slots === 'all' ? '全部' : a.slots.map(s => ({ weapon: '武器', helm: '头盔', shoulder: '肩甲', chest: '胸甲', gloves: '手套', belt: '腰带', pants: '护腿', boots: '靴子', neck: '项链', ring: '戒指', back: '披风' })[s] || s).join('/');
      const lim = a.class ? a.class.map(x => D.CLASSES[x].name).join('/') : '';
      body += `| ${a.name} | ${a.v}${a.pct ? '%' : ''} | ${slots} | ${lim} |\n`;
    }
  }
  body += `\n## 优先级怎么定\n\n不要背固定顺序，用工具算：在当前面板下逐条试算"追加一条中值词条"的秒伤增量，取最高。经验规律：\n\n1. **武器 + 项链**：类型伤（基础/强力/特殊）几乎永远是第一词，因为它独占一个乘区。\n2. **戒指/项链**：暴率、暴伤在暴击乘区还低时收益最高。\n3. **护腿/肩甲（黑雾）**：可重铸，能吃到武器专属的对精英/元素伤。\n4. 元素伤堆到 200%+ 后，同数值的边际收益明显下降，该转条件伤或类型伤。\n`;
  files.push(w('07-affixes.md', body));
}

/* ---------------- 08 敌人与版本 ---------------- */
{
  let body = `# 敌人缩放与版本

## 敌人预设

| 预设 | 生命 | 精英 | 数量 | 备注 |
| --- | --- | --- | --- | --- |
`;
  for (const e of D.ENEMIES) body += `| ${e.name} | ${e.hp.toLocaleString()} | ${e.elite ? '是' : '否'} | ${e.count} | ${e.note} |\n`;
  body += `\n## 难度倍率

| 难度 | 生命 | 伤害 |
| --- | --- | --- |
| 普通 | ×1 | ×1 |
| 噩梦 | ×3.5 | ×1.35 |
| 地狱 | ×6 | ×1.8 |

精英：生命 ×3、伤害 ×1.5。等级 70 的等级倍率约为生命 ×399.9、伤害 ×62.8（相对 1 级）。

## 版本记录

`;
  for (const p of D.PATCHES) body += `### ${p.v}（${p.d}）\n\n${p.items.map(x => '- ' + x).join('\n')}\n\n`;
  body += `\n## 版本更迭时怎么更新这个项目\n\n1. 改 \`data.js\` 的 \`VERSION\` 与受影响技能/天赋/词条的数值。\n2. 改动记进 \`PATCHES\`。\n3. 跑 \`node agent/tools/build-kb.mjs\` 重建知识库。\n4. 打开网页核对总览数字；必要时跑 \`node agent/tools/calc.mjs --check\`。\n`;
  files.push(w('08-enemies-patches.md', body));
}

/* ---------------- 09 应答手册 ---------------- */
{
  const body = `# 应答手册（智能体怎么回答配装问题）

## 先问清楚三件事

1. **打什么**：小怪群 / 精英 / 区域首领 / 秘境高层？这决定条件伤与 AOE 权重。
2. **什么档位**：起步 / 中配传奇散件 / 毕业。同一件装备在不同档位的边际收益完全不同。
3. **现在卡在哪**：伤害不够、站不住、还是法力断档？三个问题的解法不重叠。

## 回答结构

1. **结论**：一句话给答案（换什么、点哪里、差多少）。
2. **依据**：说明它进的是哪个乘区，当前该乘区是多少，所以收益是多少。
3. **代价**：换掉的那件损失了什么，净收益是多少。
4. **验证方法**：告诉他怎么在游戏里确认（打桩、看跳字、换一件对比）。

## 常见问题模板

- "这件传奇值不值？" → 看部位是否冲突、条件是否成立、覆盖率多少、进的是哪个乘区。
- "词条怎么选？" → 用工具算边际收益，不要背表。
- "天赋怎么点？" → 先用自动规划当基线，再按三选一的手感调整。
- "为什么我伤害低？" → 依次查：技能等级、主属性、元素伤与全伤、类型伤、暴击期望、条件伤覆盖率、易伤覆盖率、减伤。
- "静电/易伤怎么算？" → 都属于"目标受伤"通道，默认内部加算；静电每层 10%、只加闪电；结构无合并证据，可用相乘口径做敏感性对照。

## 红线

- 不要把"对易伤目标 +X%"和"易伤 30%"算两遍。
- 不要把全伤当独立乘区（与元素伤加算，同一乘区）。
- 不要用 AOE 打群的数字去比较单体 Boss 的强度。
- 跨职业比较只在同装备档 + 同敌人 + 同技能组口径下成立。
`;
  files.push(w('09-playbook.md', body));
}

/* ---------------- kb.json：网页问答用 ---------------- */
const kb = {
  version: D.VERSION,
  docs: files.map(f => ({
    id: f.replace('.md', ''),
    title: fs.readFileSync(path.join(outDir, f), 'utf8').split('\n')[0].replace(/^#\s*/, ''),
    text: fs.readFileSync(path.join(outDir, f), 'utf8')
  })),
  facts: {
    zones: D.MECHANICS.zones,
    caps: D.MECHANICS.caps,
    status: D.MECHANICS.status,
    minion: D.MECHANICS.minion,
    legendaries: D.LEGENDARIES.length,
    minions: D.MINIONS.length
  }
};
fs.writeFileSync(path.join(root, 'agent/kb.json'), JSON.stringify(kb, null, 1), 'utf8');

/* kb-data.js：与 kb.json 同源的 JS 全局数据版本。
   file:// 直接打开时浏览器禁止 fetch 本地 json，改由 <script> 标签加载本文件，
   页面读取 window.DESKRAWL_KB；http 场景仍可 fetch kb.json 作为兜底/热更新。 */
fs.writeFileSync(
  path.join(root, 'agent/kb-data.js'),
  'window.DESKRAWL_KB = ' + JSON.stringify(kb) + ';\n',
  'utf8'
);

console.log('生成：', files.join(', '));
console.log('kb.json 文档数：', kb.docs.length);
console.log('kb-data.js 已同步生成（file:// 直接打开可用）');
