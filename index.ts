import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { discover, readFilePaths } from './src/discover'
import type { InstructionFile } from './src/discover'
import { type FileResult, processFile, type PromptFn } from './src/process'
import { isFormatMode } from './src/prompt'
import { detectModel, promptWithRetry } from './src/session'
import { buildTable, type ComparisonResult } from './src/utils/compare'
import type { Result } from './src/utils/safe'
import { safeAsync } from './src/utils/safe'

// resolve instruction files from explicit paths or opencode.json discovery
const resolveFiles = async (directory: string, filesArg?: string): Promise<Result<InstructionFile[]>> => {
  if (filesArg) {
    const paths = filesArg.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
    if (paths.length === 0) {
      return { data: null, error: 'No valid file paths provided' }
    }
    return { data: await readFilePaths(directory, paths), error: null }
  }

  return await discover(directory)
}

const ERROR_LABELS: Record<Exclude<FileResult['status'], 'success'>, string> = {
  readError: 'Read failed',
  parseError: 'Parse failed',
  formatError: 'Format failed',
  writeError: 'Write failed',
}

// format a file result into a markdown status line
const formatFileResult = (result: FileResult): string => {
  if (result.status === 'success') {
    return '**' + result.path + '**: ' + result.rulesCount + ' rules written'
  }
  return '**' + result.path + '**: ' + ERROR_LABELS[result.status] + ' - ' + result.error
}

// append comparison table section to output lines
const appendComparisonTable = (lines: string[], comparisons: ComparisonResult[]): void => {
  if (comparisons.length === 0) {
    return
  }
  lines.push('')
  lines.push('## Comparison')
  lines.push('```')
  lines.push(buildTable(comparisons))
  lines.push('```')
  lines.push('')
  lines.push('IMPORTANT: Show the comparison table above to the user exactly as-is.')
}

// deno-lint-ignore require-await
const plugin: Plugin = async ({ directory, client }) => {
  return {
    tool: {
      'irf-rewrite': tool({
        description: [
          'Discover instruction files from opencode.json, parse them into structured rules, format them into human-readable rules, and write the formatted rules back to the original files.',
          'Accepts an optional mode: verbose (full Rule/Reason pairs), balanced (LLM decides which rules need reasons), or concise (bullet list, no reasons).',
          'Defaults to balanced.',
          'Accepts an optional files parameter to process specific files instead of running discovery.',
        ].join(' '),
        args: {
          mode: tool.schema.string().optional().describe(
            'Output format: verbose, balanced, or concise (default: balanced)',
          ),
          files: tool.schema.string().optional().describe(
            'Comma-separated file paths to process instead of discovering from opencode.json',
          ),
        },
        async execute(args, context) {
          // validate mode argument
          const mode = isFormatMode(args.mode) ? args.mode : 'balanced'
          try {
            // resolve files: explicit paths or discovery
            const resolved = await resolveFiles(directory, args.files)
            if (resolved.error !== null) {
              return resolved.error
            }
            const files = resolved.data

            // detect model from current session
            const model = await detectModel(client, context.sessionID)
            if (!model) {
              return 'Could not detect current model. Send a message first, then call irf-rewrite.'
            }

            // create a session for internal LLM calls
            const sessionResult = await client.session.create({
              body: {
                title: 'IRF Parse',
              },
            })
            if (!sessionResult.data) {
              return 'Failed to create internal session'
            }
            const sessionId = sessionResult.data.id

            // close over session details so processFile only needs a prompt callback
            const prompt: PromptFn = (text, schema) =>
              promptWithRetry({
                client,
                sessionId,
                initialPrompt: text,
                schema,
                model,
              })

            // process files sequentially; parallel prompting through a shared
            // session may cause ordering issues depending on SDK behavior
            const results: string[] = []
            const comparisons: ComparisonResult[] = []

            for (const file of files) {
              // bail if the tool call was cancelled
              if (context.abort.aborted) {
                results.push('Cancelled')
                break
              }

              const fileResult = await processFile({
                file,
                prompt,
                mode,
              })
              if (fileResult.status === 'success') {
                comparisons.push(fileResult.comparison)
              }
              results.push(formatFileResult(fileResult))
            }

            // clean up the internal session
            await safeAsync(() =>
              client.session.delete({
                path: { id: sessionId },
              })
            )

            // build comparison table
            appendComparisonTable(results, comparisons)

            return results.join('\n')
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return 'irf-rewrite error: ' + msg
          }
        },
      }),
    },
  }
}

export default plugin
