import { describe, expect, it } from 'vitest'
import { analyzeSnapshot } from '../src/scan.ts'
import type { FsSnapshot } from '../src/types.ts'

// 中性化夹具：模拟一个嵌入式固件工程的典型结构
const FW_LIKE: FsSnapshot = {
  files: [
    'main.c', 'board_api.c', 'temp_ctrl.c', 'CMakeLists.txt',
    'build/openrtos/fw_demo.cmd', 'build/win32/fw_demo.cmd',
    'Kconfig', 'build/openrtos/fw_demo/.config',
    'itu/1920x480/template.xml', 'sdk/chip/it9860.c',
    '.agents/skills/temp-control/SKILL.md', 'package.json',
  ],
  agentsMd: '# fw_demo',
  cFileSamples: {
    'board_api.c': '#include "temp_ctrl.c"\n#include "led_ctrl.c"\n',
    'main.c': '#include <stdio.h>\nint main() {}\n',
  },
}

describe('analyzeSnapshot（第一层：纯函数）', () => {
  it('识别构建系统 / Kconfig / ITU / skills / AGENTS.md', () => {
    const r = analyzeSnapshot(FW_LIKE, 'fw_demo')
    expect(r.buildSystems).toContain('cmd-scripts')
    expect(r.buildSystems).toContain('cmake')
    expect(r.buildSystems).toContain('npm')
    expect(r.hasKconfig).toBe(true)
    expect(r.hasLargeXml).toBe(true)
    expect(r.hasSkills).toBe(true)
    expect(r.hasAgentsMd).toBe(true)
  })

  it('检测 sdk/ 为受保护目录候选', () => {
    expect(analyzeSnapshot(FW_LIKE, 'fw_demo').protectedDirs).toContain('sdk')
  })

  it('检测 .c 文件 #include .c 的 quirk（聚合 include 模式）', () => {
    const r = analyzeSnapshot(FW_LIKE, 'fw_demo')
    expect(r.includeCQuirks).toEqual(['board_api.c'])
    expect(r.notes.some(n => n.includes('#include'))).toBe(true)
  })

  it('suggestedId 清洗为合法 preset id', () => {
    expect(analyzeSnapshot(FW_LIKE, 'Demo_FW Pro').suggestedId).toBe('demo-fw-pro')
    expect(analyzeSnapshot(FW_LIKE, '___').suggestedId).toBe('workspace')
  })

  it('空工作区不产生误报', () => {
    const r = analyzeSnapshot({ files: [] }, 'empty')
    expect(r.buildSystems).toHaveLength(0)
    expect(r.protectedDirs).toHaveLength(0)
    expect(r.includeCQuirks).toHaveLength(0)
  })
})
