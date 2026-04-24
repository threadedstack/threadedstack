import type { TTask, TTasks } from '@TSCL/types'

const globalOptionNames = [`--env`, `--environment`, `--help`, `-h`]

const findTask = (tasks: TTasks, name: string): [string, TTask] | undefined =>
  Object.entries(tasks).find(
    ([key, task]) => key === name || task.name === name || task.alias?.includes(name)
  )

const collectTaskNames = (tasks: TTasks): string[] => Object.keys(tasks)

const collectOptionNames = (task: TTask): string[] => {
  if (!task.options) return []
  return Object.entries(task.options).flatMap(([key, opt]) => [
    `--${key}`,
    ...(opt.alias?.map((a) => `-${a}`) || []),
  ])
}

/**
 * Generates tab-completion candidates for the given command line state
 * Parses the line up to the cursor, walks the task tree, and returns
 * matching task names/aliases or option names depending on context
 */
export const getCompletions = (line: string, point: number, tasks: TTasks): string[] => {
  const partial = line.slice(0, point)
  const parts = partial.trim().split(/\s+/)

  // Remove the command name (tdsk) from the front
  parts.shift()

  // When cursor is after a space, all parts are preceding context
  // and there is no current partial word yet
  const current = partial.endsWith(` `) ? `` : parts[parts.length - 1] || ``
  const preceding = partial.endsWith(` `) ? parts : parts.slice(0, -1)

  // Walk the task tree using preceding non-flag args
  let taskMap = tasks
  let task: TTask | null = null

  for (const arg of preceding) {
    if (arg.startsWith(`-`)) continue
    const found = findTask(taskMap, arg)
    if (!found) break
    task = found[1]
    taskMap = found[1].tasks || {}
  }

  // Return options when typing a flag, task names otherwise
  // Shell handles prefix filtering (bash compgen / zsh compadd)
  if (current.startsWith(`-`)) {
    const opts = task ? collectOptionNames(task) : []
    return [...opts, ...globalOptionNames]
  }

  return collectTaskNames(taskMap)
}

/**
 * Entry point called from cli.ts when TDSK_COMP_LINE is set
 * Prints one completion candidate per line and exits
 */
export const handleCompletion = (tasks: TTasks): never => {
  const line = process.env.TDSK_COMP_LINE || ``
  const point = Number.parseInt(process.env.TDSK_COMP_POINT || `0`, 10)

  const completions = getCompletions(line, point, tasks)
  process.stdout.write(completions.join(`\n`))
  process.exit(0)
}
