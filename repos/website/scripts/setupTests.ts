import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})

vi.mock('mui-image-alter', () => ({
  default: () => null,
}))

vi.mock('@neondatabase/neon-js/auth', () => ({
  createAuthClient: () => ({
    signIn: {
      social: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    signOut: vi.fn().mockResolvedValue({}),
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: { token: 'test-token' },
        user: { id: 'test-user', email: 'test@example.com' },
      },
    }),
  }),
}))

vi.mock('@TAF/services/api', () => {
  const mockApiService = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    bearer: vi.fn(),
    clearBearer: vi.fn(),
    config: {},
    configure: vi.fn(),
  }
  return {
    ApiService: vi.fn(() => mockApiService),
    apiService: mockApiService,
    BaseApi: class BaseApi {
      api = mockApiService
    },
  }
})
