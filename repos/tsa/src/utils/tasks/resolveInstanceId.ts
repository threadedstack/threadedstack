import type { ApiClient } from '@TSA/services/api'
import type { TInstanceResolution } from '@TSA/types'
import type { TSandboxInstance } from '@tdsk/domain'

import { createInterface } from 'readline'
import { themed } from '@TSA/theme'

const matchBySuffix = (
  instances: TSandboxInstance[],
  suffix: string
): TSandboxInstance[] => {
  const exact = instances.find((i) => i.instanceId === suffix)
  if (exact) return [exact]

  return instances.filter((i) => i.instanceId.endsWith(suffix))
}

const promptInstanceSelection = async (
  instances: TSandboxInstance[]
): Promise<TInstanceResolution> => {
  const idW = 24
  const stateW = 12

  process.stdout.write(`\n${themed(`primary`, `Select an instance:`)}\n`)
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i]
    const id = inst.instanceId.slice(-20).padEnd(idW)
    const state = inst.state.padEnd(stateW)
    const count = inst.sessions.length
    const sess = `${count} session${count !== 1 ? `s` : ``}`
    process.stdout.write(
      `  ${themed(`muted`, `${i + 1}.`)} ${id} ${themed(`success`, state)} ${sess}\n`
    )
  }
  process.stdout.write(
    `  ${themed(`muted`, `${instances.length + 1}.`)} ${themed(`primary`, `Start new instance`)}\n`
  )

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
        if (idx >= 0 && idx < instances.length) {
          process.removeListener(`SIGINT`, onSigint)
          rl.close()
          resolve({ instanceId: instances[idx].instanceId })
        } else if (idx === instances.length) {
          process.removeListener(`SIGINT`, onSigint)
          rl.close()
          resolve({ newInstance: true })
        } else {
          process.stdout.write(
            `  ${themed(`error`, `Invalid selection.`)} Enter a number between 1 and ${instances.length + 1}.\n`
          )
          ask()
        }
      })
    }
    ask()
  })
}

export const resolveInstanceId = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sandboxId: string,
  opts?: { explicitInstance?: string; forceNew?: boolean }
): Promise<TInstanceResolution> => {
  if (opts?.forceNew) return { newInstance: true }

  const { data, error } = await client.listInstances(orgId, projectId, sandboxId)
  if (error) {
    if (opts?.explicitInstance)
      throw new Error(error.message || `Failed to list instances`)
    process.stderr.write(
      `${themed(`warning`, `Warning:`)} Could not list instances: ${error.message || `unknown error`}\n`
    )
    return {}
  }

  const instances = data?.instances ?? []

  if (opts?.explicitInstance) {
    const matches = matchBySuffix(instances, opts.explicitInstance)
    if (matches.length === 0)
      throw new Error(`No running instance matching "${opts.explicitInstance}"`)
    if (matches.length > 1)
      throw new Error(
        `Ambiguous instance suffix "${opts.explicitInstance}" — matches: ${matches.map((m) => m.instanceId).join(`, `)}`
      )
    return { instanceId: matches[0].instanceId }
  }

  if (instances.length === 0) return {}

  if (instances.length === 1) {
    process.stdout.write(
      `${themed(`muted`, `Using instance:`)} ${instances[0].instanceId.slice(-12)}\n`
    )
    return { instanceId: instances[0].instanceId }
  }

  if (process.stdin.isTTY) return promptInstanceSelection(instances)

  throw new Error(
    `Multiple instances running. Use --instance <id> to specify or --new to start a new one.`
  )
}
