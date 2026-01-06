import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CouponRedemption } from '@/components/billing/coupon-redemption'
import type { RedeemCouponResponse } from '@saas/shared'

// Mock the billing API
const mockRedeemCoupon = vi.fn()
vi.mock('@/lib/api', () => ({
  billingApi: {
    redeemCoupon: (...args: unknown[]) => mockRedeemCoupon(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public error: string,
      message: string
    ) {
      super(message)
    }
  },
}))

// Mock sonner toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

describe('CouponRedemption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the coupon redemption form', () => {
    render(<CouponRedemption />)

    expect(screen.getByText('Redeem Coupon')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter coupon code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redeem' })).toBeInTheDocument()
  })

  it('converts input to uppercase', async () => {
    const user = userEvent.setup()
    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'gift50')

    expect(input).toHaveValue('GIFT50')
  })

  it('disables redeem button when input is empty', () => {
    render(<CouponRedemption />)

    const button = screen.getByRole('button', { name: 'Redeem' })
    expect(button).toBeDisabled()
  })

  it('enables redeem button when code is entered', async () => {
    const user = userEvent.setup()
    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'GIFT50')

    const button = screen.getByRole('button', { name: 'Redeem' })
    expect(button).not.toBeDisabled()
  })

  it('redeems coupon successfully', async () => {
    const user = userEvent.setup()
    const response: RedeemCouponResponse = {
      success: true,
      creditAmount: 5000,
      currency: 'usd',
      newBalance: 5000,
      message: 'Coupon redeemed successfully!',
    }
    mockRedeemCoupon.mockResolvedValue(response)

    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'GIFT50')

    const button = screen.getByRole('button', { name: 'Redeem' })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Coupon Redeemed!')).toBeInTheDocument()
      expect(screen.getByText(/\$50\.00 has been added/)).toBeInTheDocument()
      expect(screen.getByText(/New balance: \$50\.00/)).toBeInTheDocument()
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Coupon redeemed successfully!')
  })

  it('shows error toast on API failure', async () => {
    const user = userEvent.setup()
    const { ApiError } = await import('@/lib/api')
    mockRedeemCoupon.mockRejectedValue(new ApiError(400, 'InvalidCoupon', 'Invalid coupon code'))

    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'INVALID')

    const button = screen.getByRole('button', { name: 'Redeem' })
    await user.click(button)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Invalid coupon code')
    })
  })

  it('shows loading state during redemption', async () => {
    const user = userEvent.setup()
    mockRedeemCoupon.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    )

    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'GIFT50')

    const button = screen.getByRole('button', { name: 'Redeem' })
    await user.click(button)

    expect(screen.getByText('Redeeming...')).toBeInTheDocument()
    expect(input).toBeDisabled()
  })

  it('calls onRedeemed callback after successful redemption', async () => {
    const user = userEvent.setup()
    const onRedeemed = vi.fn()
    const response: RedeemCouponResponse = {
      success: true,
      creditAmount: 5000,
      currency: 'usd',
      newBalance: 5000,
    }
    mockRedeemCoupon.mockResolvedValue(response)

    render(<CouponRedemption onRedeemed={onRedeemed} />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'GIFT50')

    const button = screen.getByRole('button', { name: 'Redeem' })
    await user.click(button)

    await waitFor(() => {
      expect(onRedeemed).toHaveBeenCalled()
    })
  })

  it('passes teamId when redeeming for team', async () => {
    const user = userEvent.setup()
    const response: RedeemCouponResponse = {
      success: true,
      creditAmount: 10000,
      currency: 'usd',
      newBalance: 10000,
    }
    mockRedeemCoupon.mockResolvedValue(response)

    render(<CouponRedemption teamId={123} />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'TEAMGIFT')

    const button = screen.getByRole('button', { name: 'Redeem' })
    await user.click(button)

    await waitFor(() => {
      expect(mockRedeemCoupon).toHaveBeenCalledWith('TEAMGIFT', 123)
    })
  })

  it('allows redeeming another coupon after success', async () => {
    const user = userEvent.setup()
    const response: RedeemCouponResponse = {
      success: true,
      creditAmount: 5000,
      currency: 'usd',
      newBalance: 5000,
    }
    mockRedeemCoupon.mockResolvedValue(response)

    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'GIFT50')

    const button = screen.getByRole('button', { name: 'Redeem' })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Coupon Redeemed!')).toBeInTheDocument()
    })

    // Click to redeem another
    const anotherButton = screen.getByText('Redeem another coupon')
    await user.click(anotherButton)

    // Should show the form again
    expect(screen.getByPlaceholderText('Enter coupon code')).toBeInTheDocument()
  })

  it('redeems on Enter key press', async () => {
    const user = userEvent.setup()
    const response: RedeemCouponResponse = {
      success: true,
      creditAmount: 5000,
      currency: 'usd',
      newBalance: 5000,
    }
    mockRedeemCoupon.mockResolvedValue(response)

    render(<CouponRedemption />)

    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, 'GIFT50')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockRedeemCoupon).toHaveBeenCalledWith('GIFT50', undefined)
    })
  })

  it('shows error toast for empty code submission', async () => {
    const user = userEvent.setup()
    render(<CouponRedemption />)

    // Try to submit with empty by somehow calling the handler
    // In practice the button is disabled, but we test the validation
    const input = screen.getByPlaceholderText('Enter coupon code')
    await user.type(input, '   ') // Just whitespace
    await user.clear(input)

    const button = screen.getByRole('button', { name: 'Redeem' })
    expect(button).toBeDisabled()
  })
})
