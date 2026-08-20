import { describe, expect, it } from 'vitest'
import { generatePluginFiles, generatePresetFiles } from '../src/generate.ts'
import type { ForgePlan, ScanReport } from '../src/types.ts'

const REPORT: ScanReport = {
  name: 'demo', suggestedId: 'demo', languages: { C: 10 },
  buildSystems: ['cmd-scripts'], hasKconfig: true, hasLargeXml: false,
  hasSkills: true, hasAgentsMd: true, protectedDirs: ['sdk'],
  includeCQuirks: ['hub.c'], notes: [],
}
const PLAN: ForgePlan = {
  id: 'demo', displayName: 'demo 模式',
  personaRules: ['判断模块是否编译时先查 .config，不要靠猜。'],
  tools: [{ kind: 'build', reason: '检测到 build/*.cmd' }, { kind: 'kconfig', reason: '检测到 Kconfig' }],
  guards: [{ kind: 'protected-path', target: 'sdk/', reason: 'sdk/ 不可修改' }],
}

describe('generatePresetFiles（第一层：纯函数）', () => {
  it('生成 preset.yml + agent.cordis.yml，含 persona 规则与工具行', () => {
    const files = generatePresetFiles(PLAN, REPORT)
    expect(files['preset.yml']).toContain('demo 模式')
    const yml = files['agent.cordis.yml']
    expect(yml).toContain('@deepseek-ai/dsh-persona')
    expect(yml).toContain('1. 判断模块是否编译时先查 .config')
    expect(yml).toContain('@deepseek-ai/dsh-tool-pwsh')
    expect(yml).toContain('{{cwd}}')
  })
})

describe('generatePluginFiles（第一层：纯函数）', () => {
  it('生成 index/guard/define-tool 三件套，工具 stub 与护栏规则内嵌', () => {
    const files = generatePluginFiles(PLAN, REPORT)
    expect(files['src/index.ts']).toContain("name: 'demo_build'")
    expect(files['src/index.ts']).toContain("name: 'demo_kconfig'")
    expect(files['src/index.ts']).toContain("inject = ['tools']")
    expect(files['src/guard.ts']).toContain("segment: 'sdk/'")
    expect(files['src/define-tool.ts']).toContain('parametersToJsonSchema')
  })

  it('生成的 define-tool.ts 与宿主版本行为一致（schema 编译）', async () => {
    const files = generatePluginFiles(PLAN, REPORT)
    // 动态执行生成的 define-tool.ts：写入临时文件再 import
    const { writeFile, mkdtemp } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'forge-gen-'))
    const p = join(dir, 'define-tool.ts')
    await writeFile(p, files['src/define-tool.ts'])
    const mod = await import(p)
    const schema = mod.parametersToJsonSchema({ a: { type: 'string', required: true } })
    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(['a'])
  })
})
