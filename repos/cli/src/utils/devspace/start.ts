import type { TTaskActionArgs } from '@TSCL/types'

export type TStartCmd = TTaskActionArgs & {
  
}

export const start = (props:TStartCmd) => {
  const {
    params
  } = props

  const args = [`dev`, ...(params?.args || [])]

  return args
}