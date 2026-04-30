import type { ApiClient } from '@TSA/services/api'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const getAlias = (sandbox: any, projectId: string): string =>
  sandbox.projectConfigs?.find((pc: any) => pc.projectId === projectId)?.alias || ``

const promptSandboxSelection = async (
  sandboxes: any[],
  projectId: string
): Promise<string> => {
  const nameW = 20
  const aliasW = 20
  const runtimeW = 16

  process.stdout.write(`\n${themed(`primary`, `Select a sandbox:`)}\n`)
  sandboxes.forEach((sb, i) => {
    const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
    const alias = (getAlias(sb, projectId) || `-`).slice(0, aliasW).padEnd(aliasW)
    const runtime = (sb.config?.runtimeCommand || `-`).slice(0, runtimeW).padEnd(runtimeW)
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${name} ${themed(`success`, alias)} ${themed(`muted`, runtime)} ${themed(`muted`, sb.id)}\n`
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
        if (idx >= 0 && idx < sandboxes.length) {
          process.removeListener(`SIGINT`, onSigint)
          rl.close()
          resolve(sandboxes[idx].id)
        } else {
          process.stdout.write(
            `  ${themed(`error`, `Invalid selection.`)} Enter a number between 1 and ${sandboxes.length}.\n`
          )
          ask()
        }
      })
    }
    ask()
  })
}

export const resolveSandboxId = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  explicitSandboxId?: string,
  configSandboxId?: string
): Promise<string> => {
  if (explicitSandboxId && explicitSandboxId.startsWith(`sb_`)) return explicitSandboxId

  const { data: sandboxes, error } = await client.listSandboxes(orgId, projectId)
  if (error || !sandboxes) throw new Error(error?.message || `Failed to list sandboxes`)

  if (explicitSandboxId) {
    const byId = sandboxes.find((sb: any) => sb.id === explicitSandboxId)
    if (byId) return byId.id

    const byAlias = sandboxes.find(
      (sb: any) => getAlias(sb, projectId) === explicitSandboxId
    )
    if (byAlias) return byAlias.id

    throw new Error(`Sandbox not found: ${explicitSandboxId}`)
  }

  if (sandboxes.length === 0) throw new Error(`No sandboxes found in this project`)

  if (sandboxes.length === 1) {
    process.stdout.write(
      `${themed(`muted`, `Using sandbox:`)} ${sandboxes[0].name || sandboxes[0].id}\n`
    )
    return sandboxes[0].id
  }

  if (configSandboxId && sandboxes.some((sb: any) => sb.id === configSandboxId))
    return configSandboxId

  if (process.stdin.isTTY) return promptSandboxSelection(sandboxes, projectId)

  throw new Error(`Multiple sandboxes found. Use --sandbox <id> to specify.`)
}
