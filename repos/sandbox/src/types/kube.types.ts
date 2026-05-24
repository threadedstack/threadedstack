import type { V1Pod } from '@kubernetes/client-node'
import type { PassThrough } from 'stream'

/** Live K8s exec connection to a container. Call close() to tear down the underlying WebSocket. */
export type TExecStream = {
  stdin: PassThrough
  stdout: PassThrough
  stderr: PassThrough
  close: () => void
  /** Sends a resize control frame to the container PTY via the K8s exec WebSocket. No-op when TTY is false. */
  resize: (cols: number, rows: number) => void
}

export type TKubeEventHandlers = {
  added?: (pod: V1Pod) => void
  modified?: (pod: V1Pod) => void
  deleted?: (pod: V1Pod) => void
  bookmark?: (pod: V1Pod) => void
  error?: (err: any) => void
}

export type TKubeClientConfig = {
  namespace?: string
  inCluster?: boolean
}

export type TRunInPodOpts = {
  onStdout?: (chunk: Buffer) => void
  onStderr?: (chunk: Buffer) => void
}
