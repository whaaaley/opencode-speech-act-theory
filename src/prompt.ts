import { parseSchemaExample } from './schema'

export type FormatMode = 'verbose' | 'balanced' | 'concise'

export const FORMAT_MODES: FormatMode[] = ['verbose', 'balanced', 'concise']

export const isFormatMode = (v: unknown): v is FormatMode =>
  typeof v === 'string' && FORMAT_MODES.includes(v as FormatMode)

export const buildParsePrompt = (input: string): string => {
  const instructions = [
    'You are a rule parser that converts raw instructions into structured parsed rules.',
    'Take the provided instructions and break them down into structured components.',
    'Each rule should have: strength, action (verb), target (object), context (optional condition/scope), and reason (justification).',
    'Focus on extracting the core components without adding extra details.',
    '',
    'Return ONLY valid JSON matching this exact schema:',
    parseSchemaExample,
    '',
    'Do not include any text outside the JSON object. Do not wrap it in markdown code fences.',
  ].join('\n')

  return [instructions, 'Instructions to parse:', input].join('\n\n')
}

const verboseInstructions = [
  'You are a rule formatter that converts structured parsed rules into human-readable rules.',
  'Take the provided parsed rule components and create natural language versions.',
  'Every rule must include both a Rule line and a Reason line.',
  'Each rule must follow this exact format:',
  '',
  'Rule: <clear, concise, actionable statement>',
  'Reason: <justification from the parsed rule>',
  '',
  'Each human-readable rule should directly correspond to the parsed components without adding extra details.',
  'Make the rules clear, concise, and actionable.',
  '',
  'Return ONLY valid JSON matching this exact schema:',
  '{"rules": ["Rule: ...\\nReason: ...", "Rule: ...\\nReason: ..."]}',
  '',
  'Do not include any text outside the JSON object. Do not wrap it in markdown code fences.',
]

const balancedInstructions = [
  'You are a rule formatter that converts structured parsed rules into human-readable rules.',
  'Take the provided parsed rule components and create natural language versions.',
  'Use your judgment for each rule:',
  '- If the rule is non-obvious or counterintuitive, include both the Rule and Reason lines.',
  '- If the rule is self-explanatory, include only the Rule line and omit the Reason.',
  '',
  'Format rules that include a reason:',
  'Rule: <clear, concise, actionable statement>',
  'Reason: <justification from the parsed rule>',
  '',
  'Format rules that are self-explanatory:',
  'Rule: <clear, concise, actionable statement>',
  '',
  'Each human-readable rule should directly correspond to the parsed components without adding extra details.',
  'Make the rules clear, concise, and actionable.',
  '',
  'Return ONLY valid JSON matching this exact schema:',
  '{"rules": ["Rule: ...\\nReason: ...", "Rule: ..."]}',
  '',
  'Do not include any text outside the JSON object. Do not wrap it in markdown code fences.',
]

const conciseInstructions = [
  'You are a rule formatter that converts structured parsed rules into concise directives.',
  'Take the provided parsed rule components and create a bullet list of clear directives.',
  'Do not include reasons or justifications. Output only the actionable statement.',
  'Each rule must be a single line starting with "- " (dash space).',
  '',
  'Each directive should directly correspond to the parsed components without adding extra details.',
  'Make the directives clear, concise, and actionable.',
  '',
  'Return ONLY valid JSON matching this exact schema:',
  '{"rules": ["- ...", "- ..."]}',
  '',
  'Do not include any text outside the JSON object. Do not wrap it in markdown code fences.',
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
  return 'Your previous response was invalid. ' + errorMessage
    + '\n\nReturn ONLY valid JSON. Do not include any text outside the JSON object.'
}
