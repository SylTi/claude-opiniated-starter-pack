import type { ReactElement } from 'react'
import type { PluginAuthTokenKind } from '@saas/plugins-core'
import { getMainAppPluginId, loadClientPluginManifest } from '@saas/config/plugins/client'
import { getServerI18n } from '@/lib/i18n/server'
import IntegrationsClient from './integrations-client'

export default async function IntegrationsSettingsPage(): Promise<ReactElement> {
  const { t } = await getServerI18n('skeleton')
  const pluginId = getMainAppPluginId()
  const manifest = await loadClientPluginManifest(pluginId)
  const tokenKinds = (manifest?.authTokens?.kinds ?? []) as PluginAuthTokenKind[]
  const appName = manifest?.displayName ?? t('integrations.thisApp')

  return (
    <IntegrationsClient
      pluginId={pluginId}
      tokenKinds={tokenKinds}
      appName={appName}
    />
  )
}
