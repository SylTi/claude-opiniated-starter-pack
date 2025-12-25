import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import BillingSuccessPage from '@/app/billing/success/page'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('BillingSuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders success message', () => {
    render(<BillingSuccessPage />)

    expect(screen.getByText('Payment Successful!')).toBeInTheDocument()
    expect(screen.getByText(/Thank you for your subscription/i)).toBeInTheDocument()
  })

  it('shows countdown timer', () => {
    render(<BillingSuccessPage />)

    expect(screen.getByText(/will be redirected.*5 seconds/i)).toBeInTheDocument()
  })

  it('decrements countdown each second', async () => {
    render(<BillingSuccessPage />)

    expect(screen.getByText(/5 seconds/i)).toBeInTheDocument()

    vi.advanceTimersByTime(1000)
    await waitFor(() => {
      expect(screen.getByText(/4 seconds/i)).toBeInTheDocument()
    })

    vi.advanceTimersByTime(1000)
    await waitFor(() => {
      expect(screen.getByText(/3 seconds/i)).toBeInTheDocument()
    })
  })

  it('redirects to billing after countdown', async () => {
    render(<BillingSuccessPage />)

    vi.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/billing')
    })
  })

  it('has button to go to billing immediately', () => {
    render(<BillingSuccessPage />)

    const button = screen.getByText('Go to Billing Now')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockPush).toHaveBeenCalledWith('/billing')
  })

  it('shows success icon', () => {
    render(<BillingSuccessPage />)

    // Check for the success icon (CheckCircle renders an SVG)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('text-green-500')
  })
})
