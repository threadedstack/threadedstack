import type { TTaskActionArgs } from '@TSCL/types'
import { ETSApps } from '@TSCL/types'

export type TSelectorCmd = TTaskActionArgs & {}

export const selector = (props: TSelectorCmd) => {
  const { params } = props

  const { context } = params
  const mapped = context
    .map((ctx: keyof typeof ETSApps) => ETSApps[ctx])
    .filter(Boolean)
    .reduce((acc, ctx) => {
      acc.push(`--label-selector`, `app.kubernetes.io/component=tdsk-${ctx}`)
      return acc
    }, [] as string[])

  const args = [...mapped, ...(params?.args || [])]

  return args
}
