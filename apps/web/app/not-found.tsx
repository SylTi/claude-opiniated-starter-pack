import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound(): React.ReactElement {
  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">404 - Page Not Found</h1>
      <p className="text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link href="/">
        <Button>Go Home</Button>
      </Link>
    </div>
  )
}
