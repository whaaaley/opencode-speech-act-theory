import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { processFile, type PromptFn } from './process.ts'
import type { InstructionFile } from './discover.ts'

// helper: build a prompt fn that returns parse then format results in order
// cast is necessary because PromptFn is universally generic (<T>) but test mocks
// return canned data for specific types — no way to satisfy the generic without it
const makePromptFn = (
  parseData: { rules: { strength: string; action: string; target: string; reason: string }[] } | null,
  parseError: string | null,
  formatData: { rules: string[] } | null,
  formatError: string | null,
): PromptFn => {
  let call = 0
  return (async () => {
    call++
    if (call === 1) {
      return parseError !== null ? { data: null, error: parseError } : { data: parseData, error: null }
    }
    return formatError !== null ? { data: null, error: formatError } : { data: formatData, error: null }
  }) as PromptFn
}

const sampleParsed = {
  rules: [{
    strength: 'obligatory',
    action: 'use',
    target: 'arrow functions',
    reason: 'consistency',
  }],
}

const sampleFormatted = {
  rules: ['Rule: Use arrow functions\nReason: consistency'],
}

// helper: build a prompt fn that captures prompt strings and returns canned results
// same cast justification as makePromptFn above
const makeCapturingPromptFn = (
  parseData: { rules: { strength: string; action: string; target: string; reason: string }[] },
  formatData: { rules: string[] },
  captured: string[],
): PromptFn => {
  let call = 0
  return (async (text: string) => {
    captured.push(text)
    call++
    if (call === 1) {
      return { data: parseData, error: null }
    }
    return { data: formatData, error: null }
  }) as PromptFn
}

describe('processFile', () => {
  it('returns read error for files that failed to read', async () => {
    const file: InstructionFile = { path: '/tmp/bad.md', content: '', error: 'ENOENT' }
    const prompt = makePromptFn(null, null, null, null)

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'readError')
    assertEquals(result.path, '/tmp/bad.md')
    assert(result.status !== 'success', 'expected error result')
    assertEquals(result.error, 'ENOENT')
  })

  it('returns parse error when first prompt fails', async () => {
    const file: InstructionFile = { path: '/tmp/test.md', content: 'some instructions' }
    const prompt = makePromptFn(null, 'LLM timeout', null, null)

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'parseError')
    assert(result.status !== 'success', 'expected error result')
    assertStringIncludes(result.error, 'LLM timeout')
  })

  it('returns format error when second prompt fails', async () => {
    const file: InstructionFile = { path: '/tmp/test.md', content: 'some instructions' }
    const prompt = makePromptFn(sampleParsed, null, null, 'schema mismatch')

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'formatError')
    assert(result.status !== 'success', 'expected error result')
    assertStringIncludes(result.error, 'schema mismatch')
  })

  it('returns write error for invalid path', async () => {
    const file: InstructionFile = { path: '/nonexistent/dir/impossible.md', content: 'some instructions' }
    const prompt = makePromptFn(sampleParsed, null, sampleFormatted, null)

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'writeError')
    assert(result.status !== 'success', 'expected error result')
    assertStringIncludes(result.error, 'ENOENT')
  })

  it('writes formatted rules and returns comparison on success', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'rules.md')
    const originalContent = 'Use arrow functions for consistency.\nPrefer const over let.\n'
    await Deno.writeTextFile(filePath, originalContent)

    const file: InstructionFile = { path: filePath, content: originalContent }
    const prompt = makePromptFn(sampleParsed, null, sampleFormatted, null)

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'success')
    assert(result.status === 'success', 'expected success result')
    assertEquals(result.rulesCount, 1)
    assertEquals(result.comparison.file, 'rules.md')

    // verify file was actually written with correct content
    const written = await readFile(filePath, 'utf-8')
    assertEquals(written, 'Rule: Use arrow functions\nReason: consistency\n')

    await Deno.remove(dir, { recursive: true })
  })

  it('joins multiple rules with double newline in verbose and balanced modes', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'multi.md')
    await Deno.writeTextFile(filePath, 'original')

    const multiFormatted = {
      rules: [
        'Rule: Use arrow functions\nReason: consistency',
        'Rule: Prefer const\nReason: immutability',
      ],
    }

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompt = makePromptFn(sampleParsed, null, multiFormatted, null)

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'success')
    assert(result.status === 'success', 'expected success result')
    assertEquals(result.rulesCount, 2)

    const written = await readFile(filePath, 'utf-8')
    assertEquals(written, 'Rule: Use arrow functions\nReason: consistency\n\nRule: Prefer const\nReason: immutability\n')

    await Deno.remove(dir, { recursive: true })
  })

  it('joins multiple rules with single newline in concise mode', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'concise.md')
    await Deno.writeTextFile(filePath, 'original')

    const conciseFormatted = {
      rules: [
        '- Use arrow functions for consistency.',
        '- Prefer const over let.',
      ],
    }

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompt = makePromptFn(sampleParsed, null, conciseFormatted, null)

    const result = await processFile(file, prompt, 'concise')

    assertEquals(result.status, 'success')
    assert(result.status === 'success', 'expected success result')
    assertEquals(result.rulesCount, 2)

    const written = await readFile(filePath, 'utf-8')
    assertEquals(written, '- Use arrow functions for consistency.\n- Prefer const over let.\n')

    await Deno.remove(dir, { recursive: true })
  })

  it('includes file path in all messages', async () => {
    const file: InstructionFile = { path: '/some/project/.cursor/rules.md', content: '', error: 'nope' }
    const prompt = makePromptFn(null, null, null, null)

    const result = await processFile(file, prompt)

    assertEquals(result.path, '/some/project/.cursor/rules.md')
  })

  it('comparison reflects byte difference between original and generated', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'test.md')
    const originalContent = 'a'.repeat(100)
    await Deno.writeTextFile(filePath, originalContent)

    const file: InstructionFile = { path: filePath, content: originalContent }
    const shortFormatted = { rules: ['Rule: Short\nReason: Brief'] }
    const prompt = makePromptFn(sampleParsed, null, shortFormatted, null)

    const result = await processFile(file, prompt)

    assertEquals(result.status, 'success')
    assert(result.status === 'success', 'expected success result')
    assertEquals(result.comparison.originalBytes, 100)
    // "Rule: Short\nReason: Brief\n" = 26 bytes
    assertEquals(result.comparison.generatedBytes, 26)
    assertEquals(result.comparison.difference, 74)

    await Deno.remove(dir, { recursive: true })
  })

  it('passes verbose mode to format prompt', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'test.md')
    await Deno.writeTextFile(filePath, 'original')

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompts: string[] = []
    const capturingPrompt = makeCapturingPromptFn(sampleParsed, sampleFormatted, prompts)

    await processFile(file, capturingPrompt, 'verbose')

    // second call is the format prompt — should contain verbose-specific instructions
    assertStringIncludes(prompts[1], 'Every rule must include both a Rule line and a Reason line')

    await Deno.remove(dir, { recursive: true })
  })

  it('passes concise mode to format prompt', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'test.md')
    await Deno.writeTextFile(filePath, 'original')

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompts: string[] = []
    const capturingPrompt = makeCapturingPromptFn(sampleParsed, { rules: ['- Use arrow functions'] }, prompts)

    await processFile(file, capturingPrompt, 'concise')

    // second call is the format prompt — should contain concise-specific instructions
    assertStringIncludes(prompts[1], 'Do not include reasons or justifications')

    await Deno.remove(dir, { recursive: true })
  })

  it('defaults to balanced mode when mode is omitted', async () => {
    const dir = await Deno.makeTempDir()
    const filePath = join(dir, 'test.md')
    await Deno.writeTextFile(filePath, 'original')

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompts: string[] = []
    const capturingPrompt = makeCapturingPromptFn(sampleParsed, sampleFormatted, prompts)

    await processFile(file, capturingPrompt)

    // second call is the format prompt — should contain balanced-specific instructions
    assertStringIncludes(prompts[1], 'Use your judgment')

    await Deno.remove(dir, { recursive: true })
  })
})
