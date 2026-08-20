# dsh-agent-forge

中文 | [English](README.md)

**从任意代码工作区渐进式锻造一个可固化的 agent。**

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）host 插件，
把任意代码工作区变成可持久化、可安装的 agent（preset + 带护栏的插件）。它把我们在一个真实
嵌入式固件项目上手工走过的路形式化：观察工作区 → 推导人格 → 生成工具 →
推导护栏 → 验证 → 固化。

## 成熟度阶梯

| 等级 | 含义 | 工具 |
|---|---|---|
| L0 | 已观察：工作区画像报告 | `forge_scan` |
| L1 | 有人格：可安装的 preset | `forge_generate target=preset` |
| L2 | 有工具：按探测特征生成 stub 的插件骨架 | `forge_generate target=plugin` |
| L3 | 有护栏：从 quirk 推导的编辑规则 | 同上（guard.ts 规则表） |
| L4 | 已验证：三层验证通过 | `forge_status` + 人工确认 |
| — | 固化：装进 preset 选择器 | `forge_install` |

## 工具

- `forge_scan(workspace)` — 工作区画像：语言分布、构建系统（cmd/cmake/npm/make）、Kconfig、
  大型 XML/ITU、`.agents/skills`、受保护目录候选（sdk/vendor/third_party）、
  `.c #include .c` 编译单元 quirk。
- `forge_plan(workspace)` — 报告 → 锻造计划（persona 规则/工具/护栏）。不写盘，先给人审。
- `forge_generate(workspace, target)` — 写入工作区 `.agents/dsh-<id>/{preset,plugin}/`。幂等。
- `forge_install(workspace)` — 固化到 `~/.dsh/.agent-presets/<id>/`，sha256 标记，
  **用户改过的文件绝不覆盖**（物化模式借鉴 dsh-ptc-cordis-preset）。
- `forge_status(workspace)` — 当前等级 + 下一步建议（由产物存在性推导，无状态文件，不漂移）。

## 挂载

forge 是元工具，建议挂到 web profile 让所有会话可用：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: agent-forge
      name: 'file:///E:/ai/dsh-agent-forge/src/index.ts'
```

host 半变更需重启 DSH（ESM 模块缓存是进程级的）。

## 典型流程

```text
forge_scan('D:/some/project')          # L0：看画像
forge_plan('D:/some/project')          # 确认计划（人审）
forge_generate(..., 'preset')          # L1
forge_generate(..., 'plugin')          # L2/L3
cd .agents/dsh-<id>/plugin && pnpm i && pnpm test   # 第一、二层
forge_install(...)                     # 固化，新会话可选
实机验证                                # 第三层（人工）
```

## 测试

17 例：第一层（scan/plan/generate/materialize 纯函数全分支）+ 第二层（注册契约、schema 编译）。
其中 generate.spec 会**执行生成的 define-tool.ts**，验证其与宿主版本行为一致。

```sh
pnpm install && pnpm test
```

## 设计原则

- **决策全部纯函数化**；文件系统访问只存在于 `collectSnapshot` 和工具 `execute`。
- **无状态文件**：成熟度由产物存在性推导，不可能漂移。
- **生成器宁少勿滥**：只生成有明确证据的条目，quirk 确认留给人。
- **生态位**：dsh-assembler 从能力目录组装 agent（原料是现成 MCP/工具）；本插件从**代码工作区**
  锻造 agent（仓库本身就是原料）。

## License

MIT
