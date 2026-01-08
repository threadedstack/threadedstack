# Epic 1: Base Setup - Task Tracking

**Goal:** Operational Monorepo, Database Connectivity, Auth Backbone, and Basic UI.

## Task Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## 1. Infrastructure & Monorepo Initialization

### 1.1 Pnpm Workspace Setup
- [x] **TASK-1.1.1**: Initialize pnpm workspace with `pnpm-workspace.yaml`
- [x] **TASK-1.1.2**: Create root `package.json` with workspace scripts

### 1.2 Directory Structure
- [x] **TASK-1.2.1**: Create `repos/backend` directory with package.json
- [x] **TASK-1.2.2**: Create `repos/proxy` directory with package.json
- [x] **TASK-1.2.3**: Create `repos/admin` directory with package.json
- [x] **TASK-1.2.4**: Create `repos/database` directory with package.json
- [x] **TASK-1.2.5**: Create `repos/domain` directory with package.json
- [x] **TASK-1.2.6**: Create `repos/logger` directory with package.json
- [x] **TASK-1.2.7**: Create `repos/components` directory with package.json
- [x] **TASK-1.2.8**: Create `repos/cli` directory with package.json

### 1.3 Deployment Configuration
- [x] **TASK-1.3.4**: Create `deploy/values.local.yaml`
- [x] **TASK-1.3.5**: Create `deploy/values.production.yaml`
- [x] **TASK-1.3.6**: Create `deploy/values.yaml` (base values)
- [~] **TASK-1.3.1**: Create `deploy/Dockerfile.backend`
- [~] **TASK-1.3.2**: Create `deploy/Dockerfile.proxy`
- [~] **TASK-1.3.3**: Create `deploy/Dockerfile.admin`
- [~] **TASK-1.3.7**: Create `deploy/devspace.yaml` for local development

---

## 2. Database & Domain

### 2.1 Shared Types/Interfaces
- [x] **TASK-2.1.1**: Create base model types in `repos/domain/src/models/base.ts`
- [x] **TASK-2.1.2**: Create user model in `repos/domain/src/models/user.ts`
- [x] **TASK-2.1.3**: Create team model in `repos/domain/src/models/team.ts`
- [x] **TASK-2.1.4**: Create repo model in `repos/domain/src/models/repo.ts`
- [x] **TASK-2.1.5**: Create provider model in `repos/domain/src/models/provider.ts`
- [ ] **TASK-2.1.6**: Create endpoint model in `repos/domain/src/models/endpoint.ts`
- [ ] **TASK-2.1.7**: Create secret model in `repos/domain/src/models/secret.ts`
- [ ] **TASK-2.1.8**: Create function model in `repos/domain/src/models/function.ts`
- [ ] **TASK-2.1.9**: Create thread model in `repos/domain/src/models/thread.ts`
- [ ] **TASK-2.1.10**: Create message model in `repos/domain/src/models/message.ts`

### 2.2 Drizzle ORM Schemas
- [x] **TASK-2.2.1**: Create users schema in `repos/database/src/schemas/users.ts`
- [x] **TASK-2.2.2**: Create teams schema in `repos/database/src/schemas/teams.ts`
- [x] **TASK-2.2.3**: Create repos schema in `repos/database/src/schemas/repos.ts`
- [x] **TASK-2.2.4**: Create roles schema in `repos/database/src/schemas/roles.ts`
- [x] **TASK-2.2.5**: Create assets schema in `repos/database/src/schemas/assets.ts`
- [x] **TASK-2.2.6**: Create configs schema in `repos/database/src/schemas/configs.ts`
- [x] **TASK-2.2.7**: Create secrets schema in `repos/database/src/schemas/secrets.ts`
- [x] **TASK-2.2.8**: Create threads schema in `repos/database/src/schemas/threads.ts`
- [x] **TASK-2.2.9**: Create messages schema in `repos/database/src/schemas/messages.ts`
- [x] **TASK-2.2.10**: Create endpoints schema in `repos/database/src/schemas/endpoints.ts`
- [x] **TASK-2.2.11**: Create providers schema in `repos/database/src/schemas/providers.ts`
- [x] **TASK-2.2.12**: Create functions schema in `repos/database/src/schemas/functions.ts`

### 2.3 Database Services (Query Interfaces)
- [x] **TASK-2.3.1**: Create base service class in `repos/database/src/services/base.ts`
- [x] **TASK-2.3.2**: Create user service in `repos/database/src/services/user.ts`
- [x] **TASK-2.3.3**: Create team service in `repos/database/src/services/team.ts`
- [x] **TASK-2.3.4**: Create repo service in `repos/database/src/services/repo.ts`
- [x] **TASK-2.3.5**: Create role service in `repos/database/src/services/role.ts`
- [x] **TASK-2.3.6**: Create secret service in `repos/database/src/services/secret.ts`
- [x] **TASK-2.3.7**: Create thread service in `repos/database/src/services/thread.ts`
- [x] **TASK-2.3.8**: Create message service in `repos/database/src/services/message.ts`
- [x] **TASK-2.3.9**: Create endpoint service in `repos/database/src/services/endpoint.ts`
- [x] **TASK-2.3.10**: Create provider service in `repos/database/src/services/provider.ts`
- [x] **TASK-2.3.11**: Create function service in `repos/database/src/services/function.ts`

### 2.4 Database Configuration
- [x] **TASK-2.4.1**: Implement database connection in `repos/database/src/database.ts`
- [x] **TASK-2.4.2**: Implement dialect detection in `repos/database/src/utils/database/getDialect.ts`
- [x] **TASK-2.4.3**: Implement DB URL builder in `repos/database/src/utils/database/buildDBUrl.ts`
- [ ] **TASK-2.4.4**: Generate initial SQL migrations
- [ ] **TASK-2.4.5**: Verify migrations run successfully against Neon PostgreSQL

---

## 3. Auth-Proxy (The Gatekeeper)

### 3.1 Proxy Server Setup
- [x] **TASK-3.1.1**: Initialize Express server in `repos/proxy/src/index.ts`
- [x] **TASK-3.1.2**: Create server configuration in `repos/proxy/src/server/index.ts`
- [x] **TASK-3.1.3**: Implement environment variables loading in `repos/proxy/src/constants/envs.ts`
- [ ] **TASK-3.1.4**: Implement proxy server logic in `repos/proxy/src/proxy.ts` (currently TODO stub)

### 3.2 Neon Auth Integration
- [ ] **TASK-3.2.1**: Install and configure `@neondatabase/neon-js` in proxy repo
- [ ] **TASK-3.2.2**: Implement JWT token validation middleware
- [ ] **TASK-3.2.3**: Implement session management

### 3.3 Auth Endpoints
- [ ] **TASK-3.3.1**: Implement `POST /auth/login` endpoint
- [ ] **TASK-3.3.2**: Implement `POST /auth/logout` endpoint
- [ ] **TASK-3.3.3**: Implement `POST /auth/refresh` token refresh endpoint
- [ ] **TASK-3.3.4**: Implement `GET /auth/me` current user endpoint

### 3.4 Forwarding Logic
- [ ] **TASK-3.4.1**: Implement `/_/*` request forwarding to Backend
- [ ] **TASK-3.4.2**: Configure proxy headers for backend requests
- [ ] **TASK-3.4.3**: Implement request/response logging

---

## 4. Backend Core

### 4.1 Backend Server Setup
- [x] **TASK-4.1.1**: Initialize Express 5 server in `repos/backend/src/index.ts`
- [x] **TASK-4.1.2**: Create app configuration in `repos/backend/src/server/app.ts`
- [x] **TASK-4.1.3**: Create router setup in `repos/backend/src/server/router.ts`
- [x] **TASK-4.1.4**: Implement middleware setup chain

### 4.2 Base API Endpoints
- [x] **TASK-4.2.1**: Implement health check endpoint in `repos/backend/src/endpoints/base/health.ts`
- [x] **TASK-4.2.2**: Implement base endpoint structure in `repos/backend/src/endpoints/base/base.ts`
- [x] **TASK-4.2.3**: Implement auth endpoint structure in `repos/backend/src/endpoints/auth/auth.ts`

### 4.3 Users API
- [ ] **TASK-4.3.1**: Implement `GET /_api/users` - List users
- [ ] **TASK-4.3.2**: Implement `GET /_api/users/:id` - Get user by ID
- [ ] **TASK-4.3.3**: Implement `POST /_api/users` - Create user
- [ ] **TASK-4.3.4**: Implement `PUT /_api/users/:id` - Update user
- [ ] **TASK-4.3.5**: Implement `DELETE /_api/users/:id` - Delete user

### 4.4 Teams API
- [ ] **TASK-4.4.1**: Implement `GET /_api/teams` - List teams (verify DB connectivity)
- [ ] **TASK-4.4.2**: Implement `GET /_api/teams/:id` - Get team by ID
- [ ] **TASK-4.4.3**: Implement `POST /_api/teams` - Create team
- [ ] **TASK-4.4.4**: Implement `PUT /_api/teams/:id` - Update team
- [ ] **TASK-4.4.5**: Implement `DELETE /_api/teams/:id` - Delete team
- [ ] **TASK-4.4.6**: Implement `POST /_api/teams/:id/members` - Add team member
- [ ] **TASK-4.4.7**: Implement `DELETE /_api/teams/:id/members/:userId` - Remove team member

---

## 5. Admin UI (Skeleton)

### 5.1 Vite + React Setup
- [x] **TASK-5.1.1**: Initialize Vite project with React + TypeScript
- [x] **TASK-5.1.2**: Configure path aliases via `alias-hq` (`@TAF/*`)
- [x] **TASK-5.1.3**: Set up MUI theming in `repos/admin/src/theme/`
- [x] **TASK-5.1.4**: Configure routing with `react-router`

### 5.2 Authentication Layer
- [x] **TASK-5.2.1**: Create Auth context in `repos/admin/src/contexts/AuthContext.ts`
- [x] **TASK-5.2.2**: Create Auth provider in `repos/admin/src/contexts/AuthProvider.tsx`
- [x] **TASK-5.2.3**: Implement Login page structure in `repos/admin/src/pages/Login/`
- [x] **TASK-5.2.4**: Create social login buttons (GitHub, GitLab, Google, Vercel)
- [ ] **TASK-5.2.5**: Implement actual authentication flow with Neon Auth
- [ ] **TASK-5.2.6**: Implement JWT token storage and refresh logic
- [ ] **TASK-5.2.7**: Implement protected route wrapper

### 5.3 Sidebar Navigation
- [x] **TASK-5.3.1**: Create Sidebar component in `repos/admin/src/components/Sidebar/`
- [x] **TASK-5.3.2**: Create SBNavList component for navigation items
- [x] **TASK-5.3.3**: Create SBLogo component
- [ ] **TASK-5.3.4**: Add navigation items: Teams, Repos, Config/Settings
- [ ] **TASK-5.3.5**: Implement active route highlighting

### 5.4 Core Pages
- [x] **TASK-5.4.1**: Create Layout component in `repos/admin/src/pages/Layout/`
- [x] **TASK-5.4.2**: Create Home page in `repos/admin/src/pages/Home/`
- [x] **TASK-5.4.3**: Create Account page structure in `repos/admin/src/pages/Account/`
- [ ] **TASK-5.4.4**: Implement Teams list page in `repos/admin/src/pages/Teams/Teams.tsx`
- [ ] **TASK-5.4.5**: Implement Team detail page in `repos/admin/src/pages/Teams/Team.tsx`
- [ ] **TASK-5.4.6**: Implement Team creation form
- [ ] **TASK-5.4.7**: Implement Repos list page in `repos/admin/src/pages/Repos/Repos.tsx`
- [ ] **TASK-5.4.8**: Implement Repo detail page in `repos/admin/src/pages/Repos/Repo.tsx`

### 5.5 API Services
- [x] **TASK-5.5.1**: Create base API utility in `repos/admin/src/utils/api/`
- [ ] **TASK-5.5.2**: Implement Teams API service
- [ ] **TASK-5.5.3**: Implement Users API service
- [ ] **TASK-5.5.4**: Implement Repos API service
- [ ] **TASK-5.5.5**: Configure API calls to use `/_/*` endpoints via Proxy

---

## Deliverables Checklist

- [ ] User can Register via social login (GitHub, GitLab, Google, Vercel)
- [ ] User can Login and receive JWT token
- [ ] User can Create a Team via the UI
- [ ] User can View the Team via the UI
- [ ] Backend `GET /_api/teams` returns data from database

---

## Dependencies

This epic has no dependencies on other epics.

## Notes

- The proxy repo currently has a TODO stub in `repos/proxy/src/proxy.ts` that needs implementation
- Teams and Repos pages in admin are placeholder stubs
- Database schemas are defined but migrations may need verification
- Neon Auth integration needs to be completed in both proxy and admin repos
