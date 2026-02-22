import { glob, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { type Result, safe, safeAsync } from './safe.ts'

export type InstructionFile = {
  path: string
  content: string
  error?: string
}

type DiscoverResult = Result<InstructionFile[]>
type ConfigResult = Result<string[]>

const readConfig = async (directory: string): Promise<ConfigResult> => {
  const configPath = join(directory, 'opencode.json')
  const readResult = await safeAsync(() => readFile(configPath, 'utf-8'))
  if (readResult.error) {
    return {
      data: null,
      error: 'Could not read ' + configPath + ': ' + readResult.error.message,
    }
  }

  const parseResult = safe(() => JSON.parse(readResult.data))
  if (parseResult.error) {
    return {
      data: null,
      error: 'Invalid JSON in ' + configPath + ': ' + parseResult.error.message,
    }
  }

  const instructions = parseResult.data.instructions
  if (!Array.isArray(instructions) || instructions.length === 0) {
    return {
      data: null,
      error: 'No "instructions" array found in ' + configPath,
    }
  }

  const patterns = instructions.filter((entry: unknown) => typeof entry === 'string')
  if (patterns.length === 0) {
    return {
      data: null,
      error: 'No valid string patterns in "instructions" in ' + configPath,
    }
  }

  return {
    data: patterns,
    error: null,
  }
}

const matchPatterns = async (directory: string, patterns: string[]) => {
  const seen = new Set<string>()
  const files: string[] = []

  for (const pattern of patterns) {
    for await (const path of glob(pattern, { cwd: directory })) {
      const full = join(directory, path)
      if (!seen.has(full)) {
        seen.add(full)
        files.push(full)
      }
    }
  }

  return files
}

const readFiles = async (files: string[]) => {
  const results: InstructionFile[] = []

  for (const file of files) {
    const readResult = await safeAsync(() => readFile(file, 'utf-8'))
    if (readResult.error) {
      results.push({
        path: file,
        content: '',
        error: readResult.error.message,
      })
      continue
    }

    results.push({
      path: file,
      content: readResult.data,
    })
  }

  return results
}

// read specific file paths into InstructionFile entries, resolving relative paths against directory
export const readFilePaths = async (directory: string, paths: string[]): Promise<InstructionFile[]> => {
  const resolved = paths.map((p) => resolve(directory, p))
  return await readFiles(resolved)
}

export const discover = async (directory: string): Promise<DiscoverResult> => {
  const config = await readConfig(directory)
  if (config.error !== null) {
    return {
      data: null,
      error: config.error,
    }
  }

  const patterns = config.data
  const files = await matchPatterns(directory, patterns)
  if (files.length === 0) {
    return {
      data: null,
      error: 'No instruction files found matching patterns: ' + patterns.join(', '),
    }
  }

  return {
    data: await readFiles(files),
    error: null,
  }
}
