import type { TKubeMeta, TTaskActionArgs } from '@TSCL/types'
import { taskError } from '@TSCL/utils/tasks/error'


export const getKubeMeta = (
  props:TTaskActionArgs,
  throwErr:boolean=true
) => {
  const {
    config,
    params
  } = props
  
  const kubeContext = params?.kubeContext || config.envs.TDSK_KUBE_CONTEXT
  const namespace = params?.namespace || config.envs.TDSK_KUBE_NAMESPACE

  throwErr
    && !namespace
    && !kubeContext
    && taskError(`The "TDSK_KUBE_CONTEXT" and "TDSK_KUBE_NAMESPACE" envs are required to run devspace commands`)

  
  const arrayCtx:TKubeMeta = [`--namespace`, namespace, `--kube-context`, kubeContext]

  // Allows accessing the namespace and context in either an array or object
  arrayCtx.namespace = namespace
  arrayCtx.context = kubeContext

  return arrayCtx
}