import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import { basename } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { discover } from './discover.ts'
import { compareBytes, type ComparisonResult, buildTable } from './compare.ts'
import { ParseResponseSchema, FormatResponseSchema } from './schema.ts'
import { buildFormatPrompt, buildParsePrompt } from './prompt.ts'
import { detectModel, promptWithRetry } from './session.ts'
import { safeAsync } from './utils/safe.ts'

export const IRFPlugin: Plugin = async ({ directory, client }) => {
  return {
    tool: {
      'irf-rewrite': tool({
        description: 'Discover instruction files from opencode.json, parse them into structured rules, format them into human-readable rules, and write the formatted rules back to the original files.',
        args: {},
        async execute(_args, context) {
          try {
            // discover instruction files
            const discovered = await discover(directory)
            if (discovered.error || !discovered.data) {
              return discovered.error || 'No instruction files found'
            }

            // detect model from current session
            const model = await detectModel(client, context.sessionID)
            if (!model) {
              return 'Could not detect current model. Send a message first, then call irf-rewrite.'
            }

            const files = discovered.data
            const results: string[] = []
            const comparisons: ComparisonResult[] = []

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

            for (const file of files) {
              // bail if the tool call was cancelled
              if (context.abort.aborted) {
                results.push('Cancelled')
                break
              }

              // skip files that failed to read
              if (file.error) {
                results.push('**' + file.path + '**: Read failed — ' + file.error)
                continue
              }

              // step 1: parse instruction text -> structured rules
              const parsePrompt = buildParsePrompt(file.content)
              const parseResult = await promptWithRetry(
                client,
                sessionId,
                parsePrompt,
                ParseResponseSchema,
                model,
              )

              if (parseResult.error || !parseResult.data) {
                results.push('**' + file.path + '**: Parse failed — ' + (parseResult.error || 'no data'))
                continue
              }

              const parsedJson = JSON.stringify(parseResult.data)

              // step 2: format structured rules -> human-readable rules
              const formatPrompt = buildFormatPrompt(parsedJson)
              const formatResult = await promptWithRetry(
                client,
                sessionId,
                formatPrompt,
                FormatResponseSchema,
                model,
              )

              if (formatResult.error || !formatResult.data) {
                results.push('**' + file.path + '**: Format failed — ' + (formatResult.error || 'no data'))
                continue
              }

              // step 3: write formatted rules back to original file
              const formattedRules = formatResult.data.rules
              const content = formattedRules.join('\n\n') + '\n'
              const { error: writeError } = await safeAsync(() => writeFile(file.path, content, 'utf-8'))
              if (writeError) {
                results.push('**' + file.path + '**: Write failed — ' + writeError.message)
                continue
              }

              const comparison = compareBytes(basename(file.path), file.content, content)
              comparisons.push(comparison)
              results.push('**' + file.path + '**: ' + formattedRules.length + ' rules written')
            }

            // clean up the internal session
            await safeAsync(() => client.session.delete({
              path: { id: sessionId },
            }))

            // build comparison table
            if (comparisons.length > 0) {
              results.push('')
              results.push('```')
              results.push(buildTable(comparisons))
              results.push('```')
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
