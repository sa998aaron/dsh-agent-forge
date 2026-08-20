// forge_* 工具：薄 fs 接线层。所有决策逻辑在 scan/plan/generate/materialize 纯函数里。
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { analyzeSnapshot, collectSnapshot } from './scan.ts'
import { planForge } from './plan.ts'
import { generatePluginFiles, generatePresetFiles } from './generate.ts'
import { decideMaterialize } from './materialize.ts'
import { LEVEL_NAMES, type ForgeLevel, type ScanReport } from './types.ts'
import type { ToolDescriptor } from './define-tool.ts'

export interface ForgeConfig {
  /** dsh 用户根（默认 ~/.dsh）；preset 物化到其 .agent-presets/ 下 */
  dshHome?: string
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

function presetRoot(cfg: ForgeConfig): string {
  return join(cfg.dshHome ?? join(homedir(), '.dsh'), '.agent-presets')
}

async function scanWorkspace(workspace: string): Promise<ScanReport> {
  const snapshot = await collectSnapshot(workspace)
  return analyzeSnapshot(snapshot, basename(workspace))
}

async function writeFiles(root: string, files: Record<string, string>): Promise<string[]> {
  const written: string[] = []
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    await mkdir(join(full, '..'), { recursive: true })
    await writeFile(full, content, 'utf8')
    written.push(rel)
  }
  return written
}

/** 当前成熟度：由产物存在性推导，无状态文件，永不漂移 */
export async function detectLevel(workspace: string, report: ScanReport): Promise<ForgeLevel> {
  const dir = join(workspace, '.agents', 'dsh-' + report.suggestedId)
  if (!existsSync(join(dir, 'preset', 'agent.cordis.yml'))) return 0
  if (!existsSync(join(dir, 'plugin', 'src', 'index.ts'))) return 1
  if (!existsSync(join(dir, 'plugin', 'src', 'guard.ts'))) return 2
  return 3 // L4（实机验证）只能由人确认，见 forge_status 输出
}

export function forgeTools(cfg: ForgeConfig): ToolDescriptor[] {
  return [
    {
      name: 'forge_scan',
      description: '扫描指定代码工作区，输出画像报告（语言/构建系统/Kconfig/大XML/受保护目录/include-c quirk）。锻造 agent 的第一步。',
      parameters: { workspace: { type: 'string', required: true, description: '工作区绝对路径' } },
      output: { schema: { type: 'object' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
      async execute(args: { workspace: string }) { return await scanWorkspace(args.workspace) },
    },
    {
      name: 'forge_plan',
      description: '基于扫描报告推导锻造计划（persona 规则/工具/护栏），返回给用户确认，不写任何文件。',
      parameters: { workspace: { type: 'string', required: true, description: '工作区绝对路径' } },
      output: { schema: { type: 'object' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
      async execute(args: { workspace: string }) { return planForge(await scanWorkspace(args.workspace)) },
    },
    {
      name: 'forge_generate',
      description: '生成锻造产物并写入工作区 .agents/dsh-<id>/ 下：target=preset 生成 L1 preset；target=plugin 生成 L2/L3 插件骨架。幂等，可重复执行。',
      parameters: {
        workspace: { type: 'string', required: true, description: '工作区绝对路径' },
        target: { type: 'string', required: true, description: 'preset | plugin' },
      },
      output: { schema: { type: 'object' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
      async execute(args: { workspace: string; target: string }) {
        const report = await scanWorkspace(args.workspace)
        const plan = planForge(report)
        const dir = join(args.workspace, '.agents', 'dsh-' + plan.id)
        const files = args.target === 'preset' ? generatePresetFiles(plan, report)
          : args.target === 'plugin' ? generatePluginFiles(plan, report)
          : (() => { throw new Error('target 必须是 preset 或 plugin') })()
        const written = await writeFiles(join(dir, args.target), files)
        return { id: plan.id, dir: join(dir, args.target), written }
      },
    },
    {
      name: 'forge_install',
      description: '固化：把工作区的 preset 物化到 ~/.dsh/.agent-presets/<id>/（sha256 标记，用户改过的文件绝不覆盖）。安装后新会话即可选用。',
      parameters: { workspace: { type: 'string', required: true, description: '工作区绝对路径' } },
      output: { schema: { type: 'object' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
      async execute(args: { workspace: string }) {
        const report = await scanWorkspace(args.workspace)
        const plan = planForge(report)
        const src = join(args.workspace, '.agents', 'dsh-' + plan.id, 'preset')
        const dst = join(presetRoot(cfg), plan.id)
        const files = generatePresetFiles(plan, report)
        const existingHashes: Record<string, string> = {}
        if (existsSync(dst)) {
          for (const f of await readdir(dst)) {
            if (f.endsWith('.yml')) existingHashes[f] = sha256(await readFile(join(dst, f), 'utf8'))
          }
        }
        let managedHashes: Record<string, string> = {}
        try { managedHashes = JSON.parse(await readFile(join(dst, '.forge-managed.json'), 'utf8')) } catch { /* 首次安装 */ }
        const decisions = decideMaterialize({ files, existingHashes, managedHashes })
        await mkdir(dst, { recursive: true })
        const newManaged: Record<string, string> = {}
        for (const d of decisions) {
          if (d.action === 'write' || d.action === 'refresh') {
            await writeFile(join(dst, d.path), files[d.path], 'utf8')
            newManaged[d.path] = sha256(files[d.path])
          }
        }
        await writeFile(join(dst, '.forge-managed.json'), JSON.stringify(newManaged, null, 2), 'utf8')
        return { id: plan.id, installedTo: dst, decisions }
      },
    },
    {
      name: 'forge_status',
      description: '报告工作区 agent 的当前成熟度等级（L0-L4）与下一步建议。',
      parameters: { workspace: { type: 'string', required: true, description: '工作区绝对路径' } },
      output: { schema: { type: 'object' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
      async execute(args: { workspace: string }) {
        const report = await scanWorkspace(args.workspace)
        const level = await detectLevel(args.workspace, report)
        const installed = existsSync(join(presetRoot(cfg), report.suggestedId, 'agent.cordis.yml'))
        const next = level === 0 ? 'forge_generate target=preset 生成 L1 人格 preset'
          : level === 1 ? 'forge_generate target=plugin 生成 L2 工具骨架'
          : level === 2 ? '完善护栏规则（L3）'
          : level === 3 ? '三层验证：跑插件 vitest + 实机挂载确认（L4 只能人工确认）'
          : '已达 L4'
        return { level, levelName: LEVEL_NAMES[level], installed, suggestedId: report.suggestedId, next }
      },
    },
  ]
}
