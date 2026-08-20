import { describe, expect, it } from 'vitest'
import { decideMaterialize } from '../src/materialize.ts'

describe('decideMaterialize（第一层：纯函数）', () => {
  const files = { 'a.yml': 'A', 'b.yml': 'B', 'c.yml': 'C', 'd.yml': 'D' }

  it('四种分支：write / refresh / skip-user-modified / skip-unmanaged', () => {
    const d = decideMaterialize({
      files,
      existingHashes: { 'b.yml': 'hashB_old', 'c.yml': 'hashC_user', 'd.yml': 'hashD_user' },
      managedHashes: { 'b.yml': 'hashB_old', 'c.yml': 'hashC_forge' },
    })
    expect(d).toEqual([
      { path: 'a.yml', action: 'write' },
      { path: 'b.yml', action: 'refresh' },
      { path: 'c.yml', action: 'skip-user-modified' },
      { path: 'd.yml', action: 'skip-unmanaged' },
    ])
  })

  it('用户改过的文件绝不覆盖——这是固化的核心承诺', () => {
    const d = decideMaterialize({
      files: { 'agent.cordis.yml': 'new' },
      existingHashes: { 'agent.cordis.yml': 'useredit' },
      managedHashes: { 'agent.cordis.yml': 'forgelast' },
    })
    expect(d[0].action).toBe('skip-user-modified')
  })
})
