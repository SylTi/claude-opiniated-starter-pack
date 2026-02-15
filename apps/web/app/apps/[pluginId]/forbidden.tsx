/**
 * Custom 403 Forbidden page for plugin access denial
 *
 * Displayed when a user lacks the required role to access a plugin.
 * Uses forbidden() from next/navigation to trigger this page.
 */

import { getServerI18n } from '@/lib/i18n/server'

export default async function Forbidden(): Promise<React.ReactElement> {
  const { t } = await getServerI18n('skeleton')

  return (
    <div className="container mx-auto py-8">
      <div className="rounded-lg border bg-destructive/10 p-6">
        <h1 className="text-2xl font-semibold mb-4">{t('plugin.accessDeniedTitle')}</h1>
        <p className="text-muted-foreground">
          {t('plugin.accessDeniedMessage')}
        </p>
      </div>
    </div>
  )
}
