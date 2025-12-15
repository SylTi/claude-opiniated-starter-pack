# Architecture du Projet

## Vue d'ensemble

Ce projet est organisé en monorepo avec une séparation claire entre le frontend, le backend et les packages partagés.

```
saas-monorepo/
├── apps/
│   ├── web/          # Frontend Next.js
│   └── api/          # Backend AdonisJS
├── packages/
│   ├── shared/       # Types TypeScript partagés
│   └── config/       # Configurations partagées
├── infra/
│   └── supabase/     # Migrations et structure DB
└── docs/             # Documentation
```

## Stack Technique

### Frontend (apps/web)
- **Framework**: Next.js 15+ avec App Router
- **Langage**: TypeScript
- **Styling**: Tailwind CSS
- **Composants UI**: shadcn/ui
- **Gestion d'état**: React hooks natifs (extensible avec Zustand/Jotai si besoin)

### Backend (apps/api)
- **Framework**: AdonisJS 6+
- **Langage**: TypeScript
- **ORM**: Lucid (inclus dans AdonisJS)
- **Authentification**: AdonisJS Auth avec sessions
- **Validation**: VineJS (validator AdonisJS)

### Base de données
- **Hébergement**: Supabase
- **SGBD**: PostgreSQL
- **Gestion**: Migrations SQL + Lucid ORM
- **Note**: On utilise uniquement PostgreSQL de Supabase, pas l'auth Supabase

### Packages Partagés
- **@saas/shared**: Types DTO, interfaces API, enums
- **@saas/config**: Configurations ESLint et TypeScript de base

## Flux de Données

1. **Frontend → Backend**
   - Le frontend Next.js fait des appels API REST au backend AdonisJS
   - Les routes API sont préfixées par `/api/v1`
   - Les DTOs partagés assurent la cohérence des types

2. **Backend → Database**
   - AdonisJS se connecte directement à PostgreSQL via Supabase
   - Lucid ORM gère les requêtes et les relations
   - Les migrations sont versionnées

## Principes de Conception

### Convention over Configuration
- Structure de dossiers standardisée
- Nommage cohérent (snake_case DB, camelCase TypeScript)
- Patterns MVC pour le backend

### Type Safety
- TypeScript strict activé partout
- Pas de `any`
- Types partagés entre frontend et backend via `@saas/shared`

### Séparation des Responsabilités
- Le frontend ne contient aucune logique métier
- Le backend est la source de vérité
- Les validations sont faites côté serveur

### Extensibilité
- Architecture modulaire facile à étendre
- Ajout de nouveaux packages simple
- Migration vers microservices possible

## Points d'Extension Futurs

1. **Authentification avancée**
   - OAuth providers
   - 2FA
   - Refresh tokens

2. **Real-time**
   - WebSockets avec AdonisJS
   - Supabase Realtime (optionnel)

3. **Caching**
   - Redis pour sessions et cache
   - React Query pour cache client

4. **Testing**
   - Jest pour les tests unitaires
   - Playwright pour les tests E2E

5. **CI/CD**
   - GitHub Actions
   - Déploiement automatisé (Vercel + VPS/Cloud)
