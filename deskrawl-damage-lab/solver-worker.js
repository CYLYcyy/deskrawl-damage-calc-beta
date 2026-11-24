/* ==========================================================================
   求解器 Worker 入口
   - data/engine/affix/runes 都用 window.* 暴露，Worker 里没有 window，
     所以先 self.window = self 再 importScripts。
   - 接收 {type:'solve',id,cfg,duration,tier,seed}，逐帧推进 solveGen，
     回传 progress / result / error / cancelled。
   - {type:'cancel',id} 通过 ctx.cancelled 在下一个检查点中断。
   ========================================================================== */
self.window = self;

importScripts(
  './data.js',
  './affix.js',
  './runes.js',
  './engine.js',
  './solver.js'
);

(function () {
  const Solver = self.Solver;
  let activeId = null;
  let activeCtx = null;

  self.onmessage = function (e) {
    const m = e.data || {};
    if (m.type === 'cancel') {
      if (activeCtx && (m.id == null || m.id === activeId)) activeCtx.cancelled = true;
      return;
    }
    if (m.type !== 'solve') return;

    activeId = m.id;
    activeCtx = Solver.createContext({
      cfg: m.cfg, duration: m.duration, tier: m.tier, seed: m.seed, specPins: m.specPins || null
    });
    const it = Solver.solveGen(activeCtx);
    const done = (type, payload) => {
      self.postMessage(Object.assign({ type, id: m.id }, payload || {}));
      if (activeId === m.id) { activeId = null; activeCtx = null; }
    };

    const pump = () => {
      try {
        // Worker 内每片 ~40ms：足够快，同时仍能响应 cancel 消息
        const start = Solver.now();
        while (Solver.now() - start < 40) {
          const step = it.next();
          if (step.done) { done('result', { result: step.value }); return; }
          self.postMessage({ type: 'progress', id: m.id, pct: step.value.pct, stage: step.value.stage });
        }
        setTimeout(pump, 0);
      } catch (err) {
        if (err && err.__cancelled) done('cancelled');
        else done('error', { message: String((err && err.message) || err) });
      }
    };
    pump();
  };

  self.postMessage({ type: 'ready' });
})();
