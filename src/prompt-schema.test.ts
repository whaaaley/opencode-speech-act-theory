import { describe, expect, it } from 'bun:test'
import {
  ConstraintsSchema,
  IntentSchema,
  ParsedPromptSchema,
  ParsedTaskSchema,
  TaskContextSchema,
  TaskTargetsSchema,
} from './prompt-schema.ts'

describe('IntentSchema', () => {
  it('accepts a string', () => {
    expect(IntentSchema.parse('Add runtime guards')).toBe('Add runtime guards')
  })

  it('rejects a number', () => {
    expect(() => IntentSchema.parse(42)).toThrow()
  })
})

describe('TaskTargetsSchema', () => {
  it('accepts an array of strings', () => {
    const result = TaskTargetsSchema.parse(['bsky-search.ts', 'wiki-search.ts'])
    expect(result).toEqual(['bsky-search.ts', 'wiki-search.ts'])
  })

  it('rejects an array of numbers', () => {
    expect(() => TaskTargetsSchema.parse([1, 2])).toThrow()
  })
})

describe('ConstraintsSchema', () => {
  it('accepts an array of strings', () => {
    const result = ConstraintsSchema.parse(['no optional chaining', 'use early returns'])
    expect(result).toEqual(['no optional chaining', 'use early returns'])
  })

  it('accepts an empty array', () => {
    expect(ConstraintsSchema.parse([])).toEqual([])
  })
})

describe('TaskContextSchema', () => {
  it('accepts a string', () => {
    expect(TaskContextSchema.parse('Voice input was messy')).toBe('Voice input was messy')
  })
})

describe('ParsedTaskSchema', () => {
  it('parses a leaf task with all fields', () => {
    const result = ParsedTaskSchema.parse({
      intent: 'Add guards to bsky provider',
      targets: ['src/providers/bsky-search.ts'],
      constraints: ['use isRecord helper'],
      context: 'API responses are currently unvalidated',
      subtasks: [],
    })

    expect(result.intent).toBe('Add guards to bsky provider')
    expect(result.targets).toEqual(['src/providers/bsky-search.ts'])
    expect(result.constraints).toEqual(['use isRecord helper'])
    expect(result.context).toBe('API responses are currently unvalidated')
    expect(result.subtasks).toEqual([])
  })

  it('defaults targets to empty array', () => {
    const result = ParsedTaskSchema.parse({
      intent: 'Run tests',
      constraints: [],
      subtasks: [],
    })

    expect(result.targets).toEqual([])
  })

  it('defaults constraints to empty array', () => {
    const result = ParsedTaskSchema.parse({
      intent: 'Run tests',
      targets: [],
      subtasks: [],
    })

    expect(result.constraints).toEqual([])
  })

  it('defaults subtasks to empty array', () => {
    const result = ParsedTaskSchema.parse({
      intent: 'Run tests',
      targets: [],
      constraints: [],
    })

    expect(result.subtasks).toEqual([])
  })

  it('allows context to be omitted', () => {
    const result = ParsedTaskSchema.parse({
      intent: 'Run tests',
      targets: [],
      constraints: [],
      subtasks: [],
    })

    expect(result.context).toBeUndefined()
  })

  it('parses recursive subtasks', () => {
    const result = ParsedTaskSchema.parse({
      intent: 'Refactor search module',
      targets: ['src/search.ts'],
      constraints: [],
      subtasks: [
        {
          intent: 'Add guards to providers',
          targets: ['src/providers/'],
          constraints: ['use isRecord'],
          subtasks: [
            {
              intent: 'Validate bsky responses',
              targets: ['bsky-search.ts'],
              constraints: [],
              subtasks: [],
            },
          ],
        },
      ],
    })

    expect(result.subtasks.length).toBe(1)

    const first = result.subtasks[0]
    expect(first).toBeDefined()
    expect(first?.intent).toBe('Add guards to providers')
    expect(first?.subtasks.length).toBe(1)

    const nested = first?.subtasks[0]
    expect(nested).toBeDefined()
    expect(nested?.intent).toBe('Validate bsky responses')
  })

  it('rejects missing intent', () => {
    expect(() =>
      ParsedTaskSchema.parse({
        targets: [],
        constraints: [],
        subtasks: [],
      })
    ).toThrow()
  })
})

describe('ParsedPromptSchema', () => {
  it('parses a prompt with multiple tasks', () => {
    const result = ParsedPromptSchema.parse({
      tasks: [
        {
          intent: 'Add guards',
          targets: [],
          constraints: [],
          subtasks: [],
        },
        {
          intent: 'Run tests',
          targets: [],
          constraints: [],
          subtasks: [],
        },
      ],
    })

    expect(result.tasks.length).toBe(2)
  })

  it('rejects missing tasks field', () => {
    expect(() => ParsedPromptSchema.parse({})).toThrow()
  })

  it('rejects tasks as a string', () => {
    expect(() => ParsedPromptSchema.parse({ tasks: 'not an array' })).toThrow()
  })
})
