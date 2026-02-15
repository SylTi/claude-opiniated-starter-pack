import { test } from '@japa/runner'
import { isValidPluginRoutePrefix } from '#services/plugins/plugin_route_mounter'

test.group('PluginRouteMounter prefix validation', () => {
  test('accepts base subpaths within plugin namespace', ({ assert }) => {
    const basePrefix = '/api/v1/apps/notes'

    assert.isTrue(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes/v2'))
    assert.isTrue(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes/v2/admin'))
  })

  test('rejects traversal prefixes that escape plugin namespace', ({ assert }) => {
    const basePrefix = '/api/v1/apps/notes'

    assert.isFalse(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes/../../admin'))
    assert.isFalse(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes/./v2'))
    assert.isFalse(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes//v2'))
  })

  test('rejects prefixes with query/hash/backslash', ({ assert }) => {
    const basePrefix = '/api/v1/apps/notes'

    assert.isFalse(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes/v2?x=1'))
    assert.isFalse(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes/v2#frag'))
    assert.isFalse(isValidPluginRoutePrefix(basePrefix, '/api/v1/apps/notes\\v2'))
  })
})
