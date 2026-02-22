import { z } from 'zod'

export const IntentSchema = z.string()
  .describe('What to do, expressed as a clear directive')

export const TaskTargetsSchema = z.array(z.string())
  .describe('Files, systems, or things involved')

export const ConstraintsSchema = z.array(z.string())
  .describe('Conditions, preferences, or requirements')

export const TaskContextSchema = z.string()
  .describe('Background info or rationale for the task')

export const ParsedTaskSchema: z.ZodType<ParsedTask> = z.object({
  intent: IntentSchema,
  targets: TaskTargetsSchema.default([]),
  constraints: ConstraintsSchema.default([]),
  context: TaskContextSchema.optional(),
  subtasks: z.lazy(() => z.array(ParsedTaskSchema)).default([]),
})
  .describe('Single task decomposed into action/planning components')

export const ParsedPromptSchema = z.object({
  tasks: z.array(ParsedTaskSchema),
})

export type ParsedTask = {
  intent: string
  targets: Array<string>
  constraints: Array<string>
  context?: string
  subtasks: Array<ParsedTask>
}

export type ParsedPrompt = z.infer<typeof ParsedPromptSchema>

export const promptSchemaExample = JSON.stringify({
  tasks: [{
    intent: IntentSchema.description || 'directive',
    targets: [TaskTargetsSchema.element.description || 'file or system'],
    constraints: [ConstraintsSchema.element.description || 'requirement'],
    context: TaskContextSchema.description || 'optional background',
    subtasks: [],
  }],
})
