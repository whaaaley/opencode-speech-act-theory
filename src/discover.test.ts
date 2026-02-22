import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { discover, readFilePaths } from './discover.ts'

let tmpDir = ''

const makeTmpDir = async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'sat-discover-'))
  return tmpDir
}

const writeConfig = async (dir: string, config: Record<string, unknown>) => {
  await writeFile(join(dir, 'opencode.json'), JSON.stringify(config), 'utf-8')
}

const writeInstruction = async (dir: string, relativePath: string, content: string) => {
  const full = join(dir, relativePath)
  const parent = dirname(full)
  await mkdir(parent, { recursive: true })
  await writeFile(full, content, 'utf-8')
}

describe('discover', () => {
  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = ''
    }
  })

  it('returns error when opencode.json is missing', async () => {
    const dir = await makeTmpDir()
    const result = await discover(dir)

    expect(result.data).toEqual(null)
    expect(result.error).not.toEqual(null)
    expect(result.error).toContain('Could not read')
  })

  it('returns error when instructions array is missing', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { theme: 'opencode' })
    const result = await discover(dir)

    expect(result.data).toEqual(null)
    expect(result.error).not.toEqual(null)
    expect(result.error).toContain('No "instructions" array')
  })

  it('returns error when instructions array is empty', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: [] })
    const result = await discover(dir)

    expect(result.data).toEqual(null)
    expect(result.error).not.toEqual(null)
    expect(result.error).toContain('No "instructions" array')
  })

  it('returns error when no files match patterns', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['nonexistent/*.md'] })
    const result = await discover(dir)

    expect(result.data).toEqual(null)
    expect(result.error).not.toEqual(null)
    expect(result.error).toContain('No instruction files found matching')
  })

  it('discovers files matching a single glob pattern', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md'] })
    await writeInstruction(dir, 'docs/rules.md', 'rule content')
    const result = await discover(dir)

    expect(result.error).toEqual(null)
    expect(result.data).not.toEqual(null)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.path).toEqual(join(dir, 'docs/rules.md'))
    expect(result.data?.[0]?.content).toEqual('rule content')
  })

  it('discovers files matching multiple glob patterns', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md', 'agents/*.md'] })
    await writeInstruction(dir, 'docs/a.md', 'alpha')
    await writeInstruction(dir, 'agents/b.md', 'beta')
    const result = await discover(dir)

    expect(result.error).toEqual(null)
    expect(result.data).not.toEqual(null)
    expect(result.data).toHaveLength(2)

    const paths = result.data?.map((f) => f.path) ?? []
    expect(paths).toContain(join(dir, 'docs/a.md'))
    expect(paths).toContain(join(dir, 'agents/b.md'))
  })

  it('deduplicates files matched by overlapping patterns', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md', 'docs/rules.md'] })
    await writeInstruction(dir, 'docs/rules.md', 'content')
    const result = await discover(dir)

    expect(result.error).toEqual(null)
    expect(result.data).not.toEqual(null)
    expect(result.data).toHaveLength(1)
  })

  it('reads file content correctly', async () => {
    const dir = await makeTmpDir()
    const content = 'Use conventional commits.\nAlways write tests.'
    await writeConfig(dir, { instructions: ['*.md'] })
    await writeInstruction(dir, 'rules.md', content)
    const result = await discover(dir)

    expect(result.error).toEqual(null)
    expect(result.data).not.toEqual(null)
    expect(result.data?.[0]?.content).toEqual(content)
  })

  it('returns error content for unreadable files', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md'] })
    await writeInstruction(dir, 'docs/good.md', 'good content')
    // create a directory where a file is expected to trick readFile
    await mkdir(join(dir, 'docs/bad.md'), { recursive: true })
    const result = await discover(dir)

    expect(result.error).toEqual(null)
    expect(result.data).not.toEqual(null)
    expect(result.data).toHaveLength(2)

    const bad = result.data?.find((f) => f.path.includes('bad.md'))
    expect(bad).not.toEqual(undefined)
    expect(bad?.error).toBeDefined()
    expect(bad?.content).toEqual('')
  })

  it('returns error for invalid JSON in opencode.json', async () => {
    const dir = await makeTmpDir()
    await writeFile(join(dir, 'opencode.json'), 'not valid json', 'utf-8')
    const result = await discover(dir)

    expect(result.data).toEqual(null)
    expect(result.error).not.toEqual(null)
    expect(result.error).toContain('Invalid JSON')
  })

  it('filters out non-string entries in instructions', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md', 42, null, 'agents/*.md'] })
    await writeInstruction(dir, 'docs/a.md', 'alpha')
    await writeInstruction(dir, 'agents/b.md', 'beta')
    const result = await discover(dir)

    expect(result.error).toEqual(null)
    expect(result.data).not.toEqual(null)
    expect(result.data).toHaveLength(2)
  })
})

describe('readFilePaths', () => {
  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = ''
    }
  })

  it('reads files by relative path', async () => {
    const dir = await makeTmpDir()
    await writeInstruction(dir, 'docs/rules.md', 'rule content')

    const results = await readFilePaths(dir, ['docs/rules.md'])

    expect(results.length).toEqual(1)
    expect(results[0].path).toEqual(join(dir, 'docs/rules.md'))
    expect(results[0].content).toEqual('rule content')
    expect(results[0].error).toEqual(undefined)
  })

  it('reads files by absolute path', async () => {
    const dir = await makeTmpDir()
    await writeInstruction(dir, 'testing.md', 'test content')
    const absPath = join(dir, 'testing.md')

    const results = await readFilePaths(dir, [absPath])

    expect(results.length).toEqual(1)
    expect(results[0].content).toEqual('test content')
    expect(results[0].error).toEqual(undefined)
  })

  it('reads multiple files', async () => {
    const dir = await makeTmpDir()
    await writeInstruction(dir, 'a.md', 'alpha')
    await writeInstruction(dir, 'b.md', 'beta')

    const results = await readFilePaths(dir, ['a.md', 'b.md'])

    expect(results.length).toEqual(2)
    expect(results[0].content).toEqual('alpha')
    expect(results[1].content).toEqual('beta')
  })

  it('returns error for nonexistent file', async () => {
    const dir = await makeTmpDir()

    const results = await readFilePaths(dir, ['missing.md'])

    expect(results.length).toEqual(1)
    expect(results[0].content).toEqual('')
    expect(results[0].error).not.toEqual(undefined)
  })

  it('returns empty array for empty paths', async () => {
    const dir = await makeTmpDir()

    const results = await readFilePaths(dir, [])

    expect(results.length).toEqual(0)
  })

  it('handles mix of valid and invalid paths', async () => {
    const dir = await makeTmpDir()
    await writeInstruction(dir, 'good.md', 'good content')

    const results = await readFilePaths(dir, ['good.md', 'bad.md'])

    expect(results.length).toEqual(2)
    expect(results[0].content).toEqual('good content')
    expect(results[0].error).toEqual(undefined)
    expect(results[1].content).toEqual('')
    expect(results[1].error).not.toEqual(undefined)
  })
})
