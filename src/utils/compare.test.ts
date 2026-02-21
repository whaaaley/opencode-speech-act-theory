import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { buildTable, compareBytes, formatRow, summarize } from './compare.ts'

describe('compareBytes', () => {
  it('detects savings when original is larger', () => {
    const result = compareBytes('test.md', 'hello world', 'hello')

    assertEquals(result.file, 'test.md')
    assertEquals(result.originalBytes, 11)
    assertEquals(result.generatedBytes, 5)
    assertEquals(result.difference, 6)
  })

  it('detects increase when generated is larger', () => {
    const result = compareBytes('test.md', 'hi', 'hello world')

    assertEquals(result.difference, -9)
  })

  it('handles equal sizes', () => {
    const result = compareBytes('test.md', 'abc', 'xyz')

    assertEquals(result.difference, 0)
    assertEquals(result.percentChange, 0)
  })

  it('handles empty original without dividing by zero', () => {
    const result = compareBytes('test.md', '', 'something')

    assertEquals(result.originalBytes, 0)
    assertEquals(result.percentChange, 0)
  })

  it('correctly measures multi-byte characters', () => {
    const result = compareBytes('test.md', '\u00e9', 'e')

    assertEquals(result.originalBytes, 2)
    assertEquals(result.generatedBytes, 1)
  })
})

describe('formatRow', () => {
  it('returns a formatted string with savings icon', () => {
    const row = formatRow({
      file: 'test.md',
      originalBytes: 100,
      generatedBytes: 80,
      difference: 20,
      percentChange: 20,
    })

    assertEquals(row.includes('test.md'), true)
    assertEquals(row.includes('100'), true)
    assertEquals(row.includes('80'), true)
    assertEquals(row.includes('\u2212'), true)
  })

  it('shows plus for increase', () => {
    const row = formatRow({
      file: 'big.md',
      originalBytes: 50,
      generatedBytes: 100,
      difference: -50,
      percentChange: -100,
    })

    assertEquals(row.includes('+'), true)
  })
})

describe('summarize', () => {
  it('sums totals correctly', () => {
    const totals = summarize([
      { file: 'a.md', originalBytes: 100, generatedBytes: 80, difference: 20, percentChange: 20 },
      { file: 'b.md', originalBytes: 200, generatedBytes: 150, difference: 50, percentChange: 25 },
    ])

    assertEquals(totals.totalOriginal, 300)
    assertEquals(totals.totalGenerated, 230)
    assertEquals(totals.totalDifference, 70)
  })

  it('handles empty array', () => {
    const totals = summarize([])

    assertEquals(totals.totalOriginal, 0)
    assertEquals(totals.totalGenerated, 0)
    assertEquals(totals.totalDifference, 0)
    assertEquals(totals.totalPercentChange, 0)
  })
})

describe('buildTable', () => {
  it('returns empty string for empty results', () => {
    assertEquals(buildTable([]), '')
  })

  it('includes header, rows, totals, and summary', () => {
    const results = [
      { file: 'a.md', originalBytes: 100, generatedBytes: 80, difference: 20, percentChange: 20 },
      { file: 'b.md', originalBytes: 200, generatedBytes: 250, difference: -50, percentChange: -25 },
    ]
    const table = buildTable(results)

    assertEquals(table.includes('File'), true)
    assertEquals(table.includes('Original'), true)
    assertEquals(table.includes('Generated'), true)
    assertEquals(table.includes('a.md'), true)
    assertEquals(table.includes('b.md'), true)
    assertEquals(table.includes('TOTAL'), true)
    assertEquals(table.includes('INCREASED'), true)
  })

  it('shows SAVED when total is smaller', () => {
    const results = [
      { file: 'a.md', originalBytes: 200, generatedBytes: 100, difference: 100, percentChange: 50 },
    ]
    const table = buildTable(results)

    assertEquals(table.includes('SAVED'), true)
  })

  it('sorts rows by largest absolute difference first', () => {
    const results = [
      { file: 'small.md', originalBytes: 100, generatedBytes: 95, difference: 5, percentChange: 5 },
      { file: 'big.md', originalBytes: 500, generatedBytes: 300, difference: 200, percentChange: 40 },
    ]
    const table = buildTable(results)
    const bigIdx = table.indexOf('big.md')
    const smallIdx = table.indexOf('small.md')

    assertEquals(bigIdx < smallIdx, true)
  })
})
