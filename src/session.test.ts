import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { extractText } from './session.ts'

describe('extractText', () => {
  it('extracts text from a single text part', () => {
    const parts = [{ type: 'text', text: 'hello' }]
    assertEquals(extractText(parts), 'hello')
  })

  it('concatenates multiple text parts', () => {
    const parts = [
      { type: 'text', text: 'hello ' },
      { type: 'text', text: 'world' },
    ]
    assertEquals(extractText(parts), 'hello world')
  })

  it('skips non-text parts', () => {
    const parts = [
      { type: 'tool_call', text: 'ignored' },
      { type: 'text', text: 'kept' },
      { type: 'image' },
    ]
    assertEquals(extractText(parts), 'kept')
  })

  it('returns empty string for empty array', () => {
    assertEquals(extractText([]), '')
  })

  it('returns empty string when no text parts exist', () => {
    const parts = [
      { type: 'tool_call' },
      { type: 'image' },
    ]
    assertEquals(extractText(parts), '')
  })

  it('skips text parts with empty text', () => {
    const parts = [
      { type: 'text', text: '' },
      { type: 'text', text: 'valid' },
    ]
    assertEquals(extractText(parts), 'valid')
  })

  it('skips text parts with undefined text', () => {
    const parts = [
      { type: 'text' },
      { type: 'text', text: 'valid' },
    ]
    assertEquals(extractText(parts), 'valid')
  })
})
