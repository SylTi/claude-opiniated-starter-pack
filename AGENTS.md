# Repository Guidelines

## Unbreakable Rules
- Read and follow `.claude/rules/*.md` before making any changes.
- Always use `pnpm` (never `npm`).
- Never run tests against Supabase; local and test environments must use Docker Postgres.
- Write migrations and update seeders, but do not run migrations automatically; ask maintainers to run `node ace migration:run`.
- Use the standard API response shape and keep routes under `/api/v1`.
- Update `api.md` whenever API routes change and keep docs current.

## Project Structure & Module Organization
- Monorepo managed with pnpm workspaces.
- Frontend: `apps/web/` (Next.js App Router, UI components in `apps/web/components/`, pages in `apps/web/app/`).
- Backend: `apps/api/` (AdonisJS MVC; controllers in `apps/api/app/controllers/`, models in `apps/api/app/models/`, routes in `apps/api/start/routes.ts`).
- Shared types/config: `packages/shared/` (TypeScript types only) and `packages/config/`.
- Tests: `apps/web/tests/` (Vitest), `apps/api/tests/` (Japa).
- Infra/docs: `docs/`, `infra/`, `docker-compose.yml`, and `scripts/`.

## Architecture & API Conventions
- Backend is the source of truth; no business logic in the frontend.
- All API routes live under `/api/v1` in `apps/api/start/routes.ts`.
- API responses follow a strict shape: `{ data, message? }` for success, `{ error, message, errors? }` for failures.
- Use AdonisJS aliases (`#models`, `#controllers`, `#services`) instead of relative imports.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `pnpm run dev`: run web + api in dev mode.
- `pnpm run web:dev` / `pnpm run api:dev`: run a single app.
- `pnpm run build`: build all workspaces.
- `pnpm test`, `pnpm run web:test`, `pnpm run api:test`: run tests (never target Supabase).
- `pnpm run test:setup`: start Docker test DB + migrations.
- `pnpm run docker:test:up|down|reset`: manage test DB lifecycle.
- `cd packages/shared && pnpm run build`: build shared types after edits.

## Coding Style & Naming Conventions
- Indentation: 2 spaces (see `.editorconfig`).
- TypeScript strictness: explicit return types, `async/await` only, no `any`.
- Frontend files: `kebab-case`; React components: `PascalCase`.
- Backend files: `snake_case`; classes: `PascalCase`.
- Database: `snake_case` columns, plural table names.
- Linting via root `eslint.config.js` and shared config in `packages/config/`.

## Testing Guidelines
- Web: Vitest + React Testing Library (`apps/web/tests/`).
- API: Japa (`apps/api/tests/`), all API routes require unit tests.
- Test hierarchy: unit → integration → E2E; use mocks only in unit tests.
- Integration/E2E use Docker DB; truncate + reseed before runs.
- E2E (Playwright): `pnpm run web:e2e`, `pnpm run web:e2e:headed`.
- Mock external services (mail, payments) in unit tests only.

## Docs to Read First
- `docs/architecture.md` for system overview.
- `docs/testing-database.md` for the Docker DB testing workflow.

## Commit & Pull Request Guidelines
- Recent history uses short prefixes like `feat:`, `feature:`, `refactor:`, `update:`; follow a similar concise, descriptive style.
- PRs should include a brief summary, test commands run, and screenshots for UI changes.
- Update `api.md` whenever API routes change and keep docs in `docs/` current.

## Configuration & Data
- Do not commit `.env`; copy from `apps/api/.env.example`.
- Local and test environments use Docker Postgres.
- Write migrations and update seeders, but do not run migrations automatically; ask maintainers to run `node ace migration:run` when needed.
