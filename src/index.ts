// dsh-agent-forge —— 从任意代码工作区渐进式锻造可固化的 agent（preset + 插件）。
// 设计：五个 forge_* 工具对应成熟度阶梯 L0-L4；所有决策逻辑为纯函数，可单测。
import { defineTool } from './define-tool.ts'
import { forgeTools, type ForgeConfig } from './tools.ts'

export const name = 'dsh-agent-forge'

// cordis 强制：访问 ctx.tools 前必须声明 inject
export const inject = ['tools']

export function apply(ctx: any, config?: ForgeConfig): void {
  for (const tool of forgeTools(config ?? {})) {
    ctx.tools.register(defineTool(tool))
  }
  console.log('[dsh-agent-forge] loaded: forge_scan / forge_plan / forge_generate / forge_install / forge_status')
}
