import { describe, it, expect } from 'vitest'
import { Endpoint, ProxyEndpoint } from './endpoint'

describe(`Endpoint Model`, () => {
  describe(`constructor`, () => {
    it(`should create an endpoint with required fields`, () => {
      const endpointData = {
        type: `proxy` as const,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.id).toBe(endpointData.id)
      expect(endpoint.projectId).toBe(endpointData.projectId)
      expect(endpoint.createdAt).toBe(endpointData.createdAt)
      expect(endpoint.updatedAt).toBe(endpointData.updatedAt)
    })

    it(`should create an endpoint with all optional fields`, () => {
      const endpointData = {
        public: true,
        method: `POST`,
        type: `proxy` as const,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        headers: {
          [`Content-Type`]: `projectlication/json`,
          Authorization: `Bearer token`,
        },
        options: {
          retry: 3,
          timeout: 5000,
          url: `https://api.example.com/v1/users`,
        },
      } as any

      const endpoint = new Endpoint(endpointData)

      expect(endpoint.id).toBe(endpointData.id)
      expect(endpoint.public).toBe(true)
      expect(endpoint.method).toBe(endpointData.method)
      expect(endpoint.headers).toEqual(endpointData.headers)
      expect(endpoint.options).toEqual(endpointData.options)
      expect(endpoint.projectId).toBe(endpointData.projectId)
      expect(endpoint.createdAt).toBe(endpointData.createdAt)
      expect(endpoint.updatedAt).toBe(endpointData.updatedAt)
    })

    it(`should use default values when optional fields are not provided`, () => {
      const endpointData = {
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.method).toBe(`GET`)
      expect(endpoint.public).toBe(false)
      expect(endpoint.headers).toBeUndefined()
      expect(endpoint.options).toBeUndefined()
    })

    it(`should override default method when provided`, () => {
      const endpointData = {
        method: `PUT`,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.method).toBe(`PUT`)
    })

    it(`should override default public flag when provided`, () => {
      const endpointData = {
        public: true,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.public).toBe(true)
    })

    it(`should handle complex headers object`, () => {
      const endpointData = {
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        headers: {
          [`Content-Type`]: `projectlication/json`,
          Authorization: `Bearer token`,
          [`X-Custom-Header`]: `custom-value`,
          [`X-Request-ID`]: `12345`,
        },
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.headers).toEqual(endpointData.headers)
      expect(Object.keys(endpoint.headers || {})).toHaveLength(4)
    })

    it(`should handle complex options object`, () => {
      const endpointData = {
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        options: {
          retry: 5,
          timeout: 10000,
          maxRedirects: 5,
          retryDelay: 1000,
          followRedirects: true,
          validateStatus: (status: number) => status < 500,
        },
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.options).toEqual(endpointData.options)
      expect(endpoint.options?.timeout).toBe(10000)
      expect((endpoint.options as any)?.retry as number).toBe(5)
    })

    it(`should handle Date objects for timestamps`, () => {
      const now = new Date()
      const endpointData = {
        createdAt: now,
        updatedAt: now,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.createdAt).toBe(now)
      expect(endpoint.updatedAt).toBe(now)
    })

    it(`should handle partial data with only projectId`, () => {
      const endpointData = {
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.projectId).toBe(endpointData.projectId)
      expect(endpoint.method).toBe(`GET`)
      expect(endpoint.public).toBe(false)
    })

    it(`should support different HTTP methods`, () => {
      const methods = [`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`]

      methods.forEach((method) => {
        const endpointData = {
          method: method,
          createdAt: `2024-01-01T00:00:00Z`,
          updatedAt: `2024-01-01T00:00:00Z`,
          id: `123e4567-e89b-12d3-a456-42661417400${methods.indexOf(method)}`,
          projectId: `456e4567-e89b-12d3-a456-426614174001`,
        }

        const endpoint = new Endpoint(endpointData as any)
        expect(endpoint.method).toBe(method)
      })
    })
  })

  describe(`inheritance from Base`, () => {
    it(`should inherit Base properties`, () => {
      const endpointData = {
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint).toHaveProperty(`id`)
      expect(endpoint).toHaveProperty(`createdAt`)
      expect(endpoint).toHaveProperty(`updatedAt`)
    })
  })

  describe(`type safety`, () => {
    it(`should handle empty headers object`, () => {
      const endpointData = {
        headers: {},
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.headers).toEqual({})
      expect(Object.keys(endpoint.headers || {})).toHaveLength(0)
    })

    it(`should handle empty options object`, () => {
      const endpointData = {
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        options: {},
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.options).toEqual({})
      expect(Object.keys(endpoint.options || {})).toHaveLength(0)
    })

    it(`should preserve null values if provided`, () => {
      const endpointData = {
        headers: null as any,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.headers).toBeNull()
    })
  })

  describe(`real-world scenarios`, () => {
    it(`should create a REST API endpoint proxy configuration`, () => {
      const endpointData = {
        method: `GET`,
        public: true,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        headers: {
          Accept: `projectlication/vnd.github.v3+json`,
          [`User-Agent`]: `Threaded-Stack-Proxy`,
        },
        options: {
          cache: true,
          cacheTTL: 300,
          timeout: 30000,
          url: `https://api.github.com/projects/{owner}/{project}`,
        },
      }

      const endpoint = new ProxyEndpoint(endpointData as any)

      expect(endpoint.public).toBe(true)
      expect(endpoint.options.url).toContain(`github.com`)
      expect(endpoint.headers?.Accept).toContain(`github`)
    })

    it(`should create a private API endpoint with authentication`, () => {
      const endpointData = {
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        method: `POST`,
        headers: {
          [`Content-Type`]: `projectlication/json`,
          Authorization: `Bearer 12334`,
        },
        options: {
          url: `https://internal-api.example.com/v1/data`,
        },
        public: false,
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new ProxyEndpoint(endpointData as any)

      expect(endpoint.public).toBe(false)
      expect(endpoint.headers?.Authorization).toContain(`Bearer`)
      expect(endpoint.options?.url).toContain(`internal-api.example.com`)
    })
  })

  describe(`nullability for DB-nullable fields`, () => {
    it(`should create an endpoint without headers (undefined is ok)`, () => {
      const endpointData = {
        type: `proxy` as const,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        options: { url: `https://api.example.com` },
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.headers).toBeUndefined()
      expect(endpoint.options).toEqual(endpointData.options)
      expect(endpoint.projectId).toBe(endpointData.projectId)
    })

    it(`should create an endpoint without options (undefined is ok)`, () => {
      const endpointData = {
        type: `proxy` as const,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        headers: { Authorization: `Bearer token` },
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.options).toBeUndefined()
      expect(endpoint.headers).toEqual(endpointData.headers)
      expect(endpoint.projectId).toBe(endpointData.projectId)
    })

    it(`should create an endpoint with both headers and options`, () => {
      const endpointData = {
        type: `proxy` as const,
        id: `123e4567-e89b-12d3-a456-426614174000`,
        projectId: `456e4567-e89b-12d3-a456-426614174001`,
        headers: { [`Content-Type`]: `application/json` },
        options: { url: `https://api.example.com`, timeout: 5000 },
        createdAt: `2024-01-01T00:00:00Z`,
        updatedAt: `2024-01-01T00:00:00Z`,
      }

      const endpoint = new Endpoint(endpointData as any)

      expect(endpoint.headers).toEqual(endpointData.headers)
      expect(endpoint.options).toEqual(endpointData.options)
      expect(endpoint.projectId).toBe(endpointData.projectId)
    })
  })
})
