// 第二层：契约测试
import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/index.ts'
import { defineTool } from '../src/define-tool.ts'
import { forgeTools } from '../src/tools.ts'

function makeFakeCtx() {
  const registered: { name: string }[] = []
  return { tools: { registered, register: (d: { name: string }) => registered.push(d) }, on: () => {} }
}

describe('apply() 接线（第二层：契约）', () => {
  it('注册五个 forge_* 工具', () => {
    const ctx = makeFakeCtx()
    apply(ctx, {})
    expect(ctx.tools.registered.map(t => t.name)).toEqual([
      'forge_scan', 'forge_plan', 'forge_generate', 'forge_install', 'forge_status',
    ])
  })

  it('声明 inject: [tools]', () => {
    expect(inject).toContain('tools')
  })

  it('所有工具 parameters 编译为根级 type: object 的 JSON Schema', () => {
    for (const t of forgeTools({})) {
      const compiled = defineTool(t).parameters as { type: string; required?: string[] }
      expect(compiled.type).toBe('object')
      expect(compiled.required).toContain('workspace')
    }
  })

  it('config 可省略（undefined 不炸）', () => {
    expect(() => apply(makeFakeCtx(), undefined)).not.toThrow()
  })
})
