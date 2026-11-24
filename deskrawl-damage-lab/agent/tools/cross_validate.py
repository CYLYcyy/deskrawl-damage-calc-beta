#!/usr/bin/env python3
"""
双引擎交叉校验：用作者 GUI 引擎（Deskrawl-Reverse/tools/deskrawl_calc，
指令级逆向、更高采信度）做 golden source，验证本地 JS 引擎的底层乘区逐位一致。

运行（在本项目根目录）：
    python3 agent/tools/cross_validate.py

需设置 REVERSE_TOOLS 环境变量指向 Deskrawl-Reverse/tools（默认探测常见路径）。
本地 JS 侧由 node 子进程输出 JSON；作者侧直接 import。
"""
import json, os, subprocess, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REVERSE_TOOLS = os.environ.get('REVERSE_TOOLS') or ''
if not REVERSE_TOOLS:
    cands = glob.glob('/root/.codebuddy/artifact/*/Deskrawl-Reverse/tools')
    REVERSE_TOOLS = cands[0] if cands else ''

# 对齐输入（双方完全一致）
IN = dict(fire=1.2, all=0.3, cc=0.3, cd=2.2, main_stat=620.0,
          vuln_dmg=0.4, weapon=200.0, scaling=2.0, lvl=70, armor=100.0)

# ---------- 1) 作者 GUI 引擎 ----------
try:
    sys.path.insert(0, REVERSE_TOOLS)
    from deskrawl_calc.engine import DamageModel, StatSheet, Target, Modifier, StatType, DamageType
    sh = StatSheet()
    for st, val in [(StatType.DamageFire, IN['fire']), (StatType.DamagePercent, IN['all']),
                    (StatType.CritChance, IN['cc']), (StatType.CritDamage, IN['cd']),
                    (StatType.Strength, IN['main_stat']), (StatType.VulnerableDamage, IN['vuln_dmg'])]:
        sh.add_mod(Modifier(int(st), 0, val))
    tgt = Target(level=IN['lvl'], armor=IN['armor'], elite=True, vulnerable=True)
    m = DamageModel(sh, damage_type=DamageType.Fire, weapon_damage=IN['weapon'],
                    primary_stat=0, skill_scaling=IN['scaling'], level=IN['lvl'])
    gui = {
        'elementAll': round(m.type_multiplier(), 6),
        'mainStat': round(m.primary_stat_multiplier(), 6),
        'critChance': round(m.crit_chance(), 6),
        'condPool': round(m.conditional_multiplier(tgt), 6),
        'vulnerable': round(m.vulnerable_multiplier(tgt), 6) if hasattr(m, 'vulnerable_multiplier') else 1.3,
    }
except Exception as e:
    print(f"[作者引擎] 不可用：{e}（设置 REVERSE_TOOLS）；跳过 golden 对比")
    sys.exit(2)

# ---------- 2) 本地 JS 引擎 ----------
JS = r'''
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const root=process.argv[2]; const ctx={console}; vm.createContext(ctx); vm.runInContext('var window=globalThis;',ctx);
for(const f of ['data.js','affix.js','runes.js','engine.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const E=ctx.window.Engine;
const IN=JSON.parse(process.argv[3]);
const gear=Object.assign({},E.GEAR_PRESETS.mid,{main:IN.main_stat,cc:IN.cc*100,cd:IN.cd*100,
  ele:IN.fire*100,all:IN.all*100,vsVuln:IN.vuln_dmg*100,weaponDamage:IN.weapon,vsElite:0,type:0});
const cfg={classKey:'warrior',element:'fire',primaryType:'strong',gear,skills:{},talents:{},
  setId:null,setCount:0,legendaries:[],minionId:null,
  enemy:{hp:1e9,armor:IN.armor,mr:0,count:1,elite:true,vuln:100},vulnUptime:1,takenMode:'additive'};
const agg=E.aggregate(cfg);
const ch={elite:true,armor:IN.armor,mr:0,enemyLevel:IN.lvl,critDR:0,healthyUptime:1,injuredUptime:1,
  slowedUptime:1,immobilizedUptime:1,distant:1,count:1,vulnUptime:1,takenMode:'additive',electroStacks:0,brittleStacks:0,brittleZone:'crit'};
const ab={id:'t',name:'t',ele:'fire',pct:IN.scaling*100,type:'strong',tags:[]};
const z=E.hitZones(agg,ab,ch);
const pick=n=>{const x=z.zones.find(q=>q.name===n);return x?+x.mult.toFixed(6):null;};
console.log(JSON.stringify({elementAll:pick('元素 + 全伤'),mainStat:pick('主属性'),
  critChance:+(agg.cc/100).toFixed(6),condPool:pick('条件伤'),vulnerable:pick('目标受伤增加')}));
'''
tmp = os.path.join(ROOT, '_crossval_tmp.mjs')
with open(tmp, 'w') as f:
    f.write(JS)
try:
    out = subprocess.check_output(['node', tmp, ROOT, json.dumps(IN)], cwd=ROOT, text=True)
    local = json.loads(out.strip().splitlines()[-1])
finally:
    os.remove(tmp)

# ---------- 3) 逐项比对 ----------
print("=== 双引擎乘区交叉校验（作者 GUI golden vs 本地 JS）===")
print(f"{'乘区':<14}{'作者GUI':>12}{'本地JS':>12}{'判定':>10}")
all_ok = True
for k, label in [('elementAll', '元素+全伤'), ('mainStat', '主属性'),
                 ('critChance', '暴击率'), ('condPool', '条件池'), ('vulnerable', '易伤×1.3')]:
    g, l = gui[k], local.get(k)
    ok = (l is not None and abs(g - l) < 1e-6)
    all_ok &= ok
    print(f"{label:<14}{g:>12}{str(l):>12}{'✓ 一致' if ok else '✗ 差异':>10}")
print("\n结论：", "全部底层乘区逐位一致 ✓" if all_ok else "存在差异，需排查 ⚠")
sys.exit(0 if all_ok else 1)
