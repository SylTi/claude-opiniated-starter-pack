# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Rules

**⚠️ CRITICAL: The following rule files MUST ALWAYS be followed without exception:**
**ALWAYS read and follow all rules in `.claude/rules/*.md` before making changes.**

DO NOT UNDER ANY CIRCUNSTANCES DELETE FILES OR REVERT CHANGES WITHOUT GETTING EXPLICIT PERMISSION

- [Coding Rules](.claude/rules/coding.md) - Best practices, principles (DRY, SOLID, KISS, YAGNI), testing requirements
- [Infrastructure Rules](.claude/rules/infrastructure.md) - Docker database usage, documentation maintenance
- [Migration Rules](.claude/rules/migrations.md) - Database migrations, seed data, never run migrations directly
- [Test Rules](.claude/rules/test.md) - Test hierarchy (unit → integration → E2E), mocking strategy, API coverage

## Architecture Overview

This is a **TypeScript monorepo** for a SaaS application using pnpm workspaces.

### Key Architecture Principles

1. **Strict TypeScript everywhere** - No `any`, explicit return types required
2. **Convention over configuration** - Follow established patterns
3. **Backend is source of truth** - No business logic in frontend
4. **Shared types** - `@saas/shared` package for end-to-end type safety

### Monorepo Structure

```
apps/
  web/          → Next.js 15 (App Router) frontend
  api/          → AdonisJS 6 backend (MVC)
packages/
  shared/       → Shared TypeScript types (types only, no runtime)
  config/       → Shared configs (ESLint, TypeScript)
infra/
  supabase/     → SQL migrations (reference, not used by backend)
```

### Communication Pattern

- Frontend consumes REST API at `/api/v1/*`
- Types from `@saas/shared` ensure consistency
- Backend uses Lucid ORM to connect to PostgreSQL (Supabase for prod)
- Frontend has NO direct database access

## Branch Strategy (Public vs Enterprise)

This repo uses two branches to maintain both a public open-source version and a private enterprise version:

| Branch | Purpose | Contains |
|--------|---------|----------|
| `public/main` | Public/open-source repo | All general features |
| `main` | Private/enterprise repo | All features + enterprise-only (SSO, etc.) |

### Key Principle

**All shared files must be identical on both branches.** Enterprise features use dynamic imports that silently skip when the module is absent.

### Dynamic Import Pattern for Enterprise Features

When a shared file needs to reference enterprise-only code, use this pattern:

**For routes (`start/routes.ts`):**
```typescript
// At the end of routes.ts
// @ts-ignore - Enterprise feature: module may not exist on public repo
import('#start/routes_sso').catch(() => {})
```

**For controllers/services:**
```typescript
// Dynamic import with try/catch
try {
  // @ts-ignore - Enterprise feature: module may not exist on public repo
  const ssoModule = await import('#services/sso/index')
  const result = await ssoModule.ssoService.someMethod()
  // Use result...
} catch {
  // Enterprise module not available — use default behavior
}
```

**For constants/permissions:**
```typescript
// Create separate file for enterprise constants (e.g., permissions_sso.ts)
// Import dynamically where needed, or use type assertions when mixing
```

### Enterprise-Only Files (exist only on `main`)

All enterprise features are gated via `start/routes_enterprise_all.ts`, which dynamically imports each feature's route file. These files/directories are NOT on `public/main`:

**Enterprise gate (consolidated import):**
- `start/routes_enterprise_all.ts` — imports all enterprise route files below
- `start/routes_enterprise.ts` — control plane routes

**SSO:**
- `start/routes_sso.ts`, `start/limiter_sso.ts`
- `app/constants/permissions_sso.ts`
- `app/controllers/sso_controller.ts`, `app/controllers/sso_config_controller.ts`
- `app/models/tenant_sso_config.ts`, `app/models/sso_user_identity.ts`, `app/models/sso_state.ts`
- `app/services/sso/*`
- `app/validators/sso.ts`
- `commands/cleanup_sso_states.ts`
- SSO-related migrations (`*_sso_*`)

**Control Plane (Enterprise feature management):**
- `app/constants/permissions_enterprise.ts`
- `app/controllers/admin_enterprise_controller.ts`, `app/controllers/tenant_enterprise_controller.ts`
- `app/models/tenant_enterprise_state.ts`, `app/models/deployment_enterprise_state.ts`, `app/models/enterprise_drift_incident.ts`
- `app/services/enterprise/*`
- `app/validators/enterprise.ts`
- Enterprise-related migrations (`*_enterprise_*`, `*_deployment_enterprise_*`)
- `tests/functional/enterprise.spec.ts`

**Encryption at Rest:**
- `start/routes_encryption.ts`
- `app/controllers/encryption_controller.ts`
- `app/models/encryption_provider.ts`, `app/models/encryption_migration.ts`
- `app/services/encryption/*`
- `app/validators/encryption.ts`
- Encryption-related migrations (`*_encryption_*`)
- `tests/functional/encryption.spec.ts`

**BYOK (Bring Your Own Key):**
- `start/routes_byok.ts`
- `app/controllers/byok_controller.ts`
- `app/validators/byok.ts`
- BYOK-related migrations (`*_byok_*`)
- `tests/functional/byok.spec.ts`

**Vaults:**
- `start/routes_vaults.ts`
- `app/controllers/vaults_controller.ts`
- `app/models/vault.ts`, `app/models/vault_item.ts`
- `app/services/vaults/*`
- `app/validators/vaults.ts`
- Vaults-related migrations (`*_vaults_*`)
- `tests/functional/vaults.spec.ts`

**Audit Log:**
- `start/routes_audit_log.ts`
- `app/controllers/audit_logs_controller.ts`
- `app/models/audit_log.ts`
- `app/services/audit_log/*`
- `app/validators/audit_log.ts`
- Audit log migrations (`*_audit_logs_*`)

**Audit Sink (export/forward):**
- `start/routes_audit_sink.ts`
- `app/controllers/audit_sinks_controller.ts`
- `app/models/audit_sink.ts`, `app/models/audit_sink_delivery.ts`
- `app/services/audit_sink/*`
- `app/validators/audit_sink.ts`
- Audit sink migrations (`*_audit_sink*`)

**Encrypted Backups:**
- `start/routes_backup.ts`
- `app/controllers/encrypted_backups_controller.ts`
- `app/models/encrypted_backup.ts`
- `app/services/backup/*`
- `app/validators/backup.ts`
- Backup-related migrations (`*_backup*`)
- `tests/functional/backup.spec.ts`

**RBAC Extensions (rule packs):**
- `start/routes_rbac_extensions.ts`
- `app/services/rbac/*`
- `app/validators/rbac_extensions.ts`
- `tests/functional/rbac.spec.ts`

**DLP (Data Loss Prevention):**
- `start/routes_dlp.ts`
- `app/controllers/dlp_rules_controller.ts`
- `app/models/dlp_redaction_rule.ts`
- `app/services/dlp/*`
- `app/validators/dlp.ts`
- DLP-related migrations (`*_dlp_*`)

**Shared-file enterprise extensions (dynamic imports from shared code):**
- `tests/bootstrap_enterprise.ts` — enterprise table list for test truncation
- `app/services/plugins/plugin_boot_enterprise.ts` — enterprise availability check for plugin boot
- `database/seeders/test_data_seeder_enterprise.ts` — enterprise test data seeder

### Adding New Enterprise Features

1. Create feature files in dedicated directories (e.g., `app/services/analytics/`)
2. Create `start/routes_<feature>.ts` for feature routes
3. Add dynamic import to `start/routes_enterprise_all.ts`: `await import('#start/routes_<feature>').catch(() => {})`
4. In shared code, use dynamic imports with try/catch
5. Enterprise files only exist on `main` branch

### Syncing Changes

**All development happens on `main` (private branch).** Then cherry-pick to `public/main`:

- **Public features**: Develop on `main`, then cherry-pick commits to `public/main`
- **Enterprise features**: Develop on `main` only (do NOT cherry-pick to `public/main`)
- **Shared files are identical** so cherry-picks apply cleanly (no merge conflicts)

## Critical Rules

### Testing Database Strategy

**⚠️ ABSOLUTE RULE: NEVER run tests against Supabase cloud**

- **Unit tests**: Database MOCKED (no DB connection)
- **Integration tests**: Docker PostgreSQL local (port 5433)
- **Development**: Supabase cloud OR Docker PostgreSQL (port 5432)
- **Production**: Supabase cloud only

Setup test environment:
```bash
pnpm run test:setup  # Automated setup with Docker
```

See `docs/testing-database.md` for complete strategy.

### Code Style

**Naming conventions differ by app:**
- Frontend (Next.js): `kebab-case` files, `PascalCase` components
- Backend (AdonisJS): `snake_case` files, `PascalCase` classes
- Database: `snake_case` tables/columns (plural tables: `users`, `blog_posts`)

**Always:**
- Use `async/await` (never `.then()`)
- Explicit return types on functions
- No `any` type (use `unknown` if needed)

### API Response Format

All API responses must follow this structure:

```typescript
// Success
{ "data": T | T[], "message"?: "Optional" }

// Error
{
  "error": "ErrorType",
  "message": "Human readable",
  "errors"?: [{ "field": "email", "message": "...", "rule": "..." }]
}
```

## Development Commands

### Initial Setup

```bash
pnpm install                       # Install all workspace dependencies
cd packages/shared && pnpm run build  # Build shared types
```

### Running Applications

```bash
# Development (both apps)
pnpm run dev

# Individual apps
pnpm run web:dev                   # Next.js on :3000
pnpm run api:dev                   # AdonisJS on :3333
```

### Testing

```bash
# Setup test DB (first time only)
pnpm run test:setup                # Starts Docker PostgreSQL + migrations

# Run tests
pnpm test                          # All tests (all workspaces)
pnpm run web:test                  # Frontend tests (Vitest)
pnpm run api:test                  # Backend tests (Japa)

# Backend specific
cd apps/api
node ace test unit                 # Unit tests only (mocked DB)
node ace test functional           # Integration tests (Docker DB)

# Docker management
pnpm run docker:test:up            # Start test DB
pnpm run docker:test:down          # Stop test DB
pnpm run docker:test:reset         # Reset test DB (drops data)
```

### Backend (AdonisJS)

```bash
cd apps/api

# Database
node ace migration:run            # Run migrations
node ace migration:rollback       # Rollback migrations
NODE_ENV=test node ace migration:run  # Migrate test DB

# Code generation
node ace make:model ModelName
node ace make:controller ControllerName
node ace make:migration create_table_name

# Other
node ace generate:key             # Generate APP_KEY for .env
```

### Frontend (Next.js)

```bash
cd apps/web

# shadcn/ui components
npx shadcn@latest add button      # Add UI components
npx shadcn@latest add card

# Tests
pnpm run test:watch               # Watch mode
pnpm run test:ui                  # UI mode
```

### Shared Package

```bash
cd packages/shared
pnpm run build                     # Compile TypeScript
pnpm run dev                       # Watch mode
```

## Backend Architecture (AdonisJS)

### MVC Pattern

- **Models** (`app/models/`): Lucid ORM models, use `#models/user` import alias
- **Controllers** (`app/controllers/`): HTTP request handlers, use `#controllers/users_controller`
- **Routes** (`start/routes.ts`): Route definitions, grouped under `/api/v1`

### Route Structure

Routes MUST be grouped under `/api/v1`:

```typescript
router.group(() => {
  router.get('/users', [UsersController, 'index'])
  router.get('/users/:id', [UsersController, 'show'])
}).prefix('/api/v1')
```

### Controller Pattern

```typescript
export default class UsersController {
  async index({ response }: HttpContext): Promise<void> {
    const users = await User.all()
    response.json({ data: users })  // Standard format
  }
}
```

### Database

- **ORM**: Lucid (built into AdonisJS)
- **Migrations**: Located in `database/migrations/`
- **Models**: Use decorators (`@column`, `@hasMany`, etc.)
- **Dev/Prod**: Connects to Supabase PostgreSQL
- **Tests**: NEVER use Supabase (use Docker local)

### Import Aliases (AdonisJS)

Configured in `adonisrc.ts`:
- `#models/*` → `app/models/*.js`
- `#controllers/*` → `app/controllers/*.js`
- `#services/*` → `app/services/*.js`

## Frontend Architecture (Next.js)

### App Router

- Server Components by default
- Pages in `app/` directory
- Layouts cascade down
- Example: `app/dashboard/page.tsx` → `/dashboard`

### UI Components

- **shadcn/ui**: Pre-built accessible components in `components/ui/`
- **Tailwind CSS**: Utility-first styling
- Import example: `import { Button } from '@/components/ui/button'`

### Path Alias

`@/*` → Root of `apps/web/` (configured in `tsconfig.json`)

## Shared Types Package

Located in `packages/shared/src/`:

- **Export pattern**: All types exported through `index.ts`
- **Types only**: No runtime code, only TypeScript interfaces/types
- **Usage**:
  - Backend: `import { UserDTO } from '@saas/shared'`
  - Frontend: `import { UserDTO } from '@saas/shared'`
- **Build required**: Run `pnpm run build` after changes

Example:
```typescript
// packages/shared/src/types/user.ts
export interface UserDTO {
  id: number
  email: string
  fullName: string | null
}
```

## Testing

### Frontend Tests (Vitest)

- **Location**: `apps/web/tests/`
- **Framework**: Vitest + React Testing Library + @testing-library/jest-dom
- **Setup**: `tests/setup.ts` configures jest-dom matchers
- **Matchers**: Use `toBeInTheDocument()`, `toHaveClass()`, `toBeDisabled()` instead of basic assertions

### Backend Tests (Japa)

**Two types:**

1. **Unit tests** (`tests/unit/`) - Database MOCKED
   - Test pure logic
   - No real DB connection
   - Fast (< 1s per test)

2. **Integration tests** (`tests/functional/`) - Docker PostgreSQL
   - Full API testing
   - Uses `testUtils.db().truncate()` for cleanup
   - Requires Docker running

**Test with Supertest or @japa/api-client:**
```typescript
// Option 1: @japa/api-client (recommended for AdonisJS)
const response = await client.get('/api/v1/users')
response.assertStatus(200)

// Option 2: Supertest (standard Node.js)
const response = await request(BASE_URL).get('/api/v1/users').expect(200)
```

## Environment Configuration

### Backend Environments

- **`.env`**: Development (Supabase cloud or local Docker)
- **`.env.test`**: Tests (Docker PostgreSQL on port 5433) - PRE-CONFIGURED
- **`.env.example`**: Template

⚠️ **Never commit `.env` files**

### Required for Development

1. Copy `.env.example` to `.env` in `apps/api/`
2. Configure Supabase credentials OR use Docker with `docker-compose up postgres-dev`
3. Generate `APP_KEY`: `node ace generate:key`

## Docker

Docker is used ONLY for testing (not required for development):

```bash
docker-compose up -d postgres-test    # Test DB (port 5433)
docker-compose up -d postgres-dev     # Dev DB (port 5432) - optional
```

See `DOCKER-TESTING.md` for full guide.

## Documentation

Critical docs in `docs/`:
- `testing-database.md` - Database strategy for tests (MUST READ)
- `conventions.md` - Code style and patterns
- `architecture.md` - System design
- `testing.md` - Testing guide
- `testing-setup.md` - Test tools configuration

## Common Patterns

### Adding a New API Endpoint

1. Create/update model: `node ace make:model Post`
2. Create migration: `node ace make:migration create_posts_table`
3. Run migration: `node ace migration:run`
4. Create controller: `node ace make:controller PostsController`
5. Add route in `start/routes.ts` under `/api/v1` group
6. Create types in `packages/shared/src/types/`
7. Build shared: `cd packages/shared && pnpm run build`
8. Write tests in `tests/functional/` and `tests/unit/`

### Adding a New Frontend Page

1. Create `app/your-page/page.tsx`
2. Import types from `@saas/shared`
3. Use shadcn/ui components from `@/components/ui/`
4. Write tests in `tests/pages/your-page.test.tsx`

### Adding shadcn/ui Component

```bash
cd apps/web
npx shadcn@latest add [component-name]
# Component appears in components/ui/
```

## Package Manager

**pnpm workspaces** - commands run from root apply to all workspaces:

```bash
pnpm install            # Installs all workspace dependencies
pnpm run build          # Builds all workspaces
pnpm test               # Tests all workspaces
```

Workspace-specific:
```bash
pnpm --filter web run dev              # Run script in specific workspace
pnpm --filter api add package-name     # Install in specific workspace
pnpm -r run dev                        # Run in all workspaces recursively
pnpm -r --parallel run dev             # Run in parallel
```

### Running E2E
# Run all E2E tests (Chromium only)
pnpm run web:e2e

# Run with visible browser
pnpm run web:e2e:headed

# Run with interactive UI
pnpm run web:e2e:ui

# Show report
cd ./apps/web/ && pnpm exec playwright show-report

- toujours utiliser pnpm a la place de npm
- toujours ajouter a docs/API.md quand on modifie ou ajoute une route.
- toujours verifier docs/API.md quand on doit ajouter une nouvelle fonctionnalité qui depend de l'existant pour eviter de faire des lectures inutiles dans les fichiers.
- ne jamais lancer les tests quand on fini une nouvelle fonctionnalité, mais toujours demander a l'utilisateur de le faire en lui affichants les commandes. Pareil pour le coverage.
- chaque fonctionnalité et element UX doit avoir son test unitaire/fonctionnel/E2E/etc qui valide son fonctionnement. 
- Toujours creer un mock pour les tests necessitant un call a un service exterieur a l'application. Exemple: Mail, Paiements etc. Ne pas mock la DB pour les E2E ou test d'integration, utilise la db de test.
- n'ecris jamais de placeholder tests, ecris directement les vrais tests.
- quand tu dois reparer un test, ne supprime jamais un check qui DOIT exister juste pour que le test pass. Au contraire si c'est une erreur du au code, va fixer le code.
- Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.
