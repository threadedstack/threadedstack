import type { TTaskActionArgs } from '@TSCL/types'

export type TPurgeCmd = TTaskActionArgs & {}

export const purge = (props: TPurgeCmd) => {
  const { params } = props

  const args = [`purge`, ...(params?.args || [])]

  return args
}
