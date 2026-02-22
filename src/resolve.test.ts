import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveFiles } from './resolve.ts'

describe('resolveFiles', () => {
  let dir: string

  const setup = async () => {
    dir = await mkdtemp(join(tmpdir(), 'sat-resolve-'))
    return dir
  }

  const cleanup = async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('falls through to discover for empty filesArg', async () => {
    const d = await setup()
    const result = await resolveFiles(d, '')

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()

    await cleanup()
  })

  it('returns error for whitespace-only filesArg', async () => {
    const d = await setup()
    const result = await resolveFiles(d, '  ,  , ')

    expect(result.data).toBeNull()
    expect(result.error).toBe('No valid file paths provided')

    await cleanup()
  })

  it('reads explicit file paths from filesArg', async () => {
    const d = await setup()
    const filePath = join(d, 'rules.md')
    await writeFile(filePath, 'Rule: test\nReason: because\n', 'utf-8')

    const result = await resolveFiles(d, 'rules.md')

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect(result.data).toHaveLength(1)

    const file = result.data?.[0]
    expect(file).toBeDefined()
    expect(file?.path).toContain('rules.md')
    expect(file?.content).toContain('Rule: test')

    await cleanup()
  })

  it('splits comma-separated paths', async () => {
    const d = await setup()
    await writeFile(join(d, 'a.md'), 'rule a\n', 'utf-8')
    await writeFile(join(d, 'b.md'), 'rule b\n', 'utf-8')

    const result = await resolveFiles(d, 'a.md, b.md')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)

    await cleanup()
  })

  it('trims whitespace from paths', async () => {
    const d = await setup()
    await writeFile(join(d, 'rules.md'), 'content\n', 'utf-8')

    const result = await resolveFiles(d, '  rules.md  ')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)

    await cleanup()
  })

  it('falls through to discover when no filesArg', async () => {
    const d = await setup()
    const configPath = join(d, 'opencode.json')
    const instructionsDir = join(d, 'instructions')
    await mkdir(instructionsDir, { recursive: true })
    await writeFile(join(instructionsDir, 'rules.md'), 'Rule: discovered\nReason: found\n', 'utf-8')
    await writeFile(configPath, JSON.stringify({ instructions: ['instructions/*.md'] }), 'utf-8')

    const result = await resolveFiles(d)

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()

    const files = result.data ?? []
    expect(files.length).toBeGreaterThan(0)

    const file = files[0]
    expect(file).toBeDefined()
    expect(file?.content).toContain('Rule: discovered')

    await cleanup()
  })

  it('returns error from discover when no opencode.json', async () => {
    const d = await setup()

    const result = await resolveFiles(d)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()

    await cleanup()
  })

  it('handles nonexistent explicit file path', async () => {
    const d = await setup()

    const result = await resolveFiles(d, 'nonexistent.md')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)

    const file = result.data?.[0]
    expect(file).toBeDefined()
    expect(file?.error).toBeDefined()

    await cleanup()
  })
})
