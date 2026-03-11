import { tasks } from '@TRL/tasks'
import { find } from '@TRL/utils/tasks/find'
import { argsParse } from '@keg-hub/args-parse'
import { hasArg } from '@TRL/utils/tasks/hasArg'
import { Version } from '@TRL/constants/version'
import { AuthManager } from '@TRL/services/auth'
import { loadConfig } from '@TRL/utils/tasks/config'
import { addDefaults } from '@TRL/utils/tasks/addDefaults'

export const main = async (): Promise<any> => {
  const argv = process.argv.slice(2)

  if (hasArg(argv, `version`, [`v`])) return process.stdout.write(`tsa v${Version}\n`)

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

  // Apply insecure mode from stored credentials, --insecure flag, or local dev proxy
  const storedCreds = auth.creds()
  const isLocalProxy = storedCreds?.proxyUrl?.includes(`local.threadedstack.app`)
  if (storedCreds?.insecure || isLocalProxy || hasArg(argv, `insecure`, [`ins`]))
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

  await task.action?.({
    task,
    auth,
    tasks,
    config,
    params,
    options,
  })
}
