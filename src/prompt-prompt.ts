import { promptSchemaExample } from './prompt-schema'

export const buildPromptParsePrompt = (input: string): string => {
  const instructions = [
    'Always respond with raw JSON text only.',
    'Never use tools.',
    'Never call functions.',
    '',
    'Decompose the user input below into a structured task hierarchy.',
    'Each task has: intent (imperative verb phrase), targets (array), constraints (array), context (optional string), subtasks (recursive array).',
    'Separate compound requests into multiple top-level tasks.',
    'Preserve file names, variable names, and technical terms exactly.',
    'Drop filler words and verbal noise.',
    '',
    'Return JSON matching this schema:',
    promptSchemaExample,
  ]

  return [
    instructions.join('\n'),
    '---',
    'User input:',
    input,
  ].join('\n')
}

export const buildPromptRetryPrompt = (errorMessage: string): string => {
  return 'Invalid response: ' + errorMessage + '\n\nAlways respond with raw JSON text only. Never use tools. Never wrap in code fences.'
}
