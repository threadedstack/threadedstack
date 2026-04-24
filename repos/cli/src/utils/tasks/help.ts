import type { TTask, TTasks, TTaskOption, TTaskOptions } from '@TSCL/types'

const helpFlags = [`--help`, `-h`]

export const hasHelp = (args: string[]) => args.some((a) => helpFlags.includes(a))

export const buildCmdPath = (args: string[], tasks: TTasks): string[] => {
  const path = [`tdsk`]
  let current = tasks

  for (const arg of args) {
    if (arg.startsWith(`-`)) continue

    const found = Object.entries(current).find(
      ([key, task]) =>
        key === arg || task.name === arg || (task.alias && task.alias.includes(arg))
    )

    if (!found) break

    path.push(found[1].name)
    current = found[1].tasks || {}
  }

  return path
}

const formatTaskName = (key: string, task: TTask): string => {
  const names = [key]
  if (task.alias?.length) {
    for (const a of task.alias) {
      if (!names.includes(a)) names.push(a)
    }
  }
  return names.join(`, `)
}

const formatOptionName = (key: string, opt: TTaskOption): string => {
  const names = [`--${key}`]
  if (opt.alias?.length) names.push(...opt.alias.map((a) => `-${a}`))
  return names.join(`, `)
}

const formatMetaTags = (opt: TTaskOption): string => {
  const tags: string[] = []

  if (opt.required) tags.push(`required`)

  const t = opt.type
  if (t === `boolean` || t === `bool`) tags.push(`boolean`)
  else if (t === `array` || t === `arr`) tags.push(`array`)
  else if (t === `number` || t === `num`) tags.push(`number`)
  else if (t === `object` || t === `obj`) tags.push(`object`)

  if (opt.default !== undefined) {
    const val = Array.isArray(opt.default) ? opt.default.join(`,`) : String(opt.default)
    tags.push(`default: ${val}`)
  }

  return tags.map((t) => `[${t}]`).join(` `)
}

const formatOptions = (options: TTaskOptions): string[] => {
  const entries = Object.entries(options)
  if (!entries.length) return []

  const rows = entries.map(([key, opt]) => ({
    name: formatOptionName(key, opt),
    desc: opt.description || ``,
    meta: formatMetaTags(opt),
  }))

  const maxName = Math.max(...rows.map((r) => r.name.length))
  const pad = maxName + 4

  return rows.map((r) => {
    const left = `  ${r.name.padEnd(pad)}`
    const parts = [left, r.desc]
    if (r.meta) parts.push(` ${r.meta}`)
    return parts.join(``)
  })
}

const formatCommands = (tasks: TTasks, indent = 0): string[] => {
  const lines: string[] = []
  const prefix = `  `.repeat(indent + 1)
  const entries = Object.entries(tasks)

  const rows = entries.map(([key, task]) => ({
    key,
    task,
    name: formatTaskName(key, task),
    desc: task.description || ``,
  }))

  const maxName = Math.max(...rows.map((r) => r.name.length))
  const pad = maxName + 4

  for (const row of rows) {
    lines.push(`${prefix}${row.name.padEnd(pad)}${row.desc}`)

    if (row.task.tasks) {
      const subEntries = Object.entries(row.task.tasks)
      const subRows = subEntries.map(([k, t]) => ({
        name: formatTaskName(k, t),
        desc: t.description || ``,
      }))

      const subMax = Math.max(...subRows.map((r) => r.name.length))
      const subPad = subMax + 4
      const subPrefix = `  `.repeat(indent + 2)

      for (const sub of subRows) {
        lines.push(`${subPrefix}${sub.name.padEnd(subPad)}${sub.desc}`)
      }
    }
  }

  return lines
}

const globalOptions: TTaskOptions = {
  env: {
    default: `local`,
    alias: [`environment`],
    description: `Environment where the task should be executed`,
  },
  help: {
    type: `boolean`,
    alias: [`h`],
    description: `Show help information for a command`,
  },
}

export const printHelp = (
  task: TTask | null,
  tasks: TTasks,
  cmdPath: string[]
): never => {
  const lines: string[] = []
  const cmd = cmdPath.join(` `)

  if (!task) {
    lines.push(`${cmd} - ThreadedStack developer CLI`)
    lines.push(``)
    lines.push(`Usage: ${cmd} <command> [options]`)
    lines.push(``)
    lines.push(`Commands:`)
    lines.push(...formatCommands(tasks))
    lines.push(``)
    lines.push(`Global Options:`)
    lines.push(...formatOptions(globalOptions))
  } else {
    if (task.description) lines.push(`${cmd} - ${task.description}`)
    else lines.push(cmd)

    lines.push(``)

    const hasSubTasks = task.tasks && Object.keys(task.tasks).length > 0
    lines.push(`Usage: ${cmd} ${hasSubTasks ? `<command> ` : ``}[options]`)

    if (task.example) lines.push(`Example: ${task.example}`)

    if (hasSubTasks) {
      lines.push(``)
      lines.push(`Commands:`)
      lines.push(...formatCommands(task.tasks!))
    }

    if (task.options && Object.keys(task.options).length > 0) {
      lines.push(``)
      lines.push(`Options:`)
      lines.push(...formatOptions(task.options))
    }
  }

  console.log(lines.join(`\n`))
  process.exit(0)
}
