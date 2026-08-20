// 物化决策：纯函数。把生成文件安装到 ~/.dsh/.agent-presets/<id>/ 时，
// 用 sha256 标记区分 forge 管理的文件和用户改过的文件：
//   - 用户改过的（磁盘 hash != 上次物化 hash）→ 绝不覆盖
//   - 未标记且已存在的（用户自建的）→ 不接管
//   - 其余 → 写入/刷新
export interface MaterializeInput {
  files: Record<string, string>
  existingHashes: Record<string, string>
  managedHashes: Record<string, string>
}

export type MaterializeAction = 'write' | 'refresh' | 'skip-user-modified' | 'skip-unmanaged'

export interface MaterializeDecision {
  path: string
  action: MaterializeAction
}

export function decideMaterialize(input: MaterializeInput): MaterializeDecision[] {
  const out: MaterializeDecision[] = []
  for (const path of Object.keys(input.files)) {
    const existing = input.existingHashes[path]
    const managed = input.managedHashes[path]
    if (existing === undefined) {
      out.push({ path, action: 'write' })
    } else if (managed !== undefined && existing === managed) {
      out.push({ path, action: 'refresh' })
    } else if (managed !== undefined) {
      out.push({ path, action: 'skip-user-modified' })
    } else {
      out.push({ path, action: 'skip-unmanaged' })
    }
  }
  return out
}
