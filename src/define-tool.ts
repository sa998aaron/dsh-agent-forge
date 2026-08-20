// 本地最小 defineTool（编译版）：零外部依赖，file: URL 挂载无解析风险。
// parameters 用官方 DSL（隐式对象根 + 属性级 required: true），注册前编译成
// 标准 JSON Schema（根级 type: "object"），否则模型 API 400。
// 若同时维护多个项目级插件，建议把本文件抽为公共包，避免多处拷贝漂移。
export interface ToolContent {
  type: string
  text: string
}

export interface ToolExecContext {
  signal: AbortSignal
  agent?: { session?: { header?: { cwd?: string } } }
}

export interface ParameterProperty {
  type: string
  required?: boolean
  description?: string
  [key: string]: unknown
}

export interface ToolDescriptor<TArgs = any, TValue = any> {
  name: string
  description: string
  parameters: Record<string, ParameterProperty>
  output: {
    schema: unknown
    render: (args: TArgs, value: TValue) => ToolContent[]
  }
  execute: (args: TArgs, exec: ToolExecContext) => Promise<TValue>
}

export function parametersToJsonSchema(
  params: Record<string, ParameterProperty>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const [key, spec] of Object.entries(params)) {
    const { required: req, ...rest } = spec
    properties[key] = rest
    if (req === true) required.push(key)
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }
}

export function defineTool<T extends ToolDescriptor>(def: T): Omit<T, 'parameters'> & { parameters: Record<string, unknown> } {
  return { ...def, parameters: parametersToJsonSchema(def.parameters) }
}
