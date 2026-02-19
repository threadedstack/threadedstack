import { tasks } from '@TRL/tasks'
import { AuthManager } from '@TRL/auth'
import { Version } from '@TRL/constants'
import { find } from '@TRL/utils/tasks/find'
import { argsParse } from '@keg-hub/args-parse'
import { loadConfig } from '@TRL/utils/tasks/config'
import { addDefaults } from '@TRL/utils/tasks/addDefaults'

export const main = async (): Promise<any> => {
  const argv = process.argv.slice(2)

  if (argv[0] === `--version` || argv[0] === `-v`)
    return process.stdout.write(`tdsk-agent v${Version}\n`)

  // Default to 'chat' when no args or first arg is a value flag
  // --help is a task alias, not a value flag
  const args =
    !argv.length || (argv[0].startsWith(`--`) && argv[0] !== `--help`)
      ? [`chat`, ...argv]
      : argv

  const { task, options } = find(tasks, args)

  // Load config before argsParse so defaults are applied during parsing
  const config = loadConfig()

  const params = await argsParse({
    args: options,
    task: { options: addDefaults(task, config) },
  })
  const auth = new AuthManager()

  // Apply insecure mode from stored credentials
  const storedCreds = auth.getCredentials()
  if (storedCreds?.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

  await task.action?.({
    task,
    auth,
    tasks,
    config,
    params,
    options,
  })
}
