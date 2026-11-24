/* ==========================================================================
   桌面破坏神 · 伤害计算专家  —  数据集
   游戏版本: 1.1.11a (2026-11-12) = 内部补丁 1.0.4   数据校对: 2026-11-25
   数据来源: Deskrawl-Reverse 1.0.4 SO dump（字节级真源，buildid 26606215）+ 官方补丁公告
   说明: 技能数值为技能等级 10/10、角色 70 级。2026-11-25 全面对齐 1.0.4 真源：
         44 个技能倍率按 AttackScaling.value 重灌、静电 5%→10%（真源实锤）。
         标注 approx 的为社区推算值（真源未覆盖部分）。
   更新方式: 只改本文件，engine.js 与界面无需改动。
   ========================================================================== */
window.DESKRAWL_DATA = (function () {
  const VERSION = {
    game: '1.1.11a',
    gameDate: '2026-11-12',
    dataDate: '2026-11-25',
    trueSource: 'Deskrawl-Reverse 1.0.4（buildid 26606215，Steam展示号 1.1.11a = 内部补丁 1.0.4）',
    note: '技能 10/10、等级 70、物品等级 700 基准；2026-11-25 全面对齐 1.0.4 SO 真源'
  };

  const ELEMENTS = {
    physical: { name: '物理', color: '#d8cfc0' },
    fire: { name: '火焰', color: '#e2603c' },
    cold: { name: '冰霜', color: '#5fa8d3' },
    lightning: { name: '闪电', color: '#e6c34a' },
    poison: { name: '毒素', color: '#7fa650' },
    arcane: { name: '奥术', color: '#a97bd4' }
  };

  /* ================================================================
     宝石镶嵌系统（1.0.4 SO 真源 GemData.json，42 条 = 6 家族 × 7 品级）
     ----------------------------------------------------------------
     真源字段：每颗宝石按"镶嵌部位类型"给三套完全不同的加成：
       WeaponBonuses    → 武器槽：元素伤害%（Stat 23-28），进元素加算池
       ArmorBonuses     → 护甲槽：主属性/CDR/生命%/荆棘
       AccessoryBonuses → 饰品槽：对应元素减伤%（生存向，不进 DPS）
     宝石加成是固定值、不随等级成长（docs/04 §GemData）。
     数值直接从 SO 浮点字段读出，未做外推。
     ================================================================ */
  const GEM_GRADES = [
    { lv: 1, prefix: '粗糙的', shape: '球',     weapon: 0.10 },
    { lv: 2, prefix: '碎裂的', shape: '泪滴',   weapon: 0.15 },
    { lv: 3, prefix: '粗砺的', shape: '方块',   weapon: 0.20 },
    { lv: 4, prefix: '抛光的', shape: '菱形',   weapon: 0.25 },
    { lv: 5, prefix: '无瑕的', shape: '六边形', weapon: 0.35 },
    { lv: 6, prefix: '璀璨的', shape: '八边形', weapon: 0.50 },
    { lv: 7, prefix: '完美的', shape: '星形',   weapon: 0.70 }
  ];

  const GEM_FAMILIES = {
    diamond: {
      name: '钻石', color: '#d8cfc0', element: 'physical', pathBase: 64340,
      armor: { stat: 'cdr', name: '冷却缩减', isPct: true, values: [0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05] },
      accessory: { stat: 'physicalDR', name: '物理减伤', isPct: true, values: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17] }
    },
    ruby: {
      name: '红宝石', color: '#e2603c', element: 'fire', pathBase: 64354,
      armor: { stat: 'str', name: '力量', isPct: false, values: [5, 10, 15, 20, 25, 30, 35] },
      accessory: { stat: 'fireDR', name: '火焰减伤', isPct: true, values: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17] }
    },
    sapphire: {
      name: '蓝宝石', color: '#5fa8d3', element: 'cold', pathBase: 64361,
      armor: { stat: 'hpPct', name: '最大生命%', isPct: true, values: [0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.21] },
      accessory: { stat: 'coldDR', name: '冰霜减伤', isPct: true, values: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17] }
    },
    topaz: {
      name: '黄玉', color: '#e6c34a', element: 'lightning', pathBase: 64368,
      armor: { stat: 'dex', name: '敏捷', isPct: false, values: [5, 10, 15, 20, 25, 30, 35] },
      accessory: { stat: 'lightningDR', name: '闪电减伤', isPct: true, values: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17] }
    },
    emerald: {
      name: '绿宝石', color: '#7fa650', element: 'poison', pathBase: 64347,
      armor: { stat: 'thorns', name: '荆棘', isPct: false, values: [10, 20, 40, 80, 105, 130, 160] },
      accessory: { stat: 'poisonDR', name: '毒素减伤', isPct: true, values: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17] }
    },
    amethyst: {
      name: '紫水晶', color: '#a97bd4', element: 'arcane', pathBase: 64333,
      armor: { stat: 'int', name: '智力', isPct: false, values: [5, 10, 15, 20, 25, 30, 35] },
      accessory: { stat: 'arcaneDR', name: '奥术减伤', isPct: true, values: [0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17] }
    }
  };

  /* 槽位类型判定：决定一颗宝石镶上去读哪套加成字段 */
  const GEM_SLOT_TYPE = {
    1: 'weapon', 2: 'armor', 3: 'armor', 4: 'armor', 5: 'armor', 6: 'armor',
    7: 'accessory', 8: 'accessory', 9: 'armor', 10: 'armor', 11: 'armor'
  };
  /* 孔位上限，与 affix.js SLOT_POOLS[k].sockets 一致（真源 ItemizationConfig） */
  const GEM_SLOT_CAP = {
    1: 3, 2: 1, 3: 2, 4: 2, 5: 0, 6: 0, 7: 1, 8: 1, 9: 0, 10: 0, 11: 0
  };
  const GEM_CONFIG = {
    minLevel: 30,          // MinLevelForSockets，镶嵌开放等级
    socketMaterialAmount: 100,
    socketGoldPerItemLevel: 400,
    note: '武器槽元素伤%直接进 1+元素%+全伤% 加算池；护甲槽主属性吃 1+主属性/100；饰品槽减伤仅生存向不进 DPS。'
  };
  /* app.js 的部位字符串键 → 引擎/真源数字槽位（对应 affix.js SLOT_POOLS 的 key） */
  const GEM_KEY_TO_SLOT = {
    weapon: 1, helm: 2, chest: 3, pants: 4, boots: 5, belt: 6,
    ring: 7, neck: 8, gloves: 9, shoulder: 10, back: 11
  };
  /* 便捷查询：取某家族某品级的中文名 */
  function gemName(fam, lv) {
    const f = GEM_FAMILIES[fam], g = GEM_GRADES[lv - 1];
    return f && g ? (g.prefix + f.name + g.shape) : '—';
  }

  /* ---------------------------------------------------------------- 战士 */
  const warrior = {
    key: 'warrior', name: '战士', en: 'Warrior', stat: 'str', statName: '力量',
    color: '#b7433a', crest: 'sword',
    tagline: '近战爆发 · 流血引擎',
    weapon: { name: '处刑巨斧', dps: 230, speed: 1.0 },
    basics: [
      { id: 'w_val', name: '英勇打击', ele: 'physical', pct: 107, perLevel: 3.0, mana: 8, vuln: { chance: 20, dur: 3 }, tags: ['single'], text: '单体重击，20% 概率施加易伤。' },
      { id: 'w_cleave', name: '横扫', ele: 'physical', pct: 97, perLevel: 3.0, mana: 6, tags: ['aoe'], text: '横扫前方所有敌人。1.1.11 基础值 70%，每级 +3%（基准 pct=97 为 10 级值，待游戏面板实测 97/100/75 定稿）。' },
      { id: 'w_blood', name: '血刃', ele: 'physical', pct: 72, perLevel: 2.5, mana: 7, dot: { pct: 250, dur: 5, ele: 'physical' }, tags: ['single', 'bleed'], text: '直伤 + 5 秒流血 250%。' },
      { id: 'w_steady', name: '稳固重击', ele: 'physical', pct: 82, perLevel: 2.5, mana: 6, tags: ['single'], text: '叠加壁垒，偏防御。' }
    ],
    strongs: [
      { id: 'w_flame', name: '烈焰打击', ele: 'fire', pct: 340, perLevel: 10.0, mana: 35, tags: ['single'], text: '单体火焰爆发，战士最高单发。' },
      { id: 'w_half', name: '半月斩', ele: 'physical', pct: 213, perLevel: 7.0, mana: 55, tags: ['aoe', 'pierce'], text: '穿透所有敌人。' },
      { id: 'w_whirl', name: '旋风斩', ele: 'physical', pct: 145, perLevel: 5.0, mana: 85, channel: { dur: 3, interval: 0.4 }, tags: ['aoe', 'channel'], text: '持续旋转，每 0.4 秒一跳。' },
      { id: 'w_rend', name: '撕裂猛击', ele: 'physical', pct: 127, perLevel: 3.0, hits: 3, mana: 28, dot: { pct: 250, dur: 5, ele: 'physical' }, tags: ['aoe', 'bleed'], text: '三段斩击，每段附带流血。' }
    ],
    specials: [
      { id: 'w_shout', name: '狂暴怒吼', perLevel: 1, cd: 25, buff: { as: 35, dur: 4 }, tags: ['warcry'], text: '攻速 +35%，持续 4 秒。' },
      { id: 'w_shield', name: '狂怒护盾', perLevel: 1.5, cd: 28, tags: ['warcry', 'def'], text: '吸收 55% 最大生命的护盾，持续 9 秒。' },
      { id: 'w_hook', name: '夺命钩', ele: 'physical', pct: 88, perLevel: 1.5, cd: 10, vuln: { chance: 100, dur: 4 }, tags: ['aoe'], text: '拉怪并施加易伤。' },
      { id: 'w_earth', name: '大地震击', ele: 'physical', pct: 408, perLevel: 12.0, cd: 16, tags: ['aoe', 'stun'], text: '高伤 AOE 并眩晕。' },
      { id: 'w_thorn', name: '铁荆棘', perLevel: 10, cd: 25, thorns: { mult: 1.0, dur: 8, interval: 1 }, tags: ['aoe'], text: '8 秒内每秒对周围造成 100% 荆棘值的物理伤害。' },
      { id: 'w_molten', name: '熔火之力', perLevel: 3, cd: 10, buff: { strong: 55, costRed: 50, manaRestore: 50, dur: 11 }, tags: ['warcry'], text: '回复 50% 法力，11 秒内强力攻击 +55% 且耗蓝 -50%。' }
    ],
    sets: [
      { id: 'w_eye', name: '风暴之眼', b: { 2: { dmg: { physical: 50 } }, 4: { flag: 'whirl_fast' }, 6: { flag: 'whirl_cast' } }, text: '2: 物理 +50%; 4: 旋风斩快 25%、持续 +3 秒; 6: 旋转中可放特殊技' },
      { id: 'w_harvest', name: '收获之月', b: { 2: { dmg: { strong: 50 } }, 4: { flag: 'crescent' } }, text: '2: 强力攻击 +50%; 4: 半月斩命中叠暴击/回蓝' },
      { id: 'w_weight', name: '群山之重', b: { 2: { dmg: { special: 100 } } }, text: '2: 特殊技能伤害 +100%' },
      { id: 'w_atheron', name: '阿瑟隆之盾', b: { 2: { stat: { cc: 10 } } }, text: '2: 暴击率 +10%' }
    ]
  };

  /* ---------------------------------------------------------------- 法师 */
  const sorcerer = {
    key: 'sorcerer', name: '法师', en: 'Sorcerer', stat: 'int', statName: '智力',
    color: '#4f7fc4', crest: 'staff',
    tagline: '远程元素 · 闪电风暴',
    weapon: { name: '琥珀骷髅杖', dps: 230, speed: 1.0 },
    basics: [
      { id: 's_fireball', name: '火球术', ele: 'fire', pct: 102, perLevel: 3.0, mana: 9, tags: ['aoe'], text: '小范围爆炸。' },
      { id: 's_ice', name: '寒冰碎片', ele: 'cold', pct: 170, perLevel: 5.0, mana: 9, tags: ['single'], text: '单发最高基础倍率。' },
      { id: 's_electro', name: '电弧', ele: 'lightning', pct: 92, perLevel: 2.5, mana: 9, tags: ['aoe'], text: '扇形命中前方全部敌人。' },
      { id: 's_flamelight', name: '烈焰闪电', ele: 'lightning', pct: 88, perLevel: 2.5, extra: { ele: 'fire', pct: 80 }, mana: 9, tags: ['single'], text: '同时造成 80% 火焰 + 90% 闪电。' }
    ],
    strongs: [
      { id: 's_breath', name: '烈焰吐息', ele: 'fire', pct: 234, perLevel: 6.0, mana: 65, cd: 1.5, tags: ['aoe'], text: '直线火焰并点燃。' },
      { id: 's_icemeteor', name: '冰陨石', ele: 'cold', pct: 83, perLevel: 2.0, mana: 80, cd: 4, channel: { dur: 3, interval: 0.5 }, tags: ['aoe', 'field'], text: '留下 3 秒冰霜领域，每 0.5 秒一跳。' },
      { id: 's_storm', name: '闪电风暴', ele: 'lightning', pct: 217, perLevel: 7.5, hits: 3, mana: 50, tags: ['aoe'], text: '随机打击 3 个敌人。' },
      { id: 's_frostbeam', name: '寒冰射线', ele: 'cold', pct: 78, perLevel: 2.0, mana: 45, cd: 3.3, channel: { dur: 3, interval: 0.5 }, tags: ['aoe', 'channel'], text: '引导 3 秒，每 0.5 秒一跳。' }
    ],
    specials: [
      { id: 's_nova', name: '冰霜新星', ele: 'cold', pct: 39, perLevel: 1.0, cd: 22, tags: ['aoe', 'freeze'], text: '冻结周围敌人。' },
      { id: 's_elemental', name: '火焰元素', perLevel: 3, cd: 30, summon: { pct: 110, dur: 12, interval: 1 }, tags: ['summon'], text: '召唤火元素持续攻击。' },
      { id: 's_iceblock', name: '寒冰屏障', perLevel: 10, cd: 30, tags: ['def'], text: '5 秒无敌但无法行动。' },
      { id: 's_meteor', name: '火焰陨石', ele: 'fire', pct: 535, perLevel: 15.0, cd: 24, tags: ['aoe', 'burn'], text: '大范围爆发并点燃。' },
      { id: 's_aura', name: '烈焰光环', perLevel: 10, cd: 21, buff: { cc: 10, cd: 150, dur: 5 }, tags: ['buff'], text: '5 秒内暴击率 +10%、暴伤 +150%。' },
      { id: 's_cloud', name: '闪电云', ele: 'lightning', pct: 68, perLevel: 2.0, hits: 8, cd: 24, tags: ['aoe', 'field'], text: '4 秒内 8 道闪电。' }
    ],
    sets: [
      { id: 's_storm', name: '风暴召唤者', b: { 2: { dmg: { lightning: 50 } }, 4: { flag: 'storm_splash' }, 6: { flag: 'storm_ball' } }, text: '2: 闪电 +50%; 4: 风暴溅射; 6: 每次命中生成闪电球(50%×3)' },
      { id: 's_infernal', name: '地狱契约', b: { 2: { vs: { burning: 90 } } }, text: '2: 对燃烧目标 +90%' },
      { id: 's_frozen', name: '冰封弹幕', b: { 2: { vs: { slowed: 65 } }, 4: { stat: { as: 60 } } }, text: '2: 对减速目标 +65%; 4: 攻速 +60%' }
    ]
  };

  /* ---------------------------------------------------------------- 猎人 */
  const hunter = {
    key: 'hunter', name: '猎人', en: 'Hunter', stat: 'dex', statName: '敏捷',
    color: '#5f8f5a', crest: 'bow',
    tagline: '远程物理 · 速射与陷阱',
    weapon: { name: '黑鸦反曲弓', dps: 230, speed: 1.0 },
    basics: [
      { id: 'h_poison', name: '毒液射击', ele: 'poison', pct: 132, perLevel: 3.5, mana: 8, dot: { pct: 400, dur: 8, ele: 'poison' }, tags: ['single', 'poison'], text: '每 2 秒 100% 武器伤害，持续 8 秒（共 400%）。1.1.11 毒跳 75%→100%。' },
      { id: 'h_bomb', name: '奥术炸弹', ele: 'arcane', pct: 88, perLevel: 2.0, mana: 10, tags: ['aoe'], text: '小范围爆炸。' },
      { id: 'h_knife', name: '飞刀弹幕', ele: 'physical', pct: 117, perLevel: 3.0, hits: 3, mana: 7, tags: ['aoe'], text: '同时打 3 个目标，单体时集中。' },
      { id: 'h_twin', name: '双箭', ele: 'physical', pct: 88, perLevel: 2.0, hits: 2, mana: 9, tags: ['single'], text: '单体时两箭都命中同一目标。' }
    ],
    strongs: [
      { id: 'h_steady', name: '稳固射击', ele: 'physical', pct: 322, perLevel: 8.0, mana: 55, cd: 0.8, tags: ['pierce'], text: '穿透直线。' },
      { id: 'h_multi', name: '多重射击', ele: 'arcane', pct: 258, perLevel: 6.5, mana: 65, cd: 0.6, tags: ['aoe'], text: '宽锥形 AOE。' },
      { id: 'h_rapid', name: '快速射击', ele: 'physical', pct: 59, perLevel: 1.6, mana: 70, cd: 2.5, channel: { dur: 2, interval: 0.25 }, tags: ['channel'], text: '引导 2 秒，每 0.25 秒一箭。' },
      { id: 'h_venom', name: '毒液弩矢', ele: 'poison', pct: 205, perLevel: 5.0, mana: 80, cd: 0.8, dot: { pct: 800, dur: 8, ele: 'poison' }, tags: ['aoe', 'poison'], text: '范围爆发并叠 2 层中毒（按 2 层计）。' }
    ],
    specials: [
      { id: 'h_trap', name: '毒陷阱', ele: 'poison', pct: 340, perLevel: 10.0, cd: 30, tags: ['aoe', 'trap'], dot: { pct: 1200, dur: 8, ele: 'poison' }, text: '3 层中毒，每 2 秒 100%，持续 8 秒。' },
      { id: 'h_shock', name: '震荡波', ele: 'physical', pct: 127, perLevel: 3.0, cd: 20, tags: ['aoe'] },
      { id: 'h_flare', name: '照明弹', perLevel: 0, cd: 25, vuln: { chance: 100, dur: 3 }, tags: ['aoe'], text: '施加易伤与眩晕 3 秒。' },
      { id: 'h_arrowstorm', name: '奥术箭雨', ele: 'arcane', pct: 205, perLevel: 5.0, hits: 6, cd: 24, tags: ['aoe', 'field'] },
      { id: 'h_phantom', name: '幻影形态', perLevel: 0, cd: 24, buff: { as: 50, dur: 6 }, tags: ['buff'] },
      { id: 'h_arctrap', name: '奥术陷阱', ele: 'arcane', pct: 535, perLevel: 15.0, cd: 30, tags: ['aoe', 'trap'] }
    ],
    sets: [
      { id: 'h_deadeye', name: '神射手之决', b: { 2: { dmg: { physical: 50 } }, 6: { flag: 'rapid_double' } }, text: '2: 物理 +50%; 6: 快速射击 +30% 速度且伤害翻倍' },
      { id: 'h_venom', name: '毒牙', b: { 2: { vs: { poisoned: 70 } } }, text: '2: 对中毒目标 +70%' },
      { id: 'h_trapper', name: '陷阱客遗产', b: { 2: { dmg: { special: 60 }, ability: { h_trap: 60, h_arctrap: 60 } } }, text: '2: 陷阱直伤 +60%' }
    ]
  };

  /* ---------------------------------------------------------------- 武僧 */
  const monk = {
    key: 'monk', name: '武僧', en: 'Monk', stat: 'dex', statName: '敏捷',
    color: '#c9a227', crest: 'fist',
    tagline: '近战连击 · 圣光闪电',
    weapon: { name: '缠皮长棍', dps: 230, speed: 1.0 },
    basics: [
      { id: 'm_three', name: '三连击', ele: 'physical', pct: 380, perLevel: 20.0, mana: 9, tags: ['single'], text: '125/125/400，平均 216.7%，此处按均摊 200% 计。' },
      { id: 'm_fist', name: '怒拳', ele: 'physical', pct: 107, perLevel: 3.0, mana: 5, selfBuff: { as: 5, max: 20, dur: 4 }, tags: ['single'], text: '每层 +5% 攻速，最多 20 层。' },
      { id: 'm_seismic', name: '震地击', ele: 'physical', pct: 108, perLevel: 2.5, mana: 7, tags: ['aoe'], text: '每第三击 180% 溅射，均摊 133%。' },
      { id: 'm_chi', name: '真气弹', ele: 'physical', pct: 117, perLevel: 3.0, mana: 7, tags: ['single'], text: '第三发回血。' }
    ],
    strongs: [
      { id: 'm_judgment', name: '神圣裁决', ele: 'lightning', pct: 508, perLevel: 12.0, extra: { ele: 'lightning', pct: 140 }, mana: 45, tags: ['single'], text: '主目标 520% + 周围 140% 闪电。' },
      { id: 'm_lunge', name: '穿刺突进', ele: 'physical', pct: 234, perLevel: 6.0, mana: 32, tags: ['aoe'], text: '直线穿透。' },
      { id: 'm_staff', name: '旋风棍', ele: 'physical', pct: 92, perLevel: 2.5, hits: 2, mana: 75, cd: 1, tags: ['aoe'], text: '两道龙卷，各 95%。' },
      { id: 'm_palms', name: '金掌', ele: 'physical', pct: 223, perLevel: 7.0, mana: 40, cd: 1, tags: ['aoe'], text: '双掌穿透并击退。' }
    ],
    specials: [
      { id: 'm_orbs', name: '圣光法球', ele: 'lightning', pct: 100, perLevel: 1.5, hits: 4, cd: 18, tags: ['aoe'], text: '环绕 6 秒，多次命中。' },
      { id: 'm_stream', name: '灵流', perLevel: 1, cd: 16, tags: ['def'], text: '每秒回复 21% 最大生命，持续 4 秒。' },
      { id: 'm_charge', name: '冲锋', ele: 'physical', pct: 252, perLevel: 8.0, cd: 12, tags: ['aoe', 'stun'] },
      { id: 'm_twin', name: '灵魂双子', perLevel: 20, cd: 28, buff: { mirror: 1, dur: 10 }, tags: ['summon'], text: '10 秒内复制你的基础与强力攻击。' },
      { id: 'm_wind', name: '踏风', perLevel: 0, cd: 16, buff: { dodge: 30, dur: 5 }, tags: ['def'] },
      { id: 'm_thunder', name: '圣雷', ele: 'lightning', pct: 370, perLevel: 10.0, cd: 18, tags: ['aoe'] }
    ],
    sets: [
      { id: 'm_hundred', name: '百手', b: { 2: { dmg: { basic: 100 } }, 4: { flag: 'fist_phys' }, 6: { flag: 'fist_palms' } }, text: '2: 基础攻击 +100%; 4: 怒拳每层 +3% 物理; 6: 25% 概率免费金掌' },
      { id: 'm_wheel', name: '九重天轮', b: { 2: { dmg: { special: 100 } }, 4: { flag: 'orb_extra' } }, text: '2: 特殊技能 +100%; 4: 法球 +1' },
      { id: 'm_serpent', name: '蛇信', b: { 2: { dmg: { strong: 50 } } }, text: '2: 强力攻击 +50%' }
    ]
  };

  /* ---------------------------------------------------------------- 天赋
     行门槛: 0 / 5 / 10(cap1) / 15 / 20 / 30(cap2) / 40 / 50 / 60(cap3)
     mods 键位见 engine.js applyMods()
  */
  const T = (at, items) => ({ at, items });
  const t = (id, name, max, text, mods) => ({ id, name, max, text, mods: mods || {} });

  warrior.talents = [
    T(0, [
      t('str', '力量', 10, '+5 力量/点', { stat: { str: 5 } }),
      t('vit', '体魄', 6, '+50 最大生命/点', { def: 1 }),
      t('armor', '护甲', 5, '+40 护甲/魔抗', { def: 1 }),
      t('cc', '暴击率', 5, '+2% 暴击率/点', { stat: { cc: 2 } }),
      t('thorn', '荆棘', 8, '+8 荆棘/点', { def: 1 })
    ]),
    T(5, [
      t('cd', '暴击伤害', 8, '+10% 暴伤/点', { stat: { cd: 10 } }),
      t('cleaving', '劈砍之怒', 6, '基础攻击命中 +6% 攻速/层，10 层（按 60% 平均覆盖）', { stat: { as: 10 } }),
      t('hold', '坚守', 5, '3 名敌人近身时减伤', { def: 1 }),
      t('valvuln', '英勇打击：易伤', 5, '英勇打击额外 +10% 易伤概率/点', { flag: 'val_vuln' }),
      t('thornboost', '荆棘强化', 10, '+10% 荆棘/点', { def: 1 })
    ]),
    T(10, [
      t('heavy', '重击', 1, '强力攻击暴击施加 3 秒易伤', { flag: 'heavy_blow' }),
      t('vicious', '恶毒荆棘', 1, '荆棘可暴击', { def: 1 }),
      t('focused', '专注技法', 1, '基础攻击 +100%，但基础回蓝 -50%', { dmg: { basic: 100 }, mana: { genPct: -50 } })
    ]),
    T(15, [
      t('defstance', '防御姿态', 10, '+10% 护甲/点', { def: 1 }),
      t('ragechannel', '怒气引导', 8, '开护盾回蓝', { def: 1 }),
      t('shoutplus', '怒吼强化', 5, '怒吼攻速 +15%/点，持续 +0.5 秒/点', { flag: 'shout_plus' }),
      t('valmana', '英勇打击：回蓝', 8, '+2 回蓝/点', { mana: { genFlat: 2 } }),
      t('strongmana', '强力攻击：减耗', 5, '-5% 强力耗蓝/点', { mana: { costRed: 5 } })
    ]),
    T(20, [
      t('warcrycd', '战吼冷却', 6, '-5% 战吼冷却/点', { stat: { cdr: 5 } }),
      t('concuss', '震荡打击', 5, '基础攻击 3%/点 眩晕', { def: 1 }),
      t('spread', '烈焰扩散', 10, '烈焰打击对周围溅射 20% 武器伤害/点（单体 Boss 无收益）', { flag: 'spread_flame' }),
      t('weakness', '弱点精通', 8, '对易伤目标 +10%/点', { vs: { vulnerable: 10 } }),
      t('crescent', '新月收割', 10, '半月斩 +10%/点', { ability: { w_half: 10 } })
    ]),
    T(30, [
      t('charged', '蓄势待发', 1, '10 层后全伤害 +80%（1.1.11 上调）', { flag: 'charged_ready' }),
      t('inspiration', '战斗灵感', 1, '战吼减少另一特殊技冷却 1 秒', { flag: 'inspiration' }),
      t('returning', '怒气回流', 1, '每次直接命中回 1% 法力', { flag: 'returning_fury' })
    ]),
    T(40, [
      t('press', '乘胜追击', 8, '对眩晕目标 +20%/点', { vs: { immobilized: 20 } }),
      t('hemorrhage', '出血', 10, '流血伤害 +10%/点（1.1.11 重做）', { dmg: { dot: 10 } }),
      t('peak', '巅峰状态', 5, '生命 >80% 时全伤害 +15%/点', { vs: { healthy: 15 } }),
      t('demoral', '挫志怒吼', 6, '战吼降低敌人伤害', { def: 1 }),
      t('reapers', '收割者律动', 10, '旋风斩速度 +10%/点', { ability: { w_whirl: 10 } })
    ]),
    T(50, [
      t('rageinf', '怒气灌注', 10, '强力攻击 +15%/点，耗蓝 +10%/点', { dmg: { strong: 15 }, mana: { costAdd: 10 } }),
      t('deep', '深创', 6, '流血击杀处决', { def: 1 }),
      t('butcher', '屠夫节奏', 3, '撕裂猛击 +1 段/点', { flag: 'butcher' }),
      t('secondwind', '复苏之风', 5, '低血回复', { def: 1 }),
      t('ironblood', '铁血', 10, '30% 最大生命计入荆棘', { def: 1 })
    ]),
    T(60, [
      t('forge', '熔炉之心', 1, '每秒耗 1% 法力，换 +75% 强力伤害、-20% 耗蓝', { flag: 'forge' }),
      t('bloodlust', '嗜血', 1, '流血死亡叠层，每层 +50% 伤害，10 层（仅流血流派计入 2 层）', { flag: 'bloodlust' }),
      t('ironward', '铁壁', 1, '基础攻击获得 5% 最大生命护盾', { def: 1 }),
      t('counter', '反击风暴', 1, '每 5 次受击反击 250%', { flag: 'counter' })
    ])
  ];

  sorcerer.talents = [
    T(0, [
      t('int', '奥术洞察', 10, '+5 智力/点', { stat: { int: 5 } }),
      t('searing', '灼热之刃', 6, '基础攻击暴击率 +3%/点', { flag: 'basic_cc_only' }),
      t('frostarmor', '霜甲', 8, '护甲', { def: 1 }),
      t('reach', '奥术延伸', 6, '基础攻击射程', { def: 1 }),
      t('manaflow', '法力涌流', 8, '+4 最大法力/点', { stat: { manaMax: 4 } })
    ]),
    T(5, [
      t('flameward', '烈焰守护', 8, '火焰伤害 +5%/点', { dmg: { fire: 5 } }),
      t('conduit', '法力导管', 6, '基础攻击 +1 回蓝/点', { mana: { genFlat: 1 } }),
      t('frostmastery', '冰霜精通', 10, '冰霜伤害 +7%/点', { dmg: { cold: 7 } }),
      t('stormexec', '风暴处刑', 10, '闪电 +4%/点，对精英 +3%/点', { dmg: { lightning: 4 }, vs: { elite: 3 } }),
      t('manaregen', '法力回复', 6, '+1 回蓝/点', { mana: { regen: 1 } })
    ]),
    T(10, [
      t('momentum', '奥术动能', 1, '放特殊技后基础攻击 +40%，5 秒', { flag: 'arcane_momentum' }),
      t('immolation', '献祭', 1, '火球 15% 点燃', { flag: 'ignite_basic' }),
      t('coldret', '寒冷惩罚', 1, '护甲 +10%，近战者被冰缓', { def: 1 }),
      t('thunderstruck', '雷击', 1, '闪电风暴 15% 短眩晕', { flag: 'storm_stun' })
    ]),
    T(15, [
      t('breathcrit', '吐息：暴伤', 6, '烈焰吐息暴伤 +20%/点', { ability: { s_breath: 20 }, flag: 'ability_cd_only' }),
      t('elemfury', '元素之怒', 6, '火元素攻速 +15%/点', { flag: 'elemental_fury' }),
      t('frostalac', '霜寒迅捷', 6, '冰霜技能冷却 -4%/点', { stat: { cdr: 4 } }),
      t('deepchill', '深寒', 8, '冰缓更强', { def: 1 }),
      t('elecshield', '电盾', 8, '护甲 + 回蓝', { def: 1 })
    ]),
    T(20, [
      t('reservoir', '奥术蓄池', 8, '法力 5%/点 计入智力', { flag: 'mana_to_int' }),
      t('conflag', '焚灭', 8, '对燃烧 +12%/点', { vs: { burning: 12 } }),
      t('icemana', '冰陨石：减耗', 8, '-4% 耗蓝/点', { mana: { costRed: 4 } }),
      t('iceshards', '寒冰碎片：伤害', 8, '+10%/点', { ability: { s_ice: 10 } }),
      t('stormmastery', '风暴精通', 8, '闪电暴伤 +12%/点', { flag: 'lightning_cd_only' })
    ]),
    T(30, [
      t('ignite', '点燃', 1, '暴击必定点燃', { flag: 'crit_burn' }),
      t('flashfreeze', '急速冰冻', 1, '冰缓 15% 概率冻结', { flag: 'freeze' }),
      t('static', '静电充能', 1, '闪电技能必定叠静电', { flag: 'static' })
    ]),
    T(40, [
      t('cataclysm', '灾变', 8, '陨石 +15%/点，冷却 +2%/点', { ability: { s_meteor: 15 } }),
      t('frozenres', '冰封蓄能', 8, '冰霜新星回蓝', { flag: 'nova_mana' }),
      t('permafrost', '永冻', 6, '冻结更久', { def: 1 }),
      t('frozenrenew', '冰封复苏', 5, '冰障回血', { def: 1 }),
      t('electromana', '电弧：回蓝', 6, '+2 回蓝/点', { mana: { genFlat: 2 } })
    ]),
    T(50, [
      t('plasma', '等离子传导', 8, '烈焰闪电对燃烧/静电目标 +6%/点', { ability: { s_flamelight: 6 } }),
      t('flameward2', '烈焰守护 II', 8, '光环期间护甲魔抗', { def: 1 }),
      t('beamexp', '射线扩张', 5, '射线范围', { def: 1 }),
      t('current', '电流转移', 5, '静电传播', { def: 1 }),
      t('lingering', '滞留风暴', 8, '闪电云持续 +10%/点', { ability: { s_cloud: 10 } })
    ]),
    T(60, [
      t('exposure', '奥术暴露', 1, '每 4 次强力攻击施易伤，对易伤 +150%', { flag: 'arcane_exposure' }),
      t('combustion', '燃烧爆炸', 1, '燃烧死亡爆炸 300%', { flag: 'combustion' }),
      t('shatter', '碎冰', 1, '对冻结目标 +50% 暴击率、+250% 暴伤', { flag: 'shattering_ice' }),
      t('stormconduit', '风暴导管', 1, '电弧/烈焰闪电 30% 概率触发闪电风暴', { flag: 'storm_conduit' })
    ])
  ];

  hunter.talents = [
    T(0, [
      t('dex', '敏捷', 10, '+5 敏捷/点', { stat: { dex: 5 } }),
      t('as', '攻速', 10, '+3% 攻速 +0.5 伤害/点', { stat: { as: 3 }, flatDmg: 0.5 }),
      t('longshot', '远程射击', 8, '对远处 +15%/点', { vs: { distant: 15 } }),
      t('dodge', '闪避', 8, '+1.5% 闪避/点', { def: 1 }),
      t('fleet', '轻步', 6, '移速', { def: 1 })
    ]),
    T(5, [
      t('steadyaim', '稳定瞄准', 6, '射程', { def: 1 }),
      t('sharpshooter', '神射手', 6, '对远处 +3% 暴击率/点', { vs: { distant: 3 } }),
      t('arcane', '奥术知识', 10, '奥术 +5%/点', { dmg: { arcane: 5 } }),
      t('venomlore', '毒理', 8, '对中毒 +8%/点', { vs: { poisoned: 8 } }),
      t('deadlytoxin', '致命毒素', 8, '中毒伤害 +6%/点', { dmg: { dot: 6 } })
    ]),
    T(10, [
      t('efficient', '高效突袭', 1, '强力攻击耗蓝 -25%', { mana: { costRed: 25 } }),
      t('rapidreset', '快速重置', 1, '强力攻击减少陷阱冷却 2 秒', { flag: 'rapid_reset' }),
      t('cornered', '困兽', 1, '低血眩晕', { def: 1 })
    ]),
    T(15, [
      t('brutality', '物理暴行', 8, '物理暴伤 +15%/点', { flag: 'physical_cd_only' }),
      t('bombsplash', '炸弹扩散', 6, '炸弹范围', { def: 1 }),
      t('concussive', '震荡力', 5, '击退', { def: 1 }),
      t('lethaltraps', '致命陷阱', 6, '陷阱伤害 +10%/点', { ability: { h_trap: 10, h_arctrap: 10 } }),
      t('secondwind', '复苏', 8, '脱战回蓝', { mana: { regen: 3 } })
    ]),
    T(20, [
      t('impsteady', '稳固射击强化', 8, '每穿透 +3%/点', { ability: { h_steady: 3 } }),
      t('forceful', '强力箭雨', 6, '多重击退', { def: 1 }),
      t('imppoison', '毒射强化', 6, '毒射 +5% 施加概率/点', { flag: 'poison_chance' }),
      t('quicktraps', '迅捷陷阱', 6, '陷阱冷却 -5%/点', { stat: { cdr: 5 } }),
      t('survival', '生存本能', 8, '闪避', { def: 1 })
    ]),
    T(30, [
      t('doubletap', '双发', 1, '基础攻击 35% 概率连击', { flag: 'double_tap' }),
      t('arcancharge', '奥术充能', 1, '奥术伤害每层 +8%，50 层', { flag: 'arcane_charge' }),
      t('leech', '剧毒汲取', 1, '中毒触发击中回复', { def: 1 })
    ]),
    T(40, [
      t('sustained', '持续火力', 8, '快速射击持续 +6%/点', { ability: { h_rapid: 6 } }),
      t('deadlyknife', '致命飞刀', 6, '飞刀 +4% 暴击率/点', { ability: { h_knife: 4 } }),
      t('hardened', '硬化皮肤', 8, '暴伤减免', { def: 1 }),
      t('rapidflare', '迅捷照明', 5, '照明弹冷却 -6%/点', { stat: { cdr: 6 } }),
      t('marked', '死亡印记', 6, '易伤延长', { def: 1 })
    ]),
    T(50, [
      t('knifestorm', '飞刀风暴', 3, '飞刀 +1 目标/点', { flag: 'knife_storm' }),
      t('imptwin', '双箭强化', 6, '双箭 +5% 伤害/点并弹射', { ability: { h_twin: 5 } }),
      t('deadlytraps', '致命陷阱 II', 8, '陷阱 +4% 暴击/点', { ability: { h_trap: 4, h_arctrap: 4 } }),
      t('dazzling', '炫目回复', 8, '照明弹回蓝 10/点', { flag: 'dazzling' }),
      t('phantom', '幻影强化', 8, '幻影形态 +8%/点', { flag: 'phantom_plus' })
    ]),
    T(60, [
      t('lone', '孤猎', 1, '周围 ≤1 敌人时 +80% 攻速、+120% 全伤、+150% 强力', { flag: 'lone_hunter' }),
      t('corrosion', '奥术腐蚀', 1, '箭雨叠腐蚀，炸弹引爆 400/700%', { flag: 'corrosion' }),
      t('injection', '致命注射', 1, '毒暴击额外 3 层', { flag: 'injection' }),
      t('exposing', '暴露陷阱', 1, '陷阱施加易伤，陷阱暴伤 +300%', { flag: 'exposing_traps' })
    ])
  ];

  monk.talents = [
    T(0, [
      t('dodge', '闪避', 8, '+1.5% 闪避/点', { def: 1 }),
      t('vit', '体魄', 8, '+75 生命/点', { def: 1 }),
      t('dex', '敏捷', 10, '+5 敏捷/点', { stat: { dex: 5 } }),
      t('phys', '物理伤害', 10, '+8% 物理/点', { dmg: { physical: 8 } }),
      t('mana', '最大法力', 5, '+6 法力/点', { stat: { manaMax: 6 } })
    ]),
    T(5, [
      t('move', '移速', 5, '移速', { def: 1 }),
      t('healing', '治疗与魔抗', 8, '治疗/魔抗', { def: 1 }),
      t('as', '攻速', 6, '+4% 攻速/点', { stat: { as: 4 } }),
      t('manakill', '击杀回蓝', 5, '+2 击杀回蓝/点', { flag: 'mana_on_kill' }),
      t('lightning', '闪电伤害', 10, '+8% 闪电/点', { dmg: { lightning: 8 } })
    ]),
    T(10, [
      t('mirror', '镜像步', 1, '闪避后 +60% 物理 4 秒', { flag: 'mirror_steps' }),
      t('chain', '链劲', 1, '每 3 次基础攻击 +100% 直伤', { flag: 'chain_force' }),
      t('exposing', '暴露打击', 1, '技能施加破绽，5 层变易伤', { flag: 'exposed_strikes' }),
      t('illum', '启明', 1, '闪电暴击 30% 触发击杀回蓝', { flag: 'illumination' })
    ]),
    T(15, [
      t('zephyr', '疾风', 5, '闪避回蓝', { def: 1 }),
      t('vigor', '活力', 8, '物理暴击率 +2.5%/点', { flag: 'physical_cc_only' }),
      t('thunderclap', '雷鸣', 5, '裁决眩晕', { def: 1 }),
      t('fundamentals', '基本功', 10, '基础攻击 +10%/点', { dmg: { basic: 10 } }),
      t('lightcc', '闪电暴击率', 8, '闪电暴击 +2.5%/点', { flag: 'lightning_cc_only' })
    ]),
    T(20, [
      t('shelter', '庇护吐纳', 5, '灵流减伤', { def: 1 }),
      t('precise', '精准打击', 8, '基础攻击暴伤 +20%/点', { flag: 'basic_cd_only' }),
      t('heavy', '重手', 8, '强力攻击暴伤 +20%/点', { flag: 'strong_cd_only' }),
      t('lunge', '突进伤害', 8, '+20%/点', { ability: { m_lunge: 20 } }),
      t('orbspeed', '法球速度', 10, '转速 +20%/点', { ability: { m_orbs: 20 } })
    ]),
    T(30, [
      t('gathered', '凝聚之力', 1, '每 2 次特殊技蓄 1 层，强力 +80%', { flag: 'gathered_force' }),
      t('aftershock', '余震', 1, '每 3 次基础攻击 80% 眩晕', { flag: 'aftershock' }),
      t('chiward', '真气护体', 1, '每 3 秒护盾 = 500% 法力', { def: 1 })
    ]),
    T(40, [
      t('slipstream', '滑流', 6, '冲锋 +5% 闪避/点', { def: 1 }),
      t('twin', '双子延时', 6, '双子 +5% 持续/点', { ability: { m_twin: 5 } }),
      t('sharedchi', '共气', 8, '切换真气技能回蓝', { flag: 'shared_chi' }),
      t('sweeping', '横扫训练', 10, 'AOE 伤害 +10%/点', { dmg: { special: 0 }, flag: 'aoe_dmg' }),
      t('chargedorb', '充能法球', 8, '法球叠静电', { flag: 'charged_orb' })
    ]),
    T(50, [
      t('chibolt', '真气弹治疗', 6, '治疗', { def: 1 }),
      t('palms', '金掌强化', 8, '金掌 +10% 伤害/点，-5% 耗蓝/点', { ability: { m_palms: 10 }, mana: { costRed: 5 } }),
      t('cyclone', '旋风击退', 5, '击退', { def: 1 }),
      t('thunder', '圣雷伤害', 5, '圣雷 +40%/点', { ability: { m_thunder: 40 } }),
      t('exploit', '乘虚而入', 10, '对眩晕 +15%/点', { vs: { immobilized: 15 } })
    ]),
    T(60, [
      t('thundering', '雷鸣', 1, '5 层静电触发 250% 闪电', { flag: 'thundering' }),
      t('formless', '无形', 1, '暴伤 += 200% 闪避率', { flag: 'formless' }),
      t('iron', '铁躯', 1, '免死一次', { def: 1 }),
      t('expenditure', '真气倾泻', 1, '强力攻击耗尽法力，每点 +1% 伤害', { flag: 'chi_expenditure' })
    ])
  ];

  const CLASSES = { warrior, sorcerer, hunter, monk };

  /* ================================================================ 机制层
     这里放"规则本身"，而不是某个职业的数值。改版本时若官方改了乘区口径，
     只改这一块，引擎与 UI 会一起跟着变。
     source 字段记录每条规则的依据，UI 会原样显示，避免把推测当结论。
     ================================================================= */
  const MECHANICS = {
    /* 单跳伤害的乘区顺序（wikily.gg 逐步表 + 社区实测交叉验证） */
    zones: {
      order: ['base', 'ability', 'attr', 'element', 'crit', 'vs', 'type', 'abilityMod', 'taken', 'mitigation'],
      // 全伤害与元素伤害同一乘区加算：官方逐步表 (1 + 元素伤 + Bonus All Damage)，已拍板，无独立乘区分支
      allDamage: 'additive',
      // 条件伤（vs 精英/健康/减速…）内部加算，整体作为独立乘区
      vs: 'additive-then-multiply',
      // 类型伤（普通/强力/特殊）独立乘区
      type: 'separate',
      // 目标"受到伤害增加"通道：默认加算（用户拍板），但真源实证易伤是独立 ×1.3、
      // 静电走 DamageAmplificationBehavior，二者不同括号。见 MECHANICS_TRUE_SOURCE.md。
      // 这是「用户拍板 vs 1.0.3 真源」的未决冲突：不静默改默认，交给前端选项卡由用户裁决。
      taken: 'additive',
      source: 'wikily.gg 逐步表 + deskrawl.tools；真源核查 2026-10-16 dump（1.0.3）见 MECHANICS_TRUE_SOURCE.md'
    },

    /* 状态效果（数值取自 deskrawl.tools/status-effects，等级 1）
       真源核查补充（2026-10-16 dump，1.0.3，见 MECHANICS_TRUE_SOURCE.md）：
       - 静电 StaticElectricity = DamageAmplificationBehavior，AmplificationPercent.Base=0.10
         → 真源每层 10%（仅闪电、10层）。本地 5% 是用户拍板的推断值；真源为旧版，冲突未裁决，
           故保留 5% 默认、把 10% 作为候选写入前端选项卡，等用户定夺。
       - 易伤固定 +30%（×1.3 硬编码）真源实证，与本地一致；真源 dur=3s，本地 4s 存疑。
       - 脆裂 Brittle 真源 SO Behaviors:[] 无数值，5%/层仅见于本地化文案、SO max=100；
         乘区归属无实证（文案方向=暴击乘区）。本地维持 5%/层 max10，标为文案级。 */
    status: {
      vulnerable:      { taken: 30, dur: 4, note: 'Take 30% more damage；真源 ×1.3 硬编码实证，真源 dur=3s' },
      electrostatic:   { perStack: 10, perStackOld: 5, max: 10, dur: 4, ele: 'lightning', note: '1.0.4 真源 SO 实锤：StaticElectricity DamageAmplificationBehavior AmplificationPercent=0.10 → 每层 10%（仅闪电、10层）。旧版 5% 为用户早期推断值，已按真源对齐' },
      brittle:         { perStackCD: 5, max: 10, source: 'LegendaryRing8CritDamage', note: '1.0.4 真源实锤：脆裂本身无伤害行为（Brittle SO Behaviors=[]，MaxStacks=100）；+5%/层来自传奇戒指 LegendaryRing8CritDamage 的 ConditionalCritDamage（进暴伤池：暴伤 += 0.05×层数）。max10 为本地模拟上限，真源戒指逻辑无层数上限' },
      exposed:         { stacks: 5, note: '5 层破绽 → 易伤' },
      chill:           { as: -25, ms: -35 },
      numbingCold:     { dealt: -30 },
      bleeding:        { tick: 1, ele: 'physical' },
      poisoned:        { tick: 2, ele: 'poison', weaponPct: 75 }
    },

    /* 仆从养成（1.1.11 官方补丁 + 社区机制核对） */
    minion: {
      levelMin: 1,
      levelMax: 10,          // 技能等级上限，需要同副本堆叠
      reinsBonus: 5,         // 传奇缰绳强化：自身技能 +5 级，可超上限（48h）
      gearStar: 5,           // 5 级解锁仆从装备
      selfBasePct: 30,       // 仆从自身技能：1 级时约等于 30% 武器伤害/秒（模型估算）
      selfPerLevelPct: 4,    // 每级 +4 个百分点
      gearOptions: [
        { id: 'none', name: '不装备', fx: {} },
        { id: 'atk', name: '攻击型（+12% 仆从技能伤害）', fx: { selfPct: 12 } },
        { id: 'sup', name: '辅助型（+8% 全伤害）', fx: { dmg: { all: 8 } } },
        { id: 'def', name: '守护型（-8% 受到伤害）', fx: { takenDR: 8 } }
      ],
      source: 'gaugedb 1.1.11 补丁说明（Minion Empowerment）'
    },

    caps: { cc: 85, cdr: 80, dr: 90 },
    spread: { min: 0.9, max: 1.1, note: '直伤有 ±10% 随机浮动，DoT 没有' }
  };

  /* ---------------------------------------------------------------- 仆从 */
  const MINIONS = [
    { id: 'raptor', name: '迅猛龙', rarity: '传说', bonus: { dmg: { dot: 30 }, stat: { cc: 3, cd: 25 } }, cap: 35, bonusPerLevel: 0.1  },
    { id: 'emberfang', name: '烬牙', rarity: '传说', bonus: { vs: { elite: 30 } }, cap: 30, bonusPerLevel: 0.1  },
    { id: 'lordcinder', name: '灰烬领主', rarity: '传说', bonus: { stat: { cdr: 12 } }, cap: 35, bonusPerLevel: 0.0667  },
    { id: 'icehound', name: '冰霜猎犬', rarity: '传说', bonus: { dmg: { lightning: 30, cold: 30 } }, cap: 35, note: '1.0.4 真源补冰霜伤害 +30%', bonusPerLevel: 0.1  },
    { id: 'bonereaper', name: '白骨收割者', rarity: '传说', bonus: { dmg: { lightning: 30 } }, cap: 30, bonusPerLevel: 0.1  },
    { id: 'tidewrath', name: '怒潮蟹王', rarity: '传说', bonus: { stat: { cd: 40 }, def: 1 }, cap: 32, bonusPerLevel: 0.1  },
    { id: 'redrocklord', name: '赤岩领主', rarity: '传说', bonus: { dmg: { strong: 30 } }, cap: 25, bonusPerLevel: 0.1  },
    { id: 'lordcrimson', name: '绯红谷领主', rarity: '传说', bonus: { vs: { vulnerable: 30 } }, cap: 30, bonusPerLevel: 0.1  },
    { id: 'frostdragon', name: '霜龙', rarity: '传说', bonus: { vs: { distant: 40 } }, cap: 35, note: '1.0.4 真源 远处 30→40%', bonusPerLevel: 0.1  },
    { id: 'harpy', name: '沙暴鹰身女王', rarity: '传说', bonus: { vs: { slowed: 30 } }, cap: 27, bonusPerLevel: 0.1  },
    { id: 'serparmat', name: '吞噬者瑟帕玛特', rarity: '传说', bonus: { vs: { bleeding: 40 } }, cap: 30, note: '1.0.4 真源 流血 30→40%', bonusPerLevel: 0.1  },
    { id: 'dreadmanticore', name: '沙丘蝎狮', rarity: '传说', bonus: { dmg: { poison: 30 } }, cap: 35, bonusPerLevel: 0.1  },
    { id: 'darkelf', name: '暗精灵法师', rarity: '传说', bonus: { stat: { manaMax: 50 }, dmg: { fire: 30, arcane: 30 } }, cap: 25, note: '1.0.4 真源补奥术伤害 +30%', bonusPerLevel: 0.1  },
    { id: 'defiledwyrm', name: '污秽古龙', rarity: '传说', bonus: { def: 1 }, cap: 34 },
    { id: 'ancientoak', name: '远古橡木树精', rarity: '传说', bonus: { def: 1 }, cap: 30 },
    { id: 'bloodmoon', name: '血月狼人', rarity: '传说', bonus: { def: 1 }, cap: 25 },
    { id: 'undeadaxe', name: '亡灵斧手', rarity: '稀有', bonus: { dmg: { physical: 25 } }, cap: 27, note: '1.0.4 真源 物理 20→25%', bonusPerLevel: 0.1  },
    { id: 'cinderlash', name: '烬鞭', rarity: '稀有', bonus: { dmg: { fire: 25 } }, cap: 28, bonusPerLevel: 0.1  },
    { id: 'faedragon', name: '妖精龙', rarity: '稀有', bonus: { dmg: { arcane: 25 } }, cap: 25, bonusPerLevel: 0.1  },
    { id: 'brinescale', name: '盐鳞蛇', rarity: '稀有', bonus: { dmg: { cold: 25 } }, cap: 25, note: '1.0.4 真源 冰霜 20→25%', bonusPerLevel: 0.1  },
    { id: 'skeleton', name: '骷髅弓手', rarity: '罕见', bonus: { stat: { cc: 3 } }, cap: 25, bonusPerLevel: 0.1  },
    { id: 'greywolf', name: '灰森林狼', rarity: '罕见', bonus: { stat: { as: 10 } }, cap: 15, note: '1.0.4 真源 攻速 5→10%' },
    { id: 'mutatingwolf', name: '变异狼', rarity: '稀有', bonus: { stat: { cc: 0 } , def: 1 }, cap: 20 },
    { id: 'orc', name: '兽人战士', rarity: '稀有', bonus: { statPct: { str: 10 } }, cap: 30, note: '1.0.4 真源仅力量+10%（旧版多记的敏捷+10% 已删）' },
    { id: 'scorched', name: '焦灼小鬼', rarity: '罕见', bonus: { dmg: { fire: 20 } }, cap: 25, bonusPerLevel: 0.1  },
    { id: 'mountain', name: '山虎', rarity: '罕见', bonus: { vs: { healthy: 25 } }, cap: 25, note: '1.0.4 真源 健康目标 15→25%', bonusPerLevel: 0.1  },
    { id: 'sandwasp', name: '沙蜂', rarity: '罕见', bonus: { vs: { poisoned: 20 } }, cap: 20, note: '1.0.4 真源 中毒目标 15→20%', bonusPerLevel: 0.1  },
    { id: 'koboldthief', name: '沙狗头窃贼', rarity: '罕见', bonus: { vs: { bleeding: 20 } }, cap: 20, bonusPerLevel: 0.1  },
    { id: 'frozen', name: '冰霜僵尸战士', rarity: '罕见', bonus: { dmg: { all: 5 } }, cap: 25, note: '1.0.4 真源 全伤 3→5%', bonusPerLevel: 0.1  },
    { id: 'flyingfish', name: '飞鱼王', rarity: '传说', bonus: { mana: { costRed: 10 } }, cap: 30 },
    { id: 'bluewhale', name: '蓝猛犸', rarity: '传说', bonus: { def: 1 }, cap: 35 },

    /* ---- 1.0.4 新增仆从：仅收录带明确 DPS 被动者（真源 SlaveData.json statId 实证）。
         其余 29 个新增为坐骑/防御/资源类（移速、减伤、找金、回蓝等），对玩家 DPS 无贡献，不收录。
         base 取真源 1 级值（×100 为百分点）；成长走引擎 bonusPerLevel 路径，本批不静默外推。 ---- */
    { id: 'defiledsuccubus', name: '腐化魅魔', rarity: '稀有', bonus: { vs: { distant: 30 } }, cap: 27, note: '1.0.4 真源 DefiledKeepSuccubus Beguiling Whisper statId=58 远处目标 +30%（1级 base 0.3）', bonusPerLevel: 0.1  },
    { id: 'ogre', name: '食人魔', rarity: '传说', bonus: { vs: { immobilized: 40 } }, cap: 30, note: '1.0.4 真源 Ogre Damage to Stunned III statId=43 定身目标 +40%；另有物理减伤15%（生存向不进DPS）', bonusPerLevel: 0.1  },
    { id: 'redcroc', name: '赤沙鳄鱼', rarity: '罕见', bonus: { vs: { injured: 25 } }, cap: 25, note: '1.0.4 真源 RedDesertCrocodile statId=30 受伤目标 +25%', bonusPerLevel: 0.1  },
    { id: 'redsatyr', name: '赤沙萨提尔', rarity: '罕见', bonus: { dmg: { basic: 20 } }, cap: 25, note: '1.0.4 真源 RedDesertSatyr statId=33 基础攻击伤害 +20%', bonusPerLevel: 0.1  },
    { id: 'skeletonwarrior', name: '骷髅战士', rarity: '罕见', bonus: { dmg: { physical: 15 } }, cap: 30, note: '1.0.4 真源 SkeletonWarrior Physical Damage I statId=23 物理伤害 +15%', bonusPerLevel: 0.1  },
    { id: 'snowwhelp', name: '雪山幼龙', rarity: '稀有', bonus: { dmg: { special: 25 } }, cap: 25, note: '1.0.4 真源 SnowHillWhelp Budding Sorcery statId=61 特殊技能伤害 +25%', bonusPerLevel: 0.1  },
    { id: 'spider', name: '蜘蛛', rarity: '罕见', bonus: { dmg: { poison: 15 } }, cap: 15, note: '1.0.4 真源 Spider Poison Damage I statId=27 毒素伤害 +15%', bonusPerLevel: 0.1  },
    { id: 'pumpkin', name: '世界首领·南瓜王', rarity: '传说', bonus: { vs: { injured: 50 } }, cap: 35, bonusPerLevel: 0.1, note: '1.0.4 真源 WorldBossPumpkin Damage to Injured III statId=30 受伤目标 +50%' }
  ];

  /* ---------------------------------------------------------------- 传奇装备
     全 64 件（武器8 / 头盔5 / 肩甲5 / 胸甲6 / 手套8 / 腰带4 / 护腿4 / 靴子5 /
     项链7 / 戒指8 / 披风4）。披风为纯外观，无属性、无被动。
     fx 是"给引擎的声明式增量"，text 是官方原文，conf 标注数值可信度：
       official = 官方数字可直接用
       modeled  = 官方文本可用，但需要覆盖率/折算假设
       none     = 该基底没有传奇被动（只有 4 主 1 副）
     ========================================================================= */
  const LEGENDARIES = [
    /* ---- 武器 8 ---- */
    { id: 'blackcrow', name: '黑鸦反曲弓', slot: '武器', lvl: 1, cls: ['hunter'], conf: 'modeled',
      text: '毒素技能命中 15% 概率召唤鸦群，3 秒内共造成 720% 武器伤害（毒素）。',
      fx: { ability: { h_venom: 108 }, note: '720% × 15% 折算进毒技能' } },
    { id: 'giantaxe', name: '北境巨人之斧', slot: '武器', lvl: 10, cls: ['warrior', 'monk'], conf: 'official',
      text: '每次基础攻击额外造成 50% 武器伤害（冰霜），并有 3% 概率冻结目标。',
      fx: { basicExtra: { ele: 'cold', pct: 50 } } },
    { id: 'frostwyrm', name: '霜龙法杖', slot: '武器', lvl: 15, cls: ['sorcerer'], conf: 'modeled',
      text: '寒冰碎片命中后弹射至额外 2 个敌人。',
      fx: { multiTarget: { s_ice: 3 } } },
    { id: 'hellstorm', name: '地狱风暴钉锤', slot: '武器', lvl: 20, cls: ['warrior', 'sorcerer', 'monk'], conf: 'official',
      text: '每使用 10 次基础攻击，召唤 1000% 武器伤害的闪电打击。',
      fx: { proc: { everyBasic: 10, pct: 1000, ele: 'lightning' } } },
    { id: 'amberskull', name: '琥珀骷髅杖', slot: '武器', lvl: 30, cls: ['warrior', 'sorcerer', 'monk'], conf: 'official',
      text: '对定身或减速目标 +100% 暴击伤害。',
      fx: { cdVs: { states: ['immobilized', 'slowed'], value: 100 } } },
    { id: 'raincaller', name: '唤雨者长弓', slot: '武器', lvl: 30, cls: ['hunter'], conf: 'modeled',
      text: '施放基础攻击有 10% 概率免费施放一次奥术箭雨。',
      fx: { ability: { h_shot: 45 }, note: '免费箭雨按 10% × 450% 折算' } },
    { id: 'serrated', name: '痛苦锯齿巨剑', slot: '武器', lvl: 40, cls: ['warrior', 'sorcerer', 'monk'], conf: 'official',
      text: '对易伤目标额外 +30% 暴击率。',
      fx: { ccVs: { states: ['vulnerable'], value: 30 } } },
    { id: 'deadeyes', name: '神射之赌', slot: '武器', lvl: 65, cls: ['hunter'], conf: 'modeled',
      text: '施放物理强力攻击有概率获得 +300% 物理伤害，持续 3 秒。',
      fx: { dmg: { physical: 300 }, uptime: 0.4 } },

    /* ---- 头盔 5 ---- */
    { id: 'fallenking', name: '堕落之王冠', slot: '头盔', lvl: 1, conf: 'modeled',
      text: '击杀后 +30% 攻击速度，持续 3 秒。',
      fx: { stat: { as: 30 }, uptime: 0.6 } },
    { id: 'wanderinggale', name: '游风之冠', slot: '头盔', lvl: 35, cls: ['monk'], conf: 'modeled',
      text: '旋风棍式召唤 4 道龙卷，每道体积 -25%、游走时长 -40%（1.0.4 真源 SizeIncrease=-0.25 / LifetimeIncrease=-0.4）。',
      fx: { ability: { m_whirl: 50 }, note: '4×0.75 / 2 = 1.5 倍' } },
    { id: 'kabuto', name: '绯红风暴兜', slot: '头盔', lvl: 35, cls: ['warrior'], conf: 'modeled',
      text: '旋风斩每击 30% 概率施加流血。',
      fx: { dot: 25, note: '按 30% 触发折算' } },
    { id: 'phantommask', name: '幻影面具', slot: '头盔', lvl: 40, cls: ['hunter'], conf: 'modeled',
      text: '幻影形态期间 +100% 奥术伤害与 +100% 毒素伤害。',
      fx: { dmg: { arcane: 100, poison: 100 }, uptime: 0.6 } },
    { id: 'focus', name: '专注头环', slot: '头盔', lvl: 65, conf: 'modeled',
      text: '每次基础攻击获得 1 层专注（10 秒，5 层上限）；下次强力攻击消耗全部层数，每层 +20% 伤害。',
      fx: { type: { strong: 100 }, uptime: 0.6, note: '满层一次 +100%，按 60% 覆盖率折算' } },

    /* ---- 肩甲 5 ---- */
    { id: 'reapers', name: '收割者肩甲', slot: '肩甲', lvl: 1, conf: 'none',
      text: '该基底没有传奇被动，只有 4 主 1 副词条。', fx: {} },
    { id: 'shellspike', name: '甲壳尖刺肩甲', slot: '肩甲', lvl: 30, conf: 'official',
      text: '你 10% 的护甲同时计入荆棘。', fx: { thornsFromArmor: 0.1 } },
    { id: 'spiritbound', name: '缚灵肩甲', slot: '肩甲', lvl: 40, cls: ['monk'], conf: 'official',
      text: '每个在场的灵魂双子使你的伤害 +25%。', fx: { perSummon: { m_twin: 25 } } },
    { id: 'elementalburst', name: '元素爆发肩甲', slot: '肩甲', lvl: 45, conf: 'modeled',
      text: '施放强力攻击后，+20% 火焰/闪电/奥术伤害 6 秒，可叠 5 层。',
      fx: { dmg: { fire: 100, lightning: 100, arcane: 100 }, note: '按满 5 层折算' } },
    { id: 'venomfrost', name: '毒霜肩甲', slot: '肩甲', lvl: 55, cls: ['sorcerer', 'hunter'], conf: 'official',
      text: '对精英与首领敌人 +90% 冰霜伤害与 +90% 毒素伤害。',
      fx: { dmg: { cold: 90, poison: 90 }, cond: 'elite' } },

    /* ---- 胸甲 6 ---- */
    { id: 'thornheart', name: '棘心胸甲', slot: '胸甲', lvl: 1, conf: 'official',
      text: '荆棘伤害 +500%，但最大生命 -15%。', fx: { thornsPct: 500, hpPct: -15 } },
    { id: 'runeward', name: '符文守护法衣', slot: '胸甲', lvl: 25, cls: ['sorcerer', 'hunter'], conf: 'modeled',
      text: '受到暴击时获得基于最大生命的灵盾（8 秒冷却）。', fx: { takenDR: 8, note: '护盾折算为等效减伤' } },
    { id: 'evasive', name: '闪避胸甲', slot: '胸甲', lvl: 30, cls: ['hunter', 'monk'], conf: 'official',
      text: '获得等于闪避率 50% 的额外物理减伤。', fx: { physDRFromDodge: 0.5 } },
    { id: 'bulwark', name: '愤怒壁垒', slot: '胸甲', lvl: 35, cls: ['warrior'], conf: 'official',
      text: '怒气盾激活期间，每 3 秒对周围敌人造成 210% 武器伤害（物理）。',
      fx: { procDps: { pct: 70, ele: 'physical', uptime: 0.8 } } },
    { id: 'unyielding', name: '不屈胸甲', slot: '胸甲', lvl: 35, conf: 'official',
      text: '生命低于 30% 时受伤会获得 4 秒无敌（25 秒冷却）。', fx: {} },
    { id: 'vessel', name: '无尽流之器', slot: '胸甲', lvl: 35, cls: ['monk'], conf: 'mechanism',
      text: '1.0.4 真源：特效为 DamagePerStatusStack（每层真气/Chi 伤害 +2.2，Tag=12），不再是旧的「160%/s×4s 闪电 AOE」。',
      fx: {}, note: '真源 pathid 5141：DamagePerStack=2.2、Tag=12(Chi)。依赖真气层数，无法折算固定秒伤，暂不建模（待实测密度）。旧 procDps 已删除' },

    /* ---- 手套 8 ---- */
    { id: 'unstoppable', name: '不可阻挡护手', slot: '手套', lvl: 1, conf: 'official',
      text: '每次技能命中获得 1% 护甲，持续 5 秒，最多 100 层。', fx: {} },
    { id: 'ragefire', name: '怒火护手', slot: '手套', lvl: 30, cls: ['warrior'], conf: 'modeled',
      text: '烈焰打击有 30% 概率不消耗法力。', fx: { manaFree: { w_flame: 0.3 } } },
    { id: 'stormcaller', name: '风暴召唤护手', slot: '手套', lvl: 35, cls: ['sorcerer'], conf: 'official',
      text: '闪电风暴 +150% 暴击伤害。', fx: { cdAbility: { s_storm: 150 } } },
    { id: 'deflecting', name: '卸力缠手', slot: '手套', lvl: 40, cls: ['monk'], conf: 'official',
      text: '每层怒拳额外 +1% 闪避。', fx: {} },
    { id: 'festering', name: '溃烂护手', slot: '手套', lvl: 40, cls: ['warrior', 'sorcerer', 'hunter'], conf: 'official',
      text: '持续伤害 +80%。', fx: { dot: 80 } },
    { id: 'wayfarers', name: '旅者之握', slot: '手套', lvl: 40, cls: ['monk'], conf: 'modeled',
      text: '冲锋每命中一名敌人获得 1 层（5 秒），每层 +8% 伤害，最多 20 层。',
      fx: { dmg: { all: 40 }, note: '群怪 5 层均值' } },
    { id: 'deadeyegrips', name: '神射之握', slot: '手套', lvl: 45, cls: ['hunter'], conf: 'modeled',
      text: '飞刀弹幕与双箭可穿透 1 个目标。', fx: { ability: { h_rapid: 30 } } },
    { id: 'thirdbeat', name: '第三拍护手', slot: '手套', lvl: 50, conf: 'official',
      text: '每第 3 次基础攻击造成 100% 额外直伤。', fx: { type: { basic: 33 } } },

    /* ---- 腰带 4 ---- */
    { id: 'endlessmana', name: '无尽法力腰带', slot: '腰带', lvl: 1, conf: 'official',
      text: '饮用药水时立即恢复 40% 最大法力。', fx: { manaOnPotion: 40 } },
    { id: 'bottomless', name: '无尽药剂腰带', slot: '腰带', lvl: 34, conf: 'official',
      text: '药水充能 +4。', fx: {} },
    { id: 'draught', name: '战地药剂腰带', slot: '腰带', lvl: 50, conf: 'modeled',
      text: '饮用生命药水后 +35% 全伤害，持续 6 秒。', fx: { dmg: { all: 35 }, uptime: 0.5 } },
    { id: 'ironthorn', name: '铁棘战腰带', slot: '腰带', lvl: 60, cls: ['warrior'], conf: 'modeled',
      text: '铁棘激活期间，每 2 次受击额外触发一次铁棘脉冲（0.2 秒一次上限）。',
      fx: { thornsPct: 100 } },

    /* ---- 护腿 4 ---- */
    { id: 'stalwart', name: '坚毅药汤护胫', slot: '护腿', lvl: 1, conf: 'modeled',
      text: '饮用生命药水后获得 30% 减伤，持续 5 秒。', fx: { takenDR: 15 } },
    { id: 'manaflowgreaves', name: '法力涌流护胫', slot: '护腿', lvl: 25, conf: 'modeled',
      text: '击杀敌人后获得 15 点法力回复，持续 4 秒。', fx: { manaRegen: 7 } },
    { id: 'arcaneedge', name: '奥术之刃护胫', slot: '护腿', lvl: 50, conf: 'official',
      text: '火焰、闪电、奥术技能 +150% 暴击伤害。',
      fx: { cdEle: { fire: 150, lightning: 150, arcane: 150 } } },
    { id: 'stoneguard', name: '石卫护胫', slot: '护腿', lvl: 65, conf: 'official',
      text: '在所有其他减伤之后，再减少 300 点受到的伤害（最低 1 点）。', fx: {} },

    /* ---- 靴子 5 ---- */
    { id: 'mendingstride', name: '治愈之步', slot: '靴子', lvl: 1, conf: 'official',
      text: '移动时每秒恢复 3% 最大生命。', fx: {} },
    { id: 'windcaller', name: '唤风者之靴', slot: '靴子', lvl: 25, conf: 'official',
      text: '击杀后 +50% 移动速度，持续 4 秒。', fx: {} },
    { id: 'fallingleaf', name: '落叶之踏', slot: '靴子', lvl: 40, cls: ['monk'], conf: 'modeled',
      text: '风步激活期间额外获得 30% 攻击速度。', fx: { stat: { as: 30 }, uptime: 0.5 } },
    { id: 'blooddistiller', name: '血馏者之步', slot: '靴子', lvl: 50, conf: 'official',
      text: '击杀敌人有 10% 概率掉落生命药水（每秒最多一次，立即拾取）。', fx: {} },
    { id: 'rimeguard', name: '霜卫之踏', slot: '靴子', lvl: 65, cls: ['sorcerer'], conf: 'official',
      text: '施加冻结时同时施加麻木之寒（目标伤害 -30%）。', fx: {} },

    /* ---- 项链 7 ---- */
    { id: 'surgingmind', name: '涌动心智吊坠', slot: '项链', lvl: 1, conf: 'modeled',
      text: '每消耗 100 点法力，+20% 暴击率，持续 4 秒。', fx: { stat: { cc: 20 }, uptime: 0.7 } },
    { id: 'firelord', name: '火焰领主项链', slot: '项链', lvl: 30, cls: ['sorcerer'], conf: 'official',
      text: '火焰元素额外召唤 1 个。', fx: { ability: { s_elemental: 100 } } },
    { id: 'bellow', name: '裂伤之吼', slot: '项链', lvl: 40, cls: ['warrior'], conf: 'modeled',
      text: '战吼立即引爆周围敌人剩余的流血伤害（可暴击）。', fx: { dot: 50 } },
    { id: 'stormguard', name: '风暴守卫项链', slot: '项链', lvl: 45, cls: ['sorcerer'], conf: 'modeled',
      text: '受到攻击有 30% 概率对攻击者回敬一道烈焰闪电。', fx: { procDps: { pct: 20, ele: 'lightning', uptime: 1 } } },
    { id: 'vigor', name: '活力吊坠', slot: '项链', lvl: 55, conf: 'modeled',
      text: '生命高于 80% 时 +75% 全伤害。', fx: { dmg: { all: 75 }, cond: 'healthy', uptime: 0.6 } },
    { id: 'wolfhunger', name: '狼之饥渴', slot: '项链', lvl: 55, cls: ['hunter'], conf: 'official',
      text: '多重射击打击两次。', fx: { ability: { h_barrage: 100 } } },
    { id: 'bonebreaker', name: '碎骨吊坠', slot: '项链', lvl: 60, cls: ['warrior'], conf: 'modeled',
      text: '横扫 +150% 伤害，且目标每有一种独特减益额外 +70%。',
      fx: { ability: { w_cleave: 150 }, note: '另按 1 种减益 +70% 折算' } },

    /* ---- 戒指 8 ---- */
    { id: 'dragonslayer', name: '屠龙者之戒', slot: '戒指', lvl: 1, conf: 'official',
      text: '场上只剩 1 个敌人时 +35% 攻击速度。', fx: { stat: { as: 35 }, cond: 'single' } },
    { id: 'arcaneprecision', name: '奥术精准之戒', slot: '戒指', lvl: 15, cls: ['hunter'], conf: 'official',
      text: '奥术技能 +9% 暴击率。', fx: { ccEle: { arcane: 9 } } },
    { id: 'bloodfang', name: '血牙印记', slot: '戒指', lvl: 25, cls: ['warrior'], conf: 'modeled',
      text: '半月斩额外掷出 2 道月刃。', fx: { ability: { w_halfmoon: 100 } } },
    { id: 'thirdeye', name: '第三只眼之戒', slot: '戒指', lvl: 25, cls: ['monk'], conf: 'official',
      text: '圣球额外召唤 1 个。', fx: { ability: { m_orbs: 100 } } },
    { id: 'fourthflame', name: '第四焰之戒', slot: '戒指', lvl: 40, cls: ['sorcerer'], conf: 'modeled',
      text: '每第 4 次火球变成追踪的炎爆，爆炸伤害周围敌人。', fx: { ability: { s_fireball: 60 } } },
    { id: 'charged', name: '充能之戒', slot: '戒指', lvl: 45, conf: 'modeled',
      text: '技能伤害随当前法力最多 +50%。', fx: { dmg: { all: 50 }, uptime: 0.7 } },
    { id: 'cryofracture', name: '霜裂之戒', slot: '戒指', lvl: 60, cls: ['sorcerer'], conf: 'modeled',
      text: '冰霜强力攻击每击施加 1 层脆裂（每层 +5% 受到暴击伤害）。',
      fx: { cdEle: { cold: 30 }, note: '按 6 层均值' } },
    { id: 'revelation', name: '启示之戒', slot: '戒指', lvl: 60, conf: 'modeled',
      text: '站定时每秒 +10% 基础攻击伤害，最多 20 层。', fx: { type: { basic: 100 }, uptime: 0.5 } },

    /* ---- 披风 4：纯外观 ---- */
    { id: 'emberdusk', name: '余烬暮色披风', slot: '披风', lvl: 30, conf: 'none', text: '纯外观，无基础属性、无词条、无被动。', fx: {} },
    { id: 'rimeshard', name: '霜片裹尸布', slot: '披风', lvl: 30, conf: 'none', text: '纯外观，无基础属性、无词条、无被动。', fx: {} },
    { id: 'snowpelt', name: '雪皮披风', slot: '披风', lvl: 30, conf: 'none', text: '纯外观，无基础属性、无词条、无被动。', fx: {} },
    { id: 'duskfeather', name: '暮羽之翼', slot: '披风', lvl: 9999, conf: 'none', text: '纯外观（DLC / 成就），无战斗属性。', fx: {} },

    /* ---- 1.0.4 新增传奇（真源 pathid 实证；机制依赖覆盖率/敌人数，暂不折算固定 fx） ---- */
    { id: 'prismheart', name: '棱彩之心', slot: '项链', lvl: 60, conf: 'modeled',
      text: '1.0.4 真源：HighestElementalDamageBonus BonusIncrease=0.25——玩家最高元素伤害加成 +25 个百分点。',
      fx: { ele: 25 },
      note: 'pathid 64193 EquipmentEffect_HighestElementalDamageBonus BonusIncrease=0.25。真源元素伤害为加算池（1+元素伤%+全伤%），"+25"按给最高元素加成 +25 个百分点处理；单主元素 build 下最高元素即 cfg.element，等价 fx.ele=25。多元素均衡堆叠且最高项非主元素时为近似（偏差随元素分布扩大），多元素构筑请手动换算' },
    { id: 'finalverdict', name: '终斩印戒', slot: '戒指', lvl: 50, cls: ['warrior'], conf: 'mechanism',
      text: '1.0.4 真源：AbilityStatusDamage DamageBonus=2.5——指定技能(64251 错落连击)对携带指定状态(64857 流血 DoT)目标伤害 +250%。',
      fx: {}, note: 'pathid 5185。真源特效绑定「特定技能 × 特定状态」，非全局增伤。若手动估算：仅该技能命中带此状态目标的部分按 ×3.5 计，覆盖率=目标带该状态时间占比；无覆盖率真值，不折算固定秒伤' },
    { id: 'souldevour', name: '噬魂肩甲', slot: '肩甲', lvl: 40, conf: 'mechanism',
      text: '1.0.4 真源：DamagePerNearbyEnemy 半径 3 内每敌 +3%（DamagePerEnemy=0.03, BossWeight=5）。',
      fx: {}, note: 'pathid 64198，Radius=3.0。手动估算：全伤加成 = 3% × 半径3内敌人数（Boss 单体按 5 敌 = +15%），进元素/全伤加算池；依赖战场敌人数，不折算固定值' },
    { id: 'minionsaddle', name: '黄金可汗之鞍', slot: '仆从装备', lvl: 70, conf: 'mechanism',
      text: '1.0.4 新增仆从装备槽（槽位 12），无直接玩家 DPS 特效。',
      fx: {}, note: 'pathid 5308，对应 Slot 12 仆从装备' },

    /* ---- 清算锤：1.0.4 真源 PercentMult(Type:2) 武器伤害乘算层，层数用户录入 ---- */
    { id: 'divinemace2', name: '魔翼之锤', slot: '武器', lvl: 1, cls: ['warrior', 'sorcerer', 'monk'], conf: 'modeled',
      text: '1.0.4 真源：直接暴击时获得 1 层「武器伤害 +1%」，最多 50 层、持续 3 秒（Reckoning pathid 5773）。每层乘算 (1.01)^层数。',
      fx: { weaponDamageMult: { perStack: 0.01, maxStacks: 50 } },
      note: '真源 EquipmentEffect_StatusOnCriticalCast pathid 5120 → Reckoning(5773) Stat20 Type:2 Value=0.01。层数由配置 reckoningStacks 录入（暴击触发动态叠层，不自动推算），0 层时无效果' },
    { id: 'ancientdivinemace2', name: '远古·魔翼之锤', slot: '武器', lvl: 1, cls: ['warrior', 'sorcerer', 'monk'], conf: 'modeled',
      text: '1.0.4 真源：直接暴击时获得 1 层「武器伤害 +1.25%」，最多 50 层、持续 3 秒（AncientReckoning pathid 5757）。每层乘算 (1.0125)^层数。',
      fx: { weaponDamageMult: { perStack: 0.0125, maxStacks: 50 } },
      note: '真源 pathid 5110 → AncientReckoning(5757) Stat20 Type:2 Value=0.0125。层数由 reckoningStacks 录入，0 层时无效果' }
  ];

  /* ---------------------------------------------------------------- 词缀表 (ilvl 700 传奇) */
  const AFFIXES = {
    stat: {
      str: { name: '力量', v: 56, slots: 'all', class: ['warrior'] },
      dex: { name: '敏捷', v: 56, slots: 'all', class: ['hunter', 'monk'] },
      int: { name: '智力', v: 56, slots: 'all', class: ['sorcerer'] },
      cc: { name: '暴击率', v: 8.9, slots: ['ring', 'neck', 'gloves'], pct: 1 },
      cd: { name: '暴击伤害', v: 67.2, slots: ['weapon', 'ring', 'neck', 'gloves'], pct: 1 },
      as: { name: '攻击速度', v: 16.8, slots: ['weapon', 'belt', 'ring', 'neck', 'gloves'], pct: 1 },
      maxHealth: { name: '最大生命', v: 504, slots: ['helm', 'chest', 'pants', 'boots', 'belt', 'shoulder'] },
      manaMax: { name: '最大法力', v: 56, slots: ['helm', 'ring', 'gloves'] }
    },
    dmg: {
      damage: { name: '伤害', v: 34, slots: ['weapon', 'gloves'], flat: 1 },
      all: { name: '全伤害', v: 44.8, slots: ['ring', 'neck'], pct: 1 },
      physical: { name: '物理伤害', v: 89.6, slots: ['weapon', 'ring', 'neck'], pct: 1, ele: 'physical' },
      fire: { name: '火焰伤害', v: 89.6, slots: ['weapon', 'ring', 'neck'], pct: 1, ele: 'fire' },
      cold: { name: '冰霜伤害', v: 89.6, slots: ['weapon', 'ring', 'neck'], pct: 1, ele: 'cold' },
      lightning: { name: '闪电伤害', v: 89.6, slots: ['weapon', 'ring', 'neck'], pct: 1, ele: 'lightning' },
      poison: { name: '毒素伤害', v: 89.6, slots: ['weapon', 'ring', 'neck'], pct: 1, ele: 'poison' },
      arcane: { name: '奥术伤害', v: 89.6, slots: ['weapon', 'ring', 'neck'], pct: 1, ele: 'arcane' },
      basic: { name: '基础攻击伤害', v: 78.4, slots: ['weapon', 'neck'], pct: 1, type: 'basic' },
      strong: { name: '强力攻击伤害', v: 78.4, slots: ['weapon', 'neck'], pct: 1, type: 'strong' },
      special: { name: '特殊技能伤害', v: 89.6, slots: ['weapon', 'chest'], pct: 1, type: 'special' },
      dot: { name: '持续伤害', v: 112, slots: ['weapon'], pct: 1, dot: 1 },
      vsHealthy: { name: '对健康目标', v: 112, slots: ['weapon', 'chest', 'neck'], pct: 1, vs: 'healthy' },
      vsInjured: { name: '对受伤目标', v: 112, slots: ['weapon', 'chest', 'neck'], pct: 1, vs: 'injured' },
      vsSlowed: { name: '对减速目标', v: 112, slots: ['weapon', 'neck'], pct: 1, vs: 'slowed' },
      vsImmobilized: { name: '对定身目标', v: 112, slots: ['weapon'], pct: 1, vs: 'immobilized' },
      vsElite: { name: '对精英/Boss', v: 112, slots: ['weapon', 'neck'], pct: 1, vs: 'elite' },
      vsVulnerable: { name: '对易伤目标', v: 112, slots: ['weapon', 'ring', 'neck'], pct: 1, vs: 'vulnerable' },
      vsBleeding: { name: '对流血目标', v: 112, slots: ['weapon'], pct: 1, vs: 'bleeding' },
      vsPoisoned: { name: '对中毒目标', v: 112, slots: ['weapon'], pct: 1, vs: 'poisoned' },
      vsBurning: { name: '对燃烧目标', v: 112, slots: ['weapon'], pct: 1, vs: 'burning' },
      vsDistant: { name: '对远处目标', v: 112, slots: ['weapon'], pct: 1, vs: 'distant' }
    },
    util: {
      cdr: { name: '冷却缩减', v: 11.2, slots: ['helm', 'belt', 'neck', 'gloves', 'shoulder'], pct: 1 },
      costRed: { name: '法力消耗降低', v: 11.2, slots: ['boots', 'belt', 'gloves'], pct: 1 }
    }
  };

  /* ---------------------------------------------------------------- 敌人预设 */
  /* ---------------------------------------------------------------- 遭遇模型
     覆盖率不是"触发概率"，是"目标处于该状态的时间占比"。
     数值按击杀节奏推导：击杀越短，健康段越接近 100%、受伤段越接近 0；
     远程职业在目标来不及贴脸时能吃到"远处"，近战基本为 0。
     只用于周期期望与秒伤；单跳伤害按"这一发命中时的瞬时状态"直接取 0/1，不要用这里的覆盖率。
  */
  const CLASS_RANGE = { warrior: 'melee', sorcerer: 'ranged', hunter: 'ranged', monk: 'melee' };

  const ENCOUNTERS = [
    {
      id: 'trash', name: '单个小怪', tag: '秒杀 · 1–2 秒',
      hp: 55000, elite: false, count: 1, diff: 1,
      melee:  { distant: 0,   healthy: 100, injured: 0,  vuln: 35, slow: 0,  immob: 0 },
      ranged: { distant: 100, healthy: 100, injured: 0,  vuln: 35, slow: 0,  immob: 0 },
      why: {
        distant: '落地即死，远程来不及被贴脸 → 全程算远处；近战本就贴身，吃不到',
        healthy: '满血开打、一两下带走，伤害全落在健康段',
        injured: '没有残血阶段',
        vuln: '易伤要预铺，秒杀只吃到一次窗口，按 1/3 估'
      },
      note: '刷小怪口径。击杀短于易伤持续时间（4s）时，覆盖率由“是否先手上易伤”决定，不由持续时间决定。'
    },
    {
      id: 'elite', name: '精英怪', tag: '持续 · 5–10 秒',
      hp: 165000, elite: true, count: 1, diff: 6,
      melee:  { distant: 0, healthy: 20, injured: 25, vuln: 30, slow: 15, immob: 0 },
      ranged: { distant: 5, healthy: 20, injured: 25, vuln: 30, slow: 15, immob: 0 },
      why: {
        distant: '精英会快速贴近，只有开场几秒算远处 → 5%；近战 0',
        healthy: '血量够厚、DPS 平稳，前 30% 血约占总时长 1/4，取 20%',
        injured: '后 30% 血同理，取 25%',
        vuln: '4 秒易伤对上 6~8 秒击杀，可控覆盖约 1/3',
        slow: '减速技能有 CD，非全程；定身对精英多数抵抗，记 0'
      },
      note: '精英默认带 ×3 生命 / ×1.5 伤害；若要按噩梦难度算，把难度切到噩梦。'
    },
    {
      id: 'boss', name: '区域首领', tag: '长战 · 20 秒以上',
      hp: 2400000, elite: true, count: 1, diff: 6,
      melee:  { distant: 0, healthy: 15, injured: 25, vuln: 45, slow: 20, immob: 0 },
      ranged: { distant: 5, healthy: 15, injured: 25, vuln: 45, slow: 20, immob: 0 },
      why: {
        distant: '首领有位移与突进，远程也只有开场一小段算远处 → 5%',
        healthy: '长战里血量线性下降，健康段≈15%（爆发前置会更高）',
        injured: '收尾阶段同理 ≈25%',
        vuln: '长战里易伤能稳定续，按 45% 估',
        slow: '减速常驻但被抗性削减；定身免疫，记 0'
      },
      note: '长战口径。若你的构筑靠爆发秒阶段，健康段会显著高于 15%，手动调高。'
    },
    {
      id: 'pack', name: '群怪 6 只', tag: 'AOE · 同屏',
      hp: 55000, elite: false, count: 6, diff: 1,
      melee:  { distant: 0,  healthy: 50, injured: 20, vuln: 50, slow: 25, immob: 10 },
      ranged: { distant: 60, healthy: 50, injured: 20, vuln: 50, slow: 25, immob: 10 },
      why: {
        distant: '远程站在外圈能覆盖大半目标 → 60%；近战被围住，基本 0',
        healthy: '一群怪先被 AOE 磨血，健康段/受伤段各半',
        injured: '先死的几只走完受伤段，取 20%',
        vuln: '多目标时易伤技能命中率更高 → 50%',
        slow: '寒冰/减速类 AOE 覆盖较高；定身靠控制链，取 10%'
      },
      note: '群怪口径。AOE 技能按最多 6 个目标结算，单体技能仍只打 1 个。'
    },
    {
      id: 'dummy', name: '木桩', tag: '无限血 · 不动',
      hp: 50000000, elite: true, count: 1, diff: 1,
      melee:  { distant: 0,   healthy: 100, injured: 0, vuln: 60, slow: 0, immob: 0 },
      ranged: { distant: 100, healthy: 100, injured: 0, vuln: 60, slow: 0, immob: 0 },
      why: {
        distant: '木桩不移动：远程全程保持最远距离 → 100%；近战贴脸打，吃不到',
        healthy: '木桩血量视为无限，永远处于健康段',
        injured: '永远打不到 70% 以下，记 0',
        vuln: '站桩可以稳定续易伤，按 60% 估'
      },
      note: '标准站桩口径，用来横向比构筑，不代表任何实战场景的绝对秒伤。'
    }
  ];

  const ENEMIES = [
    { id: 'mob', name: '普通怪群 (L70)', hp: 55000, elite: false, count: 6, note: '成堆小怪，AOE 收益最高' },
    { id: 'elite', name: '精英怪 (L70)', hp: 165000, elite: true, count: 1, note: '生命 ×3，伤害 ×1.5' },
    { id: 'boss', name: '区域首领 (L70)', hp: 2400000, elite: true, count: 1, note: '远古橡木树精基准' },
    { id: 'world', name: '世界首领 · 南瓜王', hp: 9000000, elite: true, count: 1, note: '1.1.0 世界首领，可取不同难度' },
    { id: 'rift', name: '秘境首领 (高层)', hp: 18000000, elite: true, count: 1, note: '秘境按层数放大生命' }
  ];

  const PATCHES = [
    { v: '1.1.11a', d: '2026-11-12', items: ['修复材料/统计页签与祖母之弓描述'] },
    { v: '1.1.11', d: '2026-11-12', items: ['蓄势待发 +30%→+80%', '横扫基础 50%→70%，每级 2.5%→3%', '出血重做：每点 +10% 流血伤害', '毒伤每跳 75%→100%', '新增 7 套符文、8 件传奇、3 件神圣', '仆从强化：+5 技能等级（48 小时）'] },
    { v: '1.1.0', d: '2026-10-29', items: ['世界首领系统', '仆从养成', '护体真气重做：每 3 秒 500% 法力护盾', '破绽连击：5 层破绽→易伤'] },
    { v: '1.0.3', d: '2026-10-15', items: ['12 件传奇与黑雾版本', '符文套装掉率提升', '优秀→稀有符文转化率 100%'] },
    { v: '1.0.2b', d: '2026-10-13', items: ['减伤与元素抗性上限 90%', '冷却缩减上限 85%→80%'] }
  ];

  return { VERSION, ELEMENTS, CLASSES, MINIONS, LEGENDARIES, AFFIXES, ENEMIES, ENCOUNTERS, CLASS_RANGE, PATCHES, MECHANICS,
    GEMS: { GRADES: GEM_GRADES, FAMILIES: GEM_FAMILIES, SLOT_TYPE: GEM_SLOT_TYPE, SLOT_CAP: GEM_SLOT_CAP, CONFIG: GEM_CONFIG, KEY_TO_SLOT: GEM_KEY_TO_SLOT, name: gemName } };
})();
