import type { PluginInput } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { formatPrompt } from '../format-prompt.ts'
import { sendResult } from '../opencode/notify.ts'
import { ParsedPromptSchema } from '../prompt-schema.ts'
import { formatValidationError, validateJson } from '../validate.ts'
import { PARSE_PROMPT_PARAM } from './descriptions.ts'

// parse-prompt

type ParsePromptToolOptions = {
  description: string
}

export const createParsePromptTool = (options: ParsePromptToolOptions) => {
  return tool({
    description: options.description,
    args: {
      tasks: tool.schema.string().describe(PARSE_PROMPT_PARAM),
    },
    async execute(args) {
      const validated = validateJson(args.tasks, ParsedPromptSchema)
      if (validated.error !== null) {
        return formatValidationError(validated)
      }

      return JSON.stringify(validated.data, null, 2)
    },
  })
}

// format-prompt

type FormatPromptToolOptions = {
  client: PluginInput['client']
  description: string
}

export const createFormatPromptTool = (options: FormatPromptToolOptions) => {
  return tool({
    description: options.description,
    args: {
      tasks: tool.schema.string().describe(PARSE_PROMPT_PARAM),
    },
    async execute(args, context) {
      const validated = validateJson(args.tasks, ParsedPromptSchema)
      if (validated.error !== null) {
        return formatValidationError(validated)
      }

      const formatted = formatPrompt(validated.data)
      if (formatted.length === 0) {
        return 'No tasks found in the parsed input'
      }

      await sendResult({
        client: options.client,
        sessionID: context.sessionID,
        text: formatted,
      })

      return 'Formatted prompt displayed in chat.'
    },
  })
}
