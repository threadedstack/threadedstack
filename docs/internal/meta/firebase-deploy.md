# Firebase Deployment

All three UI apps (admin, threads, website) are hosted on Firebase under the `threaded-stack-prod` project. Each app has its own hosting target.

| App | Target | Firebase Site | Build Output |
|-----|--------|---------------|--------------|
| Admin | `admin` | `tdsk-admin` | `repos/admin/dist` |
| Threads | `threads` | `tdsk-threads` | `repos/threads/dist` |
| Website | `website` | `tdsk-website` | `repos/website/dist` |

## CI/CD (Automatic)

**Production deploys** happen automatically when changes are merged to the `production` branch. GitHub Actions builds all three apps in parallel and deploys them to the live channel.

**Preview deploys** happen automatically on PRs that touch any of these paths:
- `repos/admin/**`, `repos/threads/**`, `repos/website/**`
- `repos/domain/**`, `repos/components/**`
- `package.json`, `pnpm-lock.yaml`

Workflow files:
- `.github/workflows/firebase-hosting-merge.yml` (production)
- `.github/workflows/firebase-hosting-pull-request.yml` (PR previews)

## Manual Deploy

### Prerequisites

- Firebase CLI installed (`npm i -g firebase-tools`)
- Authenticated (`firebase login`)
- Access to the `threaded-stack-prod` project

### Deploy a Single App

```bash
# Build the app
pnpm --filter @tdsk/<app> build

# Deploy to production
firebase deploy --only hosting:<target> --project threaded-stack-prod
```

Replace `<app>` and `<target>` with one of: `admin`, `threads`, `website`.

Examples:

```bash
# Deploy admin
pnpm --filter @tdsk/admin build
firebase deploy --only hosting:admin --project threaded-stack-prod

# Deploy threads
pnpm --filter @tdsk/threads build
firebase deploy --only hosting:threads --project threaded-stack-prod

# Deploy website
pnpm --filter @tdsk/website build
firebase deploy --only hosting:website --project threaded-stack-prod
```

### Deploy All Apps

```bash
pnpm --filter @tdsk/admin --filter @tdsk/threads --filter @tdsk/website build
firebase deploy --only hosting --project threaded-stack-prod
```

### Deploy to a Preview Channel

```bash
pnpm --filter @tdsk/<app> build
firebase hosting:channel:deploy <channel-name> --only <target> --project threaded-stack-prod
```

## Configuration

Firebase config lives at the monorepo root:
- `firebase.json` — hosting targets, public directories, SPA rewrites
- `.firebaserc` — project and target mappings

All three apps use SPA rewrites (`** → /index.html`).
