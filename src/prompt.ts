import { parseSchemaExample } from './rule-schema'

export type FormatMode = 'verbose' | 'balanced' | 'concise'

export const FORMAT_MODES: FormatMode[] = ['verbose', 'balanced', 'concise']

export const isFormatMode = (v: unknown): v is FormatMode =>
  typeof v === 'string' && FORMAT_MODES.includes(v as FormatMode)

export const buildParsePrompt = (input: string): string => {
  const instructions = [
    'Always respond with raw JSON text only.',
    'Never use tools.',
    'Never call functions.',
    '',
    'Parse the instructions below into structured rules.',
    'Each rule has: strength (deontic modality), action (verb), target (object), context (optional scope), reason (justification).',
    '',
    'Return JSON matching this schema:',
    parseSchemaExample,
  ].join('\n')

  return [instructions, 'Instructions to parse:', input].join('\n\n')
}

const verboseInstructions = [
  'Always respond with raw JSON text only.',
  'Never use tools.',
  'Never call functions.',
  '',
  'Convert the parsed rules below into human-readable rules.',
  'Always include both a Rule line and a Reason line for every rule.',
  '',
  'Rule: <clear, actionable statement>',
  'Reason: <justification>',
  '',
  'Return JSON matching this schema:',
  '{"rules": ["Rule: ...\\nReason: ...", "Rule: ...\\nReason: ..."]}',
]

const balancedInstructions = [
  'Always respond with raw JSON text only.',
  'Never use tools.',
  'Never call functions.',
  '',
  'Convert the parsed rules below into human-readable rules.',
  'Include a Reason line only when the rule is non-obvious or counterintuitive.',
  'Omit the Reason line when the rule is self-explanatory.',
  '',
  'Rule: <clear, actionable statement>',
  'Reason: <justification> (only if needed)',
  '',
  'Return JSON matching this schema:',
  '{"rules": ["Rule: ...\\nReason: ...", "Rule: ..."]}',
]

const conciseInstructions = [
  'Always respond with raw JSON text only.',
  'Never use tools.',
  'Never call functions.',
  '',
  'Convert the parsed rules below into concise directives.',
  'Never include reasons.',
  'Each rule is a single line starting with "- ".',
  '',
  'Return JSON matching this schema:',
  '{"rules": ["- ...", "- ..."]}',
]

const formatInstructions: Record<FormatMode, string[]> = {
  verbose: verboseInstructions,
  balanced: balancedInstructions,
  concise: conciseInstructions,
}

export const buildFormatPrompt = (parsedRulesJson: string, mode: FormatMode = 'balanced'): string => {
  const instructions = formatInstructions[mode].join('\n')
  return [instructions, 'Parsed rules to convert:', parsedRulesJson].join('\n\n')
}

export const buildRetryPrompt = (errorMessage: string): string => {
  return 'Invalid response: ' + errorMessage + '\n\nAlways respond with raw JSON text only. Never use tools. Never wrap in code fences.'
}
