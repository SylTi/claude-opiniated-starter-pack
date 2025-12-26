import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BalanceCard } from '@/components/billing/balance-card'
import type { BalanceDTO } from '@saas/shared'

// Mock the billing API
const mockGetBalance = vi.fn()
vi.mock('@/lib/api', () => ({
  billingApi: {
    getBalance: (...args: unknown[]) => mockGetBalance(...args),
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

describe('BalanceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockGetBalance.mockReturnValue(new Promise(() => {})) // Never resolves
    render(<BalanceCard />)

    expect(screen.getByText('Account Balance')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders balance after loading', async () => {
    const balance: BalanceDTO = {
      balance: 5000,
      currency: 'usd',
    }
    mockGetBalance.mockResolvedValue(balance)

    render(<BalanceCard />)

    await waitFor(() => {
      expect(screen.getByText('$50.00')).toBeInTheDocument()
    })

    expect(screen.getByText('Your available credit balance')).toBeInTheDocument()
  })

  it('renders zero balance correctly', async () => {
    const balance: BalanceDTO = {
      balance: 0,
      currency: 'usd',
    }
    mockGetBalance.mockResolvedValue(balance)

    render(<BalanceCard />)

    await waitFor(() => {
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })
  })

  it('handles different currencies', async () => {
    const balance: BalanceDTO = {
      balance: 10000,
      currency: 'eur',
    }
    mockGetBalance.mockResolvedValue(balance)

    render(<BalanceCard />)

    await waitFor(() => {
      // EUR format may vary by locale, but should contain the amount
      expect(screen.getByText(/100/)).toBeInTheDocument()
    })
  })

  it('passes teamId when provided', async () => {
    const balance: BalanceDTO = {
      balance: 15000,
      currency: 'usd',
    }
    mockGetBalance.mockResolvedValue(balance)

    render(<BalanceCard teamId={123} />)

    await waitFor(() => {
      expect(mockGetBalance).toHaveBeenCalledWith(123)
    })
  })

  it('renders error state on API failure', async () => {
    const { ApiError } = await import('@/lib/api')
    mockGetBalance.mockRejectedValue(new ApiError(500, 'ServerError', 'Server error'))

    render(<BalanceCard />)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('shows informational text about balance usage', async () => {
    const balance: BalanceDTO = {
      balance: 5000,
      currency: 'usd',
    }
    mockGetBalance.mockResolvedValue(balance)

    render(<BalanceCard />)

    await waitFor(() => {
      expect(screen.getByText(/applied to your next invoice/i)).toBeInTheDocument()
    })
  })
})
