import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PromptFn } from './process'
import { buildFormatPrompt, buildParsePrompt, type FormatMode } from './prompt'
import { FormatResponseSchema, ParseResponseSchema } from './rule-schema'
import { safeAsync } from './utils/safe'

type AppendResultSuccess = {
  status: 'success'
  path: string
  rulesCount: number
}

type AppendResultError = {
  status: 'parseError' | 'formatError' | 'readError' | 'writeError'
  path: string
  error: string
}

type AppendResult = AppendResultSuccess | AppendResultError

type AppendRulesOptions = {
  input: string
  filePath: string
  directory: string
  prompt: PromptFn
  mode?: FormatMode
}

// parse unstructured input, format it, and append to end of file
export const appendRules = async (options: AppendRulesOptions): Promise<AppendResult> => {
  const mode = options.mode ?? 'balanced'
  const fullPath = resolve(options.directory, options.filePath)

  // read existing file content
  const existing = await safeAsync(() => readFile(fullPath, 'utf-8'))
  if (existing.error !== null) {
    return {
      status: 'readError',
      path: options.filePath,
      error: existing.error.message,
    }
  }

  // step 1: parse input -> structured rules
  const parseResult = await options.prompt(buildParsePrompt(options.input), ParseResponseSchema)
  if (parseResult.error !== null) {
    return {
      status: 'parseError',
      path: options.filePath,
      error: String(parseResult.error),
    }
  }

  // step 2: format structured rules -> human-readable rules
  const formatPrompt = buildFormatPrompt(JSON.stringify(parseResult.data), mode)
  const formatResult = await options.prompt(formatPrompt, FormatResponseSchema)
  if (formatResult.error !== null) {
    return {
      status: 'formatError',
      path: options.filePath,
      error: String(formatResult.error),
    }
  }

  // step 3: append formatted rules to end of file
  const joiner = mode === 'concise' ? '\n' : '\n\n'
  const newRules = formatResult.data.rules.join(joiner)
  const separator = existing.data.endsWith('\n') ? '\n' : '\n\n'
  const content = existing.data + separator + newRules + '\n'

  const writeResult = await safeAsync(() => writeFile(fullPath, content, 'utf-8'))
  if (writeResult.error) {
    return {
      status: 'writeError',
      path: options.filePath,
      error: writeResult.error.message,
    }
  }

  return {
    status: 'success',
    path: options.filePath,
    rulesCount: formatResult.data.rules.length,
  }
}
