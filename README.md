# SaaS Monorepo Starter

Projet SaaS fullstack avec architecture monorepo, TypeScript strict et stack moderne.

## Stack

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: AdonisJS 6 + Lucid ORM
- **Database**: PostgreSQL (Supabase)
- **Language**: TypeScript partout
- **Package Manager**: pnpm workspaces
- **Tests**: Vitest + @testing-library/jest-dom (front) | Japa + Supertest (back)

## Structure du Projet

```
.
├── apps/
│   ├── web/              # Frontend Next.js
│   └── api/              # Backend AdonisJS
├── packages/
│   ├── shared/           # Types partagés (DTO, interfaces)
│   └── config/           # Configurations partagées (ESLint, TS)
├── infra/
│   └── supabase/         # Migrations SQL et seeds
└── docs/
    ├── architecture.md   # Architecture détaillée
    └── conventions.md    # Conventions de code
```

## Installation

### Prérequis

- Node.js >= 18
- pnpm >= 8
- **Docker** (pour les tests avec PostgreSQL local)
- PostgreSQL (via Supabase pour dev/prod)

### Setup Initial

```bash
# Installer toutes les dépendances
pnpm install

# Compiler le package shared
cd packages/shared && pnpm run build && cd ../..
```

### Configuration Backend

1. Copier le fichier d'environnement :
```bash
cp apps/api/.env.example apps/api/.env
```

2. Configurer les variables d'environnement dans `apps/api/.env` :
```env
PORT=3333
HOST=localhost
NODE_ENV=development

# Database (Supabase PostgreSQL)
DB_HOST=your-project.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_DATABASE=postgres

# Session
APP_KEY=generate-with-node-ace-generate-key
```

3. Générer la clé d'application :
```bash
cd apps/api
node ace generate:key
```

4. Exécuter les migrations :
```bash
node ace migration:run
```

### Configuration Frontend

Le frontend est configuré par défaut pour se connecter à `http://localhost:3333` (backend AdonisJS).

Si nécessaire, créer `apps/web/.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:3333
```

## Démarrage

### Développement

```bash
# Terminal 1 - Backend
pnpm run api:dev

# Terminal 2 - Frontend
pnpm run web:dev
```

Ou lancer les deux en même temps :
```bash
pnpm run dev
```

### Accès

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3333
- **API Health Check**: http://localhost:3333/api/v1/users

## Routes API Disponibles

- `GET /api/v1/users` - Liste des utilisateurs
- `GET /api/v1/users/:id` - Détail d'un utilisateur

## Tests

### ⚠️ Stratégie de Test - IMPORTANT

**RÈGLE ABSOLUE : Ne JAMAIS exécuter de tests contre Supabase cloud**

- **Tests unitaires** : Base de données mockée (pas de connexion DB)
- **Tests d'intégration** : PostgreSQL local via Docker (port 5433)

### Setup PostgreSQL de Test (Docker)

```bash
# Démarrer PostgreSQL pour les tests
docker-compose up -d postgres-test

# Exécuter les migrations sur la DB de test
cd apps/api
NODE_ENV=test node ace migration:run

# Exécuter les tests
pnpm test

# Arrêter PostgreSQL de test
docker-compose down postgres-test
```

### Types de Tests

**Tests Unitaires (DB mockée)**
- Logique métier isolée
- Aucune connexion DB
- Très rapides (< 1s par test)

**Tests d'Intégration (Docker PostgreSQL)**
- Tests d'API complets
- Base locale sur port 5433
- Rollback automatique après chaque test

Voir [Testing Database Guide](./docs/testing-database.md) pour les détails complets.

**Commandes pour lancer les tests et le coverage**
#### Resets test database
pnpm run docker:test:reset

#### Tests unitaires API
cd apps/api && node ace test unit

#### Tests fonctionnels API (nécessite Docker)
pnpm run docker:test:up
cd apps/api && node ace test functional

#### Tous les tests
pnpm test

#### Tous les tests + Coverage
cd apps/api && node ace test --coverage


## Commandes Utiles

### Monorepo
```bash
pnpm run dev         # Démarre tous les workspaces
pnpm run build       # Build tous les workspaces
pnpm run lint        # Lint tous les workspaces
pnpm test            # Exécute tous les tests
```

### Frontend (apps/web)
```bash
pnpm run web:dev     # Démarre Next.js en dev
pnpm run web:build   # Build pour production
pnpm run web:test    # Exécute les tests Vitest
```

### Backend (apps/api)
```bash
pnpm run api:dev     # Démarre AdonisJS en dev
pnpm run api:build   # Build pour production
pnpm run api:test    # Exécute les tests Japa
node ace migration:run        # Exécute les migrations
node ace migration:rollback   # Rollback migrations
node ace make:model ModelName # Crée un nouveau modèle
node ace make:controller ControllerName # Crée un controller
```

### Packages
```bash
# Shared types
cd packages/shared
pnpm run build       # Compile les types
pnpm run dev         # Watch mode

# Config
# Pas de build nécessaire (exports directs)
```

## Ajouter des Composants shadcn/ui

```bash
cd apps/web
npx shadcn@latest add [component-name]
```

Exemples :
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add form
```

## Base de Données

### Migrations Supabase

Les migrations SQL sont dans `infra/supabase/migrations/`.

Pour les appliquer :
1. Via Supabase Dashboard > SQL Editor
2. Via Supabase CLI : `supabase db push`
3. Via AdonisJS Lucid (synchronisé avec Supabase)

### Créer une Nouvelle Migration (AdonisJS)

```bash
cd apps/api
node ace make:migration create_table_name
```

Éditer le fichier dans `apps/api/database/migrations/` puis :
```bash
node ace migration:run
```

## Production Build

```bash
# Build tous les packages
pnpm run build

# Les artefacts sont dans :
# - apps/web/.next/
# - apps/api/build/
```

## Documentation

- [Architecture](./docs/architecture.md) - Vue d'ensemble de l'architecture
- [Conventions](./docs/conventions.md) - Standards de code et bonnes pratiques
- [Testing](./docs/testing.md) - Guide des tests unitaires et fonctionnels
- [Testing Setup](./docs/testing-setup.md) - Configuration détaillée des outils de test
- [Testing Database](./docs/testing-database.md) - **Stratégie DB : Mock vs Docker PostgreSQL**

## Extensibilité

Ce projet est conçu pour être facilement étendu :

- Ajouter de nouveaux packages dans `packages/`
- Ajouter de nouvelles apps dans `apps/`
- Intégrer Redis, WebSockets, etc.
- Migrer vers microservices si nécessaire

## Points de Vigilance

- Ne jamais commit `.env` (déjà dans `.gitignore`)
- **⚠️ CRITIQUE : Ne JAMAIS exécuter de tests contre Supabase cloud**
- Tests unitaires = DB mockée | Tests d'intégration = Docker PostgreSQL local
- Toujours typer explicitement (pas de `any`)
- Valider les données côté serveur
- Le backend est la source de vérité
- Utiliser les types de `@saas/shared` pour la cohérence

## Support

Pour tout problème :
1. Vérifier la documentation dans `docs/`
2. Vérifier les logs (backend et frontend)
3. Vérifier la connexion à la base de données

## License

MIT
