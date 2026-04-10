import type { TTask, TTasks } from '@TSA/types'

import { isObj } from '@keg-hub/jsutils/isObj'
import { isArr } from '@keg-hub/jsutils/isArr'
import { noOpArr } from '@keg-hub/jsutils/noOpArr'
import { taskError } from '@TSA/utils/tasks/error'

const getTaskRef = (tasks: TTasks, task: string) => {
  const found = Object.entries(tasks).find(
    ([key, definition]: [string, TTask]) =>
      key === task ||
      definition.name === task ||
      (isArr(definition.alias) && definition.alias.includes(task))
  )

  return found?.[1]
}

const findTaskFromOptions = (task: TTask, options: string[]) => {
  const opt = options.shift()
  const subTasks = isObj(task) && task.tasks
  const subTask = opt && subTasks && getTaskRef(subTasks, opt)

  return !subTask
    ? { task: task, options: opt ? [opt, ...options] : options }
    : findTaskFromOptions(subTask, options)
}

export const find = (
  tasks: TTasks,
  opts: string[] = noOpArr,
  throwError = true
): TTask => {
  const options = [...opts]
  const taskName = options.shift()
  const task = getTaskRef(tasks, taskName)
  const foundTask = task && findTaskFromOptions(task, options)

  return foundTask
    ? { ...foundTask, tasks }
    : taskError(`Task not found for argument: ${taskName}`)
}
