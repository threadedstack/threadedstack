import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('proxy.config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('config object', () => {
    it('should have all required configuration sections', async () => {
      const { config } = await import('./proxy.config')

      expect(config).toBeDefined()
      expect(config).toHaveProperty('server')
      expect(config).toHaveProperty('backend')
      expect(config).toHaveProperty('logger')
      expect(config).toHaveProperty('jwks')
      expect(config).not.toHaveProperty('jwt')
    })

    it('should have valid server configuration', async () => {
      const { config } = await import('./proxy.config')

      expect(config.server).toHaveProperty('port')
      expect(config.server).toHaveProperty('enableSSL')
      expect(config.server).toHaveProperty('origins')
      expect(typeof config.server.port).toBe('number')
      expect(typeof config.server.enableSSL).toBe('boolean')
      expect(Array.isArray(config.server.origins)).toBe(true)
    })

    it('should have valid backend configuration', async () => {
      const { config } = await import('./proxy.config')

      expect(config.backend).toHaveProperty('url')
      expect(config.backend).toHaveProperty('adminPath')
      expect(typeof config.backend.url).toBe('string')
      expect(config.backend.url).toContain('http')
    })

    it('should have valid logger configuration', async () => {
      const { config } = await import('./proxy.config')

      expect(config.logger).toHaveProperty('label')
      expect(config.logger).toHaveProperty('level')
      expect(config.logger).toHaveProperty('pretty')
      expect(config.logger).toHaveProperty('silent')
      expect(config.logger).toHaveProperty('exceptions')
      expect(config.logger).toHaveProperty('rejections')
      expect(config.logger).toHaveProperty('exitOnError')
      expect(typeof config.logger.label).toBe('string')
      expect(typeof config.logger.pretty).toBe('boolean')
      expect(typeof config.logger.silent).toBe('boolean')
    })

    it('should have valid JWKS configuration', async () => {
      const { config } = await import('./proxy.config')

      expect(config.jwks).toHaveProperty('jwksUrl')
      expect(typeof config.jwks.jwksUrl).toBe('string')
    })

    it('should use default values when environment variables are not set', async () => {
      const { config } = await import('./proxy.config')

      expect(config.server.port).toBeGreaterThan(0)
      expect(config.backend.url).toContain('http')
    })
  })

  describe('environment variable mapping', () => {
    it('should load TDSK_AUTH_JWKS from config', async () => {
      const { config } = await import('./proxy.config')

      // JWKS URL is loaded from values.yaml via loadEnvs
      // It should be a valid URL or empty string
      expect(typeof config.jwks.jwksUrl).toBe('string')
      if (config.jwks.jwksUrl) {
        expect(config.jwks.jwksUrl).toMatch(/^https?:\/\//)
        expect(config.jwks.jwksUrl).toContain('.well-known/jwks.json')
      }
    })
  })
})
