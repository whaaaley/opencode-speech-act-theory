import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AppendResult, appendRules } from './append.ts'

const RULE_A =
  'Rule: use consistent whitespace for readability in all source files\nReason: Whitespace is critical for readability.'
const RULE_B = 'Rule: do not use non-null assertions in TypeScript files\nReason: Use narrowing type guards instead.'

type SuccessResult = Extract<AppendResult, { status: 'success' }>

const expectStatus = (result: AppendResult, expected: AppendResult['status']) => {
  expect(result.status).toBe(expected)
}

const expectSuccess = (result: AppendResult): SuccessResult => {
  expect(result.status).toBe('success')
  return result as SuccessResult
}

describe('appendRules', () => {
  let dir: string

  const setup = async (content: string) => {
    dir = await mkdtemp(join(tmpdir(), 'sat-append-'))
    const filePath = join(dir, 'instructions.md')
    await writeFile(filePath, content, 'utf-8')
    return filePath
  }

  const cleanup = async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('returns readError for missing file', async () => {
    const result = await appendRules({
      filePath: '/nonexistent/file.md',
      rules: [RULE_A],
    })

    expectStatus(result, 'readError')

    await cleanup()
  })

  it('appends formatted rules to file', async () => {
    const filePath = await setup('Existing content.\n')

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('Existing content.')
    expect(written).toContain('Rule:')
    expect(written).toContain('Reason:')

    await cleanup()
  })

  it('preserves existing content', async () => {
    const existing = 'Rule: Do something.\nReason: Because.\n'
    const filePath = await setup(existing)

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('Rule: Do something.')
    expect(written).toContain('use consistent whitespace')

    await cleanup()
  })

  it('uses double newline separator when existing content ends with single newline', async () => {
    const filePath = await setup('Existing.\n')

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('Existing.\n\n')

    await cleanup()
  })

  it('handles file without trailing newline', async () => {
    const filePath = await setup('No trailing newline')

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('No trailing newline')
    expect(written).toContain('Rule:')

    await cleanup()
  })

  it('propagates file path in result', async () => {
    const filePath = await setup('')

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expect(result.path).toBe(filePath)

    await cleanup()
  })

  it('returns rulesCount in success result', async () => {
    const filePath = await setup('')

    const result = await appendRules({
      filePath,
      rules: [RULE_A, RULE_B],
    })

    expectStatus(result, 'success')
    const success = expectSuccess(result)
    expect(success.rulesCount).toBe(2)

    await cleanup()
  })

  it('appends to empty file', async () => {
    const filePath = await setup('')

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('Rule:')

    await cleanup()
  })

  it('writes rules exactly as provided', async () => {
    const filePath = await setup('')

    const result = await appendRules({
      filePath,
      rules: [RULE_A],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe(RULE_A + '\n')

    await cleanup()
  })

  it('joins multiple rules with double newline', async () => {
    const filePath = await setup('')

    const result = await appendRules({
      filePath,
      rules: [RULE_A, RULE_B],
    })

    expectStatus(result, 'success')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe(RULE_A + '\n\n' + RULE_B + '\n')

    await cleanup()
  })
})
