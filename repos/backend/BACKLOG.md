# Backend Features Backlog

These are **new capabilities** (not bug fixes) organized into implementable tasks with cross-repo dependencies, prerequisites, complexity estimates, and test requirements.

> **Generated**: 2026-02-08
> **Source**: repos/backend/AUDIT.md (P3 backlog items)
> **Status**: All items are unstarted and ready for implementation

---

## Summary Table

| Feature | Tasks | New Files | Modified Files | Complexity | Phase |
|---------|-------|-----------|----------------|------------|-------|
| FEAT-001: Threads CRUD | 8 | 7 | 3 | Medium | 1 |
| FEAT-002: Messages CRUD | 8 | 7 | 3 | Medium | 1 |
| FEAT-003: Assets CRUD + Upload | 10 | 8 | 4 | High | 2 |
| FEAT-004: Subscription Plan Changes | 7 | 3 | 5 | High | 3 |
| FEAT-005: Payment History & Invoices | 6 | 4 | 4 | Medium | 3 |
| FEAT-006: Quota Manual Management | 7 | 4 | 4 | Medium | 4 |
| **TOTAL** | **46** | **33** | **23** | | |

## Infrastructure Already in Place

| Component | Location | Status |
|-----------|----------|--------|
| Thread DB schema | `repos/database/src/schemas/threads.ts` | Complete |
| Message DB schema | `repos/database/src/schemas/messages.ts` | Complete |
| Asset DB schema | `repos/database/src/schemas/assets.ts` | Complete (exclusive arc CHECK) |
| Quota DB schema | `repos/database/src/schemas/quotas.ts` | Complete (12 resource counters) |
| Subscription DB schema | `repos/database/src/schemas/subscriptions.ts` | Complete |
| Thread DB service | `repos/database/src/services/thread.ts` | Complete (extends Base) |
| Message DB service | `repos/database/src/services/message.ts` | Complete (extends Base) |
| Asset DB service | `repos/database/src/services/asset.ts` | Complete (extends Base) |
| Quota DB service | `repos/database/src/services/quota.ts` | Complete (increment/getUsage/initializePeriod) |
| Subscription DB service | `repos/database/src/services/subscription.ts` | Complete (findByUser/upsertByUser) |
| Thread domain model | `repos/domain/src/models/thread.ts` | Complete |
| Message domain model | `repos/domain/src/models/message.ts` | Complete (MessageType union) |
| Asset domain model | `repos/domain/src/models/asset.ts` | Complete |
| Subscription domain model | `repos/domain/src/models/subscription.ts` | Complete |
| Permission resources | `repos/domain/src/types/permissions.types.ts` | thread/message/asset in EPermResource |
| Admin API stubs | `repos/admin/src/services/{threads,messages,assets,quotas,subscriptions}Api.ts` | Complete |
| Database auto-registration | `repos/database/src/database.ts` | All services auto-registered |
| Accounts router | `repos/backend/src/endpoints/accounts.ts` | Must add threads/messages/assets |

---

## FEAT-001: Threads CRUD Endpoints

**Goal**: Full CRUD for conversation threads (list, get, create, update, delete) scoped to org/project with permission checks.

**Data Model** (already exists):
- `Thread`: id, name?, userId (NOT NULL), orgId?, projectId?, configId?, providerId?, public=false, meta?
- Relations: has many messages, belongs to user/config/provider/org/project
- DB index on userId

**Admin API Stub** (already exists at `repos/admin/src/services/threadsApi.ts`):
- list, get, create, update, delete -- will work once backend endpoints exist

### Tasks

**T-001.1: Create `listThreads.ts` endpoint**
- **File**: `repos/backend/src/endpoints/threads/listThreads.ts` (new)
- **Pattern**: Follow `listApiKeys.ts` -- require orgId query param, checkPermission(read, thread), db.services.thread.list({ where }), support projectId filter
- **Permission**: `EPermAction.read`, `EPermResource.thread`
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: List with orgId filter, list with projectId filter, 400 without orgId, 403 without permission

**T-001.2: Create `getThread.ts` endpoint**
- **File**: `repos/backend/src/endpoints/threads/getThread.ts` (new)
- **Pattern**: Follow `getApiKey.ts` -- get by id, 404 if not found, checkPermission with data.orgId
- **Permission**: `EPermAction.read`, `EPermResource.thread`
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Get existing, 404 missing, 403 wrong org

**T-001.3: Create `createThread.ts` endpoint**
- **File**: `repos/backend/src/endpoints/threads/createThread.ts` (new)
- **Pattern**: Follow `createApiKey.ts` -- validate body (name, orgId required), checkPermission(create, thread), set userId from req.user.id, db.services.thread.create(), return 201
- **Permission**: `EPermAction.create`, `EPermResource.thread`
- **Quota**: Increment `threads` quota via `db.services.quota.increment(orgId, period, "threads", 1)`
- **Complexity**: Medium (quota integration)
- **Prerequisites**: None
- **Tests**: Create with valid body, 400 missing fields, 403 permission, quota increment called

**T-001.4: Create `updateThread.ts` endpoint**
- **File**: `repos/backend/src/endpoints/threads/updateThread.ts` (new)
- **Pattern**: Follow `updateApiKey.ts` -- get existing, checkPermission(update, thread), validate allowed fields (name, meta, public, configId, providerId), return updated
- **Permission**: `EPermAction.update`, `EPermResource.thread`
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Update name, update meta, 404 missing, 403 wrong org

**T-001.5: Create `deleteThread.ts` endpoint**
- **File**: `repos/backend/src/endpoints/threads/deleteThread.ts` (new)
- **Pattern**: Follow `deleteApiKey.ts` -- get existing, checkPermission(delete, thread), db.services.thread.delete(id), return { data: { success: true, id } }
- **Permission**: `EPermAction.delete`, `EPermResource.thread`
- **Note**: Messages cascade-delete via FK constraint (threadId ON DELETE CASCADE)
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Delete existing, 404 missing, 403 wrong org, verify cascade

**T-001.6: Create `threads.ts` config + `index.ts` barrel**
- **Files**: `repos/backend/src/endpoints/threads/threads.ts` (new), `repos/backend/src/endpoints/threads/index.ts` (new)
- **Pattern**: Follow `repos/backend/src/endpoints/apiKeys/apiKeys.ts` -- export config with path `/threads`, method `EPMethod.Use`, endpoints object
- **Complexity**: Trivial
- **Prerequisites**: T-001.1 through T-001.5

**T-001.7: Register threads in accounts router**
- **File**: `repos/backend/src/endpoints/accounts.ts` (modify)
- **Change**: Import `threads` from `@TBE/endpoints/threads`, add to endpoints object
- **Complexity**: Trivial
- **Prerequisites**: T-001.6

**T-001.8: Create `threads.test.ts` test suite**
- **File**: `repos/backend/src/endpoints/threads/threads.test.ts` (new)
- **Pattern**: Follow `repos/backend/src/endpoints/apiKeys/apiKeys.test.ts` -- mock db.services.thread, test each endpoint action
- **Complexity**: Medium
- **Prerequisites**: T-001.1 through T-001.7
- **Coverage**: All 5 CRUD operations, permission checks, quota increment, error cases

---

## FEAT-002: Messages CRUD Endpoints

**Goal**: Full CRUD for messages within threads, scoped to org/project with permission checks and thread-scoped listing.

**Data Model** (already exists):
- `Message`: id, type ("user"|"assistant"|"system"|"tool"|"action"), content (jsonb, NOT NULL), threadId (NOT NULL, cascade), meta?, orgId?, projectId?
- Relations: has many assets, belongs to thread/org/project

**Admin API Stub** (already exists at `repos/admin/src/services/messagesApi.ts`):
- list, getByThread, get, create, update, delete -- will work once backend endpoints exist

### Tasks

**T-002.1: Create `listMessages.ts` endpoint**
- **File**: `repos/backend/src/endpoints/messages/listMessages.ts` (new)
- **Pattern**: Follow `listApiKeys.ts` -- require orgId, support threadId and projectId filters, checkPermission(read, message)
- **Permission**: `EPermAction.read`, `EPermResource.message`
- **Note**: Admin stub has `getByThread(threadId)` -- implement as query param filter, not separate endpoint
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: List by orgId, filter by threadId, filter by projectId, 400 without orgId

**T-002.2: Create `getMessage.ts` endpoint**
- **File**: `repos/backend/src/endpoints/messages/getMessage.ts` (new)
- **Pattern**: Follow `getApiKey.ts` -- get by id, 404 if not found, checkPermission with data.orgId
- **Permission**: `EPermAction.read`, `EPermResource.message`
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Get existing, 404 missing, 403 wrong org

**T-002.3: Create `createMessage.ts` endpoint**
- **File**: `repos/backend/src/endpoints/messages/createMessage.ts` (new)
- **Pattern**: Follow `createApiKey.ts` -- validate body (type, content, threadId required), checkPermission(create, message), verify thread exists, db.services.message.create(), return 201
- **Permission**: `EPermAction.create`, `EPermResource.message`
- **Quota**: Increment `messages` quota via `db.services.quota.increment(orgId, period, "messages", 1)`
- **Validation**: type must be one of: "user", "assistant", "system", "tool", "action"
- **Complexity**: Medium (thread verification + quota)
- **Prerequisites**: FEAT-001 (threads must exist to reference)
- **Tests**: Create valid, 400 missing fields, 400 invalid type, 404 thread not found, quota increment

**T-002.4: Create `updateMessage.ts` endpoint**
- **File**: `repos/backend/src/endpoints/messages/updateMessage.ts` (new)
- **Pattern**: Follow `updateApiKey.ts` -- get existing, checkPermission(update, message), validate allowed fields (content, meta, type)
- **Permission**: `EPermAction.update`, `EPermResource.message`
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Update content, update meta, 404 missing, 403 wrong org

**T-002.5: Create `deleteMessage.ts` endpoint**
- **File**: `repos/backend/src/endpoints/messages/deleteMessage.ts` (new)
- **Pattern**: Follow `deleteApiKey.ts` -- get existing, checkPermission(delete, message), delete, return success
- **Permission**: `EPermAction.delete`, `EPermResource.message`
- **Note**: Assets cascade-delete via FK constraint (messageId ON DELETE CASCADE)
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Delete existing, 404 missing, 403 wrong org

**T-002.6: Create `messages.ts` config + `index.ts` barrel**
- **Files**: `repos/backend/src/endpoints/messages/messages.ts` (new), `repos/backend/src/endpoints/messages/index.ts` (new)
- **Pattern**: Follow `apiKeys/apiKeys.ts` -- path `/messages`, method `EPMethod.Use`
- **Complexity**: Trivial
- **Prerequisites**: T-002.1 through T-002.5

**T-002.7: Register messages in accounts router**
- **File**: `repos/backend/src/endpoints/accounts.ts` (modify)
- **Change**: Import `messages` from `@TBE/endpoints/messages`, add to endpoints object
- **Complexity**: Trivial
- **Prerequisites**: T-002.6

**T-002.8: Create `messages.test.ts` test suite**
- **File**: `repos/backend/src/endpoints/messages/messages.test.ts` (new)
- **Pattern**: Follow `apiKeys/apiKeys.test.ts`
- **Complexity**: Medium
- **Prerequisites**: T-002.1 through T-002.7
- **Coverage**: All 5 CRUD operations, thread-scoped listing, type validation, quota increment, permission checks

---

## FEAT-003: Assets CRUD Endpoints + Upload/Download

**Goal**: Full CRUD for assets with exclusive-arc ownership (org OR project OR user OR thread OR message), plus file upload/download support.

**Data Model** (already exists):
- `Asset`: id, name (NOT NULL), type (NOT NULL), url?, content (jsonb)?, meta?, providerId?, orgId?, userId?, threadId?, projectId?, messageId?
- DB-level CHECK: exactly ONE of orgId/projectId/userId/threadId/messageId must be non-null
- Relations: belongs to org/project/user/thread/message/provider

**Admin API Stub** (already exists at `repos/admin/src/services/assetsApi.ts`):
- list, getByThread, getByMessage, get, create, update, delete -- will work once backend endpoints exist
- Note: upload method not yet in admin stub (Phase 2 enhancement)

### Tasks

**T-003.1: Create `listAssets.ts` endpoint**
- **File**: `repos/backend/src/endpoints/assets/listAssets.ts` (new)
- **Pattern**: Follow `listApiKeys.ts` -- require orgId, support threadId/projectId/messageId/userId filters, checkPermission(read, asset)
- **Permission**: `EPermAction.read`, `EPermResource.asset`
- **Complexity**: Medium (many filter combinations)
- **Prerequisites**: None
- **Tests**: List by orgId, filter by threadId, filter by messageId, 400 without orgId

**T-003.2: Create `getAsset.ts` endpoint**
- **File**: `repos/backend/src/endpoints/assets/getAsset.ts` (new)
- **Pattern**: Follow `getApiKey.ts` -- get by id, 404 if not found, resolve orgId from asset ownership chain
- **Permission**: `EPermAction.read`, `EPermResource.asset`
- **Note**: Must resolve orgId -- asset may only have threadId/messageId, need to walk up to find org
- **Complexity**: Medium (ownership resolution)
- **Prerequisites**: None
- **Tests**: Get by direct orgId, get by threadId ownership, 404 missing

**T-003.3: Create `createAsset.ts` endpoint**
- **File**: `repos/backend/src/endpoints/assets/createAsset.ts` (new)
- **Pattern**: Follow `createApiKey.ts` -- validate body (name, type required), validate exclusive-arc (exactly one owner field), checkPermission(create, asset), return 201
- **Permission**: `EPermAction.create`, `EPermResource.asset`
- **Validation**: Exactly one of orgId/projectId/userId/threadId/messageId must be provided (mirrors DB CHECK constraint)
- **Complexity**: Medium (exclusive-arc validation)
- **Prerequisites**: None
- **Tests**: Create with orgId, create with threadId, 400 no owner, 400 multiple owners, 403 permission

**T-003.4: Create `updateAsset.ts` endpoint**
- **File**: `repos/backend/src/endpoints/assets/updateAsset.ts` (new)
- **Pattern**: Follow `updateApiKey.ts` -- get existing, checkPermission(update, asset), validate allowed fields (name, type, url, content, meta)
- **Permission**: `EPermAction.update`, `EPermResource.asset`
- **Note**: Owner fields (orgId, projectId, etc.) should NOT be updatable after creation
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Update name, update content, reject owner field change, 404 missing

**T-003.5: Create `deleteAsset.ts` endpoint**
- **File**: `repos/backend/src/endpoints/assets/deleteAsset.ts` (new)
- **Pattern**: Follow `deleteApiKey.ts` -- get existing, checkPermission(delete, asset), delete, return success
- **Permission**: `EPermAction.delete`, `EPermResource.asset`
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Delete existing, 404 missing, 403 wrong org

**T-003.6: Create `assets.ts` config + `index.ts` barrel**
- **Files**: `repos/backend/src/endpoints/assets/assets.ts` (new), `repos/backend/src/endpoints/assets/index.ts` (new)
- **Pattern**: Follow `apiKeys/apiKeys.ts` -- path `/assets`, method `EPMethod.Use`
- **Complexity**: Trivial
- **Prerequisites**: T-003.1 through T-003.5

**T-003.7: Register assets in accounts router**
- **File**: `repos/backend/src/endpoints/accounts.ts` (modify)
- **Change**: Import `assets` from `@TBE/endpoints/assets`, add to endpoints object
- **Complexity**: Trivial
- **Prerequisites**: T-003.6

**T-003.8: Create `assets.test.ts` test suite**
- **File**: `repos/backend/src/endpoints/assets/assets.test.ts` (new)
- **Pattern**: Follow `apiKeys/apiKeys.test.ts`
- **Complexity**: High (exclusive-arc validation permutations)
- **Prerequisites**: T-003.1 through T-003.7
- **Coverage**: All 5 CRUD operations, exclusive-arc validation (6 owner combos), ownership resolution, permission checks

**T-003.9: Create `uploadAsset.ts` endpoint (Phase 2)**
- **File**: `repos/backend/src/endpoints/assets/uploadAsset.ts` (new)
- **Pattern**: New pattern -- multipart form upload via `multer` or similar middleware
- **Method**: `EPMethod.Post`, path `/upload`
- **Note**: Stores file content in asset.content (jsonb) or external storage (TBD)
- **Complexity**: High (new middleware pattern, file handling)
- **Prerequisites**: T-003.3 (create must work first)
- **Cross-repo**: May need admin API stub update (`assetsApi.ts` upload method)
- **Tests**: Upload file, size limits, type validation, 400 missing file

**T-003.10: Create `downloadAsset.ts` endpoint (Phase 2)**
- **File**: `repos/backend/src/endpoints/assets/downloadAsset.ts` (new)
- **Pattern**: New pattern -- stream file content from asset.content or external storage
- **Method**: `EPMethod.Get`, path `/:id/download`
- **Complexity**: Medium (content-type headers, streaming)
- **Prerequisites**: T-003.9 (upload must work first)
- **Tests**: Download existing, 404 missing, content-type headers correct

---

## FEAT-004: Subscription Plan Changes (Upgrade/Downgrade)

**Goal**: Allow users to change their subscription plan (upgrade or downgrade) through the Polar.sh API.

**Current State**:
- `createCheckout` exists for new subscriptions
- `cancelSubscription` exists for cancellation
- Missing: change plan (upgrade/downgrade) while keeping same customer

**Polar.sh API**: Uses `@polar-sh/sdk` -- subscription updates are done via `polar.subscriptions.update()`

### Tasks

**T-004.1: Add `updateSubscription` to BaseService (abstract method)**
- **File**: `repos/backend/src/services/payments/strategies/base.ts` (modify)
- **Change**: Add abstract method: `abstract updateSubscription(subscriptionId: string, newProductId: string, newPriceId: string): Promise<{ data?: { success: boolean }; error?: Error }>`
- **Complexity**: Low
- **Prerequisites**: None

**T-004.2: Implement `updateSubscription` in PolarService**
- **File**: `repos/backend/src/services/payments/strategies/polar.ts` (modify)
- **Change**: Implement using `this.polar.subscriptions.update({ id: subscriptionId, body: { productPriceId: newPriceId } })`
- **Note**: Polar handles proration automatically
- **Complexity**: Medium (Polar API integration, error handling)
- **Prerequisites**: T-004.1
- **Tests**: Add to `repos/backend/src/services/payments/strategies/polar.test.ts`

**T-004.3: Create `changeSubscription.ts` endpoint**
- **File**: `repos/backend/src/endpoints/subscriptions/changeSubscription.ts` (new)
- **Pattern**: Follow `createCheckout.ts` -- require authenticated user, validate body (tier required), look up current subscription, validate tier change is allowed (not same tier), get new product/price, call payments.service.updateSubscription(), update DB via db.services.subscription.upsertByUser()
- **Method**: `EPMethod.Post`, path `/change`
- **Body**: `{ tier: string }` (e.g., "basic", "developer", "pro")
- **Validation**: Cannot change to current tier, cannot change to free (must cancel instead), must have active subscription
- **Complexity**: High (tier validation, Polar API, DB update)
- **Prerequisites**: T-004.2
- **Tests**: Upgrade, downgrade, reject same tier, reject free tier, 401 unauthenticated

**T-004.4: Register changeSubscription in subscriptions config**
- **File**: `repos/backend/src/endpoints/subscriptions/subscriptions.ts` (modify)
- **Change**: Import and add `changeSubscription` to endpoints object
- **Complexity**: Trivial
- **Prerequisites**: T-004.3

**T-004.5: Update admin `subscriptionsApi.ts` with changePlan method**
- **File**: `repos/admin/src/services/subscriptionsApi.ts` (modify)
- **Change**: Add `changePlan(tier: string)` method calling `POST /subscriptions/change`
- **Complexity**: Low
- **Prerequisites**: T-004.3

**T-004.6: Add `changeSubscription` tests to subscriptions.test.ts**
- **File**: `repos/backend/src/endpoints/subscriptions/subscriptions.test.ts` (modify)
- **Complexity**: Medium
- **Prerequisites**: T-004.3
- **Coverage**: Upgrade free->basic, upgrade basic->pro, downgrade pro->basic, reject same tier, reject to free, 401 unauthenticated, Polar API error handling

**T-004.7: Add webhook handler for subscription_updated event**
- **File**: `repos/backend/src/services/payments/strategies/polar.ts` (modify)
- **Change**: In `webhook()` method, handle `subscription.updated` event to sync tier/price changes from Polar back to local DB
- **Note**: Polar may send this event asynchronously after plan change
- **Complexity**: Medium
- **Prerequisites**: T-004.2
- **Tests**: Mock webhook payload for subscription.updated, verify DB update

---

## FEAT-005: Payment History & Invoices

**Goal**: Allow users to view their payment history and download invoices via the Polar.sh API.

**Current State**:
- No payment history or invoice endpoints exist
- Payments config only has webhook endpoint
- Polar SDK provides `polar.orders.list()` and `polar.orders.get()` for transaction history

### Tasks

**T-005.1: Add `getPaymentHistory` and `getInvoice` to BaseService**
- **File**: `repos/backend/src/services/payments/strategies/base.ts` (modify)
- **Change**: Add two abstract methods:
  - `abstract getPaymentHistory(customerId: string, opts?: { limit?: number; offset?: number }): Promise<{ data?: any[]; error?: Error }>`
  - `abstract getInvoice(orderId: string): Promise<{ data?: any; error?: Error }>`
- **Complexity**: Low
- **Prerequisites**: None

**T-005.2: Implement `getPaymentHistory` and `getInvoice` in PolarService**
- **File**: `repos/backend/src/services/payments/strategies/polar.ts` (modify)
- **Change**: Implement using `this.polar.orders.list({ customerId })` and `this.polar.orders.get({ id: orderId })`
- **Complexity**: Medium (Polar API integration)
- **Prerequisites**: T-005.1
- **Tests**: Add to `polar.test.ts` -- mock Polar orders API

**T-005.3: Create `listPayments.ts` endpoint**
- **File**: `repos/backend/src/endpoints/payments/listPayments.ts` (new)
- **Pattern**: Require authenticated user, get subscription to find polarCustomerId, call payments.service.getPaymentHistory(customerId), return paginated list
- **Method**: `EPMethod.Get`, path `/`
- **Complexity**: Medium
- **Prerequisites**: T-005.2
- **Tests**: List payments, empty list for free user, 401 unauthenticated, pagination

**T-005.4: Create `getInvoice.ts` endpoint**
- **File**: `repos/backend/src/endpoints/payments/getInvoice.ts` (new)
- **Pattern**: Require authenticated user, verify order belongs to user (via customerId match), call payments.service.getInvoice(orderId), return invoice data
- **Method**: `EPMethod.Get`, path `/:orderId/invoice`
- **Complexity**: Medium (ownership verification)
- **Prerequisites**: T-005.2
- **Tests**: Get invoice, 404 missing, 403 wrong user, 401 unauthenticated

**T-005.5: Register new endpoints in payments config**
- **File**: `repos/backend/src/endpoints/payments/payments.ts` (modify)
- **Change**: Import and add `listPayments` and `getInvoice` to endpoints object
- **Note**: These endpoints need authentication (unlike webhook which is public). May need to split payments config or add middleware selectively.
- **Complexity**: Medium (auth middleware consideration)
- **Prerequisites**: T-005.3, T-005.4

**T-005.6: Create `payments.test.ts` additions**
- **File**: `repos/backend/src/endpoints/payments/payments.test.ts` (new or modify)
- **Complexity**: Medium
- **Prerequisites**: T-005.3, T-005.4
- **Coverage**: List payments, get invoice, ownership checks, auth required, pagination

---

## FEAT-006: Quota Manual Management

**Goal**: Admin endpoints to manually adjust quota counters (for support/debugging), with owner-only restrictions.

**Current State**:
- `getOrgQuota` -- read current usage (exists)
- `getOrgLimits` -- read plan limits (exists)
- `checkQuota` -- check if action allowed (exists)
- Missing: update (set specific values) and reset (zero out) quota counters

**Quota DB service** (`repos/database/src/services/quota.ts`):
- Has `increment()` for atomic counter updates
- Needs new `setUsage()` and `resetPeriod()` methods

### Tasks

**T-006.1: Add `setUsage` method to Quota DB service**
- **File**: `repos/database/src/services/quota.ts` (modify)
- **Change**: Add method `setUsage(orgId: string, period: string, key: string, value: number)` -- directly sets a specific quota counter
- **Validation**: value must be >= 0, key must be valid resource name
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Add to `repos/database/src/services/quota.test.ts`

**T-006.2: Add `resetPeriod` method to Quota DB service**
- **File**: `repos/database/src/services/quota.ts` (modify)
- **Change**: Add method `resetPeriod(orgId: string, period: string)` -- resets all counters to 0 for a given period (keeps the record, zeroes values)
- **Complexity**: Low
- **Prerequisites**: None
- **Tests**: Add to `repos/database/src/services/quota.test.ts`

**T-006.3: Create `updateQuota.ts` endpoint**
- **File**: `repos/backend/src/endpoints/quotas/updateQuota.ts` (new)
- **Pattern**: Follow `checkQuota.ts` -- require orgId param, validate body (resource, value required), requireOrgOwner (NOT just member), call db.services.quota.setUsage()
- **Method**: `EPMethod.Patch`, path `/:orgId`
- **Body**: `{ resource: string, value: number }`
- **Permission**: Owner-only (`EPermAction.manage`, `EPermResource.quota` or custom owner check)
- **Complexity**: Medium (owner-only restriction)
- **Prerequisites**: T-006.1
- **Tests**: Update as owner, 403 as member, 400 invalid resource, 400 negative value

**T-006.4: Create `resetQuota.ts` endpoint**
- **File**: `repos/backend/src/endpoints/quotas/resetQuota.ts` (new)
- **Pattern**: Follow `checkQuota.ts` -- require orgId param, requireOrgOwner, call db.services.quota.resetPeriod()
- **Method**: `EPMethod.Post`, path `/:orgId/reset`
- **Body**: `{ period?: string }` (defaults to current period)
- **Permission**: Owner-only
- **Complexity**: Medium
- **Prerequisites**: T-006.2
- **Tests**: Reset as owner, 403 as member, reset with custom period, reset with default period

**T-006.5: Register new endpoints in quotas config**
- **File**: `repos/backend/src/endpoints/quotas/quotas.ts` (modify)
- **Change**: Import and add `updateQuota` and `resetQuota` to endpoints object
- **Complexity**: Trivial
- **Prerequisites**: T-006.3, T-006.4

**T-006.6: Update admin `quotasApi.ts` with management methods**
- **File**: `repos/admin/src/services/quotasApi.ts` (modify)
- **Change**: Add `update(orgId, resource, value)` and `reset(orgId, period?)` methods
- **Complexity**: Low
- **Prerequisites**: T-006.3, T-006.4

**T-006.7: Add quota management tests**
- **File**: `repos/backend/src/endpoints/quotas/quotas.test.ts` (modify)
- **Complexity**: Medium
- **Prerequisites**: T-006.3, T-006.4
- **Coverage**: Update specific resource, reset all counters, owner-only access, invalid resource name, negative value rejection

---

## Implementation Order

### Phase 1: Threads + Messages (can be done in parallel)
- **FEAT-001**: Threads CRUD (T-001.1 through T-001.8)
- **FEAT-002**: Messages CRUD (T-002.1 through T-002.8)
- **Estimated effort**: 1-2 sessions
- **Dependencies**: None (all infrastructure exists)
- **Note**: Messages depend on threads at runtime (threadId FK), but the endpoints can be developed independently since mocks handle the FK relationship in tests

### Phase 2: Assets
- **FEAT-003**: Assets CRUD + Upload/Download (T-003.1 through T-003.10)
- **Estimated effort**: 1-2 sessions
- **Dependencies**: Phase 1 recommended (for thread/message-scoped assets)
- **Note**: Upload/download (T-003.9, T-003.10) can be deferred further if needed

### Phase 3: Subscription Changes + Payment History (can be done in parallel)
- **FEAT-004**: Plan Changes (T-004.1 through T-004.7)
- **FEAT-005**: Payment History (T-005.1 through T-005.6)
- **Estimated effort**: 1-2 sessions
- **Dependencies**: None (existing payment service infrastructure)
- **Note**: Requires Polar.sh API documentation review for exact SDK methods

### Phase 4: Quota Management
- **FEAT-006**: Manual Quota Management (T-006.1 through T-006.7)
- **Estimated effort**: 1 session
- **Dependencies**: None (existing quota infrastructure)

---

## Cross-Repo Dependency Map

| Backend Change | Database Change | Domain Change | Admin Change |
|---------------|-----------------|---------------|--------------|
| threads/ endpoints | None | None | None (stub exists) |
| messages/ endpoints | None | None | None (stub exists) |
| assets/ endpoints | None | None | Upload method (Phase 2) |
| accounts.ts (register) | None | None | None |
| changeSubscription endpoint | None | None | changePlan() method |
| listPayments/getInvoice | None | None | New paymentsApi methods |
| updateQuota/resetQuota | setUsage()/resetPeriod() | None | update()/reset() methods |
| BaseService new abstracts | None | None | None |
| PolarService implementations | None | None | None |

**Key insight**: Database schemas, services, and domain models are already complete for all 6 features. The work is primarily in the backend endpoints layer with minor cross-repo changes in admin API stubs and database service methods (FEAT-006 only).
