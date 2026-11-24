# 仆从机制与仆从装备

> 来源：`MINION_RESEARCH.md`（A 官方公告 + B 社区数据库交叉核实）、`data.js` / `engine.js`（已按调研修正）。
> 证据等级：**A**=官方公告原文；**B**=社区数据库（PlayOnGG / Wikily / deskrawl.tools / afkmeta）；**C**=推断；**D**=查不到。
> **已剔除的证伪说法**：「Passives do not level / 被动不随等级成长」「缰绳 +5 只加主动、被动不吃」「10 星共鸣被动 +50%」（全网查不到来源）、「仆从等级 = 技能等级上限 10」（混淆两层养成）。

## 1. 三层养成（不是同一个"等级"）

| 层级 | 范围 | 获取方式 | 证据 |
|---|---|---|---|
| 角色等级 | 70 级才开放仆从面板 | 角色经验 | B |
| **仆从训练等级** | **+0 → +10** | 击杀得经验（仅出战仆从得，1 点英雄经验 = 1 点仆从经验）；+10 需 204,036 XP，满级不再得 | B |
| **每个被动/主动技能等级** | 各自 **+0 → +10**，不得超过仆从自身训练等级 | 金币 + 物种材料；**升到 +5 与 +10 各需 1 条同款缰绳** | B |

官方 1.1.0："Minions now earn experience from kills, reaching +10. Materials upgrade their skills."（A）。技能数量因仆从而异（1~3+），**不能通用假设为"2 个技能"**。

## 2. 被动与主动随等级成长（A/B，推翻旧认知）

- 被动**随自身技能等级成长**：烬牙 Tyrant's Bane 对精英/Boss 伤 `+0=30% → +10=60%`（每级 +3 个百分点）；霜龙幼崽 Budding Sorcery 特殊技能伤 `+0=25% → +10=50%`（每级 +2.5 个百分点）（B，PlayOnGG 逐等级页）。
- 主动同样成长：烬牙 Ember Breath `+0=150% 武器伤/CD 4s → +10=250%/CD 2s`（B）。
- Wikily："A passive's value and an ability's numbers grow with its level."（B）。afkmeta 只列 +0 值并注明"每级增量不在我们的数据里"——是**数据缺口，不是不成长**。
- 反证：deskrawl.tools 现页**没有** "Passives do not level" 或等价表述，全网检索无命中 → 旧说法是产物误记/过时（B+D）。

## 3. 传奇缰绳 +5（官方原文，A）

> "Consume a Rein matching your minion's rarity to empower it for 48 hours. Empowerment raises the minion's own **skills** by 5 levels, including beyond their normal maximum. Skills inherited by other minions do not receive this bonus."
> —— 1.1.11 官方公告（https://gaugedb.com/news/4623570/1849192144180924 ，中文镜像 https://www.steambk.com/24006.html ）

- 作用于**每一个被动和主动**（Wikily 明确 "raises every passive and ability ... by 5 levels for 48 hours"），可超正常上限；满训练 + 满赋能 = 每个自己的技能 **15 级**。
- 训练等级 +0~+10 与临时 +5 是**两条独立轨道**；赋能需在城镇/训练场进行，结束后才能续；任意同稀有度缰绳都行（可交易缰绳会被永久消耗）。
- **继承来的那个技能不吃 +5**。

## 4. 技能继承槽（10 级真实解锁的东西）

- 机制是**一次性付费购买**（200 万金 + 1000 土精华），仅在**出战仆从训练等级 +10** 时生效；可放**另一只已解锁仆从的 1 个被动或主动**（B，Wikily）。
- **只有已经 +10 的技能才能被继承**；叠加官方"继承技能不吃赋能" → 取 **+10 级数值，不是 +15**（A+B 联合推导）。
- "10 星"是出战仆从的训练等级门槛，不是霓虹加成；**「10 星共鸣被动 +50%」查不到任何来源（D），已从知识库删除，不采用**。

## 5. 仆从被动加到哪一类（C，需实测确认）

总规则（B）："Gear bonuses add straight onto a stat, percent bonuses from runes, gems and talents multiply the total, and buffs apply last." 仆从被动按**与装备词条同池加算**处理：`+30% 闪电伤` → 闪电伤池；`+40% 暴伤` → 暴伤池；`+3% 暴率` → 暴率池。**只有出战仆从生效**（A/B）。但未逐条官方标注乘区，且**是否显示在玩家面板需实测**（见 `measurement-guide.md`），若面板已包含则计算器不可重复计入。

跨源数值冲突（**不裁决**）：Frozen Reach 30%(deskrawl.tools) vs 40%(afkmeta)；Sepulchral Scales 50% vs 100% MR；Ogre 对眩晕 30% vs 40%；灰森林狼攻速 5% vs 10%。以用户游戏内面板为准。

## 6. 仆从装备 = 第 13 件装备（数据充分，可用）

- **生效条件**：一次性购买（100 万金 + 100 Cinderlord Horns），**出战仆从训练等级 +5 或以上**才生效（B；Steam 论坛有"需 10 级"的冲突说法，待游戏内核对）。1.1.11 起仆从装备可升级（A）。
- **基底**（B）：`Saddle of the Golden Khan`（传奇，4 主 + 1 副）；`Fine Saddle` / `Golden Horseshoe` / `Iron Barding`（稀有，3 主 + 1 副）；另有黑雾版（固定 ilvl850）；远古传奇 = 传奇的**满装分 + 满掷变体**，非独立基底。
- **词条池 = 普通装备全池**，有明确数值公式；**无宝石孔**，传奇可升到 +13；副词条池含回血回蓝、寻找率、经验、移速等。

```
V(L, R, roll) = 中值(ilvl700传奇) × (L/700) × ((1 + bonus[R]) / 1.6) × roll
bonus: common 0.20 / uncommon 0.40 / rare 0.50 / legendary 0.60
roll ∈ [0.85,1.15]；远古传奇 roll=1.15 且 L 取区间上限
```

验证：playongg ilvl70 传奇暴伤 +5.7%~+7.7%、稀有 +5.4%~+7.2%，与公式完全吻合（B + 计算复核 C）。

- **作用对象**：装备页标注这些是角色属性（"Values are before upgrades, gems, and character modifiers"），像普通装备一样进玩家属性池 → **能当第 13 件装备**；但要加"训练等级门槛"开关、无宝石孔。产物原来的 4 个抽象 `gearOptions` 已由真实词条池替代。

## 7. 仆从自身输出（模型估算，B）

`selfPct = 30% + 4%/级 × 武器伤害` 是社区/产物模型估算，**非官方**；真实主动技能有逐等级表（烬牙 150%→250%）。单列、不吃玩家天赋与装备乘区。若要精确，需按每只仆从逐等级表重建。

## 8. 待用户裁决 / 查不到

1. 继承技能取值（推断 +10）；继承后能否继续训练、能否超过 +10。
2. 仆从装备生效门槛（专业库 +5 vs 论坛 10）。
3. 仆从被动是否进玩家面板（决定是否重复计入）。
4. 本地未收录的传奇仆从：Ancient Shellwarden、Armored Horse、Goblin Giant、Ogre、Venom Queen 等。
5. 部分传奇被动跨源数值冲突（见第 5 节）。

## 来源 URL

- https://gaugedb.com/news/4623570/1849192144180924 （A，1.1.11 缰绳 +5 原文）
- https://playongg.com/games/deskrawl/updates/patch-1-1-0 （A，仆从经验与材料升级）
- https://wikily.gg/deskrawl/minions/progression （B，三层养成/逐等级/继承槽/装备门槛）
- https://playongg.com/games/deskrawl/minions/volcanodragon （B，烬牙逐等级数值）
- https://www.deskrawl.tools/guides/item-level （B，稀有度与掷骰公式）
