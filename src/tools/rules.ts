import type { PluginInput } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { appendRules } from '../append.ts'
import { buildTable, toTableRow } from '../compare.ts'
import { sendResult } from '../opencode/notify.ts'
import { resolveFiles } from '../resolve.ts'
import { type FileResult, processFile } from '../rewrite.ts'
import { FormatResponseSchema, ParseResponseSchema } from '../rule-schema.ts'
import { formatValidationError, validateJson } from '../validate.ts'
import { FORMAT_RULES_PARAM, MODE_PARAM, PARSE_RULES_PARAM } from './descriptions.ts'

// discover-rules

type DiscoverToolOptions = {
  description: string
  directory: string
  discovered: Set<string>
}

export const createDiscoverTool = (options: DiscoverToolOptions) => {
  return tool({
    description: options.description,
    args: {
      files: tool.schema
        .string()
        .optional()
        .describe('Comma-separated file paths to read instead of discovering from opencode.json'),
    },
    async execute(args) {
      const resolved = await resolveFiles(options.directory, args.files)
      if (resolved.error !== null) {
        return resolved.error
      }

      if (resolved.data.length === 0) {
        return 'No instruction files found'
      }

      for (const file of resolved.data) {
        options.discovered.add(file.path)
      }

      const sections = resolved.data.map((file) => {
        if (file.error) {
          return '## ' + file.path + '\n\nError: ' + file.error
        }

        if (file.content.length === 0) {
          return '## ' + file.path + '\n\n(empty file)'
        }

        return '## ' + file.path + '\n\n' + file.content
      })

      return sections.join('\n\n---\n\n')
    },
  })
}

// parse-rules

type ParseRulesToolOptions = {
  description: string
}

export const createParseRulesTool = (options: ParseRulesToolOptions) => {
  return tool({
    description: options.description,
    args: {
      rules: tool.schema.string().describe(PARSE_RULES_PARAM),
    },
    async execute(args) {
      const validated = validateJson(args.rules, ParseResponseSchema)
      if (validated.error !== null) {
        return formatValidationError(validated)
      }

      return JSON.stringify(validated.data, null, 2)
    },
  })
}

// format-rules

type FormatRulesToolOptions = {
  description: string
}

export const createFormatRulesTool = (options: FormatRulesToolOptions) => {
  return tool({
    description: options.description,
    args: {
      rules: tool.schema.string().describe(FORMAT_RULES_PARAM),
      mode: tool.schema.string().optional().describe(MODE_PARAM),
    },
    async execute(args) {
      const validated = validateJson(args.rules, FormatResponseSchema)
      if (validated.error !== null) {
        return formatValidationError(validated)
      }

      return JSON.stringify(validated.data, null, 2)
    },
  })
}

// rewrite-rules / add-rules

type WriteToolOptions = {
  client: PluginInput['client']
  description: string
  directory: string
  discovered: Set<string>
}

export const createRewriteTool = (options: WriteToolOptions) => {
  return tool({
    description: options.description,
    args: {
      rules: tool.schema.string().describe(FORMAT_RULES_PARAM),
      files: tool.schema.string().optional().describe(
        'Comma-separated file paths to process instead of discovering from opencode.json',
      ),
      mode: tool.schema.string().optional().describe(MODE_PARAM),
    },
    async execute(args, context) {
      if (options.discovered.size === 0) {
        return 'Call discover-rules first to read the instruction files before rewriting.'
      }

      const validated = validateJson(args.rules, FormatResponseSchema)
      if (validated.error !== null) {
        return formatValidationError(validated)
      }

      const resolved = await resolveFiles(options.directory, args.files)
      if (resolved.error !== null) {
        return resolved.error
      }

      const fileResults: Array<FileResult> = []

      for (const file of resolved.data) {
        if (context.abort.aborted) {
          break
        }

        fileResults.push(
          await processFile({
            file,
            rules: validated.data.rules,
          }),
        )
      }

      const table = buildTable(fileResults.map(toTableRow))

      await sendResult({
        client: options.client,
        sessionID: context.sessionID,
        text: table,
      })

      return 'Rewrote ' + fileResults.length + ' file(s). Results displayed in chat.'
    },
  })
}

// add-rules

export const createAddTool = (options: WriteToolOptions) => {
  return tool({
    description: options.description,
    args: {
      rules: tool.schema.string().describe(FORMAT_RULES_PARAM),
      file: tool.schema.string().optional().describe(
        'File path to append to. If omitted, uses the first discovered instruction file.',
      ),
      mode: tool.schema.string().optional().describe(MODE_PARAM),
    },
    async execute(args, context) {
      if (options.discovered.size === 0) {
        return 'Call discover-rules first to read the instruction files before adding.'
      }

      const validated = validateJson(args.rules, FormatResponseSchema)
      if (validated.error !== null) {
        return formatValidationError(validated)
      }

      let filePath = args.file

      if (!filePath) {
        const resolved = await resolveFiles(options.directory)
        if (resolved.error !== null) {
          return resolved.error
        }

        const first = resolved.data[0]
        if (!first) {
          return 'No instruction files found in opencode.json'
        }

        filePath = first.path
      }

      const result = await appendRules({
        filePath,
        rules: validated.data.rules,
      })

      if (result.status !== 'success') {
        return result.status + ': ' + result.error
      }

      const message = 'Added ' + result.rulesCount + ' rule(s) to ' + result.path

      await sendResult({
        client: options.client,
        sessionID: context.sessionID,
        text: message,
      })

      return 'Added ' + result.rulesCount + ' rule(s). Results displayed in chat.'
    },
  })
}
