import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { stripCodeFences } from './stripCodeFences.ts'

describe('stripCodeFences', () => {
  it('returns plain text unchanged', () => {
    assertEquals(stripCodeFences('hello world'), 'hello world')
  })

  it('strips ```json fence', () => {
    const input = '```json\n{"rules": []}\n```'
    assertEquals(stripCodeFences(input), '{"rules": []}')
  })

  it('strips bare ``` fence', () => {
    const input = '```\n{"rules": []}\n```'
    assertEquals(stripCodeFences(input), '{"rules": []}')
  })

  it('strips fence with trailing whitespace', () => {
    const input = '```json  \n{"rules": []}\n```  '
    assertEquals(stripCodeFences(input), '{"rules": []}')
  })

  it('trims surrounding whitespace', () => {
    const input = '  \n {"rules": []}  \n '
    assertEquals(stripCodeFences(input), '{"rules": []}')
  })

  it('handles empty string', () => {
    assertEquals(stripCodeFences(''), '')
  })

  it('handles fence with no content', () => {
    const input = '```json\n```'
    assertEquals(stripCodeFences(input), '')
  })

  it('preserves inner newlines', () => {
    const input = '```json\n{\n  "a": 1,\n  "b": 2\n}\n```'
    assertEquals(stripCodeFences(input), '{\n  "a": 1,\n  "b": 2\n}')
  })
})
