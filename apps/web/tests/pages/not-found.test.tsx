import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotFound from '@/app/not-found'

describe('NotFound Page', () => {
  it('renders heading and message', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { name: /404/i })).toBeInTheDocument()
    expect(
      screen.getByText(/page you are looking for does not exist/i)
    ).toBeInTheDocument()
  })

  it('links to the homepage', () => {
    render(<NotFound />)

    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/')
  })

  it('is keyboard focusable', async () => {
    const user = userEvent.setup()
    render(<NotFound />)

    await user.tab()
    expect(screen.getByRole('link', { name: /go home/i })).toHaveFocus()
  })
})
