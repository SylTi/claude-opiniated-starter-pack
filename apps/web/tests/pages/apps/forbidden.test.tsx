import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Forbidden from '@/app/apps/[pluginId]/forbidden'

describe('Forbidden Page', () => {
  it('renders access denied message', () => {
    render(<Forbidden />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Access Denied'
    )
    expect(
      screen.getByText(/don't have permission to access this plugin/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/contact your administrator/i)
    ).toBeInTheDocument()
  })

  it('uses destructive styling for the container', () => {
    const { container } = render(<Forbidden />)

    const alertBox = container.querySelector('.bg-destructive\\/10')
    expect(alertBox).toBeInTheDocument()
  })
})
