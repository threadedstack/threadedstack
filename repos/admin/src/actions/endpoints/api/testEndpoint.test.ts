import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testEndpoint } from './testEndpoint'

const mockExecute = vi.fn()

vi.mock(`@TAF/services`, () => ({
  endpointTestApi: {
    execute: (...args: any[]) => mockExecute(...args),
  },
}))

describe(`testEndpoint`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should call endpointTestApi.execute with correct positional args`, async () => {
    mockExecute.mockResolvedValueOnce({
      data: {
        status: 200,
        statusText: `OK`,
        body: `{"ok":true}`,
        contentType: `application/json`,
        timing: 42,
      },
    })

    await testEndpoint({
      projectId: `proj-1`,
      endpointId: `ep-1`,
      method: `GET`,
      headers: { [`X-Custom`]: `value` },
    })

    expect(mockExecute).toHaveBeenCalledWith(`proj-1`, `ep-1`, {
      method: `GET`,
      headers: { [`X-Custom`]: `value` },
      body: undefined,
    })
  })

  it(`should return data on success`, async () => {
    const mockData = {
      status: 200,
      statusText: `OK`,
      body: `{"result":"success"}`,
      contentType: `application/json`,
      timing: 100,
    }

    mockExecute.mockResolvedValueOnce({ data: mockData })

    const result = await testEndpoint({
      projectId: `proj-2`,
      endpointId: `ep-2`,
      method: `POST`,
      body: `{"input":"test"}`,
    })

    expect(result.data).toEqual(mockData)
    expect(result.error).toBeUndefined()
  })

  it(`should return error on failure`, async () => {
    const mockError = new Error(`Network failure`)
    mockExecute.mockResolvedValueOnce({ error: mockError })

    const result = await testEndpoint({
      projectId: `proj-3`,
      endpointId: `ep-3`,
      method: `GET`,
    })

    expect(result.error).toBe(mockError)
    expect(result.data).toBeUndefined()
  })
})
