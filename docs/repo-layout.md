threaded-stack/
├── package.json              # Root workspace config
├── deployment/               # Deployment configs (Docker, Env)
│   ├── values(.*).yml        # ENV used by the application. `*` === environment (i.e. local, dev, prod)
│   └── Dockerfile.*          # `*` === name of sub-repo directory (i.e. backend, admin, proxy)
├── repos/
│   └── admin/                # React/Vite SPA
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   ├── backend/              # Core Logic API
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts      # Express App
│   ├── cli/                  # Internal developer CLI
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts      # CLI commands for running Threaded Stack
│   ├── components/           # Reusable React Components and hooks
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts      # Exported React Components and hooks
│   ├── database/             # ORM & Migrations
│   │   ├── package.json
│   │   ├── drizzle.config.ts # Schema management
│   │   └── src/
│   │       ├── schema.ts     # TS definition of your DB
│   │       └── index.ts      # DB Connection export
│   ├── domain/               # Shared types & and utilities
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   ├── logger/               # Shared logger for backend services
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   └── proxy/                # Auth Gateway
│       ├── package.json
│       └── src/
│           └── index.ts      # Express App
