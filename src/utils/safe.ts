type ResultSuccess<T> = {
  data: T
  error: null
}

type ResultError<E> = {
  data: null
  error: E
}

export type Result<T, E = string> = ResultSuccess<T> | ResultError<E>

type SafeResult<T> = Result<T, Error>

export const safe = <T>(fn: () => T): SafeResult<T> => {
  try {
    const data = fn()
    return {
      data,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

export const safeAsync = async <T>(fn: () => Promise<T>): Promise<SafeResult<T>> => {
  try {
    const data = await fn()
    return {
      data,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
