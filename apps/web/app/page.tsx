import Link from 'next/link'
import { Button } from '@saas/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas/ui/card'
import { getServerI18n } from '@/lib/i18n/server'

export default async function Home(): Promise<React.ReactElement> {
  const { t } = await getServerI18n('skeleton')

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="container px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            {t('home.title')}
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            {t('home.subtitle')}
          </p>

          <div className="flex justify-center gap-4 mb-12">
            <Button asChild size="lg">
              <Link href="/dashboard">{t('home.viewDashboard')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                {t('home.github')}
              </a>
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mt-16">
            <Card>
              <CardHeader>
                <CardTitle>{t('home.nextTitle')}</CardTitle>
                <CardDescription>{t('home.nextDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.nextBody')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('home.adonisTitle')}</CardTitle>
                <CardDescription>{t('home.adonisDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.adonisBody')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('home.sharedTitle')}</CardTitle>
                <CardDescription>{t('home.sharedDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.sharedBody')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
