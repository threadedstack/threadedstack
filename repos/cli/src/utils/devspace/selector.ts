import type { TTaskActionArgs } from '@TSCL/types'
import { ETSApps } from '@TSCL/types'

export type TSelectorCmd = TTaskActionArgs & {}

export const selector = (props: TSelectorCmd) => {
  const { params } = props

  const mapped = params.context.flatMap((ctx: keyof typeof ETSApps) => {
    const app = ETSApps[ctx]
    return app ? [`--label-selector`, `app.kubernetes.io/component=tdsk-${app}`] : []
  })

  return [...mapped, ...(params?.args || [])]
}
