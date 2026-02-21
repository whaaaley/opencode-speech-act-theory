import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { extractLlmError } from './extractLlmError.ts'

describe('extractLlmError', () => {
  it('returns null when no error', () => {
    assertEquals(extractLlmError({ role: 'assistant' }), null)
  })

  it('returns null when error is undefined', () => {
    assertEquals(extractLlmError({ role: 'assistant', error: undefined }), null)
  })

  it('extracts data.message when present', () => {
    const info = {
      role: 'assistant',
      error: {
        name: 'APIError',
        data: { message: 'rate limit exceeded' },
      },
    }
    assertEquals(extractLlmError(info), 'rate limit exceeded')
  })

  it('falls back to name when data.message is missing', () => {
    const info = {
      role: 'assistant',
      error: { name: 'TimeoutError' },
    }
    assertEquals(extractLlmError(info), 'TimeoutError')
  })

  it('falls back to name when data exists but message is missing', () => {
    const info = {
      role: 'assistant',
      error: { name: 'APIError', data: {} },
    }
    assertEquals(extractLlmError(info), 'APIError')
  })

  it('returns Unknown LLM error when no name or data', () => {
    const info = {
      role: 'assistant',
      error: {},
    }
    assertEquals(extractLlmError(info), 'Unknown LLM error')
  })
})
