import type { Message } from '@tdsk/domain'
import { useActiveOrgId, useActiveProjectId, useMessages } from '@TAF/state/selectors'
import { fetchMessages } from '@TAF/actions/messages/api/fetchMessages'
import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  Alert,
  Table,
  TableRow,
  TextField,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  CardContent,
  InputAdornment,
  TableContainer,
  Chip,
} from '@mui/material'
import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material'
import { Loading } from '@tdsk/components'

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

    return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
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
    <Box>
      {loading && (
        <Loading
          fixed
          full
        />
      )}

      {error && (
        <Box
          component='alert'
          sx={{ mb: 3, color: 'error.main' }}
        >
          {error}
        </Box>
      )}

      {!loading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant='h6'>Messages</Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  {totalMessagesCount} message{totalMessagesCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </Box>

            {totalMessagesCount > 0 && (
              <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                <TextField
                  placeholder='Search messages...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size='small'
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position='start'>
                        <SearchIcon color='action' />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position='end'>
                        <IconButton
                          size='small'
                          onClick={() => setSearchQuery('')}
                          edge='end'
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            {totalMessagesCount === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>
                  No messages found for this project. Messages will appear here as AI
                  conversations are created.
                </Typography>
              </Box>
            )}

            {totalMessagesCount > 0 && projectMessages.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>
                  No messages match your search or filter criteria.
                </Typography>
              </Box>
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
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
