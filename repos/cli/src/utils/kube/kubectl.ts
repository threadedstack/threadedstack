import type { TSpawn } from '@TSCL/utils/proc/spawn'
import type { TTaskActionArgs, TTaskParams } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { spawn } from '@TSCL/utils/proc/spawn'
import { taskError } from '@TSCL/utils/tasks/error'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { parseJSON } from '@keg-hub/jsutils/parseJSON'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

type TCallback<T=number> = (
  props?:TTaskActionArgs,
  args?:string|string[],
) => Promise<T>

type TPodDelete<T=number> = (props:TTaskActionArgs, args:string[]) => Promise<T>
type TKubeDelete<T=number> = TCallback<T> & {
  pod: TPodDelete<T>
}

export type TKubeCtl = {
  (cmd:string|string[], params:TTaskParams, validExitCode?:string|number[]): Promise<number>
  create:TCallback<string>
  delete:TKubeDelete<string>
  useContext:TCallback<string>
  getContexts:TCallback<string[]>
  ensureContext:TCallback<string>
  currentContext:TCallback<string>
  getPod:TCallback<Record<any, any>>
  getPods:TCallback<Record<any, any>>
}


/**
 * Wrapper method to resolve the args passed to the kube methods
 */
const resolveArgs = <T>(callback:TCallback<T>) => {
  return async (
    props:TTaskActionArgs,
    args:string|string[]|TTaskParams,
  ) => {
    const argsArr = Array.isArray(args)
    const argsStr = typeof args === `string`
    
    const kArgs = argsArr ? args : argsStr ? args.split(` `) : emptyArr

    return await callback(props, kArgs)
  }
}



export const kubectl = async (opts:Omit<TSpawn, `cmd`>) => await spawn({cmd: `kubectl`, ...opts})


/**
 * Creates a kubernetes object from the passed in args 
 */
kubectl.create = resolveArgs(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  await kubectl.ensureContext(props, args)
  return await kubectl({...props.params, args: [`create`, ...args]})
})


kubectl.delete = resolveArgs(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  await kubectl.ensureContext(props, args)
  return await kubectl({...props.params, args: [`delete`, ...args]})
}) as TKubeDelete


kubectl.delete.pod = (async (
  props:TTaskActionArgs,
  args:string[],
) => await kubectl.delete(props, [`pod`, ...args]))

/**
 * Creates a kubernetes object from the passed in args 
 */
kubectl.apply = resolveArgs(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  await kubectl.ensureContext(props, args)
  return await kubectl({...props.params, args:[`apply`, ...args]})
})

/**
 * Gets the current kube-context
 */
kubectl.currentContext = resolveArgs<string>(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  return new Promise(async (res, rej) => {
    let output = ``
    let resolved = false

    await kubectl({
      ...props.params,
      stdio: `pipe`,
      output: props.params?.output ?? true,
      args: [`config`, `current-context`],
      stderr:Logger.stderr,
      stdout: (data:string) => {
        output = data.trim()
      },
      close: () => {
        if(resolved) return
        resolved = true
        res(output)
      },
      error: (err) => {
        resolved = true
        rej(err)
      },
      exit: () => {
        if(resolved) return
        resolved = true
        res(output)
      }
    })
  })
  
})

/**
 * Gets all available contexts
 */
kubectl.getContexts = resolveArgs<string[]>(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  return new Promise(async (res, rej) => {
    let outputs = []
    let resolved = false
    await kubectl({
      ...props.params,
      stdio: `pipe`,
      output: props.params?.output ?? true,
      args: [`config`, `get-contexts`, `-o`, `name`],
      stderr:Logger.stderr,
      stdout: (data:string) => {
        outputs = data.split(`\n`).map(ctx => ctx.trim())
      },
      close: () => {
        if(resolved) return
        resolved = true
        res(outputs)
      },
      error: (err) => {
        resolved = true
        rej(err)
      },
      exit: () => {
        if(resolved) return
        resolved = true
        res(outputs)
      }
    })
  })
})

/**
 * Sets the current kube-context to the passed in value
 */
kubectl.useContext = resolveArgs<string>(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  await kubectl({
    ...props.params,
    output: true,
    args:[`config`, `use-context`, ...args],
  })

  return await kubectl.currentContext(props, args)
})


/**
 * Sets the current kube-context to the passed in value
 */
kubectl.ensureContext = resolveArgs<string>(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  const { log } = props.params
  const meta = getKubeMeta(props, true)

  const curContext = await kubectl.currentContext(
    {...props, params: {...props.params, output: false}},
    args
  )

  const switchContexts = meta.context && curContext.trim() !== meta.context.trim()

  if(log)
    !switchContexts
      ? Logger.pair(`Using context:`, curContext)
      : Logger.log(
          `Switching kube-context`,
          Logger.colors.yellow(curContext),
          `to`,
          Logger.colors.green(meta.context)
        )

  return switchContexts
    ? await kubectl.useContext(props, [meta.context])
    : curContext
})



/**
 * Gets the details for all pods as a JSON object
 */
kubectl.getPods = resolveArgs<Record<any, any>>(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {
  await kubectl.ensureContext(props, args)
  
  return new Promise(async (res, rej) => {
    let output:Record<any, any> = {}
    let resolved = false
    
    await kubectl({
      ...props.params,
      stdio: `pipe`,
      output: props.params?.output ?? true,
      args: [`get`, `pods`, `-o`, `json`, ...args],
      stderr:Logger.stderr,
      stdout: (data:string) => {
        output = parseJSON(data, false)
      },
      close: () => {
        if(resolved) return
        resolved = true
        res(output)
      },
      error: (err) => {
        resolved = true
        rej(err)
      },
      exit: () => {
        if(resolved) return
        resolved = true
        res(output)
      }
    })
  })
})

/**
 * Gets the details for a single pod as a JSON object
 */
kubectl.getPod = resolveArgs<Record<any, any>>(async (
  props:TTaskActionArgs,
  args:string|string[],
) => {

  // Context is used differently here, so we extract it for the call to getPods
  const { context, ...altParams } = props.params
  !context && taskError(`The context param is required to find a pod`)

  const { items } = await kubectl.getPods({...props, params: altParams}, args)

  return items?.find((item:Record<any, any>) =>
    Object.values(item?.metadata?.labels)
      .map((val) => (val as string).toLowerCase().trim())
      .includes(context.toLowerCase().trim())
  )
})
