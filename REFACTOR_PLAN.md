# Plan de Refactoring - Code Review Implementation

> Ce document contient le plan d'implémentation pour chaque critique validée de la code review.

---

## Résumé des Critiques Validées

| # | Critique | Priorité | Status |
|---|----------|----------|--------|
| 1 | Validation manuelle vs VineJS | HAUTE | ✅ Fait |
| 2 | SVG inline | BASSE | ✅ Fait |
| 3 | API fallback localhost | CRITIQUE | ✅ Fait |
| 4 | Security (CSRF/Headers) | HAUTE | ✅ Fait |
| 5 | Team membership restrictif | MOYENNE | ✅ Fait |
| 6 | Race condition slug | HAUTE | ✅ Fait |
| 7 | DTOs - Utiliser `@saas/shared` directement | MOYENNE | ✅ Vérifié |
| 8 | Server-Side Auth Guard | HAUTE | ✅ Fait |
| 9 | E2E Tests Réels | HAUTE | **EXCLUS** - Travail en cours |
| 10 | Database Consistency (indexes) | MOYENNE | ✅ Déjà en place |

---

## Phase 1: Sécurité Critique (URGENT)

### 1.1 API Client Fallback (Critique #3)

**Fichiers à modifier:**
- `apps/web/lib/api.ts`
- `apps/web/lib/auth.ts`

**Changement:**
```typescript
// AVANT (dangereux)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

// APRES (sécurisé)
const getApiUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Configuration Error: NEXT_PUBLIC_API_URL is required in production.'
      )
    }
    return 'http://localhost:3333'
  }

  return url
}

const API_BASE_URL = getApiUrl()
```

**Tests à mettre à jour:**
- `apps/web/tests/lib/api.test.ts`
- `apps/web/tests/lib/auth.test.ts`

---

### 1.2 Security Headers & CSRF (Critique #4)

**Étape 1: Installer @adonisjs/shield**
```bash
cd apps/api
pnpm add @adonisjs/shield
node ace configure @adonisjs/shield
```

**Étape 2: Configurer dans `start/kernel.ts`**
```typescript
server.use([
  () => import('@adonisjs/shield/shield_middleware'),  // AJOUTER
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])
```

**Étape 3: Modifier session config**
```typescript
// config/session.ts - Ligne cookie.sameSite
sameSite: 'strict',  // Changer de 'lax' à 'strict'
```

**Alternative si shield non possible - Créer middleware manuel:**
```typescript
// apps/api/app/middleware/security_headers_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SecurityHeadersMiddleware {
  async handle({ response }: HttpContext, next: NextFn): Promise<void> {
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('X-Frame-Options', 'DENY')
    response.header('X-XSS-Protection', '1; mode=block')
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    await next()
  }
}
```

---

### 1.3 Server-Side Auth Guard (Critique #8)

**Créer `apps/web/middleware.ts`:**
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password']
const adminRoutes = ['/admin']

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith('/api'))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('adonis-session')

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // For admin routes, verify admin role via API
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { cookie: request.headers.get('cookie') || '' },
      })

      if (!res.ok) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      const { data: user } = await res.json()
      if (user.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}
```

**Fichiers à simplifier (retirer useEffect redirects):**
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/profile/layout.tsx`
- Pages `/admin/*`

---

## Phase 2: Backend Validation (Critique #1)

### 2.1 Créer les Validators

**Fichier: `apps/api/app/validators/coupon.ts`**
```typescript
import vine from '@vinejs/vine'

export const createCouponValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(3).maxLength(50),
    creditAmount: vine.number().min(1),
    currency: vine.string().fixedLength(3).optional(),
    expiresAt: vine.date().after('today').optional(),
  })
)

export const redeemCouponValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
  })
)
```

**Fichier: `apps/api/app/validators/discount_code.ts`**
```typescript
import vine from '@vinejs/vine'

export const createDiscountCodeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(3).maxLength(50).transform((v) => v.toUpperCase()),
    description: vine.string().optional(),
    discountType: vine.enum(['percent', 'fixed']),
    discountValue: vine.number().min(0),
    currency: vine.string().fixedLength(3).optional()
      .requiredWhen('discountType', '=', 'fixed'),
    minAmount: vine.number().min(0).optional(),
    maxUses: vine.number().min(1).optional(),
    maxUsesPerUser: vine.number().min(1).optional(),
    expiresAt: vine.date().after('today').optional(),
    isActive: vine.boolean().optional(),
  })
)

export const validateDiscountCodeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
    priceId: vine.number().positive(),
  })
)
```

**Fichier: `apps/api/app/validators/team.ts`**
```typescript
import vine from '@vinejs/vine'

export const createTeamValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
  })
)

export const addMemberValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    role: vine.enum(['admin', 'member']).optional(),
  })
)

export const sendInvitationValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    role: vine.enum(['admin', 'member']).optional(),
  })
)
```

**Fichier: `apps/api/app/validators/payment.ts`**
```typescript
import vine from '@vinejs/vine'

export const createCheckoutValidator = vine.compile(
  vine.object({
    priceId: vine.number().positive(),
    discountCode: vine.string().optional(),
  })
)
```

**Fichier: `apps/api/app/validators/admin.ts`**
```typescript
import vine from '@vinejs/vine'

export const updateUserTierValidator = vine.compile(
  vine.object({
    subscriptionTier: vine.string().minLength(1),
  })
)

export const createProductValidator = vine.compile(
  vine.object({
    tierId: vine.number().positive(),
    provider: vine.string().minLength(1),
    providerProductId: vine.string().minLength(1),
  })
)

export const createPriceValidator = vine.compile(
  vine.object({
    productId: vine.number().positive(),
    provider: vine.string().minLength(1),
    providerPriceId: vine.string().minLength(1),
    interval: vine.enum(['month', 'year']),
    currency: vine.string().fixedLength(3),
    unitAmount: vine.number().min(0),
  })
)
```

### 2.2 Refactorer les Controllers

Pour chaque controller, remplacer la validation manuelle:
```typescript
// AVANT
const data = request.only(['code', 'creditAmount'])
if (!data.code || data.creditAmount === undefined) {
  return response.badRequest({ error: 'ValidationError', message: '...' })
}

// APRES
import { createCouponValidator } from '#validators/coupon'
const data = await request.validateUsing(createCouponValidator)
```

**Controllers à refactorer:**
| Controller | Méthodes | Lignes |
|------------|----------|--------|
| `admin_controller.ts` | `updateUserTier`, `createProduct`, `createPrice` | 189-194, 464-468, 602-614 |
| `coupons_controller.ts` | `store`, `redeem` | 75-87, 206-211 |
| `discount_codes_controller.ts` | `store`, `validate` | 91-110, 241-246 |
| `payment_controller.ts` | `createCheckout` | 57-62 |
| `teams_controller.ts` | `store`, `addMember`, `sendInvitation` | 40-44, 238-243, 471-476 |

---

## Phase 3: Race Conditions (Critique #6)

### 3.1 Refactorer la génération de slug

**Fichier: `apps/api/app/controllers/teams_controller.ts` - Méthode `store()`**

```typescript
import string from '@adonisjs/core/helpers/string'
import db from '@adonisjs/lucid/services/db'

async store({ request, response, auth }: HttpContext): Promise<void> {
  const data = await request.validateUsing(createTeamValidator)
  const user = auth.getUserOrFail()

  const team = await db.transaction(async (trx) => {
    const baseSlug = string.slug(data.name).toLowerCase()
    let slug = baseSlug

    const existingTeam = await Team.query({ client: trx })
      .where('slug', slug)
      .first()

    if (existingTeam) {
      slug = `${baseSlug}-${string.random(4).toLowerCase()}`
    }

    return await Team.create({
      name: data.name.trim(),
      slug,
      ownerId: user.id,
    }, { client: trx })
  })

  response.created({ data: { id: team.id, name: team.name, slug: team.slug } })
}
```

**Même pattern pour:**
- `apps/api/app/controllers/coupons_controller.ts` - `store()`
- `apps/api/app/controllers/discount_codes_controller.ts` - `store()`

---

## Phase 4: Team Multi-Membership (Critique #5)

### 4.1 Modifier addMember

**Fichier: `apps/api/app/controllers/teams_controller.ts` - Méthode `addMember()`**

**SUPPRIMER les lignes 277-296** (logique qui retire l'utilisateur des autres équipes).

**Remplacer par:**
```typescript
// Vérifier seulement s'il est déjà dans CETTE équipe
const existingMembership = await TeamMember.query()
  .where('userId', newMember.id)
  .where('teamId', teamId)
  .first()

if (existingMembership) {
  return response.badRequest({
    error: 'ValidationError',
    message: 'User is already a member of this team',
  })
}

// Créer le membership (sans supprimer les autres)
await TeamMember.create({
  userId: newMember.id,
  teamId: Number(teamId),
  role: data.role || 'member',
})
```

**Même modification pour `acceptInvitation()` (lignes 782-801).**

---

## Phase 5: DTOs (Critique #7)

Les types DTO existent dans `@saas/shared`. Les controllers doivent construire les objets de réponse conformes à ces types.

**Exemple de refactoring (utiliser directement les types):**
```typescript
import type { UserDTO } from '@saas/shared'

// Dans le controller
const userResponse: UserDTO = {
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  // ... autres champs selon le type
}

response.json({ data: userResponse })
```

**Controllers à vérifier pour conformité avec `@saas/shared`:**
- `admin_controller.ts` - Vérifier `AdminUserDTO`, `AdminTeamDTO`
- `auth_controller.ts` - Vérifier `UserDTO`, `LoginResponseDTO`
- `coupons_controller.ts` - Vérifier `CouponDTO`
- `discount_codes_controller.ts` - Vérifier `DiscountCodeDTO`
- `teams_controller.ts` - Vérifier `TeamDTO`, `TeamMemberDTO`, `TeamInvitationDTO`
- `payment_controller.ts` - Vérifier `PriceDTO`, `BillingTierDTO`

---

## Phase 6: Frontend Icons (Critique #2)

### 6.1 Créer le fichier d'icônes

**Fichier: `apps/web/components/icons/oauth-icons.tsx`**
```tsx
import type { ComponentProps } from 'react'

export function GoogleIcon(props: ComponentProps<'svg'>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export function GitHubIcon(props: ComponentProps<'svg'>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}
```

### 6.2 Mettre à jour les pages

**Fichiers à modifier:**
- `apps/web/app/(auth)/login/page.tsx` - Importer depuis `@/components/icons/oauth-icons`
- `apps/web/app/(auth)/register/page.tsx` - Importer depuis `@/components/icons/oauth-icons`
- `apps/web/app/profile/settings/page.tsx` - Supprimer les définitions locales, importer

---

## Phase 7: Database Indexes (Critique #10)

### 7.1 Créer une nouvelle migration

```bash
cd apps/api
node ace make:migration add_missing_indexes
```

**Fichier migration:**
```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.alterTable('users', (table) => {
      table.index('email', 'users_email_idx')
    })

    this.schema.alterTable('teams', (table) => {
      table.index('slug', 'teams_slug_idx')
      table.index('owner_id', 'teams_owner_id_idx')
      table.index('created_at', 'teams_created_at_idx')
    })

    this.schema.alterTable('payment_customers', (table) => {
      table.index(['subscriber_type', 'subscriber_id'], 'payment_customers_subscriber_idx')
      table.index('provider', 'payment_customers_provider_idx')
    })

    this.schema.alterTable('products', (table) => {
      table.index('provider', 'products_provider_idx')
    })

    this.schema.alterTable('discount_codes', (table) => {
      table.index('code', 'discount_codes_code_idx')
      table.index('is_active', 'discount_codes_is_active_idx')
      table.index('expires_at', 'discount_codes_expires_at_idx')
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable('users', (table) => {
      table.dropIndex('email', 'users_email_idx')
    })
    this.schema.alterTable('teams', (table) => {
      table.dropIndex('slug', 'teams_slug_idx')
      table.dropIndex('owner_id', 'teams_owner_id_idx')
      table.dropIndex('created_at', 'teams_created_at_idx')
    })
    this.schema.alterTable('payment_customers', (table) => {
      table.dropIndex(['subscriber_type', 'subscriber_id'], 'payment_customers_subscriber_idx')
      table.dropIndex('provider', 'payment_customers_provider_idx')
    })
    this.schema.alterTable('products', (table) => {
      table.dropIndex('provider', 'products_provider_idx')
    })
    this.schema.alterTable('discount_codes', (table) => {
      table.dropIndex('code', 'discount_codes_code_idx')
      table.dropIndex('is_active', 'discount_codes_is_active_idx')
      table.dropIndex('expires_at', 'discount_codes_expires_at_idx')
    })
  }
}
```

---

## Phase 8: Database Seeders (pour tests E2E futurs)

### 8.1 Créer le seeder de données de test

**Fichier: `apps/api/database/seeders/test_data_seeder.ts`**
```typescript
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import User from '#models/user'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import SubscriptionTier from '#models/subscription_tier'
import Subscription from '#models/subscription'
import Coupon from '#models/coupon'
import DiscountCode from '#models/discount_code'
import Product from '#models/product'
import Price from '#models/price'

export default class TestDataSeeder extends BaseSeeder {
  async run(): Promise<void> {
    // 1. Subscription tiers
    const freeTier = await SubscriptionTier.firstOrCreate(
      { slug: 'free' },
      {
        slug: 'free', name: 'Free', description: 'Free tier',
        level: 0, maxTeamMembers: 1, priceMonthly: 0,
        yearlyDiscountPercent: 0, features: { basic: true }, isActive: true,
      }
    )

    const tier1 = await SubscriptionTier.firstOrCreate(
      { slug: 'tier1' },
      {
        slug: 'tier1', name: 'Tier 1', description: 'Tier 1',
        level: 1, maxTeamMembers: 5, priceMonthly: 1999,
        yearlyDiscountPercent: 20, features: { basic: true, advanced: true }, isActive: true,
      }
    )

    const tier2 = await SubscriptionTier.firstOrCreate(
      { slug: 'tier2' },
      {
        slug: 'tier2', name: 'Tier 2', description: 'Tier 2',
        level: 2, maxTeamMembers: 25, priceMonthly: 4999,
        yearlyDiscountPercent: 25, features: { basic: true, advanced: true, premium: true }, isActive: true,
      }
    )

    // 2. Admin user
    const admin = await User.firstOrCreate(
      { email: 'admin@test.com' },
      {
        email: 'admin@test.com', password: 'password123',
        fullName: 'Test Admin', role: 'admin',
        emailVerifiedAt: DateTime.now(), balance: 10000,
      }
    )

    // 3. Standard user
    const user = await User.firstOrCreate(
      { email: 'user@test.com' },
      {
        email: 'user@test.com', password: 'password123',
        fullName: 'Test User', role: 'user',
        emailVerifiedAt: DateTime.now(), balance: 5000,
      }
    )

    // 4. User without team
    await User.firstOrCreate(
      { email: 'noteam@test.com' },
      {
        email: 'noteam@test.com', password: 'password123',
        fullName: 'User No Team', role: 'user',
        emailVerifiedAt: DateTime.now(), balance: 0,
      }
    )

    // 5. Test team
    const team = await Team.firstOrCreate(
      { slug: 'test-team' },
      {
        name: 'Test Team', slug: 'test-team',
        ownerId: user.id, maxMembers: 10, balance: 25000,
      }
    )

    // 6. Team membership
    await TeamMember.firstOrCreate(
      { userId: user.id, teamId: team.id },
      { userId: user.id, teamId: team.id, role: 'owner' }
    )

    user.currentTeamId = team.id
    await user.save()

    // 7. Team subscription
    await Subscription.firstOrCreate(
      { subscriberType: 'team', subscriberId: team.id },
      {
        subscriberType: 'team', subscriberId: team.id, tierId: tier1.id,
        status: 'active', startsAt: DateTime.now(),
        expiresAt: DateTime.now().plus({ months: 1 }),
      }
    )

    // 8. Coupons
    await Coupon.firstOrCreate(
      { code: 'TEST50' },
      {
        code: 'TEST50', description: '$50 credit', creditAmount: 5000,
        currency: 'USD', expiresAt: DateTime.now().plus({ months: 6 }), isActive: true,
      }
    )

    await Coupon.firstOrCreate(
      { code: 'EXPIRED' },
      {
        code: 'EXPIRED', description: 'Expired coupon', creditAmount: 1000,
        currency: 'USD', expiresAt: DateTime.now().minus({ days: 1 }), isActive: true,
      }
    )

    await Coupon.firstOrCreate(
      { code: 'REDEEMED' },
      {
        code: 'REDEEMED', description: 'Redeemed coupon', creditAmount: 2000,
        currency: 'USD', expiresAt: DateTime.now().plus({ months: 1 }),
        isActive: false, redeemedByUserId: user.id, redeemedAt: DateTime.now().minus({ days: 5 }),
      }
    )

    // 9. Discount codes
    await DiscountCode.firstOrCreate(
      { code: 'DISCOUNT20' },
      {
        code: 'DISCOUNT20', description: '20% off', discountType: 'percent',
        discountValue: 20, maxUses: 100, maxUsesPerUser: 1, timesUsed: 5,
        expiresAt: DateTime.now().plus({ months: 3 }), isActive: true,
      }
    )

    await DiscountCode.firstOrCreate(
      { code: 'FLAT500' },
      {
        code: 'FLAT500', description: '$5 off', discountType: 'fixed',
        discountValue: 500, currency: 'USD', minAmount: 1000,
        maxUses: 50, timesUsed: 10, expiresAt: DateTime.now().plus({ months: 2 }), isActive: true,
      }
    )

    await DiscountCode.firstOrCreate(
      { code: 'INACTIVE' },
      {
        code: 'INACTIVE', description: 'Inactive', discountType: 'percent',
        discountValue: 10, isActive: false,
      }
    )

    // 10. Products and prices
    const product1 = await Product.firstOrCreate(
      { tierId: tier1.id },
      { tierId: tier1.id, provider: 'stripe', providerProductId: 'prod_test_tier1' }
    )

    const product2 = await Product.firstOrCreate(
      { tierId: tier2.id },
      { tierId: tier2.id, provider: 'stripe', providerProductId: 'prod_test_tier2' }
    )

    await Price.firstOrCreate(
      { productId: product1.id, interval: 'month' },
      {
        productId: product1.id, provider: 'stripe', providerPriceId: 'price_test_tier1_monthly',
        interval: 'month', currency: 'USD', unitAmount: 1999, taxBehavior: 'exclusive', isActive: true,
      }
    )

    await Price.firstOrCreate(
      { productId: product1.id, interval: 'year' },
      {
        productId: product1.id, provider: 'stripe', providerPriceId: 'price_test_tier1_yearly',
        interval: 'year', currency: 'USD', unitAmount: 19190, taxBehavior: 'exclusive', isActive: true,
      }
    )

    await Price.firstOrCreate(
      { productId: product2.id, interval: 'month' },
      {
        productId: product2.id, provider: 'stripe', providerPriceId: 'price_test_tier2_monthly',
        interval: 'month', currency: 'USD', unitAmount: 4999, taxBehavior: 'exclusive', isActive: true,
      }
    )

    await Price.firstOrCreate(
      { productId: product2.id, interval: 'year' },
      {
        productId: product2.id, provider: 'stripe', providerPriceId: 'price_test_tier2_yearly',
        interval: 'year', currency: 'USD', unitAmount: 44991, taxBehavior: 'exclusive', isActive: true,
      }
    )

    console.log('Test data seeded successfully!')
  }
}
```

### 8.2 Commande pour seed

```bash
cd apps/api
NODE_ENV=test node ace db:seed --files database/seeders/test_data_seeder.ts
```

---

## Ordre d'Exécution Recommandé

### Sprint 1 (Critique - 1-2 jours)
1. [ ] 1.1 API Client Fallback
2. [ ] 1.2 Security Headers & Shield
3. [ ] 1.3 Server-Side Auth Guard (middleware.ts)

### Sprint 2 (Haute priorité - 2-3 jours)
4. [ ] 2.1-2.2 VineJS Validators
5. [ ] 3.1 Race Conditions

### Sprint 3 (Moyenne priorité - 2-3 jours)
6. [ ] 4.1 Team Multi-Membership
7. [ ] 5 DTOs conformité @saas/shared
8. [ ] 7.1 Database Indexes

### Sprint 4 (Amélioration - 1-2 jours)
9. [ ] 6.1-6.2 Frontend Icons
10. [ ] 8.1-8.2 Database Seeders

---

## Commandes de Vérification

```bash
# Après chaque phase
pnpm run api:test
pnpm run web:test

# Après Phase 7
cd apps/api
node ace migration:run
NODE_ENV=test node ace migration:run

# Après Phase 8
NODE_ENV=test node ace db:seed --files database/seeders/test_data_seeder.ts
```

---

## RAPPEL: Tests E2E à Refactorer (Travail Exclus)

> **Note:** Cette section est pour référence uniquement. Quelqu'un travaille déjà sur les tests qui échouent.
> Une fois ce travail terminé, il faudra refactorer ces tests pour utiliser la vraie DB au lieu des mocks.

### Liste Exhaustive des Tests E2E Mockés (45 fichiers)

Tous ces tests utilisent `page.route()` pour mocker l'API au lieu de se connecter à une vraie base de données:

**Auth (6 fichiers):**
- `apps/web/e2e/auth/login.spec.ts`
- `apps/web/e2e/auth/register.spec.ts`
- `apps/web/e2e/auth/logout.spec.ts`
- `apps/web/e2e/auth/forgot-password.spec.ts`
- `apps/web/e2e/auth/reset-password.spec.ts`
- `apps/web/e2e/auth/oauth-callback.spec.ts`

**Admin (6 fichiers):**
- `apps/web/e2e/admin/admin-access.spec.ts`
- `apps/web/e2e/admin/admin-dashboard.spec.ts`
- `apps/web/e2e/admin/coupons.spec.ts`
- `apps/web/e2e/admin/discount-codes.spec.ts`
- `apps/web/e2e/admin/users-actions.spec.ts`
- `apps/web/e2e/admin/users-table.spec.ts`

**Billing (6 fichiers):**
- `apps/web/e2e/billing/balance.spec.ts`
- `apps/web/e2e/billing/checkout.spec.ts`
- `apps/web/e2e/billing/coupon-redeem.spec.ts`
- `apps/web/e2e/billing/discount-code.spec.ts`
- `apps/web/e2e/billing/pricing-plans.spec.ts`
- `apps/web/e2e/billing/subscription-status.spec.ts`

**Dashboard (6 fichiers):**
- `apps/web/e2e/dashboard/feature-cards.spec.ts`
- `apps/web/e2e/dashboard/stats.spec.ts`
- `apps/web/e2e/dashboard/subscription-info.spec.ts`
- `apps/web/e2e/dashboard/recent-activity.spec.ts`
- `apps/web/e2e/dashboard/quick-actions.spec.ts`
- `apps/web/e2e/dashboard/*.spec.ts` (autres fichiers dans ce dossier)

**Profile (5 fichiers):**
- `apps/web/e2e/profile/profile-edit.spec.ts`
- `apps/web/e2e/profile/settings-linked.spec.ts`
- `apps/web/e2e/profile/settings-activity.spec.ts`
- `apps/web/e2e/profile/security-password.spec.ts`
- `apps/web/e2e/profile/security-mfa.spec.ts`

**Team (5 fichiers):**
- `apps/web/e2e/team/team-access.spec.ts`
- `apps/web/e2e/team/team-display.spec.ts`
- `apps/web/e2e/team/team-members.spec.ts`
- `apps/web/e2e/team/invite-members.spec.ts`
- `apps/web/e2e/team/pending-invitations.spec.ts`

**Navigation (3 fichiers):**
- `apps/web/e2e/navigation/header.spec.ts`
- `apps/web/e2e/navigation/user-menu.spec.ts`
- `apps/web/e2e/navigation/protected-routes.spec.ts`

**Forms (1 fichier):**
- `apps/web/e2e/forms/form-validation.spec.ts`

**Errors (5 fichiers):**
- `apps/web/e2e/errors/api-errors.spec.ts`
- `apps/web/e2e/errors/error-pages.spec.ts`
- `apps/web/e2e/errors/loading-states.spec.ts`
- `apps/web/e2e/errors/responsive.spec.ts`
- `apps/web/e2e/errors/accessibility.spec.ts`

**Other:**
- `apps/web/e2e/example.spec.ts`

### Fixtures de Mock à Refactorer

- `apps/web/e2e/fixtures/api-mock.fixture.ts` - Contient toutes les fonctions de mock
- `apps/web/e2e/fixtures/auth.fixture.ts` - Mock d'authentification

### Ce Qui N'Est PAS Testé Actuellement

- Authentification réelle (login/password contre DB)
- Opérations CRUD réelles
- Flows de paiement Stripe (même mockés côté Stripe, la DB devrait être réelle)
- Persistance des données entre les requêtes
- Sessions et tokens réels
- Multi-utilisateurs concurrents

### Stratégie de Refactoring Recommandée

1. Garder les tests mockés comme "tests unitaires frontend" dans `e2e/unit/`
2. Créer de nouveaux tests d'intégration dans `e2e/integration/` utilisant:
   - Le seeder `test_data_seeder.ts` pour les données
   - La vraie API (Docker PostgreSQL sur port 5433)
   - Mocks uniquement pour Stripe et services externes
