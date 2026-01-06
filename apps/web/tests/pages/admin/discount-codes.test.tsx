import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDiscountCodesPage from '@/app/admin/discount-codes/page'
import type { DiscountCodeDTO } from '@saas/shared'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/admin/discount-codes',
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock the admin discount codes API
const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  adminDiscountCodesApi: {
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
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock window.confirm
const mockConfirm = vi.fn()
global.confirm = mockConfirm

function createMockDiscountCode(overrides: Partial<DiscountCodeDTO> = {}): DiscountCodeDTO {
  return {
    id: 1,
    code: 'SUMMER20',
    description: 'Summer sale',
    discountType: 'percent',
    discountValue: 20,
    currency: null,
    minAmount: null,
    maxUses: 100,
    maxUsesPerUser: 1,
    timesUsed: 5,
    expiresAt: '2025-12-31T23:59:59.000Z',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  }
}

describe('AdminDiscountCodesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue([])
  })

  it('renders loading state initially', () => {
    mockList.mockReturnValue(new Promise(() => {}))
    render(<AdminDiscountCodesPage />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders page title and add button', async () => {
    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('Discount Codes')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Add Discount Code/i })).toBeInTheDocument()
    })
  })

  it('renders empty state when no discount codes exist', async () => {
    mockList.mockResolvedValue([])

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('No discount codes found')).toBeInTheDocument()
    })
  })

  it('renders discount codes in table', async () => {
    const codes: DiscountCodeDTO[] = [
      createMockDiscountCode({ id: 1, code: 'SUMMER20', discountValue: 20 }),
      createMockDiscountCode({
        id: 2,
        code: 'FIXED10',
        discountType: 'fixed',
        discountValue: 1000,
        currency: 'usd',
      }),
    ]
    mockList.mockResolvedValue(codes)

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeInTheDocument()
      expect(screen.getByText('FIXED10')).toBeInTheDocument()
      expect(screen.getByText('20%')).toBeInTheDocument()
      expect(screen.getByText('$10.00')).toBeInTheDocument()
    })
  })

  it('shows usage count with max uses', async () => {
    const codes: DiscountCodeDTO[] = [
      createMockDiscountCode({ timesUsed: 5, maxUses: 100 }),
    ]
    mockList.mockResolvedValue(codes)

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('5 / 100')).toBeInTheDocument()
    })
  })

  it('opens create dialog when Add button clicked', async () => {
    const user = userEvent.setup()
    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Discount Code/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Add Discount Code/i }))

    expect(screen.getByText('Create Discount Code')).toBeInTheDocument()
  })

  it('creates discount code successfully', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(createMockDiscountCode({ code: 'NEWCODE' }))

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Discount Code/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Add Discount Code/i }))

    const codeInput = screen.getByLabelText('Code')
    await user.type(codeInput, 'NEWCODE')

    const valueInput = screen.getByLabelText(/Percentage/i)
    await user.type(valueInput, '15')

    const createButton = screen.getByRole('button', { name: 'Create' })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled()
    })
  })

  it('opens edit dialog when edit button clicked', async () => {
    const user = userEvent.setup()
    const codes: DiscountCodeDTO[] = [createMockDiscountCode()]
    mockList.mockResolvedValue(codes)

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    })

    // Find and click edit button (Pencil icon button)
    const editButtons = screen.getAllByRole('button')
    const editButton = editButtons.find((btn) => btn.querySelector('svg.lucide-pencil'))
    if (editButton) {
      await user.click(editButton)
    }

    expect(screen.getByText('Edit Discount Code')).toBeInTheDocument()
  })

  it('toggles discount code active status', async () => {
    const user = userEvent.setup()
    const codes: DiscountCodeDTO[] = [createMockDiscountCode({ isActive: true })]
    mockList.mockResolvedValue(codes)
    mockUpdate.mockResolvedValue(createMockDiscountCode({ isActive: false }))

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    })

    const disableButton = screen.getByRole('button', { name: 'Disable' })
    await user.click(disableButton)

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(1, { isActive: false })
    })
  })

  it('deletes discount code after confirmation', async () => {
    const user = userEvent.setup()
    const codes: DiscountCodeDTO[] = [createMockDiscountCode()]
    mockList.mockResolvedValue(codes)
    mockConfirm.mockReturnValue(true)
    mockDelete.mockResolvedValue(undefined)

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    })

    // Find and click delete button (Trash icon button)
    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find((btn) => btn.querySelector('svg.lucide-trash-2'))
    if (deleteButton) {
      await user.click(deleteButton)
    }

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1)
    })
  })

  it('does not delete when confirmation cancelled', async () => {
    const user = userEvent.setup()
    const codes: DiscountCodeDTO[] = [createMockDiscountCode()]
    mockList.mockResolvedValue(codes)
    mockConfirm.mockReturnValue(false)

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find((btn) => btn.querySelector('svg.lucide-trash-2'))
    if (deleteButton) {
      await user.click(deleteButton)
    }

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('shows active/inactive badge correctly', async () => {
    const codes: DiscountCodeDTO[] = [
      createMockDiscountCode({ id: 1, code: 'ACTIVE', isActive: true }),
      createMockDiscountCode({ id: 2, code: 'INACTIVE', isActive: false }),
    ]
    mockList.mockResolvedValue(codes)

    render(<AdminDiscountCodesPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })
})
