/* ==========================================================================
   组合最优解求解器 · 交替坐标上升（黑盒，非严格全局最优）
   --------------------------------------------------------------------------
   需求：各系统的最优解能任意排列组合——"给定天赋页 + 技能原型，求其余系统
   的全局最优"。做法：把构筑拆成 7 个系统，每个系统有自己的单步最优求解器；
   用户锁定任意系统，框架只对未锁系统交替优化（固定其他 → 优化一个 → 收敛）。

   设计红线（与 solver.js 一致）：
   - 只通过 score(cfg)=Engine.simulate(cfg).dps 黑盒接触目标，不读引擎公式；
   - 每步用"候选生成 + 全试算取最大"，不假设凸性/梯度；
   - 结果标注为"高质量近似，非严格全局最优"。

   系统：skills / effects / affix / gems / minion / talents / runes
   用法：
     ComboSolver.solveCombo({ cfg, unlock:['skills','effects','gems'], rounds:2, duration:20 })
   兼容：浏览器 window.ComboSolver / Node vm globalThis.ComboSolver。
   ========================================================================== */
(function (root) {
  'use strict';
  const D = root.DESKRAWL_DATA || {};
  const E = root.Engine;
  const AF = root.AffixMath;
  const RD = root.RuneData;
  const MD = root.MinionData;
  const Solver = root.Solver;

  const SYSTEMS = ['skills', 'effects', 'affix', 'gems', 'minion', 'talents', 'runes'];
  const SYS_LABEL = {
    skills: '技能配置', effects: '装备特效', affix: '装备词条', gems: '宝石镶嵌',
    minion: '仆从配置', talents: '天赋页', runes: '符文页'
  };
  const clone = x => JSON.parse(JSON.stringify(x));
  const score = (cfg, duration) => {
    try { return E.simulate(cfg, { duration: duration || 20, lite: true }).dps; }
    catch (e) { return -1; }
  };

  /* ---------- 各系统单步最优（返回 { patch, dps }，patch 是 cfg 字段的增量） ---------- */

  /* 技能：枚举 basic×strong×(特殊1,特殊2) 组合，含留空；特殊不重复。
     候选数 = (B+1)(S+1)(1+P+P*(P-1)/2...) 控制在阈值内，过大则贪心。 */
  function optSkills(cfg, dur) {
    const c = D.CLASSES[cfg.classKey];
    if (!c) return null;
    const basics = [''].concat((c.basics || []).map(a => a.id));
    const strongs = [''].concat((c.strongs || []).map(a => a.id));
    const specials = (c.specials || []).map(a => a.id);
    // 特殊组合：空、单、有序对（去重），限制规模
    const spSets = [['', '']];
    specials.forEach(a => spSets.push([a, '']));
    for (let i = 0; i < specials.length; i++)
      for (let j = i + 1; j < specials.length; j++)
        spSets.push([specials[i], specials[j]]);
    let best = null;
    const combos = basics.length * strongs.length * spSets.length;
    for (const b of basics) for (const s of strongs) for (const sp of spSets) {
      const skills = { basic: b, strong: s, special1: sp[0], special2: sp[1] };
      const dps = score(Object.assign({}, cfg, { skills }), dur);
      if (!best || dps > best.dps) best = { dps, patch: { skills } };
    }
    best.combos = combos;
    return best;
  }

  /* 装备特效：从本职业可用传奇里贪心装/换（受槽位上限约束，戒指 2 件）。 */
  function optEffects(cfg, dur) {
    const pool = (D.LEGENDARIES || []).filter(L => !L.cls || L.cls.includes(cfg.classKey));
    if (!pool.length) return null;
    const capOf = L => (L.slot === '戒指' ? 2 : 1);
    const byId = {}; pool.forEach(L => { byId[L.id] = L; });
    // 规范化：去重 + 每槽不超上限
    const normalize = ids => {
      const out = [], m = {};
      ids.forEach(id => {
        const L = byId[id]; if (!L || out.indexOf(id) >= 0) return;
        if ((m[L.slot] || 0) >= capOf(L)) return;
        out.push(id); m[L.slot] = (m[L.slot] || 0) + 1;
      });
      return out;
    };
    let cur = normalize((cfg.legendaries || []).slice());
    let bestDps = score(Object.assign({}, cfg, { legendaries: cur }), dur);
    // 多轮：每个候选尝试"加入"或"替换同槽最弱的一个"（基于 trial 实时槽位统计）
    for (let round = 0; round < 2; round++) {
      let improved = false;
      for (const L of pool) {
        if (cur.indexOf(L.id) >= 0) continue;
        const trial = cur.slice();
        const m = {}; trial.forEach(id => { const x = byId[id]; if (x) m[x.slot] = (m[x.slot] || 0) + 1; });
        if ((m[L.slot] || 0) >= capOf(L)) {
          const victim = trial.find(id => byId[id] && byId[id].slot === L.slot);
          if (!victim) continue;
          trial.splice(trial.indexOf(victim), 1);
        }
        trial.push(L.id);
        const d = score(Object.assign({}, cfg, { legendaries: trial }), dur);
        if (d > bestDps + 1e-6) { cur = trial; bestDps = d; improved = true; }
      }
      if (!improved) break;
    }
    return { dps: bestDps, patch: { legendaries: cur } };
  }

  /* 装备词条（给定目标装分）：按职业/流派生成 12 部位 gearBuild 后试算。
     可选多个装分档位取最优（近似：真实词条最优属第三轮独立求解）。 */
  function optAffix(cfg, dur, targetIlvls) {
    if (!AF || !AF.buildFullGear) return null;
    const ilvls = targetIlvls && targetIlvls.length ? targetIlvls : [700, 850];
    let best = null;
    ilvls.forEach(ilvl => {
      const { gearBuild } = AF.buildFullGear(ilvl, 'legendary', cfg.classKey, cfg.element, cfg.primaryType, 1);
      const dps = score(Object.assign({}, cfg, { gearBuild }), dur);
      if (!best || dps > best.dps) best = { dps, patch: { gearBuild, targetIlvl: ilvl }, gearBuild };
    });
    return best;
  }

  /* 宝石：调用引擎 solveGems（逐孔贪心）。 */
  function optGems(cfg, dur) {
    if (!E || !E.solveGems) return null;
    try {
      const r = E.solveGems(cfg, { duration: dur });
      return { dps: r.bestDps, patch: { gems: r.gems } };
    } catch (e) { return null; }
  }

  /* 仆从：枚举仆从候选（含空），每个取最优协同被动（枚举被动）与仆从装备。
     为控规模：协同只枚举"有 DPS 价值"的 Stat 被动。 */
  function optMinion(cfg, dur) {
    const minions = [null].concat((D.MINIONS || []).map(m => m.id));
    const synergies = [null].concat((MD && MD.PASSIVES ? MD.PASSIVES.filter(p => {
      return ['all', 'physical', 'fire', 'cold', 'lightning', 'poison', 'arcane', 'cc', 'cd', 'as', 'cdr', 'basic', 'strong', 'special', 'dot', 'vs.elite', 'vs.vulnerable', 'vs.injured', 'vs.slowed'].indexOf(p.field) >= 0;
    }) : []).map(p => ({ slave: p.slave, stat: p.stat })));
    let best = null;
    for (const mid of minions) {
      const base = Object.assign({}, cfg, { minionId: mid });
      // 先试无协同
      const d0 = score(base, dur);
      if (!best || d0 > best.dps) best = { dps: d0, patch: { minionId: mid, minionSynergy: null } };
      // 有效等级 ≥10 才考虑协同
      const eff = (cfg.minionLevel != null ? cfg.minionLevel : 10) + (cfg.minionReins ? 5 : 0);
      if (mid && eff >= 10) {
        for (const syn of synergies) {
          if (!syn) continue;
          const d = score(Object.assign({}, base, { minionSynergy: syn }), dur);
          if (d > best.dps) best = { dps: d, patch: { minionId: mid, minionSynergy: syn } };
        }
      }
    }
    return best;
  }

  /* 天赋：调用 solver.js（黑盒坐标下降）。 */
  function optTalents(cfg, dur) {
    if (!Solver || !Solver.solve) return null;
    try {
      const r = Solver.solve({ cfg, duration: Math.min(dur, 16), tier: 'quick' });
      return { dps: r.dps, patch: { talents: r.talents } };
    } catch (e) { return null; }
  }

  /* 符文六槽：枚举本职业可用符文，逐槽贪心（属性 + 套装件数自动统计）。 */
  function optRunes(cfg, dur) {
    if (!RD || !RD.RUNES) return null;
    const clsBit = ({ warrior: 1, sorcerer: 2, hunter: 4, monk: 8 })[cfg.classKey] || 1;
    const pool = RD.RUNES.filter(r => r.cls === clsBit || r.cls === 15);
    if (!pool.length) return null;
    const byId = {}; RD.RUNES.forEach(r => { byId[r.id] = r; });
    const buildCfg = slots => {
      const runes = slots.filter(Boolean).map(x => ({ id: x.id, level: x.level }));
      const cnt = {};
      runes.forEach(r => { const def = byId[r.id]; if (def && def.setId) cnt[def.setId] = (cnt[def.setId] || 0) + 1; });
      const equippedSets = Object.keys(cnt).map(setId => ({ setId, count: cnt[setId] }));
      return Object.assign({}, cfg, { runes, equippedSets, setId: null, setCount: 0 });
    };
    let slots = [null, null, null, null, null, null];
    let bestDps = score(buildCfg(slots), dur);
    // 逐槽试：每个槽试所有符文（固定等级 1，控制规模），取最优；2 轮
    for (let round = 0; round < 2; round++) {
      let improved = false;
      for (let i = 0; i < 6; i++) {
        let bestForSlot = slots[i], bestD = bestDps;
        // 真源 AllowDuplicateEquip=false：同一符文不能重复装在其他槽
        const usedElsewhere = slots.filter((_, j) => j !== i && slots[j]).map(s => s.id);
        for (const r of pool) {
          if (usedElsewhere.indexOf(r.id) >= 0) continue;
          const trial = slots.slice(); trial[i] = { id: r.id, level: 1 };
          const d = score(buildCfg(trial), dur);
          if (d > bestD + 1e-6) { bestD = d; bestForSlot = trial[i]; }
        }
        // 也试留空
        const trialEmpty = slots.slice(); trialEmpty[i] = null;
        const dE = score(buildCfg(trialEmpty), dur);
        if (dE > bestD + 1e-6) { bestD = dE; bestForSlot = null; }
        if (bestD > bestDps + 1e-6) { slots[i] = bestForSlot; bestDps = bestD; improved = true; }
      }
      if (!improved) break;
    }
    return { dps: bestDps, patch: { runeSlots: slots, runes: buildCfg(slots).runes, equippedSets: buildCfg(slots).equippedSets, setId: null, setCount: 0 } };
  }

  const OPTIMIZERS = {
    skills: optSkills, effects: optEffects, affix: optAffix,
    gems: optGems, minion: optMinion, talents: optTalents, runes: optRunes
  };

  /* ---------- 主框架：交替坐标上升 ---------- */
  function solveCombo(opts) {
    opts = opts || {};
    const cfg = clone(opts.cfg || {});
    const duration = opts.duration || 20;
    const rounds = opts.rounds || 2;
    const locked = opts.locked || [];               // 锁定的系统（不优化）
    let unlock = (opts.unlock || SYSTEMS.filter(s => locked.indexOf(s) < 0)).slice();
    unlock = unlock.filter(s => SYSTEMS.indexOf(s) >= 0 && locked.indexOf(s) < 0);
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () { };
    const startDps = score(cfg, duration);
    const history = [{ step: 'start', dps: startDps }];
    let curCfg = cfg, curDps = startDps;
    let step = 0;
    const totalSteps = rounds * unlock.length;
    for (let round = 0; round < rounds; round++) {
      for (const sys of unlock) {
        step++;
        onProgress({ pct: Math.round(step / totalSteps * 100), stage: `第${round + 1}轮 · ${SYS_LABEL[sys] || sys}`, dps: curDps });
        const opt = OPTIMIZERS[sys];
        if (!opt) continue;
        // 关键：单步优化时，cfg 里已含其他系统当前值（"锁定"即不进 unlock）
        const res = opt(curCfg, duration);
        if (res && res.patch) {
          const trial = Object.assign({}, curCfg, res.patch);
          const d = score(trial, duration);
          if (d > curDps + 1e-6) { curCfg = trial; curDps = d; }
        }
        history.push({ step: step, system: sys, dps: curDps });
      }
    }
    onProgress({ pct: 100, stage: '完成', dps: curDps });
    return {
      cfg: curCfg, startDps, dps: curDps, gainPct: startDps ? (curDps / startDps - 1) * 100 : 0,
      unlock, locked, rounds, history,
      approximate: true,
      note: '交替坐标上升的近似最优解：每系统用黑盒候选试算，交替优化至收敛；非严格全局最优'
    };
  }

  root.ComboSolver = { SYSTEMS, SYS_LABEL, solveCombo, score, optimizers: OPTIMIZERS, approximate: true };
})(typeof window !== 'undefined' ? window : globalThis);
