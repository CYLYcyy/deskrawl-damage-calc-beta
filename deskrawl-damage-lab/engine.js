/* ==========================================================================
   桌面破坏神 · 伤害引擎
   公式来源: 官方/社区校对（wikily.gg/deskrawl/stats/damage-formula）
   最终伤害 = 基础伤害 × 主属性 × 元素 × 暴击期望 × 条件伤 × 类型伤 × 易伤 × 减伤
   ========================================================================== */
window.Engine = (function () {
  const D = window.DESKRAWL_DATA;
  const CLASSES = D.CLASSES;

  // 归一化技能标签
  Object.values(CLASSES).forEach(c => {
    (c.basics || []).forEach(a => { a.type = 'basic'; });
    (c.strongs || []).forEach(a => { a.type = 'strong'; });
    (c.specials || []).forEach(a => { a.type = 'special'; });
  });

  const GEAR_PRESETS = {
    starter: {
      name: '起步 (70 蓝紫混搭)', main: 320, cc: 15, cd: 120, as: 15,
      ele: 60, type: 30, all: 0, vsElite: 20, vsVuln: 0,
      manaMax: 120, regen: 6, costRed: 5, flat: 20, dps: 200, speed: 1.0, weaponDamage: 200
    },
    mid: {
      name: '中配 (传奇散件)', main: 620, cc: 30, cd: 220, as: 30,
      ele: 120, type: 80, all: 30, vsElite: 50, vsVuln: 40,
      manaMax: 150, regen: 8, costRed: 15, flat: 34, dps: 230, speed: 1.0, weaponDamage: 230
    },
    end: {
      name: '毕业 (古代传奇 +850)', main: 980, cc: 45, cd: 320, as: 50,
      ele: 210, type: 150, all: 60, vsElite: 110, vsVuln: 90,
      manaMax: 180, regen: 10, costRed: 25, flat: 48, dps: 300, speed: 1.0, weaponDamage: 300
    }
  };

  const MED = window.DESKRAWL_DATA.MECHANICS;

  /* 并行模块优雅降级：affix.js / runes.js 可能尚未加载 */
  function getAffixMath() {
    return typeof window !== 'undefined' ? window.AffixMath : globalThis.AffixMath;
  }
  function getRuneData() {
    return typeof window !== 'undefined' ? window.RuneData : globalThis.RuneData;
  }

  const emptyMods = () => ({
    str: 0, dex: 0, int: 0, cc: 0, cd: 0, as: 0,
    all: 0, physical: 0, fire: 0, cold: 0, lightning: 0, poison: 0, arcane: 0,
    basic: 0, strong: 0, special: 0, dot: 0, aoe: 0,
    vs: { healthy: 0, injured: 0, slowed: 0, immobilized: 0, elite: 0, bleeding: 0, poisoned: 0, burning: 0, distant: 0, vulnerable: 0 },
    cdr: 0, costRed: 0, costAdd: 0, manaMax: 0, manaRegen: 0, genFlat: 0, genPct: 0,
    flatDmg: 0, thorns: 0, dodge: 0,
    // 武器伤害乘算层（1.0.4 真源 PercentMult/Type:2）：清算锤暴击叠层 ×(1+per)^stacks，默认 1=不生效
    weaponDamageMult: 1,
    ccBasic: 0, ccLightning: 0, ccPhysical: 0,
    cdBasic: 0, cdStrong: 0, cdLightning: 0, cdPhysical: 0,
    // 元素/类型条件暴击（奥术之刃护胫这类"某系技能暴伤"必须走这里，
    // 不能塞进 cd 通道，否则火焰构筑也会白拿）
    cdEle: {}, ccEle: {}, cdVs: {}, ccVs: {}, cdAbility: {},
    // 传奇装备的可计算增量
    thornsFromArmor: 0, perSummon: {}, basicExtra: null,
    procs: [], procDps: [], multiTarget: {}, manaFree: {},
    hpPct: 0, takenDR: 0, physDRFromDodge: 0,
    ability: {}, flags: {}
  });

  function mergeMods(target, src) {
    if (!src) return target;
    if (src.stat) for (const k in src.stat) target[k] = (target[k] || 0) + src.stat[k];
    if (src.dmg) for (const k in src.dmg) {
      if (k === 'vs') { for (const v in src.dmg.vs) target.vs[v] += src.dmg.vs[v]; }
      else target[k] = (target[k] || 0) + src.dmg[k];
    }
    if (src.vs) for (const v in src.vs) target.vs[v] += src.vs[v];
    if (src.mana) for (const k in src.mana) target[k === 'costRed' ? 'costRed' : k] = (target[k === 'costRed' ? 'costRed' : k] || 0) + src.mana[k];
    if (src.ability) for (const k in src.ability) target.ability[k] = (target.ability[k] || 0) + src.ability[k];
    if (src.flag) target.flags[src.flag] = true;
    if (src.flatDmg) target.flatDmg += src.flatDmg;
    if (src.statPct) target.statPct = Object.assign(target.statPct || {}, src.statPct);
    return target;
  }

  /* 一件 gear 对象 -> 基础属性 mods（与原 statsFromCfg 的装备段等价） */
  function gearToMods(g, cfg) {
    const s = emptyMods();
    s[CLASSES[cfg.classKey].stat] = g.main || 0;
    s.cc = g.cc || 0; s.cd = g.cd || 0; s.as = g.as || 0;
    s.all = g.all || 0; s[cfg.element] = (s[cfg.element] || 0) + (g.ele || 0);
    s[cfg.primaryType || 'strong'] += g.type || 0;
    s.vs.elite = g.vsElite || 0;
    s.vs.vulnerable = g.vsVuln || 0;
    s.manaMax = g.manaMax || 0; s.manaRegen = g.regen || 0; s.costRed = g.costRed || 0;
    s.cdr = g.cdr || 0;
    s.dot = g.dot || 0;
    s.flatDmg = g.flat || 0;
    if (g.typeExtra) for (const k in g.typeExtra) s[k] += g.typeExtra[k];
    if (g.vsExtra) for (const k in g.vsExtra) s.vs[k] += g.vsExtra[k];
    return s;
  }

  /* 把一套 mods 的数值标量累加进另一套（用于仆从装备并入玩家属性池） */
  function addMods(target, src) {
    for (const k in src) {
      if (k === 'vs') { for (const v in src.vs) target.vs[v] = (target.vs[v] || 0) + src.vs[v]; }
      else if (typeof src[k] === 'number') target[k] = (target[k] || 0) + src[k];
    }
  }

  /* 装备/词条 -> 基础属性对象 */
  function statsFromCfg(cfg, gear) {
    const g = gear || cfg.gear;
    const s = gearToMods(g, cfg);
    s.thorns = cfg.thorns != null ? cfg.thorns : 500;
    s.dodge = cfg.dodge || 0;
    return s;
  }

  /* B1: 装备数值函数接入。cfg.gearBuild 存在且 AffixMath 可用时，
     由 affix.js 按装分×稀有度生成 gear；否则退回 cfg.gear（GEAR_PRESETS 汇总值） */
  function resolveGear(cfg) {
    const AF = getAffixMath();
    if (cfg.gearBuild && AF && typeof AF.buildGear === 'function') {
      try { return AF.buildGear(cfg) || cfg.gear; } catch (e) { return cfg.gear; }
    }
    return cfg.gear;
  }

  /* B2: 技能等级成长。10 级为基准（pct 即 10 级值），N≠10 时按每级增量调整 */
  function pctAtLevel(ab, cfg, id) {
    if (!ab) return 0;
    const base = ab.pct || 0;
    const levels = cfg && cfg.skillLevels;
    const N = (levels && levels[id] != null) ? levels[id] : 10;
    return base + (N - 10) * (ab.perLevel || 0);
  }

  /* B3: 符文 +技能等级（金/大金）写入 cfg.skillLevels。
     TODO: 配置形状以 runes.js 定稿为准；当前兼容 runeLevelGrants:[{abilityId,runeLevel}]
     与 runeLevels:{ abilityId: runeLevel } 两种写法。 */
  function applyRuneSkillLevels(cfg, RD) {
    if (!RD || typeof RD.grantedLevels !== 'function') return;
    let grants = cfg.runeLevelGrants;
    if (!grants && cfg.runeLevels) {
      grants = [];
      for (const id in cfg.runeLevels) grants.push({ abilityId: id, runeLevel: cfg.runeLevels[id] });
    }
    if (!grants || !grants.length) return;
    // 每次复制，避免 autoTalents/rankAffixes 复用 cfg 引用时等级被反复累加
    cfg.skillLevels = Object.assign({}, cfg.skillLevels || {});
    for (const g of grants) {
      const id = g.abilityId || g.id || g.skill;
      const lv = g.runeLevel != null ? g.runeLevel : g.level;
      if (!id || lv == null) continue;
      const add = RD.grantedLevels(lv, cfg.skillLevels);
      if (typeof add === 'number') cfg.skillLevels[id] = (cfg.skillLevels[id] || 10) + add;
      else if (add && typeof add === 'object') {
        for (const k in add) cfg.skillLevels[k] = (cfg.skillLevels[k] || 10) + add[k];
      }
    }
  }

  /* 汇总：装备 + 天赋 + 套装 + 传奇 + 仆从 */
  function aggregate(cfg) {
    const c = CLASSES[cfg.classKey];
    // B1: 装备可由 affix.js 按 gearBuild 生成；缺模块/无 gearBuild 时走原 preset（cfg.gear）
    const gear = resolveGear(cfg);
    const s = statsFromCfg(cfg, gear);
    s.gear = gear;

    // 天赋
    const ranks = cfg.talents || {};
    for (const row of c.talents) for (const tal of row.items) {
      const r = ranks[tal.id] || 0;
      if (!r) continue;
      applyTalent(s, tal, r, cfg, c);
    }

    // 天赋 flag -> 具体数值
    s.cdBasic += (s.flags.precise_rank || 0) * 20;
    s.cdStrong += (s.flags.heavy_rank || 0) * 20;
    s.cdLightning += (s.flags.stormmastery_rank || 0) * 12;
    s.cdPhysical += (s.flags.brutality_rank || 0) * 15;
    s.ccBasic += (s.flags.searing_rank || 0) * 3;
    s.ccPhysical += (s.flags.vigor_rank || 0) * 2.5;
    s.ccLightning += (s.flags.lightcc_rank || 0) * 2.5;
    s.aoe += (s.flags.aoe_rank || 0) * 10;

    // 符文套装（原数据层套装，保持兼容）
    const setCount = cfg.setCount || 0;
    const set = (c.sets || []).find(x => x.id === cfg.setId);
    if (set) {
      [2, 4, 6].forEach(n => {
        if (setCount >= n && set.b[n]) applySetBonus(s, set.b[n], n, cfg, c);
      });
    }

    // B3: 符文模块（runes.js）注入。cfg 无符文字段或模块缺席时完全跳过
    const RD = getRuneData();
    if (RD) {
      try {
        if (typeof RD.applyRunes === 'function') RD.applyRunes(cfg, s);
        // 符文套装：cfg.equippedSets = [{ setId, count }]，SETS[].bonus[count] 为 mods 结构
        for (const eq of (cfg.equippedSets || [])) {
          const rs = (RD.SETS || []).find(x => x.id === eq.setId);
          if (rs && rs.bonus && rs.bonus[eq.count]) {
            applySetBonus(s, rs.bonus[eq.count], eq.count, cfg, c);
          }
        }
        applyRuneSkillLevels(cfg, RD);
      } catch (e) { /* 符文数据异常时跳过，不影响主引擎 */ }
    }

    // 传奇特效（声明式 fx，由 applyLegendary 解释）
    (cfg.legendaries || []).forEach(id => {
      const L = D.LEGENDARIES.find(x => x.id === id);
      if (L) applyLegendary(s, L, cfg);
    });

    // 仆从：被动随技能等级成长；缰绳 +5 作用于所有自身技能；继承槽固定 10 级；
    // 第 13 件装备走 gearBuild（无宝石孔、需训练等级 ≥ gearStar）
    const min = D.MINIONS.find(x => x.id === cfg.minionId);
    let minionInfo = null;
    if (min) {
      const MM = MED.minion;
      // 训练等级：cfg.minionLevel 缺省取上限，夹在 [levelMin, levelMax]
      const trainLv = Math.max(MM.levelMin, Math.min(MM.levelMax, cfg.minionLevel != null ? cfg.minionLevel : MM.levelMax));
      // B5: 被动成长等级读 cfg.minionSkillLevel，默认训练等级
      const skillLv = cfg.minionSkillLevel != null ? cfg.minionSkillLevel : trainLv;
      // 缰绳 +5 作用于所有自身技能（可超上限）；继承槽技能固定 10 级、不吃 +5
      const reins = cfg.minionReins ? MM.reinsBonus : 0;
      const inherited = !!cfg.inheritedSkill;
      const eff = inherited ? 10 : skillLv + reins;
      // 共鸣字段保留供 UI 展示；放大被动的旧语义仅在数据层仍提供 resonanceBonus 时生效，
      // 数据层净化（移除 resonanceStar/resonanceBonus）后自动失效，等于删除该逻辑
      const resonance = eff >= MM.resonanceStar;
      const resonanceAmp = resonance && MM.resonanceBonus != null;

      // 被动 base
      const bonus = JSON.parse(JSON.stringify(min.bonus || {}));
      if (min.bonus && min.bonus.statPct) {
        for (const k in min.bonus.statPct) s[k] = (s[k] || 0) * (1 + min.bonus.statPct[k] / 100);
      }
      mergeMods(s, bonus);
      // 过渡保留：数据仍带 resonanceBonus 时维持旧行为；不再作为成长机制
      if (resonanceAmp) {
        const extra = JSON.parse(JSON.stringify(min.bonus || {}));
        scaleMods(extra, MM.resonanceBonus / 100);
        mergeMods(s, extra);
      }
      // B5: 被动随技能等级成长（旧「被动不成长」口径已删除）
      // 真源核查（BASEDAMAGE_RESEARCH.md §2）：2026-10-16 dump（1.0.3 时期）中 77/77 被动
      // PerLevel=0、无仆从等级字段/配置/存档位，该版本被动固定。但仆从养成是 1.1.0（10-29）
      // 才引入、当前 1.1.11，真源版本落后于游戏版本，不能据此断定当前版本被动不成长。
      // 采信度处理：保留成长路径、不编造系数；数据层一旦提供 min.bonusPerLevel 即按
      // 「每级相对增量线性放大（0.05 = 每级 +5%）」生效，否则保持 base。此项列为真源版本未决。
      const perLv = min.bonusPerLevel;
      if (perLv && skillLv > 10) {
        const extra = JSON.parse(JSON.stringify(min.bonus || {}));
        scaleMods(extra, perLv * (skillLv - 10));
        mergeMods(s, extra);
      }
      // 无 min.bonusPerLevel 时被动保持 base，不静默外推成长值。

      // 第 13 件装备：优先 gearBuild（无宝石孔、训练等级 ≥ gearStar），属性并入玩家属性池
      let minionGearLabel = null;
      if (trainLv >= MM.gearStar && cfg.minionGearBuild) {
        const AF = getAffixMath();
        if (AF && typeof AF.buildGear === 'function') {
          try {
            const mg = AF.buildGear(Object.assign({}, cfg, { gearBuild: cfg.minionGearBuild }));
            if (mg) {
              addMods(s, gearToMods(mg, cfg)); // 仆从装备无宝石孔：不并入 gem 相关字段
              minionGearLabel = 'custom';
            }
          } catch (e) { /* 缺模块/数据异常时跳过仆从装备 */ }
        }
      } else if (eff >= MM.gearStar && cfg.minionGear && cfg.minionGear !== 'none') {
        // DEPRECATED: 旧 4 个抽象 gearOptions（none/atk/sup/def）fallback，新配置请用 minionGearBuild
        const g = MM.gearOptions.find(x => x.id === cfg.minionGear);
        if (g && g.fx) {
          if (g.fx.dmg) for (const k in g.fx.dmg) s[k] = (s[k] || 0) + g.fx.dmg[k];
          if (g.fx.takenDR) s.takenDR += g.fx.takenDR;
          if (g.fx.selfPct) s.minionSelfPct = (s.minionSelfPct || 0) + g.fx.selfPct;
        }
        minionGearLabel = cfg.minionGear;
      }
      minionInfo = {
        id: min.id, name: min.name, level: trainLv, skillLevel: skillLv, eff, resonance, inherited,
        gear: (trainLv >= MM.gearStar || eff >= MM.gearStar) ? (minionGearLabel || 'none') : null,
        selfPct: (MM.selfBasePct + MM.selfPerLevelPct * (eff - 1)) * (1 + (s.minionSelfPct || 0) / 100),
        selfEle: min.selfEle || guessEle(min)
      };
    }

    // 特殊转化
    if (s.flags.mana_to_int) {
      const r = ranks['reservoir'] || 0;
      s.int += s.manaMax * 0.05 * r;
    }
    if (s.flags.formless) s.cd += s.dodge * 2;
    if (s.flags.lone_hunter && (cfg.enemy.count <= 1)) {
      s.as += 80; s.all += 120; s.strong += 150; s.flags.lone_active = true;
    }
    if (s.flags.charged_ready) s.all += 80 * 0.35;
    if (s.flags.bloodlust) {
      const c2 = CLASSES[cfg.classKey];
      const all = [...c2.basics, ...c2.strongs].filter(a => cfg.skills.basic === a.id || cfg.skills.strong === a.id);
      if (all.some(a => a.dot)) s.all += 50 * 2;
    }
    if (s.flags.flame_ground) s.ability['w_flame'] = (s.ability['w_flame'] || 0) + 90;
    if (s.flags.forge) { s.strong += 75; s.costRed += 20; }
    if (s.flags.arcane_exposure) { s.vs.vulnerable += 150; cfg._vulnBonus = (cfg._vulnBonus || 0) + 0.35; }
    if (s.flags.shatter) { s.cc += 50 * (cfg._freezeUptime || 0.2); s.cd += 250 * (cfg._freezeUptime || 0.2); }
    if (s.flags.mirror_steps) s.physical += 60 * (cfg._dodgeUptime || 0.15);
    if (s.flags.ghost_chain) s.basic += 33;
    if (s.flags.storm_conduit) s.ability['s_storm'] = (s.ability['s_storm'] || 0) + 50;
    if (s.flags.gathered_force) s.strong += 80;
    if (s.flags.chi_expenditure) s.strong += 45;
    if (s.flags.double_tap) s.basic += 35;
    if (s.flags.phantom_plus) { s.as += 0; }
    if (s.flags.rimebound) s.ability['s_frostbeam'] = (s.ability['s_frostbeam'] || 0) + 120;
    if (s.flags.exposing_traps) { s.ability['h_trap'] = (s.ability['h_trap'] || 0) + 300; s.ability['h_arctrap'] = (s.ability['h_arctrap'] || 0) + 300; }
    // 静电有多个来源：法师「静电充能」、武僧「充能法球 / 雷鸣」
    if (s.flags.charged_orb || s.flags.thundering) s.flags.static = true;

    // 上限（数值取自 MECHANICS.caps，版本改动只改数据层）
    s.cc = Math.min(MED.caps.cc, s.cc);
    s.cdr = Math.min(MED.caps.cdr, s.cdr);
    s.costRed = Math.min(85, s.costRed);
    s.dodge = Math.min(85, s.dodge);
    s.critDR = cfg.enemy.critDR || 0;
    s.takenDR = Math.min(MED.caps.dr, s.takenDR || 0);

    // 真源 Player.bjr：武器伤害(stat20)本身就是单跳伤害基项，与武器速度无关，速度只影响出手频率。
    // 真源公式 = trunc((BaseDamage + 倍率×(trunc(F20 WeaponDamage) + F3 Damage)) × (1+主属性/100))。
    //   BaseDamage 是 DamageEffect 的 long 字段、不乘技能倍率但吃主属性与后续全部乘区。
    //   真源实证（2026-10-16 dump，见 BASEDAMAGE_RESEARCH.md）：玩家四职业 49/49 段伤害效果
    //   BaseDamage 全为 0（仅 3 个敌人技能非零 50/1/500）；官方工具链亦把 base 置 0 防止与
    //   武器白字双计——白字走 F20 WeaponDamage、是乘倍率的，切勿塞进 baseDamage。
    //   故玩家侧固定项为 0，口径上记 s.baseDamage=0，不参与计算；数值零差异，TODO 关闭。
    //   若将来版本出现非零 BaseDamage，在攻击伤害合成处加 `baseDamage + 倍率×(F20+F3)` 即可。
    s.baseDamage = 0;
    // fallback 仅兼容只有 dps/speed 的旧 preset 链路；新链路（gearBuild stat20）直接给 weaponDamage。
    s.weaponDamage = gear.weaponDamage != null ? gear.weaponDamage : (gear.dps / Math.max(0.2, gear.speed));
    s.manaMax = Math.max(50, s.manaMax);
    s.electroStacks = cfg.electroStacks != null ? cfg.electroStacks : 0;
    s.minion = minionInfo;
    // B2/B4: 把等级/口径配置带在 agg 上，供 hitZones/dotTick/takenMultiplier 读取（轻量引用，避免循环）
    s._cfg = { skillLevels: cfg.skillLevels, takenMode: cfg.takenMode };
    return s;
  }

  /* 传奇 fx 解释器：把数据层的声明式增量落到属性对象上 */
  function applyLegendary(s, L, cfg) {
    const fx = L.fx || {};
    if (!fx || !Object.keys(fx).length) return;
    const up = fx.uptime != null ? fx.uptime : 1;
    const add = (k, v) => { s[k] = (s[k] || 0) + v; };
    if (fx.stat) for (const k in fx.stat) add(k, fx.stat[k] * up);
    if (fx.dmg) for (const k in fx.dmg) add(k, fx.dmg[k] * up);
    // 棱彩之心：HighestElementalDamageBonus +X%，归到玩家主元素并进元素加算池。
    // 真源取「玩家最高的元素伤害加成」，单主元素 build 下等价于主元素 +X（见 data.js note）。
    if (fx.ele) add(cfg.element, fx.ele * up);
    if (fx.type) for (const k in fx.type) add(k, fx.type[k] * up);
    if (fx.vs) for (const k in fx.vs) s.vs[k] += fx.vs[k] * up;
    if (fx.dot) add('dot', fx.dot * up);
    if (fx.cdEle) for (const k in fx.cdEle) s.cdEle[k] = (s.cdEle[k] || 0) + fx.cdEle[k];
    if (fx.ccEle) for (const k in fx.ccEle) s.ccEle[k] = (s.ccEle[k] || 0) + fx.ccEle[k];
    if (fx.cdAbility) for (const k in fx.cdAbility) s.cdAbility[k] = (s.cdAbility[k] || 0) + fx.cdAbility[k];
    if (fx.cdVs) s.cdVs[fx.cdVs.states.join('+')] = { states: fx.cdVs.states.slice(), value: fx.cdVs.value };
    if (fx.ccVs) s.ccVs[fx.ccVs.states.join('+')] = { states: fx.ccVs.states.slice(), value: fx.ccVs.value };
    if (fx.ability) for (const k in fx.ability) s.ability[k] = (s.ability[k] || 0) + fx.ability[k];
    if (fx.thornsPct) s.flags.thornsPct = (s.flags.thornsPct || 0) + fx.thornsPct;
    if (fx.thornsFromArmor) s.thornsFromArmor += fx.thornsFromArmor;
    if (fx.hpPct) s.hpPct += fx.hpPct;
    if (fx.takenDR) s.takenDR += fx.takenDR;
    if (fx.physDRFromDodge) s.physDRFromDodge += fx.physDRFromDodge;
    if (fx.manaRegen) s.manaRegen += fx.manaRegen;
    if (fx.manaOnPotion) s.flags.manaOnPotion = (s.flags.manaOnPotion || 0) + fx.manaOnPotion;
    if (fx.basicExtra) s.basicExtra = { ele: fx.basicExtra.ele, pct: fx.basicExtra.pct };
    if (fx.proc) s.procs.push(fx.proc);
    if (fx.procDps) s.procDps.push(fx.procDps);
    if (fx.multiTarget) for (const k in fx.multiTarget) s.multiTarget[k] = Math.max(s.multiTarget[k] || 1, fx.multiTarget[k]);
    if (fx.manaFree) for (const k in fx.manaFree) s.manaFree[k] = 1 - (1 - (s.manaFree[k] || 0)) * (1 - fx.manaFree[k]);
    if (fx.perSummon) for (const k in fx.perSummon) s.perSummon[k] = (s.perSummon[k] || 0) + fx.perSummon[k];
    // 清算锤：暴击触发的武器伤害乘算层。层数由用户录入 cfg.reckoningStacks（默认0），
    // 不自动按暴击频率推算（真源工具链亦未建模，避免脑补稳态层数）。(1+per)^层数 连乘。
    if (fx.weaponDamageMult) {
      const w = fx.weaponDamageMult;
      const per = w.perStack || 0;
      const rawStacks = cfg.reckoningStacks != null ? cfg.reckoningStacks : 0;
      const stacks = Math.max(0, Math.min(w.maxStacks || 50, rawStacks));
      s.weaponDamageMult = (s.weaponDamageMult || 1) * Math.pow(1 + per, stacks);
      s._reckoning = { per, stacks, max: w.maxStacks || 50 };
    }

    // 条件不满足时整条回退（不是按覆盖率，而是直接失效）
    const miss = (fx.cond === 'elite' && !cfg.enemy.elite) ||
                 (fx.cond === 'single' && (cfg.enemy.count || 1) > 1);
    if (miss) {
      if (fx.stat) for (const k in fx.stat) s[k] -= fx.stat[k] * up;
      if (fx.dmg) for (const k in fx.dmg) s[k] -= fx.dmg[k] * up;
      if (fx.ele) s[cfg.element] -= fx.ele * up;
    }
  }

  function scaleMods(m, k) {
    if (m.stat) for (const x in m.stat) m.stat[x] *= k;
    if (m.dmg) for (const x in m.dmg) if (x !== 'vs') m.dmg[x] *= k;
    if (m.vs) for (const x in m.vs) m.vs[x] *= k;
    if (m.ability) for (const x in m.ability) m.ability[x] *= k;
    if (m.flag) delete m.flag;
  }

  function applyTalent(s, tal, r, cfg, c) {
    const m = tal.mods || {};
    if (m.stat) for (const k in m.stat) {
      if (k === 'manaMax') s.manaMax += m.stat[k] * r;
      else s[k] = (s[k] || 0) + m.stat[k] * r;
    }
    if (m.dmg) for (const k in m.dmg) {
      if (k === 'vs') { for (const v in m.dmg.vs) s.vs[v] += m.dmg.vs[v] * r; }
      else s[k] += m.dmg[k] * r;
    }
    if (m.vs) for (const k in m.vs) s.vs[k] += m.vs[k] * r;
    if (m.mana) {
      if (m.mana.genFlat) s.genFlat += m.mana.genFlat * r;
      if (m.mana.regen) s.manaRegen += m.mana.regen * r;
      if (m.mana.costRed) s.costRed += m.mana.costRed * r;
      if (m.mana.costAdd) s.costAdd += m.mana.costAdd * r;
      if (m.mana.genPct) s.genPct += m.mana.genPct * r;
    }
    if (m.ability) for (const k in m.ability) s.ability[k] = (s.ability[k] || 0) + m.ability[k] * r;
    if (m.flatDmg) s.flatDmg += m.flatDmg * r;
    if (m.flag) {
      s.flags[m.flag] = true;
      if (m.flag === 'shout_plus') s.flags.shout_plus_rank = r;
      if (m.flag === 'heavy_blow') s.flags.heavy_blow = true;
      if (m.flag === 'val_vuln') s.flags.val_vuln_rank = r;
      if (m.flag === 'butcher') s.flags.butcher_rank = r;
      if (m.flag === 'knife_storm') s.flags.knife_storm_rank = r;
      if (m.flag === 'dazzling') s.flags.dazzling_rank = r;
      if (m.flag === 'phantom_plus') s.flags.phantom_rank = r;
      if (m.flag === 'aoe_dmg') s.flags.aoe_rank = r;
      if (m.flag === 'ability_cd_only') s.flags.breath_rank = r;
      if (m.flag === 'physical_cd_only') s.flags.brutality_rank = r;
      if (m.flag === 'basic_cd_only') s.flags.precise_rank = r;
      if (m.flag === 'strong_cd_only') s.flags.heavy_rank = r;
      if (m.flag === 'lightning_cd_only') s.flags.stormmastery_rank = r;
      if (m.flag === 'basic_cc_only') s.flags.searing_rank = r;
      if (m.flag === 'physical_cc_only') s.flags.vigor_rank = r;
      if (m.flag === 'lightning_cc_only') s.flags.lightcc_rank = r;
    }
  }

  function applySetBonus(s, b, n, cfg, c) {
    if (b.dmg) for (const k in b.dmg) s[k] += b.dmg[k];
    if (b.stat) for (const k in b.stat) s[k] = (s[k] || 0) + b.stat[k];
    if (b.vs) for (const k in b.vs) s.vs[k] += b.vs[k];
    if (b.ability) for (const k in b.ability) s.ability[k] = (s.ability[k] || 0) + b.ability[k];
    if (b.flag) s.flags['set_' + b.flag] = true;
  }

  /* 单个技能的一次命中期望（不含 DoT） */
  /* 条件状态权重：暴击类条件按覆盖率折算，而不是"条件存在就给满" */
  function stateWeight(state, ctx) {
    switch (state) {
      case 'vulnerable': return ctx.vulnUptime || 0;
      case 'elite': return ctx.elite ? 1 : 0;
      case 'immobilized': return ctx.immobilizedUptime || 0;
      case 'slowed': return Math.max(ctx.slowedUptime || 0, ctx.immobilizedUptime || 0);
      case 'healthy': return ctx.healthyUptime || 0;
      case 'injured': return ctx.injuredUptime || 0;
      case 'bleeding': return ctx.bleeding ? 1 : 0;
      case 'poisoned': return ctx.poisoned ? 1 : 0;
      case 'burning': return ctx.burning ? 1 : 0;
      case 'distant': return Math.min(1, typeof ctx.distant === 'number' ? ctx.distant : (ctx.distant ? 1 : 0));
      default: return 0;
    }
  }

  function stateOn(state, ctx) { return stateWeight(state, ctx) > 0; }

  function critChance(agg, ab, ele, ctx) {
    let cc = agg.cc + (agg.ccEle[ele] || 0);
    if (ab.type === 'basic') cc += agg.ccBasic;
    if (ele === 'lightning') cc += agg.ccLightning;
    if (ele === 'physical') cc += agg.ccPhysical;
    for (const k in agg.ccVs) {
      const v = agg.ccVs[k];
      v.states.forEach(st => { cc += v.value * stateWeight(st, ctx); });
    }
    return Math.min(MED.caps.cc, cc + (ctx.buffCc || 0));
  }

  function critDamage(agg, ab, ele, ctx) {
    let cd = agg.cd + (agg.cdEle[ele] || 0) + (agg.cdAbility[ab.id] || 0);
    if (ab.type === 'basic') cd += agg.cdBasic;
    if (ab.type === 'strong') cd += agg.cdStrong;
    if (ele === 'lightning') cd += agg.cdLightning;
    if (ele === 'physical') cd += agg.cdPhysical;
    for (const k in agg.cdVs) {
      const v = agg.cdVs[k];
      v.states.forEach(st => { cd += v.value * stateWeight(st, ctx); });
    }
    // 1.0.4 真源：脆裂增伤来自传奇戒指 LegendaryRing8CritDamage 的 ConditionalCritDamage
    // （进暴伤池：暴伤 += 0.05×层数，ScaleByStatusStacks）。仅在 crit 归属时并入 cd。
    // cd 为百分点单位（200=200%），故 0.05×stacks 换算为 5×stacks 百分点。
    if ((ctx.brittleZone || 'crit') === 'crit' && (ctx.brittleStacks || 0)) {
      cd += MED.status.brittle.perStackCD * ctx.brittleStacks;
    }
    return cd + (ctx.buffCd || 0);
  }

  /* 目标"受到伤害增加"通道：易伤固定 30%，静电按层只加闪电
     默认加算（与旧版完全一致）；cfg.takenMode==='multiplicative' 时改为相乘 */
  function takenMultiplier(agg, ele, ctx) {
    const ST = MED.status;
    const vuln = (ST.vulnerable.taken / 100) * (ctx.vulnUptime || 0);
    // 静电系数：1.0.4 真源默认 10%/层；前端未决项 electroPerStack 可覆盖（用户一手实测/旧口径对照）
    const perStack = ctx.electroPerStack != null ? ctx.electroPerStack : ST.electrostatic.perStack;
    const elec = ele === 'lightning' ? (perStack / 100) * (ctx.electroStacks || 0) : 0;
    // 脆裂若被裁决进"受伤区"，则与易伤/静电同通道加算（层数0时不生效）
    const brit = (ctx.brittleZone === 'taken') ? (ST.brittle.perStackCD / 100) * (ctx.brittleStacks || 0) : 0;
    if (ctx.takenMode === 'multiplicative') return (1 + vuln) * (1 + elec) * (1 + brit);
    return 1 + vuln + elec + brit;
  }

  /* 脆裂放大系数：1.0.4 真源下脆裂(crit 归属)已并入 critDamage 的暴伤池，
     此处恒返回 1，避免重复相乘。'taken' 由 takenMultiplier 处理；'off' 不启用。
     保留此函数只为兼容乘区面板的 note 展示。 */
  function brittleCritMult(ctx) {
    return 1;
  }

  /* 单元素部分的乘区集合 */
  function zoneSet(agg, ab, ctx, ele, pct) {
    const cc = critChance(agg, ab, ele, ctx);
    const cd = critDamage(agg, ab, ele, ctx);
    const bcrit = brittleCritMult(ctx);
    // 脆裂(crit区)只放大"暴击命中那部分"，不放大非暴击的基础期望
    const crit = 1 + (cc / 100) * (cd / 100) * bcrit * (1 - (agg.critDR || 0));
    const attr = 1 + attrOf(agg) / 100;
    const eleM = eleMultOf(agg, ele);
    const vs = vsMultiplier(agg, ctx);
    const aoe = 1 + ((ab.tags || []).includes('aoe') ? (agg.aoe || 0) / 100 : 0);
    const type = (1 + (agg[ab.type] || 0) / 100) * aoe;
    const abm = 1 + (agg.ability[ab.id] || 0) / 100;
    const taken = takenMultiplier(agg, ele, ctx);
    const mit = mitigation(agg, ele, ctx);
    return {
      cc, cd, crit, attr, ele: eleM, vs, type, ab: abm, aoe: 1, taken, mit,
      list: [
        { id: 'base', name: '基础武器伤害', mult: agg.weaponDamageMult || 1, value: wdOf(agg), note: '武器伤害 + 平伤' + (agg._reckoning ? ' ×清算' + Math.pow(1 + agg._reckoning.per, agg._reckoning.stacks).toFixed(2) : '') },
        { id: 'ability', name: '技能倍率', mult: pct / 100, value: pct / 100, note: (ab.name || '') + ' ' + pct + '%' },
        { id: 'attr', name: '主属性', mult: attr, value: attr, note: '1 + 主属性/100' },
        { id: 'element', name: '元素 + 全伤', mult: eleM, value: eleM, note: '加算：1 + 元素伤% + 全伤%' },
        { id: 'crit', name: '暴击期望', mult: crit, value: crit, note: '1 + 暴率×(暴伤+脆裂' + ((ctx.brittleStacks||0) && (ctx.brittleZone||'crit')==='crit' ? '+' + (MED.status.brittle.perStackCD*ctx.brittleStacks).toFixed(0) : '0') + ')×(1-暴伤减免)｜' + cc.toFixed(1) + '% / ' + cd.toFixed(0) + '%' },
        { id: 'vs', name: '条件伤', mult: vs, value: vs, note: '对精英/健康/减速等，内部加算' },
        { id: 'type', name: '类型伤', mult: type, value: type, note: '普通/强力/特殊' },
        { id: 'abilityMod', name: '技能专属加成', mult: abm, value: abm, note: '只作用于该技能' },
        { id: 'taken', name: '目标受伤增加', mult: taken, value: taken, note: '易伤 30% + 静电（仅闪电）' },
        { id: 'mitigation', name: '护甲/魔抗', mult: 1 - mit, value: 1 - mit, note: '1 − R/(R+50×等级)' }
      ]
    };
  }

  /* 单次命中期望（含多段与双元素） */
  function hitZones(agg, ab, ctx) {
    // B2: 技能按 cfg.skillLevels 成长（N=10 时等价于原 ab.pct，保持向后兼容）
    const pct = pctAtLevel(ab, agg._cfg, ab.id);
    if (!pct) return { total: 0, hits: 0, zones: [], cc: 0, cd: 0, parts: [] };
    const wd = wdOf(agg);
    const parts = [{ ele: ab.ele, pct }];
    if (ab.extra && (ctx.count || 1) > 1) {
      parts.push({ ele: ab.extra.ele, pct: pctAtLevel({ pct: ab.extra.pct, perLevel: ab.extra.perLevel }, agg._cfg, ab.id) });
    }
    let per = 0;
    let zones = null;
    const partInfo = [];
    for (const p of parts) {
      const z = zoneSet(agg, ab, ctx, p.ele, p.pct);
      const v = wd * (p.pct / 100) * z.attr * z.ele * z.crit * z.vs * z.type * z.ab * z.taken * (1 - z.mit);
      if (!zones) zones = z.list;
      partInfo.push({ ele: p.ele, pct: p.pct, value: v });
      per += v;
    }
    return { total: per * (ab.hits || 1), perHit: per, hits: ab.hits || 1, zones, cc: zones ? 0 : 0, parts: partInfo };
  }

  function hitDamage(agg, ab, ctx) {
    return hitZones(agg, ab, ctx).total;
  }

  function dotTick(agg, dot, ctx) {
    // B2: DoT 倍率随来源技能等级成长（无 src 时按 10 级，与旧版一致）
    const pct = pctAtLevel(dot, agg._cfg, dot.src || dot.id);
    const wd = wdOf(agg);
    const dps = wd * (pct / 100) / Math.max(0.1, dot.dur);
    let d = dps * (1 + attrOf(agg) / 100);
    d *= eleMultOf(agg, dot.ele);
    d *= 1 + (agg.dot || 0) / 100;
    d *= vsMultiplier(agg, ctx) * takenMultiplier(agg, dot.ele, ctx);
    d *= 1 - mitigation(agg, dot.ele, ctx);
    return d;
  }

  /* 元素 × 全伤：默认加算；数据层可切到独立乘区 */
  function eleMultOf(agg, ele) {
    return MED.zones.allDamage === 'separate'
      ? (1 + (agg[ele] || 0) / 100) * (1 + agg.all / 100)
      : 1 + ((agg[ele] || 0) + agg.all) / 100;
  }

  function attrOf(agg) { return agg.str + agg.dex + agg.int; }

  /* 武器伤害基项：白字(stat20) + 平伤，再乘武器伤害乘算层（清算锤 PercentMult）。
     所有伤害来源（直击/DoT/触发/地狱风暴）统一走这里，保证口径一致。 */
  function wdOf(agg) { return (agg.weaponDamage + agg.flatDmg) * (agg.weaponDamageMult || 1); }

  /* 仆从自身技能的元素：取被动里第一个具体元素，否则物理 */
  function guessEle(min) {
    const b = min.bonus || {};
    const ELS = ['physical', 'fire', 'cold', 'lightning', 'poison', 'arcane'];
    if (b.dmg) for (const k in b.dmg) if (ELS.includes(k)) return k;
    return 'physical';
  }

  function mitigation(agg, ele, ctx) {
    const lvl = ctx.enemyLevel || 70;
    if (ele === 'physical') return (ctx.armor || 0) / ((ctx.armor || 0) + 50 * lvl);
    return (ctx.mr || 0) / ((ctx.mr || 0) + 50 * lvl);
  }

  function vsMultiplier(agg, ctx) {
    const v = agg.vs;
    let m = 1;
    if (ctx.elite) m += (v.elite || 0) / 100;
    m += (v.vulnerable || 0) / 100 * (ctx.vulnUptime || 0);
    if (ctx.bleeding) m += (v.bleeding || 0) / 100;
    if (ctx.poisoned) m += (v.poisoned || 0) / 100;
    if (ctx.burning) m += (v.burning || 0) / 100;
    m += (v.healthy || 0) / 100 * (ctx.healthyUptime || 0);
    m += (v.injured || 0) / 100 * (ctx.injuredUptime || 0);
    m += (v.slowed || 0) / 100 * (ctx.slowedUptime || 0);
    m += (v.immobilized || 0) / 100 * (ctx.immobilizedUptime || 0);
    if (ctx.distant) m += (v.distant || 0) / 100 * (typeof ctx.distant === 'number' ? Math.min(1, ctx.distant) : 1);
    return m;
  }

  /* ------------------------------------------------------------ 模拟 */
  function simulate(cfg, opts) {
    opts = opts || {};
    if (opts.singleHit) {
      // 单跳口径：目标此刻处于全部可达状态，条件项按 100% 计入
      cfg = JSON.parse(JSON.stringify(cfg));
      cfg.vulnUptime = 1;
      cfg.enemy = Object.assign({}, cfg.enemy, {
        elite: true, distant: 1,
        healthyUptime: 1, injuredUptime: 1,
        slowedUptime: 1, immobilizedUptime: 1
      });
    }
    const c = CLASSES[cfg.classKey];
    const agg = aggregate(cfg);
    const dt = 0.05;
    const duration = opts.duration || 60;
    const lite = !!opts.lite;   // 只算总量，不记录时间轴（词条批量试算用）

    const basic = findAb(c, cfg.skills.basic, 'basics');
    const strong = findAb(c, cfg.skills.strong, 'strongs');
    const sp1 = findAb(c, cfg.skills.special1, 'specials');
    const sp2 = findAb(c, cfg.skills.special2, 'specials');

    const enemy = cfg.enemy;
    const ctx = {
      elite: !!enemy.elite,
      armor: enemy.armor || 0,
      mr: enemy.mr || 0,
      enemyLevel: 70,
      critDR: enemy.critDR || 0,
      healthyUptime: enemy.healthyUptime != null ? enemy.healthyUptime : 0.2,
      injuredUptime: enemy.injuredUptime != null ? enemy.injuredUptime : 0.2,
      slowedUptime: enemy.slowedUptime || 0,
      immobilizedUptime: enemy.immobilizedUptime || 0,
      distant: typeof enemy.distant === 'number' ? enemy.distant : (enemy.distant ? 1 : 0), count: enemy.count || 1,
      vulnUptime: cfg.vulnUptime != null ? cfg.vulnUptime : 0.25,
      // 静电：点出静电充能后闪电命中必定叠层，按"平均 6 层"给默认值，
      // 用户可以手动覆盖（0–10），UI 里是滑块
      electroStacks: cfg.electroStacks != null ? cfg.electroStacks : (agg.flags.static ? 6 : 0),
      electroPerStack: cfg.electroPerStack, // 前端未决项可覆盖静电系数（默认取 data.js 1.0.4 真源 10%）
      takenMode: cfg.takenMode, // B4: 'multiplicative' 时静电×易伤相乘，默认加算
      // 脆裂：目标身上层数，1.0.4 真源来自传奇戒指暴伤池，默认 crit 归属。
      // 归属 brittleZone: 'crit'(暴击区，默认/文案方向) | 'taken'(受伤区) | 'off'(不启用)。
      brittleStacks: cfg.brittleStacks != null ? cfg.brittleStacks : 0,
      brittleZone: cfg.brittleZone || 'crit',
      bleeding: false, poisoned: false, burning: false
    };
    agg.electroStacks = ctx.electroStacks;

    const st = {
      mana: agg.manaMax,
      hpFrac: 1,
      t: 0,
      basicT: 0,
      strongCd: 0,
      cd: {},
      buffs: [],
      dots: [],
      vulnUntil: 0,
      stacks: { fist: 0, fistUntil: 0, focus: 0, charge: 0 },
      castLock: 0,
      total: 0,
      taken: 0,
      byAb: {},
      casts: {},
      hits: {},
      dotDmg: 0,
      strongCasts: 0,
      firstStrong: -1,
      lastStrong: -1,
      timeline: [],
      manaTimeline: [],
      events: [],
      targetHp: enemy.hp,
      targetMax: enemy.hp
    };

    const abInfo = id => (st.byAb[id] = st.byAb[id] || { dmg: 0, casts: 0, hits: 0, crit: 0 });
    [basic, strong, sp1, sp2].forEach(a => a && abInfo(a.id));

    st.vulnUntil = 0;

    const addBuff = (mods, dur) => st.buffs.push(Object.assign({ until: st.t + dur }, mods));
    const buffSum = key => st.buffs.reduce((a, b) => a + (b[key] || 0), 0);

    const curCC = ab => {
      let cc = agg.cc;
      if (ab.type === 'basic') cc += agg.ccBasic;
      if (ab.ele === 'lightning') cc += agg.ccLightning;
      if (ab.ele === 'physical') cc += agg.ccPhysical;
      if (ab.type === 'basic' && st.buffs.some(b => b.shout)) cc += 0;
      return Math.min(85, cc);
    };
    const curAS = () => agg.as + buffSum('as') + Math.min(20, st.stacks.fist) * 5 + ((st.buffs.some(b => b.phantom)) ? 0 : 0);

    function enemyState() {
      ctx.bleeding = st.dots.some(d => d.ele === 'physical' && d.bleed);
      ctx.poisoned = st.dots.some(d => d.ele === 'poison');
      ctx.burning = st.dots.some(d => d.ele === 'fire');
      return ctx;
    }

    function doHit(ab, mult) {
      const c2 = enemyState();
      c2.buffCc = buffSum('cc');
      c2.buffCd = buffSum('cd');
      let d = hitDamage(agg, ab, c2) * (mult || 1);

      // 附加元素伤害（如北境巨人之斧：每次基础攻击附带 50% 冰霜）
      if (ab.type === 'basic' && agg.basicExtra) {
        d += hitDamage(agg, { id: ab.id, name: ab.name, ele: agg.basicExtra.ele, pct: agg.basicExtra.pct }, c2);
      }

      if ((ab.type === 'basic' || ab.type === 'strong') && buffSum('mirror')) d *= 1 + buffSum('mirror');
      st.total += d;
      const info = abInfo(ab.id);
      info.dmg += d; info.hits += (ab.hits || 1);
      st.targetHp -= d;
      if (st.targetHp <= 0) st.targetHp = 0;

      // 触发型传奇（地狱风暴：每 10 次基础攻击一次 1000% 闪电）
      if (ab.type === 'basic') {
        st.basicCount = (st.basicCount || 0) + 1;
        (agg.procs || []).forEach(pr => {
          if (pr.everyBasic && st.basicCount % pr.everyBasic === 0) {
            const pd = hitDamage(agg, { id: '__proc', name: '召唤打击', ele: pr.ele, pct: pr.pct }, c2);
            st.total += pd;
            const pi = abInfo('__proc');
            pi.dmg += pd; pi.hits += 1;
            st.targetHp -= pd;
            if (st.targetHp <= 0) st.targetHp = 0;
          }
        });
      }
    }

    function targetsFor(ab) {
      let t = (ab.tags || []).includes('aoe') ? Math.min(enemy.count, 6) : 1;
      const mt = agg.multiTarget[ab.id];
      if (mt && enemy.count > 1) t = Math.min(enemy.count, t * mt);
      return t;
    }

    function applyDot(ab, dotOverride) {
      const dot = dotOverride || ab.dot;
      if (!dot) return;
      const existing = st.dots.find(d => d.src === ab.id);
      if (existing) {
        // 刷新并结转剩余
        existing.until = st.t + dot.dur;
        existing.pct = dot.pct;
        existing.ele = dot.ele;
        existing.bleed = (ab.tags || []).includes('bleed');
      } else {
        st.dots.push({ src: ab.id, pct: dot.pct, dur: dot.dur, ele: dot.ele, until: st.t + dot.dur, bleed: (ab.tags || []).includes('bleed') });
      }
    }

    function castSpecial(ab) {
      if (!ab || (st.cd[ab.id] || 0) > 0) return false;
      const cdBase = ab.cd || 20;
      st.cd[ab.id] = cdBase * (1 - agg.cdr / 100);
      st.castLock = Math.max(st.castLock, Math.min(0.3, cfg.gcd || 0.45));
      st.events.push({ t: st.t, id: ab.id, kind: 'special' });
      abInfo(ab.id).casts++;
      if (pctAtLevel(ab, cfg, ab.id)) { // B2: 等级成长后的倍率大于 0 才结算
        const targets = targetsFor(ab);
        for (let i = 0; i < targets; i++) doHit(ab, 1);
      }
      if (ab.dot) applyDot(ab);
      if (ab.vuln) st.vulnUntil = st.t + ab.vuln.dur;
      if (ab.buff) {
        const b = ab.buff;
        const dur = b.dur || 5;
        const mod = {};
        if (b.as) mod.as = b.as * (1 + (agg.flags.shout_plus_rank || 0) * 0.15);
        if (b.strong) mod.strong = b.strong;
        if (b.costRed) mod.costRed = b.costRed;
        if (b.cc) mod.cc = b.cc;
        if (b.cd) mod.cd = b.cd;
        if (b.mirror) mod.mirror = b.mirror;
        if (b.dodge) mod.dodge = b.dodge;
        addBuff(mod, dur + (b.as ? (agg.flags.shout_plus_rank || 0) * 0.5 : 0));
        if (b.manaRestore) {
          const amt = agg.manaMax * b.manaRestore / 100;
          st.mana = Math.min(agg.manaMax, st.mana + amt);
          st.gained = (st.gained || 0) + amt;
        }
      }
      if (ab.summon) {
        // 火元素：按秒结算
        const ticks = Math.round(ab.summon.dur / ab.summon.interval);
        for (let i = 0; i < ticks; i++) {
          st.dots.push({ src: ab.id + '_summon_' + i, pct: ab.summon.pct * ab.summon.interval, dur: ab.summon.interval, ele: 'fire', until: st.t + (i + 1) * ab.summon.interval, summon: true });
        }
      }
      if (ab.thorns) {
        const td = (agg.thorns || 0) * ab.thorns.mult;
        for (let i = 0; i < ab.thorns.dur; i++) {
          st.dots.push({ src: ab.id + '_t' + i, flat: td, ele: 'physical', until: st.t + i + 1, tickAt: st.t + i + 1, thorns: true });
        }
      }
      return true;
    }

    function castStrong() {
      const ab = strong;
      if (!ab) return false;
      let cost = ab.mana || 0;
      cost *= (1 - agg.costRed / 100) * (1 + agg.costAdd / 100);
      cost *= 1 - buffSum('costRed') / 100;
      cost = Math.max(0, cost);
      if (st.mana < cost - 0.01) return false;
      if ((st.strongCd || 0) > 0) return false;
      st.mana -= cost;
      st.spent = (st.spent || 0) + cost;
      st.strongCd = ab.cd || (cfg.gcd || 0.45);
      const dur = ab.channel ? ab.channel.dur : 0;
      if (dur) st.channelUntil = st.t + dur;
      st.castLock = Math.max(st.castLock, dur || (cfg.gcd || 0.45));
      st.events.push({ t: st.t, id: ab.id, kind: 'strong' });
      abInfo(ab.id).casts++;
      if (pctAtLevel(ab, cfg, ab.id)) { // B2
        const targets = targetsFor(ab);
        for (let i = 0; i < targets; i++) doHit(ab);
      }
      if (ab.dot) applyDot(ab);
      if (ab.vuln) st.vulnUntil = st.t + ab.vuln.dur;
      if (agg.flags.butcher_rank) abInfo(ab.id).extraHits = (abInfo(ab.id).extraHits || 0);
      st.strongCasts++;
      if (st.firstStrong < 0) st.firstStrong = st.t;
      st.lastStrong = st.t;
      return true;
    }

    let tickAcc = 0;
    const windowDmg = [];
    let winAcc = 0, winStart = 0;

    for (let step = 0; step < duration / dt; step++) {
      st.t = step * dt;
      // buff 过期
      st.buffs = st.buffs.filter(b => b.until > st.t);
      if (st.t > st.stacks.fistUntil) st.stacks.fist = 0;

      // 持续型传奇副伤（愤怒壁垒每 3 秒 210%、无尽流之器每秒 160% 等）
      (agg.procDps || []).forEach(pr => {
        const up = pr.uptime != null ? pr.uptime : 1;
        let dd = wdOf(agg) * (pr.pct / 100) * dt * up;
        dd *= 1 + attrOf(agg) / 100;
        dd *= eleMultOf(agg, pr.ele);
        dd *= vsMultiplier(agg, ctx) * takenMultiplier(agg, pr.ele, ctx);
        dd *= 1 - mitigation(agg, pr.ele, ctx);
        st.total += dd; st.dotDmg += dd; st.targetHp -= dd;
        abInfo('传奇副伤').dmg += dd;
      });

      // DoT
      for (const d of st.dots) {
        if (d.thorns) {
          if (d.tickAt <= st.t && !d.done) {
            d.done = true;
            let dd = d.flat * (1 + (agg.thornsPct || 0) / 100);
            dd *= 1 + (agg.physical || 0) / 100 * 0;
            st.total += dd; st.dotDmg += dd; st.targetHp -= dd;
            const k = 'thorns_' + (d.src);
            abInfo('荆棘').dmg += dd;
          }
          continue;
        }
        if (d.summon) {
          if (d.until <= st.t && !d.done) {
            d.done = true;
            const dd = dotTick(agg, { pct: d.pct, dur: 1, ele: d.ele }, enemyState());
            st.total += dd; st.dotDmg += dd; st.targetHp -= dd;
            abInfo('火元素').dmg += dd;
          }
          continue;
        }
        if (d.until <= st.t) continue;
        const tickEvery = 0.2;
        if (!d.next || st.t >= d.next) {
          d.next = (d.next || st.t) + tickEvery;
          const dd = dotTick(agg, d, enemyState()) * tickEvery;
          st.total += dd; st.dotDmg += dd; st.targetHp -= dd;
          abInfo(d.src).dmg += dd;
        }
      }
      st.dots = st.dots.filter(d => d.until > st.t || (!d.done && d.thorns));

      // 冷却
      for (const k in st.cd) st.cd[k] = Math.max(0, st.cd[k] - dt);
      st.strongCd = Math.max(0, st.strongCd - dt);
      st.castLock = Math.max(0, st.castLock - dt);

      // 特殊技能（按优先级）
      if (st.castLock <= 0) {
        if (sp1 && !sp1.defensive) castSpecial(sp1);
        if (sp2 && !sp2.defensive && st.castLock <= 0) castSpecial(sp2);
      }

      // 强力攻击
      if (st.castLock <= 0) castStrong();

      // 基础攻击：自动攻击，与动作条并行（仅被引导类技能打断）
      if (st.t >= (st.channelUntil || 0)) {
        const interval = Math.max(1 / ((1 + curAS() / 100) * agg.gear.speed), basic && basic.cd ? basic.cd : 0);
        st.basicT -= dt;
        if (st.basicT <= 0) {
          st.basicT += interval;
          const ab = basic;
          const targets = targetsFor(ab);
          abInfo(ab.id).casts++;
          st.events.push({ t: st.t, id: ab.id, kind: 'basic' });
          for (let i = 0; i < targets; i++) doHit(ab);
          let gen = ab.mana || 0;
          gen += agg.genFlat;
          gen *= 1 + agg.genPct / 100;
          st.mana = Math.min(agg.manaMax, st.mana + gen);
          st.gained = (st.gained || 0) + gen;
          if (ab.vuln) st.vulnUntil = Math.max(st.vulnUntil, st.t + ab.vuln.dur * (ab.vuln.chance / 100) * 0.5);
          if (ab.dot) applyDot(ab);
          if (ab.selfBuff) { st.stacks.fist = Math.min(ab.selfBuff.max, st.stacks.fist + 1); st.stacks.fistUntil = st.t + ab.selfBuff.dur; }
          if (agg.flags.hellstorm) {
            st.stacks.charge = (st.stacks.charge || 0) + 1;
            if (st.stacks.charge >= 10) {
              st.stacks.charge = 0;
              const d = wdOf(agg) * 10 * (1 + attrOf(agg) / 100) * (1 + (agg.lightning || 0) / 100) * (1 + (agg.all || 0) / 100);
              st.total += d; abInfo('地狱风暴').dmg += d; st.targetHp -= d;
            }
          }
        }
      }

      // 法力回复
      st.mana = Math.min(agg.manaMax, st.mana + agg.manaRegen * dt);
      st.gained = (st.gained || 0) + agg.manaRegen * dt;

      // 时间轴采样
      winAcc += 0;
      if (!lite && st.t - winStart >= 1) {
        st.timeline.push(st.total);
        st.manaTimeline.push(st.mana);
        winStart = st.t;
      }

      if (st.targetHp <= 0) {
        if (!st.killTime) st.killTime = st.t;
        st.targetHp = st.targetMax;
      }
    }

    const elapsed = duration;
    const dps = st.total / elapsed;
    const cycle = st.strongCasts > 1 ? (st.lastStrong - st.firstStrong) / (st.strongCasts - 1) : elapsed;
    const dmgPerCycle = st.strongCasts ? st.total / st.strongCasts : 0;

    return {
      agg, duration: elapsed, total: st.total, dps,
      dotDmg: st.dotDmg,
      breakdown: st.byAb,
      casts: st.strongCasts,
      cycle,
      dmgPerCycle,
      perCyclePct: (dmgPerCycle / agg.weaponDamage) * 100,
      dpsPct: (dps / agg.weaponDamage) * 100,
      avgMana: st.manaTimeline.length ? st.manaTimeline.reduce((a, b) => a + b, 0) / st.manaTimeline.length / agg.manaMax : 1,
      manaSpent: st.spent || 0, manaGained: st.gained || 0,
      killTime: st.killTime || null,
      timeline: st.timeline,
      manaTimeline: st.manaTimeline,
      events: st.events,
      basicInterval: 1 / ((1 + agg.as / 100) * agg.gear.speed),
      targetMax: enemy.hp,
      minion: agg.minion || null,
      electroStacks: ctx.electroStacks,
      // 主技能单跳的乘区明细，供"乘区验算"面板使用
      zones: strong ? hitZones(agg, strong, ctx) : (basic ? hitZones(agg, basic, ctx) : null)
    };
  }

  function findAb(c, id, key) {
    const a = (c[key] || []).find(x => x.id === id) || c[key][0];
    if (a && a.channel && !a._prep) {
      a.hits = Math.max(1, Math.round(a.channel.dur / a.channel.interval));
      a._prep = true;
    }
    return a;
  }

  /* 单发期望倍率（面板条件下，不含循环） */
  function perHitTable(cfg) {
    const c = CLASSES[cfg.classKey];
    const agg = aggregate(cfg);
    const enemy = cfg.enemy;
    const ctx = {
      elite: !!enemy.elite, armor: enemy.armor || 0, mr: enemy.mr || 0,
      enemyLevel: 70, critDR: enemy.critDR || 0,
      healthyUptime: enemy.healthyUptime || 0, injuredUptime: enemy.injuredUptime || 0,
      slowedUptime: enemy.slowedUptime || 0, immobilizedUptime: enemy.immobilizedUptime || 0,
      distant: typeof enemy.distant === 'number' ? enemy.distant : (enemy.distant ? 1 : 0), vulnUptime: cfg.vulnUptime || 0,
      count: enemy.count || 1,
      electroStacks: cfg.electroStacks != null ? cfg.electroStacks : (agg.flags.static ? 6 : 0),
      electroPerStack: cfg.electroPerStack,
      takenMode: cfg.takenMode, // B4
      brittleStacks: cfg.brittleStacks != null ? cfg.brittleStacks : 0,
      brittleZone: cfg.brittleZone || 'crit',
      bleeding: true, poisoned: true, burning: true
    };
    return [...c.basics, ...c.strongs, ...c.specials].map(ab => {
      const d = hitDamage(agg, ab, ctx);
      const one = ab.hits ? d / ab.hits : d;
      return {
        id: ab.id, name: ab.name, type: ab.type || (c.basics.includes(ab) ? 'basic' : c.strongs.includes(ab) ? 'strong' : 'special'),
        dmg: d, pct: (one / agg.weaponDamage) * 100, ele: ab.ele,
        mana: ab.mana || 0, cd: ab.cd || 0
      };
    });
  }

  /* 黑雾（Black Mist）基底：护腿/肩甲/披风 三格可在工坊重铸任意词条 */
  // 黑雾可重铸基底：护腿、肩甲（披风虽也是黑雾基底，但无属性）
  const FLEX_SLOTS = ['pants', 'shoulder'];

  /* 词条收益排行 */
  function rankAffixes(cfg, opts) {
    opts = opts || {};
    const dur = opts.duration || 40;
    const simOpts = { duration: dur, lite: opts.lite !== false };
    const base = simulate(cfg, simOpts);
    const c = CLASSES[cfg.classKey];
    const list = [];
    const slotMap = cfg.slot || null;
    const flex = !!(slotMap && FLEX_SLOTS.includes(slotMap));
    const add = (key, name, apply) => {
      const clone = JSON.parse(JSON.stringify(cfg));
      apply(clone);
      const r = simulate(clone, simOpts);
      list.push({ key, name, delta: (r.dps / base.dps - 1) * 100, dps: r.dps });
    };
    for (const group in D.AFFIXES) {
      for (const key in D.AFFIXES[group]) {
        const a = D.AFFIXES[group][key];
        if (a.class && !a.class.includes(cfg.classKey)) continue;
        if (a.ele && a.ele !== cfg.element) continue;
        if (!flex && a.slots !== 'all' && slotMap && !a.slots.includes(slotMap)) continue;
        if (key === 'maxHealth') continue;
        add(key, a.name, cl => {
          if (a.flat) cl.gear.flat += a.v;
          else if (key === 'manaMax') cl.gear.manaMax += a.v;
          else if (key === 'cdr') cl.gear.cdr = (cl.gear.cdr || 0) + a.v;
          else if (key === 'costRed') cl.gear.costRed += a.v;
          else if (key === 'cc') cl.gear.cc += a.v;
          else if (key === 'cd') cl.gear.cd += a.v;
          else if (key === 'as') cl.gear.as += a.v;
          else if (key === 'all') cl.gear.all += a.v;
          else if (key === 'dot') cl.gear.dot = (cl.gear.dot || 0) + a.v;
          else if (a.type) { cl.gear.typeExtra = Object.assign({}, cl.gear.typeExtra, { [a.type]: a.v }); }
          else if (a.vs === 'elite') cl.gear.vsElite += a.v;
          else if (a.vs === 'vulnerable') cl.gear.vsVuln += a.v;
          else if (a.vs) { cl.gear.vsExtra = Object.assign({}, cl.gear.vsExtra, { [a.vs]: a.v }); }
          else if (a.ele) cl.gear.ele += a.v;
          else if (['str', 'dex', 'int'].includes(key)) cl.gear.main += a.v;
        });
      }
    }
    list.sort((a, b) => b.delta - a.delta);
    return { base, list };
  }

  /* 天赋自动规划：贪心 + 单点交换精修（专精行互斥，门槛按累计点数解锁） */
  function autoTalents(cfg, points) {
    points = points || 70;
    const c = CLASSES[cfg.classKey];
    const simOpts = { duration: 32, lite: true };
    const score = t => simulate(Object.assign({}, cfg, { talents: t }), simOpts).dps;

    const rows = c.talents;
    const isCap = row => [10, 30, 60].includes(row.at);
    const capPick = {};                     // 行号 → 已投的专精 id
    rows.forEach((row, i) => { if (isCap(row)) capPick[i] = null; });

    const ranks = {};
    let cur = score({});
    for (let p = 0; p < points; p++) {
      const total = Object.values(ranks).reduce((a, b) => a + b, 0);
      let best = null;
      rows.forEach((row, i) => {
        if (total < row.at) return;
        row.items.forEach(tal => {
          const r = ranks[tal.id] || 0;
          if (r >= tal.max) return;
          if (capPick[i] != null && capPick[i] !== tal.id) return;   // 专精互斥
          const d = score(Object.assign({}, ranks, { [tal.id]: r + 1 }));
          if (!best || d > best.dps) best = { id: tal.id, dps: d, row: i };
        });
      });
      if (!best) break;
      ranks[best.id] = (ranks[best.id] || 0) + 1;
      if (capPick[best.row] === null) capPick[best.row] = best.id;
      cur = best.dps;
    }

    // 单点交换：从已投的点挪 1 点到别处，能涨就换（上限 900 次试算）
    const cand = [];
    rows.forEach((row, i) => row.items.forEach(t => cand.push({ t, i })));
    let budget = 900, bestDps = cur, bestR = ranks;
    for (let pass = 0; pass < 3 && budget > 0; pass++) {
      let improved = false;
      const owned = Object.keys(bestR).filter(k => bestR[k] > 0);
      for (const a of owned) {
        if (budget <= 0) break;
        for (const { t, i } of cand) {
          if (budget <= 0) break;
          if (t.id === a) continue;
          const rb = bestR[t.id] || 0;
          if (rb >= t.max) continue;
          if (capPick[i] != null && capPick[i] !== t.id) continue;
          const trial = Object.assign({}, bestR, { [a]: bestR[a] - 1, [t.id]: rb + 1 });
          if (trial[a] <= 0) delete trial[a];
          budget--;
          const d = score(trial);
          if (d > bestDps * 1.0004) {
            if (!trial[a]) {
              const ar = rows.findIndex(r => r.items.some(x => x.id === a));
              if (ar >= 0 && capPick[ar] === a) capPick[ar] = null;
            }
            bestR = trial; bestDps = d; improved = true;
          }
        }
      }
      if (!improved) break;
    }
    return bestR;
  }

  return { GEAR_PRESETS, FLEX_SLOTS, MECHANICS: MED, aggregate, simulate, perHitTable, rankAffixes, autoTalents, hitDamage, hitZones, zoneSet, takenMultiplier, findAb };
})();
