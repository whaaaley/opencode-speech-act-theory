import { describe, expect, it } from 'bun:test'
import { formatPrompt } from './format-prompt.ts'
import type { ParsedPrompt, ParsedTask } from './prompt-schema.ts'

type TaskInput = Partial<ParsedTask> & { intent: string }

const task = (input: TaskInput): ParsedTask => ({
  targets: [],
  constraints: [],
  subtasks: [],
  ...input,
})

const prompt = (...tasks: Array<ParsedTask>): ParsedPrompt => ({ tasks })

describe('formatPrompt', () => {
  it('formats a single leaf task', () => {
    const result = formatPrompt(prompt(task({ intent: 'Run the tests' })))
    expect(result).toBe('1. Run the tests')
  })

  it('includes targets when present', () => {
    const result = formatPrompt(prompt(task({
      intent: 'Add guards',
      targets: ['bsky-search.ts', 'wiki-search.ts'],
    })))

    expect(result).toContain('Targets: bsky-search.ts, wiki-search.ts')
  })

  it('includes constraints when present', () => {
    const result = formatPrompt(prompt(task({
      intent: 'Refactor module',
      constraints: ['no optional chaining', 'use early returns'],
    })))

    expect(result).toContain('Constraints: no optional chaining, use early returns')
  })

  it('includes context when present', () => {
    const result = formatPrompt(prompt(task({
      intent: 'Fix the bug',
      context: 'Users reported crashes on startup',
    })))

    expect(result).toContain('Context: Users reported crashes on startup')
  })

  it('formats multiple top-level tasks', () => {
    const result = formatPrompt(prompt(
      task({ intent: 'Add guards' }),
      task({ intent: 'Run tests' }),
    ))

    expect(result).toContain('1. Add guards')
    expect(result).toContain('2. Run tests')
  })

  it('formats subtasks as tree nodes', () => {
    const result = formatPrompt(prompt(task({
      intent: 'Refactor search',
      subtasks: [task({ intent: 'Update bsky provider' })],
    })))

    expect(result).toContain('1. Refactor search')
    expect(result).toContain('└── 2. Update bsky provider')
  })

  it('formats nested subtasks with tree connectors', () => {
    const result = formatPrompt(prompt(task({
      intent: 'Refactor providers',
      subtasks: [task({
        intent: 'Add guards to bsky',
        subtasks: [task({ intent: 'Validate response shape' })],
      })],
    })))

    expect(result).toContain('1. Refactor providers')
    expect(result).toContain('Add guards to bsky')
    expect(result).toContain('Validate response shape')
  })

  it('returns empty string for empty tasks', () => {
    expect(formatPrompt(prompt())).toBe('')
  })

  it('formats a complex prompt with all fields and nesting', () => {
    const result = formatPrompt(prompt(
      task({
        intent: 'Refactor the search module',
        targets: ['src/search.ts'],
        constraints: ['use safeAsync'],
        context: 'Current error handling is inconsistent',
        subtasks: [task({
          intent: 'Add guards to providers',
          targets: ['src/providers/'],
          constraints: ['use isRecord helper'],
          subtasks: [
            task({ intent: 'Validate bsky responses', targets: ['bsky-search.ts'] }),
            task({ intent: 'Validate wiki responses', targets: ['wiki-search.ts'] }),
          ],
        })],
      }),
      task({ intent: 'Run the tests', constraints: ['fix any failures'] }),
    ))

    expect(result).toContain('1. Refactor the search module')
    expect(result).toContain('Targets: src/search.ts')
    expect(result).toContain('Constraints: use safeAsync')
    expect(result).toContain('Context: Current error handling is inconsistent')
    expect(result).toContain('2. Add guards to providers')
    expect(result).toContain('3. Validate bsky responses')
    expect(result).toContain('4. Validate wiki responses')
    expect(result).toContain('5. Run the tests')
  })

  it('visual output', () => {
    const result = formatPrompt(prompt(
      task({
        intent: 'Refactor the search module',
        targets: ['src/search.ts', 'src/providers/'],
        constraints: ['use safeAsync', 'no optional chaining'],
        context: 'Current error handling is inconsistent',
        subtasks: [
          task({
            intent: 'Add guards to providers',
            targets: ['src/providers/'],
            constraints: ['use isRecord helper'],
            subtasks: [
              task({ intent: 'Validate bsky responses', targets: ['bsky-search.ts'] }),
              task({ intent: 'Validate wiki responses', targets: ['wiki-search.ts'] }),
            ],
          }),
          task({ intent: 'Update error handling', targets: ['src/utils/safe.ts'] }),
        ],
      }),
      task({
        intent: 'Run the tests',
        constraints: ['fix any failures'],
        subtasks: [
          task({ intent: 'Run type checker' }),
          task({ intent: 'Run test suite', constraints: ['all 160 must pass'] }),
        ],
      }),
    ))

    console.log('\n' + result + '\n')
    expect(result).toBeTruthy()
  })
})
