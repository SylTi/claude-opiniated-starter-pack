import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorPage from '@/app/error'

describe('Error Page', () => {
  it('renders the error message', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('Boom')} reset={reset} />)

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })

  it('calls reset when clicking Try again', async () => {
    const reset = vi.fn()
    const user = userEvent.setup()
    render(<ErrorPage error={new Error('Boom')} reset={reset} />)

    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalled()
  })

  it('links back home', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('Boom')} reset={reset} />)

    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/')
  })
})
