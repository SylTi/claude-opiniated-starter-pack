# Structure Complète du Projet SaaS Monorepo

## Arborescence Générale

```
saas-monorepo/
├── apps/
│   ├── web/                          # Frontend Next.js
│   │   ├── app/
│   │   │   ├── layout.tsx            # Layout principal
│   │   │   ├── page.tsx              # Page d'accueil
│   │   │   ├── globals.css           # Styles globaux
│   │   │   └── dashboard/
│   │   │       └── page.tsx          # Page dashboard (exemple)
│   │   ├── components/
│   │   │   └── ui/                   # Composants shadcn/ui
│   │   │       ├── button.tsx
│   │   │       └── card.tsx
│   │   ├── lib/
│   │   │   └── utils.ts              # Utilitaires (cn, etc.)
│   │   ├── tests/
│   │   │   ├── setup.ts              # Configuration Vitest
│   │   │   ├── components/
│   │   │   │   └── button.test.tsx   # Tests composants
│   │   │   └── pages/
│   │   │       └── dashboard.test.tsx # Tests pages
│   │   ├── public/                   # Assets statiques
│   │   ├── package.json              # Config Next.js
│   │   ├── vitest.config.ts          # Config Vitest
│   │   ├── tsconfig.json             # Config TypeScript
│   │   ├── next.config.ts            # Config Next.js
│   │   ├── tailwind.config.ts        # Config Tailwind
│   │   └── components.json           # Config shadcn/ui
│   │
│   └── api/                          # Backend AdonisJS
│       ├── app/
│       │   ├── controllers/
│       │   │   └── users_controller.ts # Controller REST users
│       │   └── models/
│       │       └── user.ts           # Modèle User (Lucid ORM)
│       ├── config/
│       │   ├── app.ts                # Config app
│       │   ├── database.ts           # Config database
│       │   ├── auth.ts               # Config auth
│       │   └── session.ts            # Config sessions
│       ├── database/
│       │   └── migrations/
│       │       └── *_create_users_table.ts # Migration users
│       ├── start/
│       │   └── routes.ts             # Définition des routes API
│       ├── tests/
│       │   ├── bootstrap.ts          # Configuration Japa
│       │   ├── functional/
│       │   │   ├── users.spec.ts     # Tests API (@japa/api-client)
│       │   │   └── users_supertest.spec.ts # Tests API (Supertest)
│       │   └── unit/
│       │       └── user.spec.ts      # Tests modèle
│       ├── package.json              # Config AdonisJS
│       ├── tsconfig.json             # Config TypeScript
│       ├── adonisrc.ts               # Config AdonisJS RC
│       └── .env.example              # Variables d'environnement exemple
│
├── packages/
│   ├── shared/                       # Types partagés
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── user.ts           # DTOs User
│   │   │   │   └── api.ts            # Types API (ApiResponse, etc.)
│   │   │   └── index.ts              # Export principal
│   │   ├── dist/                     # Types compilés
│   │   ├── package.json              # Config package
│   │   └── tsconfig.json             # Config TypeScript
│   │
│   └── config/                       # Configurations partagées
│       ├── eslint.base.js            # Config ESLint de base
│       ├── tsconfig.base.json        # Config TypeScript de base
│       └── package.json              # Config package
│
├── infra/
│   └── supabase/                     # Infrastructure Supabase
│       ├── migrations/
│       │   └── 001_create_users_table.sql # Migration SQL users
│       ├── seed.sql                  # Données de départ
│       └── README.md                 # Documentation Supabase
│
├── docs/
│   ├── architecture.md               # Documentation architecture
│   ├── conventions.md                # Conventions de code
│   ├── testing.md                    # Guide des tests
│   ├── testing-setup.md              # Configuration outils de test
│   └── testing-database.md           # ⚠️ Stratégie DB : Mock vs Docker
│
├── scripts/
│   └── test-setup.sh                 # Setup auto environnement de test
│
├── docker-compose.yml                # PostgreSQL pour tests (port 5433)
├── DOCKER-TESTING.md                 # Guide Docker pour les tests
├── package.json                      # Config monorepo + scripts Docker
├── .gitignore                        # Fichiers ignorés par git
├── README.md                         # Documentation principale
└── PROMPT.md                         # Spécifications du projet
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
