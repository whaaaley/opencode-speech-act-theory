import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { discover, readFilePaths } from './discover.ts'
import type { InstructionFile } from './discover.ts'
import { buildTable, type ComparisonResult } from './utils/compare.ts'
import { detectModel, promptWithRetry } from './session.ts'
import { safeAsync } from './utils/safe.ts'
import { type FileResult, processFile } from './process.ts'
import { isFormatMode } from './prompt.ts'

const ERROR_LABELS: Record<Exclude<FileResult['status'], 'success'>, string> = {
  readError: 'Read failed',
  parseError: 'Parse failed',
  formatError: 'Format failed',
  writeError: 'Write failed',
}

export const IRFPlugin: Plugin = async ({ directory, client }) => {
  return {
    tool: {
      'irf-rewrite': tool({
        description:
          'Discover instruction files from opencode.json, parse them into structured rules, format them into human-readable rules, and write the formatted rules back to the original files. Accepts an optional mode: verbose (full Rule/Reason pairs), balanced (LLM decides which rules need reasons), or concise (bullet list, no reasons). Defaults to balanced. Accepts an optional files parameter to process specific files instead of running discovery.',
        args: {
          mode: tool.schema.string().optional().describe('Output format: verbose, balanced, or concise (default: balanced)'),
          files: tool.schema.string().optional().describe('Comma-separated file paths to process instead of discovering from opencode.json'),
        },
        async execute(args, context) {
          // validate mode argument
          const mode = isFormatMode(args.mode) ? args.mode : 'balanced'
          try {
            // resolve files: explicit paths or discovery
            let files: InstructionFile[]
            if (args.files) {
              const paths = args.files.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
              if (paths.length === 0) {
                return 'No valid file paths provided'
              }
              files = await readFilePaths(directory, paths)
            } else {
              const discovered = await discover(directory)
              if (discovered.error !== null) {
                return discovered.error
              }
              files = discovered.data
            }

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
            const prompt: Parameters<typeof processFile>[1] = (text, schema) => promptWithRetry({ client, sessionId, initialPrompt: text, schema, model })

            // process files sequentially — parallel prompting through a shared
            // session may cause ordering issues depending on SDK behavior
            const results: string[] = []
            const comparisons: ComparisonResult[] = []

            for (const file of files) {
              // bail if the tool call was cancelled
              if (context.abort.aborted) {
                results.push('Cancelled')
                break
              }

              const fileResult = await processFile(file, prompt, mode)
              if (fileResult.status === 'success') {
                results.push('**' + fileResult.path + '**: ' + fileResult.rulesCount + ' rules written')
                comparisons.push(fileResult.comparison)
              } else {
                results.push('**' + fileResult.path + '**: ' + ERROR_LABELS[fileResult.status] + ' - ' + fileResult.error)
              }
            }

            // clean up the internal session
            await safeAsync(() =>
              client.session.delete({
                path: { id: sessionId },
              })
            )

            // build comparison table
            if (comparisons.length > 0) {
              results.push('')
              results.push('## Comparison')
              results.push('```')
              results.push(buildTable(comparisons))
              results.push('```')
              results.push('')
              results.push('IMPORTANT: Show the comparison table above to the user exactly as-is.')
            }

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
