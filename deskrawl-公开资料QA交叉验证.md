# Deskrawl 公开资料 QA 交叉验证报告

> 生成时间：2026-11-25 ｜ 对齐目标：Steam 1.1.11a / 内部 1.0.4（buildid 26606215）
> 目的：在不依赖游戏内 absolute 实测的前提下，用公开讨论对本地模型做独立交叉验证，替代用户反复手工 QA。

## 一、资料源与可信度分级

| 级别 | 来源 | 用途 | 备注 |
|---|---|---|---|
| T0 真源 | Deskrawl-Reverse SO dump（本地，1.0.4） | 最终裁决 | 字节级，最高优先级 |
| T1 官方 | Steam 商店页 / 1.1.11a 补丁公告（gdgame 镜像） | 版本号、系统清单 | 确认 buildid 26606215 = 1.1.11a |
| T2 数据 Wiki | [wikily.gg/deskrawl](https://wikily.gg/deskrawl)、[deskrawlguide.wiki](https://deskrawlguide.wiki/) | 规模数字、等级/符文规则 | 结构化二手，标注日期 |
| T3 二手攻略 | [gameplay.tips 伤害指南](https://gameplay.tips/guides/deskrawl-idle-arpg-damage-calculation-guide.html)、[treyexgaming](https://www.treyexgaming.com/deskrawl-idle-arpg-beginner-guide/)、gamepretty / ninewiki / pixelnitro 职业 build | 公式结构、词条作用 | **内部有自相矛盾，仅作佐证不作裁决** |

## 二、交叉验证结果

### ✅ 一致（公开资料独立佐证本地模型）

| 项目 | 公开资料 | 本地模型 | 判定 |
|---|---|---|---|
| 技能总数 | 每职业 4 基本 + 4 强攻 + 6 特殊 = 14，共 56 | 56（4×14，逐职业已核） | ✓ |
| 职业主属性 | 战士力量 / 法师智力 / 猎人敏捷 / 武僧敏捷 | 完全一致 | ✓ |
| 等级上限 | 70，Paragon 70 解锁 | 基准等级 70 | ✓ |
| 基础伤害结构 | `武器DPS/武器速度 + Damage` | `trunc(Final(WeaponDamage)) + Final(Damage)` | ✓ 结构同构 |
| 主属性乘区 | `1 + 主属性/100` | 同 | ✓ |
| 条件伤同池 | Boss 伤与易伤同属 Conditional 池 | `vs` 池加算后乘（`vsElite`/`vsVulnerable` 同池） | ✓ 结构同构 |
| 符文槽 | 6 槽，套装 2/4/6 档 | 6 槽自由配置，2/4/6 自动统计 | ✓ |
| 宝石家族 | 6 种宝石（wiki: "6 gems"） | 6 家族 | ✓ |
| 元素伤进普攻 | 元素% 可为普通攻击附加元素伤 | 元素/全伤加算池，按技能元素取值 | ✓ |
| 难度 | Normal / Nightmare / Inferno | 一致（敌人数值本轮不建模） | ✓ |

### ⚠️ 口径差异（已裁决：维持真源，记录在案）

| 项目 | 公开资料说法 | 本地取值 | 裁决与理由 |
|---|---|---|---|
| 易伤基础值 | gameplay.tips 称 "50% base Vulnerable DMG" | ×1.3（+30%，taken 池独立） | **维持真源**。该攻略同页 Conditional 自相矛盾（3.0 vs 3.5），且把"易伤状态本身"与"易伤伤害词条"混为一谈；真源 dump 实证 ×1.3 硬编码。 |
| 宝石品级数 | wikily 称 "6 tiers each" | 7 级（GRADES 1–7，[10,20,40,80,105,130,160]） | **维持真源并标记待核验**。本地 7 级来自 dump pathBase，公开 wiki 可能统计口径不同或已过时；不影响公式，只影响镶嵌档位展示。 |
| 天赋点数 | treyexgaming 称"70 级共 69 点"，部分 build 攻略按"60 级 60 点" | 预算条按用户拍板 70/70 | **维持用户口径**；公开资料自身两种说法冲突，Capstone 门槛（10/30/60）与我们一致。 |

### 📌 公开资料有、本地明确不建模（边界声明，非缺陷）

- 伤害 RNG `90%–110%`：我们输出期望值，不模拟随机浮动（计算器惯例）。
- 装备启明（+10 装 2 次，每次全属性 +5%）、符文重铸概率、Paragon 点数：属成长/经济系统，非伤害公式核心。
- 仆从全量 68 只：本地收录的是"有被动数值贡献"的子集，纯载具/外观仆从不进 DPS。

## 三、QA 结论

1. **模型骨架获得独立佐证**：基础伤害结构、主属性/元素/条件乘区、技能规模、符文槽、宝石家族均与公开资料一致，无系统性问题。
2. **三处口径差异均可解释**，真源 dump 优先级高于二手资料，本轮**不改数值**，仅登记待核验项。
3. **发现并修复一个工程缺陷**：`agent/kb.json`、`agent/kb-data.js`、`agent/knowledge/06-minions.md` 滞后于 `data.js`（1.1.11a 真源更新后未重建知识库）。已重跑 `build-kb.mjs` 修复。
4. **可持续 QA**：本报告的"来源分级 + 一致/差异/边界三分类"可作为每次真源更新后的固定回归模板。
