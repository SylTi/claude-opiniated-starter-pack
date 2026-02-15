import { test } from '@japa/runner'
import { isValidReturnUrl } from '#controllers/payment_controller'

test.group('PaymentController return URL validation', () => {
  test('accepts same-origin URLs', ({ assert }) => {
    assert.isTrue(isValidReturnUrl('https://app.example.com/billing', 'https://app.example.com'))
  })

  test('rejects scheme downgrade with same host', ({ assert }) => {
    assert.isFalse(isValidReturnUrl('http://app.example.com/billing', 'https://app.example.com'))
  })

  test('rejects cross-origin URLs', ({ assert }) => {
    assert.isFalse(isValidReturnUrl('https://evil.example.com/billing', 'https://app.example.com'))
  })
})
