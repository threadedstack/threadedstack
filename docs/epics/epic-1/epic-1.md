# Phase 1: Base Setup

**Goal:** Operational Monorepo, Database Connectivity, Auth Backbone, and Basic UI.

## 1. Infrastructure & Monorepo Initialization

* Initialize Pnpm workspace.
* Create directory structure: `repos/backend`, `repos/proxy`, `repos/admin`, `repos/database`, `repos/domain`.
* Setup `deployment/Dockerfile.(*)` for each individual service
  * `*` === directory name of the sub-repo (i.e. `backend`, `proxy`, `admin`)
* Setup `deployment/values(*).yaml` for each environment.
  * `*` === environment name (i.e. `local`, `develop`, `staging`, `production`)

## 2. Database & Domain

* Create shared Types/Interfaces in `repos/domain`.
* Implement Drizzle ORM schemas in `repos/database`.
* Generate SQL migrations and export DB client.
* Ensure database connection config loads from `/deployment`.

## 3. Auth-Proxy (The Gatekeeper)

* Setup Pnpm + Express server in `repos/proxy`.
* Integrate Neon Auth (`@neondatabase/neon-js`) for backend authentication and JWT token generation.
* Implement Auth endpoints: as needed via `POST /auth/*` endpoints
* Implement Forwarding Logic: Forward `/_/*` requests to the Backend port.

## 4. Backend Core

* Setup Pnpm + Express server in `repos/backend`.
* Implement API stubs (Users, Orgs).
* Create `GET /_/orgs` endpoint to verify DB read connectivity.

## 5. Admin UI (Skeleton)

* Scaffold Vite + React + TS in `repos/admin`.
* Implement Authentication Layer (Login Page & Store JWT).
* Build Sidebar Navigation (Orgs, Projects, Config/Settings).
* Connect UI services to call `/_/*` endpoints via the Proxy.


## Deliverables / Acceptance Criteria

* User can Register, Login, Create a Org, and View the Org via the UI.