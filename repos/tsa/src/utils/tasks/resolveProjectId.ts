import type { ApiClient } from '@TSA/services/api'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const promptProjectSelection = async (
  projects: { id: string; name: string }[]
): Promise<string> => {
  process.stdout.write(`\n${themed(`primary`, `Select a project:`)}\n`)
  projects.forEach((p, i) => {
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${p.name} ${themed(`muted`, `(${p.id})`)}\n`
    )
  })

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve, reject) => {
    rl.question(`${themed(`muted`, `Enter number:`)} `, (answer) => {
      rl.close()
      const idx = Number.parseInt(answer, 10) - 1
      if (idx >= 0 && idx < projects.length) resolve(projects[idx].id)
      else reject(new Error(`Invalid selection`))
    })
  })
}

/**
 * Resolves the project ID from an explicit parameter, auto-detect, or interactive selection.
 * Throws if no projects are found or multiple projects exist without an explicit param in non-TTY mode.
 */
export const resolveProjectId = async (
  client: ApiClient,
  orgId: string,
  explicitProjectId?: string
): Promise<string> => {
  if (explicitProjectId) return explicitProjectId

  const { data: projects, error } = await client.listProjects(orgId)
  if (error || !projects) throw new Error(error?.message || `Failed to list projects`)
  if (projects.length === 0) throw new Error(`No projects found in this organization`)
  if (projects.length === 1) return projects[0].id

  if (process.stdin.isTTY) return promptProjectSelection(projects)

  throw new Error(`Multiple projects found. Use --project <id> to specify.`)
}
