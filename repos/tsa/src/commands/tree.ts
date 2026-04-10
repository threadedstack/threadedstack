import type { TSlashCommand, TSlashCommandContext } from '@TSA/types'

type TTreeNode = {
  id: string
  name?: string
  branches?: TTreeNode[]
  branchMessageId?: string
}

/**
 * Recursively fetches thread tree starting from the given thread.
 * Branches at each level are fetched in parallel via Promise.all.
 */
const fetchTree = async (
  ctx: TSlashCommandContext,
  threadId: string
): Promise<TTreeNode> => {
  const thread = await ctx.getThreadWithBranches(threadId)
  const node: TTreeNode = { id: thread.id, name: thread.name }

  if (thread.branches?.length) {
    node.branches = await Promise.all(
      thread.branches.map(async (branch) => {
        const child = await fetchTree(ctx, branch.id)
        child.branchMessageId = branch.branchMessageId
        return child
      })
    )
  }

  return node
}

/**
 * Renders an ASCII tree from a TTreeNode
 */
const renderTree = (
  node: TTreeNode,
  prefix: string,
  isLast: boolean,
  isRoot: boolean,
  currentThreadId: string | null
): string[] => {
  const lines: string[] = []
  const label = node.name || node.id
  const marker = node.id === currentThreadId ? ` <--` : ``
  const branchInfo = node.branchMessageId ? ` (at msg ${node.branchMessageId})` : ``

  if (isRoot) {
    lines.push(`${label} [${node.id}]${marker}`)
  } else {
    const connector = isLast ? `└── ` : `├── `
    lines.push(`${prefix}${connector}${label} [${node.id}]${branchInfo}${marker}`)
  }

  const children = node.branches || []
  for (let i = 0; i < children.length; i++) {
    const childPrefix = isRoot ? `` : `${prefix}${isLast ? `    ` : `│   `}`
    const childLines = renderTree(
      children[i],
      childPrefix,
      i === children.length - 1,
      false,
      currentThreadId
    )
    lines.push(...childLines)
  }

  return lines
}

/**
 * Walks up parentThread links to find the root thread
 */
const findRoot = async (ctx: TSlashCommandContext, threadId: string): Promise<string> => {
  const maxDepth = 50
  let currentId = threadId
  for (let depth = 0; depth < maxDepth; depth++) {
    const thread = await ctx.getThreadWithBranches(currentId)
    const parentId = thread.parentThread?.id
    if (!parentId) return currentId
    currentId = parentId
  }
  ctx.output(`Warning: reached maximum depth (${maxDepth}) while finding root thread`)
  return currentId
}

export const treeCommand: TSlashCommand = {
  name: `tree`,
  aliases: [`tr`],
  description: `Display thread branch hierarchy as ASCII tree`,
  handler: async (_args, ctx) => {
    const threadId = ctx.threadId
    if (!threadId) {
      ctx.output(`No active thread. Send a message first to create one.`)
      return
    }

    try {
      const rootId = await findRoot(ctx, threadId)
      const tree = await fetchTree(ctx, rootId)
      const lines = renderTree(tree, ``, true, true, threadId)
      ctx.output(lines.join(`\n`))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      ctx.output(`Error building thread tree: ${msg}`)
    }
  },
}
