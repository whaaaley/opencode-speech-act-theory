import { writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { z } from 'zod'
import type { InstructionFile } from './discover'
import { buildFormatPrompt, buildParsePrompt, type FormatMode } from './prompt'
import { FormatResponseSchema, ParseResponseSchema } from './rule-schema'
import { compareBytes, type ComparisonResult } from './utils/compare'
import type { Result } from './utils/safe'
import { safeAsync } from './utils/safe'

type FileResultSuccess = {
  status: 'success'
  path: string
  rulesCount: number
  comparison: ComparisonResult
}

type FileResultError = {
  status: 'readError' | 'parseError' | 'formatError' | 'writeError'
  path: string
  error: string
}

export type FileResult = FileResultSuccess | FileResultError

// callback that sends a prompt to the LLM and returns validated data
export type PromptFn = <T>(prompt: string, schema: z.ZodType<T>) => Promise<Result<T>>

type ProcessFileOptions = {
  file: InstructionFile
  prompt: PromptFn
  mode?: FormatMode
}

// process a single instruction file through the parse -> format -> write pipeline
export const processFile = async (options: ProcessFileOptions): Promise<FileResult> => {
  const mode = options.mode ?? 'balanced'

  // skip files that failed to read
  if (options.file.error) {
    return {
      status: 'readError',
      path: options.file.path,
      error: options.file.error,
    }
  }

  // step 1: parse instruction text -> structured rules
  const parseResult = await options.prompt(buildParsePrompt(options.file.content), ParseResponseSchema)

  if (parseResult.error !== null) {
    return {
      status: 'parseError',
      path: options.file.path,
      error: String(parseResult.error),
    }
  }

  // step 2: format structured rules -> human-readable rules
  const formatResult = await options.prompt(buildFormatPrompt(JSON.stringify(parseResult.data), mode), FormatResponseSchema)

  if (formatResult.error !== null) {
    return {
      status: 'formatError',
      path: options.file.path,
      error: String(formatResult.error),
    }
  }

  // step 3: write formatted rules back to original file
  const formattedRules = formatResult.data.rules
  const joiner = mode === 'concise' ? '\n' : '\n\n'
  const content = formattedRules.join(joiner) + '\n'
  const writeResult = await safeAsync(() => writeFile(options.file.path, content, 'utf-8'))
  if (writeResult.error) {
    return {
      status: 'writeError',
      path: options.file.path,
      error: writeResult.error.message,
    }
  }

  const comparison = compareBytes(basename(options.file.path), options.file.content, content)
  return {
    status: 'success',
    path: options.file.path,
    rulesCount: formattedRules.length,
    comparison,
  }
}
