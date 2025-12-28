import type {
  TTask,
  TTasks,
} from '@TSCL/types'

import { isObj } from '@keg-hub/jsutils/isObj'
import { isArr } from '@keg-hub/jsutils/isArr'
import { noOpArr } from '@keg-hub/jsutils/noOpArr'
import { taskError } from '@TSCL/utils/tasks/error'


/**
 * Maps task alias to a task name, relative to the options
 * @function
 * @private
 * @param {Object} tasks - Task Definitions
 * @param {string} task - Name of the task to search for an alias
 *
 * @example
 * getTaskRef(tasks, taskName)
 *
 * @returns {Object} - Found task object
 */
const getTaskRef = (tasks:TTasks, task:string) => {
  const found = Object.entries(tasks)
    .find(([key, definition]:[string, TTask]) => (
      key === task
        || definition.name === task
        || (isArr(definition.alias) && definition.alias.includes(task))
    ))

  return found ? found[1] : undefined
}

/**
 * Loops over the options looking for a matching name to the passed in task
 * @function
 * @private
 * @param {Object} task - Custom Task Definition
 * @param {Array} options - Task options that can be shared across tasks
 *
 * @example
 * findTask({...task definition}, [...options])
 *
 * @returns {Object} - Found task definition by name
 */
const findTaskFromOptions = (task:TTask, options:string[]) => {
  const opt = options.shift()
  const subTasks = isObj(task) && task.tasks
  const subTask = opt && subTasks && getTaskRef(subTasks, opt)

  return !subTask
    ? { task: task, options: opt ? [ opt, ...options ] : options }
    : findTaskFromOptions(subTask, options)
}

/**
 * Finds the correct task definition relative to the options
 * @function
 * @export
 * @param {Object} tasks - Custom Task Definitions
 * @param {Array} options - Task options that can be shared across tasks
 * @param {Boolean} [throwError=true] - If true, will throw when a task can not be found
 * throwError
 *
 * @example
 * findTask({...task definitions}, [...options])
 *
 * @returns {void}
 */
export const find = (
  tasks:TTasks,
  opts:string[]=noOpArr,
  throwError=true
) => {
  const options = [...opts]
  const taskName = options.shift()
  const task = getTaskRef(tasks, taskName)
  const foundTask = task && findTaskFromOptions(task, options)

  return foundTask && foundTask.task
    ? {...foundTask, tasks}
    : taskError(`Task not found for argument: ${taskName}`)
}

