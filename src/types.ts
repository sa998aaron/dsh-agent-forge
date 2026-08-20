// 领域类型：锻造（forge）一个工作区 agent 的全部中间产物。

/** 成熟度等级：0 观察 → 1 人格 → 2 工具 → 3 护栏 → 4 已验证 */
export type ForgeLevel = 0 | 1 | 2 | 3 | 4

export const LEVEL_NAMES: Record<ForgeLevel, string> = {
  0: '已观察（scan 报告）',
  1: '有人格（preset 可装可用）',
  2: '有工具（插件骨架）',
  3: '有护栏（编辑规则）',
  4: '已验证（三层通过）',
}

/** 文件系统快照：scan 的输入（collectSnapshot 采集，analyzeSnapshot 纯函数分析） */
export interface FsSnapshot {
  /** 工作区相对路径（posix 风格），文件列表（可截断） */
  files: string[]
  /** AGENTS.md 内容（存在时，截断前 8KB） */
  agentsMd?: string
  /** 抽样 .c 文件内容（用于检测 #include "*.c" quirk）：路径 → 内容片段 */
  cFileSamples?: Record<string, string>
}

/** 扫描报告：工作区画像 */
export interface ScanReport {
  name: string                    // 工作区目录名
  suggestedId: string             // preset id（合法字符）
  languages: Record<string, number>
  buildSystems: string[]          // 如 'cmd-scripts', 'cmake', 'npm'
  hasKconfig: boolean
  hasLargeXml: boolean            // ITU/XAML 等大 XML UI 描述
  hasSkills: boolean
  hasAgentsMd: boolean
  protectedDirs: string[]         // sdk/ vendor/ third_party/ 等
  includeCQuirks: string[]        // #include "*.c" 的文件（聚合 include 模式）
  notes: string[]
}

export type ToolKind = 'build' | 'kconfig' | 'xml-query'
export type GuardKind = 'protected-path' | 'preserve-call'

export interface ToolPlan { kind: ToolKind; reason: string }
export interface GuardPlan { kind: GuardKind; target: string; reason: string }

/** 锻造计划：由报告推导，用户确认后进入 generate */
export interface ForgePlan {
  id: string
  displayName: string
  personaRules: string[]
  tools: ToolPlan[]
  guards: GuardPlan[]
}
