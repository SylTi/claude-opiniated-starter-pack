# Conventions de Codage

## Principes Généraux

### TypeScript Strict
- Toujours utiliser TypeScript
- Mode strict activé
- Pas de `any` (utiliser `unknown` si vraiment nécessaire)
- Typage explicite des retours de fonction

### Async/Await
- Toujours utiliser `async/await` au lieu de `.then()`
- Gérer les erreurs avec `try/catch`

### Imports
- Utiliser les imports ES6 (`import/export`)
- Pas de `require()`
- Imports organisés : externes → internes → relatifs

## Nommage

### Fichiers et Dossiers
- **Frontend (Next.js)**: `kebab-case` pour les fichiers, `PascalCase` pour les composants
- **Backend (AdonisJS)**: `snake_case` pour les fichiers, `PascalCase` pour les classes
- **Packages**: `kebab-case`

### Variables et Fonctions
- **camelCase**: variables, fonctions, méthodes
- **PascalCase**: classes, interfaces, types, composants React
- **UPPER_SNAKE_CASE**: constantes globales

### Base de Données
- **Tables**: `snake_case`, pluriel (`users`, `blog_posts`)
- **Colonnes**: `snake_case` (`full_name`, `created_at`)
- **Foreign keys**: `{table}_id` (`user_id`, `post_id`)

## Structure des Fichiers

### Frontend (Next.js)

```typescript
// Page component
export default function PageName() {
  // Hooks first
  const [state, setState] = useState()

  // Handlers
  const handleClick = async () => {
    // Implementation
  }

  // Render
  return <div>...</div>
}
```

### Backend (AdonisJS)

```typescript
// Controller
export default class ResourcesController {
  async index({ response }: HttpContext): Promise<void> {
    const resources = await Resource.all()
    response.json({ data: resources })
  }

  async show({ params, response }: HttpContext): Promise<void> {
    const resource = await Resource.findOrFail(params.id)
    response.json({ data: resource })
  }
}
```

## Réponses API

### Format Standard
```typescript
// Success
{
  "data": T | T[],
  "message": "Optional message"
}

// Error
{
  "error": "ErrorType",
  "message": "Human readable message",
  "errors": [
    {
      "field": "email",
      "message": "Email is required",
      "rule": "required"
    }
  ]
}
```

### Codes HTTP
- `200`: Success (GET, PUT, PATCH)
- `201`: Created (POST)
- `204`: No Content (DELETE)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (not authorized)
- `404`: Not Found
- `500`: Internal Server Error

## Gestion d'Erreurs

### Frontend
```typescript
try {
  const response = await fetch('/api/v1/users')
  if (!response.ok) {
    throw new Error('Failed to fetch users')
  }
  const data = await response.json()
} catch (error) {
  console.error('Error:', error)
  // Show user feedback
}
```

### Backend
```typescript
async show({ params, response }: HttpContext) {
  try {
    const user = await User.findOrFail(params.id)
    response.json({ data: user })
  } catch (error) {
    if (error.code === 'E_ROW_NOT_FOUND') {
      response.notFound({
        error: 'NotFound',
        message: 'User not found'
      })
    } else {
      response.internalServerError({
        error: 'InternalError',
        message: 'An error occurred'
      })
    }
  }
}
```

## Commentaires

### Quand Commenter
- Logique complexe non évidente
- Hacks temporaires ou workarounds
- TODOs avec contexte

### Quand NE PAS Commenter
- Code auto-explicatif
- Répétition du code en langage naturel
- Code commenté (supprimer au lieu de commenter)

```typescript
// ❌ Mauvais
// This function adds two numbers
function add(a: number, b: number): number {
  return a + b
}

// ✅ Bon
// Workaround for Safari bug: https://bugs.webkit.org/show_bug.cgi?id=123456
if (isSafari) {
  // Special handling
}
```

## Validation

### Backend (VineJS)
```typescript
import vine from '@vinejs/vine'

const createUserSchema = vine.object({
  email: vine.string().email(),
  password: vine.string().minLength(8),
  fullName: vine.string().optional()
})

async store({ request, response }: HttpContext) {
  const data = await request.validateUsing(createUserSchema)
  const user = await User.create(data)
  response.created({ data: user })
}
```

### Frontend
- Validation de base côté client pour UX
- Toujours valider côté serveur (source de vérité)

## Tests

### Naming
```typescript
describe('UsersController', () => {
  test('should return all users', async () => {
    // Arrange
    const users = await Factory.create('User', 3)

    // Act
    const response = await client.get('/api/v1/users')

    // Assert
    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(3)
  })
})
```

## Git Commits

### Format
```
type(scope): subject

body (optional)
```

### Types
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage, point-virgules manquants, etc.
- `refactor`: Refactoring de code
- `test`: Ajout de tests
- `chore`: Maintenance (dépendances, config, etc.)

### Exemples
```
feat(api): add user registration endpoint
fix(web): correct button alignment on mobile
docs: update architecture documentation
refactor(shared): simplify UserDTO interface
```
