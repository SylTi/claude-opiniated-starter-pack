import Link from 'next/link'
import { Button } from '@saas/ui/button'
import { getServerI18n } from '@/lib/i18n/server'

export default async function NotFound(): Promise<React.ReactElement> {
  const { t } = await getServerI18n('skeleton')

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">
        {t('notFound.message')}
      </p>
      <Link href="/">
        <Button>{t('common.goHome')}</Button>
      </Link>
    </div>
  )
}
