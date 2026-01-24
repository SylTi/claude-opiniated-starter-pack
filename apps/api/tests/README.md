# Tests Backend - AdonisJS

Ce dossier contient tous les tests du backend AdonisJS.

## ⚠️ RÈGLE ABSOLUE - Base de Données

**INTERDICTION STRICTE : Ne JAMAIS exécuter de tests contre Supabase cloud**

- ✅ **Tests unitaires** : DB mockée (aucune connexion)
- ✅ **Tests d'intégration** : PostgreSQL Docker local (port 5433)
- ❌ **INTERDIT** : Tests sur Supabase cloud

## Structure

```
tests/
├── bootstrap.ts              # Configuration Japa
├── functional/               # Tests fonctionnels (API endpoints)
│   ├── users.spec.ts        # Tests avec @japa/api-client
│   └── users_supertest.spec.ts # Tests avec Supertest
└── unit/                     # Tests unitaires (modèles, services)
    └── user.spec.ts         # Tests du modèle User
```

## Deux Approches pour Tester les APIs

### 1. @japa/api-client (Recommandé)

Outil natif d'AdonisJS avec intégration optimale.

```typescript
import { test } from '@japa/runner'

test('GET /api/v1/users', async ({ client }) => {
  const response = await client.get('/api/v1/users')

  response.assertStatus(200)
  response.assertBodyContains({ data: expect.any(Array) })
})
```

**Avantages:**

- Intégration native AdonisJS
- Assertions intégrées
- Type-safe
- Pas besoin de configurer l'URL

### 2. Supertest

Bibliothèque standard de l'écosystème Node.js.

```typescript
import { test } from '@japa/runner'
import request from 'supertest'

test('GET /api/v1/users', async ({ assert }) => {
  const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

  const response = await request(BASE_URL).get('/api/v1/users').expect(200)

  assert.isArray(response.body.data)
})
```

**Avantages:**

- Très populaire
- Documentation extensive
- Syntaxe chainable
- Familier pour développeurs Node.js

## Exécuter les Tests

```bash
# Tous les tests
npm test

# Tests fonctionnels uniquement
node ace test functional

# Tests unitaires uniquement
node ace test unit

# Test spécifique
node ace test tests/functional/users.spec.ts
```

## Base de Données de Test

Avant chaque test, la base de données est nettoyée :

```typescript
test.group('My Group', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })
})
```

## Bonnes Pratiques

1. **AAA Pattern**: Arrange, Act, Assert
2. **Isolation**: Chaque test doit être indépendant
3. **Cleanup**: Toujours nettoyer la DB entre les tests
4. **Descriptif**: Noms de tests clairs et explicites

## Documentation Complète

- [Guide des Tests](/docs/testing.md)
- [Configuration Détaillée](/docs/testing-setup.md)
