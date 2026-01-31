import { test } from '@japa/runner'
import { HookRegistry, HOOK_PRIORITY } from '@saas/plugins-core'

test.group('HookRegistry - Filters', () => {
  test('applies filter in registration order', async ({ assert }) => {
    const registry = new HookRegistry()

    registry.addFilter<number>('test:value', 'plugin-a', (value: number) => value + 1)
    registry.addFilter<number>('test:value', 'plugin-b', (value: number) => value * 2)

    const result = await registry.applyFilters('test:value', 5)
    // (5 + 1) * 2 = 12
    assert.equal(result, 12)
  })

  test('applies filters by priority (lower first)', async ({ assert }) => {
    const registry = new HookRegistry()

    // Register in wrong order but with priorities
    registry.addFilter<number>('test:value', 'plugin-b', (value: number) => value * 2, {
      priority: HOOK_PRIORITY.LOW,
    })
    registry.addFilter<number>('test:value', 'plugin-a', (value: number) => value + 1, {
      priority: HOOK_PRIORITY.HIGH,
    })

    const result = await registry.applyFilters('test:value', 5)
    // HIGH runs first: (5 + 1) * 2 = 12
    assert.equal(result, 12)
  })

  test('maintains registration order for same priority', async ({ assert }) => {
    const registry = new HookRegistry()
    const order: string[] = []

    registry.addFilter<string[]>('test:order', 'plugin-a', (arr: string[]) => {
      order.push('a')
      return arr
    })
    registry.addFilter<string[]>('test:order', 'plugin-b', (arr: string[]) => {
      order.push('b')
      return arr
    })
    registry.addFilter<string[]>('test:order', 'plugin-c', (arr: string[]) => {
      order.push('c')
      return arr
    })

    await registry.applyFilters('test:order', [])
    assert.deepEqual(order, ['a', 'b', 'c'])
  })

  test('returns original value when no filters registered', async ({ assert }) => {
    const registry = new HookRegistry()

    const result = await registry.applyFilters('nonexistent:hook', 'original')
    assert.equal(result, 'original')
  })

  test('isolates errors and continues with other filters', async ({ assert }) => {
    const registry = new HookRegistry()

    registry.addFilter<number>('test:value', 'plugin-a', (value: number) => value + 1)
    registry.addFilter<number>('test:value', 'plugin-b', () => {
      throw new Error('Filter error')
    })
    registry.addFilter<number>('test:value', 'plugin-c', (value: number) => value * 2)

    // Error in plugin-b is caught, continues with plugin-c
    const result = await registry.applyFilters('test:value', 5)
    // (5 + 1) * 2 = 12 (error skipped)
    assert.equal(result, 12)
  })

  test('passes context to filters', async ({ assert }) => {
    const registry = new HookRegistry()
    let receivedContext: Record<string, unknown> | undefined

    registry.addFilter<string>(
      'test:context',
      'plugin-a',
      (value: string, context?: Record<string, unknown>) => {
        receivedContext = context
        return value
      }
    )

    await registry.applyFilters('test:context', 'test', { userId: 123 })
    assert.deepEqual(receivedContext, { userId: 123 })
  })

  test('removes filter by plugin ID', async ({ assert }) => {
    const registry = new HookRegistry()

    registry.addFilter<number>('test:value', 'plugin-a', (value: number) => value + 1)
    registry.addFilter<number>('test:value', 'plugin-b', (value: number) => value * 2)

    const removed = registry.removeFilter('test:value', 'plugin-a')
    assert.isTrue(removed)

    const result = await registry.applyFilters('test:value', 5)
    // Only plugin-b runs: 5 * 2 = 10
    assert.equal(result, 10)
  })
})

test.group('HookRegistry - Actions', () => {
  test('executes actions in order', async ({ assert }) => {
    const registry = new HookRegistry()
    const order: string[] = []

    registry.addAction<void>('test:action', 'plugin-a', () => {
      order.push('a')
    })
    registry.addAction<void>('test:action', 'plugin-b', () => {
      order.push('b')
    })

    await registry.doAction('test:action', undefined)
    assert.deepEqual(order, ['a', 'b'])
  })

  test('executes actions by priority', async ({ assert }) => {
    const registry = new HookRegistry()
    const order: string[] = []

    registry.addAction<void>(
      'test:action',
      'plugin-b',
      () => {
        order.push('b')
      },
      {
        priority: HOOK_PRIORITY.LOW,
      }
    )
    registry.addAction<void>(
      'test:action',
      'plugin-a',
      () => {
        order.push('a')
      },
      {
        priority: HOOK_PRIORITY.HIGH,
      }
    )

    await registry.doAction('test:action', undefined)
    assert.deepEqual(order, ['a', 'b'])
  })

  test('isolates errors in actions', async ({ assert }) => {
    const registry = new HookRegistry()
    const order: string[] = []

    registry.addAction<void>('test:action', 'plugin-a', () => {
      order.push('a')
    })
    registry.addAction<void>('test:action', 'plugin-b', () => {
      throw new Error('Action error')
    })
    registry.addAction<void>('test:action', 'plugin-c', () => {
      order.push('c')
    })

    // Should not throw, continues with other actions
    await registry.doAction('test:action', undefined)
    assert.deepEqual(order, ['a', 'c'])
  })
})

test.group('HookRegistry - Management', () => {
  test('removes all hooks for a plugin', async ({ assert }) => {
    const registry = new HookRegistry()

    registry.addFilter<number>('filter:one', 'plugin-a', (v: number) => v + 1)
    registry.addFilter<number>('filter:two', 'plugin-a', (v: number) => v + 2)
    registry.addAction<void>('action:one', 'plugin-a', () => {})
    registry.addFilter<number>('filter:one', 'plugin-b', (v: number) => v * 2)

    registry.removeAllPluginHooks('plugin-a')

    assert.equal(registry.getFilterCount('filter:one'), 1) // only plugin-b remains
    assert.equal(registry.getFilterCount('filter:two'), 0)
    assert.equal(registry.getActionCount('action:one'), 0)
  })

  test('reports registered hooks', ({ assert }) => {
    const registry = new HookRegistry()

    registry.addFilter<unknown>('filter:a', 'plugin-a', (v: unknown) => v)
    registry.addFilter<unknown>('filter:b', 'plugin-a', (v: unknown) => v)
    registry.addAction<void>('action:a', 'plugin-a', () => {})

    const hooks = registry.getRegisteredHooks()
    assert.deepEqual(hooks.filters.sort(), ['filter:a', 'filter:b'])
    assert.deepEqual(hooks.actions, ['action:a'])
  })

  test('hasFilter returns correct value', ({ assert }) => {
    const registry = new HookRegistry()

    assert.isFalse(registry.hasFilter('test:hook'))

    registry.addFilter<unknown>('test:hook', 'plugin-a', (v: unknown) => v)
    assert.isTrue(registry.hasFilter('test:hook'))

    registry.removeFilter('test:hook', 'plugin-a')
    assert.isFalse(registry.hasFilter('test:hook'))
  })

  test('clear removes all hooks', ({ assert }) => {
    const registry = new HookRegistry()

    registry.addFilter<unknown>('filter:a', 'plugin-a', (v: unknown) => v)
    registry.addAction<void>('action:a', 'plugin-a', () => {})

    registry.clear()

    assert.isFalse(registry.hasFilter('filter:a'))
    assert.isFalse(registry.hasAction('action:a'))
  })
})
