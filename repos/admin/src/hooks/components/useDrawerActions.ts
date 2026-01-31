import type { TButton } from '@tdsk/components'
import { useMemo } from 'react'

export type THDrawerActions = {
  onSave?: (evt: any) => any
  onClose?: (evt: any) => any
  onRemove?: (evt: any) => any
}

export const useDrawerActions = (props: THDrawerActions) => {
  const { onSave, onClose, onRemove } = props

  const actions: Record<string, Partial<TButton>> = useMemo(() => {
    return {
      remove: {
        onClick: onRemove,
      },
      cancel: {
        onClick: onClose,
      },
      save: {
        onClick: onSave,
      },
    }
  }, [onSave, onClose, onRemove])

  return {
    actions,
  }
}
