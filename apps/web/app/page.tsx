import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black">
      <main className="container px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            SaaS Monorepo Starter
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            A production-ready monorepo setup with Next.js, AdonisJS, and TypeScript.
          </p>

          <div className="flex justify-center gap-4 mb-12">
            <Button asChild size="lg">
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mt-16">
            <Card>
              <CardHeader>
                <CardTitle>Next.js Frontend</CardTitle>
                <CardDescription>App Router with TypeScript</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Modern React framework with server components and optimized routing.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AdonisJS Backend</CardTitle>
                <CardDescription>TypeScript-first Node.js framework</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Full-featured MVC framework with Lucid ORM and built-in authentication.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shared Types</CardTitle>
                <CardDescription>End-to-end type safety</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Shared TypeScript types between frontend and backend for consistency.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
