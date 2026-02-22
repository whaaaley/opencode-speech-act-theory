import { promptSchemaExample } from '../prompt-schema.ts'
import { formatSchemaExample, parseSchemaExample } from '../rule-schema.ts'

// Deontic logic: the 7 modal strengths and their natural language expression.
// Defined once, composed into tool descriptions that need them.

export const DEONTIC_STRENGTHS = [
  'obligatory -> positive imperative: "use consistent whitespace"',
  'forbidden -> negate with "do not": "do not use non-null assertions"',
  'permissible -> prefix with "may": "may use type assertions when necessary"',
  'optional -> prefix with "may choose to": "may choose to add commit body"',
  'supererogatory -> prefix with "ideally": "ideally provide comprehensive documentation"',
  'indifferent -> prefix with "either way is fine": "either way is fine for naming style"',
  'omissible -> prefix with "may omit": "may omit post-task explanations"',
].join('\n')

// Speech act detection: how to map natural language directive signals to deontic strength.
// Used by parse-rules to classify input.

export const NEGATION_SIGNALS = [
  '"avoid", "never", "do not", "don\'t", "no" -> forbidden',
  '"always", "must", "should", "ensure" -> obligatory',
  '"may", "can", "optionally" -> permissible',
].join('\n')

// Mode format templates: what each formatting mode produces.
// Used by format-rules to know the output shape per mode.

export const MODE_FORMATS = [
  'verbose: every rule gets Rule + Reason lines.',
  '  Rule: <directive>',
  '  Reason: <justification>',
  '',
  'balanced (default): include Reason only when non-obvious.',
  '  Rule: <directive>',
  '  Reason: <justification if needed>',
  '',
  'concise: bullet list, no reasons.',
  '  - <directive>',
].join('\n')

// Parameter shape descriptions. These describe the JSON value, not the LLM's role.

export const PARSE_RULES_PARAM = [
  'JSON with "rules" array of parsed rule objects.',
  'Each rule: { strength, action, target, context?, reason }',
  'Example: ' + parseSchemaExample,
].join('\n')

export const FORMAT_RULES_PARAM = [
  'JSON with "rules" array of formatted rule strings.',
  'Example: ' + formatSchemaExample,
].join('\n')

export const MODE_PARAM = 'verbose | balanced | concise. Default: balanced.'

export const PARSE_PROMPT_PARAM = [
  'JSON with "tasks" array. Each task: { intent, targets, constraints, context?, subtasks }',
  'Example: ' + promptSchemaExample,
].join('\n')
