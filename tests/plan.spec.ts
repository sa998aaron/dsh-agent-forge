import { describe, expect, it } from 'vitest'
import { planForge } from '../src/plan.ts'
import { analyzeSnapshot } from '../src/scan.ts'
import type { FsSnapshot } from '../src/types.ts'

function reportFrom(files: string[], cFileSamples: Record<string, string> = {}) {
  return analyzeSnapshot({ files, cFileSamples } satisfies FsSnapshot, 'demo')
}

describe('planForge（第一层：纯函数）', () => {
  it('build 脚本 → build 工具；Kconfig → kconfig 工具 + persona 规则', () => {
    const plan = planForge(reportFrom(['build/openrtos/x.cmd', 'Kconfig']))
    expect(plan.tools.map(t => t.kind)).toEqual(['build', 'kconfig'])
    expect(plan.personaRules.some(r => r.includes('.config'))).toBe(true)
  })

  it('sdk/ → protected-path 护栏；include-c → preserve-call 护栏', () => {
    const plan = planForge(reportFrom(['sdk/x.c', 'hub.c'], { 'hub.c': '#include "a.c"' }))
    expect(plan.guards.some(g => g.kind === 'protected-path' && g.target === 'sdk/')).toBe(true)
    expect(plan.guards.some(g => g.kind === 'preserve-call' && g.target === 'hub.c')).toBe(true)
  })

  it('无特征的工作区生成空计划（宁少勿滥）', () => {
    const plan = planForge(reportFrom(['readme.md']))
    expect(plan.tools).toHaveLength(0)
    expect(plan.guards).toHaveLength(0)
  })
})
