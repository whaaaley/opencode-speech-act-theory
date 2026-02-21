import type { PluginInput } from '@opencode-ai/plugin'
import type { z } from 'zod'
import { buildRetryPrompt } from './prompt.ts'
import { extractLlmError, type MessageInfo } from './utils/extractLlmError.ts'
import { stripCodeFences } from './utils/stripCodeFences.ts'
import { formatValidationError, validateJson } from './utils/validate.ts'

const MAX_RETRIES = 3

export type PromptModel = {
  providerID: string
  modelID: string
}

type PromptSuccess<T> = {
  data: T
  error: null
}

type PromptError = {
  data: null
  error: string
}

export type PromptResult<T> = PromptSuccess<T> | PromptError

type Part = {
  type: string
  text?: string
}

type MessageEntry = {
  info: MessageInfo
  parts: Part[]
}

// extract text content from response parts
export const extractText = (parts: Part[]): string => {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text || '')
    .join('')
}

// detect model from the calling session's most recent assistant message
export const detectModel = async (
  client: PluginInput['client'],
  sessionId: string,
): Promise<PromptModel | null> => {
  const messagesResult = await client.session.messages({
    path: { id: sessionId },
  })
  if (!messagesResult.data) {
    return null
  }

  // SDK returns untyped array — shape validated by role/providerID/modelID checks below
  const messages = messagesResult.data as MessageEntry[]
  for (let i = messages.length - 1; i >= 0; i--) {
    const info = messages[i].info
    if (info.role === 'assistant' && info.providerID && info.modelID) {
      return {
        providerID: info.providerID,
        modelID: info.modelID,
      }
    }
  }

  return null
}

// prompt the LLM and validate the response, retrying on failure
export const promptWithRetry = async <T>(
  client: PluginInput['client'],
  sessionId: string,
  initialPrompt: string,
  schema: z.ZodType<T>,
  model: PromptModel,
): Promise<PromptResult<T>> => {
  let prompt = initialPrompt
  let lastError = ''

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: prompt }],
        tools: {},
        model,
      },
    })

    if (!response.data) {
      return {
        data: null,
        error: 'No response from LLM (attempt ' + (attempt + 1) + ')',
      }
    }

    // SDK returns untyped info — shape validated by extractLlmError null checks
    const info = response.data.info as MessageInfo
    const llmError = extractLlmError(info)
    if (llmError) {
      return {
        data: null,
        error: llmError,
      }
    }

    // SDK returns untyped parts — extractText filters by type === 'text' with fallback
    const text = extractText(response.data.parts as Part[])
    if (!text) {
      lastError = 'Empty response'
      prompt = buildRetryPrompt('Empty response. Return valid JSON.')
      continue
    }

    // validate against schema
    const cleaned = stripCodeFences(text)
    const validation = validateJson(cleaned, schema)
    if (validation.error) {
      const errorMsg = formatValidationError(validation)
      lastError = errorMsg + ' | raw: ' + cleaned.slice(0, 200)
      prompt = buildRetryPrompt(errorMsg)
      continue
    }

    return {
      data: validation.data,
      error: null,
    }
  }

  return {
    data: null,
    error: 'Failed after ' + MAX_RETRIES + ' attempts. Last error: ' + lastError,
  }
}
