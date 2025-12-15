# Testing Guide

## Vue d'ensemble

Le projet utilise des frameworks de test modernes pour garantir la qualité du code et éviter les régressions :

- **Frontend (apps/web)**: Vitest + React Testing Library + @testing-library/jest-dom
- **Backend (apps/api)**: Japa (testing framework AdonisJS) avec @japa/api-client

## Structure des Tests

### Frontend
```
apps/web/tests/
├── setup.ts                    # Configuration Vitest
├── components/                 # Tests des composants UI
│   └── button.test.tsx
└── pages/                      # Tests des pages Next.js
    └── dashboard.test.tsx
```

### Backend
```
apps/api/tests/
├── bootstrap.ts                # Configuration Japa
├── functional/                 # Tests fonctionnels (API)
│   └── users.spec.ts
└── unit/                       # Tests unitaires (modèles, services)
    └── user.spec.ts
```

## Outils de Test

### Frontend

**Vitest**
- Framework de test rapide et moderne pour Vite
- Compatible avec l'API de Jest
- Hot Module Reload pour les tests

**React Testing Library**
- Bibliothèque pour tester les composants React
- Focus sur le comportement utilisateur
- Encourage les bonnes pratiques de test

**@testing-library/jest-dom**
- Matchers personnalisés pour le DOM
- Assertions plus expressives et lisibles
- Exemples: `toBeInTheDocument()`, `toHaveClass()`, `toBeDisabled()`

**@testing-library/user-event**
- Simulation d'interactions utilisateur réalistes
- Plus complet que `fireEvent`
- Reproduit le comportement réel du navigateur

### Backend

**Japa**
- Framework de test officiel d'AdonisJS
- Syntaxe claire et moderne
- Supporte tests unitaires et fonctionnels

**@japa/api-client**
- Client HTTP pour tester les APIs (recommandé)
- Assertions intégrées pour les réponses HTTP
- Intégration native avec AdonisJS

**Supertest**
- Alternative populaire pour tester les APIs
- Bibliothèque standard de l'écosystème Node.js
- Syntaxe chainable et expressive
- Compatible avec Japa

**@japa/assert**
- Bibliothèque d'assertions
- API riche et expressive
- Compatible avec tous types de tests

**testUtils (AdonisJS)**
- Utilitaires fournis par AdonisJS
- Gestion de la base de données de test
- Helpers pour démarrer/arrêter le serveur

## Commandes de Test

### Exécuter tous les tests
```bash
# Depuis la racine du monorepo
pnpm test

# Tests frontend uniquement
pnpm run web:test

# Tests backend uniquement
pnpm run api:test
```

### Tests Frontend (Vitest)
```bash
cd apps/web

# Run once
pnpm test

# Watch mode
pnpm run test:watch

# UI mode (interface graphique)
pnpm run test:ui

# Coverage
pnpm test -- --coverage
```

### Tests Backend (Japa)
```bash
cd apps/api

# Tous les tests
pnpm test

# Tests fonctionnels uniquement
node ace test functional

# Tests unitaires uniquement
node ace test unit

# Test spécifique
node ace test tests/functional/users.spec.ts
```

## Écrire des Tests

### Frontend - Composants React

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    // Utilise jest-dom matcher pour vérifier la présence dans le DOM
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: 'Disabled' })
    // Utilise jest-dom matcher pour vérifier l'état disabled
    expect(button).toBeDisabled()
  })

  it('applies correct CSS classes', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button', { name: 'Outline' })
    // Utilise jest-dom matcher pour vérifier les classes
    expect(button).toHaveClass('border')
  })
})
```

### Frontend - Pages Next.js

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

describe('Dashboard Page', () => {
  it('renders dashboard title', () => {
    render(<DashboardPage />)
    // Utilise toBeInTheDocument au lieu de toBeDefined
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('displays metric cards', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
  })
})
```

### Frontend - Matchers jest-dom Utiles

```typescript
// Vérifier la présence dans le DOM
expect(element).toBeInTheDocument()
expect(element).not.toBeInTheDocument()

// Vérifier la visibilité
expect(element).toBeVisible()
expect(element).not.toBeVisible()

// Vérifier l'état des inputs
expect(input).toBeDisabled()
expect(input).toBeEnabled()
expect(checkbox).toBeChecked()
expect(input).toHaveValue('hello')

// Vérifier les attributs et classes
expect(element).toHaveClass('bg-primary')
expect(element).toHaveAttribute('href', '/dashboard')
expect(element).toHaveTextContent('Click me')

// Vérifier les styles
expect(element).toHaveStyle({ display: 'none' })

// Vérifier la hiérarchie
expect(child).toBeInTheDocument()
expect(parent).toContainElement(child)
```

### Backend - Tests Fonctionnels (API)

**Note**: AdonisJS utilise `@japa/api-client` qui fournit des fonctionnalités similaires à Supertest, mais mieux intégré à l'écosystème AdonisJS.

```typescript
import { test } from '@japa/runner'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Users API', (group) => {
  // Nettoie la base de données avant chaque test
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('GET /api/v1/users returns list of users', async ({ client, assert }) => {
    // Arrange - Créer des données de test
    await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    // Act - Faire la requête API
    const response = await client.get('/api/v1/users')

    // Assert - Vérifier la réponse
    response.assertStatus(200)
    response.assertBodyContains({
      data: [{ email: 'test@example.com' }],
    })
  })

  test('GET /api/v1/users/:id returns 404 for non-existent user', async ({ client }) => {
    const response = await client.get('/api/v1/users/99999')

    response.assertStatus(404)
  })
})
```

### Backend - Assertions API avec @japa/api-client

Le client HTTP de Japa fournit des assertions pratiques pour tester les APIs :

```typescript
// Vérifier le code de statut HTTP
response.assertStatus(200)
response.assertStatus(201)
response.assertStatus(404)

// Vérifier le corps de la réponse
response.assertBody({ success: true })
response.assertBodyContains({ email: 'test@example.com' })

// Vérifier les headers
response.assertHeader('content-type', 'application/json')
response.assertCookie('session_id')

// Vérifier le texte de la réponse
response.assertTextIncludes('Success')

// Accéder aux données brutes
const body = response.body()
const headers = response.headers()
```

### Backend - Tests API avec Supertest

**Alternative à @japa/api-client** - Supertest est une bibliothèque populaire et peut être utilisée avec Japa :

```typescript
import { test } from '@japa/runner'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import request from 'supertest'

test.group('Users API (Supertest)', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('GET /api/v1/users returns list of users', async ({ assert }) => {
    // Arrange
    await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    // Act
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    const response = await request(BASE_URL)
      .get('/api/v1/users')
      .expect(200)
      .expect('Content-Type', /json/)

    // Assert avec Japa
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].email, 'test@example.com')
  })

  test('POST /api/v1/users creates a new user', async ({ assert }) => {
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    const response = await request(BASE_URL)
      .post('/api/v1/users')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      })
      .set('Accept', 'application/json')
      .expect(201)

    assert.equal(response.body.data.email, 'newuser@example.com')
    assert.exists(response.body.data.id)
  })
})
```

### Supertest - API Principale

```typescript
// Méthodes HTTP
await request(baseURL).get('/path')
await request(baseURL).post('/path').send(data)
await request(baseURL).put('/path').send(data)
await request(baseURL).patch('/path').send(data)
await request(baseURL).delete('/path')

// Headers
.set('Authorization', 'Bearer token')
.set('Accept', 'application/json')

// Envoyer des données
.send({ key: 'value' })           // JSON
.send('raw data')                  // Text
.attach('file', buffer)            // Fichier

// Assertions chainées
.expect(200)                       // Status code
.expect('Content-Type', /json/)    // Header regex
.expect({ success: true })         // Body exact
.expect((res) => {                 // Assertion personnalisée
  if (res.body.error) throw new Error('Error!')
})

// Accéder à la réponse
response.status       // Code HTTP
response.body         // Corps de la réponse
response.headers      // Headers
response.text         // Texte brut
```

### Comparaison @japa/api-client vs Supertest

| Feature | @japa/api-client | Supertest |
|---------|-----------------|-----------|
| Intégration AdonisJS | Native | Manuelle |
| Type Safety | Excellente | Bonne |
| Assertions | Intégrées | Via Japa Assert |
| Syntaxe | `.assertStatus()` | `.expect()` |
| Popularité | AdonisJS | Écosystème Node |
| Courbe d'apprentissage | Faible | Faible |

**Recommandation** : Utiliser `@japa/api-client` pour une meilleure intégration, mais Supertest est une excellente alternative si vous préférez une approche plus standard.

### Backend - Tests Unitaires (Modèles)

```typescript
import { test } from '@japa/runner'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('User Model', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('can create a user', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
    })

    assert.exists(user.id)
    assert.equal(user.email, 'test@example.com')
  })

  test('password is hashed on save', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
    })

    assert.notEqual(user.password, 'password123')
  })
})
```

## Bonnes Pratiques

### Général
1. **AAA Pattern**: Arrange, Act, Assert
   ```typescript
   test('example', () => {
     // Arrange - préparer les données
     const user = { name: 'John' }

     // Act - exécuter l'action
     const result = processUser(user)

     // Assert - vérifier le résultat
     expect(result).toBe('John')
   })
   ```

2. **Isolation**: Chaque test doit être indépendant
   - Utiliser `beforeEach` / `afterEach` pour setup/cleanup
   - Ne pas partager d'état entre tests

3. **Descriptif**: Nommage clair des tests
   ```typescript
   // ✅ Bon
   test('should return 404 when user does not exist', ...)

   // ❌ Mauvais
   test('test user', ...)
   ```

### Frontend
1. **Queries**: Utiliser les queries dans l'ordre de priorité
   - `getByRole` (préféré)
   - `getByLabelText`
   - `getByPlaceholderText`
   - `getByText`
   - `getByTestId` (dernier recours)

2. **User Events**: Utiliser `userEvent` au lieu de `fireEvent`
   ```typescript
   // ✅ Bon
   const user = userEvent.setup()
   await user.click(button)

   // ❌ Mauvais
   fireEvent.click(button)
   ```

3. **Async**: Toujours attendre les opérations asynchrones
   ```typescript
   await user.click(button)
   expect(await screen.findByText('Success')).toBeDefined()
   ```

### Backend
1. **Database Cleanup**: Nettoyer la DB entre chaque test
   ```typescript
   group.each.setup(async () => {
     await testUtils.db().truncate()
   })
   ```

2. **Factories**: Utiliser des factories pour les données de test
   - Éviter la duplication de setup
   - Données cohérentes et réalistes

3. **Assertions**: Utiliser les assertions spécifiques
   ```typescript
   response.assertStatus(200)
   response.assertBodyContains({ ... })
   ```

## Coverage

### Frontend
```bash
cd apps/web
pnpm test -- --coverage

# Voir le rapport HTML
open coverage/index.html
```

### Backend
Japa ne fournit pas de coverage par défaut. Pour l'activer :

1. Installer c8
```bash
pnpm add -D c8
```

2. Ajouter au package.json
```json
{
  "scripts": {
    "test:coverage": "c8 node ace test"
  }
}
```

## Objectifs de Coverage

- **Composants UI**: 80% minimum
- **Pages**: 70% minimum
- **Controllers API**: 90% minimum
- **Modèles**: 90% minimum
- **Services métier**: 95% minimum

## Tests E2E (Futur)

Pour les tests end-to-end, nous recommandons :
- **Playwright** (Next.js)
- Couverture des flows utilisateur critiques
- Exécution dans CI/CD

## CI/CD

Exemple de configuration GitHub Actions :

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: pnpm install
      - run: pnpm test
```

## Déboguer les Tests

### Frontend (Vitest)
```typescript
import { screen, debug } from '@testing-library/react'

test('debug example', () => {
  render(<Component />)
  debug() // Affiche le DOM actuel
})
```

### Backend (Japa)
```typescript
test('debug example', async ({ client }) => {
  const response = await client.get('/api/v1/users')
  console.log(response.body()) // Voir la réponse
})
```

## Ressources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Japa Documentation](https://japa.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
