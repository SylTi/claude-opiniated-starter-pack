/**
 * Main App Design Implementation
 *
 * Provides the default design for the SaaS application.
 */

import type { AppDesign, ThemeTokens, NavModel, NavContext, NavSection, ShellProps } from '@saas/plugins-core'
import { mainAppText } from './translations.js'

/**
 * Server-side AppShell placeholder.
 * The actual React component is provided in client/index.ts via clientDesign.
 * This placeholder satisfies the type contract for server-side registration.
 */
function ServerAppShellPlaceholder(_props: ShellProps): unknown {
  // This should never be called on the server
  // The client-side clientDesign overrides this with the real component
  throw new Error(
    'ServerAppShellPlaceholder called - use clientDesign from @plugins/main-app/client for React rendering'
  )
}

/**
 * Default theme tokens.
 * Per spec: cssVars is the canonical substrate, typed properties are convenience extensions.
 */
function getAppTokens(): ThemeTokens {
  return {
    // Canonical CSS variables (per spec)
    cssVars: {
      '--brand': '#3b82f6',
      '--brand-hover': '#2563eb',
      '--brand-foreground': '#ffffff',
      '--background': '#ffffff',
      '--surface': '#f9fafb',
      '--foreground': '#111827',
      '--muted': '#6b7280',
      '--border': '#e5e7eb',
      '--error': '#ef4444',
      '--success': '#22c55e',
      '--warning': '#f59e0b',
      '--info': '#3b82f6',
      '--radius': '0.5rem',
      '--radius-sm': '0.25rem',
      '--radius-lg': '0.75rem',
    },

    // Convenience typed properties (map to cssVars)
    colorPrimary: '#3b82f6',
    colorPrimaryHover: '#2563eb',
    colorSecondary: '#64748b',
    colorBackground: '#ffffff',
    colorSurface: '#f9fafb',
    colorText: '#111827',
    colorTextMuted: '#6b7280',
    colorBorder: '#e5e7eb',
    colorError: '#ef4444',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorInfo: '#3b82f6',

    // Border radius
    borderRadius: '0.5rem',
    borderRadiusSm: '0.25rem',
    borderRadiusLg: '0.75rem',

    // Typography
    fontFamily: 'Geist, system-ui, sans-serif',
    fontFamilyHeading: 'Geist, system-ui, sans-serif',
    fontFamilyMono: 'Geist Mono, monospace',
    fontSize: '1rem',
    fontSizeSm: '0.875rem',
    fontSizeLg: '1.125rem',

    // Spacing
    spacingUnit: '0.25rem',

    // Shadows
    shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  }
}

/**
 * Build baseline navigation based on context.
 */
function getNavBaseline(context: NavContext): NavModel {
  const mainSections: NavSection[] = []
  const adminSections: NavSection[] = []
  const userMenuSections: NavSection[] = []

  // Main navigation for authenticated users
  // Each item is its own section so they render as direct links in the header
  // (NavSection renders multi-item sections as dropdowns)
  if (context.userRole) {
    // Dashboard - always shown
    mainSections.push({
      id: 'core.dashboard.section',
      label: mainAppText('nav.dashboard'),
      order: 100,
      items: [
        {
          id: 'core.dashboard',
          label: mainAppText('nav.dashboard'),
          href: '/dashboard',
          icon: 'LayoutDashboard',
          order: 100,
        },
      ],
    })

    // Notes link when tenant is selected
    // Uses /apps/* route which has proper access control checks
    if (context.tenantId) {
      mainSections.push({
        id: 'core.notes.section',
        label: mainAppText('nav.notes'),
        order: 200,
        items: [
          {
            id: 'core.notes',
            label: mainAppText('nav.notes'),
            href: '/apps/notes',
            icon: 'FileText',
            order: 100,
          },
        ],
      })
    }

    // Admin link for admin users
    if (context.userRole === 'admin') {
      mainSections.push({
        id: 'core.admin.link.section',
        label: mainAppText('nav.admin'),
        order: 900,
        items: [
          {
            id: 'core.admin.link',
            label: mainAppText('nav.admin'),
            href: '/admin/dashboard',
            icon: 'Shield',
            order: 100,
          },
        ],
      })
    }
  }

  // Admin sidebar navigation
  if (context.userRole === 'admin') {
    adminSections.push({
      id: 'core.admin.main',
      label: mainAppText('nav.administration'),
      order: 100,
      items: [
        {
          id: 'core.admin.dashboard',
          label: mainAppText('nav.dashboard'),
          href: '/admin/dashboard',
          icon: 'LayoutDashboard',
          order: 100,
        },
        {
          id: 'core.admin.users',
          label: mainAppText('nav.users'),
          href: '/admin/users',
          icon: 'Users',
          order: 200,
        },
        {
          id: 'core.admin.tenants',
          label: mainAppText('nav.tenants'),
          href: '/admin/tenants',
          icon: 'UsersRound',
          order: 300,
        },
        {
          id: 'core.admin.tiers',
          label: mainAppText('nav.tiers'),
          href: '/admin/tiers',
          icon: 'Layers',
          order: 400,
        },
        {
          id: 'core.admin.stripe',
          label: mainAppText('nav.stripe'),
          href: '/admin/stripe',
          icon: 'CreditCard',
          order: 500,
        },
        {
          id: 'core.admin.discounts',
          label: mainAppText('nav.discountCodes'),
          href: '/admin/discount-codes',
          icon: 'Tag',
          order: 600,
        },
        {
          id: 'core.admin.coupons',
          label: mainAppText('nav.coupons'),
          href: '/admin/coupons',
          icon: 'Ticket',
          order: 700,
        },
      ],
    })
  }

  // User menu for authenticated users
  if (context.userRole) {
    // Account section
    const accountItems = [
      {
        id: 'core.dashboard.menu',
        label: mainAppText('nav.dashboard'),
        href: '/dashboard',
        icon: 'LayoutDashboard',
        order: 50,
      },
      {
        id: 'core.profile',
        label: mainAppText('nav.profile'),
        href: '/profile',
        icon: 'User',
        order: 100,
      },
      {
        id: 'core.security',
        label: mainAppText('nav.security'),
        href: '/profile/security',
        icon: 'Shield',
        order: 200,
      },
      {
        id: 'core.settings',
        label: mainAppText('nav.settings'),
        href: '/profile/settings',
        icon: 'Settings',
        order: 300,
      },
    ]

    // Team link for paid tiers with tenant
    if (context.tenantId && context.tierLevel > 0) {
      accountItems.push({
        id: 'core.team',
        label: mainAppText('nav.team'),
        href: '/team',
        icon: 'UsersRound',
        order: 400,
      })
    }

    userMenuSections.push({
      id: 'core.account',
      label: mainAppText('nav.account'),
      order: 100,
      items: accountItems,
    })

    // Admin panel link for admins
    if (context.userRole === 'admin') {
      userMenuSections.push({
        id: 'core.admin.menu',
        label: mainAppText('nav.admin'),
        order: 800,
        items: [
          {
            id: 'core.admin.panel',
            label: mainAppText('nav.adminPanel'),
            href: '/admin/dashboard',
            icon: 'Users',
            order: 100,
          },
        ],
      })
    }

    // Logout is added automatically by ensureMandatoryItems
  }

  return {
    main: mainSections,
    admin: adminSections,
    userMenu: userMenuSections,
  }
}

/**
 * Main app design implementation.
 */
export const design: AppDesign = {
  designId: 'main-app',
  displayName: mainAppText('design.displayName'),

  appTokens: getAppTokens,

  navBaseline: getNavBaseline,

  // AppShell placeholder for server-side type compliance
  // The real React component is in clientDesign (client/index.ts)
  AppShell: ServerAppShellPlaceholder,

  // Admin override with branded tokens
  adminOverride: {
    tokens: {
      cssVars: {
        '--brand': '#111827',
        '--brand-hover': '#1f2937',
      },
      colorPrimary: '#111827',
      colorPrimaryHover: '#1f2937',
    },
  },

  onRegister: () => {
    console.log('[MainAppDesign] Design registered successfully')
  },
}
