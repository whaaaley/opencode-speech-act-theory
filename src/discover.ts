import { glob, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { type Result, safe, safeAsync } from './utils/safe.ts'

export type InstructionFile = {
  path: string
  content: string
  error?: string
}

type DiscoverResult = Result<InstructionFile[]>
type ConfigResult = Result<string[]>

const readConfig = async (directory: string): Promise<ConfigResult> => {
  const configPath = join(directory, 'opencode.json')
  const { data, error } = await safeAsync(() => readFile(configPath, 'utf-8'))
  if (error) {
    return {
      data: null,
      error: 'Could not read ' + configPath + ': ' + error.message,
    }
  }

  const { data: parsed, error: parseError } = safe(() => JSON.parse(data))
  if (parseError) {
    return {
      data: null,
      error: 'Invalid JSON in ' + configPath + ': ' + parseError.message,
    }
  }

  const instructions = parsed.instructions
  if (!instructions || !Array.isArray(instructions) || instructions.length === 0) {
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

const resolveFiles = async (directory: string, patterns: string[]) => {
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
    const { data, error } = await safeAsync(() => readFile(file, 'utf-8'))
    if (error) {
      results.push({
        path: file,
        content: '',
        error: error.message,
      })
    } else {
      results.push({
        path: file,
        content: data,
      })
    }
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
  const files = await resolveFiles(directory, patterns)
  if (files.length === 0) {
    return {
      data: null,
      error: 'No instruction files found matching patterns: ' + patterns.join(', '),
    }
  }

  const results = await readFiles(files)

  return {
    data: results,
    error: null,
  }
}
