import { describe, it, expect } from 'vitest'
import { Function } from './function'

describe('Function Model', () => {
  describe('constructor', () => {
    it('should create a function with required fields', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        projectId: '789e4567-e89b-12d3-a456-426614174002',
        content:
          'export default function handler(req, res) { return res.json({ success: true }) }',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.id).toBe(functionData.id)
      expect(func.projectId).toBe(functionData.projectId)
      expect(func.endpointId).toBe(functionData.endpointId)
      expect(func.content).toBe(functionData.content)
      expect(func.createdAt).toBe(functionData.createdAt)
      expect(func.updatedAt).toBe(functionData.updatedAt)
    })

    it('should create a function with all optional fields', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        projectId: '789e4567-e89b-12d3-a456-426614174002',
        content:
          'export default function handler(req, res) { return res.json({ data: req.body }) }',
        language: 'python',
        defaultArgs: {
          timeout: 5000,
          retryCount: 3,
        },
        dependencies: {
          axios: '^1.6.0',
          lodash: '^4.17.21',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.id).toBe(functionData.id)
      expect(func.endpointId).toBe(functionData.endpointId)
      expect(func.projectId).toBe(functionData.projectId)
      expect(func.content).toBe(functionData.content)
      expect(func.language).toBe(functionData.language)
      expect(func.defaultArgs).toEqual(functionData.defaultArgs)
      expect(func.dependencies).toEqual(functionData.dependencies)
      expect(func.createdAt).toBe(functionData.createdAt)
      expect(func.updatedAt).toBe(functionData.updatedAt)
    })

    it('should use default language value when not provided', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content:
          'export default function handler(req, res) { return res.json({ success: true }) }',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.language).toBe('typescript')
      expect(func.defaultArgs).toBeUndefined()
      expect(func.dependencies).toBeUndefined()
    })

    it('should override default language when provided', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'def handler(req, res):\n    return {"success": True}',
        language: 'python',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.language).toBe('python')
    })

    it('should handle complex defaultArgs object', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        defaultArgs: {
          timeout: 10000,
          retryCount: 5,
          retryDelay: 1000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
          options: {
            followRedirects: true,
            maxRedirects: 3,
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.defaultArgs).toEqual(functionData.defaultArgs)
      expect(func.defaultArgs?.timeout).toBe(10000)
      expect(func.defaultArgs?.retryCount).toBe(5)
      expect(func.defaultArgs?.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      })
    })

    it('should handle complex dependencies object', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        dependencies: {
          axios: '^1.6.0',
          lodash: '^4.17.21',
          '@types/node': '^20.0.0',
          express: '~5.0.0',
          'date-fns': '2.30.0',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.dependencies).toEqual(functionData.dependencies)
      expect(Object.keys(func.dependencies || {})).toHaveLength(5)
      expect(func.dependencies?.axios).toBe('^1.6.0')
      expect(func.dependencies?.lodash).toBe('^4.17.21')
    })

    it('should handle Date objects for timestamps', () => {
      const now = new Date()
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        createdAt: now,
        updatedAt: now,
      }

      const func = new Function(functionData)

      expect(func.createdAt).toBe(now)
      expect(func.updatedAt).toBe(now)
    })

    it('should handle partial data with only required fields', () => {
      const functionData = {
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        projectId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
      }

      const func = new Function(functionData)

      expect(func.endpointId).toBe(functionData.endpointId)
      expect(func.projectId).toBe(functionData.projectId)
      expect(func.content).toBe(functionData.content)
      expect(func.language).toBe('typescript')
    })

    it('should support different programming languages', () => {
      const languages = ['typescript', 'javascript', 'python', 'go', 'rust']

      languages.forEach((lang) => {
        const functionData = {
          id: `123e4567-e89b-12d3-a456-42661417400${languages.indexOf(lang)}`,
          endpointId: '456e4567-e89b-12d3-a456-426614174001',
          providerId: '789e4567-e89b-12d3-a456-426614174002',
          content: `// ${lang} function content`,
          language: lang,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }

        const func = new Function(functionData)
        expect(func.language).toBe(lang)
      })
    })
  })

  describe('inheritance from Base', () => {
    it('should inherit Base properties', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func).toHaveProperty('id')
      expect(func).toHaveProperty('createdAt')
      expect(func).toHaveProperty('updatedAt')
    })
  })

  describe('type safety', () => {
    it('should handle empty defaultArgs object', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        defaultArgs: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.defaultArgs).toEqual({})
      expect(Object.keys(func.defaultArgs || {})).toHaveLength(0)
    })

    it('should handle empty dependencies object', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        dependencies: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.dependencies).toEqual({})
      expect(Object.keys(func.dependencies || {})).toHaveLength(0)
    })

    it('should preserve null values if provided', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        defaultArgs: null as any,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.defaultArgs).toBeNull()
    })
  })

  describe('real-world scenarios', () => {
    it('should create a TypeScript API handler function', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: `
          import { Request, Response } from 'express';

          export default async function handler(req: Request, res: Response) {
            const { userId } = req.params;
            const user = await fetchUser(userId);
            return res.json({ user });
          }
        `,
        language: 'typescript',
        dependencies: {
          '@types/express': '^4.17.21',
          axios: '^1.6.0',
        },
        defaultArgs: {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.content).toContain('export default')
      expect(func.language).toBe('typescript')
      expect(func.dependencies?.['@types/express']).toBe('^4.17.21')
      expect(func.defaultArgs?.timeout).toBe(5000)
    })

    it('should create a Python serverless function', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: `
def handler(event, context):
    import json
    user_id = event.get('userId')
    return {
        'statusCode': 200,
        'body': json.dumps({'userId': user_id})
    }
        `,
        language: 'python',
        dependencies: {
          requests: '2.31.0',
          'python-dotenv': '^1.0.0',
        },
        defaultArgs: {
          timeout: 30000,
          memory: 512,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.language).toBe('python')
      expect(func.content).toContain('def handler')
      expect(func.dependencies?.requests).toBe('2.31.0')
    })

    it('should create a function with comprehensive dependencies', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        language: 'typescript',
        dependencies: {
          express: '^5.0.0',
          '@types/express': '^4.17.21',
          axios: '^1.6.0',
          lodash: '^4.17.21',
          'date-fns': '2.30.0',
          zod: '^3.22.0',
          jsonwebtoken: '^9.0.2',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(Object.keys(func.dependencies || {})).toHaveLength(7)
      expect(func.dependencies?.express).toBe('^5.0.0')
      expect(func.dependencies?.zod).toBe('^3.22.0')
    })

    it('should create a function with complex execution configuration', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: 'export default function handler(req, res) { }',
        language: 'typescript',
        defaultArgs: {
          timeout: 30000,
          memory: 1024,
          maxConcurrency: 10,
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true,
          },
          environment: {
            NODE_ENV: 'production',
            LOG_LEVEL: 'info',
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.defaultArgs?.timeout).toBe(30000)
      expect(func.defaultArgs?.memory).toBe(1024)
      expect(func.defaultArgs?.retryPolicy).toBeDefined()
      expect(func.defaultArgs?.retryPolicy.maxRetries).toBe(3)
      expect(func.defaultArgs?.environment.NODE_ENV).toBe('production')
    })

    it('should handle multi-line function content', () => {
      const functionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        endpointId: '456e4567-e89b-12d3-a456-426614174001',
        providerId: '789e4567-e89b-12d3-a456-426614174002',
        content: `
/**
 * API Handler for user operations
 * @param req - Express request
 * @param res - Express response
 */
export default async function handler(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await fetchUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
        `,
        language: 'typescript',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const func = new Function(functionData)

      expect(func.content).toContain('API Handler')
      expect(func.content).toContain('try')
      expect(func.content).toContain('catch')
      expect(func.content.split('\n').length).toBeGreaterThan(10)
    })
  })
})
