# Stratégie de Tests - Base de Données

## ⚠️ RÈGLE ABSOLUE

**INTERDICTION STRICTE : Ne jamais exécuter de tests contre Supabase cloud (production ou dev)**

Les tests doivent TOUJOURS utiliser :
- **Tests unitaires** : Base de données mockée
- **Tests d'intégration** : PostgreSQL local (Docker)

## Architecture de Test

```
┌─────────────────────────────────────────────────────────┐
│                    TESTS UNITAIRES                      │
│  - DB mockée (pas de connexion réelle)                 │
│  - Logique métier isolée                               │
│  - Rapides (< 1s)                                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                 TESTS D'INTÉGRATION                     │
│  - PostgreSQL Docker local (port 5433)                 │
│  - Migrations AdonisJS appliquées                      │
│  - Rollback automatique après chaque test              │
│  - Isolation complète                                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  ENVIRONNEMENTS                         │
│  ✅ Local Docker   : Tests OK                          │
│  ❌ Supabase Cloud : Tests INTERDITS                   │
│  ✅ CI/CD Pipeline : Docker OK                         │
└─────────────────────────────────────────────────────────┘
```

## 1. Tests Unitaires - DB Mockée

### Principe
Les tests unitaires testent la **logique métier** sans dépendances externes.

### Configuration
- Aucune connexion DB réelle
- Tous les appels sont mockés
- Focus sur la logique pure

### Exemple

```typescript
import { test } from '@japa/runner'

test.group('UserService (Unit - Mocked)', () => {
  test('validates email format', ({ assert }) => {
    // Logique pure - pas de DB
    const email = 'invalid-email'
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    assert.isFalse(isValid)
  })

  test('sanitizes user data', ({ assert }) => {
    // Test de transformation de données
    const rawUser = {
      id: 1,
      email: 'test@example.com',
      password: 'secret',
      fullName: 'Test User',
    }

    // Logique de sanitization
    const sanitized = {
      id: rawUser.id,
      email: rawUser.email,
      fullName: rawUser.fullName,
    }

    assert.notProperty(sanitized, 'password')
  })
})
```

### Mocking Avancé

Pour les cas plus complexes avec services et repositories :

```typescript
import { test } from '@japa/runner'
import sinon from 'sinon'

test.group('UserService (Unit - Advanced Mocking)', () => {
  test('findById calls repository correctly', async ({ assert }) => {
    // Mock du repository
    const mockRepository = {
      findById: sinon.stub().resolves({
        id: 1,
        email: 'test@example.com',
      }),
    }

    // Service avec repository injecté
    const userService = new UserService(mockRepository)
    const user = await userService.findById(1)

    assert.isTrue(mockRepository.findById.calledWith(1))
    assert.equal(user.email, 'test@example.com')
  })
})
```

## 2. Tests d'Intégration - PostgreSQL Local

### Setup Docker

**1. Démarrer PostgreSQL de test**

```bash
# Démarrer uniquement la DB de test
docker-compose up -d postgres-test

# Vérifier que le container tourne
docker ps | grep postgres-test
```

**2. Variables d'environnement**

Fichier `.env.test` (déjà configuré) :

```env
# ⚠️ NE JAMAIS pointer vers Supabase cloud
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=saas_test
```

**3. Exécuter les migrations**

```bash
cd apps/api
NODE_ENV=test node ace migration:run
```

### Structure des Tests d'Intégration

```typescript
import { test } from '@japa/runner'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Users API (Integration)', (group) => {
  // Cleanup avant chaque test
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  // Rollback automatique après chaque test (via testUtils)
  group.each.teardown(async () => {
    // Nettoyage automatique par AdonisJS
  })

  test('creates and retrieves user from DB', async ({ assert }) => {
    // Arrange - Créer dans la vraie DB locale
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    // Act - Requête à la vraie DB
    const found = await User.find(user.id)

    // Assert
    assert.exists(found)
    assert.equal(found.email, 'test@example.com')
  })
})
```

## 3. Configuration Docker

### docker-compose.yml

```yaml
services:
  # PostgreSQL pour les TESTS uniquement
  postgres-test:
    image: postgres:15-alpine
    ports:
      - "5433:5432"  # Port différent pour éviter conflits
    environment:
      POSTGRES_DB: saas_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
```

### Commandes Docker Utiles

```bash
# Démarrer la DB de test
docker-compose up -d postgres-test

# Arrêter et supprimer le container
docker-compose down postgres-test

# Supprimer aussi les volumes (reset complet)
docker-compose down -v

# Voir les logs
docker-compose logs -f postgres-test

# Se connecter à la DB de test
docker exec -it saas-postgres-test psql -U postgres -d saas_test
```

## 4. CI/CD - GitHub Actions

Exemple de workflow pour les tests :

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: saas_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        working-directory: apps/api
        run: NODE_ENV=test node ace migration:run

      - name: Run tests
        run: pnpm test
```

## 5. Bonnes Pratiques

### ✅ À FAIRE

- Utiliser Docker pour PostgreSQL de test
- Truncate la DB avant chaque test
- Mocker la DB dans les tests unitaires
- Tester avec des données réalistes
- Isoler complètement chaque test

### ❌ À NE JAMAIS FAIRE

- **Se connecter à Supabase cloud pour les tests**
- Partager l'état entre les tests
- Utiliser la DB de développement pour les tests
- Laisser des données de test après exécution
- Skipper le nettoyage de la DB

## 6. Dépannage

### Les tests ne trouvent pas la DB

```bash
# Vérifier que le container tourne
docker ps | grep postgres-test

# Vérifier les logs
docker-compose logs postgres-test

# Redémarrer le container
docker-compose restart postgres-test
```

### Erreur de connexion

```bash
# Vérifier le port
netstat -an | grep 5433

# Vérifier les variables d'environnement
cat apps/api/.env.test | grep DB_
```

### Tests lents

```bash
# Les tests unitaires doivent être rapides (< 1s)
# Si lents, vous utilisez probablement la vraie DB

# Vérifier qu'il n'y a pas de connexion DB dans les tests unitaires
grep -r "testUtils.db()" tests/unit/
```

## 7. Checklist Avant de Committer

- [ ] Aucun test ne pointe vers Supabase cloud
- [ ] `.env.test` configure bien la DB locale (port 5433)
- [ ] Tests unitaires n'utilisent pas de vraie DB
- [ ] Tests d'intégration utilisent `testUtils.db().truncate()`
- [ ] Docker compose est à jour
- [ ] Documentation mise à jour si changements

## Résumé

| Type de Test | Base de Données | Port | Commande |
|--------------|-----------------|------|----------|
| Unitaire | Mockée (aucune) | N/A | `pnpm test unit` |
| Intégration | Docker PostgreSQL | 5433 | `pnpm test functional` |
| **INTERDIT** | ~~Supabase cloud~~ | ~~5432~~ | ❌ JAMAIS |

**Rappel** : Supabase cloud est UNIQUEMENT pour le développement et la production, JAMAIS pour les tests.
