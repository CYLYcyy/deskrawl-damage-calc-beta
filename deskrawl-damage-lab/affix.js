/* ==========================================================================
   装备数值模块 · 任意装分 × 稀有度 -> 词条数值 / 部位池 / 职业掩码 / Divine 固定表
   数据证据等级：A（游戏本体字节级反编译）
   来源：
     - limbo947/Deskrawl-Reverse  data/so_dump/AffixRollTable.json  (55 项 PerLevel + rarityMul + 公式)
     - limbo947/Deskrawl-Reverse  data/so_dump/ItemizationConfig.json (Slot 1-11 主/副池 + 孔位)
     - awesomehy/Deskrawl-Assistant data/affix-class-filters.json (primary_exclusion_masks)
     - /root/.codebuddy/artifact/GEAR_RESEARCH.md §2/§3/§3.7（公式裁决 + Divine 固定表）
   口径说明：PER_LEVEL 为反编译原始小数系数（百分比类存小数）；
     affixValue 返回「游戏显示单位」——百分比类词条 ×100（如暴伤 67.2 而非 0.672），
     与本地 data.js AFFIXES.v / engine.js GEAR_PRESETS 的口径一致。满掷 roll=1.15，中值 roll=1.0。
   TODO(D)：PotionCharges(38) 在腰带主池但 AffixRollTable 无系数；
   TODO(D)：5 件 Divine（Grandmother's Bow / Violet Skybow / Dreadwing / Soulrender /
            Schrodinger's Ring / Ring of Momentum）只有属性名无数值，value=null，待游戏内实测。
   TODO(待裁决)：Ancient Divine 仅被动增强、基础词条与 Divine 相同（官方 1.1.11 原文），逐件增强幅度未汇总。
   兼容：浏览器 window.AffixMath / Node vm globalThis.AffixMath。
   ========================================================================== */

const RARITY_BONUS = { common: 0.2, uncommon: 0.4, rare: 0.5, legendary: 0.6, divine: 0, runeSet: 0 };

// 55 项原始系数（key = StatType 数字，value = AffixRollTable.PerLevel）
const PER_LEVEL = {
  0: 0.05, // 力量
  1: 0.05, // 敏捷
  2: 0.05, // 智力
  3: 0.03, // 通用增伤
  7: 0.45, // 最大生命
  42: 0.0002, // 最大生命%
  14: 0.05, // 最大法力
  4: 8e-05, // 暴击率
  5: 0.0006, // 暴击伤害
  6: 0.00015, // 攻击速度%
  8: 0.5, // 护甲
  44: 0.0002, // 护甲%
  9: 0.5, // 魔抗
  60: 0.0002, // 暴击伤害减免
  51: 0.0001, // 物理减伤
  52: 0.0001, // 火焰减伤
  53: 0.0001, // 冰霜减伤
  54: 0.0001, // 闪电减伤
  49: 0.0001, // 毒素减伤
  55: 0.0001, // 奥术减伤
  13: 0.0001, // 冷却缩减
  57: 0.0001, // 移动速度%
  22: 5e-05, // 闪避
  11: 0.02, // 击中回血
  12: 0.06, // 击杀回血
  36: 0.02, // 生命回复
  35: 0.01, // 击杀回蓝
  15: 0.0002, // 金币获取
  16: 0.0002, // 魔法装备获取
  17: 0.0002, // 药水掉落
  41: 0.0002, // 经验获取
  20: 0.2, // 武器伤害
  23: 0.0008, // 物理伤害%
  24: 0.0008, // 火焰伤害%
  25: 0.0008, // 冰霜伤害%
  26: 0.0008, // 闪电伤害%
  27: 0.0008, // 毒素伤害%
  28: 0.0008, // 奥术伤害%
  29: 0.001, // 对健康敌人
  30: 0.001, // 对受伤敌人
  31: 0.001, // 对减速敌人
  43: 0.001, // 对定身敌人
  45: 0.001, // 对流血的敌人
  46: 0.001, // 对中毒的敌人
  58: 0.001, // 对远处敌人
  62: 0.001, // 持续伤害
  63: 0.001, // 对灼烧的敌人
  32: 0.001, // 对精英
  40: 0.001, // 对易伤敌人
  65: 0.0004, // 全伤害加成%
  33: 0.0007, // 普攻伤害
  34: 0.0007, // 强力攻击伤害
  61: 0.0008, // 特殊技能加成伤害
  37: 0.0001, // 法力消耗缩减
  39: 0.1, // 荆棘
};

// 百分比显示类 StatID（原始系数为小数；输出 ×100 转显示单位）
const PERCENT_STATS = new Set([4,5,6,13,15,16,17,22,23,24,25,26,27,28,29,30,31,32,33,34,37,40,41,42,43,44,45,46,49,51,52,53,54,55,57,58,60,61,62,63,65]);
const STAT_NAMES = {
  0: "力量",
  1: "敏捷",
  2: "智力",
  3: "通用增伤",
  7: "最大生命",
  42: "最大生命%",
  14: "最大法力",
  4: "暴击率",
  5: "暴击伤害",
  6: "攻击速度%",
  8: "护甲",
  44: "护甲%",
  9: "魔抗",
  60: "暴击伤害减免",
  51: "物理减伤",
  52: "火焰减伤",
  53: "冰霜减伤",
  54: "闪电减伤",
  49: "毒素减伤",
  55: "奥术减伤",
  13: "冷却缩减",
  57: "移动速度%",
  22: "闪避",
  11: "击中回血",
  12: "击杀回血",
  36: "生命回复",
  35: "击杀回蓝",
  15: "金币获取",
  16: "魔法装备获取",
  17: "药水掉落",
  41: "经验获取",
  20: "武器伤害",
  23: "物理伤害%",
  24: "火焰伤害%",
  25: "冰霜伤害%",
  26: "闪电伤害%",
  27: "毒素伤害%",
  28: "奥术伤害%",
  29: "对健康敌人",
  30: "对受伤敌人",
  31: "对减速敌人",
  43: "对定身敌人",
  45: "对流血的敌人",
  46: "对中毒的敌人",
  58: "对远处敌人",
  62: "持续伤害",
  63: "对灼烧的敌人",
  32: "对精英",
  40: "对易伤敌人",
  65: "全伤害加成%",
  33: "普攻伤害",
  34: "强力攻击伤害",
  61: "特殊技能加成伤害",
  37: "法力消耗缩减",
  39: "荆棘",
};

/* 掷骰公式：value = (1+rarityMul) × (ilvl×PerLevel[stat] (+5 if stat==20)) × roll
   百分比类再 ×100 转显示单位；保留 3 位，下限 0.001。
   校验：affixValue(700,"legendary",0,1.0)===56；affixValue(700,"legendary",5,1.0)===67.2 */
function affixValue(ilvl, rarity, stat, roll) {
  const per = PER_LEVEL[stat];
  if (per == null) return 0;
  const mul = RARITY_BONUS[rarity] != null ? RARITY_BONUS[rarity] : 0;
  roll = (roll == null) ? 1.0 : roll;
  let base = Number(ilvl) * per;
  if (stat === 20) base += 5; // WeaponDamage 特例（+5 在 rare 乘区之内）
  let v = (1 + mul) * base * roll;
  if (PERCENT_STATS.has(stat)) v *= 100;
  return +Math.max(v, 0.001).toFixed(3);
}

// 职业排除掩码：HeroClass 位标志 战士1 / 法师2 / 猎人4 / 武僧8
const CLASS_EXCLUDE = {
  0: 14, // Stats.Strength
  1: 3, // Stats.Dexterity
  2: 13, // Stats.Intelligence
  23: 2, // Stats.DamagePhysical
  24: 12, // Stats.DamageFire
  25: 13, // Stats.DamageCold
  26: 5, // Stats.DamageLightning
  27: 11, // Stats.DamagePoison
  28: 11, // Stats.DamageArcane
  45: 14, // Stats.DamageVsBleeding
  46: 11, // Stats.DamageVsPoisoned
  58: 9, // Stats.DamageVsDistant
  62: 8, // Stats.DamageOverTime
  63: 13, // Stats.DamageVsBurned
};

// 部位池：数组 = 主池；附 .secondary（副池）/ .sockets（孔）/ .name 属性
const SLOT_POOLS = {
  1: [0, 1, 2, 3, 5, 6, 33, 34, 61, 23, 24, 25, 26, 27, 28, 29, 30, 31, 43, 32, 45, 58, 46, 62, 63, 40],
  2: [0, 1, 2, 7, 14, 13, 8, 9, 22, 44, 54, 55],
  3: [0, 1, 2, 7, 8, 9, 22, 39, 44, 42, 61, 29, 30, 51, 53],
  4: [0, 1, 2, 7, 8, 9, 22, 39, 44, 42, 49, 51],
  5: [0, 1, 2, 7, 8, 9, 22, 37, 53, 52, 60],
  6: [0, 1, 2, 7, 22, 9, 37, 38, 13, 6, 39],
  7: [0, 1, 2, 4, 5, 6, 14, 9, 40, 23, 24, 25, 26, 27, 28, 65],
  8: [0, 1, 2, 4, 5, 6, 13, 9, 33, 34, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 40, 44, 65],
  9: [0, 1, 2, 13, 37, 14, 4, 3, 5, 6, 60, 9],
  10: [0, 1, 2, 7, 8, 9, 22, 13, 49, 52, 60, 39],
  11: [],
};
for (const k in SLOT_POOLS) {
  if (+k === 1) { SLOT_POOLS[k].secondary = [11, 12, 35]; SLOT_POOLS[k].sockets = 3; SLOT_POOLS[k].name = "武器"; }
  if (+k === 2) { SLOT_POOLS[k].secondary = [36, 16, 15, 17, 41]; SLOT_POOLS[k].sockets = 1; SLOT_POOLS[k].name = "头盔"; }
  if (+k === 3) { SLOT_POOLS[k].secondary = [36, 11, 15, 16, 41]; SLOT_POOLS[k].sockets = 2; SLOT_POOLS[k].name = "胸甲"; }
  if (+k === 4) { SLOT_POOLS[k].secondary = [36, 11, 15, 16, 41]; SLOT_POOLS[k].sockets = 2; SLOT_POOLS[k].name = "护腿"; }
  if (+k === 5) { SLOT_POOLS[k].secondary = [17, 57, 11, 16, 15]; SLOT_POOLS[k].sockets = 0; SLOT_POOLS[k].name = "靴子"; }
  if (+k === 6) { SLOT_POOLS[k].secondary = [17, 36, 35, 41]; SLOT_POOLS[k].sockets = 0; SLOT_POOLS[k].name = "腰带"; }
  if (+k === 7) { SLOT_POOLS[k].secondary = [11, 12, 41, 16, 15]; SLOT_POOLS[k].sockets = 1; SLOT_POOLS[k].name = "戒指"; }
  if (+k === 8) { SLOT_POOLS[k].secondary = [57, 11, 16, 41]; SLOT_POOLS[k].sockets = 1; SLOT_POOLS[k].name = "项链"; }
  if (+k === 9) { SLOT_POOLS[k].secondary = [15, 16, 17, 35, 41]; SLOT_POOLS[k].sockets = 0; SLOT_POOLS[k].name = "手套"; }
  if (+k === 10) { SLOT_POOLS[k].secondary = [36, 57]; SLOT_POOLS[k].sockets = 0; SLOT_POOLS[k].name = "肩甲"; }
  if (+k === 11) { SLOT_POOLS[k].secondary = []; SLOT_POOLS[k].sockets = 0; SLOT_POOLS[k].name = "背部"; }
}
// 结构化的完整池（含主/副/孔），供不需要数组兼容写法的调用方使用
const SLOT_POOLS_DETAIL = JSON.parse(JSON.stringify(SLOT_POOLS));

/* Divine / Ancient Divine 固定词条（GEAR_RESEARCH §3.7，A 级； Ancient 基础属性完全相同）
   value:null 表示真源只有属性名、无数值（D 级 TODO，禁止用公式外推）。 */
const DIVINE_FIXED = {
  TheGrandmother: { name: "祖母", slot: "武器", stats: {3:50, 34:120, 29:170, 7:850, 35:17, 11:34, 6:0.8, 20:430} },
  GrandmothersBow: { name: "祖母之弓", slot: "武器", stats: {3:null, 34:null, 29:null, 7:null, 35:null, 11:null} },
  VioletSkybow: { name: "紫天弓", slot: "武器", stats: {6:null, 5:null, 58:null, 32:null, 11:null, 15:null} },
  Dreadwing: { name: "恐惧之翼", slot: "武器", stats: {3:null, 34:null, 32:null, 7:null, 11:null, 35:null} },
  Soulrender: { name: "噬魂者", slot: "武器", stats: {31:null, 33:null, 42:null, 64:null, 12:null, 11:null} },
  GloriousGladiatorHelmet: { name: "光荣角斗士头盔", slot: "头盔", stats: {8:840, 44:35, 7:850, 37:17, 14:80, 36:35, 16:35} },
  VisageOfTheUndying: { name: "不朽面容", slot: "头盔", stats: {8:840, 7:850, 42:35, 61:135, 13:17, 17:35} },
  IronTyrantsHelm: { name: "铁暴君头盔", slot: "头盔", stats: {8:840, 7:850, 60:35, 65:70, 13:17, 57:15, 15:35} },
  RemnantOfTheElderSage: { name: "远古贤者遗物", slot: "戒指", stats: {37:17, 13:17, 4:13.5, 5:100, 15:35, 16:35} },
  SchrodingersRing: { name: "薛定谔之戒", slot: "戒指", stats: {4:null, 5:null, 6:null, 9:null, 15:null, 16:null} },
  RingOfMomentum: { name: "动量之戒", slot: "戒指", stats: {4:null, 65:null, 6:null, 9:null, 15:null, 16:null} },
};

const CLASS_BITS = { barbarian:1, warrior:1, mage:2, sorcerer:2, hunter:4, monk:8, wizard:2 };

/* 由 gearBuild 生成 engine.js 所用 gear 聚合对象。
   cfg.gearBuild = { ilvl, rarity, slots:[{slot, main:[stat...], secondary:[stat...], roll}],
                     classKey?, element?, blackMist?, ancient?, dps?, speed?, divineId? }
   分类：0/1/2->main；4->cc；5->cd；6->as；23-28->ele(仅当前元素)；33/34/61->type；
         65->all；32->vsElite；40->vsVuln；3->flat；14->manaMax；35/36->regen；13->cdr；62->dot。
   职业过滤：CLASS_EXCLUDE[stat] & classBit 则跳过（次级池不过滤）。
   Divine：rarity=divine/ancientDivine 且给 divineId 时直接查 DIVINE_FIXED，不走公式。
   黑雾：rarity=blackMist 或 blackMist:true -> legendary 基底、ilvl 850、roll 1.15。 */
function buildGear(cfg) {
  const gb = (cfg && cfg.gearBuild) || {};
  const out = { name: gb.name || (cfg && cfg.gearBuild && cfg.gearBuild.name) || "自定义装备",
    main:0, cc:0, cd:0, as:0, ele:0, type:0, all:0, vsElite:0, vsVuln:0,
    manaMax:0, regen:0, costRed:0, flat:0, cdr:0, dot:0,
    weaponDamage: null,
    dps: gb.dps != null ? gb.dps : ((cfg.gear && cfg.gear.dps) || 200),
    speed: gb.speed != null ? gb.speed : ((cfg.gear && cfg.gear.speed) || 1.0),
    typeExtra:{}, vsExtra:{}, other:{} };
  const rarity = gb.blackMist ? "blackMist" : (gb.rarity || "legendary");
  const blackMist = (rarity === "blackMist" || rarity === "legendary" && gb.blackMist === true);
  const ancient = !!gb.ancient;
  let ilvl = Number(gb.ilvl) || 700;
  if (blackMist && !gb.ilvl) ilvl = 850;
  const effRarity = (rarity === "blackMist" || ancient || rarity === "ancient") ? "legendary" : rarity;
  const effRoll = (blackMist || ancient) ? 1.15 : 1.0;
  const ckey = gb.classKey || (cfg && cfg.classKey) || "";
  const cbit = typeof ckey === "number" ? ckey : (CLASS_BITS[String(ckey).toLowerCase()] || 0);
  const element = gb.element || (cfg && cfg.element) || "";
  if (rarity === "divine" || rarity === "ancientDivine") {
    const id = gb.divineId || gb.item || gb.name;
    const D = DIVINE_FIXED[id];
    if (D) {
      out.name = D.name + (rarity === "ancientDivine" ? "（远古）" : "");
      for (const k in D.stats) {
        const v = D.stats[k];
        if (v == null) { out.other["divine_todo_" + k] = null; continue; } // TODO(D) 缺数值
        const sk = STAT_NAMES[k] || ("stat" + k);
        switch (Number(k)) {
          case 0: case 1: case 2: out.main += v; break;
          case 4: out.cc += v; break; case 5: out.cd += v; break; case 6: out.as += v; break;
          case 14: out.manaMax += v; break; case 13: out.cdr += v; break;
          case 3: out.flat += v; break; case 65: out.all += v; break;
          case 32: out.vsElite += v; break; case 40: out.vsVuln += v; break;
          case 33: case 34: case 61: out.type += v; break; case 62: out.dot += v; break;
          case 35: case 36: out.regen += v; break; case 37: out.costRed += v; break;
          case 20: out.weaponDamage = v; out.dps = v * out.speed; break; // stat20 = 武器伤害真源值；dps 仅作显示派生量
          case 23: case 24: case 25: case 26: case 27: case 28: {
            const el = {23:"physical",24:"fire",25:"cold",26:"lightning",27:"poison",28:"arcane"}[Number(k)];
            if (el === element) out.ele += v; else out.other["ele_" + el] = v; break; }
          default: out.other[sk] = (out.other[sk] || 0) + v;
        }
      }
      return out;
    }
    out.other.divine_unknown = id || "未指定 divineId"; // 查不到固定表则原样返回（不套公式）
    return out;
  }
  const ELE = {23:"physical",24:"fire",25:"cold",26:"lightning",27:"poison",28:"arcane"};
  const VS = {29:"healthy",30:"injured",31:"slowed",43:"immobilized",45:"bleeding",46:"poisoned",58:"distant",63:"burning"};
  const addStat = (stat, roll) => {
    if (stat == null || PER_LEVEL[stat] == null) return;
    if (cbit && CLASS_EXCLUDE[stat] && (CLASS_EXCLUDE[stat] & cbit)) return;
    const v = affixValue(ilvl, effRarity, stat, roll);
    switch (Number(stat)) {
      case 0: case 1: case 2: out.main += v; break;
      case 4: out.cc += v; break;
      case 5: out.cd += v; break;
      case 6: out.as += v; break;
      case 14: out.manaMax += v; break;
      case 13: out.cdr += v; break;
      case 3: out.flat += v; break;
      case 65: out.all += v; break;
      case 32: out.vsElite += v; break;
      case 40: out.vsVuln += v; break;
      case 33: case 34: case 61: out.type += v; break;
      case 62: out.dot += v; break;
      case 35: case 36: out.regen += v; break;
      case 37: out.costRed += v; break;
      case 20: out.weaponDamage = v; out.dps = v * out.speed; break; // stat20 = 武器伤害真源值；dps 仅作显示派生量
      default:
        if (ELE[stat]) { if (ELE[stat] === element) out.ele += v; else out.other["ele_" + ELE[stat]] = (out.other["ele_" + ELE[stat]] || 0) + v; }
        else if (VS[stat]) out.vsExtra[VS[stat]] = (out.vsExtra[VS[stat]] || 0) + v;
        else out.other[STAT_NAMES[stat] || ("stat" + stat)] = (out.other[STAT_NAMES[stat] || ("stat" + stat)] || 0) + v;
    }
  };
  for (const sl of (gb.slots || [])) {
    const roll = sl.roll != null ? sl.roll : effRoll;
    // 主池合法性校验（仅提示，不强制；允许调用方显式指定跨池词条）
    if (sl.slot != null && SLOT_POOLS[sl.slot]) {
      const pool = SLOT_POOLS[sl.slot];
      (sl.main || []).forEach(st => { if (pool.indexOf(st) < 0) out.other.poolWarning = (out.other.poolWarning || "") + "slot" + sl.slot + ":" + st + " "; });
    }
    (sl.main || []).forEach(st => addStat(st, roll));
    // 次级词缀不做职业过滤（反编译 gu.dxf）
    (sl.secondary || []).forEach(st => {
      const v = affixValue(ilvl, effRarity, st, roll);
      if (st === 11 || st === 12) out.flat += v;
      else if (st === 15 || st === 16 || st === 17 || st === 41) out.other[STAT_NAMES[st]] = (out.other[STAT_NAMES[st]] || 0) + v;
      else addStat(st, roll);
    });
  }
  return out;
}

if (typeof window !== "undefined") window.AffixMath = { RARITY_BONUS, PER_LEVEL, PERCENT_STATS, STAT_NAMES, affixValue, CLASS_EXCLUDE, SLOT_POOLS, SLOT_POOLS_DETAIL, DIVINE_FIXED, CLASS_BITS, buildGear };
else globalThis.AffixMath = { RARITY_BONUS, PER_LEVEL, PERCENT_STATS, STAT_NAMES, affixValue, CLASS_EXCLUDE, SLOT_POOLS, SLOT_POOLS_DETAIL, DIVINE_FIXED, CLASS_BITS, buildGear };
