import type { ParsedPrompt, ParsedTask } from './prompt-schema.ts'

type Counter = { value: number }

type TreeNode = {
  label: string
  metaLines: Array<string>
  children: Array<TreeNode>
}

type BuildNodeOptions = {
  task: ParsedTask
  counter: Counter
}

const buildNode = (options: BuildNodeOptions): TreeNode => {
  const label = String(options.counter.value) + '. ' + options.task.intent
  options.counter.value++

  const metaLines: Array<string> = []

  if (options.task.targets.length > 0) {
    metaLines.push('> Targets: ' + options.task.targets.join(', '))
  }

  if (options.task.constraints.length > 0) {
    metaLines.push('> Constraints: ' + options.task.constraints.join(', '))
  }

  if (options.task.context) {
    metaLines.push('> Context: ' + options.task.context)
  }

  const children = options.task.subtasks.map((subtask) => {
    return buildNode({ task: subtask, counter: options.counter })
  })

  return { label, metaLines, children }
}

const flatten = (nodes: Array<TreeNode>): Array<TreeNode> => {
  const result: Array<TreeNode> = []

  for (const node of nodes) {
    result.push({ label: node.label, metaLines: node.metaLines, children: [] })

    for (const child of node.children) {
      result.push(child)
    }
  }

  return result
}

type RenderOptions = {
  node: TreeNode
  prefix: string
  childPrefix: string
}

const renderNode = (options: RenderOptions): Array<string> => {
  const hasChildren = options.node.children.length > 0
  const firstLine = options.prefix + options.node.label
  const lines: Array<string> = [firstLine]

  const numEnd = options.node.label.indexOf('. ') + 2
  const textStart = options.prefix.length + numEnd
  const pipe = hasChildren ? '│' : ' '
  const padLen = textStart - options.childPrefix.length - 1
  const metaPad = options.childPrefix + pipe + ' '.repeat(padLen > 0 ? padLen : 0)

  for (const meta of options.node.metaLines) {
    lines.push(metaPad + meta)
  }

  if (hasChildren) {
    lines.push(options.childPrefix + '│')

    for (let i = 0; i < options.node.children.length; i++) {
      const child = options.node.children[i]
      if (!child) continue

      if (i > 0) {
        lines.push(options.childPrefix + '│')
      }

      const isLast = i === options.node.children.length - 1
      const childHasChildren = child.children.length > 0

      let connector = isLast ? '└──' : '├──'
      connector += childHasChildren ? '┬ ' : '─ '

      let continuation = ''
      if (isLast && childHasChildren) {
        continuation = '   '
      } else if (isLast) {
        continuation = '    '
      } else if (childHasChildren) {
        continuation = '│  '
      } else {
        continuation = '│   '
      }

      const childLines = renderNode({
        node: child,
        prefix: options.childPrefix + connector,
        childPrefix: options.childPrefix + continuation,
      })

      lines.push(...childLines)
    }
  }

  return lines
}

export const formatPrompt = (parsed: ParsedPrompt): string => {
  if (parsed.tasks.length === 0) {
    return ''
  }

  const counter: Counter = { value: 1 }
  const nodes = parsed.tasks.map((task) => buildNode({ task, counter }))
  const totalNodes = counter.value - 1

  if (totalNodes === 1 && nodes[0]) {
    const node = nodes[0]
    const lines: Array<string> = [node.label]

    for (const meta of node.metaLines) {
      lines.push('  ' + meta)
    }

    return lines.join('\n')
  }

  const flat = flatten(nodes)
  const first = flat[0]

  if (!first) {
    return ''
  }

  const root: TreeNode = {
    label: first.label,
    metaLines: first.metaLines,
    children: flat.slice(1),
  }

  const rootPrefix = root.children.length > 0 ? '┌ ' : ''
  return renderNode({ node: root, prefix: rootPrefix, childPrefix: '' }).join('\n')
}
