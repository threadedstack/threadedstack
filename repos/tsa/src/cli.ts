import { tasks } from '@TSA/tasks'
import { find } from '@TSA/utils/tasks/find'
import { argsParse } from '@keg-hub/args-parse'
import { hasArg } from '@TSA/utils/tasks/hasArg'
import { Version } from '@TSA/constants/version'
import { AuthManager } from '@TSA/services/auth'
import { loadConfig } from '@TSA/utils/tasks/config'
import { isLocalUrl } from '@TSA/utils/api/isLocalUrl'
import { addDefaults } from '@TSA/utils/tasks/addDefaults'

export const cli = async (): Promise<any> => {
  const argv = process.argv.slice(2)

  if (hasArg(argv, `version`, [`v`])) return process.stdout.write(`tsa v${Version}\n`)

  const args =
    !argv.length || (argv[0].startsWith(`--`) && argv[0] !== `--help`)
      ? [`sandbox`, ...argv]
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

  const isLocalProxy = isLocalUrl(storedCreds?.proxyUrl)
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
