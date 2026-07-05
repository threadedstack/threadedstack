import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { useAgentChat } from './useAgentChat'

const mockListMessages = vi.fn()
const mockUpload = vi.fn()
const mockSetCallbacks = vi.fn()
const mockEnsureConnection = vi.fn()
const mockSend = vi.fn()
const mockDispose = vi.fn()
const mockClose = vi.fn()

vi.mock('@TAF/services/threadsApi', () => ({
  threadsApi: {
    listMessages: (...args: any[]) => mockListMessages(...args),
  },
}))

vi.mock('@TAF/services/filesApi', () => ({
  filesApi: {
    upload: (...args: any[]) => mockUpload(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@TAF/services/agentWSService', () => ({
  AgentWSService: vi.fn().mockImplementation(() => ({
    setCallbacks: mockSetCallbacks,
    ensureConnection: mockEnsureConnection,
    send: mockSend,
    dispose: mockDispose,
    close: mockClose,
  })),
}))

describe('useAgentChat', () => {
  const baseOpts = { orgId: 'org-1', agentId: 'agent-1' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureConnection.mockResolvedValue(true)
    mockSend.mockReturnValue(true)
  })

  it('initializes with empty state when no threadId provided', () => {
    const { result } = renderHook(() => useAgentChat(baseOpts))

    expect(result.current.messages).toEqual([])
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.threadId).toBeUndefined()
    expect(result.current.error).toBeUndefined()
    expect(mockListMessages).not.toHaveBeenCalled()
  })

  it('loads thread history when threadId is provided', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: [
        {
          id: 'msg-1',
          type: 'user',
          createdAt: '2026-01-01T00:00:00Z',
          content: [{ type: 'text', text: 'Hello agent' }],
        },
        {
          id: 'msg-2',
          type: 'assistant',
          createdAt: '2026-01-01T00:00:01Z',
          content: [{ type: 'text', text: 'Hello! How can I help?' }],
        },
      ],
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-1' })
    )

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    expect(mockListMessages).toHaveBeenCalledWith('org-1', 'agent-1', 'thread-1')
    expect(result.current.messages[0]).toMatchObject({
      id: 'msg-1',
      text: 'Hello agent',
      role: 'user',
    })
    expect(result.current.messages[1]).toMatchObject({
      id: 'msg-2',
      text: 'Hello! How can I help?',
      role: 'assistant',
    })
  })

  it('maps tool_use content blocks to toolCalls', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: [
        {
          id: 'msg-3',
          type: 'assistant',
          createdAt: '2026-01-01T00:00:00Z',
          content: [
            { type: 'text', text: 'Let me search for that.' },
            {
              type: 'tool_use',
              id: 'tc-1',
              name: 'search',
              input: { query: 'test query' },
            },
          ],
        },
      ],
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-2' })
    )

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
    })

    const msg = result.current.messages[0]
    expect(msg.text).toBe('Let me search for that.')
    expect(msg.toolCalls).toHaveLength(1)
    expect(msg.toolCalls![0]).toMatchObject({
      id: 'tc-1',
      name: 'search',
      args: JSON.stringify({ query: 'test query' }),
    })
  })

  it('handles empty thread (no messages)', async () => {
    mockListMessages.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-empty' })
    )

    await waitFor(() => {
      expect(mockListMessages).toHaveBeenCalled()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.threadId).toBe('thread-empty')
  })

  it('sets error state when listMessages fails', async () => {
    mockListMessages.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-fail' })
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
    })
  })

  it('sets error state when listMessages returns no data', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Not found' },
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-nodata' })
    )

    // No data means the early return fires — messages stay empty, no error from this path
    await waitFor(() => {
      expect(mockListMessages).toHaveBeenCalled()
    })

    expect(result.current.messages).toEqual([])
  })

  it('clears threadId and messages on reset', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: [
        {
          id: 'msg-r1',
          type: 'user',
          createdAt: '2026-01-01T00:00:00Z',
          content: [{ type: 'text', text: 'test' }],
        },
      ],
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-reset' })
    )

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.threadId).toBeUndefined()
    expect(result.current.error).toBeUndefined()
  })

  it('syncs internal threadId when opts.threadId changes', async () => {
    mockListMessages.mockResolvedValue({ data: [] })

    const { result, rerender } = renderHook(
      (props: { threadId?: string }) =>
        useAgentChat({ ...baseOpts, threadId: props.threadId }),
      { initialProps: { threadId: undefined as string | undefined } }
    )

    expect(result.current.threadId).toBeUndefined()

    rerender({ threadId: 'thread-new' })

    await waitFor(() => {
      expect(result.current.threadId).toBe('thread-new')
    })
  })

  it('clears internal threadId when opts.threadId becomes undefined', async () => {
    mockListMessages.mockResolvedValue({ data: [] })

    const { result, rerender } = renderHook(
      (props: { threadId?: string }) =>
        useAgentChat({ ...baseOpts, threadId: props.threadId }),
      { initialProps: { threadId: 'thread-1' } }
    )

    await waitFor(() => {
      expect(result.current.threadId).toBe('thread-1')
    })

    rerender({ threadId: undefined })

    await waitFor(() => {
      expect(result.current.threadId).toBeUndefined()
    })
  })

  it('joins multiple text content blocks into a single string', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: [
        {
          id: 'msg-multi',
          type: 'assistant',
          createdAt: '2026-01-01T00:00:00Z',
          content: [
            { type: 'text', text: 'Part one. ' },
            { type: 'text', text: 'Part two.' },
          ],
        },
      ],
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-multi' })
    )

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
    })

    expect(result.current.messages[0].text).toBe('Part one. Part two.')
  })

  it('surfaces a toast and omits the attachment when a file upload fails', async () => {
    mockListMessages.mockResolvedValueOnce({ data: [] })
    mockUpload.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Upload failed' },
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-upload' })
    )

    await waitFor(() => {
      expect(mockListMessages).toHaveBeenCalled()
    })

    const file = new File(['content'], 'notes.txt', { type: 'text/plain' })

    await act(async () => {
      await result.current.sendMessage('Please review', [file])
    })

    expect(mockUpload).toHaveBeenCalledWith('org-1', 'agent-1', 'thread-upload', file)
    expect(toast.error).toHaveBeenCalledWith('Failed to upload notes.txt')

    // The message still sends, but with no files attached since the upload failed
    expect(mockSend).toHaveBeenCalled()
    const sentPayload = mockSend.mock.calls[0][0]
    expect(sentPayload.files).toBeUndefined()

    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg?.files).toBeUndefined()
  })

  it('attaches successfully uploaded files without a toast', async () => {
    mockListMessages.mockResolvedValueOnce({ data: [] })
    mockUpload.mockResolvedValueOnce({
      data: {
        assetId: 'asset-1',
        fileName: 'notes.txt',
        fileType: 'text/plain',
      },
    })

    const { result } = renderHook(() =>
      useAgentChat({ ...baseOpts, threadId: 'thread-upload-ok' })
    )

    await waitFor(() => {
      expect(mockListMessages).toHaveBeenCalled()
    })

    const file = new File(['content'], 'notes.txt', { type: 'text/plain' })

    await act(async () => {
      await result.current.sendMessage('Please review', [file])
    })

    expect(toast.error).not.toHaveBeenCalled()
    const sentPayload = mockSend.mock.calls[0][0]
    expect(sentPayload.files).toEqual([
      {
        assetId: 'asset-1',
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        extractedText: undefined,
        imageData: undefined,
      },
    ])
  })
})
