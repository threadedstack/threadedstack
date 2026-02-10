import { describe, it, expect } from 'vitest'
import { Domain } from './domain'

describe(`Domain model`, () => {
  describe(`constructor`, () => {
    it(`should create domain with basic properties`, () => {
      const d = new Domain({ domain: `example.com` })
      expect(d.domain).toBe(`example.com`)
      expect(d.verified).toBe(false)
      expect(d.sslEnabled).toBe(false)
    })

    it(`should set sslEnabled to true when explicitly true`, () => {
      const d = new Domain({ domain: `example.com`, sslEnabled: true })
      expect(d.sslEnabled).toBe(true)
    })

    it(`should set sslEnabled to false when explicitly false`, () => {
      const d = new Domain({ domain: `example.com`, sslEnabled: false })
      expect(d.sslEnabled).toBe(false)
    })

    it(`should set sslEnabled to true when sslCertificate exists but sslEnabled not set`, () => {
      const d = new Domain({
        domain: `example.com`,
        sslCertificate: `-----BEGIN CERTIFICATE-----`,
      })
      expect(d.sslEnabled).toBe(true)
    })

    it(`should set sslEnabled to false when neither sslEnabled nor sslCertificate set`, () => {
      const d = new Domain({ domain: `example.com` })
      expect(d.sslEnabled).toBe(false)
    })

    it(`should handle orgId and projectId`, () => {
      const d = new Domain({ domain: `example.com`, orgId: `org-1` })
      expect(d.orgId).toBe(`org-1`)
      expect(d.projectId).toBeUndefined()
    })

    it(`should wrap certificates in Certificate instances`, () => {
      const d = new Domain({
        domain: `example.com`,
        certificates: [
          {
            parent: `example.com`,
            name: `cert.pem`,
            isFile: true,
            value: null,
            modified: `2024-01-01`,
          },
        ],
      } as any)
      expect(d.certificates).toHaveLength(1)
    })

    it(`should default certificates to empty array`, () => {
      const d = new Domain({ domain: `example.com` })
      expect(d.certificates).toEqual([])
    })
  })
})
