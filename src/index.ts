import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { z } from 'zod'
import { ParsedRuleSchema, RuleSchema } from './schema.ts'
import { formatValidationError, validateJson } from './utils/validate.util.ts'

const ParsedRulesOutput = z.object({
  rules: z.array(ParsedRuleSchema),
})

const RulesOutput = z.object({
  rules: z.array(RuleSchema),
})

export const IRFPlugin: Plugin = async () => {
  return {
    tool: {
      'irf-parse': tool({
        description:
          'Parse unstructured instruction text into structured rules. Takes raw instruction text and returns a JSON object with a "rules" array. Each rule has: strength (obligatory/permissible/forbidden/optional/supererogatory/indifferent/omissible), action (verb), target (object), context (optional, conditions), and reason (justification). Return ONLY valid JSON matching this schema.',
        args: {
          instructions: tool.schema.string().describe('The raw instruction text to parse into structured rules'),
          output: tool.schema.string().describe(
            'Your parsed rules as a JSON string: {"rules": [{"strength": "obligatory", "action": "use", "target": "...", "context": "...", "reason": "..."}]}',
          ),
        },
        async execute(args) {
          const result = validateJson(args.output, ParsedRulesOutput)
          if (result.error) {
            return formatValidationError(result)
          }

          return '**Parsed rules validated successfully**\n\n' + args.output
        },
      }),
      'irf-format': tool({
        description:
          'Format structured parsed rules into human-readable natural language rules. Takes parsed rules JSON and returns a JSON object with a "rules" array of strings. Each string should be a clear, concise, actionable rule. Return ONLY valid JSON.',
        args: {
          parsed_rules: tool.schema.string().describe('The parsed rules JSON from irf-parse'),
          output: tool.schema.string().describe('Your formatted rules as a JSON string: {"rules": ["Rule text 1", "Rule text 2"]}'),
        },
        async execute(args) {
          const result = validateJson(args.output, RulesOutput)
          if (result.error) {
            return formatValidationError(result)
          }

          return '**Formatted rules validated successfully**\n\n' + args.output
        },
      }),
    },
  }
}
