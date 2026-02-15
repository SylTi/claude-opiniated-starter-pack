'use client'

import Link from 'next/link'
import { Button } from '@saas/ui/button'
import { useI18n } from '@/contexts/i18n-context'

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps): React.ReactElement {
  const { t } = useI18n('skeleton')

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">{t('error.title')}</h1>
      <p className="text-muted-foreground">
        {error.message || t('common.unexpectedError')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{t('common.tryAgain')}</Button>
        <Link href="/">
          <Button variant="outline">{t('common.goHome')}</Button>
        </Link>
      </div>
    </div>
  )
}
