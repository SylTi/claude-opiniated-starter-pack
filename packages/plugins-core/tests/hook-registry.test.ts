import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HookRegistry } from '../src/registry/hook_registry.js'
import { HOOK_PRIORITY } from '../src/types/hooks.js'

describe('HookRegistry', () => {
  let registry: HookRegistry

  beforeEach(() => {
    registry = new HookRegistry()
  })

  it('chains filters in order and returns modified data', async () => {
    registry.addFilter<string>('test:filter', 'plugin-a', (val) => val + '-a')
    registry.addFilter<string>('test:filter', 'plugin-b', (val) => val + '-b')

    const result = await registry.applyFilters('test:filter', 'start')
    expect(result).toBe('start-a-b')
  })

  it('calls all action handlers with data', async () => {
    const calls: string[] = []
    registry.addAction('test:action', 'plugin-a', () => { calls.push('a') })
    registry.addAction('test:action', 'plugin-b', () => { calls.push('b') })

    await registry.doAction('test:action', { event: true })
    expect(calls).toEqual(['a', 'b'])
  })

  it('respects priority ordering (lower number = earlier)', async () => {
    const calls: string[] = []
    registry.addAction('test:action', 'p-normal', () => { calls.push('normal') })
    registry.addAction('test:action', 'p-highest', () => { calls.push('highest') }, { priority: HOOK_PRIORITY.HIGHEST })
    registry.addAction('test:action', 'p-lowest', () => { calls.push('lowest') }, { priority: HOOK_PRIORITY.LOWEST })

    await registry.doAction('test:action', {})
    expect(calls).toEqual(['highest', 'normal', 'lowest'])
  })

  it('isolates errors — failing plugin does not break others', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const calls: string[] = []

    registry.addAction('test:action', 'plugin-a', () => { calls.push('a') })
    registry.addAction('test:action', 'plugin-bad', () => { throw new Error('boom') })
    registry.addAction('test:action', 'plugin-c', () => { calls.push('c') })

    await registry.doAction('test:action', {})
    expect(calls).toEqual(['a', 'c'])

    consoleSpy.mockRestore()
  })

  it('removeAllPluginHooks cleans up a single plugin without affecting others', () => {
    registry.addFilter('f1', 'plugin-a', (val) => val)
    registry.addAction('a1', 'plugin-a', () => {})
    registry.addFilter('f1', 'plugin-b', (val) => val)

    registry.removeAllPluginHooks('plugin-a')

    expect(registry.getFilterCount('f1')).toBe(1)
    expect(registry.getActionCount('a1')).toBe(0)
  })
})
