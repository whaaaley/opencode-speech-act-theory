import type { PluginInput } from '@opencode-ai/plugin'
import type { z } from 'zod'
import { buildRetryPrompt } from './prompt'
import { extractLlmError, type MessageInfo } from './utils/extractLlmError'
import type { Result } from './utils/safe'
import { stripCodeFences } from './utils/stripCodeFences'
import { formatValidationError, validateJson } from './utils/validate'

const MAX_RETRIES = 3

export type PromptModel = {
  providerID: string
  modelID: string
}

// SDK types — local workarounds until the SDK exports proper types
type Part = {
  type: string
  text?: string
}

type MessageEntry = {
  info: MessageInfo
  parts: Part[]
}

// runtime type guards for untyped SDK responses
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPart = (v: unknown): v is Part => isRecord(v) && typeof v.type === 'string'
const isPartArray = (v: unknown): v is Part[] => Array.isArray(v) && v.every(isPart)
const isMessageInfo = (v: unknown): v is MessageInfo => isRecord(v) && typeof v.role === 'string'
const isMessageEntry = (v: unknown): v is MessageEntry => isRecord(v) && isMessageInfo(v.info) && isPartArray(v.parts)
const isMessageEntryArray = (v: unknown): v is MessageEntry[] => Array.isArray(v) && v.every(isMessageEntry)

// extract text content from response parts
export const extractText = (parts: Part[]): string => {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    // fallback needed because TS cannot narrow through .filter()
    .map((p) => p.text || '')
    .join('')
}

// detect model from the calling session's most recent assistant message
export const detectModel = async (client: PluginInput['client'], sessionId: string): Promise<PromptModel | null> => {
  const messagesResult = await client.session.messages({
    path: { id: sessionId },
  })
  if (!messagesResult.data) {
    return null
  }

  const messages = messagesResult.data
  if (!isMessageEntryArray(messages)) {
    return null
  }
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

type PromptWithRetryOptions<T> = {
  client: PluginInput['client']
  sessionId: string
  initialPrompt: string
  schema: z.ZodType<T>
  model: PromptModel
}

// prompt the LLM and validate the response, retrying on failure
export const promptWithRetry = async <T>(options: PromptWithRetryOptions<T>): Promise<Result<T>> => {
  const { client, sessionId, initialPrompt, schema, model } = options
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

    // no response data means a transport/API failure — not retryable
    if (!response.data) {
      return {
        data: null,
        error: 'No response from LLM (attempt ' + (attempt + 1) + ')',
      }
    }

    const info = response.data.info
    if (!isMessageInfo(info)) {
      return {
        data: null,
        error: 'Unexpected response shape: missing info (attempt ' + (attempt + 1) + ')',
      }
    }
    const llmError = extractLlmError(info)
    if (llmError) {
      return {
        data: null,
        error: llmError,
      }
    }

    const parts = response.data.parts
    if (!isPartArray(parts)) {
      return {
        data: null,
        error: 'Unexpected response shape: missing parts (attempt ' + (attempt + 1) + ')',
      }
    }

    // empty text is a model issue — retryable
    const text = extractText(parts)
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
