# Integration Testing Requirements

## Current Status: ⚠️ INTEGRATION TESTING CODE WRITTEN, EXECUTION BLOCKED

Integration testing infrastructure code is complete (test suite + database seeds), but tests have not been executed due to missing database connection credentials.

---

## Epic 2: Proxy Engine - Integration Testing Needs

### Problem
The proxy engine implementation exists at `repos/backend/src/endpoints/proxy/` but we have no proof that the following features work end-to-end:

1. **Secret Injection** - Secrets are decrypted and injected into proxied requests
2. **Custom Headers** - Headers defined in endpoint config are properly forwarded
3. **Body Transformation** - Request/response bodies are transformed per endpoint rules
4. **OAuth Flow** - OAuth client credentials are obtained and used
5. **Domain Whitelisting** - Only whitelisted domains can be proxied
6. **Request Streaming** - Large requests/responses stream correctly

### Solution: Database Seeds + Integration Tests

#### Required Database Seeds

Create seed data in `repos/database/src/seeds/integration.ts`:

```typescript
// Seed data for proxy integration testing:

1. Test Organization
   - name: "Test Org"
   - id: "test-org-123"

2. Test Project
   - name: "Test Project"
   - orgId: "test-org-123"
   - id: "test-project-456"

3. Test Secrets
   a) API Key Secret
      - name: "EXTERNAL_API_KEY"
      - encryptedValue: (encrypted "test-api-key-12345")
      - projectId: "test-project-456"

   b) OAuth Secret
      - name: "OAUTH_CLIENT_SECRET"
      - encryptedValue: (encrypted "test-oauth-secret")
      - projectId: "test-project-456"

4. Test Endpoints
   a) Simple Proxy with Secret Injection
      - name: "External API Proxy"
      - url: "https://httpbin.org/anything"
      - method: "POST"
      - headers: {
          "Authorization": "Bearer {{EXTERNAL_API_KEY}}",
          "X-Custom-Header": "test-value"
        }
      - projectId: "test-project-456"

   b) Proxy with Body Transformation
      - name: "Transform Body Proxy"
      - url: "https://httpbin.org/post"
      - method: "POST"
      - options: {
          bodyTransform: {
            replace: [
              { find: "{{SECRET}}", replace: "{{EXTERNAL_API_KEY}}" }
            ]
          }
        }
      - projectId: "test-project-456"

   c) OAuth Proxy
      - name: "OAuth Proxy"
      - url: "https://httpbin.org/bearer"
      - method: "GET"
      - options: {
          oauth: {
            tokenUrl: "https://oauth.example.com/token",
            clientId: "test-client-id",
            clientSecret: "{{OAUTH_CLIENT_SECRET}}",
            scope: "read write"
          }
        }
      - projectId: "test-project-456"

   d) Domain Whitelisted Proxy
      - name: "Whitelisted Proxy"
      - url: "https://api.example.com/data"
      - method: "GET"
      - options: {
          domainWhitelist: ["*.example.com", "httpbin.org"]
        }
      - projectId: "test-project-456"

5. Test API Key (for M2M auth to proxy)
   - name: "Test API Key"
   - hashedKey: (hash of "test-api-key-abc123")
   - scope: ["read", "write"]
   - orgId: "test-org-123"
```

#### Integration Test Suite

Create tests in `repos/backend/src/endpoints/proxy/proxy.integration.test.ts`:

```typescript
describe('Proxy Engine - End-to-End Integration', () => {
  beforeAll(async () => {
    // Load integration seeds
    await loadIntegrationSeeds()
  })

  describe('Secret Injection', () => {
    it('should decrypt secret and inject into Authorization header', async () => {
      const response = await request(app)
        .post('/proxy/test-project-456/external-api-proxy')
        .set('X-API-Key', 'test-api-key-abc123')
        .send({ test: 'data' })
        .expect(200)

      // httpbin.org echoes back headers it received
      expect(response.body.headers.Authorization).toBe('Bearer test-api-key-12345')
      expect(response.body.headers['X-Custom-Header']).toBe('test-value')
    })
  })

  describe('Body Transformation', () => {
    it('should replace secret placeholders in request body', async () => {
      const response = await request(app)
        .post('/proxy/test-project-456/transform-body-proxy')
        .set('X-API-Key', 'test-api-key-abc123')
        .send({ apiKey: '{{SECRET}}' })
        .expect(200)

      // httpbin.org echoes back the body it received
      expect(response.body.json.apiKey).toBe('test-api-key-12345')
    })
  })

  describe('OAuth Client Credentials', () => {
    it('should obtain OAuth token and inject into request', async () => {
      // Mock OAuth token endpoint
      nock('https://oauth.example.com')
        .post('/token')
        .reply(200, { access_token: 'mocked-token-xyz', expires_in: 3600 })

      const response = await request(app)
        .get('/proxy/test-project-456/oauth-proxy')
        .set('X-API-Key', 'test-api-key-abc123')
        .expect(200)

      // httpbin.org /bearer validates Bearer token presence
      expect(response.body.authenticated).toBe(true)
      expect(response.body.token).toBe('mocked-token-xyz')
    })
  })

  describe('Domain Whitelisting', () => {
    it('should allow whitelisted domains', async () => {
      await request(app)
        .get('/proxy/test-project-456/whitelisted-proxy')
        .set('X-API-Key', 'test-api-key-abc123')
        .expect(200)
    })

    it('should block non-whitelisted domains', async () => {
      // Try to proxy to evil.com which is NOT whitelisted
      const maliciousEndpoint = await createEndpoint({
        url: 'https://evil.com/steal-data',
        options: { domainWhitelist: ['*.example.com'] }
      })

      await request(app)
        .get(`/proxy/test-project-456/${maliciousEndpoint.id}`)
        .set('X-API-Key', 'test-api-key-abc123')
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toMatch(/domain not whitelisted/i)
        })
    })
  })

  describe('Request Streaming', () => {
    it('should stream large request bodies', async () => {
      const largePayload = { data: 'x'.repeat(1024 * 1024) } // 1MB

      const response = await request(app)
        .post('/proxy/test-project-456/external-api-proxy')
        .set('X-API-Key', 'test-api-key-abc123')
        .send(largePayload)
        .expect(200)

      expect(response.body.json.data).toBe(largePayload.data)
    })
  })
})
```

---

## Task: Create Integration Testing Infrastructure

### Backend Tasks
- [x] **TASK-INT-1**: Create `repos/database/src/seeds/integration.ts` with test data - CODE COMPLETE
- [x] **TASK-INT-2**: Create seed loading script `pnpm seed:integration` - CODE COMPLETE
- [x] **TASK-INT-3**: Create `repos/backend/src/endpoints/proxy/proxy.integration.test.ts` - CODE COMPLETE (430 lines, 17 tests)
- [~] **TASK-INT-4**: Implement secret injection integration test - CODE WRITTEN, NOT EXECUTED
- [~] **TASK-INT-5**: Implement body transformation integration test - CODE WRITTEN, NOT EXECUTED
- [~] **TASK-INT-6**: Implement OAuth flow integration test - CODE WRITTEN, NOT EXECUTED
- [~] **TASK-INT-7**: Implement domain whitelisting integration test - CODE WRITTEN, NOT EXECUTED
- [~] **TASK-INT-8**: Implement request streaming integration test - CODE WRITTEN, NOT EXECUTED
- [ ] **TASK-INT-9**: Add integration test to CI/CD pipeline

**EXECUTION BLOCKER**: Database connection credentials not configured. Error: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Required Environment Variables**:
- `TDSK_DATABASE_URL` or PostgreSQL connection parameters (`TDSK_DATABASE_HOST`, `TDSK_DATABASE_PORT`, `TDSK_DATABASE_USER`, `TDSK_DATABASE_PASSWORD`, `TDSK_DATABASE_NAME`)
- `TDSK_MASTER_KEY` for secret encryption (hex format)

**To Execute Tests**:
1. Configure database credentials in environment
2. Run `cd repos/database && pnpm seed:integration`
3. Run `cd repos/backend && pnpm test proxy.integration.test.ts`
4. Verify all 17 tests pass
5. Update task statuses to [x] after successful execution

### Manual Testing Tasks (via Admin UI)
- [ ] **TASK-INT-10**: Create test org via UI
- [ ] **TASK-INT-11**: Create test project via UI
- [ ] **TASK-INT-12**: Create test secrets via UI (verify encryption)
- [ ] **TASK-INT-13**: Create test endpoint via UI (httpbin.org target)
- [ ] **TASK-INT-14**: Test proxy endpoint via curl/Postman
- [ ] **TASK-INT-15**: Verify secret injection in httpbin response
- [ ] **TASK-INT-16**: Verify custom headers in httpbin response
- [ ] **TASK-INT-17**: Document manual test results

---

## Success Criteria

✅ **Epic 2 is fully validated when:**
1. Integration tests pass for all proxy features
2. Manual testing confirms UI → Backend → Proxy → External API flow works
3. Secrets are properly encrypted in DB and decrypted for proxy
4. Custom headers are injected correctly
5. OAuth tokens are obtained and used
6. Domain whitelisting blocks unauthorized targets
7. Large requests/responses stream without issues

---

## Priority: HIGH

This is a **blocker** for considering Epic 2 complete. Without integration testing, we cannot confidently deploy the proxy engine to production.

**Recommended Timeline:**
- Database seeds: 2 hours
- Integration tests: 1 day
- Manual testing: 2 hours
- **Total: ~1.5 days**
