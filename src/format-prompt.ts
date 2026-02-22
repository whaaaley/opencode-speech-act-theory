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
  const { task, counter } = options
  const label = String(counter.value) + '. ' + task.intent
  counter.value++

  const metaLines: Array<string> = []

  if (task.targets.length > 0) {
    metaLines.push('> Targets: ' + task.targets.join(', '))
  }

  if (task.constraints.length > 0) {
    metaLines.push('> Constraints: ' + task.constraints.join(', '))
  }

  if (task.context) {
    metaLines.push('> Context: ' + task.context)
  }

  const children = task.subtasks.map((subtask) => {
    return buildNode({ task: subtask, counter })
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
  const { node, prefix, childPrefix } = options
  const hasChildren = node.children.length > 0
  const firstLine = prefix + node.label
  const lines: Array<string> = [firstLine]

  const numEnd = node.label.indexOf('. ') + 2
  const textStart = prefix.length + numEnd
  const pipe = hasChildren ? '│' : ' '
  const padLen = textStart - childPrefix.length - 1
  const metaPad = childPrefix + pipe + ' '.repeat(padLen > 0 ? padLen : 0)

  for (const meta of node.metaLines) {
    lines.push(metaPad + meta)
  }

  if (hasChildren) {
    lines.push(childPrefix + '│')

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      if (!child) continue

      if (i > 0) {
        lines.push(childPrefix + '│')
      }

      const isLast = i === node.children.length - 1
      const childHasChildren = child.children.length > 0
      const connector = (isLast ? '└──' : '├──') + (childHasChildren ? '┬ ' : ' ')
      const continuation = (isLast ? '   ' : '│  ')

      const childLines = renderNode({
        node: child,
        prefix: childPrefix + connector,
        childPrefix: childPrefix + continuation,
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

  const root: TreeNode = {
    label: flat[0]?.label ?? '',
    metaLines: flat[0]?.metaLines ?? [],
    children: flat.slice(1),
  }

  const rootPrefix = root.children.length > 0 ? '┬ ' : ''
  return renderNode({ node: root, prefix: rootPrefix, childPrefix: '' }).join('\n')
}
