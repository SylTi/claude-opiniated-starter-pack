import { describe, it, expect } from 'vitest'
import { ACTION_HOOKS, FILTER_HOOKS, HOOK_PRIORITY } from '../src/types/hooks.js'

describe('ACTION_HOOKS constants', () => {
  it('has all lifecycle hooks', () => {
    expect(ACTION_HOOKS['app:boot']).toBe('app:boot')
    expect(ACTION_HOOKS['app:ready']).toBe('app:ready')
    expect(ACTION_HOOKS['app:shutdown']).toBe('app:shutdown')
  })

  it('has all auth hooks from spec', () => {
    expect(ACTION_HOOKS['auth:registered']).toBe('auth:registered')
    expect(ACTION_HOOKS['auth:logged_in']).toBe('auth:logged_in')
    expect(ACTION_HOOKS['auth:logged_out']).toBe('auth:logged_out')
    expect(ACTION_HOOKS['auth:mfa_verified']).toBe('auth:mfa_verified')
    expect(ACTION_HOOKS['auth:password_reset']).toBe('auth:password_reset')
  })

  it('has all team hooks from spec plus additions', () => {
    expect(ACTION_HOOKS['team:created']).toBe('team:created')
    expect(ACTION_HOOKS['team:updated']).toBe('team:updated')
    expect(ACTION_HOOKS['team:deleted']).toBe('team:deleted')
    expect(ACTION_HOOKS['team:member_added']).toBe('team:member_added')
    expect(ACTION_HOOKS['team:member_removed']).toBe('team:member_removed')
    expect(ACTION_HOOKS['team:member_left']).toBe('team:member_left')
    expect(ACTION_HOOKS['team:switched']).toBe('team:switched')
  })

  it('has all billing hooks from spec plus additions', () => {
    expect(ACTION_HOOKS['billing:customer_created']).toBe('billing:customer_created')
    expect(ACTION_HOOKS['billing:subscription_created']).toBe('billing:subscription_created')
    expect(ACTION_HOOKS['billing:subscription_updated']).toBe('billing:subscription_updated')
    expect(ACTION_HOOKS['billing:subscription_cancelled']).toBe('billing:subscription_cancelled')
    expect(ACTION_HOOKS['billing:invoice_paid']).toBe('billing:invoice_paid')
    expect(ACTION_HOOKS['billing:payment_failed']).toBe('billing:payment_failed')
  })

  it('has compliance hooks', () => {
    expect(ACTION_HOOKS['audit:record']).toBe('audit:record')
  })

  it('has no duplicate values', () => {
    const values = Object.values(ACTION_HOOKS)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })

  it('keys match their values (convention: key === value)', () => {
    for (const [key, value] of Object.entries(ACTION_HOOKS)) {
      expect(key).toBe(value)
    }
  })

  it('contains expected total count of hooks', () => {
    const keys = Object.keys(ACTION_HOOKS)
    // 3 lifecycle + 5 auth + 7 team + 6 billing + 1 audit = 22
    expect(keys.length).toBe(22)
  })
})

describe('FILTER_HOOKS constants', () => {
  it('has navigation and dashboard hooks', () => {
    expect(FILTER_HOOKS['ui:nav:main']).toBe('ui:nav:main')
    expect(FILTER_HOOKS['ui:nav:admin']).toBe('ui:nav:admin')
    expect(FILTER_HOOKS['ui:user:menu']).toBe('ui:user:menu')
    expect(FILTER_HOOKS['dashboard:widgets']).toBe('dashboard:widgets')
    expect(FILTER_HOOKS['dashboard:stats']).toBe('dashboard:stats')
  })
})

describe('HOOK_PRIORITY constants', () => {
  it('has expected priority levels in ascending order', () => {
    expect(HOOK_PRIORITY.HIGHEST).toBe(0)
    expect(HOOK_PRIORITY.HIGH).toBe(25)
    expect(HOOK_PRIORITY.NORMAL).toBe(50)
    expect(HOOK_PRIORITY.LOW).toBe(75)
    expect(HOOK_PRIORITY.LOWEST).toBe(100)
    expect(HOOK_PRIORITY.HIGHEST).toBeLessThan(HOOK_PRIORITY.LOWEST)
  })
})
