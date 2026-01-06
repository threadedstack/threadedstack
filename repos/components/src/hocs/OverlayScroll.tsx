import 'overlayscrollbars/overlayscrollbars.css'

import type { ReactNode } from 'react'
import type { OverlayScrollbarsComponentProps } from 'overlayscrollbars-react'

import { MemoChildren } from '@TSC/components/MemoChildren'
import { overlayScrollOpts } from '@TSC/utils/overlayScrollOpts'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

export type TOverlayScroll = OverlayScrollbarsComponentProps & {
  children: ReactNode
}

export const OverlayScroll = (props: TOverlayScroll) => {
  const { children, options = {}, ...rest } = props
  return (
    <OverlayScrollbarsComponent
      defer
      {...rest}
      options={{ ...overlayScrollOpts, ...options }}
    >
      <MemoChildren>
        {children}
      </MemoChildren>
    </OverlayScrollbarsComponent>
  )
}
