# 状态效果

| 状态 | 数值 | 说明 |
| --- | --- | --- |
| vulnerable | taken=30，dur=4 | Take 30% more damage；真源 ×1.3 硬编码实证，真源 dur=3s |
| electrostatic | perStack=10，perStackOld=5，max=10，dur=4，ele=lightning | 1.0.4 真源 SO 实锤：StaticElectricity DamageAmplificationBehavior AmplificationPercent=0.10 → 每层 10%（仅闪电、10层）。旧版 5% 为用户早期推断值，已按真源对齐 |
| brittle | perStackCD=5，max=10，source=LegendaryRing8CritDamage | 1.0.4 真源实锤：脆裂本身无伤害行为（Brittle SO Behaviors=[]，MaxStacks=100）；+5%/层来自传奇戒指 LegendaryRing8CritDamage 的 ConditionalCritDamage（进暴伤池：暴伤 += 0.05×层数）。max10 为本地模拟上限，真源戒指逻辑无层数上限 |
| exposed | stacks=5 | 5 层破绽 → 易伤 |
| chill | as=-25，ms=-35 |  |
| numbingCold | dealt=-30 |  |
| bleeding | tick=1，ele=physical |  |
| poisoned | tick=2，ele=poison，weaponPct=75 |  |

## 归类

- **受伤增加**：易伤 30%（真源 ×1.3 实证）、静电 10%/层（1.0.4 真源实锤，仅闪电）、脆裂（进暴伤池）。默认三者相关项按加算；静电×易伤结构无合并证据，`--taken-mode multiply` 作敏感性对照。
- **脆裂落地（1.0.4 真源已裁决）**：脆裂状态本身无伤害行为（`Brittle` Behaviors=[]）；增伤来自传奇戒指 `LegendaryRing8CritDamage` 的 `ConditionalCritDamage`（暴伤 += 0.05×层数，进暴伤池 `1+cc×(cd+0.05×层数)`）。引擎已按此口径，`brittleZone` 默认 `crit`（并入暴伤）/ `taken` / `off`，层数 0 时无影响。
- **减益**：减速（攻速 -25%、移速 -35%）、麻木之寒（目标造成伤害 -30%）
- **持续伤害**：流血（每秒物理）、中毒（每 2 秒毒）、燃烧（每 0.5 秒火）
- **控制**：冻结、定身、眩晕、短眩晕

## 易伤来源

战士英勇打击（20% 概率）、夺命钩（100%）、重击天赋（强力暴击施加）、猎人照明弹、法师奥术暴露（每 4 次强攻）、武僧破绽 5 层。
覆盖率是易伤类构筑的第一变量：45% 覆盖 = ×1.135，80% 覆盖 = ×1.24。
