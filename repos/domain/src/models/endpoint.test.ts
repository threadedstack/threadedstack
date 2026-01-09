import { describe, it, expect } from 'vitest'
import { Endpoint } from './endpoint'

describe('Endpoint Model', () => {
  describe('constructor', () => {
    it('should create an endpoint with required fields', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.id).toBe(endpointData.id)
      expect(endpoint.repoId).toBe(endpointData.repoId)
      expect(endpoint.createdAt).toBe(endpointData.createdAt)
      expect(endpoint.updatedAt).toBe(endpointData.updatedAt)
    })

    it('should create an endpoint with all optional fields', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyUrl: 'https://api.example.com/v1/users',
        proxyMethod: 'POST',
        proxyHeaders: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        proxyOptions: {
          timeout: 5000,
          retry: 3,
        },
        public: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.id).toBe(endpointData.id)
      expect(endpoint.repoId).toBe(endpointData.repoId)
      expect(endpoint.proxyUrl).toBe(endpointData.proxyUrl)
      expect(endpoint.proxyMethod).toBe(endpointData.proxyMethod)
      expect(endpoint.proxyHeaders).toEqual(endpointData.proxyHeaders)
      expect(endpoint.proxyOptions).toEqual(endpointData.proxyOptions)
      expect(endpoint.public).toBe(true)
      expect(endpoint.createdAt).toBe(endpointData.createdAt)
      expect(endpoint.updatedAt).toBe(endpointData.updatedAt)
    })

    it('should use default values when optional fields are not provided', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyMethod).toBe('GET')
      expect(endpoint.public).toBe(false)
      expect(endpoint.proxyUrl).toBeUndefined()
      expect(endpoint.proxyHeaders).toBeUndefined()
      expect(endpoint.proxyOptions).toBeUndefined()
    })

    it('should override default proxyMethod when provided', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyMethod: 'PUT',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyMethod).toBe('PUT')
    })

    it('should override default public flag when provided', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        public: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.public).toBe(true)
    })

    it('should handle complex proxyHeaders object', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyHeaders: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
          'X-Custom-Header': 'custom-value',
          'X-Request-ID': '12345',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyHeaders).toEqual(endpointData.proxyHeaders)
      expect(Object.keys(endpoint.proxyHeaders || {})).toHaveLength(4)
    })

    it('should handle complex proxyOptions object', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyOptions: {
          timeout: 10000,
          retry: 5,
          retryDelay: 1000,
          followRedirects: true,
          maxRedirects: 5,
          validateStatus: (status: number) => status < 500,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyOptions).toEqual(endpointData.proxyOptions)
      expect(endpoint.proxyOptions?.timeout).toBe(10000)
      expect(endpoint.proxyOptions?.retry).toBe(5)
    })

    it('should handle Date objects for timestamps', () => {
      const now = new Date()
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: now,
        updatedAt: now,
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.createdAt).toBe(now)
      expect(endpoint.updatedAt).toBe(now)
    })

    it('should handle partial data with only repoId', () => {
      const endpointData = {
        repoId: '456e4567-e89b-12d3-a456-426614174001',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.repoId).toBe(endpointData.repoId)
      expect(endpoint.proxyMethod).toBe('GET')
      expect(endpoint.public).toBe(false)
    })

    it('should support different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

      methods.forEach((method) => {
        const endpointData = {
          id: `123e4567-e89b-12d3-a456-42661417400${methods.indexOf(method)}`,
          repoId: '456e4567-e89b-12d3-a456-426614174001',
          proxyMethod: method,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }

        const endpoint = new Endpoint(endpointData)
        expect(endpoint.proxyMethod).toBe(method)
      })
    })
  })

  describe('inheritance from Base', () => {
    it('should inherit Base properties', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint).toHaveProperty('id')
      expect(endpoint).toHaveProperty('createdAt')
      expect(endpoint).toHaveProperty('updatedAt')
    })
  })

  describe('type safety', () => {
    it('should handle empty proxyHeaders object', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyHeaders: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyHeaders).toEqual({})
      expect(Object.keys(endpoint.proxyHeaders || {})).toHaveLength(0)
    })

    it('should handle empty proxyOptions object', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyOptions: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyOptions).toEqual({})
      expect(Object.keys(endpoint.proxyOptions || {})).toHaveLength(0)
    })

    it('should preserve null values if provided', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyUrl: null as any,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyUrl).toBeNull()
    })
  })

  describe('real-world scenarios', () => {
    it('should create a REST API endpoint proxy configuration', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyUrl: 'https://api.github.com/repos/{owner}/{repo}',
        proxyMethod: 'GET',
        proxyHeaders: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Threaded-Stack-Proxy',
        },
        proxyOptions: {
          timeout: 30000,
          cache: true,
          cacheTTL: 300,
        },
        public: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.proxyUrl).toContain('github.com')
      expect(endpoint.proxyHeaders?.Accept).toContain('github')
      expect(endpoint.public).toBe(true)
    })

    it('should create a private API endpoint with authentication', () => {
      const endpointData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        repoId: '456e4567-e89b-12d3-a456-426614174001',
        proxyUrl: 'https://internal-api.example.com/v1/data',
        proxyMethod: 'POST',
        proxyHeaders: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ${SECRET_TOKEN}',
        },
        public: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.public).toBe(false)
      expect(endpoint.proxyHeaders?.Authorization).toContain('Bearer')
    })
  })
})
