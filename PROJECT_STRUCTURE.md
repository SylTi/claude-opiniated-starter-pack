# Structure Complète du Projet SaaS Monorepo

## Arborescence Générale

```
```
saas-monorepo/
.
├── .claude
│   ├── scripts
│   │   └── context-monitor.py
│   └── settings.local.json
├── .github
│   └── workflows
│       └── ci.yml
├── .gitignore
├── .husky
│   ├── _
│   │   ├── .gitignore
│   │   ├── applypatch-msg
│   │   ├── commit-msg
│   │   ├── h
│   │   ├── husky.sh
│   │   ├── post-applypatch
│   │   ├── post-checkout
│   │   ├── post-commit
│   │   ├── post-merge
│   │   ├── post-rewrite
│   │   ├── pre-applypatch
│   │   ├── pre-auto-gc
│   │   ├── pre-commit
│   │   ├── pre-merge-commit
│   │   ├── pre-push
│   │   ├── pre-rebase
│   │   └── prepare-commit-msg
│   └── pre-commit
├── CLAUDE.md
├── DOCKER-TESTING.md
├── PROJECT_STRUCTURE.md
├── PROJECT_STRUCTURE.txt
├── PROMPT-PAYMENT-PROVIDER.md
├── README.md
├── TODO.md
├── api.md
├── apps
│   ├── api
│   │   ├── .editorconfig
│   │   ├── .env
│   │   ├── .env.example
│   │   ├── .env.test
│   │   ├── .gitignore
│   │   ├── ace.js
│   │   ├── adonisrc.ts
│   │   ├── app
│   │   │   ├── abilities
│   │   │   │   └── main.ts
│   │   │   ├── controllers
│   │   │   │   ├── admin_controller.ts
│   │   │   │   ├── auth_controller.ts
│   │   │   │   ├── dashboard_controller.ts
│   │   │   │   ├── mfa_controller.ts
│   │   │   │   ├── oauth_controller.ts
│   │   │   │   ├── teams_controller.ts
│   │   │   │   └── users_controller.ts
│   │   │   ├── exceptions
│   │   │   │   └── handler.ts
│   │   │   ├── middleware
│   │   │   │   ├── admin_middleware.ts
│   │   │   │   ├── auth_middleware.ts
│   │   │   │   ├── container_bindings_middleware.ts
│   │   │   │   ├── force_json_response_middleware.ts
│   │   │   │   ├── guest_middleware.ts
│   │   │   │   ├── initialize_bouncer_middleware.ts
│   │   │   │   └── silent_auth_middleware.ts
│   │   │   ├── models
│   │   │   │   ├── email_verification_token.ts
│   │   │   │   ├── login_history.ts
│   │   │   │   ├── oauth_account.ts
│   │   │   │   ├── password_reset_token.ts
│   │   │   │   ├── team.ts
│   │   │   │   ├── team_invitation.ts
│   │   │   │   ├── team_member.ts
│   │   │   │   └── user.ts
│   │   │   ├── policies
│   │   │   │   └── main.ts
│   │   │   ├── services
│   │   │   │   ├── auth_service.ts
│   │   │   │   ├── mail_service.ts
│   │   │   │   ├── mfa_service.ts
│   │   │   │   └── subscription_service.ts
│   │   │   └── validators
│   │   │       └── auth.ts
│   │   ├── bin
│   │   │   ├── console.ts
│   │   │   ├── server.ts
│   │   │   └── test.ts
│   │   ├── commands
│   │   │   └── check_expired_subscriptions.ts
│   │   ├── config
│   │   │   ├── ally.ts
│   │   │   ├── app.ts
│   │   │   ├── auth.ts
│   │   │   ├── bodyparser.ts
│   │   │   ├── cors.ts
│   │   │   ├── database.ts
│   │   │   ├── hash.ts
│   │   │   ├── logger.ts
│   │   │   └── session.ts
│   │   ├── database
│   │   │   ├── migrations
│   │   │   │   ├── 1765740372222_create_users_table.ts
│   │   │   │   ├── 1765740372223_add_auth_fields_to_users_table.ts
│   │   │   │   ├── 1765740372224_create_oauth_accounts_table.ts
│   │   │   │   ├── 1765740372225_create_password_reset_tokens_table.ts
│   │   │   │   ├── 1765740372226_create_email_verification_tokens_table.ts
│   │   │   │   ├── 1765740372227_create_login_history_table.ts
│   │   │   │   ├── 1765740372228_add_subscription_tier_to_users_table.ts
│   │   │   │   ├── 1765740372229_add_subscription_expires_at_to_users_table.ts
│   │   │   │   ├── 1765740372230_create_teams_table.ts
│   │   │   │   ├── 1765740372231_create_team_members_table.ts
│   │   │   │   ├── 1765740372232_add_current_team_to_users.ts
│   │   │   │   ├── 1765740372233_add_max_members_to_teams.ts
│   │   │   │   └── 1765740372234_create_team_invitations_table.ts
│   │   │   └── seeders
│   │   │       └── admin_user_seeder.ts
│   │   ├── eslint.config.js
│   │   ├── package.json
│   │   ├── start
│   │   │   ├── env.ts
│   │   │   ├── kernel.ts
│   │   │   └── routes.ts
│   │   ├── tests
│   │   │   ├── README.md
│   │   │   ├── bootstrap.ts
│   │   │   ├── functional
│   │   │   │   ├── auth.spec.ts
│   │   │   │   ├── teams.spec.ts
│   │   │   │   ├── users.spec.ts
│   │   │   │   └── users_supertest.spec.ts
│   │   │   └── unit
│   │   │       ├── abilities.spec.ts
│   │   │       ├── auth_service.spec.ts
│   │   │       ├── mail_service.spec.ts
│   │   │       ├── team.spec.ts
│   │   │       ├── team_invitation.spec.ts
│   │   │       ├── user.spec.ts
│   │   │       └── user_service.spec.ts
│   │   └── tsconfig.json
│   └── web
│       ├── .gitignore
│       ├── README.md
│       ├── app
│       │   ├── (auth)
│       │   │   ├── forgot-password
│       │   │   │   └── page.tsx
│       │   │   ├── layout.tsx
│       │   │   ├── login
│       │   │   │   └── page.tsx
│       │   │   ├── register
│       │   │   │   └── page.tsx
│       │   │   └── reset-password
│       │   │       └── page.tsx
│       │   ├── admin
│       │   │   ├── dashboard
│       │   │   │   └── page.tsx
│       │   │   ├── layout.tsx
│       │   │   └── users
│       │   │       └── page.tsx
│       │   ├── auth
│       │   │   └── callback
│       │   │       └── page.tsx
│       │   ├── dashboard
│       │   │   └── page.tsx
│       │   ├── favicon.ico
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── profile
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── security
│       │   │   │   └── page.tsx
│       │   │   └── settings
│       │   │       └── page.tsx
│       │   └── team
│       │       └── page.tsx
│       ├── components
│       │   ├── header.tsx
│       │   ├── ui
│       │   │   ├── alert-dialog.tsx
│       │   │   ├── alert.tsx
│       │   │   ├── avatar.tsx
│       │   │   ├── badge.tsx
│       │   │   ├── button.tsx
│       │   │   ├── card.tsx
│       │   │   ├── dropdown-menu.tsx
│       │   │   ├── form.tsx
│       │   │   ├── input.tsx
│       │   │   ├── label.tsx
│       │   │   ├── select.tsx
│       │   │   ├── separator.tsx
│       │   │   ├── sonner.tsx
│       │   │   └── table.tsx
│       │   └── user-menu.tsx
│       ├── components.json
│       ├── contexts
│       │   └── auth-context.tsx
│       ├── eslint.config.mjs
│       ├── lib
│       │   ├── api.ts
│       │   ├── auth.ts
│       │   ├── utils.ts
│       │   └── validations.ts
│       ├── next-env.d.ts
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── public
│       │   ├── file.svg
│       │   ├── globe.svg
│       │   ├── next.svg
│       │   ├── vercel.svg
│       │   └── window.svg
│       ├── tests
│       │   ├── README.md
│       │   ├── components
│       │   │   ├── button.test.tsx
│       │   │   ├── header.test.tsx
│       │   │   └── user-menu.test.tsx
│       │   ├── contexts
│       │   │   └── auth-context.test.tsx
│       │   ├── lib
│       │   │   ├── api.test.ts
│       │   │   ├── auth.test.ts
│       │   │   └── validations.test.ts
│       │   ├── pages
│       │   │   ├── admin
│       │   │   │   ├── dashboard.test.tsx
│       │   │   │   ├── layout.test.tsx
│       │   │   │   └── users.test.tsx
│       │   │   ├── auth
│       │   │   │   ├── callback.test.tsx
│       │   │   │   ├── forgot-password.test.tsx
│       │   │   │   ├── login.test.tsx
│       │   │   │   ├── register.test.tsx
│       │   │   │   └── reset-password.test.tsx
│       │   │   ├── dashboard.test.tsx
│       │   │   ├── home.test.tsx
│       │   │   ├── profile
│       │   │   │   ├── layout.test.tsx
│       │   │   │   ├── page.test.tsx
│       │   │   │   ├── security.test.tsx
│       │   │   │   └── settings.test.tsx
│       │   │   └── team.test.tsx
│       │   ├── setup.ts
│       │   └── vitest.d.ts
│       ├── tsconfig.json
│       ├── tsconfig.tsbuildinfo
│       └── vitest.config.ts
├── docker-compose.yml
├── docs
│   ├── architecture.md
│   ├── conventions.md
│   ├── testing-database.md
│   ├── testing-setup.md
│   └── testing.md
├── infra
│   └── supabase
│       ├── README.md
│       ├── migrations
│       │   └── 001_create_users_table.sql
│       └── seed.sql
├── package-lock.json
├── package.json
├── packages
│   ├── config
│   │   ├── eslint.base.js
│   │   ├── package.json
│   │   └── tsconfig.base.json
│   └── shared
│       ├── package.json
│       ├── src
│       │   ├── index.ts
│       │   └── types
│       │       ├── api.ts
│       │       ├── auth.ts
│       │       ├── team.ts
│       │       └── user.ts
│       └── tsconfig.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prompts-used
│   ├── PROMPT-AUTH.md
│   └── PROMPT.md
└── scripts
    └── test-setup.sh

69 directories, 220 files

```

## Détail des Composants Principaux

### Frontend (apps/web)
- **Framework**: Next.js 15 avec App Router
- **UI**: shadcn/ui + Tailwind CSS
- **Tests**: Vitest + React Testing Library
- **Pages**:
  - `/` - Landing page
  - `/dashboard` - Dashboard exemple avec composants shadcn

### Backend (apps/api)
- **Framework**: AdonisJS 6
- **ORM**: Lucid
- **Auth**: Sessions AdonisJS
- **Tests**: Japa
- **Routes API**:
  - `GET /api/v1/users` - Liste des utilisateurs
  - `GET /api/v1/users/:id` - Détail utilisateur

### Packages Partagés
- **@saas/shared**: Types TypeScript (UserDTO, ApiResponse, etc.)
- **@saas/config**: Configurations ESLint et TypeScript de base

### Infrastructure
- **Supabase**: PostgreSQL hébergé
- **Migrations**: SQL + Lucid ORM
- **Table users**: email, password, full_name, timestamps

## Commandes Principales

### Démarrage
```bash
pnpm install                 # Installer toutes les dépendances
pnpm run dev                 # Démarrer frontend + backend
```

### Tests
```bash
pnpm test                    # Tous les tests
pnpm run web:test            # Tests frontend uniquement
pnpm run api:test            # Tests backend uniquement
```

### Build
```bash
pnpm run build               # Build tous les workspaces
pnpm run web:build           # Build frontend
pnpm run api:build           # Build backend
```

## Fichiers de Configuration Clés

- **Monorepo**: `package.json` + `pnpm-workspace.yaml` (pnpm workspaces)
- **Frontend**: `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`
- **Backend**: `adonisrc.ts`, `config/database.ts`, `config/auth.ts`
- **Types**: `packages/shared/tsconfig.json`

## Points d'Entrée

- **Frontend**: `apps/web/app/layout.tsx` et `apps/web/app/page.tsx`
- **Backend**: `apps/api/start/routes.ts` et `apps/api/app/controllers/`
- **Tests Frontend**: `apps/web/tests/`
- **Tests Backend**: `apps/api/tests/`

## Prochaines Étapes Suggérées

1. Configurer les variables d'environnement (`.env`)
2. Créer une base de données Supabase
3. Exécuter les migrations : `cd apps/api && node ace migration:run`
4. Lancer le projet : `npm run dev`
5. Accéder au frontend : http://localhost:3000
6. Tester l'API : http://localhost:3333/api/v1/users

## Technologies Utilisées

| Catégorie | Technologie | Version |
|-----------|------------|---------|
| Frontend Framework | Next.js | 16.x |
| UI Library | shadcn/ui | Latest |
| Styling | Tailwind CSS | 4.x |
| Backend Framework | AdonisJS | 6.x |
| ORM | Lucid | 21.x |
| Database | PostgreSQL (Supabase) | 15+ |
| Language | TypeScript | 5.x |
| Frontend Testing | Vitest + @testing-library/jest-dom | 4.x |
| Backend Testing | Japa + Supertest | 4.x |
| Package Manager | pnpm | 8+ |

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  Next.js    │ ──────> │  AdonisJS   │ ──────> │  PostgreSQL │
│  Frontend   │  REST   │  Backend    │  Lucid  │  (Supabase) │
│             │  API    │             │  ORM    │             │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │
      │                       │
      └───────────────────────┘
              │
              v
       ┌─────────────┐
       │  @saas/     │
       │  shared     │
       │  (Types)    │
       └─────────────┘
```

Le frontend et le backend partagent les types via le package `@saas/shared`, garantissant la cohérence des données à travers toute l'application.
