
import type { TTaskActionArgs } from '@TSCL/types'

export type TCleanCmd = TTaskActionArgs & {
  
}

export const clean = (props:TCleanCmd) => {
  const {
    params
  } = props

  const args = [`cleanup`, `images`, ...(params?.args || [])]

  return args
}
