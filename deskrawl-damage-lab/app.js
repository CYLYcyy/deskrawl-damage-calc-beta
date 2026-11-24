/* ==========================================================================
   UI 控制器
   ========================================================================== */
(function () {
  const D = window.DESKRAWL_DATA;
  const E = window.Engine;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const CLASS_UI = {
    warrior: { element: 'fire', type: 'strong', skills: ['w_val', 'w_flame', 'w_hook', 'w_molten'], set: 'w_eye', legs: ['vigor', 'draught', 'serrated', 'kabuto'] },
    sorcerer: { element: 'lightning', type: 'strong', skills: ['s_electro', 's_storm', 's_cloud', 's_elemental'], set: 's_storm', legs: ['vigor', 'stormgaunt', 'amberskull', 'charged'] },
    hunter: { element: 'physical', type: 'strong', skills: ['h_poison', 'h_rapid', 'h_flare', 'h_trap'], set: 'h_deadeye', legs: ['vigor', 'deadeye', 'wolfhunger', 'revelation'] },
    monk: { element: 'lightning', type: 'strong', skills: ['m_fist', 'm_judgment', 'm_orbs', 'm_twin'], set: 'm_hundred', legs: ['vigor', 'spiritbound', 'thirdverdict', 'focus'] }
  };

  const DEFAULT_TALENTS = {
    warrior: { cc: 5, cd: 8, str: 8, weakness: 8, charged: 1, cleaving: 6, focused: 1, warcrycd: 1, valmana: 8, press: 8, peak: 5, rageinf: 10, forge: 1 },
    sorcerer: { int: 3, conduit: 6, stormexec: 10, icemana: 8, conflag: 8, manaregen: 5, electromana: 6, stormmastery: 8, frostalac: 6, exposure: 1, reservoir: 7, manaflow: 1, static: 1 },
    hunter: { dex: 10, venomlore: 8, efficient: 1, as: 10, secondwind: 1, brutality: 8, deadlytoxin: 8, doubletap: 1, sustained: 8, rapidflare: 1, lethaltraps: 6, lone: 1, quicktraps: 2, deadlytraps: 5 },
    monk: { phys: 8, lightning: 10, lightcc: 8, heavy: 8, gathered: 1, dex: 10, mirror: 1, fundamentals: 5, palms: 8, exploit: 10, expenditure: 1 }
  };

  const state = {
    classKey: 'warrior',
    element: 'fire',
    primaryType: 'strong',
    gear: Object.assign({}, E.GEAR_PRESETS.mid),
    gearBuild: null,            // 目标装分生成的装备词条（存在时引擎优先于 gear 预设）
    skills: { basic: 'w_val', strong: 'w_flame', special1: 'w_hook', special2: 'w_molten' },
    talents: {},
    setId: 'w_eye',
    setCount: 4,
    runeSlots: [null, null, null, null, null, null],  // 6 槽逐槽自由配置 { id, level } | null
    legendaries: ['vigor', 'draught', 'serrated', 'kabuto'],
    minionId: 'raptor',
    minionLevel: 10,
    minionReins: false,
    minionGear: 'none',
    minionGearGate: true,       // 仆从装备是否遵守训练等级门槛（5级解锁）
    minionGearBuild: null,      // 仆从装备 gearBuild（由 affix.js 词条池构造）
    minionStars: 10,            // 仆从星级，10 星解锁协同被动槽
    minionSynergy: null,        // 协同被动 { slave, stat }：10星主仆从带另一个10级仆从的被动
    electroStacks: null,
    brittleStacks: 0,
    brittleZone: 'crit',
    reckoningStacks: 0,   // 清算锤叠层数（1.0.4 真源，暴击触发动态层，用户录入）
    gems: {},             // 宝石镶嵌 { [数字槽位]: [{ fam, lv }, ...] }，真源 GemData
    enemy: { hp: 2400000, baseHp: 2400000, armor: 0, mr: 0, count: 1, elite: true, distant: 5, vuln: 45, slow: 10, immob: 25, healthy: 20, injured: 20, critdr: 0, name: '区域首领 (L70)' },
    encounter: null,
    diff: 6,
    vulnUptime: 0.45,
    slot: 'weapon',
    duration: 60,
    gcd: 0.45,
    decisions: {},          // 未决项裁决：{ [itemId]: { mode, value, measured, ts } }
    _zoneMode: 'cycle',     // 伤害计算口径：'cycle' 周期 / 'single' 单跳（硬隔离）
    _cache: {}
  };

  /* ------------------------------------------------------------ persistence */
  /* 存档模块缺失时退化为空实现，保证主流程不中断 */
  const Store = window.Store || (function () {
    const norm = s => (s && typeof s === 'object' ? s : {});
    return {
      normalize: norm, defaults: () => ({}), save: () => null, remove: () => ({ list: [] }),
      rename: () => ({ list: [] }), activate: () => ({ list: [] }), readSaves: () => ({ list: [] }),
      saveDraft: () => false, readDraft: () => null, clearDraft: () => { },
      exportFile: () => { }, parseFile: () => ({ ok: false, error: '存档模块未加载' }),
      loadPending: () => ({ decisions: {}, stale: false }), savePending: () => false, clearPending: () => { },
      toHash: () => '', fromHash: () => null, available: false,
      getPref: () => null, setPref: () => false,
      diagnose: () => ({ available: false, draftCorrupt: false, savesCorrupt: false })
    };
  })();

  const PERSIST_KEYS = ['classKey', 'element', 'primaryType', 'gear', 'gearBuild', 'skills', 'talents', 'setId', 'setCount', 'runeSlots',
    'legendaries', 'minionId', 'minionLevel', 'minionReins', 'minionGear', 'minionGearGate', 'minionGearBuild', 'minionStars', 'minionSynergy',
    'electroStacks', 'brittleStacks', 'brittleZone', 'reckoningStacks', 'gems', 'enemy', 'encounter', 'diff', 'duration', 'gcd', 'preset', 'slot', 'decisions'];

  function snapshot() { return Store.normalize(state); }

  function applySnapshot(src) {
    const s = Store.normalize(src);
    PERSIST_KEYS.forEach(k => { if (s[k] !== undefined) state[k] = s[k]; });
    state._preset = s.preset || 'mid';
    state._cache = {}; state._affixCache = null; state._gearKey = null;
    state._slotBest = null; state._ringTop = null; state._gearRank = null;
    safeRun('同步控件', () => syncAllInputs());
    safeRun('职业卡片', () => renderClassCards());
    safeRun('技能槽', () => renderSlots());
    recomputeAll();
  }

  /* ------------------------------------------------------------ ui feedback */
  function toast(msg, isErr) {
    const box = $('#toast');
    if (!box) return;
    const d = document.createElement('div');
    if (isErr) d.className = 'err';
    d.textContent = msg;
    while (box.children.length >= 3) box.firstChild.remove();
    box.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 280); }, 2600);
  }

  function showError(title, err) {
    console.error('[' + title + ']', err);
    const bar = $('#errbar'), msg = $('#errbarMsg');
    if (!bar || !msg) return;
    const detail = String((err && err.message) || err || '未知错误').slice(0, 220);
    msg.innerHTML = `<b>${title}</b> · ${detail} <span style="opacity:.6">（其余面板仍可用）</span>`;
    bar.classList.add('on');
  }

  /** 单面板渲染隔离：出错只污染自己 */
  function safeRun(label, fn) {
    try { return fn(); }
    catch (e) { showError(label, e); return null; }
  }

  /** 重计算按钮的轻量 busy 反馈：先让浏览器画出禁用态，再执行耗时逻辑 */
  function withBusy(btn, label, fn) {
    if (!btn || btn.disabled) return;
    const old = btn.innerHTML;
    btn.disabled = true; btn.classList.add('busy');
    if (label) btn.textContent = label + '…';
    requestAnimationFrame(() => setTimeout(() => {
      try { if (fn) fn(); }
      finally { btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = old; }
    }, 140));
  }

  let draftTimer = null;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const ok = Store.saveDraft(snapshot(), { dps: state._result ? Math.round(state._result.dps) : 0 });
      setSaveState(ok ? 'saved' : 'local');
    }, 700);
  }

  function setSaveState(kind) {
    const el2 = $('#hdSaveState');
    if (!el2) return;
    const map = {
      saved: ['已自动保存', 'ok'],
      local: ['仅内存', 'dirty'],
      dirty: ['未保存', 'dirty'],
      named: ['已存为配置', 'ok']
    };
    const v = map[kind] || map.dirty;
    el2.textContent = v[0];
    el2.className = 'savepill ' + v[1];
    if (kind === 'saved' || kind === 'named') {
      void el2.offsetWidth;              // 强制重排，让每次保存都重新闪一下
      el2.classList.add('just');
    }
  }

  /* ------------------------------------------------------------ helpers */
  const fmt = n => {
    if (!isFinite(n)) return '—';
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return Math.round(n).toLocaleString('en-US');
  };
  const fmt2 = n => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
  const fmtInt = n => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
  const pct = n => (isFinite(n) ? (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + '%' : '—');
  const el = (tag, cls, html) => { const x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; };
  const elColor = e => (D.ELEMENTS[e] || {}).color || '#c9a24d';
  const cfgGcd = () => parseFloat($('#gGcd') ? $('#gGcd').value : 0.45) || 0.45;
  const AB = (id) => {
    const c = D.CLASSES[state.classKey];
    return [...c.basics, ...c.strongs, ...c.specials].find(a => a.id === id);
  };
  const abName = id => {
    const a = AB(id);
    if (a) return a.name;
    const map = { '荆棘': '铁荆棘', '火元素': '火焰元素', '地狱风暴': '地狱风暴' };
    return map[id] || id;
  };

  const CRESTS = {
    sword: '<path d="M20 4v20l-4 4-3-3 4-4V4z" stroke="#e8cd8a" stroke-width="1.3" fill="none"/><path d="M10 24l6 6M8 30l4 4" stroke="#c9a24d" stroke-width="1.2"/>',
    staff: '<path d="M20 6v28" stroke="#e8cd8a" stroke-width="1.3"/><circle cx="20" cy="7" r="4" stroke="#e8cd8a" stroke-width="1.2" fill="none"/><path d="M14 14h12" stroke="#c9a24d" stroke-width="1.2"/>',
    bow: '<path d="M13 5c9 5 9 25 0 30" stroke="#e8cd8a" stroke-width="1.3" fill="none"/><path d="M13 5v30" stroke="#c9a24d" stroke-width="1"/><path d="M13 20h16M29 20l-3-2M29 20l-3 2" stroke="#e8cd8a" stroke-width="1.2"/>',
    fist: '<path d="M11 22v-6a3 3 0 016 0v6M17 22V12a3 3 0 016 0v10M23 22V15a3 3 0 016 0v9c0 6-4 10-9 10s-9-4-9-10v-2" stroke="#e8cd8a" stroke-width="1.25" fill="none" stroke-linejoin="round"/>'
  };
  const crestSVG = key => `<svg viewBox="0 0 40 40" fill="none">${CRESTS[key] || CRESTS.sword}</svg>`;

  /* ------------------------------------------------------------ state init */
  function applyClass(key) {
    const c = D.CLASSES[key];
    const ui = CLASS_UI[key];
    state.classKey = key;
    state.element = ui.element;
    state.skills = { basic: ui.skills[0], strong: ui.skills[1], special1: ui.skills[2], special2: ui.skills[3] };
    state.setId = ui.set;
    state.setCount = 4;
    state.primaryType = ui.type;
    state.talents = Object.assign({}, DEFAULT_TALENTS[key]);
    state.legendaries = ui.legs.slice();
    state.gear = Object.assign({}, E.GEAR_PRESETS.mid);
    state.gearBuild = null;       // 换职业清掉目标装分词条（避免跨职业串配置）
    state.electroStacks = null;   // 静电是推算值，换职业重新推
    state._preset = 'mid';
    state.slot = 'weapon';
    state._gearQuery = '';
    state._cache = {}; state._affixCache = null; state._gearKey = null;
    state._slotBest = null; state._ringTop = null; state._gearRank = null;
  }

  /* ------------------------------------------------------------ nav */
  const RENDER_ON_ENTER = {
    gear: () => { safeRun('装备特效图标', renderLegendaryIcons); safeRun('装备页', renderGear); },
    talents: renderTalents, solver: renderSolver, minions: renderMinions,
    model: renderModel, rotation: renderRotation, agent: renderAgent,
    damage: renderDamage, compare: renderCompare, character: renderRuneSlots, builder: renderBuilder
  };

  function goto(tab) {
    const page = $('#page-' + tab);
    if (!page) return;
    $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
    $$('.page').forEach(p => p.classList.remove('on'));
    page.classList.add('on');
    state._tab = tab;
    const fn = RENDER_ON_ENTER[tab];
    if (fn) safeRun('渲染 ' + tab, fn);
    try { window.scrollTo(0, 0); } catch (e) { }
  }

  $$('#nav button').forEach(b => b.addEventListener('click', () => goto(b.dataset.tab)));

  /* 角色页子标签 */
  function bindCharTabs() {
    const tabs = $('#charTabs');
    if (!tabs) return;
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('button[data-ct]');
      if (!btn) return;
      const key = btn.dataset.ct;
      $$('#charTabs button').forEach(x => x.classList.toggle('on', x === btn));
      $$('.ctpane').forEach(p => p.classList.toggle('on', p.id === 'ct-' + key));
      if (key === 'leg') safeRun('传奇列表', renderLegendaries);
      if (key === 'enemy') safeRun('对敌折算', renderEnemyCalc);
    });
  }

  /* ------------------------------------------------------------ character panel */
  function renderClassCards() {
    const box = $('#classCards');
    box.innerHTML = '';
    Object.values(D.CLASSES).forEach(c => {
      const d = el('div', 'classcard' + (c.key === state.classKey ? ' on' : ''));
      d.innerHTML = `<div>${crestSVG(c.crest)}</div><div class="nm serif">${c.name}</div><div class="st">${c.statName}</div>`;
      d.onclick = () => {
        const enc = state.encounter;
        applyClass(c.key);
        renderClassCards();
        if (enc) applyEncounter(enc);
        else { syncAllInputs(); recomputeAll(); }
      };
      box.appendChild(d);
    });
  }

  function setVal(sel, v) {
    const n = $(sel);
    if (!n) return;
    if (n.type === 'checkbox') n.checked = !!v;
    else n.value = v;
  }

  function syncAllInputs() {
    const c = D.CLASSES[state.classKey] || {};
    const g = state.gear || {};
    txt('#gAps', ((1 + (g.as || 0) / 100) * (g.speed || 1)).toFixed(2));
    setVal('#gDps', g.dps); setVal('#gSpeed', g.speed); setVal('#gMain', g.main);
    setVal('#gCc', g.cc); setVal('#gCd', g.cd); setVal('#gAs', g.as);
    setVal('#gEle', g.ele); setVal('#gType', g.type); setVal('#gAll', g.all);
    setVal('#gElite', g.vsElite); setVal('#gVuln', g.vsVuln);
    setVal('#gMana', g.manaMax); setVal('#gRegen', g.regen); setVal('#gCost', g.costRed); setVal('#gFlat', g.flat);
    setVal('#gElement', state.element); setVal('#gTypeSel', state.primaryType);
    setVal('#gGcd', state.gcd || 0.45);
    setVal('#zElectro', state.electroStacks != null ? state.electroStacks : (state._result && state._result.electroStacks) || 0);
    setVal('#brittleStacks', state.brittleStacks || 0);
    setVal('#brittleZone', pendingVal('brittleZone') || 'crit');
    setVal('#reckoningStacks', state.reckoningStacks || 0);
    $$('#gearPreset button').forEach(b => b.classList.toggle('on', b.dataset.p === state._preset));

    const sel = $('#setSelect');
    if (sel) {
      sel.innerHTML = '';
      (c.sets || []).forEach(s => {
        const o = el('option'); o.value = s.id; o.textContent = s.name; o.selected = s.id === state.setId; sel.appendChild(o);
      });
    }
    $$('#setCount button').forEach(b => b.classList.toggle('on', +b.dataset.n === state.setCount));
    $$('#diffSeg button').forEach(b => b.classList.toggle('on', +b.dataset.m === state.diff));
    const set = (c.sets || []).find(s => s.id === state.setId);
    const sn = $('#setNote');
    if (sn) sn.innerHTML = set ? set.text.replace(/(\d):/g, '<b class="gold">$1 件</b>：') : '—';

    const es = $('#enemySelect');
    if (es) {
      es.innerHTML = '';
      const known = (D.ENEMIES || []).map(x => x.name);
      if (state.enemy.name && known.indexOf(state.enemy.name) < 0) {
        const o = el('option');
        o.value = '__scene__'; o.textContent = state.enemy.name; o.selected = true;
        es.appendChild(o);
      }
      (D.ENEMIES || []).forEach(e => {
        const o = el('option'); o.value = e.id; o.textContent = e.name;
        o.selected = e.name === state.enemy.name; es.appendChild(o);
      });
    }
    const en = state.enemy || {};
    setVal('#eHp', en.hp); setVal('#eArmor', en.armor); setVal('#eMr', en.mr);
    setVal('#eCount', en.count); setVal('#eElite', en.elite); setVal('#eDistant', en.distant);
    setVal('#eVuln', en.vuln); setVal('#eSlow', en.slow); setVal('#eImmob', en.immob);
    setVal('#eHealthy', en.healthy); setVal('#eInjured', en.injured); setVal('#eCritdr', en.critdr);

    safeRun('传奇列表', renderLegendaries);
    safeRun('技能槽', renderSlots);
    const tpEl = $('#tpCount');
    if (tpEl) tpEl.textContent = Object.values(state.talents).reduce((a, b) => a + b, 0);
    const tpc = $('#tpClass');
    if (tpc) tpc.textContent = c.name || '—';
    safeRun('场景预设', renderEncRow);
    safeRun('覆盖率依据', renderEncWhy);
  }

  function bindCharacter() {
    const map = {
      gDps: ['gear', 'dps'], gSpeed: ['gear', 'speed'], gMain: ['gear', 'main'],
      gCc: ['gear', 'cc'], gCd: ['gear', 'cd'], gAs: ['gear', 'as'], gEle: ['gear', 'ele'],
      gType: ['gear', 'type'], gAll: ['gear', 'all'], gElite: ['gear', 'vsElite'], gVuln: ['gear', 'vsVuln'],
      gMana: ['gear', 'manaMax'], gRegen: ['gear', 'regen'], gCost: ['gear', 'costRed'], gFlat: ['gear', 'flat']
    };
    const LIMIT = { gSpeed: [0.2, 4], gCc: [0, 100], gCost: [0, 85], gAs: [-50, 300], gDps: [1, 1e7] };
    Object.keys(map).forEach(id => {
      const [obj, key] = map[id];
      const node = $('#' + id);
      if (!node) return;
      node.addEventListener('input', e => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v)) v = 0;
        const lim = LIMIT[id];
        if (lim) v = Math.min(lim[1], Math.max(lim[0], v));
        else v = Math.max(0, v);
        state[obj][key] = v;
        state._cache = {};
        recomputeAll();
      });
      // 失焦时把夹紧后的值写回输入框，避免显示与计算不一致
      node.addEventListener('blur', e => {
        const v = state[obj][key];
        if (parseFloat(e.target.value) !== v) e.target.value = v;
      });
    });
    const ge = $('#gElement');
    if (ge) ge.addEventListener('change', e => { state.element = e.target.value; state._cache = {}; recomputeAll(); });
    const gts = $('#gTypeSel');
    if (gts) gts.addEventListener('change', e => { state.primaryType = e.target.value; state._cache = {}; recomputeAll(); });
    const gg = $('#gGcd');
    if (gg) gg.addEventListener('input', e => {
      const v = Math.min(2, Math.max(0.2, parseFloat(e.target.value) || 0.45));
      state.gcd = v; state._cache = {}; recomputeAll();
    });
    const ze = $('#zElectro');
    if (ze) ze.addEventListener('input', e => {
      const raw = parseInt(e.target.value, 10);
      const v = isFinite(raw) ? Math.max(0, Math.min(10, raw)) : 0;
      state.electroStacks = v; state._cache = {}; recomputeAll();
    });
    const zm = $('#zoneMode');
    if (zm) zm.addEventListener('click', e => {
      const b = e.target.closest('button[data-zm]');
      if (!b) return;
      state._zoneMode = b.dataset.zm;
      $$('#zoneMode button').forEach(x => x.classList.toggle('on', x === b));
      if (state._result) safeRun('乘区面板', () => renderZones(state._result));
    });
    const zr = $('#zElectroReset');
    if (zr) zr.onclick = () => { state.electroStacks = null; state._cache = {}; syncAllInputs(); recomputeAll(); toast('静电层数已回到自动推算'); };
    const bs = $('#brittleStacks');
    if (bs) {
      bs.addEventListener('input', e => {
        const raw = parseInt(e.target.value, 10);
        state.brittleStacks = isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
        state._cache = {}; recomputeAll();
      });
      bs.addEventListener('blur', e => {
        if (parseInt(e.target.value, 10) !== state.brittleStacks) e.target.value = state.brittleStacks;
      });
    }
    const rk = $('#reckoningStacks');
    if (rk) {
      rk.addEventListener('input', e => {
        const raw = parseInt(e.target.value, 10);
        state.reckoningStacks = isFinite(raw) ? Math.max(0, Math.min(50, raw)) : 0;
        state._cache = {}; recomputeAll();
      });
      rk.addEventListener('blur', e => {
        if (parseInt(e.target.value, 10) !== state.reckoningStacks) e.target.value = state.reckoningStacks;
      });
    }
    const bz = $('#brittleZone');
    if (bz) bz.addEventListener('change', e => {
      const v = ['crit', 'taken', 'off'].indexOf(e.target.value) >= 0 ? e.target.value : 'crit';
      state.brittleZone = v;
      // 与未决项同源：手动下拉写入裁决，pendingVal 是唯一采用值（裁决优先）
      const d = state.decisions.brittleZone || (state.decisions.brittleZone = {});
      d.ts = Date.now();
      if (v === 'crit') { d.mode = 'default'; d.value = null; d.measured = null; }
      else { d.mode = 'alt'; d.value = v; }
      persistDecisions();
      syncAllInputs();
    });
    $$('#gearPreset button').forEach(b => b.onclick = () => {
      const p = E.GEAR_PRESETS[b.dataset.p];
      if (!p) return;
      state._preset = b.dataset.p;
      state.gear = Object.assign({}, p);
      state.gearBuild = null;   // 切回预设装备时清掉目标装分覆盖
      state._cache = {}; state._gearKey = null;
      syncAllInputs(); recomputeAll();
    });
    const ss = $('#setSelect');
    if (ss) ss.addEventListener('change', e => { state.setId = e.target.value; state._cache = {}; recomputeAll(); });
    $$('#setCount button').forEach(b => b.onclick = () => {
      state.setCount = +b.dataset.n;
      $$('#setCount button').forEach(x => x.classList.toggle('on', x === b));
      const set = ((D.CLASSES[state.classKey] || {}).sets || []).find(s => s.id === state.setId);
      const sn = $('#setNote');
      if (sn) sn.innerHTML = set ? set.text.replace(/(\d):/g, '<b class="gold">$1 件</b>：') : '—';
      state._cache = {}; recomputeAll();
    });
    const es = $('#enemySelect');
    if (es) es.addEventListener('change', e => {
      const p = (D.ENEMIES || []).find(x => x.id === e.target.value);
      if (!p) return;
      state.enemy.name = p.name; state.enemy.baseHp = p.hp;
      state.enemy.hp = Math.round(p.hp * state.diff);
      state.enemy.elite = !!p.elite; state.enemy.count = p.count || 1;
      if (p.id === 'mob') { state.enemy.vuln = 30; state.enemy.healthy = 65; state.enemy.injured = 10; }
      else { state.enemy.vuln = 45; state.enemy.healthy = 20; state.enemy.injured = 20; }
      state._cache = {}; syncAllInputs(); recomputeAll();
    });
    const eb = {
      eHp: ['hp', 1, 1e9], eArmor: ['armor', 0, 1e6], eMr: ['mr', 0, 1e6], eCount: ['count', 1, 20],
      eVuln: ['vuln', 0, 100], eSlow: ['slow', 0, 100], eImmob: ['immob', 0, 100],
      eHealthy: ['healthy', 0, 100], eInjured: ['injured', 0, 100], eCritdr: ['critdr', 0, 90],
      eDistant: ['distant', 0, 100]
    };
    Object.keys(eb).forEach(id => {
      const node = $('#' + id);
      if (!node) return;
      const [key, lo, hi] = eb[id];
      node.addEventListener('input', e => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v)) v = lo;
        v = Math.min(hi, Math.max(lo, v));
        state.enemy[key] = v;
        if (key === 'vuln') state.vulnUptime = v / 100;
        state._cache = {}; recomputeAll();
      });
      node.addEventListener('blur', e => {
        if (parseFloat(e.target.value) !== state.enemy[key]) e.target.value = state.enemy[key];
      });
    });
    const ee = $('#eElite');
    if (ee) ee.addEventListener('change', e => { state.enemy.elite = e.target.checked; state._cache = {}; recomputeAll(); });
    $$('#diffSeg button').forEach(b => b.onclick = () => {
      state.diff = +b.dataset.m;
      $$('#diffSeg button').forEach(x => x.classList.toggle('on', x === b));
      state.enemy.hp = Math.round(state.enemy.baseHp * state.diff);
      setVal('#eHp', state.enemy.hp);
      state._cache = {}; recomputeAll();
    });
  }

  const CONF_LABEL = { official: '官方数值', modeled: '需覆盖率折算', none: '无被动' };
  const CONF_COLOR = { official: '#7ba05b', modeled: '#c9a24d', none: '#6b6255' };

  function renderLegendaries() {
    const box = $('#legList');
    if (!box) return;
    const q = String(state._legQuery || '').trim().toLowerCase();
    const f = state._legFilter || 'all';
    const avail = (D.LEGENDARIES || []).filter(L => !L.cls || L.cls.includes(state.classKey));
    const list = avail.filter(L => {
      if (f === 'on' && state.legendaries.indexOf(L.id) < 0) return false;
      if (f === 'official' && L.conf !== 'official') return false;
      if (f === 'modeled' && L.conf !== 'modeled') return false;
      if (q) {
        const hay = (L.name + ' ' + L.slot + ' ' + (L.text || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    const cnt = $('#legCount');
    if (cnt) cnt.textContent = `${list.length} / ${avail.length} 件 · 已选 ${state.legendaries.length}`;
    box.innerHTML = '';
    if (!list.length) {
      box.appendChild(el('div', 'empty', q ? `没有匹配「${q}」的传奇` : '该筛选下没有条目'));
      return;
    }
    list.forEach(L => {
      const on = state.legendaries.indexOf(L.id) >= 0;
      const row = el('label', 'legrow' + (on ? ' on' : ''));
      row.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''}>
        <span class="lb">
          <span class="ln">${L.name}<em>${L.slot}${L.lvl > 1 ? ' · Lv' + L.lvl : ''}</em>
          <span class="lc ${L.conf || 'none'}">${CONF_LABEL[L.conf] || ''}</span></span>
          <span class="ld">${L.text}</span>
        </span>`;
      row.querySelector('input').onchange = e => {
        if (e.target.checked) {
          const cap = L.slot === '戒指' ? 2 : 1;
          const same = state.legendaries.filter(id => {
            const x = (D.LEGENDARIES || []).find(y => y.id === id);
            return x && x.slot === L.slot;
          });
          if (same.length >= cap) state.legendaries = state.legendaries.filter(id => id !== same[0]);
          state.legendaries.push(L.id);
        } else {
          state.legendaries = state.legendaries.filter(x => x !== L.id);
        }
        state._cache = {}; state._gearKey = null; state._affixCache = null;
        renderLegendaries(); recomputeAll();
      };
      box.appendChild(row);
    });
  }

  /* 装备页：按部位排序的传奇特效图标网格（点击装备/卸下，戒指可 2 件） */
  const LEG_SLOT_ORDER = ['武器', '头盔', '肩甲', '胸甲', '手套', '腰带', '护腿', '靴子', '项链', '戒指', '披风', '仆从装备'];
  function renderLegendaryIcons() {
    const grid = $('#legIconGrid');
    if (!grid) return;
    const avail = (D.LEGENDARIES || []).filter(L => !L.cls || L.cls.includes(state.classKey));
    const bySlot = {};
    avail.forEach(L => { (bySlot[L.slot] || (bySlot[L.slot] = [])).push(L); });
    const slots = LEG_SLOT_ORDER.filter(s => bySlot[s] && bySlot[s].length);
    Object.keys(bySlot).forEach(s => { if (slots.indexOf(s) < 0) slots.push(s); });
    grid.innerHTML = '';
    slots.forEach(slot => {
      const row = el('div', 'lslot-row');
      const name = el('div', 'lslot-name'); name.textContent = slot;
      const icons = el('div', 'lslot-icons');
      bySlot[slot].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh')).forEach((L, idx) => {
        const on = state.legendaries.indexOf(L.id) >= 0;
        const ic = el('div', 'lgi c-' + (L.conf || 'none') + (on ? ' on' : ''));
        ic.title = L.name + (L.lvl > 1 ? ' · Lv' + L.lvl : '') + '\n' + (L.text || '') + '\n' + (CONF_LABEL[L.conf] || '');
        ic.innerHTML = `<div class="lgib"></div><span class="lgidx">${idx + 1}</span>`;
        ic.onclick = () => {
          const cap = L.slot === '戒指' ? 2 : 1;
          if (state.legendaries.indexOf(L.id) >= 0) {
            state.legendaries = state.legendaries.filter(x => x !== L.id);
          } else {
            const same = state.legendaries.filter(id => {
              const x = (D.LEGENDARIES || []).find(y => y.id === id);
              return x && x.slot === L.slot;
            });
            if (same.length >= cap) state.legendaries = state.legendaries.filter(id => id !== same[0]);
            state.legendaries.push(L.id);
          }
          state._cache = {}; state._gearKey = null; state._affixCache = null;
          safeRun('装备特效', renderLegendaryIcons); recomputeAll();
        };
        icons.appendChild(ic);
      });
      row.appendChild(name); row.appendChild(icons); grid.appendChild(row);
    });
    const cnt = $('#legIconCount');
    if (cnt) cnt.textContent = `按部位排列 · 已装 ${state.legendaries.length} 件 · 戒指可带 2 件`;
  }

  function bindLegTools() {
    const q = $('#legSearch');
    if (q) {
      let t = null;
      q.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { state._legQuery = e.target.value; safeRun('传奇列表', renderLegendaries); }, 140);
      });
    }
    const f = $('#legFilter');
    if (f) f.addEventListener('click', e => {
      const b = e.target.closest('button[data-lf]');
      if (!b) return;
      state._legFilter = b.dataset.lf;
      $$('#legFilter button').forEach(x => x.classList.toggle('on', x === b));
      safeRun('传奇列表', renderLegendaries);
    });
  }

  function renderSlots() {
    const c = D.CLASSES[state.classKey];
    $('#slotBox').innerHTML = '';
    const mk = (label, key, list, filter) => {
      const f = el('div', 'field');
      f.innerHTML = `<label>${label}</label>`;
      const sel = el('select');
      // "不装备"选项：为提高周期伤害可主动留空（如冰法只带冰普攻）
      const none = el('option'); none.value = ''; none.selected = !state.skills[key];
      none.textContent = '— 不装备 —';
      sel.appendChild(none);
      list.filter(filter || (() => true)).forEach(a => {
        const o = el('option'); o.value = a.id; o.selected = state.skills[key] === a.id;
        o.textContent = `${a.name}${a.mana ? ' · ' + a.mana + ' 法力' : ''}${a.cd ? ' · ' + a.cd + 's' : ''}`;
        sel.appendChild(o);
      });
      sel.onchange = e => { state.skills[key] = e.target.value; state._cache = {}; recomputeAll(); };
      f.appendChild(sel);
      $('#slotBox').appendChild(f);
    };
    // 基础攻击与强力攻击各自可留空；两个特殊槽双向互斥且都可留空
    mk('基础攻击', 'basic', c.basics);
    mk('强力攻击', 'strong', c.strongs);
    mk('特殊技能 1', 'special1', c.specials, a => a.id !== state.skills.special2);
    mk('特殊技能 2', 'special2', c.specials, a => a.id !== state.skills.special1);
  }

  /* ------------------------------------------------------------ 符文六槽 */
  const RUNE_CLS = { warrior: 1, sorcerer: 2, hunter: 4, monk: 8 };
  const RUNE_TYPE_LABEL = { common: '蓝', rare: '金', legendary: '大金', grand: '大金', set: '套装' };
  function renderRuneSlots() {
    const box = $('#runeSlotsBox');
    if (!box) return;
    const RD = window.RuneData;
    box.innerHTML = '';
    if (!RD || !RD.RUNES) { box.innerHTML = '<div class="empty">符文数据未加载</div>'; return; }
    const clsBit = RUNE_CLS[state.classKey] || 1;
    const pool = RD.RUNES.filter(r => (r.cls === clsBit || r.cls === 15));
    const byId = {}; RD.RUNES.forEach(r => { byId[r.id] = r; });
    const slots = state.runeSlots || [];
    for (let i = 0; i < 6; i++) {
      const cur = slots[i];
      const row = el('div', 'field');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
      const lab = el('label'); lab.style.cssText = 'width:52px;flex:none'; lab.textContent = '槽 ' + (i + 1);
      const sel = el('select'); sel.style.flex = '1';
      const none = el('option'); none.value = ''; none.textContent = '— 空槽 —'; sel.appendChild(none);
      // 按类型分组：蓝/金/大金/套装
      const groups = {};
      pool.forEach(r => {
        const g = r.type || 'other';
        (groups[g] || (groups[g] = [])).push(r);
      });
      Object.keys(groups).forEach(g => {
        const og = el('optgroup'); og.label = RUNE_TYPE_LABEL[g] || g;
        groups[g].forEach(r => {
          const o = el('option'); o.value = r.id;
          o.textContent = r.name + (r.setId ? '（套）' : '');
          og.appendChild(o);
        });
        sel.appendChild(og);
      });
      sel.value = cur && cur.id ? cur.id : '';
      const lvSel = el('select'); lvSel.style.cssText = 'width:64px;flex:none';
      for (let L = 1; L <= 6; L++) {
        const o = el('option'); o.value = L; o.textContent = 'L' + L; lvSel.appendChild(o);
      }
      lvSel.value = cur ? (cur.level || 1) : 1;
      lvSel.disabled = !cur || !cur.id;
      const onChange = () => {
        const id = sel.value;
        state.runeSlots[i] = id ? { id, level: parseInt(lvSel.value, 10) || 1 } : null;
        lvSel.disabled = !id;
        state._cache = {}; recomputeAll();
        safeRun('符文六槽', renderRuneSlots);
      };
      sel.onchange = onChange;
      lvSel.onchange = onChange;
      row.appendChild(lab); row.appendChild(sel); row.appendChild(lvSel);
      box.appendChild(row);
    }
    // 摘要：套装件数
    const cnt = {};
    slots.forEach(s => { if (s && s.id && byId[s.id] && byId[s.id].setId) { const k = byId[s.id].setId; cnt[k] = (cnt[k] || 0) + 1; } });
    const sum = $('#runeSlotsSummary');
    if (sum) {
      const parts = Object.keys(cnt).map(k => {
        const set = (RD.SETS || []).find(x => x.id === k);
        const n = cnt[k];
        const active = [2, 4, 6].filter(t => n >= t).join('/');
        return `${set ? set.name : k} ×${n}${active ? '（触发 ' + active + ' 件）' : ''}`;
      });
      sum.innerHTML = parts.length ? '已装符文套装：' + parts.join('；') : '尚未配置符文六槽（使用下方简化模式）。';
    }
  }

  /* ------------------------------------------------------------ enemy calc */
  function renderEnemyCalc() {
    const box = $('#enemyCalc');
    if (!box) return;
    const r = state._result;
    if (!r) { box.innerHTML = '<div class="empty">暂无计算结果</div>'; return; }
    const agg = r.agg || {};
    const vs = agg.vs || {};
    const e = state.enemy || {};
    const ST = (D.MECHANICS && D.MECHANICS.status) || {};
    const vulnTake = (ST.vulnerable && ST.vulnerable.taken) || 30;
    const perStack = pendingVal('electroCoef');
    const vuln = (e.vuln || 0) / 100;
    const elec = (r.electroStacks || 0) * perStack / 100;
    const taken = 1 + (vulnTake / 100) * vuln + (state.element === 'lightning' ? elec : 0);

    let vsm = 1;
    const parts = [];
    if (e.elite && vs.elite) { vsm += vs.elite / 100; parts.push(`精英 +${vs.elite.toFixed(0)}%`); }
    if (vs.vulnerable) { const v = vs.vulnerable / 100 * vuln; vsm += v; parts.push(`易伤 +${(v * 100).toFixed(1)}%`); }
    if (vs.healthy) { const v = vs.healthy / 100 * (e.healthy || 0) / 100; if (v > 0.0005) { vsm += v; parts.push(`健康 +${(v * 100).toFixed(1)}%`); } }
    if (vs.injured) { const v = vs.injured / 100 * (e.injured || 0) / 100; if (v > 0.0005) { vsm += v; parts.push(`受伤 +${(v * 100).toFixed(1)}%`); } }
    if (vs.slowed) { const v = vs.slowed / 100 * (e.slow || 0) / 100; if (v > 0.0005) { vsm += v; parts.push(`减速 +${(v * 100).toFixed(1)}%`); } }
    if (vs.immobilized) { const v = vs.immobilized / 100 * (e.immob || 0) / 100; if (v > 0.0005) { vsm += v; parts.push(`定身 +${(v * 100).toFixed(1)}%`); } }
    const dpct = (e.distant || 0) / 100;
    if (dpct > 0 && vs.distant) { const v = vs.distant / 100 * dpct; vsm += v; parts.push(`远处 +${(v * 100).toFixed(1)}%`); }

    const ttk = r.dps > 0 ? (e.hp || 0) / r.dps : Infinity;
    const mit = 1 - (r.dps > 0 ? 0 : 0);
    box.innerHTML = `
      <div class="field"><label>受伤乘区（易伤${state.element === 'lightning' ? ' + 静电' : ''}）</label><span class="num gold">×${taken.toFixed(3)}</span></div>
      <div class="field"><label>条件伤乘区</label><span class="num">×${vsm.toFixed(3)}</span></div>
      <div class="field"><label>两项合计</label><span class="num gold">×${(taken * vsm).toFixed(3)}</span></div>
      <div class="field"><label>有效生命</label><span class="num">${fmt(e.hp)}</span></div>
      <div class="field"><label>稳态击杀</label><span class="num">${isFinite(ttk) ? ttk.toFixed(1) + 's' : '—'}</span></div>
      <div class="dhint" style="margin-top:10px">${parts.length ? '条件项：' + parts.join(' · ') : '当前构筑没有吃条件伤的词条，这套敌人模型只影响易伤与减伤。'}</div>`;
  }

  /* ------------------------------------------------------------ encounter presets */
  function currentRange() {
    return (D.CLASS_RANGE || {})[state.classKey] || 'melee';
  }

  function renderEncRow() {
    const box = $('#encRow');
    const list = D.ENCOUNTERS || [];
    if (!box || !list.length) return;
    if (box.children.length !== list.length) {
      box.innerHTML = '';
      list.forEach(e => {
        const b = el('button', 'encbtn');
        b.dataset.enc = e.id;
        b.innerHTML = `<b>${e.name}</b><span>${e.tag}</span>`;
        b.onclick = () => applyEncounter(e.id);
        box.appendChild(b);
      });
    }
    Array.from(box.children).forEach(b => b.classList.toggle('on', b.dataset.enc === state.encounter));
  }

  function applyEncounter(id, silent) {
    const e = (D.ENCOUNTERS || []).find(x => x.id === id);
    if (!e) return;
    const range = currentRange();
    const v = e[range] || e.melee;
    state.encounter = id;
    state.diff = e.diff;
    state.enemy.baseHp = e.hp;
    state.enemy.hp = Math.round(e.hp * e.diff);
    state.enemy.elite = !!e.elite;
    state.enemy.count = e.count;
    state.enemy.name = e.name;
    state.enemy.distant = v.distant;
    state.enemy.healthy = v.healthy;
    state.enemy.injured = v.injured;
    state.enemy.vuln = v.vuln;
    state.enemy.slow = v.slow;
    state.enemy.immob = v.immob;
    state.vulnUptime = v.vuln / 100;
    state._cache = {}; state._gearKey = null; state._affixCache = null;
    safeRun('同步控件', syncAllInputs);
    recomputeAll();
    if (!silent) toast(`已套用「${e.name}」· ${range === 'ranged' ? '远程' : '近战'}口径`);
  }

  function renderEncWhy() {
    const e = (D.ENCOUNTERS || []).find(x => x.id === state.encounter);
    const map = { distant: '#whyDistant', healthy: '#whyHealthy', injured: '#whyInjured', vuln: '#whyVuln', slow: '#whySlow', immob: '#whyImmob' };
    Object.keys(map).forEach(k => {
      const n = $(map[k]);
      if (n) n.textContent = e && e.why ? (e.why[k] || '') : '';
    });
    const note = $('#encNote');
    if (note) {
      if (!e) {
        note.innerHTML = '选一个场景，下面六个覆盖率会自动填好，并在每个输入框下方写明依据。这些都是<b>时间占比</b>，只用于周期期望与秒伤。';
      } else {
        const range = currentRange();
        note.innerHTML = `<b class="gold">${e.name}</b> · 按${range === 'ranged' ? '远程' : '近战'}职业口径填。${e.note || ''}`;
      }
    }
  }

  /* ------------------------------------------------------------ 未决项 / 口径（一期） */
  const AF = window.AffixMath || null;
  const RD = window.RuneData || null;

  /* 首批未决项。默认值为「未裁决前的临时占位」，不是权威；
     静电×易伤按 team 校准取「加算」（引擎默认），另一口径为相乘。 */
  const PENDING = [
    { id: 'takenMode', title: '静电 × 易伤：相乘还是加算', def: 'additive', defLabel: '加算（引擎默认）',
      alts: [{ v: 'multiplicative', label: '相乘（敏感性对照）' }],
      evidence: '易伤固定 ×1.3，静电每层 +10%（1.0.4 真源实锤，只加闪电）。加算 = 1 + 30%×覆盖 + 10%×层数；相乘 = (1+30%×覆盖)×(1+10%×层数)。静电=DamageAmplificationBehavior、易伤=VulnerableBehavior，是两种不同 Behavior，真源无合并证据，故保留加算默认、相乘作敏感性对照。验证：同一技能木桩做 2×2 打桩，记录「都不开/只易伤/只静电/都开」跳字，看比值贴合哪种。' },
    { id: 'minionPassive', title: '仆从被动是否进面板', def: 'off', defLabel: '不重复计入',
      alts: [{ v: 'on', label: '进面板' }],
      evidence: '同一套装备，带仆从 / 不带仆从各看一次面板主属性：面板变了就是进面板，没变就是不进。带 +5 缰绳再测一次。本项当前只记录裁决，仆从机制修正属二期。' },
    { id: 'cdrCap', title: '冷却缩减上限：80% 还是 85%', def: 80, defLabel: '80%（真源实证）', unit: '%',
      alts: [{ v: 85, label: '85%（旧文档描述，已弃用）' }],
      evidence: '真源已确认：CDR 上限 = 80%（1.0.2b 更新说明「冷却缩减上限从 85% 降至 80%」+ 反汇编 StatCap.GetCap 逐字节实证，1.0.3 跨版本复核一致；暴击/闪避/蓝耗仍 85%）。无需实测，保留本项仅为查阅旧口径。' },
    { id: 'electroCoef', title: '静电系数：每层 10%', def: 10, defLabel: '10%/层（1.0.4 真源实锤）', unit: '%/层',
      alts: [{ v: 5, label: '5%/层（旧推断值，已弃用）' }, { v: 6.6, label: '6.6%（旧仓库值，已弃用）' }],
      evidence: '1.0.4 真源实锤：StaticElectricity = DamageAmplificationBehavior，AmplificationPercent.Base=0.10 → 每层 10%；MaxStacks=10、FilterByDamageType=true、AffectedDamageType=3(仅闪电)。旧 5%/6.6% 均为推断值，已弃用。木桩 0 层与 N 层各打同一技能可反推每层增伤 ≈(R_N/R_0−1)/N 验证。' },
    { id: 'sweepPct', title: '横扫倍率：97 / 100 / 75', def: 97, defLabel: '97%（1.0.4 真源）', unit: '%',
      alts: [{ v: 100, label: '100%' }, { v: 75, label: '75%（旧版）' }],
      evidence: '1.0.4 真源：WarriorBasicAttack2 Base=0.7/PerLevel=0.03 → 10 级 97%。100% 为四舍五入记录、75% 为旧版本值。保留候选仅作对照。' },
    { id: 'stormPct', title: '闪电风暴倍率：217%', def: 217, defLabel: '217%（1.0.4 真源）', unit: '%',
      alts: [{ v: 225, label: '225%（旧版 L11 口径，已弃用）' }],
      evidence: '1.0.4 真源：SorcererStrongAttack3 Base=1.5/PerLevel=0.075 → 10 级 217%（≈用户实测 218% 同源四舍五入）。旧 225% 已弃用。' },
    { id: 'brittleZone', title: '脆裂归属：暴击区 / 受伤区 / 不启用', def: 'crit', defLabel: '暴击区（1.0.4 真源：进暴伤池）',
      alts: [{ v: 'taken', label: '受伤区（与易伤同通道）' }, { v: 'off', label: '不启用' }],
      evidence: '1.0.4 真源实锤：脆裂状态本身 Behaviors:[] 无伤害；+5%/层来自传奇戒指 LegendaryRing8CritDamage 的 ConditionalCritDamage，进暴伤池 1+cc×(cd+0.05×层数)。引擎已按此口径，默认暴击区。taken/off 为对照口径（仅当装备不同机制来源时）。' }
  ];
  const PENDING_BY_ID = {};
  PENDING.forEach(p => { PENDING_BY_ID[p.id] = p; });

  const clampInt = (v, min, max, d) => { const n = parseInt(v, 10); return isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
  const finiteNum = v => (typeof v === 'number' && isFinite(v));
  const allAbilities = () => {
    const c = D.CLASSES[state.classKey] || {};
    return [...(c.basics || []), ...(c.strongs || []), ...(c.specials || [])];
  };
  const AFFIX_OPTS = AF ? Object.keys(AF.STAT_NAMES)
    .map(k => ({ id: +k, name: AF.STAT_NAMES[k] }))
    .filter(x => AF.PER_LEVEL[x.id] != null)
    .sort((a, b) => a.id - b.id) : [];

  /** 当前采用值：用户实测 > 另一口径 > 系统默认 */
  function pendingVal(id) {
    const spec = PENDING_BY_ID[id];
    if (!spec) return undefined;
    const d = state.decisions[id];
    let v = spec.def;
    if (d && d.mode === 'alt' && d.value != null && d.value !== '') v = d.value;
    if (d && d.mode === 'measured' && d.measured && d.measured.value != null && d.measured.value !== '') v = d.measured.value;
    if (spec.unit && typeof v === 'string') { const n = parseFloat(v); if (isFinite(n)) v = n; }
    if (id === 'takenMode') {
      // 实测比值是证据；真正进入计算的口径取实测表单里勾选的「你的实测支持」
      const mv = (d && d.mode === 'measured' && d.measured && d.measured.verdict) || v;
      return (mv === 'multiplicative' || mv === 'additive') ? mv : spec.def;
    }
    return v;
  }
  const altLabel = (spec, v) => {
    const a = (spec.alts || []).find(x => String(x.v) === String(v));
    return a ? a.label : String(v) + (spec.unit || '');
  };
  function pendingMeta(id) {
    const spec = PENDING_BY_ID[id];
    const d = state.decisions[id] || {};
    const v = pendingVal(id);
    if (d.mode === 'measured' && d.measured) return { label: '你的实测：' + v + (spec.unit || ''), source: 'me', src: '你实测（第一手）' };
    if (d.mode === 'alt') return { label: altLabel(spec, v), source: 'alt', src: '你的选择' };
    return { label: spec.defLabel, source: 'default', src: '系统默认（未裁决）' };
  }
  const pendingUnresolved = () => PENDING.filter(p => {
    const d = state.decisions[p.id];
    return !d || d.mode === 'default';
  }).length;

  /* 用户裁决进入引擎：静电×易伤走 takenMode；技能倍率走 skillLevels 反解等级 */
  const findAbAnywhere = id => {
    for (const k in D.CLASSES) {
      const c = D.CLASSES[k] || {};
      const a = [...(c.basics || []), ...(c.strongs || []), ...(c.specials || [])].find(x => x.id === id);
      if (a) return a;
    }
    return null;
  };

  function buildSkillLevels() {
    const out = {};
    [['s_storm', 225, 7.5, 'stormPct'], ['w_cleave', 97, 2.5, 'sweepPct']].forEach(([id, fb, fbPer, key]) => {
      const v = Number(pendingVal(key));
      const ab = findAbAnywhere(id);
      const base = ab && ab.pct != null ? ab.pct : fb;   // 以 data.js 当前值为准，避免与数据组改动冲突
      const per = ab && ab.perLevel ? ab.perLevel : fbPer;
      if (isFinite(v) && per && Math.abs(v - base) > 1e-6) out[id] = 10 + (v - base) / per;
    });
    return out;
  }

  function updateScopeBadge() {
    const single = state._zoneMode === 'single';
    const b = $('#hdScope');
    if (b) { b.textContent = single ? '单跳瞬时' : '周期期望'; b.classList.toggle('single', single); }
    txt('#hdScopeHint', single ? '假设命中瞬间条件全开 · 不摊覆盖率' : '按场景时间占比加权');
    const n = pendingUnresolved();
    txt('#hdPendingCount', n);
    const pb = $('#btnPending');
    if (pb) pb.classList.toggle('hot', n > 0);
  }

  /* ------------------------------------------------------------ config for engine */
  function cfg() {
    // 符文六槽 -> cfg.runes（单件属性/技能等级）+ cfg.equippedSets（套装件数自动统计）
    const runeSlots = state.runeSlots || [];
    const runes = runeSlots.filter(Boolean).map(x => ({ id: x.id, level: x.level }));
    const equippedSets = [];
    if (runes.length && window.RuneData && window.RuneData.RUNES) {
      const byId = {}; window.RuneData.RUNES.forEach(r => { byId[r.id] = r; });
      const cnt = {};
      runes.forEach(r => { const def = byId[r.id]; if (def && def.setId) cnt[def.setId] = (cnt[def.setId] || 0) + 1; });
      Object.keys(cnt).forEach(setId => equippedSets.push({ setId, count: cnt[setId] }));
    }
    // 用了逐槽符文时，职业套装位（旧 setId/setCount）置空，避免两套套装叠加双计
    const useSlots = runes.length > 0;
    return {
      classKey: state.classKey,
      element: state.element,
      primaryType: state.primaryType,
      gear: state.gear,
      gearBuild: state.gearBuild || null,
      skills: state.skills,
      talents: state.talents,
      runes,
      equippedSets,
      setId: useSlots ? null : state.setId,
      setCount: useSlots ? 0 : state.setCount,
      legendaries: state.legendaries,
      minionId: state.minionId,
      minionReins: state.minionReins,
      minionGear: state.minionGear,
      minionStars: state.minionStars,
      minionSynergy: state.minionSynergy,
      // 仆从装备（真源 5 级解锁）：关闭门槛开关时按达标等级计入
      minionLevel: (state.minionGearBuild && state.minionGearGate === false &&
        state.minionLevel < D.MECHANICS.minion.gearStar)
        ? D.MECHANICS.minion.gearStar : state.minionLevel,
      minionGearBuild: (state.minionGearBuild &&
        (state.minionGearGate === false || state.minionLevel >= D.MECHANICS.minion.gearStar))
        ? state.minionGearBuild : null,
      electroStacks: state.electroStacks,
      brittleStacks: state.brittleStacks || 0,
      brittleZone: pendingVal('brittleZone') || 'crit',
      reckoningStacks: state.reckoningStacks || 0,
      gems: state.gems || {},
      enemy: {
        hp: state.enemy.hp, armor: state.enemy.armor, mr: state.enemy.mr, count: state.enemy.count,
        elite: state.enemy.elite, distant: (state.enemy.distant || 0) / 100,
        healthyUptime: (state.enemy.healthy || 0) / 100, injuredUptime: (state.enemy.injured || 0) / 100,
        slowedUptime: (state.enemy.slow || 0) / 100, immobilizedUptime: (state.enemy.immob || 0) / 100,
        critDR: state.enemy.critdr / 100
      },
      vulnUptime: state.enemy.vuln / 100,
      gcd: cfgGcd(),
      // 未决项裁决进入计算：takenMode 与技能倍率立即生效；CDR/静电系数随引擎支持自动生效
      takenMode: pendingVal('takenMode') === 'multiplicative' ? 'multiplicative' : undefined,
      skillLevels: buildSkillLevels(),
      decisions: state.decisions,
      cdrCap: pendingVal('cdrCap'),
      electroPerStack: pendingVal('electroCoef')
    };
  }

  /* ------------------------------------------------------------ recompute */
  const onPage = t => { const p = $('#page-' + t); return !!(p && p.classList.contains('on')); };
  const txt = (sel, v) => {
    const n = $(sel);
    if (n == null || n.textContent === String(v)) return;
    n.textContent = v;
    if (String(v) === '—') {
      if (!n.title) n.title = '尚未计算或该项不适用：完成一次模拟后再看';
      if (n.matches('.metric .v, .dpsrow .v')) {
        let why = n.nextElementSibling;
        if (!why || !why.classList.contains('dashwhy')) { why = el('span', 'dashwhy', '未计算 / 不适用'); n.after(why); }
      }
    } else {
      const why = n.nextElementSibling;
      if (why && why.classList.contains('dashwhy')) why.remove();
    }
  };

  function updateChrome(r) {
    const c = D.CLASSES[state.classKey] || {};
    txt('#hdCls', c.name || '—');
    txt('#hdDps', r ? fmt(r.dps) : '—');
    updateScopeBadge();
    txt('#pcCls', c.name || '—');
    const set = ((c.sets) || []).find(x => x.id === state.setId);
    txt('#pcSet', set ? set.name : '无');
    txt('#pcLeg', state.legendaries.length + ' 件');
    if (!r) return;
    txt('#phCycle', (r.cycle || 0).toFixed(1) + 's');
    const perMin = (r.casts || 0) / Math.max(1, state.duration) * 60;
    txt('#phCast', perMin.toFixed(1));
    if (r.manaSpent != null && r.manaGained != null) {
      const ratio = r.manaGained > 0 ? r.manaSpent / r.manaGained : 0;
      txt('#phMana', ratio ? ratio.toFixed(2) + '×' : '—');
    }
  }

  function recomputeAll() {
    state._affixCache = null;
    state._gearKey = null;
    let r = null;
    try {
      const c = cfg();
      r = E.simulate(c, { duration: state.duration });
      state._result = r;
      state._cfg = c;
    } catch (e) {
      state._result = null;
      showError('计算失败', e);
      updateChrome(null);
      return;
    }
    state._errors = [];
    safeRun('总览', () => renderOverview(r));
    updateChrome(r);
    if (onPage('rotation')) safeRun('技能轴', renderRotation);
    if (onPage('damage')) safeRun('伤害计算页', renderDamage);
    if (onPage('talents')) safeRun('天赋页', renderTalents);
    if (onPage('gear')) { safeRun('装备特效图标', renderLegendaryIcons); safeRun('装备页', renderGear); }
    if (onPage('minions')) safeRun('仆从详情', renderMinionPanel);
    if (onPage('character')) { safeRun('符文六槽', renderRuneSlots); safeRun('对敌折算', renderEnemyCalc); }
    const ze = $('#zElectro');
    if (ze && state.electroStacks == null) ze.value = r.electroStacks;
    scheduleDraft();
  }

  /* ------------------------------------------------------------ overview */
  function renderOverview(r) {
    const c = D.CLASSES[state.classKey];
    $('#ovCrest').innerHTML = crestSVG(c.crest);
    $('#ovClass').textContent = c.name;
    $('#ovTag').textContent = c.tagline;
    $('#ovDps').textContent = fmt(r.dps);
    $('#ovDpsPct').textContent = '×' + (r.dpsPct / 100).toFixed(1);
    $('#ovCyclePct').textContent = '×' + (r.perCyclePct / 100).toFixed(1);
    $('#ovCycle').textContent = r.cycle.toFixed(1) + 's';
    const steadyTtk = r.dps > 0 ? state.enemy.hp / r.dps : Infinity;
    $('#ovTtk').textContent = isFinite(steadyTtk) ? steadyTtk.toFixed(1) + 's' : '—';
    $('#enemyNote').innerHTML = `有效生命 <b class="gold">${fmt(state.enemy.hp)}</b> = 基础 ${fmt(state.enemy.baseHp)} × 难度 ${state.diff}${state.enemy.elite ? ' · 已按精英 ×3 计入预设' : ''}。普通怪默认 0 护甲 / 0 魔抗，Boss 若有减伤请在下方补。`;
    txt('#hdVer', D.VERSION.game);
    txt('#hdDate', D.VERSION.dataDate);

    const agg = r.agg;
    $('#mWd').textContent = Math.round(agg.weaponDamage);
    $('#mAttr').textContent = (1 + (agg.str + agg.dex + agg.int) / 100).toFixed(2) + '×';
    $('#mCrit').textContent = (1 + (agg.cc / 100) * (agg.cd / 100) * (1 - (agg.critDR || 0))).toFixed(2) + '×';
    $('#mDot').textContent = r.total ? ((r.dotDmg / r.total) * 100).toFixed(1) + '%' : '—';
    const strongAb = AB(state.skills.strong) || {};
    const basicAb = AB(state.skills.basic) || {};
    let cost = (strongAb.mana || 0) * (1 - (agg.costRed || 0) / 100);
    const gen = (basicAb.mana || 0) + (agg.genFlat || 0);
    $('#mMana').textContent = gen ? Math.max(0, cost / gen).toFixed(1) + ' 基础/次' : '—';

    const hits = E.perHitTable(cfg()) || [];
    const best = hits.length ? hits.reduce((a, b) => (b.dmg > a.dmg ? b : a), hits[0]) : null;
    const mb = $('#mBest');
    if (mb) { mb.textContent = best ? '×' + (best.pct / 100).toFixed(1) : '—'; mb.title = best ? best.name : ''; }

    renderComposition(r);
    renderOverviewAffix();
    renderDiagnosis(r);
    drawDpsChart(r);
    renderBuildSummary(r);
  }

  function renderComposition(r) {
    const entries = Object.entries(r.breakdown).filter(([k, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg);
    const total = entries.reduce((a, b) => a + b[1].dmg, 0) || 1;
    const bar = $('#compBar'); bar.innerHTML = '';
    const list = $('#compList'); list.innerHTML = '';
    const palette = ['#c9a24d', '#b7433a', '#5f8fc4', '#6d9b6f', '#a97bd4', '#d9834a', '#8a8f9c', '#7fa6d4'];
    entries.slice(0, 8).forEach(([k, v], i) => {
      const p = (v.dmg / total) * 100;
      const col = palette[i % palette.length];
      const seg = el('div'); seg.style.width = p + '%'; seg.style.background = col; seg.title = abName(k) + ' ' + p.toFixed(1) + '%';
      bar.appendChild(seg);
      const row = el('div', 'comprow');
      row.innerHTML = `<div class="nm"><i style="display:inline-block;width:7px;height:7px;background:${col}"></i>${abName(k)}<span class="tag">${v.casts} 次</span></div>
        <div class="bar"><i style="width:${p}%;background:${col}"></i></div>
        <div class="pc num">${p.toFixed(1)}%</div>`;
      list.appendChild(row);
    });
    if (!entries.length) list.innerHTML = '<div class="dim">无伤害数据</div>';
  }

  function renderDiagnosis(r) {
    const entries = Object.entries(r.breakdown).filter(([k, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg);
    const total = entries.reduce((a, b) => a + b[1].dmg, 0) || 1;
    const top = entries[0];
    const tips = [];
    if (top) {
      const share = (top[1].dmg / total) * 100;
      if (share > 70) tips.push(`<b class="gold">${abName(top[0])}</b> 占总伤害 <b>${share.toFixed(0)}%</b>，属于单技能主导构筑。单体 Boss 没问题，但遇到高抗性或强制位移会明显失速；建议保留一个不依赖该元素的副输出技能。`);
      else tips.push(`伤害分散在 ${entries.length} 个来源，<b class="gold">${abName(top[0])}</b> 占 ${share.toFixed(0)}%，结构较健康。`);
    }
    if (r.cycle < 0.8) tips.push(`强力技能实际循环 <b>${r.cycle.toFixed(2)}s</b>，已顶到公共施放间隔（${(cfgGcd()).toFixed(2)}s）。此时再堆攻速/回蓝几乎零收益，应该转向<b>提高单发质量</b>：主属性、元素伤、暴击、类型伤与条件伤。`);
    else if (r.avgMana < 0.35) tips.push(`平均法力仅 <b>${(r.avgMana * 100).toFixed(0)}%</b>，处于法力饥饿：优先补减耗、最大法力与基础回蓝，而不是暴击。`);
    else if (r.cycle > 3.2) tips.push(`强力技能循环 <b>${r.cycle.toFixed(2)}s</b> 偏长，说明回蓝跟不上。优先补减耗 / 最大法力，或把基础攻击换成回蓝更高的技能。`);
    else tips.push(`强力技能循环 <b>${r.cycle.toFixed(2)}s</b>，处于健康区间；继续堆攻速只会让基础攻击占比上升。`);
    const tp = Object.values(state.talents).reduce((a, b) => a + b, 0);
    if (tp < 70) tips.push(`天赋仅投入 <b>${tp}/70</b> 点，还有 ${70 - tp} 点未分配，通常还能再拿 20%–60% 输出。`);
    if (state.setCount < 6) tips.push(`符文套装 <b>${state.setCount}/6</b> 件，6 件效果往往是整套构筑的核心机制，优先补齐。`);
    const aff = state._affixCache ? state._affixCache.slice(0, 3).map(x => x.name + ' +' + x.delta.toFixed(1) + '%').join('、') : '—';
    tips.push(`当前单位词条收益最高：<b class="gold">${aff}</b>。条件伤词条（对精英/对易伤）只在对应目标模型下生效，刷图与打 Boss 需要分开配装。`);
    const steady = r.dps > 0 ? state.enemy.hp / r.dps : Infinity;
    const hpk = isFinite(steady) ? `按稳态秒伤估算击杀约 <b>${steady.toFixed(1)}s</b>` : '当前模型下无法击杀';
    tips.push(`${hpk}（有效生命 ${fmt(state.enemy.hp)}）。`);
    $('#diagnosis').innerHTML = tips.map((t, i) => `<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px dashed rgba(43,35,24,.6)"><span class="num dim" style="flex:0 0 22px">${String(i + 1).padStart(2, '0')}</span><span style="font-size:12px;color:#cfc6b4;line-height:1.75">${t}</span></div>`).join('');
  }

  function drawDpsChart(r) {
    const cv = $('#dpsChart');
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = 190;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const tl = r.timeline;
    let raw = tl.map((v, i) => i === 0 ? v : v - tl[i - 1]);
    raw = raw.slice(1);
    const vals = raw.map((v, i) => {
      const a = raw.slice(Math.max(0, i - 1), i + 2);
      return a.reduce((x, y) => x + y, 0) / a.length;
    });
    if (!vals.length) return;
    const max = Math.max(...vals, 1);
    const padL = 46, padB = 22, padT = 10, padR = 8;
    const iw = w - padL - padR, ih = h - padT - padB;
    // grid
    ctx.strokeStyle = 'rgba(201,162,77,.10)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + ih * i / 3;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = '#655c4e'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(fmt(max * (1 - i / 3)), padL - 6, y + 3);
    }
    const bw = iw / vals.length;
    vals.forEach((v, i) => {
      const bh = (v / max) * ih;
      const x = padL + i * bw, y = padT + ih - bh;
      const g = ctx.createLinearGradient(0, y, 0, padT + ih);
      g.addColorStop(0, 'rgba(232,205,138,.95)');
      g.addColorStop(1, 'rgba(183,67,58,.55)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 1, y, Math.max(1.5, bw - 2), bh);
    });
    // 稳态均值参考线
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const yA = padT + ih - (avg / max) * ih;
    ctx.save();
    ctx.strokeStyle = 'rgba(10,8,6,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(padL, yA); ctx.lineTo(w - padR, yA); ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(232,205,138,.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, yA); ctx.lineTo(w - padR, yA); ctx.stroke();
    ctx.restore();
    // 均值放到坐标轴下方，避免压住柱体与纵轴刻度
    ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#655c4e';
    ctx.fillText('1s', padL, h - 6);
    ctx.textAlign = 'right'; ctx.fillText((vals.length + 1) + 's', w - padR, h - 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,205,138,.9)';
    ctx.fillText('虚线＝稳态均值 ' + fmt(avg), padL + iw / 2, h - 6);
  }

  function renderOverviewAffix() {
    const box = $('#ovAffix');
    if (!state._affixCache) {
      const res = E.rankAffixes(cfg());
      state._affixCache = res.list;
    }
    const list = state._affixCache.slice(0, 6);
    box.innerHTML = '';
    list.forEach((a, i) => {
      const row = el('div', 'affrow');
      const mx = Math.max(...list.map(x => x.delta), 0.001);
      row.innerHTML = `<div class="nm"><span class="dim num" style="margin-right:6px">${String(i + 1).padStart(2, '0')}</span>${a.name}</div>
        <div class="tr"><i style="width:${Math.max(3, (a.delta / mx) * 100)}%"></i></div>
        <div class="pc num">+${a.delta.toFixed(1)}%</div>`;
      box.appendChild(row);
    });
    if (!list.length) box.innerHTML = '<div class="dim">—</div>';
  }

  function renderBuildSummary(r) {
    const c = D.CLASSES[state.classKey];
    const set = (c.sets || []).find(s => s.id === state.setId);
    $('#ovSetName').textContent = (set ? set.name : '无套装') + ' · ' + state.setCount + ' 件';
    const tp = Object.values(state.talents).reduce((a, b) => a + b, 0);
    const min = D.MINIONS.find(m => m.id === state.minionId);
    const rows = [
      ['技能轴', [state.skills.basic, state.skills.strong, state.skills.special1, state.skills.special2].map(id => abName(id)).filter(Boolean).join(' → ') || '（全部留空）'],
      ['符文', `${set ? set.name : '—'} ${state.setCount} 件`],
      ['天赋', `${tp} / 70 点`],
      ['仆从', min ? min.name : '—'],
      ['传奇', state.legendaries.length ? state.legendaries.map(id => (D.LEGENDARIES.find(l => l.id === id) || {}).name).filter(Boolean).join('、') : '—'],
      ['敌人', `${state.enemy.name} · ${fmt(state.enemy.hp)} 生命${state.enemy.elite ? ' · 精英' : ''}`]
    ];
    const box = $('#ovBuild'); box.innerHTML = '';
    rows.forEach(([k, v]) => {
      const d = el('div', 'field');
      d.innerHTML = `<label style="flex:0 0 48px">${k}</label><div style="flex:1;text-align:right;font-size:11.5px;color:#cfc6b4;line-height:1.5">${v}</div>`;
      box.appendChild(d);
    });
    const note = el('div', 'note');
    note.style.marginTop = '10px';
    note.innerHTML = `周期内共 <b class="gold">${r.casts}</b> 次强力攻击，平均每 <b class="gold">${r.cycle.toFixed(2)}s</b> 一次；周期倍率按此折算。`;
    box.appendChild(note);
  }

  /* ------------------------------------------------------------ rotation */
  function renderRotation() {
    const r = state._result || E.simulate(cfg(), { duration: state.duration });
    if (!r || !r.breakdown) return;
    const wd = Math.max(1, (r.agg && r.agg.weaponDamage) || 1);
    const rows = Object.entries(r.breakdown).filter(([k, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg);
    const total = rows.reduce((a, b) => a + b[1].dmg, 0) || 1;
    let html = `<table><thead><tr><th>技能</th><th class="r">施放</th><th class="r">命中</th><th class="r">单跳期望</th><th class="r">总伤害</th><th class="r">占比</th></tr></thead><tbody>`;
    rows.forEach(([id, v]) => {
      const ab = AB(id);
      const per = v.hits ? v.dmg / v.hits : v.dmg;
      const perPct = per / wd;
      html += `<tr><td>${abName(id)}${ab ? `<span class="tag ${ab.type === 'basic' ? 'b' : ab.type === 'strong' ? 's' : 'sp'}">${ab.type === 'basic' ? '基础' : ab.type === 'strong' ? '强力' : '特殊'}</span>` : ''}</td>
        <td class="r num">${v.casts}</td><td class="r num">${v.hits}</td>
        <td class="r num gold">×${perPct.toFixed(1)}</td>
        <td class="r num">${fmt(v.dmg)}</td><td class="r num muted">${((v.dmg / total) * 100).toFixed(1)}%</td></tr>`;
    });
    html += '</tbody></table>';
    const rt = $('#rotTable');
    if (rt) rt.innerHTML = html;

    drawCastTimeline(r);
    drawMana(r);
    renderZones(r);
  }

  /* ------------------------------------------------------------ 乘区验算 */
  function renderZones(r, opt) {
    opt = opt || {};
    const box = $(opt.box || '#zoneTable');
    if (!box) return;
    const single = opt.mode ? opt.mode === 'single' : state._zoneMode === 'single';
    let z = opt.zones || (r && r.zones);
    if (single && !opt.zones) {
      try {
        const rr = E.simulate(cfg(), { duration: 1, lite: true, singleHit: true });
        z = rr.zones;
      } catch (e) { showError('单跳试算失败', e); }
    }
    if (!z || !z.zones || !z.zones.length) {
      box.innerHTML = '<div class="note">当前技能没有直接伤害倍率（纯 buff / 召唤类）。换一个带倍率的技能再看。</div>';
      return;
    }
    let acc = z.zones[0].value;
    let html = '<div class="ztable">';
    z.zones.forEach((x, i) => {
      if (x.id !== 'base') acc *= x.mult;
      html += `<div class="zrow${x.id === 'taken' ? ' hi' : ''}">
        <span class="zn">${x.name}<em>${x.note}</em></span>
        <span class="zx num">${x.id === 'base' ? '×1' : '×' + x.mult.toFixed(3)}</span>
        <span class="zv num">${fmt2(acc)}</span></div>`;
    });
    html += `<div class="zrow sum"><span class="zn">${single ? '单跳（条件全开）' : '单跳期望（按覆盖率）'}（×${z.hits} 段）</span><span class="zx num">—</span><span class="zv num gold">${fmt2(z.total)}</span></div>`;
    html += '</div>';
    box.innerHTML = html;

    const diff = Math.abs(acc * z.hits - z.total) / Math.max(1, z.total);
    const hint = $(opt.hint || '#zoneHint');
    if (hint) hint.textContent = `${single ? '单跳' : '周期'} ${fmt2(z.total)} · 连乘误差 ${(diff * 100).toFixed(4)}%`;

    const note = $(opt.note || '#zoneNote');
    if (note) note.innerHTML = single
      ? `<div style="margin-bottom:6px;color:#e8cd8a">单跳口径</div>
         <div class="dim" style="font-size:10.5px;line-height:1.7">
           假设这一发命中时：目标带易伤、处于健康/受伤段、被减速与定身、且在远处，全部条件按 <b>100%</b> 计。
           这是<b>上限参照</b>，不是平均。实战请按目标此刻的真实状态取 0 或 1。
         </div>`
      : `<div style="margin-bottom:6px">周期期望口径（来源：wikily 逐步表）</div>
         <div class="dim" style="font-size:10.5px;line-height:1.7">
           基础 → 技能倍率 → 主属性 → <b>元素+全伤（加算）</b> → 暴击期望 → 条件伤 → 类型伤 → 技能专属 → 目标受伤 → 减伤。
           <br>条件伤按「对敌模型」里的时间占比折算，所以同一套装备换个场景，数字会变。
           <br>易伤是目标<b>受到伤害</b>通道的固定 30%，与「对易伤目标 +X%」的条件伤不是同一件事。
           <br>静电只加闪电，每层 ${pendingVal('electroCoef')}%（1.0.4 真源），上限 ${(D.MECHANICS.status.electrostatic || {}).max || 10} 层；静电 × 易伤按「${pendingMeta('takenMode').label}」计。
         </div>`;
  }

  function drawMana(r) {
    const cv = $('#manaChart');
    if (!cv) return;
    const hint = $('#manaHint');
    if (hint) {
      const per = r.casts ? (r.manaSpent / r.casts) : 0;
      hint.textContent = `0 – ${Math.round(r.duration)} 秒 · 每发强攻耗蓝 ${per.toFixed(1)} · 收支 ${Math.round(r.manaGained)} / ${Math.round(r.manaSpent)}`;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 900, h = 150;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
    const vals = r.manaTimeline || [];
    if (!vals.length) return;
    const max = Math.max(...vals, r.agg.manaMax, 1);
    const padL = 44, padR = 10, padT = 10, padB = 18;
    const iw = w - padL - padR, ih = h - padT - padB;
    ctx.strokeStyle = 'rgba(201,162,77,.10)';
    for (let i = 0; i <= 2; i++) {
      const y = padT + ih * i / 2;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = '#655c4e'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(max * (1 - i / 2)), padL - 6, y + 3);
    }
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = padL + (i / Math.max(1, vals.length - 1)) * iw;
      const y = padT + ih - (v / max) * ih;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#5f8fc4'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.lineTo(padL + iw, padT + ih); ctx.lineTo(padL, padT + ih); ctx.closePath();
    ctx.fillStyle = 'rgba(95,143,196,.12)'; ctx.fill();
    ctx.fillStyle = '#655c4e'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('0s', padL, h - 5);
    ctx.textAlign = 'right'; ctx.fillText(vals.length + 's', w - padR, h - 5);
  }

  function drawCastTimeline(r) {
    const cv = $('#castChart');
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 900, h = 190;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
    const events = (r.events || []).filter(e => e.t <= 30);
    if (!events.length) return;
    const ids = Array.from(new Set(events.map(e => e.id)));
    const padL = 96, padR = 12, top = 14, rowH = Math.min(34, (h - 40) / Math.max(1, ids.length));
    const span = Math.min(30, r.duration);
    const x = t => padL + (t / span) * (w - padL - padR);
    // axis
    ctx.strokeStyle = 'rgba(201,162,77,.14)';
    for (let s2 = 0; s2 <= span; s2 += 5) {
      ctx.beginPath(); ctx.moveTo(x(s2), top - 4); ctx.lineTo(x(s2), top + rowH * ids.length); ctx.stroke();
      ctx.fillStyle = '#655c4e'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(s2 + 's', x(s2), top + rowH * ids.length + 12);
    }
    ids.forEach((id, i) => {
      const y = top + i * rowH;
      const ab = AB(id);
      const col = elColor(ab ? ab.ele : 'physical');
      ctx.fillStyle = '#8f8474'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(abName(id).slice(0, 9), padL - 10, y + 11);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.beginPath(); ctx.moveTo(padL, y + 6); ctx.lineTo(w - padR, y + 6); ctx.stroke();
      events.filter(e => e.id === id).forEach(e => {
        ctx.fillStyle = e.kind === 'strong' ? col : e.kind === 'basic' ? col + '77' : col + 'cc';
        const bw = e.kind === 'strong' ? 3 : e.kind === 'basic' ? 1.5 : 2;
        ctx.fillRect(x(e.t) - bw / 2, y + 2, bw, 9);
      });
    });
    ctx.textAlign = 'left'; ctx.fillStyle = '#655c4e'; ctx.font = '9px sans-serif';
    ctx.fillText('前 30 秒施放节奏 · 粗线＝强力攻击，中线＝特殊技能，细线＝基础攻击', padL, h - 4);
  }

  /* ------------------------------------------------------------ gear */
  /* 12 格：武器/头盔/肩甲/胸甲/手套/腰带/护腿/靴子/项链/戒指×2/披风
     护腿·肩甲·披风 为黑雾基底，可在工坊重铸任意词条（引擎 FLEX_SLOTS） */
  const SLOTS = [
    ['weapon', '武器'], ['helm', '头盔'], ['shoulder', '肩甲'], ['chest', '胸甲'],
    ['gloves', '手套'], ['belt', '腰带'], ['pants', '护腿'], ['boots', '靴子'],
    ['neck', '项链'], ['ring', '戒指 ①'], ['ring', '戒指 ②'], ['back', '披风']
  ];

  /* 宝石镶嵌面板（真源 GemData）：按数字槽位渲染孔位选择器 + 贡献汇总 */
  function renderGems() {
    const G = D.GEMS;
    const host = $('#gemSlots');
    if (!host || !G) return;
    host.innerHTML = '';
    // 有孔槽位（按数字序），映射回中文名
    const slotNames = { 1:'武器', 2:'头盔', 3:'胸甲', 4:'护腿', 7:'戒指', 8:'项链' };
    const famKeys = Object.keys(G.FAMILIES);
    const gemList = state.gems || (state.gems = {});
    Object.keys(slotNames).map(Number).sort((a,b)=>a-b).forEach(slot => {
      const cap = G.SLOT_CAP[slot] || 0;
      const type = G.SLOT_TYPE[slot];
      const typeLabel = type === 'weapon' ? '元素伤' : (type === 'armor' ? '主属性/防御' : '元素减伤');
      const card = el('div', 'panel');
      card.style.cssText = 'padding:10px;background:var(--panel2)';
      let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:var(--gold2);font-size:12.5px">${slotNames[slot]}</span>
        <span style="font-size:10px;color:var(--dim)">${cap} 孔 · ${typeLabel}</span></div>`;
      const arr = Array.isArray(gemList[slot]) ? gemList[slot] : [];
      for (let i = 0; i < cap; i++) {
        const g = arr[i] || null;
        const famSel = famKeys.map(fk => `<option value="${fk}" ${g && g.fam===fk?'selected':''}>${G.FAMILIES[fk].name}</option>`).join('');
        const lvSel = G.GRADES.map((gr,gi) => `<option value="${gi+1}" ${g && g.lv===(gi+1)?'selected':''}>${gr.lv} · ${gr.prefix}${gr.shape}</option>`).join('');
        h += `<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
          <span style="font-size:10px;color:var(--dim);width:22px">孔${i+1}</span>
          <select class="gem-fam" data-slot="${slot}" data-idx="${i}" style="flex:1;max-width:110px">${g?'':'<option value="">— 空 —</option>'}${famSel}</select>
          <select class="gem-lv" data-slot="${slot}" data-idx="${i}" style="flex:1">${g?lvSel:'<option value="">—</option>'}</select>
          <button class="gem-clr" data-slot="${slot}" data-idx="${i}" title="取下宝石" aria-label="取下${slotNames[slot]}第 ${i + 1} 孔宝石" style="padding:2px 7px">×</button>
        </div>`;
      }
      card.innerHTML = h;
      host.appendChild(card);
    });

    // 事件接线（每次重渲染重新绑定）
    host.querySelectorAll('.gem-fam').forEach(sel => sel.addEventListener('change', e => {
      setGem(+e.target.dataset.slot, +e.target.dataset.idx, e.target.value || null);
    }));
    host.querySelectorAll('.gem-lv').forEach(sel => sel.addEventListener('change', e => {
      setGem(+e.target.dataset.slot, +e.target.dataset.idx, null, +e.target.value);
    }));
    host.querySelectorAll('.gem-clr').forEach(btn => btn.onclick = () => {
      setGem(+btn.dataset.slot, +btn.dataset.idx, null, null, true);
    });
    renderGemSummary();
  }

  function setGem(slot, idx, fam, lv, clear) {
    const G = D.GEMS;
    const cap = G.SLOT_CAP[slot] || 0;
    const arr = Array.isArray(state.gems[slot]) ? state.gems[slot].slice() : [];
    if (clear || !fam) { arr[idx] = null; }
    else {
      const cur = arr[idx] || { fam, lv: 7 };
      arr[idx] = { fam, lv: isFinite(lv) && lv >= 1 ? lv : (cur.lv || 7) };
    }
    // 压缩前导空洞但保留位置（孔位有序）
    while (arr.length > cap) arr.pop();
    state.gems[slot] = arr;
    state._cache = {}; state._gearKey = null;
    // recomputeAll 会在 gear 页触发 renderGear → renderGems（含汇总），避免双重渲染与读到旧 agg
    recomputeAll();
    if (!onPage('gear')) { renderGems(); }
  }

  function renderGemSummary() {
    const G = D.GEMS, host = $('#gemSummary');
    if (!host || !G) return;
    const agg = (state._result && state._result.agg) || {};
    const eleParts = [], statParts = [], drParts = [];
    const gemDR = agg.gemDR || {};
    for (const slot in (state.gems || {})) {
      const type = G.SLOT_TYPE[slot];
      (state.gems[slot] || []).forEach(g => {
        if (!g) return;
        const f = G.FAMILIES[g.fam]; if (!f) return;
        if (type === 'weapon') {
          const pct = G.GRADES[g.lv - 1].weapon * 100;
          eleParts.push(`${f.name} ${pct}%`);
        } else if (type === 'armor') {
          const a = f.armor, v = a.values[g.lv - 1];
          statParts.push(`${G.name(g.fam, g.lv)} → ${a.name} ${v > 1 ? v : (v * 100).toFixed(0) + '%'}`);
        }
      });
    }
    for (const k in gemDR) if (gemDR[k]) drParts.push(`${k.replace('DR','')}减伤 ${gemDR[k].toFixed(0)}%`);
    host.innerHTML = `<div class="note" style="line-height:1.9">
      <div><b class="gold">元素伤（进 DPS）</b>：${eleParts.length ? eleParts.join(' + ') : '<span class="dim">未镶嵌武器宝石</span>'}</div>
      <div><b class="gold">护甲槽（进属性）</b>：${statParts.length ? statParts.join(' · ') : '<span class="dim">未镶嵌护甲宝石</span>'}</div>
      <div><b>减伤（生存向，不进 DPS）</b>：${drParts.length ? drParts.join(' · ') : '<span class="dim">—</span>'}</div>
    </div>`;
  }

  /* 一键最优镶嵌：调用引擎逐孔试算 DPS，选家族+品级；结果写入 state 并刷新。
     饰品槽减伤不进 DPS，求解器保持其为空，用户可手动补。 */
  function bindGemSolve() {
    const btn = $('#gemSolve');
    if (!btn || typeof E.solveGems !== 'function') return;
    btn.onclick = () => {
      const hint = $('#gemSolveHint');
      if (hint) hint.textContent = '试算中…';
      // 让浏览器先绘制 hint，再做同步求解（约 0.2–0.5 秒）
      setTimeout(() => {
        try {
          const res = E.solveGems(cfg(), { maxGrade: 7, duration: 20, slots: [1, 3, 4, 7, 8] });
          // 只写有 DPS 增益的槽；清理旧宝石后写入最优
          state.gems = {};
          for (const s in res.gems) if (res.gems[s] && res.gems[s].some(Boolean)) state.gems[s] = res.gems[s];
          state._cache = {}; state._gearKey = null;
          recomputeAll();
          if (hint) hint.innerHTML = `已优化 <b class="gold">+${res.pct.toFixed(1)}%</b>（${Math.round(res.baseDps).toLocaleString()} → ${Math.round(res.bestDps).toLocaleString()}）`;
        } catch (e) {
          if (hint) hint.textContent = '求解失败';
          showError('宝石求解', e);
        }
      }, 30);
    };
  }

  function renderGear() {
    safeRun('装备数值面板', renderAffixLab);
    safeRun('宝石镶嵌', renderGems);
    const tabs = $('#slotTabs');
    if (tabs) {
      tabs.innerHTML = '';
      const seen = {};
      SLOTS.forEach(([k, n]) => {
        if (seen[k]) return; seen[k] = 1;
        const label = k === 'ring' ? '戒指' : n;
        const b = el('button', 'subtab' + (state.slot === k ? ' on' : ''), label);
        b.onclick = () => { state.slot = k; safeRun('装备页', renderGear); };
        tabs.appendChild(b);
      });
    }
    const slotName = (SLOTS.find(s => s[0] === state.slot) || [])[1] || '—';
    txt('#phSlot', slotName);

    const key = state.classKey + state.slot + state.element + state.primaryType + JSON.stringify(state.gear)
      + JSON.stringify(state.talents) + state.setId + state.setCount + state.legendaries.join();
    if (state._gearKey !== key) {
      try {
        const base = E.simulate(cfg(), { duration: 40, lite: true });
        const res = E.rankAffixes(Object.assign(cfg(), { slot: state.slot }), { duration: 40, lite: false });
        state._gearRank = res.list;
        state._gearBase = base;
        const perSlot = {};
        const uniq = [...new Set(SLOTS.map(s => s[0]))];
        uniq.forEach(sl => {
          if (sl === 'back') return;   // 披风纯外观，不参与词条
          const rr = E.rankAffixes(Object.assign(cfg(), { slot: sl }), { duration: 40, lite: true });
          perSlot[sl] = rr.list[0];
          if (sl === 'ring') state._ringTop = rr.list.slice(0, 2);
        });
        state._slotBest = perSlot;
        state._gearKey = key;
      } catch (e) {
        showError('词条试算失败', e);
        state._gearRank = [];
      }
    }

    const list = (state._gearRank || []).slice(0, 12);
    const max = Math.max(...list.map(x => x.delta), 0.01);
    if ($('#affixRank')) {
      let html = '<div style="display:grid;gap:2px">';
      if (!list.length) html += '<div class="empty">没有可计算的词条</div>';
      list.forEach((a, i) => {
        html += `<div class="affrow"><div class="nm"><span class="dim num" style="margin-right:6px">${String(i + 1).padStart(2, '0')}</span>${a.name}</div>
          <div class="tr"><i style="width:${Math.max(3, (a.delta / max) * 100)}%"></i></div>
          <div class="pc num">+${a.delta.toFixed(2)}%</div></div>`;
      });
      html += '</div>';
      $('#affixRank').innerHTML = html;
    }
    txt('#phBestAffix', list[0] ? list[0].name + ' +' + list[0].delta.toFixed(2) + '%' : '—');
    txt('#gearHint', '点击上方部位切换 · 每次只加一条 ilvl700 传奇中值词条');

    const agg = (state._gearBase || (state._result || {})).agg || {};
    if ($('#gearSummary')) {
      const vs = agg.vs || {};
      $('#gearSummary').innerHTML = `
        <div class="field"><label>主属性倍率</label><span class="num gold">${(1 + ((agg.str || 0) + (agg.dex || 0) + (agg.int || 0)) / 100).toFixed(2)}×</span></div>
        <div class="field"><label>元素乘区</label><span class="num">${(1 + ((agg[state.element] || 0) + (agg.all || 0)) / 100).toFixed(2)}×</span></div>
        <div class="field"><label>类型乘区</label><span class="num">${(1 + (agg[state.primaryType] || 0) / 100).toFixed(2)}×</span></div>
        <div class="field"><label>暴击期望</label><span class="num">${(1 + (agg.cc || 0) / 100 * (agg.cd || 0) / 100 * (1 - (agg.critDR || 0))).toFixed(2)}×</span></div>
        <div class="field"><label>对易伤</label><span class="num">${(1 + (vs.vulnerable || 0) / 100).toFixed(2)}×</span></div>
        <div class="note" style="margin-top:10px">当前最欠的乘区决定下一条词条的价值。若某项已超过 3×，同数值的边际收益会明显下降。</div>`;
    }

    // 12 格
    const grid = $('#slotGrid');
    if (!grid) return;
    grid.innerHTML = '';
    let ringIdx = 0;
    SLOTS.forEach(([sl, n]) => {
      if (sl === 'back') {
        const d = el('div', 'slotcard');
        d.innerHTML = `<div class="s">披风</div><div class="a dim">纯外观</div><div class="v">无属性</div>`;
        grid.appendChild(d);
        return;
      }
      let best;
      if (sl === 'ring') {
        best = (state._ringTop || [])[ringIdx] || (state._slotBest || {}).ring;
        ringIdx += 1;
      } else best = (state._slotBest || {})[sl];
      const flex = E.FLEX_SLOTS.includes(sl);
      const d = el('div', 'slotcard' + (flex ? ' flex' : ''));
      d.innerHTML = `<div class="s">${n}${flex ? '<em>黑雾</em>' : ''}</div><div class="a">${best ? best.name : '—'}</div><div class="v num">${best ? '+' + best.delta.toFixed(2) + '%' : ''}</div>`;
      grid.appendChild(d);
    });
  }

  /* ------------------------------------------------------------ 伤害计算（一期） */
  function setZoneMode(mode) {
    if (mode !== 'cycle' && mode !== 'single') return;
    state._zoneMode = mode;
    $$('#dmScope button').forEach(x => x.classList.toggle('on', x.dataset.dm === mode));
    updateScopeBadge();
    if (onPage('damage')) safeRun('伤害计算页', renderDamage);
  }

  function bindDamage() {
    const seg = $('#dmScope');
    if (seg) seg.addEventListener('click', e => {
      const b = e.target.closest('button[data-dm]');
      if (b) setZoneMode(b.dataset.dm);
    });
    const enc = $('#dmEnc');
    if (enc) {
      const opts = [['', '沿用当前敌人'], ...(D.ENCOUNTERS || []).map(x => [x.id, x.name])];
      opts.forEach(([v, n]) => { const o = el('option', null, n); o.value = v; enc.appendChild(o); });
      enc.addEventListener('change', e => { if (e.target.value) safeRun('场景预设', () => applyEncounter(e.target.value, true)); });
    }
    const dur = $('#dmDur');
    if (dur) dur.addEventListener('change', e => {
      state.duration = clampInt(e.target.value, 20, 180, state.duration);
      e.target.value = state.duration;
      recomputeAll();
    });
    const sk = $('#dmSkill');
    if (sk) {
      allAbilities().forEach(a => { const o = el('option', null, a.name); o.value = a.id; sk.appendChild(o); });
      sk.addEventListener('change', () => safeRun('单跳结果', renderDamageSingle));
    }
    const ie = $('#dmElectro');
    if (ie) ie.addEventListener('input', e => {
      const n = parseInt(e.target.value, 10);
      state._singleStacks = isFinite(n) ? Math.max(0, Math.min(10, n)) : null;
      safeRun('单跳结果', renderDamageSingle);
    });
    const auto = $('#dmElectroAuto');
    if (auto) auto.onclick = () => {
      state._singleStacks = null;
      const i = $('#dmElectro'); if (i) i.value = '';
      toast('静电层数回到自动推算');
      safeRun('单跳结果', renderDamageSingle);
    };
  }

  function renderDamage() {
    const single = state._zoneMode === 'single';
    $$('#dmScope button').forEach(x => x.classList.toggle('on', x.dataset.dm === state._zoneMode));
    const pc = $('#dmPaneCycle'), ps = $('#dmPaneSingle');
    if (pc) pc.style.display = single ? 'none' : '';
    if (ps) ps.style.display = single ? '' : 'none';
    txt('#dmRedline', single
      ? '单跳口径：只看这一发，假设命中瞬间所有可达状态成立。不要用群怪 AOE 的这一发去比单体 Boss；这里不显示任何每秒平均数字。'
      : '周期期望：按场景时间占比加权，得到长期平均每秒伤害。结果里不出现单跳瞬时数字。');
    txt('#dmInputTitle', single ? '单跳条件' : '周期条件');
    txt('#dmInputHint', single ? '手动选技能与这一发的静电层数' : '沿用角色页的敌人与场景');
    txt('#dmBadge', single ? '瞬时状态 · 不摊覆盖率' : '按场景时间占比加权');
    const c = D.CLASSES[state.classKey] || {};
    txt('#dmBuild', (c.name || '—') + ' · ' + (state.gear.name || '自定义装备'));
    const enc = $('#dmEnc'); if (enc && document.activeElement !== enc) enc.value = state.encounter || '';
    const dur = $('#dmDur'); if (dur && document.activeElement !== dur) dur.value = state.duration;
    const sk = $('#dmSkill'); if (sk && !sk.value) sk.value = (allAbilities()[0] || {}).id || '';
    const ie = $('#dmElectro'); if (ie && document.activeElement !== ie) ie.value = state._singleStacks == null ? '' : state._singleStacks;
    const tm = pendingMeta('takenMode'), badge = $('#dmTaken');
    if (badge) { badge.textContent = tm.label; badge.className = 'badge ' + (tm.source === 'default' ? 'warn' : tm.source === 'me' ? 'me' : 'good'); }
    if (single) renderDamageSingle(); else renderDamageCycle();
    renderDamagePerHit();
  }

  const fieldHtml = rows => rows.map(([k, v]) => `<div class="field"><label>${k}</label><span class="num">${v}</span></div>`).join('');

  function renderDamageCycle() {
    const r = state._result;
    if (!r) { txt('#dmBig', '—'); return; }
    txt('#dmBig', fmt(r.dps)); txt('#dmUnit', '/秒');
    txt('#dmBigLabel', '对当前敌人模型 · 长期平均');
    const box = $('#dmMeta');
    if (box) box.innerHTML = fieldHtml([
      ['总伤', fmt(r.total)], ['击杀时间', finiteNum(r.killTime) ? r.killTime.toFixed(1) + 's' : '—'],
      ['技能轴周期', (r.cycle || 0).toFixed(1) + 's'], ['施法次数', fmtInt(r.casts)],
      ['静电层数', (r.electroStacks || 0) + ' 层']
    ]);
    renderZones(r, { box: '#dmZoneTable', hint: '#dmZoneHint', note: '#dmNote', mode: 'cycle' });
  }

  function renderDamageSingle() {
    const c = cfg();
    const skillId = ($('#dmSkill') || {}).value || (allAbilities()[0] || {}).id;
    const ab = allAbilities().find(a => a.id === skillId) || allAbilities()[0];
    if (!ab) return;
    const raw = state._singleStacks;
    const sc = JSON.parse(JSON.stringify(c));
    sc.vulnUptime = 1;
    sc.enemy = Object.assign({}, sc.enemy, {
      elite: true, distant: 1, healthyUptime: 1, injuredUptime: 1, slowedUptime: 1, immobilizedUptime: 1
    });
    if (raw != null) sc.electroStacks = raw;
    let agg;
    try { agg = E.aggregate(sc); } catch (e) { showError('单跳汇总', e); return; }
    const stacks = raw != null ? raw : ((agg.flags && agg.flags.static) ? 6 : 0);
    const ctx = {
      elite: true, armor: sc.enemy.armor || 0, mr: sc.enemy.mr || 0, enemyLevel: 70, critDR: (sc.enemy.critDR || 0),
      healthyUptime: 1, injuredUptime: 1, slowedUptime: 1, immobilizedUptime: 1,
      distant: 1, count: sc.enemy.count || 1, vulnUptime: 1,
      electroStacks: stacks, takenMode: sc.takenMode, bleeding: true, poisoned: true, burning: true
    };
    let hz;
    try { hz = E.hitZones(agg, ab, ctx); } catch (e) { showError('单跳乘区', e); return; }
    txt('#dmBig', fmt(hz.total)); txt('#dmUnit', '这一发');
    txt('#dmBigLabel', ab.name + ' · 全状态成立');
    const box = $('#dmMeta');
    if (box) box.innerHTML = fieldHtml([
      ['技能', ab.name], ['命中段数', hz.hits + ' 段'],
      ['等效倍率', ((hz.total / Math.max(1, agg.weaponDamage)) * 100).toFixed(0) + '%'],
      ['静电层数', stacks + ' 层'], ['结构口径', pendingMeta('takenMode').label]
    ]);
    renderZones(null, { zones: hz, box: '#dmZoneTable', hint: '#dmZoneHint', note: '#dmNote', mode: 'single' });
    const note = $('#dmNote');
    if (note) note.innerHTML = `<div style="margin-bottom:6px;color:#e8cd8a">单跳口径（上限参照）</div>
      <div class="dim" style="font-size:10.5px;line-height:1.7">
        假设这一发命中时目标带易伤、是精英、处于健康/受伤段、被减速与定身、且在远处，全部按 100% 计。
        静电 ${stacks} 层 × ${pendingVal('electroCoef')}%/层，静电 × 易伤按「${pendingMeta('takenMode').label}」计。这是上限参照，不是平均。
      </div>`;
  }

  function renderDamagePerHit() {
    const box = $('#dmPerHit'); if (!box) return;
    let list = [];
    try { list = E.perHitTable(cfg()) || []; } catch (e) { showError('全技能单发', e); }
    if (!list.length) { box.innerHTML = '<div class="empty">暂无可计算的技能</div>'; return; }
    const typeName = { basic: '普攻', strong: '强力', special: '特殊' };
    let html = '<table class="cmptable"><thead><tr><th>技能</th><th>类型</th><th>单发期望</th><th>相对武器倍率</th></tr></thead><tbody>';
    list.forEach(x => {
      html += `<tr><td>${x.name}</td><td>${typeName[x.type] || x.type || '—'}</td><td class="num">${fmt(x.dmg)}</td><td class="num gold">${x.pct.toFixed(0)}%</td></tr>`;
    });
    box.innerHTML = html + '</tbody></table>';
  }

  /* ------------------------------------------------------------ 未决项选项卡（一期） */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function persistDecisions() {
    safeRun('保存裁决', () => Store.savePending(state.decisions));
    scheduleDraft();
    updateScopeBadge();
    state._cache = {}; state._gearKey = null;
    recomputeAll();
  }

  function openPending() {
    const d = $('#pendDrawer'); if (!d) return;
    const sd = $('#saveDrawer'); if (sd) sd.classList.remove('on');
    d.classList.add('on');
    const s = $('#scrim'); if (s) s.classList.add('on');
    safeRun('未决项列表', renderPending);
  }
  function closePending() {
    const d = $('#pendDrawer'); if (!d) return;
    d.classList.remove('on');
    const s = $('#scrim'); if (s) s.classList.remove('on');
  }

  function bindPending() {
    const close = $('#pendClose'); if (close) close.onclick = closePending;
    const btn = $('#btnPending'); if (btn) btn.onclick = openPending;
    const scrim = $('#scrim'); if (scrim) scrim.addEventListener('click', closePending);
    const list = $('#pendList'); if (!list) return;
    list.addEventListener('click', e => {
      const why = e.target.closest('.why');
      if (why) {
        const box = why.closest('.pcard').querySelector('.evidence');
        if (box) { box.classList.toggle('on'); why.textContent = box.classList.contains('on') ? '收起' : '? 为什么'; }
        return;
      }
      const reset = e.target.closest('[data-preset]');
      if (reset) {
        state.decisions[reset.dataset.preset] = { mode: 'default', value: null, measured: null, ts: Date.now() };
        persistDecisions(); renderPending();
      }
    });
    list.addEventListener('change', e => {
      const t = e.target, id = t.dataset.pid;
      if (!id) return;
      const d = state.decisions[id] || (state.decisions[id] = {});
      d.ts = Date.now();
      if (t.dataset.pm) {
        d.mode = t.dataset.pm;
        d.value = d.mode === 'alt' ? (t.dataset.val || ((PENDING_BY_ID[id].alts || [])[0] || {}).v) : null;
        persistDecisions(); renderPending();
      } else if (t.dataset.mf) {
        d.measured = d.measured || { value: '', conditions: '', date: '', note: '' };
        d.measured[t.dataset.mf] = t.value;
        d.mode = 'measured';
        persistDecisions();
      }
    });
  }

  function renderPending() {
    const box = $('#pendList'); if (!box) return;
    box.innerHTML = '';
    PENDING.forEach(spec => {
      const d = state.decisions[spec.id] || {};
      const mode = d.mode || 'default';
      const meta = pendingMeta(spec.id);
      const srcCls = meta.source === 'me' ? 'me' : meta.source === 'default' ? 'warn' : 'good';
      let html = `<div class="ph2">
          <span class="t">${spec.title}</span>
          <span class="badge ${srcCls}">${esc(meta.label)}</span>
          <button class="why" type="button">? 为什么</button>
        </div>
        <div class="pb2">
          <div class="src">当前采用：<b>${esc(meta.label)}</b> · 来源：${meta.src}${d.ts ? ' · ' + new Date(d.ts).toLocaleDateString() : ''}</div>
          <div class="opts">
            <label class="opt"><input type="radio" name="pd_${spec.id}" data-pid="${spec.id}" data-pm="default" ${mode === 'default' ? 'checked' : ''}><span>采用系统默认（<b>${spec.defLabel}</b>）</span></label>`;
      (spec.alts || []).forEach(a => {
        html += `<label class="opt"><input type="radio" name="pd_${spec.id}" data-pid="${spec.id}" data-pm="alt" data-val="${esc(String(a.v))}" ${mode === 'alt' && String(d.value) === String(a.v) ? 'checked' : ''}><span>采用另一口径（<b>${a.label}</b>）</span></label>`;
      });
      html += `<label class="opt"><input type="radio" name="pd_${spec.id}" data-pid="${spec.id}" data-pm="measured" ${mode === 'measured' ? 'checked' : ''}><span>我实测过 → 录入实测结果（<b>优先于默认，进入计算</b>）</span></label>
          </div>`;
      const m = d.measured || {};
      html += `<div class="measure" style="display:${mode === 'measured' ? 'block' : 'none'}">
          <div class="row"><label>实测数值</label><input type="text" data-pid="${spec.id}" data-mf="value" value="${esc(m.value)}" placeholder="如 1.34 或 85"></div>
          ${spec.id === 'takenMode' ? `<div class="row"><label>实测支持</label><select data-pid="takenMode" data-mf="verdict"><option value="additive" ${(m.verdict || 'additive') === 'additive' ? 'selected' : ''}>加算</option><option value="multiplicative" ${m.verdict === 'multiplicative' ? 'selected' : ''}>相乘</option></select></div>` : ''}
          <div class="row"><label>测量条件</label><input type="text" data-pid="${spec.id}" data-mf="conditions" value="${esc(m.conditions)}" placeholder="易伤覆盖 / 静电层数 / 技能 / 白字或暴击 / 敌人"></div>
          <div class="row"><label>测量日期</label><input type="date" data-pid="${spec.id}" data-mf="date" value="${esc(m.date)}"></div>
          <div class="row"><label>备注</label><input type="text" data-pid="${spec.id}" data-mf="note" value="${esc(m.note)}" placeholder="选填"></div>
          <div class="hintline">${spec.id === 'takenMode' ? '比值只作证据记录；请按你的比值在上面选择支持的口径，它会进入计算。' : '实测优先于系统默认并进入计算；数据版本变更时保留。'}</div>
        </div>
        <div class="evidence">${spec.evidence}</div>
        <div class="inlinebtns"><button class="btn ghost" data-preset="${spec.id}" style="padding:3px 8px;font-size:10.5px">恢复默认</button></div>
        </div>`;
      const card = el('div', 'pcard');
      card.innerHTML = html;
      box.appendChild(card);
    });
  }

  /* ------------------------------------------------------------ 装备取舍（一期） */
  let _cmpMode = 'gear', _cmpInputKey = '', _cmpPayload = null;
  const slotLabel = k => (SLOTS.find(s => s[0] === k) || [k, k])[1];
  const RARITIES = [['common', '普通'], ['uncommon', '优秀'], ['rare', '稀有'], ['legendary', '传奇'], ['blackMist', '黑雾'], ['divine', '神圣（固定表）']];

  function bindCompare() {
    const mode = $('#cmpMode');
    if (mode) mode.addEventListener('click', e => {
      const b = e.target.closest('button[data-cm]');
      if (!b) return;
      _cmpMode = b.dataset.cm;
      $$('#cmpMode button').forEach(x => x.classList.toggle('on', x === b));
      renderCompareInput(true);
    });
    const enc = $('#cmpEnc');
    if (enc) {
      [['', '沿用当前敌人'], ...(D.ENCOUNTERS || []).map(x => [x.id, x.name])].forEach(([v, n]) => {
        const o = el('option', null, n); o.value = v; enc.appendChild(o);
      });
      enc.addEventListener('change', e => { if (e.target.value) safeRun('场景预设', () => applyEncounter(e.target.value, true)); });
    }
    const scope = $('#cmpScope');
    if (scope) scope.addEventListener('change', () => txt('#cmpBadge', scope.value === 'single' ? '单跳（只看这一发）' : '周期期望 · 按场景加权'));
    const run = $('#cmpRun');
    if (run) run.onclick = () => withBusy(run, '对比中', () => safeRun('装备取舍', runCompare));
    const apply = $('#cmpApply'); if (apply) apply.onclick = () => safeRun('应用优者', applyCompareWinner);
    const box = $('#cmpInput');
    if (box) box.addEventListener('click', e => {
      const fill = e.target.closest('[data-fill-tal]');
      if (!fill) return;
      const side = fill.dataset.fillTal;
      $$(`[data-side="${side}"][data-tal]`).forEach(n => {
        const v = state.talents[n.dataset.tal] || 0;
        n.value = Math.min(v, parseInt(n.max, 10) || 1);
      });
      toast('已把当前天赋填入方案 ' + side);
    });
  }

  function cmpCfg() {
    const c = cfg();
    const dur = clampInt(($('#cmpDur') || {}).value, 20, 180, state.duration);
    const scope = ($('#cmpScope') || {}).value || 'cycle';
    if (scope === 'single') {
      c.vulnUptime = 1;
      c.enemy = Object.assign({}, c.enemy, {
        elite: true, distant: 1, healthyUptime: 1, injuredUptime: 1, slowedUptime: 1, immobilizedUptime: 1
      });
    }
    return { cfg: c, duration: dur, scope: scope };
  }

  function renderCompare() {
    const enc = $('#cmpEnc'); if (enc && document.activeElement !== enc) enc.value = state.encounter || '';
    const dur = $('#cmpDur'); if (dur && document.activeElement !== dur) dur.value = state.duration;
    const scope = $('#cmpScope');
    txt('#cmpBadge', scope && scope.value === 'single' ? '单跳（只看这一发）' : '周期期望 · 按场景加权');
    renderCompareInput();
  }

  function affixSelect(side, field, chosen) {
    let h = `<select data-side="${side}" data-field="${field}">`;
    AFFIX_OPTS.forEach(o => { h += `<option value="${o.id}" ${+chosen === o.id ? 'selected' : ''}>${o.name}</option>`; });
    return h + '</select>';
  }

  function renderCompareInput(force) {
    const key = _cmpMode + '|' + state.classKey;
    if (!force && _cmpInputKey === key) return;
    _cmpInputKey = key;
    const box = $('#cmpInput'); if (!box) return;
    let h = '';
    if (_cmpMode === 'gear') {
      const col = (side, ilvl, rarity, roll) => `<div class="cmpcol">
        <h4>装备 ${side}</h4>
        <div class="field"><label>装分</label><div class="val"><input type="number" data-side="${side}" data-field="ilvl" min="100" max="1200" step="10" value="${ilvl}" style="width:70px"></div></div>
        <div class="field"><label>稀有度</label><div class="val"><select data-side="${side}" data-field="rarity">${RARITIES.map(([v, n]) => `<option value="${v}" ${v === rarity ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <div class="field"><label>掷骰档</label><div class="val"><select data-side="${side}" data-field="roll"><option value="1" ${roll === 1 ? 'selected' : ''}>中值</option><option value="1.15" ${roll === 1.15 ? 'selected' : ''}>满掷</option></select></div></div>
        ${[0, 1, 2, 3].map(i => `<div class="field"><label>主词条 ${i + 1}</label><div class="val">${affixSelect(side, 'm' + i, [0, 4, 5, 2][i])}</div></div>`).join('')}
        <div class="field"><label>副词条</label><div class="val">${affixSelect(side, 'sub', 32)}</div></div>
      </div>`;
      h = `<div class="note" style="margin-bottom:12px">两件装备各填装分、稀有度、掷骰档和 4 主 + 1 副；数值由 <b>AffixMath.buildGear</b> 换算后各跑一次 simulate。仆从装备（5 级解锁）在仆从页配置。</div>
        <div class="grid2" style="grid-template-columns:1fr 1fr">${col('A', 700, 'legendary', 1)}${col('B', 850, 'legendary', 1.15)}</div>`;
    } else if (_cmpMode === 'talent') {
      const c = D.CLASSES[state.classKey] || {};
      const col = side => {
        let t = `<div class="cmpcol"><h4>方案 ${side}</h4><div class="talentgrid">`;
        (c.talents || []).forEach(row => (row.items || []).forEach(x => {
          t += `<div class="field"><label title="${x.name}">${x.name}${x.max > 1 ? ' ×' + x.max : ''}</label><div class="val"><input type="number" data-side="${side}" data-tal="${x.id}" min="0" max="${x.max || 1}" value="0" style="width:44px"></div></div>`;
        }));
        return t + '</div></div>';
      };
      h = `<div class="note" style="margin-bottom:12px">两套天赋各 70 点以内，专精行互斥与行门槛会校验。可先到「天赋」页点好，再用下面的按钮把当前分配填入 A / B。</div>
        <div class="inlinebtns" style="margin-bottom:12px"><button class="btn ghost" data-fill-tal="A">当前天赋填入 A</button><button class="btn ghost" data-fill-tal="B">当前天赋填入 B</button></div>
        <div class="grid2" style="grid-template-columns:1fr 1fr">${col('A')}${col('B')}</div>`;
    } else {
      const uniq = ['weapon', 'helm', 'shoulder', 'chest', 'gloves', 'belt', 'pants', 'boots', 'neck', 'ring'];
      h = `<div class="note" style="margin-bottom:12px">对指定部位的每条词条做<b>单条孤立试算</b>，按 DPS 增益排序。未计预算/部位竞争，数值取 ilvl700 传奇中值。</div>
        <div class="field" style="max-width:280px"><label>部位</label><div class="val"><select id="cmpSlot">${uniq.map(k => `<option value="${k}" ${k === state.slot ? 'selected' : ''}>${slotLabel(k)}</option>`).join('')}</select></div></div>`;
    }
    box.innerHTML = h;
    safeRun('范围提示', addRangeHints);
  }

  function readGearBuild(side) {
    const q = f => { const n = $(`[data-side="${side}"][data-field="${f}"]`); return n ? n.value : ''; };
    const rarity = q('rarity');
    const valid = x => AFFIX_OPTS.some(o => o.id === x);
    const mains = ['m0', 'm1', 'm2', 'm3'].map(k => clampInt(q(k), 0, 300, 0)).filter(valid);
    const sub = clampInt(q('sub'), 0, 300, 0);
    return {
      name: '装备 ' + side,
      ilvl: clampInt(q('ilvl'), 100, 1200, 700),
      rarity: rarity, blackMist: rarity === 'blackMist',
      roll: parseFloat(q('roll')) || 1,
      classKey: state.classKey, element: state.element,
      dps: state.gear.dps, speed: state.gear.speed,
      slots: [{ slot: 1, main: mains, secondary: valid(sub) ? [sub] : [] }]
    };
  }

  function readTalents(side) {
    const out = {};
    $$(`[data-side="${side}"][data-tal]`).forEach(n => {
      const v = clampInt(n.value, 0, parseInt(n.max, 10) || 1, 0);
      if (v > 0) out[n.dataset.tal] = v;
    });
    return out;
  }

  const signPct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  function cmpTable(rows) {
    let h = '<table class="cmptable"><thead><tr><th>指标</th><th>A</th><th>B</th><th>差异</th></tr></thead><tbody>';
    rows.forEach(r => { h += `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num diff">${r[3] || '—'}</td></tr>`; });
    return h + '</tbody></table>';
  }
  const aggRows = (a, b) => {
    const av = (a.agg || {}), bv = (b.agg || {});
    const xs = x => (1 + ((x.str || 0) + (x.dex || 0) + (x.int || 0)) / 100).toFixed(2) + '×';
    const cr = x => (1 + (x.cc || 0) / 100 * (x.cd || 0) / 100 * (1 - (x.critDR || 0))).toFixed(2) + '×';
    return [
      ['主属性倍率', xs(av), xs(bv), ''], ['暴击期望', cr(av), cr(bv), ''],
      ['元素 + 全伤', (1 + ((av[state.element] || 0) + (av.all || 0)) / 100).toFixed(2) + '×',
        (1 + ((bv[state.element] || 0) + (bv.all || 0)) / 100).toFixed(2) + '×', '']
    ];
  };

  function runCompare() {
    const base = cmpCfg();
    const verdict = $('#cmpVerdict'), out = $('#cmpResult'), applyBtn = $('#cmpApply');
    if (applyBtn) applyBtn.style.display = '';
    _cmpPayload = null;
    const warn = base.scope === 'single' ? '<span class="badge warn">单跳：只看这一发，别用它下整场结论</span> ' : '';
    if (_cmpMode === 'gear') {
      if (!AF) { verdict.textContent = '装备数值模块未加载，无法计算。'; return; }
      const gbA = readGearBuild('A'), gbB = readGearBuild('B');
      let rA, rB;
      try {
        rA = E.simulate(Object.assign({}, base.cfg, { gearBuild: gbA }), { duration: base.duration, lite: true });
        rB = E.simulate(Object.assign({}, base.cfg, { gearBuild: gbB }), { duration: base.duration, lite: true });
      } catch (e) { showError('装备 A/B', e); return; }
      const d = rA.dps > 0 ? (rB.dps / rA.dps - 1) * 100 : 0;
      if (verdict) verdict.innerHTML = warn + `B 比 A <b>${signPct(d)} DPS</b>（${fmt(rB.dps - rA.dps)} 秒伤）` +
        `<span class="sub">${Math.abs(d) < 0.5 ? '差距在误差内，不建议为它换装' : (d > 0 ? '建议换 B' : '建议留 A')} · 本页口径：${base.scope === 'single' ? '单跳瞬时' : '周期期望'}</span>`;
      if (out) out.innerHTML = cmpTable([
        ['DPS', fmt(rA.dps), fmt(rB.dps), signPct(d)],
        ['总伤', fmt(rA.total), fmt(rB.total), rA.total ? signPct((rB.total / rA.total - 1) * 100) : '—'],
        ['击杀时间', finiteNum(rA.killTime) ? rA.killTime.toFixed(1) + 's' : '—', finiteNum(rB.killTime) ? rB.killTime.toFixed(1) + 's' : '—', ''],
        ...aggRows(rA, rB)
      ]) + '<div class="note" style="margin-top:10px">装备数值由装分×稀有度换算，是一次<b>近似替换</b>：其余部位仍沿用当前汇总。仆从装备与宝石孔属二期。</div>';
      _cmpPayload = { gear: d >= 0 ? gbB : gbA };
      if (applyBtn) applyBtn.textContent = '把优者装备应用到当前构筑（近似）';
    } else if (_cmpMode === 'talent') {
      const tA = readTalents('A'), tB = readTalents('B');
      const sum = t => Object.values(t).reduce((a, b) => a + b, 0);
      const c = D.CLASSES[state.classKey] || {};
      const conflict = t => (c.talents || []).some(row =>
        [10, 30, 60].includes(row.at) && (row.items || []).filter(x => (t[x.id] || 0) > 0).length > 1);
      if (sum(tA) > 70 || sum(tB) > 70 || conflict(tA) || conflict(tB)) {
        verdict.innerHTML = '<span class="red">点数超过 70 或专精行冲突</span><span class="sub">请检查专精行互斥后再对比。</span>';
        return;
      }
      let rA, rB;
      try {
        rA = E.simulate(Object.assign({}, base.cfg, { talents: tA }), { duration: base.duration, lite: true });
        rB = E.simulate(Object.assign({}, base.cfg, { talents: tB }), { duration: base.duration, lite: true });
      } catch (e) { showError('天赋 A/B', e); return; }
      const d = rA.dps > 0 ? (rB.dps / rA.dps - 1) * 100 : 0;
      if (verdict) verdict.innerHTML = warn + `B 比 A <b>${signPct(d)} DPS</b>（${fmt(rB.dps - rA.dps)} 秒伤）` +
        `<span class="sub">${Math.abs(d) < 0.5 ? '差距在误差内' : (d > 0 ? '建议用方案 B' : '建议用方案 A')} · A ${sum(tA)} 点 / B ${sum(tB)} 点</span>`;
      if (out) out.innerHTML = cmpTable([
        ['DPS', fmt(rA.dps), fmt(rB.dps), signPct(d)],
        ['总伤', fmt(rA.total), fmt(rB.total), ''],
        ['击杀时间', finiteNum(rA.killTime) ? rA.killTime.toFixed(1) + 's' : '—', finiteNum(rB.killTime) ? rB.killTime.toFixed(1) + 's' : '—', ''],
        ...aggRows(rA, rB)
      ]);
      _cmpPayload = { talents: d >= 0 ? tB : tA };
      if (applyBtn) applyBtn.textContent = '把优者天赋应用到当前构筑';
    } else {
      if (!AF) { /* 词条边际不依赖 affix.js，继续 */ }
      const slot = ($('#cmpSlot') || {}).value || state.slot;
      let rr;
      try { rr = E.rankAffixes(Object.assign({}, base.cfg, { slot: slot }), { duration: base.duration, lite: true }); }
      catch (e) { showError('词条边际', e); return; }
      if (verdict) verdict.innerHTML = warn + `已按「${slotLabel(slot)}」部位算出 <b>${(rr.list || []).length} 条</b>词条的边际收益`;
      let h = '<table class="cmptable"><thead><tr><th>词条</th><th>DPS 增益</th></tr></thead><tbody>';
      (rr.list || []).slice(0, 8).forEach(a => { h += `<tr><td>${a.name}</td><td class="num gold">+${a.delta.toFixed(2)}%</td></tr>`; });
      h += '</tbody></table><div class="note" style="margin-top:10px">单条孤立试算，未计预算与部位竞争；数值取 ilvl700 传奇中值。若要按指定装分×稀有度算，见「装备」页的数值面板。</div>';
      if (out) out.innerHTML = h;
      if (applyBtn) applyBtn.style.display = 'none';
    }
    txt('#cmpStamp', new Date().toLocaleTimeString() + ' · ' + (base.scope === 'single' ? '单跳' : '周期') + ' · ' + base.duration + 's');
  }

  function applyCompareWinner() {
    if (!_cmpPayload) { toast('请先完成一次对比'); return; }
    if (_cmpPayload.gear && AF) {
      state.gear = AF.buildGear(_cmpPayload.gear);
      state.gear.name = '对比胜出装备';
      state._preset = 'mid';
      toast('已应用胜出装备数值（近似替换当前汇总）');
    } else if (_cmpPayload.talents) {
      state.talents = Object.assign({}, _cmpPayload.talents);
      toast('已应用胜出天赋');
    }
    safeRun('同步控件', syncAllInputs);
    safeRun('天赋页', renderTalents);
    safeRun('装备页', renderGear);
    recomputeAll();
  }

  /* ------------------------------------------------------------ 装备数值面板（一期） */
  function bindAffixLab() {
    const stat = $('#agStat');
    if (stat && AF) {
      AFFIX_OPTS.forEach(o => { const x = el('option', null, o.name); x.value = o.id; stat.appendChild(x); });
      stat.value = '0';
    }
    let agTimer = null;
    const recalc = () => {
      const spin = $('#agBusy'); if (spin) spin.classList.add('on');
      clearTimeout(agTimer);
      agTimer = setTimeout(() => {
        safeRun('装备数值面板', renderAffixLab);
        if (spin) spin.classList.remove('on');
      }, 130);
    };
    ['#agIlvl', '#agRarity', '#agRoll', '#agStat'].forEach(s => {
      const n = $(s); if (!n) return;
      n.addEventListener('input', recalc);
      n.addEventListener('change', recalc);
    });
  }

  function renderAffixLab() {
    if (!AF) { txt('#agFormula', '数值模块未加载'); return; }
    if (!$('#agStat')) return;
    const stat = clampInt(($('#agStat') || {}).value, 0, 300, 0);
    let ilvl = clampInt(($('#agIlvl') || {}).value, 100, 1200, 700);
    let rarity = ($('#agRarity') || {}).value || 'legendary';
    let roll = parseFloat(($('#agRoll') || {}).value) || 1;
    if (AF.PER_LEVEL[stat] == null) { txt('#agFormula', '该词条暂无反编译系数'); return; }
    if (rarity === 'divine') {
      txt('#agValue', '查固定表'); txt('#agRange', '见资料库'); txt('#agSum', '—');
      txt('#agFormula', '神圣 / 远古神圣走 DIVINE_FIXED 固定属性表，不走装分 × 稀有度公式。');
      return;
    }
    const wasBlack = rarity === 'blackMist';
    if (wasBlack) { ilvl = 850; roll = 1.15; rarity = 'legendary'; }
    const v = AF.affixValue(ilvl, rarity, stat, roll);
    const mid = AF.affixValue(ilvl, rarity, stat, 1);
    const max = AF.affixValue(ilvl, rarity, stat, 1.15);
    const percent = AF.PERCENT_STATS.has(stat);
    const fv = x => percent ? x.toFixed(1) + '%' : (x >= 10 ? String(Math.round(x)) : x.toFixed(2));
    txt('#agValue', fv(v));
    txt('#agRange', fv(mid) + ' / ' + fv(max));
    txt('#agSum', fv(mid * 4 + max) + '（仅数值相加）');
    txt('#agFormula', `公式：(1 + 稀有度加成 ${((AF.RARITY_BONUS[rarity] || 0) * 100).toFixed(0)}%) × 装分 ${ilvl} × 每级系数 ${AF.PER_LEVEL[stat]}${percent ? ' ×100' : ''} × 掷骰 ${roll} = ${v.toFixed(3)}${wasBlack ? '（黑雾按 850 / 满掷换算）' : ''}`);
  }

  /* ------------------------------------------------------------ talents */
  function talentPoints() { return Object.values(state.talents).reduce((a, b) => a + b, 0); }

  function capstoneRowIds(row) { return row.items.map(i => i.id); }

  function renderTalents() {
    const c = D.CLASSES[state.classKey] || { talents: [], name: '—' };
    const total = talentPoints();
    txt('#tpCount', total);
    txt('#phTpCls', c.name || '—');
    txt('#phTpPts', total + ' / 70');
    const tree = $('#talentTree'); tree.innerHTML = '';
    // 点数预算条（70 点上限，满额高亮）
    const budget = el('div', 'tp-budget');
    const pct = Math.min(100, total / 70 * 100);
    budget.innerHTML = `<div class="lbl"><span>天赋点数</span><span><b>${total}</b> / 70</span></div>
      <div class="bar"><i class="${total >= 70 ? 'full' : ''}" style="width:${pct}%"></i></div>`;
    tree.appendChild(budget);
    c.talents.forEach(row => {
      const locked = total < row.at;
      const isCap = [10, 30, 60].includes(row.at);
      const r = el('div', 'trow' + (locked ? ' locked' : '') + (isCap ? ' caprow' : ''));
      r.innerHTML = `<div class="tmeta"><b class="num">${row.at}</b>${isCap ? '专精' : '门槛'}</div>`;
      const items = el('div', 'titems');
      row.items.forEach(tal => {
        const rank = state.talents[tal.id] || 0;
        const d = el('div', 'tal' + (rank ? ' on' : '') + (rank >= tal.max ? ' max' : ''));
        d.title = `${tal.name}（${rank}/${tal.max}）\n${tal.text}`;
        d.innerHTML = `<div class="n"><span>${tal.name}</span><span class="r ${rank >= tal.max ? 'maxr' : ''}">${rank}/${tal.max}</span></div>
          <div class="d">${tal.text}</div>
          <div class="pips">${Array.from({ length: Math.min(tal.max, 10) }, (_, i) => `<i class="${i < rank ? 'f' : ''}"></i>`).join('')}</div>`;
        d.onclick = () => {
          if (talentPoints() >= 70 && rank < tal.max) return;
          if (rank >= tal.max) return;
          if (isCap) row.items.forEach(o => { if (o.id !== tal.id) delete state.talents[o.id]; });
          state.talents[tal.id] = rank + 1;
          state._cache = {}; state._gearKey = null; state._affixCache = null;
          renderTalents(); recomputeAll();
        };
        d.oncontextmenu = e => {
          e.preventDefault();
          if (!rank) return;
          state.talents[tal.id] = rank - 1;
          if (!state.talents[tal.id]) delete state.talents[tal.id];
          state._cache = {}; state._gearKey = null; state._affixCache = null;
          renderTalents(); recomputeAll();
        };
        items.appendChild(d);
      });
      r.appendChild(items);
      tree.appendChild(r);
    });
    renderTalentSummary();
  }

  function renderTalentSummary() {
    const box = $('#tpSummary');
    if (!box) return;
    const cur = E.simulate(cfg(), { duration: state.duration, lite: true });
    const zero = Object.assign(cfg(), { talents: {} });
    const base = E.simulate(zero, { duration: state.duration, lite: true });
    const gain = base.dps ? (cur.dps / base.dps - 1) * 100 : 0;
    const tp = talentPoints();
    txt('#phTpGain', isFinite(gain) ? '+' + gain.toFixed(1) + '%' : '—');
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);margin-bottom:14px">
        <div style="background:var(--panel);padding:14px 16px"><div class="k" style="font-size:10px;color:var(--dim);letter-spacing:1.4px">当前天赋秒伤</div><div class="v num gold" style="font-size:24px">${fmt(cur.dps)}</div></div>
        <div style="background:var(--panel);padding:14px 16px"><div class="k" style="font-size:10px;color:var(--dim);letter-spacing:1.4px">相对 0 点</div><div class="v num green" style="font-size:24px">+${gain.toFixed(1)}%</div></div>
        <div style="background:var(--panel);padding:14px 16px"><div class="k" style="font-size:10px;color:var(--dim);letter-spacing:1.4px">每点平均收益</div><div class="v num" style="font-size:18px">${tp ? '+' + (gain / tp).toFixed(2) + '%' : '—'}</div></div>
        <div style="background:var(--panel);padding:14px 16px"><div class="k" style="font-size:10px;color:var(--dim);letter-spacing:1.4px">已投入</div><div class="v num" style="font-size:18px">${tp} / 70</div></div>
      </div>
      <div class="dhint">自动规划按「每点秒伤增量」贪心分配，并遵守行门槛与专精互斥。防御向天赋不参与伤害评分，需要时手动补。</div>`;
  }

  function bindTalents() {
    $('#tpClear').onclick = () => { state.talents = {}; state._gearKey = null; state._affixCache = null; renderTalents(); recomputeAll(); };
    $('#tpBuild').onclick = () => {
      const ui = CLASS_UI[state.classKey];
      state.talents = Object.assign({}, DEFAULT_TALENTS[state.classKey]);
      state.skills = { basic: ui.skills[0], strong: ui.skills[1], special1: ui.skills[2], special2: ui.skills[3] };
      state._gearKey = null; state._affixCache = null;
      syncAllInputs(); renderTalents(); recomputeAll();
    };
    $('#tpAuto').onclick = () => {
      const btn = $('#tpAuto');
      btn.textContent = '计算中…';
      setTimeout(() => {
        const res = E.autoTalents(cfg(), 70);
        state.talents = res;
        state._gearKey = null; state._affixCache = null;
        btn.textContent = '自动规划 70 点';
        renderTalents(); recomputeAll();
      }, 30);
    };
  }

  /* ------------------------------------------------------------ 最优解 */
  /* 模板按「技能组 + 元素 + 套装 + 专精行」定义；每个 Tab 独立求解、同口径可比。
     只固定一条专精行作为流派身份，其余专精行仍由求解器精确枚举。 */
  const SOLVER_TEMPLATES = {
    warrior: [
      { id: 'w_forge', name: '火焰强力 · 熔炉', element: 'fire', primaryType: 'strong',
        skills: { basic: 'w_val', strong: 'w_flame', special1: 'w_hook', special2: 'w_molten' },
        setId: 'w_eye', setCount: 4, specPins: { 60: 'forge' },
        desc: '烈焰打击主输出，夺命钩铺易伤，熔火之力回蓝增伤；专精锁定「熔炉之心」。' },
      { id: 'w_bleed', name: '流血旋风 · 荆棘', element: 'physical', primaryType: 'strong',
        skills: { basic: 'w_blood', strong: 'w_whirl', special1: 'w_thorn', special2: 'w_shout' },
        setId: 'w_eye', setCount: 6, specPins: { 60: 'bloodlust' },
        desc: '旋风斩 + 铁荆棘持续流血，风暴之眼 6 件允许旋转中施法；专精锁定「嗜血」。' }
    ],
    sorcerer: [
      { id: 's_lightning', name: '闪电风暴 · 静电', element: 'lightning', primaryType: 'strong',
        skills: { basic: 's_electro', strong: 's_storm', special1: 's_cloud', special2: 's_elemental' },
        setId: 's_storm', setCount: 4, specPins: { 30: 'static' },
        desc: '电弧叠层 + 闪电风暴多段，闪电云补足命中数；专精锁定「静电充能」。' },
      { id: 's_fire', name: '火焰陨石 · 点燃', element: 'fire', primaryType: 'strong',
        skills: { basic: 's_fireball', strong: 's_breath', special1: 's_meteor', special2: 's_aura' },
        setId: 's_infernal', setCount: 2, specPins: { 30: 'ignite' },
        desc: '吐息铺垫点燃，陨石爆发，光环补暴击；专精锁定「点燃」。' }
    ],
    hunter: [
      { id: 'h_poison', name: '毒伤陷阱', element: 'poison', primaryType: 'strong',
        skills: { basic: 'h_poison', strong: 'h_venom', special1: 'h_trap', special2: 'h_flare' },
        setId: 'h_venom', setCount: 2, specPins: { 60: 'injection' },
        desc: '毒射与毒液弩矢叠毒，陷阱爆发；专精锁定「致命注射」。' },
      { id: 'h_physical', name: '物理速射 · 孤猎', element: 'physical', primaryType: 'strong',
        skills: { basic: 'h_twin', strong: 'h_rapid', special1: 'h_steady', special2: 'h_phantom' },
        setId: 'h_deadeye', setCount: 6, specPins: { 60: 'lone' },
        desc: '双箭 + 快速射击高频输出，神射手 6 件翻倍；专精锁定「孤猎」。' }
    ],
    monk: [
      { id: 'm_orbs', name: '雷电法球 · 凝聚', element: 'lightning', primaryType: 'strong',
        skills: { basic: 'm_fist', strong: 'm_judgment', special1: 'm_orbs', special2: 'm_twin' },
        setId: 'm_hundred', setCount: 4, specPins: { 30: 'gathered' },
        desc: '怒拳叠攻速，裁决与法球吃闪电乘区；专精锁定「凝聚之力」。' },
      { id: 'm_palms', name: '金掌物理 · 链劲', element: 'physical', primaryType: 'strong',
        skills: { basic: 'm_three', strong: 'm_palms', special1: 'm_charge', special2: 'm_twin' },
        setId: 'm_hundred', setCount: 6, specPins: { 10: 'chain' },
        desc: '三连击起手，金掌穿透，冲锋控场；专精锁定「链劲」。' }
    ]
  };

  let svRunnerPromise = null;
  let svActiveId = null;
  let svTier = 'quick';
  let svHandle = null;
  let svLastFromCache = false;

  function getSolverRunner() {
    const S = window.Solver;
    if (!S) {
      txt('#svMode', '不可用');
      txt('#svRunnerNote', 'solver.js 未加载，最优解功能不可用。');
      return Promise.resolve(null);
    }
    if (!svRunnerPromise) {
      svRunnerPromise = S.createRunner().then(r => {
        const isMain = r && r.mode === 'main';
        txt('#svMode', isMain ? '主线程分片' : 'Worker 线程');
        txt('#svRunnerNote', isMain
          ? '当前为 file:// 直开或 Worker 不可用，已降级为主线程分片（每片 ≤12ms），界面保持可交互。'
          : '求解在独立 Worker 线程进行，主线程不阻塞；中断可随时生效。');
        return r;
      }).catch(() => null);
    }
    return svRunnerPromise;
  }

  function templateCfg(t) {
    return Object.assign({}, cfg(), {
      element: t.element,
      primaryType: t.primaryType,
      skills: Object.assign({}, t.skills),
      setId: t.setId,
      setCount: t.setCount
    });
  }
  function templatePins(t) {
    return Object.keys(t.specPins || {}).map(k => ({ at: +k, id: t.specPins[k] }));
  }
  function currentTemplates() { return SOLVER_TEMPLATES[state.classKey] || []; }
  function activeTemplate() {
    const list = currentTemplates();
    return list.find(t => t.id === svActiveId) || list[0] || null;
  }

  function renderSolverTemplates() {
    const box = $('#svTemplates');
    if (!box) return;
    const list = currentTemplates();
    if (!list.some(t => t.id === svActiveId)) svActiveId = list[0] && list[0].id;
    txt('#svClsName', (D.CLASSES[state.classKey] || {}).name || '—');
    box.innerHTML = '';
    list.forEach(t => {
      const b = el('button', 'svtab' + (t.id === svActiveId ? ' on' : ''));
      b.innerHTML = `${t.name}<span class="dot"></span>`;
      b.dataset.tid = t.id;
      b.onclick = () => selectTemplate(t.id);
      box.appendChild(b);
    });
    const t = activeTemplate();
    const desc = $('#svTemplateDesc');
    if (desc) desc.textContent = t ? t.desc : '当前职业暂无模板，可用「自动规划」代替。';
  }

  function selectTemplate(id) {
    if (svHandle) return;   // 求解中不允许切换
    svActiveId = id;
    renderSolverTemplates();
    const t = activeTemplate();
    const box = $('#svResult');
    if (!box || !t) return;
    const c = templateCfg(t);
    const hit = Store.getSolve(Store.solveKey(c, svTier));
    if (hit) { svLastFromCache = true; renderSolverResult(hit); }
    else {
      svLastFromCache = false;
      box.innerHTML = '<div class="empty">该模板尚未求解。<br>点「开始计算」生成同口径结果。</div>';
      txt('#svResultHint', '尚未计算');
      txt('#svStage', '待机'); txt('#svPct', '0%');
      $('#svBarFill').style.width = '0%';
    }
  }

  function renderSolverResult(res, fromCache) {
    const box = $('#svResult');
    if (!box || !res) return;
    if (fromCache != null) svLastFromCache = fromCache;
    const t = activeTemplate();
    const c = t ? templateCfg(t) : cfg();
    const baseCfg = Object.assign({}, c, { talents: state.talents || {} });
    let baseDps = NaN;
    try { baseDps = E.simulate(baseCfg, { duration: svTier === 'quick' ? 16 : 32, lite: true }).dps; }
    catch (e) { }
    const gain = isFinite(baseDps) && baseDps > 0 ? (res.dps / baseDps - 1) * 100 : NaN;
    const names = {};
    ((D.CLASSES[state.classKey] || {}).talents || []).forEach(row =>
      (row.items || []).forEach(x => { names[x.id] = { name: x.name, max: x.max, at: row.at }; }));
    const alloc = Object.keys(res.talents || {}).filter(k => res.talents[k] > 0)
      .sort((a, b) => (names[a] ? names[a].at : 0) - (names[b] ? names[b].at : 0));
    const allocHtml = alloc.length
      ? `<div class="svalloc">${alloc.map(k => {
        const d = names[k] || { name: k, max: 1, at: 0 };
        return `<div><span>${d.name}<span class="dim" style="font-size:9px"> · ${d.at}点门槛</span></span><span class="num">${res.talents[k]}/${d.max}</span></div>`;
      }).join('')}</div>`
      : '<div class="note">无投入</div>';
    txt('#svResultHint', svLastFromCache ? '缓存命中 · 秒开' : `求解完成 · ${res.tier === 'standard' ? '标准档' : '快速档'}`);
    box.innerHTML = `
      <div class="svcard">
        <div class="svmetrics">
          <div><div class="k">最优 DPS</div><div class="v num">${fmt(res.dps)}</div></div>
          <div><div class="k">相对当前加点</div><div class="v num green">${isFinite(gain) ? (gain >= 0 ? '+' : '') + gain.toFixed(1) + '%' : '—'}</div></div>
          <div><div class="k">黑盒调用</div><div class="v num">${fmt(res.calls)}</div></div>
          <div><div class="k">求解耗时</div><div class="v num">${(res.elapsedMs / 1000).toFixed(1)}<span style="font-size:12px">s</span></div></div>
        </div>
        ${allocHtml}
        <div class="note" style="font-size:10.5px;line-height:1.8">
          模板：<b class="gold">${t ? t.name : '当前构筑'}</b> · 点数 ${Object.values(res.talents || {}).reduce((a, b) => a + b, 0)} / ${res.budget || 70} ·
          记忆化去重 ${fmt(res.cached || 0)} 项 · 随机种子 ${res.seed} · 求解口径 duration ${res.durationOverride || (svTier === 'quick' ? 16 : 32)}s / lite（总览为 60s 完整模拟，数值略有差异）。
        </div>
        <div class="svnote">结果标注：<b class="gold">高质量近似解，非严格全局最优</b>。仅专精选定被精确枚举，阈值与协同靠启发式逼近；调用次数与耗时即收敛证据。</div>
        <div class="inlinebtns"><button class="btn primary" id="svApply">一键应用</button>
          <span class="dim" style="font-size:10.5px;align-self:center">写入天赋并切换到本模板的技能 / 元素 / 套装</span></div>
      </div>`;
    const apply = $('#svApply');
    if (apply) apply.onclick = () => applySolverResult(res);
  }

  function applySolverResult(res) {
    const t = activeTemplate();
    state.talents = Object.assign({}, res.talents || {});
    if (t) {
      state.element = t.element;
      state.primaryType = t.primaryType;
      state.skills = Object.assign({}, t.skills);
      state.setId = t.setId;
      state.setCount = t.setCount;
    }
    state._cache = {}; state._gearKey = null; state._affixCache = null;
    safeRun('同步控件', () => syncAllInputs());
    safeRun('技能槽', () => renderSlots());
    safeRun('天赋树', () => renderTalents());
    recomputeAll();
    toast('已应用最优解，总览已刷新');
  }

  function setSvRunning(running) {
    const s = $('#svStart'), c = $('#svCancel');
    if (s) s.disabled = running;
    if (c) c.disabled = !running;
    $$('.svtab').forEach(b => b.classList.toggle('run', running && b.dataset.tid === svActiveId));
    if (running) { txt('#svStage', '准备'); txt('#svPct', '0%'); $('#svBarFill').style.width = '0%'; }
  }

  function startSolve() {
    if (svHandle) return;
    const t = activeTemplate();
    if (!t) { toast('当前职业暂无模板', true); return; }
    const S = window.Solver;
    if (!S) { toast('求解器未加载', true); return; }
    const cfgT = templateCfg(t);
    const duration = svTier === 'quick' ? 16 : 32;
    const sig = Store.solveKey(cfgT, svTier);
    const hit = Store.getSolve(sig);
    if (hit) {
      svLastFromCache = true; renderSolverResult(hit);
      toast('命中缓存，秒开');
      return;
    }
    setSvRunning(true);
    txt('#svResultHint', '求解中…');
    getSolverRunner().then(runner => {
      if (!runner) { setSvRunning(false); showError('最优解', new Error('求解器不可用')); return; }
      const req = {
        cfg: cfgT, duration, tier: svTier, seed: 20261124,
        specPins: templatePins(t), tierDuration: duration
      };
      svHandle = runner.solve(req, {
        onProgress(pct, stage) {
          txt('#svStage', stage || '—');
          txt('#svPct', (pct || 0) + '%');
          const bar = $('#svBarFill'); if (bar) bar.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
        },
        onDone(result) {
          svHandle = null; setSvRunning(false);
          result.templateId = t.id;
          result.durationOverride = duration;
          Store.putSolve(sig, result);
          svLastFromCache = false;
          renderSolverResult(result);
          toast(`求解完成：${fmt(result.dps)} DPS / ${result.calls} 次调用`);
        },
        onCancelled() {
          svHandle = null; setSvRunning(false);
          txt('#svStage', '已中断'); txt('#svResultHint', '已中断');
          toast('求解已中断');
        },
        onError(err) {
          svHandle = null; setSvRunning(false);
          showError('最优解求解', err);
          toast('求解失败：' + ((err && err.message) || err), true);
        }
      });
    });
  }

  function cancelSolve() {
    if (svHandle && svHandle.cancel) {
      svHandle.cancel();
      txt('#svStage', '中断中…');
    } else {
      toast('当前没有进行中的求解');
    }
  }

  function renderSolver() {
    txt('#svVer', D.VERSION.game);
    const r = state._result;
    txt('#svCurDps', r ? fmt(r.dps) : '—');
    txt('#svDuration', svTier === 'quick' ? '16' : '32');
    $$('#svTierQuick, #svTierStd').forEach(b => b.classList.remove('gold'));
    $(svTier === 'quick' ? '#svTierQuick' : '#svTierStd').classList.add('gold');
    renderSolverTemplates();
    getSolverRunner();
    const t = activeTemplate();
    if (t) {
      const hit = Store.getSolve(Store.solveKey(templateCfg(t), svTier));
      if (hit) { svLastFromCache = true; renderSolverResult(hit); }
    }
  }

  /* ------------------------------------------------------------ 组合最优解 */
  let _comboResult = null;
  function renderComboBoxes() {
    const box = $('#comboSystems');
    if (!box || !window.ComboSolver) return;
    const SYS = window.ComboSolver.SYSTEMS;
    const LABEL = window.ComboSolver.SYS_LABEL;
    box.innerHTML = '';
    SYS.forEach(sys => {
      const on = state._comboUnlock ? (state._comboUnlock.indexOf(sys) >= 0) : true;
      const lbl = el('label', 'switchrow');
      lbl.style.cssText = 'font-size:10.5px;border:1px solid var(--line2);padding:4px 8px;background:#0c0a07';
      lbl.innerHTML = `<input type="checkbox" data-combo-sys="${sys}" ${on ? 'checked' : ''}><span>${LABEL[sys] || sys}</span>`;
      box.appendChild(lbl);
    });
  }
  function bindCombo() {
    renderComboBoxes();
    const run = $('#comboRun');
    if (run) run.onclick = () => {
      if (!window.ComboSolver) { toast('组合求解模块未加载', true); return; }
      const unlock = $$('[data-combo-sys]').filter(x => x.checked).map(x => x.dataset.comboSys);
      const locked = [];
      if ($('#comboKeepSkills') && $('#comboKeepSkills').checked) { locked.push('skills'); const i = unlock.indexOf('skills'); if (i >= 0) unlock.splice(i, 1); }
      if ($('#comboKeepTalents') && $('#comboKeepTalents').checked) { locked.push('talents'); const i = unlock.indexOf('talents'); if (i >= 0) unlock.splice(i, 1); }
      if (!unlock.length) { toast('至少勾选一个要优化的系统', true); return; }
      state._comboUnlock = unlock;
      const resBox = $('#comboResult');
      if (resBox) resBox.innerHTML = '<div class="note">求解中… 交替优化 ' + unlock.length + ' 个系统，逐一黑盒试算中</div>';
      const applyBtn = $('#comboApply'); if (applyBtn) applyBtn.disabled = true;
      // 让浏览器先画出"求解中"
      setTimeout(() => {
        try {
          const t0 = Date.now();
          const res = window.ComboSolver.solveCombo({
            cfg: cfg(), unlock, locked, rounds: 2, duration: Math.min(20, state.duration),
            onProgress: p => { const b = $('#comboResult'); if (b) b.innerHTML = `<div class="note">${p.stage} · ${p.pct}% · 当前 ${fmt(p.dps)}</div>`; }
          });
          _comboResult = res;
          const sysNames = unlock.map(s => (window.ComboSolver.SYS_LABEL[s] || s)).join('、');
          if (resBox) resBox.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)">
              <div style="background:var(--panel);padding:10px 12px"><div class="k" style="font-size:9.5px;color:var(--dim)">起始秒伤</div><div class="num" style="font-size:17px">${fmt(res.startDps)}</div></div>
              <div style="background:var(--panel);padding:10px 12px"><div class="k" style="font-size:9.5px;color:var(--dim)">优化后</div><div class="num gold" style="font-size:17px">${fmt(res.dps)}</div></div>
              <div style="background:var(--panel);padding:10px 12px"><div class="k" style="font-size:9.5px;color:var(--dim)">提升</div><div class="num green" style="font-size:17px">+${res.gainPct.toFixed(1)}%</div></div>
            </div>
            <div class="note" style="margin-top:8px;font-size:10px;line-height:1.7">优化系统：${sysNames} · 锁定：${locked.length ? locked.map(s => window.ComboSolver.SYS_LABEL[s] || s).join('、') : '无'} · ${res.history.length - 1} 步 · ${Date.now() - t0}ms<br>${res.note}</div>`;
          if (applyBtn) applyBtn.disabled = false;
        } catch (e) {
          const b = $('#comboResult'); if (b) b.innerHTML = '<div class="note red">求解失败：' + String(e.message || e) + '</div>';
        }
      }, 60);
    };
    const apply = $('#comboApply');
    if (apply) apply.onclick = () => {
      if (!_comboResult) return;
      const r = _comboResult;
      // 把结果 cfg 的相关字段写回 state
      const c = r.cfg;
      if (c.legendaries) state.legendaries = c.legendaries.slice();
      if (c.gems) state.gems = c.gems;
      if (c.minionId !== undefined) state.minionId = c.minionId;
      if (c.minionSynergy !== undefined) state.minionSynergy = c.minionSynergy;
      if (c.runeSlots) state.runeSlots = c.runeSlots;
      if (c.runes !== undefined) { /* runeSlots 已含，cfg 会重建 */ }
      if (c.talents && state._comboUnlock && state._comboUnlock.indexOf('talents') >= 0) state.talents = c.talents;
      if (c.gearBuild && state._comboUnlock && state._comboUnlock.indexOf('affix') >= 0) {
        state.gearBuild = c.gearBuild;
        if (c.targetIlvl) state.gear = Object.assign(state.gear, { name: '目标装分 ' + c.targetIlvl });
      }
      // 技能仅当未锁定时应用
      if (c.skills && !(($('#comboKeepSkills') || {}).checked)) state.skills = c.skills;
      syncAllInputs(); safeRun('技能槽', renderSlots); safeRun('符文六槽', renderRuneSlots); safeRun('仆从', renderMinions);
      state._cache = {}; state._affixCache = null; state._gearKey = null;
      recomputeAll(); toast('已应用组合最优解');
    };
  }

  function bindSolver() {
    safeRun('组合求解', bindCombo);
    if ($('#svTierQuick')) $('#svTierQuick').onclick = () => {
      if (svHandle) return; svTier = 'quick'; renderSolver(); selectTemplate(svActiveId);
    };
    if ($('#svTierStd')) $('#svTierStd').onclick = () => {
      if (svHandle) return; svTier = 'standard'; renderSolver(); selectTemplate(svActiveId);
    };
    if ($('#svStart')) $('#svStart').onclick = startSolve;
    if ($('#svCancel')) $('#svCancel').onclick = cancelSolve;
  }

  /* ------------------------------------------------------------ minions */
  const BONUS_LABEL = {
    all: '全伤害', physical: '物理', fire: '火焰', cold: '冰霜', lightning: '闪电', poison: '毒素', arcane: '奥术',
    basic: '基础', strong: '强力', special: '特殊', dot: '持续',
    healthy: '健康', injured: '受伤', slowed: '减速', immobilized: '定身', elite: '精英',
    bleeding: '流血', poisoned: '中毒', burning: '燃烧', distant: '远处', vulnerable: '易伤',
    cc: '暴击率', cd: '暴伤', as: '攻速', cdr: '冷却', manaMax: '最大法力',
    str: '力量', dex: '敏捷', int: '智力'
  };
  const bonusText = m => Object.keys(m.bonus || {}).map(k => {
    if (k === 'vs') return Object.entries(m.bonus.vs).map(([x, v]) => `对${BONUS_LABEL[x] || x} +${v}%`).join('，');
    if (k === 'dmg') return Object.entries(m.bonus.dmg).map(([x, v]) => `${BONUS_LABEL[x] || x} +${v}%`).join('，');
    if (k === 'stat') return Object.entries(m.bonus.stat).map(([x, v]) => `${BONUS_LABEL[x] || x} +${v}${x === 'manaMax' ? '' : '%'}`).join('，');
    if (k === 'statPct') return Object.entries(m.bonus.statPct).map(([x, v]) => `${BONUS_LABEL[x] || x} +${v}%`).join('，');
    if (k === 'mana') return '法力消耗 -10%';
    if (k === 'def') return '防御向';
    return '';
  }).filter(Boolean).join('；') || '防御向被动';

  /* 真源成长口径：被动值(L) = base × (1 + bonusPerLevel × (eff-1))。
     只放大数值型被动（vs/dmg/stat/statPct/mana），mana/def 等描述型保持原文。 */
  const bonusTextAtLevel = (m, eff) => {
    const ratio = m.bonusPerLevel || 0;
    const k = 1 + ratio * Math.max(0, (eff || 1) - 1);
    const fmt = v => (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1));
    return Object.keys(m.bonus || {}).map(key => {
      const scale = v => fmt(v * k);
      if (key === 'vs') return Object.entries(m.bonus.vs).map(([x, v]) => `对${BONUS_LABEL[x] || x} +${scale(v)}%`).join('，');
      if (key === 'dmg') return Object.entries(m.bonus.dmg).map(([x, v]) => `${BONUS_LABEL[x] || x} +${scale(v)}%`).join('，');
      if (key === 'stat') return Object.entries(m.bonus.stat).map(([x, v]) => `${BONUS_LABEL[x] || x} +${scale(v)}${x === 'manaMax' ? '' : '%'}`).join('，');
      if (key === 'statPct') return Object.entries(m.bonus.statPct).map(([x, v]) => `${BONUS_LABEL[x] || x} +${scale(v)}%`).join('，');
      if (key === 'mana') return '法力消耗 -10%';
      if (key === 'def') return '防御向';
      return '';
    }).filter(Boolean).join('；') || '防御向被动';
  };

  /* ---------------- 仆从第 13 件装备（affix.js 真实词条池 / 数值公式） ---------------- */
  const MN13_RARITIES = [
    { id: 'rare', name: '稀有' }, { id: 'legendary', name: '传奇' },
    { id: 'ancient', name: '古代（满掷）' }, { id: 'blackMist', name: '黑雾（满掷）' }
  ];
  function mn13Slots() {
    const AF = window.AffixMath;
    if (!AF || !AF.SLOT_POOLS) return [];
    return Object.keys(AF.SLOT_POOLS).map(Number)
      .filter(k => AF.SLOT_POOLS[k].sockets === 0 && AF.SLOT_POOLS[k].length > 0);
  }
  const mn13StatLabel = st => {
    const AF = window.AffixMath;
    return (AF && AF.STAT_NAMES && AF.STAT_NAMES[st]) || ('词条' + st);
  };
  function mn13BuildFromUI() {
    const slot = parseInt(($('#mn13Slot') || {}).value, 10) || mn13Slots()[0] || 5;
    const main = parseInt(($('#mn13Main') || {}).value, 10);
    const sec = parseInt(($('#mn13Sec') || {}).value, 10);
    const rarity = ($('#mn13Rarity') || {}).value || 'legendary';
    const ilvl = parseInt(($('#mn13Ilvl') || {}).value, 10) || 700;
    const roll = (parseInt(($('#mn13Roll') || {}).value, 10) || 100) / 100;
    return {
      name: '仆从第13件', ilvl, rarity,
      ancient: rarity === 'ancient', blackMist: rarity === 'blackMist',
      classKey: state.classKey, element: state.element,
      slots: [{ slot, main: isFinite(main) ? [main] : [], secondary: isFinite(sec) ? [sec] : [], roll }]
    };
  }
  function mn13Preview(build) {
    const AF = window.AffixMath;
    if (!AF || !AF.buildGear) return '词条模块未加载，无法预览。';
    const rarity = build.blackMist || build.ancient ? 'legendary' : build.rarity;
    const effRoll = build.slots[0].roll * (build.blackMist || build.ancient ? 1.15 : 1);
    const lines = [];
    build.slots.forEach(sl => {
      (sl.main || []).forEach(st => lines.push(`主 · ${mn13StatLabel(st)} <b class="gold">+${AF.affixValue(build.ilvl, rarity, st, effRoll)}</b>`));
      (sl.secondary || []).forEach(st => lines.push(`副 · ${mn13StatLabel(st)} <b class="gold">+${AF.affixValue(build.ilvl, rarity, st, effRoll)}</b>`));
    });
    let g = null;
    try { g = AF.buildGear(Object.assign({}, cfg(), { gearBuild: build })); } catch (e) { }
    const mods = g ? [
      ['主属性', g.main], ['暴击率', g.cc], ['暴伤', g.cd], ['攻速', g.as],
      ['元素伤', g.ele], ['类型伤', g.type], ['全伤', g.all],
      ['对精英', g.vsElite], ['对易伤', g.vsVuln], ['冷却', g.cdr]
    ].filter(x => x[1] > 0).map(x => `${x[0]} +${Math.round(x[1])}`) : [];
    return `${lines.join('　') || '未选词条'}<br><span class="dim">并入玩家属性池：${mods.join('，') || '无有效输出词条'}</span>`;
  }
  function mn13FillStats(slot, keepMain, keepSec) {
    const AF = window.AffixMath;
    const pool = AF.SLOT_POOLS[slot] || [];
    const sec = pool.secondary || [];
    const mainSel = $('#mn13Main'), secSel = $('#mn13Sec');
    const opt = (st, roll) => `<option value="${st}">${mn13StatLabel(st)}（${AF.affixValue(700, 'legendary', st, roll)}）</option>`;
    if (mainSel) {
      mainSel.innerHTML = pool.map(st => opt(st, 1)).join('');
      if (pool.map(String).indexOf(String(keepMain)) >= 0) mainSel.value = String(keepMain);
    }
    if (secSel) {
      secSel.innerHTML = '<option value="">无</option>' + sec.map(st => opt(st, 1)).join('');
      if (sec.map(String).indexOf(String(keepSec)) >= 0) secSel.value = String(keepSec);
    }
  }
  /* 协同被动槽（真源 SlaveData.Passives）：10 级有效技能等级解锁。
     主仆从可带一个"已培养至 10 级的其他仆从的被动"，按 Base+PerLevel×9 注入。 */
  function renderSynergy() {
    const sel = $('#mnSynergy');
    if (!sel) return;
    const MD = window.MinionData;
    const eff = (() => {
      const M = D.MECHANICS.minion;
      const lv = Math.max(M.levelMin, Math.min(M.levelMax, state.minionLevel != null ? state.minionLevel : M.levelMax));
      return lv + (state.minionReins ? M.reinsBonus : 0);
    })();
    const unlocked = eff >= (D.MECHANICS.minion.synergyStar || 10);
    const hint = $('#mnSynStarHint');
    if (hint) hint.textContent = unlocked ? '已解锁' : `需有效等级 10（当前 ${eff}）`;
    sel.innerHTML = '<option value="">— 不带协同被动 —</option>';
    if (!MD || !MD.PASSIVES) return;
    // 按仆从分组，组内按 statName
    const bySlave = {};
    MD.PASSIVES.forEach((p, idx) => {
      const k = p.slave + '|' + p.stat;
      (bySlave[p.slaveZh] || (bySlave[p.slaveZh] = [])).push({ k, p, idx });
    });
    Object.keys(bySlave).forEach(zname => {
      const og = el('optgroup'); og.label = zname;
      bySlave[zname].forEach(x => {
        const o = el('option'); o.value = x.k;
        o.textContent = x.p.statName + ' · ' + x.p.text.replace(x.p.statName + ' ', '');
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    const cur = state.minionSynergy;
    const curKey = cur && cur.slave != null ? (cur.slave + '|' + cur.stat) : '';
    if (curKey) sel.value = curKey;
    sel.disabled = !unlocked;
    const desc = $('#mnSynDesc');
    if (desc && cur && (MD.PASSIVES || []).length) {
      const p = MD.PASSIVES.find(x => x.slave === cur.slave && x.stat === cur.stat);
      desc.innerHTML = p && unlocked
        ? `<b class="gold">${p.slaveZh} · ${p.statName}</b>：${p.text}（真源 Base+PerLevel×9，10 级固定值）`
        : '10 星（有效等级 10）主仆从可额外携带一个已培养至 10 级的其他仆从的被动。';
    }
  }

  function renderMn13() {
    const AF = window.AffixMath;
    const preview = $('#mn13Preview');
    if (!AF || !preview) { if (preview) preview.textContent = '词条模块未加载。'; return; }
    const M = D.MECHANICS.minion;
    txt('#mn13Star', M.gearStar);
    const slots = mn13Slots();
    const slotSel = $('#mn13Slot');
    const build = state.minionGearBuild;
    const curSlot = build && build.slots[0] ? build.slots[0].slot : (slots[0] || 5);
    if (slotSel && slotSel.dataset.slotList !== String(slots.join(','))) {
      slotSel.innerHTML = slots.map(k => `<option value="${k}">${AF.SLOT_POOLS[k].name || ('部位' + k)}（无宝石孔）</option>`).join('');
      slotSel.dataset.slotList = String(slots.join(','));
    }
    if (slotSel) slotSel.value = String(curSlot);
    const rarSel = $('#mn13Rarity');
    if (rarSel && !rarSel.options.length) {
      rarSel.innerHTML = MN13_RARITIES.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }
    if (rarSel) rarSel.value = build ? (build.rarity === 'ancientDivine' ? 'legendary' : build.rarity) : 'legendary';
    const curMain = build && build.slots[0] ? build.slots[0].main[0] : (AF.SLOT_POOLS[curSlot] || [])[0];
    const curSec = build && build.slots[0] ? build.slots[0].secondary[0] : null;
    mn13FillStats(curSlot, curMain, curSec);
    const ilvl = $('#mn13Ilvl'); if (ilvl) ilvl.value = build ? build.ilvl : 700;
    const roll = $('#mn13Roll');
    const rollVal = build && build.slots[0] ? build.slots[0].roll : 1;
    if (roll) roll.value = Math.round(rollVal * 100);
    txt('#mn13RollVal', rollVal.toFixed(2));
    const on = $('#mn13On'), gate = $('#mn13Gate');
    if (on) on.checked = !!state.minionGearBuild;
    if (gate) gate.checked = state.minionGearGate !== false;
    preview.innerHTML = mn13Preview(build || mn13BuildFromUI());
  }
  function mn13Apply() {
    const on = $('#mn13On');
    state.minionGearBuild = on && on.checked ? mn13BuildFromUI() : null;
    const gate = $('#mn13Gate');
    state.minionGearGate = gate ? gate.checked : true;
    state._cache = {}; state._gearKey = null; state._affixCache = null;
    scheduleDraft();
    recomputeAll();
    renderMinions();
  }

  function renderMinions() {
    const grid = $('#minionGrid'); grid.innerHTML = '';
    D.MINIONS.forEach(m => {
      const d = el('div', 'minion' + (m.id === state.minionId ? ' on' : ''));
      d.innerHTML = `<div class="top"><span class="nm">${m.name}</span><span class="rar ${m.rarity}">${m.rarity}</span></div>
        <div class="bo">${bonusText(m)}</div><div class="cap">车厢容量 ${m.cap}</div>`;
      d.onclick = () => { state.minionId = m.id; state._cache = {}; state._gearKey = null; state._affixCache = null; renderMinions(); recomputeAll(); };
      grid.appendChild(d);
    });
    const cur = D.MINIONS.find(m => m.id === state.minionId);
    $('#minionCurrent').textContent = cur ? `${cur.name} · ${cur.rarity}` : '—';
    renderMinionPanel();
  }

  function renderMinionPanel() {
    const M = D.MECHANICS.minion;
    const r = state._result;
    const info = r && r.minion;
    const lv = state.minionLevel;
    const eff = state.minionReins ? lv + M.reinsBonus : lv;
    const curMin = (D.MINIONS || []).find(m => m.id === state.minionId);
    txt('#phMinion', curMin ? curMin.name : '—');
    txt('#phMinionLv', eff + (state.minionReins ? '（含缰绳）' : ''));
    $('#mnLevel').value = lv;
    $('#mnLevelVal').textContent = lv;
    $('#mnReins').checked = !!state.minionReins;

    renderMn13();
    renderSynergy();

    const stars = [];
    for (let i = 1; i <= M.levelMax; i++) stars.push(i);
    $('#mnStars').innerHTML = `
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
        ${stars.map(i => `<span class="star${i <= eff ? ' on' : ''}" title="${i}">★</span>`).join('')}
      </div>
      <div class="note" style="font-size:10.5px;line-height:1.8">
        <div>${eff >= M.gearStar ? '<b class="gold">5 级</b>：已解锁仆从装备' : '<span class="dim">5 级：解锁仆从装备</span>'}</div>
        <div>${eff >= M.synergyStar ? '<b class="gold">10 级</b>：已解锁协同被动槽' : '<span class="dim">10 级：解锁协同被动槽</span>'}</div>
        <div class="dim" style="margin-top:6px">缰绳的 +${M.reinsBonus} 级对每个被动/主动技能都生效，可超过等级上限。</div>
      </div>`;

    if (!info) { $('#mnDetail').innerHTML = '<div class="note">未选择仆从。</div>'; return; }
    const growth = curMin && curMin.bonusPerLevel ? curMin.bonusPerLevel : 0;
    const baseTxt = bonusText(curMin);
    const lvTxt = bonusTextAtLevel(curMin, info.eff);
    const grew = growth > 0 && info.eff > 1;
    const abil = info.ability || [];
    const abilTxt = abil.length ? abil.map(a => `${a.zh}<span class="tag ${a.kind === 'buff' ? 'b' : 'sp'}">${a.kind === 'buff' ? '增益' : '伤害'}</span>`).join('、') : '无主动技能（多数仆从只有被动）';
    const synTxt = info.synergy ? `${info.synergy.slaveZh} · ${info.synergy.text}` : '—';
    $('#mnDetail').innerHTML = `
      <div class="field"><label>被动加成（${grew ? 'L' + info.eff + ' 成长后' : '1 级基准'}</label><span class="num">${grew ? lvTxt : baseTxt}</span></div>
      ${grew ? `<div class="field"><label>被动成长系数</label><span class="num">每级 +${(growth * 100).toFixed(growth < 0.1 ? 2 : 1)}%（相对 1 级）· 真源 PerLevel/Base</span></div>
      <div class="field"><label>1 级基准值</label><span class="num dim">${baseTxt}</span></div>` : ''}
      <div class="field"><label>技能等级 / 强化后</label><span class="num">${info.level} → ${info.eff}${state.minionReins ? '（缰绳 +' + M.reinsBonus + '）' : ''}</span></div>
      <div class="field"><label>主动技能</label><span class="num">${abilTxt}</span></div>
      <div class="field"><label>协同被动（10 级）</label><span class="num gold">${synTxt}</span></div>
      <div class="field"><label>仆从装备</label><span class="num">${info.gear === 'custom' ? '自定义词条（5 级解锁）' : '—'}</span></div>
      <div class="note" style="margin-top:10px">
        仆从只有被动稳定作用于角色；<b>主动技能多数是给角色加增益/状态</b>（治愈/顺风/护壳/法力…），
        真源 Effects 未展开伤害倍率，故<b>不计入 DPS</b>，仅作机制标注。被动随有效等级成长（真源 <b>Base + PerLevel×(L-1)</b>）。
      </div>`;
  }

  function bindMinions() {
    const lv = $('#mnLevel'), reins = $('#mnReins'), gear = $('#mnGear');
    if (lv) lv.addEventListener('input', e => {
      state.minionLevel = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
      state._cache = {}; state._gearKey = null; state._affixCache = null;
      $('#mnLevelVal').textContent = state.minionLevel;
      renderMinions(); recomputeAll();
    });
    if (reins) reins.addEventListener('change', e => {
      state.minionReins = e.target.checked;
      state._cache = {}; state._gearKey = null; state._affixCache = null;
      renderMinions(); recomputeAll();
    });
    if (gear) gear.addEventListener('change', e => {
      state.minionGear = e.target.value;
      state._cache = {}; recomputeAll();
    });
    const synSel = $('#mnSynergy');
    if (synSel) synSel.addEventListener('change', e => {
      const v = e.target.value;
      if (!v) state.minionSynergy = null;
      else {
        const [slave, stat] = v.split('|');
        state.minionSynergy = { slave, stat: parseInt(stat, 10) };
      }
      state._cache = {}; recomputeAll();
      safeRun('协同被动', renderSynergy);
    });
    const m13on = $('#mn13On'), m13gate = $('#mn13Gate');
    if (m13on) m13on.addEventListener('change', () => { mn13Apply(); toast(m13on.checked ? '仆从装备已启用' : '仆从装备已关闭'); });
    if (m13gate) m13gate.addEventListener('change', () => { mn13Apply(); toast(m13gate.checked ? '遵守训练等级门槛' : '已忽略训练等级门槛（按达标等级计入）'); });
    [['#mn13Slot', 'change'], ['#mn13Rarity', 'change'], ['#mn13Ilvl', 'change'],
     ['#mn13Main', 'change'], ['#mn13Sec', 'change'], ['#mn13Roll', 'input']].forEach(pair => {
      const node = $(pair[0]);
      if (!node) return;
      node.addEventListener(pair[1], () => {
        if (pair[0] === '#mn13Roll') txt('#mn13RollVal', (parseInt(node.value, 10) / 100).toFixed(2));
        if (pair[0] === '#mn13Slot') {
          const b = state.minionGearBuild || mn13BuildFromUI();
          mn13FillStats(+node.value, b.slots[0] && b.slots[0].main[0], b.slots[0] && b.slots[0].secondary[0]);
        }
        if (state.minionGearBuild) mn13Apply();
        else {
          const pv = $('#mn13Preview');
          if (pv) pv.innerHTML = mn13Preview(mn13BuildFromUI());
        }
      });
    });
  }

  function bindAgent() {
    const send = () => askAgent($('#agInput').value);
    if ($('#agSend')) $('#agSend').addEventListener('click', send);
    if ($('#agInput')) $('#agInput').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  /* ------------------------------------------------------------ 智能体 */
  let KB = null;
  let KB_TRIED = false;

  async function loadKB() {
    if (KB || KB_TRIED) return KB;
    KB_TRIED = true;
    // 优先用 <script> 注入的全局数据：file:// 直接打开时 fetch 本地 json 会被浏览器禁止
    if (typeof window !== 'undefined' && window.DESKRAWL_KB) {
      KB = window.DESKRAWL_KB;
      return KB;
    }
    // http 场景下兜底/热更新
    try {
      const r = await fetch('./agent/kb.json');
      if (r.ok) KB = await r.json();
    } catch (e) { KB = null; }
    return KB;
  }

  const STOP = ['怎么', '什么', '多少', '么算', '怎样', '为何', '为什', '可以', '需要', '一个', '这个', '那个', '现在', '如何', '请问', '一下', '我的', '应该', '还是', '比较', '么样'];

  function grams(s) {
    const t = String(s).replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '').toLowerCase();
    const out = [];
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      if (!STOP.includes(g)) out.push(g);
    }
    return out;
  }

  function sections(kb) {
    const out = [];
    (kb ? kb.docs : []).forEach(d => {
      const parts = d.text.split(/\n## /);
      parts.forEach((p, i) => {
        const title = (i === 0 ? p.split('\n')[0] : p.split('\n')[0]).replace(/^#\s*/, '');
        out.push({ doc: d.id, title, text: i === 0 ? p : '## ' + p });
      });
    });
    return out;
  }

  let SEC = null;
  function retrieve(q, k) {
    if (!KB) return [];
    if (!SEC) SEC = sections(KB);
    const g = grams(q);
    const uniq = [...new Set(g)];
    const scored = SEC.map(s => {
      const t = s.text.toLowerCase();
      let hit = 0;
      uniq.forEach(x => { if (t.includes(x)) hit += 1; });
      const tg = grams(s.title);
      const th = tg.filter(x => uniq.includes(x)).length;
      // 标题命中权重远高于正文命中，避免泛化段落压过专门章节
      const score = th * 10 + hit;
      return { ...s, score, hit, th };
    }).filter(x => x.hit >= 1 && (x.th > 0 || x.hit >= 2)).sort((a, b) => b.score - a.score);
    return scored.slice(0, k || 3);
  }

  const ALL_AB = () => {
    const out = [];
    Object.entries(D.CLASSES).forEach(([k, c]) => {
      [...c.basics, ...c.strongs, ...c.specials].forEach(a => out.push({ ...a, cls: k }));
    });
    return out;
  };

  function findSkillInQuery(q) {
    const all = ALL_AB();
    return all.find(a => q.includes(a.name)) || null;
  }

  function findLegInQuery(q) {
    return D.LEGENDARIES.find(L => q.includes(L.name)) || null;
  }

  const SLOT_CN = { weapon: '武器', helm: '头盔', shoulder: '肩甲', chest: '胸甲', gloves: '手套', belt: '腰带', pants: '护腿', boots: '靴子', neck: '项链', ring: '戒指', back: '披风' };
  const SLOT_EN = Object.fromEntries(Object.entries(SLOT_CN).map(([k, v]) => [v, k]));

  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }

  /* 组装回答：返回 { html, trace } */
  function answer(q) {
    const raw = q.trim();
    const qq = raw.toLowerCase();
    const cur = state._result;
    const agg = cur.agg;
    const cls = D.CLASSES[state.classKey];
    const hitWord = ['单跳', '一跳', '每跳', '多少伤害', '打多少', '倍率'].some(w => raw.includes(w));
    const dpsWord = ['秒伤', 'dps', '多久', '击杀', '快不快', '输出'].some(w => qq.includes(w));
    const affixWord = ['词条', '词缀', '附魔', '选什么', '优先', '配装'].some(w => raw.includes(w));
    const talentWord = ['天赋', '点法', '怎么点', '加点'].some(w => raw.includes(w));
    const minionWord = ['仆从', '宠物', '缰绳', '共鸣', '车厢'].some(w => raw.includes(w));
    const mechWord = ['静电', '易伤', '全伤', '乘区', '暴击', '公式', '独立', '加算', '脆裂', '霜裂', '暴击伤害', '受到伤害', '受伤增加', '元素伤', '类型伤', 'dot', '持续伤害'].some(w => qq.includes(w));
    const verWord = ['版本', '更新', '补丁', 'patch'].some(w => qq.includes(w));

    const skill = findSkillInQuery(raw);
    const leg = findLegInQuery(raw);
    const trace = [];

    /* 1) 单跳 */
    if (skill && (hitWord || qq.includes('伤害'))) {
      const c2 = {
        elite: state.enemy.elite, armor: state.enemy.armor, mr: state.enemy.mr,
        enemyLevel: 70, critDR: state.enemy.critdr / 100,
        healthyUptime: 1, injuredUptime: 1,
        slowedUptime: 1, immobilizedUptime: 1,
        distant: 1, count: state.enemy.count,
        vulnUptime: 1,
        electroStacks: state.electroStacks != null ? state.electroStacks : cur.electroStacks
      };
      const z = E.hitZones(agg, skill, c2);
      const rows = z.zones.map((x, i) => {
        const acc = z.zones.slice(0, i + 1).reduce((a, y, j) => (j === 0 ? y.value : a * y.mult), 1);
        return `<span>${x.name}</span><span>×${x.mult.toFixed(2)}</span>`;
      }).join('');
      trace.push({ t: '调用 hitZones()', b: `${skill.name} · ${skill.pct}%${z.hits > 1 ? ' × ' + z.hits + ' 段' : ''} → ${fmt2(z.total)}`, k: 'engine.js · zoneSet' });
      return {
        html: `<b>${skill.name}</b> 在当前面板 + 当前对敌模型下，单跳期望 <b>${fmt2(z.total)}</b>，约 <code>×${(z.total / agg.weaponDamage).toFixed(1)}</code> 武器伤害。${z.hits > 1 ? `（${z.hits} 段合计）` : ''}
          <div class="kv">${rows}</div>
          口径：单跳瞬时——假设这一发命中时目标带易伤且条件成立，<b>不摊覆盖率</b>。要算平均秒伤请用总览。
          <div class="src">技能页的「单发期望」用的就是这个函数</div>`,
        trace
      };
    }

    /* 2) 秒伤 */
    if (dpsWord && !affixWord) {
      const rows = Object.entries(cur.breakdown).filter(([, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg)
        .map(([k, v]) => `<span>${abName(k)}</span><span>${(v.dmg / cur.total * 100).toFixed(1)}%</span>`).join('');
      trace.push({ t: '调用 simulate()', b: `${cls.name} · ${cur.duration}s · ${fmt(cur.dps)} / 秒`, k: 'engine.js · 0.05s 逐帧' });
      return {
        html: `当前构筑秒伤 <b>${fmt(cur.dps)}</b>（约 <code>×${(cur.dpsPct/100).toFixed(0)}</code> 武器伤害/秒），有效生命 ${fmt(state.enemy.hp)} 的目标 ${(state.enemy.hp / cur.dps).toFixed(1)} 秒打完。
          <div class="kv">${rows}</div>
          想要更高，先看占比最大的那项：它的乘区是不是已经堆满了。换一件装备前，用装备页算一下净收益。
          <div class="src">口径：${D.VERSION.game} · ${state.enemy.name} · ${state.gear.name}</div>`,
        trace
      };
    }

    /* 3) 词条 */
    if (affixWord) {
      let slot = state.slot;
      for (const [cn, en] of Object.entries(SLOT_EN)) if (raw.includes(cn)) slot = en;
      const res = E.rankAffixes(Object.assign(cfg(), { slot }), { duration: 30, lite: true });
      const top = res.list.slice(0, 5);
      trace.push({ t: '调用 rankAffixes()', b: `${SLOT_CN[slot]} · 试算 ${res.list.length} 条词缀 · 最优 ${top[0] ? top[0].name : '—'}`, k: 'engine.js · 30s lite' });
      return {
        html: `<b>${SLOT_CN[slot]}</b> 部位现在追加一条 ilvl700 中值词条，收益排序：
          <div class="kv">${top.map((a, i) => `<span>${i + 1}. ${a.name}</span><span>${fmtPct(a.delta)}</span>`).join('')}</div>
          这是"从当前面板再加一条"的边际收益，不是绝对值。同一个乘区堆得越高，同数值的收益越低——所以榜单会随你的配装变化。
          <div class="src">如果想看别的部位，问"头盔词条怎么选"这种</div>`,
        trace
      };
    }

    /* 4) 天赋 */
    if (talentWord) {
      const pts = Object.values(state.talents).reduce((a, b) => a + b, 0);
      const list = Object.entries(state.talents).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const nameOf = id => {
        for (const row of cls.talents) { const t = row.items.find(i => i.id === id); if (t) return t.name; }
        return id;
      };
      trace.push({ t: '读取当前天赋', b: `${pts} 点 · ${list.length} 个天赋`, k: 'state.talents' });
      return {
        html: `当前 <b>${pts}/70</b> 点，主要投入：
          <div class="kv">${list.map(([k, v]) => `<span>${nameOf(k)}</span><span>${v} 点</span>`).join('')}</div>
          10 / 30 / 60 三行是三选一，换专精要把已点的先退掉。要我按当前技能组重算一遍最优分配，点天赋页的「自动规划」——它会逐点比较边际收益，包含专精门槛。
          <div class="src">自动规划是贪心 + 单点交换精修，不是全局最优，但通常优于手点</div>`,
        trace
      };
    }

    /* 5) 仆从 */
    if (minionWord) {
      const info = cur.minion;
      const M = D.MECHANICS.minion;
      trace.push({ t: '读取仆从状态', b: info ? `${info.name} Lv${info.level} → ${info.eff}` : '未选择', k: 'MECHANICS.minion' });
      if (!info) return { html: '当前没有出战仆从。到仆从页选一只。', trace };
      return {
        html: `出战中：<b>${info.name}</b>，技能等级 ${info.level}${state.minionReins ? ` + ${M.reinsBonus}（缰绳）= ${info.eff}` : ''}。
          <div class="kv">
            <span>被动</span><span>${bonusText(D.MINIONS.find(m => m.id === info.id))}</span>
            <span>5 级装备槽</span><span>${info.eff >= M.gearStar ? '已解锁' : '未解锁'}</span>
            <span>协同被动</span><span>${info.synergy ? info.synergy.text : '未配置'}</span>
            <span>主动技能</span><span>${(info.ability || []).map(a => a.zh).join('、') || '无'}</span>
          </div>
          注意：<b>被动随技能等级成长</b>，缰绳的 +${M.reinsBonus} 级对每个被动/主动技能都生效；仆从主动技能多数是给角色加增益，真源未展开伤害倍率，故不计入 DPS。
          <div class="src">只有召唤中的那只生效，换仆从要回城</div>`,
        trace
      };
    }

    /* 6) 具体传奇 */
    if (leg) {
      const on = state.legendaries.includes(leg.id);
      const same = state.legendaries.filter(id => { const x = D.LEGENDARIES.find(y => y.id === id); return x && x.slot === leg.slot && id !== leg.id; });
      const conf = { official: '数值可直接用', modeled: '需要覆盖率折算，不是实测', none: '该基底没有被动' }[leg.conf];
      trace.push({ t: '查询传奇', b: `${leg.name} · ${leg.slot} · ${leg.conf}`, k: 'data.js · LEGENDARIES' });
      return {
        html: `<b>${leg.name}</b>（${leg.slot}${leg.lvl > 1 ? ` · Lv${leg.lvl}` : ''}${leg.cls ? ' · ' + leg.cls.map(k => D.CLASSES[k].name).join('/') : ' · 通用'}）<br>${leg.text}
          <div class="kv">
            <span>数值口径</span><span>${conf}</span>
            <span>当前状态</span><span>${on ? '已装备' : '未装备'}</span>
            <span>同部位占用</span><span>${same.length ? same.map(x => (D.LEGENDARIES.find(y => y.id === x) || {}).name).join('、') : '无'}</span>
          </div>
          ${leg.conf === 'modeled' ? '这件需要假设覆盖率（击杀后、站定、喝药），实际收益取决于你的战斗节奏，别把这里的数字当实测。' : ''}
          想确认净值，勾上它看总览秒伤变化，再和同部位替代品比。
          <div class="src">同部位只能带 1 件，戒指 2 件</div>`,
        trace
      };
    }

    /* 7) 版本 */
    if (verWord) {
      const p = D.PATCHES.slice(0, 3);
      trace.push({ t: '版本数据', b: `${D.VERSION.game} · ${D.VERSION.gameDate}`, k: 'data.js · PATCHES' });
      return {
        html: `当前数据集 <b>${D.VERSION.game}</b>（${D.VERSION.gameDate}），技能按 10/10 级、等级 70、ilvl700 传奇基准。<br><br>
          ${p.map(x => `<b>${x.v}</b> <span class="dim">${x.d}</span><br>${x.items.join(' · ')}`).join('<br><br>')}
          <div class="src">版本更迭只改 data.js，再跑 build-kb.mjs 重建知识库</div>`,
        trace
      };
    }

    /* 8) 机制 */
    if (mechWord) {
      const hits = retrieve(raw, 2);
      hits.forEach(h => trace.push({ t: h.title, b: h.text.replace(/^#+\s*/gm, '').slice(0, 180) + '…', k: `knowledge · ${h.doc}` }));
      const extra = [];
      if (raw.includes('静电')) extra.push(`你现在静电 <b>${cur.electroStacks} 层</b>，这一项对闪电伤害贡献 ×${(1 + D.MECHANICS.status.electrostatic.perStack * cur.electroStacks / 100).toFixed(2)}，和易伤加算后整条"受伤"乘区是 ×${cur.zones ? (cur.zones.zones.find(x => x.id === 'taken') || {}).mult.toFixed(3) : '—'}。${cur.electroStacks ? '' : '（当前构筑没点静电充能，或者主技能不是闪电。）'}`);
      if (raw.includes('易伤')) extra.push(`当前易伤覆盖 <b>${state.enemy.vuln}%</b> → 目标受伤 ×${(1 + 0.3 * state.enemy.vuln / 100).toFixed(3)}；另有「对易伤目标 +${agg.vs.vulnerable}%」在条件伤乘区。`);
      if (raw.includes('全伤')) extra.push(`全伤当前 <b>${agg.all.toFixed(1)}%</b>，与元素伤 <b>${(agg[state.element] || 0).toFixed(0)}%</b> 加算，合计 ×${(1 + ((agg[state.element] || 0) + agg.all) / 100).toFixed(2)}。`);
      if (qq.includes('脆裂') || qq.includes('霜裂')) {
        const bs = state.brittleStacks || 0;
        const bz = pendingVal('brittleZone') || 'crit';
        const zoneName = bz === 'crit' ? '暴击区（只放大暴击部分）' : bz === 'taken' ? '受伤区（与易伤同通道）' : '未启用';
        const amp = (1 + 0.05 * bs).toFixed(2);
        extra.push(`脆裂当前 <b>${bs} 层</b>、归属 <b>${zoneName}</b>${bz === 'crit' ? ` → 暴击部分放大 ×${amp}` : ''}。每层 +5% 受到暴击伤害仅来自本地化文案，真源 SO 无数值、乘区归属无实证，属未决项；可在伤害计算页「目标状态·脆裂」改层数/归属，或在待裁决面板选口径/录实测。`);
      }
      if (raw.includes('乘区')) extra.push(`当前主技能有 ${cur.zones ? cur.zones.zones.length : 0} 个乘区，最大的一项是 <b>${cur.zones ? cur.zones.zones.slice(1).sort((a, b) => b.mult - a.mult)[0].name : '—'}</b>。`);
      const body = hits.map(h => `<b>${h.title}</b><br>${h.text.replace(/^#+.*\n/, '').replace(/\n{2,}/g, '<br>').slice(0, 520)}`).join('<hr style="border:0;border-top:1px solid #241d14;margin:10px 0">');
      return { html: (extra.length ? extra.join(' ') + '<br><br>' : '') + (body || '没找到对应片段，试试问"静电怎么算"、"易伤和全伤的区别"。'), trace };
    }

    /* 兜底 */
    const hits = retrieve(raw, 2);
    hits.forEach(h => trace.push({ t: h.title, b: h.text.slice(0, 160) + '…', k: `knowledge · ${h.doc}` }));
    return {
      html: `这个问题我还没把握直接算。可以换个问法，比如：<br>
        · <code>烈焰打击单跳多少</code><br>
        · <code>武器词条怎么选</code><br>
        · <code>静电怎么算</code><br>
        · <code>奥术之刃护胫值不值</code><br>
        · <code>现在秒伤多少</code><br>
        也可以直接说职业 + 目标 + 想解决的问题。`,
      trace
    };
  }

  function pushMsg(role, html) {
    const log = $('#agLog');
    const d = el('div', 'msg ' + role, html);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  async function askAgent(text) {
    const q = (text || '').trim();
    if (!q) return;
    pushMsg('me', q.replace(/</g, '&lt;'));
    $('#agInput').value = '';
    await loadKB();
    let out;
    try { out = answer(q); } catch (e) { out = { html: '计算时出错：' + e.message, trace: [] }; }
    pushMsg('bot', out.html);
    if (out.trace && out.trace.length) {
      $('#agTrace').innerHTML = out.trace.map(t => `<div class="trace"><div class="th">${t.t}</div><div class="tb">${t.b}</div><div class="tk">${t.k}</div></div>`).join('');
    }
    if (!KB) $('#agHint').textContent = '未加载知识库（file:// 下 fetch 受限）· 数值仍可算';
  }

  function renderAgent() {
    const panel = $('#agQuick');
    if (!panel) return;
    const cls = D.CLASSES[state.classKey] || { strongs: [] };
    const qs = ['现在秒伤多少', '主攻技能单跳多少', '武器词条怎么选', '静电怎么算', '奥术之刃护胫值不值', '天赋怎么点'];
    panel.innerHTML = '';
    qs.forEach(q => {
      const b = el('button', '', q);
      b.onclick = () => askAgent(q.replace('主攻技能', (cls.strongs[0] || {}).name || '烈焰打击'));
      panel.appendChild(b);
    });
    const log = $('#agLog');
    if (log && !log.dataset.init) {
      log.dataset.init = '1';
      pushMsg('bot', `我是这个实验室的顾问。数据版本 <b>${D.VERSION.game}</b>，当前构筑：${cls.name || '—'} · ${(state.gear && state.gear.name) || '—'} · ${state.enemy.name}。<br>
        我会直接调引擎算，不是背答案。问技能、词条、天赋、传奇、仆从、机制都行。`);
      loadKB().then(k => {
        txt('#phKb', k ? '已加载' : '未加载');
        if (!k && $('#agHint')) $('#agHint').textContent = '未加载知识库（用本地服务器打开可启用）· 数值仍可算';
      });
    }
  }

  /* ------------------------------------------------------------ model */
  function renderModel() {
    const pl = $('#patchList');
    if (pl) pl.innerHTML = (D.PATCHES || []).map(p => `<div style="margin-bottom:8px"><b class="gold">${p.v}</b> <span class="dim">${p.d}</span><div class="dim" style="font-size:10.5px;line-height:1.6">${p.items.join(' · ')}</div></div>`).join('');
    const dn = $('#dataNote');
    if (dn) dn.innerHTML = `当前数据集：<b>${D.VERSION.game}</b>（${D.VERSION.gameDate}），技能按 <b>10/10</b> 级、角色 70 级、物品等级 700 传奇基准。${D.VERSION.note}。<br>社区推算值（火元素命中数、法球命中次数、引导类 tick 数）已在技能说明中标注。`;
    txt('#phVer', D.VERSION.game);
    txt('#phDate', D.VERSION.dataDate);
  }

  /* ------------------------------------------------------------ saves */
  function tsLabel(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function autoName() {
    const c = D.CLASSES[state.classKey] || {};
    const set = ((c.sets) || []).find(x => x.id === state.setId);
    const preset = { starter: '起步', mid: '中配', end: '毕业' }[state._preset] || '中配';
    return [c.name, set ? set.name : '', preset].filter(Boolean).join(' · ').slice(0, 40);
  }

  /* 构筑指纹：比裸 DPS 更有意义的存档标记——脱离场景也稳定。
     格式：职业 · 套装N件 · 核心技能 · 天赋N点 · 装分档。
     裸 DPS 之所以会"存档显示≠载入后首页"，是因为它依赖保存那一刻的 duration /
     未决项裁决，而载入会用当前口径重算。指纹只描述构筑本身，不随场景漂移。 */
  function buildFingerprint(snap) {
    const s = snap || {};
    const c = D.CLASSES[s.classKey] || {};
    const all = [...(c.basics || []), ...(c.strongs || []), ...(c.specials || [])];
    const nm = id => { const a = all.find(x => x.id === id); return a ? a.name : null; };
    const set = ((c.sets) || []).find(x => x.id === s.setId);
    const sk = s.skills || {};
    const core = [nm(sk.basic), nm(sk.strong)].filter(Boolean).slice(0, 2).join('/') || '无技能';
    const tp = Object.values(s.talents || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const preset = ({ starter: '起步', mid: '中配', end: '毕业' })[s.preset] || '中配';
    const bits = [c.name || s.classKey || '—'];
    if (set) bits.push(set.name + (s.setCount ? s.setCount + '件' : ''));
    bits.push(core, tp + '点', preset);
    return bits.filter(Boolean).join(' · ').slice(0, 52);
  }

  /* ============================================================ 构筑方案
     每个板块独立保存多套预设，总方案 = 各板块各选一套的组合。 */
  const BUILDER_META = {
    skills:  { tab: 'character', icon: 'sword',   desc: '普攻/强攻/两个特殊技能（可留空）' },
    effects: { tab: 'character', icon: 'star',    desc: '传奇装备特效（最多 4 件）' },
    affix:   { tab: 'gear',      icon: 'shield',  desc: '装备数值 / 套装件数 / 目标装分' },
    gems:    { tab: 'gear',      icon: 'gem',     desc: '宝石镶嵌（6 家族 × 孔位）' },
    minion:  { tab: 'minions',   icon: 'paw',     desc: '出战仆从 / 协同被动 / 仆从装备' },
    talents: { tab: 'talents',   icon: 'tree',    desc: '天赋页（70 点分配）' },
    runes:   { tab: 'character', icon: 'rune',    desc: '符文六槽 + 套装件数' }
  };
  const BUILDER_ICONS = {
    sword: '<path d="M18 3l3 3-9 9-3-3zM9 12l-4 1 1-4z" stroke="currentColor" fill="none" stroke-width="1.5"/>',
    star: '<path d="M12 3l2.5 6h6l-5 4 2 6-5.5-4-5.5 4 2-6-5-4h6z" stroke="currentColor" fill="none" stroke-width="1.4"/>',
    shield: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z" stroke="currentColor" fill="none" stroke-width="1.4"/>',
    gem: '<path d="M12 3l6 6-6 12-6-12z" stroke="currentColor" fill="none" stroke-width="1.4"/>',
    paw: '<circle cx="8" cy="9" r="2"/><circle cx="16" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><path d="M12 12c-3 0-5 2-5 4s2 3 5 3 5-1 5-3-2-4-5-4z" stroke="currentColor" fill="none" stroke-width="1.3"/>',
    tree: '<path d="M12 21V8M12 12L7 7M12 14l5-5M7 7l-2-3M7 7l2-3M17 9l-2-3M17 9l2-3" stroke="currentColor" fill="none" stroke-width="1.3"/>',
    rune: '<path d="M12 2l8 10-8 10L4 12z" stroke="currentColor" fill="none" stroke-width="1.4"/><path d="M9 12h6M12 9v6" stroke="currentColor" stroke-width="1.3"/>'
  };
  function captureBlock(kind) {
    switch (kind) {
      case 'skills': return { skills: JSON.parse(JSON.stringify(state.skills)) };
      case 'effects': return { legendaries: state.legendaries.slice() };
      case 'affix': return { gear: JSON.parse(JSON.stringify(state.gear)), setId: state.setId, setCount: state.setCount, preset: state._preset, gearBuild: state.gearBuild || null };
      case 'gems': return { gems: JSON.parse(JSON.stringify(state.gems || {})) };
      case 'minion': return {
        minionId: state.minionId, minionLevel: state.minionLevel, minionReins: state.minionReins,
        minionStars: state.minionStars, minionSynergy: state.minionSynergy ? JSON.parse(JSON.stringify(state.minionSynergy)) : null,
        minionGear: state.minionGear, minionGearGate: state.minionGearGate,
        minionGearBuild: state.minionGearBuild ? JSON.parse(JSON.stringify(state.minionGearBuild)) : null
      };
      case 'talents': return { talents: JSON.parse(JSON.stringify(state.talents)) };
      case 'runes': return { runeSlots: JSON.parse(JSON.stringify(state.runeSlots || [])) };
      default: return {};
    }
  }
  function applyBlock(kind, data) {
    if (!data) return;
    const set = (k, v) => { if (v !== undefined) state[k] = v; };
    switch (kind) {
      case 'skills': set('skills', data.skills); break;
      case 'effects': set('legendaries', data.legendaries); break;
      case 'affix':
        set('gear', data.gear); set('setId', data.setId); set('setCount', data.setCount); set('gearBuild', data.gearBuild);
        if (data.preset) state._preset = data.preset; break;
      case 'gems': set('gems', data.gems); break;
      case 'minion':
        ['minionId', 'minionLevel', 'minionReins', 'minionStars', 'minionSynergy', 'minionGear', 'minionGearGate', 'minionGearBuild'].forEach(k => set(k, data[k])); break;
      case 'talents': set('talents', data.talents); break;
      case 'runes': set('runeSlots', data.runeSlots); break;
    }
  }
  function blockPreview(kind, data) {
    if (!data) return '';
    const nm = id => abName(id);
    switch (kind) {
      case 'skills': { const s = data.skills || {}; return [s.basic, s.strong, s.special1, s.special2].map(nm).filter(Boolean).join(' → ') || '全空'; }
      case 'effects': return (data.legendaries || []).length + ' 件传奇特效';
      case 'affix': return (data.gear && data.gear.name) || '装备数值';
      case 'gems': { let n = 0; Object.values(data.gems || {}).forEach(a => { n += (a || []).length; }); return n + ' 颗宝石'; }
      case 'minion': { const m = D.MINIONS.find(x => x.id === data.minionId); return (m ? m.name : '无仆从') + (data.minionSynergy ? ' · 协同' : ''); }
      case 'talents': return Object.values(data.talents || {}).reduce((a, b) => a + (b || 0), 0) + ' 点天赋';
      case 'runes': { const n = (data.runeSlots || []).filter(Boolean).length; return n + ' / 6 符文槽'; }
      default: return '';
    }
  }
  function renderBuilder() {
    const grid = $('#builderGrid');
    if (!grid) return;
    const db = Store.readBlocks ? Store.readBlocks() : {};
    const bp = Store.getBlueprint ? Store.getBlueprint() : {};
    const kinds = Store.BLOCK_KINDS || Object.keys(BUILDER_META);
    grid.innerHTML = '';
    kinds.forEach(kind => {
      const meta = BUILDER_META[kind] || {};
      const list = (db[kind] || []);
      const chosenId = bp[kind];
      const chosen = list.find(x => x.id === chosenId);
      const card = el('div', 'bcard' + (chosen ? ' on' : ''));
      const ic = `<svg viewBox="0 0 24 24">${BUILDER_ICONS[meta.icon] || BUILDER_ICONS.rune}</svg>`;
      const selOpts = ['<option value="">— 未选 —</option>'].concat(list.map(x => `<option value="${x.id}"${x.id === chosenId ? ' selected' : ''}>${x.name}</option>`)).join('');
      card.innerHTML = `
        <div class="bh"><span class="ic">${ic}</span><h4>${Store.BLOCK_LABEL[kind] || kind}</h4><span class="cnt">${list.length} 套</span></div>
        <div class="cur">${chosen ? blockPreview(kind, chosen.data) : (meta.desc || '')}</div>
        <select data-bsel="${kind}">${selOpts}</select>
        <div class="bops">
          <button data-bact="save" data-kind="${kind}">保存当前</button>
          <button data-bact="edit" data-kind="${kind}">去编辑</button>
          <button data-bact="rename" data-kind="${kind}" class="del" title="重命名选中方案">✎</button>
          <button data-bact="del" data-kind="${kind}" class="del" title="删除选中方案">×</button>
        </div>`;
      card.onclick = e => {
        const btn = e.target.closest('button[data-bact]');
        const sel = e.target.closest('select[data-bsel]');
        if (sel) return;
        if (!btn) return;
        const act = btn.dataset.bact, k = btn.dataset.kind;
        if (act === 'edit') { goto(meta.tab || 'character'); return; }
        if (act === 'save') {
          const defName = (Store.BLOCK_LABEL[k] || k) + ' ' + (list.length + 1);
          const name = window.prompt('给这套「' + (Store.BLOCK_LABEL[k] || k) + '」起名', defName);
          if (!name || !name.trim()) return;
          const entry = Store.saveBlock(k, name.trim(), captureBlock(k));
          bp[k] = entry.id; Store.setBlueprint(bp);
          toast('已保存「' + name.trim() + '」'); safeRun('构筑方案', renderBuilder);
        } else if (act === 'rename') {
          const cur = list.find(x => x.id === bp[k]);
          if (!cur) { toast('请先选择一个方案', true); return; }
          const name = window.prompt('新名称', cur.name);
          if (name && name.trim()) { Store.renameBlock(k, cur.id, name.trim()); safeRun('构筑方案', renderBuilder); }
        } else if (act === 'del') {
          const cur = list.find(x => x.id === bp[k]);
          if (!cur) { toast('请先选择一个方案', true); return; }
          if (!window.confirm('删除方案「' + cur.name + '」？')) return;
          Store.removeBlock(k, cur.id); delete bp[k]; Store.setBlueprint(bp);
          safeRun('构筑方案', renderBuilder);
        }
      };
      const sel = card.querySelector('select[data-bsel]');
      sel.onchange = e => {
        const v = e.target.value;
        if (v) bp[kind] = v; else delete bp[kind];
        Store.setBlueprint(bp);
        safeRun('构筑方案', renderBuilder);
      };
      grid.appendChild(card);
    });
    // 总方案摘要
    const chosen = kinds.filter(k => bp[k]);
    if ($('#bpCount')) $('#bpCount').textContent = chosen.length + ' / ' + kinds.length;
    if ($('#bpDps') && state._result) $('#bpDps').textContent = fmt(state._result.dps);
    const sum = $('#bpSummary');
    if (sum) {
      sum.innerHTML = chosen.length
        ? chosen.map(k => { const l = (db[k] || []).find(x => x.id === bp[k]); return (Store.BLOCK_LABEL[k] || k) + '：<b class="gold">' + (l ? l.name : '?') + '</b>'; }).join('<br>')
        : '尚未选择任何板块预设。';
    }
  }

  function bindBuilder() {
    const apply = $('#bpApply');
    if (apply) apply.onclick = () => {
      const db = Store.readBlocks ? Store.readBlocks() : {};
      const bp = Store.getBlueprint ? Store.getBlueprint() : {};
      const kinds = Store.BLOCK_KINDS || [];
      let n = 0;
      kinds.forEach(k => {
        const id = bp[k];
        if (!id) return;
        const entry = (db[k] || []).find(x => x.id === id);
        if (entry) { applyBlock(k, entry.data); n++; }
      });
      syncAllInputs(); safeRun('职业卡片', renderClassCards); safeRun('技能槽', renderSlots);
      safeRun('符文六槽', renderRuneSlots); safeRun('仆从', renderMinions);
      state._cache = {}; state._affixCache = null; state._gearKey = null;
      recomputeAll(); safeRun('构筑方案', renderBuilder);
      toast('已应用 ' + n + ' 个板块预设');
    };
    const saveFull = $('#bpSaveFull');
    if (saveFull) saveFull.onclick = () => {
      const name = ($('#bpName') && $('#bpName').value.trim()) || autoName() + '·组合';
      const entry = Store.save(snapshot(), { name, dps: state._result ? state._result.dps : 0 });
      toast(entry ? '已存为完整配置「' + name + '」' : '保存失败');
    };
    const clear = $('#bpClear');
    if (clear) clear.onclick = () => {
      if (!window.confirm('清空所有板块的预设选择？（不会删除已保存的预设）')) return;
      Store.setBlueprint({}); safeRun('构筑方案', renderBuilder); toast('已清空板块选择');
    };
  }

  function renderSaveList() {
    const box = $('#saveList');
    if (!box) return;
    const db = Store.readSaves();
    const cur = db.active;
    box.innerHTML = '';
    if (!db.list.length) {
      box.appendChild(el('div', 'empty', '还没有存档<br><span style="font-size:10.5px">给上面的输入框起个名字，点「保存当前」</span>'));
      return;
    }
    db.list.forEach(item => {
      const c = D.CLASSES[item.cls] || {};
      const stale = item.game && D.VERSION && item.game !== D.VERSION.game;
      const d = el('div', 'saveitem' + (item.id === cur ? ' on' : ''));
      d.innerHTML = `
        <div class="t">
          <span class="nm">${item.name}</span>
          ${item.id === cur ? '<span class="badge">当前</span>' : ''}
          ${stale ? `<span class="badge warn">${item.game}</span>` : ''}
        </div>
        <div class="m">
          <span class="fp">${buildFingerprint(item.snap)}</span>
          <span>${tsLabel(item.ts)}</span>
        </div>
        <div class="ops">
          <button data-act="load">载入</button>
          <button data-act="rename">改名</button>
          <button data-act="export">导出</button>
          <button data-act="del" class="del">删除</button>
        </div>`;
      d.onclick = e => {
        const btn = e.target.closest('button[data-act]');
        const act = btn ? btn.dataset.act : 'load';
        e.stopPropagation();
        if (act === 'load') {
          applySnapshot(item.snap);
          Store.activate(item.id);
          setSaveState('named');
          const nm = $('#saveName'); if (nm) nm.value = item.name;
          safeRun('存档列表', renderSaveList);
          toast('已载入「' + item.name + '」');
        } else if (act === 'rename') {
          const name = window.prompt('新名称', item.name);
          if (name && name.trim()) {
            Store.rename(item.id, name.trim());
            safeRun('存档列表', renderSaveList);
            toast('已改名');
          }
        } else if (act === 'export') {
          Store.exportFile(item.name, item.snap, { dps: item.dps });
          toast('已导出 JSON');
        } else if (act === 'del') {
          if (!window.confirm('删除配置「' + item.name + '」？此操作不可撤销。')) return;
          Store.remove(item.id);
          safeRun('存档列表', renderSaveList);
          toast('已删除');
        }
      };
      box.appendChild(d);
    });
  }

  function openDrawer() {
    safeRun('存档列表', renderSaveList);
    const nm = $('#saveName');
    if (nm && !nm.value) nm.value = autoName();
    const hint = $('#saveHint');
    if (hint) {
      hint.innerHTML = Store.available
        ? '存档保存在本机浏览器；当前配置改动会自动记为草稿，刷新不丢。'
        : '<span class="red">当前浏览器禁用了本地存储，存档只在本次会话有效</span>，请用「导出 JSON」保存。';
    }
    $('#scrim').classList.add('on');
    $('#saveDrawer').classList.add('on');
  }
  function closeDrawer() {
    const sc = $('#scrim'), dr = $('#saveDrawer');
    if (sc) sc.classList.remove('on');
    if (dr) dr.classList.remove('on');
  }

  function bindSaves() {
    const btn = $('#btnSaves');
    if (btn) btn.onclick = openDrawer;
    const cl = $('#saveClose');
    if (cl) cl.onclick = closeDrawer;
    const sc = $('#scrim');
    if (sc) sc.onclick = closeDrawer;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDrawer();
    });

    const newBtn = $('#saveNew');
    if (newBtn) newBtn.onclick = () => {
      const nm = $('#saveName');
      const name = (nm && nm.value.trim()) || autoName();
      const r = state._result;
      const entry = Store.save(snapshot(), {
        name: name,
        dps: r ? r.dps : 0,
        ttk: r && r.dps > 0 ? state.enemy.hp / r.dps : 0
      });
      setSaveState('named');
      if (nm) nm.value = name;
      safeRun('存档列表', renderSaveList);
      toast(entry ? '已保存「' + name + '」' : '保存失败：本地存储不可用');
    };

    const exp = $('#saveExport');
    if (exp) exp.onclick = () => {
      const nm = $('#saveName');
      Store.exportFile((nm && nm.value.trim()) || autoName(), snapshot(), {
        dps: state._result ? state._result.dps : 0
      });
      toast('已导出 JSON 文件');
    };

    const imp = $('#saveImport');
    const file = $('#saveFile');
    if (imp && file) {
      imp.onclick = () => file.click();
      file.onchange = () => {
        const f = file.files && file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onerror = () => toast('读文件失败', true);
        reader.onload = () => {
          const res = Store.parseFile(String(reader.result || ''));
          if (!res.ok) { showError('导入失败', new Error(res.error)); toast(res.error, true); file.value = ''; return; }
          applySnapshot(res.snap);
          (res.warnings || []).forEach(w => toast(w, true));
          const nm = $('#saveName'); if (nm) nm.value = res.name;
          Store.save(res.snap, { name: res.name, dps: state._result ? state._result.dps : 0 });
          safeRun('存档列表', renderSaveList);
          toast('已导入「' + res.name + '」');
          file.value = '';
        };
        reader.readAsText(f);
      };
    }

    const share = $('#saveShare');
    if (share) share.onclick = () => copyShare();

    const errClose = $('#errbarClose');
    if (errClose) errClose.onclick = () => $('#errbar').classList.remove('on');
  }

  /* ------------------------------------------------------------ 易用性：引导 / 示例 / 快捷入口 */
  const PREF_ONBOARD = 'onboardDismissed.v1';

  /** 载入某职业的推荐构筑（职业/技能/天赋/套装/传奇/装备全配好），口径裁决不动 */
  function loadDemo(cls) {
    if (!D.CLASSES[cls]) { toast('该职业示例暂不可用', true); return; }
    applyClass(cls);
    state._preset = 'mid';
    state._singleStacks = null;
    state.enemy.baseHp = 2400000;
    state.enemy.hp = Math.round(state.enemy.baseHp * state.diff);
    safeRun('示例场景', () => applyEncounter('boss', true));
    safeRun('职业卡片', renderClassCards);
    goto('overview');
    toast('已载入' + (D.CLASSES[cls].name || '示例') + '推荐构筑 · 中配');
  }

  function resetBuild() {
    if (!window.confirm('重置当前构筑为默认推荐配置？\n未决项裁决会保留，当前配置草稿会被覆盖。')) return;
    applyClass('warrior');
    state._preset = 'mid';
    state._singleStacks = null;
    state.enemy.baseHp = 2400000;
    state.enemy.hp = Math.round(state.enemy.baseHp * state.diff);
    safeRun('默认场景', () => applyEncounter('boss', true));
    safeRun('职业卡片', renderClassCards);
    setSaveState('dirty');
    goto('overview');
    toast('已重置为默认推荐构筑');
  }

  async function copyShare() {
    let url;
    try { url = location.href.split('#')[0] + '#b=' + Store.toHash(snapshot()); }
    catch (e) { showError('生成分享码失败', e); return; }
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); ok = true; }
    } catch (e) { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy'); ta.remove();
      } catch (e) { ok = false; }
    }
    if (ok) toast('分享码已复制（' + url.length + ' 字符）');
    else window.prompt('复制这个分享码链接', url);
  }

  /** 给数字输入补一行范围提示，减少盲填 */
  function addRangeHints() {
    $$('input[type=number]').forEach(inp => {
      if (inp.dataset.rangeHint) return;
      const lo = inp.getAttribute('min'), hi = inp.getAttribute('max');
      if (lo == null && hi == null) return;
      const label = (lo != null && hi != null) ? `范围 ${lo}–${hi}` : (lo != null ? `最小 ${lo}` : `最大 ${hi}`);
      const hint = el('span', 'rangehint', label);
      const host = inp.closest('.val') || inp.closest('.fitem') || inp.parentElement;
      if (host) { host.appendChild(hint); inp.dataset.rangeHint = '1'; }
    });
  }

  function bindUsability() {
    const bar = $('#onboard');
    let dismissed = false;
    try { dismissed = Store.getPref(PREF_ONBOARD, false) === true; } catch (e) { }
    if (bar) {
      if (dismissed) bar.hidden = true;
      const close = $('#obClose');
      if (close) close.onclick = () => {
        bar.hidden = true;
        try { Store.setPref(PREF_ONBOARD, true); } catch (e) { }
        toast('引导已关闭，需要时可从顶部「示例构筑」重新体验');
      };
      // 常驻示例入口：引导关闭后仍能从状态栏重新打开（兑现关闭提示的承诺）
      const demoBtn = $('#btnDemo');
      if (demoBtn) demoBtn.onclick = () => {
        if (bar) { bar.hidden = false; bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      };
      const dw = $('#obDemoWarrior'), dm = $('#obDemoMage');
      if (dw) dw.onclick = () => withBusy(dw, '载入中', () => loadDemo('warrior'));
      if (dm) dm.onclick = () => withBusy(dm, '载入中', () => loadDemo('sorcerer'));
    }

    const pop = $('#scopePop'), help = $('#scopeHelp'), px = $('#scopePopX');
    if (help && pop) {
      help.onclick = e => { e.stopPropagation(); pop.classList.toggle('on'); };
      if (px) px.onclick = e => { e.stopPropagation(); pop.classList.remove('on'); };
      document.addEventListener('click', e => {
        if (pop.classList.contains('on') && !e.target.closest('.scope-wrap')) pop.classList.remove('on');
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') pop.classList.remove('on'); });
    }

    const sm = $('#btnSaveMgr'); if (sm) sm.onclick = () => safeRun('存档管理', openDrawer);
    const sh = $('#btnShare'); if (sh) sh.onclick = () => copyShare();
    const rs = $('#btnReset'); if (rs) rs.onclick = () => withBusy(rs, '重置中', resetBuild);
  }

  /* ------------------------------------------------------------ init */
  function init() {
    // 全局兜底：任何未捕获错误都不该把页面变成白屏
    window.addEventListener('error', e => showError('脚本错误', (e && (e.error || e.message)) || '未知'));
    window.addEventListener('unhandledrejection', e => showError('异步错误', (e && e.reason) || '未知'));
    safeRun('宝石求解按钮', bindGemSolve);

    // 存储健康自检：不可用 / 损坏时明确提示，不静默失败
    safeRun('存储自检', () => {
      const diag = (Store.diagnose && Store.diagnose()) || { available: Store.available };
      if (!diag.available) toast('本地存储不可用：配置仅本次会话有效，请用「导出 JSON」保存', true);
      if (diag.draftCorrupt) toast('自动保存的数据已损坏，已按默认配置继续', true);
      if (diag.savesCorrupt) toast('存档数据已损坏，请到存档管理检查', true);
    });

    // 1) 默认流派（战士 / 中配 / 推荐天赋）
    try {
      applyClass('warrior');
      state._preset = 'mid';
      state.enemy.baseHp = 2400000;
      state.enemy.hp = Math.round(state.enemy.baseHp * state.diff);
    } catch (e) { showError('初始化默认值', e); }

    // 2) 绑定交互（绑定早于恢复，恢复后控件自然同步）
    safeRun('角色面板', bindCharacter);
    safeRun('角色子标签', bindCharTabs);
    safeRun('传奇筛选', bindLegTools);
    safeRun('天赋', bindTalents);
    safeRun('最优解', bindSolver);
    safeRun('仆从', bindMinions);
    safeRun('构筑方案', bindBuilder);
    safeRun('伤害计算', bindDamage);
    safeRun('未决项', bindPending);
    safeRun('装备取舍', bindCompare);
    safeRun('装备数值面板', bindAffixLab);
    safeRun('问答', bindAgent);
    safeRun('存档', bindSaves);
    safeRun('易用性', bindUsability);
    safeRun('范围提示', addRangeHints);
    document.addEventListener('click', e => { if (e.target.closest('[data-open-pending]')) openPending(); });

    // 3) 恢复：URL 分享 > 本地草稿 > 默认
    let restored = null, from = '';
    try {
      if (location.hash.indexOf('#b=') === 0) {
        restored = Store.fromHash(location.hash.slice(3));
        if (restored) from = '分享链接';
      }
      if (!restored) {
        const dr = Store.readDraft();
        if (dr && dr.snap) { restored = dr.snap; from = '上次编辑'; }
      }
    } catch (e) { console.warn('恢复配置失败', e); toast('恢复上次配置失败，已载入默认配置', true); }

    if (restored) {
      applySnapshot(restored);
      setSaveState('saved');
      if (from) toast('已载入' + from + '的配置');
    } else {
      safeRun('默认场景', () => applyEncounter('boss', true));
      safeRun('职业卡片', renderClassCards);
      setSaveState('dirty');
    }

    // 未决项：本地裁决优先于构筑快照；数据版本变更时只保留用户实测
    try {
      const pd = Store.loadPending();
      if (pd && pd.decisions && Object.keys(pd.decisions).length) {
        state.decisions = Object.assign({}, state.decisions, pd.decisions);
      }
      if (pd && pd.stale) toast('数据版本已更新：未裁决项回到默认，你的实测已保留');
    } catch (e) { console.warn('恢复未决项失败', e); }
    updateScopeBadge();

    safeRun('仆从列表', renderMinions);
    safeRun('数据页', renderModel);

    const hv = $('#hdVer'); if (hv) hv.textContent = D.VERSION.game;
    const hd = $('#hdDate'); if (hd) hd.textContent = D.VERSION.dataDate;
    const pv = $('#phVer'); if (pv) pv.textContent = D.VERSION.game;
    const pd = $('#phDate'); if (pd) pd.textContent = D.VERSION.dataDate;

    window.__lab = {
      state, cfg, engine: E, pendingVal, setZoneMode, openPending,
      snapshot: () => snapshot(),
      load: s => applySnapshot(s),
      save: (name) => Store.save(snapshot(), { name: name || autoName(), dps: state._result ? state._result.dps : 0 })
    };

    let rz = null;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        if (!state._result) return;
        safeRun('秒伤曲线', () => drawDpsChart(state._result));
        if (onPage('rotation')) safeRun('技能轴图表', () => { drawCastTimeline(state._result); drawMana(state._result); });
      }, 160);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
