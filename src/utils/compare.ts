export type ComparisonResult = {
  file: string
  originalBytes: number
  generatedBytes: number
  difference: number
  percentChange: number
}

// compare byte sizes of two strings and return diff stats
export const compareBytes = (file: string, original: string, generated: string): ComparisonResult => {
  const originalBytes = new TextEncoder().encode(original).length
  const generatedBytes = new TextEncoder().encode(generated).length
  const difference = originalBytes - generatedBytes
  const percentChange = originalBytes === 0 ? 0 : (difference / originalBytes) * 100

  return {
    file,
    originalBytes,
    generatedBytes,
    difference,
    percentChange,
  }
}

// format a percent change string with direction indicator
const formatChange = (difference: number, percentChange: number): string => {
  if (difference > 0) {
    return '\u2212' + percentChange.toFixed(1) + '%'
  }
  return '+' + Math.abs(percentChange).toFixed(1) + '%'
}

// format a single comparison result as a table row
// uses ASCII indicators (+/-) for consistent monospace alignment
export const formatRow = (result: ComparisonResult): string => {
  const changeStr = formatChange(result.difference, result.percentChange)

  return (
    result.file.padEnd(25) +
    result.originalBytes.toString().padStart(10) +
    result.generatedBytes.toString().padStart(12) +
    result.difference.toString().padStart(8) +
    changeStr.padStart(10)
  )
}

export type ComparisonSummary = {
  totalOriginal: number
  totalGenerated: number
  totalDifference: number
  totalPercentChange: number
}

// summarize an array of comparison results into totals
export const summarize = (results: ComparisonResult[]): ComparisonSummary => {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalBytes, 0)
  const totalGenerated = results.reduce((sum, r) => sum + r.generatedBytes, 0)
  const totalDifference = totalOriginal - totalGenerated
  const totalPercentChange = totalOriginal === 0 ? 0 : (totalDifference / totalOriginal) * 100

  return {
    totalOriginal,
    totalGenerated,
    totalDifference,
    totalPercentChange,
  }
}

// build a full comparison table as a string
export const buildTable = (results: ComparisonResult[]): string => {
  if (results.length === 0) {
    return ''
  }

  const lines: string[] = []
  const header = 'File'.padEnd(25) + 'Original'.padStart(10) + 'Generated'.padStart(12) + 'Diff'.padStart(8) + 'Change'.padStart(10)
  const separator = '\u2500'.repeat(65)

  lines.push(header)
  lines.push(separator)

  const sorted = [...results].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
  for (const result of sorted) {
    lines.push(formatRow(result))
  }

  const totals = summarize(results)

  lines.push(separator)
  const totalChangeStr = formatChange(totals.totalDifference, totals.totalPercentChange)
  lines.push(
    'TOTAL'.padEnd(25) +
      totals.totalOriginal.toString().padStart(10) +
      totals.totalGenerated.toString().padStart(12) +
      totals.totalDifference.toString().padStart(8) +
      totalChangeStr.padStart(10),
  )
  lines.push('')
  lines.push(
    (totals.totalDifference > 0 ? 'SAVED ' : 'INCREASED ') +
      Math.abs(totals.totalDifference) + ' bytes (' +
      Math.abs(totals.totalPercentChange).toFixed(1) + '%)',
  )

  return lines.join('\n')
}
