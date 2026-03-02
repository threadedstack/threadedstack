import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { API } from './api'
import { EAPIMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

const mockFetch = vi.fn()
global.fetch = mockFetch

global.FormData = class FormData {
  private data: Map<string, any> = new Map()

  set(key: string, value: any) {
    this.data.set(key, value)
  }

  get(key: string) {
    return this.data.get(key)
  }

  append(key: string, value: any) {
    this.data.set(key, value)
  }
} as any

describe(`API`, () => {
  let api: API
  const baseUrl = `https://api.example.com`
  const defaultHeaders = { [`Content-Type`]: `application/json` }

  beforeEach(() => {
    api = new API({
      url: baseUrl,
      headers: defaultHeaders,
    })
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe(`constructor`, () => {
    it(`should initialize API with base URL and headers`, () => {
      expect(api.baseUrl).toBe(baseUrl)
      expect(api.headers).toEqual(defaultHeaders)
    })

    it(`should handle initialization without headers`, () => {
      const apiNoHeaders = new API({ url: baseUrl })
      expect(apiNoHeaders.baseUrl).toBe(baseUrl)
      expect(apiNoHeaders.headers).toEqual({})
    })

    it(`should store additional options`, () => {
      const apiWithOpts = new API({
        url: baseUrl,
        // @ts-ignore
        timeout: 5000,
        headers: defaultHeaders,
      })
      expect(apiWithOpts.opts).toEqual({ timeout: 5000 })
    })
  })

  describe(`GET requests`, () => {
    it(`should make GET request successfully`, async () => {
      const responseData = { id: 1, name: `Test` }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      })

      const result = await api.get({ path: `/users` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          method: EAPIMethod.GET,
          headers: defaultHeaders,
        })
      )
      expect(result.data).toEqual(responseData)
      expect(result.error).toBeUndefined()
    })

    it(`should handle GET request with query parameters`, async () => {
      const responseData = { results: [] }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      })

      const result = await api.get({
        path: `/users`,
        data: { limit: 10, page: 1 },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users?limit=10&page=1`,
        expect.objectContaining({
          method: EAPIMethod.GET,
        })
      )
    })

    it(`should handle GET request with text response`, async () => {
      const responseText = `Plain text response`
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(responseText),
      })

      const result = await api.get({
        path: '/text',
        responseType: 'text',
      })

      expect(result.data).toBe(responseText)
    })
  })

  describe(`POST requests`, () => {
    it(`should make POST request with JSON data`, async () => {
      const requestData = { name: `New User` }
      const responseData = { id: 1, ...requestData }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(responseData),
      })

      const result = await api.post({
        path: `/users`,
        data: requestData,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          method: EAPIMethod.POST,
          body: JSON.stringify(requestData),
          headers: defaultHeaders,
        })
      )
      expect(result.data).toEqual(responseData)
    })

    it(`should make POST request with form data`, async () => {
      const requestData = { name: `New User`, file: `content` }
      const responseData = { success: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      })

      const result = await api.post({
        path: `/upload`,
        data: requestData,
        form: true,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/upload`,
        expect.objectContaining({
          method: EAPIMethod.POST,
          body: expect.any(FormData),
        })
      )
    })
  })

  describe(`PUT requests`, () => {
    it(`should make PUT request successfully`, async () => {
      const requestData = { name: `Updated User` }
      const responseData = { id: 1, ...requestData }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      })

      const result = await api.put({
        path: `/users/1`,
        data: requestData,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users/1`,
        expect.objectContaining({
          method: EAPIMethod.PUT,
          body: JSON.stringify(requestData),
        })
      )
      expect(result.data).toEqual(responseData)
    })
  })

  describe(`DELETE requests`, () => {
    it(`should make DELETE request successfully`, async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      })

      const result = await api.delete({ path: `/users/1` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users/1`,
        expect.objectContaining({
          method: EAPIMethod.DELETE,
        })
      )
    })
  })

  describe(`error handling`, () => {
    it(`should handle HTTP error responses`, async () => {
      const errorMessage = `User not found`
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: `Not Found`,
        json: () => Promise.resolve({ error: errorMessage }),
      })

      const result = await api.get({
        path: `/users/999`,
        error: `Failed to fetch user`,
      })

      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.status).toBe(404)
      expect(result.error?.message).toContain(`Failed to fetch user`)
      expect(result.data).toBeUndefined()
    })

    it(`should handle network errors`, async () => {
      const networkError = new Error(`Network error`)
      mockFetch.mockRejectedValueOnce(networkError)

      const result = await api.get({ path: `/users` })

      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.status).toBe(500)
      expect(result.error?.message).toBe(`Network error`)
    })

    it(`should handle JSON parse errors`, async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error(`Invalid JSON`)),
      })

      const result = await api.get({ path: `/users` })

      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.status).toBe(500)
    })
  })

  describe(`URL building`, () => {
    it(`should build URL with custom base URL`, () => {
      const customApi = new API({ url: `https://custom.api.com/` })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })

      customApi.get({ path: `/test` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://custom.api.com/test`,
        expect.any(Object)
      )
    })

    it(`should handle trailing slashes in URL building`, () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })

      api.get({ path: `/users/` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users/`,
        expect.any(Object)
      )
    })

    it(`should handle query parameters as string`, () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })

      api.get({
        path: `/users`,
        data: `limit=10&page=1`,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users?limit=10&page=1`,
        expect.any(Object)
      )
    })
  })

  describe(`headers handling`, () => {
    it(`should merge request headers with default headers`, async () => {
      const customHeaders = { [`X-Custom-Header`]: `custom-value` }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })

      await api.get({
        path: `/users`,
        headers: customHeaders,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          headers: { ...defaultHeaders, ...customHeaders },
        })
      )
    })

    it(`should allow request headers to override default headers`, async () => {
      const overrideHeaders = { [`Content-Type`]: `text/plain` }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })

      await api.post({
        path: `/users`,
        data: `text data`,
        headers: overrideHeaders,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          headers: { ...defaultHeaders, ...overrideHeaders },
        })
      )
    })
  })
})
