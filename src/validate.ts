import type { z } from 'zod'
import { safe } from './safe.ts'

type ValidateJsonSuccess<T> = {
  data: T
  error: null
}

type ValidateJsonParseError = {
  data: null
  error: 'parse'
}

type ValidateJsonSchemaError = {
  data: null
  error: 'schema'
  issues: z.core.$ZodIssue[]
}

type ValidateJsonResult<T> = ValidateJsonSuccess<T> | ValidateJsonParseError | ValidateJsonSchemaError

export const validateJson = <T>(json: string, schema: z.ZodType<T>): ValidateJsonResult<T> => {
  const parseResult = safe(() => JSON.parse(json))
  if (parseResult.error) {
    return {
      data: null,
      error: 'parse',
    }
  }

  const result = schema.safeParse(parseResult.data)
  if (!result.success) {
    return {
      data: null,
      error: 'schema',
      issues: result.error.issues,
    }
  }

  return {
    data: result.data,
    error: null,
  }
}

export const formatValidationError = (result: ValidateJsonParseError | ValidateJsonSchemaError): string => {
  if (result.error === 'parse') {
    return 'Invalid JSON. Return valid JSON.'
  }

  const issues = result.issues
    .map((i) => '  - ' + i.path.join('.') + ': ' + i.message)
    .join('\n')

  return 'Schema validation failed:\n' + issues + '\n\nFix the issues and try again.'
}
