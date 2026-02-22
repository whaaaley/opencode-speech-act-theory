import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { InstructionFile } from './discover.ts'
import { processFile, type PromptFn } from './process.ts'

// helper: build a prompt fn that returns parse then format results in order
// cast is necessary because PromptFn is universally generic (<T>) but test mocks
// return canned data for specific types; no way to satisfy the generic without it

type MakePromptFnOptions = {
  parseData: { rules: { strength: string; action: string; target: string; reason: string }[] } | null
  parseError: string | null
  formatData: { rules: string[] } | null
  formatError: string | null
}

const makePromptFn = (options: MakePromptFnOptions): PromptFn => {
  let call = 0
  return (() => {
    call++
    if (call === 1) {
      if (options.parseError !== null) {
        return Promise.resolve({ data: null, error: options.parseError })
      }
      return Promise.resolve({ data: options.parseData, error: null })
    }
    if (options.formatError !== null) {
      return Promise.resolve({ data: null, error: options.formatError })
    }
    return Promise.resolve({ data: options.formatData, error: null })
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
  return ((text: string) => {
    captured.push(text)
    call++
    if (call === 1) {
      return Promise.resolve({ data: parseData, error: null })
    }
    return Promise.resolve({ data: formatData, error: null })
  }) as PromptFn
}

describe('processFile', () => {
  it('returns read error for files that failed to read', async () => {
    const file: InstructionFile = {
      path: '/tmp/bad.md',
      content: '',
      error: 'ENOENT',
    }
    const prompt = makePromptFn({
      parseData: null,
      parseError: null,
      formatData: null,
      formatError: null,
    })

    const result = await processFile({ file, prompt })
    if (result.status === 'success') throw new Error('expected error')
    expect(result.error).toEqual('ENOENT')
  })

  it('returns parse error when first prompt fails', async () => {
    const file: InstructionFile = { path: '/tmp/test.md', content: 'some instructions' }
    const prompt = makePromptFn({
      parseData: null,
      parseError: 'LLM timeout',
      formatData: null,
      formatError: null,
    })

    const result = await processFile({ file, prompt })

    expect(result.status).toEqual('parseError')
    if (result.status === 'success') throw new Error('expected error')
    expect(result.error).toContain('LLM timeout')
  })

  it('returns format error when second prompt fails', async () => {
    const file: InstructionFile = { path: '/tmp/test.md', content: 'some instructions' }
    const prompt = makePromptFn({
      parseData: sampleParsed,
      parseError: null,
      formatData: null,
      formatError: 'schema mismatch',
    })

    const result = await processFile({ file, prompt })

    expect(result.status).toEqual('formatError')
    if (result.status === 'success') throw new Error('expected error')
    expect(result.error).toContain('schema mismatch')
  })

  it('returns write error for invalid path', async () => {
    const file: InstructionFile = { path: '/nonexistent/dir/impossible.md', content: 'some instructions' }
    const prompt = makePromptFn({
      parseData: sampleParsed,
      parseError: null,
      formatData: sampleFormatted,
      formatError: null,
    })

    const result = await processFile({ file, prompt })

    expect(result.status).toEqual('writeError')
    if (result.status === 'success') throw new Error('expected error')
    expect(result.error).toContain('ENOENT')
  })

  it('writes formatted rules and returns comparison on success', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'rules.md')
    const originalContent = 'Use arrow functions for consistency.\nPrefer const over let.\n'
    await writeFile(filePath, originalContent, 'utf-8')

    const file: InstructionFile = { path: filePath, content: originalContent }
    const prompt = makePromptFn({
      parseData: sampleParsed,
      parseError: null,
      formatData: sampleFormatted,
      formatError: null,
    })

    const result = await processFile({ file, prompt })

    expect(result.status).toEqual('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.rulesCount).toEqual(1)
    expect(result.comparison.file).toEqual('rules.md')

    // verify file was actually written with correct content
    const written = await readFile(filePath, 'utf-8')
    expect(written).toEqual('Rule: Use arrow functions\nReason: consistency\n')

    await rm(dir, { recursive: true, force: true })
  })

  it('joins multiple rules with double newline in verbose and balanced modes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'multi.md')
    await writeFile(filePath, 'original', 'utf-8')

    const multiFormatted = {
      rules: [
        'Rule: Use arrow functions\nReason: consistency',
        'Rule: Prefer const\nReason: immutability',
      ],
    }

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompt = makePromptFn({
      parseData: sampleParsed,
      parseError: null,
      formatData: multiFormatted,
      formatError: null,
    })

    const result = await processFile({ file, prompt })

    expect(result.status).toEqual('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.rulesCount).toEqual(2)

    const written = await readFile(filePath, 'utf-8')
    expect(written).toEqual(
      'Rule: Use arrow functions\nReason: consistency\n\nRule: Prefer const\nReason: immutability\n',
    )

    await rm(dir, { recursive: true, force: true })
  })

  it('joins multiple rules with single newline in concise mode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'concise.md')
    await writeFile(filePath, 'original', 'utf-8')

    const conciseFormatted = {
      rules: [
        '- Use arrow functions for consistency.',
        '- Prefer const over let.',
      ],
    }

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompt = makePromptFn({
      parseData: sampleParsed,
      parseError: null,
      formatData: conciseFormatted,
      formatError: null,
    })

    const result = await processFile({ file, prompt, mode: 'concise' })

    expect(result.status).toEqual('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.rulesCount).toEqual(2)

    const written = await readFile(filePath, 'utf-8')
    expect(written).toEqual('- Use arrow functions for consistency.\n- Prefer const over let.\n')

    await rm(dir, { recursive: true, force: true })
  })

  it('includes file path in all messages', async () => {
    const file: InstructionFile = {
      path: '/some/project/.cursor/rules.md',
      content: '',
      error: 'nope',
    }
    const prompt = makePromptFn({
      parseData: null,
      parseError: null,
      formatData: null,
      formatError: null,
    })

    const result = await processFile({ file, prompt })

    expect(result.path).toEqual('/some/project/.cursor/rules.md')
  })

  it('comparison reflects byte difference between original and generated', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'test.md')
    const originalContent = 'a'.repeat(100)
    await writeFile(filePath, originalContent, 'utf-8')

    const file: InstructionFile = { path: filePath, content: originalContent }
    const shortFormatted = { rules: ['Rule: Short\nReason: Brief'] }
    const prompt = makePromptFn({
      parseData: sampleParsed,
      parseError: null,
      formatData: shortFormatted,
      formatError: null,
    })

    const result = await processFile({ file, prompt })

    expect(result.status).toEqual('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.comparison.originalBytes).toEqual(100)
    // "Rule: Short\nReason: Brief\n" = 26 bytes
    expect(result.comparison.generatedBytes).toEqual(26)
    expect(result.comparison.difference).toEqual(74)

    await rm(dir, { recursive: true, force: true })
  })

  it('passes verbose mode to format prompt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'test.md')
    await writeFile(filePath, 'original', 'utf-8')

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompts: string[] = []
    const capturingPrompt = makeCapturingPromptFn(sampleParsed, sampleFormatted, prompts)

    await processFile({ file, prompt: capturingPrompt, mode: 'verbose' })

    // second call is the format prompt; should contain verbose-specific instructions
    expect(prompts[1]).toContain('Every rule must include both a Rule line and a Reason line')

    await rm(dir, { recursive: true, force: true })
  })

  it('passes concise mode to format prompt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'test.md')
    await writeFile(filePath, 'original', 'utf-8')

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompts: string[] = []
    const capturingPrompt = makeCapturingPromptFn(sampleParsed, { rules: ['- Use arrow functions'] }, prompts)

    await processFile({ file, prompt: capturingPrompt, mode: 'concise' })

    // second call is the format prompt; should contain concise-specific instructions
    expect(prompts[1]).toContain('Do not include reasons or justifications')

    await rm(dir, { recursive: true, force: true })
  })

  it('defaults to balanced mode when mode is omitted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sat-process-'))
    const filePath = join(dir, 'test.md')
    await writeFile(filePath, 'original', 'utf-8')

    const file: InstructionFile = { path: filePath, content: 'original' }
    const prompts: string[] = []
    const capturingPrompt = makeCapturingPromptFn(sampleParsed, sampleFormatted, prompts)

    await processFile({ file, prompt: capturingPrompt })

    // second call is the format prompt; should contain balanced-specific instructions
    expect(prompts[1]).toContain('Use your judgment')

    await rm(dir, { recursive: true, force: true })
  })
})
