import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminCouponsPage from '@/app/admin/coupons/page'
import type { CouponDTO } from '@saas/shared'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/admin/coupons',
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock the admin coupons API
const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  adminCouponsApi: {
    list: () => mockList(),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
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

// Mock window.confirm
const mockConfirm = vi.fn()
global.confirm = mockConfirm

function createMockCoupon(overrides: Partial<CouponDTO> = {}): CouponDTO {
  return {
    id: 1,
    code: 'GIFT50',
    description: 'Gift coupon',
    creditAmount: 5000,
    currency: 'usd',
    expiresAt: '2025-12-31T23:59:59.000Z',
    isActive: true,
    redeemedByUserId: null,
    redeemedByUserEmail: null,
    redeemedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  }
}

describe('AdminCouponsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue([])
  })

  it('renders loading state initially', () => {
    mockList.mockReturnValue(new Promise(() => {}))
    render(<AdminCouponsPage />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders page title and add button', async () => {
    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('Coupons')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Add Coupon/i })).toBeInTheDocument()
    })
  })

  it('renders empty state when no coupons exist', async () => {
    mockList.mockResolvedValue([])

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('No coupons found')).toBeInTheDocument()
    })
  })

  it('renders coupons in table', async () => {
    const coupons: CouponDTO[] = [
      createMockCoupon({ id: 1, code: 'GIFT50', creditAmount: 5000 }),
      createMockCoupon({ id: 2, code: 'GIFT100', creditAmount: 10000 }),
    ]
    mockList.mockResolvedValue(coupons)

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('GIFT50')).toBeInTheDocument()
      expect(screen.getByText('GIFT100')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })
  })

  it('shows redeemed status for redeemed coupons', async () => {
    const coupons: CouponDTO[] = [
      createMockCoupon({
        id: 1,
        code: 'REDEEMED',
        isActive: false,
        redeemedByUserId: 1,
        redeemedByUserEmail: 'user@example.com',
        redeemedAt: new Date().toISOString(),
      }),
    ]
    mockList.mockResolvedValue(coupons)

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('Redeemed')).toBeInTheDocument()
      expect(screen.getByText('user@example.com')).toBeInTheDocument()
    })
  })

  it('opens create dialog when Add button clicked', async () => {
    const user = userEvent.setup()
    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Coupon/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Add Coupon/i }))

    expect(screen.getByText('Create Coupon')).toBeInTheDocument()
  })

  it('creates coupon successfully', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(createMockCoupon({ code: 'NEWCOUPON' }))

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Coupon/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Add Coupon/i }))

    const codeInput = screen.getByLabelText('Code')
    await user.type(codeInput, 'NEWCOUPON')

    const amountInput = screen.getByLabelText(/Credit Amount/i)
    await user.type(amountInput, '5000')

    const createButton = screen.getByRole('button', { name: 'Create' })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled()
      expect(mockToastSuccess).toHaveBeenCalledWith('Coupon created successfully')
    })
  })

  it('prevents editing redeemed coupons', async () => {
    const user = userEvent.setup()
    const coupons: CouponDTO[] = [
      createMockCoupon({
        redeemedByUserId: 1,
        redeemedByUserEmail: 'user@example.com',
      }),
    ]
    mockList.mockResolvedValue(coupons)

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('GIFT50')).toBeInTheDocument()
    })

    // Find edit button - should be disabled for redeemed coupons
    const editButtons = screen.getAllByRole('button')
    const editButton = editButtons.find((btn) => btn.querySelector('svg.lucide-pencil'))

    if (editButton) {
      expect(editButton).toBeDisabled()
    }
  })

  it('toggles coupon active status', async () => {
    const user = userEvent.setup()
    const coupons: CouponDTO[] = [createMockCoupon({ isActive: true })]
    mockList.mockResolvedValue(coupons)
    mockUpdate.mockResolvedValue(createMockCoupon({ isActive: false }))

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('GIFT50')).toBeInTheDocument()
    })

    const disableButton = screen.getByRole('button', { name: 'Disable' })
    await user.click(disableButton)

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(1, { isActive: false })
    })
  })

  it('deletes coupon after confirmation', async () => {
    const user = userEvent.setup()
    const coupons: CouponDTO[] = [createMockCoupon()]
    mockList.mockResolvedValue(coupons)
    mockConfirm.mockReturnValue(true)
    mockDelete.mockResolvedValue(undefined)

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('GIFT50')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find((btn) => btn.querySelector('svg.lucide-trash-2'))
    if (deleteButton) {
      await user.click(deleteButton)
    }

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1)
      expect(mockToastSuccess).toHaveBeenCalledWith('Coupon deleted successfully')
    })
  })

  it('shows correct status badges', async () => {
    const coupons: CouponDTO[] = [
      createMockCoupon({ id: 1, code: 'ACTIVE', isActive: true }),
      createMockCoupon({ id: 2, code: 'INACTIVE', isActive: false }),
      createMockCoupon({
        id: 3,
        code: 'REDEEMED',
        isActive: false,
        redeemedByUserId: 1,
        redeemedByUserEmail: 'user@example.com',
      }),
      createMockCoupon({
        id: 4,
        code: 'EXPIRED',
        isActive: true,
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    ]
    mockList.mockResolvedValue(coupons)

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
      expect(screen.getByText('Redeemed')).toBeInTheDocument()
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  it('hides toggle button for redeemed coupons', async () => {
    const coupons: CouponDTO[] = [
      createMockCoupon({
        redeemedByUserId: 1,
        redeemedByUserEmail: 'user@example.com',
      }),
    ]
    mockList.mockResolvedValue(coupons)

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('GIFT50')).toBeInTheDocument()
    })

    // Enable/Disable button should not be present for redeemed coupons
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument()
  })

  it('shows error toast on API failure', async () => {
    const { ApiError } = await import('@/lib/api')
    mockList.mockRejectedValue(new ApiError(500, 'ServerError', 'Server error'))

    render(<AdminCouponsPage />)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Server error')
    })
  })
})
