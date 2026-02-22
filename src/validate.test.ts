import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { formatValidationError, validateJson } from './validate.ts'

const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
})

describe('validateJson', () => {
  it('returns data for valid JSON matching schema', () => {
    const result = validateJson('{"name": "Alice", "age": 30}', TestSchema)

    expect(result.error).toEqual(null)
    expect(result.data).toEqual({ name: 'Alice', age: 30 })
  })

  it('returns parse error for invalid JSON', () => {
    const result = validateJson('not json', TestSchema)

    expect(result.error).toEqual('parse')
    expect(result.data).toEqual(null)
  })

  it('returns parse error for empty string', () => {
    const result = validateJson('', TestSchema)

    expect(result.error).toEqual('parse')
    expect(result.data).toEqual(null)
  })

  it('returns schema error when JSON does not match schema', () => {
    const result = validateJson('{"name": 42}', TestSchema)

    expect(result.error).toEqual('schema')
    expect(result.data).toEqual(null)
    expect('issues' in result).toEqual(true)
  })

  it('returns schema error with issues for missing fields', () => {
    const result = validateJson('{}', TestSchema)

    expect(result.error).toEqual('schema')
    expect(result.data).toEqual(null)
    expect('issues' in result && result.issues.length > 0).toEqual(true)
  })

  it('accepts valid nested JSON', () => {
    const nested = z.object({ items: z.array(z.string()) })
    const result = validateJson('{"items": ["a", "b"]}', nested)

    expect(result.error).toEqual(null)
    expect(result.data).toEqual({ items: ['a', 'b'] })
  })
})

describe('formatValidationError', () => {
  it('returns generic message for parse errors', () => {
    const result = formatValidationError({ data: null, error: 'parse' })

    expect(result.includes('Invalid JSON')).toEqual(true)
  })

  it('returns formatted issues for schema errors', () => {
    const validation = validateJson('{"name": 42}', TestSchema)
    expect(validation.error).toEqual('schema')

    const result = formatValidationError(validation as Parameters<typeof formatValidationError>[0])
    expect(result.includes('Schema validation failed')).toEqual(true)
    expect(result.includes('Fix the issues')).toEqual(true)
  })

  it('includes field paths in schema error output', () => {
    const validation = validateJson('{}', TestSchema)
    expect(validation.error).toEqual('schema')

    const result = formatValidationError(validation as Parameters<typeof formatValidationError>[0])
    expect(result.includes('  - ')).toEqual(true)
  })
})
