import 'overlayscrollbars/overlayscrollbars.css'
import type { OverlayScrollbarsComponentProps } from "overlayscrollbars-react"

import { OverlayScrollbars } from "overlayscrollbars"
import { overlayScrollOpts } from '@TSC/utils/overlayScrollOpts'


export const overlayScrollBody = (options:OverlayScrollbarsComponentProps["options"]={}) => {
  OverlayScrollbars(document.body, {...overlayScrollOpts, ...options})
}