# 真源实证事实表（1.0.4 dump，2026-11-25 全面对齐）

> 来源：`CYLYcyy/Deskrawl-Reverse` commit `84e1727`，重导 **1.0.4** 全量 SO（buildid 26606215，2026-11-12 补丁）。
> **版本口径**：Steam 展示号 **1.1.11a = 内部补丁 1.0.4**（同一天同一补丁）。旧「1.0.3 落后于 1.1.11」判断作废——缺的从来是高精度 dump，现已在手。
> 完整裁决：`/workspace/deskrawl-真源裁决-1.0.4.md`；结构差异核实：`engine-gaps.md`（artifact）。
> 采信度：官方 > 游戏本体逆向（本表）> 社区数据库 > 推断 > 查不到。

## 一、真源已实证、本地已对齐（可直接采信）

| 项 | 1.0.4 真源值 | 证据 | 本地状态 |
| --- | --- | --- | --- |
| 易伤幅度 | 固定 **×1.3** + VulnerableDamage 进条件池 | `docs/04` 步骤8 `dmg=round(dmg×1.3)`；`VulnerableBehavior` pathid 64929 | ✅ `taken:30`；真源 dur=3s，本地 4s 存疑（不影响幅度） |
| CDR 上限 | **80%** | `StatCap.GetCap` 查表 1.0.4 逐字节一致 | ✅ `caps.cdr:80` |
| 暴击/闪避/蓝耗上限 | 85%；减伤 90% | `StatCap.GetCap` 分档 | ✅ `caps.cc:85, dr:90` |
| **静电** | **每层 10%**、最多 10 层、**仅闪电** | `StaticElectricity` pathid 64917：`DamageAmplificationBehavior AmplificationPercent.Base=0.10`、`MaxStacks=10`、`FilterByDamageType=true`、`AffectedDamageType=3(Lightning)` | ✅ 2026-11-25 从 5% 改为 10%；旧 5%/6.6% 已弃用 |
| **闪电风暴** | 10 级 **217%**（Base 1.5 + 0.075/级） | `AbilityData.json SorcererStrongAttack3` `AttackScaling.value` | ✅ 从 225% 改为 217%；≈用户实测 218%（同源） |
| **横扫** | 10 级 **97%**（Base 0.7 + 0.03/级） | `WarriorBasicAttack2` | ✅ 本地 97% 已正确 |
| 技能等级成长 | `倍率(N)=Base+max(0,N−1)×PerLevel` | `docs/04` §6.2.0 | ✅ 引擎 `pctAtLevel`（44 技能按真源重灌） |
| 武器白字 | `Final(WeaponDamage=20)` 进伤害基项、乘倍率 | `Player.bjr` 原式 | ✅ `weaponDamage` 走 stat20；白字勿塞 baseDamage |
| BaseDamage 固定项 | 玩家 49/49 段全为 0 | `DamageEffect.BaseDamage` 穷举 | ✅ 引擎 `s.baseDamage=0` |
| 装备词条 Roll | `(1+rarityMul)×ilvl×perLevel×rollFactor`（stat20 +5） | `ItemizationConfig` + `docs/04` §6.3 | ✅ affix.js 一致，55 项系数未变 |

## 二、真源给了证据但结构仍无定论（保留敏感性口径）

| 项 | 真源情况 | 处理 |
| --- | --- | --- |
| 静电 × 易伤结构 | 静电=`DamageAmplificationBehavior`、易伤=`VulnerableBehavior`，两种不同 Behavior，真源**无合并证据** | 默认**加算**（`taken:'additive'`）；`--taken-mode multiply` 作敏感性对照。回答时说明口径，不武断断言 |

## 三、真源已裁决的机制（初判「待实测」已移除）

| 项 | 1.0.4 裁决 | 处理 |
| --- | --- | --- |
| **脆裂 Brittle** | 状态本身 `Behaviors=[]` 无伤害；+5%/层来自传奇戒指 `LegendaryRing8CritDamage` 的 `ConditionalCritDamage`，进**暴伤池** `1+cc×(cd+0.05×层数)` | ✅ 引擎已从「独立乘区」改为「并入暴伤」，默认 `brittleZone:'crit'` |
| 三层聚合 PercentMult | 三层模型真实存在，但真实 `Type:2` 仅 12 个，全在 AttackSpeed/MoveSpeed/WeaponDamage；伤害关键属性 0 个 | 暂不接入通用层，登记结构缺口（清算锤未收录） |
| 技能类型乘区 Slot16 | 33/34/61 真源独立加算，但 134/134 技能全单标签 | `ab.type` 单分类等价，不改引擎 |
| 最终减伤 66 | 乘区后绝对减法、无上限，数据只在玩家侧磐石护腿 | 对输出 DPS 零影响，低优先级可选（默认 0） |
| DoT | 引擎已有 `dotTick`（62 同池 + 条件池 + 暴击） | 已覆盖，无需补 |

## 四、真源仍无答案（维持近似 / 标文案级）

| 项 | 真源情况 | 处理 |
| --- | --- | --- |
| 充能之戒 K 值 | 仅 `MaxBonus=0.5`，无独立 K/曲线 | 本地"50%×0.7 uptime"近似，维持 |
| 仆从被动成长 | 68 条 SlaveData 无被动 PerLevel 成长字段；养成是 1.1.0 引入 | 保留成长路径，标"真源未给系数"，不编造 |
| 新增传奇的机制折算 | 棱彩之心/终斩印戒/噬魂肩甲等依赖覆盖率/敌人数 | 标 `conf:'mechanism'`、记真源数值，不折算固定 fx |

## 五、回答机制问题时的标准话术

1. 先查本表：**已实证**的直接给值，标"1.0.4 真源实证"。
2. **结构无定论**（静电×易伤）：说"默认加算，真源两种 Behavior 无合并证据，可用相乘做敏感性对照"。
3. **真源也没有**的：说"真源 SO 无此数值，维持近似"，绝不编造。
4. 版本标注："1.0.4 SO dump（= Steam 1.1.11a，2026-11-25 对齐）"。

## 六、如何更新本表

游戏再更新后，按 `patch_regression.py --live` 重导 SO，逐项对比本表：静电/易伤结构是否出现合并证据、新增双标签技能、PercentMult 是否落到伤害属性、仆从成长系数。更新后同步 `data.js`、`engine.js`、`SKILL.md`，跑 `build-kb.mjs` 重建知识库。
