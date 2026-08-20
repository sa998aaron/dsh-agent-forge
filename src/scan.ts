// 工作区扫描：analyzeSnapshot 是纯函数（输入快照、输出画像），
// collectSnapshot 是唯一碰文件系统的薄层。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { FsSnapshot, ScanReport } from './types.ts'

const EXT_LANG: Record<string, string> = {
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.ts': 'TypeScript', '.js': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java',
}
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'out', '.agents\node_modules'])
const PROTECTED_CANDIDATES = ['sdk', 'vendor', 'third_party', 'third-party', 'external']
const MAX_FILES = 8000

export function analyzeSnapshot(snapshot: FsSnapshot, workspaceName: string): ScanReport {
  const files = snapshot.files
  const languages: Record<string, number> = {}
  for (const f of files) {
    const ext = f.slice(f.lastIndexOf('.')).toLowerCase()
    const lang = EXT_LANG[ext]
    if (lang) languages[lang] = (languages[lang] ?? 0) + 1
  }

  const buildSystems: string[] = []
  if (files.some(f => /(^|\/)build\/.*\.cmd$/.test(f))) buildSystems.push('cmd-scripts')
  if (files.some(f => /(^|\/)CMakeLists\.txt$/.test(f))) buildSystems.push('cmake')
  if (files.some(f => /(^|\/)package\.json$/.test(f))) buildSystems.push('npm')
  if (files.some(f => /(^|\/)Makefile$/.test(f))) buildSystems.push('make')

  const topDirs = new Set(files.map(f => f.split('/')[0]))
  const protectedDirs = PROTECTED_CANDIDATES.filter(d => topDirs.has(d))

  // 聚合 include 模式：.c 文件里 #include 其他 .c（不独立编译的编译单元）
  const includeCQuirks: string[] = []
  for (const [path, content] of Object.entries(snapshot.cFileSamples ?? {})) {
    if (/^\s*#\s*include\s+"[^"]+\.c"/m.test(content)) includeCQuirks.push(path)
  }

  const hasKconfig = files.some(f => /(^|\/)Kconfig(\.|$)/.test(f))
  const hasLargeXml = files.some(f => /\.itu$/.test(f)) || files.some(f => /(^|\/)itu\//.test(f))
  const hasSkills = files.some(f => /(^|\/)\.agents\/skills\//.test(f))

  const notes: string[] = []
  if (includeCQuirks.length > 0) notes.push('检测到 .c 文件被 #include（编译单元不走独立编译）')
  if (hasLargeXml) notes.push('存在 ITU/大型 XML UI 文件，read 工具可能爆上下文')

  return {
    name: workspaceName,
    suggestedId: workspaceName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '') || 'workspace',
    languages, buildSystems, hasKconfig, hasLargeXml,
    hasSkills, hasAgentsMd: snapshot.agentsMd !== undefined,
    protectedDirs, includeCQuirks, notes,
  }
}

/** 薄 fs 层：遍历工作区采集快照。跳过大目录，抽样 .c 文件内容。 */
export async function collectSnapshot(root: string): Promise<FsSnapshot> {
  const files: string[] = []
  const cFileSamples: Record<string, string> = {}

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6 || files.length >= MAX_FILES) return
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full, depth + 1)
      } else {
        const rel = relative(root, full).split(sep).join('/')
        files.push(rel)
        if (entry.name.endsWith('.c') && Object.keys(cFileSamples).length < 60) {
          const s = await stat(full)
          if (s.size < 500_000) cFileSamples[rel] = (await readFile(full, 'utf8')).slice(0, 20_000)
        }
      }
    }
  }
  await walk(root, 0)

  let agentsMd: string | undefined
  try { agentsMd = (await readFile(join(root, 'AGENTS.md'), 'utf8')).slice(0, 8192) } catch { /* 不存在 */ }
  return { files, agentsMd, cFileSamples }
}
