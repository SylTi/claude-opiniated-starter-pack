import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BillingCancelPage from '@/app/billing/cancel/page'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('BillingCancelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders cancelled message', () => {
    render(<BillingCancelPage />)

    expect(screen.getByText('Checkout Cancelled')).toBeInTheDocument()
    expect(screen.getByText(/No charges have been made/i)).toBeInTheDocument()
  })

  it('shows support message', () => {
    render(<BillingCancelPage />)

    expect(screen.getByText(/contact our support team/i)).toBeInTheDocument()
  })

  it('has button to view plans', () => {
    render(<BillingCancelPage />)

    const button = screen.getByText('View Plans')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockPush).toHaveBeenCalledWith('/billing')
  })

  it('has button to go to dashboard', () => {
    render(<BillingCancelPage />)

    const button = screen.getByText('Go to Dashboard')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows cancel icon', () => {
    render(<BillingCancelPage />)

    // Check for the cancel icon (XCircle renders an SVG)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('text-muted-foreground')
  })
})
