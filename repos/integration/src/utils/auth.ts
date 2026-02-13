/**
 * Neon Auth mock payload for Playwright UI tests.
 *
 * The admin app fetches /neondb/auth/get-session on load.
 * We intercept this and return a mock session with the test API key as the token.
 * The admin app then sets `Authorization: Bearer <token>` on all requests.
 */
export const buildNeonAuthMock = (apiKey: string) => ({
  session: {
    token: apiKey,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  user: {
    id: 'integration-test-user',
    email: 'integration@test.local',
    name: 'Integration Test',
    image: '',
  },
})
