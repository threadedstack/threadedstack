import type { TSpawn } from '@TSCL/utils/proc/spawn'
import type { TTaskActionArgs, TTaskParams } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { spawn } from '@TSCL/utils/proc/spawn'
import { taskError } from '@TSCL/utils/tasks/error'
import { emptyArr } from '@keg-hub/jsutils/emptyArr'
import { parseJSON } from '@keg-hub/jsutils/parseJSON'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

type TCallback<T = number> = (
  props?: TTaskActionArgs,
  args?: string | string[]
) => Promise<T>

type TPodDelete<T = number> = (props: TTaskActionArgs, args: string[]) => Promise<T>
type TKubeDelete<T = number> = TCallback<T> & {
  pod: TPodDelete<T>
}

export type TKubeCtl = {
  (
    cmd: string | string[],
    params: TTaskParams,
    validExitCode?: string | number[]
  ): Promise<number>
  create: TCallback<string>
  delete: TKubeDelete<string>
  describe: TCallback<string>
  useContext: TCallback<string>
  describePod: TCallback<string>
  getContexts: TCallback<string[]>
  ensureContext: TCallback<string>
  currentContext: TCallback<string>
  getPod: TCallback<Record<any, any>>
  getPods: TCallback<Record<any, any>>
}

/**
 * Wrapper method to resolve the args passed to the kube methods
 */
const resolveArgs = <T>(callback: TCallback<T>) => {
  return async (props: TTaskActionArgs, args: string | string[] | TTaskParams) => {
    const argsArr = Array.isArray(args)
    const argsStr = typeof args === `string`

    const kArgs = argsArr ? args : argsStr ? args.split(` `) : emptyArr

    return await callback(props, kArgs)
  }
}

export const kubectl = async (opts: Omit<TSpawn, `cmd`>) =>
  await spawn({ cmd: `kubectl`, ...opts })

const kubectlPipe = <T>(
  params: Record<string, any>,
  args: string[],
  initial: T,
  transform: (data: string) => T
): Promise<T> => {
  return new Promise((res, rej) => {
    let output = initial
    let resolved = false
    kubectl({
      ...params,
      stdio: `pipe`,
      output: params?.output ?? true,
      args,
      stderr: Logger.stderr,
      stdout: (data: string) => {
        output = transform(data)
      },
      close: () => {
        if (resolved) return
        resolved = true
        res(output)
      },
      error: (err) => {
        if (resolved) return
        resolved = true
        rej(err)
      },
      exit: () => {
        if (resolved) return
        resolved = true
        res(output)
      },
    }).catch((err) => {
      if (resolved) return
      resolved = true
      rej(err)
    })
  })
}

/**
 * Creates a kubernetes object from the passed in args
 */
kubectl.create = resolveArgs(async (props: TTaskActionArgs, args: string | string[]) => {
  await kubectl.ensureContext(props, args)
  return await kubectl({ ...props.params, args: [`create`, ...args] })
})

kubectl.delete = resolveArgs(async (props: TTaskActionArgs, args: string | string[]) => {
  await kubectl.ensureContext(props, args)
  return await kubectl({ ...props.params, args: [`delete`, ...args] })
}) as TKubeDelete

kubectl.delete.pod = resolveArgs(
  async (props: TTaskActionArgs, args: string | string[]) => {
    await kubectl.ensureContext(props, args)
    return await kubectl.delete(props, [`pod`, ...args])
  }
)

/**
 * Creates a kubernetes object from the passed in args
 */
kubectl.apply = resolveArgs(async (props: TTaskActionArgs, args: string | string[]) => {
  await kubectl.ensureContext(props, args)
  return await kubectl({ ...props.params, args: [`apply`, ...args] })
})

/**
 * Gets the current kube-context
 */
kubectl.currentContext = resolveArgs<string>(async (props: TTaskActionArgs) => {
  return kubectlPipe(props.params, [`config`, `current-context`], ``, (data) =>
    data.trim()
  )
})

/**
 * Gets all available contexts
 */
kubectl.getContexts = resolveArgs<string[]>(async (props: TTaskActionArgs) => {
  return kubectlPipe(
    props.params,
    [`config`, `get-contexts`, `-o`, `name`],
    [] as string[],
    (data) => data.split(`\n`).map((ctx) => ctx.trim())
  )
})

/**
 * Uses the current kube-context to the passed in value
 */
kubectl.useContext = resolveArgs<string>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    await kubectl({
      ...props.params,
      output: true,
      args: [`config`, `use-context`, ...args],
    })

    return await kubectl.currentContext(props, args)
  }
)

/**
 * Sets the current kube-context to the passed in value
 */
kubectl.setContext = resolveArgs<string>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    await kubectl({
      ...props.params,
      output: true,
      args: [`config`, `set-context`, ...args],
    })

    return await kubectl.currentContext(props, args)
  }
)

/**
 * Sets the current kube-context to the passed in value
 */
kubectl.ensureContext = resolveArgs<string>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    const { log } = props.params
    const meta = getKubeMeta(props, true)

    const curContext = await kubectl.currentContext(
      { ...props, params: { ...props.params, output: false } },
      args
    )

    const switchContexts = meta.context && curContext.trim() !== meta.context.trim()

    if (log)
      !switchContexts
        ? Logger.pair(`Using context:`, curContext)
        : Logger.log(
            `Switching kube-context`,
            Logger.colors.yellow(curContext),
            `to`,
            Logger.colors.green(meta.context)
          )

    return switchContexts ? await kubectl.useContext(props, [meta.context]) : curContext
  }
)

/**
 * Gets the details for all pods as a JSON object
 */
kubectl.getPods = resolveArgs<Record<any, any>>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    await kubectl.ensureContext(props, args)
    return kubectlPipe(
      props.params,
      [`get`, `pods`, `-o`, `json`, ...args],
      {} as Record<any, any>,
      (data) => parseJSON(data, false)
    )
  }
)

/**
 * Gets the details for a single pod as a JSON object
 */
kubectl.getPod = resolveArgs<Record<any, any>>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    // Context is used differently here, so we extract it for the call to getPods
    const { context, ...altParams } = props.params
    !context && taskError(`The context param is required to find a pod`)

    const { items } = await kubectl.getPods({ ...props, params: altParams }, args)

    return items?.find((item: Record<any, any>) =>
      Object.values(item?.metadata?.labels)
        .map((val) => (val as string).toLowerCase().trim())
        .includes(context.toLowerCase().trim())
    )
  }
)

/**
 * Describes a kubernetes resource
 */
kubectl.describe = resolveArgs<string>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    await kubectl.ensureContext(props, args)
    return kubectlPipe(props.params, [`describe`, ...args], ``, (data) => data.trim())
  }
)

/**
 * Describes a kubernetes pod
 */
kubectl.describePod = resolveArgs<string>(
  async (props: TTaskActionArgs, args: string | string[]) => {
    await kubectl.ensureContext(props, args)
    return await kubectl.describe(props, [`pod`, ...args])
  }
)
