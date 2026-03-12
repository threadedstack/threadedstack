import type { Message } from '@tdsk/domain'

import { useState, useCallback } from 'react'
import { branchThread } from '@TAF/actions/threads/api/branchThread'
import { updateMessage } from '@TAF/actions/messages/api/updateMessage'
import { deleteMessage } from '@TAF/actions/messages/api/deleteMessage'

export type TUseMessageActionsOpts = {
  orgId: string
  agentId: string
  threadId: string
  onBranchSuccess?: (newThreadId: string) => void
}

export const useMessageActions = (opts: TUseMessageActionsOpts) => {
  const { orgId, agentId, threadId, onBranchSuccess } = opts

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  const extractText = useCallback((content: any): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((block: any) => {
          if (typeof block === 'string') return block
          if (block.type === 'text') return block.text || ''
          if (block.type === 'tool_use') return `[Tool: ${block.name}]`
          if (block.type === 'tool_result') return block.content || '[Tool Result]'
          return JSON.stringify(block)
        })
        .join('\n')
    }
    if (content && typeof content === 'object') {
      if (content.text) return content.text
      return JSON.stringify(content, null, 2)
    }
    return String(content ?? '')
  }, [])

  const onEditStart = useCallback(
    (message: Message) => {
      setEditingId(message.id)
      setEditContent(extractText(message.content))
    },
    [extractText]
  )

  const onEditCancel = useCallback(() => {
    setEditingId(null)
    setEditContent('')
  }, [])

  const onEditSave = useCallback(
    async (message: Message) => {
      if (!orgId || !agentId || !threadId) return

      const result = await updateMessage({
        orgId,
        agentId,
        threadId,
        messageId: message.id,
        data: { content: editContent },
      })

      if (result.error) {
        setError(result.error.message || 'Failed to update message')
      } else {
        setSuccess('Message updated')
        setTimeout(() => setSuccess(null), 2000)
      }

      setEditingId(null)
      setEditContent('')
    },
    [orgId, agentId, threadId, editContent]
  )

  const onDeleteClick = useCallback((message: Message) => {
    setSelectedMessage(message)
    setDeleteDialogOpen(true)
  }, [])

  const onDeleteConfirm = useCallback(async () => {
    if (!selectedMessage || !orgId || !agentId || !threadId) return

    const result = await deleteMessage({
      orgId,
      agentId,
      threadId,
      messageId: selectedMessage.id,
    })

    if (result.error) {
      setError(result.error.message || 'Failed to delete message')
    } else {
      setSuccess('Message deleted')
      setTimeout(() => setSuccess(null), 2000)
    }

    setDeleteDialogOpen(false)
    setSelectedMessage(null)
  }, [selectedMessage, orgId, agentId, threadId])

  const onDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false)
    setSelectedMessage(null)
  }, [])

  const onBranchClick = useCallback((message: Message) => {
    setSelectedMessage(message)
    setBranchDialogOpen(true)
  }, [])

  const onBranchConfirm = useCallback(async () => {
    if (!selectedMessage || !orgId || !agentId || !threadId) return

    const result = await branchThread({
      orgId,
      agentId,
      threadId,
      messageId: selectedMessage.id,
      contextKey: 'org',
    })

    if (result.error) {
      setError(result.error.message || 'Failed to branch thread')
    } else {
      setSuccess('Thread branched successfully')
      setTimeout(() => setSuccess(null), 2000)
      if (result.data?.id) {
        onBranchSuccess?.(result.data.id)
      }
    }

    setBranchDialogOpen(false)
    setSelectedMessage(null)
  }, [selectedMessage, orgId, agentId, threadId, onBranchSuccess])

  const onBranchCancel = useCallback(() => {
    setBranchDialogOpen(false)
    setSelectedMessage(null)
  }, [])

  return {
    error,
    setError,
    success,
    editingId,
    editContent,
    setEditContent,
    selectedMessage,
    deleteDialogOpen,
    branchDialogOpen,
    extractText,
    onEditStart,
    onEditCancel,
    onEditSave,
    onDeleteClick,
    onDeleteConfirm,
    onDeleteCancel,
    onBranchClick,
    onBranchConfirm,
    onBranchCancel,
  }
}
