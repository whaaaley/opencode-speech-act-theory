export type MessageInfo = {
  role: string
  providerID?: string
  modelID?: string
  error?: {
    name?: string
    data?: {
      message?: string
    }
  }
}

// extract error message from LLM response info
export const extractLlmError = (info: MessageInfo): string | null => {
  if (!info.error) {
    return null
  }

  const err = info.error
  if (err.data && err.data.message) {
    return err.data.message
  }

  return err.name || 'Unknown LLM error'
}
