import { assertEquals, assertInstanceOf } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { safe, safeAsync } from './safe.ts'

describe('safe', () => {
  it('returns data on success', () => {
    const result = safe(() => 42)

    assertEquals(result.data, 42)
    assertEquals(result.error, null)
  })

  it('returns data for string values', () => {
    const result = safe(() => 'hello')

    assertEquals(result.data, 'hello')
    assertEquals(result.error, null)
  })

  it('returns error when function throws an Error', () => {
    const result = safe(() => {
      throw new Error('boom')
    })

    assertEquals(result.data, null)
    assertInstanceOf(result.error, Error)
    assertEquals(result.error.message, 'boom')
  })

  it('wraps non-Error throws in an Error', () => {
    const result = safe(() => {
      throw 'string error'
    })

    assertEquals(result.data, null)
    assertInstanceOf(result.error, Error)
    assertEquals(result.error.message, 'string error')
  })

  it('returns null data as success', () => {
    const result = safe(() => null)

    assertEquals(result.data, null)
    assertEquals(result.error, null)
  })

  it('returns undefined data as success', () => {
    const result = safe(() => undefined)

    assertEquals(result.data, undefined)
    assertEquals(result.error, null)
  })
})

describe('safeAsync', () => {
  it('returns data on success', async () => {
    const result = await safeAsync(() => Promise.resolve(42))

    assertEquals(result.data, 42)
    assertEquals(result.error, null)
  })

  it('returns error when promise rejects with Error', async () => {
    const result = await safeAsync(() => Promise.reject(new Error('async boom')))

    assertEquals(result.data, null)
    assertInstanceOf(result.error, Error)
    assertEquals(result.error.message, 'async boom')
  })

  it('wraps non-Error rejections in an Error', async () => {
    const result = await safeAsync(() => Promise.reject('string rejection'))

    assertEquals(result.data, null)
    assertInstanceOf(result.error, Error)
    assertEquals(result.error.message, 'string rejection')
  })

  it('returns error when async function throws', async () => {
    // deno-lint-ignore require-await
    const result = await safeAsync(async () => {
      throw new Error('thrown in async')
    })

    assertEquals(result.data, null)
    assertInstanceOf(result.error, Error)
    assertEquals(result.error.message, 'thrown in async')
  })
})
