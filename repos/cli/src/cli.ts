import { tasks } from '@TSCL/tasks'
import { ife } from '@keg-hub/jsutils/ife'
import { find } from '@TSCL/utils/tasks/find'
import { argsParse } from '@keg-hub/args-parse'
import { taskError } from '@TSCL/utils/tasks/error'

const loadCfg = async (environment: string) => {
  // Ensure the NODE_ENV is set based on the parsed options
  // This way the correct ENVs are loaded when we import the cli.config file
  if (!process.env.NODE_ENV && environment) process.env.NODE_ENV = environment

  try {
    const mod = await import('@TSCL/configs/cli.config.ts')
    return mod.config
  } catch (err) {
    taskError(err as Error)
  }
}

ife(async () => {
  const args = process.argv.slice(2) as string[]
  const { task, options } = find(tasks, args)

  !task.action && taskError(`Task ${task.name} does not have an action to preform`)

  const params = await argsParse(
    { args: options, task: { options: task?.options || [] } },
    {
      defaultArgs: {
        env: {
          default: `local`,
          alias: [`environment`],
          example: `<command> --env staging`,
          description: `Environment where the task should be executed`,
        },
      },
    }
  )

  const config = await loadCfg(params.env)

  await task.action({
    task,
    tasks,
    params,
    config,
    options,
  })
})
