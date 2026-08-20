// 生成器：纯函数。ForgePlan + ScanReport → { 相对路径: 文件内容 }。
// 生成 preset（L1）与插件骨架（L2/L3）；测试直接断言内容标记。
// 注意：本文件刻意不用反引号模板（避免嵌套转义），一律数组 join。
import type { ForgePlan, ScanReport } from './types.ts'

const DEFINE_TOOL_TS = [
  '// 本地 defineTool（编译版）：parameters DSL → 标准 JSON Schema',
  'export interface ToolContent { type: string; text: string }',
  'export interface ToolExecContext { signal: AbortSignal }',
  'export interface ParameterProperty { type: string; required?: boolean; description?: string; [key: string]: unknown }',
  'export interface ToolDescriptor<A = any, V = any> { name: string; description: string; parameters: Record<string, ParameterProperty>; output: { schema: unknown; render: (a: A, v: V) => ToolContent[] }; execute: (a: A, e: ToolExecContext) => Promise<V> }',
  'export function parametersToJsonSchema(params: Record<string, ParameterProperty>): Record<string, unknown> {',
  '  const properties: Record<string, unknown> = {}',
  '  const required: string[] = []',
  '  for (const [key, spec] of Object.entries(params)) {',
  '    const { required: req, ...rest } = spec',
  '    properties[key] = rest',
  '    if (req === true) required.push(key)',
  '  }',
  "  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }",
  '}',
  "export function defineTool<T extends ToolDescriptor>(def: T): Omit<T, 'parameters'> & { parameters: Record<string, unknown> } {",
  '  return { ...def, parameters: parametersToJsonSchema(def.parameters) }',
  '}',
  '',
].join('\n')

export function generatePresetFiles(plan: ForgePlan, report: ScanReport): Record<string, string> {
  const ruleLines = plan.personaRules.map((r, i) => '      ' + (i + 1) + '. ' + r)
  const yml: string[] = [
    '# 由 dsh-agent-forge 生成；可手工编辑，forge_install 不会覆盖已改动文件',
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    text: >-',
    '      You are the ' + report.name + ' workspace agent, powered by {{model}}.',
    '      Working directory is {{cwd}}.',
  ]
  if (ruleLines.length > 0) yml.push('      硬性规则：', ...ruleLines)
  yml.push(
    '',
    '- id: agent-instructions',
    "  name: '@deepseek-ai/dsh-agent-instructions'",
    '',
    '- id: tool-pwsh',
    "  name: '@deepseek-ai/dsh-tool-pwsh'",
    "  disabled: !!js process.platform !== 'win32'",
    '',
    '- id: tool-bash',
    "  name: '@deepseek-ai/dsh-tool-bash'",
    "  disabled: !!js process.platform === 'win32'",
    '',
    '- id: tool-fs',
    "  name: '@deepseek-ai/dsh-tool-fs'",
    '',
    '- id: tool-fs-search',
    "  name: '@deepseek-ai/dsh-tool-fs-search'",
    '',
    '- id: skill-filesystem',
    "  name: '@deepseek-ai/dsh-skill-filesystem'",
    '',
    '- id: tool-skill',
    "  name: '@deepseek-ai/dsh-tool-skill'",
    '',
  )
  return {
    'preset.yml': ['name: ' + plan.displayName, 'description: dsh-agent-forge 生成的 ' + report.name + ' 工作区 Agent', ''].join('\n'),
    'agent.cordis.yml': yml.join('\n'),
  }
}

/** L2/L3：插件骨架。工具按 plan.tools 生成 stub，护栏规则为纯数据表。 */
export function generatePluginFiles(plan: ForgePlan, report: ScanReport): Record<string, string> {
  const stubs: string[] = []
  for (const t of plan.tools) {
    const toolName = plan.id + '_' + t.kind.replace(/-/g, '_')
    stubs.push(
      '  // ' + t.reason,
      '  ctx.tools.register(defineTool({',
      "    name: '" + toolName + "',",
      "    description: 'TODO: " + t.kind + " tool（forge 生成的 stub，按工作区实际实现）',",
      "    parameters: { query: { type: 'string', description: '可选参数' } },",
      "    output: { schema: { type: 'object' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: JSON.stringify(v) }] },",
      "    async execute() { throw new Error('" + t.kind + " 工具待实现') },",
      '  }))',
    )
  }
  const ruleRows: string[] = []
  for (const g of plan.guards) {
    if (g.kind !== 'protected-path') continue
    ruleRows.push("  { segment: '" + g.target + "', action: 'deny', reason: '" + g.reason + "' },")
  }
  const indexTs: string[] = [
    '// ' + plan.displayName + ' host 插件 —— dsh-agent-forge 生成（工作区：' + report.name + '）',
    "import { defineTool } from './define-tool.ts'",
    "import { createGuard } from './guard.ts'",
    '',
    "export const name = 'dsh-plugin-" + plan.id + "'",
    "export const inject = ['tools']",
    '',
    'export function apply(ctx: any, _config?: unknown): void {',
    ...(stubs.length > 0 ? stubs : ['  //（未探测到可生成工具的特征）']),
    '',
    "  ctx.on('tools/pre-execute', createGuard())",
    "  console.log('[dsh-plugin-" + plan.id + "] loaded')",
    '}',
    '',
  ]
  const guardTs: string[] = [
    '// 护栏：forge 从工作区 quirk 推导的规则表（纯数据）+ 薄接线',
    "export interface GuardRule { segment: string; action: 'deny' | 'warn'; reason: string }",
    '',
    'export const RULES: GuardRule[] = [',
    ...(ruleRows.length > 0 ? ruleRows : ['  //（未探测到受保护路径）']),
    ']',
    '',
    "export function decide(filePath: string): { verdict: 'allow' | 'warn' | 'deny'; reason?: string } {",
    '  const BS = String.fromCharCode(92) // 反斜杠，避免多层转义',
    "  const p = '/' + filePath.split(BS).join('/') + '/'",
    '  for (const r of RULES) {',
    "    if (p.includes('/' + r.segment)) return { verdict: r.action, reason: r.reason }",
    '  }',
    "  return { verdict: 'allow' }",
    '}',
    '',
    'export function createGuard() {',
    '  return async (exec: any, next: (e: any) => Promise<unknown>) => {',
    "    if (exec.name !== 'write' && exec.name !== 'edit') return await next(exec)",
    "    const d = decide(exec.arguments?.file_path ?? '')",
    "    if (d.verdict === 'deny') return { blocked: true, reason: d.reason }",
    "    if (d.verdict === 'warn') console.warn('[forge-guard]', d.reason)",
    '    return await next(exec)',
    '  }',
    '}',
    '',
  ]
  return {
    'src/index.ts': indexTs.join('\n'),
    'src/guard.ts': guardTs.join('\n'),
    'src/define-tool.ts': DEFINE_TOOL_TS,
  }
}
