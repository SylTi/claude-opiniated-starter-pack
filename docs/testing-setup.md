# Configuration des Tests - Détails Techniques

## Frontend - Configuration Vitest avec jest-dom

### Packages Installés

```bash
pnpm add -D vitest @vitejs/plugin-react
pnpm add -D @testing-library/react @testing-library/dom @testing-library/user-event
pnpm add -D @testing-library/jest-dom happy-dom
```

### Fichiers de Configuration

#### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

#### tests/setup.ts
```typescript
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

afterEach(() => {
  cleanup()
})
```

#### tests/vitest.d.ts
```typescript
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  interface Assertion<T = any> extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers {}
}
```

### Avantages de @testing-library/jest-dom

**Avant (sans jest-dom)**:
```typescript
// Verbose et moins lisible
expect(screen.getByRole('button')).toBeDefined()
expect(button.disabled).toBe(true)
expect(button.className).toContain('bg-primary')
```

**Après (avec jest-dom)**:
```typescript
// Expressif et lisible
expect(screen.getByRole('button')).toBeInTheDocument()
expect(button).toBeDisabled()
expect(button).toHaveClass('bg-primary')
```

### Matchers Disponibles

#### Présence et Visibilité
- `toBeInTheDocument()` - Élément existe dans le DOM
- `toBeVisible()` - Élément est visible
- `toBeEmptyDOMElement()` - Élément n'a pas de contenu

#### États des Inputs
- `toBeDisabled()` - Input est désactivé
- `toBeEnabled()` - Input est activé
- `toBeChecked()` - Checkbox/radio est coché
- `toBeRequired()` - Input est requis
- `toHaveValue(value)` - Input a une valeur spécifique
- `toHaveFocus()` - Élément a le focus

#### Attributs et Classes
- `toHaveClass(...classes)` - Vérifie les classes CSS
- `toHaveAttribute(attr, value)` - Vérifie un attribut
- `toHaveTextContent(text)` - Vérifie le contenu texte
- `toHaveStyle(styles)` - Vérifie les styles inline

#### Formulaires
- `toBeValid()` - Champ de formulaire est valide
- `toBeInvalid()` - Champ de formulaire est invalide
- `toHaveFormValues(values)` - Formulaire a des valeurs

## Backend - Configuration Japa

### Packages Installés

**Par défaut avec AdonisJS:**
```json
{
  "@japa/runner": "^4.2.0",
  "@japa/assert": "^4.0.1",
  "@japa/api-client": "^3.1.0",
  "@japa/plugin-adonisjs": "^4.0.0"
}
```

**Optionnel - Supertest (alternative):**
```bash
pnpm add -D supertest @types/supertest
```

### Structure de Configuration

#### tests/bootstrap.ts
```typescript
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'

export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app)
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
```

### @japa/api-client vs Supertest

**Pourquoi @japa/api-client ?**

1. **Intégration Native**: Conçu spécifiquement pour AdonisJS
2. **Type Safety**: TypeScript first avec auto-complétion
3. **Assertions Intégrées**: Pas besoin de chaîner avec une autre bibliothèque
4. **Gestion du Serveur**: Démarre/arrête automatiquement le serveur de test

**Comparaison**:

```typescript
// Supertest (approche traditionnelle)
import request from 'supertest'
const response = await request(app).get('/users')
expect(response.status).toBe(200)
expect(response.body).toHaveProperty('data')

// @japa/api-client (approche AdonisJS)
const response = await client.get('/api/v1/users')
response.assertStatus(200)
response.assertBodyContains({ data: expect.any(Array) })
```

### Utiliser Supertest avec Japa

Supertest peut être utilisé comme alternative à @japa/api-client :

**Installation:**
```bash
pnpm add -D supertest @types/supertest
```

**Exemple d'utilisation:**
```typescript
import { test } from '@japa/runner'
import request from 'supertest'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('API Tests', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('GET /api/v1/users', async ({ assert }) => {
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

    const response = await request(BASE_URL)
      .get('/api/v1/users')
      .expect(200)
      .expect('Content-Type', /json/)

    assert.isArray(response.body.data)
  })
})
```

**Avantages de Supertest:**
- Très populaire dans l'écosystème Node.js
- Documentation extensive et communauté large
- Syntaxe chainable intuitive
- Supporte tous les types de requêtes HTTP

**Inconvénients:**
- Nécessite configuration manuelle de l'URL
- Pas d'intégration native avec AdonisJS
- Doit être combiné avec Japa Assert pour les assertions avancées

**Quand utiliser Supertest:**
- Vous migrez d'un autre framework Node.js
- Votre équipe est déjà familière avec Supertest
- Vous préférez une approche standard Node.js

**Quand utiliser @japa/api-client:**
- Nouveau projet AdonisJS (recommandé)
- Vous voulez une intégration optimale
- Vous préférez les assertions intégrées

### Plugins Japa Utiles

#### @japa/assert
Fournit des assertions riches pour les tests :
```typescript
assert.equal(1, 1)
assert.isTrue(value)
assert.deepEqual(obj1, obj2)
assert.throws(() => throwError())
assert.isNull(value)
assert.exists(value)
```

#### @japa/plugin-adonisjs
Intégration avec l'écosystème AdonisJS :
- Gestion automatique du cycle de vie de l'app
- Accès aux services AdonisJS
- Helpers pour la base de données
- Gestion des sessions et cookies

#### testUtils (AdonisJS)
Utilitaires pour les tests :
```typescript
// Nettoyer la base de données
await testUtils.db().truncate()

// Migrer la base de données
await testUtils.db().migrate()

// Seed la base de données
await testUtils.db().seed()

// Démarrer le serveur HTTP
await testUtils.httpServer().start()
```

## Bonnes Pratiques

### Frontend

1. **Toujours utiliser les matchers jest-dom**
   ```typescript
   // ✅ Bon
   expect(element).toBeInTheDocument()

   // ❌ À éviter
   expect(element).toBeDefined()
   ```

2. **Préférer les queries par rôle**
   ```typescript
   // ✅ Bon
   screen.getByRole('button', { name: 'Submit' })

   // ❌ À éviter (sauf si nécessaire)
   screen.getByTestId('submit-button')
   ```

3. **Utiliser userEvent pour les interactions**
   ```typescript
   // ✅ Bon
   const user = userEvent.setup()
   await user.click(button)

   // ❌ À éviter
   fireEvent.click(button)
   ```

### Backend

1. **Toujours nettoyer la base de données**
   ```typescript
   group.each.setup(async () => {
     await testUtils.db().truncate()
   })
   ```

2. **Utiliser les assertions du client API**
   ```typescript
   // ✅ Bon
   response.assertStatus(200)
   response.assertBodyContains({ email: 'test@example.com' })

   // ❌ À éviter
   assert.equal(response.status(), 200)
   assert.include(response.body(), { email: 'test@example.com' })
   ```

3. **Grouper les tests par fonctionnalité**
   ```typescript
   test.group('Users API', () => {
     // Tous les tests liés aux users
   })

   test.group('Auth API', () => {
     // Tous les tests liés à l'auth
   })
   ```

## Migration depuis d'autres outils

### De Jest vers Vitest

Vitest est compatible avec l'API Jest, donc la plupart du code fonctionne sans modification.

**Changements nécessaires**:
- Importer `expect` de `vitest` au lieu de global
- Utiliser `vi.fn()` au lieu de `jest.fn()`
- Configuration dans `vitest.config.ts` au lieu de `jest.config.js`

### De Supertest standalone vers Supertest + Japa

Si vous utilisez déjà Supertest, vous pouvez le continuer avec Japa :

**Avant (Supertest + Jest/Mocha)**:
```typescript
import request from 'supertest'
import { expect } from 'chai'

describe('Users API', () => {
  it('should return users', async () => {
    const response = await request(app)
      .get('/users')
      .expect(200)

    expect(response.body).to.have.property('data')
  })
})
```

**Après (Supertest + Japa)**:
```typescript
import { test } from '@japa/runner'
import request from 'supertest'

test.group('Users API', () => {
  test('should return users', async ({ assert }) => {
    const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
    const response = await request(BASE_URL)
      .get('/api/v1/users')
      .expect(200)

    assert.property(response.body, 'data')
  })
})
```

### De Supertest vers @japa/api-client

Si vous voulez migrer vers l'outil natif AdonisJS :

**Supertest**:
```typescript
const response = await request(app)
  .post('/users')
  .send({ email: 'test@example.com' })
  .expect(201)
```

**@japa/api-client**:
```typescript
const response = await client
  .post('/api/v1/users')
  .json({ email: 'test@example.com' })

response.assertStatus(201)
```

**Note**: Les deux approches sont valides. Utilisez @japa/api-client pour une meilleure intégration, ou gardez Supertest si vous êtes plus à l'aise avec.

## Ressources

### Frontend
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
- [user-event Documentation](https://testing-library.com/docs/user-event/intro)

### Backend
- [Japa Documentation](https://japa.dev/)
- [AdonisJS Testing Guide](https://docs.adonisjs.com/guides/testing)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [@japa/api-client](https://japa.dev/docs/plugins/api-client)
