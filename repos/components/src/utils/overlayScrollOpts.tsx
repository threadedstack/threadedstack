import type { OverlayScrollbarsComponentProps } from "overlayscrollbars-react"

import { ClickScrollPlugin, OverlayScrollbars } from "overlayscrollbars"

OverlayScrollbars.plugin(ClickScrollPlugin)

export const overlayScrollOpts: OverlayScrollbarsComponentProps["options"] = {
  overflow: {
    x: `hidden`,
  },
  scrollbars: {
    autoHide: `move`,
    clickScroll: true,
  },
}
