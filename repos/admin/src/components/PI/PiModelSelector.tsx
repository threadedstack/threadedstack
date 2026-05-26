import type { ModelSelector } from '@earendil-works/pi-web-ui'

import '@earendil-works/pi-web-ui/app.css'
import { Box } from '@mui/material'
import { useRef, useEffect, useCallback } from 'react'
import { getThemeBridgeStyles } from '@TAF/utils/piWebUiThemeBridge'

export type TPiModelSelector = {
  currentModel?: string
  onSelect?: (model: string) => void
}

/**
 * React wrapper around pi-web-ui's `agent-model-selector` web component.
 *
 * Uses a ref + useEffect to sync React props into the Lit element's
 * imperative properties. Wrapped in a container with CSS custom property
 * overrides to match our MUI dark theme.
 */
export const PiModelSelector = (props: TPiModelSelector) => {
  const { currentModel, onSelect } = props
  const selectorRef = useRef<ModelSelector | null>(null)

  // Sync currentModel property
  useEffect(() => {
    if (!selectorRef.current || !currentModel) return
    // The ModelSelector uses a Model<any> object; for now we set it
    // as a string attribute if the web component supports it,
    // or consumers can access the ref directly for richer model objects.
    const el = selectorRef.current as unknown as HTMLElement
    el.setAttribute(`data-current-model`, currentModel)
  }, [currentModel])

  // Wire up selection callback
  const handleSelect = useCallback(
    (model: string) => {
      onSelect?.(model)
    },
    [onSelect]
  )

  // Listen for the custom element's selection event
  useEffect(() => {
    const el = selectorRef.current as unknown as HTMLElement
    if (!el) return

    const listener = (evt: Event) => {
      const detail = (evt as CustomEvent).detail
      const modelId =
        typeof detail === `string` ? detail : (detail?.id ?? detail?.name ?? ``)
      handleSelect(modelId)
    }

    el.addEventListener(`model-select`, listener)
    return () => el.removeEventListener(`model-select`, listener)
  }, [handleSelect])

  const themeBridgeStyles = getThemeBridgeStyles()

  return (
    <Box
      className='dark pi-model-selector-wrapper'
      style={themeBridgeStyles}
      sx={{
        display: `inline-flex`,
        alignItems: `center`,
      }}
    >
      <agent-model-selector
        ref={(el: HTMLElement | null) => {
          selectorRef.current = el as ModelSelector | null
        }}
      />
    </Box>
  )
}
