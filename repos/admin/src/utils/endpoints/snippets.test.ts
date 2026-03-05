import { describe, it, expect } from 'vitest'
import { generateSnippet } from './snippets'

describe('generateSnippet', () => {
  const baseOpts = {
    url: 'https://api.example.com/data',
    method: 'GET',
  }

  describe('curl', () => {
    it('should generate GET with no body', () => {
      const result = generateSnippet('curl', baseOpts)
      expect(result).toContain('curl -X GET')
      expect(result).toContain('https://api.example.com/data')
      expect(result).not.toContain('-d')
    })

    it('should generate POST with JSON body', () => {
      const result = generateSnippet('curl', {
        ...baseOpts,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      })
      expect(result).toContain('curl -X POST')
      expect(result).toContain("-H 'Content-Type: application/json'")
      expect(result).toContain(`-d '{"name":"test"}'`)
    })

    it('should generate with custom headers', () => {
      const result = generateSnippet('curl', {
        ...baseOpts,
        headers: { Authorization: 'Bearer token123', Accept: 'application/json' },
      })
      expect(result).toContain("-H 'Authorization: Bearer token123'")
      expect(result).toContain("-H 'Accept: application/json'")
    })
  })

  describe('fetch', () => {
    it('should generate GET with no body', () => {
      const result = generateSnippet('fetch', baseOpts)
      expect(result).toContain("fetch('https://api.example.com/data'")
      expect(result).toContain("method: 'GET'")
      expect(result).not.toContain('body:')
    })

    it('should generate POST with JSON body', () => {
      const result = generateSnippet('fetch', {
        ...baseOpts,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      })
      expect(result).toContain("method: 'POST'")
      expect(result).toContain("'Content-Type': 'application/json'")
      expect(result).toContain('body:')
    })

    it('should generate with no headers', () => {
      const result = generateSnippet('fetch', baseOpts)
      expect(result).not.toContain('headers:')
    })
  })

  describe('axios', () => {
    it('should generate GET with no body', () => {
      const result = generateSnippet('axios', baseOpts)
      expect(result).toContain("method: 'get'")
      expect(result).toContain("url: 'https://api.example.com/data'")
      expect(result).not.toContain('data:')
    })

    it('should generate POST with body and headers', () => {
      const result = generateSnippet('axios', {
        ...baseOpts,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"key":"value"}',
      })
      expect(result).toContain("method: 'post'")
      expect(result).toContain("'Content-Type': 'application/json'")
      expect(result).toContain('data:')
    })

    it('should generate with multiple headers', () => {
      const result = generateSnippet('axios', {
        ...baseOpts,
        headers: { Authorization: 'Bearer abc', 'X-Custom': 'val' },
      })
      expect(result).toContain("'Authorization': 'Bearer abc'")
      expect(result).toContain("'X-Custom': 'val'")
    })
  })

  describe('httpie', () => {
    it('should generate GET with no body', () => {
      const result = generateSnippet('httpie', baseOpts)
      expect(result).toContain("http GET 'https://api.example.com/data'")
    })

    it('should generate POST with JSON body fields', () => {
      const result = generateSnippet('httpie', {
        ...baseOpts,
        method: 'POST',
        body: '{"name":"test","count":5}',
      })
      expect(result).toContain('http POST')
      expect(result).toContain('name=test')
      expect(result).toContain('count=5')
    })

    it('should generate with headers', () => {
      const result = generateSnippet('httpie', {
        ...baseOpts,
        headers: { Authorization: 'Bearer xyz' },
      })
      expect(result).toContain("'Authorization:Bearer xyz'")
    })

    it('should use --raw for non-JSON body', () => {
      const result = generateSnippet('httpie', {
        ...baseOpts,
        method: 'POST',
        body: 'plain text body',
      })
      expect(result).toContain("--raw 'plain text body'")
    })
  })

  describe('shell escaping', () => {
    it('should escape single quotes in curl URL', () => {
      const result = generateSnippet('curl', {
        url: "https://api.example.com/data?name=O'Brien",
        method: 'GET',
      })
      expect(result).toContain("O'\\''Brien")
      expect(result).not.toContain("O'Brien'")
    })

    it('should escape single quotes in curl header value', () => {
      const result = generateSnippet('curl', {
        ...baseOpts,
        headers: { 'X-Custom': "it's a test" },
      })
      expect(result).toContain("it'\\''s a test")
    })

    it('should escape single quotes in curl body', () => {
      const result = generateSnippet('curl', {
        ...baseOpts,
        method: 'POST',
        body: "{'key': 'value'}",
      })
      expect(result).toContain("'\\''key'\\'': '\\''value'\\''")
    })

    it('should handle HTTPie with nested JSON object in body', () => {
      const result = generateSnippet('httpie', {
        ...baseOpts,
        method: 'POST',
        body: '{"name":"test","config":{"nested":true}}',
      })
      expect(result).toContain('http POST')
      expect(result).toContain('name=test')
      // nested object gets JSON.stringify'd
      expect(result).toContain('config=')
    })
  })
})
