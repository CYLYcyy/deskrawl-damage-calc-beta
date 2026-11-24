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
