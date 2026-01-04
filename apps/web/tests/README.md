# Tests Frontend - Next.js

Ce dossier contient tous les tests du frontend Next.js.

## Structure

```
tests/
├── setup.ts              # Configuration Vitest + jest-dom
├── vitest.d.ts          # Types TypeScript pour jest-dom
├── components/          # Tests des composants UI
│   └── button.test.tsx
└── pages/               # Tests des pages Next.js
    └── dashboard.test.tsx
```

## Stack de Test

- **Vitest**: Framework de test rapide et moderne
- **React Testing Library**: Tests centrés sur le comportement utilisateur
- **@testing-library/jest-dom**: Matchers expressifs pour le DOM
- **@testing-library/user-event**: Simulation d'interactions utilisateur

## Exemple de Test

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('renders and handles clicks', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)

    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()

    await user.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })
})
```

## Matchers jest-dom Utiles

```typescript
// Présence dans le DOM
expect(element).toBeInTheDocument()
expect(element).toBeVisible()

// État des inputs
expect(input).toBeDisabled()
expect(input).toBeEnabled()
expect(checkbox).toBeChecked()
expect(input).toHaveValue('text')

// Classes et attributs
expect(element).toHaveClass('bg-primary')
expect(element).toHaveAttribute('href', '/dashboard')
expect(element).toHaveTextContent('Hello')
```

## Queries Recommandées

Ordre de priorité pour sélectionner les éléments :

1. **getByRole** (préféré) - Accessible et sémantique
2. **getByLabelText** - Pour les inputs avec label
3. **getByPlaceholderText** - Pour les inputs avec placeholder
4. **getByText** - Pour le contenu textuel
5. **getByTestId** - Dernier recours uniquement

```typescript
// ✅ Bon
screen.getByRole('button', { name: 'Submit' })
screen.getByLabelText('Email')

// ❌ À éviter (sauf nécessaire)
screen.getByTestId('submit-button')
```

## Exécuter les Tests

```bash
# Tous les tests (run once)
pnpm run web:test

# Watch mode (re-run on changes)
pnpm run web:test:watch

# UI mode (interface graphique)
pnpm run web:test:ui

# Coverage
pnpm run web:test:coverage
```

## E2E (Playwright)

Les E2E utilisent un build de production (`pnpm run build && pnpm run start`).

```bash
# Pré-requis: base de données de test + seed
pnpm run docker:test:up
export NEXT_PUBLIC_API_URL=http://localhost:3333
cd apps/api
NODE_ENV=test node ace migration:fresh
NODE_ENV=test node ace db:seed

# Lancer l'API en test (dans un autre terminal)
NODE_ENV=test pnpm --filter api run dev

# Lancer les E2E
pnpm run web:e2e
pnpm run web:e2e:headed
pnpm run web:e2e:ui
```

## Bonnes Pratiques

1. **User-centric**: Tester le comportement utilisateur, pas l'implémentation
2. **Async**: Toujours await les interactions utilisateur
3. **Cleanup**: Automatique avec `@testing-library/react`
4. **Queries**: Privilégier les queries par rôle
5. **Matchers**: Utiliser les matchers jest-dom pour la lisibilité

## Documentation Complète

- [Guide des Tests](/docs/testing.md)
- [Configuration Détaillée](/docs/testing-setup.md)
