import type { TMonEditorRef, THMonaco, TAccordionAction } from '@TSC/types'

import { toast } from 'sonner'
import { useMemo } from 'react'
import { gutter } from '@TSC/theme/gutter'
import { EEditorActionKey } from '@TSC/types'
import { stopEvent } from '@TSC/utils/helpers'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import { useCopyToClipboard } from '@TSC/hooks/dom/useCopyToClipboard'

const wrapActions = (
  actions: TAccordionAction[],
  editorRef?: TMonEditorRef,
  id?: string
) => {
  return actions?.map((action) => {
    const { onClick, onChange, ...rest } = action
    return {
      ...rest,
      onClick: onClick ? (evt: any) => onClick(evt, editorRef, id) : undefined,
      onChange: onChange ? (evt: any) => onChange(evt, editorRef, id) : undefined,
    }
  })
}

const useCopyToClip = (props: THMonaco) => {
  const { hideCopy, editorRef } = props

  const { onCopyToClipBoard } = useCopyToClipboard()

  return useMemo(() => {
    return (
      !hideCopy &&
      ({
        Icon: <ContentPasteIcon sx={{ height: gutter.px, width: gutter.px }} />,
        tooltip: `Copy to clipboard`,
        key: EEditorActionKey.copyToClip,
        onClick: async (evt: any) => {
          stopEvent(evt)
          const value = editorRef.current?.getValue()
          if (!value) return toast.error(`Error`, { description: `Editor not found.` })

          onCopyToClipBoard(value)
          toast.success(`Success`, { description: `Copied to clipboard.` })
        },
      } as TAccordionAction)
    )
  }, [hideCopy])
}

const useClearText = (props: THMonaco) => {
  const { onChange, hideClear } = props

  return useMemo(() => {
    return (
      !hideClear &&
      ({
        tooltip: `Clear Text`,
        Icon: <RestartAltIcon sx={{ height: gutter.px, width: gutter.px }} />,
        key: EEditorActionKey.clearText,
        onClick: async (evt: any) => {
          stopEvent(evt)
          onChange(``, evt)
        },
      } as TAccordionAction)
    )
  }, [hideClear, onChange])
}

export const useMonacoActions = (props: THMonaco) => {
  const { id, actionsBefore, editorRef } = props
  const clearText = useClearText(props)
  const copyToClip = useCopyToClip(props)

  const actions = useMemo(() => {
    const external = props?.actions?.length
      ? wrapActions(props?.actions, editorRef, id)
      : []

    return [
      ...(actionsBefore ? external : []),
      copyToClip,
      clearText,
      ...(!actionsBefore ? external : []),
    ].filter(Boolean) as TAccordionAction[]
  }, [id, clearText, copyToClip, props?.actions])

  return {
    actions,
  }
}
