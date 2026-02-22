import type { PluginInput } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { basename } from 'node:path'
import { appendRules } from './append.ts'
import { sendResult } from './opencode/notify.ts'
import { type FileResult, processFile, type PromptFn } from './process.ts'
import { processPrompt } from './process-prompt.ts'
import { type FormatMode, isFormatMode } from './prompt.ts'
import { resolveFiles } from './resolve.ts'
import { detectModel, promptWithRetry } from './session.ts'
import { buildTable, type TableRow } from './utils/compare.ts'
import { safeAsync } from './utils/safe.ts'

type Client = PluginInput['client']

type ToolDeps = {
  directory: string
  client: Client
}

const ERROR_LABELS: Record<string, string> = {
  readError: 'Read failed',
  parseError: 'Parse failed',
  formatError: 'Format failed',
  writeError: 'Write failed',
}

const toTableRow = (result: FileResult): TableRow => {
  if (result.status === 'success') {
    return {
      file: basename(result.path),
      status: 'Success',
      rules: result.rulesCount,
      comparison: result.comparison,
    }
  }

  const label = ERROR_LABELS[result.status] || result.status

  return {
    file: basename(result.path),
    status: label,
  }
}

type CreateSessionSuccess = {
  ok: true
  sessionId: string
  prompt: PromptFn
}

type CreateSessionError = {
  ok: false
  error: string
}

type CreateSessionResult = CreateSessionSuccess | CreateSessionError

type CreateSessionOptions = {
  client: Client
  sessionID: string
  title: string
  toolName: string
}

const createSession = async (options: CreateSessionOptions): Promise<CreateSessionResult> => {
  const model = await detectModel(options.client, options.sessionID)
  if (!model) {
    return {
      ok: false,
      error: 'Could not detect current model. Send a message first, then call ' + options.toolName + '.',
    }
  }

  const sessionResult = await options.client.session.create({ body: { title: options.title } })
  if (!sessionResult.data) {
    return {
      ok: false,
      error: 'Failed to create internal session',
    }
  }

  const sessionId = sessionResult.data.id

  const prompt: PromptFn = (text, schema) => (
    promptWithRetry({
      client: options.client,
      sessionId,
      initialPrompt: text,
      schema,
      model,
    })
  )

  return {
    ok: true,
    sessionId,
    prompt,
  }
}

type RewriteToolOptions = {
  description: string
  deps: ToolDeps
}

export const createRewriteTool = (options: RewriteToolOptions) => {
  return tool({
    description: options.description,
    args: {
      mode: tool.schema.string().optional().describe(
        'Output format: verbose, balanced, or concise (default: balanced)',
      ),
      files: tool.schema.string().optional().describe(
        'Comma-separated file paths to process instead of discovering from opencode.json',
      ),
    },
    async execute(args, context) {
      const mode = isFormatMode(args.mode) ? args.mode : 'balanced'

      try {
        const resolved = await resolveFiles(options.deps.directory, args.files)
        if (resolved.error !== null) {
          return resolved.error
        }

        const session = await createSession({
          client: options.deps.client,
          sessionID: context.sessionID,
          title: 'SAT Rewrite',
          toolName: 'rewrite-instructions',
        })
        if (!session.ok) {
          return session.error
        }

        const fileResults: FileResult[] = []

        for (const file of resolved.data) {
          if (context.abort.aborted) {
            break
          }

          fileResults.push(await processFile({
            file,
            prompt: session.prompt,
            mode,
          }))
        }

        await safeAsync(() => options.deps.client.session.delete({
          path: { id: session.sessionId },
        }))

        const table = buildTable(fileResults.map(toTableRow))

        if (table.length > 0) {
          await sendResult({
            client: options.deps.client,
            sessionID: context.sessionID,
            text: table,
          })
        }

        return table
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return 'rewrite-instructions error: ' + msg
      }
    },
  })
}

type AppendToolOptions = {
  description: string
  deps: ToolDeps
  toolName: string
  sessionTitle: string
  defaultMode: FormatMode
  successPrefix: string
  hasMode: boolean
}

export const createAppendTool = (options: AppendToolOptions) => {
  return tool({
    description: options.description,
    args: {
      input: tool.schema.string().describe(
        'Unstructured text describing the rule(s) to add',
      ),
      file: tool.schema.string().optional().describe(
        'File path to append to. If omitted, uses the first discovered instruction file.',
      ),
      ...(options.hasMode
        ? {
          mode: tool.schema.string().optional().describe(
            'Output format: verbose, balanced, or concise (default: balanced)',
          ),
        }
        : {}),
    },
    async execute(args, context) {
      const mode: FormatMode = options.hasMode && isFormatMode(args.mode) ? args.mode : options.defaultMode

      try {
        let filePath = args.file

        if (!filePath) {
          const resolved = await resolveFiles(options.deps.directory)
          if (resolved.error !== null) {
            return resolved.error
          }

          const first = resolved.data[0]
          if (!first) {
            return 'No instruction files found in opencode.json'
          }

          filePath = first.path
        }

        const session = await createSession({
          client: options.deps.client,
          sessionID: context.sessionID,
          title: options.sessionTitle,
          toolName: options.toolName,
        })
        if (!session.ok) {
          return session.error
        }

        const result = await appendRules({
          input: args.input,
          filePath,
          directory: options.deps.directory,
          prompt: session.prompt,
          mode,
        })

        await safeAsync(() => options.deps.client.session.delete({
          path: { id: session.sessionId },
        }))

        if (result.status !== 'success') {
          return result.status + ': ' + result.error
        }

        const msg = options.successPrefix + result.rulesCount + ' rule(s) to ' + result.path

        await sendResult({
          client: options.deps.client,
          sessionID: context.sessionID,
          text: msg,
        })

        return msg
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return options.toolName + ' error: ' + msg
      }
    },
  })
}

type RefineToolOptions = {
  description: string
  deps: ToolDeps
}

export const createRefineTool = (options: RefineToolOptions) => {
  return tool({
    description: options.description,
    args: {
      input: tool.schema.string().describe(
        'Raw unstructured user input to refine into a structured prompt',
      ),
    },
    async execute(args, context) {
      try {
        const session = await createSession({
          client: options.deps.client,
          sessionID: context.sessionID,
          title: 'SAT Refine',
          toolName: 'refine-prompt',
        })
        if (!session.ok) {
          return session.error
        }

        const result = await processPrompt({
          input: args.input,
          prompt: session.prompt,
        })

        await safeAsync(() => options.deps.client.session.delete({
          path: { id: session.sessionId },
        }))

        if (result.status !== 'success') {
          return 'refine-prompt parse error: ' + result.error
        }

        await sendResult({
          client: options.deps.client,
          sessionID: context.sessionID,
          text: result.formatted,
        })

        return result.formatted
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return 'refine-prompt error: ' + msg
      }
    },
  })
}
