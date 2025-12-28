# Threaded Stack: Specification

## 1. Architecture & Tech Stack

The application is a **Pnpm Monorepo** using Workspaces.

### Directory Structure & Sub-Repos

All code resides in `repos/`.

#### Auth-Proxy

* **Directory** - `/repos/proxy`
* **Tech** - Node.js / Express
* **Key Responsibilities:**
* **Authentication:** Implements OAuth client credentials flow, long-term API tokens, and short-term JWT minting/validation.
* **Routing Rules (Strict):**
  1. **Auth:** Handles `/auth/*` internally (Login, Token generation).
  2. **Admin UI:** Forwards `/_/*`  **Backend Admin API**.
  3. **User Proxies:** Forwards `/proxy/*`  **Backend Proxy API**.
  4. **FaaS:** Forwards `/faas/*`  **Backend FaaS API**.
  5. **AI:** Forwards `/ai/*`  **Backend AI API**.
* **Tasks**
  * Auth & Routing Gateway.
  * Handles CORS and rate limiting.
  * Termination point for external traffic.
  * Implements OAuth2 Client Credentials & JWT minting.


#### Backend

* **Directory** - `/repos/backend`
* **Tech** - Node.js / Express / WASM
* **Key Responsibilities:**
  * Express API that exposed endpoints called by the Auth-Proxy Service
  * Secure function execution within a WASM sandbox
  * Proxies requests to downstream URLs, injecting secrets/headers into requests as defined
* **Tasks**
  * Loads config from `/deployment` YAMLs
  * Propagate Redis/ValKey events for realtime and streaming 
  * Handle CRUD for Teams, Users, Secrets (i.e. *Admin API (`/_/*`)*)
  * LLM context management and streaming for **AI API** `/ai/*` endpoints
  * Handle WASM function execution for **FaaS Engine** `/faas/*` endpoints
  * Proxy user configured requests, including modification and secret injection for **Proxy Engine** `/proxy/*` endpoints

#### Database

* **Directory** - `/repos/database`
* **Tech** - Node.js / Drizzle ORM
* **Tasks**
  * Exports the singleton `db` instance.
  * Defines Drizzle Models (Schema), Migrations, and Seeds.
  * Loads config from `/deployment` YAMLs

#### Domain

* **Directory** - `/repos/domain`
* **Tech** - Node.js / Drizzle ORM
* **Tasks**
  * Shared Runtime Object Models, Utility Functions, and TypeScript Types
  * Exports code that can and should be shared across other sub-repos


#### Admin UI

* **Directory** - `/repos/admin`
* **Tech** - React + Vite
* **Tasks**
  * Admin dashboard UI
  * SPA for managing application resources.
  * Uses `Material-UI` components and `React-Router`.
  * Imports shared components from `/repos/components` sub-repo
  * Authenticated via Auth-Proxy interface.
  * **Navigation Structure:**
    * **Teams:** List/Create  Team View (Users, Config, Secrets, Providers, Assets).
    * **Repos:** List/Create (by Team)  Repo View (Endpoints, Config, Secrets, Assets).
    * **Profile/Config:** User specific settings.


#### Deployment

* **Directory** - `/deploy`
* **Tech** - Docker / Kubernetes / Devspace.io / Helm
* **Tasks**
  * Defines deployment config files *(i.e. Docker/YAML)*
    * `values(.*).yaml` - ENV and kubernetes configs used by the application. `*` === environment (i.e. `local`, `develop`, `staging` `production`)
    * All `Dockerfile.*` - `*` === name of sub-repo directory (i.e. `backend`, `admin`, `proxy`)
  * Helm chart for Kubernetes deployment


## 2. Database Schema

Uses **PostgreSQL**. Polymorphic relationships use the "Exclusive Arc" pattern (Check Constraints) to ensure a record belongs to only one parent.

| Table | Fields | Relationships / Constraints |
| --- | --- | --- |
| **`teams`** | `id`, `name`, `description`, `created_at`, `updated_at` | Has many: Users, Repos, Secrets, Assets, Providers. |
| **`users`** | `id`, `email` (unique), `full_name`, `password` (enc), `alt_email`, `bio`, `avatar_url` | Has many: Teams, Assets, Providers (auth). |
| **`repos`** | `id`, `name`, `git_url`, `branch`, `meta` (JSONB) | **Belongs to Team**. Has many: Secrets, Providers (git), Assets, Endpoints. |
| **`endpoints`** | `id`, `public` (bool), `proxy_url`, `proxy_method`, `proxy_headers` (JSONB), `proxy_options` (JSONB) | **Belongs to Repo**. Linked to Secrets (via Repo/Team). |
| **`functions`** | `id`, `content` (string), `language`, `dependencies` (JSONB array), `default_args` (JSONB) | **Belongs to Endpoint**. Has one Provider. |
| **`configs`** | `id`, `data` (JSONB) | **Polymorphic:** Belongs to User **OR** Team **OR** Repo (Exclusive). |
| **`providers`** | `id`, `type` (auth/git/ai/storage), `options` (JSONB) | **Belongs to Team** (usually) or User. |
| **`secrets`** | `id`, `name`, `encrypted_value`, `hash_key` | **Polymorphic:** Belongs to Team **OR** Repo. (Admins R/W, Users Read-Name-Only). |
| **`roles`** | `id`, `type` (super/admin/basic), `name` | **Polymorphic:** Links User to **Team** OR **Repo**. |
| **`threads`** | `id`, `name`, `public`, `meta` (JSONB) | **Belongs to User**. Links to Provider (AI) & Config. |
| **`messages`** | `id`, `type` (user/assistant/system/tool/action), `content` (JSONB), `meta` (JSONB) | **Belongs to Thread**. Has many Assets. |
| **`assets`** | `id`, `name`, `type`, `url`, `content` (JSONB), `meta` (JSONB) | **Polymorphic:** Belongs to Team/Repo/User/Thread/Message. Links to Provider (Storage). |

