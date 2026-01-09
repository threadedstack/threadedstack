import { describe, it, expect } from 'vitest'
import { Message } from './message'

describe('Message Model', () => {
  describe('constructor', () => {
    it('should create a message with required fields', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'Hello, how can I help you?' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.id).toBe(messageData.id)
      expect(message.type).toBe(messageData.type)
      expect(message.content).toEqual(messageData.content)
      expect(message.threadId).toBe(messageData.threadId)
      expect(message.createdAt).toBe(messageData.createdAt)
      expect(message.updatedAt).toBe(messageData.updatedAt)
    })

    it('should create a message with all optional fields', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: {
          text: 'I can help you with that.',
          tokens: 150,
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          model: 'gpt-4',
          temperature: 0.7,
          responseTime: 1200,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.id).toBe(messageData.id)
      expect(message.type).toBe(messageData.type)
      expect(message.content).toEqual(messageData.content)
      expect(message.threadId).toBe(messageData.threadId)
      expect(message.meta).toEqual(messageData.meta)
      expect(message.createdAt).toBe(messageData.createdAt)
      expect(message.updatedAt).toBe(messageData.updatedAt)
    })

    it('should handle user message type', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'What is the weather like?' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('user')
    })

    it('should handle assistant message type', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: { text: 'The weather is sunny with a high of 75°F.' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('assistant')
    })

    it('should handle system message type', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'system' as const,
        content: { text: 'You are a helpful assistant.' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('system')
    })

    it('should handle tool message type', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'tool' as const,
        content: {
          toolName: 'weather_api',
          toolInput: { location: 'San Francisco' },
          toolOutput: { temp: 75, conditions: 'sunny' },
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('tool')
      expect(message.content.toolName).toBe('weather_api')
    })

    it('should handle action message type', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'action' as const,
        content: {
          action: 'update_database',
          parameters: { userId: '123', field: 'email' },
          result: 'success',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('action')
      expect(message.content.action).toBe('update_database')
    })

    it('should handle complex content object', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: {
          text: 'Here is the analysis:',
          attachments: [
            { type: 'image', url: 'https://example.com/chart.png' },
            { type: 'file', url: 'https://example.com/report.pdf' },
          ],
          formatting: {
            bold: [0, 4],
            italic: [10, 18],
          },
          code: {
            language: 'javascript',
            snippet: 'const x = 10;',
          },
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.text).toBe('Here is the analysis:')
      expect(message.content.attachments).toHaveLength(2)
      expect(message.content.code.language).toBe('javascript')
    })

    it('should handle Date objects for timestamps', () => {
      const now = new Date()
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'Hello' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: now,
        updatedAt: now,
      }

      const message = new Message(messageData)

      expect(message.createdAt).toBe(now)
      expect(message.updatedAt).toBe(now)
    })

    it('should use undefined for optional meta field when not provided', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'Hello' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.meta).toBeUndefined()
    })
  })

  describe('inheritance from Base', () => {
    it('should inherit Base properties', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'Hello' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message).toHaveProperty('id')
      expect(message).toHaveProperty('createdAt')
      expect(message).toHaveProperty('updatedAt')
    })
  })

  describe('type safety', () => {
    it('should handle empty content object', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: {},
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content).toEqual({})
      expect(Object.keys(message.content)).toHaveLength(0)
    })

    it('should handle empty meta object', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: { text: 'Response' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.meta).toEqual({})
      expect(Object.keys(message.meta || {})).toHaveLength(0)
    })

    it('should preserve null values if provided', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: null as any },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.text).toBeNull()
    })
  })

  describe('real-world scenarios', () => {
    it('should create a user question message', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: {
          text: 'How do I configure the proxy settings?',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('user')
      expect(message.content.text).toContain('proxy settings')
      expect(message.meta?.userAgent).toBe('Mozilla/5.0')
    })

    it('should create an AI assistant response with metadata', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: {
          text: 'To configure proxy settings, follow these steps: 1. Navigate to Settings...',
          tokens: 250,
          finishReason: 'stop',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          responseTime: 1500,
          cost: 0.006,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('assistant')
      expect(message.content.tokens).toBe(250)
      expect(message.meta?.model).toBe('gpt-4')
      expect(message.meta?.cost).toBe(0.006)
    })

    it('should create a system message with instructions', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'system' as const,
        content: {
          text: 'You are a technical support assistant for the Threaded Stack platform.',
          role: 'system',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('system')
      expect(message.content.text).toContain('technical support assistant')
    })

    it('should create a tool execution message', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'tool' as const,
        content: {
          toolName: 'database_query',
          toolInput: {
            query: 'SELECT * FROM users WHERE id = $1',
            params: ['user-123'],
          },
          toolOutput: {
            rows: [{ id: 'user-123', name: 'John Doe', email: 'john@example.com' }],
            rowCount: 1,
            executionTime: 45,
          },
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          toolVersion: '1.2.0',
          success: true,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('tool')
      expect(message.content.toolName).toBe('database_query')
      expect(message.content.toolOutput.rowCount).toBe(1)
      expect(message.meta?.success).toBe(true)
    })

    it('should create an action message for automation', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'action' as const,
        content: {
          action: 'send_notification',
          parameters: {
            userId: 'user-123',
            message: 'Your deployment is complete',
            channel: 'email',
          },
          result: 'success',
          timestamp: '2024-01-01T00:05:00Z',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          triggeredBy: 'workflow-456',
          retryCount: 0,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.type).toBe('action')
      expect(message.content.action).toBe('send_notification')
      expect(message.content.result).toBe('success')
      expect(message.meta?.triggeredBy).toBe('workflow-456')
    })

    it('should create a message with rich content including code', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: {
          text: 'Here is the implementation:',
          code: {
            language: 'typescript',
            snippet: `function hello(name: string): string {
  return \`Hello, \${name}!\`;
}`,
          },
          explanation: 'This function takes a name and returns a greeting.',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          hasCode: true,
          codeLanguage: 'typescript',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.code.language).toBe('typescript')
      expect(message.content.code.snippet).toContain('function hello')
      expect(message.meta?.hasCode).toBe(true)
    })

    it('should create a message with attachments', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: {
          text: 'Here are the error logs',
          attachments: [
            {
              id: 'att-1',
              type: 'file',
              name: 'error.log',
              size: 15000,
              url: 'https://example.com/uploads/error.log',
            },
            {
              id: 'att-2',
              type: 'image',
              name: 'screenshot.png',
              size: 250000,
              url: 'https://example.com/uploads/screenshot.png',
            },
          ],
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: {
          attachmentCount: 2,
          totalSize: 265000,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.attachments).toHaveLength(2)
      expect(message.content.attachments[0].name).toBe('error.log')
      expect(message.meta?.attachmentCount).toBe(2)
    })
  })

  describe('data mutations', () => {
    it('should allow updating message properties after creation', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'Original text' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)
      message.content = { text: 'Updated text' }

      expect(message.content.text).toBe('Updated text')
    })

    it('should allow updating meta object after creation', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: { text: 'Response' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: { status: 'processing' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)
      message.meta = { status: 'completed', completedAt: '2024-01-02T00:00:00Z' }

      expect(message.meta.status).toBe('completed')
      expect(message.meta.completedAt).toBe('2024-01-02T00:00:00Z')
    })

    it('should allow adding meta after creation', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: 'Hello' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)
      message.meta = { edited: true, editedAt: '2024-01-02T00:00:00Z' }

      expect(message.meta.edited).toBe(true)
      expect(message.meta.editedAt).toBe('2024-01-02T00:00:00Z')
    })
  })

  describe('edge cases', () => {
    it('should handle message with very long text content', () => {
      const longText = 'A'.repeat(10000)
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: longText },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.text).toBe(longText)
      expect(message.content.text.length).toBe(10000)
    })

    it('should handle message with special characters in content', () => {
      const specialText = `Message with <script>alert('xss')</script> and "quotes" & 'apostrophes' and émojis 🚀`
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user' as const,
        content: { text: specialText },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.text).toBe(specialText)
    })

    it('should handle message with large meta object', () => {
      const largeMeta: Record<string, any> = {}
      for (let i = 0; i < 100; i++) {
        largeMeta[`key${i}`] = `value${i}`
      }

      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: { text: 'Response' },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        meta: largeMeta,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(Object.keys(message.meta || {})).toHaveLength(100)
      expect(message.meta?.key50).toBe('value50')
    })

    it('should handle message with deeply nested content', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'tool' as const,
        content: {
          toolName: 'complex_operation',
          toolInput: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    data: 'deeply nested value',
                  },
                },
              },
            },
          },
          toolOutput: {
            results: [
              {
                id: 1,
                data: { nested: { value: 'test' } },
              },
            ],
          },
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.toolInput.level1.level2.level3.level4.data).toBe(
        'deeply nested value'
      )
      expect(message.content.toolOutput.results[0].data.nested.value).toBe('test')
    })

    it('should handle message with multiple content types', () => {
      const messageData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'assistant' as const,
        content: {
          text: 'Analysis complete',
          data: {
            summary: 'All tests passed',
            details: ['test1: pass', 'test2: pass'],
          },
          links: ['https://example.com/report'],
          timestamp: '2024-01-01T00:05:00Z',
          status: 'success',
        },
        threadId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const message = new Message(messageData)

      expect(message.content.text).toBe('Analysis complete')
      expect(message.content.data.details).toHaveLength(2)
      expect(message.content.links).toContain('https://example.com/report')
      expect(message.content.status).toBe('success')
    })
  })

  describe('message type variations', () => {
    const types: Array<'user' | 'assistant' | 'system' | 'tool' | 'action'> = [
      'user',
      'assistant',
      'system',
      'tool',
      'action',
    ]

    types.forEach((type) => {
      it(`should correctly set ${type} message type`, () => {
        const messageData = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          type,
          content: { text: `This is a ${type} message` },
          threadId: '456e4567-e89b-12d3-a456-426614174001',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }

        const message = new Message(messageData)

        expect(message.type).toBe(type)
      })
    })
  })
})
