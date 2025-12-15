import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

describe('Dashboard Page', () => {
  it('renders dashboard title', () => {
    render(<DashboardPage />)
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
  })

  it('displays welcome message', () => {
    render(<DashboardPage />)
    expect(screen.getByText(/Welcome to your SaaS dashboard/i)).toBeInTheDocument()
  })

  it('renders metric cards', () => {
    render(<DashboardPage />)

    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
  })

  it('displays metric values', () => {
    render(<DashboardPage />)

    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('$12,345')).toBeInTheDocument()
    expect(screen.getByText('573')).toBeInTheDocument()
  })

  it('renders quick action buttons', () => {
    render(<DashboardPage />)

    expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('displays growth percentages', () => {
    render(<DashboardPage />)

    expect(screen.getByText('+20% from last month')).toBeInTheDocument()
    expect(screen.getByText('+15% from last month')).toBeInTheDocument()
  })
})
