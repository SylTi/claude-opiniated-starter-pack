import { translatePlugin, type PluginTranslations } from '@saas/plugins-core'

const MAIN_APP_EN_CATALOG = {
  'design.displayName': 'Main Application Design',
  'nav.dashboard': 'Dashboard',
  'nav.notes': 'Notes',
  'nav.admin': 'Admin',
  'nav.administration': 'Administration',
  'nav.users': 'Users',
  'nav.tenants': 'Tenants',
  'nav.tiers': 'Tiers',
  'nav.stripe': 'Stripe',
  'nav.discountCodes': 'Discount Codes',
  'nav.coupons': 'Coupons',
  'nav.profile': 'Profile',
  'nav.security': 'Security',
  'nav.settings': 'Settings',
  'nav.team': 'Team',
  'nav.account': 'Account',
  'nav.adminPanel': 'Admin Panel',
} as const

type MainAppTranslationKey = keyof typeof MAIN_APP_EN_CATALOG

const MAIN_APP_FR_CATALOG: Partial<Record<MainAppTranslationKey, string>> = {
  'design.displayName': "Design de l'application principale",
  'nav.dashboard': 'Tableau de bord',
  'nav.notes': 'Notes',
  'nav.admin': 'Admin',
  'nav.administration': 'Administration',
  'nav.users': 'Utilisateurs',
  'nav.tenants': 'Tenants',
  'nav.tiers': 'Offres',
  'nav.stripe': 'Stripe',
  'nav.discountCodes': 'Codes promo',
  'nav.coupons': 'Coupons',
  'nav.profile': 'Profil',
  'nav.security': 'Sécurité',
  'nav.settings': 'Paramètres',
  'nav.team': 'Équipe',
  'nav.account': 'Compte',
  'nav.adminPanel': 'Panneau admin',
}

export const translations: PluginTranslations = {
  en: MAIN_APP_EN_CATALOG,
  fr: MAIN_APP_FR_CATALOG,
}

export function mainAppText(
  key: MainAppTranslationKey,
  options?: { locale?: string; defaultValue?: string; values?: Record<string, string | number> }
): string {
  return translatePlugin('main-app', key, {
    locale: options?.locale,
    values: options?.values,
    defaultValue: options?.defaultValue ?? MAIN_APP_EN_CATALOG[key],
  })
}
