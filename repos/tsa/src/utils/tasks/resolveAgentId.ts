import type { ApiClient } from '@TSA/services/api'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const promptAgentSelection = async (
  agents: { id: string; name: string; model?: string }[]
): Promise<string> => {
  process.stdout.write(`\n${themed(`primary`, `Select an agent:`)}\n`)
  agents.forEach((a, i) => {
    const model = a.model ? themed(`muted`, ` (${a.model})`) : ``
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${a.name}${model} ${themed(`muted`, `(${a.id})`)}\n`
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
        if (idx >= 0 && idx < agents.length) {
          process.removeListener(`SIGINT`, onSigint)
          rl.close()
          resolve(agents[idx].id)
        } else {
          process.stdout.write(
            `  ${themed(`error`, `Invalid selection.`)} Enter a number between 1 and ${agents.length}.\n`
          )
          ask()
        }
      })
    }
    ask()
  })
}

export const resolveAgentId = async (
  client: ApiClient,
  orgId: string,
  explicitAgentId?: string,
  configAgentId?: string
): Promise<string> => {
  if (explicitAgentId) return explicitAgentId

  const { data: agents, error } = await client.listAgents(orgId)
  if (error || !agents) throw new Error(error?.message || `Failed to list agents`)

  if (agents.length === 0) throw new Error(`No agents found in this organization`)

  if (agents.length === 1) {
    process.stdout.write(
      `${themed(`muted`, `Using agent:`)} ${agents[0].name || agents[0].id}\n`
    )
    return agents[0].id
  }

  if (configAgentId && agents.some((a) => a.id === configAgentId)) return configAgentId

  if (process.stdin.isTTY) return promptAgentSelection(agents)

  throw new Error(`Multiple agents found. Use --agent <id> to specify.`)
}
