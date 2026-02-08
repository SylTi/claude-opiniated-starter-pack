import { test } from '@japa/runner'
import type { PluginHttpContext, PluginManifest } from '@saas/plugins-core'
import {
  createPluginFeaturePolicyService,
  PluginFeatureDisabledError,
} from '#services/plugins/plugin_feature_policy_service'

function createManifest(): PluginManifest {
  return {
    pluginId: 'collab',
    packageName: '@plugins/collab',
    version: '1.0.0',
    tier: 'C',
    requestedCapabilities: [],
    features: {
      comments: { defaultEnabled: true },
      mentions: { defaultEnabled: false },
    },
  }
}

function createCtx(config: Record<string, unknown> | null): PluginHttpContext {
  return {
    plugin: {
      id: 'collab',
      grantedCapabilities: [],
      state: {
        config,
      },
    },
  }
}

test.group('PluginFeaturePolicyService', () => {
  test('uses manifest default when no tenant override is set', async ({ assert }) => {
    const policy = createPluginFeaturePolicyService({
      pluginId: 'collab',
      manifest: createManifest(),
    })

    const enabled = await policy.has('comments', createCtx(null))
    const disabled = await policy.has('mentions', createCtx(null))

    assert.isTrue(enabled)
    assert.isFalse(disabled)
  })

  test('applies tenant feature override from plugin state config', async ({ assert }) => {
    const policy = createPluginFeaturePolicyService({
      pluginId: 'collab',
      manifest: createManifest(),
    })

    const enabled = await policy.has(
      'comments',
      createCtx({
        features: {
          comments: false,
        },
      })
    )

    assert.isFalse(enabled)
  })

  test('hard-disable takes precedence over tenant override', async ({ assert }) => {
    const policy = createPluginFeaturePolicyService({
      pluginId: 'collab',
      manifest: createManifest(),
      hardDisabledFeatures: new Set(['comments']),
    })

    const enabled = await policy.has(
      'comments',
      createCtx({
        features: {
          comments: true,
        },
      })
    )

    assert.isFalse(enabled)
  })

  test('require throws PluginFeatureDisabledError for disabled features', async ({ assert }) => {
    const policy = createPluginFeaturePolicyService({
      pluginId: 'collab',
      manifest: createManifest(),
    })

    try {
      await policy.require(
        'mentions',
        createCtx({
          features: {
            mentions: false,
          },
        })
      )
      assert.fail('Expected feature gate require() to throw')
    } catch (error) {
      assert.instanceOf(error, PluginFeatureDisabledError)
      assert.equal((error as PluginFeatureDisabledError).code, 'E_FEATURE_DISABLED')
      assert.equal((error as PluginFeatureDisabledError).featureId, 'mentions')
    }
  })
})
