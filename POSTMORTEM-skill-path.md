# 复盘：Skill 技能层归位后工具命令定位失败

- 日期：2026-11-26
- 严重度：中（Skill 被加载后所有算数工具不可用，但数值引擎本身无错）
- 触发提交：`4446064 docs: 清理辅助判断文档并将技能层归位到根目录`

## 现象

把本仓库以 git 方式安装为 WorkBuddy Skill（`~/.codebuddy/skills/<name>/`）后，
在 skill 根目录直接执行 `SKILL.md` 里写的命令（如 `node agent/tools/calc.mjs --check`）
报"找不到模块"：工具实际位于 `deskrawl-damage-lab/agent/tools/`。

## 根因

`4446064` 把唯一 `SKILL.md` 从 `deskrawl-damage-lab/agent/` 上移到**仓库根目录**，
但正文里的工具命令仍沿用旧 subdir 视角的相对路径（`agent/tools/...`、`build-standalone.mjs`），
并用一句自然语言"在 `deskrawl-damage-lab/` 下执行"来交代 cwd。

问题在于：**Skill 被加载后，agent 执行命令的 cwd 是 skill 根目录（= 仓库根），
不一定会先 `cd deskrawl-damage-lab`**。CI 之所以全绿，是因为 CI 每个步骤都显式设了
`working-directory: deskrawl-damage-lab`，恰好掩盖了这个假设——测试路径与真实使用路径不一致。

一句话教训：**"文档里写了该 cd 到哪"不等于"执行时真的在那个目录"；
路径必须写成 cwd 无关，否则文档自洽不等于运行时可用。**

## 修复

1. `SKILL.md` 中所有工具命令改为**仓库根相对路径**，统一带 `deskrawl-damage-lab/` 前缀：
   - `node agent/tools/calc.mjs ...` → `node deskrawl-damage-lab/agent/tools/calc.mjs ...`
   - `python3 agent/tools/cross_validate.py` → `python3 deskrawl-damage-lab/agent/tools/cross_validate.py`
   - `node build-standalone.mjs` → `node deskrawl-damage-lab/build-standalone.mjs`
   - 移除"改动纪律"块里的 `cd deskrawl-damage-lab` / `cd ..`，改为从仓库根直接执行。
2. CI 增加两个检查（见 `.github/workflows/verify.yml`）：
   - 从仓库根直接跑 `SKILL.md` 等价命令，证明加载器 cwd 下可用；
   - 断言 `SKILL.md` 不再含裸的 `node agent/` / `python3 agent/` / `node build-standalone` 前缀。

## 防回归规则（以后必须遵守）

- **技能/文档里的任何命令路径都写成 cwd 无关**：以仓库根为基准显式带子目录前缀，
  或在命令块正上方用一行可执行的 `cd`，不要只靠自然语言交代工作目录。
- **移动入口文件位置（如 SKILL.md 上移/下移）时，必须把所有相对路径引用一起改**，
  并检查 `CI 的工作目录` 是否掩盖了真实运行 cwd。
- **CI 的 working-directory 要与文档承诺的执行 cwd 一致**，否则 CI 绿不代表用户可用。
- 安装 Skill 后要做一次"冒烟验证"：在 skill 根目录直接跑 `--check`、一次秒伤、一次单跳，
  而不是先看 CI 状态。
