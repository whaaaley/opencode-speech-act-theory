import { z } from 'zod'

export const StrengthSchema = z.enum([
  'obligatory',
  'permissible',
  'forbidden',
  'optional',
  'supererogatory',
  'indifferent',
  'omissible',
])
  .describe('Deontic modality expressing enforcement strength')

export const ActionSchema = z.string()
  .describe('Imperative verb describing the action to take')

export const TargetSchema = z.string()
  .describe('Object or subject the action applies to')

export const ContextSchema = z.string()
  .describe('Condition, scope, or circumstance when the rule applies')

export const ReasonSchema = z.string()
  .describe('Justification for why the rule exists')

export const ParsedRuleSchema = z.object({
  strength: StrengthSchema,
  action: ActionSchema,
  target: TargetSchema,
  context: ContextSchema.optional(),
  reason: ReasonSchema,
})
  .describe('Single instruction decomposed into deontic components')

export const RuleSchema = z.string()
  .describe('Human-readable rule derived from parsed components')

export const ParsedSchema = z.array(ParsedRuleSchema)
  .describe('Array of parsed rules')

export const ParseResponseSchema = z.object({
  rules: ParsedSchema,
})

export const FormatResponseSchema = z.object({
  rules: z.array(RuleSchema),
})

export type Strength = z.infer<typeof StrengthSchema>
export type ParsedRule = z.infer<typeof ParsedRuleSchema>
