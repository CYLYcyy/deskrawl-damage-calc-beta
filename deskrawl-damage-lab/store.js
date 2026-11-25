/* ==========================================================================
   配置存档层
   - 任何来源（localStorage / 导入文件 / URL）的数据都要先过 normalize()
   - normalize 做三件事：字段兜底、类型纠正、与当前数据版本做交叉校验
   - 存储不可用时（隐私模式 / file:// 限制）自动降级为内存，功能不中断
   ========================================================================== */
(function () {
  const D = window.DESKRAWL_DATA || {};
  const KEY_SAVES = 'deskrawl.lab.saves.v2';
  const KEY_DRAFT = 'deskrawl.lab.draft.v2';
  const KEY_PENDING = 'deskrawl.lab.pending.v1';   // 未决项裁决 + 用户实测（独立存储，版本变更保留实测）
  const KEY_SOLVE = 'deskrawl.lab.solve.v1';      // 最优解缓存（数据版本变更即失效）
  const KEY_PREF = 'deskrawl.lab.pref.v1';        // UI 偏好（引导条关闭状态等）
  const MAX_SAVES = 40;
  const MAX_SOLVES = 40;

  const GEAR_KEYS = ['dps', 'speed', 'main', 'cc', 'cd', 'as', 'ele', 'type', 'all', 'vsElite', 'vsVuln', 'manaMax', 'regen', 'costRed', 'flat', 'cdr', 'weaponDamage'];
  const CLASS_KEYS = Object.keys(D.CLASSES || {});
  const ELEMENTS = Object.keys(D.ELEMENTS || {});
  const TYPES = ['basic', 'strong', 'special'];

  /* ---------------------------------------------------------------- storage */
  function probe() {
    try {
      const k = '__probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }
  const hasLS = typeof window !== 'undefined' && probe();
  const mem = Object.create(null);

  const raw = {
    get(k) {
      try { return hasLS ? window.localStorage.getItem(k) : (k in mem ? mem[k] : null); }
      catch (e) { return null; }
    },
    set(k, v) {
      try {
        if (hasLS) window.localStorage.setItem(k, v);
        else mem[k] = v;
        return true;
      } catch (e) {
        mem[k] = v;                       // 配额满 / 被禁用时退到内存
        return false;
      }
    },
    del(k) {
      try { if (hasLS) window.localStorage.removeItem(k); } catch (e) { }
      delete mem[k];
    }
  };

  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

  /* ---------------------------------------------------------------- coercion */
  const num = (v, d, min, max) => {
    let n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) n = d;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  };
  const int = (v, d, min, max) => Math.round(num(v, d, min, max));
  const pick = (v, list, d) => (list.indexOf(v) >= 0 ? v : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : (v === 1 || v === '1' ? true : (v === 0 || v === '0' ? false : !!d)));
  const arr = (v) => (Array.isArray(v) ? v : []);

  const PRESETS = (window.Engine && window.Engine.GEAR_PRESETS) || {};

  function defaultGear(preset) {
    const p = PRESETS[preset] || PRESETS.mid || {};
    const g = {};
    GEAR_KEYS.forEach(k => { g[k] = typeof p[k] === 'number' ? p[k] : 0; });
    g.name = p.name || '中配';
    return g;
  }

  /* 该职业的兜底技能组：取前三类各第一个；特殊技能只有一个时第二槽留空（不重复带） */
  function fallbackSkills(classKey) {
    const c = D.CLASSES[classKey] || {};
    const b = (c.basics || [])[0], s = (c.strongs || [])[0], sp = (c.specials || [])[0], sp2 = (c.specials || [])[1];
    return { basic: b && b.id, strong: s && s.id, special1: sp && sp.id, special2: (sp2 && sp2.id) || '' };
  }

  /* 技能槽规范化：
     - 显式 '' / null / 'none' = 该槽不装备（留空）；用于"为提高周期伤害不带技能"
     - 未提供该键（旧存档）才回退到职业默认；无效 id 也回退
     - 特殊技能双向去重：两个特殊槽不得装备同一个技能 */
  function sanitizeSkills(classKey, v) {
    const c = D.CLASSES[classKey] || {};
    const pool = { basic: (c.basics || []).map(a => a.id), strong: (c.strongs || []).map(a => a.id), special1: (c.specials || []).map(a => a.id), special2: (c.specials || []).map(a => a.id) };
    const fb = fallbackSkills(classKey);
    const out = {};
    ['basic', 'strong', 'special1', 'special2'].forEach(k => {
      const has = v && Object.prototype.hasOwnProperty.call(v, k);
      const want = has ? v[k] : undefined;
      if (want === '' || want === null || want === 'none') out[k] = '';       // 显式留空
      else if (pool[k].indexOf(want) >= 0) out[k] = want;                      // 合法技能
      else out[k] = fb[k] || '';                                              // 缺省/无效回退
    });
    // 双向去重：特殊槽 2 与特殊槽 1 相同则换一个，换不到则留空（绝不重复带）
    if (out.special1 && out.special2 && out.special1 === out.special2) {
      out.special2 = pool.special2.find(x => x !== out.special1) || '';
    }
    return out;
  }

  function sanitizeTalents(classKey, v) {
    const c = D.CLASSES[classKey] || {};
    const defs = {};
    (c.talents || []).forEach(row => (row.items || []).forEach(t => { defs[t.id] = t.max || 1; }));
    const out = {};
    let total = 0;
    if (!v || typeof v !== 'object') return out;
    Object.keys(v).forEach(k => {
      if (!(k in defs)) return;                       // 数据版本变了之后清掉不存在的天赋
      const n = int(v[k], 0, 0, defs[k]);
      if (n > 0) { out[k] = n; total += n; }
    });
    // 点数超上限（换版本/手改文件）时按比例截断，避免引擎按超配算
    const CAP = 70;   // 与 solver.js BUDGET、engine.js autoTalents 保持一致
    if (total > CAP) {
      let left = CAP;
      const keys = Object.keys(out).sort((a, b) => out[b] - out[a]);
      keys.forEach(k => { const keep = Math.min(out[k], left); left -= keep; if (keep > 0) out[k] = keep; else delete out[k]; });
    }
    return out;
  }

  function sanitizeLegendaries(classKey, v) {
    const list = arr(v);
    const byId = {};
    ((D.LEGENDARIES) || []).forEach(L => { byId[L.id] = L; });
    const out = [];
    const slotCount = {};
    list.forEach(id => {
      const L = byId[id];
      if (!L) return;                                  // 不存在的传奇直接丢
      if (L.cls && L.cls.indexOf(classKey) < 0) return; // 职业限定不符
      const cap = L.slot === '戒指' ? 2 : 1;
      slotCount[L.slot] = slotCount[L.slot] || 0;
      if (slotCount[L.slot] >= cap) return;
      slotCount[L.slot]++;
      if (out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  /* 主装备 gearBuild（目标装分生成）：结构较深，宽松校验防类型污染即可 */
  function sanitizeGearBuild(v) {
    if (!v || typeof v !== 'object') return null;
    const out = JSON.parse(JSON.stringify(v));
    out.ilvl = int(out.ilvl, 700, 100, 1200);
    out.rarity = pick(out.rarity, ['common', 'uncommon', 'rare', 'legendary', 'divine', 'blackMist', 'ancient', 'ancientDivine'], 'legendary');
    out.roll = num(out.roll, 1, 0.5, 1.15);
    if (Array.isArray(out.slots)) out.slots = out.slots.slice(0, 11);
    return out;
  }

  /* 仆从第 13 件装备：部位限定为 affix.js 中无宝石孔且主池非空的槽位 */
  function minionGearSlots() {
    const AF = window.AffixMath;
    if (!AF || !AF.SLOT_POOLS) return [];
    return Object.keys(AF.SLOT_POOLS).map(Number)
      .filter(k => AF.SLOT_POOLS[k].sockets === 0 && AF.SLOT_POOLS[k].length > 0);
  }
  function sanitizeMinionGearBuild(v) {
    if (!v || typeof v !== 'object') return null;
    const allowed = minionGearSlots();
    const slots = arr(v.slots).slice(0, 4).map(s => ({
      slot: allowed.indexOf(+s.slot) >= 0 ? +s.slot : (allowed[0] || 5),
      main: arr(s.main).slice(0, 3).map(x => int(x, 0, 0, 70)),
      secondary: arr(s.secondary).slice(0, 3).map(x => int(x, 0, 0, 70)),
      roll: num(s.roll, 1, 0.5, 1.15)
    })).filter(s => s.main.length || s.secondary.length);
    if (!slots.length) return null;
    return {
      name: '仆从第13件',
      ilvl: int(v.ilvl, 700, 100, 1000),
      rarity: pick(v.rarity, ['common', 'uncommon', 'rare', 'legendary', 'ancient', 'blackMist'], 'legendary'),
      ancient: !!v.ancient,
      blackMist: !!v.blackMist,
      classKey: typeof v.classKey === 'string' ? v.classKey : '',
      element: typeof v.element === 'string' ? v.element : '',
      slots: slots
    };
  }

  function sanitizeEnemy(v, diff, fallbackName) {
    const e = v && typeof v === 'object' ? v : {};
    const baseHp = num(e.baseHp, 2400000, 1000);
    const d = num(diff, 6, 1, 20);
    const preset = (D.ENEMIES || []).find(x => x.name === e.name);
    return {
      name: typeof e.name === 'string' && e.name ? e.name : (preset ? preset.name : (fallbackName || '区域首领 (L70)')),
      baseHp: baseHp,
      hp: num(e.hp, Math.round(baseHp * d), 0) > 0 ? num(e.hp, Math.round(baseHp * d), 0) : Math.round(baseHp * d),
      armor: num(e.armor, 0, 0, 1e6),
      mr: num(e.mr, 0, 0, 1e6),
      count: int(e.count, 1, 1, 20),
      elite: bool(e.elite, true),
      distant: typeof e.distant === 'boolean' ? (e.distant ? 100 : 0) : num(e.distant, 0, 0, 100),
      vuln: num(e.vuln, 45, 0, 100),
      slow: num(e.slow, 10, 0, 100),
      immob: num(e.immob, 25, 0, 100),
      healthy: num(e.healthy, 20, 0, 100),
      injured: num(e.injured, 20, 0, 100),
      critdr: num(e.critdr, 0, 0, 90)
    };
  }

  /* ---------------------------------------------------------------- decisions */
  /* 未决项裁决：选择 + 用户实测。实测属第一手证据，数据版本变更时保留；
     系统默认/另一口径随版本重新审视（回到默认，由用户重新裁决）。 */
  const DEC_MODES = ['default', 'alt', 'measured'];
  function cleanValue(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') return v.slice(0, 40);
    return null;
  }
  function cleanMeasured(m) {
    if (!m || typeof m !== 'object') return null;
    const value = cleanValue(m.value);
    const verdict = m.verdict === 'multiplicative' || m.verdict === 'additive' ? m.verdict : null;
    if ((value == null || value === '') && !verdict) return null;
    return {
      value: value == null ? '' : value,
      conditions: String(m.conditions || '').slice(0, 200),
      date: String(m.date || '').slice(0, 20),
      note: String(m.note || '').slice(0, 200),
      verdict: verdict
    };
  }
  function sanitizeDecisions(v) {
    const out = {};
    if (!v || typeof v !== 'object') return out;
    Object.keys(v).forEach(id => {
      const d = v[id];
      if (!d || typeof d !== 'object') return;
      const mode = pick(d.mode, DEC_MODES, 'default');
      const measured = cleanMeasured(d.measured);
      out[id] = {
        mode: measured && mode === 'measured' ? 'measured' : mode,
        value: cleanValue(d.value),
        measured: measured,
        ts: num(d.ts, 0, 0)
      };
    });
    return out;
  }

  function loadPending() {
    const o = parse(raw.get(KEY_PENDING));
    const game = (D.VERSION && D.VERSION.game) || '';
    if (!o || typeof o !== 'object' || !o.decisions || typeof o.decisions !== 'object') {
      return { decisions: {}, stale: false, game: game };
    }
    const stale = !!o.game && !!game && o.game !== game;
    const dec = sanitizeDecisions(o.decisions);
    if (stale) {
      // 版本变了：只保留用户实测，其余回到系统默认等待重新裁决
      Object.keys(dec).forEach(id => {
        const d = dec[id];
        if (d.mode !== 'measured') dec[id] = { mode: 'default', value: null, measured: null, ts: 0 };
      });
    }
    return { decisions: dec, stale: stale, game: game };
  }
  function savePending(decisions) {
    return raw.set(KEY_PENDING, JSON.stringify({
      v: 1,
      game: (D.VERSION && D.VERSION.game) || '',
      ts: Date.now(),
      decisions: sanitizeDecisions(decisions)
    }));
  }
  function clearPending() { raw.del(KEY_PENDING); }

  /* 符文六槽：真源 RuneSlotUnlockLevels=[30,35,40,45,50,55]，6 槽逐槽自由配置。
     每槽 { id: RuneData id, level: 1-6 } 或 null（空槽）。 */
  const RUNE_UNLOCK = [30, 35, 40, 45, 50, 55];
  function sanitizeRuneSlots(v) {
    const out = [null, null, null, null, null, null];
    if (!Array.isArray(v)) return out;
    const validIds = {};
    const RD = window.RuneData;
    if (RD && Array.isArray(RD.RUNES)) RD.RUNES.forEach(r => { validIds[r.id] = true; });
    for (let i = 0; i < 6; i++) {
      const slot = v[i];
      if (!slot || typeof slot !== 'object' || !slot.id) continue;
      // 有 RuneData 时校验 id 合法性；无则保留（模块未加载不丢数据）
      if (Object.keys(validIds).length && !validIds[slot.id]) continue;
      out[i] = { id: String(slot.id).slice(0, 60), level: int(slot.level, 1, 1, 6) };
    }
    return out;
  }

  /* 协同被动槽：{ slave: 真源英文名, stat: Stat id }，需主仆从 10 星 */
  function sanitizeSynergy(v) {
    if (!v || typeof v !== 'object' || v.stat == null) return null;
    const stat = int(v.stat, 0, 0, 100);
    const slave = typeof v.slave === 'string' ? v.slave.slice(0, 60) : '';
    return { slave, stat };
  }

  /* 宝石镶嵌 { [数字槽位]: [{ fam, lv }, ...] }，照真源 GemData 校验
     槽位 1-11、家族 6 类、品级 1-7、每槽孔数不超过 GEM_SLOT_CAP。 */
  const GEM_FAMS = ['diamond', 'ruby', 'sapphire', 'topaz', 'emerald', 'amethyst'];
  const GEM_CAP = (D.GEMS && D.GEMS.SLOT_CAP) ||
    { 1: 3, 2: 1, 3: 2, 4: 2, 5: 0, 6: 0, 7: 1, 8: 1, 9: 0, 10: 0, 11: 0 };
  function sanitizeGems(v) {
    const out = {};
    if (!v || typeof v !== 'object') return out;
    Object.keys(v).forEach(sk => {
      const slot = parseInt(sk, 10);
      if (!(slot >= 1 && slot <= 11) || !Array.isArray(v[sk])) return;
      const cap = GEM_CAP[slot] || 0;
      const gems = v[sk].slice(0, cap).map(g => ({
        fam: pick(g && g.fam, GEM_FAMS, GEM_FAMS[0]),
        lv: int(g && g.lv, 1, 1, 7)
      }));
      if (gems.length) out[slot] = gems;
    });
    return out;
  }

  /* ---------------------------------------------------------------- snapshot */
  function defaults() {
    const cls = CLASS_KEYS[0] || 'warrior';
    return {
      classKey: cls,
      element: ELEMENTS[0] || 'physical',
      primaryType: 'strong',
      gear: defaultGear('mid'),
      gearBuild: null,
      skills: fallbackSkills(cls),
      talents: {},
      setId: null,
      setCount: 0,
      runeSlots: [null, null, null, null, null, null],
      legendaries: [],
      minionId: (D.MINIONS && D.MINIONS[0] && D.MINIONS[0].id) || null,
      minionLevel: 10,
      minionReins: false,
      minionGear: 'none',
      minionGearGate: true,
      minionGearBuild: null,
      minionStars: 10,
      minionSynergy: null,
      electroStacks: null,
      brittleStacks: 0,
      brittleZone: 'crit',
      reckoningStacks: 0,
      gems: {},
      enemy: sanitizeEnemy({}, 6),
      encounter: null,
      diff: 6,
      duration: 60,
      gcd: 0.45,
      preset: 'mid',
      slot: 'weapon',
      decisions: {}
    };
  }

  /** 任何外部数据都从这里进入系统 */
  function normalize(src) {
    const base = defaults();
    const s = src && typeof src === 'object' ? src : {};

    const classKey = pick(s.classKey || s.c, CLASS_KEYS, base.classKey);
    const c = D.CLASSES[classKey] || {};

    // 职业默认流派（用于兜底，不依赖 app.js）
    const ui = {
      warrior: ['fire', 'strong'], sorcerer: ['lightning', 'strong'],
      hunter: ['physical', 'strong'], monk: ['lightning', 'strong']
    }[classKey] || [base.element, 'strong'];

    const element = pick(s.element || s.e, ELEMENTS, ui[0]);
    const primaryType = pick(s.primaryType || s.t, TYPES, ui[1]);

    const gRaw = s.gear || s.g;
    const g = gRaw && typeof gRaw === 'object' ? gRaw : {};
    const gear = defaultGear(s.preset || s.pr || 'mid');
    GEAR_KEYS.forEach(k => { if (k in g) gear[k] = num(g[k], gear[k], 0); });
    gear.dps = num(gear.dps, 200, 1);
    gear.speed = num(gear.speed, 1, 0.2, 4);
      gear.name = typeof g.name === 'string' ? g.name : gear.name;
      const gearBuild = sanitizeGearBuild(s.gearBuild || s.gb);

      const encIds = (D.ENCOUNTERS || []).map(x => x.id);
    const encRaw = s.encounter !== undefined ? s.encounter : s.ec;
    const encounter = encIds.indexOf(encRaw) >= 0 ? encRaw : null;
    const encDef = (D.ENCOUNTERS || []).find(x => x.id === encounter);

    const setIds = (c.sets || []).map(x => x.id);
    const setId = setIds.indexOf(s.setId || s.si) >= 0 ? (s.setId || s.si) : (setIds[0] || null);
    const setCount = int(s.setCount != null ? s.setCount : s.sc, 0, 0, 6);

    const minionIds = (D.MINIONS || []).map(m => m.id);
    const minionId = minionIds.indexOf(s.minionId || s.mi) >= 0 ? (s.minionId || s.mi) : base.minionId;
    const stars = int(s.minionStars != null ? s.minionStars : s.ms, 10, 1, 10);

    return {
      classKey: classKey,
      element: element,
      primaryType: primaryType,
      gear: gear,
      gearBuild: gearBuild,
      skills: sanitizeSkills(classKey, s.skills || s.s),
      talents: sanitizeTalents(classKey, s.talents || s.tl),
      setId: setId,
      setCount: setCount,
      runeSlots: sanitizeRuneSlots(s.runeSlots || s.rs),
      legendaries: sanitizeLegendaries(classKey, s.legendaries || s.lg),
      minionId: minionId,
      minionLevel: int(s.minionLevel != null ? s.minionLevel : s.ml, 10, 1, 10),
      minionReins: bool(s.minionReins != null ? s.minionReins : s.mr, false),
      minionGear: pick(s.minionGear || s.mg, ['none', 'atk', 'sup', 'def'], 'none'),
      minionGearGate: bool(s.minionGearGate != null ? s.minionGearGate : s.m13g, true),
      minionGearBuild: sanitizeMinionGearBuild(s.minionGearBuild || s.m13),
      minionStars: stars,
      minionSynergy: sanitizeSynergy(s.minionSynergy || s.mSyn),
      electroStacks: (s.electroStacks === undefined ? s.es : s.electroStacks) == null ? null : int(s.electroStacks !== undefined ? s.electroStacks : s.es, 0, 0, 10),
      brittleStacks: int(s.brittleStacks != null ? s.brittleStacks : s.bs, 0, 0, 100),
      brittleZone: pick(s.brittleZone || s.bz, ['crit', 'taken', 'off'], 'crit'),
      reckoningStacks: int(s.reckoningStacks != null ? s.reckoningStacks : s.rk, 0, 0, 30),
      gems: sanitizeGems(s.gems || s.gm),
      enemy: sanitizeEnemy(s.enemy || s.en, s.diff != null ? s.diff : s.df, encDef ? encDef.name : null),
      encounter: encounter,
      diff: num(s.diff != null ? s.diff : s.df, 6, 1, 20),
      duration: int(s.duration || s.du, 60, 20, 180),
      gcd: num(s.gcd || s.gc, 0.45, 0.2, 3),
      preset: pick(s.preset || s.pr, ['starter', 'mid', 'end'], 'mid'),
      slot: pick(s.slot || s.sl, ['weapon', 'helm', 'shoulder', 'chest', 'gloves', 'belt', 'pants', 'boots', 'neck', 'ring', 'back'], 'weapon'),
      decisions: sanitizeDecisions(s.decisions || s.dj)
    };
  }

  /* 紧凑键名：URL 分享用，短一半左右 */
  const SHORT = {
    classKey: 'c', element: 'e', primaryType: 't', gear: 'g', skills: 's', talents: 'tl',
    setId: 'si', setCount: 'sc', legendaries: 'lg', minionId: 'mi', minionLevel: 'ml',
    minionReins: 'mr', minionGear: 'mg', minionGearGate: 'm13g', minionGearBuild: 'm13', minionStars: 'ms', minionSynergy: 'mSyn',
    electroStacks: 'es', encounter: 'ec', brittleStacks: 'bs', brittleZone: 'bz', reckoningStacks: 'rk', gems: 'gm',
    gearBuild: 'gb', runeSlots: 'rs',
    enemy: 'en', diff: 'df', duration: 'du', gcd: 'gc', preset: 'pr', slot: 'sl', decisions: 'dj'
  };

  function encode(snap) {
    const o = {};
    Object.keys(SHORT).forEach(k => {
      if (snap[k] === undefined || snap[k] === null) return;
      if (k === 'decisions' && !Object.keys(snap.decisions || {}).length) return;  // 空裁决不占分享码
      o[SHORT[k]] = snap[k];
    });
    o.g = {}; GEAR_KEYS.forEach(k => { o.g[k] = snap.gear[k]; });
    if (o.en && o.en.name && snap.encounter) { o.en = Object.assign({}, o.en); delete o.en.name; }
    return o;
  }

  function b64url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  const toHash = (snap) => b64url(JSON.stringify(encode(snap)));
  function fromHash(h) {
    if (!h) return null;
    try { return normalize(JSON.parse(unb64url(h))); } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- saves */
  function readSaves() {
    const o = parse(raw.get(KEY_SAVES));
    if (!o || !Array.isArray(o.list)) return { v: 2, list: [], active: null };
    o.list = o.list.filter(x => x && x.id && x.snap).map(x => ({
      id: String(x.id),
      name: String(x.name || '未命名').slice(0, 40),
      cls: String(x.cls || ''),
      ele: String(x.ele || ''),
      dps: num(x.dps, 0, 0),
      ttk: num(x.ttk, 0, 0),
      game: String(x.game || ''),
      conf: num(x.conf, 0, 0, 100),
      ts: num(x.ts, Date.now(), 0),
      snap: normalize(x.snap)
    }));
    return { v: 2, list: o.list, active: o.active || null };
  }

  function writeSaves(db) {
    const trimmed = { v: 2, active: db.active || null, list: db.list.slice(0, MAX_SAVES) };
    return raw.set(KEY_SAVES, JSON.stringify(trimmed));
  }

  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function save(snap, meta) {
    const db = readSaves();
    const m = meta || {};
    const entry = {
      id: m.id || uid(),
      name: String(m.name || '未命名配置').slice(0, 40),
      cls: snap.classKey,
      ele: snap.element,
      dps: num(m.dps, 0, 0),
      ttk: num(m.ttk, 0, 0),
      game: (D.VERSION && D.VERSION.game) || '',
      conf: num(m.conf, 0, 0, 100),
      ts: Date.now(),
      snap: normalize(snap)
    };
    const i = db.list.findIndex(x => x.id === entry.id);
    if (i >= 0) db.list[i] = entry; else db.list.unshift(entry);
    db.active = entry.id;
    writeSaves(db);
    return entry;
  }

  function remove(id) {
    const db = readSaves();
    db.list = db.list.filter(x => x.id !== id);
    if (db.active === id) db.active = null;
    writeSaves(db);
    return db;
  }
  function rename(id, name) {
    const db = readSaves();
    const e = db.list.find(x => x.id === id);
    if (e) e.name = String(name || e.name).slice(0, 40);
    writeSaves(db);
    return db;
  }
  function activate(id) {
    const db = readSaves();
    db.active = db.list.some(x => x.id === id) ? id : null;
    writeSaves(db);
    return db;
  }

  /* ---------------------------------------------------------------- draft */
  function saveDraft(snap, meta) {
    const o = { ts: Date.now(), game: (D.VERSION && D.VERSION.game) || '', meta: meta || {}, snap: normalize(snap) };
    return raw.set(KEY_DRAFT, JSON.stringify(o));
  }
  function readDraft() {
    const o = parse(raw.get(KEY_DRAFT));
    if (!o || !o.snap) return null;
    return { ts: num(o.ts, 0, 0), game: String(o.game || ''), meta: o.meta || {}, snap: normalize(o.snap) };
  }
  function clearDraft() { raw.del(KEY_DRAFT); }

  /* ---------------------------------------------------------------- 最优解缓存 */
  /* key = 职业 + 技能组 + 元素 + 套装 + 敌模型 + 数据版本 + 档位
     （额外纳入装备/传奇/仆从/裁决，避免口径不同时误命中旧结果） */
  function solveKey(cfg, tier) {
    const c = cfg || {}, en = c.enemy || {}, g = c.gear || {};
    const game = (D.VERSION && D.VERSION.game) || '';
    return [
      game, c.classKey || '', c.element || '', c.primaryType || '', tier || 'quick',
      JSON.stringify(c.skills || {}),
      c.setId || '', c.setCount || 0,
      JSON.stringify([en.name, en.hp, en.baseHp, en.armor, en.mr, en.count, en.elite,
        en.distant, en.vuln, en.slow, en.immob, en.healthy, en.injured, en.critdr,
        en.healthyUptime, en.injuredUptime, en.slowedUptime, en.immobilizedUptime, c.vulnUptime]),
      JSON.stringify(c.legendaries || []),
      JSON.stringify([g.dps, g.speed, g.main, g.cc, g.cd, g.as, g.ele, g.type, g.all,
        g.vsElite, g.vsVuln, g.manaMax, g.regen, g.costRed, g.flat, g.cdr, g.weaponDamage, g.name]),
      JSON.stringify([c.minionId, c.minionLevel, c.minionReins, c.minionGear]),
      JSON.stringify(c.decisions || {}),
      JSON.stringify(c.gearBuild || null),
      JSON.stringify(c.minionGearBuild || null)
    ].join('|');
  }
  function hashSig(sig) {
    let h = 2166136261;
    for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function readSolveDb() {
    const o = parse(raw.get(KEY_SOLVE));
    if (!o || typeof o !== 'object' || !o.map || typeof o.map !== 'object') return { v: 1, map: {} };
    const game = (D.VERSION && D.VERSION.game) || '';
    const map = {};
    Object.keys(o.map).forEach(k => {
      const e = o.map[k];
      if (e && e.game === game && e.sig && e.result) map[k] = e;   // 数据版本变更即失效
    });
    return { v: 1, map };
  }
  function getSolve(sig) {
    if (!sig) return null;
    const e = readSolveDb().map[hashSig(sig)];
    return (e && e.sig === sig) ? e.result : null;
  }
  function putSolve(sig, result) {
    if (!sig || !result) return false;
    const db = readSolveDb();
    db.map[hashSig(sig)] = { sig: sig, game: (D.VERSION && D.VERSION.game) || '', ts: Date.now(), result: result };
    const keys = Object.keys(db.map);
    if (keys.length > MAX_SOLVES) {
      keys.sort((a, b) => db.map[b].ts - db.map[a].ts);
      keys.slice(MAX_SOLVES).forEach(k => { delete db.map[k]; });
    }
    return raw.set(KEY_SOLVE, JSON.stringify(db));
  }
  function clearSolve() { raw.del(KEY_SOLVE); }

  /* ---------------------------------------------------------------- file io */
  function exportFile(name, snap, meta) {
    const payload = {
      app: 'deskrawl-damage-lab',
      schema: 2,
      game: (D.VERSION && D.VERSION.game) || '',
      dataDate: (D.VERSION && D.VERSION.dataDate) || '',
      exportedAt: new Date().toISOString(),
      name: name || '未命名配置',
      meta: meta || {},
      snapshot: normalize(snap)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deskrawl-${(name || 'build').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30)}-${payload.game}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }

  /** 返回 {ok, snap, name, warning} */
  function parseFile(text) {
    const o = parse(text);
    if (!o || typeof o !== 'object') return { ok: false, error: '不是合法的 JSON 文件' };
    const snapSrc = o.snapshot || o.snap || o;
    if (!snapSrc || typeof snapSrc !== 'object') return { ok: false, error: '文件里没有配置数据' };
    if (o.app && o.app !== 'deskrawl-damage-lab') return { ok: false, error: '这个文件不是本工具导出的（app 标识不符）' };
    const snap = normalize(snapSrc);
    const warnings = [];
    if (o.game && D.VERSION && o.game !== D.VERSION.game) warnings.push(`存档来自 ${o.game}，当前数据 ${D.VERSION.game}，已按当前数值重算`);
    return { ok: true, snap, name: String(o.name || '导入的配置').slice(0, 40), warnings };
  }

  /* ---------------------------------------------------------------- UI 偏好 */
  /* 与存档共用同一套 storage 降级层（不可用时写内存），命名空间 deskrawl.lab.* */
  function readPrefs() {
    const o = parse(raw.get(KEY_PREF));
    return o && typeof o === 'object' ? o : {};
  }
  function getPref(k, d) {
    const o = readPrefs();
    return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : d;
  }
  function setPref(k, v) {
    const o = readPrefs();
    o[k] = v;
    return raw.set(KEY_PREF, JSON.stringify(o));
  }

  /* ---------------------------------------------------------------- 板块预设
     受游戏内置"天赋页保存"启发：每个板块（技能/装备特效/词条/宝石/仆从/天赋/符文）
     独立保存多个命名方案；总配置方案 = 各板块各选一个预设的组合。
     数据结构：{ skills:[{id,name,ts,data}], effects:[...], ... } */
  const KEY_BLOCKS = 'deskrawl.lab.blocks.v1';
  const BLOCK_KINDS = ['skills', 'effects', 'affix', 'gems', 'minion', 'talents', 'runes'];
  const BLOCK_LABEL = {
    skills: '技能配置', effects: '装备特效', affix: '装备词条', gems: '宝石镶嵌',
    minion: '仆从配置', talents: '天赋页', runes: '符文页'
  };
  const bid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function readBlocks() {
    const o = parse(raw.get(KEY_BLOCKS));
    const out = {};
    BLOCK_KINDS.forEach(k => { out[k] = (o && Array.isArray(o[k])) ? o[k] : []; });
    return out;
  }
  function writeBlocks(db) {
    const clean = {};
    BLOCK_KINDS.forEach(k => { clean[k] = Array.isArray(db[k]) ? db[k].slice(0, 30) : []; });
    return raw.set(KEY_BLOCKS, JSON.stringify(clean));
  }
  function saveBlock(kind, name, data) {
    if (BLOCK_KINDS.indexOf(kind) < 0) return null;
    const db = readBlocks();
    const entry = { id: bid(), name: String(name || '未命名').slice(0, 24), ts: Date.now(), data: data || {} };
    db[kind].unshift(entry);
    writeBlocks(db);
    return entry;
  }
  function renameBlock(kind, id, name) {
    const db = readBlocks();
    const e = (db[kind] || []).find(x => x.id === id);
    if (e) { e.name = String(name || e.name).slice(0, 24); writeBlocks(db); }
    return e || null;
  }
  function removeBlock(kind, id) {
    const db = readBlocks();
    db[kind] = (db[kind] || []).filter(x => x.id !== id);
    writeBlocks(db);
    return db;
  }
  /* 总配置方案 = 各板块选中的预设 id 组合 */
  function getBlueprint() {
    const o = parse(raw.get(KEY_BLOCKS + '.blueprint')) || {};
    return o; // { skills: id, effects: id, ... }
  }
  function setBlueprint(bp) {
    return raw.set(KEY_BLOCKS + '.blueprint', JSON.stringify(bp || {}));
  }

  /** 存储健康诊断：UI 用它在启动时给出友好提示，而不是静默失败 */
  function diagnose() {
    const draftRaw = raw.get(KEY_DRAFT);
    const savesRaw = raw.get(KEY_SAVES);
    const prefRaw = raw.get(KEY_PREF);
    return {
      available: hasLS,
      draftCorrupt: !!(draftRaw && !parse(draftRaw)),
      savesCorrupt: !!(savesRaw && !parse(savesRaw)),
      prefCorrupt: !!(prefRaw && !parse(prefRaw))
    };
  }

  window.Store = {
    normalize, defaults, save, remove, rename, activate, readSaves,
    saveDraft, readDraft, clearDraft,
    loadPending, savePending, clearPending,
    solveKey, getSolve, putSolve, clearSolve,
    exportFile, parseFile, toHash, fromHash,
    getPref, setPref, diagnose,
    readBlocks, writeBlocks, saveBlock, renameBlock, removeBlock, getBlueprint, setBlueprint,
    BLOCK_KINDS: BLOCK_KINDS.slice(), BLOCK_LABEL: BLOCK_LABEL,
    available: hasLS,
    KEY: { saves: KEY_SAVES, draft: KEY_DRAFT, pending: KEY_PENDING, solve: KEY_SOLVE, pref: KEY_PREF, blocks: KEY_BLOCKS }
  };
})();
