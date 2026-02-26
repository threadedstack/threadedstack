import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Endpoint } from '@tdsk/domain'
import { fetchEndpoints } from './fetchEndpoints'

const mockSetProjectEndpoints = vi.fn()
const mockEndpointsList = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setProjectEndpoints: (...args: any[]) => mockSetProjectEndpoints(...args),
}))

vi.mock('@TAF/services', () => ({
  endpointsApi: {
    list: (...args: any[]) => mockEndpointsList(...args),
  },
}))

describe('fetchEndpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should replace state for projectId with fresh data from API', async () => {
    const mockEndpoints = [
      new Endpoint({ id: 'ep-1', name: 'Endpoint 1', type: 'proxy' }),
      new Endpoint({ id: 'ep-2', name: 'Endpoint 2', type: 'proxy' }),
    ]

    mockEndpointsList.mockResolvedValueOnce({ data: mockEndpoints })

    await fetchEndpoints({ orgId: 'org-1', projectId: 'proj-1' })

    expect(mockEndpointsList).toHaveBeenCalledWith('org-1', 'proj-1')
    expect(mockSetProjectEndpoints).toHaveBeenCalledWith('proj-1', {
      'ep-1': mockEndpoints[0],
      'ep-2': mockEndpoints[1],
    })
  })

  it('should not include stale data in the state map', async () => {
    const mockEndpoints = [
      new Endpoint({ id: 'ep-new', name: 'New Endpoint', type: 'proxy' }),
    ]

    mockEndpointsList.mockResolvedValueOnce({ data: mockEndpoints })

    await fetchEndpoints({ orgId: 'org-1', projectId: 'proj-1' })

    const [, setMap] = mockSetProjectEndpoints.mock.calls[0]
    expect(setMap).toHaveProperty('ep-new')
    expect(setMap).not.toHaveProperty('ep-old')
    expect(Object.keys(setMap)).toHaveLength(1)
  })

  it('should handle API errors without updating state', async () => {
    mockEndpointsList.mockResolvedValueOnce({
      error: new Error('Failed to fetch'),
    })

    const result = await fetchEndpoints({ orgId: 'org-1', projectId: 'proj-1' })

    expect(result.error).toBeDefined()
    expect(mockSetProjectEndpoints).not.toHaveBeenCalled()
  })
})
