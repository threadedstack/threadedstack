import { describe, it, expect } from 'vitest'
import { Thread } from './thread'

describe('Thread Model', () => {
  describe('constructor', () => {
    it('should create a thread with required fields', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.id).toBe(threadData.id)
      expect(thread.userId).toBe(threadData.userId)
      expect(thread.createdAt).toBe(threadData.createdAt)
      expect(thread.updatedAt).toBe(threadData.updatedAt)
    })

    it('should create a thread with all optional fields', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: 'Customer Support Chat',
        meta: {
          topic: 'billing',
          priority: 'high',
          tags: ['support', 'billing'],
        },
        public: true,
        configId: '789e4567-e89b-12d3-a456-426614174002',
        providerId: '012e4567-e89b-12d3-a456-426614174003',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.id).toBe(threadData.id)
      expect(thread.userId).toBe(threadData.userId)
      expect(thread.name).toBe(threadData.name)
      expect(thread.meta).toEqual(threadData.meta)
      expect(thread.public).toBe(true)
      expect(thread.configId).toBe(threadData.configId)
      expect(thread.providerId).toBe(threadData.providerId)
      expect(thread.createdAt).toBe(threadData.createdAt)
      expect(thread.updatedAt).toBe(threadData.updatedAt)
    })

    it('should use default values when optional fields are not provided', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.public).toBe(false)
      expect(thread.name).toBeUndefined()
      expect(thread.meta).toBeUndefined()
      expect(thread.configId).toBeUndefined()
      expect(thread.providerId).toBeUndefined()
    })

    it('should override default public flag when provided', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        public: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.public).toBe(true)
    })

    it('should handle complex meta object', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          topic: 'technical-support',
          priority: 'high',
          tags: ['urgent', 'bug', 'production'],
          assignedTo: 'support-team-1',
          customFields: {
            severity: 'critical',
            affectedUsers: 150,
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.meta).toEqual(threadData.meta)
      expect(thread.meta?.topic).toBe('technical-support')
      expect(thread.meta?.tags).toHaveLength(3)
      expect(thread.meta?.customFields.severity).toBe('critical')
    })

    it('should handle Date objects for timestamps', () => {
      const now = new Date()
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: now,
        updatedAt: now,
      }

      const thread = new Thread(threadData)

      expect(thread.createdAt).toBe(now)
      expect(thread.updatedAt).toBe(now)
    })

    it('should handle partial data with only userId', () => {
      const threadData = {
        userId: '456e4567-e89b-12d3-a456-426614174001',
      }

      const thread = new Thread(threadData)

      expect(thread.userId).toBe(threadData.userId)
      expect(thread.public).toBe(false)
    })

    it('should handle thread name variations', () => {
      const names = [
        'Support Thread',
        'Billing Question - Account #12345',
        'Technical Issue: API Rate Limiting',
        '',
        'Thread with émojis 🚀 and ünïcödé',
      ]

      names.forEach((name, index) => {
        const threadData = {
          id: `123e4567-e89b-12d3-a456-42661417400${index}`,
          userId: '456e4567-e89b-12d3-a456-426614174001',
          name,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }

        const thread = new Thread(threadData)
        expect(thread.name).toBe(name)
      })
    })
  })

  describe('inheritance from Base', () => {
    it('should inherit Base properties', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread).toHaveProperty('id')
      expect(thread).toHaveProperty('createdAt')
      expect(thread).toHaveProperty('updatedAt')
    })
  })

  describe('type safety', () => {
    it('should handle empty meta object', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.meta).toEqual({})
      expect(Object.keys(thread.meta || {})).toHaveLength(0)
    })

    it('should preserve null values if provided', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: null as any,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.name).toBeNull()
    })

    it('should handle undefined for optional UUIDs', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        configId: undefined,
        providerId: undefined,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.configId).toBeUndefined()
      expect(thread.providerId).toBeUndefined()
    })
  })

  describe('real-world scenarios', () => {
    it('should create a customer support thread', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: 'Customer Support - Issue with API Keys',
        meta: {
          department: 'support',
          category: 'api',
          priority: 'high',
          ticketId: 'SUP-12345',
        },
        public: false,
        configId: '789e4567-e89b-12d3-a456-426614174002',
        providerId: '012e4567-e89b-12d3-a456-426614174003',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.name).toContain('Customer Support')
      expect(thread.meta?.category).toBe('api')
      expect(thread.public).toBe(false)
    })

    it('should create a public community thread', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: 'How to use the Proxy Feature?',
        meta: {
          forum: 'community',
          views: 245,
          upvotes: 12,
          tags: ['proxy', 'tutorial', 'beginners'],
        },
        public: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.public).toBe(true)
      expect(thread.meta?.forum).toBe('community')
      expect(thread.meta?.tags).toContain('proxy')
    })

    it('should create an AI chat thread with provider and config', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: 'AI Assistant - Code Review',
        meta: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          conversationType: 'code-review',
        },
        public: false,
        configId: '789e4567-e89b-12d3-a456-426614174002',
        providerId: '012e4567-e89b-12d3-a456-426614174003',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.configId).toBeDefined()
      expect(thread.providerId).toBeDefined()
      expect(thread.meta?.model).toBe('gpt-4')
      expect(thread.name).toContain('AI Assistant')
    })

    it('should create a thread with minimal data', () => {
      const threadData = {
        userId: '456e4567-e89b-12d3-a456-426614174001',
      }

      const thread = new Thread(threadData)

      expect(thread.userId).toBe(threadData.userId)
      expect(thread.public).toBe(false)
      expect(thread.name).toBeUndefined()
      expect(thread.configId).toBeUndefined()
      expect(thread.providerId).toBeUndefined()
    })

    it('should handle thread with nested meta data structures', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: 'Complex Thread',
        meta: {
          workspace: {
            id: 'ws-123',
            name: 'Engineering',
          },
          participants: [
            { id: 'user-1', role: 'owner' },
            { id: 'user-2', role: 'member' },
          ],
          settings: {
            notifications: true,
            aiEnabled: true,
            customPrompts: ['prompt-1', 'prompt-2'],
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.meta?.workspace.id).toBe('ws-123')
      expect(thread.meta?.participants).toHaveLength(2)
      expect(thread.meta?.settings.customPrompts).toHaveLength(2)
    })
  })

  describe('data mutations', () => {
    it('should allow updating thread properties after creation', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: 'Original Name',
        public: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)
      thread.name = 'Updated Name'
      thread.public = true

      expect(thread.name).toBe('Updated Name')
      expect(thread.public).toBe(true)
    })

    it('should allow updating meta object after creation', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        meta: { status: 'open' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)
      thread.meta = { status: 'closed', closedAt: '2024-01-02T00:00:00Z' }

      expect(thread.meta.status).toBe('closed')
      expect(thread.meta.closedAt).toBe('2024-01-02T00:00:00Z')
    })

    it('should allow adding configId and providerId after creation', () => {
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)
      thread.configId = '789e4567-e89b-12d3-a456-426614174002'
      thread.providerId = '012e4567-e89b-12d3-a456-426614174003'

      expect(thread.configId).toBe('789e4567-e89b-12d3-a456-426614174002')
      expect(thread.providerId).toBe('012e4567-e89b-12d3-a456-426614174003')
    })
  })

  describe('edge cases', () => {
    it('should handle thread with very long name', () => {
      const longName = 'A'.repeat(500)
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: longName,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.name).toBe(longName)
      expect(thread.name?.length).toBe(500)
    })

    it('should handle thread with special characters in name', () => {
      const specialName = `Thread with <script>alert('xss')</script> and "quotes" & 'apostrophes'`
      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        name: specialName,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(thread.name).toBe(specialName)
    })

    it('should handle thread with large meta object', () => {
      const largeMeta: Record<string, any> = {}
      for (let i = 0; i < 100; i++) {
        largeMeta[`key${i}`] = `value${i}`
      }

      const threadData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e4567-e89b-12d3-a456-426614174001',
        meta: largeMeta,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const thread = new Thread(threadData)

      expect(Object.keys(thread.meta || {})).toHaveLength(100)
      expect(thread.meta?.key50).toBe('value50')
    })
  })
})
