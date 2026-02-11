import { useState, useEffect, useMemo } from 'react'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { fetchMessages } from '@TAF/actions/messages/api/fetchMessages'
import { useActiveOrgId, useActiveProjectId, useMessages } from '@TAF/state/selectors'
import {
  Table,
  TableRow,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  TableContainer,
  Chip,
} from '@mui/material'

export type TMessagesTab = {}

export const MessagesTab = (props: TMessagesTab) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [messages] = useMessages()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    const loadData = async () => {
      if (!orgId || !projectId) return

      setLoading(true)
      setError(null)

      const result = await fetchMessages({ orgId, projectId })

      if (result.error) {
        setError(result.error.message)
      }

      setLoading(false)
    }

    loadData()
  }, [orgId, projectId])

  const projectMessages = useMemo(() => {
    if (!messages || !projectId) return []
    let filtered = Object.values(messages).filter(
      (message) => message.projectId === projectId
    )

    if (typeFilter !== 'all') {
      filtered = filtered.filter((message) => message.type === typeFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((message) => {
        const content = JSON.stringify(message.content)
        return (
          content?.toLowerCase().includes(query) ||
          message.id?.toLowerCase().includes(query)
        )
      })
    }

    return filtered.sort(
      (a, b) => ((b.createdAt || 0) as any) - ((a.createdAt || 0) as any)
    )
  }, [messages, projectId, searchQuery, typeFilter])

  const totalMessagesCount = useMemo(() => {
    if (!messages || !projectId) return 0
    return Object.values(messages).filter((message) => message.projectId === projectId)
      .length
  }, [messages, projectId])

  const getMsgTypeColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'primary'
      case 'assistant':
        return 'success'
      case 'tool':
        return 'warning'
      case 'system':
        return 'default'
      case 'action':
        return 'info'
      default:
        return 'default'
    }
  }

  const formatContent = (content: any) => {
    if (typeof content === 'string') {
      return content.length > 100 ? content.substring(0, 100) + '...' : content
    }
    return JSON.stringify(content).substring(0, 100) + '...'
  }

  return (
    <PageLayout
      title='Messages'
      loading={loading}
      error={error}
      setError={setError}
      searchCount={0}
      query={searchQuery}
      countLabel='message'
      count={totalMessagesCount}
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search messages...'
    >
      {totalMessagesCount === 0 && (
        <EmptyState message='No messages found for this project. Messages will appear here as AI conversations are created.' />
      )}

      {totalMessagesCount > 0 && projectMessages.length === 0 && (
        <EmptyState message='No messages match your search or filter criteria.' />
      )}

      {projectMessages.length > 0 && (
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Thread ID</TableCell>
                <TableCell>Content</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectMessages.map((message) => (
                <TableRow
                  key={message.id}
                  hover
                >
                  <TableCell>
                    <Chip
                      label={message.type}
                      size='small'
                      color={getMsgTypeColor(message.type) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {message.threadId?.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      sx={{
                        maxWidth: 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatContent(message.content)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2'>
                      {message.createdAt
                        ? new Date(message.createdAt).toLocaleString()
                        : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
