/* ==========================================================================
   天赋毕业最优解求解器（黑盒非凸优化）
   --------------------------------------------------------------------------
   设计红线：求解器只通过黑盒 score(talentsObj) -> number 接触目标函数，
   不读引擎内部公式，不假设梯度/凸性/单调性。结果标注为「高质量近似，
   非严格全局最优」。

   算法（移植自 opt-prototype.mjs，扩展到 3 个专精行 + 多起点）：
     1) 专精行枚举：互斥离散结构在外层精确枚举（每排 one-hot）；
     2) 单变量全范围坐标扫描：一次把某变量设到 0..max 跨过阈值山谷；
     3) 块重置 / 2-opt：成组挪点，跳出「两个变量要同时改变」的局部极小；
     4) 多起点 + 确定性扰动：跳出局部极小；
     5) 全程记忆化：同一分配只真正调用黑盒一次。

   执行方式：
     - solveGen(ctx) 是 generator，每个检查点 yield 一次进度；
     - Worker 与主线程分片两套 runner 消费同一个 generator，
       因此 file:// 下 Worker 被禁时可无缝降级为 setTimeout 分片。
   ========================================================================== */
(function (root) {
  'use strict';

  const D = root.DESKRAWL_DATA || {};
  const Engine = root.Engine;
  const SPEC_AT = [10, 30, 60];   // 与 engine.js:1072 autoTalents 的 isCap 一致
  const BUDGET = 70;              // 与 autoTalents(cfg, 70) 一致

  const now = () => (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
  const clone = x => Object.assign({}, x);
  const zeros = P => { const o = {}; for (const v of P.VARS) o[v] = 0; return o; };
  const sum = (x, P) => { let s = 0; for (const v of P.VARS) s += x[v] || 0; return s; };
  const keyOf = (x, P) => { let k = ''; for (const v of P.VARS) k += (x[v] || 0) + ','; return k; };
  const objFrom = (x, P) => { const o = {}; for (const v of P.VARS) if (x[v] > 0) o[v] = x[v]; return o; };

  /* 从 data.js 的职业天赋树提取真实约束（不硬编码任何数值） */
  function extractProblem(classKey) {
    const c = D.CLASSES[classKey] || { talents: [] };
    const rows = c.talents || [];
    const VARS = [], MAX = {}, ROW_OF = {}, rowItems = [], rowAt = [];
    rows.forEach((row, ri) => {
      rowAt[ri] = row.at;
      rowItems[ri] = (row.items || []).map(t => t.id);
      (row.items || []).forEach(t => {
        if (VARS.indexOf(t.id) < 0) VARS.push(t.id);
        MAX[t.id] = Math.max(1, t.max || 1);
        ROW_OF[t.id] = ri;
      });
    });
    const specRowSet = new Set();
    const specRows = [];
    rows.forEach((row, ri) => {
      if (SPEC_AT.indexOf(row.at) >= 0) {
        specRowSet.add(ri);
        specRows.push({ ri, at: row.at, items: (row.items || []).map(t => t.id) });
      }
    });
    const nonSpec = VARS.filter(v => !specRowSet.has(ROW_OF[v]));
    const rowOrder = rows.map((r, ri) => ({ ri, at: r.at }))
      .sort((a, b) => a.at - b.at || a.ri - b.ri);
    return { classKey, rows, VARS, MAX, ROW_OF, rowItems, rowAt, specRows, specRowSet, nonSpec, rowOrder };
  }

  /* 可行性：预算、专精互斥、行门槛。
     行门槛语义对齐 autoTalents：某行投入 s>0 时，其它行点数之和 S-s 必须 >= 该行 at。 */
  function feasible(x, P) {
    const S = sum(x, P);
    if (S > BUDGET) return false;
    for (const sr of P.specRows) {
      let picked = 0;
      for (const id of sr.items) if ((x[id] || 0) > 0) picked++;
      if (picked > 1) return false;
    }
    for (let ri = 0; ri < P.rows.length; ri++) {
      let s = 0;
      const items = P.rowItems[ri];
      for (const id of items) s += x[id] || 0;
      if (s > 0 && S - s < P.rowAt[ri]) return false;
    }
    return true;
  }

  /* 黑盒 + 记忆化。求解器只通过 oracle.score 接触目标。 */
  function makeOracle(scoreFn, P) {
    const cache = new Map();
    let calls = 0;
    return {
      score(x) {
        const k = keyOf(x, P);
        if (cache.has(k)) return cache.get(k);
        calls++;
        let v;
        try { v = scoreFn(objFrom(x, P)); }
        catch (e) { v = -1e12; }
        if (typeof v !== 'number' || !isFinite(v)) v = -1e12;
        cache.set(k, v);
        return v;
      },
      get calls() { return calls; },
      get cached() { return cache.size; }
    };
  }

  /* 专精组合笛卡尔积：每排「不选 / 选某一个」。数量过大时确定性截断。 */
  function specCombos(P, pins) {
    let combos = [[]];
    for (const sr of P.specRows) {
      const pin = (pins || []).find(p => p && p.id != null && (p.at === sr.at || p.ri === sr.ri));
      const pid = pin && sr.items.indexOf(pin.id) >= 0 ? pin.id : null;
      const opts = pid ? [pid] : [null].concat(sr.items);
      const next = [];
      for (const c of combos) {
        for (const id of opts) next.push(id == null ? c.slice() : c.concat([{ ri: sr.ri, id }]));
      }
      combos = next;
    }
    if (combos.length > 240) combos = combos.slice(0, 240); // 防御性上限，真实数据约 80
    return combos;
  }

  /* 确定性伪随机（可复现） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* 按行门槛顺序构造可行起点；保证专精组合被真实放置 */
  function makeSeed(combo, P, rng, mode) {
    const x = zeros(P);
    let placed = 0;
    const ordered = P.rowOrder;
    for (let oi = 0; oi < ordered.length; oi++) {
      const { ri, at } = ordered[oi];
      if (placed >= BUDGET) break;
      if (at > 0 && placed < at) continue;         // 其它行点数不足，本行尚未解锁
      const items = P.rowItems[ri];
      if (P.specRowSet.has(ri)) {
        let pick = combo.find(p => p.ri === ri);
        if (!pick && mode === 'random' && rng() < 0.6) {
          pick = { ri, id: items[Math.floor(rng() * items.length)] };
        }
        if (pick && placed < BUDGET) { x[pick.id] = 1; placed++; }
      } else {
        let want;
        if (mode === 'uniform') want = Math.floor((BUDGET - placed) / (ordered.length - oi));
        else want = 1 + Math.floor(rng() * Math.min(10, BUDGET - placed));
        for (const id of items) {
          if (want <= 0) break;
          const take = Math.min(P.MAX[id], want, BUDGET - placed);
          if (take > 0) { x[id] = take; want -= take; placed += take; }
        }
      }
    }
    // 余点全部落在 0 门槛行（永远解锁），保证预算用满且仍可行
    let rem = BUDGET - placed;
    for (let ri = 0; ri < P.rows.length && rem > 0; ri++) {
      if (P.rowAt[ri] !== 0) continue;
      for (const id of P.rowItems[ri]) {
        if (rem <= 0) break;
        const take = Math.min(P.MAX[id] - (x[id] || 0), rem);
        if (take > 0) { x[id] += take; rem -= take; }
      }
    }
    return x;
  }

  /* 单变量全范围扫描（跨阈值）：固定其它变量，把 v 从 0..max 直接扫一遍 */
  function* coordScanGen(x, ctx, oracle, P) {
    let cur = clone(x), curScore = oracle.score(cur);
    let improved = true, guard = 0;
    while (improved && guard++ < 24) {
      improved = false;
      for (const v of P.nonSpec) {
        if (ctx.cancelled) return { x: cur, score: curScore };
        let bestV = cur[v] || 0, bestS = curScore;
        for (let k = 0; k <= P.MAX[v]; k++) {
          const y = clone(cur); y[v] = k;
          if (!feasible(y, P)) continue;
          const s = oracle.score(y);
          if (s > bestS * (1 + 1e-9)) { bestS = s; bestV = k; }
        }
        if (bestV !== (cur[v] || 0)) { cur[v] = bestV; curScore = bestS; improved = true; }
        yield ctx.tick();
      }
    }
    return { x: cur, score: curScore };
  }

  /* 块重置 / 2-opt：从 from 挪 1..3 点到 to，成组重分配 */
  function* blockMovesGen(x, ctx, oracle, P) {
    let cur = clone(x), curScore = oracle.score(cur);
    let improved = true, guard = 0;
    while (improved && guard++ < 16) {
      improved = false;
      for (const from of P.VARS) {
        if (!(cur[from] > 0)) continue;
        for (const to of P.VARS) {
          if (to === from) continue;
          for (let d = 1; d <= 3; d++) {
            if (ctx.cancelled) return { x: cur, score: curScore };
            if (cur[from] - d < 0 || (cur[to] || 0) + d > P.MAX[to]) continue;
            const y = clone(cur); y[from] -= d; y[to] += d;
            if (!feasible(y, P)) continue;
            const s = oracle.score(y);
            if (s > curScore * (1 + 1e-9)) { cur = y; curScore = s; improved = true; }
          }
          yield ctx.tick();
        }
      }
    }
    return { x: cur, score: curScore };
  }

  function* refineGen(x, ctx, oracle, P, rounds) {
    let best = { x: clone(x), score: oracle.score(x) };
    for (let r = 0; r < rounds; r++) {
      const before = keyOf(best.x, P);
      let res = yield* coordScanGen(best.x, ctx, oracle, P);
      res = yield* blockMovesGen(res.x, ctx, oracle, P);
      best = res;
      if (ctx.cancelled) return best;
      if (keyOf(best.x, P) === before) break;
      yield ctx.tick();
    }
    return best;
  }

  /* 确定性扰动：挪 amount 个点，制造新的可行起点 */
  function perturb(x, P, rng, amount) {
    const y = clone(x);
    for (let s = 0; s < amount; s++) {
      const donors = P.VARS.filter(v => (y[v] || 0) > 0);
      if (!donors.length) break;
      const from = donors[Math.floor(rng() * donors.length)];
      const receivers = P.VARS.filter(v => v !== from && (y[v] || 0) < P.MAX[v]);
      if (!receivers.length) break;
      const to = receivers[Math.floor(rng() * receivers.length)];
      y[from]--; if (!y[from]) delete y[from];
      y[to] = (y[to] || 0) + 1;
      if (!feasible(y, P)) {           // 回退非法扰动
        y[from] = (y[from] || 0) + 1;
        y[to]--; if (!y[to]) delete y[to];
      }
    }
    return y;
  }

  /* -------------------------------------------------------------- 上下文 */
  function createContext(opts) {
    const o = opts || {};
    const seed = (o.seed >>> 0) || 20261124;
    const ctx = {
      cfg: o.cfg,
      duration: o.duration || 16,
      tier: o.tier === 'standard' ? 'standard' : 'quick',
      seed,
      cancelled: false,
      specPins: o.specPins || null,   // 模板可固定专精行；未固定的行仍精确枚举
      stage: '准备',
      pct: 0,
      tick() {
        if (this.cancelled) { const e = new Error('求解已中断'); e.__cancelled = true; throw e; }
        return { pct: Math.round(this.pct), stage: this.stage };
      }
    };
    return ctx;
  }

  /* 求解主流程（generator）。所有对外可见的进度都来自 ctx.tick()。 */
  function* solveGen(ctx) {
    const t0 = now();
    const P = extractProblem(ctx.cfg && ctx.cfg.classKey);
    const scoreFn = talents => Engine.simulate(
      Object.assign({}, ctx.cfg, { talents }),
      { duration: ctx.duration, lite: true }
    ).dps;
    const oracle = makeOracle(scoreFn, P);
    const rng = mulberry32(ctx.seed);
    const quick = ctx.tier === 'quick';
    const restarts = quick ? 2 : 6;
    const rounds = quick ? 2 : 5;
    const callBudget = quick ? 160000 : 800000;   // 安全闸，保证响应时间可控
    let best = { x: null, score: -Infinity };

    // 阶段 1：专精行枚举 —— 用统一起点 + 坐标扫描为每个组合打分并排序
    const combos = specCombos(P, ctx.specPins);
    const ranked = [];
    for (let ci = 0; ci < combos.length; ci++) {
      if (ctx.cancelled || oracle.calls > callBudget) break;
      ctx.stage = '专精枚举';
      ctx.pct = 4 + 26 * ci / Math.max(1, combos.length);
      const sx = makeSeed(combos[ci], P, rng, 'uniform');
      if (!feasible(sx, P)) { yield ctx.tick(); continue; }
      const res = yield* coordScanGen(sx, ctx, oracle, P);
      ranked.push({ combo: combos[ci], x: res.x, score: res.score });
      yield ctx.tick();
    }
    ranked.sort((a, b) => b.score - a.score);
    if (!ranked.length) {
      const z = zeros(P);
      best = { x: z, score: oracle.score(z) };
    }

    // 阶段 2/3：坐标扫描 + 块重置（在排名靠前的专精组合上多起点精修）
    const K = quick ? Math.min(6, ranked.length) : ranked.length;
    for (let i = 0; i < K; i++) {
      if (ctx.cancelled || oracle.calls > callBudget) break;
      const base = ranked[i];
      ctx.pct = 30 + 40 * i / Math.max(1, K);
      for (let r = 0; r < restarts; r++) {
        if (ctx.cancelled || oracle.calls > callBudget) break;
        ctx.stage = r % 2 === 0 ? '坐标扫描' : '块重置';
        const sx = r === 0 ? base.x : makeSeed(base.combo, P, rng, 'random');
        if (!feasible(sx, P)) { yield ctx.tick(); continue; }
        const res = yield* refineGen(sx, ctx, oracle, P, rounds);
        if (res.score > best.score) best = { x: clone(res.x), score: res.score };
        yield ctx.tick();
      }
    }

    // 阶段 4：多起点扰动 —— 围绕当前最优跳出局部极小
    const nPerturb = quick ? 4 : 16;
    ctx.stage = '多起点';
    for (let r = 0; r < nPerturb; r++) {
      if (ctx.cancelled || oracle.calls > callBudget) break;
      ctx.pct = 70 + 28 * r / nPerturb;
      const sx = perturb(best.x, P, rng, quick ? 2 : 4);
      if (feasible(sx, P)) {
        const res = yield* refineGen(sx, ctx, oracle, P, rounds);
        if (res.score > best.score) best = { x: clone(res.x), score: res.score };
      }
      yield ctx.tick();
    }

    ctx.stage = '完成'; ctx.pct = 100;
    yield ctx.tick();
    return {
      talents: objFrom(best.x, P),
      dps: best.score,
      calls: oracle.calls,
      cached: oracle.cached,
      elapsedMs: Math.round(now() - t0),
      seed: ctx.seed,
      tier: ctx.tier,
      budget: BUDGET,
      approximate: true,
      note: '高质量近似解，非严格全局最优（黑盒非凸、仅保证专精枚举精确）'
    };
  }

  /* 同步便捷入口（测试 / 非 UI 场景） */
  function solve(opts) {
    const ctx = createContext(opts);
    const it = solveGen(ctx);
    let step = it.next();
    while (!step.done) step = it.next();
    return step.value;
  }

  /* -------------------------------------------------------------- runners */
  /* 主线程分片：每片最多 ~12ms，让出 UI；进度与中断与 Worker 完全一致 */
  function mainRunner() {
    const runner = {
      mode: 'main',
      _active: null,
      solve(req, handlers) {
        const ctx = createContext(req);
        const it = solveGen(ctx);
        const h = handlers || {};
        const handle = { mode: 'main', cancel() { ctx.cancelled = true; } };
        runner._active = handle;
        let timer = null, last = null;
        const pump = () => {
          try {
            const start = now();
            while (now() - start < 12) {
              const step = it.next();
              if (step.done) {
                runner._active = null;
                if (last && h.onProgress) h.onProgress(last.pct, last.stage);
                if (h.onDone) h.onDone(step.value);
                return;
              }
              last = step.value;
            }
            if (last && h.onProgress) h.onProgress(last.pct, last.stage);
            timer = setTimeout(pump, 0);
          } catch (e) {
            runner._active = null;
            if (e && e.__cancelled) { if (h.onCancelled) h.onCancelled(); }
            else if (h.onError) h.onError(e);
          }
        };
        timer = setTimeout(pump, 0);
        handle._stop = () => clearTimeout(timer);
        return handle;
      },
      cancel() { if (runner._active) runner._active.cancel(); }
    };
    return runner;
  }

  /* Worker runner：消息协议 {type:'solve'|'progress'|'result'|'error'|'cancelled'|'cancel'} */
  function workerRunner(worker) {
    const runner = {
      mode: 'worker',
      _active: null,
      _seq: 0,
      solve(req, handlers) {
        const id = ++runner._seq;
        const h = handlers || {};
        const handle = {
          mode: 'worker', id,
          cancel() { try { worker.postMessage({ type: 'cancel', id }); } catch (e) { } }
        };
        runner._active = handle;
        const onMsg = e => {
          const m = e.data || {};
          if (m.id !== id) return;
          if (m.type === 'progress') { if (h.onProgress) h.onProgress(m.pct, m.stage); }
          else if (m.type === 'result') { cleanup(); runner._active = null; if (h.onDone) h.onDone(m.result); }
          else if (m.type === 'error') { cleanup(); runner._active = null; if (h.onError) h.onError(new Error(m.message)); }
          else if (m.type === 'cancelled') { cleanup(); runner._active = null; if (h.onCancelled) h.onCancelled(); }
        };
        const cleanup = () => { try { worker.removeEventListener('message', onMsg); } catch (e) { } };
        handle._cleanup = cleanup;
        worker.addEventListener('message', onMsg);
        worker.postMessage({ type: 'solve', id, cfg: req.cfg, duration: req.duration, tier: req.tier, seed: req.seed, specPins: req.specPins || null });
        return handle;
      },
      cancel() { if (runner._active) runner._active.cancel(); }
    };
    return runner;
  }

  /* 自动选择 runner：file:// 直开时 Worker 通常被浏览器拦截，直接走分片降级 */
  function createRunner() {
    const proto = (typeof location !== 'undefined' && location.protocol) || '';
    if (proto === 'file:') return Promise.resolve(mainRunner());
    try {
      const worker = new Worker('./solver-worker.js');
      return new Promise(resolve => {
        let done = false;
        const finish = ok => {
          if (done) return; done = true;
          clearTimeout(timer);
          if (ok) resolve(workerRunner(worker));
          else { try { worker.terminate(); } catch (e) { } resolve(mainRunner()); }
        };
        const timer = setTimeout(() => finish(false), 1600);
        worker.addEventListener('message', e => { if (e.data && e.data.type === 'ready') finish(true); });
        worker.addEventListener('error', () => finish(false));
      });
    } catch (e) {
      return Promise.resolve(mainRunner());
    }
  }

  root.Solver = {
    solve, solveGen, createContext, createRunner,
    mainRunner, workerRunner, extractProblem, feasible, makeOracle,
    now, approx: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
