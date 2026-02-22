import type { z } from 'zod'
import type { Result } from './utils/safe'
import type { ParsedPrompt } from './prompt-schema'
import { ParsedPromptSchema } from './prompt-schema'
import { buildPromptParsePrompt } from './prompt-prompt'
import { formatPrompt } from './format-prompt'

type PromptFn = <T>(prompt: string, schema: z.ZodType<T>) => Promise<Result<T>>

type ProcessPromptOptions = {
  input: string
  prompt: PromptFn
}

type PromptSuccess = {
  status: 'success'
  formatted: string
  parsed: ParsedPrompt
}

type PromptParseError = {
  status: 'parseError'
  error: string
}

type PromptResult = PromptSuccess | PromptParseError

export const processPrompt = async (options: ProcessPromptOptions): Promise<PromptResult> => {
  const parsePrompt = buildPromptParsePrompt(options.input)
  const parseResult = await options.prompt(parsePrompt, ParsedPromptSchema)
  if (!parseResult.data) {
    return {
      status: 'parseError',
      error: parseResult.error,
    }
  }

  const formatted = formatPrompt(parseResult.data)

  return {
    status: 'success',
    formatted,
    parsed: parseResult.data,
  }
}
