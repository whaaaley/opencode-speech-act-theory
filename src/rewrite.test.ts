import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type FileResult, processFile } from './rewrite.ts'

const RULE_A = [
  'Rule: use consistent whitespace for readability in all source files',
  'Reason: Whitespace is critical for readability.',
].join('\n')

const RULE_B = [
  'Rule: do not use non-null assertions in TypeScript files when accessing optional values',
  'Reason: Use narrowing type guards instead.',
].join('\n')

type ReadErrorResult = Extract<FileResult, { status: 'readError' | 'writeError' }>
type SuccessResult = Extract<FileResult, { status: 'success' }>

const expectStatus = (result: FileResult, expected: FileResult['status']) => {
  expect(result.status).toBe(expected)
}

const expectReadError = (result: FileResult): ReadErrorResult => {
  expect(result.status).toBe('readError')
  return result as ReadErrorResult
}

const expectSuccess = (result: FileResult): SuccessResult => {
  expect(result.status).toBe('success')
  return result as SuccessResult
}

describe('processFile', () => {
  let dir: string

  const setup = async (content: string) => {
    dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'instructions.md')
    await writeFile(filePath, content, 'utf-8')
    return filePath
  }

  const cleanup = async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('returns readError when file has error', async () => {
    const result = await processFile({
      file: { path: '/fake/path.md', content: '', error: 'ENOENT' },
      rules: [RULE_A],
    })

    expectStatus(result, 'readError')
    const error = expectReadError(result)
    expect(error.error).toBe('ENOENT')

    await cleanup()
  })

  it('writes formatted rules to file', async () => {
    const filePath = await setup('old content\n')

    const result = await processFile({
      file: { path: filePath, content: 'old content\n' },
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('Rule:')
    expect(written).toContain('Reason:')
    expect(written).not.toContain('old content')

    await cleanup()
  })

  it('includes comparison in success result', async () => {
    const filePath = await setup('old content\n')

    const result = await processFile({
      file: { path: filePath, content: 'old content\n' },
      rules: [RULE_A],
    })

    expectStatus(result, 'success')
    const success = expectSuccess(result)
    expect(success.comparison).toBeDefined()
    expect(success.rulesCount).toBe(1)

    await cleanup()
  })

  it('joins multiple rules with double newline', async () => {
    const filePath = await setup('')

    const result = await processFile({
      file: { path: filePath, content: '' },
      rules: [RULE_A, RULE_B],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('\n\n')

    await cleanup()
  })

  it('propagates file path in result', async () => {
    const filePath = await setup('')

    const result = await processFile({
      file: { path: filePath, content: '' },
      rules: [RULE_A],
    })

    expect(result.path).toBe(filePath)

    await cleanup()
  })

  it('includes context in written output', async () => {
    const filePath = await setup('')

    const result = await processFile({
      file: { path: filePath, content: '' },
      rules: [RULE_B],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('when accessing optional values')

    await cleanup()
  })

  it('writes rules exactly as provided', async () => {
    const filePath = await setup('')

    const result = await processFile({
      file: { path: filePath, content: '' },
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe(RULE_A + '\n')

    await cleanup()
  })

  it('writes multiple rules joined by double newline', async () => {
    const filePath = await setup('')

    const result = await processFile({
      file: { path: filePath, content: '' },
      rules: [RULE_A, RULE_B],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe(RULE_A + '\n\n' + RULE_B + '\n')

    await cleanup()
  })
})
