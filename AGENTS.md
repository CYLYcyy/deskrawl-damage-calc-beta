# 项目协作约定（给所有 AI 协作者）

本项目是 Deskrawl 伤害实验室：纯静态前端伤害计算器 + 可调用的知识库智能体。
目标是把伤害预测持续逼近游戏真源，并给出配装/天赋/宝石的最优建议。

## 唯一的真源

- **数值真源**：`deskrawl-damage-lab/data.js`（VERSION、MECHANICS、技能、天赋、传奇、仆从、敌人）+ `affix.js`（装备数值）+ `runes.js`（符文/套装）+ `minion-data.js`（仆从技能库）。改数值只改这些文件。
- **裁决真源**：根目录 `deskrawl-真源裁决-1.0.4.md`。证据采信度：**用户实测 > 官方/游戏本体 SO dump > 第三方**。已证伪值（静电 5%/6.6%、闪电风暴 225%、"仆从被动不成长"、旧 30%+4%/级）不得写回。
- `agent/knowledge/*.md`、`agent/kb.json`、`agent/kb-data.js`、根目录 `deskrawl-lab.html` **都是生成物，禁止手改**。

## 每次改动的固定流程（顺序不可颠倒）

```bash
cd deskrawl-damage-lab
# 1. 改真源文件（data.js / affix.js / runes.js / engine.js / app.js / index.html 等）
# 2. 重建知识库与单文件
node agent/tools/build-kb.mjs
node build-standalone.mjs
# 3. 自洽校验
node agent/tools/calc.mjs --check
# 4. 确认无遗漏的未重建产物
cd .. && git diff --exit-code   # 有输出说明有产物没重建或手改了生成物
```

第 2 步漏掉任何一步，都会造成"源码改了、玩家拿到的单文件还是旧的"这类漂移。
CI（`.github/workflows/verify.yml`）会在 push 后重跑构建并校验，不一致即失败。

## 关键口径（不要重新发明）

- 全伤与元素伤**加算**，不是独立乘区。
- 易伤 30% 是目标受伤通道；"对易伤目标 +X%" 是攻击者条件伤乘区，两者不同。
- 静电 10%/层、**只加闪电**、最多 10 层，与易伤在目标通道内加算。结构（相乘 vs 加算）仍是未决项，回答时需标注口径。
- 仆从主动技能倍率未展开、**不计入 DPS**；被动按真源 PerLevel 成长，协同槽需 10 星。
- 天赋预算 70 点（存档层、求解器、引擎三处必须一致）；清算锤上限 30。
- 分享码 `SHORT` 表与 `PERSIST_KEYS` / `normalize()` 短别名必须同步，加字段时三处一起加。

## 已知高风险区（改动前先跑回归）

- `engine.js` 的 `simulate`（381 行）与 `aggregate`（189 行）是核心，占到文件 43%。任何改动前后都要用 `node agent/tools/calc.mjs --class ... --enemy boss` 对比 DPS 与循环。
- `rankAffixes` 试算只改 `cl.gear`，若 `cfg.gearBuild` 存在会被 `resolveGear` 覆盖导致增量恒 0（待修）。
- `findAb` 会写全局技能对象的 `_prep`，一旦置位后续不再重算（待修）。
- `autoTalents` / `solveGems` 每次完整重跑 `simulate`，是性能热点，改动评分口径会改变最优解，必须逐项回归。

## 协作习惯

- 用 `agent/SKILL.md` 作为回答口径的规范；引用资料优先 `agent/references/true-source-facts.md`。
- 遇到未决项：先查真源 → 没有证据就标注"待实测"，不要编造数值。
- 每次发布更新根目录 `CHANGELOG.md`，并确认单文件已重建（`git diff --exit-code` 干净）。
