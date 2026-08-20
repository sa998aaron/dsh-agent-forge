// 锻造计划推导：纯函数。报告里每类事实映射成 persona 规则、工具、护栏。
// 映射规则刻意保守：只生成有明确证据的条目，宁少勿滥（用户确认环节再补）。
import type { ForgePlan, ScanReport } from './types.ts'

export function planForge(report: ScanReport): ForgePlan {
  const personaRules: string[] = []
  const tools: ForgePlan['tools'] = []
  const guards: ForgePlan['guards'] = []

  if (report.buildSystems.includes('cmd-scripts')) {
    tools.push({ kind: 'build', reason: '检测到 build/*.cmd 构建脚本，生成构建摘要工具' })
  }
  if (report.hasKconfig) {
    tools.push({ kind: 'kconfig', reason: '检测到 Kconfig 体系，生成 .config 查询工具' })
    personaRules.push('判断模块是否编译时先查 .config，不要靠猜。')
  }
  if (report.hasLargeXml) {
    tools.push({ kind: 'xml-query', reason: '检测到大型 XML/ITU 文件，生成流式查询工具' })
  }
  for (const dir of report.protectedDirs) {
    guards.push({ kind: 'protected-path', target: dir + '/', reason: dir + '/ 通常是不可修改的外部代码' })
  }
  for (const f of report.includeCQuirks) {
    personaRules.push(f + ' 直接 #include 其他 .c 文件：新增源文件可能要双登记（构建脚本 + include 列表）。')
    guards.push({ kind: 'preserve-call', target: f, reason: 'include 列表完整性约束' })
  }

  return {
    id: report.suggestedId,
    displayName: report.name + ' 模式',
    personaRules, tools, guards,
  }
}
