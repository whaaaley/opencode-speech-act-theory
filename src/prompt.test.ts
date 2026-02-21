import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { buildParsePrompt, buildFormatPrompt, buildRetryPrompt } from './prompt.ts'

describe('buildParsePrompt', () => {
  it('includes the input text', () => {
    const result = buildParsePrompt('Use conventional commits.')
    assertEquals(result.includes('Use conventional commits.'), true)
  })

  it('includes schema example', () => {
    const result = buildParsePrompt('anything')
    assertEquals(result.includes('"strength"'), true)
    assertEquals(result.includes('"action"'), true)
    assertEquals(result.includes('"target"'), true)
    assertEquals(result.includes('"reason"'), true)
  })

  it('asks for valid JSON only', () => {
    const result = buildParsePrompt('anything')
    assertEquals(result.includes('Return ONLY valid JSON'), true)
  })

  it('mentions all deontic strengths', () => {
    const result = buildParsePrompt('anything')
    assertEquals(result.includes('obligatory'), true)
    assertEquals(result.includes('forbidden'), true)
    assertEquals(result.includes('permissible'), true)
    assertEquals(result.includes('optional'), true)
    assertEquals(result.includes('supererogatory'), true)
    assertEquals(result.includes('indifferent'), true)
    assertEquals(result.includes('omissible'), true)
  })
})

describe('buildFormatPrompt', () => {
  it('includes the parsed rules JSON', () => {
    const json = '{"rules": [{"strength": "obligatory"}]}'
    const result = buildFormatPrompt(json)
    assertEquals(result.includes(json), true)
  })

  it('specifies Rule: / Reason: format', () => {
    const result = buildFormatPrompt('{}')
    assertEquals(result.includes('Rule:'), true)
    assertEquals(result.includes('Reason:'), true)
  })

  it('asks for valid JSON only', () => {
    const result = buildFormatPrompt('{}')
    assertEquals(result.includes('Return ONLY valid JSON'), true)
  })
})

describe('buildRetryPrompt', () => {
  it('includes the error message', () => {
    const result = buildRetryPrompt('Schema validation failed')
    assertEquals(result.includes('Schema validation failed'), true)
  })

  it('asks for valid JSON', () => {
    const result = buildRetryPrompt('anything')
    assertEquals(result.includes('Return ONLY valid JSON'), true)
  })

  it('mentions previous response was invalid', () => {
    const result = buildRetryPrompt('anything')
    assertEquals(result.includes('previous response was invalid'), true)
  })
})
