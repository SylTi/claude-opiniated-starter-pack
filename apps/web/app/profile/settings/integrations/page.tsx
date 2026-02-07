import type { ReactElement } from 'react'
import type { PluginAuthTokenKind } from '@saas/plugins-core'
import { getMainAppPluginId, loadClientPluginManifest } from '@saas/config/plugins/client'
import IntegrationsClient from './integrations-client'

export default async function IntegrationsSettingsPage(): Promise<ReactElement> {
  const pluginId = getMainAppPluginId()
  const manifest = await loadClientPluginManifest(pluginId)
  const tokenKinds = (manifest?.authTokens?.kinds ?? []) as PluginAuthTokenKind[]
  const appName = manifest?.displayName ?? 'this app'

  return (
    <IntegrationsClient
      pluginId={pluginId}
      tokenKinds={tokenKinds}
      appName={appName}
    />
  )
}
