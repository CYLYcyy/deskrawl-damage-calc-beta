---
name: deskrawl-damage-analyst
description: Deskrawl（桌面破坏神 / Deskrawl Idle ARPG）伤害与配装分析。当用户问某个技能打多少、为什么伤害低、装备/词条怎么选、天赋怎么点、仆从怎么带、符文与技能等级怎么算、宝石怎么镶、某件传奇值不值、来源冲突信谁、某未明项怎么实测，或需要跨构筑比较时使用。基于本仓库的计算器：70 件传奇、四职业 56 技能、天赋树、39 仆从、241 符文与 20 套、宝石 6 家族×7 级×3 部位、装备数值函数（任意装分×稀有度）。数据版本 1.0.4（= Steam 1.1.11a，SO dump buildid 26606215）。
agent_created: true
---

# Deskrawl 伤害实验室 · 协作技能

这个技能是**算数字 + 裁来源 + 给实测步骤**，不是查资料。每个结论都要能落到"哪个乘区、当前多少、所以收益多少"，并说明证据等级。

## 一、数据分层（唯一真源）

| 层 | 文件 | 规则 |
| --- | --- | --- |
| 数值真源 | `data.js`（VERSION/MECHANICS/技能/天赋/传奇/仆从/敌人）、`affix.js`（装备数值）、`runes.js`（符文/套装）、`minion-data.js`（仆从技能库） | 改数值只改这里 |
| 算法 | `engine.js`、`solver.js`、`combo-solver.js` | 机制变化才改，改动前后跑回归 |
| 生成物 | `agent/knowledge/*.md`、`agent/kb.json`、`agent/kb-data.js`、根目录 `deskrawl-lab.html` | 由真源生成，**禁止手改** |
| 产品文档 | `README.md`、`CHANGELOG.md` | 面向使用者，不是给 AI 的规则 |

知识库生成链：`data.js` → `build-kb.mjs` → 10 篇 md + `kb.json` + `kb-data.js` → `build-standalone.mjs` → 单文件。网页"智能体"页用 kb-data 检索，命令行技能直接调引擎。

## 二、采信度与回答纪律

1. **采信度**：官方 > 游戏本体逆向（SO 直出）> 社区数据库 > 推断 > 查不到（不编造）。冲突时取高者，并明确告诉用户"取了谁、弃了谁、依据是什么"。
2. **已证伪值禁止写回**：静电 5%/6.6%、闪电风暴 225%、仆从被动不成长、`30%+4%/级` 仆从伤害、旧 199 符文/13 套/64 传奇。
3. **未明项给选项卡**：先说当前口径与证据等级，再给"系统默认 / 另一口径 / 我实测过"三选一与可行实测步骤；用户一手实测覆盖系统默认。不静默采用默认值。
4. **过时即删除**：不留兼容分支、不写"旧值仍可选"。

## 三、当前有效真源结论（1.0.4 = Steam 1.1.11a）

### 已实证，直接用

| 项 | 值 | 证据 |
| --- | --- | --- |
| 版本口径 | Steam 1.1.11a = 内部补丁 1.0.4（同日同补丁） | buildid 26606215，2026-11-12 |
| 静电 | 每层 **10%**、最多 10 层、**只加闪电** | `StaticElectricity` pathid 64917：`AmplificationPercent.Base=0.10`、`FilterByDamageType=true`、`AffectedDamageType=3` |
| 易伤 | 固定 **×1.3** + VulnerableDamage 进条件池 | `VulnerableBehavior` pathid 64929；步骤8 `dmg=round(dmg×1.3)` |
| 脆裂 | 状态本身不增伤；**+5%/层来自传奇戒指** `LegendaryRing8CritDamage`，进**暴伤池** `crit=1+cc×(cd+0.05×层数)×(1−critDR)` | pathid 5184 `BonusCritDamage=0.05, ScaleByStatusStacks=true` |
| 闪电风暴 | 10 级 **217%**（Base 1.5 + 0.075/级） | `SorcererStrongAttack3` AttackScaling.value |
| 横扫 | 10 级 **97%**（Base 0.7 + 0.03/级） | `WarriorBasicAttack2` |
| 技能成长 | `倍率(N)=Base+max(0,N−1)×PerLevel`；可经符文推到 50+ | `docs/04` §6.2.0 |
| 武器白字 | stat20 进伤害基项；BaseDamage 全 0 | `Player.bjr` |
| 上限 | 暴击/闪避/蓝耗 85%、CDR 80%、减伤 90%；最终减伤66 无上限但敌人侧 0 处 | `StatCap.GetCap` |
| 装备 Roll | `(1+rarityMul)×ilvl×perLevel×rollFactor`，stat20 +5 | `ItemizationConfig`，与 affix.js 一致 |
| 宝石 | 6 家族×7 级；武器槽元素伤 10/15/20/25/35/50/70%（按家族元素）、护甲槽主属性/CDR/生命%/荆棘、饰品槽元素减伤；孔位武器3/胸甲2/护腿2/头戒链各1，L30 开放 | `GemData.json` 42 条 |
| 仆从被动成长 | `Value(L)=Base+PerLevel×(L−1)`；83 个被动 PerLevel≠0，多数 ratio 0.10 | `SlaveData.json` Passives.Modifier.Value |
| 仆从主动技能 | 16 只有 Abilities，Effects 未展开倍率，**不计 DPS**，只作机制标注 | `minion-data.js` |
| 仆从装备 | 5 级解锁（非"第13件装备"）；协同槽需 10 星 | SlaveData 1.0.4 |

### 结构已核实（不改引擎）

- 全伤与元素伤**加算**同一乘区，无独立分支。
- `ab.type` 单分类：134/134 技能全单标签，与 33/34/61 独立加算等价。
- DoT 引擎已有 `dotTick`（62 同池 + 条件池 + 暴击）。
- 三层聚合 `Type:2` 真实 12 个全在攻速/移速/武器伤害，伤害关键属性 0 → 仅清算锤单独接入，其余不接。
- 最终减伤66 对输出 DPS 零影响，默认 0。

### 唯一未决项

**静电 × 易伤结构**：真源是两种不同 Behavior（`DamageAmplificationBehavior` vs `VulnerableBehavior`），无合并证据。默认**加算**，`--taken-mode multiply` 做敏感性对照。回答时说明口径，不武断断言。

## 四、两条口径绝不混用

| 口径 | 用在哪 | 算法 |
| --- | --- | --- |
| 周期期望 / 秒伤 | "这套构筑打这个场景平均每秒多少" | 条件伤按对敌模型里的**时间占比**加权 |
| 单跳伤害 | "这一发打多少" | 不摊覆盖率，按命中瞬间目标是否带该状态取 0/1 |

回答单跳（`--hit`、`hitZones`）用瞬时；回答秒伤、词条收益、循环期望用周期。不说"45% 易伤覆盖 = 这发吃 45% 易伤"，也不说"这发暴击所以秒伤翻倍"。

## 五、算数优先用工具

在 `deskrawl-damage-lab/` 下执行：

```bash
node agent/tools/calc.mjs --class sorcerer --element lightning --enemy boss --diff 6   # 秒伤+伤害构成
node agent/tools/calc.mjs --class warrior --hit w_flame --electro 0                    # 单跳逐乘区
node agent/tools/calc.mjs --gear 840,legendary                                          # 装分×稀有度数值
node agent/tools/calc.mjs --class warrior --skill-level w_val:20                       # 技能等级倍率
node agent/tools/calc.mjs --class warrior --runes RareRune_WarriorBasicAttack:6        # 符文加成
node agent/tools/calc.mjs --class warrior --affix weapon                               # 词条边际 Top8
node agent/tools/calc.mjs --class monk --json                                           # 机器可读
node agent/tools/calc.mjs --check                                                       # 自洽校验（必须 PASS）
python3 agent/tools/cross_validate.py                                                   # 双引擎乘区交叉校验
```

`--help` 看全部参数。`--check` PASS 是回答数值问题的前置条件。

## 六、能力边界

**能算**：周期秒伤与单跳逐乘区；任意装分×稀有度（职业掩码、部位池、Divine/黑雾/远古）；目标装分全局旋钮；宝石镶嵌与 `solveGems` 最优求解；技能留空与 50+ 等级外推；符文六槽独立配置与 2/4/6 套装统计；仆从三层养成与协同被动槽；静电双口径；词条边际；天赋自动规划（**基线而非全局最优**）；`ComboSolver` 组合最优（锁定任意系统、交替坐标上升的**近似**）。

**不能当事实**：静电×易伤结构、充能之戒 K、11–20 级技能实测倍率、符文 2–5 级游戏内数值、DoT/荆棘暴击完整链路、闪避/格挡/护盾完整链、**严格全局最优解**。这些要给选项卡和实测步骤，不得脑补。

## 七、改动纪律（每次必做）

改任何真源或前端代码后，按顺序：

```bash
cd deskrawl-damage-lab
node agent/tools/build-kb.mjs      # 重建知识库（漏掉 → 网页问答读旧数据）
node build-standalone.mjs          # 重建根目录单文件（漏掉 → 玩家拿到旧逻辑）
node agent/tools/calc.mjs --check  # 自洽校验
cd .. && git diff --exit-code      # 有输出说明产物没同步；CI 也会拦截
```

高风险改动（`engine.js` 的 `simulate`/`aggregate`、`rankAffixes` 与 `gearBuild` 的交互、`findAb` 的全局副作用、求解器评分口径）前后必须做 DPS 与循环回归比对。发布更新 `CHANGELOG.md`。
