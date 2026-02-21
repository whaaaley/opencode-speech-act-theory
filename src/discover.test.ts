import { assertEquals, assertNotEquals } from '@std/assert'
import { afterEach, describe, it } from '@std/testing/bdd'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discover } from './discover.ts'

let tmpDir = ''

const makeTmpDir = async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'irf-discover-'))
  return tmpDir
}

const writeConfig = async (dir: string, config: Record<string, unknown>) => {
  await writeFile(join(dir, 'opencode.json'), JSON.stringify(config), 'utf-8')
}

const writeInstruction = async (dir: string, relativePath: string, content: string) => {
  const full = join(dir, relativePath)
  const parent = full.substring(0, full.lastIndexOf('/'))
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

    assertEquals(result.data, null)
    assertNotEquals(result.error, null)
    assertEquals(result.error !== null && result.error.includes('Could not read'), true)
  })

  it('returns error when instructions array is missing', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { theme: 'opencode' })
    const result = await discover(dir)

    assertEquals(result.data, null)
    assertNotEquals(result.error, null)
    assertEquals(result.error !== null && result.error.includes('No "instructions" array'), true)
  })

  it('returns error when instructions array is empty', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: [] })
    const result = await discover(dir)

    assertEquals(result.data, null)
    assertNotEquals(result.error, null)
    assertEquals(result.error !== null && result.error.includes('No "instructions" array'), true)
  })

  it('returns error when no files match patterns', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['nonexistent/*.md'] })
    const result = await discover(dir)

    assertEquals(result.data, null)
    assertNotEquals(result.error, null)
    assertEquals(result.error !== null && result.error.includes('No instruction files found matching'), true)
  })

  it('discovers files matching a single glob pattern', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md'] })
    await writeInstruction(dir, 'docs/rules.md', 'rule content')
    const result = await discover(dir)

    assertEquals(result.error, null)
    assertNotEquals(result.data, null)
    assertEquals(result.data !== null && result.data.length, 1)
    assertEquals(result.data !== null && result.data[0].path, join(dir, 'docs/rules.md'))
    assertEquals(result.data !== null && result.data[0].content, 'rule content')
  })

  it('discovers files matching multiple glob patterns', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md', 'agents/*.md'] })
    await writeInstruction(dir, 'docs/a.md', 'alpha')
    await writeInstruction(dir, 'agents/b.md', 'beta')
    const result = await discover(dir)

    assertEquals(result.error, null)
    assertNotEquals(result.data, null)
    assertEquals(result.data !== null && result.data.length, 2)

    if (result.data) {
      const paths = result.data.map((f) => f.path)
      assertEquals(paths.includes(join(dir, 'docs/a.md')), true)
      assertEquals(paths.includes(join(dir, 'agents/b.md')), true)
    }
  })

  it('deduplicates files matched by overlapping patterns', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md', 'docs/rules.md'] })
    await writeInstruction(dir, 'docs/rules.md', 'content')
    const result = await discover(dir)

    assertEquals(result.error, null)
    assertNotEquals(result.data, null)
    assertEquals(result.data !== null && result.data.length, 1)
  })

  it('reads file content correctly', async () => {
    const dir = await makeTmpDir()
    const content = 'Use conventional commits.\nAlways write tests.'
    await writeConfig(dir, { instructions: ['*.md'] })
    await writeInstruction(dir, 'rules.md', content)
    const result = await discover(dir)

    assertEquals(result.error, null)
    assertNotEquals(result.data, null)
    assertEquals(result.data !== null && result.data[0].content, content)
  })

  it('returns error content for unreadable files', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md'] })
    await writeInstruction(dir, 'docs/good.md', 'good content')
    // create a directory where a file is expected to trick readFile
    await mkdir(join(dir, 'docs/bad.md'), { recursive: true })
    const result = await discover(dir)

    assertEquals(result.error, null)
    assertNotEquals(result.data, null)
    assertEquals(result.data !== null && result.data.length, 2)

    if (result.data) {
      const bad = result.data.find((f) => f.path.includes('bad.md'))
      assertNotEquals(bad, undefined)
      assertEquals(bad !== undefined && bad.error !== undefined, true)
      assertEquals(bad !== undefined && bad.content, '')
    }
  })

  it('returns error for invalid JSON in opencode.json', async () => {
    const dir = await makeTmpDir()
    await writeFile(join(dir, 'opencode.json'), 'not valid json', 'utf-8')
    const result = await discover(dir)

    assertEquals(result.data, null)
    assertNotEquals(result.error, null)
    assertEquals(result.error !== null && result.error.includes('Invalid JSON'), true)
  })

  it('filters out non-string entries in instructions', async () => {
    const dir = await makeTmpDir()
    await writeConfig(dir, { instructions: ['docs/*.md', 42, null, 'agents/*.md'] })
    await writeInstruction(dir, 'docs/a.md', 'alpha')
    await writeInstruction(dir, 'agents/b.md', 'beta')
    const result = await discover(dir)

    assertEquals(result.error, null)
    assertNotEquals(result.data, null)
    assertEquals(result.data !== null && result.data.length, 2)
  })
})
