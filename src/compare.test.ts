import { describe, expect, it } from 'bun:test'
import { buildTable, compareBytes, summarize, type TableRow } from './compare.ts'

describe('compareBytes', () => {
  it('detects savings when original is larger', () => {
    const result = compareBytes('test.md', 'hello world', 'hello')

    expect(result.file).toEqual('test.md')
    expect(result.originalBytes).toEqual(11)
    expect(result.generatedBytes).toEqual(5)
    expect(result.difference).toEqual(6)
  })

  it('detects increase when generated is larger', () => {
    const result = compareBytes('test.md', 'hi', 'hello world')

    expect(result.difference).toEqual(-9)
  })

  it('handles equal sizes', () => {
    const result = compareBytes('test.md', 'abc', 'xyz')

    expect(result.difference).toEqual(0)
    expect(result.percentChange).toEqual(0)
  })

  it('handles empty original without dividing by zero', () => {
    const result = compareBytes('test.md', '', 'something')

    expect(result.originalBytes).toEqual(0)
    expect(result.percentChange).toEqual(0)
  })

  it('correctly measures multi-byte characters', () => {
    const result = compareBytes('test.md', '\u00e9', 'e')

    expect(result.originalBytes).toEqual(2)
    expect(result.generatedBytes).toEqual(1)
  })
})

describe('summarize', () => {
  it('sums totals correctly', () => {
    const totals = summarize([
      { file: 'a.md', originalBytes: 100, generatedBytes: 80, difference: 20, percentChange: 20 },
      { file: 'b.md', originalBytes: 200, generatedBytes: 150, difference: 50, percentChange: 25 },
    ])

    expect(totals.totalOriginal).toEqual(300)
    expect(totals.totalGenerated).toEqual(230)
    expect(totals.totalDifference).toEqual(70)
  })

  it('handles empty array', () => {
    const totals = summarize([])

    expect(totals.totalOriginal).toEqual(0)
    expect(totals.totalGenerated).toEqual(0)
    expect(totals.totalDifference).toEqual(0)
    expect(totals.totalPercentChange).toEqual(0)
  })
})

describe('buildTable', () => {
  it('returns empty string for empty results', () => {
    expect(buildTable([])).toEqual('')
  })

  it('includes header, rows, totals, and summary', () => {
    const rows: TableRow[] = [{
      file: 'a.md',
      status: 'Success',
      rules: 5,
      comparison: { file: 'a.md', originalBytes: 100, generatedBytes: 80, difference: 20, percentChange: 20 },
    }, {
      file: 'b.md',
      status: 'Success',
      rules: 3,
      comparison: { file: 'b.md', originalBytes: 200, generatedBytes: 250, difference: -50, percentChange: -25 },
    }]
    const table = buildTable(rows)

    expect(table.includes('File')).toEqual(true)
    expect(table.includes('Status')).toEqual(true)
    expect(table.includes('Rules')).toEqual(true)
    expect(table.includes('Original')).toEqual(true)
    expect(table.includes('Generated')).toEqual(true)
    expect(table.includes('a.md')).toEqual(true)
    expect(table.includes('b.md')).toEqual(true)
    expect(table.includes('TOTAL')).toEqual(true)
    expect(table.includes('INCREASED')).toEqual(true)
  })

  it('shows SAVED when total is smaller', () => {
    const rows: TableRow[] = [{
      file: 'a.md',
      status: 'Success',
      rules: 10,
      comparison: { file: 'a.md', originalBytes: 200, generatedBytes: 100, difference: 100, percentChange: 50 },
    }]
    const table = buildTable(rows)

    expect(table.includes('SAVED')).toEqual(true)
  })

  it('sorts rows by largest absolute difference first', () => {
    const rows: TableRow[] = [{
      file: 'small.md',
      status: 'Success',
      rules: 2,
      comparison: { file: 'small.md', originalBytes: 100, generatedBytes: 95, difference: 5, percentChange: 5 },
    }, {
      file: 'big.md',
      status: 'Success',
      rules: 8,
      comparison: { file: 'big.md', originalBytes: 500, generatedBytes: 300, difference: 200, percentChange: 40 },
    }]
    const table = buildTable(rows)
    const bigIdx = table.indexOf('big.md')
    const smallIdx = table.indexOf('small.md')

    expect(bigIdx < smallIdx).toEqual(true)
  })

  it('handles failed rows with no comparison data', () => {
    const rows: TableRow[] = [{
      file: 'good.md',
      status: 'Success',
      rules: 5,
      comparison: { file: 'good.md', originalBytes: 200, generatedBytes: 150, difference: 50, percentChange: 25 },
    }, {
      file: 'bad.md',
      status: 'Parse failed',
    }]
    const table = buildTable(rows)

    expect(table.includes('good.md')).toEqual(true)
    expect(table.includes('bad.md')).toEqual(true)
    expect(table.includes('Parse failed')).toEqual(true)
    expect(table.includes('SAVED')).toEqual(true)
  })

  it('omits summary line when no comparisons exist', () => {
    const rows: TableRow[] = [{
      file: 'bad.md',
      status: 'Read failed',
    }]
    const table = buildTable(rows)

    expect(table.includes('bad.md')).toEqual(true)
    expect(table.includes('SAVED')).toEqual(false)
    expect(table.includes('INCREASED')).toEqual(false)
  })

  it('visual output', () => {
    const rows: TableRow[] = [{
      file: 'instructions.md',
      status: 'Success',
      rules: 12,
      comparison: {
        file: 'instructions.md',
        originalBytes: 542,
        generatedBytes: 481,
        difference: 61,
        percentChange: 11.3,
      },
    }, {
      file: 'guidelines.md',
      status: 'Success',
      rules: 8,
      comparison: {
        file: 'guidelines.md',
        originalBytes: 1200,
        generatedBytes: 980,
        difference: 220,
        percentChange: 18.3,
      },
    }, {
      file: 'notes.md',
      status: 'Success',
      rules: 15,
      comparison: {
        file: 'notes.md',
        originalBytes: 300,
        generatedBytes: 350,
        difference: -50,
        percentChange: -16.7,
      },
    }, {
      file: 'broken.md',
      status: 'Parse failed',
    }]

    const table = buildTable(rows)
    expect(table.length).toBeGreaterThan(0)
  })
})
