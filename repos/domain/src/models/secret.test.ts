import { describe, it, expect } from 'vitest'
import { Secret } from './secret'

describe('Secret Model', () => {
  describe('constructor', () => {
    it('should create a secret with required fields', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'API_KEY',
        hashKey: 'hash_abc123',
        encryptedValue: 'encrypted_value_xyz789',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.id).toBe(secretData.id)
      expect(secret.name).toBe(secretData.name)
      expect(secret.hashKey).toBe(secretData.hashKey)
      expect(secret.encryptedValue).toBe(secretData.encryptedValue)
      expect(secret.createdAt).toBe(secretData.createdAt)
      expect(secret.updatedAt).toBe(secretData.updatedAt)
    })

    it('should create a team-scoped secret', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'TEAM_SECRET',
        hashKey: 'hash_team123',
        encryptedValue: 'encrypted_team_value',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.id).toBe(secretData.id)
      expect(secret.name).toBe(secretData.name)
      expect(secret.hashKey).toBe(secretData.hashKey)
      expect(secret.encryptedValue).toBe(secretData.encryptedValue)
      expect(secret.teamId).toBe(secretData.teamId)
      expect(secret.repoId).toBeUndefined()
      expect(secret.createdAt).toBe(secretData.createdAt)
      expect(secret.updatedAt).toBe(secretData.updatedAt)
    })

    it('should create a repo-scoped secret', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'REPO_SECRET',
        hashKey: 'hash_repo123',
        encryptedValue: 'encrypted_repo_value',
        repoId: '789e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.id).toBe(secretData.id)
      expect(secret.name).toBe(secretData.name)
      expect(secret.hashKey).toBe(secretData.hashKey)
      expect(secret.encryptedValue).toBe(secretData.encryptedValue)
      expect(secret.repoId).toBe(secretData.repoId)
      expect(secret.teamId).toBeUndefined()
      expect(secret.createdAt).toBe(secretData.createdAt)
      expect(secret.updatedAt).toBe(secretData.updatedAt)
    })

    it('should handle Date objects for timestamps', () => {
      const now = new Date()
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'API_KEY',
        hashKey: 'hash_abc123',
        encryptedValue: 'encrypted_value_xyz789',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: now,
        updatedAt: now,
      }

      const secret = new Secret(secretData)

      expect(secret.createdAt).toBe(now)
      expect(secret.updatedAt).toBe(now)
    })

    it('should handle partial data with only required fields', () => {
      const secretData = {
        name: 'GITHUB_TOKEN',
        hashKey: 'hash_github',
        encryptedValue: 'encrypted_github_token',
      }

      const secret = new Secret(secretData)

      expect(secret.name).toBe(secretData.name)
      expect(secret.hashKey).toBe(secretData.hashKey)
      expect(secret.encryptedValue).toBe(secretData.encryptedValue)
      expect(secret.teamId).toBeUndefined()
      expect(secret.repoId).toBeUndefined()
    })

    it('should handle secrets with special characters in name', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'DATABASE_URL_PROD',
        hashKey: 'hash_db_123',
        encryptedValue: 'encrypted_db_connection_string',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.name).toBe('DATABASE_URL_PROD')
      expect(secret.hashKey).toBe(secretData.hashKey)
    })

    it('should handle long encrypted values', () => {
      const longEncryptedValue = 'A'.repeat(1000)
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'CERTIFICATE',
        hashKey: 'hash_cert',
        encryptedValue: longEncryptedValue,
        repoId: '789e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.encryptedValue).toBe(longEncryptedValue)
      expect(secret.encryptedValue.length).toBe(1000)
    })

    it('should preserve all properties when creating from object', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'AWS_SECRET_KEY',
        hashKey: 'hash_aws',
        encryptedValue: 'encrypted_aws_secret',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret).toMatchObject(secretData)
    })
  })

  describe('inheritance from Base', () => {
    it('should inherit Base properties', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'API_KEY',
        hashKey: 'hash_abc123',
        encryptedValue: 'encrypted_value_xyz789',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret).toHaveProperty('id')
      expect(secret).toHaveProperty('createdAt')
      expect(secret).toHaveProperty('updatedAt')
    })
  })

  describe('exclusive arc pattern', () => {
    it('should allow secret with teamId only', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'TEAM_API_KEY',
        hashKey: 'hash_team',
        encryptedValue: 'encrypted_team_api_key',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.teamId).toBe(secretData.teamId)
      expect(secret.repoId).toBeUndefined()
    })

    it('should allow secret with repoId only', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'REPO_API_KEY',
        hashKey: 'hash_repo',
        encryptedValue: 'encrypted_repo_api_key',
        repoId: '789e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.repoId).toBe(secretData.repoId)
      expect(secret.teamId).toBeUndefined()
    })

    it('should allow secret with neither teamId nor repoId', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'UNSCOPED_SECRET',
        hashKey: 'hash_unscoped',
        encryptedValue: 'encrypted_unscoped_value',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.teamId).toBeUndefined()
      expect(secret.repoId).toBeUndefined()
    })

    it('should allow secret with both teamId and repoId (model layer does not enforce constraint)', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'BOTH_IDS_SECRET',
        hashKey: 'hash_both',
        encryptedValue: 'encrypted_both_value',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        repoId: '789e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.teamId).toBe(secretData.teamId)
      expect(secret.repoId).toBe(secretData.repoId)
    })
  })

  describe('type safety', () => {
    it('should handle null values if provided', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'NULL_TEAM_SECRET',
        hashKey: 'hash_null',
        encryptedValue: 'encrypted_null_value',
        teamId: null as any,
        repoId: null as any,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.teamId).toBeNull()
      expect(secret.repoId).toBeNull()
    })
  })

  describe('real-world scenarios', () => {
    it('should create a GitHub API token secret for a team', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'GITHUB_API_TOKEN',
        hashKey: 'sha256_hash_of_github_token',
        encryptedValue: 'aes256_encrypted_github_token_value',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.name).toBe('GITHUB_API_TOKEN')
      expect(secret.teamId).toBeDefined()
      expect(secret.repoId).toBeUndefined()
    })

    it('should create a database connection string secret for a repo', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'DATABASE_URL',
        hashKey: 'sha256_hash_of_db_url',
        encryptedValue: 'aes256_encrypted_postgres_connection_string',
        repoId: '789e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.name).toBe('DATABASE_URL')
      expect(secret.repoId).toBeDefined()
      expect(secret.teamId).toBeUndefined()
    })

    it('should create an AWS credentials secret', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'AWS_SECRET_ACCESS_KEY',
        hashKey: 'sha256_hash_of_aws_secret',
        encryptedValue: 'aes256_encrypted_aws_secret_access_key',
        teamId: '456e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.name).toBe('AWS_SECRET_ACCESS_KEY')
      expect(secret.encryptedValue).toContain('aes256_encrypted')
    })

    it('should create an API key for external service', () => {
      const secretData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'OPENAI_API_KEY',
        hashKey: 'sha256_hash_openai',
        encryptedValue: 'aes256_encrypted_openai_key',
        repoId: '789e4567-e89b-12d3-a456-426614174002',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const secret = new Secret(secretData)

      expect(secret.name).toBe('OPENAI_API_KEY')
      expect(secret.repoId).toBeDefined()
    })

    it('should handle secret name with various formats', () => {
      const formats = [
        'SNAKE_CASE_SECRET',
        'kebab-case-secret',
        'camelCaseSecret',
        'PascalCaseSecret',
        'SECRET123',
        'secret.with.dots',
        'secret/with/slashes',
      ]

      formats.forEach((name) => {
        const secretData = {
          id: `123e4567-e89b-12d3-a456-42661417400${formats.indexOf(name)}`,
          name,
          hashKey: `hash_${name}`,
          encryptedValue: `encrypted_${name}`,
          teamId: '456e4567-e89b-12d3-a456-426614174001',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }

        const secret = new Secret(secretData)
        expect(secret.name).toBe(name)
      })
    })
  })
})
