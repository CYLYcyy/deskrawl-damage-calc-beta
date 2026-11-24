# Deskrawl 真源更新到 1.1.11 操作清单

> 背景：当前真源仓库 `limbo947/Deskrawl-Reverse` 已是最新 commit `0d56f3e`，但 `data/so_dump/*.json` 数据是 **2026-10-16（1.0.3 时期）** 导出的，落后于游戏 **1.1.11（2026-11-12）**。
> 沙箱环境没有游戏本体，**无法重新 dump**。以下步骤需在你**装有 Deskrawl 的本地机器**上执行。

---

## 精简版：复制即用的命令块（Windows PowerShell）

前置：游戏已更新到 1.1.11、已 `pip install UnityPy capstone cryptography`、仓库在最新 commit。
在仓库根目录打开 PowerShell，设好游戏路径后**依次粘贴**：

```powershell
$env:DESKRAWL_GAME = "C:\Program Files (x86)\Steam\steamapps\common\Deskrawl"   # 改成你的实际路径
cd tools\scripts

# 1) 重建资产缓存（必须，否则新物品认不全）
python assets_probe.py

# 2) 重导 SO 数值表（静态导出，不需要游戏运行中）
python dump_all2.py

# 3) 逐文件核对：只应看到数值行变化，不应有结构性增删
cd ..\..
git diff --numstat data/so_dump/

# 4)（可选，需游戏运行中）实机补丁回归：指纹→体检→别名→自检→实机
cd tools\scripts
python patch_regression.py --live
```

把生成的 `data/so_dump/*.json`（必要时含 `data/schema/aliases.json`）打包发我即可。

---

## 为什么必须本地做

真源仓库的 `so_dump` 是作者用**自己游戏版本**从 `GameAssembly.dll` + Unity 资产导出的（README 原文："各人按自己的游戏版本生成即可"）。`git pull` 只能拿到代码工具链，拿不到新版数值。要跟上 1.1.11，必须对本机游戏文件重新导出。

---

## 前置条件

1. 本地已安装 Deskrawl（Steam），游戏已更新到 1.1.11。
2. Python 3.11 + 依赖：`UnityPy`、`capstone`；存档解密另需 `cryptography`（可选）。
   ```bash
   pip install UnityPy capstone cryptography
   ```
3. 克隆/拉取仓库到最新版本：
   ```bash
   git clone https://github.com/limbo947/Deskrawl-Reverse.git
   cd Deskrawl-Reverse && git pull   # 确认 commit = 0d56f3e 或更新
   ```
4. 设置游戏目录（脚本通过环境变量定位，默认 `d:\steam\steamapps\common\Deskrawl`）：
   ```powershell
   $env:DESKRAWL_GAME = "你的游戏安装目录"
   ```
   Linux 用 `export DESKRAWL_GAME="..."`。

---

## 步骤（按顺序，一条命令串行）

### 1. 一键补丁回归（地址体检 + 别名 + 自检）
```powershell
cd tools\scripts
python patch_regression.py --live
```
- `--live` 需要**游戏正在运行**，会做实机内存验证。
- 若地址/混淆名变了，先看 RVA 体检报告，必要时更新 `data/schema/aliases.json`。

### 2. 重建 schema（仅当反编译结构变化时）
- 用 [Il2CppDumper v39](https://github.com/Perfare/Il2CppDumper/releases) 对本机 `GameAssembly.dll` + `global-metadata.dat` 导出；
- 只保留 `dump.cs` / `script.json` / `stringliteral.json` 到 `data/schema/`。
- 若只是数值变化、结构没变，可跳过。

### 3. 重建资产缓存（重要，勿跳过）
```powershell
python assets_probe.py        # 或对应重建缓存脚本，见 AGENTS.md
```
仓库警告：`dump_all2.py` 依赖 `tools/scripts/assets_cache.json`，缓存偏旧会导致只认到部分物品。

### 4. 重导 SO 数值
```powershell
python dump_all2.py
```

### 5. 逐文件核对（防止误改）
```powershell
git diff --numstat data/so_dump/
```
**只应看到数值行变化**。若出现结构性增删，说明 schema/缓存有问题，先回退排查。

### 6.（可选）实机内存快照交叉验证
```powershell
python decrypt_save.py      # 解密存档
python read_save.py         # 读角色数值
# 游戏运行时：
python -m deskrawl_gui.memdump --json
```

---

## 导出完成后交给我

把更新后的这两个目录打包发我（或提交到仓库后告诉我）：
- `data/so_dump/*.json`
- `data/schema/aliases.json`（若有更新）

我会据此重新核查以下当前存疑项，并更新伤害实验室：
1. **静电系数**：真源 1.0.3 = 10%/层，但本地/用户拍板 = 5%——需用新版确认真源是否已改。
2. **静电 × 易伤结构**：真源 1.0.3 显示二者不同括号（偏相乘），本地默认加算——需新版确认。
3. **横扫**：1.1.11 已改 70%+3%/级，真源 1.0.3 仍是 50%+2.5%——需新版拿准确值。
4. **仆从被动成长**：真源 1.0.3 无成长系数（但 1.1.0 才引入仆从养成）——需新版确认被动是否随等级成长。
5. **易伤时长**：真源 3s vs 本地 4s。
6. **脆裂 / 充能之戒**：真源 SO 无数值，需新版看是否补上。

---

## 我这边已做的兜底

即使暂时拿不到新真源，产物已按采信度正确处理：
- 用户拍板值（静电 5%、加算）保持为默认，**不被旧真源覆盖**；
- 真源新证据（10%/层、相乘）作为**候选项写进前端未决项选项卡**，附证据与实测步骤；
- 每项都在 `data.js` / `SKILL.md` / 知识库标注"真源版本 1.0.3，可能与当前不符"，不冒充权威。
