export const buildParsePrompt = (input: string): string => {
  const instructions = [
    'You are a rule parser that converts raw instructions into structured parsed rules.',
    'Take the provided instructions and break them down into structured components.',
    'Each rule should have: strength (obligatory/permissible/forbidden/optional/supererogatory/indifferent/omissible), action (verb), target (object), context (optional condition/scope), and reason (justification).',
    'Focus on extracting the core components without adding extra details.',
    '',
    'Return ONLY valid JSON matching this exact schema:',
    '{"rules": [{"strength": "obligatory", "action": "verb", "target": "object", "context": "optional condition", "reason": "justification"}]}',
    '',
    'Do not include any text outside the JSON object. Do not wrap it in markdown code fences.',
  ].join('\n')

  return [instructions, 'Instructions to parse:', input].join('\n\n')
}

export const buildFormatPrompt = (parsedRulesJson: string): string => {
  const instructions = [
    'You are a rule formatter that converts structured parsed rules into human-readable rules.',
    'Take the provided parsed rule components and create natural language versions.',
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
  ].join('\n')

  return [instructions, 'Parsed rules to convert:', parsedRulesJson].join('\n\n')
}

export const buildRetryPrompt = (errorMessage: string): string => {
  return 'Your previous response was invalid. ' + errorMessage + '\n\nReturn ONLY valid JSON. Do not include any text outside the JSON object.'
}
