import type { ApiClient } from '@TSA/services/api'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const promptOrgSelection = async (
  orgs: { id: string; name: string }[]
): Promise<string> => {
  process.stdout.write(`\n${themed(`primary`, `Select an organization:`)}\n`)
  orgs.forEach((o, i) => {
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${o.name} ${themed(`muted`, `(${o.id})`)}\n`
    )
  })

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const onSigint = () => {
    rl.close()
    process.exit(130)
  }
  process.once(`SIGINT`, onSigint)
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`${themed(`muted`, `Enter number:`)} `, (answer) => {
        const idx = Number.parseInt(answer, 10) - 1
        if (idx >= 0 && idx < orgs.length) {
          process.removeListener(`SIGINT`, onSigint)
          rl.close()
          resolve(orgs[idx].id)
        } else {
          process.stdout.write(
            `  ${themed(`error`, `Invalid selection.`)} Enter a number between 1 and ${orgs.length}.\n`
          )
          ask()
        }
      })
    }
    ask()
  })
}

export const resolveOrgId = async (
  client: ApiClient,
  explicitOrgId?: string,
  configOrgId?: string
): Promise<string> => {
  if (explicitOrgId) return explicitOrgId

  const { data: orgs, error } = await client.listOrgs()
  if (error || !orgs) throw new Error(error?.message || `Failed to list organizations`)

  if (orgs.length === 0) throw new Error(`No organizations found`)

  if (orgs.length === 1) return orgs[0].id

  if (configOrgId && orgs.some((o) => o.id === configOrgId)) return configOrgId

  if (process.stdin.isTTY) return promptOrgSelection(orgs)

  throw new Error(`Multiple orgs found. Use --org <id> to specify.`)
}
