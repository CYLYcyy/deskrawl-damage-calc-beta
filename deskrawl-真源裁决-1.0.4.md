# Deskrawl 真源裁决报告 — 1.0.4（2026-11-12 补丁）

> 真源：`CYLYcyy/Deskrawl-Reverse`，最新 commit `84e1727`（重导 1.0.4 全量数据，buildid 26606215）。
> 裁决日期：2026-11-25。所有结论均来自字节级 SO dump 或指令级文档，标注 ✅ 实证 / 🔶 推断。

## 0. 版本号口径统一（重要）

- 真源把 2026-11-12 补丁记为 **1.0.4**；计算器标 **1.1.11a**。
- 两者是**同一个补丁**：日期一致、内容一致（新增套装符文/仆从装备 Slot12/远古装备）。
- 旧判断「dump 落后于 1.1.11」作废——我们缺的是同一版本的高精度 dump，现已在手。
- 结论：计算器统一采用真源版本号口径，note 中注明 "Steam 展示号 1.1.11a = 内部补丁 1.0.4"。

## 1. 静电（StaticElectricity）✅ 实锤

真源 `StatusEffectData.json` pathid 64917：
- `Stackable=true`, `MaxStacks=10`, `Duration=4s`
- `DamageAmplificationBehavior`: `AmplificationPercent.Base = 0.10`（每层 10%），`PerLevel=0`
- `FilterByDamageType=true`, `AffectedDamageType=3` = **Lightning（闪电）**

**裁决**：
- 真源确为 **每层 +10% 闪电受伤**（最大 10 层 → ×2.0），与我们默认 5% 冲突。
- 按「全面对齐真源」决定：**默认改为 10%/层**，保留 5% 作为历史口径候选（用户旧拍板值）在前端标注。
- 静电**只放大闪电伤害**（FilterByDamageType=true），非全元素——需在引擎按伤害类型门控。
- 静电 × 易伤的乘区结构：真源里静电是 `DamageAmplificationBehavior`（放大受伤），易伤是 `VulnerableBehavior`（×1.3 固定）。二者都是受击方通道的放大，真源内核未实现静电放大（grep 无 amplification 计算），故结构上无「加算/相乘」的指令级结论——保留我们现有「默认加算、真源候选相乘」的未决项标注，不静默改。

## 2. 易伤（Vulnerable）✅ 实锤

- 真源 `VulnerableBehavior` pathid 64929，非叠层，Duration 3s。
- 伤害链路步骤 8：`dmg = round(dmg × 1.3)`，固定乘区（独立）。
- 同时 `VulnerableDamage(40)` 计入乘区 C 条件池。
- **两者同时生效**：×1.3 固定 × (1 + 条件池含 VulnerableDamage)。

**裁决**：与我们模型一致（易伤 ×1.3 + 条件池），无需改。我们「静电×易伤默认加算」的未决项维持，因为是两种不同 Behavior，真源无明确合并证据。

## 3. 脆裂（Brittle）✅ 实锤，机制需修正认知

真源 `StatusEffectData.json` pathid 5755：
- `Stackable=true`, `MaxStacks=100`, `Duration=6s`
- 状态本身 `Behaviors=[]`（不自带增伤）；`ScalePerStack=0.2` 是**视觉缩放**，非伤害。

真正的脆裂增伤来自**传奇戒指** `LegendaryRing8CritDamage`（pathid 5184）：
- `EquipmentEffect_ConditionalCritDamage`, `Condition=5`（SpecificStatus）
- `Status=5755 (Brittle)`, `BonusCritDamage=0.05`, `ScaleByStatusStacks=true`
- 效果：目标处于 Brittle 时，暴伤 `+= 0.05 × 层数`（真源内核断言：3 层 → +0.15）。

**裁决**：
- 我们模型的 `brittleStacks/brittleZone` 把脆裂做成**独立乘区** `×(1+0.05×stacks)`（crit 区）——数值接近但路径不同。
- 真源路径是**进暴伤加成池**：`crit = 1 + cc × (cd + 0.05×stacks) × (1−critDR)`。
- 按「全面对齐真源」决定：**改为暴伤加成口径**（仅当装备了 LegendaryRing8 或等效来源时才生效；否则脆裂本身不增伤）。
- 保留 `brittleStacks/brittleZone` 参数作为手动模拟入口，但 note 说明真实来源是传奇戒指。

## 4. 属性聚合（三层模型）✅ 需对齐

真源：`Final(stat) = (Base + ΣFlat) × (1 + ΣPercentAdd) × Π(1 + PercentMult)`。
- 我们模型多数是 `(1 + Σ所有%)` 的简化。装备/宝石/符文走三层，技能乘区走独立乘区——需要引擎层区分。
- 这是底层结构性差异，重灌时逐字段核对。

## 5. 封顶（StatCap.GetCap）✅

| 属性 | 上限 |
|---|---|
| CritChance / Dodge / ManaCostReduction | 0.85 |
| CooldownReduction | 0.80 |
| 减伤类 | 0.90 |
| FinalDamageReduction(66) | inf（无上限，绝对减法） |

**裁决**：我们 README 写 CDR 0.80 正确；暴击 0.85 正确。一致。

## 6. 结构差异 ✅ 经精确核实：无需改引擎（推翻初判）

初判认为要补三项乘区，经子 agent 逐项核实（见 artifact `engine-gaps.md`，含 RVA 指令级证据）后**全部推翻**——避免了一次无收益的大重构：

1. **三层聚合 PercentMult(Type:2)**：初判「111 次」是**文本误匹配**（94 消耗品类别 + 5 任务需求 + 12 真实 StatModifier）。真实 12 个全在 AttackSpeed/MoveSpeed/WeaponDamage，**伤害关键属性（元素/主属性/暴伤/33/34/61/62/64/65）Type:2 = 0 个**。唯一伤害相关是玩家侧「清算」叠层 Buff（传奇锤，我方未收录）。→ **暂不接入通用乘算层**，登记为结构缺口。
2. **技能类型乘区 Slot 16**：真源确为三项独立加算（多标签双吃），但 134/134 技能**全是单类型标签**，双标签 0 例。我方 `ab.type` 单分类与数据一一对应，`1+agg[ab.type]/100` 完全等价。→ **现有实现足够，无需改**。
3. **最终减伤 FinalDamageReduction(66)**：乘区后绝对减法、无上限、不进 DPS 倍率。数据落点**唯一且在玩家侧**（磐石护腿 Flat 300），敌人侧 0 处 → 对输出 DPS 零影响。→ **低优先级可选**，默认 0 时对现有构筑零变化；若要接入加 `ctx.finalDR` 在 hitZones/DoT tick 后按次扣减，切勿塞进 `zoneSet.list`。
4. **DoT 乘区**：我方引擎**已有** `dotTick()`（62 同池 + 条件池 + 暴击），初判「没有 DoT」错误。→ 无需补。

> 结论：三项均非当前阻塞，不改引擎。这纠正了初版裁决的过度表述。

## 7. 装备词条 Roll 公式 ✅ 一致

`value = (1+rarityMul) × itemLevel×perLevel × rollFactor (+5 if stat20)`，保留 3 位小数。
- rarityMul: Common .2 / Uncommon .4 / Rare .5 / Legendary .6。
- rollFactor: 1.15（取最大）或 Random(.85,1.15)。
- 55 项 perLevel 系数按 1.0.4 地址重算，与原文件一致。
- **裁决**：与 affix.js 一致，无需改。

## 8. 技能倍率 ✅ 待技能映射完成后重灌

- 真源技能用内部名（WarriorBasicAttack1 等），134 个，含 AttackScaling Base/PerLevel（ObscuredFloat 包裹，真实值在 `.value`）。
- 已知差异候选：横扫（我们 70%+3%/级，旧真源 1.0.3 为 50%+2.5%）、闪电风暴（我们 225%+7.5%/级×3）。
- 由子 agent 产出 skill_mapping.json 后逐项重灌。

## 裁决汇总表

| 争议项 | 旧默认 | 1.0.4 真源 | 决定 |
|---|---|---|---|
| 静电/层 | 5% | **10%** | 改 10%，5% 留候选标注 |
| 静电范围 | 全元素 | **仅闪电** | 按类型门控 |
| 静电×易伤 | 默认加算 | 两种 Behavior，无合并证据 | 维持未决项 |
| 易伤 | ×1.3 + 条件池 | 同 | 不改 |
| 脆裂 | 独立乘区 ×(1+.05×层数) | **暴伤 += .05×层数（传奇戒指）** | 改暴伤口径 |
| CDR 上限 | 0.80 | 0.80 | 不改 |
| DoT | 已有 dotTick | 62 同池 + 条件池 + 暴击 | 已覆盖，不改 |
| 技能类型乘区 | ab.type 单分类 | 33/34/61 独立加算，但技能全单标签 | 等价，不改 |
| 三层聚合 PercentMult | 标量加算 | Type:2 仅 12 个，伤害属性 0 | 清算锤单独接入，其余暂不接入 |
| 最终减伤66 | 无 | 玩家侧绝对减法，敌人侧 0 | 低优先级可选，默认 0 |

## 9. 补齐未建模内容（2026-11-25 续）

基于真源逐件核实，把"可计算"与"依赖覆盖率/敌人数"分开处理，不伪造固定 fx：

| 项目 | 真源依据 | 处理 |
|---|---|---|
| 清算锤（魔翼/远古） | `Reckoning(5773)` Stat20 **Type:2** +1%/层，50 层上限；远古 +1.25%（pathid 5110/5120） | **已接入**：`wdOf = (白字+平伤)×(1+per)^层数`；层数用户录入（前端控件 / `--reckoning`），不按暴击频率脑补。CLI 验证 10 层 = 基准×1.01^10 / ×1.0125^10 |
| 棱彩之心 | `HighestElementalDamageBonus BonusIncrease=0.25`（pathid 64193） | **已接入**：`fx.ele=25` 归主元素进元素加算池。单主元素 build 精确，多元素均衡为近似（note 标注） |
| 终斩印戒 | `AbilityStatusDamage DamageBonus=2.5`（pathid 5185），绑定技能 64251×状态 64857 | **保持 mechanism**：特定技能×特定状态 +250%，覆盖率未知；note 给手动公式 |
| 噬魂肩甲 | `DamagePerNearbyEnemy 0.03, BossWeight=5, Radius=3`（pathid 64198） | **保持 mechanism**：依赖半径内敌人数；note 给手动公式（Boss 按 5 = +15%） |
| 黄金可汗之鞍 | pathid 5308，Slot 12 仆从装备 | **保持 mechanism**：无玩家 DPS 特效 |
| 无尽流之器 | `DamagePerStatusStack 2.2/层 Tag=12(Chi)`（pathid 5141） | **保持 mechanism**：依赖真气层数，旧 procDps 已删 |
| 仆从扩充 | `SlaveData.json` 68 个 | **+8 个**：仅收录带明确 DPS 被动者（statId 23/27/30/33/43/58/61 实证）；其余 29 个坐骑/防御/资源类对 DPS 无贡献，不收录。31→39 |

> 原则：确定性乘算层（清算锤）与确定性元素加成（棱彩）接入引擎；一切依赖覆盖率/敌人数/层数的效果保留 mechanism + 手动公式，不静默折算固定秒伤。

## 10. 宝石镶嵌 + 仆从成长（2026-11-25 第二轮，前端产品升级）

用户反馈"宝石镶嵌、仆从伤害提升建模太简单"。先加载 UI/UX 设计系统完成"前端产品经理"能力升级，再从真源逐字段挖出两块机制，结论：**不是太简单，是错把动态系统当常量**。

### 10.1 宝石镶嵌（此前零建模）

| 项 | 真源依据 | 处理 |
|---|---|---|
| 数据结构 | `GemData.json` 42 条 = 6 家族×7 品级；每颗 `WeaponBonuses/ArmorBonuses/AccessoryBonuses` 三套加成 | **全量建模**：data.js `GEMS`（GRADES/FAMILIES/SLOT_TYPE/SLOT_CAP） |
| 武器槽 | 元素伤% 10/15/20/25/35/50/70（全家族同值、按家族元素） | **接入元素加算池** `1+元素%+全伤%`，只被同元素技能吃；`gemsToMods` → `s[element]` |
| 护甲槽 | 红力量/黄敏捷/紫智力/钻CDR/蓝生命%/绿荆棘，固定值不随等级（docs/04 §GemData） | 接入主属性/CDR/生命/荆棘；DR 仅展示不进 DPS |
| 饰品槽 | 对应元素减伤% | 存 `s.gemDR` 供生存视图，不进 DPS |
| 孔位 | `ItemizationConfig` 武器3/胸甲2/护腿2/头戒链各1；`MinLevelForSockets=30` | UI/CLI 按 `SLOT_CAP` 约束 |
| 验证 | 战士火系镶3颗7级红宝石 DPS 146.9万→227.1万；换黄玉回基线；单跳元素乘区 ×2.5→×4.6（+210pt） | CLI `--gems` + 浏览器回归 PASS |

### 10.2 仆从被动成长（推翻此前"PerLevel 全 0"误判）

| 项 | 真源依据 | 处理 |
|---|---|---|
| 成长公式 | `SlaveData[].Passives[].Modifier.Value.{Base,PerLevel}`，`Value(L)=Base+PerLevel×(L−1)` | **修正引擎**：成长基准 `skillLv−10` → `eff−1`（Base 是 1 级值）；`bonusPerLevel=PerLevel/Base` |
| PerLevel 实测 | 83 个被动 PerLevel≠0（此前"77/77 全0"是读错字段）；31/39 已建模仆从按 statId 灌 ratio，绝大多数 0.10、灰烬领主 CDR 0.0667 | data.js 补 `bonusPerLevel`；前端显示成长后数值+1级基准+成长系数 |
| 缰绳推动 | `UI.SlaveEmpowerDesc` 缰绳赋能所有技能+N级 | 成长等级用 `eff`（含缰绳+5、可超10；继承槽固定10不吃缰绳）。南瓜王 vs受伤 L1=50%→L10=95%→L15缰绳=120% |

> 至此数据/代码层面无剩余未决项。唯一仍需用户本地 2×2 木桩实测的是「静电×易伤结构」（加算 vs 相乘），真源两种 Behavior 无合并证据，引擎默认加算 + 相乘敏感性对照。

## 11. 二轮产品升级：职业主属性 bug 修复 + 宝石最优求解 + 无障碍加固（2026-11-25）

### 11.1 【正确性 bug 修复】职业主属性只吃对应那一个

| 项 | 发现 | 修复 |
|---|---|---|
| 症状 | 宝石求解时发现法师镶红宝石（力量）也涨 DPS——引擎 `attrOf = str+dex+int` 把三个主属性加总 | 真源 `docs/04` §6.2.0/§552：`Player.bjr` 的 `主属性 = Player.fak()` 返回**英雄职业对应的那一个**（战士力量/法师智力/猎人与武僧敏捷），其余属性经 StatConversion 转 |
| 修复 | `aggregate` 在 `_cfg` 带 `classStat`；`attrOf(agg)` 改读 `agg[agg._cfg.classStat]`，无 `_cfg` 时才回退三者之和 | 4 个调用点（hitZones/dotTick/procDps/地狱风暴）无需改，只改 attrOf 一处 |
| 验证 | 法师/战士/猎人镶各自主属性宝石 +3.2%，镶副属性宝石 = 基线（无白拿）；CLI 自检基准仍 183541、PASS | 修复符合真源，消除"全属性词条让法师白拿力量"的隐藏高估 |

### 11.2 宝石最优镶嵌求解器

- `engine.js solveGems(cfg, opts)`：逐孔贪心，候选=空+6家族×品级上限，评分=lite simulate DPS；饰品槽不进 DPS 保持空。
- 前端装备页「⚡ 一键最优镶嵌」按钮，点击试算并写入 state；CLI `--gem-solve` / `--gem-grade N`。
- 求解器忠实反映真实技能轴：战士默认轴火技能占比高→武器选红宝石（火伤）；猎人毒技能→绿宝石；护甲一律选职业主属性宝石。
- 验证：战士基线 18.7万→最优 39.9万（+113.3%）；浏览器点击后 146.9万→268.9万（+82.8%），0 JS 错误。

### 11.3 无障碍 / 主题规范加固（Web Interface Guidelines 审查）

| 项 | 修复 |
|---|---|
| 深色主题原生控件白底 | `<html color-scheme:dark>` + select/input/button color-scheme + `<meta theme-color>` |
| 键盘焦点不可见（6 处 outline:none） | 全局 `:focus-visible` 金色描边；`input:focus` 只改边框，焦点描述交给 `:focus-visible` |
| 移动端双击缩放延迟 | `touch-action:manipulation` + `-webkit-tap-highlight-color` |
| 动画无降级 | `@media (prefers-reduced-motion:reduce)` 全部动画/过渡归零 |
| 图标按钮无标签 | 宝石清除按钮、存档/未决关闭按钮补 `aria-label` |

### 11.4 双引擎交叉校验工具（正确率的硬证据）

- 新增 `agent/tools/cross_validate.py`：以作者 GUI 引擎（指令级逆向、更高采信度）为 golden source，对同一组面板参数（火伤120/全伤30/暴击30/暴伤220/主属性620/易伤40/武器200/倍率2.0）比对底层乘区。
- 结果 **5/5 逐位一致**：元素+全伤 2.5、主属性 7.2、暴击率 0.3、条件池 1.4、易伤 1.3。
- 这直接回答"伤害对比能完美确保正确率吗"：**底层乘区公式与更高采信度的作者引擎逐位一致**；剩余不确定性只在覆盖率/静电×易伤结构（场景量/真源无定论），非公式错误。
- 工具可重复运行（`REVERSE_TOOLS` 指向 reverse/tools），引擎每次改动后重跑即构成正确性回归。
