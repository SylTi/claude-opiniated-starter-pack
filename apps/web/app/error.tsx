'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps): React.ReactElement {
  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="outline">Go Home</Button>
        </Link>
      </div>
    </div>
  )
}
